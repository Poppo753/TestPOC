// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./IProtocolAdapter.sol";

/**
 * @title ILensAdapter
 * @notice Standard interface for protocol lens/query adapters
 * @dev Handles complex view functions and risk calculations for each protocol
 * 
 * PURPOSE:
 * LensAdapters wrap protocol-specific query logic (health factor calculations,
 * time-to-liquidation, APY, etc.) and expose them in a standardized way.
 * 
 * WHY SEPARATE FROM PLUGIN?
 * 1. Separation of concerns: Plugin = actions, LensAdapter = queries
 * 2. Query logic can be complex (interacting with external Lens contracts)
 * 3. Keeps Plugin contract size smaller
 * 4. LensAdapter can be upgraded independently
 * 
 * THE 3 MUSKETEERS:
 * 1. Plugin (IProtocolAdapter) - deposit, withdraw, close positions
 * 2. LensAdapter (ILensAdapter) - health queries, risk assessment, APY
 * 3. Registry - vault/token mappings, protocol-specific config
 * 
 * @author Project4 Team
 */
interface ILensAdapter {
    
    // ==================== STRUCTS ====================
    
    /**
     * @notice Detailed health information for a position or account
     */
    struct HealthInfo {
        uint256 healthFactor;          // 1e18 scale, max uint = no debt
        uint256 liquidationThreshold;  // Price drop % that triggers liquidation
        int256 timeToLiquidation;      // Seconds until liquidation (-1 = already liquidatable)
        string riskLevel;              // "SAFE", "WARNING", "DANGER", "LIQUIDATABLE"
        bool isHealthy;                // HF > minSafeHF
    }
    
    /**
     * @notice Value breakdown for positions
     */
    struct ValueBreakdown {
        uint256 totalCollateralEth;
        uint256 totalDebtEth;
        uint256 netValueEth;
        uint256 availableToWithdrawEth; // How much can be withdrawn maintaining health
    }
    
    /**
     * @notice APY/APR information for yield calculation
     */
    struct YieldInfo {
        uint256 supplyAPY;    // Supply APY in 1e18 (0.05e18 = 5%)
        uint256 borrowAPY;    // Borrow APY in 1e18
        int256 netAPY;        // Net APY after borrow costs (can be negative)
        uint256 rewardsAPY;   // Additional rewards APY (if any)
    }
    
    /**
     * @notice Position with extended risk information
     */
    struct PositionWithRisk {
        uint256 positionId;
        string protocolName;
        uint256 healthFactor;
        int256 timeToLiquidation;
        string riskLevel;
        uint256 collateralEth;
        uint256 debtEth;
        bool shouldAutoClose;  // Below auto-close threshold
    }
    
    // ==================== IDENTIFICATION ====================
    
    /**
     * @notice Get associated protocol name
     * @return name Protocol identifier (must match Plugin.protocolName())
     */
    function protocolName() external view returns (string memory name);
    
    /**
     * @notice Get associated plugin address
     * @return plugin Address of the protocol plugin
     */
    function getPlugin() external view returns (address plugin);
    
    // ==================== HEALTH MONITORING ====================
    
    /**
     * @notice Get overall health factor for the protocol
     * @dev Returns min HF across all positions
     * @return healthFactor Lowest health factor (1e18 scale)
     */
    function getHealthFactor() external view returns (uint256 healthFactor);
    
    /**
     * @notice Get detailed health info for a specific position
     * @param positionId Position to check
     * @return info HealthInfo struct with detailed data
     */
    function getPositionHealth(uint256 positionId) external view returns (HealthInfo memory info);
    
    /**
     * @notice Get health info for main account (non-position based protocols)
     * @return info HealthInfo struct
     */
    function getAccountHealth() external view returns (HealthInfo memory info);
    
    /**
     * @notice Get time to liquidation for a position
     * @param positionId Position to check
     * @return ttl Seconds until liquidation, -1 if already liquidatable, max if safe
     * @return status Human-readable status string
     */
    function getTimeToLiquidation(uint256 positionId) 
        external view returns (int256 ttl, string memory status);
    
    // ==================== RISK ASSESSMENT ====================
    
    /**
     * @notice Get positions at risk (below health threshold)
     * @param minHealthFactor Minimum acceptable HF (e.g., 1.5e18)
     * @return positions Array of positions below threshold
     */
    function getPositionsAtRisk(uint256 minHealthFactor) 
        external view returns (PositionWithRisk[] memory positions);
    
    /**
     * @notice Check if a position should be auto-closed
     * @param positionId Position to check
     * @param healthThreshold HF threshold for auto-close
     * @return shouldClose True if position should be closed
     */
    function shouldAutoClose(uint256 positionId, uint256 healthThreshold) 
        external view returns (bool shouldClose);
    
    /**
     * @notice Get all positions sorted by risk (riskiest first)
     * @return positions Sorted array with risk info
     */
    function getPositionsSortedByRisk() 
        external view returns (PositionWithRisk[] memory positions);
    
    // ==================== VALUE FUNCTIONS ====================
    
    /**
     * @notice Get total net value of all positions in ETH
     * @return netValueEth Net value (collateral - debt)
     */
    function getTotalValue() external view returns (uint256 netValueEth);
    
    /**
     * @notice Get detailed value breakdown
     * @return breakdown ValueBreakdown struct
     */
    function getValueBreakdown() external view returns (ValueBreakdown memory breakdown);
    
    /**
     * @notice Get value of a specific position in ETH
     * @param positionId Position to check
     * @return collateralEth Collateral value
     * @return debtEth Debt value
     * @return netEth Net value
     */
    function getPositionValue(uint256 positionId) 
        external view returns (uint256 collateralEth, uint256 debtEth, uint256 netEth);
    
    // ==================== YIELD INFORMATION ====================
    
    /**
     * @notice Get APY/yield information for a token
     * @param tokenCode Token to check (e.g., "WETH")
     * @return info YieldInfo struct with APY data
     */
    function getYieldInfo(string memory tokenCode) external view returns (YieldInfo memory info);
    
    /**
     * @notice Get estimated net APY for current positions
     * @return netAPY Net APY considering borrow costs (can be negative)
     */
    function getNetAPY() external view returns (int256 netAPY);
    
    // ==================== UTILITY FUNCTIONS ====================
    
    /**
     * @notice Get vault/market address for a token
     * @param tokenCode Token identifier
     * @return vault Protocol-specific vault/market address
     */
    function getVaultForToken(string memory tokenCode) external view returns (address vault);
    
    /**
     * @notice Get maximum withdrawable amount maintaining health
     * @param tokenCode Token to withdraw
     * @return maxAmount Maximum amount that can be withdrawn
     */
    function getMaxWithdrawable(string memory tokenCode) external view returns (uint256 maxAmount);
    
    /**
     * @notice Estimate WETH obtainable by closing all positions
     * @return wethAmount Estimated WETH after closing all positions
     */
    function estimateWethFromCloseAll() external view returns (uint256 wethAmount);
    
    // ==================== EVENTS ====================
    
    event HealthChecked(uint256 indexed positionId, uint256 healthFactor, string riskLevel);
    event RiskAlertTriggered(uint256 indexed positionId, uint256 healthFactor, string reason);
}
