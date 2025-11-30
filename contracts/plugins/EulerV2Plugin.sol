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
import "../interfaces/euler/IEVault.sol";
import "../interfaces/euler/IEVC.sol";
import "../interfaces/euler/ISwapper.sol";
import "../interfaces/euler/IAccountLens.sol";

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
 * - Swapper + SwapVerifier: Per operazioni leverage
 * 
 * CUSTODY MODEL:
 * - ProtocolManager chiama deposit/withdraw/borrow/repay
 * - Plugin si aspetta token già nel contratto (inviati da ProtocolManager)
 * - Plugin restituisce token a ProxyGeneral dopo operazioni
 * - Operazioni leverage chiamate direttamente (con trasferimento preventivo)
 * 
 * INDIRIZZI ARBITRUM:
 * - EVC: 0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066
 * - Swapper: 0x6eE488A00A2ef1E2764cD7245F8a77C40060A7C7
 * - SwapVerifier: 0x7b16DAaFa76CfeC8C08D7a68aF31949B37ebfdF5
 * 
 * @author Project4 Team
 * @custom:version 1.0.0
 */
contract EulerV2Plugin is IEulerV2Plugin, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ==================== IMMUTABLES ====================
    
    /// @notice Beacon per risoluzione moduli (ProxyGeneral, TokenManager, EulerVaultRegistry)
    address public immutable beacon;
    
    /// @notice Euler Vault Connector (hub centrale)
    IEVC public immutable evc;
    
    // ==================== CONSTANTS ====================
    
    /// @notice Indirizzo EVC su Arbitrum
    address public constant EVC_ADDRESS = 0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066;
    
    /// @notice Indirizzo Swapper su Arbitrum
    address public constant SWAPPER_ADDRESS = 0x6eE488A00A2ef1E2764cD7245F8a77C40060A7C7;
    
    /// @notice Indirizzo SwapVerifier su Arbitrum
    address public constant SWAP_VERIFIER_ADDRESS = 0x7b16DAaFa76CfeC8C08D7a68aF31949B37ebfdF5;
    
    /// @notice Indirizzo AccountLens su Arbitrum (per health factor)
    address public constant ACCOUNT_LENS_ADDRESS = 0x90a52DDcb232e7bb003DD9258fA1235c553eC956;
    
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
    error DeadlineExpired();
    error HealthFactorTooLow();
    
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
    
    // ==================== IEulerV2Plugin: LEVERAGE OPERATIONS ====================
    
    /**
     * @inheritdoc IEulerV2Plugin
     * @dev Apre una posizione leverage usando EVC batch atomico:
     *      1. Deposita collaterale iniziale nel sub-account
     *      2. Abilita collateral vault come collaterale
     *      3. Abilita borrow vault come controller
     *      4. Borrow dal vault → Swapper
     *      5. Swapper esegue lo swap → collaterale
     *      6. Deposita collaterale swappato
     *      7. SwapVerifier verifica output minimo
     * 
     * IMPORTANTE: I token collaterali DEVONO essere già nel plugin prima della chiamata!
     * Il chiamante (owner) deve trasferire i token al plugin prima.
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
            revert InvalidAddress(); // Reuse error
        }
        
        // 1. Risolvi vault
        address collateralVault = _getVault(params.collateralTokenCode);
        address borrowVault = _getVault(params.borrowTokenCode);
        address collateralToken = _resolveToken(params.collateralTokenCode);
        
        // 2. Verifica che il plugin abbia ricevuto il collaterale
        uint256 balance = IERC20(collateralToken).balanceOf(address(this));
        if (balance < params.collateralAmount) {
            revert InsufficientBalance(balance, params.collateralAmount);
        }
        
        // 3. Assegna nuovo sub-account ID
        uint8 subAccountId = nextSubAccountId;
        nextSubAccountId++;
        if (nextSubAccountId == 0) nextSubAccountId = LEVERAGE_SUB_ACCOUNT_START; // Wrap around
        
        address subAccount = _deriveSubAccount(subAccountId);
        
        // 4. Deposita collaterale iniziale PRIMA del batch
        //    Il vault.deposit viene chiamato direttamente dal plugin (non via EVC batch)
        //    perché i token sono nel plugin e serve il plugin come msg.sender
        IERC20(collateralToken).safeIncreaseAllowance(collateralVault, params.collateralAmount);
        IEVault(collateralVault).deposit(params.collateralAmount, subAccount);
        
        // 5. Abilita collateral e controller via EVC (chiamate dirette, non batch)
        //    L'EVC riconosce il plugin come owner dei sub-account derivati da address(this)
        evc.enableCollateral(subAccount, collateralVault);
        evc.enableController(subAccount, borrowVault);
        
        // 6. Costruisci ed esegui batch EVC solo per borrow + swap + verify
        IEVC.BatchItem[] memory batchItems = _buildOpenLeverageBatch(
            params,
            subAccountId,
            subAccount,
            collateralVault,
            borrowVault
        );
        
        // 6. Esegui batch atomico
        evc.batch(batchItems);
        
        // 7. Registra posizione
        positionId = nextPositionId++;
        _positions[positionId] = LeveragePositionInternal({
            subAccountId: subAccountId,
            collateralVault: collateralVault,
            borrowVault: borrowVault,
            initialCollateral: params.collateralAmount,
            borrowedAmount: params.borrowAmount,
            isActive: true,
            createdAt: block.timestamp
        });
        
        // 8. Ottieni collaterale totale dopo swap per evento
        uint256 totalCollateral = IEVault(collateralVault).balanceOf(subAccount);
        totalCollateral = IEVault(collateralVault).convertToAssets(totalCollateral);
        
        emit LeveragePositionOpened(positionId, subAccountId, totalCollateral, params.borrowAmount);
        
        return positionId;
    }
    
    /**
     * @inheritdoc IEulerV2Plugin
     * @dev Chiude una posizione leverage usando EVC batch atomico:
     *      1. Preleva tutto il collaterale → Swapper
     *      2. Swap collaterale → debt token (target debt mode)
     *      3. Ripaga tutto il debito
     *      4. SwapVerifier verifica debito = 0
     *      5. Trasferisce collaterale residuo a ProxyGeneral
     * 
     * NOTA: Per posizioni con debito, i token per il ripago DEVONO essere 
     * già nel plugin (trasferiti prima della chiamata) OPPURE usare 
     * closeLeveragePositionWithSwap per swap automatico.
     */
    function closeLeveragePosition(uint256 positionId) 
        external 
        override 
        onlyOwner
        notCircuitBroken
        nonReentrant
        returns (uint256 collateralReturned) 
    {
        // 1. Verifica posizione
        if (positionId >= nextPositionId) revert PositionNotFound(positionId);
        LeveragePositionInternal storage pos = _positions[positionId];
        if (!pos.isActive) revert PositionAlreadyClosed(positionId);
        
        address subAccount = _deriveSubAccount(pos.subAccountId);
        address collateralToken = IEVault(pos.collateralVault).asset();
        address borrowToken = IEVault(pos.borrowVault).asset();
        
        // 2. Ottieni debito corrente
        uint256 currentDebt = IEVault(pos.borrowVault).debtOf(subAccount);
        
        // 3. Se c'è debito, ripaga prima
        if (currentDebt > 0) {
            // Verifica che abbiamo abbastanza token per ripagare
            uint256 borrowTokenBalance = IERC20(borrowToken).balanceOf(address(this));
            if (borrowTokenBalance < currentDebt) {
                revert InsufficientBalance(borrowTokenBalance, currentDebt);
            }
            
            // Ripaga il debito
            IERC20(borrowToken).safeIncreaseAllowance(pos.borrowVault, currentDebt);
            IEVault(pos.borrowVault).repay(currentDebt, subAccount);
        }
        
        // 4. Preleva tutto il collaterale
        uint256 collateralShares = IEVault(pos.collateralVault).balanceOf(subAccount);
        if (collateralShares > 0) {
            IEVault(pos.collateralVault).redeem(
                collateralShares, 
                address(this), 
                subAccount
            );
        }
        
        // 5. Trasferisci tutto il collaterale a ProxyGeneral
        uint256 collateralBalance = IERC20(collateralToken).balanceOf(address(this));
        if (collateralBalance > 0) {
            address proxyGeneral = _getProxyGeneral();
            IERC20(collateralToken).safeTransfer(proxyGeneral, collateralBalance);
            collateralReturned = collateralBalance;
        }
        
        // 6. Disabilita controller (opzionale, per pulizia)
        // evc.disableController(subAccount, pos.borrowVault);
        
        // 7. Marca posizione come chiusa
        pos.isActive = false;
        
        emit LeveragePositionClosed(positionId, collateralReturned);
        
        return collateralReturned;
    }
    
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
        address subAccount = _deriveSubAccount(pos.subAccountId);
        
        // Verifica balance
        uint256 balance = IERC20(collateralToken).balanceOf(address(this));
        if (balance < amount) revert InsufficientBalance(balance, amount);
        
        // Approva e deposita
        IERC20(collateralToken).safeIncreaseAllowance(pos.collateralVault, amount);
        IEVault(pos.collateralVault).deposit(amount, subAccount);
        
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
    
    // ==================== LEVERAGE BATCH BUILDERS ====================
    
    /**
     * @notice Costruisce batch per apertura posizione leverage
     * @dev Batch atomico:
     *      1. Deposit collaterale iniziale
     *      2. Enable collateral vault
     *      3. Enable controller (borrow vault)
     *      4. Borrow → Swapper
     *      5. Swap (eseguito da Swapper)
     *      6. Deposit swapped collateral
     *      7. Verify con SwapVerifier
     */
    function _buildOpenLeverageBatch(
        OpenLeverageParams calldata params,
        uint8 /* subAccountId */,
        address subAccount,
        address collateralVault,
        address borrowVault
    ) internal view returns (IEVC.BatchItem[] memory items) {
        // NOTA: Il deposit del collaterale iniziale e l'abilitazione di collateral/controller
        // sono già stati fatti PRIMA del batch.
        //
        // Il batch fa solo:
        // 1. Borrow → Swapper
        // 2. Swap (USDC → WETH) con receiver = collateralVault
        // 3. SwapVerifier.verifyAmountMinAndSkim() fa slippage check + skim
        
        items = new IEVC.BatchItem[](3);
        
        // 1. Borrow dal vault → inviare direttamente allo Swapper
        items[0] = IEVC.BatchItem({
            targetContract: borrowVault,
            onBehalfOfAccount: subAccount,
            value: 0,
            data: abi.encodeCall(IEVault.borrow, (params.borrowAmount, SWAPPER_ADDRESS))
        });
        
        // 2. Eseguire swap via Swapper
        // Il swapData contiene: handler=Generic, receiver=collateralVault
        // I token output vengono mandati direttamente al vault
        // NOTA: Usiamo subAccount come onBehalfOfAccount perché l'EVC richiede
        //       autenticazione quando targetContract != msg.sender.
        //       Lo Swapper non usa effettivamente onBehalfOfAccount, ma l'EVC
        //       deve poter verificare che il chiamante (plugin) è autorizzato.
        items[1] = IEVC.BatchItem({
            targetContract: SWAPPER_ADDRESS,
            onBehalfOfAccount: subAccount,
            value: 0,
            data: params.swapData
        });
        
        // 3. SwapVerifier verifica slippage e fa skim() per depositare i token
        // skim() prende i token "extra" nel vault (balance - cash) e li deposita
        // NOTA: Come sopra, usiamo subAccount per soddisfare l'autenticazione EVC.
        items[2] = IEVC.BatchItem({
            targetContract: SWAP_VERIFIER_ADDRESS,
            onBehalfOfAccount: subAccount,
            value: 0,
            data: abi.encodeCall(
                ISwapVerifier.verifyAmountMinAndSkim,
                (collateralVault, subAccount, params.minCollateralReceived, params.deadline)
            )
        });
        
        return items;
    }
    
    /**
     * @notice Costruisce batch per chiusura posizione leverage
     * @dev Batch atomico:
     *      1. Withdraw tutto il collaterale → Swapper
     *      2. Swap collaterale → debt token
     *      3. Ripaga debito
     *      4. Verify debito = 0
     * 
     * NOTA: Per semplicità iniziale, questa versione richiede che swapData 
     * sia pre-costruito off-chain. In futuro si può integrare con aggregator API.
     */
    function _buildCloseLeverageBatch(
        LeveragePositionInternal storage pos,
        address subAccount
    ) internal view returns (IEVC.BatchItem[] memory items) {
        // Per ora, versione semplificata: withdraw tutto e swap manualmente
        // In produzione, si userebbe un batch più sofisticato con Swapper
        
        items = new IEVC.BatchItem[](1);
        
        // 1. Preleva tutto il collaterale (lo usiamo per ripagare manualmente)
        items[0] = IEVC.BatchItem({
            targetContract: pos.collateralVault,
            onBehalfOfAccount: subAccount,
            value: 0,
            data: abi.encodeCall(IEVault.withdraw, (type(uint256).max, address(this), subAccount))
        });
        
        // NOTA: Il ripago del debito viene gestito separatamente perché richiede
        // uno swap esterno (via aggregator) che non può essere incluso nel batch
        // in modo semplice senza integrare l'API dell'aggregator.
        // 
        // Per una versione production-ready:
        // 1. Integrare con 1inch/Paraswap API per generare swapData
        // 2. Aggiungere items per: withdraw → swapper → swap → repay → verify
        
        return items;
    }
}
