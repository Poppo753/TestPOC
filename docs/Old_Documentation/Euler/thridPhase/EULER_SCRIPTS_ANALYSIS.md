# 📊 EULER V2 - ANALISI SCRIPT DA CREARE

**Data**: 31 Gennaio 2026  
**Fase**: Third Phase - Post Refactoring (Phases 9, 10, 11)  
**Obiettivo**: Creare script deployment + testing per Euler V2 Integration

---

## 📑 INDICE

1. [Analisi Test Files](#analisi-test-files)
2. [Operazioni Estraibili](#operazioni-estraibili)
3. [Script Deployment](#script-deployment)
4. [Script Testing](#script-testing)
5. [Step Implementazione](#step-implementazione)

---

## 1. ANALISI TEST FILES

### 1.1 EulerV2Plugin.realfunds.test.ts

**Scopo**: Testare operazioni base su fork Arbitrum con WETH reali

**Flusso Operativo**:
```
Step 1: Deploy EulerRegistry + configure vaults
Step 2: Deploy EulerV2Plugin
Step 3: Authorize plugin in ProxyGeneral
Step 4: Transfer WETH to plugin
Step 5: Deposit WETH → Euler vault (auto-enable collateral)
Step 6: Verify collateral enabled
Step 7: Withdraw WETH → ProxyGeneral
Step 8: Re-deposit WETH
Step 9: Borrow USDC against collateral (auto-enable controller)
Step 10: Repay USDC debt
Step 11: Withdraw all WETH
Step 13: Fresh leverage test (deposit + borrow)
```

**Operazioni Chiave**:
- ✅ `eulerPlugin.deposit("WETH", amount)` → Deposita collateral (auto-enable)
- ✅ `eulerPlugin.withdraw("WETH", amount)` → Ritira collateral
- ✅ `eulerPlugin.borrow("USDC", amount)` → Borrow contro collateral (auto-enable controller)
- ✅ `eulerPlugin.repay("USDC", amount)` → Ripaga debt
- ✅ `evc.isCollateralEnabled(account, vault)` → Verifica collateral
- ✅ `evc.isControllerEnabled(account, vault)` → Verifica controller
- ✅ `wethVault.balanceOf(account)` → Shares in vault
- ✅ `wethVault.convertToAssets(shares)` → Collateral value
- ✅ `usdcVault.debtOf(account)` → Current debt

**Configurazione Beacon**:
```typescript
beacon.updateImplementation("EulerRegistry", registryAddress)
eulerRegistry.setVault("WETH", WETH_VAULT)
eulerRegistry.setVault("USDC", USDC_VAULT)
beacon.updateImplementation("WETH", ADDRESSES.WETH)
beacon.updateImplementation("ProtocolManager", TOKEN_MANAGER)
```

---

### 1.2 FlashLoanService.e2e.test.ts

**Scopo**: Testare leverage atomico con flash loans Balancer V2

**Flusso Operativo**:
```
Phase 1: Deploy FlashLoanService + EulerV2Plugin
         - Setup Beacon (EulerRegistry, tokens, FlashLoanService)
         - Register plugin in Beacon
         - Transfer registry ownership to plugin
Phase 2: Get test WETH from whale
Phase 3: Open 2x leverage position ATOMICALLY
         - openLeverageAtomic({ collateral, targetLeverage, ... })
Phase 4: Verify leverage state
         - Check collateral/controller enabled
         - Calculate leverage from position
Phase 5: Close leverage position ATOMICALLY
         - closeLeverageAtomic({ maxSlippage, deadline })
Phase 6: Verify security (unauthorized callers)
```

**Operazioni Chiave**:
- ✅ `eulerPlugin.openLeverageAtomic({...})` → Open leverage in 1 tx
- ✅ `eulerPlugin.closeLeverageAtomic({...})` → Close leverage in 1 tx
- ✅ `accountLens.getAccountLiquidityInfo(account, vault)` → Health factor
- ✅ `flashLoanService.isAuthorizedPlugin(plugin)` → Security check

**Helper Functions**:
```typescript
// Formattazione
formatAmount(amount, decimals)

// Health Check
async checkPluginHealth(label) {
    const shares = await wethVault.balanceOf(pluginAddress);
    const collateral = await wethVault.convertToAssets(shares);
    const debt = await usdcVault.debtOf(pluginAddress);
    const info = await accountLens.getAccountLiquidityInfo(...);
    const healthFactor = collateralValue / liabilityValue;
    // Returns { healthFactor, collateral, debt }
}

// Leverage Calculation
async estimateLeverage() {
    const collateral = await wethVault.convertToAssets(shares);
    const debt = await usdcVault.debtOf(pluginAddress);
    const debtInWeth = (debt * 1e12) / 3000; // Assuming ETH = $3000
    const equity = collateral - debtInWeth;
    return collateral / equity;
}
```

---

## 2. OPERAZIONI ESTRAIBILI

### 2.1 Operazioni Deployment

| # | Operazione | Fonte | Priorità |
|---|------------|-------|----------|
| 1 | Deploy EulerRegistry | realfunds Step 1 | 🔴 ALTA |
| 2 | Configure vaults in registry | realfunds Step 1 | 🔴 ALTA |
| 3 | Deploy EulerLensAdapter | - | 🔴 ALTA |
| 4 | Deploy FlashLoanService | e2e Phase 1 | 🔴 ALTA |
| 5 | Deploy EulerV2Plugin | realfunds Step 2 | 🔴 ALTA |
| 6 | Register all in Beacon | entrambi | 🔴 ALTA |
| 7 | Transfer registry ownership | e2e Phase 1 | 🔴 ALTA |

### 2.2 Operazioni Testing (Read-Only)

| # | Operazione | Fonte | Gas | Descrizione |
|---|------------|-------|-----|-------------|
| 1 | Check position | entrambi | 0 | View vault shares, collateral, debt |
| 2 | Check health factor | e2e Phase 4 | 0 | AccountLens.getAccountLiquidityInfo |
| 3 | Calculate leverage | e2e helper | 0 | Collateral / (Collateral - Debt) |
| 4 | Check EVC status | realfunds Step 6 | 0 | isCollateralEnabled, isControllerEnabled |
| 5 | Verify authorization | e2e Phase 6 | 0 | isAuthorizedPlugin |

### 2.3 Operazioni Testing (Write)

| # | Operazione | Fonte | Gas Estimate | Descrizione |
|---|------------|-------|--------------|-------------|
| 1 | Deposit WETH | realfunds Step 5 | ~150k | Auto-enable collateral |
| 2 | Withdraw WETH | realfunds Step 7 | ~100k | Return to ProxyGeneral |
| 3 | Borrow USDC | realfunds Step 9 | ~200k | Auto-enable controller |
| 4 | Repay USDC | realfunds Step 10 | ~150k | Reduce debt |
| 5 | Open Leverage 2x | e2e Phase 3 | ~500k | Atomic via flash loan |
| 6 | Close Leverage | e2e Phase 5 | ~500k | Atomic via flash loan |

---

## 3. SCRIPT DEPLOYMENT

### 3.1 deploy-euler-registry.ts

**Pattern**: Come `deployAll.mainnet.ts` Phase 1 (Beacon)

**Codice Estratto**:
```typescript
// Da realfunds.test.ts Step 1
const EulerRegistry = await ethers.getContractFactory("EulerRegistry", deployer);
const eulerRegistry = await EulerRegistry.deploy();
await eulerRegistry.waitForDeployment();

const registryAddress = await eulerRegistry.getAddress();
console.log(`✅ EulerRegistry deployed: ${registryAddress}`);

// Register in Beacon
const beacon = await ethers.getContractAt([...], BEACON_ADDRESS, deployer);
await beacon.updateImplementation("EulerRegistry", registryAddress);

// Configure vaults
await eulerRegistry.setVault("WETH", ADDRESSES.WETH_VAULT);
await eulerRegistry.setVault("USDC", ADDRESSES.USDC_VAULT);
console.log("✅ Vaults configured");

// Save to mainnet-latest.json
const deployment = {
    EulerRegistry: {
        address: registryAddress,
        deployer: await deployer.getAddress(),
        timestamp: new Date().toISOString(),
        vaults: {
            WETH: ADDRESSES.WETH_VAULT,
            USDC: ADDRESSES.USDC_VAULT
        }
    }
};
```

**Input**:
- `BEACON_ADDRESS` (da mainnet-latest.json)
- `WETH_VAULT`, `USDC_VAULT` (Euler V2 addresses)

**Output**:
- `EulerRegistry` address
- Update `mainnet-latest.json`

---

### 3.2 deploy-euler-lens.ts

**Pattern**: Deploy semplice + register in Beacon

**Codice**:
```typescript
const EulerLensAdapter = await ethers.getContractFactory("EulerLensAdapter", deployer);
const lens = await EulerLensAdapter.deploy(BEACON_ADDRESS);
await lens.waitForDeployment();

const lensAddress = await lens.getAddress();
console.log(`✅ EulerLensAdapter deployed: ${lensAddress}`);

// Register in Beacon
await beacon.updateImplementation("EulerLensAdapter", lensAddress);

// Verify configuration
const evcAddress = await lens.EVC_ADDRESS();
const accountLensAddress = await lens.ACCOUNT_LENS();
console.log(`   EVC: ${evcAddress}`);
console.log(`   AccountLens: ${accountLensAddress}`);
```

**Input**:
- `BEACON_ADDRESS`

**Output**:
- `EulerLensAdapter` address
- Update `mainnet-latest.json`

---

### 3.3 deploy-flashloan-service.ts

**Pattern**: Da e2e.test.ts Phase 1

**Codice Estratto**:
```typescript
// Da FlashLoanService.e2e.test.ts Phase 1
const FlashLoanService = await ethers.getContractFactory("FlashLoanService", deployer);
const flashLoanService = await FlashLoanService.deploy(BEACON_ADDRESS);
await flashLoanService.waitForDeployment();

const address = await flashLoanService.getAddress();
console.log(`✅ FlashLoanService deployed: ${address}`);

// Verify configuration
const balancerVault = await flashLoanService.getBalancerVault();
const simpleSwap = await flashLoanService.getSimpleSwap();

console.log(`   Balancer Vault: ${balancerVault}`);
console.log(`   SimpleSwap: ${simpleSwap}`);

// Register in Beacon
await beacon.updateImplementation("FlashLoanService", address);
```

**Input**:
- `BEACON_ADDRESS`
- Hardcoded: `BALANCER_VAULT`, `SIMPLE_SWAP` (Arbitrum addresses)

**Output**:
- `FlashLoanService` address
- Update `mainnet-latest.json`

**Note**:
- FlashLoanService ha addresses hardcoded nel constructor
- No configuration needed post-deploy

---

### 3.4 deploy-euler-plugin.ts (UPDATE)

**File Esistente**: `scripts/deploy-euler-plugin.ts` (da verificare se esiste)

**Modifiche Necessarie**:
```typescript
// BEFORE (vecchio):
const registry = await beacon.getImplementation("EulerVaultRegistry");

// AFTER (nuovo):
const registry = await beacon.getImplementation("EulerRegistry");
```

**Codice Completo**:
```typescript
// Da realfunds.test.ts Step 2
const EulerV2Plugin = await ethers.getContractFactory("EulerV2Plugin", deployer);
const eulerPlugin = await EulerV2Plugin.deploy(BEACON_ADDRESS);
await eulerPlugin.waitForDeployment();

const pluginAddress = await eulerPlugin.getAddress();
console.log(`✅ EulerV2Plugin deployed: ${pluginAddress}`);

// Verify configuration
const evcAddress = await eulerPlugin.EVC_ADDRESS();
console.log(`   EVC: ${evcAddress}`);

// Register in Beacon
await beacon.updateImplementation("EulerV2Plugin", pluginAddress);

// Verify registry lookup works
const registryAddr = await beacon.getImplementation("EulerRegistry");
console.log(`   EulerRegistry: ${registryAddr}`);
```

**Input**:
- `BEACON_ADDRESS`
- Richiede `EulerRegistry` già deployato in Beacon

**Output**:
- `EulerV2Plugin` address
- Update `mainnet-latest.json`

---

### 3.5 configure-euler-system.ts

**Pattern**: Post-deployment configuration

**Codice**:
```typescript
// Da e2e.test.ts - Transfer ownership to plugin
const eulerRegistry = await ethers.getContractAt("EulerRegistry", REGISTRY_ADDRESS, deployer);
const eulerPlugin = await ethers.getContractAt("EulerV2Plugin", PLUGIN_ADDRESS, deployer);

console.log("📋 Configuring Euler System...");

// 1. Transfer EulerRegistry ownership to plugin (required for createPosition)
console.log("\n1️⃣ Transferring EulerRegistry ownership to plugin...");
const tx1 = await eulerRegistry.transferOwnership(PLUGIN_ADDRESS);
await tx1.wait();

const newOwner = await eulerRegistry.owner();
console.log(`   ✅ New owner: ${newOwner}`);
console.log(`   Expected: ${PLUGIN_ADDRESS}`);

if (newOwner.toLowerCase() !== PLUGIN_ADDRESS.toLowerCase()) {
    throw new Error("❌ Ownership transfer failed!");
}

// 2. Verify FlashLoanService recognizes plugin
const flashLoanService = await ethers.getContractAt("FlashLoanService", FLS_ADDRESS, deployer);
const isAuthorized = await flashLoanService.isAuthorizedPlugin(PLUGIN_ADDRESS);
console.log(`\n2️⃣ Plugin authorization in FlashLoanService: ${isAuthorized}`);

if (!isAuthorized) {
    throw new Error("❌ Plugin not authorized! Check Beacon registration.");
}

// 3. Verify all Beacon registrations
console.log("\n3️⃣ Verifying Beacon registrations...");
const modules = ["EulerRegistry", "EulerLensAdapter", "FlashLoanService", "EulerV2Plugin"];
for (const module of modules) {
    const addr = await beacon.getImplementation(module);
    console.log(`   ✅ ${module}: ${addr}`);
}

console.log("\n✅ Euler system configuration complete!");
```

**Input** (da mainnet-latest.json):
- `BEACON_ADDRESS`
- `REGISTRY_ADDRESS` (EulerRegistry)
- `PLUGIN_ADDRESS` (EulerV2Plugin)
- `FLS_ADDRESS` (FlashLoanService)

**Output**:
- Ownership transferred
- Verification report

---

## 4. SCRIPT TESTING

### 4.1 check-position.ts (READ-ONLY)

**Scopo**: View position state senza gas cost

**Codice**:
```typescript
// Da e2e.test.ts - checkPluginHealth() helper
const pluginAddress = PLUGIN_ADDRESS; // From config or CLI arg

const wethVault = await ethers.getContractAt([...], ADDRESSES.WETH_VAULT);
const usdcVault = await ethers.getContractAt([...], ADDRESSES.USDC_VAULT);
const accountLens = await ethers.getContractAt([...], ADDRESSES.ACCOUNT_LENS);
const evc = await ethers.getContractAt([...], ADDRESSES.EVC);

console.log("\n📊 EULER V2 POSITION STATUS");
console.log("=".repeat(70));

// 1. Vault Shares & Collateral
const shares = await wethVault.balanceOf(pluginAddress);
const collateral = await wethVault.convertToAssets(shares);
console.log(`\n💰 WETH Collateral:`);
console.log(`   Vault Shares: ${ethers.formatEther(shares)}`);
console.log(`   Asset Value:  ${ethers.formatEther(collateral)} WETH`);

// 2. Debt
const debt = await usdcVault.debtOf(pluginAddress);
console.log(`\n💳 USDC Debt:`);
console.log(`   Current Debt: ${ethers.formatUnits(debt, 6)} USDC`);

// 3. Health Factor
if (debt > 0n) {
    const info = await accountLens.getAccountLiquidityInfo(pluginAddress, ADDRESSES.USDC_VAULT);
    const collateralValue = info.collateralValueBorrowing;
    const liabilityValue = info.liabilityValueBorrowing;
    
    if (liabilityValue > 0n) {
        const healthFactor = (collateralValue * ethers.parseEther("1")) / liabilityValue;
        const healthNum = Number(ethers.formatEther(healthFactor));
        
        let emoji = "🟢"; // > 1.5
        if (healthNum < 1.05) emoji = "🔴"; // Critical
        else if (healthNum < 1.3) emoji = "🟡"; // Warning
        
        console.log(`\n${emoji} Health Factor:`);
        console.log(`   Health: ${healthNum.toFixed(2)}x`);
        console.log(`   Collateral Value: $${ethers.formatUnits(collateralValue, 18)}`);
        console.log(`   Liability Value:  $${ethers.formatUnits(liabilityValue, 18)}`);
    }
}

// 4. Leverage
if (debt > 0n) {
    const debtInWeth = (debt * BigInt(10 ** 12)) / 3000n; // Assume ETH = $3000
    const equity = collateral > debtInWeth ? collateral - debtInWeth : 1n;
    const leverage = Number(collateral) / Number(equity);
    
    console.log(`\n📊 Leverage:`);
    console.log(`   Current: ${leverage.toFixed(2)}x`);
}

// 5. EVC Status
const isCollateral = await evc.isCollateralEnabled(pluginAddress, ADDRESSES.WETH_VAULT);
const isController = await evc.isControllerEnabled(pluginAddress, ADDRESSES.USDC_VAULT);

console.log(`\n🔒 EVC Status:`);
console.log(`   WETH Collateral Enabled: ${isCollateral}`);
console.log(`   USDC Controller Enabled: ${isController}`);

console.log("\n" + "=".repeat(70));
```

**Input** (CLI args or config):
- `PLUGIN_ADDRESS` (default: from mainnet-latest.json)
- Optional: `WETH_VAULT`, `USDC_VAULT` override

**Output**:
- Console report (no file)
- Exit code 0 if healthy, 1 if critical

**Usage**:
```bash
npx hardhat run scripts/testing/check-position.ts --network arbitrum
# OR with custom plugin:
npx hardhat run scripts/testing/check-position.ts --network arbitrum -- --plugin 0x123...
```

---

### 4.2 test-deposit.ts

**Scopo**: Deposit WETH to Euler vault (test on mainnet)

**Codice**:
```typescript
// Da realfunds.test.ts Step 4 + 5
const [deployer] = await ethers.getSigners();

// Config
const PLUGIN_ADDRESS = process.env.PLUGIN_ADDRESS || getFromConfig();
const AMOUNT_WETH = ethers.parseEther(process.env.AMOUNT || "0.01"); // Default 0.01 WETH

console.log("\n🏦 EULER V2 - DEPOSIT TEST");
console.log("=".repeat(70));
console.log(`Plugin: ${PLUGIN_ADDRESS}`);
console.log(`Amount: ${ethers.formatEther(AMOUNT_WETH)} WETH`);

// Get contracts
const eulerPlugin = await ethers.getContractAt("EulerV2Plugin", PLUGIN_ADDRESS, deployer);
const proxyGeneral = await ethers.getContractAt([...], PROXY_GENERAL_ADDRESS, deployer);
const weth = await ethers.getContractAt("IERC20", ADDRESSES.WETH, deployer);
const wethVault = await ethers.getContractAt([...], ADDRESSES.WETH_VAULT);

// 1. Check ProxyGeneral WETH balance
const proxyWeth = await weth.balanceOf(PROXY_GENERAL_ADDRESS);
console.log(`\nProxyGeneral WETH: ${ethers.formatEther(proxyWeth)}`);

if (proxyWeth < AMOUNT_WETH) {
    throw new Error(`❌ Insufficient WETH in ProxyGeneral! Need ${ethers.formatEther(AMOUNT_WETH)}, have ${ethers.formatEther(proxyWeth)}`);
}

// 2. Transfer WETH to plugin
console.log(`\n💸 Transferring ${ethers.formatEther(AMOUNT_WETH)} WETH to plugin...`);
const tx1 = await proxyGeneral.transferToModule(ADDRESSES.WETH, PLUGIN_ADDRESS, AMOUNT_WETH);
await tx1.wait();

const pluginWeth = await weth.balanceOf(PLUGIN_ADDRESS);
console.log(`   ✅ Plugin WETH: ${ethers.formatEther(pluginWeth)}`);

// 3. Deposit to Euler
console.log(`\n🏦 Depositing ${ethers.formatEther(pluginWeth)} WETH to Euler...`);
const tx2 = await eulerPlugin.deposit("WETH", pluginWeth);
const receipt = await tx2.wait();

console.log(`   Tx: ${receipt.hash}`);
console.log(`   Gas: ${receipt.gasUsed}`);

// 4. Verify results
const shares = await wethVault.balanceOf(PLUGIN_ADDRESS);
const maxWithdraw = await wethVault.maxWithdraw(PLUGIN_ADDRESS);

console.log(`\n✅ Deposit successful!`);
console.log(`   eWETH Shares: ${ethers.formatEther(shares)}`);
console.log(`   Max Withdraw: ${ethers.formatEther(maxWithdraw)} WETH`);

// 5. Verify auto-enabled collateral
const evc = await ethers.getContractAt([...], ADDRESSES.EVC);
const isCollateral = await evc.isCollateralEnabled(PLUGIN_ADDRESS, ADDRESSES.WETH_VAULT);
console.log(`   Collateral Enabled: ${isCollateral} ✅`);
```

**Input** (env vars):
- `PLUGIN_ADDRESS`
- `AMOUNT` (default: "0.01")

**Output**:
- Deposit confirmation
- Gas used
- Update position state

**Safety**:
- ✅ Check balance before transfer
- ✅ Verify collateral auto-enabled
- ⚠️ Requires ProxyGeneral ownership

---

### 4.3 test-withdraw.ts

**Scopo**: Withdraw WETH from Euler vault

**Codice**:
```typescript
// Da realfunds.test.ts Step 7
const PLUGIN_ADDRESS = process.env.PLUGIN_ADDRESS || getFromConfig();
const AMOUNT_WETH = process.env.AMOUNT; // Optional: withdraw specific amount

console.log("\n💰 EULER V2 - WITHDRAW TEST");
console.log("=".repeat(70));

const eulerPlugin = await ethers.getContractAt("EulerV2Plugin", PLUGIN_ADDRESS, deployer);
const wethVault = await ethers.getContractAt([...], ADDRESSES.WETH_VAULT);
const weth = await ethers.getContractAt("IERC20", ADDRESSES.WETH);

// 1. Check current position
const maxWithdraw = await wethVault.maxWithdraw(PLUGIN_ADDRESS);
console.log(`\nMax Withdrawable: ${ethers.formatEther(maxWithdraw)} WETH`);

if (maxWithdraw === 0n) {
    console.log("❌ No WETH to withdraw!");
    process.exit(1);
}

// 2. Determine withdraw amount
let withdrawAmount = maxWithdraw;
if (AMOUNT_WETH) {
    withdrawAmount = ethers.parseEther(AMOUNT_WETH);
    if (withdrawAmount > maxWithdraw) {
        throw new Error(`❌ Amount ${AMOUNT_WETH} exceeds max ${ethers.formatEther(maxWithdraw)}`);
    }
}

console.log(`Withdrawing: ${ethers.formatEther(withdrawAmount)} WETH`);

// 3. Withdraw
const tx = await eulerPlugin.withdraw("WETH", withdrawAmount);
const receipt = await tx.wait();

console.log(`   Tx: ${receipt.hash}`);
console.log(`   Gas: ${receipt.gasUsed}`);

// 4. Verify
const proxyWeth = await weth.balanceOf(PROXY_GENERAL_ADDRESS);
const remainingShares = await wethVault.balanceOf(PLUGIN_ADDRESS);

console.log(`\n✅ Withdrawal successful!`);
console.log(`   ProxyGeneral WETH: ${ethers.formatEther(proxyWeth)}`);
console.log(`   Remaining Shares: ${ethers.formatEther(remainingShares)}`);
```

**Input**:
- `PLUGIN_ADDRESS`
- `AMOUNT` (optional, default: max)

**Safety**:
- ✅ Check maxWithdraw before
- ✅ Handles full/partial withdrawal
- ⚠️ May fail if debt exists

---

### 4.4 test-borrow.ts

**Scopo**: Borrow USDC against WETH collateral

**Codice**:
```typescript
// Da realfunds.test.ts Step 9
const PLUGIN_ADDRESS = process.env.PLUGIN_ADDRESS || getFromConfig();
const BORROW_USDC = process.env.AMOUNT || "0.1"; // Default 0.1 USDC

console.log("\n💳 EULER V2 - BORROW TEST");
console.log("=".repeat(70));

const eulerPlugin = await ethers.getContractAt("EulerV2Plugin", PLUGIN_ADDRESS, deployer);
const wethVault = await ethers.getContractAt([...], ADDRESSES.WETH_VAULT);
const usdcVault = await ethers.getContractAt([...], ADDRESSES.USDC_VAULT);
const accountLens = await ethers.getContractAt([...], ADDRESSES.ACCOUNT_LENS);

// 1. Check collateral
const shares = await wethVault.balanceOf(PLUGIN_ADDRESS);
const collateral = await wethVault.convertToAssets(shares);

console.log(`\nCurrent Collateral: ${ethers.formatEther(collateral)} WETH`);

if (collateral === 0n) {
    throw new Error("❌ No collateral! Deposit WETH first.");
}

// 2. Check max borrow capacity
const info = await accountLens.getAccountLiquidityInfo(PLUGIN_ADDRESS, ADDRESSES.USDC_VAULT);
const maxBorrowValue = info.collateralValueBorrowing - info.liabilityValueBorrowing;

console.log(`Max Borrow Capacity: $${ethers.formatUnits(maxBorrowValue, 18)}`);

// 3. Borrow
const borrowAmount = ethers.parseUnits(BORROW_USDC, 6);
console.log(`\nBorrowing: ${BORROW_USDC} USDC`);

const tx = await eulerPlugin.borrow("USDC", borrowAmount);
const receipt = await tx.wait();

console.log(`   Tx: ${receipt.hash}`);
console.log(`   Gas: ${receipt.gasUsed}`);

// 4. Verify
const debt = await usdcVault.debtOf(PLUGIN_ADDRESS);
const evc = await ethers.getContractAt([...], ADDRESSES.EVC);
const isController = await evc.isControllerEnabled(PLUGIN_ADDRESS, ADDRESSES.USDC_VAULT);

console.log(`\n✅ Borrow successful!`);
console.log(`   Total Debt: ${ethers.formatUnits(debt, 6)} USDC`);
console.log(`   Controller Enabled: ${isController} ✅`);

// 5. Check health
const newInfo = await accountLens.getAccountLiquidityInfo(PLUGIN_ADDRESS, ADDRESSES.USDC_VAULT);
const healthFactor = (newInfo.collateralValueBorrowing * ethers.parseEther("1")) / newInfo.liabilityValueBorrowing;
console.log(`   Health Factor: ${Number(ethers.formatEther(healthFactor)).toFixed(2)}x`);
```

**Input**:
- `PLUGIN_ADDRESS`
- `AMOUNT` (default: "0.1" USDC)

**Safety**:
- ✅ Check collateral exists
- ✅ Verify max borrow capacity
- ✅ Report health factor after
- ⚠️ May fail if health < min threshold

---

### 4.5 test-repay.ts

**Scopo**: Repay USDC debt

**Codice**:
```typescript
// Da realfunds.test.ts Step 10
const PLUGIN_ADDRESS = process.env.PLUGIN_ADDRESS || getFromConfig();
const REPAY_USDC = process.env.AMOUNT; // Optional: specific amount

console.log("\n💰 EULER V2 - REPAY TEST");
console.log("=".repeat(70));

const eulerPlugin = await ethers.getContractAt("EulerV2Plugin", PLUGIN_ADDRESS, deployer);
const usdcVault = await ethers.getContractAt([...], ADDRESSES.USDC_VAULT);
const usdc = await ethers.getContractAt("IERC20", ADDRESSES.USDC);
const proxyGeneral = await ethers.getContractAt([...], PROXY_GENERAL_ADDRESS);

// 1. Check current debt
const currentDebt = await usdcVault.debtOf(PLUGIN_ADDRESS);
console.log(`\nCurrent Debt: ${ethers.formatUnits(currentDebt, 6)} USDC`);

if (currentDebt === 0n) {
    console.log("✅ No debt to repay!");
    process.exit(0);
}

// 2. Determine repay amount
let repayAmount = currentDebt;
if (REPAY_USDC) {
    repayAmount = ethers.parseUnits(REPAY_USDC, 6);
}

// 3. Check ProxyGeneral USDC balance
const proxyUsdc = await usdc.balanceOf(PROXY_GENERAL_ADDRESS);
console.log(`ProxyGeneral USDC: ${ethers.formatUnits(proxyUsdc, 6)}`);

if (proxyUsdc < repayAmount) {
    console.log(`⚠️ Insufficient USDC, repaying what we have: ${ethers.formatUnits(proxyUsdc, 6)}`);
    repayAmount = proxyUsdc;
}

// 4. Transfer USDC to plugin
if (proxyUsdc > 0n) {
    console.log(`\n💸 Transferring ${ethers.formatUnits(repayAmount, 6)} USDC to plugin...`);
    await (await proxyGeneral.transferToModule(ADDRESSES.USDC, PLUGIN_ADDRESS, repayAmount)).wait();
}

// 5. Repay
console.log(`\n💳 Repaying ${ethers.formatUnits(repayAmount, 6)} USDC...`);
const tx = await eulerPlugin.repay("USDC", repayAmount);
const receipt = await tx.wait();

console.log(`   Tx: ${receipt.hash}`);
console.log(`   Gas: ${receipt.gasUsed}`);

// 6. Verify
const remainingDebt = await usdcVault.debtOf(PLUGIN_ADDRESS);

console.log(`\n✅ Repay successful!`);
console.log(`   Remaining Debt: ${ethers.formatUnits(remainingDebt, 6)} USDC`);

if (remainingDebt > 0n) {
    console.log(`   ℹ️ Note: Dust may remain due to interest accrual`);
}
```

**Input**:
- `PLUGIN_ADDRESS`
- `AMOUNT` (optional, default: full debt)

**Safety**:
- ✅ Check debt exists
- ✅ Handle partial repay if insufficient USDC
- ✅ Note about interest dust

---

### 4.6 test-leverage-open.ts

**Scopo**: Open 2x leverage position atomically

**Codice**:
```typescript
// Da e2e.test.ts Phase 3
const PLUGIN_ADDRESS = process.env.PLUGIN_ADDRESS || getFromConfig();
const COLLATERAL_WETH = process.env.COLLATERAL || "0.3"; // Default 0.3 WETH
const TARGET_LEVERAGE = parseInt(process.env.LEVERAGE || "200"); // Default 2x
const MIN_HEALTH = process.env.MIN_HEALTH || "1.05"; // Default 1.05x

console.log("\n⚡ EULER V2 - OPEN LEVERAGE (ATOMIC)");
console.log("=".repeat(70));
console.log(`Collateral: ${COLLATERAL_WETH} WETH`);
console.log(`Target Leverage: ${TARGET_LEVERAGE/100}x`);
console.log(`Min Health Factor: ${MIN_HEALTH}x`);

const eulerPlugin = await ethers.getContractAt("EulerV2Plugin", PLUGIN_ADDRESS, deployer);
const weth = await ethers.getContractAt("IERC20", ADDRESSES.WETH);
const proxyGeneral = await ethers.getContractAt([...], PROXY_GENERAL_ADDRESS);

// 1. Prepare WETH
const collateralAmount = ethers.parseEther(COLLATERAL_WETH);
const proxyWeth = await weth.balanceOf(PROXY_GENERAL_ADDRESS);

console.log(`\nProxyGeneral WETH: ${ethers.formatEther(proxyWeth)}`);

if (proxyWeth < collateralAmount) {
    throw new Error(`❌ Insufficient WETH! Need ${COLLATERAL_WETH}, have ${ethers.formatEther(proxyWeth)}`);
}

// 2. Transfer to plugin
console.log(`\n💸 Transferring ${COLLATERAL_WETH} WETH to plugin...`);
await (await proxyGeneral.transferToModule(ADDRESSES.WETH, PLUGIN_ADDRESS, collateralAmount)).wait();

// 3. Approve WETH for plugin (if needed)
const pluginWeth = await weth.balanceOf(PLUGIN_ADDRESS);
console.log(`   Plugin WETH: ${ethers.formatEther(pluginWeth)}`);

// 4. Open leverage ATOMICALLY
console.log(`\n⚡ Opening ${TARGET_LEVERAGE/100}x leverage via FlashLoanService...`);

const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

const tx = await eulerPlugin.openLeverageAtomic({
    collateralToken: "WETH",
    borrowToken: "USDC",
    collateralAmount: collateralAmount,
    targetLeverageX100: TARGET_LEVERAGE,
    minHealthFactor: ethers.parseEther(MIN_HEALTH),
    deadline: deadline
});

const receipt = await tx.wait();

console.log(`\n✅ Leverage opened ATOMICALLY!`);
console.log(`   Tx: ${receipt.hash}`);
console.log(`   Gas Used: ${receipt.gasUsed}`);
console.log(`   Block: ${receipt.blockNumber}`);

// 5. Check position
const wethVault = await ethers.getContractAt([...], ADDRESSES.WETH_VAULT);
const usdcVault = await ethers.getContractAt([...], ADDRESSES.USDC_VAULT);
const accountLens = await ethers.getContractAt([...], ADDRESSES.ACCOUNT_LENS);

const shares = await wethVault.balanceOf(PLUGIN_ADDRESS);
const collateral = await wethVault.convertToAssets(shares);
const debt = await usdcVault.debtOf(PLUGIN_ADDRESS);

console.log(`\n📊 Position State:`);
console.log(`   WETH Collateral: ${ethers.formatEther(collateral)}`);
console.log(`   USDC Debt: ${ethers.formatUnits(debt, 6)}`);

// 6. Calculate leverage
const debtInWeth = (debt * BigInt(10 ** 12)) / 3000n;
const equity = collateral - debtInWeth;
const actualLeverage = Number(collateral) / Number(equity);

console.log(`   Actual Leverage: ${actualLeverage.toFixed(2)}x`);

// 7. Health factor
const info = await accountLens.getAccountLiquidityInfo(PLUGIN_ADDRESS, ADDRESSES.USDC_VAULT);
const healthFactor = (info.collateralValueBorrowing * ethers.parseEther("1")) / info.liabilityValueBorrowing;

console.log(`   Health Factor: ${Number(ethers.formatEther(healthFactor)).toFixed(2)}x`);
```

**Input** (env vars):
- `PLUGIN_ADDRESS`
- `COLLATERAL` (default: "0.3")
- `LEVERAGE` (default: "200" = 2x)
- `MIN_HEALTH` (default: "1.05")

**Safety**:
- ✅ Check WETH balance before
- ✅ Verify leverage achieved
- ✅ Report health factor
- ⚠️ Gas intensive (~500k gas)

---

### 4.7 test-leverage-close.ts

**Scopo**: Close leverage position atomically

**Codice**:
```typescript
// Da e2e.test.ts Phase 5
const PLUGIN_ADDRESS = process.env.PLUGIN_ADDRESS || getFromConfig();
const MAX_SLIPPAGE_BPS = parseInt(process.env.SLIPPAGE || "200"); // Default 2%

console.log("\n⚡ EULER V2 - CLOSE LEVERAGE (ATOMIC)");
console.log("=".repeat(70));

const eulerPlugin = await ethers.getContractAt("EulerV2Plugin", PLUGIN_ADDRESS, deployer);
const wethVault = await ethers.getContractAt([...], ADDRESSES.WETH_VAULT);
const usdcVault = await ethers.getContractAt([...], ADDRESSES.USDC_VAULT);
const usdc = await ethers.getContractAt("IERC20", ADDRESSES.USDC);
const weth = await ethers.getContractAt("IERC20", ADDRESSES.WETH);

// 1. Check current position
const sharesBefore = await wethVault.balanceOf(PLUGIN_ADDRESS);
const collateralBefore = await wethVault.convertToAssets(sharesBefore);
const debtBefore = await usdcVault.debtOf(PLUGIN_ADDRESS);

console.log(`\n📊 Position Before:`);
console.log(`   WETH Collateral: ${ethers.formatEther(collateralBefore)}`);
console.log(`   USDC Debt: ${ethers.formatUnits(debtBefore, 6)}`);

if (debtBefore === 0n) {
    console.log("❌ No leverage position to close!");
    process.exit(1);
}

const usdcBalanceBefore = await usdc.balanceOf(PROXY_GENERAL_ADDRESS);
console.log(`   ProxyGeneral USDC: ${ethers.formatUnits(usdcBalanceBefore, 6)}`);

// 2. Close leverage ATOMICALLY
console.log(`\n⚡ Closing leverage via FlashLoanService...`);
console.log(`   Max Slippage: ${MAX_SLIPPAGE_BPS/100}%`);

const deadline = Math.floor(Date.now() / 1000) + 3600;

const tx = await eulerPlugin.closeLeverageAtomic({
    collateralToken: "WETH",
    borrowToken: "USDC",
    maxSlippageBps: MAX_SLIPPAGE_BPS,
    deadline: deadline
});

const receipt = await tx.wait();

console.log(`\n✅ Leverage closed ATOMICALLY!`);
console.log(`   Tx: ${receipt.hash}`);
console.log(`   Gas Used: ${receipt.gasUsed}`);

// 3. Check final position
const sharesAfter = await wethVault.balanceOf(PLUGIN_ADDRESS);
const collateralAfter = await wethVault.convertToAssets(sharesAfter);
const debtAfter = await usdcVault.debtOf(PLUGIN_ADDRESS);

console.log(`\n📊 Position After:`);
console.log(`   WETH Collateral: ${ethers.formatEther(collateralAfter)}`);
console.log(`   USDC Debt: ${ethers.formatUnits(debtAfter, 6)}`);

// 4. Check returned equity
const usdcBalanceAfter = await usdc.balanceOf(PROXY_GENERAL_ADDRESS);
const usdcReturned = usdcBalanceAfter - usdcBalanceBefore;

console.log(`\n💰 Equity Returned:`);
console.log(`   USDC: ${ethers.formatUnits(usdcReturned, 6)}`);

// 5. Verify clean state
console.log(`\n✅ Verification:`);
console.log(`   Debt Cleared: ${debtAfter === 0n ? "✅" : "⚠️ " + ethers.formatUnits(debtAfter, 6) + " dust"}`);
console.log(`   Collateral Minimal: ${collateralAfter < ethers.parseEther("0.01") ? "✅" : "⚠️ " + ethers.formatEther(collateralAfter)}`);
```

**Input**:
- `PLUGIN_ADDRESS`
- `SLIPPAGE` (default: "200" = 2%)

**Safety**:
- ✅ Check position exists
- ✅ Verify debt cleared
- ✅ Report equity returned
- ⚠️ Gas intensive (~500k gas)

---

## 5. STEP IMPLEMENTAZIONE

### 5.1 FASE 1: Deployment Scripts (Priority: 🔴 ALTA)

```bash
# Step 1: Creare struttura
mkdir -p scripts/deployment/euler
mkdir -p scripts/testing

# Step 2: Deploy scripts (in ordine)
1. deploy-euler-registry.ts      → Deploy + configure vaults
2. deploy-euler-lens.ts           → Deploy lens adapter
3. deploy-flashloan-service.ts    → Deploy flash loan service
4. deploy-euler-plugin.ts         → UPDATE per EulerRegistry
5. configure-euler-system.ts      → Ownership + verification

# Step 3: Test deployment su fork
FORK_ENABLED=true npx hardhat run scripts/deployment/euler/deploy-euler-registry.ts --network hardhat
# ... repeat for each script

# Step 4: Deploy su mainnet (ATTENZIONE!)
npx hardhat run scripts/deployment/euler/deploy-euler-registry.ts --network arbitrum
```

**Ordine Deployment**:
1. ✅ EulerRegistry (first - needed by plugin)
2. ✅ EulerLensAdapter (independent)
3. ✅ FlashLoanService (independent)
4. ✅ EulerV2Plugin (requires EulerRegistry in Beacon)
5. ✅ Configure (transfer ownership, verify)

**Tempo Stimato**: 2-3 ore

---

### 5.2 FASE 2: Testing Scripts (Priority: 🟡 MEDIA)

```bash
# Step 1: Create scripts
1. check-position.ts         → READ-ONLY (safe)
2. test-deposit.ts           → Basic operation
3. test-withdraw.ts          → Basic operation
4. test-borrow.ts            → Advanced (requires collateral)
5. test-repay.ts             → Advanced (requires debt)
6. test-leverage-open.ts     → Complex (flash loan)
7. test-leverage-close.ts    → Complex (flash loan)

# Step 2: Test su fork (SEMPRE prima!)
FORK_ENABLED=true npx hardhat run scripts/testing/check-position.ts --network hardhat

# Step 3: Test su mainnet (con PICCOLI importi!)
npx hardhat run scripts/testing/test-deposit.ts --network arbitrum
# Set: AMOUNT=0.001 (tiny amount!)
```

**Ordine Testing**:
1. ✅ check-position (sempre safe)
2. ✅ test-deposit (0.001 WETH)
3. ✅ check-position (verify)
4. ✅ test-withdraw (partial)
5. ✅ test-deposit (re-deposit)
6. ✅ test-borrow (0.1 USDC)
7. ✅ check-position (verify health)
8. ✅ test-repay (full)
9. ✅ test-withdraw (full)
10. ✅ test-leverage-open (0.01 WETH, 2x)
11. ✅ check-position (verify leverage)
12. ✅ test-leverage-close
13. ✅ check-position (verify clean)

**Tempo Stimato**: 3-4 ore

---

### 5.3 FASE 3: Verifica e Documentazione (Priority: 🟢 BASSA)

```bash
# Step 1: Creare summary di tutti i deployment
scripts/deployment/euler/DEPLOYMENT_SUMMARY.md

# Step 2: Creare guide d'uso
scripts/testing/TESTING_GUIDE.md

# Step 3: Update mainnet-latest.json
# Automatico durante deployment

# Step 4: Commit & push
git add scripts/
git commit -m "feat: Euler V2 deployment & testing scripts"
```

**Tempo Stimato**: 1 ora

---

## 6. CHECKLIST IMPLEMENTAZIONE

### 6.1 Deployment Scripts

- [ ] `deploy-euler-registry.ts`
  - [ ] Deploy contract
  - [ ] Configure WETH/USDC vaults
  - [ ] Register in Beacon
  - [ ] Save to mainnet-latest.json
  - [ ] Verify on Arbiscan

- [ ] `deploy-euler-lens.ts`
  - [ ] Deploy contract
  - [ ] Register in Beacon
  - [ ] Verify configuration
  - [ ] Save to mainnet-latest.json
  - [ ] Verify on Arbiscan

- [ ] `deploy-flashloan-service.ts`
  - [ ] Deploy contract
  - [ ] Verify Balancer/SimpleSwap addresses
  - [ ] Register in Beacon
  - [ ] Save to mainnet-latest.json
  - [ ] Verify on Arbiscan

- [ ] `deploy-euler-plugin.ts` (UPDATE)
  - [ ] Change `EulerVaultRegistry` → `EulerRegistry`
  - [ ] Deploy contract
  - [ ] Register in Beacon
  - [ ] Save to mainnet-latest.json
  - [ ] Verify on Arbiscan

- [ ] `configure-euler-system.ts`
  - [ ] Transfer EulerRegistry ownership to plugin
  - [ ] Verify FlashLoanService authorization
  - [ ] Verify all Beacon registrations
  - [ ] Print configuration report

---

### 6.2 Testing Scripts

- [ ] `check-position.ts`
  - [ ] Read vault shares/collateral/debt
  - [ ] Calculate health factor
  - [ ] Calculate leverage
  - [ ] Check EVC status
  - [ ] CLI args support

- [ ] `test-deposit.ts`
  - [ ] Check ProxyGeneral balance
  - [ ] Transfer WETH to plugin
  - [ ] Deposit to Euler
  - [ ] Verify auto-enabled collateral
  - [ ] Safety checks

- [ ] `test-withdraw.ts`
  - [ ] Check maxWithdraw
  - [ ] Withdraw (full or partial)
  - [ ] Verify returned to ProxyGeneral
  - [ ] Handle edge cases

- [ ] `test-borrow.ts`
  - [ ] Check collateral exists
  - [ ] Verify max borrow capacity
  - [ ] Borrow USDC
  - [ ] Verify auto-enabled controller
  - [ ] Report health factor

- [ ] `test-repay.ts`
  - [ ] Check current debt
  - [ ] Transfer USDC to plugin
  - [ ] Repay debt
  - [ ] Handle partial repay
  - [ ] Note interest dust

- [ ] `test-leverage-open.ts`
  - [ ] Prepare WETH collateral
  - [ ] Call openLeverageAtomic
  - [ ] Verify leverage achieved
  - [ ] Check health factor
  - [ ] Report position

- [ ] `test-leverage-close.ts`
  - [ ] Check position exists
  - [ ] Call closeLeverageAtomic
  - [ ] Verify debt cleared
  - [ ] Check equity returned
  - [ ] Verify clean state

---

## 7. CONFIGURAZIONE SCRIPTS

### 7.1 Addresses Configuration

Creare `scripts/config/arbitrum.config.ts`:

```typescript
export const ARBITRUM_ADDRESSES = {
    // Core (from mainnet-latest.json)
    BEACON: "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870",
    PROXY_GENERAL: "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1",
    TOKEN_MANAGER: "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517",
    
    // Tokens
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    
    // Euler V2
    EVC: "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066",
    WETH_VAULT: "0x78E3E051D32157AACD550fBB78458762d8f7edFF",
    USDC_VAULT: "0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899",
    ACCOUNT_LENS: "0x90a52DDcb232e7bb003DD9258fA1235c553eC956",
    
    // Balancer & Swap
    BALANCER_VAULT: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
    SIMPLE_SWAP: "0xa0DB78167CBAccD47524a261b7741C6B41Bbd096",
};
```

### 7.2 Helper Functions

Creare `scripts/utils/euler-helpers.ts`:

```typescript
import { ethers } from "hardhat";

export function formatAmount(amount: bigint, decimals: number = 18): string {
    return Number(ethers.formatUnits(amount, decimals)).toFixed(4);
}

export async function checkHealth(
    pluginAddress: string,
    wethVault: any,
    usdcVault: any,
    accountLens: any
): Promise<{ healthFactor: bigint; collateral: bigint; debt: bigint }> {
    const shares = await wethVault.balanceOf(pluginAddress);
    const collateral = await wethVault.convertToAssets(shares);
    const debt = await usdcVault.debtOf(pluginAddress);
    
    let healthFactor = 0n;
    
    if (debt > 0n) {
        const info = await accountLens.getAccountLiquidityInfo(
            pluginAddress,
            await usdcVault.getAddress()
        );
        if (info.liabilityValueBorrowing > 0n) {
            healthFactor = (info.collateralValueBorrowing * ethers.parseEther("1")) / 
                          info.liabilityValueBorrowing;
        }
    }
    
    return { healthFactor, collateral, debt };
}

export async function saveDeployment(
    contractName: string,
    address: string,
    deployer: string,
    extraData?: any
): Promise<void> {
    const fs = require("fs");
    const path = require("path");
    
    const deploymentPath = path.join(__dirname, "../../deployments/mainnet-latest.json");
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    
    deployment[contractName] = {
        address,
        deployer,
        timestamp: new Date().toISOString(),
        ...extraData
    };
    
    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
    console.log(`✅ Saved ${contractName} to mainnet-latest.json`);
}
```

---

## 8. GAS ESTIMATES

| Script | Gas Estimate | Cost @ 0.1 Gwei | Note |
|--------|--------------|----------------|------|
| deploy-euler-registry | ~1.5M | ~$0.50 | Deploy + config |
| deploy-euler-lens | ~1.2M | ~$0.40 | Deploy only |
| deploy-flashloan-service | ~800k | ~$0.27 | Deploy only |
| deploy-euler-plugin | ~2M | ~$0.67 | Large contract |
| configure-euler-system | ~200k | ~$0.07 | Ownership transfer |
| **Total Deployment** | **~5.7M** | **~$1.91** | |
| test-deposit | ~150k | ~$0.05 | Simple operation |
| test-withdraw | ~100k | ~$0.03 | Simple operation |
| test-borrow | ~200k | ~$0.07 | EVC enable + borrow |
| test-repay | ~150k | ~$0.05 | Simple operation |
| test-leverage-open | ~500k | ~$0.17 | Flash loan + swap |
| test-leverage-close | ~500k | ~$0.17 | Flash loan + swap |

**Total Estimated Cost**: ~$2.45 @ 0.1 Gwei (Arbitrum typical)

---

## 9. TIMELINE

### Week 1: Deployment Scripts
- **Day 1-2**: deploy-euler-registry.ts, deploy-euler-lens.ts
- **Day 3**: deploy-flashloan-service.ts
- **Day 4**: Update deploy-euler-plugin.ts
- **Day 5**: configure-euler-system.ts + testing su fork

### Week 2: Testing Scripts
- **Day 6-7**: check-position.ts, test-deposit.ts, test-withdraw.ts
- **Day 8-9**: test-borrow.ts, test-repay.ts
- **Day 10**: test-leverage-open.ts, test-leverage-close.ts

### Week 3: Deploy & Verify
- **Day 11**: Deploy tutti i contracts su mainnet
- **Day 12**: Configure system
- **Day 13-14**: Test operazioni base (deposit/withdraw/borrow/repay)
- **Day 15**: Test leverage (piccoli importi!)

**Total Time**: 15 giorni (~3 settimane)

---

## 10. RISCHI & MITIGAZIONI

| Rischio | Probabilità | Impatto | Mitigazione |
|---------|-------------|---------|-------------|
| Deploy fallito per gas | Bassa | Medio | Test su fork prima, gas limit alto |
| Ownership transfer fail | Media | Alto | Verificare owner prima, test su fork |
| Flash loan revert | Media | Medio | Test con importi minimi, check slippage |
| Health factor < 1 | Media | Alto | Sempre check health prima di borrow |
| Swap fail (liquidity) | Bassa | Medio | Use high slippage tolerance per test |
| Beacon registration fail | Bassa | Alto | Verify owner, check implementation exists |

---

## 11. PROSSIMI PASSI

1. ✅ **Approvazione Analisi**: Review questo documento
2. ⏳ **Creazione Scripts Deployment**: 5 files (2-3 ore)
3. ⏳ **Creazione Scripts Testing**: 7 files (3-4 ore)
4. ⏳ **Test su Fork**: Verificare tutti gli script (2 ore)
5. ⏳ **Deploy Mainnet**: Seguire ordine deployment (1 ora)
6. ⏳ **Test Mainnet**: Operazioni base + leverage (2 ore)
7. ✅ **Documentazione**: Update deployment guide

**Tempo Totale Stimato**: 10-14 ore (2 giorni lavorativi)

---

## 12. CONCLUSIONI

Dai due test files abbiamo estratto:
- **12 operazioni deployment/config**
- **7 operazioni testing write**
- **5 operazioni testing read-only**
- **Pattern riutilizzabili** per formatAmount, checkHealth, estimateLeverage

Tutti gli script seguiranno il pattern di `deployAll.mainnet.ts` per consistency.

La separazione **deployment vs testing** permette:
- ✅ Deploy 1 volta, test molte volte
- ✅ Scripts modulari e riutilizzabili
- ✅ Sicurezza (test piccoli importi prima)
- ✅ Debugging facilitato

**Ready to proceed! 🚀**
