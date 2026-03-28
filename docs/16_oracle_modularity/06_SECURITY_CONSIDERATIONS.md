# Security Considerations for Oracle Modularity

**Versione**: 1.0  
**Data**: 14 Novembre 2025  
**Status**: Security Analysis  

---

## 🎯 **OVERVIEW**

Questo documento analizza i rischi di sicurezza legati all'implementazione di oracle modulari e definisce le mitigazioni necessarie.

**Scope**: Coprire attack vectors specifici per oracle price feeds e adapter pattern.

---

## 🚨 **THREAT MODEL**

### **Assets at Risk**

1. **User Funds** in liquidity pools
2. **Protocol TVL** (Total Value Locked)
3. **Protocol Solvency** - capacità di onorare withdrawals
4. **Protocol Reputation**

### **Threat Actors**

| Actor | Motivation | Capability |
|-------|-----------|------------|
| **Flash Loan Attacker** | Profit via price manipulation | High capital, technical skill |
| **MEV Bot** | Extract value from price discrepancies | Automated, fast execution |
| **Malicious Oracle Provider** | Disrupt protocol / profit | Control over oracle data |
| **Compromised Admin** | Misconfiguration or malicious intent | Admin keys |
| **Smart Contract Bug** | Unintended behavior | N/A - code flaw |

---

## 🔴 **ATTACK VECTORS**

### **1. Oracle Price Manipulation**

#### **Attack Description**

Attacker manipulates oracle price feed to:
- **Inflate** asset value → withdraw more than entitled
- **Deflate** asset value → buy assets below fair value
- **Cause liquidations** → profit from liquidation penalties

#### **Attack Scenarios**

**Scenario A: Flash Loan Price Manipulation (Chainlink)**
```solidity
// Attacker's contract
function attack() external {
    // 1. Take flash loan of 10M USDC
    flashLoan(10_000_000e6);
    
    // 2. Dump USDC on DEX → crash USDC price momentarily
    //    (Chainlink may lag behind actual market)
    
    // 3. Protocol reads "stale" higher USDC price from Chainlink
    //    while actual market is lower
    
    // 4. Withdraw USDC at inflated value
    protocol.withdraw(lpTokens);
    
    // 5. Repay flash loan, keep profit
    repayFlashLoan();
}
```

**Impact**: Loss of funds for other LPs

#### **Mitigations**

✅ **Heartbeat Validation**
```solidity
// Check price freshness
require(block.timestamp - updatedAt <= heartbeat, "Price too old");
```

✅ **Price Deviation Checks**
```solidity
// Reject prices that deviate too much from last known price
uint256 maxDeviation = 10%; // 10% max change per update
require(
    newPrice <= lastPrice * (100 + maxDeviation) / 100 &&
    newPrice >= lastPrice * (100 - maxDeviation) / 100,
    "Price deviation too high"
);
```

✅ **Multiple Oracle Sources** (CompositeAdapter)
```solidity
// Use median of 3 oracles - harder to manipulate all
uint256 chainlinkPrice = chainlinkAdapter.getPrice("USDC");
uint256 pythPrice = pythAdapter.getPrice("USDC");
uint256 uniswapPrice = uniswapTWAPAdapter.getPrice("USDC");

uint256 medianPrice = median(chainlinkPrice, pythPrice, uniswapPrice);
```

✅ **Time-Weighted Average Price (TWAP)**
```solidity
// Use TWAP instead of spot price
uint256 twapPrice = getTWAP(tokenCode, 30 minutes);
// Harder to manipulate for sustained period
```

---

### **2. Oracle Failure / Downtime**

#### **Attack Description**

Oracle becomes unavailable:
- **Chainlink feed paused** (maintenance, security incident)
- **Network congestion** prevents oracle updates
- **Oracle contract bug** causes reverts

**Impact**: Protocol cannot operate, users cannot withdraw/deposit

#### **Attack Scenarios**

**Scenario B: Oracle Downtime DoS**
```solidity
// TokenManager.getTokenPrice() calls oracle
(uint256 price,,) = oracleAdapter.getPrice("USDC");
// ↑ REVERTS if oracle down

// Entire protocol stops functioning
```

#### **Mitigations**

✅ **Fallback Oracle** (CompositeAdapter with PRIMARY_FALLBACK strategy)
```solidity
// Try Chainlink first
try chainlinkAdapter.getPrice("USDC") returns (uint256 price, ...) {
    if (isValid) return price;
} catch {}

// Fallback to Pyth
try pythAdapter.getPrice("USDC") returns (uint256 price, ...) {
    if (isValid) return price;
} catch {}

// Fallback to Uniswap TWAP
return uniswapAdapter.getPrice("USDC");
```

✅ **Circuit Breaker Pattern**
```solidity
// Track oracle failures
uint256 public errorCount;
uint256 public constant MAX_ERRORS = 5;

function getPrice(string memory tokenCode) external view returns (...) {
    if (errorCount >= MAX_ERRORS) {
        // Oracle in "circuit breaker" mode
        // Use last known good price + warning
        return (lastGoodPrice, lastTimestamp, false);
    }
    
    try externalOracle.getPrice() {
        errorCount = 0; // Reset on success
        return ...;
    } catch {
        errorCount++;
        return (lastGoodPrice, lastTimestamp, false);
    }
}
```

✅ **Graceful Degradation**
```solidity
// Allow operations to continue with warnings
(uint256 price, , bool isValid) = oracleAdapter.getPrice("USDC");

if (!isValid) {
    // Emit warning event
    emit OracleIssueDetected("USDC", "Price not valid");
    
    // Use last known price with staleness flag
    price = tokenData["USDC"].lastPrice;
    
    // Potentially restrict sensitive operations
    if (operationType == HIGH_RISK) {
        revert("Oracle unavailable for high-risk operation");
    }
}
```

---

### **3. Adapter Configuration Errors**

#### **Attack Description**

Admin misconfigures adapter:
- **Wrong price feed address** → uses incorrect oracle
- **Wrong decimals** → price normalization errors (10^decimals)
- **Wrong heartbeat** → accepts stale prices
- **Untrusted adapter** → malicious implementation

**Impact**: Incorrect pricing → fund loss

#### **Attack Scenarios**

**Scenario C: Decimals Misconfiguration**
```solidity
// Admin sets USDC price feed with wrong decimals
adapter.setPriceFeed("USDC", chainlinkUSDC, 18, 3600);
//                                            ^^
//                                  WRONG! Should be 8

// Later, ValueCalculator does:
uint256 value = (amount * price) / (10 ** 18);
//                                      ^^^^^^
//                            Divides by 10^18 instead of 10^8
// Result: Price off by 10^10 (10 billion)
```

#### **Mitigations**

✅ **On-Chain Validation**
```solidity
function setPriceFeed(
    string memory tokenCode,
    address feedAddress,
    uint8 decimals,
    uint256 heartbeat
) external onlyOwner {
    // 1. Validate feed address
    require(feedAddress != address(0), "Invalid feed");
    
    // 2. Validate decimals range
    require(decimals > 0 && decimals <= 18, "Invalid decimals");
    
    // 3. Validate heartbeat
    require(heartbeat > 0 && heartbeat <= 24 hours, "Invalid heartbeat");
    
    // 4. TEST FEED WORKS
    AggregatorV3Interface feed = AggregatorV3Interface(feedAddress);
    try feed.latestRoundData() returns (
        uint80 roundId,
        int256 price,
        uint256,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        // Validate response
        require(price > 0, "Invalid price");
        require(updatedAt > 0, "Round not complete");
        require(answeredInRound >= roundId, "Stale feed");
    } catch {
        revert("Feed validation failed");
    }
    
    // 5. Check decimals match (if oracle has decimals() method)
    try feed.decimals() returns (uint8 oracleDecimals) {
        require(oracleDecimals == decimals, "Decimals mismatch");
    } catch {
        // Feed doesn't expose decimals, accept provided value
    }
}
```

✅ **Multi-Sig for Adapter Changes**
```solidity
// Require multiple signers to change critical config
contract AdapterManager is Ownable {
    uint256 public constant DELAY = 24 hours; // Timelock
    
    function setOracleAdapter(address newAdapter) external onlyOwner {
        // Propose change
        proposedAdapter = newAdapter;
        proposalTime = block.timestamp;
        
        emit AdapterChangeProposed(newAdapter);
    }
    
    function executeAdapterChange() external onlyOwner {
        require(block.timestamp >= proposalTime + DELAY, "Timelock not expired");
        
        // Execute after delay
        tokenManager.setOracleAdapter(proposedAdapter);
    }
}
```

✅ **Whitelist Pattern**
```solidity
// Only allow pre-approved adapter implementations
mapping(address => bool) public approvedAdapters;

function setOracleAdapter(address newAdapter) external onlyOwner {
    require(approvedAdapters[newAdapter], "Adapter not whitelisted");
    oracleAdapter = IOracleAdapter(newAdapter);
}
```

---

### **4. Stale Price Acceptance**

#### **Attack Description**

Protocol accepts outdated price during:
- **Network congestion** → oracle update delayed
- **Oracle maintenance** → feed temporarily paused
- **Heartbeat misconfiguration** → accepts too-old prices

**Impact**: Users trade at unfair prices

#### **Mitigations**

✅ **Strict Heartbeat Enforcement**
```solidity
// In adapter.getPrice()
bool isFresh = block.timestamp - updatedAt <= heartbeat;

if (!isFresh) {
    return (price, updatedAt, false); // Mark as invalid
}
```

✅ **Multiple Heartbeat Thresholds**
```solidity
// Different thresholds for different risk levels
uint256 constant STANDARD_HEARTBEAT = 1 hours;
uint256 constant STRICT_HEARTBEAT = 15 minutes;

function getPrice(string memory tokenCode, RiskLevel riskLevel)
    external view returns (...)
{
    uint256 maxAge = (riskLevel == RiskLevel.HIGH) 
        ? STRICT_HEARTBEAT 
        : STANDARD_HEARTBEAT;
    
    bool isFresh = block.timestamp - updatedAt <= maxAge;
    return (..., isFresh);
}
```

✅ **Token-Specific Heartbeats**
```solidity
// Volatile tokens → shorter heartbeat
// Stablecoins → longer heartbeat acceptable

mapping(string => uint256) public tokenHeartbeats;

tokenHeartbeats["ETH"] = 15 minutes;   // Volatile
tokenHeartbeats["USDC"] = 1 hours;     // Stable
```

---

### **5. Reentrancy via Oracle Calls**

#### **Attack Description**

Malicious adapter performs reentrancy:
```solidity
contract MaliciousAdapter {
    function getPrice(string memory tokenCode) external view returns (...) {
        // Call back into protocol during "view" function
        targetContract.withdraw(stealAmount);
        
        return (fakePrice, block.timestamp, true);
    }
}
```

**Impact**: State changes during supposedly read-only operation

#### **Mitigations**

✅ **Checks-Effects-Interactions Pattern**
```solidity
// Complete all state changes BEFORE calling adapter
function someFunction() external {
    // 1. Checks
    require(authorized, "Not authorized");
    
    // 2. Effects (state changes)
    balance[msg.sender] -= amount;
    
    // 3. Interactions (external calls)
    (uint256 price,,) = oracleAdapter.getPrice("USDC");
}
```

✅ **ReentrancyGuard** (where applicable)
```solidity
contract TokenManager is ReentrancyGuard {
    function getTokenPrice(string memory tokenCode)
        public
        view
        nonReentrant // Prevent reentrancy even in view
        returns (...)
    {
        return oracleAdapter.getPrice(tokenCode);
    }
}
```

✅ **Adapter Whitelisting**
```solidity
// Only use trusted, audited adapters
// Malicious adapters can't be added
```

---

### **6. Admin Key Compromise**

#### **Attack Description**

Attacker gains control of admin keys:
- **Private key leak**
- **Phishing attack**
- **Malware**

**Actions attacker can perform:**
```solidity
// 1. Switch to malicious adapter
tokenManager.setOracleAdapter(maliciousAdapter);

// 2. Configure wrong price feeds
adapter.setPriceFeed("USDC", maliciousFeed, ...);

// 3. Disable circuit breakers
adapter.setMaxErrorThreshold(999999);
```

**Impact**: Total protocol compromise

#### **Mitigations**

✅ **Multi-Signature Wallet**
```solidity
// Require 2-of-3 or 3-of-5 signatures for critical operations
// Use Gnosis Safe or similar
```

✅ **Timelock for Critical Changes**
```solidity
// 24-48 hour delay for adapter changes
// Community can react if malicious change proposed
```

✅ **Role-Based Access Control**
```solidity
// Separate roles for different operations
contract TokenManager is AccessControl {
    bytes32 public constant ADAPTER_ADMIN = keccak256("ADAPTER_ADMIN");
    bytes32 public constant FEED_MANAGER = keccak256("FEED_MANAGER");
    
    function setOracleAdapter(address newAdapter) 
        external 
        onlyRole(ADAPTER_ADMIN) 
    { ... }
    
    function setPriceFeed(...) 
        external 
        onlyRole(FEED_MANAGER) 
    { ... }
}
```

✅ **Emergency Pause Mechanism**
```solidity
// Emergency multisig can pause protocol if compromise detected
function emergencyPause() external onlyEmergencyMultisig {
    paused = true;
    emit EmergencyPause(msg.sender);
}
```

---

## 🛡️ **SECURITY BEST PRACTICES**

### **1. Adapter Implementation**

**DO:**
- ✅ Use `view` functions for price queries (no state changes)
- ✅ Validate all inputs (token codes, addresses)
- ✅ Implement circuit breakers for error tracking
- ✅ Emit events for monitoring
- ✅ Follow Checks-Effects-Interactions pattern
- ✅ Write comprehensive tests

**DON'T:**
- ❌ Trust external oracle data blindly
- ❌ Modify state in `getPrice()` (should be view)
- ❌ Allow unbounded loops in price calculations
- ❌ Use `tx.origin` for authentication
- ❌ Perform complex calculations in view functions (gas limits)

### **2. Configuration**

**DO:**
- ✅ Validate feed addresses on-chain
- ✅ Test feed works before accepting
- ✅ Use reasonable heartbeats (15min - 1 hour)
- ✅ Document decimals for each feed
- ✅ Use multi-sig for configuration changes

**DON'T:**
- ❌ Set heartbeat too high (>24 hours)
- ❌ Accept zero address for feeds
- ❌ Mix decimals (e.g., 8 vs 18)
- ❌ Skip validation on configuration

### **3. Monitoring**

**DO:**
- ✅ Monitor oracle update frequency
- ✅ Alert on price deviations >10%
- ✅ Track error counts per adapter
- ✅ Monitor gas costs for oracle calls
- ✅ Set up health checks

**DON'T:**
- ❌ Ignore stale price warnings
- ❌ Let errors accumulate without investigation
- ❌ Skip post-deployment monitoring

---

## 🔬 **TESTING REQUIREMENTS**

### **Security Test Cases**

```solidity
describe("Security Tests", function() {
    
    it("Should reject prices deviating >10% from last", async function() {
        // Set initial price
        await mockOracle.setPrice(2000e8);
        
        // Try to set price 20% higher
        await mockOracle.setPrice(2400e8);
        
        const [, , isValid] = await adapter.getPrice("USDC");
        expect(isValid).to.be.false; // Rejected
    });
    
    it("Should use fallback oracle if primary fails", async function() {
        // Break primary oracle
        await primaryOracle.setPaused(true);
        
        // Should use fallback
        const [price,,] = await compositeAdapter.getPrice("USDC");
        expect(price).to.equal(FALLBACK_PRICE);
    });
    
    it("Should reject stale prices", async function() {
        // Advance time beyond heartbeat
        await ethers.provider.send("evm_increaseTime", [3600 + 1]);
        
        const [, , isValid] = await adapter.getPrice("USDC");
        expect(isValid).to.be.false;
    });
    
    it("Should validate feed on configuration", async function() {
        // Try to configure invalid feed
        await expect(
            adapter.setPriceFeed("USDC", invalidFeedAddress, 8, 3600)
        ).to.be.revertedWith("Feed validation failed");
    });
    
    it("Should prevent reentrancy", async function() {
        // Attempt reentrancy attack
        const attacker = await MaliciousAdapter.deploy();
        
        await expect(
            tokenManager.setOracleAdapter(attacker.address)
        ).to.be.revertedWith("Reentrancy detected");
    });
});
```

---

## 📋 **PRE-DEPLOYMENT SECURITY CHECKLIST**

### **Code Review**

- [ ] All adapters implement `IOracleAdapter` correctly
- [ ] No state changes in view functions
- [ ] Input validation on all public functions
- [ ] Circuit breakers implemented
- [ ] ReentrancyGuard where needed
- [ ] Access control properly configured

### **Configuration**

- [ ] All price feeds validated on testnet
- [ ] Decimals verified for each feed
- [ ] Heartbeats set appropriately
- [ ] Fallback oracles configured (if CompositeAdapter)
- [ ] Admin keys use multi-sig

### **Testing**

- [ ] 100% test coverage for adapters
- [ ] Security tests pass (stale prices, deviation, reentrancy)
- [ ] Integration tests with full system pass
- [ ] Gas benchmarks acceptable (<50k per getPrice)
- [ ] Fork tests on mainnet data pass

### **Monitoring**

- [ ] Oracle health check dashboard
- [ ] Alerts for stale prices
- [ ] Alerts for price deviations >10%
- [ ] Error rate monitoring
- [ ] Gas cost tracking

### **Incident Response**

- [ ] Emergency pause mechanism tested
- [ ] Rollback procedure documented
- [ ] Emergency multisig ready
- [ ] On-call rotation defined

---

## 🚨 **INCIDENT RESPONSE PLAN**

### **If Oracle Compromise Detected**

```bash
# 1. IMMEDIATE - Pause protocol (if possible)
await emergencyMultisig.pause();

# 2. Assess damage
# - Check recent transactions
# - Identify affected users
# - Calculate losses

# 3. Rollback to safe adapter
await tokenManager.setOracleAdapter(SAFE_ADAPTER_ADDRESS);

# 4. Communication
# - Announce incident to community
# - Provide updates every 2 hours
# - Transparency on losses

# 5. Post-Mortem
# - Root cause analysis
# - Update security measures
# - Compensate affected users (if applicable)
```

---

## 📚 **REFERENCES**

### **Known Oracle Attack Examples**

1. **Compound Oracle Attack (Nov 2020)**
   - Price manipulation via Coinbase API
   - $89M liquidations
   - Lesson: Don't rely on single source

2. **bZx Flash Loan Attack (Feb 2020)**
   - Manipulated Uniswap V1 oracle
   - $350k stolen
   - Lesson: Use TWAP, not spot price

3. **Harvest Finance (Oct 2020)**
   - Curve pool manipulation
   - $24M stolen
   - Lesson: Large trades affect prices

### **Security Resources**

- [Chainlink Best Practices](https://docs.chain.link/data-feeds/best-practices)
- [Trail of Bits: DeFi Security Guide](https://blog.trailofbits.com/)
- [Consensys: Smart Contract Best Practices](https://consensys.github.io/smart-contract-best-practices/)
- [OpenZeppelin: Security Considerations](https://docs.openzeppelin.com/contracts/4.x/api/security)

---

## ✅ **SECURITY SIGN-OFF**

Before mainnet deployment:

- [ ] Security audit completed by reputable firm
- [ ] All high/critical findings resolved
- [ ] Medium findings risk-accepted or resolved
- [ ] Bug bounty program launched
- [ ] Insurance coverage obtained (if available)
- [ ] Legal review completed

---

**Version**: 1.0.0  
**Last Updated**: 14 Novembre 2025  
**Status**: ✅ Security Analysis Complete  
**Next Review**: Before mainnet deployment
