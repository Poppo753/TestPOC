// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IUniswapV3QuoterV2
 * @notice Interface for Uniswap V3 Quoter V2
 * @dev Used for getting accurate price quotes without executing swaps
 */
interface IUniswapV3QuoterV2 {
    
    struct QuoteExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint24 fee;
        uint160 sqrtPriceLimitX96;
    }
    
    /**
     * @notice Returns the amount out for a single-hop exact input swap
     * @param params The params for the quote
     * @return amountOut The amount of tokenOut received
     * @return sqrtPriceX96After The sqrt price after the swap
     * @return initializedTicksCrossed The number of initialized ticks crossed
     * @return gasEstimate The estimated gas used for the swap
     * @dev Marked as view for staticcall compatibility from Solidity contracts
     */
    function quoteExactInputSingle(QuoteExactInputSingleParams calldata params)
        external
        view
        returns (
            uint256 amountOut,
            uint160 sqrtPriceX96After,
            uint32 initializedTicksCrossed,
            uint256 gasEstimate
        );
}
