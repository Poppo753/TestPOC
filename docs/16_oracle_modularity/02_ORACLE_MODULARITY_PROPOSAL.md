# Proposta: Oracle Modularity System

## 🎯 Obiettivo

Trasformare il sistema oracle da **hardcoded Chainlink** a **pluggable multi-oracle** senza breaking changes.

---

## 🏗️ Nuova Architettura Proposta

```
┌──────────────────────────────────────────────────────────────┐
│                      TokenManager.sol                         │
│  - NO più import Chainlink                                   │
│  - Chiama: oracleAdapter.getPrice(tokenCode)                 │
│  - Interface standard mantenuta per backward compatibility   │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                   IOracleAdapter.sol                          │
│  Interface standard per tutti gli oracle adapters            │
│  function getPrice(string memory tokenCode)                  │
│      returns (uint256 price, uint256 timestamp, bool valid)  │
└──────────────────────────────────────────────────────────────┘
                            ↓
          ┌─────────────────┼─────────────────────┐
          ↓                 ↓                      ↓
┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  ChainlinkAdapter│  │   PythAdapter    │  │  UniswapAdapter  │
│  - latestRoundData│  │ - Pyth Network  │  │ - TWAP Oracle   │
│  - validations   │  │ - validations   │  │ - validations   │
└─────────────────┘  └──────────────────┘  └──────────────────┘
          ↓                 ↓                      ↓
┌─────────────────────────────────────────────────────────────┐
│               CompositeOracleAdapter.sol                     │
│  - Strategy: Average, Median, Weighted, Fallback            │
│  - Usa multiple sources con fallback automatico             │
│  - Circuit breaker su deviazioni anomale                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 📐 Design Pattern: Adapter Pattern

### Perché Adapter Pattern?

✅ **Mantiene interfaccia esistente** → No breaking changes  
✅ **Plug & Play** → Aggiungi nuovi oracle senza modificare core  
✅ **Testabilità** → Mock facilmente gli adapters  
✅ **Separation of Concerns** → Oracle logic separata da business logic  

---

## 🔧 Implementazione Proposta

### 1. **IOracleAdapter.sol** (Interface)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IOracleAdapter
 * @notice Standard interface for all oracle adapters
 * @dev Each oracle provider (Chainlink, Pyth, etc.) implements this
 */
interface IOracleAdapter {
    
    /// @notice Get price for a token
    /// @param tokenCode Unique token identifier
    /// @return price Current price (normalized to adapter's decimals)
    /// @return timestamp When the price was last updated
    /// @return isValid Whether the price is valid and fresh
    function getPrice(string memory tokenCode) 
        external 
        view 
        returns (
            uint256 price,
            uint256 timestamp,
            bool isValid
        );
    
    /// @notice Get decimals for price normalization
    /// @param tokenCode Token identifier
    /// @return decimals Number of decimals in price
    function getPriceDecimals(string memory tokenCode) 
        external 
        view 
        returns (uint8 decimals);
    
    /// @notice Check if adapter supports a token
    /// @param tokenCode Token to check
    /// @return supported True if token is supported
    function supportsToken(string memory tokenCode) 
        external 
        view 
        returns (bool supported);
    
    /// @notice Get adapter metadata
    /// @return name Adapter name (e.g., "Chainlink", "Pyth")
    /// @return version Adapter version
    function getAdapterInfo() 
        external 
        view 
        returns (
            string memory name,
            string memory version
        );
}
```

---

### 2. **ChainlinkAdapter.sol** (Implementation)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./IOracleAdapter.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ChainlinkAdapter
 * @notice Adapter for Chainlink Price Feeds
 * @dev Wraps Chainlink-specific logic
 */
contract ChainlinkAdapter is IOracleAdapter, Ownable {
    
    struct PriceFeedConfig {
        address feedAddress;
        uint8 decimals;
        uint256 heartbeat;
        bool isActive;
    }
    
    /// @notice Mapping: tokenCode => Chainlink price feed config
    mapping(string => PriceFeedConfig) private priceFeeds;
    
    // Events
    event PriceFeedAdded(string indexed tokenCode, address feedAddress);
    event PriceFeedUpdated(string indexed tokenCode, address feedAddress);
    event PriceFeedRemoved(string indexed tokenCode);
    
    /**
     * @notice Add or update a price feed
     * @param tokenCode Token identifier
     * @param feedAddress Chainlink aggregator address
     * @param decimals Feed decimals
     * @param heartbeat Max time between updates
     */
    function setPriceFeed(
        string memory tokenCode,
        address feedAddress,
        uint8 decimals,
        uint256 heartbeat
    ) external onlyOwner {
        require(feedAddress != address(0), "Invalid feed address");
        require(heartbeat > 0, "Invalid heartbeat");
        
        // Validate feed works
        AggregatorV3Interface feed = AggregatorV3Interface(feedAddress);
        try feed.latestRoundData() returns (
            uint80 roundId,
            int256 price,
            uint256,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            require(price > 0, "Invalid price");
            require(updatedAt > 0, "Round not complete");
            require(answeredInRound >= roundId, "Stale feed");
        } catch {
            revert("Feed validation failed");
        }
        
        bool isNew = !priceFeeds[tokenCode].isActive;
        
        priceFeeds[tokenCode] = PriceFeedConfig({
            feedAddress: feedAddress,
            decimals: decimals,
            heartbeat: heartbeat,
            isActive: true
        });
        
        if (isNew) {
            emit PriceFeedAdded(tokenCode, feedAddress);
        } else {
            emit PriceFeedUpdated(tokenCode, feedAddress);
        }
    }
    
    /**
     * @notice Remove a price feed
     * @param tokenCode Token to remove
     */
    function removePriceFeed(string memory tokenCode) external onlyOwner {
        require(priceFeeds[tokenCode].isActive, "Feed not active");
        priceFeeds[tokenCode].isActive = false;
        emit PriceFeedRemoved(tokenCode);
    }
    
    /**
     * @inheritdoc IOracleAdapter
     */
    function getPrice(string memory tokenCode)
        external
        view
        override
        returns (uint256 price, uint256 timestamp, bool isValid)
    {
        PriceFeedConfig memory config = priceFeeds[tokenCode];
        require(config.isActive, "Token not supported");
        
        AggregatorV3Interface feed = AggregatorV3Interface(config.feedAddress);
        
        (
            uint80 roundId,
            int256 rawPrice,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = feed.latestRoundData();
        
        // Chainlink-specific validations
        bool priceValid = rawPrice > 0 && 
                         updatedAt > 0 && 
                         answeredInRound >= roundId;
        
        bool isFresh = block.timestamp - updatedAt <= config.heartbeat;
        
        return (
            uint256(rawPrice),
            updatedAt,
            priceValid && isFresh
        );
    }
    
    /**
     * @inheritdoc IOracleAdapter
     */
    function getPriceDecimals(string memory tokenCode)
        external
        view
        override
        returns (uint8)
    {
        require(priceFeeds[tokenCode].isActive, "Token not supported");
        return priceFeeds[tokenCode].decimals;
    }
    
    /**
     * @inheritdoc IOracleAdapter
     */
    function supportsToken(string memory tokenCode)
        external
        view
        override
        returns (bool)
    {
        return priceFeeds[tokenCode].isActive;
    }
    
    /**
     * @inheritdoc IOracleAdapter
     */
    function getAdapterInfo()
        external
        pure
        override
        returns (string memory name, string memory version)
    {
        return ("Chainlink", "1.0.0");
    }
}
```

---

### 3. **TokenManager.sol** (Updated)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IBeacon.sol";
import "./interfaces/IParameterManagerForModules.sol";
import "./interfaces/IOracleAdapter.sol";  // ← NEW IMPORT

/**
 * @title TokenManager
 * @dev Gestione token registry con PLUGGABLE oracle adapters
 */
contract TokenManager is Ownable {
    
    struct TokenInfo {
        address tokenAddress;
        uint8 tokenDecimals;
        string tokenCode;
        // ↓ REMOVED: address priceFeed; uint8 priceFeedDecimals;
        bool isActive;
        uint256 lastPriceTimestamp;
        uint256 lastPrice;
        uint256 heartbeat;
        uint256 errorCount;
    }

    /// @notice Oracle adapter (pluggable)
    IOracleAdapter public oracleAdapter;  // ← NEW
    
    /// @notice Mapping dei token data
    mapping(string => TokenInfo) private tokenData;
    string[] private tokenCodes;
    uint256 public tokenCodesCount;
    
    // ... rest of storage ...
    
    address public immutable beacon;
    
    // Events
    event OracleAdapterUpdated(address indexed oldAdapter, address indexed newAdapter);
    // ... other events ...
    
    constructor(address _beacon, address _oracleAdapter) Ownable() {
        require(_beacon != address(0), "Invalid beacon");
        require(_oracleAdapter != address(0), "Invalid oracle adapter");
        
        beacon = _beacon;
        oracleAdapter = IOracleAdapter(_oracleAdapter);
    }
    
    /**
     * @notice Update oracle adapter (owner only)
     * @param _newAdapter New adapter address
     */
    function setOracleAdapter(address _newAdapter) external onlyOwner {
        require(_newAdapter != address(0), "Invalid adapter");
        address oldAdapter = address(oracleAdapter);
        oracleAdapter = IOracleAdapter(_newAdapter);
        emit OracleAdapterUpdated(oldAdapter, _newAdapter);
    }
    
    /**
     * @notice Add/update token (SIMPLIFIED - no price feed params)
     * @param _tokenCode Token identifier
     * @param _tokenAddress Token contract address
     * @param _tokenDecimals Token decimals
     * @param _heartbeat Max price age
     */
    function manageTokenData(
        string memory _tokenCode,
        address _tokenAddress,
        uint8 _tokenDecimals,
        uint256 _heartbeat
    ) external onlyOwner {
        require(bytes(_tokenCode).length > 0, "Invalid token code");
        require(_tokenAddress != address(0), "Invalid token address");
        require(_heartbeat > 0, "Invalid heartbeat");
        
        // VERIFY ORACLE SUPPORTS TOKEN
        require(oracleAdapter.supportsToken(_tokenCode), "Token not supported by oracle");
        
        // WETH exclusion
        address wethAddress = IBeacon(beacon).getImplementation("WETH");
        require(_tokenAddress != wethAddress, "Cannot add WETH");
        
        // Update or add
        if (!tokenData[_tokenCode].isActive) {
            require(tokenCodesCount < maxTokensPerOperation, "Too many tokens");
            tokenCodes.push(_tokenCode);
            tokenCodesCount++;
        }
        
        tokenData[_tokenCode] = TokenInfo({
            tokenAddress: _tokenAddress,
            tokenDecimals: _tokenDecimals,
            tokenCode: _tokenCode,
            isActive: true,
            lastPriceTimestamp: 0,
            lastPrice: 0,
            heartbeat: _heartbeat,
            errorCount: 0
        });
        
        emit TokenAdded(_tokenCode, _tokenAddress, address(oracleAdapter));
    }
    
    /**
     * @notice Get token price (INTERFACE UNCHANGED - backward compatible)
     * @param _tokenCode Token identifier
     * @return price Current price
     * @return updatedAt Last update timestamp
     * @return isStale Whether price is stale
     */
    function getTokenPrice(string memory _tokenCode)
        public
        view
        returns (uint256 price, uint256 updatedAt, bool isStale)
    {
        require(tokenData[_tokenCode].isActive, "Token not active");
        
        // DELEGATE TO ORACLE ADAPTER
        (uint256 oraclePrice, uint256 timestamp, bool isValid) = oracleAdapter.getPrice(_tokenCode);
        
        require(isValid, "Invalid oracle price");
        
        TokenInfo memory token = tokenData[_tokenCode];
        bool stale = block.timestamp - timestamp > token.heartbeat;
        
        return (oraclePrice, timestamp, stale);
    }
    
    // ... rest of functions remain UNCHANGED ...
}
```

---

### 4. **CompositeOracleAdapter.sol** (Advanced)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./IOracleAdapter.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CompositeOracleAdapter
 * @notice Combines multiple oracle sources with fallback
 * @dev Strategies: Average, Median, Weighted, Primary+Fallback
 */
contract CompositeOracleAdapter is IOracleAdapter, Ownable {
    
    enum Strategy {
        AVERAGE,           // Average of all sources
        MEDIAN,            // Median of all sources
        PRIMARY_FALLBACK,  // Use primary, fallback if fails
        WEIGHTED           // Weighted average
    }
    
    struct OracleSource {
        IOracleAdapter adapter;
        uint256 weight;    // For weighted strategy
        bool isActive;
        uint256 priority;  // Lower = higher priority
    }
    
    /// @notice Token => Array of oracle sources
    mapping(string => OracleSource[]) private tokenSources;
    
    /// @notice Strategy per token
    mapping(string => Strategy) private tokenStrategy;
    
    /// @notice Max deviation allowed (basis points, 500 = 5%)
    uint256 public maxDeviation = 500;
    
    event SourceAdded(string indexed tokenCode, address indexed adapter);
    event StrategyUpdated(string indexed tokenCode, Strategy strategy);
    event DeviationDetected(string indexed tokenCode, uint256 deviation);
    
    /**
     * @notice Add oracle source for a token
     */
    function addOracleSource(
        string memory tokenCode,
        address adapterAddress,
        uint256 weight,
        uint256 priority
    ) external onlyOwner {
        require(adapterAddress != address(0), "Invalid adapter");
        
        IOracleAdapter adapter = IOracleAdapter(adapterAddress);
        require(adapter.supportsToken(tokenCode), "Adapter doesn't support token");
        
        tokenSources[tokenCode].push(OracleSource({
            adapter: adapter,
            weight: weight,
            isActive: true,
            priority: priority
        }));
        
        emit SourceAdded(tokenCode, adapterAddress);
    }
    
    /**
     * @notice Set strategy for a token
     */
    function setStrategy(string memory tokenCode, Strategy strategy) external onlyOwner {
        tokenStrategy[tokenCode] = strategy;
        emit StrategyUpdated(tokenCode, strategy);
    }
    
    /**
     * @inheritdoc IOracleAdapter
     */
    function getPrice(string memory tokenCode)
        external
        view
        override
        returns (uint256 price, uint256 timestamp, bool isValid)
    {
        OracleSource[] memory sources = tokenSources[tokenCode];
        require(sources.length > 0, "No sources for token");
        
        Strategy strategy = tokenStrategy[tokenCode];
        
        if (strategy == Strategy.PRIMARY_FALLBACK) {
            return _getPriceWithFallback(tokenCode, sources);
        } else if (strategy == Strategy.AVERAGE) {
            return _getPriceAverage(tokenCode, sources);
        } else if (strategy == Strategy.MEDIAN) {
            return _getPriceMedian(tokenCode, sources);
        } else if (strategy == Strategy.WEIGHTED) {
            return _getPriceWeighted(tokenCode, sources);
        }
        
        revert("Unknown strategy");
    }
    
    /**
     * @dev Primary with fallback strategy
     */
    function _getPriceWithFallback(
        string memory tokenCode,
        OracleSource[] memory sources
    ) private view returns (uint256, uint256, bool) {
        // Sort by priority (already sorted on add ideally)
        for (uint256 i = 0; i < sources.length; i++) {
            if (!sources[i].isActive) continue;
            
            try sources[i].adapter.getPrice(tokenCode) returns (
                uint256 price,
                uint256 timestamp,
                bool valid
            ) {
                if (valid) {
                    return (price, timestamp, true);
                }
            } catch {
                continue; // Try next
            }
        }
        
        return (0, 0, false); // All failed
    }
    
    /**
     * @dev Average strategy
     */
    function _getPriceAverage(
        string memory tokenCode,
        OracleSource[] memory sources
    ) private view returns (uint256, uint256, bool) {
        uint256 sum = 0;
        uint256 count = 0;
        uint256 latestTimestamp = 0;
        
        for (uint256 i = 0; i < sources.length; i++) {
            if (!sources[i].isActive) continue;
            
            try sources[i].adapter.getPrice(tokenCode) returns (
                uint256 price,
                uint256 timestamp,
                bool valid
            ) {
                if (valid) {
                    sum += price;
                    count++;
                    if (timestamp > latestTimestamp) {
                        latestTimestamp = timestamp;
                    }
                }
            } catch {
                continue;
            }
        }
        
        if (count == 0) return (0, 0, false);
        
        uint256 avgPrice = sum / count;
        return (avgPrice, latestTimestamp, true);
    }
    
    /**
     * @dev Median strategy
     */
    function _getPriceMedian(
        string memory tokenCode,
        OracleSource[] memory sources
    ) private view returns (uint256, uint256, bool) {
        uint256[] memory prices = new uint256[](sources.length);
        uint256 count = 0;
        uint256 latestTimestamp = 0;
        
        // Collect prices
        for (uint256 i = 0; i < sources.length; i++) {
            if (!sources[i].isActive) continue;
            
            try sources[i].adapter.getPrice(tokenCode) returns (
                uint256 price,
                uint256 timestamp,
                bool valid
            ) {
                if (valid) {
                    prices[count] = price;
                    count++;
                    if (timestamp > latestTimestamp) {
                        latestTimestamp = timestamp;
                    }
                }
            } catch {
                continue;
            }
        }
        
        if (count == 0) return (0, 0, false);
        
        // Simple bubble sort (OK for small arrays)
        for (uint256 i = 0; i < count - 1; i++) {
            for (uint256 j = 0; j < count - i - 1; j++) {
                if (prices[j] > prices[j + 1]) {
                    uint256 temp = prices[j];
                    prices[j] = prices[j + 1];
                    prices[j + 1] = temp;
                }
            }
        }
        
        uint256 median;
        if (count % 2 == 0) {
            median = (prices[count / 2 - 1] + prices[count / 2]) / 2;
        } else {
            median = prices[count / 2];
        }
        
        return (median, latestTimestamp, true);
    }
    
    /**
     * @dev Weighted average strategy
     */
    function _getPriceWeighted(
        string memory tokenCode,
        OracleSource[] memory sources
    ) private view returns (uint256, uint256, bool) {
        uint256 weightedSum = 0;
        uint256 totalWeight = 0;
        uint256 latestTimestamp = 0;
        
        for (uint256 i = 0; i < sources.length; i++) {
            if (!sources[i].isActive) continue;
            
            try sources[i].adapter.getPrice(tokenCode) returns (
                uint256 price,
                uint256 timestamp,
                bool valid
            ) {
                if (valid) {
                    weightedSum += price * sources[i].weight;
                    totalWeight += sources[i].weight;
                    if (timestamp > latestTimestamp) {
                        latestTimestamp = timestamp;
                    }
                }
            } catch {
                continue;
            }
        }
        
        if (totalWeight == 0) return (0, 0, false);
        
        uint256 weightedPrice = weightedSum / totalWeight;
        return (weightedPrice, latestTimestamp, true);
    }
    
    function getPriceDecimals(string memory tokenCode)
        external
        view
        override
        returns (uint8)
    {
        // Use first active source's decimals
        OracleSource[] memory sources = tokenSources[tokenCode];
        for (uint256 i = 0; i < sources.length; i++) {
            if (sources[i].isActive) {
                return sources[i].adapter.getPriceDecimals(tokenCode);
            }
        }
        revert("No active sources");
    }
    
    function supportsToken(string memory tokenCode)
        external
        view
        override
        returns (bool)
    {
        return tokenSources[tokenCode].length > 0;
    }
    
    function getAdapterInfo()
        external
        pure
        override
        returns (string memory, string memory)
    {
        return ("Composite", "1.0.0");
    }
}
```

---

## 🔄 Migration Path (Zero Downtime)

### Fase 1: Deploy Adapters (No Changes to Existing)
```
1. Deploy ChainlinkAdapter
2. Configure tutti i price feeds esistenti nel ChainlinkAdapter
3. Test ChainlinkAdapter standalone
```

### Fase 2: Update TokenManager
```
1. Deploy nuovo TokenManager con adapter support
2. Point to ChainlinkAdapter
3. Migrate token configs
4. Update Beacon to point to new TokenManager
```

### Fase 3: Zero Downtime Switch
```
1. All existing contracts (ValueCalculator, SwapManager) continue working
2. Interface getTokenPrice() unchanged → no code changes needed
3. Behavior identical → just internal delegation to adapter
```

### Fase 4: Add New Oracles (Optional)
```
1. Deploy PythAdapter (or others)
2. Deploy CompositeOracleAdapter
3. Switch TokenManager to use CompositeOracleAdapter
4. Configure fallback: Chainlink primary, Pyth fallback
```

---

## ✅ Vantaggi

### 1. **Backward Compatibility al 100%**
- `getTokenPrice()` interface invariata
- Zero modifiche a ValueCalculator
- Zero modifiche a SwapManager
- Zero modifiche a test esistenti

### 2. **Flessibilità Estrema**
- Aggiungi Pyth domani → deploy adapter, update config
- Vuoi TWAP da Uniswap? → deploy adapter
- Vuoi media di 3 oracle? → use CompositeOracleAdapter

### 3. **Resilienza**
- Oracle primary down? → automatic fallback
- Prezzi anomali? → median filter
- Circuit breaker su deviazioni

### 4. **Testing**
```solidity
// Mock adapter per test
contract MockOracleAdapter is IOracleAdapter {
    mapping(string => uint256) public prices;
    
    function setPrice(string memory token, uint256 price) external {
        prices[token] = price;
    }
    
    function getPrice(string memory token) external view override 
        returns (uint256, uint256, bool) 
    {
        return (prices[token], block.timestamp, true);
    }
}
```

### 5. **Gas Optimization**
- Adapter leggero → stesso gas di prima
- Composite solo quando serve features avanzate
- Cache in ValueCalculator still works

---

## 📊 Comparison Table

| Feature | Attuale (Hardcoded) | Con Adapter Pattern |
|---------|---------------------|---------------------|
| Oracle providers | Solo Chainlink | Infiniti |
| Fallback logic | ❌ Nessuno | ✅ Automatico |
| Composite strategies | ❌ No | ✅ Sì |
| Testing | Mock Chainlink | Mock IOracleAdapter |
| Migration | Breaking changes | Smooth |
| Gas overhead | Baseline | +~2000 gas (trascurabile) |
| Vendor lock-in | 🔴 Alto | 🟢 Zero |

---

## 🚀 Implementation Checklist

- [ ] **Fase 1**: Crea interfaces
  - [ ] `IOracleAdapter.sol`
  
- [ ] **Fase 2**: Implementa ChainlinkAdapter
  - [ ] `ChainlinkAdapter.sol`
  - [ ] Test suite per ChainlinkAdapter
  - [ ] Deploy e configure su testnet
  
- [ ] **Fase 3**: Update TokenManager
  - [ ] Aggiungi `oracleAdapter` storage
  - [ ] Modifica `getTokenPrice()` per delegare
  - [ ] Simplify `manageTokenData()` (rimuovi price feed params)
  - [ ] Test backward compatibility
  
- [ ] **Fase 4**: Migration
  - [ ] Script di migration
  - [ ] Deploy su testnet
  - [ ] Verify nessun breaking change
  - [ ] Deploy mainnet
  
- [ ] **Fase 5**: Advanced Features (Optional)
  - [ ] Implementa `PythAdapter`
  - [ ] Implementa `CompositeOracleAdapter`
  - [ ] Configure fallback strategies
  - [ ] Test resilience

---

## 💡 Alternative Considerate

### Opzione B: Strategy Pattern Diretto in TokenManager
❌ **Rejected** perché:
- Aggiunge complessità a TokenManager
- TokenManager diventa "fat contract"
- Difficile testare strategies isolatamente

### Opzione C: Registry Pattern
❌ **Rejected** perché:
- Overhead inutile
- Adapter pattern più semplice
- Registry utile solo con 10+ providers

### ✅ Opzione A: Adapter Pattern
**Scelta finale** perché:
- Clean separation
- Easy testing
- Backward compatible
- Industry standard pattern

---

## 🎓 Resources

- [Adapter Pattern in Solidity](https://solidity-by-example.org/)
- [Chainlink Best Practices](https://docs.chain.link/data-feeds/best-practices)
- [Pyth Network Integration](https://docs.pyth.network/)
- [Uniswap TWAP Oracle](https://docs.uniswap.org/contracts/v3/guides/oracle/integration)

---

## 📝 Notes

- Gas cost per adapter call: ~2000-3000 extra gas (trascurabile)
- CompositeOracleAdapter con 3 sources: ~10k gas extra
- Mantieni cache in ValueCalculator per ottimizzazione
- Consider circuit breaker per deviazioni > 10%

---

**Next**: Vedi `03_IMPLEMENTATION_GUIDE.md` per step-by-step implementation
