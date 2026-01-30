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
    function getAllVaults() external view returns (string[] memory tokenCodes, address[] memory vaults);
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
 * - Operazioni leverage ATOMICHE: openLeverageAtomic, closeLeverageAtomic (via FlashLoanService)
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
    mapping(uint256 => LeveragePositionStorage) internal _positions;
    
    /// @notice Prossimo sub-account ID disponibile per leverage
    uint8 public nextSubAccountId;
    
    /// @notice Flag per verificare callback flash loan legittimo
    bool private _inFlashLoanCallback;
    
    /// @notice Contesto temporaneo durante flash loan
    FlashLoanCallbackContext private _flashLoanContext;
    
    // ==================== INTERNAL STRUCTS ====================
    
    /// @notice Struct interna per storage (senza positionId per risparmiare gas)
    struct LeveragePositionStorage {
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
    // Note: EulerDeposit, EulerWithdrawal, EulerBorrow, EulerRepay are defined in IEulerV2Plugin
    
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
     * @inheritdoc IProtocolAdapter
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
     * @inheritdoc IProtocolAdapter
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
     * @inheritdoc IEulerV2Plugin
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
     * @inheritdoc IEulerV2Plugin
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
    
    // ==================== DEBT FUNCTIONS ====================
    
    /**
     * @notice Get debt for a specific token
     * @param tokenCode Token code (e.g., "USDC")
     * @return Debt amount
     */
    function getDebt(string memory tokenCode) 
        external 
        view 
        returns (uint256) 
    {
        address vault = _getVaultSafe(tokenCode);
        if (vault == address(0)) return 0;
        
        return IEVault(vault).debtOf(address(this));
    }
    
    // DEPRECATED: Use getDebt() instead - identical functionality
    // /**
    //  * @inheritdoc IEulerV2Plugin
    //  */
    // function getBorrowedAmount(string memory tokenCode) 
    //     external 
    //     view 
    //     override 
    //     returns (uint256) 
    // {
    //     address vault = _getVaultSafe(tokenCode);
    //     if (vault == address(0)) return 0;
    //     
    //     return IEVault(vault).debtOf(address(this));
    // }
    
    /**
     * @inheritdoc IEulerV2Plugin
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
    
    // REMOVED: getHealthFactorForVault() - Use EulerLensAdapter.getSubAccountHealth() instead
    // REMOVED: getTimeToLiquidation() - Use EulerLensAdapter.getTimeToLiquidation() instead

    /**
     * @notice Get borrow capacity for a token
     * @param tokenCode Token code
     * @return Borrow capacity (TODO: implement with EulerLensAdapter)
     */
    function getBorrowCapacity(string memory tokenCode) 
        external 
        view 
        returns (uint256) 
    {
        // TODO: Implementare con calcolo basato su collaterale e LTV
        return 0;
    }
    
    // ==================== IProtocolManager: VIEW FUNCTIONS ====================
    
    /**
     * @inheritdoc IProtocolAdapter
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
     * @inheritdoc IProtocolAdapter
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
     * @notice Get protocol info (legacy helper)
     * @return name Protocol name
     * @return version Protocol version
     * @return isActive Whether protocol is active
     */
    function getProtocolInfo() 
        external 
        pure 
        returns (string memory name, string memory version, bool isActive) 
    {
        return ("EulerV2", "1.0.0", true);
    }
    
    /**
     * @inheritdoc IProtocolAdapter
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
        _positions[positionId] = LeveragePositionStorage({
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
    
    // ==================== POSITION MANAGEMENT ====================
    
    /**
     * @inheritdoc IEulerV2PluginSpecific
     * @dev Aggiunge collaterale a una posizione esistente per migliorare health factor
     * @dev Il collaterale viene depositato sul sub-account della posizione leverage
     */
    function addCollateralToPosition(uint256 positionId, uint256 amount) 
        external 
        override 
        onlyOwner
        notCircuitBroken
        nonReentrant
    {
        if (positionId >= nextPositionId) revert PositionNotFound(positionId);
        LeveragePositionStorage storage pos = _positions[positionId];
        if (!pos.isActive) revert PositionNotActive(positionId);
        
        address collateralToken = IEVault(pos.collateralVault).asset();
        address subAccount = _deriveSubAccount(pos.subAccountId);
        
        // Verifica balance disponibile nel contratto
        uint256 balance = IERC20(collateralToken).balanceOf(address(this));
        if (balance < amount) revert InsufficientBalance(balance, amount);
        
        // Trasferisci collaterale al sub-account
        IERC20(collateralToken).safeTransfer(subAccount, amount);
        
        // Deposita nel vault per conto del sub-account (aumenta collaterale → migliora HF)
        evc.call(pos.collateralVault, subAccount, 0, abi.encodeWithSelector(
            IEVault.deposit.selector,
            amount,
            subAccount
        ));
        
        emit CollateralAdded(positionId, amount);
    }
    
    /**
     * @inheritdoc IEulerV2PluginSpecific
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
        LeveragePositionStorage storage pos = _positions[positionId];
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
     * @inheritdoc IProtocolAdapter
     * @dev Returns positions in standard IProtocolAdapter.Position format
     */
    function getAllPositions() 
        external 
        view 
        override 
        returns (IProtocolAdapter.Position[] memory positions) 
    {
        // Conta posizioni attive
        uint256 count = 0;
        for (uint256 i = 0; i < nextPositionId; i++) {
            if (_positions[i].isActive) count++;
        }
        
        // Popola array
        positions = new IProtocolAdapter.Position[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < nextPositionId && idx < count; i++) {
            if (_positions[i].isActive) {
                positions[idx++] = _convertToStandardPosition(i, _positions[i]);
            }
        }
    }
    
    /**
     * @inheritdoc IProtocolAdapter
     * @dev Returns position in standard IProtocolAdapter.Position format
     */
    function getPosition(uint256 positionId) 
        external 
        view 
        override 
        returns (IProtocolAdapter.Position memory) 
    {
        if (positionId >= nextPositionId) revert PositionNotFound(positionId);
        return _convertToStandardPosition(positionId, _positions[positionId]);
    }
    
    /**
     * @inheritdoc IProtocolAdapter
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
     * @inheritdoc IEulerV2PluginSpecific
     */
    function setCircuitBreaker(bool tripped) external override onlyOwner {
        circuitBreakerTripped = tripped;
        emit CircuitBreakerSet(tripped);
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
        LeveragePositionStorage storage pos = _positions[positionId];
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
    
    // ==================== IProtocolAdapter IMPLEMENTATION ====================
    
    /// @inheritdoc IProtocolAdapter
    function protocolName() external pure override returns (string memory) {
        return "Euler";
    }
    
    /// @inheritdoc IProtocolAdapter
    function protocolType() external pure override returns (IProtocolAdapter.ProtocolType) {
        return IProtocolAdapter.ProtocolType.LENDING;
    }
    
    /// @inheritdoc IProtocolAdapter
    function getProtocolSummary() external view override returns (IProtocolAdapter.ProtocolSummary memory summary) {
        uint256 activeCount = 0;
        uint256 totalColl = 0;
        uint256 totalDbt = 0;
        uint256 lowestHF = type(uint256).max;
        
        for (uint256 i = 0; i < nextPositionId; i++) {
            LeveragePositionStorage storage pos = _positions[i];
            if (!pos.isActive) continue;
            
            activeCount++;
            
            // Get position values
            address subAccount = _deriveSubAccount(pos.subAccountId);
            uint256 collShares = IEVault(pos.collateralVault).balanceOf(subAccount);
            uint256 collAssets = IEVault(pos.collateralVault).convertToAssets(collShares);
            uint256 debtAssets = IEVault(pos.borrowVault).debtOf(subAccount);
            
            totalColl += collAssets;
            totalDbt += debtAssets;
            
            // Get health factor
            IAccountLens lens = IAccountLens(ACCOUNT_LENS_ADDRESS);
            IAccountLens.AccountLiquidityInfo memory liq = lens.getAccountLiquidityInfo(subAccount, pos.borrowVault);
            uint256 hf = type(uint256).max;
            if (!liq.queryFailure && liq.liabilityValueBorrowing > 0) {
                hf = (liq.collateralValueBorrowing * 1e18) / liq.liabilityValueBorrowing;
            }
            if (hf < lowestHF) lowestHF = hf;
        }
        
        summary = IProtocolAdapter.ProtocolSummary({
            name: "Euler",
            protocolType: IProtocolAdapter.ProtocolType.LENDING,
            totalCollateralEth: totalColl,  // Already in ETH for WETH collateral
            totalDebtEth: totalDbt,          // Needs conversion for USDC debt
            netValueEth: totalColl > totalDbt ? totalColl - totalDbt : 0,
            activePositionCount: activeCount,
            lowestHealthFactor: lowestHF,
            isHealthy: lowestHF >= 1.2e18
        });
    }
    
    /// @inheritdoc IProtocolAdapter
    function getPositionsSortedByRisk() external view override returns (IProtocolAdapter.Position[] memory positions) {
        // First count active positions
        uint256 activeCount = 0;
        for (uint256 i = 0; i < nextPositionId; i++) {
            if (_positions[i].isActive) activeCount++;
        }
        
        if (activeCount == 0) return positions;
        
        positions = new IProtocolAdapter.Position[](activeCount);
        uint256 idx = 0;
        
        for (uint256 i = 0; i < nextPositionId && idx < activeCount; i++) {
            LeveragePositionStorage storage pos = _positions[i];
            if (!pos.isActive) continue;
            
            positions[idx++] = _convertToStandardPosition(i, pos);
        }
        
        // Sort by health factor (bubble sort - ok for small arrays)
        for (uint256 i = 0; i < positions.length; i++) {
            for (uint256 j = i + 1; j < positions.length; j++) {
                if (positions[j].healthFactor < positions[i].healthFactor) {
                    IProtocolAdapter.Position memory temp = positions[i];
                    positions[i] = positions[j];
                    positions[j] = temp;
                }
            }
        }
    }
    
    /// @inheritdoc IProtocolAdapter
    /// @dev Closes a leverage position atomically using closeLeverageAtomic().
    ///      Retrieves position info and calls the atomic close function.
    function closePosition(uint256 positionId) external override returns (uint256 wethReturned) {
        // Verifica che la posizione esista ed è attiva
        if (positionId >= nextPositionId) revert PositionNotFound(positionId);
        LeveragePositionStorage storage pos = _positions[positionId];
        if (!pos.isActive) revert PositionAlreadyClosed(positionId);
        
        // Recupera token codes dai vault addresses
        IEulerVaultRegistry registry = IEulerVaultRegistry(
            IBeacon(beacon).getImplementation("EulerVaultRegistry")
        );
        
        string memory collateralTokenCode = registry.getTokenCode(pos.collateralVault);
        string memory borrowTokenCode = registry.getTokenCode(pos.borrowVault);
        
        // Prepara parametri per chiusura atomica
        CloseLeverageAtomicParams memory params = CloseLeverageAtomicParams({
            collateralToken: collateralTokenCode,
            borrowToken: borrowTokenCode,
            maxSlippageBps: 200,  // 2% max slippage (default conservativo)
            deadline: block.timestamp + 300  // 5 minuti deadline
        });
        
        // Chiama chiusura atomica
        wethReturned = this.closeLeverageAtomic(params);
        
        // Marca posizione come chiusa
        pos.isActive = false;
        
        return wethReturned;
    }
    
    /// @inheritdoc IProtocolAdapter
    function closePositionsForWeth(uint256 targetWethAmount) 
        external 
        override 
        onlyOwnerOrLiquidityManager
        returns (uint256 wethObtained, uint256 positionsClosed) 
    {
        address proxyGeneral = _getProxyGeneral();
        
        // STEP 1: First close normal deposits (no leverage, no debt)
        // These are simpler and less risky to close
        (uint256 fromDeposits, uint256 depositsClosed) = _closeNormalDepositsForWeth(targetWethAmount, proxyGeneral);
        wethObtained += fromDeposits;
        positionsClosed += depositsClosed;
        
        // Check if we have enough
        if (wethObtained >= targetWethAmount) {
            return (wethObtained, positionsClosed);
        }
        
        // STEP 2: Close leverage positions (sorted by risk, riskiest first)
        uint256 stillNeeded = targetWethAmount - wethObtained;
        IProtocolAdapter.Position[] memory sortedPositions = this.getPositionsSortedByRisk();
        
        for (uint256 i = 0; i < sortedPositions.length && wethObtained < targetWethAmount; i++) {
            uint256 positionId = sortedPositions[i].positionId;
            
            // Skip invalid positions
            if (positionId >= nextPositionId) continue;
            LeveragePositionStorage storage pos = _positions[positionId];
            if (!pos.isActive) continue;
            
            // Get position tokens for closeLeverageAtomic
            string memory collateralToken = _getTokenCodeFromVault(pos.collateralVault);
            string memory borrowToken = _getTokenCodeFromVault(pos.borrowVault);
            
            // Try to close position using atomic close (with flash loan)
            try this._closeLeverageAtomicForWeth(collateralToken, borrowToken, positionId) returns (uint256 wethReturned) {
                wethObtained += wethReturned;
                positionsClosed++;
            } catch {
                // Continue on failure - try next position
            }
        }
        
        // Transfer obtained WETH to ProxyGeneral
        if (wethObtained > 0) {
            IERC20(WETH).safeTransfer(proxyGeneral, wethObtained);
        }
    }
    
    /**
     * @dev Close normal (non-leverage) deposits to obtain WETH
     * @notice Withdraws from vaults that have no debt (simple yield deposits)
     * @param targetWethAmount Amount of WETH needed
     * @param proxyGeneral Address to send non-WETH tokens (for swap)
     * @return wethObtained WETH obtained from closing deposits
     * @return depositsClosed Number of deposits closed
     */
    function _closeNormalDepositsForWeth(
        uint256 targetWethAmount,
        address proxyGeneral
    ) internal returns (uint256 wethObtained, uint256 depositsClosed) {
        // Get EulerVaultRegistry to find all vaults
        address vaultRegistry = IBeacon(beacon).getImplementation("EulerVaultRegistry");
        if (vaultRegistry == address(0)) return (0, 0);
        
        // Get all registered vaults
        (string[] memory tokenCodes, address[] memory vaults) = IEulerVaultRegistry(vaultRegistry).getAllVaults();
        
        for (uint256 i = 0; i < vaults.length && wethObtained < targetWethAmount; i++) {
            address vault = vaults[i];
            
            // Check if we have shares in this vault
            uint256 shares = IEVault(vault).balanceOf(address(this));
            if (shares == 0) continue;
            
            // Check if there's debt - if so, skip (it's leveraged, not a normal deposit)
            uint256 debt = IEVault(vault).debtOf(address(this));
            if (debt > 0) continue;
            
            // This is a normal deposit (shares > 0, debt = 0)
            address asset = IEVault(vault).asset();
            uint256 maxWithdrawable = IEVault(vault).maxWithdraw(address(this));
            if (maxWithdrawable == 0) continue;
            
            // Withdraw from vault
            try IEVault(vault).withdraw(maxWithdrawable, address(this), address(this)) returns (uint256 withdrawn) {
                if (withdrawn == 0) continue;
                
                depositsClosed++;
                
                // If it's WETH, add directly
                if (asset == WETH) {
                    wethObtained += withdrawn;
                } else {
                    // Swap non-WETH to WETH via FlashLoanService
                    address flashLoanService = _getFlashLoanService();
                    if (flashLoanService != address(0)) {
                        IERC20(asset).safeIncreaseAllowance(flashLoanService, withdrawn);
                        try IFlashLoanService(flashLoanService).swap(asset, WETH, withdrawn) returns (uint256 wethFromSwap) {
                            wethObtained += wethFromSwap;
                        } catch {
                            // Swap failed, transfer asset to ProxyGeneral for manual handling
                            IERC20(asset).safeTransfer(proxyGeneral, withdrawn);
                        }
                    } else {
                        // No swap service, transfer to ProxyGeneral
                        IERC20(asset).safeTransfer(proxyGeneral, withdrawn);
                    }
                }
            } catch {
                // Withdrawal failed, continue
            }
        }
        
        return (wethObtained, depositsClosed);
    }
    
    /**
     * @dev Helper to get token code from vault address
     */
    function _getTokenCodeFromVault(address vault) internal view returns (string memory) {
        address asset = IEVault(vault).asset();
        if (asset == WETH) return "WETH";
        // Add more token mappings as needed
        // For now, assume USDC for any non-WETH vault
        return "USDC";
    }
    
    /**
     * @dev Internal-use function to close a leverage position atomically and return WETH
     * @notice Uses flash loan to close position, keeps WETH instead of swapping all to USDC
     */
    function _closeLeverageAtomicForWeth(
        string memory collateralToken, 
        string memory borrowToken,
        uint256 positionId
    ) external returns (uint256 wethReturned) {
        require(msg.sender == address(this), "Only self-call");
        
        // Get vaults
        address collateralVault = _getVaultWithFallback(collateralToken);
        address borrowVault = _getVaultWithFallback(borrowToken);
        address borrowTokenAddr = IEVault(borrowVault).asset();
        
        // Get current debt
        uint256 currentDebt = IEVault(borrowVault).debtOf(address(this));
        if (currentDebt == 0) {
            // No debt - just withdraw collateral
            uint256 shares = IEVault(collateralVault).balanceOf(address(this));
            if (shares > 0) {
                wethReturned = IEVault(collateralVault).redeem(shares, address(this), address(this));
            }
            _positions[positionId].isActive = false;
            emit LeveragePositionClosed(positionId, wethReturned);
            return wethReturned;
        }
        
        // Save context for callback - use CLOSE_FOR_WETH operation
        _flashLoanContext = FlashLoanCallbackContext({
            operation: FlashLoanOperation.CLOSE,
            user: address(this), // WETH goes to this contract, not external user
            collateralVault: collateralVault,
            borrowVault: borrowVault,
            targetLeverageX100: 0,
            initialCollateral: 0,
            minHealthFactor: 0,
            maxSlippageBps: 100
        });
        
        // Get FlashLoanService
        address flashLoanService = _getFlashLoanService();
        
        // Execute flash loan
        address[] memory tokens = new address[](1);
        tokens[0] = borrowTokenAddr;
        
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = currentDebt;
        
        _inFlashLoanCallback = true;
        
        uint256 wethBefore = IERC20(WETH).balanceOf(address(this));
        
        IFlashLoanService(flashLoanService).executeFlashLoan(tokens, amounts, "");
        
        _inFlashLoanCallback = false;
        
        // Get WETH balance after (may include excess from swap)
        wethReturned = IERC20(WETH).balanceOf(address(this)) - wethBefore;
        
        // If we still have USDC excess, swap it to WETH
        uint256 usdcBalance = IERC20(borrowTokenAddr).balanceOf(address(this));
        if (usdcBalance > 0) {
            IERC20(borrowTokenAddr).safeIncreaseAllowance(flashLoanService, usdcBalance);
            uint256 extraWeth = IFlashLoanService(flashLoanService).swap(
                borrowTokenAddr,
                WETH,
                usdcBalance
            );
            wethReturned += extraWeth;
        }
        
        // Mark position as closed
        _positions[positionId].isActive = false;
        emit LeveragePositionClosed(positionId, wethReturned);
        
        delete _flashLoanContext;
        
        return wethReturned;
    }
    
    /// @inheritdoc IProtocolAdapter
    function getTotalCollateral() external view override returns (uint256 collateralEth) {
        for (uint256 i = 0; i < nextPositionId; i++) {
            LeveragePositionStorage storage pos = _positions[i];
            if (!pos.isActive) continue;
            
            address subAccount = _deriveSubAccount(pos.subAccountId);
            uint256 shares = IEVault(pos.collateralVault).balanceOf(subAccount);
            collateralEth += IEVault(pos.collateralVault).convertToAssets(shares);
        }
    }
    
    /// @inheritdoc IProtocolAdapter
    function getTotalDebt() external view override returns (uint256 debtEth) {
        for (uint256 i = 0; i < nextPositionId; i++) {
            LeveragePositionStorage storage pos = _positions[i];
            if (!pos.isActive) continue;
            
            address subAccount = _deriveSubAccount(pos.subAccountId);
            debtEth += IEVault(pos.borrowVault).debtOf(subAccount);
        }
    }
    
    /// @inheritdoc IProtocolAdapter
    function getLowestHealthFactor() external view override returns (uint256 healthFactor) {
        healthFactor = type(uint256).max;
        
        for (uint256 i = 0; i < nextPositionId; i++) {
            LeveragePositionStorage storage pos = _positions[i];
            if (!pos.isActive) continue;
            
            address subAccount = _deriveSubAccount(pos.subAccountId);
            IAccountLens lens = IAccountLens(ACCOUNT_LENS_ADDRESS);
            IAccountLens.AccountLiquidityInfo memory liq = lens.getAccountLiquidityInfo(subAccount, pos.borrowVault);
            
            if (!liq.queryFailure && liq.liabilityValueBorrowing > 0) {
                uint256 hf = (liq.collateralValueBorrowing * 1e18) / liq.liabilityValueBorrowing;
                if (hf < healthFactor) healthFactor = hf;
            }
        }
    }
    
    /// @inheritdoc IProtocolAdapter
    function getMaxWithdrawable(string memory tokenCode) external view override returns (uint256 maxAmount) {
        address vault = _getVaultSafe(tokenCode);
        if (vault == address(0)) return 0;
        return IEVault(vault).maxWithdraw(address(this));
    }
    
    /// @inheritdoc IProtocolAdapter
    function isCircuitBreakerActive() external view override returns (bool) {
        return circuitBreakerTripped;
    }
    
    /// @inheritdoc IProtocolAdapter
    function activateCircuitBreaker() external override onlyOwner {
        circuitBreakerTripped = true;
        emit CircuitBreakerSet(true);
    }
    
    // ==================== IEulerV2PluginSpecific IMPLEMENTATION ====================
    
    /// @inheritdoc IEulerV2PluginSpecific
    function getLeveragePosition(uint256 positionId) 
        external view override 
        returns (IEulerV2PluginSpecific.LeveragePositionInternal memory position) 
    {
        LeveragePositionStorage storage pos = _positions[positionId];
        position = IEulerV2PluginSpecific.LeveragePositionInternal({
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
    
    /// @inheritdoc IEulerV2PluginSpecific
    function getAllLeveragePositions() 
        external view override 
        returns (IEulerV2PluginSpecific.LeveragePositionInternal[] memory positions) 
    {
        positions = new IEulerV2PluginSpecific.LeveragePositionInternal[](nextPositionId);
        
        for (uint256 i = 0; i < nextPositionId; i++) {
            LeveragePositionStorage storage pos = _positions[i];
            positions[i] = IEulerV2PluginSpecific.LeveragePositionInternal({
                positionId: i,
                subAccountId: pos.subAccountId,
                collateralVault: pos.collateralVault,
                borrowVault: pos.borrowVault,
                initialCollateral: pos.initialCollateral,
                borrowedAmount: pos.borrowedAmount,
                isActive: pos.isActive,
                createdAt: pos.createdAt
            });
        }
    }
    
    // ==================== INTERNAL HELPERS ====================
    
    /**
     * @notice Convert internal position to IProtocolAdapter.Position format
     */
    function _convertToStandardPosition(uint256 positionId, LeveragePositionStorage storage pos) 
        internal view returns (IProtocolAdapter.Position memory) 
    {
        address subAccount = _deriveSubAccount(pos.subAccountId);
        
        // Get collateral value
        uint256 collShares = IEVault(pos.collateralVault).balanceOf(subAccount);
        uint256 collValue = IEVault(pos.collateralVault).convertToAssets(collShares);
        
        // Get debt value
        uint256 debtValue = IEVault(pos.borrowVault).debtOf(subAccount);
        
        // Get health factor
        uint256 hf = type(uint256).max;
        IAccountLens lens = IAccountLens(ACCOUNT_LENS_ADDRESS);
        IAccountLens.AccountLiquidityInfo memory liq = lens.getAccountLiquidityInfo(subAccount, pos.borrowVault);
        if (!liq.queryFailure && liq.liabilityValueBorrowing > 0) {
            hf = (liq.collateralValueBorrowing * 1e18) / liq.liabilityValueBorrowing;
        }
        
        return IProtocolAdapter.Position({
            positionId: positionId,
            protocolName: "Euler",
            status: pos.isActive ? IProtocolAdapter.PositionStatus.ACTIVE : IProtocolAdapter.PositionStatus.CLOSED,
            collateralValueEth: collValue,
            debtValueEth: debtValue,
            netValueEth: collValue > debtValue ? collValue - debtValue : 0,
            healthFactor: hf,
            openTimestamp: pos.createdAt,
            collateralToken: pos.collateralVault,
            debtToken: pos.borrowVault
        });
    }
}
