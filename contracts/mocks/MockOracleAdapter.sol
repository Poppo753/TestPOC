// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IOracleAdapter.sol";

/**
 * @title MockOracleAdapter
 * @notice Mock implementation of IOracleAdapter for testing
 * @dev Allows full control over prices, timestamps, and validity flags for testing
 * 
 * Features:
 * - Controllable prices per token
 * - Controllable validity flags (simulate stale prices)
 * - Controllable decimals per token
 * - Simple mapping-based storage (no external dependencies)
 * 
 * Usage:
 * ```solidity
 * MockOracleAdapter mock = new MockOracleAdapter();
 * mock.setPrice("USDC", 2000_00000000); // $2000.00 with 8 decimals
 * mock.setDecimals("USDC", 8);
 * mock.setStale("USDC"); // Mark as stale for testing
 * ```
 */
contract MockOracleAdapter is IOracleAdapter {
    
    // ==================== STORAGE ====================
    
    /// @notice Prices per token code
    mapping(string => uint256) public prices;
    
    /// @notice Timestamps per token code
    mapping(string => uint256) public timestamps;
    
    /// @notice Validity flags per token code (true = fresh, false = stale)
    mapping(string => bool) public validFlags;
    
    /// @notice Decimals per token code
    mapping(string => uint8) public decimalsMap;
    
    // ==================== TEST HELPER FUNCTIONS ====================
    
    /**
     * @notice Set price for a token
     * @dev Automatically marks as valid and sets current timestamp
     * @param tokenCode Token identifier
     * @param price Price value (in token's decimals)
     */
    function setPrice(string memory tokenCode, uint256 price) external {
        prices[tokenCode] = price;
        timestamps[tokenCode] = block.timestamp;
        validFlags[tokenCode] = true;
    }
    
    /**
     * @notice Set custom timestamp for a token
     * @dev Useful for testing stale price detection
     * @param tokenCode Token identifier
     * @param timestamp Custom timestamp (typically in the past)
     */
    function setTimestamp(string memory tokenCode, uint256 timestamp) external {
        timestamps[tokenCode] = timestamp;
    }
    
    /**
     * @notice Mark price as stale
     * @dev Sets validFlags[tokenCode] = false
     * @param tokenCode Token to mark as stale
     */
    function setStale(string memory tokenCode) external {
        validFlags[tokenCode] = false;
    }
    
    /**
     * @notice Mark price as valid/fresh
     * @dev Sets validFlags[tokenCode] = true
     * @param tokenCode Token to mark as valid
     */
    function setValid(string memory tokenCode) external {
        validFlags[tokenCode] = true;
    }
    
    /**
     * @notice Set decimals for a token
     * @param tokenCode Token identifier
     * @param decimals Number of decimals (0-18)
     */
    function setDecimals(string memory tokenCode, uint8 decimals) external {
        require(decimals <= 18, "Invalid decimals");
        decimalsMap[tokenCode] = decimals;
    }
    
    /**
     * @notice Remove token (set price to 0)
     * @dev Makes supportsToken() return false
     * @param tokenCode Token to remove
     */
    function removeToken(string memory tokenCode) external {
        prices[tokenCode] = 0;
        validFlags[tokenCode] = false;
    }
    
    /**
     * @notice Setup complete token configuration in one call
     * @dev Convenience function for test setup
     * @param tokenCode Token identifier
     * @param price Price value
     * @param decimals Number of decimals
     * @param isValid Whether price should be marked as valid
     */
    function setupToken(
        string memory tokenCode,
        uint256 price,
        uint8 decimals,
        bool isValid
    ) external {
        prices[tokenCode] = price;
        timestamps[tokenCode] = block.timestamp;
        decimalsMap[tokenCode] = decimals;
        validFlags[tokenCode] = isValid;
    }
    
    // ==================== IORACLEADAPTER IMPLEMENTATION ====================
    
    /**
     * @inheritdoc IOracleAdapter
     * @dev Returns stored values - no external calls
     */
    function getPrice(string memory tokenCode)
        external
        view
        override
        returns (
            uint256 price,
            uint256 timestamp,
            bool isValid
        )
    {
        // Check if token exists (price > 0)
        if (prices[tokenCode] == 0) {
            revert TokenNotSupported(tokenCode);
        }
        
        return (
            prices[tokenCode],
            timestamps[tokenCode],
            validFlags[tokenCode]
        );
    }
    
    /**
     * @inheritdoc IOracleAdapter
     * @dev Returns stored decimals value
     */
    function getPriceDecimals(string memory tokenCode)
        external
        view
        override
        returns (uint8 decimals)
    {
        // Check if token exists
        if (prices[tokenCode] == 0) {
            revert TokenNotSupported(tokenCode);
        }
        
        return decimalsMap[tokenCode];
    }
    
    /**
     * @inheritdoc IOracleAdapter
     * @dev Returns true if price > 0 (token configured)
     */
    function supportsToken(string memory tokenCode)
        external
        view
        override
        returns (bool supported)
    {
        return prices[tokenCode] > 0;
    }
    
    /**
     * @inheritdoc IOracleAdapter
     * @dev Returns mock adapter info
     */
    function getAdapterInfo()
        external
        pure
        override
        returns (
            string memory name,
            string memory version
        )
    {
        return ("Mock", "1.0.0");
    }
}
