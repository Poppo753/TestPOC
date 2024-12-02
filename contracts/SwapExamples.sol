// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.27;
pragma abicoder v2;

import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';

contract SwapExamples {
    ISwapRouter public immutable swapRouter;

    constructor(ISwapRouter _swapRouter) {
        swapRouter = _swapRouter;
    }

    /// @notice swapExactInputSingle swaps a fixed amount of `tokenIn` for a maximum possible amount of `tokenOut`
    /// @dev The calling address must approve this contract to spend at least `amountIn` worth of `tokenIn` for this function to succeed.
    /// @param tokenIn The address of the token being sent.
    /// @param tokenOut The address of the token being received.
    /// @param fee The fee tier of the pool to use (e.g., 500, 3000, 10000 for 0.05%, 0.3%, and 1% respectively).
    /// @param amountIn The exact amount of `tokenIn` that will be swapped.
    /// @return amountOut The amount of `tokenOut` received.
    function swapExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn
    ) external returns (uint256 amountOut) {
        // Transfer the specified amount of `tokenIn` to this contract.
        TransferHelper.safeTransferFrom(tokenIn, msg.sender, address(this), amountIn);

        // Approve the router to spend `tokenIn`.
        TransferHelper.safeApprove(tokenIn, address(swapRouter), amountIn);

        // Set up the parameters for the swap.
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            recipient: msg.sender,
            deadline: block.timestamp,
            amountIn: amountIn,
            amountOutMinimum: 0, // In production, set a safer value based on an oracle or other data source.
            sqrtPriceLimitX96: 0 // No price limit; set appropriately in production.
        });

        // Execute the swap.
        amountOut = swapRouter.exactInputSingle(params);
    }
}
