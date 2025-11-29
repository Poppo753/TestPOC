// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ISimpleSwap.sol";

/**
 * @title IAsyncSwapPlugin
 * @notice Extended interface for async swap plugins that require execution fees
 * @dev Extends ISimpleSwap with payable support for plugins like GMX V2
 * 
 * WHY THIS EXISTS:
 * - GMX V2 requires ETH execution fees for keeper operations
 * - ISimpleSwap.inputSwap() is not payable
 * - Cannot override with different mutability
 * 
 * SOLUTION:
 * - GMXv2Plugin implements this interface instead
 * - SwapManager can detect async plugins and handle execution fees
 * - Backward compatible with ISimpleSwap (for queries)
 */
interface IAsyncSwapPlugin {
    
    /**
     * @notice Async swap with execution fee support
     * @param spendToken Token to spend
     * @param receiveToken Token to receive
     * @param amountIn Amount to spend
     * @return amountOut Expected output (estimated for async)
     * 
     * DIFFERENCES FROM ISimpleSwap:
     * - Payable (accepts msg.value for execution fees)
     * - Returns estimate (actual output known after keeper execution)
     * - Non-atomic (delay between call and execution)
     * 
     * EXECUTION FEE:
     * - Must send ETH via msg.value
     * - Typical range: 0.001-0.003 ETH
     * - Varies with gas price
     */
    function inputSwap(
        address spendToken,
        address receiveToken,
        uint256 amountIn
    ) external payable returns (uint256 amountOut);
    
    /**
     * @notice Output swap (may not be supported by all async plugins)
     * @param spendToken Token to spend
     * @param receiveToken Token to receive
     * @param amountInMax Max amount to spend
     * @param amountOut Exact output desired
     * @return amountIn Actual input used (estimated for async)
     */
    function outputSwap(
        address spendToken,
        address receiveToken,
        uint256 amountInMax,
        uint256 amountOut
    ) external payable returns (uint256 amountIn);
    
    /**
     * @notice Get expected output (same as ISimpleSwap)
     * @param spendToken Token to sell
     * @param receiveToken Token to buy
     * @param amountIn Amount to spend
     * @param decimalsIn Decimals of spendToken
     * @param decimalsOut Decimals of receiveToken
     * @return Expected output amount
     */
    function getExpectedOutput(
        address spendToken,
        address receiveToken,
        uint256 amountIn,
        uint8 decimalsIn,
        uint8 decimalsOut
    ) external view returns (uint256);
    
    /**
     * @notice Get required execution fee for operation
     * @param operationType 0=deposit, 1=withdrawal
     * @return executionFee Required ETH amount
     */
    function getExecutionFee(uint8 operationType) 
        external view returns (uint256 executionFee);
    
    /**
     * @notice Check if operation is still pending
     * @param operationKey Unique key for tracking
     * @return isPending True if still pending
     * @return estimatedTime Estimated completion time
     */
    function checkOperationStatus(bytes32 operationKey)
        external view returns (bool isPending, uint256 estimatedTime);
}
