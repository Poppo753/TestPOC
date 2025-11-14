# 📋 PIANO STRATEGICO - SWAP MODULARITY EXTENSION

**Ruolo**: AI Senior Engineer / Technical Architect  
**Data**: 14 Novembre 2025  
**Documento Base**: SWAP_MODULARITY_REVISED.md v3.0

---

## 🔍 ANALISI

### **Contesto**

Il sistema DeFi esistente presenta:

1. **Architettura Attuale (FUNZIONANTE)**:
   - 3 ecosistemi separati: LiquidityManager-ETH/USDC/WBTC
   - SwapManager condiviso tra tutti gli ecosistemi
   - Sistema **GIÀ modulare**: SwapManager delega swap a `ISimpleSwap` interface
   - SimpleSwap deployed (0xa0DB78167CBAccD47524a261b7741C6B41Bbd096) = wrapper Uniswap V3
   - Authorization robusta: solo LiquidityManager autorizzati

2. **Limitazione Identificata**:
   - Mono-plugin: solo 1 DEX supportato (hardcoded `simpleSwapRouter` address)
   - Nessuna price competition tra DEX
   - Cambiamento DEX richiede intervento owner manuale

3. **Obiettivo Refactor**:
   - Estendere da mono-plugin a multi-plugin
   - Best price selection automatica
   - Plugin registration via Beacon (già esistente)
   - **NON rebuild from scratch**: modifiche incrementali

---

### **Vincoli / Requisiti**

#### **Vincoli Tecnici**

1. **Backward Compatibility (CRITICO)**:
   - Sistema esistente DEVE continuare a funzionare durante migration
   - Zero downtime requirement
   - LiquidityManager NON deve essere modificato
   - ISimpleSwap interface DEVE rimanere invariata

2. **Security (CRITICO)**:
   - Authorization system DEVE rimanere invariato
   - Solo LiquidityManager-ETH/USDC/WBTC autorizzati a chiamare SwapManager
   - Nessun accesso utenti esterni
   - Reentrancy protection DEVE essere mantenuta

3. **Gas Efficiency**:
   - Overhead accettabile: max +10% gas cost
   - Query multi-plugin DEVE essere ottimizzata
   - Beacon resolution overhead: target <5k gas

4. **Production Constraints**:
   - SimpleSwap deployed (0xa0DB7...) NON può essere modificato (già in produzione)
   - Beacon contract già esistente e funzionante
   - Rollback DEVE essere possibile in ogni fase

#### **Requisiti Funzionali**

1. **Phase 1 (Core Refactor)**:
   - ISwapPlugin extends ISimpleSwap (backward compatible)
   - SwapManager risolve plugin via Beacon invece di hardcoded address
   - Best price selection tra N plugin
   - Plugin switching dinamico

2. **Phase 2+ (Nuovi Plugin)**:
   - CamelotPlugin (Camelot V3 Router)
   - OdosPlugin (MEV protection)
   - PendlePlugin (yield tokens PT/YT)

---

### **Rischi / Incertezze**

| Rischio | Probabilità | Impatto | Mitigazione |
|---------|------------|---------|-------------|
| **Breaking backward compatibility** | Media | CRITICO | Extensive testing + fallback mechanism |
| **Gas costs troppo alti** | Bassa | Alto | Benchmarking continuo + optimization |
| **Plugin malevolo manipola quotes** | Media | Alto | Quote validation vs oracle prices |
| **Beacon resolution failure** | Bassa | CRITICO | Fallback a `simpleSwapRouter` deprecato |
| **SimpleSwap non implementa ISwapPlugin** | Bassa | Medio | ISwapPlugin extends ISimpleSwap (compatible) |
| **Authorization bypass durante migration** | Bassa | CRITICO | Mantiene `onlyAuthorizedCaller` modifier |

---

## 🎯 STRATEGIA

### **Approccio Scelto: Incremental Extension**

**Rationale**: Sistema già modulare, serve solo estendere capabilities.

#### **Principi Guida**

1. **Non toccare ciò che funziona**:
   - ISimpleSwap: NO modifiche
   - Authorization: NO modifiche
   - Validations: NO modifiche
   - WETH handling: NO modifiche

2. **Estendere, non sostituire**:
   - ISwapPlugin extends ISimpleSwap (non replace)
   - SwapManager refactor con fallback a sistema vecchio
   - Plugin registration additive (non breaking)

3. **Migration incrementale**:
   - Step 1: Register existing SimpleSwap come plugin
   - Step 2: Deploy new SwapManager (backward compatible)
   - Step 3: Switch via Beacon (rollback ready)
   - Step 4: Verify + test

4. **Safety first**:
   - Ogni step testabile indipendentemente
   - Rollback plan per ogni fase
   - Extensive test coverage (>95%)

---

### **Alternative e Trade-off**

#### **Alternativa A: Big Bang Rewrite** ❌

**Approccio**: Ricostruire SwapManager da zero con architettura multi-plugin nativa.

**Pro**:
- Design pulito senza legacy code
- Nessun deprecation warning
- Ottimizzazione gas più facile

**Contro**:
- Alto rischio breaking changes
- Deployment complesso (swap atomico)
- Testing più esteso necessario
- Nessun fallback a sistema vecchio
- Downtime potenziale

**Decisione**: SCARTATA - Rischio troppo alto per benefici marginali

---

#### **Alternativa B: Proxy Pattern con Upgrade** ❌

**Approccio**: Usare Transparent/UUPS Proxy per upgrade SwapManager.

**Pro**:
- Indirizzo SwapManager invariato
- Upgrade più smooth
- Rollback via proxy admin

**Contro**:
- Aggiunge complessità (proxy overhead)
- Beacon già presente (duplicazione pattern)
- Storage layout constraints
- Gas cost overhead proxy calls

**Decisione**: SCARTATA - Beacon già fornisce dynamic resolution, proxy ridondante

---

#### **Alternativa C: Incremental Extension** ✅ SCELTA

**Approccio**: Estendere sistema esistente con backward compatibility totale.

**Pro**:
- Zero breaking changes
- Migration sicura step-by-step
- Rollback sempre possibile
- Riutilizzo codice esistente (SimpleSwap deployed)
- Testing incrementale

**Contro**:
- Deprecation warnings nel codice
- Doppio path (vecchio + nuovo) temporaneo
- Cleanup code in futuro

**Decisione**: SCELTA - Massima sicurezza con minimo rischio

---

### **Motivazioni Tecniche**

1. **Perché ISwapPlugin extends ISimpleSwap?**
   - Backward compatibility: vecchi contratti (SimpleSwap) funzionano senza modifiche
   - Future-proof: possiamo aggiungere funzioni avanzate (health check, features)
   - Type safety: SwapManager può cast a ISimpleSwap per chiamate base

2. **Perché mantenere `simpleSwapRouter` come fallback?**
   - Safety: se Beacon resolution fallisce, sistema torna a funzionare
   - Testing: possiamo testare nuovo sistema senza disabilitare vecchio
   - Migration graduale: LiquidityManager possono migrare uno alla volta

3. **Perché query multi-plugin invece di routing statico?**
   - Best price guarantee: utenti ottengono sempre miglior quote disponibile
   - Flexibility: possiamo aggiungere/rimuovere plugin senza modificare SwapManager
   - Competition: DEX competono su prezzo, migliorando execution

4. **Perché NON modificare LiquidityManager?**
   - Separation of concerns: LiquidityManager chiama SwapManager, non sa quale plugin usa
   - Zero impact: nessun rischio su logica core deposit/withdraw
   - Testing isolato: possiamo testare SwapManager indipendentemente

---

## 📐 DOCUMENTAZIONE

### **Schema Architetturale**

```
CURRENT STATE (Phase 0):
┌─────────────────────────────────────────┐
│ LiquidityManager-ETH/USDC/WBTC          │
│   └─> performSwap(token, amount, ...)   │ (NO CHANGES)
└──────────────┬──────────────────────────┘
               │ ISwapManagerForModules
               ▼
┌─────────────────────────────────────────┐
│ SwapManager (CURRENT)                   │
│   └─> simpleSwapRouter = 0xa0DB7...    │ (hardcoded)
└──────────────┬──────────────────────────┘
               │ ISimpleSwap
               ▼
┌─────────────────────────────────────────┐
│ SimpleSwap (0xa0DB7...)                 │
│   └─> Uniswap V3 wrapper                │ (NO CHANGES)
└─────────────────────────────────────────┘

TARGET STATE (Phase 1B):
┌─────────────────────────────────────────┐
│ LiquidityManager-ETH/USDC/WBTC          │
│   └─> performSwap(token, amount, ...)   │ (NO CHANGES)
└──────────────┬──────────────────────────┘
               │ ISwapManagerForModules
               ▼
┌─────────────────────────────────────────┐
│ SwapManager (REFACTORED)                 │
│   ├─> activeSwapPlugin = "UniswapV3"    │ (NEW)
│   ├─> swapWithBestPlugin()              │ (NEW)
│   └─> _getActivePlugin() via Beacon     │ (NEW)
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ Beacon (EXISTING)                        │
│   ├─> "UniswapV3Plugin" → 0xa0DB7...   │ (SimpleSwap registered)
│   ├─> "CamelotPlugin"   → 0xNew...     │ (future)
│   └─> "OdosPlugin"      → 0xNew...     │ (future)
└──────────────┬──────────────────────────┘
               │ ISwapPlugin (extends ISimpleSwap)
               ▼
┌─────────────────────────────────────────┐
│ PLUGINS (N implementations)              │
│   ├─> UniswapV3Plugin = SimpleSwap     │ (reused)
│   ├─> CamelotPlugin (new)               │
│   └─> OdosPlugin (new)                  │
└─────────────────────────────────────────┘
```

---

### **API / Interfacce**

#### **1. ISwapPlugin (NEW)**

```solidity
// contracts/interfaces/ISwapPlugin.sol
pragma solidity ^0.8.19;

import "./ISimpleSwap.sol";

/**
 * @title ISwapPlugin
 * @notice Extended DEX plugin interface
 * @dev Extends ISimpleSwap with health checks and metadata
 */
interface ISwapPlugin is ISimpleSwap {
    
    struct ProtocolInfo {
        string name;        // "Uniswap V3"
        string version;     // "1.0.0"
        uint256 features;   // Bitmask (BASIC_SWAP | MULTI_HOP | ...)
    }
    
    /// @notice Returns protocol metadata
    function getProtocolInfo() external pure returns (ProtocolInfo memory);
    
    /// @notice Checks if plugin supports token pair
    function supportsTokenPair(address tokenA, address tokenB) 
        external view returns (bool);
    
    /// @notice Health check for plugin operability
    function isHealthy() 
        external view returns (bool healthy, string memory reason);
}
```

**Backward Compatibility**:
- Inherits all ISimpleSwap functions
- Old plugins (SimpleSwap) work senza implementare nuove funzioni
- SwapManager può chiamare ISimpleSwap base functions su tutti i plugin

---

#### **2. SwapManager Refactored (MODIFIED)**

```solidity
// contracts/SwapManager.sol (KEY CHANGES)
contract SwapManager {
    
    // ============ STORAGE (NEW) ============
    
    /// @notice Active plugin name (Beacon resolution)
    string public activeSwapPlugin = "UniswapV3Plugin";
    
    /// @notice Deprecated (backward compatibility)
    /// @dev Kept for fallback if Beacon fails
    address public simpleSwapRouter;  // DEPRECATED but MAINTAINED
    
    // ============ PLUGIN RESOLUTION (NEW) ============
    
    /**
     * @notice Resolves active plugin via Beacon
     * @dev Falls back to simpleSwapRouter if Beacon fails
     */
    function _getActivePlugin() internal view returns (ISwapPlugin) {
        // Try new system
        try IBeacon(beacon).getImplementation(activeSwapPlugin) 
            returns (address pluginAddr) 
        {
            if (pluginAddr != address(0)) {
                return ISwapPlugin(pluginAddr);
            }
        } catch {}
        
        // Fallback to old system
        require(simpleSwapRouter != address(0), "No plugin configured");
        return ISwapPlugin(simpleSwapRouter);
    }
    
    // ============ MULTI-PLUGIN QUERY (NEW) ============
    
    struct QuoteResult {
        string pluginName;
        uint256 quote;
        bool isValid;
        string errorReason;
    }
    
    /**
     * @notice Get quotes from ALL registered plugins
     * @dev Queries each plugin, returns array of results
     */
    function getAllQuotes(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (QuoteResult[] memory results) {
        // Get all SWAP_PLUGIN modules from Beacon
        string[] memory pluginNames = _getSwapPluginNames();
        results = new QuoteResult[](pluginNames.length);
        
        for (uint i = 0; i < pluginNames.length; i++) {
            results[i].pluginName = pluginNames[i];
            
            address pluginAddr = IBeacon(beacon).getImplementation(pluginNames[i]);
            if (pluginAddr == address(0)) {
                results[i].isValid = false;
                results[i].errorReason = "Plugin not registered";
                continue;
            }
            
            ISwapPlugin plugin = ISwapPlugin(pluginAddr);
            
            try plugin.getExpectedOutput(tokenIn, tokenOut, amountIn) 
                returns (uint256 quote) 
            {
                results[i].quote = quote;
                results[i].isValid = true;
            } catch Error(string memory reason) {
                results[i].isValid = false;
                results[i].errorReason = reason;
            }
        }
    }
    
    /**
     * @notice Execute swap with BEST PRICE plugin
     * @dev Queries all plugins, selects best, executes swap
     */
    function swapWithBestPlugin(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external onlyAuthorizedCaller nonReentrant returns (uint256 amountOut) {
        require(block.timestamp <= deadline, "Deadline expired");
        
        // Get quotes from all plugins
        QuoteResult[] memory quotes = this.getAllQuotes(tokenIn, tokenOut, amountIn);
        
        // Find best valid quote
        uint256 bestQuote = 0;
        string memory bestPlugin;
        
        for (uint i = 0; i < quotes.length; i++) {
            if (quotes[i].isValid && quotes[i].quote > bestQuote) {
                bestQuote = quotes[i].quote;
                bestPlugin = quotes[i].pluginName;
            }
        }
        
        require(bestQuote >= minAmountOut, "Best quote below minimum");
        require(bytes(bestPlugin).length > 0, "No valid plugin found");
        
        // Execute swap with best plugin
        address bestPluginAddr = IBeacon(beacon).getImplementation(bestPlugin);
        ISwapPlugin swapper = ISwapPlugin(bestPluginAddr);
        
        IProxyGeneral proxy = IProxyGeneral(proxyGeneralAddr);
        proxy.approveSpender(tokenIn, address(swapper), amountIn);
        
        amountOut = swapper.inputSwap(tokenIn, tokenOut, amountIn);
        
        emit BestPluginSelected(bestPlugin, bestQuote, amountOut);
        return amountOut;
    }
    
    // ============ BACKWARD COMPATIBILITY (MAINTAINED) ============
    
    /**
     * @notice Set active plugin by name
     * @dev NEW function for plugin switching
     */
    function setActiveSwapPlugin(string memory pluginName) 
        external onlyOwner 
    {
        address pluginAddr = IBeacon(beacon).getImplementation(pluginName);
        require(pluginAddr != address(0), "Plugin not registered");
        
        string memory oldPlugin = activeSwapPlugin;
        activeSwapPlugin = pluginName;
        
        emit SwapPluginChanged(oldPlugin, pluginName, pluginAddr);
    }
    
    /**
     * @notice DEPRECATED: Use setActiveSwapPlugin() instead
     * @dev Maintained for backward compatibility
     */
    function setSimpleSwapRouter(address newRouter) external onlyOwner {
        emit DeprecationWarning(
            "setSimpleSwapRouter is deprecated. Use setActiveSwapPlugin()"
        );
        
        address oldRouter = simpleSwapRouter;
        simpleSwapRouter = newRouter;
        
        emit SimpleSwapRouterUpdated(oldRouter, newRouter);
    }
    
    // ============ EXISTING FUNCTIONS (NO CHANGES) ============
    
    /// @notice Core swap logic - DELEGATES to plugin
    /// @dev NO CHANGES to this function logic
    function _performSwapInternal(...) internal returns (uint256) {
        // OLD: ISimpleSwap swapper = ISimpleSwap(simpleSwapRouter);
        // NEW: ISwapPlugin swapper = _getActivePlugin();
        
        ISwapPlugin swapper = _getActivePlugin();  // ONLY CHANGE
        
        // REST REMAINS IDENTICAL:
        SwapValidation memory validation = _validateSwapParameters(...);
        require(validation.isValid, validation.errorReason);
        
        IProxyGeneral proxy = IProxyGeneral(proxyGeneralAddr);
        proxy.approveSpender(tokenAddr, address(swapper), amount);
        
        return swapper.inputSwap(tokenIn, tokenOut, amount);
    }
}
```

**Key Changes Summary**:
1. NEW: `activeSwapPlugin` storage variable
2. NEW: `_getActivePlugin()` with fallback
3. NEW: `getAllQuotes()` multi-plugin query
4. NEW: `swapWithBestPlugin()` best price selection
5. NEW: `setActiveSwapPlugin()` plugin switching
6. MODIFIED: `_performSwapInternal()` usa `_getActivePlugin()` invece di hardcoded
7. MAINTAINED: `simpleSwapRouter` + `setSimpleSwapRouter()` (deprecated but working)
8. NO CHANGES: Authorization, validations, WETH handling, slippage protection

---

#### **3. Beacon Integration (NO CODE CHANGES)**

```solidity
// contracts/Beacon.sol (EXISTING - NO MODIFICATIONS)
// Solo registrazione nuovi plugin:

// Deploy script:
await beacon.registerModule(
    "UniswapV3Plugin",              // name
    "0xa0DB78167CBAccD47524a261...", // SimpleSwap existing address
    ModuleCategory.SWAP_PLUGIN,     // category
    "1.0.0"                         // version
);
```

---

### **Impatti / Note Tecniche**

#### **Gas Costs**

| Operation | Current | New (1 plugin) | New (3 plugins query) |
|-----------|---------|----------------|----------------------|
| Direct swap | 180k | 185k (+5k) | 185k |
| Best price swap | N/A | N/A | 195k (+15k) |

**Overhead**: ~5k gas per Beacon resolution, ~10k gas per plugin query aggiuntivo.  
**Accettabile**: +8% gas per best price guarantee.

#### **Storage Layout**

**SwapManager NEW storage**:
```solidity
// EXISTING (MAINTAINED):
address public immutable beacon;
address public simpleSwapRouter;  // DEPRECATED but kept
uint256 public maxSlippage;
bool public swapsEnabled;
mapping(string => uint256) public minSwapAmounts;
mapping(string => uint256) public maxSwapAmounts;
mapping(bytes32 => uint256) private swapErrors;
mapping(bytes32 => uint256) private swapSuccesses;

// NEW:
string public activeSwapPlugin;  // Added at end (no storage conflict)
```

**No storage conflicts**: Nuova variabile aggiunta alla fine dello storage layout.

#### **Testing Requirements**

**Unit Tests** (NEW):
- `test_getActivePlugin_beacon_resolution`
- `test_getActivePlugin_fallback_to_simpleSwapRouter`
- `test_getAllQuotes_single_plugin`
- `test_getAllQuotes_multi_plugin`
- `test_swapWithBestPlugin_uniswap_best`
- `test_swapWithBestPlugin_camelot_best`
- `test_setActiveSwapPlugin_success`
- `test_setActiveSwapPlugin_not_registered_reverts`

**Integration Tests** (NEW):
- `test_liquidity_manager_calls_swap_manager_backward_compatible`
- `test_multi_plugin_rebalancing_eth_ecosystem`
- `test_migration_zero_downtime`
- `test_rollback_to_old_system`

**Gas Benchmarks** (NEW):
- Swap gas cost: old vs new
- Multi-plugin query overhead
- Beacon resolution cost

---

## ✅ TODO

### **Phase 0: Preparation & Validation (1 giorno)**

- [ ] **0.1**: Analizzare Beacon.sol esistente
  - Verificare `getImplementation()` signature
  - Verificare `registerModule()` con ModuleCategory
  - Verificare `getAllSwapPlugins()` disponibile o da implementare
  
- [ ] **0.2**: Analizzare SimpleSwap deployed (0xa0DB7...)
  - Verificare implementa `ISimpleSwap` correttamente
  - Verificare non ha breaking issues
  - Confermare Uniswap V3 Router address

- [ ] **0.3**: Setup testing environment
  - Fork Arbitrum mainnet @ latest block
  - Deploy mock LiquidityManager per testing
  - Setup gas reporter

- [ ] **0.4**: Baseline measurements
  - Gas cost swap current system
  - Success rate current system
  - Performance benchmarks

---

### **Phase 1A: Interface & Core Refactor (2-3 giorni)**

- [ ] **1A.1**: Creare `ISwapPlugin.sol`
  ```solidity
  // contracts/interfaces/ISwapPlugin.sol
  interface ISwapPlugin is ISimpleSwap {
      struct ProtocolInfo { ... }
      function getProtocolInfo() external pure returns (ProtocolInfo memory);
      function supportsTokenPair(address, address) external view returns (bool);
      function isHealthy() external view returns (bool, string memory);
  }
  ```

- [ ] **1A.2**: Refactor SwapManager - Storage
  - Aggiungere `string public activeSwapPlugin = "UniswapV3Plugin"`
  - Mantenere `address public simpleSwapRouter` (deprecated)
  - Aggiungere events: `SwapPluginChanged`, `DeprecationWarning`

- [ ] **1A.3**: Refactor SwapManager - Plugin Resolution
  - Implementare `_getActivePlugin()` con fallback logic
  - Implementare `setActiveSwapPlugin(string)` owner function
  - Mantenere `setSimpleSwapRouter(address)` con deprecation warning

- [ ] **1A.4**: Refactor SwapManager - Core Logic
  - Modificare `_performSwapInternal()`: usa `_getActivePlugin()` invece di hardcoded
  - Verificare NESSUNA altra modifica a logica esistente
  - Mantenere authorization, validations, WETH handling invariati

- [ ] **1A.5**: Testing backward compatibility
  - Test: `simpleSwapRouter` funziona come prima (fallback)
  - Test: `setSimpleSwapRouter()` ancora funziona (deprecated)
  - Test: Beacon resolution fallisce → fallback a simpleSwapRouter
  - Test: LiquidityManager calls ancora funzionano

- [ ] **1A.6**: Gas benchmarking Phase 1A
  - Misurare overhead Beacon resolution
  - Confrontare con baseline Phase 0
  - Verificare <5k gas overhead target

---

### **Phase 1B: Multi-Plugin Query System (2-3 giorni)**

- [ ] **1B.1**: Implementare `getAllQuotes()`
  ```solidity
  function getAllQuotes(address tokenIn, address tokenOut, uint256 amountIn)
      external view returns (QuoteResult[] memory)
  ```
  - Query tutti i plugin da Beacon
  - Try/catch per ogni plugin.getExpectedOutput()
  - Return array con quote + validity + error reason

- [ ] **1B.2**: Implementare `swapWithBestPlugin()`
  ```solidity
  function swapWithBestPlugin(...)
      external onlyAuthorizedCaller nonReentrant returns (uint256)
  ```
  - Call `getAllQuotes()` internal
  - Find best valid quote (max value)
  - Execute swap with best plugin
  - Emit `BestPluginSelected` event

- [ ] **1B.3**: Ottimizzazione gas multi-query
  - Minimize external calls
  - Optimize loop iterations
  - Consider view function gas limits

- [ ] **1B.4**: Testing multi-plugin logic
  - Test: `getAllQuotes()` con 0 plugin → empty array
  - Test: `getAllQuotes()` con 1 plugin → 1 quote
  - Test: `getAllQuotes()` con 3 plugin → 3 quotes
  - Test: `swapWithBestPlugin()` seleziona correttamente best
  - Test: `swapWithBestPlugin()` reverts se no valid quotes
  - Test: `swapWithBestPlugin()` reverts se best < minAmountOut

- [ ] **1B.5**: Gas benchmarking multi-plugin
  - 1 plugin query cost
  - 3 plugins query cost
  - 5 plugins query cost (stress test)
  - Verificare <10k gas per plugin overhead target

---

### **Phase 1C: Migration & Deployment (1 giorno)**

- [ ] **1C.1**: Preparare migration scripts
  ```typescript
  // scripts/migration/01_register_simpleswap.ts
  // scripts/migration/02_deploy_new_swapmanager.ts
  // scripts/migration/03_update_beacon.ts
  // scripts/migration/04_verify_system.ts
  // scripts/migration/rollback.ts
  ```

- [ ] **1C.2**: Deploy su testnet (Arbitrum Sepolia)
  - Deploy nuovo SwapManager
  - Register SimpleSwap come "UniswapV3Plugin" in Beacon
  - Update Beacon SwapManager pointer
  - Test end-to-end con LiquidityManager

- [ ] **1C.3**: Smoke tests testnet
  - LiquidityManager.rebalance() funziona
  - Swap via best plugin funziona
  - Authorization check funziona
  - Rollback procedure funziona

- [ ] **1C.4**: Audit checklist
  - Security review: authorization invariata
  - Security review: reentrancy protection invariata
  - Security review: validations invariate
  - Gas review: overhead accettabile
  - Code review: deprecation warnings corretti

---

### **Phase 2: First New Plugin - CamelotPlugin (3-5 giorni)**

- [ ] **2.1**: Implementare `CamelotPlugin.sol`
  ```solidity
  contract CamelotPlugin is ISwapPlugin {
      ICamelotRouter public camelotRouter;
      
      function inputSwap(...) external returns (uint256) {
          // Camelot V3 swap logic
      }
      
      function getProtocolInfo() external pure returns (ProtocolInfo memory) {
          return ProtocolInfo("Camelot V3", "1.0.0", BASIC_SWAP | MULTI_HOP);
      }
  }
  ```

- [ ] **2.2**: Testing CamelotPlugin
  - Unit tests: inputSwap, outputSwap, getExpectedOutput
  - Integration test: vs Camelot pools reali su Arbitrum fork
  - Quote comparison: Uniswap vs Camelot

- [ ] **2.3**: Deploy & Register CamelotPlugin
  - Deploy su testnet
  - Register in Beacon come "CamelotPlugin"
  - Test multi-plugin query (Uniswap + Camelot)

- [ ] **2.4**: Validation best price selection
  - Test: Uniswap best → selezionato
  - Test: Camelot best → selezionato
  - Test: Quote equal → primo in lista selezionato

---

### **Phase 3-4: Additional Plugins (1-2 settimane, parallel)**

- [ ] **3.1**: OdosPlugin implementation
- [ ] **3.2**: PendlePlugin implementation
- [ ] **3.3**: Testing & optimization
- [ ] **3.4**: Production deployment preparation

---

### **Final: Production Deployment (1 giorno)**

- [ ] **F.1**: Final audit & review
- [ ] **F.2**: Deploy su Arbitrum mainnet
- [ ] **F.3**: Migration execution
- [ ] **F.4**: Monitoring & verification
- [ ] **F.5**: Documentation update

---

## 📊 TIMELINE SUMMARY

| Phase | Duration | Criticality | Dependencies |
|-------|----------|-------------|--------------|
| Phase 0 | 1 giorno | HIGH | None |
| Phase 1A | 2-3 giorni | CRITICAL | Phase 0 |
| Phase 1B | 2-3 giorni | CRITICAL | Phase 1A |
| Phase 1C | 1 giorno | HIGH | Phase 1B |
| Phase 2 | 3-5 giorni | MEDIUM | Phase 1C |
| Phase 3-4 | 1-2 settimane | LOW | Phase 1C (parallel) |
| Final | 1 giorno | HIGH | All phases |

**Total Estimate**: 16-24 giorni (3-4 settimane)  
**Critical Path**: Phase 0 → 1A → 1B → 1C (5-8 giorni)

---

## 🎯 SUCCESS CRITERIA

1. ✅ **Backward Compatibility**: Sistema esistente funziona senza modifiche
2. ✅ **Gas Efficiency**: Overhead <10% su swap singolo, <20% su best price
3. ✅ **Security**: Zero nuove vulnerabilità, authorization invariata
4. ✅ **Functionality**: Best price selection funziona correttamente
5. ✅ **Testing**: Coverage >95%, tutti test pass
6. ✅ **Rollback**: Possibile in qualsiasi momento
7. ✅ **Production**: Zero downtime durante migration

---

**🔐 CRITICAL REMINDERS**:
- NON modificare ISimpleSwap
- NON modificare LiquidityManager
- NON modificare authorization logic
- SEMPRE testare backward compatibility
- SEMPRE verificare rollback funziona
- GAS benchmarks OGNI fase