// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITokenManagerForModules {
    struct TokenInfo {
        address tokenAddress;
        uint8 tokenDecimals;
        string tokenCode;
        address priceFeed;
        uint8 priceFeedDecimals;
        uint32 heartbeat;
        bool isActive;
    }
    
    function getTokenAddress(string memory tokenCode) external view returns (address);
    function isTokenActive(string memory tokenCode) external view returns (bool);
    function getTokenPrice(string memory tokenCode) external view returns (uint256 price, uint256 updatedAt, bool isStale);
    function getTokenInfo(string memory tokenCode) external view returns (TokenInfo memory);
    function getActiveTokens() external view returns (string[] memory);
    function getAllTokens() external view returns (string[] memory);
}
