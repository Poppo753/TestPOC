// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IEulerLensAdapter
 * @notice Interface for Euler V2 Lens Adapter - Health monitoring and value calculation
 * @dev Used by ValueCalculator, LiquidityManager, and EulerV2Plugin for:
 *      - Health factor monitoring
 *      - Time to liquidation tracking
 *      - Total Euler positions value calculation
 *      - Auto-close support for LiquidityManager
 * 
 * INTEGRATION POINTS:
 * - ValueCalculator: getTotalEulerValue() for pool value calculation
 * - LiquidityManager: getEulerPositionsAtRisk() for auto-close
 * - EulerV2Plugin: getHealthFactor(), getSubAccountHealth() for position monitoring
 * 
 * EULER LENS CONTRACTS (Arbitrum):
 * - AccountLens: 0x90a52DDcb232e7bb003DD9258fA1235c553eC956
 * - VaultLens: 0xc99FCEE6174Bc92eBe9C78690fFD5067018a8380
 * - UtilsLens: 0xDAf44060DCe217Fd603908A49fcaa1FA900304BE
 * 
 * @author Project4 Team
 */
interface IEulerLensAdapter {
    
    // ==================== STRUCTS ====================
    
    /**
     * @notice Detailed position value breakdown
     * @param totalCollateral Total collateral value in ETH
     * @param totalDebt Total debt value in ETH
     * @param netValue Net value (collateral - debt) in ETH
     */
    struct PositionValues {
        uint256 totalCollateral;
        uint256 totalDebt;
        uint256 netValue;
    }
    
    /**
     * @notice Time to liquidation status
     * @param ttl Seconds until liquidation (-1 = liquidatable, max = no debt)
     * @param status Human-readable status string
     */
    struct LiquidationStatus {
        int256 ttl;
        string status;
    }
    
    // ==================== HEALTH MONITORING ====================
    
    /**
     * @notice Get health factor for main account (EulerV2Plugin)
     * @return healthFactor Health factor scaled to 1e18 (1e18 = 1.0)
     *         Returns type(uint256).max if no debt
     */
    function getHealthFactor(address account) external view returns (uint256 healthFactor);
    
    /**
     * @notice Get health factor for a specific sub-account
     * @param subAccount Sub-account address (derived from plugin + subAccountId)
     * @param controllerVault Borrow vault that is the controller
     * @return healthFactor Health factor scaled to 1e18
     */
    function getSubAccountHealth(address subAccount, address controllerVault) 
        external view returns (uint256 healthFactor);
    
    /**
     * @notice Get time to liquidation with human-readable status
     * @param account Account to check
     * @param vault Controller vault
     * @return ttl Seconds to liquidation
     * @return status Status string: "LIQUIDATABLE", "SAFE_NO_DEBT", "SAFE_OVER_1_YEAR", "AT_RISK", "ERROR"
     */
    function getTimeToLiquidation(address account, address vault) 
        external view returns (int256 ttl, string memory status);
    
    // ==================== VALUE FUNCTIONS ====================
    
    /**
     * @notice Get total net value of all Euler positions in ETH
     * @dev Calculates: Σ(collateral values) - Σ(debt values)
     *      Includes both simple deposits and leverage positions
     * @return netValue Net value in ETH (wei)
     */
    function getTotalEulerValue() external view returns (uint256 netValue);
    
    /**
     * @notice Get detailed breakdown of Euler position values
     * @return totalCollateral Total collateral value in ETH
     * @return totalDebt Total debt value in ETH  
     * @return netValue Net value (collateral - debt) in ETH
     */
    function getEulerPositionValues() 
        external view returns (
            uint256 totalCollateral, 
            uint256 totalDebt, 
            uint256 netValue
        );
    
    /**
     * @notice Get collateral value for a specific leverage position
     * @param positionId Position ID from EulerV2Plugin
     * @return ethValue Collateral value in ETH
     */
    function getPositionCollateralInEth(uint256 positionId) 
        external view returns (uint256 ethValue);
    
    /**
     * @notice Get withdrawable amount for a token (considering debt)
     * @param tokenCode Token code (e.g., "WETH")
     * @return amount Maximum withdrawable amount without breaking health
     */
    function getWithdrawableAmount(string memory tokenCode) 
        external view returns (uint256 amount);
    
    // ==================== AUTO-CLOSE SUPPORT ====================
    
    /**
     * @notice Get list of position IDs that are at risk
     * @dev Used by LiquidityManager for auto-close decisions
     * @param minHealthFactor Minimum acceptable health factor (1.5e18 = 1.5)
     * @return positionIds Array of position IDs below threshold
     */
    function getEulerPositionsAtRisk(uint256 minHealthFactor) 
        external view returns (uint256[] memory positionIds);
    
    /**
     * @notice Check if a specific position should be auto-closed
     * @param positionId Position ID to check
     * @param healthThreshold Health factor threshold
     * @return shouldClose True if position health is below threshold
     */
    function shouldAutoClosePosition(uint256 positionId, uint256 healthThreshold) 
        external view returns (bool shouldClose);
    
    // ==================== UTILITY FUNCTIONS ====================
    
    /**
     * @notice Get primary controller vault for the plugin
     * @param plugin EulerV2Plugin address
     * @return vault Primary controller vault address (or address(0) if none)
     */
    function getPrimaryControllerVault(address plugin) 
        external view returns (address vault);
    
    /**
     * @notice Convert token code to vault address
     * @param tokenCode Token code (e.g., "WETH")
     * @return vault Euler vault address
     */
    function getVaultForToken(string memory tokenCode) 
        external view returns (address vault);
    
    /**
     * @notice Get APY information for a vault
     * @param vault Euler vault address
     * @return borrowAPY Borrow APY (scaled)
     * @return supplyAPY Supply APY (scaled)
     */
    function getVaultAPYs(address vault) 
        external view returns (uint256 borrowAPY, uint256 supplyAPY);
    
    // ==================== POSITION SORTING ====================
    
    /**
     * @notice Position with health factor for sorting
     */
    struct PositionWithHealth {
        uint256 positionId;
        uint256 healthFactor;
    }
    
    /**
     * @notice Get all active positions sorted by health factor (lowest first)
     * @dev Used by LiquidityManager to close riskiest positions first
     * @return positions Array of positions with health factors, sorted ascending
     */
    function getPositionsSortedByHealth() 
        external view returns (PositionWithHealth[] memory positions);
    
    /**
     * @notice Get health factor for a specific leverage position
     * @param positionId Position ID from EulerV2Plugin
     * @return healthFactor Health factor scaled to 1e18
     */
    function getPositionHealthFactor(uint256 positionId) 
        external view returns (uint256 healthFactor);
}
