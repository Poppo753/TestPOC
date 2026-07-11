Perfetto! 🎯 Sì, avevo capito esattamente quello che vuoi: un sistema **plug-and-play** dove puoi aggiungere nuovi router **senza mai rideployare** i contratti core. Lascia che ti mostri come fare: 

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/SwapManager.sol#1-1), lines 1 to 51

Esatto! Il problema è che attualmente hai **hardcoded** un solo router. Ecco come trasformarlo in un sistema **modulare plug-and-play**:

## 🎯 **SOLUZIONE: Plugin System Modulare**

### **SCENARIO ATTUALE (Problematico):**
```solidity
// ❌ Hardcoded - devi rideployare tutto per aggiungere router
contract SwapManager {
    address public simpleSwapRouter;  // Solo questo!
    
    function swapERC20(...) external {
        ISimpleSwap(simpleSwapRouter).inputSwap(...); // Solo SimpleSwap
    }
}
```

### **SCENARIO TARGET (Plug-and-Play):**
```solidity
// ✅ Modulare - aggiungi router senza rideployare
contract SwapManager {
    mapping(string => address) public swapPlugins;  // "uniswap", "pendle", "odos"
    mapping(string => bool) public pluginEnabled;
    
    // Aggiungi NUOVI router senza rideployare SwapManager
    function addPlugin(string memory name, address plugin) external onlyOwner {
        swapPlugins[name] = plugin;
        pluginEnabled[name] = true;
    }
    
    // Usa qualsiasi router installato
    function swapViaPlugin(string memory pluginName, ...) external {
        address plugin = swapPlugins[pluginName];
        ISwapPlugin(plugin).swap(...);
    }
}
```

## 🚀 **WORKFLOW FUTURO (Zero Redeploy):**

### **Settimana 1: Deploy Sistema Base**
```typescript
// 1. Deploy SwapManager con supporto plugin
const swapManager = await SwapManager.deploy(beacon.address);

// 2. Deploy primo plugin (SimpleSwap wrapper)
const simpleSwapPlugin = await SimpleSwapPlugin.deploy(simpleSwapRouter);

// 3. Registra plugin
await swapManager.addPlugin("simple", simpleSwapPlugin.address);
```

### **Settimana 3: Aggiungi Uniswap (ZERO REDEPLOY!)**
```typescript
// 1. Sviluppi UniswapPlugin
const uniswapPlugin = await UniswapV3Plugin.deploy();

// 2. Lo aggiungi senza toccare nient'altro
await swapManager.addPlugin("uniswap", uniswapPlugin.address);

// 3. SwapManager ora supporta ENTRAMBI!
await swapManager.swapViaPlugin("uniswap", params); // Nuovo
await swapManager.swapViaPlugin("simple", params);  // Vecchio ancora funziona
```

### **Settimana 5: Aggiungi Pendle (ZERO REDEPLOY!)**
```typescript
// Stesso processo - ZERO modifiche ai contratti esistenti
const pendlePlugin = await PendlePlugin.deploy();
await swapManager.addPlugin("pendle", pendlePlugin.address);

// Ora hai 3 router disponibili!
```

## 🛠️ **IMPLEMENTAZIONE PRATICA**

### **Step 1: Refactor SwapManager Attuale**
```solidity
contract SwapManager {
    // ==================== NEW PLUGIN SYSTEM ====================
    
    /// @notice Plugin registry
    mapping(string => address) public swapPlugins;
    mapping(string => bool) public pluginEnabled;
    string[] public availablePlugins;
    
    /// @notice Plugin management
    function addPlugin(string memory name, address plugin) external onlyOwner {
        require(plugin != address(0), "Invalid plugin");
        require(bytes(name).length > 0, "Invalid name");
        
        // Se non esiste, aggiungilo alla lista
        if (swapPlugins[name] == address(0)) {
            availablePlugins.push(name);
        }
        
        swapPlugins[name] = plugin;
        pluginEnabled[name] = true;
        
        emit PluginAdded(name, plugin);
    }
    
    function removePlugin(string memory name) external onlyOwner {
        require(swapPlugins[name] != address(0), "Plugin not found");
        
        delete swapPlugins[name];
        delete pluginEnabled[name];
        
        // Remove from array (expensive but rare operation)
        for (uint i = 0; i < availablePlugins.length; i++) {
            if (keccak256(bytes(availablePlugins[i])) == keccak256(bytes(name))) {
                availablePlugins[i] = availablePlugins[availablePlugins.length - 1];
                availablePlugins.pop();
                break;
            }
        }
        
        emit PluginRemoved(name);
    }
    
    function enablePlugin(string memory name, bool enabled) external onlyOwner {
        require(swapPlugins[name] != address(0), "Plugin not found");
        pluginEnabled[name] = enabled;
        emit PluginToggled(name, enabled);
    }
    
    // ==================== BACKWARD COMPATIBILITY ====================
    
    // Mantieni funzioni esistenti che usano SimpleSwap
    function swapERC20(...) external {
        // Internamente usa il plugin "simple"
        swapViaPlugin("simple", ...);
    }
    
    // ==================== NEW PLUGIN INTERFACE ====================
    
    function swapViaPlugin(
        string memory pluginName,
        string memory spendTokenCode,
        string memory receiveTokenCode,
        uint256 amount,
        uint256 minReceived
    ) public returns (uint256 received) {
        require(pluginEnabled[pluginName], "Plugin disabled");
        
        address plugin = swapPlugins[pluginName];
        require(plugin != address(0), "Plugin not found");
        
        // Call plugin with standardized interface
        received = ISwapPlugin(plugin).swap(
            spendTokenCode,
            receiveTokenCode, 
            amount,
            minReceived,
            msg.sender
        );
    }
    
    function getBestQuote(
        string memory spendToken,
        string memory receiveToken,
        uint256 amount
    ) external view returns (string memory bestPlugin, uint256 bestQuote) {
        for (uint i = 0; i < availablePlugins.length; i++) {
            string memory pluginName = availablePlugins[i];
            
            if (!pluginEnabled[pluginName]) continue;
            
            try ISwapPlugin(swapPlugins[pluginName]).getQuote(spendToken, receiveToken, amount) 
                returns (uint256 quote) {
                if (quote > bestQuote) {
                    bestQuote = quote;
                    bestPlugin = pluginName;
                }
            } catch {
                // Plugin failed, skip
                continue;
            }
        }
    }
    
    function swapWithBestPrice(...) external returns (uint256) {
        (string memory bestPlugin,) = getBestQuote(...);
        require(bytes(bestPlugin).length > 0, "No available plugins");
        
        return swapViaPlugin(bestPlugin, ...);
    }
}
```

### **Step 2: Interface Standard per Plugin**
```solidity
interface ISwapPlugin {
    function swap(
        string memory spendToken,
        string memory receiveToken,
        uint256 amount,
        uint256 minReceived,
        address recipient
    ) external returns (uint256 received);
    
    function getQuote(
        string memory spendToken,
        string memory receiveToken,
        uint256 amount
    ) external view returns (uint256 expectedOutput);
    
    function getProtocolName() external pure returns (string memory);
    function isHealthy() external view returns (bool);
}
```

### **Step 3: Wrapper per SimpleSwap Esistente**
```solidity
contract SimpleSwapPlugin is ISwapPlugin {
    address public immutable simpleSwapRouter;
    address public immutable swapManager;
    
    constructor(address _router, address _swapManager) {
        simpleSwapRouter = _router;
        swapManager = _swapManager;
    }
    
    modifier onlySwapManager() {
        require(msg.sender == swapManager, "Only SwapManager");
        _;
    }
    
    function swap(...) external override onlySwapManager returns (uint256) {
        // Usa la logica SimpleSwap esistente
        return ISimpleSwap(simpleSwapRouter).inputSwap(...);
    }
    
    function getQuote(...) external view override returns (uint256) {
        return ISimpleSwap(simpleSwapRouter).getExpectedOutput(...);
    }
    
    function getProtocolName() external pure override returns (string memory) {
        return "SimpleSwap";
    }
}
```

## 🎯 **BENEFICI IMMEDIATI:**

1. **✅ Zero Breaking Changes**: Tutte le funzioni esistenti continuano a funzionare
2. **✅ Backward Compatible**: Il codice frontend non cambia
3. **✅ Plug-and-Play**: Aggiungi router quando vuoi
4. **✅ A/B Testing**: Testa nuovi router senza rischi
5. **✅ Fallback**: Se un router si rompe, usi gli altri
6. **✅ Best Price**: Automaticamente scegli il migliore

## 🚀 **DEPLOYMENT PLAN:**

### **Fase 1: Refactor Esistente**
```typescript
// 1. Upgrade SwapManager con supporto plugin
// 2. Deploy SimpleSwapPlugin (wrapper)
// 3. Registra SimpleSwap come primo plugin
// 4. Test che tutto funzioni come prima
```

### **Fase 2: Aggiunta Router**
```typescript
// Quando sviluppi nuovo router:
// 1. Deploy NewRouterPlugin
// 2. await swapManager.addPlugin("newrouter", pluginAddress)
// 3. Test in parallelo con quello esistente
// 4. Enable quando sicuro
```

Adesso è chiaro? Il sistema ti permette di **aggiungere qualsiasi router** in futuro senza mai dover rideployare o modificare i contratti esistenti! 🔥