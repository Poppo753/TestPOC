# Analisi Architettura Oracoli Attuale

## 📊 Overview

Attualmente il sistema utilizza **Chainlink Price Feeds** hardcoded direttamente nel `TokenManager`.

---

## 🏗️ Architettura Attuale

### Componenti Coinvolti

```
┌─────────────────────────────────────────────────────────────┐
│                      TokenManager.sol                        │
│  - Import: @chainlink/contracts AggregatorV3Interface       │
│  - Chiamata diretta: priceFeed.latestRoundData()            │
│  - Validazioni hardcoded per Chainlink                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    ValueCalculator.sol                       │
│  - Chiama: tokenManager.getTokenPrice(_tokenCode)           │
│  - Calcola valori pool basandosi sui prezzi                 │
│  - Cache system per ottimizzazione gas                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     SwapManager.sol                          │
│  - Chiama: tokenManager.getTokenPrice(tokenCode)            │
│  - Usa prezzi per validazioni slippage                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 Analisi Dettagliata

### 1. **TokenManager.sol** - Oracle Implementation

#### Import Chainlink
```solidity
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
```

#### Struct TokenInfo
```solidity
struct TokenInfo {
    address tokenAddress;
    uint8 tokenDecimals;
    string tokenCode;
    address priceFeed;           // ← Chainlink Price Feed Address
    uint8 priceFeedDecimals;     // ← Chainlink Decimals
    bool isActive;
    uint256 lastPriceTimestamp;
    uint256 lastPrice;
    uint256 heartbeat;
    uint256 errorCount;
}
```

#### Funzione di Validazione (onchain)
```solidity
function manageTokenData(..., address _priceFeed, ...) external onlyOwner {
    // VALIDAZIONE PRICE FEED CHAINLINK COMPLETA
    try AggregatorV3Interface(_priceFeed).latestRoundData() returns (
        uint80 roundId,
        int256 price,
        uint256,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        require(price > 0, "Invalid price feed");
        require(updatedAt > 0, "Round not complete");
        require(answeredInRound >= roundId, "Stale price feed");
    } catch {
        revert("Price feed validation failed");
    }
}
```

#### Funzione di Recupero Prezzo
```solidity
function getTokenPrice(string memory _tokenCode)
    public view
    returns (uint256 price, uint256 updatedAt, bool isStale)
{
    require(tokenData[_tokenCode].isActive, "Token not active");

    TokenInfo memory token = tokenData[_tokenCode];
    AggregatorV3Interface priceFeed = AggregatorV3Interface(token.priceFeed);
    
    // CHIAMATA DIRETTA A CHAINLINK
    (
        uint80 roundId,
        int256 rawPrice,
        ,
        uint256 timestamp,
        uint80 answeredInRound
    ) = priceFeed.latestRoundData();

    // VALIDAZIONI CHAINLINK
    require(rawPrice > 0, "Invalid price");
    require(timestamp > 0, "Round not complete");
    require(answeredInRound >= roundId, "Stale price");

    return (
        uint256(rawPrice),
        timestamp,
        block.timestamp - timestamp > token.heartbeat
    );
}
```

---

### 2. **ValueCalculator.sol** - Price Consumer

#### Calcolo Valore Token
```solidity
function calculateTokenValue(string memory _tokenCode) public returns (uint256) {
    // Chiama TokenManager
    try tokenManager.getTokenPrice(_tokenCode) returns (uint256 price, uint256 timestamp, bool isStale) {
        // VALIDATE PRICE AGE
        require(!isStale && block.timestamp - timestamp <= maxPriceAge, "Price too old");
        
        // CALCULATE VALUE (normalize by price feed decimals)
        uint256 value = (tokenBalance * price) / (10 ** tokenInfo.priceFeedDecimals);
        
        return value;
    } catch Error(string memory reason) {
        revert(string(abi.encodePacked("Value calculation failed for ", _tokenCode, ": ", reason)));
    }
}
```

#### Selezione Token per Swap
```solidity
function selectTokenForSwap(uint256 targetValue) external view returns (string memory tokenCode, uint256 amount) {
    // GET PRICE from TokenManager
    (uint256 price, , bool isStale) = tokenManager.getTokenPrice(currentToken);
    if (isStale || price == 0) {
        continue; // Skip tokens with stale/invalid prices
    }
    
    // CALCULATE VALUE using price
    uint256 tokenValue = (tokenBalance * price) / (10 ** tokenInfo.priceFeedDecimals);
}
```

---

### 3. **SwapManager.sol** - Price Validation

```solidity
function _getTokenUSDValue(
    string memory tokenCode,
    uint256 amount,
    ITokenManagerForModules tokenManager
) private view returns (uint256) {
    // GET PRICE
    (uint256 tokenPrice, , ) = tokenManager.getTokenPrice(tokenCode);
    
    // CALCULATE USD VALUE
    ITokenManagerForModules.TokenInfo memory tokenInfo = tokenManager.getTokenInfo(tokenCode);
    return (amount * tokenPrice) / (10 ** tokenInfo.priceFeedDecimals);
}
```

---

## 🚨 Problemi dell'Architettura Attuale

### ❌ Criticità

1. **Vendor Lock-in Totale**
   - Dipendenza hardcoded da Chainlink
   - Import diretto di `AggregatorV3Interface`
   - Impossibile cambiare oracle provider senza riscrivere contratti

2. **Zero Flessibilità**
   - Non puoi usare altri oracle (Pyth, Band Protocol, Uniswap TWAP, ecc.)
   - Non puoi implementare strategie composite (es: media di più oracle)
   - Non puoi fare fallback su oracle secondari

3. **Validazioni Specifiche Hardcoded**
   - Logica di validazione Chainlink (roundId, answeredInRound) nel core
   - Ogni oracle ha validazioni diverse
   - Non generalizzabile

4. **Impossibile Upgrade**
   - Se Chainlink depreca interfaccia → devi riscrivere tutto
   - Se vuoi migliorare validazioni → devi modificare TokenManager
   - Breaking changes richiedono deploy completo

5. **Testing Limitato**
   - Devi mockare esattamente Chainlink in test
   - Non puoi testare facilmente altri provider
   - Mock devono replicare tutte le quirks di Chainlink

---

## 💡 Opportunità di Miglioramento

### Cosa Mantenere
✅ Interface standardizzata per consumers (`getTokenPrice`)  
✅ Cache system in ValueCalculator (funziona bene)  
✅ Error tracking e heartbeat validation  
✅ Decimals normalization logic  

### Cosa Modularizzare
🔄 **Oracle Provider Implementation** → Pluggable modules  
🔄 **Validazione prezzi** → Strategie configurabili  
🔄 **Fallback logic** → Multiple oracle sources  
🔄 **Price aggregation** → Composite strategies (media, mediana, ecc.)  

---

## 📋 Interfaccia Attuale Esposta

### Per Moduli Esterni (ValueCalculator, SwapManager)
```solidity
function getTokenPrice(string memory tokenCode) 
    external view 
    returns (uint256 price, uint256 updatedAt, bool isStale);
```

### Questa interfaccia è **PERFETTA** e deve rimanere invariata
- Semplice
- Chiara
- Testata
- Usata ovunque

**Obiettivo**: Mantenere questa interfaccia verso l'esterno, ma rendere modulare l'implementazione interna.

---

## 🎯 Obiettivo Modularità

Creare un **Oracle Plugin System** che permetta di:

1. ✅ **Mantenere l'interfaccia esistente** (`getTokenPrice`)
2. ✅ **Plug diversi provider** (Chainlink, Pyth, Band, Uniswap TWAP)
3. ✅ **Strategie composite** (average, median, weighted)
4. ✅ **Fallback automatico** su oracle secondari
5. ✅ **Zero breaking changes** per contratti esistenti

---

## 📊 Metriche Attuali

- **Chiamate a Oracle**: ~15 punti nel codice
- **Moduli dipendenti**: 3 (TokenManager, ValueCalculator, SwapManager)
- **Validazioni hardcoded**: 4 check Chainlink-specific
- **Livello di accoppiamento**: 🔴 ALTO (tight coupling con Chainlink)

---

## 🚀 Next Steps

Vedi documento: `02_ORACLE_MODULARITY_PROPOSAL.md`
