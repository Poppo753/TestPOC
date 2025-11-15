// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITokenManagerForModules {
    struct TokenInfo {
        address tokenAddress;
        uint8 tokenDecimals;
        string tokenCode;
        bool isActive;
        uint256 lastPriceTimestamp;
        uint256 lastPrice;
        uint256 heartbeat;
        uint256 errorCount;
    }
    
    function getTokenAddress(string memory tokenCode) external view returns (address);
    function isTokenActive(string memory tokenCode) external view returns (bool);
    function getTokenPrice(string memory tokenCode) external view returns (uint256 price, uint256 updatedAt, bool isStale);
    function getTokenInfo(string memory tokenCode) external view returns (TokenInfo memory);
    function getActiveTokens() external view returns (string[] memory);
    function getAllTokens() external view returns (string[] memory);
    function getPriceDecimals(string memory tokenCode) external view returns (uint256);
}
