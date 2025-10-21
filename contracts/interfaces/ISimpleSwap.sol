// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISimpleSwap {
    function inputSwap(address spendToken, address receiveToken, uint256 amountIn) external returns (uint256);
    function outputSwap(address spendToken, address receiveToken, uint256 amountInMax, uint256 amountOut) external returns (uint256);
    function getExpectedOutput(address spendToken, address receiveToken, uint256 amountIn) external view returns (uint256);
}
