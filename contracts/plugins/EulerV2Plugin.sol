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
     * @dev Per ora ritorna 0 - sarà implementato con EulerLensAdapter
     */
    function getHealthFactor() 
        external 
        view 
        override 
        returns (uint256) 
    {
        // TODO: Implementare con EulerLensAdapter
        // Per ora ritorna un valore placeholder alto (sicuro)
        return type(uint256).max;
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
        // TODO: Implementare con EulerLensAdapter
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
    
    // ==================== IEulerV2Plugin: LEVERAGE (PLACEHOLDER) ====================
    // Le funzioni leverage saranno implementate nella Fase 3
    
    /**
     * @inheritdoc IEulerV2Plugin
     * @dev PLACEHOLDER - Sarà implementato in Fase 3
     */
    function openLeveragePosition(OpenLeverageParams calldata /* params */) 
        external 
        override 
        onlyOwner
        notCircuitBroken
        nonReentrant
        returns (uint256) 
    {
        revert("Not implemented yet");
    }
    
    /**
     * @inheritdoc IEulerV2Plugin
     * @dev PLACEHOLDER - Sarà implementato in Fase 3
     */
    function closeLeveragePosition(uint256 /* positionId */) 
        external 
        override 
        onlyOwner
        notCircuitBroken
        nonReentrant
        returns (uint256) 
    {
        revert("Not implemented yet");
    }
    
    /**
     * @inheritdoc IEulerV2Plugin
     * @dev PLACEHOLDER - Sarà implementato in Fase 3
     */
    function addCollateralToPosition(uint256 /* positionId */, uint256 /* amount */) 
        external 
        override 
        onlyOwner
        notCircuitBroken
        nonReentrant
    {
        revert("Not implemented yet");
    }
    
    /**
     * @inheritdoc IEulerV2Plugin
     * @dev PLACEHOLDER - Sarà implementato in Fase 3
     */
    function removeCollateralFromPosition(uint256 /* positionId */, uint256 /* amount */) 
        external 
        override 
        onlyOwner
        notCircuitBroken
        nonReentrant
    {
        revert("Not implemented yet");
    }
    
    /**
     * @inheritdoc IEulerV2Plugin
     */
    function getPositionHealth(uint256 /* positionId */) 
        external 
        pure 
        override 
        returns (uint256) 
    {
        return 0;
    }
    
    /**
     * @inheritdoc IEulerV2Plugin
     */
    function getPositionValue(uint256 /* positionId */) 
        external 
        pure 
        override 
        returns (uint256, uint256) 
    {
        return (0, 0);
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
    
    // ==================== INTERNAL HELPERS ====================
    
    /**
     * @notice Risolve token address da tokenCode via TokenManager
     */
    function _resolveToken(string memory tokenCode) internal view returns (address) {
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
}
