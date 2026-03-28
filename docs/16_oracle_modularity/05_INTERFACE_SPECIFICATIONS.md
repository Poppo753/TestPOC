# IOracleAdapter Interface Specifications

**Versione**: 1.0  
**Data**: 14 Novembre 2025  
**Status**: Interface Definition  

---

## 📋 **OVERVIEW**

Questo documento definisce le specifiche complete dell'interface `IOracleAdapter`, che è il contratto standard che tutti gli oracle providers devono implementare per integrarsi con il sistema.

**Scopo**: Fornire un'interfaccia uniforme per recuperare prezzi da qualsiasi oracle provider (Chainlink, Pyth, Uniswap TWAP, ecc.).

---

## 🔧 **INTERFACE DEFINITION**

### **File**: `contracts/interfaces/IOracleAdapter.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IOracleAdapter
 * @notice Standard interface for oracle price adapters
 * @dev All oracle implementations (Chainlink, Pyth, etc.) must conform to this interface
 * 
 * Interface Design Principles:
 * 1. Backward compatible with TokenManager.getTokenPrice()
 * 2. Simple and minimal - no unnecessary complexity
 * 3. View functions only - no state changes
 * 4. Clear error handling through return values
 */
interface IOracleAdapter {
    
    // ==================== ERRORS ====================
    
    /// @notice Thrown when token is not supported by this adapter
    /// @param tokenCode The token code that is not supported
    error TokenNotSupported(string tokenCode);
    
    /// @notice Thrown when price is invalid (zero or negative)
    error InvalidPrice();
    
    /// @notice Thrown when price is too old (exceeds heartbeat)
    /// @param timestamp Price timestamp
    /// @param maxAge Maximum allowed age
    error StalePrice(uint256 timestamp, uint256 maxAge);
    
    /// @notice Thrown when oracle call fails
    /// @param reason Failure reason
    error OracleCallFailed(string reason);
    
    // ==================== EVENTS ====================
    
    /// @notice Emitted when price is successfully retrieved
    /// @param tokenCode Token identifier
    /// @param price Retrieved price
    /// @param timestamp Price update timestamp
    /// @param isValid Whether price is considered valid
    event PriceRetrieved(
        string indexed tokenCode,
        uint256 price,
        uint256 timestamp,
        bool isValid
    );
    
    // ==================== CORE FUNCTIONS ====================
    
    /**
     * @notice Get current price for a token
     * @dev This is the PRIMARY function used by TokenManager
     * 
     * Requirements:
     * - MUST revert with TokenNotSupported if token not configured
     * - MUST return price > 0 if isValid = true
     * - MUST return current block.timestamp or earlier for timestamp
     * - MUST validate price before returning (provider-specific checks)
     * 
     * @param tokenCode Unique token identifier (e.g., "USDC", "WBTC")
     * @return price Current price in adapter's native decimals
     * @return timestamp Unix timestamp of last price update
     * @return isValid True if price passed all validations and is fresh
     */
    function getPrice(string memory tokenCode)
        external
        view
        returns (
            uint256 price,
            uint256 timestamp,
            bool isValid
        );
    
    /**
     * @notice Get decimals used by price feed
     * @dev CRITICAL: Used for price normalization in calculations
     * 
     * Requirements:
     * - MUST return consistent value for same token
     * - MUST be between 0 and 18 (inclusive)
     * - Chainlink typically uses 8 decimals for USD pairs
     * 
     * Example:
     * - Chainlink ETH/USD: 8 decimals (price = 200000000000 = $2000.00)
     * - Pyth may use different decimals
     * 
     * @param tokenCode Token identifier
     * @return decimals Number of decimals in price value
     */
    function getPriceDecimals(string memory tokenCode)
        external
        view
        returns (uint8 decimals);
    
    /**
     * @notice Check if adapter supports a specific token
     * @dev Use this to avoid reverts before calling getPrice()
     * 
     * Usage Pattern:
     * ```solidity
     * if (adapter.supportsToken("USDC")) {
     *     (uint256 price,,) = adapter.getPrice("USDC");
     * }
     * ```
     * 
     * @param tokenCode Token to check
     * @return supported True if token is configured in this adapter
     */
    function supportsToken(string memory tokenCode)
        external
        view
        returns (bool supported);
    
    /**
     * @notice Get adapter metadata for identification
     * @dev Useful for logging, debugging, and UI display
     * 
     * Examples:
     * - ChainlinkAdapter: ("Chainlink", "1.0.0")
     * - PythAdapter: ("Pyth", "1.0.0")
     * - CompositeAdapter: ("Composite", "1.0.0")
     * 
     * @return name Human-readable adapter name
     * @return version Semantic version string
     */
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

## 📖 **METHOD SPECIFICATIONS**

### **1. getPrice()**

**Signature**: 
```solidity
function getPrice(string memory tokenCode) 
    external view 
    returns (uint256 price, uint256 timestamp, bool isValid)
```

#### **Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `tokenCode` | `string` | Unique token identifier (e.g., "USDC", "WBTC", "ARB") |

#### **Returns**

| Return | Type | Description |
|--------|------|-------------|
| `price` | `uint256` | Current price in adapter's native decimals. Zero if invalid. |
| `timestamp` | `uint256` | Unix timestamp of last price update from oracle |
| `isValid` | `bool` | `true` if price passed all validations, `false` otherwise |

#### **Behavior**

**MUST:**
- Revert with `TokenNotSupported` if token is not configured
- Return `price > 0` when `isValid = true`
- Return `price = 0` when `isValid = false`
- Perform provider-specific validations (e.g., Chainlink roundId checks)
- Check price freshness against heartbeat/max age
- Return actual oracle update timestamp, not `block.timestamp`

**SHOULD:**
- Emit `PriceRetrieved` event for monitoring
- Use try/catch for external oracle calls
- Handle oracle failures gracefully

**MUST NOT:**
- Modify state (view function)
- Return stale price as valid
- Return negative price (use uint256)

#### **Example Implementation Pattern**

```solidity
function getPrice(string memory tokenCode)
    external
    view
    override
    returns (uint256 price, uint256 timestamp, bool isValid)
{
    // 1. Check token is supported
    PriceFeedConfig memory config = priceFeeds[tokenCode];
    if (!config.isActive) {
        revert TokenNotSupported(tokenCode);
    }
    
    // 2. Query external oracle
    try externalOracle.latestData() returns (int256 rawPrice, uint256 updatedAt) {
        
        // 3. Validate price
        if (rawPrice <= 0) {
            return (0, 0, false);
        }
        
        // 4. Check freshness
        bool isFresh = block.timestamp - updatedAt <= config.heartbeat;
        
        // 5. Return result
        return (uint256(rawPrice), updatedAt, isFresh);
        
    } catch {
        // Oracle call failed
        return (0, 0, false);
    }
}
```

#### **Usage in TokenManager**

```solidity
// TokenManager.getTokenPrice() delegates to adapter
function getTokenPrice(string memory _tokenCode)
    public
    view
    returns (uint256 price, uint256 updatedAt, bool isStale)
{
    require(tokenData[_tokenCode].isActive, "Token not active");
    
    // Call adapter
    (uint256 oraclePrice, uint256 timestamp, bool isValid) = oracleAdapter.getPrice(_tokenCode);
    
    require(isValid, "Invalid oracle price");
    
    // Additional staleness check based on TokenManager's heartbeat
    TokenInfo memory token = tokenData[_tokenCode];
    bool stale = block.timestamp - timestamp > token.heartbeat;
    
    return (oraclePrice, timestamp, stale);
}
```

---

### **2. getPriceDecimals()**

**Signature**:
```solidity
function getPriceDecimals(string memory tokenCode) 
    external view 
    returns (uint8 decimals)
```

#### **Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `tokenCode` | `string` | Token identifier |

#### **Returns**

| Return | Type | Description |
|--------|------|-------------|
| `decimals` | `uint8` | Number of decimals in price (0-18) |

#### **Behavior**

**MUST:**
- Revert with `TokenNotSupported` if token not configured
- Return consistent value for same token (immutable per token)
- Return value between 0 and 18 (inclusive)

**Common Values:**
- Chainlink USD pairs: `8` (e.g., ETH/USD = 200000000000 = $2000.00)
- Chainlink ETH pairs: `18`
- Custom adapters: Depends on implementation

#### **Example**

```solidity
function getPriceDecimals(string memory tokenCode)
    external
    view
    override
    returns (uint8)
{
    PriceFeedConfig memory config = priceFeeds[tokenCode];
    if (!config.isActive) {
        revert TokenNotSupported(tokenCode);
    }
    return config.decimals;
}
```

#### **Usage Pattern**

```solidity
// In ValueCalculator - normalize price
uint256 price = tokenManager.getTokenPrice("USDC");
uint8 priceDecimals = oracleAdapter.getPriceDecimals("USDC");

// Calculate value: (tokenAmount * price) / 10^priceDecimals
uint256 value = (tokenBalance * price) / (10 ** priceDecimals);
```

---

### **3. supportsToken()**

**Signature**:
```solidity
function supportsToken(string memory tokenCode) 
    external view 
    returns (bool supported)
```

#### **Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `tokenCode` | `string` | Token to check |

#### **Returns**

| Return | Type | Description |
|--------|------|-------------|
| `supported` | `bool` | `true` if token is configured, `false` otherwise |

#### **Behavior**

**MUST:**
- Return `true` only if token is fully configured and active
- Return `false` for unconfigured tokens (no revert)
- Be consistent with `getPrice()` behavior

**MUST NOT:**
- Revert (always return bool)
- Perform external calls (gas efficient check)

#### **Example**

```solidity
function supportsToken(string memory tokenCode)
    external
    view
    override
    returns (bool)
{
    return priceFeeds[tokenCode].isActive;
}
```

#### **Usage Pattern**

```solidity
// Defensive programming - check before use
if (!oracleAdapter.supportsToken("NEWTOKEN")) {
    revert("Token not supported by oracle");
}

// Safe to call now
(uint256 price,,) = oracleAdapter.getPrice("NEWTOKEN");
```

---

### **4. getAdapterInfo()**

**Signature**:
```solidity
function getAdapterInfo() 
    external view 
    returns (string memory name, string memory version)
```

#### **Returns**

| Return | Type | Description |
|--------|------|-------------|
| `name` | `string` | Human-readable adapter name |
| `version` | `string` | Semantic version (e.g., "1.0.0") |

#### **Behavior**

**MUST:**
- Return consistent values (typically hardcoded)
- Use semantic versioning for `version`
- Use descriptive name for `name`

**Examples:**
- ChainlinkAdapter: `("Chainlink", "1.0.0")`
- PythAdapter: `("Pyth", "1.0.0")`
- CompositeAdapter: `("Composite", "1.0.0")`

#### **Example**

```solidity
function getAdapterInfo()
    external
    pure
    override
    returns (string memory name, string memory version)
{
    return ("Chainlink", "1.0.0");
}
```

#### **Usage**

```solidity
// Logging/monitoring
(string memory name, string memory version) = adapter.getAdapterInfo();
console.log("Using oracle adapter:", name, version);

// UI display
emit OracleAdapterChanged(name, version, adapterAddress);
```

---

## ⚠️ **ERROR HANDLING**

### **Standard Errors**

```solidity
/// @notice Token not supported by adapter
error TokenNotSupported(string tokenCode);

/// @notice Price validation failed
error InvalidPrice();

/// @notice Price too old
error StalePrice(uint256 timestamp, uint256 maxAge);

/// @notice External oracle call failed
error OracleCallFailed(string reason);
```

### **When to Use Each Error**

| Error | When to Use | Example |
|-------|-------------|---------|
| `TokenNotSupported` | Token not configured in adapter | User calls `getPrice("UNKNOWN")` |
| `InvalidPrice` | Price is zero or negative | Oracle returns invalid data |
| `StalePrice` | Price exceeds max age | Last update was 2 hours ago, heartbeat is 1 hour |
| `OracleCallFailed` | External call reverts | Chainlink feed is paused |

### **Error vs Return False**

**Use Revert (Error):**
- Token not configured → Caller made mistake
- Critical validation failure → Should not continue

**Use Return `isValid=false`:**
- Price is stale → Temporary issue, retry later
- Oracle unavailable → Transient failure
- Price failed validation → Data issue, not config issue

#### **Example Pattern**

```solidity
function getPrice(string memory tokenCode)
    external view returns (uint256, uint256, bool)
{
    // REVERT - configuration error
    if (!priceFeeds[tokenCode].isActive) {
        revert TokenNotSupported(tokenCode);
    }
    
    // RETURN FALSE - transient issue
    if (block.timestamp - lastUpdate > heartbeat) {
        return (0, 0, false); // Stale, but don't revert
    }
}
```

---

## 📝 **IMPLEMENTATION CHECKLIST**

When implementing a new adapter:

- [ ] **Interface Compliance**
  - [ ] Implements all 4 required functions
  - [ ] Uses exact function signatures
  - [ ] Returns correct types

- [ ] **getPrice() Implementation**
  - [ ] Reverts with `TokenNotSupported` for unknown tokens
  - [ ] Validates price > 0
  - [ ] Checks timestamp freshness
  - [ ] Returns `isValid=false` for transient failures
  - [ ] Emits `PriceRetrieved` event

- [ ] **getPriceDecimals() Implementation**
  - [ ] Returns correct decimals for each token
  - [ ] Consistent with actual price format
  - [ ] Reverts for unsupported tokens

- [ ] **supportsToken() Implementation**
  - [ ] Returns true only for configured tokens
  - [ ] Never reverts
  - [ ] Fast execution (no external calls)

- [ ] **getAdapterInfo() Implementation**
  - [ ] Returns descriptive name
  - [ ] Uses semantic versioning

- [ ] **Testing**
  - [ ] Unit tests for all functions
  - [ ] Tests for error cases
  - [ ] Integration tests with TokenManager
  - [ ] Gas benchmarks

---

## 🎯 **USAGE PATTERNS**

### **Pattern 1: TokenManager Integration**

```solidity
contract TokenManager {
    IOracleAdapter public oracleAdapter;
    
    function getTokenPrice(string memory tokenCode)
        public view returns (uint256, uint256, bool)
    {
        // Delegate to adapter
        (uint256 price, uint256 timestamp, bool isValid) = 
            oracleAdapter.getPrice(tokenCode);
        
        require(isValid, "Invalid price");
        
        // Additional checks...
        return (price, timestamp, staleness);
    }
}
```

### **Pattern 2: ValueCalculator Usage**

```solidity
contract ValueCalculator {
    function calculateValue(string memory tokenCode, uint256 amount)
        internal view returns (uint256)
    {
        // Get price from TokenManager (which uses adapter)
        (uint256 price,,) = tokenManager.getTokenPrice(tokenCode);
        
        // Get decimals for normalization
        uint8 priceDecimals = oracleAdapter.getPriceDecimals(tokenCode);
        
        // Calculate: (amount * price) / 10^decimals
        return (amount * price) / (10 ** priceDecimals);
    }
}
```

### **Pattern 3: Defensive Token Addition**

```solidity
function manageTokenData(string memory tokenCode, ...)
    external onlyOwner
{
    // Check oracle supports token BEFORE adding
    require(oracleAdapter.supportsToken(tokenCode), "Oracle doesn't support token");
    
    // Safe to add now
    tokenData[tokenCode] = TokenInfo({...});
}
```

---

## 🔬 **TESTING GUIDELINES**

### **Unit Tests Required**

```solidity
describe("IOracleAdapter Compliance", function() {
    
    it("Should implement all interface methods", async function() {
        // Verify function exists and signature correct
        expect(await adapter.getPrice("USDC")).to.exist;
        expect(await adapter.getPriceDecimals("USDC")).to.exist;
        expect(await adapter.supportsToken("USDC")).to.exist;
        expect(await adapter.getAdapterInfo()).to.exist;
    });
    
    it("getPrice: Should revert for unsupported token", async function() {
        await expect(
            adapter.getPrice("UNKNOWN")
        ).to.be.revertedWithCustomError(adapter, "TokenNotSupported");
    });
    
    it("getPrice: Should return valid=false for stale price", async function() {
        // Advance time beyond heartbeat
        await ethers.provider.send("evm_increaseTime", [7200]);
        
        const [, , isValid] = await adapter.getPrice("USDC");
        expect(isValid).to.be.false;
    });
    
    it("getPriceDecimals: Should return consistent value", async function() {
        const decimals1 = await adapter.getPriceDecimals("USDC");
        const decimals2 = await adapter.getPriceDecimals("USDC");
        expect(decimals1).to.equal(decimals2);
    });
    
    it("supportsToken: Should not revert", async function() {
        // Should return false, not revert
        const supported = await adapter.supportsToken("UNKNOWN");
        expect(supported).to.be.false;
    });
});
```

---

## 📚 **REFERENCE IMPLEMENTATIONS**

See:
- `02_ORACLE_MODULARITY_PROPOSAL.md` - ChainlinkAdapter full implementation
- `03_IMPLEMENTATION_GUIDE.md` - Step-by-step adapter creation

---

## ✅ **COMPLIANCE VERIFICATION**

Before deploying an adapter, verify:

1. **Interface**: Implements `IOracleAdapter` correctly
2. **Errors**: Uses standard error types
3. **Validations**: Performs provider-specific checks
4. **Testing**: Full test coverage
5. **Gas**: Reasonable gas costs (<50k for getPrice)
6. **Security**: No reentrancy, no state changes in views

---

**Version**: 1.0.0  
**Last Updated**: 14 Novembre 2025  
**Status**: ✅ Interface Definition Complete
