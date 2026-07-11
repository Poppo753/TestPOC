# 🎯 INTEGRATION: Plugin Factory + Three Separate Ecosystems

**Versione**: 1.1 (Corrected)  
**Data**: 13 Novembre 2025 (Updated)  
**Target**: Come Plugin Factory (swap modulari) si integra con i 3 ecosistemi separati (ETH/USDC/WBTC)  

---

## ⚠️ **CHIARIMENTO TERMINOLOGICO IMPORTANTE**

Questo documento usa il termine **"Strategy Pattern"** in modo confuso. In realtà **NON implementiamo il Strategy Pattern** (design pattern GoF con strategie intercambiabili).

**ARCHITETTURA REALE**:
- ✅ **TRE DEPLOYMENT SEPARATI**: LiquidityManager-ETH.sol, LiquidityManager-USDC.sol, LiquidityManager-WBTC.sol
- ✅ **Logica hardcoded** in ogni contratto per il proprio token base
- ❌ **NON strategie intercambiabili** registrate in Beacon

Quando leggi "ETHDepositStrategy", "USDCDepositStrategy" in questo documento, intendi:
- **Logiche di deposit diverse per token diversi**, hardcoded nei rispettivi LiquidityManager
- **NON contratti separati** che implementano IDepositStrategy e sono swappabili a runtime

---

## 📋 **OVERVIEW (Corrected)**

Questo documento spiega come **Plugin Factory System** (per swap routers) si integra con i **3 ecosistemi separati** (ETH, USDC, WBTC) in un'architettura basata su **Beacon**.

---

## 🏗️ **ARCHITETTURA UNIFICATA (Corrected)**

### **Beacon come Registry Centrale + 3 Ecosistemi Separati**

```
BEACON (Registry Unico per Plugin e Utility Condivisi)
│
├── CORE MODULES (Registrati quando deployed - 3 set separati!)
│   ├── LiquidityManager-ETH    → Contratto dedicato ETH con logica hardcoded
│   ├── LiquidityManager-USDC   → Contratto dedicato USDC con logica hardcoded
│   ├── LiquidityManager-WBTC   → Contratto dedicato WBTC con logica hardcoded
│   ├── ValueCalculator-ETH     → Calcoli per ETH (18 decimals)
│   ├── ValueCalculator-USDC    → Calcoli per USDC (6 decimals)
│   ├── ValueCalculator-WBTC    → Calcoli per WBTC (8 decimals)
│   ├── SwapManager             → Condiviso da tutti gli ecosistemi
│   ├── TokenManager-ETH/USDC/WBTC
│   ├── ParameterManager
│   └── EmergencyHandler
│
├── SWAP PLUGINS (Plugin Factory - Condivisi tra tutti gli ecosistemi!)
│   ├── UniswapV3Plugin     → Usato da tutti i LiquidityManager-*
│   ├── PendlePlugin        → Usato da tutti i LiquidityManager-*
│   ├── OdosPlugin          → Usato da tutti i LiquidityManager-*
│   └── 1inchPlugin         → Usato da tutti i LiquidityManager-*
│
└── UTILITIES (Helper modules - Condivisi)
    ├── OracleManager
    ├── FeeCalculator
    └── RebalanceBot

⚠️ NOTA: "STRATEGIES" CATEGORIA RIMOSSA dal Beacon!
Le logiche di deposit/withdraw per ETH/USDC/WBTC sono HARDCODED
nei rispettivi LiquidityManager-*.sol, NON sono contratti separati!

DEPLOYMENT STRUCTURE:
├── ETH Ecosystem: LiquidityManager-ETH.sol, ValueCalculator-ETH.sol, TokenManager-ETH.sol
├── USDC Ecosystem: LiquidityManager-USDC.sol, ValueCalculator-USDC.sol, TokenManager-USDC.sol
└── WBTC Ecosystem: LiquidityManager-WBTC.sol, ValueCalculator-WBTC.sol, TokenManager-WBTC.sol
```

---

## 🎯 **QUANDO SI USA COSA**

### **Plugin Factory (Swap Plugins)** 🔌

**Scopo**: Gestire **swap routers** (DEX) per operazioni di swap  
**Usato da**: SwapManager durante rebalancing  
**Chiamato da**: LiquidityManager-ETH/USDC/WBTC → SwapManager → Plugin  
**⚠️ Condivisi**: Tutti gli ecosistemi (ETH/USDC/WBTC) usano gli stessi plugin swap!

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

### **❌ "Strategy Pattern" (NAMING CONFUSO - Correzione)** 🎯

**⚠️ CORREZIONE**: Non usiamo Strategy Pattern con contratti intercambiabili!

**Architettura Reale**:
- **3 LiquidityManager separati**: LiquidityManager-ETH.sol, LiquidityManager-USDC.sol, LiquidityManager-WBTC.sol
- **Logica hardcoded** in ogni contratto per il proprio token base
- **Differenze**: Gestione decimals (ETH 18, USDC 6, WBTC 8), wrapping ETH, transfer logic

**Scopo**: Gestire **logiche diverse** per ETH/USDC/WBTC ecosystems  
**Implementazione**: Contratti separati con logica hardcoded, NON strategie intercambiabili  
**Chiamato da**: User deposits → LiquidityManager-ETH/USDC/WBTC (logica interna)

```solidity
// ⚠️ CODICE CORRETTO: NON deleghiamo a strategy, logica è INTERNA!

// ===== LiquidityManager-ETH.sol (contratto separato per ETH) =====
function deposit(uint256 amount) external payable {
    // Logica ETH HARDCODED in questo contratto:
    require(msg.value == amount, "Invalid ETH amount");
    
    // Wrap ETH → WETH (logica interna, non delegata)
    IWETH(WETH).deposit{value: amount}();
    
    // Calcola shares (18 decimals native)
    uint256 shares = _calculateShares(amount, 18);
    
    // Minta LP-ETH tokens
    _mint(msg.sender, shares);
}

// ===== LiquidityManager-USDC.sol (contratto separato per USDC) =====
function deposit(uint256 amount) external {
    // Logica USDC HARDCODED in questo contratto:
    // Transfer USDC from user
    IERC20(USDC).transferFrom(msg.sender, address(this), amount);
    
    // Scale 6 decimals → 18 decimals (logica interna)
    uint256 scaledAmount = amount * 10**12;
    
    // Calcola shares con scaling
    uint256 shares = _calculateShares(scaledAmount, 6);
    
    // Minta LP-USDC tokens
    _mint(msg.sender, shares);
}

// ⚠️ NON esiste IDepositStrategy interface con .execute()!
// Ogni LiquidityManager-*.sol ha la sua logica interna!
```

**Modularity Benefit (Corrected)**: Aggiungi DAI ecosystem → scrivi **LiquidityManager-DAI.sol** con logica hardcoded → deploy nuovo set contratti in 1-2 giorni

⚠️ Non scrivi "DAIDepositStrategy" come contratto separato - la logica deposit è interna a LiquidityManager-DAI.sol!

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

## 📊 **CONFRONTO: Plugin Factory vs Separate Ecosystems (Corrected)**

| Aspetto | Plugin Factory ✅ | Separate Ecosystems ✅ (NON Strategy Pattern!) |
|---------|------------------|------------------------------------------------|
| **Scopo** | Swap routers modulari | Logiche ecosystem separate per token diversi |
| **Usato per** | Scegliere DEX (Uniswap, Pendle, ecc.) | Gestire token diversi (ETH, USDC, WBTC) |
| **Implementazione** | Contratti plugin separati che implementano ISwapPlugin | **Contratti LiquidityManager-*.sol separati con logica hardcoded** |
| **Chiamato da** | SwapManager | User → direttamente il LiquidityManager-ETH/USDC/WBTC |
| **Quando** | Durante rebalancing/swap operations | Durante deposit/withdraw/value calc |
| **Modularity** | Aggiungi nuovi DEX come plugin | Deploy nuovo set contratti (LiquidityManager-DAI.sol, ecc.) |
| **Esempio** | UniswapV3Plugin, OdosPlugin | ~~ETHDepositStrategy~~, LiquidityManager-ETH.sol, LiquidityManager-USDC.sol |
| **Storage in Beacon** | Beacon (ModuleCategory.SWAP_PLUGIN) | ~~Beacon (ModuleCategory.STRATEGY)~~ Beacon (ModuleCategory.CORE) |
| **Condivisione** | Condivisi tra tutti gli ecosistemi | Ogni ecosistema ha i suoi contratti dedicati |
| **Runtime flexibility** | SwapManager sceglie miglior plugin a runtime | ❌ NO runtime change - deploy separati fissi |

---

## 🎯 **BENEFICI ARCHITETTURA UNIFICATA**

### **1. Beacon come Single Source of Truth (Corrected)**

```solidity
// ✅ REGISTRAZIONE CORRETTA nel Beacon

// Plugin swap (condivisi tra tutti gli ecosistemi)
beacon.registerModule("uniswap", uniswapPlugin, ModuleCategory.SWAP_PLUGIN, "1.0");
beacon.registerModule("pendle", pendlePlugin, ModuleCategory.SWAP_PLUGIN, "1.0");

// Moduli CORE di ogni ecosistema (deployment separati)
beacon.registerModule("LiquidityManager-ETH", liquidityManagerETH, ModuleCategory.CORE, "1.0");
beacon.registerModule("LiquidityManager-USDC", liquidityManagerUSDC, ModuleCategory.CORE, "1.0");
beacon.registerModule("LiquidityManager-WBTC", liquidityManagerWBTC, ModuleCategory.CORE, "1.0");

// ❌ NON registriamo "ETHDeposit", "USDCDeposit" come strategie!
// La logica deposit è interna ai rispettivi LiquidityManager-*.sol

// Query unificata
address uniswap = beacon.getModule("uniswap", ModuleCategory.SWAP_PLUGIN);
address lmETH = beacon.getModule("LiquidityManager-ETH", ModuleCategory.CORE);
// ❌ NON esiste: beacon.getModule("ETHDeposit", ModuleCategory.STRATEGY);
```

### **2. Upgrade Centralizzato (Corrected)**

```solidity
// ✅ Upgrade Uniswap plugin (condiviso tra tutti gli ecosistemi)
beacon.registerModule("uniswap", newUniswapPluginV2, ModuleCategory.SWAP_PLUGIN, "2.0");

// ✅ Upgrade LiquidityManager-ETH (contratto dedicato per ETH)
beacon.registerModule("LiquidityManager-ETH", newLiquidityManagerETHV2, ModuleCategory.CORE, "2.0");

// ❌ NON esiste "ETHDeposit" strategy separata!
// beacon.registerModule("ETHDeposit", newETHDepositStrategyV2, ModuleCategory.STRATEGY, "2.0");

// Tutto gestito in 1 posto (Beacon), ma logiche deposit sono hardcoded nei LiquidityManager!
```

### **3. Monitoring Unificato (Corrected)**

```typescript
// Get tutti i moduli di tutte le categorie
const coreModules = await beacon.getAllModules(ModuleCategory.CORE);
const swapPlugins = await beacon.getAllModules(ModuleCategory.SWAP_PLUGIN);
const utilities = await beacon.getAllModules(ModuleCategory.UTILITY);
// ❌ NON esiste: await beacon.getAllModules(ModuleCategory.STRATEGY);

// Monitoring dashboard mostra tutto insieme:
console.log("Core Modules (ETH/USDC/WBTC ecosystems):", coreModules.length);
console.log("Swap Plugins (shared):", swapPlugins.length);
console.log("Utilities (shared):", utilities.length);

// ⚠️ "Strategies" rimossa - logiche deposit/withdraw sono interne ai LiquidityManager-*.sol
```

---

## 🚀 **ROADMAP INTEGRATA (Corrected)**

### **Q1 2026: Foundation**
- ✅ Implementare Beacon con 3 categorie (CORE, SWAP_PLUGIN, UTILITY) - ~~STRATEGY rimossa~~
- ✅ Refactoring SwapManager per usare Beacon
- ~~✅ Refactoring LiquidityManager per Strategy Pattern~~ → Deploy contratti separati (LiquidityManager-ETH.sol, ecc.)
- 🔵 Deploy UniswapV3Plugin
- ~~🎯 Deploy ETHDepositStrategy, USDCDepositStrategy, WBTCDepositStrategy~~ → Deploy **LiquidityManager-ETH.sol, LiquidityManager-USDC.sol, LiquidityManager-WBTC.sol**

### **Q2 2026: Expansion**
- 🟣 Deploy PendlePlugin (yield tokens)
- ~~🎯 Deploy DAIDepositStrategy (4° ecosystem)~~ → Deploy **set completo contratti DAI** (LiquidityManager-DAI.sol, ValueCalculator-DAI.sol, ecc.)
- 📊 Monitoring e analytics unificati

### **Q3 2026: Advanced Features**
- 🟡 Deploy OdosPlugin (MEV protection)
- ~~🎯 Deploy USTDepositStrategy (5° ecosystem)~~ → Deploy **set completo contratti UST**
- ⚡ Ottimizzazioni gas cross-moduli

### **Q4 2026: Aggregation**
- 🔴 Deploy 1inchPlugin (multi-DEX aggregation)
- ~~🎯 Deploy FRAXDepositStrategy (6° ecosystem)~~ → Deploy **set completo contratti FRAX**
- 🤖 Rebalancing automatico bot

---

## 💡 **BEST PRACTICES**

### **1. Naming Convention (Corrected)**

```solidity
// Swap Plugins: [Protocol]Plugin
UniswapV3Plugin, PendlePlugin, OdosPlugin

// ❌ NON esiste: ETHDepositStrategy, USDCWithdrawStrategy come contratti separati!

// Core Modules: [Function]Manager-[Token] (contratti separati per ogni ecosystem)
LiquidityManager-ETH, LiquidityManager-USDC, LiquidityManager-WBTC
ValueCalculator-ETH, ValueCalculator-USDC, ValueCalculator-WBTC
TokenManager-ETH, TokenManager-USDC, TokenManager-WBTC

// Shared Modules: [Function]Manager (nessun suffisso token)
SwapManager, ParameterManager, EmergencyHandler
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

### **3. Query Pattern (Corrected)**

```solidity
// Query con categoria specifica
address plugin = beacon.getModule("uniswap", ModuleCategory.SWAP_PLUGIN);
address lmETH = beacon.getModule("LiquidityManager-ETH", ModuleCategory.CORE);
// ❌ NON esiste: beacon.getModule("ETHDeposit", ModuleCategory.STRATEGY);

// Get all per categoria
ModuleInfo[] memory plugins = beacon.getAllSwapPlugins();
ModuleInfo[] memory coreModules = beacon.getModulesByCategory(ModuleCategory.CORE);
// ❌ NON esiste: beacon.getAllStrategies();
```

---

## ✅ **SUMMARY (Corrected)**

### **Plugin Factory (Swap Plugins)** ✅
- 🎯 **Scopo**: Modulare swap routers (Uniswap, Pendle, Odos)
- 📍 **Dove**: Beacon → ModuleCategory.SWAP_PLUGIN
- 🔧 **Usato da**: SwapManager durante rebalancing
- 🌐 **Condivisione**: Condivisi tra TUTTI gli ecosistemi (ETH/USDC/WBTC)
- ⚡ **Benefit**: Aggiungi nuovi DEX senza modificare SwapManager

### **~~Strategy Pattern~~ Three Separate Ecosystems** ✅ (Corrected)
- 🎯 **Scopo**: ~~Modulare logiche per ecosystems diversi~~ → **Deployment separati per ogni token (ETH, USDC, WBTC)**
- 📍 **Dove**: ~~Beacon → ModuleCategory.STRATEGY~~ → **Beacon → ModuleCategory.CORE (LiquidityManager-ETH.sol, ecc.)**
- 🔧 **Implementazione**: ~~LiquidityManager delega a strategie~~ → **LiquidityManager-*.sol con logica hardcoded interna**
- ⚡ **Benefit**: Aggiungi nuovo ecosystem → **deploy nuovo set contratti** (LiquidityManager-DAI.sol, ValueCalculator-DAI.sol, ecc.)

### **Architettura Unificata (Corrected)**
- ✅ Beacon è l'unico registry
- ✅ Tutti i moduli (core + plugins + utilities) in 1 posto
- ~~✅ Tutti i moduli (core + plugins + strategies) in 1 posto~~ → **"strategies" rimossa, non esiste**
- ✅ Query unificate e semplificate
- ✅ Upgrade centralizzato
- ✅ Monitoring unificato
- ⚠️ **3 deployment separati** per ETH/USDC/WBTC, NON strategie intercambiabili!

---

## 📌 **NOTA FINALE: Perché la Confusione?**

Questo documento originalmente usava il termine **"Strategy Pattern"** in modo confuso:

| Termine Usato | Cosa Significa Realmente | Perché Confuso |
|---------------|--------------------------|----------------|
| "Strategy Pattern" | 3 deployment separati (ETH/USDC/WBTC) con logica hardcoded | Fa pensare al design pattern GoF con strategie intercambiabili |
| "ETHDepositStrategy" | Logica deposit in LiquidityManager-ETH.sol | Suona come contratto separato che implementa IDepositStrategy |
| "ModuleCategory.STRATEGY" | ~~Categoria Beacon per strategie~~ | Non serve - i 3 ecosistemi sono CORE modules, non strategies |

**ARCHITETTURA REALE**:
- ✅ Plugin Factory per swap: ISwapPlugin interface, contratti separati, runtime selection
- ✅ Tre Ecosistemi per token: LiquidityManager-*.sol, logica hardcoded, deployment separati
- ❌ Strategy Pattern per deposit/withdraw: NON implementato, era solo un'idea

---

**🔄 Ultimo Aggiornamento**: 13 Novembre 2025 (Corrected)  
**✍️ Autore**: Development Team  
**📋 Status**: Integration Documentation - Corrected v1.1 (Fixed Strategy Pattern Confusion)
