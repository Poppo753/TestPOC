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
    
    // ==================== LEVERAGE OPERATIONS ====================
    
    /**
     * @notice Open a new leverage position
     * @dev Executes atomic EVC batch:
     *      1. Deposit initial collateral
     *      2. Enable collateral vault as collateral
     *      3. Enable borrow vault as controller
     *      4. Borrow → send to Swapper
     *      5. Swap borrowed → collateral
     *      6. Deposit swapped collateral
     *      7. Verify with SwapVerifier
     * 
     * @param params Position parameters (see OpenLeverageParams)
     * @return positionId Unique ID of created position
     */
    function openLeveragePosition(OpenLeverageParams calldata params) 
        external 
        returns (uint256 positionId);
    
    /**
     * @notice Close an existing leverage position
     * @param positionId Position ID to close
     * @return collateralReturned Collateral returned to ProxyGeneral
     */
    function closeLeveragePosition(uint256 positionId) 
        external 
        returns (uint256 collateralReturned);
    
    /**
     * @notice Add collateral to an existing position
     * @param positionId Position ID
     * @param amount Collateral amount to add
     */
    function addCollateralToPosition(uint256 positionId, uint256 amount) external;
    
    /**
     * @notice Remove collateral from an existing position
     * @param positionId Position ID
     * @param amount Collateral amount to remove
     */
    function removeCollateralFromPosition(uint256 positionId, uint256 amount) external;
    
    // ==================== EULER-SPECIFIC VIEWS ====================
    
    /**
     * @notice Get health factor of a specific position
     * @param positionId Position ID
     * @return healthFactor Health factor in 18 decimals (1.0 = 1e18)
     */
    function getPositionHealth(uint256 positionId) 
        external 
        view 
        returns (uint256 healthFactor);
    
    /**
     * @notice Get values of a position
     * @param positionId Position ID
     * @return collateralValue Collateral value in ETH (18 decimals)
     * @return debtValue Debt value in ETH (18 decimals)
     */
    function getPositionValue(uint256 positionId) 
        external 
        view 
        returns (uint256 collateralValue, uint256 debtValue);
    
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
