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
        uint256 collateralValueEth;   // Total collateral in ETH
        uint256 debtValueEth;         // Total debt in ETH
        uint256 netValueEth;          // collateral - debt
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
        uint256 totalCollateralEth;
        uint256 totalDebtEth;
        uint256 netValueEth;
        uint256 activePositionCount;
        uint256 lowestHealthFactor;   // Min HF across all positions
        bool isHealthy;               // All positions above safe threshold
    }
    
    // ==================== IDENTIFICATION ====================
    
    /**
     * @notice Get the protocol name
     * @return name Protocol identifier (e.g., "Euler", "Dolomite")
     */
    function protocolName() external view returns (string memory name);
    
    /**
     * @notice Get the protocol type
     * @return protocolType Type enum (LENDING, YIELD, TRADING, LIQUIDITY)
     */
    function protocolType() external view returns (ProtocolType protocolType);
    
    /**
     * @notice Get protocol summary
     * @return summary ProtocolSummary struct with aggregated data
     */
    function getProtocolSummary() external view returns (ProtocolSummary memory summary);
    
    // ==================== POSITION MANAGEMENT ====================
    
    /**
     * @notice Get count of active positions
     * @return count Number of active positions
     */
    function getActivePositionCount() external view returns (uint256 count);
    
    /**
     * @notice Get all active positions in standardized format
     * @return positions Array of Position structs
     */
    function getAllPositions() external view returns (Position[] memory positions);
    
    /**
     * @notice Get a specific position by ID
     * @param positionId Position identifier
     * @return position Position struct
     */
    function getPosition(uint256 positionId) external view returns (Position memory position);
    
    /**
     * @notice Get positions sorted by health factor (lowest first = riskiest)
     * @return positions Sorted array of positions
     */
    function getPositionsSortedByRisk() external view returns (Position[] memory positions);
    
    /**
     * @notice Close a position and return assets to ProxyGeneral
     * @param positionId Position to close
     * @return wethReturned Amount of WETH returned to ProxyGeneral
     */
    function closePosition(uint256 positionId) external returns (uint256 wethReturned);
    
    /**
     * @notice Close positions until target WETH amount is obtained
     * @dev Closes riskiest positions first (lowest HF)
     * @param targetWethAmount Target WETH to obtain
     * @return wethObtained Actual WETH obtained
     * @return positionsClosed Number of positions closed
     */
    function closePositionsForWeth(uint256 targetWethAmount) 
        external 
        returns (uint256 wethObtained, uint256 positionsClosed);
    
    // ==================== VALUE FUNCTIONS ====================
    
    /**
     * @notice Get total value of all positions in ETH
     * @return totalValueEth Net value (collateral - debt) in ETH
     */
    function getTotalValue() external view returns (uint256 totalValueEth);
    
    /**
     * @notice Get total collateral value in ETH
     * @return collateralEth Total collateral across all positions
     */
    function getTotalCollateral() external view returns (uint256 collateralEth);
    
    /**
     * @notice Get total debt value in ETH
     * @return debtEth Total debt across all positions
     */
    function getTotalDebt() external view returns (uint256 debtEth);
    
    /**
     * @notice Get lowest health factor across all positions
     * @return healthFactor Minimum HF (1e18 scale), max uint if no debt
     */
    function getLowestHealthFactor() external view returns (uint256 healthFactor);
    
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
    
    /**
     * @notice Get maximum withdrawable amount for a token
     * @dev Considers debt obligations and health factor requirements
     * @param tokenCode Token identifier
     * @return maxAmount Maximum withdrawable without breaking health
     */
    function getMaxWithdrawable(string memory tokenCode) external view returns (uint256 maxAmount);
    
    // ==================== EMERGENCY ====================
    
    /**
     * @notice Emergency withdraw all assets to ProxyGeneral
     * @param tokenCodes Array of token codes to withdraw
     * @return success True if successful
     */
    function emergencyWithdrawAll(string[] memory tokenCodes) external returns (bool success);
    
    /**
     * @notice Check if circuit breaker is active
     * @return isActive True if circuit breaker is tripped
     */
    function isCircuitBreakerActive() external view returns (bool isActive);
    
    /**
     * @notice Activate circuit breaker (emergency stop)
     */
    function activateCircuitBreaker() external;
    
    // ==================== EVENTS ====================
    
    event PositionOpened(uint256 indexed positionId, uint256 collateralEth, uint256 debtEth);
    event PositionClosed(uint256 indexed positionId, uint256 wethReturned);
    event PositionLiquidated(uint256 indexed positionId, uint256 collateralLost);
    event Deposited(string tokenCode, uint256 amount);
    event Withdrawn(string tokenCode, uint256 amount);
    event CircuitBreakerActivated(address indexed triggeredBy);
}
