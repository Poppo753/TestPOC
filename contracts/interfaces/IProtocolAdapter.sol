// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IProtocolAdapter
 * @notice Standard interface for all protocol plugins (lending, yield, trading)
 * @dev Every protocol integration must implement this interface
 * 
 * ARCHITECTURE:
 * This interface standardizes how ProtocolManager interacts with external protocols.
 * Each protocol (Euler, Dolomite, Aave, GMX, etc.) implements this interface.
 * 
 * THE 3 MUSKETEERS PATTERN:
 * For each protocol integration, you need:
 * 1. Plugin (implements IProtocolAdapter) - actions (deposit, withdraw, close)
 * 2. LensAdapter (implements ILensAdapter) - queries (health, values, risks)
 * 3. Registry/Config - protocol-specific configuration (vault mappings, etc.)
 * 
 * POSITION STRUCTURE:
 * All protocols must return positions in a standardized format so ProtocolManager
 * can aggregate, sort, and manage them uniformly.
 * 
 * @author Project4 Team
 */
interface IProtocolAdapter {
    
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
    
    // ==================== POSITION MANAGEMENT ====================
    
    /**
     * @notice Close a position and return assets to ProxyGeneral
     * @param positionId Position to close
     * @return baseAssetReturned Amount of base asset returned to ProxyGeneral
     */
    function closePosition(uint256 positionId) external returns (uint256 baseAssetReturned);
    
    /**
     * @notice Close positions until target base asset amount is obtained
     * @dev Closes riskiest positions first (lowest HF)
     * @param targetAmount Target base asset amount to obtain
     * @return baseAssetObtained Actual base asset obtained
     * @return positionsClosed Number of positions closed
     */
    function closePositionsForBaseAsset(uint256 targetAmount) 
        external 
        returns (uint256 baseAssetObtained, uint256 positionsClosed);
    
    // ==================== BASIC OPERATIONS ====================
    
    /**
     * @notice Deposit tokens into the protocol
     * @param tokenCode Token identifier (e.g., "WETH", "USDC")
     * @param amount Amount to deposit
     * @return success True if successful
     */
    function deposit(string memory tokenCode, uint256 amount) external returns (bool success);
    
    /**
     * @notice Withdraw tokens from the protocol to ProxyGeneral
     * @param tokenCode Token identifier
     * @param amount Amount to withdraw
     * @return success True if successful
     */
    function withdraw(string memory tokenCode, uint256 amount) external returns (bool success);
    
    /**
     * @notice Get balance of a token in the protocol
     * @param tokenCode Token identifier
     * @return balance Token balance
     */
    function getBalance(string memory tokenCode) external view returns (uint256 balance);
    
    // ==================== EMERGENCY ====================
    
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
    event Deposited(string tokenCode, uint256 amount);
    event Withdrawn(string tokenCode, uint256 amount);
    event CircuitBreakerActivated(address indexed triggeredBy);
}
