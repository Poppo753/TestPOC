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
import "../interfaces/ILensAdapter.sol";
import "../interfaces/IEulerRegistry.sol";
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
 * SUB-ACCOUNT ALLOCATION STRATEGY (Opzione C - Lazy On-Demand):
 * 
 * EVC (Ethereum Vault Connector) requires unique addresses for each position:
 *   address = address(this) XOR subAccountId
 * 
 * DESIGN DECISION (June 2024):
 * Previous approach: Manual allocation in plugin (nextSubAccountId counter)
 * Current approach: Lazy allocation in EulerRegistry via createPositionOnDemand()
 * 
 * Benefits:
 * 1. Sub-account reuse: Same vault pair → same sub-account
 *    - First open: 42k gas (allocate + create position)
 *    - Re-open: 27k gas (reuse sub-account, -36%)
 * 
 * 2. Centralized management: EulerRegistry owns allocation logic
 *    - Single source of truth for position → sub-account mapping
 *    - EulerLensAdapter, ProtocolManager remain unchanged
 * 
 * 3. Safety: No race conditions on shared counter
 *    - Hash-based allocation: keccak256(abi.encode(collateralVault, borrowVault))
 *    - Deterministic: same pair always gets same sub-account
 * 
 * 4. Code size: -3.3 KB net (-7.7 KB plugin, +4.4 KB registry)
 * 
 * Implementation:
 * - EulerRegistry.positionKeyToSubAccount: mapping(bytes32 => uint8)
 * - createPositionOnDemand(): allocates on first use, reuses on subsequent opens
 * - Helper functions: getSubAccountForPair(), hasActivePositionForPair()
 * 
 * Alternatives considered:
 * - Opzione A (Pool): Pre-allocated 10 sub-accounts with manual reuse
 *   Rejected: Complex pool management, 20k gas overhead per allocation check
 * 
 * - Opzione B (Main-Only): No sub-accounts, single position only
 *   Rejected: No parallel positions, breaks multi-collateral use cases
 * 
 * See: contracts/plugins/EulerRegistry.sol for allocation implementation
 *      GMX_V2_INTEGRATION_STRATEGY.md for full analysis

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
    
    /// @notice Minimum health factor (1.05 = 105%)
    uint256 public constant MIN_HEALTH_FACTOR = 1.05e18;
    
    /// @notice Sub-account ID per depositi semplici
    uint8 public constant MAIN_SUB_ACCOUNT = 0;
    
    // Removed: LEVERAGE_SUB_ACCOUNT_START - allocation managed by EulerRegistry (Opzione C)
    
    // ==================== STATE VARIABLES ====================
    
    /// @notice Circuit breaker flag (emergency stop)
    bool public override circuitBreakerTripped;
    
    /// @dev Sub-account allocation removed - now managed by EulerRegistry (Opzione C)
    /// @dev See EulerRegistry.createPositionOnDemand() for lazy allocation logic
    
    /// @notice Flag per verificare callback flash loan legittimo
    bool private _inFlashLoanCallback;
    
    /// @notice Contesto temporaneo durante flash loan
    FlashLoanCallbackContext private _flashLoanContext;
    
    // ==================== INTERNAL STRUCTS ====================
    
    /// @notice Tipo di operazione flash loan
    enum FlashLoanOperation { OPEN, CLOSE }
    
    /// @notice Contesto per callback flash loan (semplificato per Opzione C)
    /// @dev Removed targetLeverageX100, minHealthFactor - only used for validation, not in callback
    struct FlashLoanCallbackContext {
        FlashLoanOperation operation;   // OPEN o CLOSE
        address user;
        address collateralVault;
        address borrowVault;
        uint256 initialCollateral;       // Solo per OPEN
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
    error BatchOperationFailed();
    
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
        // Sub-account allocation removed - now managed by EulerRegistry (Opzione C)
    }
    
    // ==================== IProtocolManager: DEPOSIT/WITHDRAW ====================
    
    /**
     * @inheritdoc IProtocolAdapter
     * @dev Deposita token nel vault Euler corrispondente
     *      I token devono essere già nel contratto (inviati da ProtocolManager)
     *      Auto-abilita il vault come collaterale in EVC se non già abilitato
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
        
        // 4. Deposita nel vault Euler via EVC batch (Euler official pattern)
        // Enable collateral + deposit in the same atomic batch to defer status checks
        IEVC.BatchItem[] memory items = evc.isCollateralEnabled(address(this), vault)
            ? new IEVC.BatchItem[](1)
            : new IEVC.BatchItem[](2);
        
        uint256 cursor;
        if (items.length == 2) {
            items[cursor++] = _buildBatchItem(
                address(evc),
                abi.encodeWithSelector(IEVC.enableCollateral.selector, address(this), vault)
            );
        }
        
        items[cursor] = _buildBatchItem(
            vault,
            abi.encodeWithSelector(IEVault.deposit.selector, amount, address(this))
        );
        
        uint256 sharesBefore = IEVault(vault).balanceOf(address(this));
        _executeBatch(items);
        uint256 sharesReceived = IEVault(vault).balanceOf(address(this)) - sharesBefore;
        
        emit EulerDeposit(tokenCode, vault, amount, sharesReceived);
        
        return true;
    }
    
    /**
     * @inheritdoc IProtocolAdapter
     * @dev Preleva token dal vault Euler e li invia a ProxyGeneral
     *      Auto-disabilita il collaterale se si ritira tutto e non ci sono debiti
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
        
        // 2. Check se stiamo ritirando tutto
        uint256 totalShares = IEVault(vault).balanceOf(address(this));
        if (totalShares == 0) {
            revert InsufficientBalance(0, amount);
        }
        
        // 3. Verifica balance disponibile
        uint256 maxWithdraw = IEVault(vault).maxWithdraw(address(this));
        
        // Se amount = 0, withdraw all
        uint256 withdrawAmount = (amount == 0) ? maxWithdraw : (amount > maxWithdraw ? maxWithdraw : amount);
        
        if (withdrawAmount == 0) {
            revert InsufficientBalance(0, amount);
        }
        
        // 4. Preleva da Euler via EVC batch
        // If we are fully exiting and no debt remains, disable collateral in same batch.
        bool withdrawingAll = withdrawAmount == maxWithdraw;
        bool canDisableCollateral = withdrawingAll &&
            IEVault(vault).debtOf(address(this)) == 0 &&
            evc.isCollateralEnabled(address(this), vault);
        
        IEVC.BatchItem[] memory items = canDisableCollateral
            ? new IEVC.BatchItem[](2)
            : new IEVC.BatchItem[](1);
        
        items[0] = _buildBatchItem(
            vault,
            abi.encodeWithSelector(IEVault.withdraw.selector, withdrawAmount, address(this), address(this))
        );
        
        if (canDisableCollateral) {
            items[1] = _buildBatchItem(
                address(evc),
                abi.encodeWithSelector(IEVC.disableCollateral.selector, address(this), vault)
            );
        }
        
        uint256 sharesBefore = IEVault(vault).balanceOf(address(this));
        _executeBatch(items);
        uint256 sharesBurned = sharesBefore - IEVault(vault).balanceOf(address(this));
        
        // 5. Trasferisci a ProxyGeneral (CRITICO per custody)
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
     *      Auto-abilita il vault come controller in EVC se non già abilitato
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
        
        // 2. Borrow da Euler via EVC batch (enable controller + borrow)
        IEVC.BatchItem[] memory items = evc.isControllerEnabled(address(this), vault)
            ? new IEVC.BatchItem[](1)
            : new IEVC.BatchItem[](2);
        
        uint256 cursor;
        if (items.length == 2) {
            items[cursor++] = _buildBatchItem(
                address(evc),
                abi.encodeWithSelector(IEVC.enableController.selector, address(this), vault)
            );
        }
        
        items[cursor] = _buildBatchItem(
            vault,
            abi.encodeWithSelector(IEVault.borrow.selector, amount, address(this))
        );
        
        _executeBatch(items);
        
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
     *      Auto-disabilita il controller se debt = 0 dopo repay
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
        
        // 2. Get actual debt to handle dust correctly
        uint256 currentDebt = IEVault(vault).debtOf(address(this));
        if (currentDebt == 0) {
            return true; // No debt, nothing to repay
        }
        
        // 3. Determine repay amount (handle "repay all" if amount = 0 or >= debt)
        uint256 repayAmount = (amount == 0 || amount >= currentDebt) ? currentDebt : amount;
        
        // 4. Verifica balance
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance < repayAmount) {
            revert InsufficientBalance(balance, repayAmount);
        }
        
        // 5. Approva e ripaga via EVC batch
        IERC20(token).safeIncreaseAllowance(vault, repayAmount);
        
        IEVC.BatchItem[] memory repayItems = new IEVC.BatchItem[](1);
        repayItems[0] = _buildBatchItem(
            vault,
            abi.encodeWithSelector(IEVault.repay.selector, repayAmount, address(this))
        );
        _executeBatch(repayItems);
        
        // 6. Handle interest dust that accrued during transaction
        uint256 remainingDebt = IEVault(vault).debtOf(address(this));
        
        // If there's minimal dust (< 1000 wei), repay it too to fully close position
        if (remainingDebt > 0 && remainingDebt < 1000) {
            uint256 dustBalance = IERC20(token).balanceOf(address(this));
            if (dustBalance >= remainingDebt) {
                IERC20(token).safeIncreaseAllowance(vault, remainingDebt);
                IEVC.BatchItem[] memory dustItems = new IEVC.BatchItem[](1);
                dustItems[0] = _buildBatchItem(
                    vault,
                    abi.encodeWithSelector(IEVault.repay.selector, remainingDebt, address(this))
                );
                _executeBatch(dustItems);
                remainingDebt = 0; // Force to 0 after dust repay
            }
        }
        
        // 7. Auto-disable controller REMOVED - should be done via batch operation
        // The EVC doesn't allow disabling controller while collateral is still enabled
        // This should be handled externally with proper sequencing:
        // 1. Repay debt
        // 2. Withdraw collateral (if any)
        // 3. Disable collateral
        // 4. Disable controller
        // OR use EVC.batch() to do atomic operations
        
        emit EulerRepay(tokenCode, vault, repayAmount);
        emit Repaid(tokenCode, repayAmount, 0);
        
        return true;
    }
    
    /**
     * @notice Close a complete position: repay all debt, disable controller, withdraw collateral, disable collateral
     * @dev Atomic operation to fully exit a position in a single transaction
     * @param debtTokenCode Token code for debt (e.g., "USDC")
     * @param collateralTokenCode Token code for collateral (e.g., "WETH")
     * @return success True if position closed successfully
     */
    function closePosition(
        string memory debtTokenCode,
        string memory collateralTokenCode
    ) 
        external 
        onlyProtocolManager
        notCircuitBroken
        nonReentrant
        returns (bool success) 
    {
        // 1. Resolve vaults/tokens and debt
        address debtToken = _resolveToken(debtTokenCode);
        address debtVault = _getVault(debtTokenCode);
        address collateralToken = _resolveToken(collateralTokenCode);
        address collateralVault = _getVault(collateralTokenCode);
        
        uint256 repayAmount = IEVault(debtVault).debtOf(address(this));
        if (repayAmount > 0) {
            uint256 debtBalance = IERC20(debtToken).balanceOf(address(this));
            if (debtBalance < repayAmount) revert InsufficientBalance(debtBalance, repayAmount);
            IERC20(debtToken).safeIncreaseAllowance(debtVault, repayAmount);
        }
        
        uint256 maxWithdraw = IEVault(collateralVault).maxWithdraw(address(this));
        
        // 2. Build single atomic batch with official Euler sequencing
        uint256 steps = 0;
        if (repayAmount > 0) steps += 1;
        if (repayAmount > 0 && evc.isControllerEnabled(address(this), debtVault)) steps += 1;
        if (maxWithdraw > 0) steps += 1;
        if (evc.isCollateralEnabled(address(this), collateralVault)) steps += 1;
        
        if (steps == 0) return true;
        
        IEVC.BatchItem[] memory items = new IEVC.BatchItem[](steps);
        uint256 cursor;
        
        if (repayAmount > 0) {
            items[cursor++] = _buildBatchItem(
                debtVault,
                abi.encodeWithSelector(IEVault.repay.selector, repayAmount, address(this))
            );
            
            if (evc.isControllerEnabled(address(this), debtVault)) {
                items[cursor++] = _buildBatchItem(
                    address(evc),
                    abi.encodeWithSelector(IEVC.disableController.selector, address(this), debtVault)
                );
            }
        }
        
        if (maxWithdraw > 0) {
            items[cursor++] = _buildBatchItem(
                collateralVault,
                abi.encodeWithSelector(IEVault.withdraw.selector, maxWithdraw, address(this), address(this))
            );
        }
        
        if (evc.isCollateralEnabled(address(this), collateralVault)) {
            items[cursor] = _buildBatchItem(
                address(evc),
                abi.encodeWithSelector(IEVC.disableCollateral.selector, address(this), collateralVault)
            );
        }
        
        _executeBatch(items);
        
        // 3. Transfer returned collateral to ProxyGeneral
        uint256 collateralBalance = IERC20(collateralToken).balanceOf(address(this));
        if (collateralBalance > 0) {
            IERC20(collateralToken).safeTransfer(_getProxyGeneral(), collateralBalance);
        }
        
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
        address collateralVault = _getVault(params.collateralToken);
        address borrowVault = _getVault(params.borrowToken);
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
        
        // Salva contesto per callback (semplificato per Opzione C)
        _flashLoanContext = FlashLoanCallbackContext({
            operation: FlashLoanOperation.OPEN,
            user: msg.sender,
            collateralVault: collateralVault,
            borrowVault: borrowVault,
            initialCollateral: params.collateralAmount,
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
        uint256 minHF = params.minHealthFactor > 0 ? params.minHealthFactor : MIN_HEALTH_FACTOR;
        if (healthFactor < minHF) {
            revert HealthFactorTooLow(healthFactor, minHF);
        }
        
        // Registra posizione con lazy allocation (Opzione C)
        // createPositionOnDemand allocates sub-account on-demand and reuses for same vault pair
        address registry = _getVaultRegistry();
        IEulerRegistry(registry).createPositionOnDemand(
            collateralVault,
            borrowVault,
            params.collateralAmount,
            totalDebt
        );
        
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
        address collateralVault = _getVault(params.collateralToken);
        address borrowVault = _getVault(params.borrowToken);
        address borrowToken = IEVault(borrowVault).asset();
        
        // Ottieni debito corrente
        uint256 currentDebt = IEVault(borrowVault).debtOf(address(this));
        if (currentDebt == 0) revert NoPositionToClose();
        
        // Salva contesto per callback (semplificato per Opzione C)
        _flashLoanContext = FlashLoanCallbackContext({
            operation: FlashLoanOperation.CLOSE,
            user: msg.sender,
            collateralVault: collateralVault,
            borrowVault: borrowVault,
            initialCollateral: 0,   // Non usato per CLOSE
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

        // Step 3/4/5: Official Euler atomic path via EVC.batch:
        // enable collateral -> enable controller -> deposit -> borrow
        uint256 borrowAmount = flashLoanAmount + feeAmount;
        uint256 steps = 2; // deposit + borrow
        bool needsCollateralEnable = !evc.isCollateralEnabled(address(this), ctx.collateralVault);
        bool needsControllerEnable = !evc.isControllerEnabled(address(this), ctx.borrowVault);
        if (needsCollateralEnable) steps += 1;
        if (needsControllerEnable) steps += 1;
        
        IEVC.BatchItem[] memory items = new IEVC.BatchItem[](steps);
        uint256 cursor;
        if (needsCollateralEnable) {
            items[cursor++] = _buildBatchItem(
                address(evc),
                abi.encodeWithSelector(IEVC.enableCollateral.selector, address(this), ctx.collateralVault)
            );
        }
        if (needsControllerEnable) {
            items[cursor++] = _buildBatchItem(
                address(evc),
                abi.encodeWithSelector(IEVC.enableController.selector, address(this), ctx.borrowVault)
            );
        }
        items[cursor++] = _buildBatchItem(
            ctx.collateralVault,
            abi.encodeWithSelector(IEVault.deposit.selector, totalCollateral, address(this))
        );
        items[cursor] = _buildBatchItem(
            ctx.borrowVault,
            abi.encodeWithSelector(IEVault.borrow.selector, borrowAmount, address(this))
        );
        _executeBatch(items);
        
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
        
        // Step 2: Use official Euler exit sequence in one batch:
        // repay -> disable controller -> withdraw all -> disable collateral
        uint256 collateralWithdrawn = 0;
        uint256 maxWithdraw = IEVault(ctx.collateralVault).maxWithdraw(address(this));
        bool hasControllerEnabled = evc.isControllerEnabled(address(this), ctx.borrowVault);
        bool hasCollateralEnabled = evc.isCollateralEnabled(address(this), ctx.collateralVault);
        uint256 steps = 1; // repay
        if (hasControllerEnabled) steps += 1;
        if (maxWithdraw > 0) steps += 1;
        if (hasCollateralEnabled) steps += 1;
        
        IEVC.BatchItem[] memory items = new IEVC.BatchItem[](steps);
        uint256 cursor;
        items[cursor++] = _buildBatchItem(
            ctx.borrowVault,
            abi.encodeWithSelector(IEVault.repay.selector, flashLoanAmount, address(this))
        );
        if (hasControllerEnabled) {
            items[cursor++] = _buildBatchItem(
                address(evc),
                abi.encodeWithSelector(IEVC.disableController.selector, address(this), ctx.borrowVault)
            );
        }
        if (maxWithdraw > 0) {
            items[cursor++] = _buildBatchItem(
                ctx.collateralVault,
                abi.encodeWithSelector(IEVault.withdraw.selector, maxWithdraw, address(this), address(this))
            );
        }
        if (hasCollateralEnabled) {
            items[cursor] = _buildBatchItem(
                address(evc),
                abi.encodeWithSelector(IEVC.disableCollateral.selector, address(this), ctx.collateralVault)
            );
        }
        
        uint256 collateralBalanceBefore = IERC20(collateralToken).balanceOf(address(this));
        _executeBatch(items);
        collateralWithdrawn = IERC20(collateralToken).balanceOf(address(this)) - collateralBalanceBefore;
        
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
        address registry = _getVaultRegistry();
        IEulerRegistry.LeveragePositionStorage memory pos = IEulerRegistry(registry).getPosition(positionId);
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
        address registry = _getVaultRegistry();
        IEulerRegistry.LeveragePositionStorage memory pos = IEulerRegistry(registry).getPosition(positionId);
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
    // ==================== ADMIN FUNCTIONS ====================
    
    /**
     * @inheritdoc IEulerV2PluginSpecific
     */
    function setCircuitBreaker(bool tripped) external override onlyOwner {
        circuitBreakerTripped = tripped;
        emit CircuitBreakerSet(tripped);
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
     * @notice Ottiene indirizzo EulerRegistry (Position Manager)
     * @return registry Indirizzo del Registry
     */
    function _getVaultRegistry() internal view returns (address registry) {
        return IBeacon(beacon).getImplementation("EulerRegistry");
    }
    
    /**
     * @notice Ottiene vault address da EulerVaultRegistry
     * @dev Reverte se non trovato
     */
    function _getVault(string memory tokenCode) internal view returns (address) {
        address registry = _getVaultRegistry();
        return IEulerRegistry(registry).getVault(tokenCode);
    }
    
    /**
     * @notice Ottiene vault address senza revert
     * @return address(0) se non trovato
     */
    function _getVaultSafe(string memory tokenCode) internal view returns (address) {
        address registry = _getVaultRegistry();
        if (registry == address(0)) return address(0);
        return IEulerRegistry(registry).getVaultSafe(tokenCode);
    }
    
    /**
     * @notice Deriva indirizzo sub-account
     * @dev Formula Euler: address XOR subAccountId
     */
    function _deriveSubAccount(uint8 subAccountId) internal view returns (address) {
        return address(uint160(address(this)) ^ uint160(subAccountId));
    }
    
    /**
     * @notice Build a single EVC batch item for main account operations
     * @param targetContract Contract to call inside batch
     * @param data Encoded calldata
     */
    function _buildBatchItem(
        address targetContract,
        bytes memory data
    ) internal view returns (IEVC.BatchItem memory item) {
        item = IEVC.BatchItem({
            targetContract: targetContract,
            onBehalfOfAccount: address(this),
            value: 0,
            data: data
        });
    }
    
    /**
     * @notice Execute EVC batch and bubble a generic error on failure
     */
    function _executeBatch(IEVC.BatchItem[] memory items) internal {
        try evc.batch(items) {} catch {
            revert BatchOperationFailed();
        }
    }
    
    // ==================== FLASH LOAN HELPERS ====================
    
    /**
     * @notice Ottiene FlashLoanService da Beacon
     */
    function _getFlashLoanService() internal view returns (address) {
        address service = IBeacon(beacon).getImplementation("FlashLoanService");
        if (service == address(0)) revert FlashLoanServiceNotFound();
        return service;
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
        address flashLoanService = _getFlashLoanService();
        
        // Calcola valore collaterale in borrow token
        uint256 collateralValueInBorrow = IFlashLoanService(flashLoanService).getExpectedOutput(
            collateralToken,
            borrowToken,
            collateralAmount
        );
        
        // Flash loan = collateralValue * (leverageMultiplier / 100)
        return (collateralValueInBorrow * leverageMultiplier) / 100;
    }
    
    /**
     * @notice Ottiene stato posizione corrente
     * @dev Usa getHealthFactor() per evitare duplicazione logica
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
        
        // Health factor - riusa logica esistente invece di duplicare
        healthFactor = this.getHealthFactor();
    }
    
    // ==================== IProtocolAdapter IMPLEMENTATION ====================
    
    /// @inheritdoc IProtocolAdapter
    /// @dev Closes a leverage position atomically using closeLeverageAtomic().
    ///      Retrieves position info and calls the atomic close function.
    function closePosition(uint256 positionId) external override returns (uint256 wethReturned) {
        // Verifica che la posizione esista ed è attiva
        address registry = _getVaultRegistry();
        IEulerRegistry.LeveragePositionStorage memory pos = IEulerRegistry(registry).getPosition(positionId);
        if (!pos.isActive) revert PositionAlreadyClosed(positionId);
        
        // Recupera token codes dai vault addresses
        IEulerRegistry registryContract = IEulerRegistry(registry);
        
        string memory collateralTokenCode = registryContract.getTokenCode(pos.collateralVault);
        string memory borrowTokenCode = registryContract.getTokenCode(pos.borrowVault);
        
        // Prepara parametri per chiusura atomica
        CloseLeverageAtomicParams memory params = CloseLeverageAtomicParams({
            collateralToken: collateralTokenCode,
            borrowToken: borrowTokenCode,
            maxSlippageBps: 200,  // 2% max slippage (default conservativo)
            deadline: block.timestamp + 300  // 5 minuti deadline
        });
        
        // Chiama chiusura atomica
        wethReturned = this.closeLeverageAtomic(params);
        
        // Marca posizione come chiusa nel Registry
        IEulerRegistry(registry).closePositionRecord(positionId);
        
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
        // Get sorted positions from LensAdapter
        address lensAdapter = IBeacon(beacon).getImplementation("EulerLensAdapter");
        ILensAdapter.PositionWithRisk[] memory sortedPositions = ILensAdapter(lensAdapter).getPositionsSortedByRisk();
        
        address registry = _getVaultRegistry();
        
        for (uint256 i = 0; i < sortedPositions.length && wethObtained < targetWethAmount; i++) {
            uint256 positionId = sortedPositions[i].positionId;
            
            // Skip invalid positions
            IEulerRegistry.LeveragePositionStorage memory pos = IEulerRegistry(registry).getPositionSafe(positionId);
            if (pos.createdAt == 0 || !pos.isActive) continue;
            
            // Get position tokens for closeLeverageAtomic
            address collateralAsset = IEVault(pos.collateralVault).asset();
            address borrowAsset = IEVault(pos.borrowVault).asset();
            address weth = IBeacon(beacon).getImplementation("WETH");
            string memory collateralToken = (collateralAsset == weth) ? "WETH" : "USDC";
            string memory borrowToken = (borrowAsset == weth) ? "WETH" : "USDC";
            
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
            address weth = IBeacon(beacon).getImplementation("WETH");
            IERC20(weth).safeTransfer(proxyGeneral, wethObtained);
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
        // Get EulerRegistry to find all vaults
        address vaultRegistry = IBeacon(beacon).getImplementation("EulerRegistry");
        if (vaultRegistry == address(0)) return (0, 0);
        
        // Get all registered vaults
        (, address[] memory vaults) = IEulerRegistry(vaultRegistry).getAllVaults();
        
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
                
                address weth = IBeacon(beacon).getImplementation("WETH");
                
                // If it's WETH, add directly
                if (asset == weth) {
                    wethObtained += withdrawn;
                } else {
                    // Swap non-WETH to WETH via FlashLoanService
                    address flashLoanService = _getFlashLoanService();
                    if (flashLoanService != address(0)) {
                        IERC20(asset).safeIncreaseAllowance(flashLoanService, withdrawn);
                        try IFlashLoanService(flashLoanService).swap(asset, weth, withdrawn) returns (uint256 wethFromSwap) {
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
        address collateralVault = _getVault(collateralToken);
        address borrowVault = _getVault(borrowToken);
        address borrowTokenAddr = IEVault(borrowVault).asset();
        
        // Get current debt
        uint256 currentDebt = IEVault(borrowVault).debtOf(address(this));
        if (currentDebt == 0) {
            // No debt - just withdraw collateral
            uint256 shares = IEVault(collateralVault).balanceOf(address(this));
            if (shares > 0) {
                wethReturned = IEVault(collateralVault).redeem(shares, address(this), address(this));
            }
            address positionRegistry = _getVaultRegistry();
            IEulerRegistry(positionRegistry).closePositionRecord(positionId);
            emit LeveragePositionClosed(positionId, wethReturned);
            return wethReturned;
        }
        
        // Save context for callback (semplificato per Opzione C)
        _flashLoanContext = FlashLoanCallbackContext({
            operation: FlashLoanOperation.CLOSE,
            user: address(this), // WETH goes to this contract, not external user
            collateralVault: collateralVault,
            borrowVault: borrowVault,
            initialCollateral: 0,
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
        
        address weth = IBeacon(beacon).getImplementation("WETH");
        uint256 wethBefore = IERC20(weth).balanceOf(address(this));
        
        IFlashLoanService(flashLoanService).executeFlashLoan(tokens, amounts, "");
        
        _inFlashLoanCallback = false;
        
        // Get WETH balance after (may include excess from swap)
        wethReturned = IERC20(weth).balanceOf(address(this)) - wethBefore;
        
        // If we still have USDC excess, swap it to WETH
        uint256 usdcBalance = IERC20(borrowTokenAddr).balanceOf(address(this));
        if (usdcBalance > 0) {
            IERC20(borrowTokenAddr).safeIncreaseAllowance(flashLoanService, usdcBalance);
            uint256 extraWeth = IFlashLoanService(flashLoanService).swap(
                borrowTokenAddr,
                weth,
                usdcBalance
            );
            wethReturned += extraWeth;
        }
        
        // Mark position as closed nel Registry
        address registry = _getVaultRegistry();
        IEulerRegistry(registry).closePositionRecord(positionId);
        emit LeveragePositionClosed(positionId, wethReturned);
        
        delete _flashLoanContext;
        
        return wethReturned;
    }
    
    /// @inheritdoc IProtocolAdapter
    function activateCircuitBreaker() external override onlyOwner {
        circuitBreakerTripped = true;
        emit CircuitBreakerSet(true);
    }
}
