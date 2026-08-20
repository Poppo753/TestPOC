// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IFlashLoanCallback.sol";

/**
 * @title MockFlashLoanService
 * @notice Mock FlashLoanService for testing leverage operations
 * @dev Simulates: executeFlashLoan (Balancer-style), swap (token exchange), getExpectedOutput
 *      Uses configurable ETH price for WETH/USDC swap simulation
 */
contract MockFlashLoanService {
    using SafeERC20 for IERC20;

    address public immutable WETH;
    address public immutable USDC;

    /// @notice ETH price in USDC (6 decimals). Default: 2500 USDC
    uint256 public ethPriceUsdc = 2500e6;

    /// @notice Track if currently in a flash loan (for swap reentrancy)
    bool private _inFlashLoan;

    constructor(address _weth, address _usdc) {
        WETH = _weth;
        USDC = _usdc;
    }

    /// @notice Set ETH price for swap calculations
    function setEthPrice(uint256 _priceUsdc6Decimals) external {
        ethPriceUsdc = _priceUsdc6Decimals;
    }

    /**
     * @notice Simulates Balancer flash loan flow
     * @dev Flow:
     *   1. Transfer tokens to caller (plugin)
     *   2. Call plugin.onFlashLoanReceived()
     *   3. Verify plugin returned tokens (revert if not)
     */
    function executeFlashLoan(
        address[] calldata tokens,
        uint256[] calldata amounts,
        bytes calldata callbackData
    ) external {
        require(!_inFlashLoan, "ReentrancyGuard");
        _inFlashLoan = true;

        address caller = msg.sender;

        // Build IERC20 array and fee array (0% fees like Balancer)
        IERC20[] memory ierc20Tokens = new IERC20[](tokens.length);
        uint256[] memory feeAmounts = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            ierc20Tokens[i] = IERC20(tokens[i]);
            feeAmounts[i] = 0;
        }

        // Step 1: Transfer flash loan tokens to plugin
        for (uint256 i = 0; i < tokens.length; i++) {
            IERC20(tokens[i]).safeTransfer(caller, amounts[i]);
        }

        // Step 2: Call plugin callback
        IFlashLoanCallback(caller).onFlashLoanReceived(
            ierc20Tokens,
            amounts,
            feeAmounts,
            callbackData
        );

        // Step 3: Verify repayment (plugin must have transferred tokens back)
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 balance = IERC20(tokens[i]).balanceOf(address(this));
            require(balance >= amounts[i], "MockFlashLoan: insufficient repayment");
        }

        _inFlashLoan = false;
    }

    /**
     * @notice Simulates token swap (WETH <-> USDC)
     * @dev Pulls tokenIn from caller, sends tokenOut back
     *      Uses ethPriceUsdc for price calculation
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external returns (uint256 amountOut) {
        // Pull tokens from caller
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // Calculate output
        amountOut = _calculateSwapOutput(tokenIn, tokenOut, amountIn);
        require(amountOut > 0, "MockSwap: zero output");

        // Send output tokens to caller
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);
    }

    /**
     * @notice Estimate swap output without executing
     */
    function getExpectedOutput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256) {
        return _calculateSwapOutput(tokenIn, tokenOut, amountIn);
    }

    function _calculateSwapOutput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256) {
        if (tokenIn == WETH && tokenOut == USDC) {
            // WETH → USDC: amountIn (18 dec) * ethPrice (6 dec) / 1e18
            return (amountIn * ethPriceUsdc) / 1e18;
        } else if (tokenIn == USDC && tokenOut == WETH) {
            // USDC → WETH: amountIn (6 dec) * 1e18 / ethPrice (6 dec)
            return (amountIn * 1e18) / ethPriceUsdc;
        }
        return 0;
    }
}
