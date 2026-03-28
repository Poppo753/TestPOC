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
    
    function setTokenAddress(string memory tokenCode, address tokenAddress) external {
        tokenAddresses[tokenCode] = tokenAddress;
        tokenCodes[tokenAddress] = tokenCode;
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
}
