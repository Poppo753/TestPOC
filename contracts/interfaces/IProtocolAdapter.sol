// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IProtocolAdapter
 * @notice Standard PAIR-BASED interface for all protocol plugins (lending, yield, trading).
 * @dev Every protocol integration must implement this interface.
 *
 * ARCHITECTURE:
 * This interface standardizes how ProtocolManager interacts with external protocols.
 * Each protocol (Euler, Aave, Morpho, MorphoVault, InterVault, ...) implements it.
 *
 * PAIR-BASED CONVENTION (collateral, loan) — DEC-006 / DEC-009:
 * Every lending operation is keyed by the pair `(string collateral, string loan)`:
 *   - Pooled (Aave):        `collateral` è validato; l'operazione usa `loan`.
 *   - Vault-controller (Euler): (collateral, loan) → (collateral vault, controller vault).
 *   - Isolated (Morpho):    (collateral, loan) identifica il mercato isolato.
 *   - Supply-only (MorphoVault, InterVault): usano solo supplyCollateral/withdrawCollateral
 *     con `loan == collateral`; `borrow`/`repay` DEVONO revertare `UnsupportedOperation`.
 * Tutti i fondi presi in prestito / ritirati confluiscono in ProxyGeneral (custody centrico).
 *
 * THE 3 MUSKETEERS PATTERN:
 * 1. Plugin (implements IProtocolAdapter) - actions (supply, borrow, close)
 * 2. LensAdapter (implements ILensAdapter) - queries (health, values, risks)
 * 3. Registry/Config - protocol-specific configuration (vault mappings, etc.)
 *
 * @author Project4 Team
 */
interface IProtocolAdapter {

    // ==================== ERRORS ====================

    /// @notice Sollevato dai plugin supply-only quando si chiama borrow/repay (DEC-009 D1b).
    error UnsupportedOperation();

    // ==================== ENUMS ====================

    /**
     * @notice Type of protocol for categorization
     */
    enum ProtocolType {
        LENDING,    // Euler, Aave, Compound, Dolomite
        YIELD,      // Yearn, Convex, GMX GLP
        TRADING,    // GMX Perps, dYdX
        LIQUIDITY   // Uniswap LP, Curve LP
    }

    /**
     * @notice Status of a position
     */
    enum PositionStatus {
        ACTIVE,
        CLOSED,
        LIQUIDATED
    }

    // ==================== STRUCTS ====================

    /**
     * @notice Standardized position structure across all protocols
     * @dev All protocols must convert their internal position format to this
     */
    struct Position {
        uint256 positionId;           // Unique ID within this protocol
        string protocolName;          // "Euler", "Dolomite", etc.
        PositionStatus status;        // ACTIVE, CLOSED, LIQUIDATED
        uint256 collateralValue;      // Total collateral in base asset
        uint256 debtValue;            // Total debt in base asset
        uint256 netValue;             // collateral - debt
        uint256 healthFactor;         // 1e18 = 1.0, type(uint256).max = no debt
        uint256 openTimestamp;        // When position was opened
        address collateralToken;      // Primary collateral token
        address debtToken;            // Primary debt token (address(0) if none)
    }

    /**
     * @notice Protocol summary for quick overview
     */
    struct ProtocolSummary {
        string name;
        ProtocolType protocolType;
        uint256 totalCollateral;
        uint256 totalDebt;
        uint256 netValue;
        uint256 activePositionCount;
        uint256 lowestHealthFactor;   // Min HF across all positions
        bool isHealthy;               // All positions above safe threshold
    }

    // ==================== SUPPLY SIDE (collaterale) ====================

    /**
     * @notice Deposita collaterale nel protocollo.
     * @param collateral token code del collaterale
     * @param loan token code del mercato/loan (== collateral per pooled/supply-only)
     * @param amount quantità di collaterale da depositare
     * @return success True se riuscito
     */
    function supplyCollateral(string memory collateral, string memory loan, uint256 amount) external returns (bool success);

    /**
     * @notice Ritira collaterale dal protocollo verso ProxyGeneral.
     * @dev Operativo anche sui plugin supply-only (è così che restituiscono il capitale).
     */
    function withdrawCollateral(string memory collateral, string memory loan, uint256 amount) external returns (bool success);

    // ==================== BORROW SIDE (debito) ====================

    /**
     * @notice Prende in prestito `loan` contro `collateral`. I fondi vanno a ProxyGeneral.
     * @dev I plugin supply-only DEVONO revertare `UnsupportedOperation`.
     */
    function borrow(string memory collateral, string memory loan, uint256 amount) external returns (bool success);

    /**
     * @notice Ripaga il debito `loan` della coppia (collateral, loan).
     * @dev I plugin supply-only DEVONO revertare `UnsupportedOperation`.
     */
    function repay(string memory collateral, string memory loan, uint256 amount) external returns (bool success);

    // ==================== VIEWS ====================

    /// @notice Collaterale corrente della coppia, in unità del token collaterale.
    function getCollateral(string memory collateral, string memory loan) external view returns (uint256);

    /// @notice Debito corrente della coppia, in unità del token loan.
    function getDebt(string memory collateral, string memory loan) external view returns (uint256);

    /// @notice Health factor della coppia in scala WAD (1e18 = 1.0). type(uint256).max se no debt.
    /// @dev MAI ritornare max per mascherare un errore (VAL-005).
    function getHealthFactor(string memory collateral, string memory loan) external view returns (uint256 hf);

    /// @notice Balance di un token nel protocollo (view single-token, per aggregazioni/NAV).
    function getBalance(string memory tokenCode) external view returns (uint256 balance);

    /// @notice Tipo/nome del protocollo, es. "AAVE_V3" | "EULER_V2" | "MORPHO_BLUE".
    function protocolType() external pure returns (string memory);

    // ==================== POSITION MANAGEMENT ====================

    /**
     * @notice Close a position and return assets to ProxyGeneral
     * @param positionId Position to close
     * @return baseAssetReturned Amount of base asset returned to ProxyGeneral
     */
    function closePosition(uint256 positionId) external returns (uint256 baseAssetReturned);

    /**
     * @notice Close positions until target base asset amount is obtained.
     * @dev CONTRATTO UNIFORME (DEC-007): raccoglie TUTTE le posizioni del plugin
     *      (leverage + supply), le ordina per rischio (health factor crescente — le più
     *      rischiose prima) e le chiude progressivamente:
     *        - `targetAmount` finito  → withdrawal mode: chiude finché ottiene targetAmount, poi si ferma.
     *        - `targetAmount == type(uint256).max` → emergency mode: chiude TUTTO.
     *      I plugin supply-only rispettano comunque `targetAmount` (nessun ordinamento reale).
     * @param targetAmount Target base asset amount to obtain (type(uint256).max = unwind totale).
     * @return baseAssetObtained Actual base asset obtained
     * @return positionsClosed Number of positions closed
     */
    function closePositionsForBaseAsset(uint256 targetAmount)
        external
        returns (uint256 baseAssetObtained, uint256 positionsClosed);

    // ==================== EMERGENCY ====================

    /**
     * @notice EMERGENCY ONLY — chiude direttamente la posizione della coppia bypassando
     *         ProtocolManager. Da usare solo se ProtocolManager è compromesso/frozen.
     *         Rompe la modularità di proposito (escape hatch, onlyOwner nel plugin).
     */
    function emergencyClosePosition(string memory collateral, string memory loan) external returns (uint256 baseAssetReturned);

    /**
     * @notice Emergency withdraw all assets to ProxyGeneral
     * @param tokenCodes Array of token codes to withdraw
     * @return success True if successful
     */
    function emergencyWithdrawAll(string[] memory tokenCodes) external returns (bool success);

    /**
     * @notice Activate circuit breaker (emergency stop)
     */
    function activateCircuitBreaker() external;

    // ==================== EVENTS ====================

    event PositionOpened(uint256 indexed positionId, uint256 collateral, uint256 debt);
    event PositionClosed(uint256 indexed positionId, uint256 baseAssetReturned);
    event PositionLiquidated(uint256 indexed positionId, uint256 collateralLost);
    event CircuitBreakerActivated(address indexed triggeredBy);
}
