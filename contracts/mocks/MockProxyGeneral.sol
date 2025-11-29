// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MockProxyGeneral
 * @notice Mock del ProxyGeneral per test unitari
 * @dev Può ricevere token e ETH
 */
contract MockProxyGeneral {
    using SafeERC20 for IERC20;
    
    // Receive ETH
    receive() external payable {}
    
    // Fallback
    fallback() external payable {}
    
    /**
     * @notice Ritorna il balance di un token
     */
    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
    
    /**
     * @notice Trasferisce token a un destinatario (per simulare operazioni)
     */
    function transferToken(address token, address to, uint256 amount) external {
        IERC20(token).safeTransfer(to, amount);
    }
    
    /**
     * @notice Approva un spender per un token
     */
    function approveToken(address token, address spender, uint256 amount) external {
        IERC20(token).approve(spender, amount);
    }
}
