// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title IEulerV2PluginSpecific
 * @notice Interface for Euler V2 specific operations (leverage, sub-accounts)
 * @dev These functions are unique to Euler V2 and not part of the standard IProtocolAdapter
 * 
 * EULER V2 SPECIFIC FEATURES:
 * - EVC (Ethereum Vault Connector): Hub for batching and sub-accounts
 * - Sub-accounts: Isolated positions (0 = simple deposits, 1-255 = leverage)
 * - Leverage operations via atomic EVC batch
 * 
 * @author Project4 Team
 */
interface IEulerV2PluginSpecific {
    
    // ==================== STRUCTS ====================
    
    /**
     * @notice Parameters for opening a leverage position
     * @param collateralTokenCode Collateral token code (e.g., "WETH")
     * @param borrowTokenCode Token to borrow (e.g., "USDC")
     * @param collateralAmount Initial collateral to deposit
     * @param borrowAmount Amount to borrow
     * @param minCollateralReceived Minimum collateral after swap (slippage protection)
     * @param swapData Data for Euler Swapper (from aggregator API)
     * @param deadline Operation deadline timestamp
     */
    struct OpenLeverageParams {
        string collateralTokenCode;
        string borrowTokenCode;
        uint256 collateralAmount;
        uint256 borrowAmount;
        uint256 minCollateralReceived;
        bytes swapData;
        uint256 deadline;
    }
    
    /**
     * @notice Internal leverage position data
     * @dev This is the Euler-specific format, converted to IProtocolAdapter.Position for external use
     */
    struct LeveragePositionInternal {
        uint256 positionId;
        uint8 subAccountId;
        address collateralVault;
        address borrowVault;
        uint256 initialCollateral;
        uint256 borrowedAmount;
        bool isActive;
        uint256 createdAt;
    }
    
    // ==================== EVENTS ====================
    
    event LeveragePositionOpened(
        uint256 indexed positionId,
        uint8 indexed subAccountId,
        uint256 collateralAmount,
        uint256 borrowAmount
    );
    
    event LeveragePositionClosed(
        uint256 indexed positionId,
        uint256 collateralReturned
    );
    
    event CollateralAdded(uint256 indexed positionId, uint256 amount);
    event CollateralRemoved(uint256 indexed positionId, uint256 amount);
    event CircuitBreakerSet(bool tripped);
    
    // ==================== LEVERAGE OPERATIONS (DEPRECATED - Use Atomic) ====================
    
    // NOTE: Non-atomic leverage functions have been removed.
    // Use openLeverageAtomic() and closeLeverageAtomic() from IEulerV2Plugin instead.
    
    // ==================== COLLATERAL MANAGEMENT ====================
    
    /**
     * @notice Add collateral to an existing position to improve health factor
     * @dev Useful for saving positions close to liquidation
     * @param positionId Position ID
     * @param amount Collateral amount to add
     */
    function addCollateralToPosition(uint256 positionId, uint256 amount) external;
    
    /**
     * @notice Remove collateral from an existing position
     * @dev EVC will verify that health factor remains above 1.0
     * @param positionId Position ID
     * @param amount Collateral amount to remove
     */
    function removeCollateralFromPosition(uint256 positionId, uint256 amount) external;
    
    // ==================== EULER-SPECIFIC VIEWS ====================
    
    /**
     * @notice Get internal position data (Euler-specific format)
     * @param positionId Position ID
     * @return position Internal position data
     */
    function getLeveragePosition(uint256 positionId) 
        external 
        view 
        returns (LeveragePositionInternal memory position);
    
    /**
     * @notice Get all internal positions (Euler-specific format)
     * @return positions Array of internal positions
     */
    function getAllLeveragePositions() 
        external 
        view 
        returns (LeveragePositionInternal[] memory positions);
    
    /**
     * @notice Get next position ID that will be assigned
     * @return nextId Next position ID
     */
    function nextPositionId() external view returns (uint256 nextId);
    
    // ==================== ADMIN ====================
    
    /**
     * @notice Set circuit breaker state
     * @param tripped True to activate, false to deactivate
     */
    function setCircuitBreaker(bool tripped) external;
    
    /**
     * @notice Check if circuit breaker is tripped
     * @return True if active
     */
    function circuitBreakerTripped() external view returns (bool);
}
