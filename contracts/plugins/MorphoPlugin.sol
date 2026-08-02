// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../interfaces/IMorphoPlugin.sol";
import "../interfaces/IMorphoRegistry.sol";
import "../interfaces/IBeacon.sol";
import "../interfaces/IProxyGeneral.sol";
import "../interfaces/ITokenManagerForModules.sol";
import "../interfaces/IFlashLoanCallback.sol";
import {IMorpho, MarketParams, Id, Market, Position as MorphoPosition, IMorphoOracle, MarketParamsLib} from "../interfaces/morpho/IMorpho.sol";

/**
 * @title IFlashLoanService
 * @notice Interface per il servizio flash loan centralizzato
 */
interface IFlashLoanServiceMorpho {
    function executeFlashLoan(address[] calldata tokens, uint256[] calldata amounts, bytes calldata callbackData) external;
    function swap(address tokenIn, address tokenOut, uint256 amountIn) external returns (uint256);
    function getExpectedOutput(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256);
}

/**
 * @title MorphoPlugin
 * @notice Plugin per integrazione Morpho Blue lending protocol via ProtocolManager
 * @dev Implementa IMorphoPlugin (che estende IProtocolAdapter)
 * 
 * ARCHITETTURA:
 * - Gestito da ProtocolManager (orchestratore centrale)
 * - Custody flow: ProxyGeneral → ProtocolManager → MorphoPlugin → Morpho Blue
 * - Operazioni: supplyCollateral, withdrawCollateral, borrow, repay
 * 
 * DIFFERENZE CHIAVE VS AAVE:
 * - Morpho ha mercati ISOLATI (non pool condiviso)
 * - Nessun receipt token (no aToken). Le posizioni sono trackate internamente
 * - Il collaterale NON genera yield
 * - No health factor nativo → deve essere computato manualmente
 * - Ogni operazione richiede MarketParams completi
 * - Il plugin deve essere autorizzato su Morpho (setAuthorization)
 * 
 * DIFFERENZE CHIAVE VS EULER:
 * - Nessun EVC, nessun sub-account
 * - Mercati semplici: 1 collateral + 1 loan per market
 * - Oracle integrato per ogni mercato
 * - Flash loan nativi nel contratto Morpho (0% fee)
 * 
 * CUSTODY MODEL:
 * - ProtocolManager chiama deposit/withdraw/borrow/repay
 * - Plugin si aspetta token già nel contratto (inviati da ProtocolManager)
 * - Plugin restituisce token a ProxyGeneral dopo operazioni
 * 
 * INDIRIZZO MORPHO BLUE (Arbitrum):
 * - 0x6c247b1F6182318877311737BaC0844bAa518F5e
 * 
 * @author Project4 Team
 * @custom:version 1.0.0
 */
contract MorphoPlugin is IMorphoPlugin, IFlashLoanCallback, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using MarketParamsLib for MarketParams;

    // ==================== IMMUTABLES ====================

    /// @notice Beacon per risoluzione moduli
    address public immutable beacon;

    /// @notice Morpho Blue singleton
    IMorpho public immutable morpho;

    // ==================== CONSTANTS ====================

    /// @notice Oracle price scale (1e36)
    uint256 public constant ORACLE_PRICE_SCALE = 1e36;

    /// @notice WAD (1e18)
    uint256 public constant WAD = 1e18;

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
    error MarketNotConfigured(string collateralCode, string loanCode);
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

    modifier notCircuitBroken() {
        if (circuitBreakerTripped) revert CircuitBreakerActive();
        _;
    }

    modifier onlyProtocolManager() {
        address protocolManager = IBeacon(beacon).getImplementation("ProtocolManager");
        // PLG-084 fix (DEC-006/009): NESSUN bypass owner(). Solo ProtocolManager instrada qui.
        // L'accesso diretto d'emergenza passa da emergencyClosePosition (escape hatch onlyOwner).
        if (msg.sender != protocolManager) {
            revert OnlyProtocolManager();
        }
        _;
    }

    modifier onlyOwnerOrLiquidityManager() {
        address liquidityManager = IBeacon(beacon).getImplementation("LiquidityManager");
        require(
            msg.sender == owner() || msg.sender == liquidityManager || msg.sender == address(this),
            "MorphoPlugin: not authorized"
        );
        _;
    }

    // ==================== CONSTRUCTOR ====================

    constructor(address _beacon, string memory _baseAssetCode, address _morphoAddress) Ownable() {
        if (_beacon == address(0)) revert InvalidAddress();
        if (_morphoAddress == address(0)) revert InvalidAddress();
        beacon = _beacon;
        baseAssetCode = _baseAssetCode;
        morpho = IMorpho(_morphoAddress);
    }

    // ==================== IProtocolAdapter: SUPPLY/WITHDRAW (pair-based) ====================
    // NOTE (DEC-009): i vecchi deposit/withdraw single-token sono stati RIMOSSI.
    // L'interfaccia universale usa supplyCollateral / withdrawCollateral (collateral, loan, amount).
    // _findMarketForCollateral resta come helper interno (non più usato dopo la rimozione).

    // ==================== MORPHO-SPECIFIC: SUPPLY COLLATERAL ====================

    /**
     * @inheritdoc IMorphoPlugin
     * @dev Fornisce collaterale a uno specifico mercato Morpho
     */
    function supplyCollateral(
        string memory collateralCode,
        string memory loanCode,
        uint256 amount
    )
        external
        override
        onlyProtocolManager
        notCircuitBroken
        nonReentrant
        returns (bool)
    {
        return _supplyCollateral(collateralCode, loanCode, amount);
    }

    function _supplyCollateral(
        string memory collateralCode,
        string memory loanCode,
        uint256 amount
    ) internal returns (bool) {
        // 1. Get market params from registry
        MarketParams memory params = _getMarketParams(collateralCode, loanCode);

        // 2. Verify balance
        uint256 balance = IERC20(params.collateralToken).balanceOf(address(this));
        if (balance < amount) {
            revert InsufficientBalance(balance, amount);
        }

        // 3. Approve Morpho
        IERC20(params.collateralToken).safeIncreaseAllowance(address(morpho), amount);

        // 4. Supply collateral to Morpho
        morpho.supplyCollateral(params, amount, address(this), "");

        emit MorphoSupplyCollateral(collateralCode, loanCode, params.collateralToken, amount);

        return true;
    }

    // ==================== MORPHO-SPECIFIC: WITHDRAW COLLATERAL ====================

    /**
     * @inheritdoc IMorphoPlugin
     */
    function withdrawCollateral(
        string memory collateralCode,
        string memory loanCode,
        uint256 amount
    )
        external
        override
        onlyProtocolManager
        notCircuitBroken
        nonReentrant
        returns (bool)
    {
        return _withdrawCollateral(collateralCode, loanCode, amount);
    }

    function _withdrawCollateral(
        string memory collateralCode,
        string memory loanCode,
        uint256 amount
    ) internal returns (bool) {
        // 1. Get market params
        MarketParams memory params = _getMarketParams(collateralCode, loanCode);
        Id marketId = params.id();

        // 2. Get current collateral
        MorphoPosition memory pos = morpho.position(marketId, address(this));
        uint256 currentCollateral = pos.collateral;
        if (currentCollateral == 0) {
            revert InsufficientBalance(0, amount);
        }

        // 3. If amount = 0, withdraw all
        uint256 withdrawAmount = (amount == 0) ? currentCollateral : amount;

        // 4. Withdraw collateral to ProxyGeneral
        address proxyGeneral = _getProxyGeneral();
        morpho.withdrawCollateral(params, withdrawAmount, address(this), proxyGeneral);

        emit MorphoWithdrawCollateral(collateralCode, loanCode, params.collateralToken, withdrawAmount);

        return true;
    }

    // ==================== MORPHO-SPECIFIC: BORROW ====================

    /**
     * @inheritdoc IMorphoPlugin
     * @dev Prende in prestito dal mercato Morpho e invia a ProxyGeneral
     */
    function borrow(
        string memory collateralCode,
        string memory loanCode,
        uint256 amount
    )
        external
        override
        onlyProtocolManager
        notCircuitBroken
        nonReentrant
        returns (bool)
    {
        // 1. Get market params
        MarketParams memory params = _getMarketParams(collateralCode, loanCode);
        address proxyGeneral = _getProxyGeneral();

        // 2. Borrow from Morpho (assets mode, shares = 0)
        //    Receiver = proxyGeneral (Morpho supports direct receiver)
        (uint256 assetsBorrowed, ) = morpho.borrow(
            params,
            amount,
            0,              // shares = 0 → use assets
            address(this),  // onBehalf = this plugin
            proxyGeneral    // receiver = ProxyGeneral (custodian)
        );

        emit MorphoBorrow(collateralCode, loanCode, params.loanToken, assetsBorrowed);
        emit Borrowed(loanCode, assetsBorrowed, 0);

        return true;
    }

    // ==================== MORPHO-SPECIFIC: REPAY ====================

    /**
     * @inheritdoc IMorphoPlugin
     * @dev Ripaga un debito su Morpho Blue
     *      Gestisce dust e repay completo (via shares per full repay)
     */
    function repay(
        string memory collateralCode,
        string memory loanCode,
        uint256 amount
    )
        external
        override
        onlyProtocolManager
        notCircuitBroken
        nonReentrant
        returns (bool)
    {
        return _repay(collateralCode, loanCode, amount);
    }

    function _repay(
        string memory collateralCode,
        string memory loanCode,
        uint256 amount
    ) internal returns (bool) {
        // 1. Get market params
        MarketParams memory params = _getMarketParams(collateralCode, loanCode);
        Id marketId = params.id();

        // 2. Get current debt
        MorphoPosition memory pos = morpho.position(marketId, address(this));
        if (pos.borrowShares == 0) {
            return true; // No debt, nothing to repay
        }

        // 3. Verify balance
        uint256 balance = IERC20(params.loanToken).balanceOf(address(this));

        // 4. Approve Morpho
        IERC20(params.loanToken).safeIncreaseAllowance(address(morpho), balance);

        // 5. Full repay → use shares to avoid dust
        uint256 actualRepaid;
        if (amount == 0 || amount >= balance) {
            // Full repay via shares
            (actualRepaid, ) = morpho.repay(
                params,
                0,                  // assets = 0
                pos.borrowShares,   // shares = all borrow shares
                address(this),      // onBehalf
                ""                  // data
            );
        } else {
            // Partial repay via assets
            (actualRepaid, ) = morpho.repay(
                params,
                amount,             // assets > 0
                0,                  // shares = 0
                address(this),      // onBehalf
                ""                  // data
            );
        }

        emit MorphoRepay(collateralCode, loanCode, params.loanToken, actualRepaid);
        emit Repaid(loanCode, actualRepaid, 0);

        return true;
    }

    // ==================== POSITION MANAGEMENT ====================

    /**
     * @inheritdoc IMorphoPlugin
     * @dev Chiude una posizione completa: ripaga debito + ritira collaterale
     */
    function closeMarketPosition(
        string memory collateralCode,
        string memory loanCode
    )
        external
        override
        onlyProtocolManager
        notCircuitBroken
        nonReentrant
        returns (bool)
    {
        MarketParams memory params = _getMarketParams(collateralCode, loanCode);
        Id marketId = params.id();
        MorphoPosition memory pos = morpho.position(marketId, address(this));
        address proxyGeneral = _getProxyGeneral();

        // 1. Repay all debt if any
        if (pos.borrowShares > 0) {
            uint256 balance = IERC20(params.loanToken).balanceOf(address(this));
            if (balance > 0) {
                IERC20(params.loanToken).safeIncreaseAllowance(address(morpho), balance);
                morpho.repay(params, 0, pos.borrowShares, address(this), "");
            }
        }

        // 2. Withdraw all collateral
        // Re-read position after repay (debt may have changed)
        pos = morpho.position(marketId, address(this));
        if (pos.collateral > 0) {
            morpho.withdrawCollateral(params, pos.collateral, address(this), proxyGeneral);
        }

        return true;
    }

    /**
     * @inheritdoc IProtocolAdapter
     * @dev EMERGENCY escape hatch (DEC-006/007): chiude direttamente la posizione
     *      (collateral, loan) bypassando ProtocolManager. onlyOwner. Ripaga il debito e
     *      ritira il collaterale in ProxyGeneral. Nota: se il collaterale != base asset,
     *      baseAssetReturned può essere 0 (i fondi tornano comunque in custody come collaterale);
     *      la conversione a base asset è coordinata con C1-06 (swap+slippage).
     */
    function emergencyClosePosition(string memory collateral, string memory loan)
        external
        override
        onlyOwner
        nonReentrant
        returns (uint256 baseAssetReturned)
    {
        address baseAsset = _resolveToken(baseAssetCode);
        address proxyGeneral = _getProxyGeneral();
        uint256 balBefore = IERC20(baseAsset).balanceOf(proxyGeneral);

        MarketParams memory params = _getMarketParams(collateral, loan);
        Id marketId = params.id();
        MorphoPosition memory pos = morpho.position(marketId, address(this));

        if (pos.borrowShares > 0) {
            uint256 bal = IERC20(params.loanToken).balanceOf(address(this));
            if (bal > 0) {
                IERC20(params.loanToken).safeIncreaseAllowance(address(morpho), bal);
                morpho.repay(params, 0, pos.borrowShares, address(this), "");
            }
        }
        pos = morpho.position(marketId, address(this));
        if (pos.collateral > 0) {
            morpho.withdrawCollateral(params, pos.collateral, address(this), proxyGeneral);
        }
        baseAssetReturned = IERC20(baseAsset).balanceOf(proxyGeneral) - balBefore;
        emit PositionClosed(0, baseAssetReturned);
    }

    /**
     * @inheritdoc IProtocolAdapter
     */
    function protocolType() external pure override returns (string memory) {
        return "MORPHO_BLUE";
    }

    /**
     * @inheritdoc IProtocolAdapter
     * @dev Chiude posizione per ID (Morpho non ha positionId, usa market-based)
     */
    function closePosition(uint256 /* positionId */)
        external
        override
        onlyProtocolManager
        notCircuitBroken
        nonReentrant
        returns (uint256 baseAssetReturned)
    {
        // Morpho non ha position IDs → chiudi tutti i mercati e ritira base asset
        address baseAsset = _resolveToken(baseAssetCode);
        address proxyGeneral = _getProxyGeneral();
        uint256 balBefore = IERC20(baseAsset).balanceOf(proxyGeneral);

        IMorphoRegistry registry = _getRegistry();
        (string[] memory collCodes, string[] memory lnCodes) = registry.getRegisteredMarkets();

        for (uint256 i = 0; i < collCodes.length; i++) {
            MarketParams memory params = registry.getMarketParams(collCodes[i], lnCodes[i]);
            Id marketId = params.id();
            MorphoPosition memory pos = morpho.position(marketId, address(this));

            if (pos.borrowShares > 0) {
                uint256 balance = IERC20(params.loanToken).balanceOf(address(this));
                if (balance > 0) {
                    IERC20(params.loanToken).safeIncreaseAllowance(address(morpho), balance);
                    morpho.repay(params, 0, pos.borrowShares, address(this), "");
                }
            }

            pos = morpho.position(marketId, address(this));
            if (pos.collateral > 0) {
                morpho.withdrawCollateral(params, pos.collateral, address(this), proxyGeneral);
            }
        }

        baseAssetReturned = IERC20(baseAsset).balanceOf(proxyGeneral) - balBefore;
        emit PositionClosed(0, baseAssetReturned);
    }

    /**
     * @inheritdoc IProtocolAdapter
     */
    function closePositionsForBaseAsset(uint256 targetAmount)
        external
        override
        onlyProtocolManager
        notCircuitBroken
        nonReentrant
        returns (uint256 obtained, uint256 positionsClosed)
    {
        address baseAsset = _resolveToken(baseAssetCode);
        address proxyGeneral = _getProxyGeneral();
        uint256 balBefore = IERC20(baseAsset).balanceOf(proxyGeneral);

        IMorphoRegistry registry = _getRegistry();
        (string[] memory collCodes, string[] memory lnCodes) = registry.getRegisteredMarkets();

        for (uint256 i = 0; i < collCodes.length; i++) {
            MarketParams memory params = registry.getMarketParams(collCodes[i], lnCodes[i]);
            Id marketId = params.id();
            MorphoPosition memory pos = morpho.position(marketId, address(this));

            if (pos.collateral > 0 && params.collateralToken == baseAsset) {
                if (pos.borrowShares > 0) {
                    uint256 balance = IERC20(params.loanToken).balanceOf(address(this));
                    if (balance > 0) {
                        IERC20(params.loanToken).safeIncreaseAllowance(address(morpho), balance);
                        morpho.repay(params, 0, pos.borrowShares, address(this), "");
                    }
                }

                pos = morpho.position(marketId, address(this));
                uint256 withdrawAmount = targetAmount < pos.collateral ? targetAmount : pos.collateral;
                morpho.withdrawCollateral(params, withdrawAmount, address(this), proxyGeneral);
                positionsClosed++;
            }

            obtained = IERC20(baseAsset).balanceOf(proxyGeneral) - balBefore;
            if (obtained >= targetAmount) break;
        }
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @inheritdoc IMorphoPlugin
     */
    function getDebt(string memory collateralCode, string memory loanCode)
        external
        view
        override
        returns (uint256)
    {
        MarketParams memory params = _getMarketParams(collateralCode, loanCode);
        Id marketId = params.id();
        MorphoPosition memory pos = morpho.position(marketId, address(this));

        if (pos.borrowShares == 0) return 0;

        // Convert shares to assets: borrowShares * totalBorrowAssets / totalBorrowShares
        Market memory mkt = morpho.market(marketId);
        if (mkt.totalBorrowShares == 0) return 0;

        return (uint256(pos.borrowShares) * uint256(mkt.totalBorrowAssets)) / uint256(mkt.totalBorrowShares);
    }

    /**
     * @inheritdoc IMorphoPlugin
     */
    function getCollateral(string memory collateralCode, string memory loanCode)
        external
        view
        override
        returns (uint256)
    {
        MarketParams memory params = _getMarketParams(collateralCode, loanCode);
        Id marketId = params.id();
        MorphoPosition memory pos = morpho.position(marketId, address(this));
        return pos.collateral;
    }

    /**
     * @inheritdoc IMorphoPlugin
     * @dev HF = (collateral * oraclePrice * lltv) / (debt * ORACLE_PRICE_SCALE)
     *      Based on Morpho docs: healthFactor = (collateralValueInLoanToken * lltv) / borrowedAmount
     */
    function getHealthFactor(string memory collateralCode, string memory loanCode)
        external
        view
        override
        returns (uint256)
    {
        return _computeHealthFactor(collateralCode, loanCode);
    }

    /**
     * @inheritdoc IProtocolAdapter
     */
    function getBalance(string memory tokenCode)
        external
        view
        override
        returns (uint256 balance)
    {
        // Sum collateral across all markets where this token is collateral
        IMorphoRegistry registry = _getRegistry();
        (string[] memory collCodes, string[] memory lnCodes) = registry.getRegisteredMarkets();

        for (uint256 i = 0; i < collCodes.length; i++) {
            if (keccak256(bytes(collCodes[i])) == keccak256(bytes(tokenCode))) {
                MarketParams memory params = registry.getMarketParams(collCodes[i], lnCodes[i]);
                Id marketId = params.id();
                MorphoPosition memory pos = morpho.position(marketId, address(this));
                balance += pos.collateral;
            }
        }
    }

    // ==================== ATOMIC LEVERAGE VIA FLASH LOAN SERVICE ====================

    /**
     * @notice Apre una posizione leverage ATOMICA usando FlashLoanService
     * @param params_ Parametri per l'apertura leverage
     * @return totalCollateral Collaterale finale depositato
     * @return totalDebt Debito totale
     * @return healthFactor Health factor finale
     *
     * @dev Flusso atomico:
     * 1. Flash loan USDC da Balancer (0% fee)
     * 2. Swap USDC → WETH
     * 3. morpho.supplyCollateral(WETH totale) → deposita collaterale
     * 4. morpho.borrow(USDC) → genera debito per ripagare flash loan
     * 5. Trasferisci USDC al FlashLoanService → ripaga Balancer
     */
    function openLeverageAtomic(
        OpenLeverageAtomicParams calldata params_
    ) external onlyOwner notCircuitBroken nonReentrant returns (
        uint256 totalCollateral,
        uint256 totalDebt,
        uint256 healthFactor
    ) {
        if (block.timestamp > params_.deadline) revert DeadlineExpired();
        if (params_.targetLeverageX100 < 110 || params_.targetLeverageX100 > 500) {
            revert InvalidLeverage();
        }

        address collateralToken = _resolveToken(params_.collateralToken);
        address borrowToken = _resolveToken(params_.borrowToken);

        // Transfer initial collateral from user
        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), params_.collateralAmount);

        // Calculate flash loan amount
        uint256 leverageMultiplier = params_.targetLeverageX100 - 100;
        uint256 flashLoanAmount = _calculateFlashLoanAmount(
            collateralToken, borrowToken, params_.collateralAmount, leverageMultiplier
        );

        // Save callback context
        _flashLoanContext = FlashLoanCallbackContext({
            operation: FlashLoanOperation.OPEN,
            user: msg.sender,
            initialCollateral: params_.collateralAmount,
            maxSlippageBps: 0,
            collateralTokenCode: params_.collateralToken,
            borrowTokenCode: params_.borrowToken
        });

        // Execute flash loan
        address flashLoanService = _getFlashLoanService();
        address[] memory tokens = new address[](1);
        tokens[0] = borrowToken;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = flashLoanAmount;

        _inFlashLoanCallback = true;
        IFlashLoanServiceMorpho(flashLoanService).executeFlashLoan(tokens, amounts, "");
        _inFlashLoanCallback = false;

        // Get final state
        MarketParams memory mktParams = _getMarketParams(params_.collateralToken, params_.borrowToken);
        Id marketId = mktParams.id();
        MorphoPosition memory pos = morpho.position(marketId, address(this));

        totalCollateral = pos.collateral;

        // Compute debt from shares
        Market memory mkt = morpho.market(marketId);
        totalDebt = mkt.totalBorrowShares > 0
            ? (uint256(pos.borrowShares) * uint256(mkt.totalBorrowAssets)) / uint256(mkt.totalBorrowShares)
            : 0;

        healthFactor = _computeHealthFactor(params_.collateralToken, params_.borrowToken);

        // Verify health factor
        uint256 minHF = params_.minHealthFactor > 0 ? params_.minHealthFactor : MIN_HEALTH_FACTOR;
        if (healthFactor < minHF) {
            revert HealthFactorTooLow(healthFactor, minHF);
        }

        emit LeverageOpenedAtomic(
            msg.sender, collateralToken, borrowToken,
            params_.collateralAmount, totalCollateral, totalDebt,
            healthFactor, params_.targetLeverageX100
        );

        delete _flashLoanContext;
    }

    /**
     * @notice Chiude una posizione leverage ATOMICA usando FlashLoanService
     * @param params_ Parametri per la chiusura
     * @return collateralReturned Collaterale restituito all'utente
     *
     * @dev Flusso atomico:
     * 1. Flash loan USDC (= debito corrente) da Balancer
     * 2. morpho.repay(USDC) → ripaga tutto il debito
     * 3. morpho.withdrawCollateral(WETH, max) → ritira tutto il collaterale
     * 4. Swap parte WETH → USDC per ripagare flash loan
     * 5. Trasferisci USDC al FlashLoanService → ripaga Balancer
     * 6. WETH rimanente → utente
     */
    function closeLeverageAtomic(
        CloseLeverageAtomicParams calldata params_
    ) external onlyOwnerOrLiquidityManager notCircuitBroken nonReentrant returns (uint256 collateralReturned) {
        if (block.timestamp > params_.deadline) revert DeadlineExpired();

        MarketParams memory mktParams = _getMarketParams(params_.collateralToken, params_.borrowToken);
        Id marketId = mktParams.id();
        MorphoPosition memory pos = morpho.position(marketId, address(this));

        if (pos.borrowShares == 0) revert NoPositionToClose();

        // Compute debt in assets
        Market memory mkt = morpho.market(marketId);
        uint256 currentDebt = (uint256(pos.borrowShares) * uint256(mkt.totalBorrowAssets)) / uint256(mkt.totalBorrowShares);
        // Add small buffer for interest accrual
        currentDebt = currentDebt + (currentDebt / 100);

        // Save callback context
        _flashLoanContext = FlashLoanCallbackContext({
            operation: FlashLoanOperation.CLOSE,
            user: msg.sender,
            initialCollateral: 0,
            maxSlippageBps: params_.maxSlippageBps > 0 ? params_.maxSlippageBps : 100,
            collateralTokenCode: params_.collateralToken,
            borrowTokenCode: params_.borrowToken
        });

        // Flash loan for debt amount
        address flashLoanService = _getFlashLoanService();
        address borrowToken = _resolveToken(params_.borrowToken);
        address[] memory tokens = new address[](1);
        tokens[0] = borrowToken;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = currentDebt;

        _inFlashLoanCallback = true;
        IFlashLoanServiceMorpho(flashLoanService).executeFlashLoan(tokens, amounts, "");
        _inFlashLoanCallback = false;

        // Transfer remaining collateral to user
        address collateralToken = _resolveToken(params_.collateralToken);
        collateralReturned = IERC20(collateralToken).balanceOf(address(this));
        if (collateralReturned > 0) {
            IERC20(collateralToken).safeTransfer(msg.sender, collateralReturned);
        }

        // Transfer excess borrow token to user
        uint256 borrowExcess = IERC20(borrowToken).balanceOf(address(this));
        if (borrowExcess > 0) {
            IERC20(borrowToken).safeTransfer(msg.sender, borrowExcess);
        }

        emit LeverageClosedAtomic(
            msg.sender, collateralToken, borrowToken, currentDebt, collateralReturned
        );

        delete _flashLoanContext;
    }

    // ==================== FLASH LOAN CALLBACK ====================

    /**
     * @notice Callback chiamato da FlashLoanService
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
        uint256 collateralFromSwap = IFlashLoanServiceMorpho(flashLoanService).swap(
            borrowToken, collateralToken, flashLoanAmount
        );
        if (collateralFromSwap == 0) revert SwapFailed();

        // Step 2: Supply all collateral to Morpho
        MarketParams memory params = _getMarketParams(ctx.collateralTokenCode, ctx.borrowTokenCode);
        uint256 totalCollateral = ctx.initialCollateral + collateralFromSwap;
        IERC20(collateralToken).safeIncreaseAllowance(address(morpho), totalCollateral);
        morpho.supplyCollateral(params, totalCollateral, address(this), "");

        // Step 3: Borrow to repay flash loan
        uint256 borrowAmount = flashLoanAmount + feeAmount;
        morpho.borrow(params, borrowAmount, 0, address(this), address(this));

        // Step 4: Transfer to FlashLoanService to repay Balancer
        IERC20(borrowToken).safeTransfer(flashLoanService, borrowAmount);
    }

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

        // Step 1: Repay all debt (use shares for exact full repay)
        MarketParams memory params = _getMarketParams(ctx.collateralTokenCode, ctx.borrowTokenCode);
        Id marketId = params.id();
        MorphoPosition memory pos = morpho.position(marketId, address(this));

        IERC20(borrowToken).safeIncreaseAllowance(address(morpho), flashLoanAmount);
        morpho.repay(params, 0, pos.borrowShares, address(this), "");

        // Step 2: Withdraw all collateral (to ourselves for swap)
        pos = morpho.position(marketId, address(this));
        if (pos.collateral > 0) {
            morpho.withdrawCollateral(params, pos.collateral, address(this), address(this));
        }

        // Step 3: Swap collateral → borrow token to repay flash loan
        uint256 repayAmount = flashLoanAmount + feeAmount;
        uint256 collateralBalance = IERC20(collateralToken).balanceOf(address(this));
        IERC20(collateralToken).safeIncreaseAllowance(flashLoanService, collateralBalance);
        uint256 borrowReceived = IFlashLoanServiceMorpho(flashLoanService).swap(
            collateralToken, borrowToken, collateralBalance
        );

        if (borrowReceived < repayAmount) {
            revert SlippageExceeded(repayAmount, borrowReceived);
        }

        // Step 4: Transfer to FlashLoanService to repay Balancer
        IERC20(borrowToken).safeTransfer(flashLoanService, repayAmount);
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
        IMorphoRegistry registry = _getRegistry();
        (string[] memory collCodes, string[] memory lnCodes) = registry.getRegisteredMarkets();

        for (uint256 i = 0; i < collCodes.length; i++) {
            MarketParams memory params = registry.getMarketParams(collCodes[i], lnCodes[i]);
            Id marketId = params.id();
            MorphoPosition memory pos = morpho.position(marketId, address(this));

            if (pos.collateral > 0) {
                // Try repay first if there's debt
                if (pos.borrowShares > 0) {
                    uint256 balance = IERC20(params.loanToken).balanceOf(address(this));
                    if (balance > 0) {
                        IERC20(params.loanToken).safeIncreaseAllowance(address(morpho), balance);
                        try morpho.repay(params, 0, pos.borrowShares, address(this), "") {} catch {}
                    }
                }

                // Withdraw collateral
                pos = morpho.position(marketId, address(this));
                if (pos.collateral > 0) {
                    try morpho.withdrawCollateral(params, pos.collateral, address(this), proxyGeneral) {
                        emit EmergencyWithdraw(collCodes[i], pos.collateral);
                    } catch {}
                }
            }
        }

        // Also sweep any tokens stuck in the plugin
        for (uint256 i = 0; i < tokenCodes.length; i++) {
            address token = _resolveToken(tokenCodes[i]);
            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance > 0) {
                IERC20(token).safeTransfer(proxyGeneral, balance);
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

    // ==================== INTERNAL: HEALTH FACTOR ====================

    /**
     * @dev Compute health factor for a Morpho market position
     *      HF = (collateral * oraclePrice * lltv) / (debt * ORACLE_PRICE_SCALE)
     *      Equivalent to: (collateralValueInLoanToken * lltv) / borrowedAmount
     */
    function _computeHealthFactor(string memory collateralCode, string memory loanCode)
        internal view returns (uint256)
    {
        MarketParams memory params = _getMarketParams(collateralCode, loanCode);
        Id marketId = params.id();
        MorphoPosition memory pos = morpho.position(marketId, address(this));

        // No debt → infinite HF
        if (pos.borrowShares == 0) return type(uint256).max;

        // Compute debt in assets
        Market memory mkt = morpho.market(marketId);
        if (mkt.totalBorrowShares == 0) return type(uint256).max;

        // Round up for safety (like Morpho does internally)
        uint256 debtAssets = (uint256(pos.borrowShares) * uint256(mkt.totalBorrowAssets) + uint256(mkt.totalBorrowShares) - 1) / uint256(mkt.totalBorrowShares);
        if (debtAssets == 0) return type(uint256).max;

        // Get oracle price
        uint256 oraclePrice = IMorphoOracle(params.oracle).price();

        // Collateral value in loan token units = collateral * oraclePrice / ORACLE_PRICE_SCALE
        uint256 collateralValue = (uint256(pos.collateral) * oraclePrice) / ORACLE_PRICE_SCALE;

        // Health Factor = collateralValue * lltv / debtAssets
        // (lltv is already in WAD scale, so result is in WAD scale). C1-05: rimosso `* WAD` errato.
        return (collateralValue * params.lltv) / debtAssets;
    }

    // ==================== INTERNAL: RESOLVERS ====================

    function _resolveToken(string memory tokenCode) internal view returns (address) {
        if (keccak256(bytes(tokenCode)) == keccak256(bytes(baseAssetCode))) {
            return IBeacon(beacon).getImplementation("BASE_ASSET");
        }
        address tokenManager = IBeacon(beacon).getImplementation("TokenManager");
        return ITokenManagerForModules(tokenManager).getTokenAddress(tokenCode);
    }

    function _getRegistry() internal view returns (IMorphoRegistry) {
        address registry = IBeacon(beacon).getImplementation("MorphoRegistry");
        return IMorphoRegistry(registry);
    }

    function _getMarketParams(string memory collateralCode, string memory loanCode)
        internal view returns (MarketParams memory)
    {
        return _getRegistry().getMarketParams(collateralCode, loanCode);
    }

    function _getProxyGeneral() internal view returns (address) {
        return IBeacon(beacon).getImplementation("ProxyGeneral");
    }

    function _getFlashLoanService() internal view returns (address) {
        address service = IBeacon(beacon).getImplementation("FlashLoanService");
        if (service == address(0)) revert FlashLoanServiceNotFound();
        return service;
    }

    function _calculateFlashLoanAmount(
        address collateralToken,
        address borrowToken,
        uint256 collateralAmount,
        uint256 leverageMultiplier
    ) internal view returns (uint256) {
        address flashLoanService = _getFlashLoanService();
        uint256 collateralValueInBorrow = IFlashLoanServiceMorpho(flashLoanService).getExpectedOutput(
            collateralToken, borrowToken, collateralAmount
        );
        return (collateralValueInBorrow * leverageMultiplier) / 100;
    }

    /**
     * @dev Find the first registered market where the given token is used as collateral
     */
    function _findMarketForCollateral(string memory tokenCode)
        internal view returns (string memory collateralCode, string memory loanCode)
    {
        IMorphoRegistry registry = _getRegistry();
        (string[] memory collCodes, string[] memory lnCodes) = registry.getRegisteredMarkets();

        bytes32 tokenHash = keccak256(bytes(tokenCode));
        for (uint256 i = 0; i < collCodes.length; i++) {
            if (keccak256(bytes(collCodes[i])) == tokenHash) {
                return (collCodes[i], lnCodes[i]);
            }
        }

        revert MarketNotConfigured(tokenCode, "");
    }
}
