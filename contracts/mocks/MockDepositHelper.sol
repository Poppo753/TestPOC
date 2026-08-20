// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IWETH.sol";

/**
 * @title MockDepositHelper
 * @dev Simple helper contract for testing deposits from contract addresses
 */
contract MockDepositHelper {
    // Allow contract to receive ETH
    receive() external payable {}
    
    /**
     * @dev Deposit via ERC20 flow: wrap ETH→WETH, approve LM, call deposit(amount)
     * @param liquidityManager Address of LiquidityManager contract
     * @param weth Address of WETH token
     * @param amount Amount to deposit
     */
    function depositTo(address liquidityManager, address weth, uint256 amount) external {
        // Wrap ETH to WETH
        IWETH(weth).deposit{value: amount}();
        // Approve LM
        IERC20(weth).approve(liquidityManager, amount);
        // Call deposit(uint256)
        (bool success, ) = liquidityManager.call(
            abi.encodeWithSignature("deposit(uint256)", amount)
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
