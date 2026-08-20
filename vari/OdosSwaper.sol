// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IOdosRouter {
    function swap(
        address fromToken,
        address toToken,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        address referral
    ) external returns (uint256 amountOut);
}

contract OdosSwapper {
    address public odosRouter;
    uint256 public constant SLIPPAGE_DENOMINATOR = 10000; // Basis points (0.01% precision)

    constructor(address _odosRouter) {
        require(_odosRouter != address(0), "Invalid Odos Router address");
        odosRouter = _odosRouter;
    }

    function approveToken(address token, uint256 amount) external {
        require(token != address(0), "Invalid token address");
        IERC20(token).approve(odosRouter, amount);
    }

function swapTokens(
    address fromToken,
    address toToken,
    uint256 amountIn,
    uint256 slippageBps,
    address recipient,
    address referral
) external returns (uint256 amountOut) {
    require(fromToken != address(0), "Invalid fromToken address");
    require(toToken != address(0), "Invalid toToken address");
    require(recipient != address(0), "Invalid recipient address");
    require(slippageBps <= SLIPPAGE_DENOMINATOR, "Slippage too high");

    // Trasferisci i token dal mittente al contratto
    IERC20(fromToken).transferFrom(msg.sender, address(this), amountIn);

    // Approva il router di Odos a spendere i token
    IERC20(fromToken).approve(odosRouter, amountIn);

    uint256 minAmountOut = (amountIn * (SLIPPAGE_DENOMINATOR - slippageBps)) / SLIPPAGE_DENOMINATOR;

    // Chiama il router di Odos per eseguire lo swap
    amountOut = IOdosRouter(odosRouter).swap(
        fromToken,
        toToken,
        amountIn,
        minAmountOut,
        recipient,
        referral
    );

    require(amountOut >= minAmountOut, "Swap failed due to slippage");
}

}
