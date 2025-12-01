// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../interfaces/IEulerV2Plugin.sol";
import "../interfaces/IBeacon.sol";
import "../interfaces/IProxyGeneral.sol";
import "../interfaces/ITokenManagerForModules.sol";
import "../interfaces/IFlashLoanCallback.sol";
import "../interfaces/euler/IEVault.sol";
import "../interfaces/euler/IEVC.sol";
import "../interfaces/euler/ISwapper.sol";
import "../interfaces/euler/IAccountLens.sol";

// Forward declaration per FlashLoanService
interface IFlashLoanService {
    function executeFlashLoan(
        address[] calldata tokens,
        uint256[] calldata amounts,
        bytes calldata callbackData
    ) external;
    function swap(address tokenIn, address tokenOut, uint256 amountIn) external returns (uint256);
    function getExpectedOutput(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256);
}

// Forward declaration per EulerVaultRegistry
interface IEulerVaultRegistry {
    function getVault(string memory tokenCode) external view returns (address);
    function getVaultSafe(string memory tokenCode) external view returns (address);
    function getTokenCode(address vault) external view returns (string memory);
    function isRegistered(string memory tokenCode) external view returns (bool);
    function getAllRegisteredTokens() external view returns (string[] memory);
}

/**
 * @title EulerV2Plugin
 * @notice Plugin per integrazione Euler V2 lending protocol via ProtocolManager
 * @dev Implementa IEulerV2Plugin (che estende ILendingProtocol)
 * 
 * ARCHITETTURA:
 * - Gestito da ProtocolManager (orchestratore centrale)
 * - Custody flow: ProxyGeneral → ProtocolManager → EulerV2Plugin → Euler Vaults
 * - Operazioni comuni: deposit, withdraw, borrow, repay (via ILendingProtocol)
 * - Operazioni leverage: openLeveragePosition, closeLeveragePosition (via IEulerV2Plugin)
 * 
 * EULER V2 SPECIFICO:
 * - EVC (Ethereum Vault Connector): Hub per batching e sub-accounts
 * - Sub-account 0: Depositi semplici (yield farming)
 * - Sub-account 1-255: Posizioni leverage isolate
 * - FlashLoanService: Per operazioni leverage atomiche via Balancer flash loans
 * 
 * CUSTODY MODEL:
 * - ProtocolManager chiama deposit/withdraw/borrow/repay
 * - Plugin si aspetta token già nel contratto (inviati da ProtocolManager)
 * - Plugin restituisce token a ProxyGeneral dopo operazioni
 * - Operazioni leverage usano FlashLoanService centralizzato
 * 
 * INDIRIZZI ARBITRUM:
 * - EVC: 0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066
 * - FlashLoanService: Risolto via Beacon
 * 
 * @author Project4 Team
 * @custom:version 2.0.0
 */
contract EulerV2Plugin is IEulerV2Plugin, IFlashLoanCallback, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ==================== IMMUTABLES ====================
    
    /// @notice Beacon per risoluzione moduli (ProxyGeneral, TokenManager, EulerVaultRegistry)
    address public immutable beacon;
    
    /// @notice Euler Vault Connector (hub centrale)
    IEVC public immutable evc;
    
    // ==================== CONSTANTS ====================
    
    /// @notice Indirizzo EVC su Arbitrum
    address public constant EVC_ADDRESS = 0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066;
    
    /// @notice Indirizzo AccountLens su Arbitrum (per health factor)
    address public constant ACCOUNT_LENS_ADDRESS = 0x90a52DDcb232e7bb003DD9258fA1235c553eC956;
    
    /// @notice WETH su Arbitrum (hardcoded per fallback)
    address public constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    
    /// @notice USDC su Arbitrum (hardcoded per fallback)
    address public constant USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    
    /// @notice WETH Vault su Arbitrum (hardcoded per fallback)
    address public constant WETH_VAULT = 0x78E3E051D32157AACD550fBB78458762d8f7edFF;
    
    /// @notice USDC Vault su Arbitrum (hardcoded per fallback)
    address public constant USDC_VAULT = 0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899;
    
    /// @notice Minimum health factor (1.05 = 105%)
    uint256 public constant MIN_HEALTH_FACTOR = 1.05e18;
    
    /// @notice Sub-account ID per depositi semplici
    uint8 public constant MAIN_SUB_ACCOUNT = 0;
    
    /// @notice Primo sub-account ID per posizioni leverage
    uint8 public constant LEVERAGE_SUB_ACCOUNT_START = 1;
    
    // ==================== STATE VARIABLES ====================
    
    /// @notice Circuit breaker flag (emergency stop)
    bool public override circuitBreakerTripped;
    
    /// @notice Prossimo position ID da assegnare
    uint256 public override nextPositionId;
    
    /// @notice Mapping positionId → LeveragePosition
    mapping(uint256 => LeveragePositionInternal) internal _positions;
    
    /// @notice Prossimo sub-account ID disponibile per leverage
    uint8 public nextSubAccountId;
    
    /// @notice Flag per verificare callback flash loan legittimo
    bool private _inFlashLoanCallback;
    
    /// @notice Contesto temporaneo durante flash loan
    FlashLoanCallbackContext private _flashLoanContext;
    
    // ==================== INTERNAL STRUCTS ====================
    
    /// @notice Struct interna per storage (senza positionId per risparmiare gas)
    struct LeveragePositionInternal {
        uint8 subAccountId;
        address collateralVault;
        address borrowVault;
        uint256 initialCollateral;
        uint256 borrowedAmount;
        bool isActive;
        uint256 createdAt;
    }
    
    /// @notice Tipo di operazione flash loan
    enum FlashLoanOperation { OPEN, CLOSE }
    
    /// @notice Contesto per callback flash loan
    struct FlashLoanCallbackContext {
        FlashLoanOperation operation;   // OPEN o CLOSE
        address user;
        address collateralVault;
        address borrowVault;
        uint256 targetLeverageX100;      // Solo per OPEN
        uint256 initialCollateral;       // Solo per OPEN
        uint256 minHealthFactor;         // Solo per OPEN
        uint256 maxSlippageBps;          // Solo per CLOSE (basis points, e.g., 100 = 1%)
    }
    
    // ==================== ERRORS ====================
    
    error InvalidAddress();
    error CircuitBreakerActive();
    error TokenNotRegistered(string tokenCode);
    error VaultNotFound(string tokenCode);
    error InsufficientBalance(uint256 available, uint256 requested);
    error DepositFailed(string tokenCode, uint256 amount);
    error WithdrawalFailed(string tokenCode, uint256 amount);
    error BorrowFailed(string tokenCode, uint256 amount);
    error RepayFailed(string tokenCode, uint256 amount);
    error PositionNotFound(uint256 positionId);
    error PositionNotActive(uint256 positionId);
    error PositionAlreadyClosed(uint256 positionId);
    error OnlyProtocolManager();
    error NoPositionToClose();
    error SlippageExceeded(uint256 expected, uint256 actual);
    error DeadlineExpired();
    error HealthFactorTooLow(uint256 current, uint256 minimum);
    error InvalidLeverage();
    error UnauthorizedFlashLoanCallback();
    error FlashLoanServiceNotFound();
    error SwapFailed();
    
    // ==================== EVENTS ====================
    
    event EulerDeposit(
        string indexed tokenCode,
        address indexed vault,
        uint256 amount,
        uint256 sharesReceived
    );
    
    event EulerWithdrawal(
        string indexed tokenCode,
        address indexed vault,
        uint256 amount,
        uint256 sharesBurned
    );
    
    event EulerBorrow(
        string indexed tokenCode,
        address indexed vault,
        uint256 amount
    );
    
    event EulerRepay(
        string indexed tokenCode,
        address indexed vault,
        uint256 amount
    );
    
    event EmergencyWithdraw(
        string indexed tokenCode,
        uint256 amount
    );
    
    event CollateralEnabled(
        address indexed vault,
        address indexed account
    );
    
    event ControllerEnabled(
        address indexed vault,
        address indexed account
    );
    
    event CollateralDisabled(
        address indexed vault,
        address indexed account
    );
    
    event ControllerDisabled(
        address indexed vault,
        address indexed account
    );
    
    event LeverageOpenedAtomic(
        address indexed user,
        address indexed collateralVault,
        address indexed borrowVault,
        uint256 initialCollateral,
        uint256 totalCollateral,
        uint256 totalDebt,
        uint256 healthFactor,
        uint256 targetLeverageX100
    );
    
    event LeverageClosedAtomic(
        address indexed user,
        address indexed collateralVault,
        address indexed borrowVault,
        uint256 debtRepaid,
        uint256 collateralWithdrawn,
        uint256 collateralReturned
    );
    
    // ==================== MODIFIERS ====================
    
    /// @notice Verifica che il circuit breaker non sia attivo
    modifier notCircuitBroken() {
        if (circuitBreakerTripped) revert CircuitBreakerActive();
        _;
    }
    
    /// @notice Solo ProtocolManager può chiamare
    modifier onlyProtocolManager() {
        address protocolManager = IBeacon(beacon).getImplementation("ProtocolManager");
        if (msg.sender != protocolManager && msg.sender != owner()) {
            revert OnlyProtocolManager();
        }
        _;
    }
    
    /// @notice Owner o LiquidityManager possono chiamare (per auto-close posizioni)
    /// @dev Coerente con SwapManager.onlyAuthorizedCaller pattern
    modifier onlyOwnerOrLiquidityManager() {
        address liquidityManager = IBeacon(beacon).getImplementation("LiquidityManager");
        require(
            msg.sender == owner() || msg.sender == liquidityManager,
            "EulerV2Plugin: not authorized"
        );
        _;
    }
    
    // ==================== CONSTRUCTOR ====================
    
    /**
     * @notice Costruttore del plugin
     * @param _beacon Indirizzo del Beacon per risoluzione moduli
     */
    constructor(address _beacon) Ownable() {
        if (_beacon == address(0)) revert InvalidAddress();
        
        beacon = _beacon;
        evc = IEVC(EVC_ADDRESS);
        nextSubAccountId = LEVERAGE_SUB_ACCOUNT_START;
    }
    
    // ==================== IProtocolManager: DEPOSIT/WITHDRAW ====================
    
    /**
     * @inheritdoc IProtocolManager
     * @dev Deposita token nel vault Euler corrispondente
     *      I token devono essere già nel contratto (inviati da ProtocolManager)
     */
    function deposit(string memory tokenCode, uint256 amount) 
        external 
        override 
        onlyProtocolManager
        notCircuitBroken
        nonReentrant
        returns (bool) 
    {
        // 1. Risolvi token e vault
        address token = _resolveToken(tokenCode);
        address vault = _getVault(tokenCode);
        
        // 2. Verifica balance
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance < amount) {
            revert InsufficientBalance(balance, amount);
        }
        
        // 3. Approva vault
        IERC20(token).safeIncreaseAllowance(vault, amount);
        
        // 4. Deposita nel vault Euler (riceve shares)
        uint256 sharesBefore = IEVault(vault).balanceOf(address(this));
        IEVault(vault).deposit(amount, address(this));
        uint256 sharesReceived = IEVault(vault).balanceOf(address(this)) - sharesBefore;
        
        emit EulerDeposit(tokenCode, vault, amount, sharesReceived);
        
        return true;
    }
    
    /**
     * @inheritdoc IProtocolManager
     * @dev Preleva token dal vault Euler e li invia a ProxyGeneral
     */
    function withdraw(string memory tokenCode, uint256 amount) 
        external 
        override 
        onlyProtocolManager
        notCircuitBroken
        nonReentrant
        returns (bool) 
    {
        // 1. Risolvi token e vault
        address token = _resolveToken(tokenCode);
        address vault = _getVault(tokenCode);
        
        // 2. Verifica balance disponibile
        uint256 maxWithdraw = IEVault(vault).maxWithdraw(address(this));
        uint256 withdrawAmount = amount > maxWithdraw ? maxWithdraw : amount;
        
        if (withdrawAmount == 0) {
            revert InsufficientBalance(0, amount);
        }
        
        // 3. Preleva da Euler
        uint256 sharesBefore = IEVault(vault).balanceOf(address(this));
        IEVault(vault).withdraw(withdrawAmount, address(this), address(this));
        uint256 sharesBurned = sharesBefore - IEVault(vault).balanceOf(address(this));
        
        // 4. Trasferisci a ProxyGeneral (CRITICO per custody)
        address proxyGeneral = _getProxyGeneral();
        IERC20(token).safeTransfer(proxyGeneral, withdrawAmount);
        
        emit EulerWithdrawal(tokenCode, vault, withdrawAmount, sharesBurned);
        
        return true;
    }
    
    // ==================== ILendingProtocol: BORROW/REPAY ====================
    
    /**
     * @inheritdoc ILendingProtocol
     * @dev Prende in prestito dal vault e invia a ProxyGeneral
     *      Richiede collaterale già depositato
     */
    function borrow(string memory tokenCode, uint256 amount) 
        external 
        override 
        onlyProtocolManager
        notCircuitBroken
        nonReentrant
        returns (bool) 
    {
        // 1. Risolvi token e vault
        address token = _resolveToken(tokenCode);
        address vault = _getVault(tokenCode);
        
        // 2. Borrow da Euler
        IEVault(vault).borrow(amount, address(this));
        
        // 3. Trasferisci a ProxyGeneral
        address proxyGeneral = _getProxyGeneral();
        IERC20(token).safeTransfer(proxyGeneral, amount);
        
        emit EulerBorrow(tokenCode, vault, amount);
        emit Borrowed(tokenCode, amount, 0); // accountNumber = 0 per main account
        
        return true;
    }
    
    /**
     * @inheritdoc ILendingProtocol
     * @dev Ripaga un debito nel vault
     *      I token devono essere già nel contratto
     */
    function repay(string memory tokenCode, uint256 amount) 
        external 
        override 
        onlyProtocolManager
        notCircuitBroken
        nonReentrant
        returns (bool) 
    {
        // 1. Risolvi token e vault
        address token = _resolveToken(tokenCode);
        address vault = _getVault(tokenCode);
        
        // 2. Verifica balance
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance < amount) {
            revert InsufficientBalance(balance, amount);
        }
        
        // 3. Approva e ripaga
        IERC20(token).safeIncreaseAllowance(vault, amount);
        IEVault(vault).repay(amount, address(this));
        
        emit EulerRepay(tokenCode, vault, amount);
        emit Repaid(tokenCode, amount, 0);
        
        return true;
    }
    
    // ==================== ILendingProtocol: VIEW FUNCTIONS ====================
    
    /**
     * @inheritdoc ILendingProtocol
     */
    function getDebt(string memory tokenCode) 
        external 
        view 
        override 
        returns (uint256) 
    {
        address vault = _getVaultSafe(tokenCode);
        if (vault == address(0)) return 0;
        
        return IEVault(vault).debtOf(address(this));
    }
    
    /**
     * @inheritdoc ILendingProtocol
     * @dev Calcola health factor usando AccountLens
     *      Health Factor = collateralValue / liabilityValue (in 1e18)
     *      Ritorna type(uint256).max se non ci sono debiti
     */
    function getHealthFactor() 
        external 
        view 
        override 
        returns (uint256) 
    {
        // Ottieni i controller abilitati (vault da cui abbiamo borrowato)
        address[] memory controllers = evc.getControllers(address(this));
        
        if (controllers.length == 0) {
            // Nessun controller = nessun debito = infinitamente sicuro
            return type(uint256).max;
        }
        
        // Usa il primo controller per query (in caso di più controller, 
        // servirebbe aggregare - per ora semplifichiamo)
        address controllerVault = controllers[0];
        
        // Query AccountLens per informazioni liquidità
        IAccountLens lens = IAccountLens(ACCOUNT_LENS_ADDRESS);
        IAccountLens.AccountLiquidityInfo memory liquidity = 
            lens.getAccountLiquidityInfo(address(this), controllerVault);
        
        // Controlla se la query è fallita
        if (liquidity.queryFailure) {
            // In caso di errore, ritorna MAX per sicurezza
            return type(uint256).max;
        }
        
        if (liquidity.liabilityValueBorrowing == 0) {
            return type(uint256).max;
        }
        
        // Health Factor = collateralValueBorrowing / liabilityValueBorrowing (scaled to 1e18)
        return (liquidity.collateralValueBorrowing * 1e18) / liquidity.liabilityValueBorrowing;
    }
    
    /**
     * @notice Ottiene health factor per un vault controller specifico
     * @param controllerVault Vault controller da interrogare
     * @return healthFactor in 1e18 (1e18 = 1.0)
     */
    function getHealthFactorForVault(address controllerVault) 
        external 
        view 
        returns (uint256) 
    {
        IAccountLens lens = IAccountLens(ACCOUNT_LENS_ADDRESS);
        IAccountLens.AccountLiquidityInfo memory liquidity = 
            lens.getAccountLiquidityInfo(address(this), controllerVault);
        
        if (liquidity.queryFailure || liquidity.liabilityValueBorrowing == 0) {
            return type(uint256).max;
        }
        
        return (liquidity.collateralValueBorrowing * 1e18) / liquidity.liabilityValueBorrowing;
    }
    
    /**
     * @notice Ottiene il tempo alla liquidazione
     * @param controllerVault Vault controller
     * @return ttl Secondi alla liquidazione, valori speciali:
     *         -1 = già liquidabile
     *         type(int256).max = nessun debito
     *         type(int256).max - 1 = più di un anno
     */
    function getTimeToLiquidation(address controllerVault) 
        external 
        view 
        returns (int256 ttl) 
    {
        IAccountLens lens = IAccountLens(ACCOUNT_LENS_ADDRESS);
        return lens.getTimeToLiquidation(address(this), controllerVault);
    }

    /**
     * @inheritdoc ILendingProtocol
     * @dev Per ora ritorna 0 - sarà implementato con EulerLensAdapter
     */
    function getBorrowCapacity(string memory tokenCode) 
        external 
        view 
        override 
        returns (uint256) 
    {
        // TODO: Implementare con calcolo basato su collaterale e LTV
        return 0;
    }
    
    // ==================== IProtocolManager: VIEW FUNCTIONS ====================
    
    /**
     * @inheritdoc IProtocolManager
     */
    function getBalance(string memory tokenCode) 
        external 
        view 
        override 
        returns (uint256) 
    {
        address vault = _getVaultSafe(tokenCode);
        if (vault == address(0)) return 0;
        
        // Shares convertite in assets
        uint256 shares = IEVault(vault).balanceOf(address(this));
        return IEVault(vault).convertToAssets(shares);
    }
    
    /**
     * @inheritdoc IProtocolManager
     * @dev Ritorna il valore totale in ETH di tutti i depositi
     *      Per ora ritorna 0 - sarà implementato con EulerLensAdapter
     */
    function getTotalValue() 
        external 
        view 
        override 
        returns (uint256) 
    {
        // TODO: Implementare con EulerLensAdapter per calcolo valore in ETH
        return 0;
    }
    
    /**
     * @inheritdoc IProtocolManager
     */
    function getProtocolInfo() 
        external 
        pure 
        override 
        returns (string memory name, string memory version, bool isActive) 
    {
        return ("EulerV2", "1.0.0", true);
    }
    
    /**
     * @inheritdoc IProtocolManager
     */
    function emergencyWithdrawAll(string[] memory tokenCodes) 
        external 
        override 
        onlyOwner
        nonReentrant
        returns (bool) 
    {
        address proxyGeneral = _getProxyGeneral();
        
        for (uint256 i = 0; i < tokenCodes.length; i++) {
            address vault = _getVaultSafe(tokenCodes[i]);
            if (vault == address(0)) continue;
            
            uint256 shares = IEVault(vault).balanceOf(address(this));
            if (shares > 0) {
                // Redeem tutte le shares
                uint256 assets = IEVault(vault).redeem(shares, proxyGeneral, address(this));
                emit EmergencyWithdraw(tokenCodes[i], assets);
            }
        }
        
        return true;
    }
    
    // ==================== ATOMIC LEVERAGE VIA FLASH LOAN SERVICE ====================
    
    /**
     * @notice Parametri per apertura leverage atomica
     */
    struct OpenLeverageAtomicParams {
        string collateralToken;     // e.g., "WETH"
        string borrowToken;         // e.g., "USDC"
        uint256 collateralAmount;   // Initial collateral amount
        uint256 targetLeverageX100; // Target leverage * 100 (e.g., 200 = 2x)
        uint256 minHealthFactor;    // Minimum acceptable health factor
        uint256 deadline;           // Transaction deadline
    }
    
    /**
     * @notice Apre una posizione leverage ATOMICA usando FlashLoanService
     * @param params Parametri per l'apertura leverage
     * @return totalCollateral Collaterale finale depositato
     * @return totalDebt Debito totale
     * @return healthFactor Health factor finale
     * 
     * @dev Flusso atomico via FlashLoanService:
     * 1. Plugin chiama FlashLoanService.executeFlashLoan(USDC, amount)
     * 2. Service riceve USDC da Balancer (0% fee!)
     * 3. Service trasferisce USDC a questo plugin
     * 4. Service chiama onFlashLoanReceived()
     * 5. Plugin swappa USDC → WETH via FlashLoanService.swap()
     * 6. Plugin deposita tutto WETH in Euler
     * 7. Plugin abilita collateral e controller
     * 8. Plugin fa borrow USDC da Euler
     * 9. Plugin trasferisce USDC al FlashLoanService
     * 10. Service ripaga Balancer
     */
    function openLeverageAtomic(
        OpenLeverageAtomicParams calldata params
    ) external onlyOwner notCircuitBroken nonReentrant returns (
        uint256 totalCollateral,
        uint256 totalDebt,
        uint256 healthFactor
    ) {
        // Validazioni
        if (block.timestamp > params.deadline) revert DeadlineExpired();
        if (params.targetLeverageX100 < 110 || params.targetLeverageX100 > 500) {
            revert InvalidLeverage();
        }
        
        // Risolvi vault
        address collateralVault = _getVaultWithFallback(params.collateralToken);
        address borrowVault = _getVaultWithFallback(params.borrowToken);
        address collateralToken = IEVault(collateralVault).asset();
        address borrowToken = IEVault(borrowVault).asset();
        
        // Trasferisci collaterale iniziale dall'utente
        IERC20(collateralToken).safeTransferFrom(
            msg.sender,
            address(this),
            params.collateralAmount
        );
        
        // Calcola importo flash loan
        uint256 leverageMultiplier = params.targetLeverageX100 - 100;
        uint256 flashLoanAmount = _calculateFlashLoanAmount(
            collateralToken,
            borrowToken,
            params.collateralAmount,
            leverageMultiplier
        );
        
        // Salva contesto per callback
        _flashLoanContext = FlashLoanCallbackContext({
            operation: FlashLoanOperation.OPEN,
            user: msg.sender,
            collateralVault: collateralVault,
            borrowVault: borrowVault,
            targetLeverageX100: params.targetLeverageX100,
            initialCollateral: params.collateralAmount,
            minHealthFactor: params.minHealthFactor > 0 ? params.minHealthFactor : MIN_HEALTH_FACTOR,
            maxSlippageBps: 0  // Non usato per OPEN
        });
        
        // Ottieni FlashLoanService da Beacon
        address flashLoanService = _getFlashLoanService();
        
        // Prepara chiamata flash loan
        address[] memory tokens = new address[](1);
        tokens[0] = borrowToken;
        
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = flashLoanAmount;
        
        // Flag per callback
        _inFlashLoanCallback = true;
        
        // Esegui flash loan via service
        IFlashLoanService(flashLoanService).executeFlashLoan(
            tokens,
            amounts,
            ""  // callbackData non necessario, usiamo storage
        );
        
        _inFlashLoanCallback = false;
        
        // Ottieni stato finale posizione
        (totalCollateral, totalDebt, healthFactor) = _getPositionState(collateralVault, borrowVault);
        
        // Verifica health factor
        uint256 minHF = _flashLoanContext.minHealthFactor;
        if (healthFactor < minHF) {
            revert HealthFactorTooLow(healthFactor, minHF);
        }
        
        // Registra posizione per tracking
        uint256 positionId = nextPositionId++;
        _positions[positionId] = LeveragePositionInternal({
            subAccountId: 0,
            collateralVault: collateralVault,
            borrowVault: borrowVault,
            initialCollateral: params.collateralAmount,
            borrowedAmount: totalDebt,
            isActive: true,
            createdAt: block.timestamp
        });
        
        emit LeverageOpenedAtomic(
            msg.sender,
            collateralVault,
            borrowVault,
            params.collateralAmount,
            totalCollateral,
            totalDebt,
            healthFactor,
            params.targetLeverageX100
        );
        
        // Pulisci contesto
        delete _flashLoanContext;
        
        return (totalCollateral, totalDebt, healthFactor);
    }
    
    /**
     * @notice Parametri per chiusura leverage atomica
     */
    struct CloseLeverageAtomicParams {
        string collateralToken;     // e.g., "WETH"
        string borrowToken;         // e.g., "USDC"
        uint256 maxSlippageBps;     // Max slippage in basis points (e.g., 100 = 1%)
        uint256 deadline;           // Transaction deadline
    }
    
    /**
     * @notice Chiude una posizione leverage ATOMICA usando FlashLoanService
     * @param params Parametri per la chiusura
     * @return collateralReturned Collaterale restituito all'utente
     * 
     * @dev Flusso atomico via FlashLoanService:
     * 1. Flash loan USDC (importo = debito corrente)
     * 2. Repay tutto il debito USDC su Euler
     * 3. Withdraw tutto il collaterale WETH da Euler
     * 4. Swap parte WETH → USDC per ripagare flash loan
     * 5. Trasferisci USDC al FlashLoanService
     * 6. Service ripaga Balancer
     * 7. Trasferisci WETH rimanente all'utente
     * @notice Can be called by owner or LiquidityManager (for auto-close on withdraw)
     */
    function closeLeverageAtomic(
        CloseLeverageAtomicParams calldata params
    ) external onlyOwnerOrLiquidityManager notCircuitBroken nonReentrant returns (uint256 collateralReturned) {
        // Validazioni
        if (block.timestamp > params.deadline) revert DeadlineExpired();
        
        // Risolvi vault
        address collateralVault = _getVaultWithFallback(params.collateralToken);
        address borrowVault = _getVaultWithFallback(params.borrowToken);
        address borrowToken = IEVault(borrowVault).asset();
        
        // Ottieni debito corrente
        uint256 currentDebt = IEVault(borrowVault).debtOf(address(this));
        if (currentDebt == 0) revert NoPositionToClose();
        
        // Salva contesto per callback
        _flashLoanContext = FlashLoanCallbackContext({
            operation: FlashLoanOperation.CLOSE,
            user: msg.sender,
            collateralVault: collateralVault,
            borrowVault: borrowVault,
            targetLeverageX100: 0,  // Non usato per CLOSE
            initialCollateral: 0,   // Non usato per CLOSE
            minHealthFactor: 0,     // Non usato per CLOSE
            maxSlippageBps: params.maxSlippageBps > 0 ? params.maxSlippageBps : 100  // Default 1%
        });
        
        // Ottieni FlashLoanService da Beacon
        address flashLoanService = _getFlashLoanService();
        
        // Prepara flash loan per importo = debito corrente
        address[] memory tokens = new address[](1);
        tokens[0] = borrowToken;
        
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = currentDebt;
        
        // Flag per callback
        _inFlashLoanCallback = true;
        
        // Esegui flash loan via service
        IFlashLoanService(flashLoanService).executeFlashLoan(
            tokens,
            amounts,
            ""
        );
        
        _inFlashLoanCallback = false;
        
        // Calcola e trasferisci i fondi rimanenti all'utente
        address collateralToken = IEVault(collateralVault).asset();
        collateralReturned = IERC20(collateralToken).balanceOf(address(this));
        
        // Se c'è collaterale residuo (WETH), trasferiscilo all'utente
        if (collateralReturned > 0) {
            IERC20(collateralToken).safeTransfer(msg.sender, collateralReturned);
        }
        
        // Se c'è USDC in eccesso, trasferiscilo all'utente
        uint256 usdcExcess = IERC20(borrowToken).balanceOf(address(this));
        if (usdcExcess > 0) {
            IERC20(borrowToken).safeTransfer(msg.sender, usdcExcess);
        }
        
        emit LeverageClosedAtomic(
            msg.sender,
            collateralVault,
            borrowVault,
            currentDebt,
            0,  // Sarà settato dal contesto
            collateralReturned
        );
        
        // Pulisci contesto
        delete _flashLoanContext;
        
        return collateralReturned;
    }
    
    /**
     * @notice Callback chiamato da FlashLoanService
     * @param tokens Token ricevuti dal flash loan
     * @param amounts Importi ricevuti
     * @param feeAmounts Fee (sempre 0 per Balancer!)
     * @param callbackData Non usato
     * 
     * @dev Implementa IFlashLoanCallback. Gestisce sia OPEN che CLOSE leverage.
     */
    function onFlashLoanReceived(
        IERC20[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        bytes memory callbackData
    ) external override {
        // Verifica che il caller sia FlashLoanService
        address flashLoanService = _getFlashLoanService();
        if (msg.sender != flashLoanService) revert UnauthorizedFlashLoanCallback();
        if (!_inFlashLoanCallback) revert UnauthorizedFlashLoanCallback();
        
        // Suppress unused
        (callbackData);
        
        FlashLoanCallbackContext memory ctx = _flashLoanContext;
        
        if (ctx.operation == FlashLoanOperation.OPEN) {
            _handleOpenLeverageCallback(tokens, amounts, feeAmounts, ctx, flashLoanService);
        } else {
            _handleCloseLeverageCallback(tokens, amounts, feeAmounts, ctx, flashLoanService);
        }
    }
    
    /**
     * @notice Gestisce callback per apertura leverage
     */
    function _handleOpenLeverageCallback(
        IERC20[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        FlashLoanCallbackContext memory ctx,
        address flashLoanService
    ) internal {
        address collateralToken = IEVault(ctx.collateralVault).asset();
        address borrowToken = address(tokens[0]);
        uint256 flashLoanAmount = amounts[0];
        uint256 feeAmount = feeAmounts[0];
        
        // Step 1: Swap borrowed tokens to collateral (USDC → WETH)
        IERC20(borrowToken).safeIncreaseAllowance(flashLoanService, flashLoanAmount);
        uint256 collateralFromSwap = IFlashLoanService(flashLoanService).swap(
            borrowToken,
            collateralToken,
            flashLoanAmount
        );
        
        if (collateralFromSwap == 0) revert SwapFailed();
        
        // Step 2: Deposita TUTTO il collaterale (iniziale + da swap) in Euler
        uint256 totalCollateral = ctx.initialCollateral + collateralFromSwap;
        IERC20(collateralToken).safeIncreaseAllowance(ctx.collateralVault, totalCollateral);
        IEVault(ctx.collateralVault).deposit(totalCollateral, address(this));
        
        // Step 3: Abilita collateral vault come collaterale in EVC
        evc.enableCollateral(address(this), ctx.collateralVault);
        
        // Step 4: Abilita borrow vault come controller in EVC
        evc.enableController(address(this), ctx.borrowVault);
        
        // Step 5: Borrow da Euler per ripagare flash loan
        uint256 borrowAmount = flashLoanAmount + feeAmount;
        IEVault(ctx.borrowVault).borrow(borrowAmount, address(this));
        
        // Step 6: Trasferisci token al FlashLoanService per ripagare
        IERC20(borrowToken).safeTransfer(flashLoanService, borrowAmount);
    }
    
    /**
     * @notice Gestisce callback per chiusura leverage
     * 
     * @dev Flusso CLOSE:
     * 1. Riceve USDC flash loan (= debito corrente)
     * 2. Repay tutto il debito su Euler
     * 3. Withdraw tutto il collaterale da Euler
     * 4. Swap TUTTO il WETH → USDC 
     * 5. Restituisci USDC necessario al FlashLoanService
     * 6. USDC e WETH rimanenti verranno trasferiti all'utente
     */
    function _handleCloseLeverageCallback(
        IERC20[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        FlashLoanCallbackContext memory ctx,
        address flashLoanService
    ) internal {
        address collateralToken = IEVault(ctx.collateralVault).asset();
        address borrowToken = address(tokens[0]);
        uint256 flashLoanAmount = amounts[0];
        uint256 feeAmount = feeAmounts[0];
        
        // Step 1: Repay tutto il debito su Euler
        IERC20(borrowToken).safeIncreaseAllowance(ctx.borrowVault, flashLoanAmount);
        IEVault(ctx.borrowVault).repay(flashLoanAmount, address(this));
        
        // Step 2: Withdraw tutto il collaterale usando redeem (più sicuro di withdraw)
        uint256 shares = IEVault(ctx.collateralVault).balanceOf(address(this));
        uint256 collateralWithdrawn = 0;
        if (shares > 0) {
            collateralWithdrawn = IEVault(ctx.collateralVault).redeem(
                shares,
                address(this),
                address(this)
            );
        }
        
        // Step 3: Calcola quanto USDC serve per ripagare Balancer
        uint256 repayAmount = flashLoanAmount + feeAmount;
        
        // Step 4: Swap TUTTO il collaterale → USDC 
        // (meglio avere eccesso USDC che rischiare di non averne abbastanza)
        if (collateralWithdrawn > 0) {
            IERC20(collateralToken).safeIncreaseAllowance(flashLoanService, collateralWithdrawn);
            uint256 usdcReceived = IFlashLoanService(flashLoanService).swap(
                collateralToken,
                borrowToken,
                collateralWithdrawn
            );
            
            // Verifica che abbiamo ricevuto abbastanza USDC
            if (usdcReceived < repayAmount) {
                revert SlippageExceeded(repayAmount, usdcReceived);
            }
        }
        
        // Step 5: Trasferisci USDC al FlashLoanService per ripagare Balancer
        uint256 usdcBalance = IERC20(borrowToken).balanceOf(address(this));
        if (usdcBalance < repayAmount) {
            revert SlippageExceeded(repayAmount, usdcBalance);
        }
        IERC20(borrowToken).safeTransfer(flashLoanService, repayAmount);
        
        // Step 6: USDC rimanente verrà trasferito all'utente in closeLeverageAtomic()
        // (insieme al WETH, se ce n'è)
    }
    
    /**
     * @notice Stima WETH necessario per ottenere un certo importo USDC
     * @param usdcNeeded Importo USDC necessario (6 decimali)
     * @param slippageBps Slippage in basis points
     * @return wethNeeded WETH stimato necessario (18 decimali)
     * 
     * @dev Usa prezzo conservativo: 1 ETH = 2500 USDC (sotto mercato per sicurezza)
     *      e aggiunge slippage buffer
     */
    function _estimateWethForUsdc(uint256 usdcNeeded, uint256 slippageBps) internal pure returns (uint256) {
        // Prezzo conservativo: 1 ETH = 2500 USDC (meglio stimare più WETH che meno)
        // wethNeeded = usdcNeeded / 2500 * (1 + slippage)
        
        // usdcNeeded è in 6 decimali, output in 18 decimali
        // baseWeth = usdcNeeded * 1e18 / (2500 * 1e6) = usdcNeeded * 1e12 / 2500
        uint256 baseWeth = (usdcNeeded * 1e12) / 2500;
        
        // Aggiungi slippage: (10000 + slippageBps) / 10000
        uint256 withSlippage = (baseWeth * (10000 + slippageBps)) / 10000;
        
        return withSlippage;
    }
    
    // ==================== LEGACY LEVERAGE (DEPRECATED) ====================
    
    /**
     * @inheritdoc IEulerV2Plugin
     * @dev DEPRECATED: Usa openLeverageAtomic() invece.
     *      Questa funzione è mantenuta per compatibilità ma usa EVC batch che non funziona.
     */
    function openLeveragePosition(OpenLeverageParams calldata params) 
        external 
        override 
        onlyOwner
        notCircuitBroken
        nonReentrant
        returns (uint256 positionId) 
    {
        // Validazioni
        if (block.timestamp > params.deadline) revert DeadlineExpired();
        if (params.collateralAmount == 0 || params.borrowAmount == 0) {
            revert InvalidAddress();
        }
        
        // Fallback: usa la versione atomica se possibile
        // Per ora, manteniamo la vecchia implementazione per compatibilità
        
        address collateralVault = _getVaultWithFallback(params.collateralTokenCode);
        address borrowVault = _getVaultWithFallback(params.borrowTokenCode);
        address collateralToken = IEVault(collateralVault).asset();
        
        // Verifica balance
        uint256 balance = IERC20(collateralToken).balanceOf(address(this));
        if (balance < params.collateralAmount) {
            revert InsufficientBalance(balance, params.collateralAmount);
        }
        
        // Deposita collaterale
        IERC20(collateralToken).safeIncreaseAllowance(collateralVault, params.collateralAmount);
        IEVault(collateralVault).deposit(params.collateralAmount, address(this));
        
        // Abilita collateral e controller
        evc.enableCollateral(address(this), collateralVault);
        evc.enableController(address(this), borrowVault);
        
        // Registra posizione (senza borrow, posizione parziale)
        positionId = nextPositionId++;
        _positions[positionId] = LeveragePositionInternal({
            subAccountId: 0,
            collateralVault: collateralVault,
            borrowVault: borrowVault,
            initialCollateral: params.collateralAmount,
            borrowedAmount: 0,
            isActive: true,
            createdAt: block.timestamp
        });
        
        emit LeveragePositionOpened(positionId, 0, params.collateralAmount, 0);
        return positionId;
    }
    
    /**
     * @inheritdoc IEulerV2Plugin
     * @dev Chiude una posizione leverage manualmente (step by step)
     * @notice Can be called by owner or LiquidityManager (for auto-close on withdraw)
     */
    function closeLeveragePosition(uint256 positionId) 
        external 
        override 
        onlyOwnerOrLiquidityManager
        notCircuitBroken
        nonReentrant
        returns (uint256 collateralReturned) 
    {
        if (positionId >= nextPositionId) revert PositionNotFound(positionId);
        LeveragePositionInternal storage pos = _positions[positionId];
        if (!pos.isActive) revert PositionAlreadyClosed(positionId);
        
        address collateralToken = IEVault(pos.collateralVault).asset();
        address borrowToken = IEVault(pos.borrowVault).asset();
        
        // Ottieni debito corrente
        uint256 currentDebt = IEVault(pos.borrowVault).debtOf(address(this));
        
        // Se c'è debito, ripaga prima
        if (currentDebt > 0) {
            uint256 borrowTokenBalance = IERC20(borrowToken).balanceOf(address(this));
            if (borrowTokenBalance < currentDebt) {
                revert InsufficientBalance(borrowTokenBalance, currentDebt);
            }
            
            IERC20(borrowToken).safeIncreaseAllowance(pos.borrowVault, currentDebt);
            IEVault(pos.borrowVault).repay(currentDebt, address(this));
        }
        
        // Preleva tutto il collaterale
        uint256 collateralShares = IEVault(pos.collateralVault).balanceOf(address(this));
        if (collateralShares > 0) {
            IEVault(pos.collateralVault).redeem(
                collateralShares, 
                address(this), 
                address(this)
            );
        }
        
        // Trasferisci tutto il collaterale a ProxyGeneral
        uint256 collateralBalance = IERC20(collateralToken).balanceOf(address(this));
        if (collateralBalance > 0) {
            address proxyGeneral = _getProxyGeneral();
            IERC20(collateralToken).safeTransfer(proxyGeneral, collateralBalance);
            collateralReturned = collateralBalance;
        }
        
        pos.isActive = false;
        emit LeveragePositionClosed(positionId, collateralReturned);
        
        return collateralReturned;
    }
    
    // ==================== POSITION MANAGEMENT ====================
    
    /**
     * @inheritdoc IEulerV2Plugin
     * @dev Aggiunge collaterale a una posizione esistente per aumentare health factor
     */
    function addCollateralToPosition(uint256 positionId, uint256 amount) 
        external 
        override 
        onlyOwner
        notCircuitBroken
        nonReentrant
    {
        if (positionId >= nextPositionId) revert PositionNotFound(positionId);
        LeveragePositionInternal storage pos = _positions[positionId];
        if (!pos.isActive) revert PositionNotActive(positionId);
        
        address collateralToken = IEVault(pos.collateralVault).asset();
        
        // Verifica balance
        uint256 balance = IERC20(collateralToken).balanceOf(address(this));
        if (balance < amount) revert InsufficientBalance(balance, amount);
        
        // Approva e deposita
        IERC20(collateralToken).safeIncreaseAllowance(pos.collateralVault, amount);
        IEVault(pos.collateralVault).deposit(amount, address(this));
        
        emit CollateralAdded(positionId, amount);
    }
    
    /**
     * @inheritdoc IEulerV2Plugin
     * @dev Rimuove collaterale da una posizione (se health factor lo permette)
     */
    function removeCollateralFromPosition(uint256 positionId, uint256 amount) 
        external 
        override 
        onlyOwner
        notCircuitBroken
        nonReentrant
    {
        if (positionId >= nextPositionId) revert PositionNotFound(positionId);
        LeveragePositionInternal storage pos = _positions[positionId];
        if (!pos.isActive) revert PositionNotActive(positionId);
        
        address collateralToken = IEVault(pos.collateralVault).asset();
        address subAccount = _deriveSubAccount(pos.subAccountId);
        
        // Preleva dal vault (EVC verificherà automaticamente health factor)
        IEVault(pos.collateralVault).withdraw(amount, address(this), subAccount);
        
        // Trasferisci a ProxyGeneral
        address proxyGeneral = _getProxyGeneral();
        IERC20(collateralToken).safeTransfer(proxyGeneral, amount);
        
        emit CollateralRemoved(positionId, amount);
    }
    
    /**
     * @inheritdoc IEulerV2Plugin
     * @dev Calcola health factor di una posizione leverage usando AccountLens
     */
    function getPositionHealth(uint256 positionId) 
        external 
        view 
        override 
        returns (uint256) 
    {
        if (positionId >= nextPositionId) revert PositionNotFound(positionId);
        LeveragePositionInternal storage pos = _positions[positionId];
        if (!pos.isActive) return 0;
        
        address subAccount = _deriveSubAccount(pos.subAccountId);
        
        IAccountLens lens = IAccountLens(ACCOUNT_LENS_ADDRESS);
        IAccountLens.AccountLiquidityInfo memory liquidity = 
            lens.getAccountLiquidityInfo(subAccount, pos.borrowVault);
        
        if (liquidity.queryFailure || liquidity.liabilityValueBorrowing == 0) {
            return type(uint256).max;
        }
        
        return (liquidity.collateralValueBorrowing * 1e18) / liquidity.liabilityValueBorrowing;
    }
    
    /**
     * @inheritdoc IEulerV2Plugin
     * @dev Ritorna (collateralValue, debtValue) in unit of account
     */
    function getPositionValue(uint256 positionId) 
        external 
        view 
        override 
        returns (uint256 collateralValue, uint256 debtValue) 
    {
        if (positionId >= nextPositionId) return (0, 0);
        LeveragePositionInternal storage pos = _positions[positionId];
        if (!pos.isActive) return (0, 0);
        
        address subAccount = _deriveSubAccount(pos.subAccountId);
        
        IAccountLens lens = IAccountLens(ACCOUNT_LENS_ADDRESS);
        IAccountLens.AccountLiquidityInfo memory liquidity = 
            lens.getAccountLiquidityInfo(subAccount, pos.borrowVault);
        
        return (liquidity.collateralValueBorrowing, liquidity.liabilityValueBorrowing);
    }
    
    /**
     * @inheritdoc IEulerV2Plugin
     */
    function getAllPositions() 
        external 
        view 
        override 
        returns (LeveragePosition[] memory positions) 
    {
        // Conta posizioni attive
        uint256 count = 0;
        for (uint256 i = 0; i < nextPositionId; i++) {
            if (_positions[i].isActive) count++;
        }
        
        // Popola array
        positions = new LeveragePosition[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < nextPositionId; i++) {
            if (_positions[i].isActive) {
                positions[idx++] = _toExternalPosition(i);
            }
        }
    }
    
    /**
     * @inheritdoc IEulerV2Plugin
     */
    function getPosition(uint256 positionId) 
        external 
        view 
        override 
        returns (LeveragePosition memory) 
    {
        if (positionId >= nextPositionId) revert PositionNotFound(positionId);
        return _toExternalPosition(positionId);
    }
    
    /**
     * @inheritdoc IEulerV2Plugin
     */
    function getActivePositionCount() 
        external 
        view 
        override 
        returns (uint256 count) 
    {
        for (uint256 i = 0; i < nextPositionId; i++) {
            if (_positions[i].isActive) count++;
        }
    }
    
    // ==================== ADMIN FUNCTIONS ====================
    
    /**
     * @inheritdoc IEulerV2Plugin
     */
    function setCircuitBreaker(bool tripped) external override onlyOwner {
        circuitBreakerTripped = tripped;
        emit CircuitBreakerSet(tripped);
    }
    
    /**
     * @notice Attiva il circuit breaker (wrapper per setCircuitBreaker(true))
     */
    function tripCircuitBreaker() external onlyOwner {
        circuitBreakerTripped = true;
        emit CircuitBreakerSet(true);
    }
    
    /**
     * @notice Disattiva il circuit breaker (wrapper per setCircuitBreaker(false))
     */
    function resetCircuitBreaker() external onlyOwner {
        circuitBreakerTripped = false;
        emit CircuitBreakerSet(false);
    }
    
    // ==================== EVC CONFIGURATION ====================
    
    /**
     * @notice Abilita un vault come collaterale per il main account
     * @dev Necessario prima di poter fare borrow usando quel collaterale
     * @param vault Indirizzo del vault da abilitare come collaterale
     */
    function enableCollateral(address vault) external onlyOwner {
        if (vault == address(0)) revert InvalidAddress();
        evc.enableCollateral(address(this), vault);
        emit CollateralEnabled(vault, address(this));
    }
    
    /**
     * @notice Abilita un vault come controller per il main account
     * @dev Il controller vault può liquidare l'account e controllarne lo stato
     *      Necessario prima di fare borrow da quel vault
     * @param vault Indirizzo del vault controller
     */
    function enableController(address vault) external onlyOwner {
        if (vault == address(0)) revert InvalidAddress();
        evc.enableController(address(this), vault);
        emit ControllerEnabled(vault, address(this));
    }
    
    /**
     * @notice Disabilita un vault come collaterale
     * @dev Non può essere chiamato se ci sono debiti che usano quel collaterale
     * @param vault Vault da disabilitare
     */
    function disableCollateral(address vault) external onlyOwner {
        if (vault == address(0)) revert InvalidAddress();
        evc.disableCollateral(address(this), vault);
        emit CollateralDisabled(vault, address(this));
    }
    
    /**
     * @notice Disabilita un vault come controller
     * @dev Non può essere chiamato se ci sono debiti aperti con quel vault
     * @param vault Vault controller da disabilitare
     */
    function disableController(address vault) external onlyOwner {
        if (vault == address(0)) revert InvalidAddress();
        evc.disableController(address(this), vault);
        emit ControllerDisabled(vault, address(this));
    }
    
    /**
     * @notice Configura collateral e controller in una chiamata
     * @dev Utility per setup rapido prima di borrow
     * @param collateralVault Vault da usare come collaterale
     * @param borrowVault Vault da cui fare borrow (sarà controller)
     */
    function setupBorrowConfig(address collateralVault, address borrowVault) external onlyOwner {
        if (collateralVault == address(0) || borrowVault == address(0)) revert InvalidAddress();
        
        // Abilita collateral
        if (!evc.isCollateralEnabled(address(this), collateralVault)) {
            evc.enableCollateral(address(this), collateralVault);
            emit CollateralEnabled(collateralVault, address(this));
        }
        
        // Abilita controller
        if (!evc.isControllerEnabled(address(this), borrowVault)) {
            evc.enableController(address(this), borrowVault);
            emit ControllerEnabled(borrowVault, address(this));
        }
    }
    
    /**
     * @notice Verifica se un vault è abilitato come collaterale
     * @param vault Vault da verificare
     * @return True se è abilitato
     */
    function isCollateralEnabled(address vault) external view returns (bool) {
        return evc.isCollateralEnabled(address(this), vault);
    }
    
    /**
     * @notice Verifica se un vault è abilitato come controller
     * @param vault Vault da verificare
     * @return True se è abilitato
     */
    function isControllerEnabled(address vault) external view returns (bool) {
        return evc.isControllerEnabled(address(this), vault);
    }
    
    /**
     * @notice Ottiene tutti i vault collateral abilitati
     * @return Array di indirizzi vault
     */
    function getEnabledCollaterals() external view returns (address[] memory) {
        return evc.getCollaterals(address(this));
    }
    
    /**
     * @notice Ottiene tutti i vault controller abilitati
     * @return Array di indirizzi vault
     */
    function getEnabledControllers() external view returns (address[] memory) {
        return evc.getControllers(address(this));
    }
    
    // ==================== INTERNAL HELPERS ====================
    
    /**
     * @notice Risolve token address da tokenCode via TokenManager o Beacon
     * @dev WETH è gestito come caso speciale tramite Beacon
     */
    function _resolveToken(string memory tokenCode) internal view returns (address) {
        // WETH è gestito separatamente nel Beacon (non in TokenManager)
        if (keccak256(bytes(tokenCode)) == keccak256(bytes("WETH"))) {
            return IBeacon(beacon).getImplementation("WETH");
        }
        
        address tokenManager = IBeacon(beacon).getImplementation("TokenManager");
        return ITokenManagerForModules(tokenManager).getTokenAddress(tokenCode);
    }
    
    /**
     * @notice Ottiene ProxyGeneral address via Beacon
     */
    function _getProxyGeneral() internal view returns (address) {
        return IBeacon(beacon).getImplementation("ProxyGeneral");
    }
    
    /**
     * @notice Ottiene vault address da EulerVaultRegistry
     * @dev Reverte se non trovato
     */
    function _getVault(string memory tokenCode) internal view returns (address) {
        address registry = IBeacon(beacon).getImplementation("EulerVaultRegistry");
        return IEulerVaultRegistry(registry).getVault(tokenCode);
    }
    
    /**
     * @notice Ottiene vault address senza revert
     * @return address(0) se non trovato
     */
    function _getVaultSafe(string memory tokenCode) internal view returns (address) {
        address registry = IBeacon(beacon).getImplementation("EulerVaultRegistry");
        if (registry == address(0)) return address(0);
        return IEulerVaultRegistry(registry).getVaultSafe(tokenCode);
    }
    
    /**
     * @notice Converte posizione interna in formato esterno
     */
    function _toExternalPosition(uint256 positionId) 
        internal 
        view 
        returns (LeveragePosition memory) 
    {
        LeveragePositionInternal storage pos = _positions[positionId];
        return LeveragePosition({
            positionId: positionId,
            subAccountId: pos.subAccountId,
            collateralVault: pos.collateralVault,
            borrowVault: pos.borrowVault,
            initialCollateral: pos.initialCollateral,
            borrowedAmount: pos.borrowedAmount,
            isActive: pos.isActive,
            createdAt: pos.createdAt
        });
    }
    
    /**
     * @notice Deriva indirizzo sub-account
     * @dev Formula Euler: address XOR subAccountId
     */
    function _deriveSubAccount(uint8 subAccountId) internal view returns (address) {
        return address(uint160(address(this)) ^ uint160(subAccountId));
    }
    
    // ==================== FLASH LOAN HELPERS ====================
    
    /**
     * @notice Ottiene FlashLoanService da Beacon
     */
    function _getFlashLoanService() internal view returns (address) {
        try IBeacon(beacon).getImplementation("FlashLoanService") returns (address service) {
            if (service == address(0)) revert FlashLoanServiceNotFound();
            return service;
        } catch {
            revert FlashLoanServiceNotFound();
        }
    }
    
    /**
     * @notice Ottiene vault con fallback a hardcoded
     */
    function _getVaultWithFallback(string memory tokenCode) internal view returns (address) {
        // Prima prova registry
        try this.getVaultExternal(tokenCode) returns (address vault) {
            if (vault != address(0)) return vault;
        } catch {}
        
        // Fallback a hardcoded
        if (keccak256(bytes(tokenCode)) == keccak256(bytes("WETH"))) {
            return WETH_VAULT;
        } else if (keccak256(bytes(tokenCode)) == keccak256(bytes("USDC"))) {
            return USDC_VAULT;
        }
        
        revert VaultNotFound(tokenCode);
    }
    
    /**
     * @notice Wrapper esterno per _getVault (per try/catch)
     */
    function getVaultExternal(string memory tokenCode) external view returns (address) {
        return _getVault(tokenCode);
    }
    
    /**
     * @notice Calcola importo flash loan necessario per leverage target
     * @param collateralToken Token collaterale
     * @param borrowToken Token da prendere in prestito
     * @param collateralAmount Importo collaterale iniziale
     * @param leverageMultiplier Moltiplicatore leverage (100 = 1x additional)
     */
    function _calculateFlashLoanAmount(
        address collateralToken,
        address borrowToken,
        uint256 collateralAmount,
        uint256 leverageMultiplier
    ) internal view returns (uint256) {
        // Ottieni FlashLoanService per quotazione
        address flashLoanService;
        try IBeacon(beacon).getImplementation("FlashLoanService") returns (address service) {
            flashLoanService = service;
        } catch {
            // Fallback a stima semplice
            return _estimateFlashLoanAmount(collateralAmount, leverageMultiplier);
        }
        
        if (flashLoanService == address(0)) {
            return _estimateFlashLoanAmount(collateralAmount, leverageMultiplier);
        }
        
        // Calcola valore collaterale in borrow token
        uint256 collateralValueInBorrow = IFlashLoanService(flashLoanService).getExpectedOutput(
            collateralToken,
            borrowToken,
            collateralAmount
        );
        
        if (collateralValueInBorrow == 0) {
            return _estimateFlashLoanAmount(collateralAmount, leverageMultiplier);
        }
        
        // Flash loan = collateralValue * (leverageMultiplier / 100)
        return (collateralValueInBorrow * leverageMultiplier) / 100;
    }
    
    /**
     * @notice Stima fallback per flash loan amount
     */
    function _estimateFlashLoanAmount(
        uint256 collateralAmount,
        uint256 leverageMultiplier
    ) internal pure returns (uint256) {
        // Assume ETH = 3000 USDC
        uint256 collateralValueUSDC = (collateralAmount * 3000e6) / 1e18;
        return (collateralValueUSDC * leverageMultiplier) / 100;
    }
    
    /**
     * @notice Ottiene stato posizione corrente
     */
    function _getPositionState(
        address collateralVault,
        address borrowVault
    ) internal view returns (
        uint256 totalCollateral,
        uint256 totalDebt,
        uint256 healthFactor
    ) {
        // Collaterale in asset
        uint256 shares = IEVault(collateralVault).balanceOf(address(this));
        totalCollateral = IEVault(collateralVault).convertToAssets(shares);
        
        // Debito
        totalDebt = IEVault(borrowVault).debtOf(address(this));
        
        // Health factor via AccountLens
        IAccountLens lens = IAccountLens(ACCOUNT_LENS_ADDRESS);
        IAccountLens.AccountLiquidityInfo memory liquidity = 
            lens.getAccountLiquidityInfo(address(this), borrowVault);
        
        if (liquidity.queryFailure || liquidity.liabilityValueBorrowing == 0) {
            healthFactor = type(uint256).max;
        } else {
            healthFactor = (liquidity.collateralValueBorrowing * 1e18) / liquidity.liabilityValueBorrowing;
        }
    }
    
    /**
     * @notice Calcola leverage attuale
     * @return leverageX100 Leverage * 100 (e.g., 200 = 2x)
     */
    function getCurrentLeverage() external view returns (uint256 leverageX100) {
        // Usa vault hardcoded per semplicità
        (uint256 collateral, uint256 debt, ) = _getPositionState(WETH_VAULT, USDC_VAULT);
        
        if (collateral == 0) return 100; // 1x (no leverage)
        
        // Stima valore collaterale in USDC usando fallback price
        // (SimpleSwap non ha getExpectedOutput semplice, usiamo stima)
        uint256 collateralValueUSDC = (collateral * 3000e6) / 1e18; // ETH ~= 3000 USDC
        
        uint256 positionEquity = collateralValueUSDC > debt ? collateralValueUSDC - debt : 0;
        if (positionEquity == 0) return 0;
        
        return (collateralValueUSDC * 100) / positionEquity;
    }
}
