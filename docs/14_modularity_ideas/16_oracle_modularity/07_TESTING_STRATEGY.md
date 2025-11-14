# Testing Strategy for Oracle Modularity

**Versione**: 1.0  
**Data**: 14 Novembre 2025  
**Status**: Testing Framework  

---

## 🎯 **OVERVIEW**

Questo documento definisce la strategia completa di testing per il sistema di oracle modulari, garantendo robustezza, sicurezza e backward compatibility.

**Obiettivi:**
1. ✅ Zero breaking changes per contratti esistenti
2. ✅ Comportamento identico a sistema attuale (con Chainlink hardcoded)
3. ✅ Copertura security issues identificati
4. ✅ Performance acceptable (gas overhead <5k)

---

## 📊 **TEST PYRAMID**

```
       /\
      /E2E\         10% - End-to-End Tests
     /------\       
    /Integr.\      20% - Integration Tests
   /----------\    
  /   Unit     \   70% - Unit Tests
 /--------------\  
```

### **Distribution**

| Level | Coverage | Purpose |
|-------|----------|---------|
| **Unit** | 70% | Test individual adapter methods in isolation |
| **Integration** | 20% | Test adapter + TokenManager + ValueCalculator |
| **E2E** | 10% | Test full user flows (deposit → swap → withdraw) |

---

## 🧪 **UNIT TESTS**

### **Scope: Individual Adapter Contracts**

Test each adapter (ChainlinkAdapter, PythAdapter, etc.) in isolation.

### **Test Matrix: ChainlinkAdapter**

| Test Case | Description | Expected Outcome |
|-----------|-------------|------------------|
| **Configuration** | | |
| Add price feed | Configure new token | Success, token supported |
| Add invalid feed | Feed address = 0x0 | Revert: "Invalid feed address" |
| Add with wrong decimals | Decimals > 18 | Revert: "Invalid decimals" |
| Add with zero heartbeat | Heartbeat = 0 | Revert: "Invalid heartbeat" |
| Validate feed on add | Feed returns invalid data | Revert: "Feed validation failed" |
| Update existing feed | Change feed address | Success, event emitted |
| Remove feed | Mark feed inactive | Success, supportsToken = false |
| **Price Retrieval** | | |
| Get valid price | Token configured, price fresh | Returns price, isValid=true |
| Get stale price | Time > heartbeat | Returns price, isValid=false |
| Get price for unsupported token | Token not configured | Revert: TokenNotSupported |
| Oracle returns zero price | Chainlink returns 0 | Returns 0, isValid=false |
| Oracle returns negative price | Chainlink returns -1 | Returns 0, isValid=false |
| Oracle call reverts | Feed unavailable | Revert: OracleCallFailed |
| Chainlink round incomplete | updatedAt = 0 | Returns 0, isValid=false |
| Chainlink stale round | answeredInRound < roundId | Returns 0, isValid=false |
| **Decimals** | | |
| Get decimals | Token configured with 8 decimals | Returns 8 |
| Get decimals unsupported | Token not configured | Revert: TokenNotSupported |
| Decimals consistency | Call twice for same token | Returns same value |
| **Token Support** | | |
| Check supported token | Token configured | Returns true |
| Check unsupported token | Token not configured | Returns false |
| Support check no revert | Any token code | Never reverts, returns bool |
| **Adapter Info** | | |
| Get adapter name | Call getAdapterInfo | Returns ("Chainlink", "1.0.0") |
| Info consistency | Call multiple times | Always same result |
| **Error Tracking** | | |
| Circuit breaker activation | Errors >= threshold | getPrice returns false |
| Error count reset | Successful price retrieval | errorCount = 0 |
| Max error threshold update | Owner sets new threshold | Success, new value applied |

### **Example Test Implementation**

```typescript
// test/unit/ChainlinkAdapter.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { ChainlinkAdapter, MockChainlinkOracle } from "../../typechain-types";

describe("ChainlinkAdapter - Unit Tests", function () {
    let adapter: ChainlinkAdapter;
    let mockOracle: MockChainlinkOracle;
    let owner: any, user: any;

    beforeEach(async function () {
        [owner, user] = await ethers.getSigners();

        // Deploy mock oracle
        const MockOracleFactory = await ethers.getContractFactory("MockChainlinkOracle");
        mockOracle = await MockOracleFactory.deploy();
        await mockOracle.setPrice(2000_00000000); // $2000.00
        await mockOracle.setDecimals(8);
        await mockOracle.setTimestamp(await ethers.provider.getBlock('latest').then(b => b!.timestamp));

        // Deploy adapter
        const AdapterFactory = await ethers.getContractFactory("ChainlinkAdapter");
        adapter = await AdapterFactory.deploy();
    });

    describe("Configuration", function () {
        it("Should add price feed correctly", async function () {
            await adapter.setPriceFeed(
                "USDC",
                await mockOracle.getAddress(),
                8,
                3600
            );

            expect(await adapter.supportsToken("USDC")).to.be.true;
            
            const config = await adapter.getFeedConfig("USDC");
            expect(config.feedAddress).to.equal(await mockOracle.getAddress());
            expect(config.decimals).to.equal(8);
            expect(config.heartbeat).to.equal(3600);
            expect(config.isActive).to.be.true;
        });

        it("Should reject invalid feed address", async function () {
            await expect(
                adapter.setPriceFeed("USDC", ethers.ZeroAddress, 8, 3600)
            ).to.be.revertedWith("Invalid feed address");
        });

        it("Should reject invalid decimals", async function () {
            await expect(
                adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 0, 3600)
            ).to.be.revertedWith("Invalid decimals");

            await expect(
                adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 19, 3600)
            ).to.be.revertedWith("Invalid decimals");
        });

        it("Should reject zero heartbeat", async function () {
            await expect(
                adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 8, 0)
            ).to.be.revertedWith("Invalid heartbeat");
        });

        it("Should validate feed works on add", async function () {
            // Mock oracle with invalid price
            await mockOracle.setPrice(0);

            await expect(
                adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 8, 3600)
            ).to.be.revertedWith("Invalid price");
        });

        it("Should emit event on feed add", async function () {
            await expect(
                adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 8, 3600)
            ).to.emit(adapter, "PriceFeedAdded")
             .withArgs("USDC", await mockOracle.getAddress(), 8, 3600);
        });

        it("Should update existing feed", async function () {
            // Add initial feed
            await adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 8, 3600);

            // Deploy new oracle
            const newOracle = await (await ethers.getContractFactory("MockChainlinkOracle")).deploy();
            await newOracle.setPrice(2000_00000000);

            // Update feed
            await expect(
                adapter.setPriceFeed("USDC", await newOracle.getAddress(), 8, 3600)
            ).to.emit(adapter, "PriceFeedUpdated");

            const config = await adapter.getFeedConfig("USDC");
            expect(config.feedAddress).to.equal(await newOracle.getAddress());
        });

        it("Should remove feed", async function () {
            await adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 8, 3600);
            
            await adapter.removePriceFeed("USDC");

            expect(await adapter.supportsToken("USDC")).to.be.false;
        });
    });

    describe("Price Retrieval", function () {
        beforeEach(async function () {
            await adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 8, 3600);
        });

        it("Should return valid price", async function () {
            const [price, timestamp, isValid] = await adapter.getPrice("USDC");

            expect(price).to.equal(2000_00000000);
            expect(timestamp).to.be.gt(0);
            expect(isValid).to.be.true;
        });

        it("Should detect stale price", async function () {
            // Advance time beyond heartbeat
            await ethers.provider.send("evm_increaseTime", [3601]);
            await ethers.provider.send("evm_mine", []);

            const [, , isValid] = await adapter.getPrice("USDC");
            expect(isValid).to.be.false;
        });

        it("Should revert for unsupported token", async function () {
            await expect(
                adapter.getPrice("UNKNOWN")
            ).to.be.revertedWithCustomError(adapter, "TokenNotSupported");
        });

        it("Should handle zero price", async function () {
            await mockOracle.setPrice(0);

            const [price, , isValid] = await adapter.getPrice("USDC");
            expect(price).to.equal(0);
            expect(isValid).to.be.false;
        });

        it("Should handle oracle revert", async function () {
            await mockOracle.setShouldRevert(true);

            await expect(
                adapter.getPrice("USDC")
            ).to.be.revertedWithCustomError(adapter, "OracleCallFailed");
        });

        it("Should emit PriceRetrieved event", async function () {
            await expect(
                adapter.getPrice("USDC")
            ).to.emit(adapter, "PriceRetrieved");
        });
    });

    describe("Decimals", function () {
        beforeEach(async function () {
            await adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 8, 3600);
        });

        it("Should return correct decimals", async function () {
            const decimals = await adapter.getPriceDecimals("USDC");
            expect(decimals).to.equal(8);
        });

        it("Should revert for unsupported token", async function () {
            await expect(
                adapter.getPriceDecimals("UNKNOWN")
            ).to.be.revertedWithCustomError(adapter, "TokenNotSupported");
        });

        it("Should return consistent decimals", async function () {
            const decimals1 = await adapter.getPriceDecimals("USDC");
            const decimals2 = await adapter.getPriceDecimals("USDC");
            expect(decimals1).to.equal(decimals2);
        });
    });

    describe("Token Support", function () {
        it("Should return true for configured token", async function () {
            await adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 8, 3600);
            expect(await adapter.supportsToken("USDC")).to.be.true;
        });

        it("Should return false for unconfigured token", async function () {
            expect(await adapter.supportsToken("UNKNOWN")).to.be.false;
        });

        it("Should never revert", async function () {
            // Should not revert even for invalid input
            expect(await adapter.supportsToken("")).to.be.false;
            expect(await adapter.supportsToken("VERYLONGTOKENCODEHERE")).to.be.false;
        });
    });

    describe("Adapter Info", function () {
        it("Should return correct name and version", async function () {
            const [name, version] = await adapter.getAdapterInfo();
            expect(name).to.equal("Chainlink");
            expect(version).to.equal("1.0.0");
        });

        it("Should return consistent info", async function () {
            const [name1, version1] = await adapter.getAdapterInfo();
            const [name2, version2] = await adapter.getAdapterInfo();
            expect(name1).to.equal(name2);
            expect(version1).to.equal(version2);
        });
    });

    describe("Circuit Breaker", function () {
        beforeEach(async function () {
            await adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 8, 3600);
            await adapter.setMaxErrorThreshold(3);
        });

        it("Should activate after max errors", async function () {
            // Simulate 3 errors
            await mockOracle.setShouldRevert(true);
            
            for (let i = 0; i < 3; i++) {
                try {
                    await adapter.getPrice("USDC");
                } catch (e) {
                    // Expected to revert
                }
            }

            // Circuit breaker active - should return false
            await mockOracle.setShouldRevert(false);
            const [, , isValid] = await adapter.getPrice("USDC");
            expect(isValid).to.be.false;
        });

        it("Should reset error count on success", async function () {
            // One error
            await mockOracle.setShouldRevert(true);
            try {
                await adapter.getPrice("USDC");
            } catch {}

            // Success
            await mockOracle.setShouldRevert(false);
            const [, , isValid] = await adapter.getPrice("USDC");
            expect(isValid).to.be.true;

            // Error count should be reset
            const config = await adapter.getFeedConfig("USDC");
            expect(config.errorCount).to.equal(0);
        });
    });

    describe("Gas Benchmarks", function () {
        beforeEach(async function () {
            await adapter.setPriceFeed("USDC", await mockOracle.getAddress(), 8, 3600);
        });

        it("getPrice gas cost", async function () {
            const tx = await adapter.getPrice("USDC");
            const receipt = await tx.wait();
            
            console.log(`getPrice gas used: ${receipt.gasUsed}`);
            
            // Should be < 50k gas
            expect(receipt.gasUsed).to.be.lt(50000);
        });
    });
});
```

---

## 🔗 **INTEGRATION TESTS**

### **Scope: Adapter + TokenManager + ValueCalculator**

Test that adapters integrate correctly with existing contracts.

### **Test Matrix: Integration**

| Test Case | Components | Expected Outcome |
|-----------|-----------|------------------|
| TokenManager uses adapter | TokenManager + ChainlinkAdapter | getTokenPrice works |
| ValueCalculator with adapter | ValueCalculator + TokenManager + Adapter | calculateValue works |
| SwapManager price validation | SwapManager + TokenManager + Adapter | Price validation works |
| Adapter switch | TokenManager + 2 Adapters | Can switch adapters without breaking |
| Multiple tokens | TokenManager + Adapter (3 tokens) | All tokens have valid prices |
| Stale price handling | Full stack + stale oracle | System handles gracefully |
| Oracle failure | Full stack + failing oracle | Fallback or error handling works |

### **Example Integration Test**

```typescript
// test/integration/OracleModularity.integration.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Oracle Modularity - Integration Tests", function () {
    let system: any;
    let adapter: any;
    let tokenManager: any;
    let valueCalculator: any;
    let mockOracle: any;

    beforeEach(async function () {
        // Deploy full system
        system = await deployFullSystem(); // Helper function
        
        adapter = system.adapter;
        tokenManager = system.tokenManager;
        valueCalculator = system.valueCalculator;
        mockOracle = system.mockOracle;
    });

    describe("TokenManager Integration", function () {
        it("Should get price via adapter", async function () {
            const [price, timestamp, isStale] = await tokenManager.getTokenPrice("USDC");

            expect(price).to.be.gt(0);
            expect(timestamp).to.be.gt(0);
            expect(isStale).to.be.false;
        });

        it("Should maintain backward compatibility", async function () {
            // Same interface as before
            const [price, , ] = await tokenManager.getTokenPrice("USDC");
            
            // Should work exactly like old implementation
            expect(price).to.equal(2000_00000000);
        });

        it("Should allow adapter switch", async function () {
            // Deploy second adapter with different price
            const newAdapter = await deployNewAdapter(2100_00000000); // $2100
            
            // Switch adapter
            await tokenManager.setOracleAdapter(await newAdapter.getAddress());
            
            // Price should update
            const [newPrice, , ] = await tokenManager.getTokenPrice("USDC");
            expect(newPrice).to.equal(2100_00000000);
        });
    });

    describe("ValueCalculator Integration", function () {
        it("Should calculate value correctly", async function () {
            // Setup: User has 1000 USDC
            const amount = ethers.parseUnits("1000", 6); // 1000 USDC (6 decimals)
            
            // Calculate value
            const value = await valueCalculator.calculateTokenValue("USDC");
            
            // Expected: 1000 USDC * $2000 = $2,000,000
            // With 8 decimals: 2000_00000000 * 1000 / 10^8
            expect(value).to.be.gt(0);
        });

        it("Should handle multiple tokens", async function () {
            // Calculate total pool value with 3 tokens
            const totalValue = await valueCalculator.getTotalPoolValueView();
            
            expect(totalValue).to.be.gt(0);
        });

        it("Should use fresh prices only", async function () {
            // Make price stale
            await ethers.provider.send("evm_increaseTime", [7200]);
            
            await expect(
                valueCalculator.calculateTokenValue("USDC")
            ).to.be.revertedWith("Price too old");
        });
    });

    describe("SwapManager Integration", function () {
        it("Should validate prices before swap", async function () {
            // SwapManager should use oracle for price validation
            const valid = await system.swapManager.validateSwapPrice(
                "USDC",
                "WETH",
                ethers.parseEther("1")
            );
            
            expect(valid).to.be.true;
        });
    });

    describe("Backward Compatibility", function () {
        it("All existing tests should pass", async function () {
            // Run OLD test suite
            // Should pass without modifications
            
            // Example: Old deposit flow
            await system.liquidityManager.deposit({ value: ethers.parseEther("1") });
            
            // Should work identically
            expect(await system.liquidityManager.getUserShares(user.address)).to.be.gt(0);
        });
    });
});
```

---

## 🌐 **END-TO-END TESTS**

### **Scope: Complete User Flows**

Test real user scenarios from start to finish.

### **E2E Scenarios**

| Scenario | Steps | Success Criteria |
|----------|-------|------------------|
| **User Deposit** | 1. User deposits ETH<br>2. LP tokens minted<br>3. Value calculated via oracle | Correct LP tokens minted |
| **User Withdraw** | 1. User withdraws<br>2. Oracle prices queried<br>3. ETH returned | Correct ETH amount returned |
| **Automatic Swap** | 1. Withdraw needs swap<br>2. Oracle validates prices<br>3. Swap executed | Swap succeeds, user receives ETH |
| **Rebalancing** | 1. Owner triggers rebalance<br>2. Oracle provides prices<br>3. Assets rebalanced | Pool balanced correctly |
| **Oracle Switch** | 1. Deploy new adapter<br>2. Switch via TokenManager<br>3. Continue operations | No disruption to users |

### **Example E2E Test**

```typescript
// test/e2e/UserFlows.e2e.test.ts
describe("E2E - User Flows with Oracle Modularity", function () {
    
    it("Complete deposit-withdraw cycle", async function () {
        const user = await ethers.getSigners()[1];
        
        // 1. User deposits 1 ETH
        const depositTx = await liquidityManager.connect(user).deposit({
            value: ethers.parseEther("1")
        });
        await depositTx.wait();
        
        // 2. Check LP tokens minted (uses oracle for value calc)
        const lpTokens = await liquidityManager.getUserShares(user.address);
        expect(lpTokens).to.be.gt(0);
        
        // 3. Time passes
        await ethers.provider.send("evm_increaseTime", [3600]);
        
        // 4. User withdraws
        const withdrawTx = await liquidityManager.connect(user).withdraw(lpTokens);
        await withdrawTx.wait();
        
        // 5. Verify user received ETH (oracle used for calculations)
        const finalBalance = await ethers.provider.getBalance(user.address);
        expect(finalBalance).to.be.closeTo(initialBalance, ethers.parseEther("0.01"));
    });
    
    it("Live adapter switch during operations", async function () {
        // Users actively depositing/withdrawing
        
        // 1. User 1 deposits
        await liquidityManager.connect(user1).deposit({ value: ethers.parseEther("1") });
        
        // 2. Admin switches oracle adapter
        const newAdapter = await deployNewAdapter();
        await tokenManager.setOracleAdapter(await newAdapter.getAddress());
        
        // 3. User 2 deposits (with new adapter)
        await liquidityManager.connect(user2).deposit({ value: ethers.parseEther("1") });
        
        // 4. User 1 withdraws (mix of old/new adapter data)
        const lpTokens = await liquidityManager.getUserShares(user1.address);
        await liquidityManager.connect(user1).withdraw(lpTokens);
        
        // All operations should succeed
    });
});
```

---

## 🍴 **FORK TESTING**

### **Purpose: Test with Real Mainnet Data**

Use Hardhat's forking to test against actual Chainlink feeds on mainnet.

### **Setup**

```typescript
// hardhat.config.ts
export default {
    networks: {
        hardhat: {
            forking: {
                url: "https://arb1.arbitrum.io/rpc",
                blockNumber: 123456789 // Pin to specific block
            }
        }
    }
};
```

### **Fork Tests**

```typescript
// test/fork/MainnetOracle.fork.test.ts
describe("Fork Tests - Real Chainlink Data", function () {
    
    it("Should use real Chainlink USDC/USD feed", async function () {
        const REAL_CHAINLINK_USDC_USD = "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3"; // Arbitrum
        
        // Deploy adapter
        const adapter = await ChainlinkAdapter.deploy();
        
        // Configure with REAL feed
        await adapter.setPriceFeed("USDC", REAL_CHAINLINK_USDC_USD, 8, 3600);
        
        // Get price
        const [price, , isValid] = await adapter.getPrice("USDC");
        
        // Verify real price (USDC should be ~$1)
        expect(price).to.be.closeTo(1_00000000, 0.05e8); // $1 ± 5%
        expect(isValid).to.be.true;
    });
    
    it("Should handle real network conditions", async function () {
        // Test with actual network latency, gas prices, etc.
    });
});
```

---

## 🎭 **MOCK STRATEGIES**

### **MockOracleAdapter for Testing**

```solidity
// contracts/mocks/MockOracleAdapter.sol
contract MockOracleAdapter is IOracleAdapter {
    mapping(string => uint256) public prices;
    mapping(string => uint256) public timestamps;
    mapping(string => bool) public validFlags;
    mapping(string => uint8) public decimalsMap;
    
    function setPrice(string memory tokenCode, uint256 price) external {
        prices[tokenCode] = price;
        timestamps[tokenCode] = block.timestamp;
        validFlags[tokenCode] = true;
    }
    
    function setStale(string memory tokenCode) external {
        validFlags[tokenCode] = false;
    }
    
    function setDecimals(string memory tokenCode, uint8 decimals) external {
        decimalsMap[tokenCode] = decimals;
    }
    
    function getPrice(string memory tokenCode)
        external
        view
        override
        returns (uint256, uint256, bool)
    {
        return (prices[tokenCode], timestamps[tokenCode], validFlags[tokenCode]);
    }
    
    function getPriceDecimals(string memory tokenCode)
        external
        view
        override
        returns (uint8)
    {
        return decimalsMap[tokenCode];
    }
    
    function supportsToken(string memory tokenCode)
        external
        view
        override
        returns (bool)
    {
        return prices[tokenCode] > 0;
    }
    
    function getAdapterInfo()
        external
        pure
        override
        returns (string memory, string memory)
    {
        return ("Mock", "1.0.0");
    }
}
```

### **Usage in Tests**

```typescript
describe("Tests with MockAdapter", function () {
    let mockAdapter: MockOracleAdapter;
    
    beforeEach(async function () {
        mockAdapter = await MockOracleAdapter.deploy();
        
        // Setup prices
        await mockAdapter.setPrice("USDC", 2000_00000000);
        await mockAdapter.setDecimals("USDC", 8);
    });
    
    it("Should use mock prices", async function () {
        const [price,,] = await mockAdapter.getPrice("USDC");
        expect(price).to.equal(2000_00000000);
    });
    
    it("Should simulate stale price", async function () {
        await mockAdapter.setStale("USDC");
        
        const [, , isValid] = await mockAdapter.getPrice("USDC");
        expect(isValid).to.be.false;
    });
});
```

---

## 📈 **COVERAGE TARGETS**

### **Minimum Coverage Requirements**

| Component | Line Coverage | Branch Coverage | Function Coverage |
|-----------|---------------|-----------------|-------------------|
| IOracleAdapter | N/A (interface) | N/A | N/A |
| ChainlinkAdapter | 95% | 90% | 100% |
| CompositeAdapter | 90% | 85% | 100% |
| TokenManager (oracle parts) | 95% | 90% | 100% |

### **Generate Coverage Report**

```bash
npx hardhat coverage --testfiles "test/unit/ChainlinkAdapter.test.ts"
```

---

## ⏱️ **PERFORMANCE BENCHMARKS**

### **Gas Cost Targets**

| Operation | Old (Hardcoded) | New (Adapter) | Max Overhead |
|-----------|-----------------|---------------|--------------|
| getTokenPrice | ~25k gas | ~30k gas | +5k (20%) |
| deposit (uses price) | ~150k gas | ~155k gas | +5k (3%) |
| withdraw (uses price) | ~180k gas | ~185k gas | +5k (3%) |

### **Benchmark Tests**

```typescript
describe("Gas Benchmarks", function () {
    it("getTokenPrice gas comparison", async function () {
        // Warm up
        await tokenManager.getTokenPrice("USDC");
        
        // Measure
        const tx = await tokenManager.getTokenPrice("USDC");
        const receipt = await tx.wait();
        
        console.log(`Gas used: ${receipt.gasUsed}`);
        
        // Assert acceptable overhead
        expect(receipt.gasUsed).to.be.lt(30000);
    });
});
```

---

## ✅ **PRE-DEPLOYMENT TESTING CHECKLIST**

### **Unit Tests**
- [ ] All adapter methods tested
- [ ] All error cases covered
- [ ] Edge cases tested (zero values, max values)
- [ ] Gas benchmarks pass (<50k per getPrice)
- [ ] Coverage >95%

### **Integration Tests**
- [ ] TokenManager integration works
- [ ] ValueCalculator integration works
- [ ] SwapManager integration works
- [ ] Adapter switching works
- [ ] Multiple tokens work simultaneously

### **E2E Tests**
- [ ] Deposit flow works
- [ ] Withdraw flow works
- [ ] Swap flow works
- [ ] Rebalance flow works
- [ ] Live adapter switch works

### **Fork Tests**
- [ ] Works with real Chainlink feeds
- [ ] Handles mainnet network conditions
- [ ] Real gas costs acceptable

### **Security Tests**
- [ ] Stale price rejection works
- [ ] Circuit breaker activates correctly
- [ ] Reentrancy protection works
- [ ] Access control enforced
- [ ] Price deviation detection works

### **Regression Tests**
- [ ] ALL existing tests still pass
- [ ] No breaking changes detected
- [ ] Behavior identical to old implementation

---

## 🚀 **CI/CD INTEGRATION**

### **GitHub Actions Workflow**

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Install dependencies
        run: npm install
      
      - name: Compile
        run: npx hardhat compile
      
      - name: Unit Tests
        run: npx hardhat test test/unit/**/*.test.ts
      
      - name: Integration Tests
        run: npx hardhat test test/integration/**/*.test.ts
      
      - name: Coverage
        run: npx hardhat coverage
      
      - name: Upload Coverage
        uses: codecov/codecov-action@v3
```

---

## 📚 **TESTING TIMELINE**

| Phase | Duration | Tests |
|-------|----------|-------|
| Unit Tests | 2 days | ChainlinkAdapter complete |
| Integration Tests | 1 day | Full stack integration |
| E2E Tests | 1 day | User flows |
| Fork Tests | 0.5 days | Mainnet simulation |
| Security Tests | 0.5 days | Attack scenarios |
| **TOTAL** | **5 days** | **Complete test suite** |

---

**Version**: 1.0.0  
**Last Updated**: 14 Novembre 2025  
**Status**: ✅ Testing Strategy Complete  
**Coverage Target**: >95% for all adapters
