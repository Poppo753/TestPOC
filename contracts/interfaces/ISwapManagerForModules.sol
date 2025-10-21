// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISwapManagerForModules {
    function performSwap(
        string memory spendTokenCode,
        string memory receiveTokenCode,
        uint256 amountIn
    ) external returns (uint256 amountReceived);
    
    function validateSwapParameters(
        string memory spendTokenCode,
        string memory receiveTokenCode,
        uint256 amountIn
    ) external view returns (bool isValid, string memory errorReason);
}
