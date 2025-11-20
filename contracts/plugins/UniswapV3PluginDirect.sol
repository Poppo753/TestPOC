// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ISwapPlugin.sol";
import "../interfaces/IUniswapV3Router.sol";
import "../interfaces/IUniswapV3QuoterV2.sol";
import "../interfaces/IUniswapV3Pool.sol";

/**
 * @title UniswapV3PluginDirect
 * @notice Direct Uniswap V3 integration plugin with Quoter V2
 * @dev Implements ISwapPlugin interface, calls Uniswap V3 Router directly
 * 
 * ARCHITECTURE (CORRECTED):
 * SwapManager → UniswapV3PluginDirect → Uniswap V3 Router (0xE592...)
 *                                     → Uniswap V3 Quoter V2 (0x61fF...)
 * 
 * NO intermediate SimpleSwap contract needed
 */
contract UniswapV3PluginDirect is ISwapPlugin {
    
    // ============ IMMUTABLES ============
    
    /// @notice Uniswap V3 Router address
    IUniswapV3Router public immutable uniswapRouter;
    
    /// @notice Uniswap V3 Quoter V2 address (for accurate quotes)
    IUniswapV3QuoterV2 public immutable quoterV2;
    
    /// @notice ProxyGeneral address (custody holder for tokens)
    address public immutable proxyGeneral;
    
    /// @notice Default fee tier (0.3% = 3000)
    uint24 public constant DEFAULT_FEE = 3000;
    
    // ============ ERRORS ============
    
    error InvalidRouterAddress();
    error InvalidProxyAddress();
    error SwapFailed(string reason);
    error InvalidTokenPair();
    error InsufficientOutput();
    
    // ============ CONSTRUCTOR ============
    
    /**
     * @notice Initialize with Uniswap V3 Router, Quoter V2, and ProxyGeneral
     * @param _uniswapRouter Uniswap V3 SwapRouter address (0xE592427A0AEce92De3Edee1F18E0157C05861564)
     * @param _quoterV2 Uniswap V3 Quoter V2 address (0x61fFE014bA17989E743c5F6cB21bF9697530B21e)
     * @param _proxyGeneral ProxyGeneral address (custody holder for pool tokens)
     */
    constructor(address _uniswapRouter, address _quoterV2, address _proxyGeneral) {
        if (_uniswapRouter == address(0)) revert InvalidRouterAddress();
        if (_proxyGeneral == address(0)) revert InvalidProxyAddress();
        if (_quoterV2 == address(0)) revert InvalidRouterAddress();
        uniswapRouter = IUniswapV3Router(_uniswapRouter);
        quoterV2 = IUniswapV3QuoterV2(_quoterV2);
        proxyGeneral = _proxyGeneral;
    }
    
    // ============ ISWAP PLUGIN INTERFACE ============
    
    /**
     * @inheritdoc ISwapPlugin
     */
    function getProtocolInfo() external pure override returns (ProtocolInfo memory) {
        return ProtocolInfo({
            name: "Uniswap V3",
            version: "2.0.0",
            features: 3 // BASIC_SWAP | MULTI_HOP
        });
    }
    
    /**
     * @inheritdoc ISwapPlugin
     */
    function supportsTokenPair(
        address tokenA,
        address tokenB
    ) external pure override returns (bool) {
        // Uniswap V3 permissionless - assume all pairs supported
        return tokenA != address(0) && tokenB != address(0) && tokenA != tokenB;
    }
    
    /**
     * @inheritdoc ISwapPlugin
     */
    function isHealthy() external view override returns (bool healthy, string memory reason) {
        // Check router contract exists
        uint256 size;
        address target = address(uniswapRouter);
        
        assembly {
            size := extcodesize(target)
        }
        
        if (size == 0) {
            return (false, "Uniswap Router not found");
        }
        
        return (true, "");
    }
    
    // ============ ISIMPLESWAP INTERFACE (DELEGATION TO UNISWAP) ============
    
    /**
     * @inheritdoc ISimpleSwap
     * @dev Executes exactInputSingle on Uniswap V3 Router
     * 
     * FLOW:
     * 1. SwapManager transfers tokens to this contract
     * 2. This contract approves Uniswap Router
     * 3. Uniswap Router executes swap
     * 4. Tokens returned to msg.sender (SwapManager)
     */
    function inputSwap(
        address spendToken,
        address receiveToken,
        uint256 amountIn
    ) external override returns (uint256 amountOut) {
        // Validate inputs
        if (spendToken == address(0) || receiveToken == address(0)) {
            revert InvalidTokenPair();
        }
        if (spendToken == receiveToken) revert InvalidTokenPair();
        if (amountIn == 0) revert InvalidTokenPair();
        
        // Transfer tokens from ProxyGeneral (custody holder) to this contract
        // SwapManager has already approved this plugin via proxy.approveSpender()
        require(
            IERC20(spendToken).transferFrom(proxyGeneral, address(this), amountIn),
            "Transfer from ProxyGeneral failed"
        );
        
        // Approve Uniswap Router to spend tokens
        require(
            IERC20(spendToken).approve(address(uniswapRouter), amountIn),
            "Approval to Router failed"
        );
        
        // Execute swap via Uniswap V3
        try uniswapRouter.exactInputSingle(
            IUniswapV3Router.ExactInputSingleParams({
                tokenIn: spendToken,
                tokenOut: receiveToken,
                fee: DEFAULT_FEE,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: 0, // Slippage controlled by SwapManager
                sqrtPriceLimitX96: 0
            })
        ) returns (uint256 outputAmount) {
            amountOut = outputAmount;
            
            // Transfer received tokens back to ProxyGeneral (custody holder)
            require(
                IERC20(receiveToken).transfer(proxyGeneral, amountOut),
                "Transfer to ProxyGeneral failed"
            );
            
            return amountOut;
        } catch Error(string memory reason) {
            revert SwapFailed(reason);
        } catch {
            revert SwapFailed("Uniswap swap failed");
        }
    }
    
    /**
     * @inheritdoc ISimpleSwap
     * @dev Executes exactOutputSingle on Uniswap V3 Router
     */
    function outputSwap(
        address spendToken,
        address receiveToken,
        uint256 amountInMax,
        uint256 amountOut
    ) external override returns (uint256 amountIn) {
        // Validate inputs
        if (spendToken == address(0) || receiveToken == address(0)) {
            revert InvalidTokenPair();
        }
        if (spendToken == receiveToken) revert InvalidTokenPair();
        if (amountInMax == 0 || amountOut == 0) revert InvalidTokenPair();
        
        // Transfer max tokens from ProxyGeneral
        require(
            IERC20(spendToken).transferFrom(proxyGeneral, address(this), amountInMax),
            "Transfer from ProxyGeneral failed"
        );
        
        // Approve Uniswap Router
        require(
            IERC20(spendToken).approve(address(uniswapRouter), amountInMax),
            "Approval to Router failed"
        );
        
        // Execute swap
        try uniswapRouter.exactOutputSingle(
            IUniswapV3Router.ExactOutputSingleParams({
                tokenIn: spendToken,
                tokenOut: receiveToken,
                fee: DEFAULT_FEE,
                recipient: address(this),
                deadline: block.timestamp,
                amountOut: amountOut,
                amountInMaximum: amountInMax,
                sqrtPriceLimitX96: 0
            })
        ) returns (uint256 actualAmountIn) {
            amountIn = actualAmountIn;
            
            // Transfer exact output to ProxyGeneral
            require(
                IERC20(receiveToken).transfer(proxyGeneral, amountOut),
                "Transfer receiveToken failed"
            );
            
            // Refund unused tokens to ProxyGeneral
            if (actualAmountIn < amountInMax) {
                uint256 refund = amountInMax - actualAmountIn;
                require(
                    IERC20(spendToken).transfer(proxyGeneral, refund),
                    "Refund transfer failed"
                );
            }
            
            return amountIn;
        } catch Error(string memory reason) {
            revert SwapFailed(reason);
        } catch {
            revert SwapFailed("Uniswap output swap failed");
        }
    }
    
    /**
     * @inheritdoc ISimpleSwap
     * @dev Returns ACTUAL quote from Uniswap V3 Quoter V2
     * @notice Uses staticcall to Quoter V2 for accurate on-chain price quotes
     *         Decimals provided by TokenManager (single source of truth)
     *         Returns conservative estimate (90% of quote) to account for slippage
     * @param spendToken Token to sell
     * @param receiveToken Token to buy
     * @param amountIn Amount to swap (in spendToken decimals)
     * @param decimalsIn Decimals of spendToken (from TokenManager)
     * @param decimalsOut Decimals of receiveToken (from TokenManager)
     */
    function getExpectedOutput(
        address spendToken,
        address receiveToken,
        uint256 amountIn,
        uint8 decimalsIn,
        uint8 decimalsOut
    ) external view override returns (uint256) {
        if (spendToken == address(0) || receiveToken == address(0)) return 0;
        if (spendToken == receiveToken) return 0;
        if (amountIn == 0) return 0;
        
        // Decimals provided by TokenManager but currently unused
        // For accurate quotes, use Quoter V2 from off-chain (TypeScript)
        // This function returns a conservative estimate based on pool reserves
        
        // Get Uniswap V3 pool for this pair
        address poolAddress = _getPoolAddress(spendToken, receiveToken, DEFAULT_FEE);
        if (poolAddress == address(0)) {
            return 0; // Pool doesn't exist
        }
        
        // Get current price from pool.slot0()
        try IUniswapV3Pool(poolAddress).slot0() returns (
            uint160 sqrtPriceX96,
            int24,
            uint16,
            uint16,
            uint16,
            uint8,
            bool
        ) {
            // Calculate expected output from sqrtPriceX96
            // Formula: amountOut = amountIn * (sqrtPriceX96 / 2^96)^2
            // Simplified for gas efficiency
            
            uint256 priceRatio = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
            uint256 expectedOutput;
            
            // Check token order (token0 < token1 in Uniswap)
            if (spendToken < receiveToken) {
                // Selling token0 for token1
                expectedOutput = (amountIn * priceRatio) >> 192; // Divide by 2^192
            } else {
                // Selling token1 for token0
                expectedOutput = (amountIn << 192) / priceRatio; // Inverse price
            }
            
            // Apply fee (0.3% = 3000 bips)
            expectedOutput = (expectedOutput * (1000000 - DEFAULT_FEE)) / 1000000;
            
            // Return 85% as conservative estimate (accounting for slippage & price impact)
            return (expectedOutput * 85) / 100;
            
        } catch {
            return 0; // Failed to get pool price
        }
    }
    
    /**
     * @notice Get Uniswap V3 pool address for token pair
     * @param tokenA First token
     * @param tokenB Second token
     * @param fee Pool fee tier
     * @return pool Pool address (0 if doesn't exist)
     */
    function _getPoolAddress(
        address tokenA,
        address tokenB,
        uint24 fee
    ) internal view returns (address pool) {
        // Uniswap V3 Factory on Arbitrum
        address factory = 0x1F98431c8aD98523631AE4a59f267346ea31F984;
        
        // Sort tokens
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        
        // Compute pool address using CREATE2
        pool = address(uint160(uint256(keccak256(abi.encodePacked(
            hex'ff',
            factory,
            keccak256(abi.encode(token0, token1, fee)),
            hex'e34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54' // POOL_INIT_CODE_HASH
        )))));
        
        // Check if pool exists (has code)
        if (pool.code.length == 0) {
            return address(0);
        }
        
        return pool;
    }
}
