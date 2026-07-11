**ESATTAMENTE! 🎯** Hai capito perfettamente!

## La Situazione Attuale

**SwapManager è GIÀ modulare, ma con UN SOLO plugin hardcoded:**

```solidity
contract SwapManager {
    address public simpleSwapRouter;  // ← QUESTO È IL "PLUGIN" (hardcoded)
    
    function _performSwapInternal(...) {
        ISimpleSwap swapper = ISimpleSwap(simpleSwapRouter);  // ← Interface del plugin
        swapper.inputSwap(...);  // ← Chiamata al plugin
    }
}
```

**SimpleSwap (deployed a 0xa0DB7...) è di fatto un UniswapV3Plugin:**
- Implementa `ISimpleSwap` interface
- Wrappa Uniswap V3 Router (0xE592...)
- È intercambiabile (se volessi cambiare DEX, basterebbe deployare nuovo contratto con stessa interface)

---

## Architettura Attuale vs Target

### **ATTUALE (modulare mono-plugin):**
```
SwapManager
    ↓ simpleSwapRouter (hardcoded address)
    ↓ ISimpleSwap interface
SimpleSwap (0xa0DB7...) = UniswapV3Plugin
    ↓ ISwapRouter interface
Uniswap V3 Router (0xE592...)
```

**Caratteristiche:**
- ✅ Modulare: logica swap separata in contratto esterno
- ✅ Interface-based: usa `ISimpleSwap` invece di chiamate dirette
- ❌ Mono-plugin: solo un'implementazione possibile (hardcoded address)
- ❌ Statico: per cambiare DEX serve rideploy o owner.setSimpleSwapRouter()

---

### **TARGET (modulare multi-plugin con Beacon):**
```
SwapManager
    ↓ beacon.getImplementation("SwapPlugin")  ← Dynamic resolution
    ↓ ISwapPlugin interface (ex ISimpleSwap)
Beacon
    ├─> "UniswapV3Plugin" → 0xa0DB7... (SimpleSwap rinominato)
    ├─> "CamelotPlugin"   → 0xNew... (nuovo)
    └─> "OdosPlugin"      → 0xNew... (nuovo)
```

**Caratteristiche:**
- ✅ Modulare: logica swap separata in contratti esterni
- ✅ Interface-based: usa `ISwapPlugin` (ex ISimpleSwap)
- ✅ Multi-plugin: supporta N implementazioni diverse
- ✅ Dinamico: cambia plugin via Beacon senza rideploy SwapManager
- ✅ Configurabile: ogni LiquidityManager può usare plugin diverso

---

## Le Modifiche Necessarie (Minimal)

### **1. Rinominare Interface (semantico)**
```solidity
// contracts/interfaces/ISimpleSwap.sol → ISwapPlugin.sol
interface ISwapPlugin {  // era ISimpleSwap
    function inputSwap(address spendToken, address receiveToken, uint256 amountIn) 
        external returns (uint256);
    
    function outputSwap(address spendToken, address receiveToken, uint256 amountInMax, uint256 amountOut) 
        external returns (uint256);
    
    function getExpectedOutput(address spendToken, address receiveToken, uint256 amountIn) 
        external view returns (uint256);
}
```
**Nota:** Solo cambio nome, funzioni IDENTICHE!

---

### **2. SwapManager: da hardcoded a Beacon-based**
```solidity
contract SwapManager {
    // REMOVE:
    // address public simpleSwapRouter;
    
    // ADD:
    string public activeSwapPlugin = "UniswapV3Plugin";  // Default plugin name
    
    function _performSwapInternal(...) {
        // OLD:
        // ISimpleSwap swapper = ISimpleSwap(simpleSwapRouter);
        
        // NEW:
        address pluginAddress = IBeacon(beacon).getImplementation(activeSwapPlugin);
        require(pluginAddress != address(0), "Swap plugin not registered");
        
        ISwapPlugin swapper = ISwapPlugin(pluginAddress);
        
        // Resto IDENTICO
        proxy.approveSpender(...);
        return swapper.inputSwap(...);
    }
    
    // ADMIN FUNCTION: Switch plugin
    function setActiveSwapPlugin(string memory pluginName) external onlyOwner {
        address pluginAddr = IBeacon(beacon).getImplementation(pluginName);
        require(pluginAddr != address(0), "Plugin not registered in Beacon");
        
        string memory oldPlugin = activeSwapPlugin;
        activeSwapPlugin = pluginName;
        
        emit SwapPluginChanged(oldPlugin, pluginName, pluginAddr);
    }
}
```

---

### **3. Beacon: registrare plugin**
```solidity
// Deploy script o admin call
beacon.registerModule("UniswapV3Plugin", 0xa0DB78167CBAccD47524a261b7741C6B41Bbd096);
// SimpleSwap esistente viene registrato come UniswapV3Plugin
```

---

### **4. (Opzionale) Creare nuovi plugin**
```solidity
// contracts/plugins/CamelotPlugin.sol
contract CamelotPlugin is ISwapPlugin {
    ICamelotRouter public camelotRouter;
    
    constructor(address _camelotRouter) {
        camelotRouter = ICamelotRouter(_camelotRouter);
    }
    
    function inputSwap(address spendToken, address receiveToken, uint256 amountIn) 
        external returns (uint256) 
    {
        // Logica Camelot (diversa da Uniswap V3)
        ...
    }
}

// Deploy e registra
beacon.registerModule("CamelotPlugin", camelotPluginAddress);
```

---

## Recap: Differenza Architetturale

| Aspetto | Attuale | Target |
|---------|---------|--------|
| **Modularità** | ✅ Sì (1 plugin) | ✅ Sì (N plugins) |
| **Interface** | `ISimpleSwap` | `ISwapPlugin` (stesso) |
| **Plugin attivo** | `simpleSwapRouter` (address hardcoded) | `beacon.getImplementation(pluginName)` |
| **Cambio plugin** | Owner chiama `setSimpleSwapRouter(newAddr)` | Owner chiama `setActiveSwapPlugin("CamelotPlugin")` |
| **Registrazione plugin** | Manuale (owner set address) | Beacon-based (centralizzato) |
| **SimpleSwap deployed** | Usato direttamente | Diventa `UniswapV3Plugin` in Beacon |

---

## Conclusione

**Sì, hai ragione al 100%:**
1. **SwapManager è già modulare** (delega a contratto esterno via interface)
2. **SimpleSwap è di fatto un plugin** (Uniswap V3 wrapper)
3. **Serve solo "aprire" a multi-plugin** via Beacon invece di hardcoded address
4. **Modifiche minime:** rinominare interface, sostituire `simpleSwapRouter` con `beacon.getImplementation(pluginName)`

**La buona notizia:** L'architettura base è corretta, serve solo generalizzarla! 🎉

Vuoi che proceda con il refactoring? È un lavoro piccolo (~1h) 🚀