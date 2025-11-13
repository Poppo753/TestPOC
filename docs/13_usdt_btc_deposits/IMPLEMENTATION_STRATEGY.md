# 🔧 SEPARATE ECOSYSTEM IMPLEMENTATION STRATEGY

## 🎯 **Three Independent Ecosystems**

### **Ecosystem 1: ETH (Current - Live)**
- **Status**: ✅ Production ready
- **Base Token**: ETH (native)
- **Contracts**: Full suite deployed
- **Target Users**: DeFi natives, gas efficiency focused

### **Ecosystem 2: USDC/USDT (New)**
- **Status**: 🔨 To build
- **Base Token**: USDC or USDT (6 decimals)
- **Contracts**: Copy + modify for ERC20
- **Target Users**: Risk-averse, USD stability seekers

### **Ecosystem 3: WBTC (New)**
- **Status**: 🔨 To build  
- **Base Token**: WBTC (8 decimals)
- **Contracts**: Copy + modify for Bitcoin exposure
- **Target Users**: Bitcoin maximalists, BTC exposure seekers

---

## 🏗️ **Contract Architecture Per Ecosystem**

### **ETH Ecosystem (Reference)**
```
Beacon → ProxyGeneral → LiquidityManager → ValueCalculator
   ↓         ↓              ↓                 ↓
TokenManager ← SwapManager ← ParameterManager ← EmergencyHandler
```

### **USDC Ecosystem (New)**
```solidity
// All contracts copied and modified for USDC base
contract BeaconUSDC { /* Same logic */ }
contract ProxyGeneralUSDC { /* USDC custody instead of ETH */ }
contract LiquidityManagerUSDC { /* USDC deposits instead of ETH */ }
contract ValueCalculatorUSDC { /* USDC-based value calculations */ }
contract TokenManagerUSDC { /* USDC as base token */ }
contract SwapManagerUSDC { /* USDC routing logic */ }
contract ParameterManagerUSDC { /* USDC-specific parameters */ }
contract EmergencyHandlerUSDC { /* USDC emergency logic */ }
```

### **WBTC Ecosystem (New)**
```solidity  
// All contracts copied and modified for WBTC base
contract BeaconWBTC { /* Same logic */ }
contract ProxyGeneralWBTC { /* WBTC custody instead of ETH */ }
contract LiquidityManagerWBTC { /* WBTC deposits instead of ETH */ }
contract ValueCalculatorWBTC { /* WBTC-based value calculations */ }
contract TokenManagerWBTC { /* WBTC as base token */ }
contract SwapManagerWBTC { /* WBTC routing logic */ }
contract ParameterManagerWBTC { /* WBTC-specific parameters */ }
contract EmergencyHandlerWBTC { /* WBTC emergency logic */ }
```

---

## 🔄 **Key Contract Modifications**

### **LiquidityManager Changes**

#### **ETH Version (Current)**
```solidity
contract LiquidityManager {
    function deposit() external payable returns (uint256 lpTokens) {
        require(msg.value >= minDeposit, "Below minimum");
        
        uint256 netDeposit = msg.value - feeAmount;
        
        // Convert ETH to WETH
        weth.deposit{value: netDeposit}();
        weth.transfer(proxyGeneral, netDeposit);
        
        uint256 shares = calculateShares(netDeposit);
        proxy.mint(msg.sender, shares);
        
        return shares;
    }
}
```

#### **USDC Version (New)**
```solidity
contract LiquidityManagerUSDC {
    IERC20 public immutable USDC;
    
    constructor(address _beacon, address _usdc) {
        beacon = _beacon;
        USDC = IERC20(_usdc);
    }
    
    function deposit(uint256 amount) external returns (uint256 lpTokens) {
        require(amount >= minDeposit, "Below minimum");
        
        uint256 feeAmount = (amount * depositFee) / 10000;
        uint256 netDeposit = amount - feeAmount;
        
        // Transfer USDC from user (requires approval)
        USDC.transferFrom(msg.sender, proxyGeneral, netDeposit);
        
        // Transfer fee to recipient
        if (feeAmount > 0) {
            USDC.transferFrom(msg.sender, feeRecipient, feeAmount);
        }
        
        uint256 shares = calculateShares(netDeposit);
        proxy.mint(msg.sender, shares);
        
        return shares;
    }
}
```

#### **WBTC Version (New)**
```solidity
contract LiquidityManagerWBTC {
    IERC20 public immutable WBTC;
    
    constructor(address _beacon, address _wbtc) {
        beacon = _beacon;
        WBTC = IERC20(_wbtc);
    }
    
    function deposit(uint256 amount) external returns (uint256 lpTokens) {
        require(amount >= minDeposit, "Below minimum");
        
        uint256 feeAmount = (amount * depositFee) / 10000;
        uint256 netDeposit = amount - feeAmount;
        
        // Transfer WBTC from user (requires approval)
        WBTC.transferFrom(msg.sender, proxyGeneral, netDeposit);
        
        // Transfer fee to recipient  
        if (feeAmount > 0) {
            WBTC.transferFrom(msg.sender, feeRecipient, feeAmount);
        }
        
        uint256 shares = calculateShares(netDeposit);
        proxy.mint(msg.sender, shares);
        
        return shares;
    }
}
```

### **ValueCalculator Changes**

#### **ETH Version (Current)**
```solidity
function getTotalPoolValue() external view returns (uint256) {
    uint256 wethValue = IERC20(weth).balanceOf(proxyGeneral);
    uint256 usdcValue = convertUSDCToETH(IERC20(usdc).balanceOf(proxyGeneral));
    uint256 wbtcValue = convertWBTCToETH(IERC20(wbtc).balanceOf(proxyGeneral));
    
    return wethValue + usdcValue + wbtcValue; // All in ETH terms
}
```

#### **USDC Version (New)**
```solidity
function getTotalPoolValue() external view returns (uint256) {
    uint256 usdcValue = IERC20(usdc).balanceOf(proxyGeneral);
    uint256 wethValue = convertETHToUSDC(IERC20(weth).balanceOf(proxyGeneral));
    uint256 wbtcValue = convertWBTCToUSDC(IERC20(wbtc).balanceOf(proxyGeneral));
    
    return usdcValue + wethValue + wbtcValue; // All in USDC terms
}
```

#### **WBTC Version (New)**
```solidity
function getTotalPoolValue() external view returns (uint256) {
    uint256 wbtcValue = IERC20(wbtc).balanceOf(proxyGeneral);
    uint256 wethValue = convertETHToWBTC(IERC20(weth).balanceOf(proxyGeneral));
    uint256 usdcValue = convertUSDCToWBTC(IERC20(usdc).balanceOf(proxyGeneral));
    
    return wbtcValue + wethValue + usdcValue; // All in WBTC terms
}
```

### **ProxyGeneral Changes**

#### **Remove ETH-specific functions for USDC/WBTC**
```solidity
// Remove from USDC/WBTC versions:
// - receive() payable
// - depositETH()
// - withdrawETH()
// - wrapETH() / unwrapWETH()

// Keep ERC20 functions:
// - mint() / burn() for LP tokens
// - approveSpender() for swaps
// - Standard ERC20 custody functions
```

---

## 📐 **Decimal Conversion Strategies**

### **Ecosystem-Specific Decimal Handling**

#### **ETH Ecosystem**: 18 decimals native
```solidity
// No conversion needed
uint256 lpTokens = netDeposit; // 1:1 ratio for bootstrap
```

#### **USDC Ecosystem**: 6 decimals → 18 decimals
```solidity
// Scale USDC to 18 decimals for internal calculations
uint256 scaledAmount = amount * 1e12; // 6 → 18 decimals
uint256 lpTokens = calculateShares(scaledAmount);

// But store actual USDC amounts (6 decimals) in balances
```

#### **WBTC Ecosystem**: 8 decimals → 18 decimals
```solidity
// Scale WBTC to 18 decimals for internal calculations  
uint256 scaledAmount = amount * 1e10; // 8 → 18 decimals
uint256 lpTokens = calculateShares(scaledAmount);

// But store actual WBTC amounts (8 decimals) in balances
```

### **Bootstrap Share Calculation**

#### **First Deposit Logic Per Ecosystem**
```solidity
// ETH: 1 ETH = 1e18 LP tokens
if (totalSupply == 0) shares = msg.value;

// USDC: 1 USDC = 1e18 LP tokens (scale up)
if (totalSupply == 0) shares = amount * 1e12;

// WBTC: 1 WBTC = 1e18 LP tokens (scale up)  
if (totalSupply == 0) shares = amount * 1e10;
```

---

## 🚀 **Deployment Strategy**

### **Phase 1: USDC Ecosystem (2-3 weeks)**

#### **Week 1: Contract Development**
- Copy all contracts from ETH ecosystem
- Modify LiquidityManager for USDC deposits
- Update ValueCalculator for USDC base calculations
- Remove ETH-specific functions from ProxyGeneral
- Update parameter defaults for USDC amounts

#### **Week 2: Testing & Integration**
- Deploy to testnet with mock USDC
- Run full test suite (unit + integration)
- Test decimal conversions thoroughly
- Verify oracle integrations

#### **Week 3: Production Deployment**
- Deploy to mainnet with real USDC
- Initialize parameters
- Test with small amounts
- Monitor first transactions

### **Phase 2: WBTC Ecosystem (2-3 weeks)**

#### **Week 1: Contract Development**
- Start from USDC contracts as template
- Modify for WBTC (8 decimals vs 6)
- Update value calculations for WBTC volatility
- Adjust parameters for WBTC amounts

#### **Week 2: Testing & Integration**
- Deploy to testnet with mock WBTC
- Focus on volatility handling
- Test with various WBTC amounts
- Verify price oracle accuracy

#### **Week 3: Production Deployment**
- Deploy to mainnet with real WBTC
- Conservative initial parameters
- Monitor volatility impact
- Adjust parameters based on performance

---

## 🧪 **Testing Strategy Per Ecosystem**

### **Unit Tests (Per Ecosystem)**
```typescript
describe("LiquidityManager-USDC", function() {
    it("should handle USDC deposits correctly", async function() {
        const usdcAmount = ethers.parseUnits("100", 6); // 100 USDC
        await usdc.approve(liquidityManagerUSDC.target, usdcAmount);
        await liquidityManagerUSDC.deposit(usdcAmount);
        
        // Verify LP tokens minted with correct decimal scaling
        const expectedLP = usdcAmount * BigInt(1e12); // Scale to 18 decimals
        expect(await proxyGeneralUSDC.totalSupply()).to.equal(expectedLP);
    });
    
    it("should handle decimal conversions correctly", async function() {
        // Test edge cases with small USDC amounts
    });
});

describe("LiquidityManager-WBTC", function() {
    it("should handle WBTC deposits correctly", async function() {
        const wbtcAmount = ethers.parseUnits("0.1", 8); // 0.1 WBTC
        await wbtc.approve(liquidityManagerWBTC.target, wbtcAmount);
        await liquidityManagerWBTC.deposit(wbtcAmount);
        
        // Verify LP tokens minted with correct decimal scaling
        const expectedLP = wbtcAmount * BigInt(1e10); // Scale to 18 decimals
        expect(await proxyGeneralWBTC.totalSupply()).to.equal(expectedLP);
    });
});
```

### **Integration Tests**
- Cross-ecosystem isolation (no interference)
- Oracle price feed accuracy
- Withdrawal flows for each ecosystem
- Emergency scenarios per ecosystem

---

## 🔒 **Security Considerations Per Ecosystem**

### **Token-Specific Risks**

#### **USDC Ecosystem**
- **Centralization Risk**: USDC can be frozen by Centre
- **Regulatory Risk**: USDC subject to US regulations
- **Depeg Risk**: Rare but possible USD peg loss
- **Approval Risk**: Users must approve before deposit

#### **WBTC Ecosystem**  
- **Custodial Risk**: WBTC backed by BitGo custody
- **Volatility Risk**: Higher volatility than stablecoins
- **Liquidity Risk**: Less liquid than ETH in some pools
- **Complexity Risk**: More complex than stablecoins

### **Mitigation Strategies**
```solidity
// Add ecosystem-specific emergency controls
contract EmergencyHandlerUSDC {
    function pauseUSDCOperations() external onlyOwner {
        // Pause USDC ecosystem if USDC frozen
    }
}

contract EmergencyHandlerWBTC {
    function pauseOnVolatility() external {
        // Auto-pause if WBTC price deviates >20% in 1 hour
    }
}
```

---

## 👥 **Frontend Integration Strategy**

### **Unified Interface with Ecosystem Selection**
```typescript
interface EcosystemConfig {
    name: "ETH" | "USDC" | "WBTC";
    baseToken: string;
    contracts: {
        beacon: string;
        liquidityManager: string;
        proxyGeneral: string;
    };
    decimals: number;
    requiresApproval: boolean;
}

const ecosystems: EcosystemConfig[] = [
    {
        name: "ETH",
        baseToken: "ETH",
        contracts: { /* ETH addresses */ },
        decimals: 18,
        requiresApproval: false
    },
    {
        name: "USDC", 
        baseToken: "0xA0b86...", // USDC address
        contracts: { /* USDC addresses */ },
        decimals: 6,
        requiresApproval: true
    },
    {
        name: "WBTC",
        baseToken: "0x2f2a2...", // WBTC address  
        contracts: { /* WBTC addresses */ },
        decimals: 8,
        requiresApproval: true
    }
];
```

### **User Flow Per Ecosystem**
```typescript
// ETH Ecosystem (existing)
async function depositETH(amount: string) {
    const tx = await liquidityManager.deposit({ value: parseEther(amount) });
    return tx;
}

// USDC Ecosystem (new)
async function depositUSDC(amount: string) {
    const usdcAmount = parseUnits(amount, 6);
    
    // Step 1: Approve USDC
    const approveTx = await usdc.approve(liquidityManagerUSDC.address, usdcAmount);
    await approveTx.wait();
    
    // Step 2: Deposit USDC
    const depositTx = await liquidityManagerUSDC.deposit(usdcAmount);
    return depositTx;
}

// WBTC Ecosystem (new)
async function depositWBTC(amount: string) {
    const wbtcAmount = parseUnits(amount, 8);
    
    // Step 1: Approve WBTC
    const approveTx = await wbtc.approve(liquidityManagerWBTC.address, wbtcAmount);
    await approveTx.wait();
    
    // Step 2: Deposit WBTC  
    const depositTx = await liquidityManagerWBTC.deposit(wbtcAmount);
    return depositTx;
}
```

---

## 📊 **Monitoring & Analytics Per Ecosystem**

### **Separate Dashboards**
- **ETH Pool**: TVL, APY, transactions in ETH terms
- **USDC Pool**: TVL, APY, transactions in USD terms  
- **WBTC Pool**: TVL, APY, transactions in BTC terms

### **Cross-Ecosystem Metrics**
- Total TVL across all ecosystems
- User distribution per ecosystem
- Performance comparison (APY, gas costs)
- Risk assessment per ecosystem

---

## 🎯 **Success Metrics & KPIs**

### **Per Ecosystem Targets (30 days)**
| Metric | ETH (Current) | USDC Target | WBTC Target |
|--------|---------------|-------------|-------------|
| **TVL** | Current TVL | $100k+ | $50k+ |
| **Users** | Current users | 50+ | 25+ |
| **Transactions** | Current volume | 200+ | 100+ |
| **Success Rate** | Current rate | >95% | >95% |

### **Growth Targets (90 days)**
- **Combined TVL**: 2x current across all ecosystems
- **User Growth**: 50% new users via USDC/WBTC
- **Revenue**: 3x fee revenue from multiple ecosystems

---

## 💡 **Optimization Opportunities**

### **Shared Infrastructure**
- **Oracles**: Same Chainlink feeds across ecosystems
- **Monitoring**: Unified alerting system
- **Analytics**: Combined dashboard with ecosystem filters

### **Code Efficiency**
- **Template Contracts**: Abstract base contracts for reuse
- **Factory Deployment**: Deploy new ecosystems via factory
- **Upgrade Patterns**: Consistent upgrade mechanisms

### **User Experience**
- **Portfolio View**: Users see holdings across all ecosystems
- **Cross-Ecosystem Swaps**: Allow swapping between pool tokens
- **Unified Withdrawals**: Withdraw from any ecosystem to any token

---

## 📋 **Implementation Checklist**

### **USDC Ecosystem**
- [ ] Copy and modify all contracts for USDC
- [ ] Update decimal handling (6 → 18)
- [ ] Remove ETH-specific functions
- [ ] Add ERC20 approval logic
- [ ] Update all tests for USDC
- [ ] Deploy to testnet
- [ ] Frontend integration
- [ ] Deploy to mainnet

### **WBTC Ecosystem**  
- [ ] Copy USDC contracts as template
- [ ] Modify for WBTC (8 decimals)
- [ ] Update volatility parameters
- [ ] Add WBTC-specific risk controls
- [ ] Update tests for WBTC
- [ ] Deploy to testnet
- [ ] Frontend integration
- [ ] Deploy to mainnet

### **Infrastructure**
- [ ] Unified frontend ecosystem selector
- [ ] Cross-ecosystem analytics
- [ ] Shared monitoring & alerting
- [ ] Documentation per ecosystem
- [ ] User guides per ecosystem

---

## 📝 **Required Contract Changes**

### **LiquidityManager.sol Modifications**

#### **Current State**
```solidity
function deposit() external payable nonReentrant whenNotPaused whenDepositsEnabled 
    returns (uint256 lpTokens) {
    
    require(msg.value >= minDeposit, "Below minimum deposit");
    require(msg.value <= maxDeposit, "Exceeds maximum deposit");
    
    uint256 feeAmount = (msg.value * depositFee) / 10000;
    uint256 netDeposit = msg.value - feeAmount;
    
    // Convert ETH to WETH
    weth.deposit{value: netDeposit}();
    require(weth.transfer(proxyGeneral, netDeposit), "WETH transfer failed");
    
    // ... rest of logic
}
```

#### **USDT Version**
```solidity
function depositUSDT(uint256 amount) external nonReentrant whenNotPaused whenDepositsEnabled 
    returns (uint256 lpTokens) {
    
    require(amount >= minDepositUSDT, "Below minimum deposit");
    require(amount <= maxDepositUSDT, "Exceeds maximum deposit");
    
    uint256 feeAmount = (amount * depositFee) / 10000;
    uint256 netDeposit = amount - feeAmount;
    
    // Transfer USDT directly
    IERC20(USDT_ADDRESS).transferFrom(msg.sender, proxyGeneral, netDeposit);
    
    if (feeAmount > 0 && feeRecipient != address(0)) {
        IERC20(USDT_ADDRESS).transferFrom(msg.sender, feeRecipient, feeAmount);
    }
    
    // Calculate shares based on USDT value
    uint256 shares = calculateUSDTShares(netDeposit);
    proxy.mint(msg.sender, shares);
    
    return shares;
}
```

#### **WBTC Version**
```solidity
function depositWBTC(uint256 amount) external nonReentrant whenNotPaused whenDepositsEnabled 
    returns (uint256 lpTokens) {
    
    require(amount >= minDepositWBTC, "Below minimum deposit");
    require(amount <= maxDepositWBTC, "Exceeds maximum deposit");
    
    uint256 feeAmount = (amount * depositFee) / 10000;
    uint256 netDeposit = amount - feeAmount;
    
    // Transfer WBTC directly
    IERC20(WBTC_ADDRESS).transferFrom(msg.sender, proxyGeneral, netDeposit);
    
    if (feeAmount > 0 && feeRecipient != address(0)) {
        IERC20(WBTC_ADDRESS).transferFrom(msg.sender, feeRecipient, feeAmount);
    }
    
    // Calculate shares based on WBTC value
    uint256 shares = calculateWBTCShares(netDeposit);
    proxy.mint(msg.sender, shares);
    
    return shares;
}
```

### **ValueCalculator.sol Updates**

#### **Current ETH/WETH Logic**
```solidity
function getTotalPoolValue() external view returns (uint256) {
    // Count WETH balance as ETH value
    uint256 wethBalance = IERC20(wethAddress).balanceOf(proxyGeneral);
    return wethBalance; // 1:1 with ETH
}
```

#### **USDT Pool Logic**
```solidity
function getTotalPoolValue() external view returns (uint256) {
    // Convert USDT balance to ETH value using oracle
    uint256 usdtBalance = IERC20(USDT_ADDRESS).balanceOf(proxyGeneral);
    uint256 usdtPriceInETH = getUSDTPriceInETH();
    
    // USDT has 6 decimals, ETH has 18
    return (usdtBalance * usdtPriceInETH * 1e12) / 1e18;
}
```

#### **WBTC Pool Logic**
```solidity
function getTotalPoolValue() external view returns (uint256) {
    // Convert WBTC balance to ETH value using oracle
    uint256 wbtcBalance = IERC20(WBTC_ADDRESS).balanceOf(proxyGeneral);
    uint256 wbtcPriceInETH = getWBTCPriceInETH();
    
    // WBTC has 8 decimals, ETH has 18
    return (wbtcBalance * wbtcPriceInETH * 1e10) / 1e18;
}
```

### **Parameter Updates**

#### **New Parameters Needed**
```solidity
// For USDT
uint256 public minDepositUSDT = 1e6;     // 1 USDT (6 decimals)
uint256 public maxDepositUSDT = 100000e6; // 100k USDT

// For WBTC  
uint256 public minDepositWBTC = 1e5;     // 0.001 WBTC (8 decimals)
uint256 public maxDepositWBTC = 10e8;    // 10 WBTC
```

---

## 🔀 **Withdrawal Modifications**

### **Current ETH Withdrawal**
```solidity
function withdraw(uint256 lpTokens) external returns (uint256 ethAmount) {
    // Burn LP tokens
    // Calculate ETH value
    // Convert tokens to WETH if needed
    // Unwrap WETH to ETH
    // Transfer ETH to user
}
```

### **USDT Withdrawal**
```solidity
function withdraw(uint256 lpTokens) external returns (uint256 usdtAmount) {
    // Burn LP tokens
    // Calculate USDT value
    // Swap other tokens to USDT if needed
    // Transfer USDT to user
}
```

### **WBTC Withdrawal**
```solidity
function withdraw(uint256 lpTokens) external returns (uint256 wbtcAmount) {
    // Burn LP tokens
    // Calculate WBTC value
    // Swap other tokens to WBTC if needed
    // Transfer WBTC to user
}
```

---

## 🧪 **Testing Strategy**

### **New Test Cases Needed**

#### **USDT Deposit Tests**
```typescript
describe("USDT Deposits", function() {
    it("should handle USDT decimals correctly", async function() {
        const usdtAmount = ethers.parseUnits("100", 6); // 100 USDT
        await usdt.approve(liquidityManager.target, usdtAmount);
        await liquidityManager.depositUSDT(usdtAmount);
    });
    
    it("should enforce USDT deposit limits", async function() {
        // Test min/max limits
    });
    
    it("should calculate fees with USDT precision", async function() {
        // Test fee calculation with 6 decimals
    });
});
```

#### **WBTC Deposit Tests**
```typescript
describe("WBTC Deposits", function() {
    it("should handle WBTC decimals correctly", async function() {
        const wbtcAmount = ethers.parseUnits("0.1", 8); // 0.1 WBTC
        await wbtc.approve(liquidityManager.target, wbtcAmount);
        await liquidityManager.depositWBTC(wbtcAmount);
    });
});
```

### **Integration Tests**
- Oracle price feed integration
- Decimal conversion accuracy
- Cross-token swap functionality
- Withdrawal flows for each token

---

## 🚀 **Migration Process**

### **Phase 1: Preparation**
1. Deploy new contracts with USDT/WBTC support
2. Extensive testing on testnet
3. Security audit of new functionality
4. Frontend development and testing

### **Phase 2: Deployment**
1. Deploy to mainnet
2. Initialize with conservative limits
3. Monitor first transactions closely
4. Gradual increase of limits

### **Phase 3: Migration**
1. Announce migration period
2. Provide tools for users to withdraw ETH deposits
3. Encourage new deposits in USDT/WBTC
4. Eventually deprecate ETH deposits (if desired)

---

## 💡 **Gas Optimization Ideas**

### **Batch Operations**
```solidity
function batchDeposit(
    DepositToken[] calldata tokens,
    uint256[] calldata amounts
) external {
    // Process multiple token deposits in single tx
}
```

### **Permit Support**
```solidity
function depositUSDTWithPermit(
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
) external {
    // Use EIP-2612 permit to avoid separate approve tx
}
```

### **Pre-computed Values**
```solidity
// Cache frequently used calculations
mapping(uint256 => uint256) public precomputedShares;
```

---

## 🔒 **Security Considerations**

### **New Attack Vectors**
1. **Approval Front-running**: Users must approve before deposit
2. **Token-specific risks**: USDT centralization, WBTC custody
3. **Decimal precision errors**: Different decimal handling
4. **Oracle manipulation**: Price feed dependency

### **Mitigation Strategies**
1. **Slippage protection** on all token conversions
2. **Comprehensive decimal testing**
3. **Multiple oracle sources** for price feeds
4. **Emergency pause** functionality per token
5. **Rate limiting** per token type

---

## 📊 **Monitoring & Analytics**

### **New Metrics to Track**
- Deposit volume per token type
- Gas costs per deposit method
- Oracle price deviation
- Failed transactions (approvals/transfers)
- User preference patterns

### **Alerts Needed**
- Unusual price movements
- Failed oracle updates
- High gas cost thresholds
- Token contract issues