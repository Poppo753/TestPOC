# 🔄 LIQUIDITY MANAGER INTEGRATION

**Versione**: 1.0  
**Data**: 13 Novembre 2025  
**Target**: Integrazione SwapManager con LiquidityManager per rebalancing automatico  

---

## 📋 **INDICE**

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Implementation](#-implementation)
- [Usage Examples](#-usage-examples)
- [Security Considerations](#-security-considerations)

---

## 🎯 **OVERVIEW**

Questo documento descrive come **LiquidityManager** utilizza il sistema modulare di swap plugins per eseguire operazioni di rebalancing del pool.

### **Chi Può Chiamare SwapManager?**

⚠️ **IMPORTANTE**: Gli swap NON sono chiamati da utenti esterni random!

**Chiamanti Autorizzati:**
- ✅ **LiquidityManager** - Durante rebalancing automatico
- ✅ **RebalanceBot** - Bot automatizzato per rebalancing periodico (futuro)
- ✅ **EmergencyHandler** - In caso di emergenze (futuro)
- ❌ **Utenti esterni** - NON possono chiamare direttamente

### **Flusso di Autorizzazione:**

```
DEPLOYMENT:
1. Deploy SwapManager(beaconAddress)
2. swapManager.authorizeCaller(liquidityManagerAddress) ✅
3. swapManager.authorizeCaller(rebalanceBotAddress) ✅

RUNTIME:
- LiquidityManager → swapManager.swapWithBestPlugin() ✅ Authorized
- Random User → swapManager.swapWithBestPlugin() ❌ Reverts: "Caller not authorized"
```

---

## 🏗️ **ARCHITECTURE**

### **Componenti Coinvolti:**

```
OWNER
  ↓ calls rebalance()
  ↓
LIQUIDITY MANAGER (Caller autorizzato)
  ↓ calcola necessità swap
  ↓ calls swapManager.swapWithBestPlugin()
  ↓
SWAP MANAGER
  ↓ verifica autorizzazione
  ↓ query tutti i plugin dal Beacon
  ↓ seleziona plugin con miglior prezzo
  ↓
BEACON
  ↓ fornisce lista plugin attivi
  ↓
SWAP MANAGER
  ↓ esegue swap con miglior plugin
  ↓
UNISWAP / PENDLE / ODOS / 1INCH PLUGIN
  ↓ esegue swap specifico del protocollo
  ↓ ritorna tokens a LiquidityManager
  ↓
LIQUIDITY MANAGER
  ↓ riceve tokens swappati
  ↓ ridistribuisce assets nel pool
```

---

## 💻 **IMPLEMENTATION**

### **LiquidityManager - Rebalancing con Best Plugin Selection**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/ISwapManager.sol";
import "./interfaces/IBeacon.sol";

contract LiquidityManager {
    
    ISwapManager public immutable swapManager;
    IBeacon public immutable beacon;
    
    // Thresholds per rebalancing
    uint256 public constant REBALANCE_THRESHOLD = 500; // 5%
    uint256 public constant MIN_SWAP_AMOUNT = 0.01 ether;
    
    // Target allocation percentages (basis points)
    uint256 public constant TARGET_ETH_BPS = 5000;  // 50%
    uint256 public constant TARGET_USDC_BPS = 3000; // 30%
    uint256 public constant TARGET_WBTC_BPS = 2000; // 20%
    
    constructor(address _beacon, address _swapManager) {
        beacon = IBeacon(_beacon);
        swapManager = ISwapManager(_swapManager);
    }
    
    // ==================== REBALANCING FUNCTIONS ====================
    
    /**
     * @notice Esegue rebalancing automatico del pool
     * @dev Owner chiama questa funzione, SwapManager seleziona automaticamente miglior plugin
     */
    function rebalance() external onlyOwner {
        // 1. Calcola current allocation
        (uint256 ethValue, uint256 usdcValue, uint256 wbtcValue, uint256 totalValue) = 
            _calculateCurrentAllocation();
        
        // 2. Identifica asset in excess e asset in deficit
        (address excessAsset, uint256 excessAmount, address deficitAsset) = 
            _identifyRebalanceNeeds(ethValue, usdcValue, wbtcValue, totalValue);
        
        // Se non serve rebalancing, exit
        if (excessAmount < MIN_SWAP_AMOUNT) {
            emit RebalanceNotNeeded(totalValue);
            return;
        }
        
        // 3. Esegui swap automatico con miglior plugin
        uint256 receivedAmount = _executeRebalanceSwap(
            excessAsset, 
            deficitAsset, 
            excessAmount
        );
        
        emit Rebalanced(excessAsset, deficitAsset, excessAmount, receivedAmount);
    }
    
    /**
     * @notice Preview rebalancing senza eseguirlo
     * @return needsRebalance Se serve rebalancing
     * @return excessAsset Asset da vendere
     * @return excessAmount Quantità da vendere
     * @return deficitAsset Asset da comprare
     * @return expectedReceive Quantità attesa da ricevere
     * @return bestPlugin Plugin che offre miglior prezzo
     */
    function previewRebalance() 
        external 
        view 
        returns (
            bool needsRebalance,
            address excessAsset,
            uint256 excessAmount,
            address deficitAsset,
            uint256 expectedReceive,
            string memory bestPlugin
        ) 
    {
        // Calcola allocation corrente
        (uint256 ethValue, uint256 usdcValue, uint256 wbtcValue, uint256 totalValue) = 
            _calculateCurrentAllocation();
        
        // Identifica necessità
        (excessAsset, excessAmount, deficitAsset) = 
            _identifyRebalanceNeeds(ethValue, usdcValue, wbtcValue, totalValue);
        
        needsRebalance = excessAmount >= MIN_SWAP_AMOUNT;
        
        if (!needsRebalance) {
            return (false, address(0), 0, address(0), 0, "");
        }
        
        // Get best quote
        (bestPlugin, expectedReceive) = swapManager.getBestQuote(ISwapManager.QuoteParams({
            tokenIn: excessAsset,
            tokenOut: deficitAsset,
            amountIn: excessAmount,
            extraData: "0x"
        }));
    }
    
    /**
     * @notice Ottiene quotazioni da tutti i plugin disponibili
     */
    function getRebalanceQuotes(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (
        ISwapManager.Quote[] memory quotes,
        string[] memory pluginNames
    ) {
        return swapManager.getAllQuotes(ISwapManager.QuoteParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            extraData: "0x"
        }));
    }
    
    // ==================== INTERNAL FUNCTIONS ====================
    
    function _executeRebalanceSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal returns (uint256 amountOut) {
        
        // Calcola minimum output con slippage protection (2%)
        uint256 minAmountOut = _calculateMinOutput(tokenIn, tokenOut, amountIn, 200); // 2% slippage
        
        // Approva SwapManager a spendere tokens
        IERC20(tokenIn).approve(address(swapManager), amountIn);
        
        // Esegui swap - SwapManager seleziona automaticamente miglior plugin!
        amountOut = swapManager.swapWithBestPlugin(ISwapManager.SwapParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            minAmountOut: minAmountOut,
            recipient: address(this), // LiquidityManager riceve i tokens
            deadline: block.timestamp + 300, // 5 minuti
            extraData: "0x"
        }));
        
        // Verifica output ricevuto
        require(amountOut >= minAmountOut, "Slippage too high");
        
        return amountOut;
    }
    
    function _calculateCurrentAllocation() 
        internal 
        view 
        returns (
            uint256 ethValue, 
            uint256 usdcValue, 
            uint256 wbtcValue, 
            uint256 totalValue
        ) 
    {
        // Get balances
        uint256 ethBalance = IERC20(WETH).balanceOf(address(this));
        uint256 usdcBalance = IERC20(USDC).balanceOf(address(this));
        uint256 wbtcBalance = IERC20(WBTC).balanceOf(address(this));
        
        // Convert to USD values (usando oracle)
        ethValue = _convertToUSD(WETH, ethBalance);
        usdcValue = usdcBalance * 1e12; // USDC has 6 decimals, scale to 18
        wbtcValue = _convertToUSD(WBTC, wbtcBalance);
        
        totalValue = ethValue + usdcValue + wbtcValue;
    }
    
    function _identifyRebalanceNeeds(
        uint256 ethValue,
        uint256 usdcValue,
        uint256 wbtcValue,
        uint256 totalValue
    ) internal pure returns (
        address excessAsset,
        uint256 excessAmount,
        address deficitAsset
    ) {
        // Calculate current percentages
        uint256 currentEthBps = (ethValue * 10000) / totalValue;
        uint256 currentUsdcBps = (usdcValue * 10000) / totalValue;
        uint256 currentWbtcBps = (wbtcValue * 10000) / totalValue;
        
        // Find largest deviation
        int256 ethDeviation = int256(currentEthBps) - int256(TARGET_ETH_BPS);
        int256 usdcDeviation = int256(currentUsdcBps) - int256(TARGET_USDC_BPS);
        int256 wbtcDeviation = int256(currentWbtcBps) - int256(TARGET_WBTC_BPS);
        
        // Identify excess asset (positive deviation)
        if (ethDeviation > 0 && ethDeviation > usdcDeviation && ethDeviation > wbtcDeviation) {
            excessAsset = WETH;
            excessAmount = (ethValue * uint256(ethDeviation)) / 10000;
        } else if (usdcDeviation > 0 && usdcDeviation > wbtcDeviation) {
            excessAsset = USDC;
            excessAmount = (usdcValue * uint256(usdcDeviation)) / 10000;
        } else if (wbtcDeviation > 0) {
            excessAsset = WBTC;
            excessAmount = (wbtcValue * uint256(wbtcDeviation)) / 10000;
        }
        
        // Identify deficit asset (most negative deviation)
        if (ethDeviation < usdcDeviation && ethDeviation < wbtcDeviation) {
            deficitAsset = WETH;
        } else if (usdcDeviation < wbtcDeviation) {
            deficitAsset = USDC;
        } else {
            deficitAsset = WBTC;
        }
    }
    
    function _calculateMinOutput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 slippageBps
    ) internal view returns (uint256 minOutput) {
        // Get expected output from oracle or swap quote
        uint256 expectedOutput = _getExpectedOutput(tokenIn, tokenOut, amountIn);
        
        // Apply slippage tolerance
        minOutput = expectedOutput * (10000 - slippageBps) / 10000;
    }
    
    function _getExpectedOutput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256) {
        // Implementation: query Chainlink oracle or use SwapManager.getBestQuote()
        (, uint256 bestQuote) = swapManager.getBestQuote(ISwapManager.QuoteParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            extraData: "0x"
        }));
        
        return bestQuote;
    }
    
    function _convertToUSD(address token, uint256 amount) internal view returns (uint256) {
        // Implementation: use Chainlink price feed
        // For now, simplified
        return amount; // TODO: implement oracle integration
    }
    
    // ==================== EVENTS ====================
    
    event Rebalanced(
        address indexed tokenSold,
        address indexed tokenBought,
        uint256 amountSold,
        uint256 amountReceived
    );
    
    event RebalanceNotNeeded(uint256 totalValue);
}
```

---

## 📊 **USAGE EXAMPLES**

### **Esempio 1: Rebalancing Automatico**

```typescript
// Owner esegue rebalancing
const tx = await liquidityManager.rebalance();
await tx.wait();

// SwapManager automaticamente:
// 1. Query Uniswap V3: 10 ETH → 18,500 USDC
// 2. Query Pendle: 10 ETH → 18,300 USDC (yield token)
// 3. Query Odos: 10 ETH → 18,600 USDC (MEV protected)
// 4. Seleziona Odos (miglior prezzo!)
// 5. Esegue swap

console.log("✅ Rebalanced with best available price");
```

### **Esempio 2: Preview Prima di Rebalancing**

```typescript
// Owner visualizza preview senza eseguire
const preview = await liquidityManager.previewRebalance();

console.log("Needs rebalance:", preview.needsRebalance);
console.log("Sell:", preview.excessAmount, "of", preview.excessAsset);
console.log("Buy:", preview.deficitAsset);
console.log("Expected receive:", preview.expectedReceive);
console.log("Best plugin:", preview.bestPlugin); // "odos"

// Owner decide se procedere
if (preview.needsRebalance && preview.bestPlugin === "odos") {
    await liquidityManager.rebalance();
}
```

### **Esempio 3: Confronto Quote da Tutti i Plugin**

```typescript
// Owner confronta tutti i plugin disponibili
const { quotes, pluginNames } = await liquidityManager.getRebalanceQuotes(
    WETH_ADDRESS,
    USDC_ADDRESS,
    ethers.parseEther("10")
);

for (let i = 0; i < pluginNames.length; i++) {
    console.log(`${pluginNames[i]}: ${ethers.formatUnits(quotes[i].amountOut, 6)} USDC`);
}

// Output:
// uniswap: 18,500.00 USDC
// pendle: 18,300.00 USDC  
// odos: 18,600.00 USDC ← Best!
// 1inch: 18,550.00 USDC
```

### **Esempio 4: Setup Autorizzazioni Iniziali**

```typescript
// Durante deployment
const swapManager = await SwapManager.deploy(beacon.address);
const liquidityManager = await LiquidityManager.deploy(
    beacon.address, 
    swapManager.address
);

// Autorizza LiquidityManager a chiamare SwapManager
await swapManager.authorizeCaller(liquidityManager.address);
console.log("✅ LiquidityManager authorized");

// Autorizza anche bot rebalancing automatico (futuro)
const rebalanceBot = await RebalanceBot.deploy(liquidityManager.address);
await swapManager.authorizeCaller(rebalanceBot.address);
console.log("✅ RebalanceBot authorized");

// Verifica autorizzazioni
const isLMAuthorized = await swapManager.authorizedCallers(liquidityManager.address);
console.log("LiquidityManager authorized:", isLMAuthorized); // true

// Random user NON è autorizzato
const isUserAuthorized = await swapManager.authorizedCallers(userAddress);
console.log("Random user authorized:", isUserAuthorized); // false
```

---

## 🛡️ **SECURITY CONSIDERATIONS**

### **1. Authorization Security**

```solidity
// ✅ GOOD: Solo moduli autorizzati possono chiamare
modifier onlyAuthorized() {
    require(authorizedCallers[msg.sender], "Not authorized");
    _;
}

// ❌ BAD: Chiunque può chiamare
function swapViaPlugin(...) external { // No modifier!
    // Vulnerability: random users can drain funds
}
```

### **2. Slippage Protection**

```solidity
// ✅ GOOD: Calcola minAmountOut con slippage tolerance
uint256 minAmountOut = expectedOutput * (10000 - slippageBps) / 10000;

// Passa a swap
amountOut = swapManager.swapWithBestPlugin(SwapParams({
    ...
    minAmountOut: minAmountOut, // Protection!
    ...
}));

// ❌ BAD: No slippage protection
minAmountOut: 0 // Vulnerability: sandwich attacks!
```

### **3. Deadline Protection**

```solidity
// ✅ GOOD: Deadline ragionevole
deadline: block.timestamp + 300 // 5 minuti

// ❌ BAD: Deadline troppo lungo o assente
deadline: block.timestamp + 86400 // 24 ore - troppo!
deadline: type(uint256).max // Nessuna protezione
```

### **4. Reentrancy Protection**

```solidity
// ✅ GOOD: SwapManager usa nonReentrant
function swapWithBestPlugin(...) 
    external 
    onlyAuthorized 
    nonReentrant // Protection!
    returns (uint256) 
{
    // Safe from reentrancy
}
```

### **5. Token Approval Management**

```solidity
// ✅ GOOD: Approve exact amount needed
IERC20(tokenIn).approve(address(swapManager), amountIn);

// Dopo swap, revoca approval residua
IERC20(tokenIn).approve(address(swapManager), 0);

// ❌ BAD: Approve unlimited
IERC20(tokenIn).approve(address(swapManager), type(uint256).max);
```

---

## 🎯 **SUMMARY**

### **Chi Può Usare il Sistema?**
- ✅ **LiquidityManager** (autorizzato)
- ✅ **RebalanceBot** (autorizzato, futuro)
- ✅ **EmergencyHandler** (autorizzato, futuro)
- ❌ **Utenti esterni** (NON autorizzati)

### **Come Funziona la Selezione Plugin?**
1. Owner chiama `liquidityManager.rebalance()`
2. LiquidityManager calcola necessità swap
3. LiquidityManager chiama `swapManager.swapWithBestPlugin()`
4. SwapManager query **tutti i plugin** per quote
5. SwapManager seleziona **automaticamente** plugin con miglior prezzo
6. Swap eseguito con plugin ottimale

### **Vantaggi Approccio Automatico:**
- ✅ Sempre miglior prezzo disponibile
- ✅ Zero configurazione manuale
- ✅ Nuovi plugin funzionano immediatamente
- ✅ Owner non deve specificare plugin manualmente

---

**🔄 Ultimo Aggiornamento**: 13 Novembre 2025  
**✍️ Autore**: Development Team  
**📋 Status**: Architecture Documentation - Ready for Review
