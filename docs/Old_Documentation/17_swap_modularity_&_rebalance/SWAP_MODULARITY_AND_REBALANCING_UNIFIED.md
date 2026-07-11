# 🔄 SWAP MODULARITY & REBALANCING - UNIFIED DOCUMENTATION

**Versione**: 2.0 (Unified)  
**Data Creazione**: 14 Novembre 2025  
**Stato**: Architecture Specification - Consolidata da folder 12 + folder 17  
**Autore**: Development Team

---

## 📋 **INDICE**

- [Executive Summary](#-executive-summary)
- [Architectural Overview](#-architectural-overview)
- [Core Components](#-core-components)
- [Interface Specifications](#-interface-specifications)
- [Authorization Model](#-authorization-model)
- [Rebalancing Integration](#-rebalancing-integration)
- [Implementation Roadmap](#-implementation-roadmap)
- [Usage Examples](#-usage-examples)
- [Security Considerations](#-security-considerations)
- [Appendix: Resolved Inconsistencies](#-appendix-resolved-inconsistencies)

---

## 🎯 **EXECUTIVE SUMMARY**

### **Obiettivo**

Sostituire l'architettura monolitica di SwapManager con un **sistema modulare plugin-based** che:
- ✅ Permette aggiunta incrementale di nuovi DEX senza modificare il core
- ✅ Seleziona automaticamente il miglior prezzo tra tutti i plugin disponibili
- ✅ Supporta sia modalità automatica (best price) che manuale (plugin specifico)
- ✅ Integra seamlessly con operazioni di rebalancing dei 3 ecosistemi (ETH/USDC/WBTC)
- ✅ Mantiene autorizzazioni rigorose (solo moduli interni, NO utenti esterni)

### **Problemi Risolti**

| Problema Attuale | Soluzione Plugin System |
|------------------|------------------------|
| ❌ Solo SimpleSwap supportato | ✅ Plugin per Uniswap, Pendle, Odos, 1inch, ecc. |
| ❌ Ogni nuovo DEX richiede refactoring | ✅ Aggiungi plugin senza toccare core |
| ❌ Nessuna price competition | ✅ Best price automatico tra tutti i DEX |
| ❌ Token su DEX specifici non gestibili | ✅ `swapViaPlugin("pendle", ...)` per PT/YT |
| ❌ Rebalancing manuale inefficiente | ✅ `swapWithBestPlugin()` automatico |

### **Architettura Scelta**

```
BEACON (Unified Registry)
   ↓
   ├─ ModuleCategory.CORE (LiquidityManager-ETH/USDC/WBTC, ...)
   ├─ ModuleCategory.SWAP_PLUGIN (Uniswap, Pendle, Odos, 1inch)
   └─ ModuleCategory.UTILITY (SwapManager, OracleManager, ...)
       ↓
   SwapManager (CONDIVISO tra tutti gli ecosistemi)
       ↓ authorizedCallers
   LiquidityManager-ETH, LiquidityManager-USDC, LiquidityManager-WBTC
       ↓ rebalance() / _executeAutomaticSwap()
   Plugin Selection → Best Price → Swap Execution
```

---

## 🏗️ **ARCHITECTURAL OVERVIEW**

### **Three Separate Ecosystems + Shared SwapManager**

⚠️ **ARCHITETTURA FONDAMENTALE**: Questo progetto implementa **3 deployment completamente separati** con logiche hardcoded per ogni token base:

```
DEPLOYMENT STRUCTURE:

📦 ETH ECOSYSTEM (Deployment #1):
   ├─ LiquidityManager-ETH.sol (18 decimals, ETH-specific logic)
   ├─ ValueCalculator-ETH.sol
   ├─ TokenManager-ETH.sol
   └─ ProxyGeneral-ETH.sol

📦 USDC ECOSYSTEM (Deployment #2):
   ├─ LiquidityManager-USDC.sol (6 decimals, USDC-specific logic)
   ├─ ValueCalculator-USDC.sol
   ├─ TokenManager-USDC.sol
   └─ ProxyGeneral-USDC.sol

📦 WBTC ECOSYSTEM (Deployment #3):
   ├─ LiquidityManager-WBTC.sol (8 decimals, WBTC-specific logic)
   ├─ ValueCalculator-WBTC.sol
   ├─ TokenManager-WBTC.sol
   └─ ProxyGeneral-WBTC.sol

🔗 SHARED MODULES (Single Deployment - usati da tutti):
   ├─ SwapManager.sol ← CONDIVISO!
   ├─ Beacon.sol
   ├─ UniswapV3Plugin.sol
   ├─ PendlePlugin.sol
   ├─ OdosPlugin.sol
   └─ 1inchPlugin.sol
```

**Rationale**: NON usiamo Strategy Pattern con strategie intercambiabili. Ogni ecosistema ha contratti separati con logica hardcoded. I plugin swap sono condivisi perché possono gestire qualsiasi coppia di token (ETH→USDC, USDC→WBTC, ecc.).

---

## 🧩 **CORE COMPONENTS**

### **1. Beacon with ModuleCategory**

Il Beacon è il registry centralizzato per TUTTI i moduli del sistema.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Beacon {
    
    // ==================== ENUMS ====================
    
    enum ModuleCategory {
        CORE,           // LiquidityManager-ETH/USDC/WBTC, ValueCalculator-*, ecc.
        SWAP_PLUGIN,    // UniswapV3Plugin, PendlePlugin, OdosPlugin, 1inchPlugin
        UTILITY         // SwapManager, OracleManager, FeeCalculator (condivisi)
        // ⚠️ NO "STRATEGY" - Non usiamo Strategy Pattern!
    }
    
    // ==================== STRUCTS ====================
    
    struct ModuleInfo {
        address implementation;  // Indirizzo contratto
        string name;            // Nome modulo (es: "uniswap", "LiquidityManager-ETH")
        string version;         // Versione (es: "1.0.0")
        ModuleCategory category; // Categoria di appartenenza
        bool active;            // Se il modulo è attivo
        uint256 registeredAt;   // Timestamp registrazione
    }
    
    // ==================== STORAGE ====================
    
    /// @dev Mapping unificato: keccak256(category, name) → ModuleInfo
    mapping(bytes32 => ModuleInfo) public modules;
    
    /// @dev Lista module IDs per categoria (per iteration)
    mapping(ModuleCategory => bytes32[]) public modulesByCategory;
    
    // ==================== CORE FUNCTIONS ====================
    
    /**
     * @notice Registra un nuovo modulo nel Beacon
     * @param name Nome univoco del modulo
     * @param implementation Indirizzo implementazione
     * @param category Categoria del modulo
     * @param version Versione del modulo
     */
    function registerModule(
        string memory name,
        address implementation,
        ModuleCategory category,
        string memory version
    ) external onlyOwner {
        bytes32 moduleId = keccak256(abi.encodePacked(category, name));
        require(modules[moduleId].implementation == address(0), "Module already exists");
        require(implementation != address(0), "Invalid implementation");
        
        modules[moduleId] = ModuleInfo({
            implementation: implementation,
            name: name,
            version: version,
            category: category,
            active: true,
            registeredAt: block.timestamp
        });
        
        modulesByCategory[category].push(moduleId);
        
        emit ModuleRegistered(moduleId, name, category, implementation, version);
    }
    
    /**
     * @notice Ottiene indirizzo modulo per nome e categoria
     * @param name Nome del modulo
     * @param category Categoria del modulo
     * @return implementation Indirizzo implementazione
     */
    function getModule(string memory name, ModuleCategory category) 
        public 
        view 
        returns (address implementation) 
    {
        bytes32 moduleId = keccak256(abi.encodePacked(category, name));
        ModuleInfo memory info = modules[moduleId];
        require(info.implementation != address(0), "Module not found");
        require(info.active, "Module not active");
        return info.implementation;
    }
    
    /**
     * @notice Ottiene TUTTI i plugin swap attivi (per best price selection)
     * @return plugins Array di ModuleInfo per tutti i plugin swap
     */
    function getAllSwapPlugins() external view returns (ModuleInfo[] memory plugins) {
        bytes32[] memory pluginIds = modulesByCategory[ModuleCategory.SWAP_PLUGIN];
        uint256 activeCount = 0;
        
        // Count active plugins
        for (uint256 i = 0; i < pluginIds.length; i++) {
            if (modules[pluginIds[i]].active) {
                activeCount++;
            }
        }
        
        // Build active plugins array
        plugins = new ModuleInfo[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < pluginIds.length; i++) {
            if (modules[pluginIds[i]].active) {
                plugins[index] = modules[pluginIds[i]];
                index++;
            }
        }
    }
    
    /**
     * @notice Attiva/disattiva un modulo
     * @param name Nome del modulo
     * @param category Categoria del modulo
     * @param active Nuovo stato
     */
    function setModuleActive(
        string memory name, 
        ModuleCategory category, 
        bool active
    ) external onlyOwner {
        bytes32 moduleId = keccak256(abi.encodePacked(category, name));
        require(modules[moduleId].implementation != address(0), "Module not found");
        
        modules[moduleId].active = active;
        
        emit ModuleActiveStatusChanged(moduleId, active);
    }
    
    // ==================== EVENTS ====================
    
    event ModuleRegistered(
        bytes32 indexed moduleId,
        string name,
        ModuleCategory category,
        address implementation,
        string version
    );
    
    event ModuleActiveStatusChanged(bytes32 indexed moduleId, bool active);
}
```

### **Registration Examples**

```solidity
// Durante deployment iniziale:

// 1. CORE modules per ETH ecosystem
beacon.registerModule("LiquidityManager-ETH", 0x..., ModuleCategory.CORE, "1.0.0");
beacon.registerModule("ValueCalculator-ETH", 0x..., ModuleCategory.CORE, "1.0.0");

// 2. CORE modules per USDC ecosystem
beacon.registerModule("LiquidityManager-USDC", 0x..., ModuleCategory.CORE, "1.0.0");
beacon.registerModule("ValueCalculator-USDC", 0x..., ModuleCategory.CORE, "1.0.0");

// 3. CORE modules per WBTC ecosystem
beacon.registerModule("LiquidityManager-WBTC", 0x..., ModuleCategory.CORE, "1.0.0");
beacon.registerModule("ValueCalculator-WBTC", 0x..., ModuleCategory.CORE, "1.0.0");

// 4. SWAP_PLUGIN (condivisi tra TUTTI gli ecosistemi)
beacon.registerModule("uniswap", 0x..., ModuleCategory.SWAP_PLUGIN, "1.0.0");
beacon.registerModule("pendle", 0x..., ModuleCategory.SWAP_PLUGIN, "1.0.0");
beacon.registerModule("odos", 0x..., ModuleCategory.SWAP_PLUGIN, "1.0.0");

// 5. UTILITY (condivisi)
beacon.registerModule("SwapManager", 0x..., ModuleCategory.UTILITY, "1.0.0");
beacon.registerModule("OracleManager", 0x..., ModuleCategory.UTILITY, "1.0.0");
```

---

## 📐 **INTERFACE SPECIFICATIONS**

### **ISwapPlugin - Core Interface**

⚠️ **DECISIONE ARCHITETTURALE**: Uso **struct-based parameters** (non parametri separati) per estendibilità futura senza breaking changes.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ISwapPlugin
 * @notice Interfaccia standard per tutti i plugin swap
 * @dev Tutti i plugin devono implementare questa interface
 */
interface ISwapPlugin {
    
    // ==================== DATA STRUCTURES ====================
    
    /**
     * @dev Parametri per eseguire uno swap
     */
    struct SwapParams {
        address tokenIn;        // Token da vendere
        address tokenOut;       // Token da comprare
        uint256 amountIn;       // Quantità input
        uint256 minAmountOut;   // Minimo output accettabile (slippage protection)
        address recipient;      // Destinatario dei token
        uint256 deadline;       // Deadline operazione (timestamp)
        bytes extraData;        // Dati extra specifici del protocollo
    }
    
    /**
     * @dev Parametri per ottenere una quotazione
     */
    struct QuoteParams {
        address tokenIn;        // Token da vendere
        address tokenOut;       // Token da comprare
        uint256 amountIn;       // Quantità input
        bytes extraData;        // Dati extra per quotazione
    }
    
    /**
     * @dev Risultato di una quotazione
     */
    struct Quote {
        uint256 amountOut;      // Quantità stimata in output
        uint256 slippageBps;    // Slippage stimato in basis points
        uint256 gasEstimate;    // Stima gas per l'operazione
        uint256 priceImpact;    // Impatto sul prezzo in basis points
        bool isValid;           // Se la quotazione è valida
        string reason;          // Motivo se non valida (es: "Insufficient liquidity")
    }
    
    /**
     * @dev Informazioni sul protocollo
     */
    struct ProtocolInfo {
        string name;            // Nome (es: "Uniswap V3")
        string version;         // Versione (es: "1.0.0")
        uint256 features;       // Bitmask features supportate
    }
    
    // ==================== CORE FUNCTIONS ====================
    
    /**
     * @notice Esegue swap tramite il protocollo specifico
     * @param params Parametri dello swap
     * @return amountOut Quantità effettiva ricevuta
     * @custom:security Solo SwapManager può chiamare
     */
    function swap(SwapParams calldata params) external returns (uint256 amountOut);
    
    /**
     * @notice Ottiene quotazione per uno swap senza eseguirlo
     * @param params Parametri per quotazione
     * @return quote Informazioni sulla quotazione
     * @custom:gas-limit Max 100,000 gas
     */
    function getQuote(QuoteParams calldata params) 
        external 
        view 
        returns (Quote memory quote);
    
    /**
     * @notice Ritorna informazioni sul protocollo
     * @return info Informazioni del protocollo
     */
    function getProtocolInfo() external pure returns (ProtocolInfo memory info);
    
    // ==================== UTILITY FUNCTIONS ====================
    
    /**
     * @notice Verifica se plugin supporta coppia di token
     * @param tokenA Primo token
     * @param tokenB Secondo token
     * @return supported True se supportata
     */
    function supportsTokenPair(address tokenA, address tokenB) 
        external 
        view 
        returns (bool supported);
    
    /**
     * @notice Verifica stato di salute del plugin
     * @return healthy True se operativo
     * @return reason Motivo se non healthy
     */
    function isHealthy() external view returns (bool healthy, string memory reason);
}
```

### **Feature Flags**

```solidity
/**
 * @dev Bitmask per features supportate dai plugin
 */
library ProtocolFeatures {
    uint256 constant BASIC_SWAP = 1 << 0;       // 0x001 - Swap base
    uint256 constant MULTI_HOP = 1 << 1;        // 0x002 - Multi-hop routing
    uint256 constant YIELD_TOKENS = 1 << 2;     // 0x004 - Yield tokens (PT/YT)
    uint256 constant MEV_PROTECTION = 1 << 3;   // 0x008 - MEV protection
    uint256 constant FLASH_SWAPS = 1 << 4;      // 0x010 - Flash swaps
    uint256 constant LIMIT_ORDERS = 1 << 5;     // 0x020 - Limit orders
}
```

### **Custom Errors**

```solidity
/**
 * @dev Errori standard per plugin
 */
interface ISwapPluginErrors {
    error UnauthorizedCaller(address caller);
    error InvalidTokenPair(address tokenA, address tokenB);
    error InsufficientLiquidity(address tokenA, address tokenB);
    error SlippageTooHigh(uint256 slippage, uint256 maxSlippage);
    error DeadlineExpired(uint256 deadline, uint256 currentTime);
    error SwapFailed(string reason);
    error PluginNotHealthy(string reason);
}
```

---

## 🔧 **SWAPMANAGER IMPLEMENTATION**

### **SwapManager - Plugin Manager con Authorization**

Il SwapManager è il **punto centrale** per tutti gli swap. È **condiviso tra tutti e 3 gli ecosistemi** (ETH/USDC/WBTC).

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/ISwapPlugin.sol";
import "./Beacon.sol";

/**
 * @title SwapManager
 * @notice Manager centrale per swap tramite plugin system
 * @dev Condiviso tra tutti gli ecosistemi (ETH, USDC, WBTC)
 */
contract SwapManager is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    
    // ==================== IMMUTABLES ====================
    
    Beacon public immutable beacon;
    
    // ==================== STORAGE ====================
    
    /// @notice Mapping dei chiamanti autorizzati (LiquidityManager-ETH/USDC/WBTC, ecc.)
    mapping(address => bool) public authorizedCallers;
    
    /// @notice History swap per caller (per analytics)
    mapping(address => SwapExecution[]) private callerSwapHistory;
    
    // ==================== STRUCTS ====================
    
    struct SwapExecution {
        string pluginName;
        uint256 amountIn;
        uint256 amountOut;
        uint256 gasUsed;
        bool success;
        uint256 timestamp;
    }
    
    // ==================== MODIFIERS ====================
    
    modifier onlyAuthorized() {
        require(authorizedCallers[msg.sender], "SwapManager: Not authorized");
        _;
    }
    
    // ==================== CONSTRUCTOR ====================
    
    constructor(address _beacon) {
        require(_beacon != address(0), "Invalid beacon");
        beacon = Beacon(_beacon);
    }
    
    // ==================== AUTHORIZATION MANAGEMENT ====================
    
    /**
     * @notice Autorizza un chiamante (es: LiquidityManager-ETH)
     * @param caller Indirizzo da autorizzare
     */
    function authorizeCaller(address caller) external onlyOwner {
        require(caller != address(0), "Invalid caller");
        require(!authorizedCallers[caller], "Already authorized");
        
        authorizedCallers[caller] = true;
        
        emit CallerAuthorized(caller);
    }
    
    /**
     * @notice Revoca autorizzazione chiamante
     * @param caller Indirizzo da revocare
     */
    function revokeCaller(address caller) external onlyOwner {
        require(authorizedCallers[caller], "Not authorized");
        
        authorizedCallers[caller] = false;
        
        emit CallerRevoked(caller);
    }
    
    // ==================== SWAP EXECUTION ====================
    
    /**
     * @notice Esegue swap con plugin specifico
     * @dev Modalità MANUALE - specifica quale plugin usare
     * @param pluginName Nome del plugin (es: "pendle" per yield tokens)
     * @param params Parametri swap
     * @return amountOut Quantità ricevuta
     */
    function swapViaPlugin(
        string memory pluginName,
        ISwapPlugin.SwapParams memory params
    ) external onlyAuthorized nonReentrant returns (uint256 amountOut) {
        // Get plugin address from Beacon
        address pluginAddress = beacon.getModule(pluginName, Beacon.ModuleCategory.SWAP_PLUGIN);
        require(pluginAddress != address(0), "Plugin not found");
        
        ISwapPlugin plugin = ISwapPlugin(pluginAddress);
        
        // Validate parameters
        _validateSwapParams(params);
        
        // Transfer tokens from caller to plugin
        IERC20(params.tokenIn).safeTransferFrom(msg.sender, pluginAddress, params.amountIn);
        
        // Execute swap
        uint256 gasStart = gasleft();
        amountOut = plugin.swap(params);
        uint256 gasUsed = gasStart - gasleft();
        
        // Verify output received by recipient
        require(amountOut >= params.minAmountOut, "Insufficient output");
        
        // Record execution
        _recordSwapExecution(msg.sender, pluginName, params, amountOut, gasUsed);
        
        emit SwapExecuted(
            msg.sender, 
            pluginName, 
            params.tokenIn, 
            params.tokenOut, 
            params.amountIn, 
            amountOut
        );
    }
    
    /**
     * @notice Esegue swap con il plugin che offre miglior prezzo
     * @dev Modalità AUTOMATICA - query tutti i plugin, seleziona best price
     * @param params Parametri swap
     * @return amountOut Quantità ricevuta
     */
    function swapWithBestPlugin(
        ISwapPlugin.SwapParams memory params
    ) external onlyAuthorized nonReentrant returns (uint256 amountOut) {
        // Validate parameters
        _validateSwapParams(params);
        
        // Get all active swap plugins from Beacon
        Beacon.ModuleInfo[] memory plugins = beacon.getAllSwapPlugins();
        require(plugins.length > 0, "No plugins available");
        
        // Find best plugin
        (address bestPluginAddress, string memory bestPluginName, uint256 bestQuote) = 
            _findBestPlugin(plugins, params);
        
        require(bestPluginAddress != address(0), "No suitable plugin found");
        require(bestQuote >= params.minAmountOut, "Best quote below minimum");
        
        // Transfer tokens to best plugin
        IERC20(params.tokenIn).safeTransferFrom(msg.sender, bestPluginAddress, params.amountIn);
        
        // Execute swap with best plugin
        uint256 gasStart = gasleft();
        amountOut = ISwapPlugin(bestPluginAddress).swap(params);
        uint256 gasUsed = gasStart - gasleft();
        
        // Record execution
        _recordSwapExecution(msg.sender, bestPluginName, params, amountOut, gasUsed);
        
        emit BestPluginSelected(bestPluginName, bestQuote);
        emit SwapExecuted(
            msg.sender, 
            bestPluginName, 
            params.tokenIn, 
            params.tokenOut, 
            params.amountIn, 
            amountOut
        );
    }
    
    // ==================== VIEW FUNCTIONS ====================
    
    /**
     * @notice Ottiene quotazioni da TUTTI i plugin attivi
     * @param params Parametri per quotazione
     * @return quotes Array di quote
     * @return pluginNames Array nomi plugin
     */
    function getAllQuotes(
        ISwapPlugin.QuoteParams memory params
    ) external view returns (
        ISwapPlugin.Quote[] memory quotes, 
        string[] memory pluginNames
    ) {
        Beacon.ModuleInfo[] memory plugins = beacon.getAllSwapPlugins();
        
        quotes = new ISwapPlugin.Quote[](plugins.length);
        pluginNames = new string[](plugins.length);
        
        for (uint256 i = 0; i < plugins.length; i++) {
            pluginNames[i] = plugins[i].name;
            
            try ISwapPlugin(plugins[i].implementation).getQuote(params) returns (
                ISwapPlugin.Quote memory quote
            ) {
                quotes[i] = quote;
            } catch {
                quotes[i] = ISwapPlugin.Quote({
                    amountOut: 0,
                    slippageBps: 0,
                    gasEstimate: 0,
                    priceImpact: 0,
                    isValid: false,
                    reason: "Query failed"
                });
            }
        }
    }
    
    /**
     * @notice Trova plugin con miglior quotazione
     * @param params Parametri per quotazione
     * @return bestPlugin Nome miglior plugin
     * @return bestQuote Miglior quotazione trovata
     */
    function getBestQuote(
        ISwapPlugin.QuoteParams memory params
    ) external view returns (string memory bestPlugin, uint256 bestQuote) {
        Beacon.ModuleInfo[] memory plugins = beacon.getAllSwapPlugins();
        
        for (uint256 i = 0; i < plugins.length; i++) {
            try ISwapPlugin(plugins[i].implementation).getQuote(params) returns (
                ISwapPlugin.Quote memory quote
            ) {
                if (quote.isValid && quote.amountOut > bestQuote) {
                    bestQuote = quote.amountOut;
                    bestPlugin = plugins[i].name;
                }
            } catch {
                continue;
            }
        }
    }
    
    // ==================== INTERNAL FUNCTIONS ====================
    
    function _validateSwapParams(ISwapPlugin.SwapParams memory params) internal view {
        require(params.tokenIn != address(0), "Invalid tokenIn");
        require(params.tokenOut != address(0), "Invalid tokenOut");
        require(params.tokenIn != params.tokenOut, "Same token");
        require(params.amountIn > 0, "Amount zero");
        require(params.deadline >= block.timestamp, "Deadline expired");
    }
    
    function _findBestPlugin(
        Beacon.ModuleInfo[] memory plugins,
        ISwapPlugin.SwapParams memory params
    ) internal view returns (address bestAddress, string memory bestName, uint256 bestQuote) {
        ISwapPlugin.QuoteParams memory quoteParams = ISwapPlugin.QuoteParams({
            tokenIn: params.tokenIn,
            tokenOut: params.tokenOut,
            amountIn: params.amountIn,
            extraData: params.extraData
        });
        
        for (uint256 i = 0; i < plugins.length; i++) {
            try ISwapPlugin(plugins[i].implementation).getQuote(quoteParams) returns (
                ISwapPlugin.Quote memory quote
            ) {
                if (quote.isValid && quote.amountOut > bestQuote) {
                    bestQuote = quote.amountOut;
                    bestAddress = plugins[i].implementation;
                    bestName = plugins[i].name;
                }
            } catch {
                continue;
            }
        }
    }
    
    function _recordSwapExecution(
        address caller,
        string memory pluginName,
        ISwapPlugin.SwapParams memory params,
        uint256 amountOut,
        uint256 gasUsed
    ) internal {
        callerSwapHistory[caller].push(SwapExecution({
            pluginName: pluginName,
            amountIn: params.amountIn,
            amountOut: amountOut,
            gasUsed: gasUsed,
            success: true,
            timestamp: block.timestamp
        }));
    }
    
    // ==================== EVENTS ====================
    
    event CallerAuthorized(address indexed caller);
    event CallerRevoked(address indexed caller);
    event SwapExecuted(
        address indexed caller,
        string pluginName,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
    event BestPluginSelected(string pluginName, uint256 quote);
}
```

---

## 🔐 **AUTHORIZATION MODEL**

### **Chi Può Chiamare SwapManager?**

⚠️ **CRITICAL SECURITY**: Solo moduli interni autorizzati possono chiamare SwapManager. **NO utenti esterni**!

```
✅ AUTHORIZED CALLERS:
├─ LiquidityManager-ETH.sol (rebalancing + automatic withdrawals nell'ecosistema ETH)
├─ LiquidityManager-USDC.sol (rebalancing + automatic withdrawals nell'ecosistema USDC)
├─ LiquidityManager-WBTC.sol (rebalancing + automatic withdrawals nell'ecosistema WBTC)
├─ RebalanceBot.sol (futuro - automatic cross-ecosystem rebalancing)
├─ EmergencyHandler.sol (futuro - emergency swaps)
└─ Owner (via special functions - futuro)

❌ NOT AUTHORIZED:
└─ Random users / External contracts
```

### **Deployment Authorization Flow**

```solidity
// Step 1: Deploy SwapManager (SHARED tra tutti gli ecosistemi)
SwapManager swapManager = new SwapManager(beaconAddress);

// Step 2: Deploy LiquidityManager per ogni ecosistema
LiquidityManager liquidityManagerETH = new LiquidityManager(..., address(swapManager));
LiquidityManager liquidityManagerUSDC = new LiquidityManager(..., address(swapManager));
LiquidityManager liquidityManagerWBTC = new LiquidityManager(..., address(swapManager));

// Step 3: Autorizza TUTTI i LiquidityManager
swapManager.authorizeCaller(address(liquidityManagerETH));   // ✅ Authorized
swapManager.authorizeCaller(address(liquidityManagerUSDC));  // ✅ Authorized
swapManager.authorizeCaller(address(liquidityManagerWBTC));  // ✅ Authorized

// Step 4: Autorizza altri moduli (futuro)
swapManager.authorizeCaller(rebalanceBotAddress);            // ✅ Authorized
swapManager.authorizeCaller(emergencyHandlerAddress);        // ✅ Authorized

// Verifica
console.log(swapManager.authorizedCallers(liquidityManagerETHAddress));  // true
console.log(swapManager.authorizedCallers(randomUserAddress));           // false
```

### **Runtime Authorization Check**

```solidity
// In SwapManager.sol
modifier onlyAuthorized() {
    require(authorizedCallers[msg.sender], "SwapManager: Not authorized");
    _;
}

// Tutte le funzioni swap usano il modifier:
function swapWithBestPlugin(...) external onlyAuthorized nonReentrant { ... }
function swapViaPlugin(...) external onlyAuthorized nonReentrant { ... }

// Esempio chiamate:
liquidityManagerETH.rebalance();  // ✅ Chiama swapManager.swapWithBestPlugin() → SUCCESS
randomUser.callSwapManager();     // ❌ Tenta swapManager.swapWithBestPlugin() → REVERT
```

### **Authorization Management**

```solidity
// Solo owner può gestire autorizzazioni
function authorizeCaller(address caller) external onlyOwner {
    require(caller != address(0), "Invalid caller");
    require(!authorizedCallers[caller], "Already authorized");
    authorizedCallers[caller] = true;
    emit CallerAuthorized(caller);
}

function revokeCaller(address caller) external onlyOwner {
    require(authorizedCallers[caller], "Not authorized");
    authorizedCallers[caller] = false;
    emit CallerRevoked(caller);
}
```

---

## 🔄 **REBALANCING INTEGRATION**

### **LiquidityManager Integration**

Ogni LiquidityManager (ETH/USDC/WBTC) utilizza SwapManager per rebalancing automatico.

```solidity
// Esempio: LiquidityManager-ETH.sol
contract LiquidityManagerETH {
    
    ISwapManager public immutable swapManager;
    
    // Target allocation (basis points)
    uint256 public constant TARGET_ETH_BPS = 5000;   // 50%
    uint256 public constant TARGET_USDC_BPS = 3000;  // 30%
    uint256 public constant TARGET_WBTC_BPS = 2000;  // 20%
    
    uint256 public constant REBALANCE_THRESHOLD = 500; // 5% deviation
    uint256 public constant MIN_SWAP_AMOUNT = 0.01 ether;
    
    constructor(address _swapManager, ...) {
        swapManager = ISwapManager(_swapManager);
    }
    
    /**
     * @notice Rebalancing automatico del pool ETH
     * @dev Owner chiama, SwapManager seleziona automaticamente miglior plugin
     */
    function rebalance() external onlyOwner {
        // 1. Calcola allocation corrente
        (uint256 ethValue, uint256 usdcValue, uint256 wbtcValue, uint256 totalValue) = 
            _calculateCurrentAllocation();
        
        // 2. Identifica asset in excess e deficit
        (address excessAsset, uint256 excessAmount, address deficitAsset) = 
            _identifyRebalanceNeeds(ethValue, usdcValue, wbtcValue, totalValue);
        
        // Se non serve rebalancing, exit
        if (excessAmount < MIN_SWAP_AMOUNT) {
            emit RebalanceNotNeeded(totalValue);
            return;
        }
        
        // 3. Esegui swap AUTOMATICO con miglior plugin
        uint256 receivedAmount = _executeRebalanceSwap(
            excessAsset, 
            deficitAsset, 
            excessAmount
        );
        
        emit Rebalanced(excessAsset, deficitAsset, excessAmount, receivedAmount);
    }
    
    /**
     * @notice Preview rebalancing senza eseguirlo
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
        (uint256 ethValue, uint256 usdcValue, uint256 wbtcValue, uint256 totalValue) = 
            _calculateCurrentAllocation();
        
        (excessAsset, excessAmount, deficitAsset) = 
            _identifyRebalanceNeeds(ethValue, usdcValue, wbtcValue, totalValue);
        
        needsRebalance = excessAmount >= MIN_SWAP_AMOUNT;
        
        if (!needsRebalance) {
            return (false, address(0), 0, address(0), 0, "");
        }
        
        // Get best quote da SwapManager
        (bestPlugin, expectedReceive) = swapManager.getBestQuote(
            ISwapPlugin.QuoteParams({
                tokenIn: excessAsset,
                tokenOut: deficitAsset,
                amountIn: excessAmount,
                extraData: ""
            })
        );
    }
    
    /**
     * @notice Confronta quote da tutti i plugin
     */
    function getRebalanceQuotes(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (
        ISwapPlugin.Quote[] memory quotes,
        string[] memory pluginNames
    ) {
        return swapManager.getAllQuotes(
            ISwapPlugin.QuoteParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                amountIn: amountIn,
                extraData: ""
            })
        );
    }
    
    // ==================== INTERNAL FUNCTIONS ====================
    
    function _executeRebalanceSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal returns (uint256 amountOut) {
        
        // Calcola minimum output (2% slippage tolerance)
        uint256 minAmountOut = _calculateMinOutput(tokenIn, tokenOut, amountIn, 200);
        
        // Approva SwapManager
        IERC20(tokenIn).approve(address(swapManager), amountIn);
        
        // Esegui swap - SwapManager trova automaticamente miglior plugin!
        amountOut = swapManager.swapWithBestPlugin(
            ISwapPlugin.SwapParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                amountIn: amountIn,
                minAmountOut: minAmountOut,
                recipient: address(this), // LiquidityManager riceve
                deadline: block.timestamp + 300, // 5 minuti
                extraData: ""
            })
        );
        
        require(amountOut >= minAmountOut, "Slippage too high");
        
        return amountOut;
    }
    
    function _calculateCurrentAllocation() 
        internal 
        view 
        returns (uint256 ethValue, uint256 usdcValue, uint256 wbtcValue, uint256 totalValue) 
    {
        // Implementation: get balances + convert to USD using oracle
        // ...
    }
    
    function _identifyRebalanceNeeds(
        uint256 ethValue,
        uint256 usdcValue,
        uint256 wbtcValue,
        uint256 totalValue
    ) internal pure returns (address excessAsset, uint256 excessAmount, address deficitAsset) {
        // Calculate current percentages
        uint256 currentEthBps = (ethValue * 10000) / totalValue;
        uint256 currentUsdcBps = (usdcValue * 10000) / totalValue;
        uint256 currentWbtcBps = (wbtcValue * 10000) / totalValue;
        
        // Find deviations
        int256 ethDeviation = int256(currentEthBps) - int256(TARGET_ETH_BPS);
        int256 usdcDeviation = int256(currentUsdcBps) - int256(TARGET_USDC_BPS);
        int256 wbtcDeviation = int256(currentWbtcBps) - int256(TARGET_WBTC_BPS);
        
        // Identify excess asset (largest positive deviation)
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
    ) internal view returns (uint256) {
        // Get expected output from SwapManager best quote
        (, uint256 expectedOutput) = swapManager.getBestQuote(
            ISwapPlugin.QuoteParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                amountIn: amountIn,
                extraData: ""
            })
        );
        
        // Apply slippage
        return expectedOutput * (10000 - slippageBps) / 10000;
    }
}
```

### **Automatic Withdraw Swaps**

Oltre al rebalancing manuale, LiquidityManager usa SwapManager anche per automatic withdrawals.

```solidity
// In LiquidityManager-ETH._executeAutomaticSwap()
function _executeAutomaticSwap(uint256 wethNeeded, ...) internal {
    // Seleziona token da swappare (es: USDC → WETH)
    (string memory tokenCode, uint256 amount) = calculator.selectTokenForSwap(wethNeeded);
    address tokenAddress = tokenManager.getTokenAddress(tokenCode);
    
    // Approva SwapManager
    IERC20(tokenAddress).approve(address(swapManager), amount);
    
    // Esegui swap con BEST PLUGIN automaticamente
    uint256 received = swapManager.swapWithBestPlugin(
        ISwapPlugin.SwapParams({
            tokenIn: tokenAddress,
            tokenOut: wethAddress,
            amountIn: amount,
            minAmountOut: minWeth,
            recipient: address(proxyGeneral),
            deadline: block.timestamp + 300,
            extraData: ""
        })
    );
    
    emit AutomaticSwapExecuted(tokenCode, "WETH", amount, received);
}
```

---

## 🛣️ **IMPLEMENTATION ROADMAP**

### **Phase 1: Foundation (Priorità ALTA) - 2-3 settimane**

**Obiettivo**: Sistema plugin base + UniswapV3 funzionante

**Tasks**:
1. ✅ Refactor Beacon.sol
   - Aggiungere `ModuleCategory` enum (CORE, SWAP_PLUGIN, UTILITY)
   - Implementare `getAllSwapPlugins()`
   - Testing completo

2. ✅ Implementare ISwapPlugin.sol
   - Interface standard con SwapParams/QuoteParams/Quote structs
   - Feature flags library
   - Custom errors

3. ✅ Refactor SwapManager.sol
   - Integration con Beacon
   - Authorization system (`authorizeCaller`, `onlyAuthorized`)
   - `swapWithBestPlugin()` logic
   - `swapViaPlugin()` logic
   - View functions (`getAllQuotes`, `getBestQuote`)

4. ✅ Implementare UniswapV3Plugin.sol
   - Basic swap functionality
   - Quote calculation
   - Fee tier selection (0.01%, 0.05%, 0.3%, 1%)
   - Pool discovery

5. ✅ Testing Completo
   - Unit tests per ogni componente
   - Integration tests con LiquidityManager-ETH/USDC/WBTC
   - E2E scenarios (rebalancing, automatic withdrawals)
   - Gas benchmarking

**Deliverables**:
- `contracts/Beacon.sol` (refactored)
- `contracts/interfaces/ISwapPlugin.sol`
- `contracts/SwapManager.sol` (refactored)
- `contracts/plugins/UniswapV3Plugin.sol`
- Test suite completa (>95% coverage)

**Timeline**: 2-3 settimane

---

### **Phase 2: Yield Tokens Support - 1-2 settimane**

**Obiettivo**: Supporto Pendle per PT/YT tokens

**Tasks**:
1. Implementare `PendlePlugin.sol`
2. Gestione maturity e APY calculation
3. Swap strategies per yield tokens
4. Testing con PT/YT tokens reali

**Deliverables**:
- `contracts/plugins/PendlePlugin.sol`
- Yield calculation utilities
- Test suite Pendle-specific

**Timeline**: 1-2 settimane

---

### **Phase 3: MEV Protection - 1-2 settimane**

**Obiettivo**: Integrazione Odos per MEV-protected swaps

**Tasks**:
1. Implementare `OdosPlugin.sol`
2. MEV protection features
3. Route optimization
4. Testing MEV scenarios

**Deliverables**:
- `contracts/plugins/OdosPlugin.sol`
- MEV protection utilities
- Test suite anti-MEV

**Timeline**: 1-2 settimane

---

### **Phase 4: Multi-DEX Aggregation - 1-2 settimane**

**Obiettivo**: Integrazione 1inch per best execution

**Tasks**:
1. Implementare `1inchPlugin.sol`
2. Smart routing across multiple DEX
3. Gas optimization
4. Benchmarking vs altri plugin

**Deliverables**:
- `contracts/plugins/1inchPlugin.sol`
- Routing algorithms
- Performance benchmarks

**Timeline**: 1-2 settimane

---

## 💻 **USAGE EXAMPLES**

### **Esempio 1: Rebalancing Automatico (ETH Ecosystem)**

```typescript
// Owner esegue rebalancing nell'ecosistema ETH
const liquidityManagerETH = await ethers.getContractAt(
    "LiquidityManager", 
    LIQUIDITY_MANAGER_ETH_ADDRESS
);

// Preview prima di eseguire
const preview = await liquidityManagerETH.previewRebalance();
console.log("Needs rebalance:", preview.needsRebalance);
console.log("Sell:", ethers.formatEther(preview.excessAmount), "of", preview.excessAsset);
console.log("Buy:", preview.deficitAsset);
console.log("Expected receive:", ethers.formatUnits(preview.expectedReceive, 6));
console.log("Best plugin:", preview.bestPlugin); // "odos"

// Output:
// Needs rebalance: true
// Sell: 5.5 of 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1 (WETH)
// Buy: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 (USDC)
// Expected receive: 10450.00
// Best plugin: odos

// Esegui rebalancing
const tx = await liquidityManagerETH.rebalance();
await tx.wait();

// SwapManager automaticamente:
// 1. Query Uniswap V3: 5.5 ETH → 10,350 USDC
// 2. Query Pendle: Non supporta questa coppia
// 3. Query Odos: 5.5 ETH → 10,450 USDC ← BEST!
// 4. Esegue swap con Odos
// 5. LiquidityManagerETH riceve 10,450 USDC

console.log("✅ Rebalanced with best available price (Odos)");
```

---

### **Esempio 2: Manual Plugin Selection (Yield Tokens)**

```typescript
// Caso d'uso: Swap verso PT-USDC (solo su Pendle)
const liquidityManagerUSDC = await ethers.getContractAt(
    "LiquidityManager",
    LIQUIDITY_MANAGER_USDC_ADDRESS
);

// Ottieni quote da tutti i plugin
const { quotes, pluginNames } = await liquidityManagerUSDC.getRebalanceQuotes(
    USDC_ADDRESS,
    PT_USDC_ADDRESS, // Principal Token USDC (Pendle)
    ethers.parseUnits("10000", 6)
);

for (let i = 0; i < pluginNames.length; i++) {
    console.log(`${pluginNames[i]}: ${quotes[i].isValid ? quotes[i].amountOut : "Not supported"}`);
}

// Output:
// uniswap: Not supported (no PT-USDC pool)
// pendle: 9850 PT-USDC ← ONLY ONE!
// odos: Not supported
// 1inch: Not supported

// In questo caso, usiamo swapViaPlugin() direttamente
// (swapWithBestPlugin() funzionerebbe comunque, trovando solo Pendle)

const swapManager = await ethers.getContractAt("SwapManager", SWAP_MANAGER_ADDRESS);

// Approva e swap manuale
await usdc.approve(swapManager.address, ethers.parseUnits("10000", 6));

const tx = await swapManager.swapViaPlugin(
    "pendle", // Plugin specifico!
    {
        tokenIn: USDC_ADDRESS,
        tokenOut: PT_USDC_ADDRESS,
        amountIn: ethers.parseUnits("10000", 6),
        minAmountOut: ethers.parseUnits("9750", 18), // 2.5% slippage
        recipient: liquidityManagerUSDC.address,
        deadline: (await ethers.provider.getBlock("latest")).timestamp + 300,
        extraData: "0x"
    }
);

console.log("✅ Swapped to PT-USDC via Pendle");
```

---

### **Esempio 3: Cross-Ecosystem Scenario**

```typescript
// Scenario: 3 ecosistemi diversi usano STESSO SwapManager

// Ecosistema ETH fa rebalancing
console.log("=== ETH Ecosystem Rebalancing ===");
await liquidityManagerETH.rebalance();
// SwapManager sceglie Odos: 5 ETH → 9,500 USDC

// Ecosistema USDC fa rebalancing
console.log("=== USDC Ecosystem Rebalancing ===");
await liquidityManagerUSDC.rebalance();
// SwapManager sceglie Uniswap: 10,000 USDC → 0.525 WBTC

// Ecosistema WBTC fa rebalancing
console.log("=== WBTC Ecosystem Rebalancing ===");
await liquidityManagerWBTC.rebalance();
// SwapManager sceglie 1inch: 0.1 WBTC → 1.95 ETH

// Tutti e 3 gli ecosistemi:
// - Condividono STESSO SwapManager
// - Condividono STESSI plugin
// - Ottengono automaticamente BEST PRICE disponibile
// - Sono autorizzati a chiamare SwapManager

console.log("✅ All ecosystems rebalanced with best prices");
```

---

### **Esempio 4: Setup Autorizzazioni**

```typescript
// Durante deployment iniziale
const beacon = await Beacon.deploy();
const swapManager = await SwapManager.deploy(beacon.address);

// Deploy ecosistemi
const liquidityManagerETH = await LiquidityManagerETH.deploy(swapManager.address, ...);
const liquidityManagerUSDC = await LiquidityManagerUSDC.deploy(swapManager.address, ...);
const liquidityManagerWBTC = await LiquidityManagerWBTC.deploy(swapManager.address, ...);

// Autorizza TUTTI i LiquidityManager
await swapManager.authorizeCaller(liquidityManagerETH.address);
await swapManager.authorizeCaller(liquidityManagerUSDC.address);
await swapManager.authorizeCaller(liquidityManagerWBTC.address);

console.log("✅ All LiquidityManagers authorized");

// Verifica autorizzazioni
const isETHAuthorized = await swapManager.authorizedCallers(liquidityManagerETH.address);
const isUSDCAuthorized = await swapManager.authorizedCallers(liquidityManagerUSDC.address);
const isWBTCAuthorized = await swapManager.authorizedCallers(liquidityManagerWBTC.address);
const isUserAuthorized = await swapManager.authorizedCallers(userAddress);

console.log("ETH authorized:", isETHAuthorized);   // true
console.log("USDC authorized:", isUSDCAuthorized); // true
console.log("WBTC authorized:", isWBTCAuthorized); // true
console.log("User authorized:", isUserAuthorized); // false ← Security!
```

---

## 🛡️ **SECURITY CONSIDERATIONS**

### **1. Authorization Security**

```solidity
// ✅ GOOD: Solo autorizzati
modifier onlyAuthorized() {
    require(authorizedCallers[msg.sender], "Not authorized");
    _;
}

// ❌ BAD: Chiunque può chiamare
function swapWithBestPlugin(...) external { // NO MODIFIER!
    // Vulnerability: users can drain funds
}
```

### **2. Slippage Protection**

```solidity
// ✅ GOOD: minAmountOut calcolato con slippage tolerance
uint256 minAmountOut = expectedOutput * (10000 - slippageBps) / 10000;

// ❌ BAD: No protection
minAmountOut: 0 // Vulnerability: sandwich attacks
```

### **3. Deadline Protection**

```solidity
// ✅ GOOD: Deadline ragionevole
deadline: block.timestamp + 300 // 5 minuti

// ❌ BAD: No deadline
deadline: type(uint256).max
```

### **4. Reentrancy Protection**

```solidity
// ✅ GOOD: nonReentrant modifier
function swapWithBestPlugin(...) external onlyAuthorized nonReentrant { ... }
```

### **5. Token Approval Management**

```solidity
// ✅ GOOD: Approve exact amount
IERC20(tokenIn).approve(swapManager, amountIn);

// ❌ BAD: Unlimited approval
IERC20(tokenIn).approve(swapManager, type(uint256).max);
```

---

## 📊 **APPENDIX: RESOLVED INCONSISTENCIES**

### **Incongruenze Identificate e Risolte**

Durante la consolidazione di folder 12 e folder 17, sono state identificate e risolte le seguenti incongruenze:

| Incongruenza | Folder 12 | Folder 17 | Decisione |
|--------------|-----------|-----------|-----------|
| **ISwapPlugin.swap() signature** | SwapParams struct (7 fields) | 5 parametri separati | ✅ **Usato struct** (più estendibile) |
| **getQuote() return type** | Quote struct (6 fields) | `(uint256, bool)` | ✅ **Usato struct** (più informazioni) |
| **SwapManager definition** | Dettagliato in PLUGIN_ARCHITECTURE.md | Ridefinito in folder 17 | ✅ **Consolidato** in questo documento |
| **Timeline** | Quarter-based (Q1-Q4 2026) | Week-based (2-3 settimane) | ✅ **Usato settimane** (più realistico per Phase 1) |
| **Rebalancing logic** | Solo in LIQUIDITY_MANAGER_INTEGRATION.md | Duplicato con esempi extra | ✅ **Unificato** con esempi completi |
| **Authorization flow** | Documentato in PLUGIN_ARCHITECTURE.md | Duplicato identico | ✅ **Consolidato** in sezione unica |

### **Coerenze Mantenute**

- ✅ Architettura Beacon-based con `ModuleCategory.SWAP_PLUGIN`
- ✅ Tre ecosistemi separati (ETH/USDC/WBTC) con deployment indipendenti
- ✅ SwapManager condiviso tra tutti gli ecosistemi
- ✅ Authorization system con `authorizedCallers` mapping
- ✅ Dual-mode swap: `swapWithBestPlugin()` (auto) e `swapViaPlugin()` (manual)

---

## ✅ **SUMMARY**

### **Cosa Abbiamo Consolidato**

Questo documento unifica:
- **Folder 12** (docs/12_swap_modularity/): Architettura plugin, interface specifications, Beacon integration
- **Folder 17** (docs/17_swap_modularity_&_rebalance/): Rebalancing integration, authorization model, esempi pratici

### **Decisioni Architetturali Finali**

1. ✅ **Interface Definitiva**: Struct-based (SwapParams, QuoteParams, Quote) per estendibilità
2. ✅ **SwapManager**: Condiviso tra tutti e 3 gli ecosistemi (ETH/USDC/WBTC)
3. ✅ **Authorization**: Solo moduli interni autorizzati, NO utenti esterni
4. ✅ **Plugin Selection**: Dual-mode (automatic best price + manual plugin)
5. ✅ **Rebalancing**: Integrazione seamless con LiquidityManager di ogni ecosistema

### **Prossimi Passi**

1. **Week 1-2**: Implementare Beacon refactor + SwapManager refactor
2. **Week 3**: Implementare UniswapV3Plugin + testing completo
3. **Week 4-5**: Phase 2 (Pendle) e Phase 3 (Odos)
4. **Week 6**: Phase 4 (1inch) + production deployment

---

**📧 Contatti**: Development Team  
**🔄 Ultimo Aggiornamento**: 14 Novembre 2025  
**📋 Stato**: Unified Architecture Documentation v2.0 - Ready for Implementation

---

**🎯 NOTA**: Questo documento sostituisce completamente il file precedente `Swap_mod_&_rebalance.md` in folder 17, consolidando tutta la documentazione di swap modularity e rebalancing in un unico riferimento autorevole.

