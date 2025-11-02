// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MockDepositHelper
 * @dev Simple helper contract for testing deposits from contract addresses
 */
contract MockDepositHelper {
    // Allow contract to receive ETH
    receive() external payable {}
    
    /**
     * @dev Deposit ETH to LiquidityManager from this contract address
     * @param liquidityManager Address of LiquidityManager contract
     * @param amount Amount of ETH to deposit
     */
    function depositTo(address payable liquidityManager, uint256 amount) external {
        require(address(this).balance >= amount, "Insufficient balance");
        
        // Call deposit() on LiquidityManager
        (bool success, ) = liquidityManager.call{value: amount}(
            abi.encodeWithSignature("deposit()")
        );
        require(success, "Deposit failed");
    }
    
    /**
     * @dev Get ETH balance of this contract
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
