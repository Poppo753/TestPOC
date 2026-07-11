// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IWETH.sol";
import "./interfaces/IBeacon.sol";
import "./interfaces/ILiquidityManager.sol";

/**
 * @title DepositHelper
 * @notice Thin wrapper that accepts native ETH, wraps to WETH, 
 *         and forwards to LiquidityManager.deposit() for WETH-based pools.
 * @dev Only useful when the pool's base asset is WETH.
 *      For USDC/USDT pools, users call LiquidityManager.deposit() directly.
 */
contract DepositHelper {
    using SafeERC20 for IERC20;

    address public immutable beacon;
    IWETH public immutable weth;

    error ZeroDeposit();

    constructor(address _beacon) {
        beacon = _beacon;
        weth = IWETH(IBeacon(_beacon).getImplementation("BASE_ASSET"));
    }

    /**
     * @notice Deposit native ETH into a WETH-based pool.
     *         Wraps ETH → WETH, approves LiquidityManager, calls deposit().
     * @return lpTokens LP tokens minted to msg.sender
     */
    function depositETH() external payable returns (uint256 lpTokens) {
        if (msg.value == 0) revert ZeroDeposit();

        // Wrap ETH → WETH
        weth.deposit{value: msg.value}();

        address lm = IBeacon(beacon).getImplementation("LiquidityManager");

        // Approve LiquidityManager to pull WETH
        IERC20(address(weth)).safeIncreaseAllowance(lm, msg.value);

        // Deposit into pool (LP tokens go to this contract first)
        lpTokens = ILiquidityManager(lm).deposit(msg.value);

        // Transfer LP tokens to caller
        address proxy = IBeacon(beacon).getImplementation("ProxyGeneral");
        IERC20(proxy).safeTransfer(msg.sender, lpTokens);
    }

    receive() external payable {}
}
