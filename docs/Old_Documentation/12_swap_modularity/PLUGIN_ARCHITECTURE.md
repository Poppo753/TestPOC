# 🏗️ PLUGIN ARCHITECTURE

**Versione**: 1.0  
**Data**: 3 Novembre 2025  
**Target**: Sistema modulare per swap multi-protocollo  

---

## 📋 **INDICE**

- [Principi Architetturali](#-principi-architetturali)
- [Core Components](#-core-components)
- [Plugin Lifecycle](#-plugin-lifecycle)
- [Security Model](#-security-model)
- [Performance Considerations](#-performance-considerations)

---

## 🎯 **PRINCIPI ARCHITETTURALI**

### **1. Separation of Concerns**
```
SwapManager (Core) ← gestisce → Plugin Registry
        ↓                           ↓
   User Interface              Plugin Instances
        ↓                           ↓
   Business Logic              Protocol-Specific Logic
```

### **2. Interface Segregation**
```solidity
// Core interface - Minimal e stabile
interface ISwapPlugin {
    function swap(SwapParams calldata params) external returns (uint256);
    function getQuote(QuoteParams calldata params) external view returns (Quote memory);
    function getProtocolInfo() external pure returns (ProtocolInfo memory);
}

// Extended interfaces per funzionalità specifiche
interface IAdvancedSwapPlugin is ISwapPlugin {
    function swapWithPath(PathParams calldata params) external returns (uint256);
    function getMultiHopQuote(address[] calldata path, uint256 amountIn) external view returns (uint256);
}

interface IYieldSwapPlugin is ISwapPlugin {
    function swapToYieldToken(YieldParams calldata params) external returns (uint256);
    function getYieldQuote(YieldQuoteParams calldata params) external view returns (YieldQuote memory);
}
```

### **3. Inversion of Control**
```solidity
// SwapManager non conosce implementazioni specifiche
contract SwapManager {
    function executeSwap(string memory pluginName, SwapParams memory params) external {
        ISwapPlugin plugin = getPlugin(pluginName);
        require(address(plugin) != address(0), "Plugin not found");
        
        // Delega completamente al plugin
        uint256 result = plugin.swap(params);
        
        // Handle result genericamente
        _handleSwapResult(result, params);
    }
}
```

---

## 🧩 **CORE COMPONENTS**

### **1. Beacon Integration (Updated Architecture)**

⚠️ **ARCHITETTURA AGGIORNATA**: I plugin sono ora registrati nel **Beacon** come tutti gli altri moduli, per consistenza architetturale.

📌 **IMPORTANTE - TRE ECOSISTEMI SEPARATI**: 
Questo progetto implementa **3 deployment completamente separati**:
- **ETH Ecosystem**: LiquidityManager-ETH.sol, ValueCalculator-ETH.sol, TokenManager-ETH.sol, ecc.
- **USDC Ecosystem**: LiquidityManager-USDC.sol, ValueCalculator-USDC.sol, TokenManager-USDC.sol, ecc.  
- **WBTC Ecosystem**: LiquidityManager-WBTC.sol, ValueCalculator-WBTC.sol, TokenManager-WBTC.sol, ecc.

Ogni ecosistema è un **set di contratti indipendente** con logica hardcoded per il proprio token base.  
**NON utilizziamo Strategy Pattern con strategie intercambiabili** - quella era solo un'idea non implementata.

Il **Beacon** registra:
- **CORE**: Moduli principali di ogni ecosistema (quando deployed)
- **SWAP_PLUGIN**: Plugin swap condivisi tra tutti gli ecosistemi (Uniswap, Pendle, Odos, 1inch)
- **UTILITY**: Moduli ausiliari condivisi (OracleManager, FeeCalculator, ecc.)

```solidity
contract Beacon {
    
    // Categorie di moduli
    enum ModuleCategory {
        CORE,           // LiquidityManager, ValueCalculator, SwapManager, ecc.
        SWAP_PLUGIN,    // UniswapV3Plugin, PendlePlugin, OdosPlugin, 1inchPlugin
        // ⚠️ RIMOSSA CATEGORIA "STRATEGY" - Non necessaria perché i 3 ecosistemi (ETH, USDC, WBTC)
        // sono DEPLOYMENT SEPARATI (LiquidityManager-ETH.sol, LiquidityManager-USDC.sol, ecc.),
        // NON strategie intercambiabili registrate in un unico Beacon.
        // Ogni ecosistema avrà la sua logica hardcoded nei propri contratti.
        UTILITY         // Altri moduli ausiliari (OracleManager, FeeCalculator, ecc.)
    }
    
    struct ModuleInfo {
        address implementation;
        string name;
        string version;
        ModuleCategory category;
        bool active;
        uint256 registeredAt;
    }
    
    // Mapping unificato per TUTTI i moduli
    mapping(bytes32 => ModuleInfo) public modules;
    mapping(ModuleCategory => bytes32[]) public modulesByCategory;
    
    // Registra qualsiasi tipo di modulo (core, plugin, utility)
    // ⚠️ NOTA: Ogni ecosistema (ETH/USDC/WBTC) registra i propri moduli CORE separatamente
    function registerModule(
        string memory name,
        address implementation,
        ModuleCategory category,
        string memory version
    ) external onlyOwner {
        bytes32 moduleId = keccak256(abi.encodePacked(category, name));
        require(modules[moduleId].implementation == address(0), "Module already exists");
        
        modules[moduleId] = ModuleInfo({
            implementation: implementation,
            name: name,
            version: version,
            category: category,
            active: true,
            registeredAt: block.timestamp
        });
        
        modulesByCategory[category].push(moduleId);
        emit ModuleRegistered(moduleId, name, category, implementation);
    }
    
    // Get module by name and category
    function getModule(string memory name, ModuleCategory category) 
        public view returns (address) 
    {
        bytes32 moduleId = keccak256(abi.encodePacked(category, name));
        ModuleInfo memory info = modules[moduleId];
        require(info.active, "Module not active");
        return info.implementation;
    }
    
    // Get all swap plugins (condivisi tra tutti gli ecosistemi ETH/USDC/WBTC)
    function getAllSwapPlugins() external view returns (ModuleInfo[] memory) {
        bytes32[] memory pluginIds = modulesByCategory[ModuleCategory.SWAP_PLUGIN];
        ModuleInfo[] memory plugins = new ModuleInfo[](pluginIds.length);
        
        for (uint i = 0; i < pluginIds.length; i++) {
            plugins[i] = modules[pluginIds[i]];
        }
        
        return plugins;
    }
    
    // Get all modules by category (generico per CORE, UTILITY, ecc.)
    function getModulesByCategory(ModuleCategory category) external view returns (ModuleInfo[] memory) {
        bytes32[] memory moduleIds = modulesByCategory[category];
        ModuleInfo[] memory categoryModules = new ModuleInfo[](moduleIds.length);
        
        for (uint i = 0; i < moduleIds.length; i++) {
            categoryModules[i] = modules[moduleIds[i]];
        }
        
        return categoryModules;
    }
    
    // Enable/disable specific module
    function setModuleActive(string memory name, ModuleCategory category, bool active) 
        external onlyOwner 
    {
        bytes32 moduleId = keccak256(abi.encodePacked(category, name));
        require(modules[moduleId].implementation != address(0), "Module not found");
        modules[moduleId].active = active;
        emit ModuleActiveStatusChanged(moduleId, active);
    }
}
```

### **2. Plugin Factory**
```solidity
abstract contract BaseSwapPlugin is ISwapPlugin {
    address public immutable swapManager;
    string private protocolName;
    string private protocolVersion;
    
    modifier onlySwapManager() {
        require(msg.sender == swapManager, "Only SwapManager");
        _;
    }
    
    constructor(address _swapManager, string memory _name, string memory _version) {
        swapManager = _swapManager;
        protocolName = _name;
        protocolVersion = _version;
    }
    
    function getProtocolInfo() external view override returns (ProtocolInfo memory) {
        return ProtocolInfo({
            name: protocolName,
            version: protocolVersion,
            features: _getSupportedFeatures()
        });
    }
    
    function _getSupportedFeatures() internal virtual returns (uint256);
}
```

### **3. Enhanced SwapManager (Updated)**

```solidity
contract SwapManager is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    
    // ⚠️ UPDATED: Usa Beacon invece di PluginRegistry separato
    Beacon public immutable beacon;
    
    // Autorizzazioni per chiamanti (solo moduli del protocollo)
    mapping(address => bool) public authorizedCallers;
    
    struct SwapExecution {
        string pluginName;
        uint256 amountIn;
        uint256 amountOut;
        uint256 gasUsed;
        bool success;
        uint256 timestamp;
    }
    
    // History per caller (LiquidityManager, ecc.)
    mapping(address => SwapExecution[]) private callerSwapHistory;
    
    modifier onlyAuthorized() {
        require(authorizedCallers[msg.sender], "SwapManager: Caller not authorized");
        _;
    }
    
    constructor(address _beacon) {
        beacon = Beacon(_beacon);
    }
    
    // ==================== AUTHORIZATION MANAGEMENT ====================
    
    function authorizeCaller(address caller) external onlyOwner {
        require(caller != address(0), "Invalid caller");
        authorizedCallers[caller] = true;
        emit CallerAuthorized(caller);
    }
    
    function revokeCaller(address caller) external onlyOwner {
        authorizedCallers[caller] = false;
        emit CallerRevoked(caller);
    }
    
    // ==================== SWAP EXECUTION ====================
    
    /**
     * @notice Esegue swap con plugin specifico
     * @dev Solo moduli autorizzati (es: LiquidityManager) possono chiamare
     */
    function swapViaPlugin(
        string memory pluginName,
        SwapParams memory params
    ) external onlyAuthorized nonReentrant returns (uint256 amountOut) {
        // Get plugin dal Beacon (non più da registry separato)
        address pluginAddress = beacon.getModule(pluginName, Beacon.ModuleCategory.SWAP_PLUGIN);
        require(pluginAddress != address(0), "Plugin not found in Beacon");
        
        ISwapPlugin plugin = ISwapPlugin(pluginAddress);
        
        // Pre-swap validations
        _validateSwapParams(params);
        
        // Transfer tokens from caller to plugin
        IERC20(params.tokenIn).safeTransferFrom(msg.sender, pluginAddress, params.amountIn);
        
        // Execute swap
        uint256 gasStart = gasleft();
        amountOut = plugin.swap(params);
        uint256 gasUsed = gasStart - gasleft();
        
        // Verify plugin returned tokens to caller
        require(
            IERC20(params.tokenOut).balanceOf(msg.sender) >= params.minAmountOut,
            "Insufficient output received"
        );
        
        // Record execution
        _recordSwapExecution(msg.sender, pluginName, params, amountOut, gasUsed);
        
        emit SwapExecuted(msg.sender, pluginName, params.tokenIn, params.tokenOut, params.amountIn, amountOut);
    }
    
    /**
     * @notice Esegue swap con il plugin che offre miglior prezzo
     * @dev Automaticamente trova e usa il plugin ottimale
     */
    function swapWithBestPlugin(
        SwapParams memory params
    ) external onlyAuthorized nonReentrant returns (uint256 amountOut) {
        // Get tutti i plugin dal Beacon
        Beacon.ModuleInfo[] memory plugins = beacon.getAllSwapPlugins();
        require(plugins.length > 0, "No plugins available");
        
        uint256 bestQuote = 0;
        address bestPluginAddress;
        string memory bestPluginName;
        
        // Query tutti i plugin per trovare miglior prezzo
        for (uint i = 0; i < plugins.length; i++) {
            if (!plugins[i].active) continue;
            
            try ISwapPlugin(plugins[i].implementation).getQuote(QuoteParams({
                tokenIn: params.tokenIn,
                tokenOut: params.tokenOut,
                amountIn: params.amountIn,
                extraData: params.extraData
            })) returns (Quote memory quote) {
                if (quote.isValid && quote.amountOut > bestQuote) {
                    bestQuote = quote.amountOut;
                    bestPluginAddress = plugins[i].implementation;
                    bestPluginName = plugins[i].name;
                }
            } catch {
                // Plugin failed to quote, skip
                continue;
            }
        }
        
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
        emit SwapExecuted(msg.sender, bestPluginName, params.tokenIn, params.tokenOut, params.amountIn, amountOut);
    }
    
    // ==================== VIEW FUNCTIONS ====================
    
    /**
     * @notice Ottiene quotazioni da tutti i plugin
     */
    function getAllQuotes(
        QuoteParams memory params
    ) external view returns (Quote[] memory quotes, string[] memory pluginNames) {
        Beacon.ModuleInfo[] memory plugins = beacon.getAllSwapPlugins();
        
        quotes = new Quote[](plugins.length);
        pluginNames = new string[](plugins.length);
        
        for (uint i = 0; i < plugins.length; i++) {
            pluginNames[i] = plugins[i].name;
            
            if (!plugins[i].active) {
                quotes[i] = Quote({
                    amountOut: 0,
                    slippageBps: 0,
                    gasEstimate: 0,
                    priceImpact: 0,
                    isValid: false,
                    reason: "Plugin inactive"
                });
                continue;
            }
            
            try ISwapPlugin(plugins[i].implementation).getQuote(params) returns (Quote memory quote) {
                quotes[i] = quote;
            } catch {
                quotes[i] = Quote({
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
     */
    function getBestQuote(
        QuoteParams memory params
    ) external view returns (string memory bestPlugin, uint256 bestQuote) {
        Beacon.ModuleInfo[] memory plugins = beacon.getAllSwapPlugins();
        
        for (uint i = 0; i < plugins.length; i++) {
            if (!plugins[i].active) continue;
            
            try ISwapPlugin(plugins[i].implementation).getQuote(params) returns (Quote memory quote) {
                if (quote.isValid && quote.amountOut > bestQuote) {
                    bestQuote = quote.amountOut;
                    bestPlugin = plugins[i].name;
                }
            } catch {
                continue;
            }
        }
    }
    
    /**
     * @notice Lista plugin disponibili
     */
    function getAvailablePlugins() external view returns (string[] memory pluginNames, bool[] memory statuses) {
        Beacon.ModuleInfo[] memory plugins = beacon.getAllSwapPlugins();
        
        pluginNames = new string[](plugins.length);
        statuses = new bool[](plugins.length);
        
        for (uint i = 0; i < plugins.length; i++) {
            pluginNames[i] = plugins[i].name;
            statuses[i] = plugins[i].active;
        }
    }
    
    // ==================== INTERNAL FUNCTIONS ====================
    
    function _recordSwapExecution(
        address caller,
        string memory pluginName,
        SwapParams memory params,
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
    
    function _validateSwapParams(SwapParams memory params) internal view {
        require(params.tokenIn != address(0), "Invalid tokenIn");
        require(params.tokenOut != address(0), "Invalid tokenOut");
        require(params.tokenIn != params.tokenOut, "Same token");
        require(params.amountIn > 0, "Amount zero");
        require(params.deadline >= block.timestamp, "Deadline expired");
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

## 🔄 **PLUGIN LIFECYCLE**

### **1. Development Phase**
```solidity
// Sviluppatore crea nuovo plugin
contract MyProtocolPlugin is BaseSwapPlugin {
    constructor() BaseSwapPlugin(swapManager, "MyProtocol", "1.0") {}
    
    function swap(SwapParams calldata params) external override onlySwapManager returns (uint256) {
        // Implementazione specifica del protocollo
        return _executeMyProtocolSwap(params);
    }
    
    function getQuote(QuoteParams calldata params) external view override returns (Quote memory) {
        // Quote logic specifica del protocollo
        return _getMyProtocolQuote(params);
    }
}
```

### **2. Registration Phase**
```solidity
// Owner registra il plugin
pluginRegistry.authorizeImplementation(myPluginAddress);
pluginRegistry.registerPlugin("myprotocol", myPluginAddress, "1.0");
```

### **3. Activation Phase**
```solidity
// Plugin è ora utilizzabile
swapManager.swapViaPlugin("myprotocol", swapParams);
```

### **4. Upgrade/Deactivation Phase**
```solidity
// Disabilita versione vecchia
pluginRegistry.disablePlugin("myprotocol");

// Registra versione nuova  
pluginRegistry.registerPlugin("myprotocol", newPluginAddress, "2.0");
```

---

## 🛡️ **SECURITY MODEL**

### **1. Access Control Hierarchy**
```
Owner
  ├── Can add/remove plugins
  ├── Can authorize implementations  
  └── Can emergency disable
      
SwapManager
  ├── Can call plugin functions
  ├── Manages user funds
  └── Enforces swap logic
  
Plugins
  ├── Receive funds temporarily
  ├── Execute protocol-specific logic
  └── Return funds to SwapManager
```

### **2. Security Validations**
```solidity
contract SecurityValidations {
    function validatePlugin(address plugin) external view returns (bool) {
        // 1. Check contract exists
        require(plugin.code.length > 0, "Not a contract");
        
        // 2. Check implements interface
        require(IERC165(plugin).supportsInterface(type(ISwapPlugin).interfaceId), "Invalid interface");
        
        // 3. Check not malicious
        require(!_isBlacklisted(plugin), "Blacklisted plugin");
        
        // 4. Check gas limits
        require(_checkGasLimits(plugin), "Gas limit exceeded");
        
        return true;
    }
}
```

### **3. Fund Security**
```solidity
// Plugins non mantengono mai fondi
contract PluginSecurityModel {
    function secureSwapExecution(address plugin, SwapParams memory params) internal {
        // 1. Transfer minimal funds to plugin
        IERC20(params.tokenIn).safeTransfer(plugin, params.amountIn);
        
        // 2. Execute with timeout
        uint256 deadline = block.timestamp + 5 minutes;
        require(block.timestamp <= deadline, "Execution timeout");
        
        // 3. Verify fund return
        uint256 balanceBefore = IERC20(params.tokenOut).balanceOf(address(this));
        // ... plugin execution ...
        uint256 balanceAfter = IERC20(params.tokenOut).balanceOf(address(this));
        require(balanceAfter > balanceBefore, "No tokens received");
        
        // 4. Ensure no funds left in plugin
        require(IERC20(params.tokenIn).balanceOf(plugin) == 0, "Funds stuck in plugin");
    }
}
```

---

## ⚡ **PERFORMANCE CONSIDERATIONS**

### **1. Gas Optimization**
```solidity
// Plugin calls minimizzate attraverso batch operations
function batchSwaps(BatchSwapParams[] calldata swaps) external {
    for (uint i = 0; i < swaps.length; i++) {
        // Riusa plugin instance se stesso protocollo
        if (i > 0 && keccak256(bytes(swaps[i].pluginName)) == keccak256(bytes(swaps[i-1].pluginName))) {
            // Riusa istanza
        } else {
            // Nuova istanza
        }
    }
}
```

### **2. Quote Caching**
```solidity
struct QuoteCache {
    uint256 quote;
    uint256 timestamp;
    uint256 blockNumber;
}

mapping(bytes32 => QuoteCache) private quoteCache;

function getCachedQuote(QuoteParams memory params) public view returns (uint256) {
    bytes32 key = keccak256(abi.encode(params));
    QuoteCache memory cached = quoteCache[key];
    
    // Cache valida per 5 blocchi
    if (cached.blockNumber + 5 > block.number) {
        return cached.quote;
    }
    
    return 0; // Cache expired
}
```

### **3. Lazy Loading**
```solidity
// Plugin sono caricati solo quando necessari
mapping(string => bool) private pluginLoaded;

function getPlugin(string memory name) internal returns (ISwapPlugin) {
    if (!pluginLoaded[name]) {
        _loadPlugin(name);
        pluginLoaded[name] = true;
    }
    
    return ISwapPlugin(pluginRegistry.getPlugin(name));
}
```

---

## 📊 **METRICS AND MONITORING**

### **1. Plugin Performance Tracking**
```solidity
struct PluginMetrics {
    uint256 totalSwaps;
    uint256 totalVolume;
    uint256 avgGasUsed;
    uint256 successRate;
    uint256 avgSlippage;
}

mapping(string => PluginMetrics) public pluginMetrics;
```

### **2. Health Checks**
```solidity
function checkPluginHealth(string memory pluginName) external view returns (bool healthy) {
    PluginMetrics memory metrics = pluginMetrics[pluginName];
    
    // Success rate > 95%
    require(metrics.successRate > 9500, "Low success rate");
    
    // Gas usage not excessive
    require(metrics.avgGasUsed < 500000, "High gas usage");
    
    return true;
}
```

---

## 📝 **NOTE ARCHITETTURALI IMPORTANTI**

### **Tre Ecosistemi Separati vs Strategy Pattern**

⚠️ **CHIARIMENTO FONDAMENTALE**: 

Questo progetto implementa **TRE DEPLOYMENT COMPLETAMENTE SEPARATI**, non un sistema con strategie intercambiabili:

| Aspetto | Architettura Scelta ✅ | Strategy Pattern (NON Implementato) ❌ |
|---------|------------------------|----------------------------------------|
| **Struttura** | 3 deployment separati (ETH, USDC, WBTC) | Singolo deployment con strategie swappabili |
| **Contratti** | LiquidityManager-ETH.sol, LiquidityManager-USDC.sol, ecc. | Singolo LiquidityManager.sol + IDepositStrategy interface |
| **Logica Token** | Hardcoded in ogni contratto (18 decimals ETH, 6 decimals USDC, ecc.) | Delegata a strategy intercambiabili |
| **Beacon Usage** | Registra moduli CORE di ogni ecosistema + SWAP_PLUGIN condivisi | Registrerebbe anche ModuleCategory.STRATEGY |
| **Espandibilità** | Deploy nuovo set contratti per DAI, FRAX, ecc. | Scrivi nuova strategy, registra nel Beacon |
| **Vantaggi** | Isolamento totale, sicurezza, nessuna complessità runtime | Flessibilità, single deployment, upgrade facili |
| **Status** | ✅ **SCELTA IMPLEMENTATA** | ❌ Solo idea documentata (docs/14_modularity_ideas/) |

### **Perché NON abbiamo ModuleCategory.STRATEGY nel Beacon**

La categoria `STRATEGY` è stata **rimossa** perché:

1. **Non serve**: Ogni ecosistema ha contratti separati con logica hardcoded
2. **Confondente**: Il nome "Strategy Pattern" fa pensare al design pattern GoF, ma qui significa solo "logiche diverse per token diversi"
3. **Architettura diversa**: Con 3 deployment separati, non c'è bisogno di registrare "strategie" in un registry centrale

### **Cosa Registriamo nel Beacon**

```solidity
// ✅ MODULI CORE (uno per ogni ecosistema quando deployed)
beacon.registerModule("LiquidityManager-ETH", address(...), ModuleCategory.CORE, "1.0");
beacon.registerModule("LiquidityManager-USDC", address(...), ModuleCategory.CORE, "1.0");
beacon.registerModule("ValueCalculator-ETH", address(...), ModuleCategory.CORE, "1.0");

// ✅ SWAP PLUGINS (condivisi tra tutti gli ecosistemi)
beacon.registerModule("uniswap", address(...), ModuleCategory.SWAP_PLUGIN, "1.0");
beacon.registerModule("pendle", address(...), ModuleCategory.SWAP_PLUGIN, "1.0");
beacon.registerModule("odos", address(...), ModuleCategory.SWAP_PLUGIN, "1.0");

// ✅ UTILITY (condivisi)
beacon.registerModule("OracleManager", address(...), ModuleCategory.UTILITY, "1.0");
beacon.registerModule("FeeCalculator", address(...), ModuleCategory.UTILITY, "1.0");

// ❌ NON registriamo "ETHDepositStrategy", "USDCDepositStrategy" - non esistono come contratti separati!
// La logica di deposit per ETH è hardcoded in LiquidityManager-ETH.sol
```

---

**🔄 Ultimo Aggiornamento**: 13 Novembre 2025 (Corretto architettura Beacon)  
**✍️ Autore**: Development Team  
**📋 Status**: Architecture Documentation - Corrected v1.1