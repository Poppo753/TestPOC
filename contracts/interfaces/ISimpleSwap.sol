// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ISimpleSwap
 * @notice Interface for swap plugins with TokenManager integration
 * @dev Updated to receive decimals from TokenManager (single source of truth)
 */
interface ISimpleSwap {
    function inputSwap(address spendToken, address receiveToken, uint256 amountIn) external returns (uint256);
    function outputSwap(address spendToken, address receiveToken, uint256 amountInMax, uint256 amountOut) external returns (uint256);
    
    /**
     * @notice Get expected output amount for a swap
     * @param spendToken Token to sell
     * @param receiveToken Token to buy
     * @param amountIn Amount of spendToken to sell
     * @param decimalsIn Decimals of spendToken (from TokenManager)
     * @param decimalsOut Decimals of receiveToken (from TokenManager)
     * @return Expected amount of receiveToken
     */
    function getExpectedOutput(
        address spendToken, 
        address receiveToken, 
        uint256 amountIn,
        uint8 decimalsIn,
        uint8 decimalsOut
    ) external view returns (uint256);
}
