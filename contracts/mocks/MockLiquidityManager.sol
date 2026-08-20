// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockLiquidityManager
 * @notice Mock implementation of LiquidityManager for testing
 * @dev Minimal implementation to satisfy Beacon registration for SwapManager tests
 */
contract MockLiquidityManager {
    address public owner;
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @notice Mock function to satisfy interface requirements
     */
    function isAuthorized(address _user) external view returns (bool) {
        return _user == owner;
    }
}
