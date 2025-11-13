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

### **1. Plugin Registry**
```solidity
contract PluginRegistry {
    struct PluginInfo {
        address implementation;
        string name;
        string version;
        bool enabled;
        uint256 addedAt;
        address addedBy;
    }
    
    mapping(bytes32 => PluginInfo) private plugins;
    mapping(address => bool) private authorizedImplementations;
    bytes32[] private pluginKeys;
    
    function registerPlugin(
        string memory name,
        address implementation,
        string memory version
    ) external onlyOwner {
        bytes32 key = keccak256(bytes(name));
        require(plugins[key].implementation == address(0), "Plugin already exists");
        require(authorizedImplementations[implementation], "Implementation not authorized");
        
        plugins[key] = PluginInfo({
            implementation: implementation,
            name: name,
            version: version,
            enabled: true,
            addedAt: block.timestamp,
            addedBy: msg.sender
        });
        
        pluginKeys.push(key);
        emit PluginRegistered(name, implementation, version);
    }
    
    function getPlugin(string memory name) external view returns (address) {
        bytes32 key = keccak256(bytes(name));
        PluginInfo memory info = plugins[key];
        require(info.enabled, "Plugin disabled");
        return info.implementation;
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

### **3. Enhanced SwapManager**
```solidity
contract SwapManager is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    
    PluginRegistry public immutable pluginRegistry;
    
    struct SwapExecution {
        string pluginName;
        uint256 amountIn;
        uint256 amountOut;
        uint256 gasUsed;
        bool success;
    }
    
    mapping(address => SwapExecution[]) private userSwapHistory;
    
    constructor(address _pluginRegistry) {
        pluginRegistry = PluginRegistry(_pluginRegistry);
    }
    
    function swapViaPlugin(
        string memory pluginName,
        SwapParams memory params
    ) external nonReentrant returns (uint256 amountOut) {
        // Get plugin from registry
        address pluginAddress = pluginRegistry.getPlugin(pluginName);
        ISwapPlugin plugin = ISwapPlugin(pluginAddress);
        
        // Pre-swap validations
        _validateSwapParams(params);
        _transferTokensToPlugin(pluginAddress, params.tokenIn, params.amountIn);
        
        // Execute swap
        uint256 gasStart = gasleft();
        amountOut = plugin.swap(params);
        uint256 gasUsed = gasStart - gasleft();
        
        // Post-swap processing
        _recordSwapExecution(pluginName, params, amountOut, gasUsed, true);
        _handleSwapResult(params, amountOut);
        
        emit SwapExecuted(pluginName, params.tokenIn, params.tokenOut, params.amountIn, amountOut);
    }
    
    function getBestQuote(
        QuoteParams memory params
    ) external view returns (string memory bestPlugin, uint256 bestQuote) {
        string[] memory activePlugins = pluginRegistry.getActivePlugins();
        
        for (uint i = 0; i < activePlugins.length; i++) {
            try ISwapPlugin(pluginRegistry.getPlugin(activePlugins[i])).getQuote(params) returns (Quote memory quote) {
                if (quote.amountOut > bestQuote) {
                    bestQuote = quote.amountOut;
                    bestPlugin = activePlugins[i];
                }
            } catch {
                // Plugin failed, skip
                continue;
            }
        }
    }
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

**🔄 Ultimo Aggiornamento**: 3 Novembre 2025  
**✍️ Autore**: Development Team  
**📋 Status**: Architecture Draft v1.0