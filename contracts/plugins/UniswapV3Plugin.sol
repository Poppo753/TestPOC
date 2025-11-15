// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ISwapPlugin.sol";

/**
 * @title UniswapV3Plugin
 * @notice Wrapper for deployed SimpleSwap contract (0xa0DB78167CBAccD47524a261b7741C6B41Bbd096)
 * @dev Implements ISwapPlugin interface for Uniswap V3 swaps
 * 
 * ARCHITECTURE:
 * - Wraps existing SimpleSwap deployed on Arbitrum
 * - SimpleSwap contract is a Uniswap V3 Router wrapper
 * - Adds ISwapPlugin metadata functions (getProtocolInfo, supportsTokenPair, isHealthy)
 * - Delegates actual swap execution to SimpleSwap
 * 
 * DEPLOYMENT:
 * - Constructor takes SimpleSwap address (0xa0DB7...)
 * - Can be registered in Beacon as "UniswapV3Plugin"
 * - No need to redeploy SimpleSwap (reuses existing)
 */
contract UniswapV3Plugin is ISwapPlugin {
    
    // ============ IMMUTABLES ============
    
    /// @notice Address of deployed SimpleSwap contract (Uniswap V3 wrapper)
    address public immutable simpleSwap;
    
    // ============ ERRORS ============
    
    error InvalidSimpleSwapAddress();
    error SwapFailed(string reason);
    error TokenPairNotSupported();
    
    // ============ CONSTRUCTOR ============
    
    /**
     * @notice Initialize UniswapV3Plugin with deployed SimpleSwap address
     * @param _simpleSwap Address of SimpleSwap contract (0xa0DB78167CBAccD47524a261b7741C6B41Bbd096)
     */
    constructor(address _simpleSwap) {
        if (_simpleSwap == address(0)) revert InvalidSimpleSwapAddress();
        simpleSwap = _simpleSwap;
    }
    
    // ============ ISWAP PLUGIN INTERFACE ============
    
    /**
     * @inheritdoc ISwapPlugin
     * @dev Features bitmask: 1=BASIC_SWAP, 2=MULTI_HOP
     */
    function getProtocolInfo() external pure override returns (ProtocolInfo memory) {
        return ProtocolInfo({
            name: "Uniswap V3",
            version: "1.0.0",
            features: 3 // 1 | 2 = BASIC_SWAP | MULTI_HOP
        });
    }
    
    /**
     * @inheritdoc ISwapPlugin
     * @dev For Uniswap V3, we assume all token pairs are supported (liquidity check happens on-chain)
     */
    function supportsTokenPair(
        address /* tokenA */,
        address /* tokenB */
    ) external pure override returns (bool) {
        // Uniswap V3 has permissionless pools - any pair could exist
        // Actual liquidity check happens during swap execution
        return true;
    }
    
    /**
     * @inheritdoc ISwapPlugin
     * @dev Basic health check: verifies SimpleSwap contract still exists
     */
    function isHealthy() external view override returns (bool healthy, string memory reason) {
        // Check if SimpleSwap contract still has code
        uint256 size;
        address target = simpleSwap;
        
        assembly {
            size := extcodesize(target)
        }
        
        if (size == 0) {
            return (false, "SimpleSwap contract not found");
        }
        
        return (true, "");
    }
    
    // ============ ISIMPLESWAP INTERFACE (DELEGATION) ============
    
    /**
     * @inheritdoc ISimpleSwap
     * @dev Delegates to SimpleSwap.inputSwap()
     * 
     * CUSTODY PATTERN:
     * - SwapManager calls this function
     * - SwapManager must have approved this contract (UniswapV3Plugin) to spend tokens
     * - This contract approves SimpleSwap to spend tokens
     * - SimpleSwap executes the swap via Uniswap V3
     * - Tokens returned to msg.sender (SwapManager)
     */
    function inputSwap(
        address spendToken,
        address receiveToken,
        uint256 amountIn
    ) external override returns (uint256 amountOut) {
        // Validate inputs
        require(spendToken != address(0), "Invalid spendToken");
        require(receiveToken != address(0), "Invalid receiveToken");
        require(amountIn > 0, "Invalid amountIn");
        require(spendToken != receiveToken, "Same token");
        
        // Transfer tokens from caller (SwapManager) to this contract
        require(
            IERC20(spendToken).transferFrom(msg.sender, address(this), amountIn),
            "Transfer from caller failed"
        );
        
        // Approve SimpleSwap to spend tokens
        require(
            IERC20(spendToken).approve(simpleSwap, amountIn),
            "Approval to SimpleSwap failed"
        );
        
        // Delegate to SimpleSwap
        try ISimpleSwap(simpleSwap).inputSwap(spendToken, receiveToken, amountIn) 
            returns (uint256 outputAmount) 
        {
            amountOut = outputAmount;
            
            // Transfer received tokens back to caller (SwapManager)
            require(
                IERC20(receiveToken).transfer(msg.sender, amountOut),
                "Transfer to caller failed"
            );
            
            return amountOut;
        } catch Error(string memory reason) {
            revert SwapFailed(reason);
        } catch {
            revert SwapFailed("Unknown error in SimpleSwap");
        }
    }
    
    /**
     * @inheritdoc ISimpleSwap
     * @dev Delegates to SimpleSwap.outputSwap()
     */
    function outputSwap(
        address spendToken,
        address receiveToken,
        uint256 amountInMax,
        uint256 amountOut
    ) external override returns (uint256 amountIn) {
        // Validate inputs
        require(spendToken != address(0), "Invalid spendToken");
        require(receiveToken != address(0), "Invalid receiveToken");
        require(amountInMax > 0, "Invalid amountInMax");
        require(amountOut > 0, "Invalid amountOut");
        require(spendToken != receiveToken, "Same token");
        
        // Transfer max tokens from caller to this contract
        require(
            IERC20(spendToken).transferFrom(msg.sender, address(this), amountInMax),
            "Transfer from caller failed"
        );
        
        // Approve SimpleSwap to spend tokens
        require(
            IERC20(spendToken).approve(simpleSwap, amountInMax),
            "Approval to SimpleSwap failed"
        );
        
        // Delegate to SimpleSwap
        try ISimpleSwap(simpleSwap).outputSwap(spendToken, receiveToken, amountInMax, amountOut) 
            returns (uint256 actualAmountIn) 
        {
            amountIn = actualAmountIn;
            
            // Transfer received tokens to caller
            require(
                IERC20(receiveToken).transfer(msg.sender, amountOut),
                "Transfer receiveToken to caller failed"
            );
            
            // Refund unused spendToken if any
            if (actualAmountIn < amountInMax) {
                uint256 refund = amountInMax - actualAmountIn;
                require(
                    IERC20(spendToken).transfer(msg.sender, refund),
                    "Refund transfer failed"
                );
            }
            
            return amountIn;
        } catch Error(string memory reason) {
            revert SwapFailed(reason);
        } catch {
            revert SwapFailed("Unknown error in SimpleSwap");
        }
    }
    
    /**
     * @inheritdoc ISimpleSwap
     * @dev Delegates to SimpleSwap.getExpectedOutput()
     * 
     * NOTE: This is a VIEW function - no state changes, just query
     */
    function getExpectedOutput(
        address spendToken,
        address receiveToken,
        uint256 amountIn
    ) external view override returns (uint256) {
        require(spendToken != address(0), "Invalid spendToken");
        require(receiveToken != address(0), "Invalid receiveToken");
        require(amountIn > 0, "Invalid amountIn");
        
        // Delegate to SimpleSwap (view function - no gas cost for external call in view context)
        try ISimpleSwap(simpleSwap).getExpectedOutput(spendToken, receiveToken, amountIn) 
            returns (uint256 expectedOutput) 
        {
            return expectedOutput;
        } catch {
            return 0; // Return 0 if query fails (e.g., no liquidity)
        }
    }
}
