// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IValueCalculatorForModules {
    struct PoolValueInfo {
        uint256 totalValue;
        TokenValueInfo[] tokenValues;
    }
    
    struct TokenValueInfo {
        string tokenCode;
        uint256 value;
        uint256 balance;
        uint256 pricePerToken;
        uint256 percentage;
    }
    
    function getTotalPoolValue() external returns (PoolValueInfo memory);
    function getTotalPoolValueView() external view returns (uint256);
    function calculateTokenValue(string memory tokenCode) external returns (uint256);
    function selectTokenForSwap(uint256 targetValue) external view returns (string memory tokenCode, uint256 amount);
    function validatePoolValue() external view returns (bool isValid, string memory errorReason);
}
