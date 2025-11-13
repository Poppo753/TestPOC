# 🔵 UNISWAP V3 PLUGIN

**Versione**: 1.0  
**Data**: 3 Novembre 2025  
**Target**: Plugin per integrazione Uniswap V3 - Phase 1 Implementation  

---

## 📋 **INDICE**

- [Overview](#-overview)
- [Technical Specification](#-technical-specification)
- [Implementation Details](#-implementation-details)
- [Integration Requirements](#-integration-requirements)
- [Testing Strategy](#-testing-strategy)

---

## 🎯 **OVERVIEW**

Il **UniswapV3Plugin** è il primo plugin da implementare nell'architettura modulare, focalizzato su:
- ✅ Token ERC20 standard (WETH, USDC, WBTC, ecc.)
- ✅ Single-hop swaps ottimizzati
- ✅ Liquidity concentration benefits
- ✅ Multiple fee tiers (0.01%, 0.05%, 0.3%, 1%)

### **Features Target Phase 1**:
- 🔵 Basic ERC20 ↔ ERC20 swaps
- 🔵 Automatic fee tier selection
- 🔵 Price impact calculation  
- 🔵 Slippage protection
- 🔵 Gas optimization

### **Features Future Phases**:
- 🔄 Multi-hop routing (Phase 2)
- 📊 Advanced price oracles (Phase 2)
- ⚡ Flash swaps (Phase 3)
- 🎯 Limit orders (Phase 4)

---

## 🔧 **TECHNICAL SPECIFICATION**

### **Contract Structure**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/ISwapPlugin.sol";
import "./base/BaseSwapPlugin.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

/**
 * @title UniswapV3Plugin
 * @dev Plugin per swaps tramite Uniswap V3
 * @custom:version 1.0
 * @custom:phase 1
 */
contract UniswapV3Plugin is BaseSwapPlugin {
    
    // ==================== CONSTANTS ====================
    
    /// @dev Uniswap V3 SwapRouter address (Arbitrum)
    address public constant UNISWAP_V3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    
    /// @dev Uniswap V3 Factory address (Arbitrum) 
    address public constant UNISWAP_V3_FACTORY = 0x1F98431c8aD98523631AE4a59f267346ea31F984;
    
    /// @dev Fee tiers supportati da Uniswap V3
    uint24[4] public FEE_TIERS = [100, 500, 3000, 10000]; // 0.01%, 0.05%, 0.3%, 1%
    
    /// @dev Maximum slippage permesso (500 = 5%)
    uint256 public constant MAX_SLIPPAGE_BPS = 500;
    
    // ==================== STATE VARIABLES ====================
    
    ISwapRouter private immutable swapRouter;
    IUniswapV3Factory private immutable factory;
    
    /// @dev Cache per pool addresses (tokenA, tokenB, fee) → pool
    mapping(bytes32 => address) private poolCache;
    
    /// @dev Fee tier preferito per ogni coppia
    mapping(bytes32 => uint24) private preferredFeeTier;
    
    // ==================== CONSTRUCTOR ====================
    
    constructor(address _swapManager) 
        BaseSwapPlugin(_swapManager, "UniswapV3", "1.0.0") 
    {
        swapRouter = ISwapRouter(UNISWAP_V3_ROUTER);
        factory = IUniswapV3Factory(UNISWAP_V3_FACTORY);
    }
    
    // ==================== CORE PLUGIN FUNCTIONS ====================
    
    /**
     * @inheritdoc ISwapPlugin
     */
    function swap(SwapParams calldata params) 
        external 
        override 
        onlySwapManager 
        trackGas("swap")
        returns (uint256 amountOut) 
    {
        _validateSwapParams(params);
        
        // Find best pool for this swap
        (address pool, uint24 fee) = _findBestPool(params.tokenIn, params.tokenOut, params.amountIn);
        require(pool != address(0), "UniswapV3: No suitable pool found");
        
        // Setup swap parameters
        ISwapRouter.ExactInputSingleParams memory swapParams = ISwapRouter.ExactInputSingleParams({
            tokenIn: params.tokenIn,
            tokenOut: params.tokenOut,
            fee: fee,
            recipient: address(this), // Plugin riceve temporaneamente
            deadline: params.deadline,
            amountIn: params.amountIn,
            amountOutMinimum: params.minAmountOut,
            sqrtPriceLimitX96: 0 // No price limit
        });
        
        // Approve router to spend tokens
        IERC20(params.tokenIn).approve(UNISWAP_V3_ROUTER, params.amountIn);
        
        // Execute swap
        amountOut = swapRouter.exactInputSingle(swapParams);
        
        // Transfer result back to SwapManager
        IERC20(params.tokenOut).transfer(swapManager, amountOut);
        
        // Update preferred fee tier cache
        bytes32 pairKey = _getPairKey(params.tokenIn, params.tokenOut);
        preferredFeeTier[pairKey] = fee;
        
        emit SwapExecuted(params.tokenIn, params.tokenOut, params.amountIn, amountOut, fee);
    }
    
    /**
     * @inheritdoc ISwapPlugin
     */
    function getQuote(QuoteParams calldata params) 
        external 
        view 
        override 
        returns (Quote memory quote) 
    {
        if (!supportsTokenPair(params.tokenIn, params.tokenOut)) {
            return Quote({
                amountOut: 0,
                slippageBps: 0,
                gasEstimate: 0,
                priceImpact: 0,
                isValid: false,
                reason: "Token pair not supported"
            });
        }
        
        // Try all fee tiers and find best quote
        uint256 bestAmountOut = 0;
        uint24 bestFee = 0;
        
        for (uint256 i = 0; i < FEE_TIERS.length; i++) {
            uint24 fee = FEE_TIERS[i];
            address pool = _getPool(params.tokenIn, params.tokenOut, fee);
            
            if (pool != address(0)) {
                try this._getQuoteFromPool(pool, params.tokenIn, params.tokenOut, params.amountIn) 
                    returns (uint256 amountOut) {
                    if (amountOut > bestAmountOut) {
                        bestAmountOut = amountOut;
                        bestFee = fee;
                    }
                } catch {
                    // Pool exists but quote failed, skip
                    continue;
                }
            }
        }
        
        if (bestAmountOut == 0) {
            return Quote({
                amountOut: 0,
                slippageBps: 0,
                gasEstimate: 0,
                priceImpact: 0,
                isValid: false,
                reason: "No liquidity available"
            });
        }
        
        // Calculate price impact and slippage
        uint256 priceImpact = _calculatePriceImpact(params.tokenIn, params.tokenOut, params.amountIn, bestAmountOut);
        uint256 slippage = _estimateSlippage(bestFee, priceImpact);
        
        return Quote({
            amountOut: bestAmountOut,
            slippageBps: slippage,
            gasEstimate: _estimateGasCost(bestFee),
            priceImpact: priceImpact,
            isValid: true,
            reason: ""
        });
    }
    
    /**
     * @inheritdoc ISwapPlugin
     */
    function getProtocolInfo() external pure override returns (ProtocolInfo memory) {
        return ProtocolInfo({
            name: "UniswapV3",
            version: "1.0.0",
            features: ProtocolFeatures.BASIC_SWAP,
            router: UNISWAP_V3_ROUTER,
            deployedAt: 18515494 // Arbitrum deployment block
        });
    }
    
    /**
     * @inheritdoc ISwapPlugin
     */
    function supportsTokenPair(address tokenA, address tokenB) 
        public 
        view 
        override 
        returns (bool supported) 
    {
        // Check if any fee tier has a pool for this pair
        for (uint256 i = 0; i < FEE_TIERS.length; i++) {
            if (_getPool(tokenA, tokenB, FEE_TIERS[i]) != address(0)) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @inheritdoc ISwapPlugin
     */
    function getRouterAddress() external pure override returns (address) {
        return UNISWAP_V3_ROUTER;
    }
    
    /**
     * @inheritdoc ISwapPlugin
     */
    function isHealthy() external view override returns (bool healthy, string memory reason) {
        // Check if router is responding
        try factory.owner() returns (address) {
            return (true, "");
        } catch {
            return (false, "Factory not responding");
        }
    }
    
    // ==================== INTERNAL FUNCTIONS ====================
    
    /**
     * @dev Trova il miglior pool per uno swap
     */
    function _findBestPool(address tokenIn, address tokenOut, uint256 amountIn) 
        internal 
        view 
        returns (address bestPool, uint24 bestFee) 
    {
        uint256 bestLiquidity = 0;
        
        // Check preferred fee tier first
        bytes32 pairKey = _getPairKey(tokenIn, tokenOut);
        uint24 preferred = preferredFeeTier[pairKey];
        
        if (preferred != 0) {
            address preferredPool = _getPool(tokenIn, tokenOut, preferred);
            if (preferredPool != address(0)) {
                uint256 liquidity = _getPoolLiquidity(preferredPool);
                if (liquidity > 0) {
                    return (preferredPool, preferred);
                }
            }
        }
        
        // Try all fee tiers
        for (uint256 i = 0; i < FEE_TIERS.length; i++) {
            uint24 fee = FEE_TIERS[i];
            address pool = _getPool(tokenIn, tokenOut, fee);
            
            if (pool != address(0)) {
                uint256 liquidity = _getPoolLiquidity(pool);
                if (liquidity > bestLiquidity) {
                    bestLiquidity = liquidity;
                    bestPool = pool;
                    bestFee = fee;
                }
            }
        }
    }
    
    /**
     * @dev Ottiene indirizzo pool con caching
     */
    function _getPool(address tokenA, address tokenB, uint24 fee) 
        internal 
        view 
        returns (address pool) 
    {
        bytes32 key = keccak256(abi.encode(tokenA, tokenB, fee));
        pool = poolCache[key];
        
        if (pool == address(0)) {
            pool = factory.getPool(tokenA, tokenB, fee);
            // Note: non possiamo aggiornare cache in view function
        }
        
        return pool;
    }
    
    /**
     * @dev Calcola liquidità disponibile in un pool
     */
    function _getPoolLiquidity(address pool) internal view returns (uint256 liquidity) {
        try IUniswapV3Pool(pool).liquidity() returns (uint128 poolLiquidity) {
            return uint256(poolLiquidity);
        } catch {
            return 0;
        }
    }
    
    /**
     * @dev Quote da un pool specifico (external per try/catch)
     */
    function _getQuoteFromPool(
        address pool, 
        address tokenIn, 
        address tokenOut, 
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        require(msg.sender == address(this), "Internal only");
        
        // Implementazione semplificata - in produzione useremo quoter contract
        // Per ora calcoliamo basandoci su price del pool
        
        (uint160 sqrtPriceX96,,,,,,) = IUniswapV3Pool(pool).slot0();
        
        // Convert sqrt price to normal price
        uint256 price = _sqrtPriceX96ToPrice(sqrtPriceX96, tokenIn, tokenOut);
        
        return (amountIn * price) / 1e18;
    }
    
    /**
     * @dev Converte sqrt price in prezzo normale
     */
    function _sqrtPriceX96ToPrice(
        uint160 sqrtPriceX96, 
        address token0, 
        address token1
    ) internal pure returns (uint256 price) {
        // Implementazione semplificata
        uint256 numerator1 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
        uint256 numerator2 = 1 << 192;
        return (numerator1 * 1e18) / numerator2;
    }
    
    /**
     * @dev Calcola price impact
     */
    function _calculatePriceImpact(
        address tokenIn,
        address tokenOut, 
        uint256 amountIn,
        uint256 amountOut
    ) internal view returns (uint256 priceImpact) {
        // Implementazione semplificata - confronta con spot price
        // In produzione useremo calcolo più sofisticato
        return 50; // 0.5% default per ora
    }
    
    /**
     * @dev Stima slippage basato su fee tier
     */
    function _estimateSlippage(uint24 fee, uint256 priceImpact) 
        internal 
        pure 
        returns (uint256 slippage) 
    {
        // Fee più alta = liquidità più scarsa = slippage maggiore
        uint256 baseFee = fee / 100; // Convert to bps
        return baseFee + priceImpact;
    }
    
    /**
     * @dev Stima costo gas
     */
    function _estimateGasCost(uint24 fee) internal pure returns (uint256 gasEstimate) {
        // Gas cost varies by fee tier complexity
        if (fee == 100) return 150000;      // 0.01% - più complesso
        if (fee == 500) return 140000;      // 0.05% - standard
        if (fee == 3000) return 130000;     // 0.3% - più liquido
        if (fee == 10000) return 135000;    // 1% - meno liquido
        return 140000; // default
    }
    
    /**
     * @dev Genera chiave per coppia token
     */
    function _getPairKey(address tokenA, address tokenB) 
        internal 
        pure 
        returns (bytes32) 
    {
        return tokenA < tokenB 
            ? keccak256(abi.encode(tokenA, tokenB))
            : keccak256(abi.encode(tokenB, tokenA));
    }
    
    // ==================== EVENTS ====================
    
    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint24 fee
    );
    
    event PoolCacheUpdated(
        address indexed tokenA,
        address indexed tokenB,
        uint24 fee,
        address pool
    );
}
```

---

## 📊 **INTEGRATION REQUIREMENTS**

### **Dependencies**
```json
{
  "dependencies": {
    "@uniswap/v3-core": "^1.0.1",
    "@uniswap/v3-periphery": "^1.4.3",
    "@openzeppelin/contracts": "^4.9.0"
  }
}
```

### **Network Configuration**
```typescript
// Arbitrum One addresses
export const UNISWAP_V3_CONFIG = {
  FACTORY: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  ROUTER: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  QUOTER: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
  NONFUNGIBLE_POSITION_MANAGER: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"
};

// Supported tokens (Phase 1)
export const SUPPORTED_TOKENS = {
  WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  USDC: "0xA0b86a33E6441b8893b8a49C00bB25cA62b8Be4A", 
  USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
  ARB: "0x912CE59144191C1204E64559FE8253a0e49E6548"
};
```

### **Deployment Steps**
```typescript
// 1. Deploy plugin
const uniswapPlugin = await UniswapV3Plugin.deploy(swapManager.address);

// 2. Register in PluginRegistry  
await pluginRegistry.authorizeImplementation(uniswapPlugin.address);
await pluginRegistry.registerPlugin("uniswap", uniswapPlugin.address, "1.0.0");

// 3. Enable in SwapManager
await swapManager.enablePlugin("uniswap", true);

// 4. Verify integration
const quote = await swapManager.getQuote("uniswap", quoteParams);
console.log("Integration successful:", quote.isValid);
```

---

## 🧪 **TESTING STRATEGY**

### **Unit Tests**
```typescript
describe("UniswapV3Plugin", () => {
  describe("Basic Functionality", () => {
    it("should swap WETH for USDC");
    it("should return accurate quotes"); 
    it("should handle slippage correctly");
    it("should revert on insufficient liquidity");
  });
  
  describe("Fee Tier Selection", () => {
    it("should select optimal fee tier");
    it("should cache preferred fee tiers");
    it("should fallback to other tiers if preferred unavailable");
  });
  
  describe("Gas Optimization", () => {
    it("should stay within gas limits");
    it("should estimate gas accurately");
    it("should cache pool addresses");
  });
});
```

### **Integration Tests**
```typescript
describe("UniswapV3Plugin Integration", () => {
  it("should integrate with SwapManager");
  it("should handle real Arbitrum tokens");
  it("should work with actual liquidity");
  it("should perform better than SimpleSwap");
});
```

### **Performance Benchmarks**
```typescript
describe("Performance Benchmarks", () => {
  it("should execute swaps in <200k gas");
  it("should provide quotes in <50k gas");
  it("should cache frequently used pools");
  it("should beat SimpleSwap by 5%+ on execution price");
});
```

---

**🔄 Ultimo Aggiornamento**: 3 Novembre 2025  
**✍️ Autore**: Development Team  
**📋 Status**: Phase 1 Specification Ready for Implementation