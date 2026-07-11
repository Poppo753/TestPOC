// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/ISwapPlugin.sol";

/**
 * @title UniswapV3Plugin
 * @notice Wrapper around deployed SimpleSwap contract
 * @dev Implements ISwapPlugin interface, delegates actual swap operations to SimpleSwap
 */
contract UniswapV3Plugin is ISwapPlugin, Ownable {
    using SafeERC20 for IERC20;

    /// @notice The underlying SimpleSwap contract
    address public immutable simpleSwap;

    /// @notice Custom error for invalid SimpleSwap address
    error InvalidSimpleSwapAddress();

    constructor(address _simpleSwap) Ownable() {
        if (_simpleSwap == address(0)) revert InvalidSimpleSwapAddress();
        simpleSwap = _simpleSwap;
    }

    // ==================== ISwapPlugin METADATA ====================

    function getProtocolInfo() external pure override returns (ProtocolInfo memory) {
        return ProtocolInfo({
            name: "Uniswap V3",
            version: "1.0.0",
            features: 3 // BASIC_SWAP | MULTI_HOP
        });
    }

    function supportsTokenPair(address, address) external pure override returns (bool) {
        return true;
    }

    function isHealthy() external pure override returns (bool healthy, string memory reason) {
        return (true, "");
    }

    // ==================== ISimpleSwap DELEGATION ====================

    function inputSwap(
        address spendToken,
        address receiveToken,
        uint256 amountIn
    ) external override returns (uint256) {
        require(spendToken != address(0), "Invalid spendToken");
        require(receiveToken != address(0), "Invalid receiveToken");
        require(amountIn > 0, "Invalid amountIn");
        require(spendToken != receiveToken, "Same token");

        // Transfer tokens from caller to this contract
        IERC20(spendToken).safeTransferFrom(msg.sender, address(this), amountIn);
        
        // Approve SimpleSwap to spend tokens
        IERC20(spendToken).safeApprove(simpleSwap, 0);
        IERC20(spendToken).safeApprove(simpleSwap, amountIn);

        // Delegate to SimpleSwap
        uint256 amountOut = ISimpleSwap(simpleSwap).inputSwap(spendToken, receiveToken, amountIn);

        // Transfer output tokens to caller
        if (amountOut > 0) {
            IERC20(receiveToken).safeTransfer(msg.sender, amountOut);
        }

        return amountOut;
    }

    function outputSwap(
        address spendToken,
        address receiveToken,
        uint256 amountInMax,
        uint256 amountOut
    ) external override returns (uint256) {
        IERC20(spendToken).safeTransferFrom(msg.sender, address(this), amountInMax);
        IERC20(spendToken).safeApprove(simpleSwap, 0);
        IERC20(spendToken).safeApprove(simpleSwap, amountInMax);

        uint256 amountUsed = ISimpleSwap(simpleSwap).outputSwap(spendToken, receiveToken, amountInMax, amountOut);

        // Return excess tokens
        uint256 excess = amountInMax - amountUsed;
        if (excess > 0) {
            IERC20(spendToken).safeTransfer(msg.sender, excess);
        }
        // Transfer output tokens to caller
        if (amountOut > 0) {
            IERC20(receiveToken).safeTransfer(msg.sender, amountOut);
        }

        return amountUsed;
    }

    /// @notice Get expected output (3-param convenience method)
    function getExpectedOutput(
        address spendToken,
        address receiveToken,
        uint256 amountIn
    ) external view returns (uint256) {
        return ISimpleSwap(simpleSwap).getExpectedOutput(spendToken, receiveToken, amountIn, 0, 0);
    }

    /// @notice Get expected output (5-param ISimpleSwap interface)
    function getExpectedOutput(
        address spendToken,
        address receiveToken,
        uint256 amountIn,
        uint8 decimalsIn,
        uint8 decimalsOut
    ) external view override returns (uint256) {
        return ISimpleSwap(simpleSwap).getExpectedOutput(spendToken, receiveToken, amountIn, decimalsIn, decimalsOut);
    }
}
