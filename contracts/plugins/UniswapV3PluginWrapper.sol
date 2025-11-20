// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/ISwapPlugin.sol";
import "../interfaces/ISimpleSwap.sol";

/**
 * @title UniswapV3PluginWrapper
 * @notice Minimal wrapper around existing SimpleSwap contract
 * @dev Adds ISwapPlugin metadata to deployed SimpleSwap (0xa0DB7...)
 * 
 * ARCHITECTURE (ORIGINAL PLAN):
 * SwapManager → UniswapV3PluginWrapper → SimpleSwap (0xa0DB7...) → Uniswap Router
 * 
 * This is the LIGHTEST possible implementation:
 * - Just adds 3 metadata functions (getProtocolInfo, supportsTokenPair, isHealthy)
 * - All swap logic delegated to existing SimpleSwap
 */
contract UniswapV3PluginWrapper is ISwapPlugin {
    
    // ============ IMMUTABLES ============
    
    /// @notice Address of deployed SimpleSwap contract
    ISimpleSwap public immutable simpleSwap;
    
    // ============ ERRORS ============
    
    error InvalidSimpleSwapAddress();
    
    // ============ CONSTRUCTOR ============
    
    /**
     * @notice Wrap existing SimpleSwap deployment
     * @param _simpleSwap SimpleSwap contract address (0xa0DB78167CBAccD47524a261b7741C6B41Bbd096)
     */
    constructor(address _simpleSwap) {
        if (_simpleSwap == address(0)) revert InvalidSimpleSwapAddress();
        simpleSwap = ISimpleSwap(_simpleSwap);
    }
    
    // ============ ISWAP PLUGIN METADATA (NEW) ============
    
    function getProtocolInfo() external pure override returns (ProtocolInfo memory) {
        return ProtocolInfo({
            name: "Uniswap V3",
            version: "1.0.0",
            features: 3 // BASIC_SWAP | MULTI_HOP
        });
    }
    
    function supportsTokenPair(
        address /* tokenA */,
        address /* tokenB */
    ) external pure override returns (bool) {
        return true; // Uniswap V3 permissionless
    }
    
    function isHealthy() external view override returns (bool healthy, string memory reason) {
        uint256 size;
        address target = address(simpleSwap);
        
        assembly {
            size := extcodesize(target)
        }
        
        if (size == 0) {
            return (false, "SimpleSwap contract not found");
        }
        
        return (true, "");
    }
    
    // ============ ISIMPLESWAP DELEGATION (PASSTHROUGH) ============
    
    /**
     * @inheritdoc ISimpleSwap
     * @dev Pure delegation to SimpleSwap - NO token handling here
     */
    function inputSwap(
        address spendToken,
        address receiveToken,
        uint256 amountIn
    ) external override returns (uint256) {
        return simpleSwap.inputSwap(spendToken, receiveToken, amountIn);
    }
    
    function outputSwap(
        address spendToken,
        address receiveToken,
        uint256 amountInMax,
        uint256 amountOut
    ) external override returns (uint256) {
        return simpleSwap.outputSwap(spendToken, receiveToken, amountInMax, amountOut);
    }
    
    function getExpectedOutput(
        address spendToken,
        address receiveToken,
        uint256 amountIn,
        uint8 /* decimalsIn */,
        uint8 /* decimalsOut */
    ) external view override returns (uint256) {
        return simpleSwap.getExpectedOutput(spendToken, receiveToken, amountIn, 18, 18);
    }
}
