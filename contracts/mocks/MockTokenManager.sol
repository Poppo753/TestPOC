// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title MockTokenManager
 * @notice Mock del TokenManager per test unitari
 * @dev Permette di configurare mapping tokenCode -> address
 */
contract MockTokenManager {
    mapping(string => address) private tokenAddresses;
    mapping(address => string) private tokenCodes;
    mapping(string => uint256) private tokenPrices;
    string[] private _activeTokens;
    
    function setTokenAddress(string memory tokenCode, address tokenAddress) external {
        tokenAddresses[tokenCode] = tokenAddress;
        tokenCodes[tokenAddress] = tokenCode;
        // Track active tokens for getActiveTokens()
        bool exists = false;
        for (uint256 i = 0; i < _activeTokens.length; i++) {
            if (keccak256(bytes(_activeTokens[i])) == keccak256(bytes(tokenCode))) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            _activeTokens.push(tokenCode);
        }
    }
    
    function getTokenAddress(string memory tokenCode) external view returns (address) {
        return tokenAddresses[tokenCode];
    }
    
    function getTokenCode(address tokenAddress) external view returns (string memory) {
        return tokenCodes[tokenAddress];
    }
    
    function isTokenRegistered(string memory tokenCode) external view returns (bool) {
        return tokenAddresses[tokenCode] != address(0);
    }

    function setTokenPrice(string memory tokenCode, uint256 price) external {
        tokenPrices[tokenCode] = price;
    }

    function getTokenPriceForModule(string memory tokenCode) external view returns (uint256) {
        return tokenPrices[tokenCode];
    }

    function getActiveTokens() external view returns (string[] memory) {
        return _activeTokens;
    }

    function isTokenActive(string memory tokenCode) external view returns (bool) {
        return tokenAddresses[tokenCode] != address(0);
    }
}
