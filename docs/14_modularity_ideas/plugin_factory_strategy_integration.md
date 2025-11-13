# 🎯 INTEGRATION: Plugin Factory + Strategy Pattern

**Versione**: 1.0  
**Data**: 13 Novembre 2025  
**Target**: Come i due sistemi di modularità si integrano insieme  

---

## 📋 **OVERVIEW**

Questo documento spiega come **Plugin Factory System** (per swap routers) e **Strategy Pattern** (per deposit/withdraw/value logic) lavorano insieme in un'architettura unificata basata su **Beacon**.

---

## 🏗️ **ARCHITETTURA UNIFICATA**

### **Beacon come Registry Centrale per TUTTO**

```
BEACON (Registry Unico)
│
├── CORE MODULES (Moduli principali)
│   ├── LiquidityManager    → Usa Strategy Pattern
│   ├── ValueCalculator      → Usa Strategy Pattern
│   ├── SwapManager         → Usa Plugin Factory
│   ├── TokenManager
│   ├── ParameterManager
│   └── EmergencyHandler
│
├── SWAP PLUGINS (Plugin Factory)
│   ├── UniswapV3Plugin     → Per swap durante rebalancing
│   ├── PendlePlugin        → Per yield token swaps
│   ├── OdosPlugin          → Per MEV-protected swaps
│   └── 1inchPlugin         → Per aggregated swaps
│
├── STRATEGIES (Strategy Pattern)
│   ├── ETHDepositStrategy    → Per ETH ecosystem
│   ├── USDCDepositStrategy   → Per USDC ecosystem
│   ├── WBTCDepositStrategy   → Per WBTC ecosystem
│   ├── ETHValueStrategy
│   ├── USDCValueStrategy
│   └── WBTCValueStrategy
│
└── UTILITIES (Helper modules)
    ├── OracleManager
    ├── FeeCalculator
    └── RebalanceBot
```

---

## 🎯 **QUANDO SI USA COSA**

### **Plugin Factory (Swap Plugins)** 🔌

**Scopo**: Gestire **swap routers** (DEX) per operazioni di swap  
**Usato da**: SwapManager durante rebalancing  
**Chiamato da**: LiquidityManager → SwapManager → Plugin

```solidity
// LiquidityManager ha excess ETH, vuole swappare in USDC
function rebalance() external onlyOwner {
    // 1. Calcola quanto swappare
    uint256 excessETH = calculateExcess();
    
    // 2. SwapManager trova miglior plugin automaticamente
    uint256 usdcReceived = swapManager.swapWithBestPlugin(SwapParams({
        tokenIn: WETH,
        tokenOut: USDC,
        amountIn: excessETH,
        ...
    }));
    // SwapManager query: Uniswap, Pendle, Odos, 1inch
    // → Sceglie Odos (miglior prezzo)
    
    // 3. Ridistribuisce assets
    _redistributeAssets(usdcReceived);
}
```

**Modularity Benefit**: Aggiungi Uniswap V4 → deploy plugin → funziona immediatamente

---

### **Strategy Pattern (Deposit/Withdraw/Value Strategies)** 🎯

**Scopo**: Gestire **logiche diverse** per ETH/USDC/WBTC ecosystems  
**Usato da**: LiquidityManager, ValueCalculator  
**Chiamato da**: User deposits → LiquidityManager → DepositStrategy

```solidity
// User deposita in ETH ecosystem
function deposit(uint256 amount) external payable {
    // LiquidityManager delega a ETHDepositStrategy
    uint256 shares = depositStrategy.execute(amount, msg.sender);
    // ETHDepositStrategy:
    // - Wrap ETH → WETH
    // - Calcola shares (18 decimals native)
    // - Minta LP tokens
}

// User deposita in USDC ecosystem
function deposit(uint256 amount) external {
    // LiquidityManager delega a USDCDepositStrategy
    uint256 shares = depositStrategy.execute(amount, msg.sender);
    // USDCDepositStrategy:
    // - Transfer USDC from user
    // - Scale 6 decimals → 18 decimals
    // - Calcola shares con scaling
    // - Minta LP tokens
}
```

**Modularity Benefit**: Aggiungi DAI ecosystem → scrivi DAIDepositStrategy → deploy in 1-2 giorni

---

## 🔗 **COME SI INTEGRANO**

### **Scenario Completo: Deposit → Rebalance → Withdraw**

```
USER deposita 100 USDC in USDC Pool
  ↓
LIQUIDITY MANAGER (USDC ecosystem)
  ↓ usa STRATEGY PATTERN
  ↓
USDC DEPOSIT STRATEGY
  ↓ gestisce 6 decimals
  ↓ minta LP-USDC tokens
  ↓
User riceve LP-USDC
  
  ⏱️ [TEMPO PASSA]
  
OWNER chiama rebalance()
  ↓
LIQUIDITY MANAGER
  ↓ calcola: "Troppo USDC, poco WBTC"
  ↓ usa PLUGIN FACTORY
  ↓
SWAP MANAGER
  ↓ query tutti i plugin dal Beacon
  ↓ Uniswap: 100 USDC → 0.0052 WBTC
  ↓ Pendle:  100 USDC → 0.0051 WBTC
  ↓ Odos:    100 USDC → 0.0053 WBTC ← BEST!
  ↓ seleziona Odos automaticamente
  ↓
ODOS PLUGIN
  ↓ esegue swap MEV-protected
  ↓ ritorna 0.0053 WBTC
  ↓
LIQUIDITY MANAGER
  ↓ ridistribuisce assets nel pool
  
  ⏱️ [TEMPO PASSA]
  
USER chiama withdraw(LP-USDC)
  ↓
LIQUIDITY MANAGER (USDC ecosystem)
  ↓ usa STRATEGY PATTERN
  ↓
USDC WITHDRAW STRATEGY
  ↓ calcola USDC da restituire
  ↓ scala 18 decimals → 6 decimals
  ↓ trasferisce USDC a user
  ↓
User riceve USDC
```

---

## 📊 **CONFRONTO: Plugin Factory vs Strategy Pattern**

| Aspetto | Plugin Factory | Strategy Pattern |
|---------|---------------|------------------|
| **Scopo** | Swap routers modulari | Logiche ecosystem modulari |
| **Usato per** | Scegliere DEX (Uniswap, Pendle, ecc.) | Gestire token diversi (ETH, USDC, WBTC) |
| **Chiamato da** | SwapManager | LiquidityManager, ValueCalculator |
| **Quando** | Durante rebalancing | Durante deposit/withdraw/value calc |
| **Modularity** | Aggiungi nuovi DEX | Aggiungi nuovi token ecosystems |
| **Esempio** | UniswapV3Plugin, OdosPlugin | ETHDepositStrategy, USDCDepositStrategy |
| **Storage** | Beacon (ModuleCategory.SWAP_PLUGIN) | Beacon (ModuleCategory.STRATEGY) |
| **Cambio** | SwapManager sceglie miglior plugin | Owner setta strategy per ecosystem |

---

## 🎯 **BENEFICI ARCHITETTURA UNIFICATA**

### **1. Beacon come Single Source of Truth**

```solidity
// Tutto registrato nel Beacon
beacon.registerModule("uniswap", uniswapPlugin, ModuleCategory.SWAP_PLUGIN, "1.0");
beacon.registerModule("ETHDeposit", ethDepositStrategy, ModuleCategory.STRATEGY, "1.0");
beacon.registerModule("LiquidityManager", liquidityManager, ModuleCategory.CORE, "1.0");

// Query unificata
address uniswap = beacon.getModule("uniswap", ModuleCategory.SWAP_PLUGIN);
address ethDeposit = beacon.getModule("ETHDeposit", ModuleCategory.STRATEGY);
```

### **2. Upgrade Centralizzato**

```solidity
// Upgrade Uniswap plugin
beacon.registerModule("uniswap", newUniswapPluginV2, ModuleCategory.SWAP_PLUGIN, "2.0");

// Upgrade ETH deposit strategy
beacon.registerModule("ETHDeposit", newETHDepositStrategyV2, ModuleCategory.STRATEGY, "2.0");

// Tutto gestito in 1 posto!
```

### **3. Monitoring Unificato**

```typescript
// Get tutti i moduli di tutte le categorie
const coreModules = await beacon.getAllModules(ModuleCategory.CORE);
const swapPlugins = await beacon.getAllModules(ModuleCategory.SWAP_PLUGIN);
const strategies = await beacon.getAllModules(ModuleCategory.STRATEGY);

// Monitoring dashboard mostra tutto insieme:
console.log("Core Modules:", coreModules.length);
console.log("Swap Plugins:", swapPlugins.length);
console.log("Strategies:", strategies.length);
```

---

## 🚀 **ROADMAP INTEGRATA**

### **Q1 2026: Foundation**
- ✅ Implementare Beacon con 4 categorie (CORE, SWAP_PLUGIN, STRATEGY, UTILITY)
- ✅ Refactoring SwapManager per usare Beacon
- ✅ Refactoring LiquidityManager per Strategy Pattern
- 🔵 Deploy UniswapV3Plugin
- 🎯 Deploy ETHDepositStrategy, USDCDepositStrategy, WBTCDepositStrategy

### **Q2 2026: Expansion**
- 🟣 Deploy PendlePlugin (yield tokens)
- 🎯 Deploy DAIDepositStrategy (4° ecosystem)
- 📊 Monitoring e analytics unificati

### **Q3 2026: Advanced Features**
- 🟡 Deploy OdosPlugin (MEV protection)
- 🎯 Deploy USTDepositStrategy (5° ecosystem)
- ⚡ Ottimizzazioni gas cross-moduli

### **Q4 2026: Aggregation**
- 🔴 Deploy 1inchPlugin (multi-DEX aggregation)
- 🎯 Deploy FRAXDepositStrategy (6° ecosystem)
- 🤖 Rebalancing automatico bot

---

## 💡 **BEST PRACTICES**

### **1. Naming Convention**

```solidity
// Swap Plugins: [Protocol]Plugin
UniswapV3Plugin, PendlePlugin, OdosPlugin

// Strategies: [Token][Action]Strategy
ETHDepositStrategy, USDCWithdrawStrategy, WBTCValueStrategy

// Core Modules: [Function]Manager
LiquidityManager, SwapManager, TokenManager
```

### **2. Registration Pattern**

```solidity
// Deploy
const plugin = await UniswapV3Plugin.deploy(swapManager.address);

// Register nel Beacon con categoria corretta
await beacon.registerModule(
    "uniswap",                          // nome
    plugin.address,                      // implementation
    Beacon.ModuleCategory.SWAP_PLUGIN,   // categoria corretta!
    "1.0.0"                             // versione
);
```

### **3. Query Pattern**

```solidity
// Query con categoria specifica
address plugin = beacon.getModule("uniswap", ModuleCategory.SWAP_PLUGIN);
address strategy = beacon.getModule("ETHDeposit", ModuleCategory.STRATEGY);

// Get all per categoria
ModuleInfo[] memory plugins = beacon.getAllSwapPlugins();
ModuleInfo[] memory strategies = beacon.getAllStrategies(); // TODO: add helper
```

---

## ✅ **SUMMARY**

### **Plugin Factory (Swap Plugins)**
- 🎯 **Scopo**: Modulare swap routers (Uniswap, Pendle, Odos)
- 📍 **Dove**: Beacon → ModuleCategory.SWAP_PLUGIN
- 🔧 **Usato da**: SwapManager durante rebalancing
- ⚡ **Benefit**: Aggiungi nuovi DEX senza modificare SwapManager

### **Strategy Pattern**
- 🎯 **Scopo**: Modulare logiche per ecosystems diversi (ETH, USDC, WBTC)
- 📍 **Dove**: Beacon → ModuleCategory.STRATEGY
- 🔧 **Usato da**: LiquidityManager, ValueCalculator durante deposit/withdraw
- ⚡ **Benefit**: Aggiungi nuovi token ecosystems in 1-2 giorni

### **Architettura Unificata**
- ✅ Beacon è l'unico registry
- ✅ Tutti i moduli (core + plugins + strategies) in 1 posto
- ✅ Query unificate e semplificate
- ✅ Upgrade centralizzato
- ✅ Monitoring unificato

---

**🔄 Ultimo Aggiornamento**: 13 Novembre 2025  
**✍️ Autore**: Development Team  
**📋 Status**: Integration Documentation Complete
