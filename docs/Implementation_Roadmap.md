# 🚀 ROADMAP IMPLEMENTAZIONE COMPLETA
## Sistema DeFi Modulare - Piano di Sviluppo Strutturato

*Documento consolidato da tutti i gap analysis e priorità identificate*

---

## 📊 **EXECUTIVE SUMMARY**

Questo documento raccoglie **tutti i gap, problemi e implementazioni mancanti** identificati nell'analisi tecnica dettagliata del sistema modulare DeFi. Gli item sono organizzati in **4 fasi prioritarie** con timeline stimate e dipendenze chiare.

### **Stato Attuale Sistema**
- ✅ **Beacon**: 100% funzionale
- 🟡 **TokenManager**: 80% (mancano interfacce e validazioni)
- ❌ **ValueCalculator**: 30% (architettura da rivedere)
- 🟡 **SwapManager**: 60% (custody problem)
- ❌ **LiquidityManager**: 10% (95% logica mancante)
- ❌ **EmergencyHandler**: 20% (logica errata)
- 🟡 **ParameterManager**: 50% (hardcoded)
- ❌ **ProxyGeneral**: 0% (non implementato)

---

## 🎯 **FASE 1: BLOCKERS CRITICI** 
*Timeline: 2-3 settimane | Priorità: BLOCCANTE*

### **1.1 ProxyGeneral - Implementazione Completa** 🔴
**Problema**: Cuore finanziario del sistema completamente mancante
**Impatto**: Sistema 100% non funzionale senza questo contratto

#### **Componenti da Implementare:**
```solidity
contract ProxyGeneral is ERC20, Ownable, ReentrancyGuard {
    // LP Token Management (inherits ERC20)
    // Asset Custody (WETH + ERC20 tokens)
    // Access Control (solo moduli autorizzati)
    // Emergency Pause Mechanism
}
```

#### **API Critica Richiesta:**
- `mint(address to, uint256 amount)` - LP token emission
- `burn(address from, uint256 amount)` - LP token burning
- `transferFunds(address to, address asset, uint256 amount)` - Asset transfers
- `approveSpender(address token, address spender, uint256 amount)` - Swap support
- `isAuthorizedModule(address module)` - ACL validation
- `pause()` / `unpause()` / `isPaused()` - Emergency controls

#### **Effort**: 40-50 ore | **Blockers**: Nessuno

---

### **1.2 TokenManager - Interfacce Mancanti** 🔴
**Problema**: Altri moduli chiamano funzioni inesistenti
**Impatto**: Compilation failures su SwapManager e ValueCalculator

#### **Funzioni da Aggiungere:**
```solidity
// Per SwapManager
function isTokenActive(string memory _tokenCode) external view returns (bool) {
    return tokenData[_tokenCode].isActive;
}

// Per ValueCalculator (da migrare da monolite)
function getCachedTokenValue(string memory _tokenCode) external view returns (uint256, bool);
function calculateTokenValue(string memory _tokenCode) external returns (uint256);
function invalidateCache(string memory _tokenCode) external;
```

#### **Validazioni Chainlink Mancanti:**
```solidity
// getTokenPrice() - validazioni critiche
require(timestamp > 0, "Round not complete");
require(answeredInRound >= roundId, "Stale price");
```

#### **Sistema Error Tracking:**
```solidity
mapping(string => uint256) public tokenErrors;
uint256 public maxErrors = 3;
// + eventi: TokenError, ErrorThresholdReached, PriceStale
```

#### **Effort**: 15-20 ore | **Blockers**: Definire storage cache in TokenManager vs ValueCalculator

---

### **1.3 ValueCalculator - Riscrittura Architettura** 🔴
**Problema**: Dipendenza circolare e delegazione inappropriata
**Impatto**: Calcoli valore pool non funzionanti

#### **Decisione Architetturale Critica:**
```
OPZIONE A: TokenManager gestisce cache + prezzi (tutto in uno)
OPZIONE B: ValueCalculator gestisce cache + calcoli (separazione)

RACCOMANDATO: OPZIONE B per separazione responsabilità
```

#### **Implementazione ValueCalculator (se Opzione B):**
```solidity
contract ValueCalculator {
    // Storage proprio
    mapping(string => TokenValueCache) private cache;
    mapping(string => uint256) private tokenErrors;
    
    // Parametri da ParameterManager
    uint256 cacheDuration; uint256 maxPriceAge; uint256 maxErrors;
    
    // Logica completa dal monolite
    function calculateTokenValue() // con try/catch e error tracking
    function getTotalPoolValue() // con percentuali e PoolValueInfo
    function getCachedTokenValue() // con TTL validation
}
```

#### **Holder Asset Resolution:**
```solidity
// Lettura bilanci da ProxyGeneral (non address(this))
address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
uint256 tokenBalance = IERC20(token).balanceOf(proxyGeneral);
uint256 wethBalance = IWETH(weth).balanceOf(proxyGeneral);
```

#### **Effort**: 25-30 ore | **Blockers**: ProxyGeneral implementation

---

### **1.4 SwapManager - Custody Problem** 🔴
**Problema**: Approva token che non possiede
**Impatto**: Tutti gli swap falliscono

#### **Implementazione Pattern Asset Access:**
```solidity
// Pattern A: ProxyGeneral Approval (RACCOMANDATO)
function performSwap(...) {
    IProxyGeneral proxy = IProxyGeneral(beacon.getImplementation("ProxyGeneral"));
    proxy.approveSpender(spendToken, simpleSwapAddress, amountIn);
    uint256 received = simpleSwap.inputSwap(spendToken, receiveToken, amountIn);
}

// Pattern B: Temporary Transfer
function performSwap(...) {
    proxy.transferToModule(spendToken, address(this), amountIn);
    IERC20(spendToken).approve(simpleSwapAddress, amountIn);
    // ... swap e transfer back
}
```

#### **Access Control Fix:**
```solidity
modifier onlyOwnerOrLiquidityManager() {
    require(
        msg.sender == owner() || 
        msg.sender == IBeacon(beacon).getImplementation("LiquidityManager"),
        "Unauthorized"
    );
    _;
}
```

#### **Effort**: 10-15 ore | **Blockers**: ProxyGeneral implementation

---

## 🔧 **FASE 2: COMPLETAMENTO CORE LOGIC**
*Timeline: 2-3 settimane | Priorità: ALTA*

### **2.1 LiquidityManager - Migrazione Logica Monolite** 🟡
**Problema**: 95% della logica complessa mancante
**Impatto**: Deposit/withdraw non funzionali

#### **Logica da Migrare dal Monolite:**

##### **Deposit Function Enhancement:**
```solidity
function deposit() external payable {
    // Validazioni da ParameterManager
    require(msg.value >= params.getCurrentParameterValue("minDeposit"));
    require(msg.value <= params.getCurrentParameterValue("maxDeposit"));
    
    // Pre-state validations
    uint256 preDepositBalance = IWETH(weth).balanceOf(proxyGeneral);
    uint256 preDepositSupply = proxy.totalSupply();
    
    // Share calculation (mantenere logica originale)
    uint256 shares = calculateShares(msg.value, preDepositBalance, preDepositSupply);
    
    // Wrap e transfer
    IWETH(weth).deposit{value: msg.value}();
    IWETH(weth).transfer(proxyGeneral, msg.value);
    
    // Mint e validazioni post
    proxy.mint(msg.sender, shares);
    
    // Emit eventi ricchi
    emit Deposit(msg.sender, msg.value, shares, postBalance, postSupply);
}
```

##### **Withdraw Function - Algoritmo Completo:**
```solidity
function withdraw(uint256 shares, uint256 minWethOut) external {
    // 1. VALIDAZIONI COMPLETE
    require(shares <= proxy.balanceOf(msg.sender), "Insufficient LP");
    require(shares <= params.getCurrentParameterValue("maxWithdrawPerTx"));
    require(!emergency.isPaused(), "System paused");
    
    // 2. CALCOLO VALORE CON STRUCT VALIDATION
    WithdrawValidation memory validation;
    validation.totalValue = valueCalculator.getTotalPoolValue();
    validation.ethAmount = (shares * validation.totalValue) / proxy.totalSupply();
    
    // 3. SLIPPAGE PROTECTION
    require(validation.ethAmount >= minWethOut, "Excessive slippage");
    uint256 maxSlippage = params.getCurrentParameterValue("maxSlippage");
    uint256 expectedMin = (validation.ethAmount * (10000 - maxSlippage)) / 10000;
    require(minWethOut >= expectedMin, "Slippage tolerance too high");
    
    // 4. RESERVE RATIO CHECKS
    validation.currentRatio = (wethBalance * 10000) / validation.totalValue;
    uint256 reserveRatio = params.getCurrentParameterValue("poolReserveRatio");
    require(validation.currentRatio >= reserveRatio, "Insufficient reserves");
    
    // 5. ALGORITMO SELEZIONE TOKEN PER SWAP
    if (wethBalance < validation.ethAmount) {
        string memory tokenToSwap = selectTokenForSwap(validation.ethAmount - wethBalance);
        uint256 tokenAmount = calculateSwapAmount(tokenToSwap, wethNeeded);
        swapManager.performSwap(tokenToSwap, "WETH", tokenAmount);
    }
    
    // 6. POST-WITHDRAWAL VALIDATIONS & TRANSFER
    validatePostWithdraw(validation);
    proxy.burn(msg.sender, shares);
    proxy.transferFunds(msg.sender, weth, validation.ethAmount);
    
    emit Withdrawn(msg.sender, shares, validation.ethAmount, postValue, postBalance);
}
```

##### **Algoritmo Selezione Token:**
```solidity
function selectTokenForSwap(uint256 wethNeeded) internal returns (string memory) {
    PoolValueInfo memory poolInfo = valueCalculator.getTotalPoolValue();
    
    string memory selectedToken;
    uint256 lowestPercentage = type(uint256).max;
    
    for (uint i = 0; i < poolInfo.tokenValues.length; i++) {
        if (poolInfo.tokenValues[i].value >= wethNeeded && 
            poolInfo.tokenValues[i].percentage < lowestPercentage) {
            
            lowestPercentage = poolInfo.tokenValues[i].percentage;
            selectedToken = tokenManager.getTokenCode(i);
        }
    }
    
    require(bytes(selectedToken).length > 0, "No suitable token for swap");
    return selectedToken;
}
```

#### **Integrazione Parametri:**
```solidity
// Leggere TUTTI i parametri da ParameterManager
IParameterManager params = IParameterManager(beacon.getImplementation("ParameterManager"));

// Parametri richiesti:
// minDeposit, maxDeposit, maxWithdrawPerTx, minWithdraw
// maxSlippage, poolReserveRatio, withdrawLimitPerHour
```

#### **Limite Orario Implementation:**
```solidity
// Storage in ProxyGeneral per coerenza multi-modulo
mapping(address => mapping(uint256 => uint256)) hourlyWithdrawn; // user => hour => amount
uint256 public withdrawLimitPerHour;

modifier withinHourlyLimits(uint256 amount) {
    uint256 currentHour = block.timestamp / 1 hours;
    require(
        hourlyWithdrawn[msg.sender][currentHour] + amount <= withdrawLimitPerHour,
        "Exceeds hourly limit"
    );
    hourlyWithdrawn[msg.sender][currentHour] += amount;
    _;
}
```

#### **Effort**: 40-50 ore | **Blockers**: ProxyGeneral, ValueCalculator, ParameterManager

---

### **2.2 EmergencyHandler - Logica Corretta** 🟡
**Problema**: Chiamate a funzioni inesistenti e logica errata
**Impatto**: Emergency procedures non funzionanti

#### **Fix Implementazione:**
```solidity
contract EmergencyHandler {
    function emergencyWithdraw() external onlyOwner {
        require(isPaused(), "Must be paused first");
        
        address proxyGeneral = beacon.getImplementation("ProxyGeneral");
        ITokenManager tokenManager = ITokenManager(beacon.getImplementation("TokenManager"));
        
        uint256 totalAssets = 0;
        bool allSuccessful = true;
        
        // 1. Withdraw WETH
        uint256 wethBalance = IWETH(weth).balanceOf(proxyGeneral);
        if (wethBalance > 0) {
            try IProxyGeneral(proxyGeneral).transferFunds(owner(), weth, wethBalance) {
                totalAssets += wethBalance;
                emit EmergencyWithdrawal("WETH", wethBalance, owner());
            } catch {
                allSuccessful = false;
                emit EmergencyWithdrawalFailed("WETH", wethBalance, "Transfer failed");
            }
        }
        
        // 2. Withdraw all active tokens
        string[] memory activeTokens = tokenManager.getActiveTokens();
        for (uint i = 0; i < activeTokens.length; i++) {
            address tokenAddress = tokenManager.getTokenAddress(activeTokens[i]);
            uint256 balance = IERC20(tokenAddress).balanceOf(proxyGeneral);
            
            if (balance > 0) {
                try IProxyGeneral(proxyGeneral).transferFunds(owner(), tokenAddress, balance) {
                    totalAssets += 1; // Count assets, not amounts (different units)
                    emit EmergencyWithdrawal(activeTokens[i], balance, owner());
                } catch {
                    allSuccessful = false;
                    emit EmergencyWithdrawalFailed(activeTokens[i], balance, "Transfer failed");
                }
            }
        }
        
        emit EmergencyWithdrawalComplete(totalAssets, allSuccessful);
    }
    
    // Centralized pause management
    function pause() external onlyOwner {
        IProxyGeneral(beacon.getImplementation("ProxyGeneral")).pause();
    }
    
    function unpause() external onlyOwner {
        IProxyGeneral(beacon.getImplementation("ProxyGeneral")).unpause();
    }
}
```

#### **Effort**: 8-10 ore | **Blockers**: ProxyGeneral

---

### **2.3 ParameterManager - Storage Stateful** 🟡
**Problema**: Valori hardcoded, updateParameterValue non aggiorna nulla
**Impatto**: Gestione parametri non funzionale

#### **Implementazione Storage State:**
```solidity
contract ParameterManager {
    // Storage stateful invece di hardcoded
    mapping(string => uint256) private parameters;
    
    constructor() {
        // Initialize with default values
        parameters["maxDeposit"] = 100 ether;
        parameters["maxWithdrawPerTx"] = 50 ether;
        parameters["minDeposit"] = 0.000001 ether;
        parameters["minWithdraw"] = 0.000001 ether;
        parameters["maxSlippage"] = 200; // 2%
        parameters["poolReserveRatio"] = 0;
        parameters["cacheDuration"] = 5 minutes;
        parameters["maxPriceAge"] = 24 hours;
        parameters["maxTokensPerOperation"] = 10;
        parameters["maxErrors"] = 3;
        parameters["withdrawLimitPerHour"] = 100 ether;
    }
    
    function getCurrentParameterValue(string calldata parameterName) 
        public view returns (uint256) {
        uint256 value = parameters[parameterName];
        require(value > 0, "Parameter not found");
        return value;
    }
    
    function updateParameterValue(string calldata parameterName, uint256 newValue) 
        external onlyOwner {
        require(isValidParameter(parameterName, newValue), "Invalid parameter");
        
        uint256 oldValue = parameters[parameterName];
        parameters[parameterName] = newValue; // ACTUALLY UPDATE STORAGE
        
        emit ParameterUpdated(parameterName, oldValue, newValue, block.timestamp, msg.sender);
    }
}
```

#### **Effort**: 5-8 ore | **Blockers**: Nessuno

---

## 🔒 **FASE 3: SECURITY & VALIDAZIONI**
*Timeline: 1-2 settimane | Priorità: MEDIA-ALTA*

### **3.1 TokenManager - Validazioni Sicurezza** 🟡

#### **WETH Exclusion e Max Tokens:**
```solidity
function manageTokenData(...) external onlyOwner {
    // Critical validations missing
    address wethAddress = IBeacon(beacon).getImplementation("WETH");
    require(_tokenAddress != wethAddress, "Cannot add WETH as token");
    
    // Add counter management
    if (!tokenData[_tokenCode].isActive) {
        require(tokenCodes.length < maxTokensPerOperation, "Too many tokens");
        tokenCodes.push(_tokenCode);
        tokenCodesCount++; // Add counter if using this pattern
    }
}
```

#### **Chainlink Validations Complete:**
```solidity
function getTokenPrice(string memory _tokenCode) public view returns (...) {
    AggregatorV3Interface priceFeed = AggregatorV3Interface(token.priceFeed);
    (
        uint80 roundId,
        int256 rawPrice,
        ,
        uint256 timestamp,
        uint80 answeredInRound
    ) = priceFeed.latestRoundData();
    
    require(rawPrice > 0, "Invalid price");
    require(timestamp > 0, "Round not complete"); // MISSING
    require(answeredInRound >= roundId, "Stale price"); // MISSING
    
    return (uint256(rawPrice), timestamp, block.timestamp - timestamp > token.heartbeat);
}
```

#### **Eventi Monitoring Completi:**
```solidity
event TokenError(string indexed tokenCode, string errorMessage);
event PriceStale(string indexed tokenCode, uint256 lastUpdateTime);
event ErrorThresholdReached(string indexed tokenCode);
```

#### **Effort**: 10-12 ore

---

### **3.2 Slippage & MEV Protection** 🟡

#### **SwapManager Slippage Protection:**
```solidity
function performSwap(
    string memory spendTokenCode,
    string memory receiveTokenCode, 
    uint256 amountIn,
    uint256 minAmountOut // ADD SLIPPAGE PARAMETER
) external returns (uint256) {
    // ... existing logic ...
    
    uint256 received = simpleSwap.inputSwap(spendToken, receiveToken, amountIn);
    require(received >= minAmountOut, "Excessive slippage");
    
    return received;
}

// Alternative: Use outputSwap for fixed output
function performSwapExactOut(
    string memory spendTokenCode,
    string memory receiveTokenCode,
    uint256 amountOut,
    uint256 maxAmountIn
) external returns (uint256) {
    uint256 spent = simpleSwap.outputSwap(spendToken, receiveToken, maxAmountIn, amountOut);
    require(spent <= maxAmountIn, "Excessive slippage");
    return spent;
}
```

#### **LiquidityManager MEV Protection:**
```solidity
// Calcolare slippage massimo consentito
uint256 maxSlippage = params.getCurrentParameterValue("maxSlippage");
uint256 minTokenOut = (tokenAmountToSwap * (10000 - maxSlippage)) / 10000;

swapManager.performSwap(tokenToSwap, "WETH", tokenAmountToSwap, minTokenOut);
```

#### **Effort**: 8-10 ore

---

### **3.3 SafeERC20 e Approval Management** 🟡

#### **Uniformare Approvals:**
```solidity
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract SwapManager {
    using SafeERC20 for IERC20;
    
    function performSwap(...) external {
        // Safe approval pattern
        IERC20(spendToken).safeApprove(simpleSwapAddress, 0);
        IERC20(spendToken).safeApprove(simpleSwapAddress, amountIn);
        
        try simpleSwap.inputSwap(...) {
            // success
        } catch {
            // Reset approval on failure
            IERC20(spendToken).safeApprove(simpleSwapAddress, 0);
            revert();
        }
    }
}
```

#### **Effort**: 4-5 ore

---

### **3.4 2-Step Ownership e Timelock** 🟡

#### **Beacon Ownership Enhancement:**
```solidity
contract Beacon {
    address public owner;
    address public pendingOwner;
    
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }
    
    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Not pending owner");
        address oldOwner = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(oldOwner, owner);
    }
}
```

#### **Critical Parameters Timelock:**
```solidity
contract ParameterManager {
    uint256 public constant TIMELOCK_DELAY = 24 hours;
    
    struct PendingChange {
        uint256 newValue;
        uint256 executeTime;
        bool pending;
    }
    
    mapping(string => PendingChange) public pendingChanges;
    
    function proposeParameterChange(string calldata param, uint256 newValue) external onlyOwner {
        require(isCriticalParameter(param), "Not critical parameter");
        
        pendingChanges[param] = PendingChange({
            newValue: newValue,
            executeTime: block.timestamp + TIMELOCK_DELAY,
            pending: true
        });
        
        emit ParameterChangeProposed(param, newValue, block.timestamp + TIMELOCK_DELAY);
    }
    
    function executeParameterChange(string calldata param) external onlyOwner {
        PendingChange memory change = pendingChanges[param];
        require(change.pending, "No pending change");
        require(block.timestamp >= change.executeTime, "Timelock not expired");
        
        uint256 oldValue = parameters[param];
        parameters[param] = change.newValue;
        delete pendingChanges[param];
        
        emit ParameterUpdated(param, oldValue, change.newValue, block.timestamp, msg.sender);
    }
}
```

#### **Effort**: 10-12 ore

---

## 🧪 **FASE 4: TESTING & OPTIMIZATION**
*Timeline: 2-3 settimane | Priorità: MEDIA*

### **4.1 Unit Testing Completo** 🟢

#### **Test Coverage per Modulo:**
```typescript
// Beacon.test.ts
describe("Beacon", () => {
    it("should update implementation correctly");
    it("should reject invalid addresses");
    it("should handle ownership transfer");
    it("should emit events appropriately");
});

// TokenManager.test.ts
describe("TokenManager", () => {
    it("should add/remove tokens correctly");
    it("should reject WETH as token");
    it("should enforce max tokens limit");
    it("should handle Chainlink price feeds");
    it("should track errors and emit events");
});

// ValueCalculator.test.ts  
describe("ValueCalculator", () => {
    it("should calculate token values correctly");
    it("should handle cache TTL");
    it("should calculate pool value with percentages");
    it("should handle stale prices");
});

// SwapManager.test.ts
describe("SwapManager", () => {
    it("should perform swaps with correct access control");
    it("should handle slippage protection");
    it("should reset approvals on failure");
});

// LiquidityManager.test.ts
describe("LiquidityManager", () => {
    it("should handle deposits with validations");
    it("should handle withdrawals with swap logic");
    it("should enforce limits and slippage");
    it("should calculate shares correctly");
});

// ProxyGeneral.test.ts
describe("ProxyGeneral", () => {
    it("should mint/burn LP tokens correctly");
    it("should handle asset custody");
    it("should enforce ACL");
    it("should handle emergency pause");
});
```

#### **Effort**: 30-40 ore

---

### **4.2 Integration Testing** 🟢

#### **End-to-End Scenarios:**
```typescript
describe("Full System Integration", () => {
    it("should handle complete deposit flow");
    it("should handle withdraw without swap");
    it("should handle withdraw with token swap");
    it("should handle emergency procedures");
    it("should handle parameter updates");
    it("should handle module upgrades via Beacon");
});
```

#### **Effort**: 20-25 ore

---

### **4.3 Fuzz & Property Testing** 🟢

#### **Invariant Testing:**
```solidity
// PropertyTests.sol
contract PropertyTests {
    function invariant_totalSupplyEqualsSum() public {
        // LP token supply should equal sum of all balances
    }
    
    function invariant_reserveRatioMaintained() public {
        // Reserve ratio should always be >= poolReserveRatio
    }
    
    function invariant_hourlyLimitsRespected() public {
        // Hourly withdrawal amounts should not exceed limits
    }
    
    function fuzz_withdrawNeverExceedsBalance(uint256 shares) public {
        // Withdraw should never transfer more than user's LP balance worth
    }
    
    function fuzz_priceCalculationNeverOverflows(
        uint256 balance, 
        uint256 price, 
        uint8 decimals
    ) public {
        // Price calculations should handle all decimal combinations
    }
}
```

#### **Effort**: 15-20 ore

---

### **4.4 Gas Optimization** 🟢

#### **Optimizations Identificate:**

##### **ValueCalculator View Functions:**
```solidity
// Aggiungere versioni view che non aggiornano cache
function getTotalPoolValueView() external view returns (uint256);
function calculateTokenValueView(string memory _tokenCode) external view returns (uint256);
```

##### **Batch Operations:**
```solidity
// ProxyGeneral batch operations per risparmiare gas
function batchTransferFunds(
    address[] calldata recipients,
    address[] calldata assets,
    uint256[] calldata amounts
) external onlyAuthorizedModule;
```

##### **Storage Packing:**
```solidity
// Ottimizzare storage layout per ridurre SSTORE costs
struct TokenInfo {
    address tokenAddress;        // 20 bytes
    address priceFeed;          // 20 bytes  
    uint8 tokenDecimals;        // 1 byte
    uint8 priceFeedDecimals;    // 1 byte
    bool isActive;              // 1 byte
    // Pack in single slot: uint256 heartbeat
    // Pack in single slot: uint256 lastPrice  
    // Pack in single slot: uint256 lastPriceTimestamp
}
```

#### **Effort**: 10-15 ore

---

### **4.5 Documentation & Deployment** 🟢

#### **Technical Documentation:**
- API documentation completa per ogni modulo
- Sequence diagrams per flussi principali
- Architecture decision records (ADRs)
- Security considerations e threat model
- Upgrade procedures e migration guides

#### **Deployment Automation:**
```typescript
// deploy.ts - Full system deployment script
async function deployFullSystem() {
    // 1. Deploy Beacon
    // 2. Deploy all modules
    // 3. Setup Beacon mappings
    // 4. Initialize parameters
    // 5. Transfer ownerships
    // 6. Verify deployments
}
```

#### **Monitoring Dashboard:**
- Real-time pool value tracking
- Price feed health monitoring  
- Error rates e alert system
- Gas usage analytics
- LP token metrics

#### **Effort**: 20-25 ore

---

## 📊 **TIMELINE & RESOURCE ALLOCATION**

### **Breakdown Temporale**

| Fase | Duration | Effort (ore) | Developers | Dependencies |
|------|----------|--------------|------------|--------------|
| **Fase 1** | 2-3 settimane | 90-115 | 1-2 senior | Nessuna |
| **Fase 2** | 2-3 settimane | 53-68 | 1-2 senior | Fase 1 complete |
| **Fase 3** | 1-2 settimane | 32-39 | 1 senior | Fase 1-2 complete |  
| **Fase 4** | 2-3 settimane | 95-125 | 1-2 (mix levels) | Fase 1-3 complete |
| **TOTALE** | **7-11 settimane** | **270-347 ore** | - | - |

### **Critical Path**
1. ProxyGeneral (blocca tutto) → 2 settimane
2. TokenManager interfaces (blocca compilation) → 3 giorni
3. ValueCalculator rework (blocca calcoli) → 1 settimana  
4. LiquidityManager logic (blocca business logic) → 2 settimane

### **Paralleli Possibili**
- ParameterManager + EmergencyHandler (Fase 2)
- Security improvements (Fase 3) possono iniziare dopo Fase 1
- Testing può iniziare per moduli completati

---

## 🎯 **SUCCESS CRITERIA**

### **Fase 1 Complete:**
- ✅ Tutti i moduli compilano senza errori
- ✅ ProxyGeneral gestisce custody e LP tokens
- ✅ Basic deposit/withdraw funzionanti

### **Fase 2 Complete:**
- ✅ Logica complessa LiquidityManager implementata
- ✅ Swap automatici funzionanti
- ✅ Emergency procedures operative

### **Fase 3 Complete:**
- ✅ Tutte le validazioni di sicurezza implementate
- ✅ MEV/slippage protection attiva
- ✅ Ownership e timelock sicuri

### **Fase 4 Complete:**
- ✅ Test coverage >90%
- ✅ Gas optimizations applicate
- ✅ Sistema ready per mainnet

---

*Pronto per iniziare da ProxyGeneral implementation?* 🚀