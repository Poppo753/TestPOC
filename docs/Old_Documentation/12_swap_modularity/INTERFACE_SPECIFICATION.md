# 📋 INTERFACE SPECIFICATION

**Versione**: 1.0  
**Data**: 3 Novembre 2025  
**Target**: Specifica completa ISwapPlugin e interfacce correlate  

---

## 📋 **INDICE**

- [Core Interface](#-core-interface)
- [Extended Interfaces](#-extended-interfaces)
- [Data Structures](#-data-structures)
- [Error Handling](#-error-handling)
- [Gas Considerations](#-gas-considerations)

---

## 🎯 **CORE INTERFACE**

### **ISwapPlugin.sol**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ISwapPlugin
 * @dev Core interface che tutti i plugin swap devono implementare
 * @custom:version 1.0
 */
interface ISwapPlugin {
    
    // ==================== CORE FUNCTIONS ====================
    
    /**
     * @notice Esegue uno swap tramite il protocollo specifico
     * @param params Parametri di swap (vedi SwapParams struct)
     * @return amountOut Quantità effettiva di token ricevuti
     * 
     * @custom:requirements
     * - Solo SwapManager può chiamare questa funzione
     * - I token devono essere già stati trasferiti al plugin
     * - Il plugin deve restituire tutti i token al SwapManager
     * - Gas limit: max 500,000
     */
    function swap(SwapParams calldata params) external returns (uint256 amountOut);
    
    /**
     * @notice Ottiene una quotazione per uno swap senza eseguirlo
     * @param params Parametri per la quotazione (vedi QuoteParams struct)
     * @return quote Informazioni sulla quotazione (vedi Quote struct)
     * 
     * @custom:requirements
     * - Funzione view - non modifica state
     * - Deve ritornare 0 se swap non possibile
     * - Gas limit: max 100,000
     */
    function getQuote(QuoteParams calldata params) external view returns (Quote memory quote);
    
    /**
     * @notice Ritorna informazioni sul protocollo
     * @return info Informazioni del protocollo (vedi ProtocolInfo struct)
     */
    function getProtocolInfo() external pure returns (ProtocolInfo memory info);
    
    // ==================== UTILITY FUNCTIONS ====================
    
    /**
     * @notice Verifica se il plugin supporta una coppia di token
     * @param tokenA Primo token della coppia
     * @param tokenB Secondo token della coppia
     * @return supported True se la coppia è supportata
     */
    function supportsTokenPair(address tokenA, address tokenB) external view returns (bool supported);
    
    /**
     * @notice Ottiene l'indirizzo del router utilizzato dal plugin
     * @return router Indirizzo del router del protocollo
     */
    function getRouterAddress() external view returns (address router);
    
    /**
     * @notice Verifica lo stato di salute del plugin
     * @return healthy True se il plugin è operativo
     * @return reason Motivo se non è healthy
     */
    function isHealthy() external view returns (bool healthy, string memory reason);
}
```

---

## 🔧 **EXTENDED INTERFACES**

### **IAdvancedSwapPlugin.sol**
```solidity
/**
 * @title IAdvancedSwapPlugin
 * @dev Interfaccia per plugin con funzionalità avanzate (multi-hop, routing)
 */
interface IAdvancedSwapPlugin is ISwapPlugin {
    
    /**
     * @notice Esegue swap multi-hop con path personalizzato
     * @param params Parametri per swap con path (vedi PathSwapParams struct)
     * @return amountOut Quantità finale ricevuta
     */
    function swapWithPath(PathSwapParams calldata params) external returns (uint256 amountOut);
    
    /**
     * @notice Ottiene quotazione per swap multi-hop
     * @param path Array di token per il path di swap
     * @param amountIn Quantità di token in input
     * @return amountOut Quantità stimata in output
     * @return path Miglior path trovato
     */
    function getMultiHopQuote(
        address[] calldata path,
        uint256 amountIn
    ) external view returns (uint256 amountOut, address[] memory bestPath);
    
    /**
     * @notice Trova il miglior path tra due token
     * @param tokenIn Token di input
     * @param tokenOut Token di output
     * @param amountIn Quantità di input
     * @return path Miglior path trovato
     * @return expectedOutput Output stimato
     */
    function findBestPath(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (address[] memory path, uint256 expectedOutput);
}
```

### **IYieldSwapPlugin.sol**
```solidity
/**
 * @title IYieldSwapPlugin
 * @dev Interfaccia per plugin specializzati in yield tokens (es. Pendle)
 */
interface IYieldSwapPlugin is ISwapPlugin {
    
    /**
     * @notice Swap verso yield token (PT/YT)
     * @param params Parametri per yield swap (vedi YieldSwapParams struct)
     * @return ptAmount Quantità di Principal Token ricevuti
     * @return ytAmount Quantità di Yield Token ricevuti
     */
    function swapToYieldToken(YieldSwapParams calldata params) 
        external returns (uint256 ptAmount, uint256 ytAmount);
    
    /**
     * @notice Quotazione per yield token swap
     * @param params Parametri per quotazione yield
     * @return quote Quotazione yield (vedi YieldQuote struct)
     */
    function getYieldQuote(YieldQuoteParams calldata params) 
        external view returns (YieldQuote memory quote);
    
    /**
     * @notice Ottiene informazioni su un yield token
     * @param yieldToken Indirizzo del yield token
     * @return info Informazioni yield token (vedi YieldTokenInfo struct)
     */
    function getYieldTokenInfo(address yieldToken) 
        external view returns (YieldTokenInfo memory info);
    
    /**
     * @notice Calcola APY corrente per un yield token
     * @param yieldToken Indirizzo del yield token
     * @return apy APY in basis points (10000 = 100%)
     */
    function getCurrentAPY(address yieldToken) external view returns (uint256 apy);
}
```

---

## 📊 **DATA STRUCTURES**

### **Core Structs**
```solidity
/**
 * @dev Parametri base per uno swap
 */
struct SwapParams {
    address tokenIn;           // Token da vendere
    address tokenOut;          // Token da comprare
    uint256 amountIn;          // Quantità token in input
    uint256 minAmountOut;      // Minima quantità accettabile in output
    address recipient;         // Chi riceve i token
    uint256 deadline;          // Deadline per l'operazione
    bytes extraData;           // Dati extra specifici del protocollo
}

/**
 * @dev Parametri per quotazioni
 */
struct QuoteParams {
    address tokenIn;           // Token da vendere
    address tokenOut;          // Token da comprare
    uint256 amountIn;          // Quantità token in input
    bytes extraData;           // Dati extra per quotazione
}

/**
 * @dev Risultato di una quotazione
 */
struct Quote {
    uint256 amountOut;         // Quantità stimata in output
    uint256 slippageBps;       // Slippage stimato in basis points
    uint256 gasEstimate;       // Stima gas per l'operazione
    uint256 priceImpact;       // Impatto sul prezzo in basis points
    bool isValid;              // Se la quotazione è valida
    string reason;             // Motivo se non valida
}

/**
 * @dev Informazioni su un protocollo
 */
struct ProtocolInfo {
    string name;               // Nome del protocollo (es. "Uniswap")
    string version;            // Versione (es. "3.0.1")
    uint256 features;          // Bitmask delle features supportate
    address router;            // Indirizzo router principale
    uint256 deployedAt;        // Block di deployment
}

/**
 * @dev Feature flags per protocolli
 */
library ProtocolFeatures {
    uint256 constant BASIC_SWAP = 1 << 0;          // 0x001 - Swap base
    uint256 constant MULTI_HOP = 1 << 1;           // 0x002 - Multi-hop routing
    uint256 constant YIELD_TOKENS = 1 << 2;        // 0x004 - Yield token support
    uint256 constant MEV_PROTECTION = 1 << 3;      // 0x008 - MEV protection
    uint256 constant FLASH_SWAPS = 1 << 4;         // 0x010 - Flash swaps
    uint256 constant LIMIT_ORDERS = 1 << 5;        // 0x020 - Limit orders
    uint256 constant BATCH_SWAPS = 1 << 6;         // 0x040 - Batch operations
    uint256 constant CROSS_CHAIN = 1 << 7;         // 0x080 - Cross-chain
}
```

### **Advanced Structs**
```solidity
/**
 * @dev Parametri per swap con path personalizzato
 */
struct PathSwapParams {
    address[] path;            // Path completo del swap
    uint256 amountIn;          // Quantità in input
    uint256 minAmountOut;      // Minimo output accettabile
    address recipient;         // Destinatario
    uint256 deadline;          // Deadline
    uint256[] fees;            // Fee per ogni hop (se applicabile)
    bytes extraData;           // Dati extra
}

/**
 * @dev Parametri per yield token swap
 */
struct YieldSwapParams {
    address baseToken;         // Token base (es. USDC)
    address yieldToken;        // Yield token target (es. PT-USDC)
    uint256 amountIn;          // Quantità input
    uint256 minPtOut;          // Minimo PT ricevuto
    uint256 minYtOut;          // Minimo YT ricevuto
    uint256 maturity;          // Maturity del yield token
    address recipient;         // Destinatario
    uint256 deadline;          // Deadline
    SwapType swapType;         // Tipo di swap yield
}

/**
 * @dev Tipi di swap per yield tokens
 */
enum SwapType {
    TOKEN_TO_PT,               // Token normale → Principal Token
    TOKEN_TO_YT,               // Token normale → Yield Token
    TOKEN_TO_BOTH,             // Token normale → PT + YT
    PT_TO_TOKEN,               // Principal Token → Token normale
    YT_TO_TOKEN,               // Yield Token → Token normale
    PT_TO_YT,                  // Principal Token → Yield Token
    YT_TO_PT                   // Yield Token → Principal Token
}

/**
 * @dev Quote per yield tokens
 */
struct YieldQuote {
    uint256 ptOut;             // PT ricevuti
    uint256 ytOut;             // YT ricevuti
    uint256 impliedApy;        // APY implicito
    uint256 timeToMaturity;    // Tempo a maturity in secondi
    uint256 gasEstimate;       // Stima gas
    bool isValid;              // Se quote è valida
}

/**
 * @dev Informazioni yield token
 */
struct YieldTokenInfo {
    address underlying;        // Token sottostante
    address principalToken;    // Indirizzo PT
    address yieldToken;        // Indirizzo YT
    uint256 maturity;          // Timestamp maturity
    uint256 currentApy;        // APY corrente
    uint256 totalAssets;       // Assets totali nel pool
    bool isActive;             // Se il mercato è attivo
}
```

---

## ❌ **ERROR HANDLING**

### **Custom Errors**
```solidity
/**
 * @dev Errori standard per plugin
 */
interface ISwapPluginErrors {
    
    // ==================== ACCESS ERRORS ====================
    error UnauthorizedCaller(address caller);
    error OnlySwapManager();
    
    // ==================== VALIDATION ERRORS ====================
    error InvalidTokenPair(address tokenA, address tokenB);
    error UnsupportedToken(address token);
    error AmountTooSmall(uint256 amount, uint256 minimum);
    error AmountTooLarge(uint256 amount, uint256 maximum);
    error DeadlineExpired(uint256 deadline, uint256 currentTime);
    error SlippageTooHigh(uint256 slippage, uint256 maxSlippage);
    
    // ==================== EXECUTION ERRORS ====================
    error SwapFailed(string reason);
    error InsufficientLiquidity(address tokenA, address tokenB);
    error PriceImpactTooHigh(uint256 priceImpact, uint256 maxImpact);
    error RouterNotResponding(address router);
    error InsufficientOutput(uint256 amountOut, uint256 minAmountOut);
    
    // ==================== PROTOCOL ERRORS ====================
    error ProtocolUnavailable(string protocolName);
    error FeatureNotSupported(uint256 requestedFeature);
    error RouterAddressZero();
    error PluginNotHealthy(string reason);
    
    // ==================== YIELD TOKEN ERRORS ====================
    error YieldTokenExpired(address yieldToken, uint256 maturity);
    error InvalidMaturity(uint256 maturity, uint256 minMaturity);
    error YieldMarketInactive(address market);
}
```

### **Error Handling Pattern**
```solidity
contract BaseSwapPlugin {
    
    /**
     * @dev Wrapper sicuro per chiamate esterne
     */
    function _safeExternalCall(
        address target,
        bytes memory data
    ) internal returns (bool success, bytes memory returnData) {
        try this._externalCall(target, data) returns (bytes memory result) {
            return (true, result);
        } catch Error(string memory reason) {
            return (false, bytes(reason));
        } catch (bytes memory lowLevelData) {
            return (false, lowLevelData);
        }
    }
    
    /**
     * @dev Validazione standard parametri swap
     */
    function _validateSwapParams(SwapParams calldata params) internal view {
        if (params.tokenIn == address(0)) revert InvalidTokenPair(params.tokenIn, params.tokenOut);
        if (params.tokenOut == address(0)) revert InvalidTokenPair(params.tokenIn, params.tokenOut);
        if (params.tokenIn == params.tokenOut) revert InvalidTokenPair(params.tokenIn, params.tokenOut);
        if (params.amountIn == 0) revert AmountTooSmall(params.amountIn, 1);
        if (params.deadline < block.timestamp) revert DeadlineExpired(params.deadline, block.timestamp);
        if (!supportsTokenPair(params.tokenIn, params.tokenOut)) {
            revert UnsupportedToken(params.tokenIn);
        }
    }
}
```

---

## ⛽ **GAS CONSIDERATIONS**

### **Gas Limits per Function**
```solidity
library GasLimits {
    uint256 constant SWAP_MAX_GAS = 500_000;           // Max gas per swap
    uint256 constant QUOTE_MAX_GAS = 100_000;          // Max gas per quote
    uint256 constant MULTI_HOP_MAX_GAS = 800_000;      // Max gas per multi-hop
    uint256 constant YIELD_SWAP_MAX_GAS = 600_000;     // Max gas per yield swap
    
    // Emergency gas limits
    uint256 constant EMERGENCY_GAS_BUFFER = 50_000;    // Buffer emergenza
    uint256 constant MAX_TOTAL_GAS = 1_000_000;        // Limite assoluto
}
```

### **Gas Optimization Patterns**
```solidity
contract GasOptimizedPlugin {
    
    // ==================== STORAGE OPTIMIZATION ====================
    
    // Pack struct per risparmiare storage slots
    struct PackedQuote {
        uint128 amountOut;      // Sufficiente per la maggior parte dei casi
        uint64 gasEstimate;     // Max ~18B gas
        uint32 slippageBps;     // Max 42949% slippage
        uint32 timestamp;       // Timestamp relativo
    }
    
    // ==================== COMPUTATION OPTIMIZATION ====================
    
    /**
     * @dev Cache calcoli costosi
     */
    mapping(bytes32 => PackedQuote) private quoteCache;
    uint256 private constant CACHE_DURATION = 5; // 5 blocchi
    
    function _getCachedQuote(QuoteParams calldata params) internal view returns (Quote memory) {
        bytes32 key = keccak256(abi.encode(params.tokenIn, params.tokenOut, params.amountIn));
        PackedQuote memory cached = quoteCache[key];
        
        if (cached.timestamp + CACHE_DURATION > block.number) {
            return Quote({
                amountOut: cached.amountOut,
                gasEstimate: cached.gasEstimate,
                slippageBps: cached.slippageBps,
                priceImpact: 0, // Calcolato lazy
                isValid: true,
                reason: ""
            });
        }
        
        return Quote(0, 0, 0, 0, false, "Cache expired");
    }
    
    // ==================== BATCH OPERATIONS ====================
    
    /**
     * @dev Batch multiple quotes in single call
     */
    function getBatchQuotes(QuoteParams[] calldata paramsArray) 
        external view returns (Quote[] memory quotes) {
        quotes = new Quote[](paramsArray.length);
        
        for (uint256 i = 0; i < paramsArray.length; ) {
            quotes[i] = getQuote(paramsArray[i]);
            unchecked { ++i; }
        }
    }
}
```

### **Gas Monitoring**
```solidity
contract GasMonitoring {
    
    event GasUsageRecorded(
        string pluginName,
        string functionName,
        uint256 gasUsed,
        bool exceeded
    );
    
    modifier trackGas(string memory functionName) {
        uint256 gasStart = gasleft();
        _;
        uint256 gasUsed = gasStart - gasleft();
        
        bool exceeded = gasUsed > GasLimits.SWAP_MAX_GAS;
        emit GasUsageRecorded(getProtocolInfo().name, functionName, gasUsed, exceeded);
        
        if (exceeded) {
            // Log warning ma non revert per non bloccare operazioni
        }
    }
}
```

---

## 📝 **IMPLEMENTATION CHECKLIST**

### **Plugin Development Checklist**:
- [ ] Implementa tutte le funzioni di ISwapPlugin
- [ ] Gestisce tutti gli errori custom appropriati  
- [ ] Rispetta i gas limits specificati
- [ ] Include validazioni complete dei parametri
- [ ] Implementa health checks appropriati
- [ ] Ha test coverage > 95%
- [ ] È stato auditato per sicurezza
- [ ] Ha documentazione completa

### **Integration Checklist**:
- [ ] Plugin registrato nel PluginRegistry
- [ ] Autorizzazioni impostate correttamente
- [ ] Monitoring e alerts configurati
- [ ] Procedure emergenza documentate
- [ ] Rollback plan disponibile

---

**🔄 Ultimo Aggiornamento**: 3 Novembre 2025  
**✍️ Autore**: Development Team  
**📋 Status**: Interface Specification v1.0