// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../interfaces/IAaveV3Plugin.sol";
import "../interfaces/IAaveV3Registry.sol";
import "../interfaces/IBeacon.sol";
import "../interfaces/IProxyGeneral.sol";
import "../interfaces/ITokenManagerForModules.sol";
import "../interfaces/aave/IAaveV3Pool.sol";
import "../interfaces/IFlashLoanCallback.sol";

/**
 * @title IFlashLoanService
 * @notice Interface per il servizio flash loan centralizzato
 */
interface IFlashLoanService {
    function executeFlashLoan(address[] calldata tokens, uint256[] calldata amounts, bytes calldata callbackData) external;
    function swap(address tokenIn, address tokenOut, uint256 amountIn) external returns (uint256);
    function getExpectedOutput(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256);
}

/**
 * @title AaveV3Plugin
 * @notice Plugin per integrazione Aave V3 lending protocol via ProtocolManager
 * @dev Implementa IAaveV3Plugin (che estende IProtocolAdapter)
 * 
 * ARCHITETTURA:
 * - Gestito da ProtocolManager (orchestratore centrale)
 * - Custody flow: ProxyGeneral → ProtocolManager → AaveV3Plugin → Aave V3 Pool
 * - Operazioni: deposit (supply), withdraw, borrow, repay
 * 
 * DIFFERENZE CHIAVE VS EULER:
 * - Aave V3 ha un POOL UNICO condiviso (non vault per-token)
 * - 1 account per address (no sub-accounts, no EVC)
 * - Health factor NATIVO via getUserAccountData()
 * - Collaterale abilitato automaticamente al primo supply
 * - Solo variable rate borrowing (interestRateMode = 2)
 * - withdraw() può inviare direttamente a un recipient (3° parametro)
 * 
 * CUSTODY MODEL:
 * - ProtocolManager chiama deposit/withdraw/borrow/repay
 * - Plugin si aspetta token già nel contratto (inviati da ProtocolManager)
 * - Plugin restituisce token a ProxyGeneral dopo operazioni
 * 
 * INDIRIZZI AAVE V3 ARBITRUM:
 * - Pool: 0x794a61358D6845594F94dc1DB02A252b5b4814aD
 * - Oracle: 0xb56c2F0B653B2e0b10C9b928C8580Ac5Df02C7C7
 * - PoolDataProvider: 0x243Aa95cAC2a25651eda86e80bEe66114413c43b
 * 
 * @author Project4 Team
 * @custom:version 1.0.0
 */
contract AaveV3Plugin is IAaveV3Plugin, IFlashLoanCallback, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ==================== IMMUTABLES ====================

    /// @notice Beacon per risoluzione moduli (ProxyGeneral, TokenManager, AaveV3Registry)
    address public immutable beacon;

    /// @notice Aave V3 Pool address on Arbitrum
    IAaveV3Pool public immutable aavePool;

    // ==================== CONSTANTS ====================

    /// @notice Variable interest rate mode (Aave V3 only supports variable)
    uint256 public constant VARIABLE_RATE_MODE = 2;

    /// @notice Minimum health factor (1.05 = 105%)
    uint256 public constant MIN_HEALTH_FACTOR = 1.05e18;

    // ==================== STATE VARIABLES ====================

    /// @notice Base asset code for this pool (e.g. "WETH", "USDC", "WBTC")
    string public baseAssetCode;

    /// @notice Circuit breaker flag (emergency stop)
    bool public override circuitBreakerTripped;

    /// @notice Flash loan callback context (temporary, cleared after each operation)
    FlashLoanCallbackContext private _flashLoanContext;

    /// @notice Reentrancy guard for flash loan callbacks
    bool private _inFlashLoanCallback;

    // ==================== ENUMS & STRUCTS ====================

    enum FlashLoanOperation { OPEN, CLOSE }

    struct FlashLoanCallbackContext {
        FlashLoanOperation operation;
        address user;
        uint256 initialCollateral;    // Solo per OPEN
        uint256 maxSlippageBps;       // Solo per CLOSE
        string collateralTokenCode;
        string borrowTokenCode;
    }

    struct OpenLeverageAtomicParams {
        string collateralToken;       // e.g., "WETH"
        string borrowToken;           // e.g., "USDC"
        uint256 collateralAmount;     // Initial collateral amount
        uint256 targetLeverageX100;   // Target leverage * 100 (e.g., 200 = 2x)
        uint256 minHealthFactor;      // Minimum acceptable health factor
        uint256 deadline;             // Transaction deadline
    }

    struct CloseLeverageAtomicParams {
        string collateralToken;       // e.g., "WETH"
        string borrowToken;           // e.g., "USDC"
        uint256 maxSlippageBps;       // Max slippage in basis points (e.g., 100 = 1%)
        uint256 deadline;             // Transaction deadline
    }

    // ==================== ERRORS ====================

    error InvalidAddress();
    error CircuitBreakerActive();
    error TokenNotConfigured(string tokenCode);
    error InsufficientBalance(uint256 available, uint256 requested);
    error OnlyProtocolManager();
    error HealthFactorTooLow(uint256 current, uint256 minimum);
    error NoDebtToRepay();
    error DeadlineExpired();
    error InvalidLeverage();
    error NoPositionToClose();
    error SwapFailed();
    error SlippageExceeded(uint256 required, uint256 received);
    error UnauthorizedFlashLoanCallback();
    error FlashLoanServiceNotFound();

    // ==================== EVENTS ====================

    event EmergencyWithdraw(string indexed tokenCode, uint256 amount);
    event LeverageOpenedAtomic(
        address indexed user,
        address collateralToken,
        address borrowToken,
        uint256 initialCollateral,
        uint256 totalCollateral,
        uint256 totalDebt,
        uint256 healthFactor,
        uint256 leverageX100
    );
    event LeverageClosedAtomic(
        address indexed user,
        address collateralToken,
        address borrowToken,
        uint256 debtRepaid,
        uint256 collateralReturned
    );

    // ==================== MODIFIERS ====================

    /// @notice Verifica che il circuit breaker non sia attivo
    modifier notCircuitBroken() {
        if (circuitBreakerTripped) revert CircuitBreakerActive();
        _;
    }

    /// @notice Solo ProtocolManager o owner può chiamare
    modifier onlyProtocolManager() {
        address protocolManager = IBeacon(beacon).getImplementation("ProtocolManager");
        if (msg.sender != protocolManager && msg.sender != owner()) {
            revert OnlyProtocolManager();
        }
        _;
    }

    /// @notice Owner o LiquidityManager possono chiamare (per auto-close posizioni)
    modifier onlyOwnerOrLiquidityManager() {
        address liquidityManager = IBeacon(beacon).getImplementation("LiquidityManager");
        require(
            msg.sender == owner() || msg.sender == liquidityManager || msg.sender == address(this),
            "AaveV3Plugin: not authorized"
        );
        _;
    }

    // ==================== CONSTRUCTOR ====================

    /**
     * @notice Costruttore del plugin
     * @param _beacon Indirizzo del Beacon per risoluzione moduli
     * @param _aavePool Aave V3 Pool address (chain-specific, injected at deploy time)
     */
    constructor(address _beacon, string memory _baseAssetCode, address _aavePool) Ownable() {
        if (_beacon == address(0)) revert InvalidAddress();
        if (_aavePool == address(0)) revert InvalidAddress();
        beacon = _beacon;
        baseAssetCode = _baseAssetCode;
        aavePool = IAaveV3Pool(_aavePool);
    }

    // ==================== IProtocolAdapter: DEPOSIT/WITHDRAW ====================

    /**
     * @inheritdoc IProtocolAdapter
     * @dev Deposita (supply) token nel Pool Aave V3
     *      I token devono essere già nel contratto (inviati da ProtocolManager)
     *      Aave abilita automaticamente il collaterale al primo supply
     */
    function deposit(string memory tokenCode, uint256 amount)
        external
        override
        onlyProtocolManager
        notCircuitBroken
        nonReentrant
        returns (bool)
    {
        // 1. Risolvi token address
        address token = _resolveToken(tokenCode);

        // 2. Verifica balance
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance < amount) {
            revert InsufficientBalance(balance, amount);
        }

        // 3. Approva il Pool Aave
        IERC20(token).safeIncreaseAllowance(address(aavePool), amount);

        // 4. Query aToken balance prima del deposit (per calcolo receipt)
        address aToken = _getAToken(tokenCode);
        uint256 aTokenBefore = IERC20(aToken).balanceOf(address(this));

        // 5. Supply al Pool Aave
        // supply(asset, amount, onBehalfOf, referralCode)
        aavePool.supply(token, amount, address(this), 0);

        // 6. Calcola aToken ricevuti
        uint256 aTokenReceived = IERC20(aToken).balanceOf(address(this)) - aTokenBefore;

        emit AaveDeposit(tokenCode, token, amount, aTokenReceived);
        emit Deposited(tokenCode, amount);

        return true;
    }

    /**
     * @inheritdoc IProtocolAdapter
     * @dev Preleva token dal Pool Aave V3 e li invia a ProxyGeneral
     *      Aave V3 withdraw() supporta invio diretto a recipient (3° parametro)
     */
    function withdraw(string memory tokenCode, uint256 amount)
        external
        override
        onlyProtocolManager
        notCircuitBroken
        nonReentrant
        returns (bool)
    {
        // 1. Risolvi token address
        address token = _resolveToken(tokenCode);

        // 2. Check saldo disponibile via aToken
        address aToken = _getAToken(tokenCode);
        uint256 aTokenBalance = IERC20(aToken).balanceOf(address(this));
        if (aTokenBalance == 0) {
            revert InsufficientBalance(0, amount);
        }

        // 3. Se amount = 0, withdraw all
        // Aave stores scaled balances and converts them through the liquidity
        // index. Especially for micro-deposits, rounding can make balanceOf()
        // one or two asset units lower than the amount originally supplied.
        // Asking the Pool for the nominal amount would then revert with
        // NotEnoughAvailableUserBalance even though this plugin intends to
        // close its whole position. Clamp to the currently redeemable aToken
        // balance; amount == 0 retains Aave's canonical withdraw-all path.
        uint256 withdrawAmount = (amount == 0)
            ? type(uint256).max
            : (amount > aTokenBalance ? aTokenBalance : amount);

        // 4. Withdraw da Aave direttamente a ProxyGeneral
        //    Aave V3 withdraw(asset, amount, to) → invia direttamente al recipient!
        address proxyGeneral = _getProxyGeneral();
        uint256 actualWithdrawn = aavePool.withdraw(token, withdrawAmount, proxyGeneral);

        emit AaveWithdrawal(tokenCode, token, actualWithdrawn);
        emit Withdrawn(tokenCode, actualWithdrawn);

        return true;
    }

    // ==================== LENDING: BORROW/REPAY ====================

    /**
     * @inheritdoc IAaveV3Plugin
     * @dev Prende in prestito dal Pool Aave V3 e invia a ProxyGeneral
     *      Richiede collaterale già depositato (via supply)
     *      Usa variable rate (interestRateMode = 2)
     */
    function borrow(string memory tokenCode, uint256 amount)
        external
        override
        onlyProtocolManager
        notCircuitBroken
        nonReentrant
        returns (bool)
    {
        // 1. Risolvi token address
        address token = _resolveToken(tokenCode);

        // 2. Borrow da Aave V3
        // borrow(asset, amount, interestRateMode, referralCode, onBehalfOf)
        aavePool.borrow(token, amount, VARIABLE_RATE_MODE, 0, address(this));

        // 3. Trasferisci borrowed tokens a ProxyGeneral
        address proxyGeneral = _getProxyGeneral();
        IERC20(token).safeTransfer(proxyGeneral, amount);

        emit AaveBorrow(tokenCode, token, amount);
        emit Borrowed(tokenCode, amount, 0); // accountNumber = 0 (Aave single account)

        return true;
    }

    /**
     * @inheritdoc IAaveV3Plugin
     * @dev Ripaga un debito nel Pool Aave V3
     *      I token devono essere già nel contratto (inviati da ProtocolManager)
     *      Gestisce dust e repay completo
     */
    function repay(string memory tokenCode, uint256 amount)
        external
        override
        onlyProtocolManager
        notCircuitBroken
        nonReentrant
        returns (bool)
    {
        // 1. Risolvi token e debt token
        address token = _resolveToken(tokenCode);
        address variableDebtToken = _getVariableDebtToken(tokenCode);

        // 2. Get debito corrente
        uint256 currentDebt = IERC20(variableDebtToken).balanceOf(address(this));
        if (currentDebt == 0) {
            return true; // Nessun debito, nulla da ripagare
        }

        // 3. Determine repay amount (handle "repay all" if amount = 0 or >= debt)
        //    Per Aave V3: type(uint256).max ripaga TUTTO il debito
        uint256 repayAmount;
        if (amount == 0 || amount >= currentDebt) {
            repayAmount = type(uint256).max;
        } else {
            repayAmount = amount;
        }

        // 4. Verifica balance disponibile
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 needed = (repayAmount == type(uint256).max) ? currentDebt : repayAmount;
        if (balance < needed) {
            revert InsufficientBalance(balance, needed);
        }

        // 5. Approva il Pool per il repay
        //    Per repay con type(uint256).max, approva il debito corrente + margine per interessi
        uint256 approveAmount = (repayAmount == type(uint256).max) ? currentDebt + (currentDebt / 100) : repayAmount;
        if (approveAmount > balance) approveAmount = balance;
        IERC20(token).safeIncreaseAllowance(address(aavePool), approveAmount);

        // 6. Repay su Aave V3
        // repay(asset, amount, interestRateMode, onBehalfOf)
        uint256 actualRepaid = aavePool.repay(token, repayAmount, VARIABLE_RATE_MODE, address(this));

        emit AaveRepay(tokenCode, token, actualRepaid);
        emit Repaid(tokenCode, actualRepaid, 0);

        return true;
    }

    // ==================== POSITION MANAGEMENT ====================

    /**
     * @inheritdoc IAaveV3Plugin
     * @dev Chiude una posizione completa: ripaga debito + ritira collaterale
     *      Tutto in sequenza (Aave non ha batch come EVC)
     */
    function closePosition(
        string memory debtTokenCode,
        string memory collateralTokenCode
    )
        external
        override
        onlyProtocolManager
        notCircuitBroken
        nonReentrant
        returns (bool)
    {
        address debtToken = _resolveToken(debtTokenCode);
        address collateralToken = _resolveToken(collateralTokenCode);
        address variableDebtToken = _getVariableDebtToken(debtTokenCode);
        address proxyGeneral = _getProxyGeneral();

        // 1. Ripaga tutto il debito (se presente)
        uint256 currentDebt = IERC20(variableDebtToken).balanceOf(address(this));
        if (currentDebt > 0) {
            uint256 balance = IERC20(debtToken).balanceOf(address(this));
            uint256 repayAmount = balance < currentDebt ? balance : currentDebt;
            if (repayAmount > 0) {
                IERC20(debtToken).safeIncreaseAllowance(address(aavePool), repayAmount);
                aavePool.repay(debtToken, repayAmount, VARIABLE_RATE_MODE, address(this));
            }
        }

        // 2. Ritira tutto il collaterale direttamente a ProxyGeneral
        address aToken = _getAToken(collateralTokenCode);
        uint256 aTokenBalance = IERC20(aToken).balanceOf(address(this));
        if (aTokenBalance > 0) {
            aavePool.withdraw(collateralToken, type(uint256).max, proxyGeneral);
        }

        return true;
    }

    /**
     * @inheritdoc IProtocolAdapter
     * @dev Chiude una singola posizione (Aave ha account unico, non position-based)
     *      Per Aave, questo è equivalente a closePosition con i token dell'unica posizione
     */
    function closePosition(uint256 /* positionId */)
        external
        override
        onlyProtocolManager
        notCircuitBroken
        nonReentrant
        returns (uint256 baseAssetReturned)
    {
        // Aave ha account unico → chiudi tutto e ritira base asset
        address baseAsset = _resolveToken(baseAssetCode);
        address aToken = _getAToken(baseAssetCode);
        address proxyGeneral = _getProxyGeneral();

        uint256 aTokenBalance = IERC20(aToken).balanceOf(address(this));
        if (aTokenBalance > 0) {
            uint256 balBefore = IERC20(baseAsset).balanceOf(proxyGeneral);
            aavePool.withdraw(baseAsset, type(uint256).max, proxyGeneral);
            baseAssetReturned = IERC20(baseAsset).balanceOf(proxyGeneral) - balBefore;
        }

        emit PositionClosed(0, baseAssetReturned);
    }

    /**
     * @inheritdoc IProtocolAdapter
     */
    function closePositionsForBaseAsset(uint256 targetAmount)
        external
        override
        onlyOwnerOrLiquidityManager
        notCircuitBroken
        nonReentrant
        returns (uint256 obtained, uint256 positionsClosed)
    {
        // Per Aave: tenta di chiudere l'unica posizione
        address baseAsset = _resolveToken(baseAssetCode);
        address aToken = _getAToken(baseAssetCode);
        address proxyGeneral = _getProxyGeneral();

        uint256 aTokenBalance = IERC20(aToken).balanceOf(address(this));
        if (aTokenBalance == 0) return (0, 0);

        uint256 withdrawAmount = targetAmount < aTokenBalance ? targetAmount : type(uint256).max;

        uint256 balBefore = IERC20(baseAsset).balanceOf(proxyGeneral);
        aavePool.withdraw(baseAsset, withdrawAmount, proxyGeneral);
        obtained = IERC20(baseAsset).balanceOf(proxyGeneral) - balBefore;
        positionsClosed = 1;
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @inheritdoc IAaveV3Plugin
     * @dev Get debito corrente per un token via variableDebtToken balance
     */
    function getDebt(string memory tokenCode)
        external
        view
        override
        returns (uint256)
    {
        address variableDebtToken = _getVariableDebtTokenSafe(tokenCode);
        if (variableDebtToken == address(0)) return 0;
        return IERC20(variableDebtToken).balanceOf(address(this));
    }

    /**
     * @inheritdoc IAaveV3Plugin
     * @dev Health factor NATIVO da Aave V3 getUserAccountData()
     *      Ritorna type(uint256).max se non ci sono debiti
     */
    function getHealthFactor()
        external
        view
        override
        returns (uint256)
    {
        (
            ,
            uint256 totalDebtBase,
            ,
            ,
            ,
            uint256 healthFactor
        ) = aavePool.getUserAccountData(address(this));

        if (totalDebtBase == 0) {
            return type(uint256).max;
        }

        return healthFactor;
    }

    /**
     * @inheritdoc IAaveV3Plugin
     * @dev Capacità di borrow rimanente in base currency
     */
    function getBorrowCapacity(string memory /* tokenCode */)
        external
        view
        override
        returns (uint256)
    {
        (
            ,
            ,
            uint256 availableBorrowsBase,
            ,
            ,
        ) = aavePool.getUserAccountData(address(this));

        return availableBorrowsBase;
    }

    /**
     * @inheritdoc IProtocolAdapter
     * @dev Balance di un token depositato su Aave (= aToken balance)
     */
    function getBalance(string memory tokenCode)
        external
        view
        override
        returns (uint256)
    {
        address aToken = _getATokenSafe(tokenCode);
        if (aToken == address(0)) return 0;
        return IERC20(aToken).balanceOf(address(this));
    }

    // ==================== ATOMIC LEVERAGE VIA FLASH LOAN SERVICE ====================

    /**
     * @notice Apre una posizione leverage ATOMICA usando FlashLoanService
     * @param params Parametri per l'apertura leverage
     * @return totalCollateral Collaterale finale depositato
     * @return totalDebt Debito totale
     * @return healthFactor Health factor finale
     *
     * @dev Flusso atomico:
     * 1. Flash loan USDC da Balancer (0% fee)
     * 2. Swap USDC → WETH
     * 3. pool.supply(WETH totale) → deposita come collaterale (auto-enabled)
     * 4. pool.borrow(USDC) → genera debito per ripagare flash loan
     * 5. Trasferisci USDC al FlashLoanService → ripaga Balancer
     */
    function openLeverageAtomic(
        OpenLeverageAtomicParams calldata params
    ) external onlyOwner notCircuitBroken nonReentrant returns (
        uint256 totalCollateral,
        uint256 totalDebt,
        uint256 healthFactor
    ) {
        if (block.timestamp > params.deadline) revert DeadlineExpired();
        if (params.targetLeverageX100 < 110 || params.targetLeverageX100 > 500) {
            revert InvalidLeverage();
        }

        address collateralToken = _resolveToken(params.collateralToken);
        address borrowToken = _resolveToken(params.borrowToken);

        // Trasferisci collaterale iniziale dall'utente
        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), params.collateralAmount);

        // Calcola importo flash loan
        uint256 leverageMultiplier = params.targetLeverageX100 - 100;
        uint256 flashLoanAmount = _calculateFlashLoanAmount(
            collateralToken, borrowToken, params.collateralAmount, leverageMultiplier
        );

        // Salva contesto per callback
        _flashLoanContext = FlashLoanCallbackContext({
            operation: FlashLoanOperation.OPEN,
            user: msg.sender,
            initialCollateral: params.collateralAmount,
            maxSlippageBps: 0,
            collateralTokenCode: params.collateralToken,
            borrowTokenCode: params.borrowToken
        });

        // Esegui flash loan
        address flashLoanService = _getFlashLoanService();
        address[] memory tokens = new address[](1);
        tokens[0] = borrowToken;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = flashLoanAmount;

        _inFlashLoanCallback = true;
        IFlashLoanService(flashLoanService).executeFlashLoan(tokens, amounts, "");
        _inFlashLoanCallback = false;

        // Ottieni stato finale
        address aToken = _getAToken(params.collateralToken);
        totalCollateral = IERC20(aToken).balanceOf(address(this));

        address variableDebtToken = _getVariableDebtToken(params.borrowToken);
        totalDebt = IERC20(variableDebtToken).balanceOf(address(this));

        (, , , , , healthFactor) = aavePool.getUserAccountData(address(this));

        // Verifica health factor
        uint256 minHF = params.minHealthFactor > 0 ? params.minHealthFactor : MIN_HEALTH_FACTOR;
        if (healthFactor < minHF) {
            revert HealthFactorTooLow(healthFactor, minHF);
        }

        emit LeverageOpenedAtomic(
            msg.sender, collateralToken, borrowToken,
            params.collateralAmount, totalCollateral, totalDebt,
            healthFactor, params.targetLeverageX100
        );

        delete _flashLoanContext;
    }

    /**
     * @notice Chiude una posizione leverage ATOMICA usando FlashLoanService
     * @param params Parametri per la chiusura
     * @return collateralReturned Collaterale restituito all'utente
     *
     * @dev Flusso atomico:
     * 1. Flash loan USDC (= debito corrente) da Balancer
     * 2. pool.repay(USDC) → ripaga tutto il debito
     * 3. pool.withdraw(WETH, max) → ritira tutto il collaterale
     * 4. Swap parte WETH → USDC per ripagare flash loan
     * 5. Trasferisci USDC al FlashLoanService → ripaga Balancer
     * 6. WETH rimanente → utente
     */
    function closeLeverageAtomic(
        CloseLeverageAtomicParams calldata params
    ) external onlyOwnerOrLiquidityManager notCircuitBroken nonReentrant returns (uint256 collateralReturned) {
        if (block.timestamp > params.deadline) revert DeadlineExpired();

        address borrowToken = _resolveToken(params.borrowToken);
        address variableDebtToken = _getVariableDebtToken(params.borrowToken);

        uint256 currentDebt = IERC20(variableDebtToken).balanceOf(address(this));
        if (currentDebt == 0) revert NoPositionToClose();

        // Salva contesto per callback
        _flashLoanContext = FlashLoanCallbackContext({
            operation: FlashLoanOperation.CLOSE,
            user: msg.sender,
            initialCollateral: 0,
            maxSlippageBps: params.maxSlippageBps > 0 ? params.maxSlippageBps : 100,
            collateralTokenCode: params.collateralToken,
            borrowTokenCode: params.borrowToken
        });

        // Flash loan per importo = debito corrente
        address flashLoanService = _getFlashLoanService();
        address[] memory tokens = new address[](1);
        tokens[0] = borrowToken;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = currentDebt;

        _inFlashLoanCallback = true;
        IFlashLoanService(flashLoanService).executeFlashLoan(tokens, amounts, "");
        _inFlashLoanCallback = false;

        // Trasferisci collaterale rimanente all'utente
        address collateralToken = _resolveToken(params.collateralToken);
        collateralReturned = IERC20(collateralToken).balanceOf(address(this));
        if (collateralReturned > 0) {
            IERC20(collateralToken).safeTransfer(msg.sender, collateralReturned);
        }

        // Trasferisci eventuale eccesso di borrow token all'utente
        uint256 borrowExcess = IERC20(borrowToken).balanceOf(address(this));
        if (borrowExcess > 0) {
            IERC20(borrowToken).safeTransfer(msg.sender, borrowExcess);
        }

        emit LeverageClosedAtomic(
            msg.sender, collateralToken, borrowToken, currentDebt, collateralReturned
        );

        delete _flashLoanContext;
    }

    /**
     * @notice Callback chiamato da FlashLoanService
     * @dev Implementa IFlashLoanCallback. Gestisce sia OPEN che CLOSE leverage.
     *      I token flash loan sono GIA' nel plugin quando viene chiamato.
     */
    function onFlashLoanReceived(
        IERC20[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        bytes memory /* callbackData */
    ) external override {
        address flashLoanService = _getFlashLoanService();
        if (msg.sender != flashLoanService) revert UnauthorizedFlashLoanCallback();
        if (!_inFlashLoanCallback) revert UnauthorizedFlashLoanCallback();

        FlashLoanCallbackContext memory ctx = _flashLoanContext;

        if (ctx.operation == FlashLoanOperation.OPEN) {
            _handleOpenLeverageCallback(tokens, amounts, feeAmounts, ctx, flashLoanService);
        } else {
            _handleCloseLeverageCallback(tokens, amounts, feeAmounts, ctx, flashLoanService);
        }
    }

    /**
     * @notice Gestisce callback per apertura leverage
     * @dev Flusso: swap borrow→collateral, supply al Pool, borrow per ripagare flash loan
     *      Aave V3 non richiede EVC batch — operazioni sequenziali dirette sul Pool
     */
    function _handleOpenLeverageCallback(
        IERC20[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        FlashLoanCallbackContext memory ctx,
        address flashLoanService
    ) internal {
        address collateralToken = _resolveToken(ctx.collateralTokenCode);
        address borrowToken = address(tokens[0]);
        uint256 flashLoanAmount = amounts[0];
        uint256 feeAmount = feeAmounts[0];

        // Step 1: Swap borrow token → collateral token (USDC → WETH)
        IERC20(borrowToken).safeIncreaseAllowance(flashLoanService, flashLoanAmount);
        uint256 collateralFromSwap = IFlashLoanService(flashLoanService).swap(
            borrowToken, collateralToken, flashLoanAmount
        );
        if (collateralFromSwap == 0) revert SwapFailed();

        // Step 2: Supply tutto il collaterale al Pool Aave
        //         Aave abilita automaticamente il collaterale al primo supply
        uint256 totalCollateral = ctx.initialCollateral + collateralFromSwap;
        IERC20(collateralToken).safeIncreaseAllowance(address(aavePool), totalCollateral);
        aavePool.supply(collateralToken, totalCollateral, address(this), 0);

        // Step 3: Borrow per ripagare flash loan
        uint256 borrowAmount = flashLoanAmount + feeAmount;
        aavePool.borrow(borrowToken, borrowAmount, VARIABLE_RATE_MODE, 0, address(this));

        // Step 4: Trasferisci al FlashLoanService per ripagare Balancer
        IERC20(borrowToken).safeTransfer(flashLoanService, borrowAmount);
    }

    /**
     * @notice Gestisce callback per chiusura leverage
     * @dev Flusso: repay debito, withdraw collaterale, swap per ripagare flash loan
     */
    function _handleCloseLeverageCallback(
        IERC20[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        FlashLoanCallbackContext memory ctx,
        address flashLoanService
    ) internal {
        address collateralToken = _resolveToken(ctx.collateralTokenCode);
        address borrowToken = address(tokens[0]);
        uint256 flashLoanAmount = amounts[0];
        uint256 feeAmount = feeAmounts[0];

        // Step 1: Ripaga tutto il debito
        IERC20(borrowToken).safeIncreaseAllowance(address(aavePool), flashLoanAmount);
        aavePool.repay(borrowToken, flashLoanAmount, VARIABLE_RATE_MODE, address(this));

        // Step 2: Ritira tutto il collaterale (a noi stessi, non a ProxyGeneral)
        aavePool.withdraw(collateralToken, type(uint256).max, address(this));

        // Step 3: Swap collaterale → borrow token per ripagare flash loan
        uint256 repayAmount = flashLoanAmount + feeAmount;
        uint256 collateralBalance = IERC20(collateralToken).balanceOf(address(this));
        IERC20(collateralToken).safeIncreaseAllowance(flashLoanService, collateralBalance);
        uint256 borrowReceived = IFlashLoanService(flashLoanService).swap(
            collateralToken, borrowToken, collateralBalance
        );

        if (borrowReceived < repayAmount) {
            revert SlippageExceeded(repayAmount, borrowReceived);
        }

        // Step 4: Trasferisci al FlashLoanService per ripagare Balancer
        IERC20(borrowToken).safeTransfer(flashLoanService, repayAmount);
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
        uint256 collateralValueInBorrow = IFlashLoanService(flashLoanService).getExpectedOutput(
            collateralToken, borrowToken, collateralAmount
        );
        return (collateralValueInBorrow * leverageMultiplier) / 100;
    }

    // ==================== EMERGENCY ====================

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
            address aToken = _getATokenSafe(tokenCodes[i]);
            if (aToken == address(0)) continue;

            uint256 aTokenBalance = IERC20(aToken).balanceOf(address(this));
            if (aTokenBalance > 0) {
                address token = _resolveToken(tokenCodes[i]);
                uint256 actualWithdrawn = aavePool.withdraw(token, type(uint256).max, proxyGeneral);
                emit EmergencyWithdraw(tokenCodes[i], actualWithdrawn);
            }
        }

        return true;
    }

    /**
     * @inheritdoc IProtocolAdapter
     */
    function activateCircuitBreaker() external override onlyOwner {
        circuitBreakerTripped = true;
        emit CircuitBreakerActivated(msg.sender);
    }

    /**
     * @notice Deactivate circuit breaker
     */
    function deactivateCircuitBreaker() external onlyOwner {
        circuitBreakerTripped = false;
    }

    // ==================== INTERNAL: RISOLUZIONE INDIRIZZI ====================

    /**
     * @dev Risolve l'indirizzo di un token via Beacon pattern
     *      WETH direttamente dal Beacon, altri via TokenManager
     */
    function _resolveToken(string memory tokenCode) internal view returns (address) {
        if (keccak256(bytes(tokenCode)) == keccak256(bytes(baseAssetCode))) {
            return IBeacon(beacon).getImplementation("BASE_ASSET");
        }
        address tokenManager = IBeacon(beacon).getImplementation("TokenManager");
        return ITokenManagerForModules(tokenManager).getTokenAddress(tokenCode);
    }

    /**
     * @dev Get AaveV3Registry via Beacon
     */
    function _getRegistry() internal view returns (IAaveV3Registry) {
        address registry = IBeacon(beacon).getImplementation("AaveV3Registry");
        return IAaveV3Registry(registry);
    }

    /**
     * @dev Get aToken address per un tokenCode
     */
    function _getAToken(string memory tokenCode) internal view returns (address) {
        return _getRegistry().getAToken(tokenCode);
    }

    /**
     * @dev Get aToken address safe (returns address(0) if not configured)
     */
    function _getATokenSafe(string memory tokenCode) internal view returns (address) {
        try _getRegistry().getAToken(tokenCode) returns (address aToken) {
            return aToken;
        } catch {
            return address(0);
        }
    }

    /**
     * @dev Get variableDebtToken address per un tokenCode
     */
    function _getVariableDebtToken(string memory tokenCode) internal view returns (address) {
        return _getRegistry().getVariableDebtToken(tokenCode);
    }

    /**
     * @dev Get variableDebtToken safe (returns address(0) if not configured)
     */
    function _getVariableDebtTokenSafe(string memory tokenCode) internal view returns (address) {
        try _getRegistry().getVariableDebtToken(tokenCode) returns (address debtToken) {
            return debtToken;
        } catch {
            return address(0);
        }
    }

    /**
     * @dev Get ProxyGeneral via Beacon
     */
    function _getProxyGeneral() internal view returns (address) {
        return IBeacon(beacon).getImplementation("ProxyGeneral");
    }
}
