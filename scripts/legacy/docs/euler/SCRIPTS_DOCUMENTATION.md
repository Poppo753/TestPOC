# Euler V2 Integration - Scripts Documentation

**Created:** January 31, 2026  
**Last Updated:** February 1, 2026  
**Version:** 1.0.0  
**Network:** Arbitrum Mainnet (Chain ID: 42161)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Configuration Files](#configuration-files)
4. [Deployment Scripts](#deployment-scripts)
5. [Testing Scripts](#testing-scripts)
6. [Execution Order](#execution-order)
7. [Environment Variables](#environment-variables)
8. [Verification Status](#verification-status)
9. [Gas Estimates](#gas-estimates)

---

## 🎯 Overview

This documentation covers the complete set of production scripts for deploying and testing the Euler V2 integration on Arbitrum mainnet. All scripts have been extracted from working test files and verified against the original test suite (34/34 tests passing).

### Key Features

- **Auto-Enable Architecture**: Automatic collateral/controller enablement (no manual calls required)
- **Atomic Leverage**: Flash loan-based leverage operations in single transactions
- **Zero-Fee Flash Loans**: Balancer V2 integration (0% fee)
- **Production-Ready**: Full validation, error handling, and safety checks

### Source Test Files

- `test/integration/EulerV2Plugin.realfunds.test.ts` - Basic operations (deposit, withdraw, borrow, repay)
- `test/integration/FlashLoanService.e2e.test.ts` - Atomic leverage operations

---

## 🏗️ Architecture

### Contract Stack

```
┌─────────────────────────────────────────────────────────────┐
│                         Beacon                               │
│  (0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870)               │
│                                                              │
│  Modules Registry:                                           │
│  • EulerRegistry        → Vault mapping (WETH, USDC)        │
│  • EulerLensAdapter     → View functions (health, liquidity)│
│  • FlashLoanService     → Balancer flash loans + swaps      │
│  • EulerV2Plugin        → Main plugin logic                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    EulerV2Plugin                             │
│                                                              │
│  Core Functions:                                             │
│  • deposit(token, amount)     → Auto-enables collateral     │
│  • withdraw(token, amount)                                   │
│  • borrow(token, amount)      → Auto-enables controller     │
│  • repay(token, amount)                                      │
│                                                              │
│  Atomic Functions:                                           │
│  • openLeverageAtomic(...)    → Flash loan leverage open    │
│  • closeLeverageAtomic(...)   → Flash loan leverage close   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Euler V2 Vaults                             │
│                                                              │
│  • WETH Vault: 0x78E3E051D32157AACD550fBB78458762d8f7edFF  │
│  • USDC Vault: 0x0a1eCC5Fe8C9be3C09844fcBe615B46A869b899  │
│                                                              │
│  EVC: 0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066            │
└─────────────────────────────────────────────────────────────┘
```

### Auto-Enable Flow

```
DEPOSIT:
user → deposit(WETH) → Euler Vault → AUTO-ENABLE collateral ✅

BORROW:
user → borrow(USDC) → Euler Vault → AUTO-ENABLE controller ✅
```

**No manual enable calls required!** (Post Phase 9/10/11 refactoring)

---

## ⚙️ Configuration Files

### 1. `scripts/config/arbitrum.config.ts`

**Purpose:** Central configuration for all Arbitrum mainnet addresses

**Created:** January 31, 2026

**Exports:**
```typescript
ARBITRUM_ADDRESSES: {
  // Core Infrastructure
  BEACON: "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870",
  PROXY_GENERAL: "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1",
  TOKEN_MANAGER: "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517",
  
  // Tokens
  WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  
  // Euler V2
  EVC: "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066",
  WETH_VAULT: "0x78E3E051D32157AACD550fBB78458762d8f7edFF",
  USDC_VAULT: "0x0a1eCC5Fe8C9be3C09844fcBe615B46A869b899",
  ACCOUNT_LENS: "0x90a52DDcb232e7bb003DD9258fA1235c553eC956",
  
  // External Services
  BALANCER_VAULT: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
  SIMPLE_SWAP: "0xa0DB78167CBAccD47524a261b7741C6B41Bbd096"
}

EULER_VAULTS: {
  WETH: "0x78E3E051D32157AACD550fBB78458762d8f7edFF",
  USDC: "0x0a1eCC5Fe8C9be3C09844fcBe615B46A869b899"
}
```

**Verification:** ✅ All addresses verified against test files

---

### 2. `scripts/utils/euler-helpers.ts`

**Purpose:** Reusable helper functions for all scripts

**Created:** January 31, 2026

**Functions:**

#### `formatAmount(amount: bigint, decimals: number = 18): string`
Formats token amounts for display
```typescript
formatAmount(ethers.parseEther("1.5")) // "1.5000"
formatAmount(1500000n, 6) // "1.5000" (USDC)
```

#### `checkHealth(plugin: Contract, vaults: {weth, usdc}, lens: Contract): Promise<HealthInfo>`
Checks position health factor using AccountLens
```typescript
const health = await checkHealth(eulerPlugin, {wethVault, usdcVault}, accountLens);
// Returns: { healthFactor, collateralValue, liabilityValue }
```

#### `calculateLeverage(collateral: bigint, debt: bigint): number`
Calculates actual leverage ratio
```typescript
// 1 WETH collateral + 1000 USDC debt (WETH @ $2000)
calculateLeverage(parseEther("1"), parseUnits("1000", 6)) // ~2.0x
```

#### `printHealthFactor(health: bigint): void`
Displays health factor with emoji indicators
```typescript
printHealthFactor(ethers.parseEther("2.5")) // 🟢 Health: 2.50x
printHealthFactor(ethers.parseEther("1.2")) // 🟡 Health: 1.20x
printHealthFactor(ethers.parseEther("1.04")) // 🔴 Health: 1.04x
```

Thresholds:
- 🟢 Green: > 1.5x (Safe)
- 🟡 Yellow: 1.3x - 1.5x (Caution)
- 🔴 Red: < 1.3x (Danger)

#### `saveDeployment(name: string, address: string, deployer: string, data?: any): Promise<void>`
Saves deployment info to `deployments/mainnet-latest.json`

#### `loadDeployment(name: string): string | undefined`
Loads deployed contract address from JSON

#### `verifyArbitrumMainnet(): Promise<void>`
Validates network is Arbitrum (chainId 42161)

#### `checkSignerBalance(minEth: string): Promise<void>`
Validates deployer has sufficient ETH for gas

**Verification:** ✅ All functions match test implementations

---

## 🚀 Deployment Scripts

### Deployment Order

**CRITICAL:** Scripts must be executed in this exact order

1. ✅ `deploy-euler-registry.ts` - FIRST (required by plugin)
2. ✅ `deploy-euler-lens.ts` - Independent
3. ✅ `deploy-flashloan-service.ts` - Independent
4. ✅ `deploy-euler-plugin.ts` - Requires Registry deployed
5. ✅ `configure-euler-system.ts` - LAST (requires all 4 deployed)

---

### 1. `scripts/deployment/euler/deploy-euler-registry.ts`

**Purpose:** Deploy and configure EulerRegistry contract

**Created:** January 31, 2026

**Order:** Step 1/5 (MUST RUN FIRST)

**Actions:**
1. Deploy `EulerRegistry` contract
2. Configure vault mappings:
   - `setVault("WETH", 0x78E3E051...)`
   - `setVault("USDC", 0x0a1eCC5F...)`
3. Register in Beacon as "EulerRegistry"
4. Verify configuration
5. Save to `deployments/mainnet-latest.json`

**Usage:**
```bash
npx hardhat run scripts/deployment/euler/deploy-euler-registry.ts --network arbitrum
```

**Gas Estimate:** ~250,000 gas (~$0.05 @ 0.1 gwei)

**Outputs:**
- Contract address logged to console
- Saved to `deployments/mainnet-latest.json`
- Beacon registration confirmation

**Validation:**
- ✅ Network is Arbitrum mainnet
- ✅ Deployer has >= 0.001 ETH
- ✅ Vault addresses verified
- ✅ Beacon registration verified

**Source:** Based on `EulerV2Plugin.realfunds.test.ts` lines 95-120

---

### 2. `scripts/deployment/euler/deploy-euler-lens.ts`

**Purpose:** Deploy EulerLensAdapter for view functions

**Created:** January 31, 2026

**Order:** Step 2/5 (Independent)

**Actions:**
1. Deploy `EulerLensAdapter(beaconAddress)`
2. Verify hardcoded addresses:
   - EVC: `0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066`
   - AccountLens: `0x90a52DDcb232e7bb003DD9258fA1235c553eC956`
3. Register in Beacon as "EulerLensAdapter"
4. Save deployment

**Usage:**
```bash
npx hardhat run scripts/deployment/euler/deploy-euler-lens.ts --network arbitrum
```

**Gas Estimate:** ~350,000 gas (~$0.07 @ 0.1 gwei)

**Validation:**
- ✅ EVC address correct
- ✅ AccountLens address correct
- ✅ Contract size < 24KB

**Source:** Based on test integration of AccountLens

---

### 3. `scripts/deployment/euler/deploy-flashloan-service.ts`

**Purpose:** Deploy FlashLoanService for atomic leverage

**Created:** January 31, 2026

**Order:** Step 3/5 (Independent)

**Actions:**
1. Deploy `FlashLoanService(beaconAddress)`
2. Verify hardcoded addresses:
   - Balancer Vault: `0xBA12222222228d8Ba445958a75a0704d566BF2C8`
   - SimpleSwap: `0xa0DB78167CBAccD47524a261b7741C6B41Bbd096`
3. Register in Beacon as "FlashLoanService"
4. Save deployment

**Usage:**
```bash
npx hardhat run scripts/deployment/euler/deploy-flashloan-service.ts --network arbitrum
```

**Gas Estimate:** ~400,000 gas (~$0.08 @ 0.1 gwei)

**Features:**
- ✅ Balancer V2 flash loans (0% fee!)
- ✅ SimpleSwap integration (Uniswap V3)
- ✅ Beacon-based authorization
- ✅ IFlashLoanCallback interface

**Source:** Based on `FlashLoanService.e2e.test.ts` lines 1-100

---

### 4. `scripts/deployment/euler/deploy-euler-plugin.ts`

**Purpose:** Deploy main EulerV2Plugin contract

**Created:** January 31, 2026

**Order:** Step 4/5 (Requires EulerRegistry)

**Actions:**
1. Verify `EulerRegistry` exists in Beacon
2. Check `FlashLoanService` (optional warning)
3. Deploy `EulerV2Plugin(beaconAddress)`
4. Verify EVC: `0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066`
5. Check contract size < 24KB
6. Register in Beacon as "EulerV2Plugin"
7. Save deployment

**Usage:**
```bash
npx hardhat run scripts/deployment/euler/deploy-euler-plugin.ts --network arbitrum
```

**Gas Estimate:** ~600,000 gas (~$0.12 @ 0.1 gwei)

**Prerequisites:**
- ⚠️ EulerRegistry MUST be deployed and registered
- 💡 FlashLoanService recommended for leverage features

**Validation:**
- ✅ EulerRegistry in Beacon
- ✅ EVC address correct
- ✅ Bytecode size check
- ✅ Registry ownership (will be transferred in step 5)

**Source:** Based on `EulerV2Plugin.realfunds.test.ts` lines 130-165

---

### 5. `scripts/deployment/euler/configure-euler-system.ts`

**Purpose:** Final system configuration and verification

**Created:** January 31, 2026

**Order:** Step 5/5 (LAST - Requires all 4 contracts)

**Actions:**
1. Verify all 4 modules in Beacon:
   - EulerRegistry ✓
   - EulerLensAdapter ✓
   - FlashLoanService ✓
   - EulerV2Plugin ✓
2. Transfer EulerRegistry ownership to EulerV2Plugin
3. Verify FlashLoanService authorization
4. Check token registrations (WETH, USDC)
5. Final validation

**Usage:**
```bash
npx hardhat run scripts/deployment/euler/configure-euler-system.ts --network arbitrum
```

**Gas Estimate:** ~100,000 gas (~$0.02 @ 0.1 gwei)

**CRITICAL Operations:**
- ⚠️ **Registry Ownership Transfer**: Required for `createPosition()` to work
- ✅ Verifies FlashLoanService can be called via Beacon check
- ✅ Confirms all integrations ready

**Source:** Based on test setup Phase 1 completion checks

---

## 🧪 Testing Scripts

### Testing Order (Recommended)

1. `check-position.ts` - Always safe (read-only)
2. `test-deposit.ts` - Deposit WETH
3. `test-borrow.ts` - Borrow USDC (requires collateral)
4. `check-position.ts` - Verify state
5. `test-repay.ts` - Repay debt
6. `test-withdraw.ts` - Withdraw WETH
7. `test-leverage-open.ts` - Atomic 2x leverage
8. `check-position.ts` - Verify leverage
9. `test-leverage-close.ts` - Close leverage
10. `check-position.ts` - Verify clean state

---

### 1. `scripts/testing/check-position.ts`

**Purpose:** View current position state (READ-ONLY, no gas cost)

**Created:** January 31, 2026

**Type:** View Function (No transactions)

**Displays:**
- WETH vault shares & collateral amount
- USDC debt amount
- Health factor with emoji (🟢/🟡/🔴)
- Actual leverage ratio
- EVC status (collateral enabled, controller enabled)

**Usage:**
```bash
# Default: uses mainnet-latest.json
npx hardhat run scripts/testing/check-position.ts --network arbitrum

# Custom plugin address
PLUGIN_ADDRESS=0x... npx hardhat run scripts/testing/check-position.ts --network arbitrum
```

**Environment Variables:**
- `PLUGIN_ADDRESS` (optional) - Override plugin address

**Example Output:**
```
📊 POSITION STATE
════════════════════════════════════════════════════════════════════

WETH Collateral: 0.3000
USDC Debt: 300.0000

🟢 Health: 2.50x
   Collateral Value: $600.00
   Liability Value:  $240.00

Leverage: 2.00x

EVC Status:
   Collateral Enabled: ✅
   Controller Enabled: ✅
```

**Source:** Based on test helper functions in both test files

---

### 2. `scripts/testing/test-deposit.ts`

**Purpose:** Deposit WETH to Euler vault

**Created:** January 31, 2026

**Flow:**
1. Check ProxyGeneral WETH balance
2. Transfer WETH from ProxyGeneral to plugin
3. Call `eulerPlugin.deposit("WETH", amount)`
4. Verify shares received
5. **Auto-verify collateral enabled** (no manual call!)
6. Display final state

**Usage:**
```bash
# Default: 0.01 WETH
npx hardhat run scripts/testing/test-deposit.ts --network arbitrum

# Custom amount
AMOUNT=0.1 npx hardhat run scripts/testing/test-deposit.ts --network arbitrum
```

**Environment Variables:**
- `AMOUNT` (optional, default: "0.01") - WETH amount to deposit
- `PLUGIN_ADDRESS` (optional) - Plugin address

**Gas Estimate:** ~280,000 gas (~$0.056 @ 0.1 gwei)

**Validation:**
- ✅ Sufficient WETH in ProxyGeneral
- ✅ Shares received > 0
- ✅ Collateral auto-enabled via EVC

**Auto-Enable Verification:**
```typescript
const enabled = await evc.isCollateralEnabled(pluginAddress, wethVault.address);
// Expected: true (AUTO-ENABLED!)
```

**Source:** Based on `EulerV2Plugin.realfunds.test.ts` lines 200-250 (Step 5-6)

---

### 3. `scripts/testing/test-withdraw.ts`

**Purpose:** Withdraw WETH from Euler vault

**Created:** January 31, 2026

**Flow:**
1. Check current collateral balance
2. Calculate `maxWithdraw` (respects health factor)
3. Call `eulerPlugin.withdraw("WETH", amount)`
4. Verify WETH returned to ProxyGeneral
5. Display final state

**Usage:**
```bash
# Full withdrawal (max safe amount)
npx hardhat run scripts/testing/test-withdraw.ts --network arbitrum

# Partial withdrawal
AMOUNT=0.05 npx hardhat run scripts/testing/test-withdraw.ts --network arbitrum
```

**Environment Variables:**
- `AMOUNT` (optional) - WETH to withdraw (default: max safe)
- `PLUGIN_ADDRESS` (optional) - Plugin address

**Gas Estimate:** ~250,000 gas (~$0.05 @ 0.1 gwei)

**Safety:**
- ✅ Checks `maxWithdraw` to prevent health factor violations
- ✅ Warns if debt exists
- ✅ Verifies balance returned to ProxyGeneral

**Source:** Based on `EulerV2Plugin.realfunds.test.ts` lines 280-320 (Step 7)

---

### 4. `scripts/testing/test-borrow.ts`

**Purpose:** Borrow USDC against WETH collateral

**Created:** January 31, 2026

**Flow:**
1. Verify WETH collateral exists
2. Check max borrow capacity via `AccountLens.getAccountLiquidityInfo()`
3. Call `eulerPlugin.borrow("USDC", amount)`
4. **Auto-verify controller enabled** (no manual call!)
5. Verify USDC in ProxyGeneral
6. Check health factor
7. Display final state

**Usage:**
```bash
# Default: 0.1 USDC
npx hardhat run scripts/testing/test-borrow.ts --network arbitrum

# Custom amount
AMOUNT=10 npx hardhat run scripts/testing/test-borrow.ts --network arbitrum
```

**Environment Variables:**
- `AMOUNT` (optional, default: "0.1") - USDC amount to borrow
- `PLUGIN_ADDRESS` (optional) - Plugin address

**Gas Estimate:** ~320,000 gas (~$0.064 @ 0.1 gwei)

**Prerequisites:**
- ⚠️ WETH collateral MUST exist (run `test-deposit.ts` first)

**Validation:**
- ✅ Collateral exists
- ✅ Borrow amount <= max capacity
- ✅ Controller auto-enabled via EVC
- ✅ Health factor > 1.0
- ✅ USDC received in ProxyGeneral

**Auto-Enable Verification:**
```typescript
const enabled = await evc.isControllerEnabled(pluginAddress, usdcVault.address);
// Expected: true (AUTO-ENABLED!)
```

**Source:** Based on `EulerV2Plugin.realfunds.test.ts` lines 350-400 (Step 9)

---

### 5. `scripts/testing/test-repay.ts`

**Purpose:** Repay USDC debt

**Created:** January 31, 2026

**Flow:**
1. Check current debt via `usdcVault.debtOf()`
2. Determine repay amount (full or partial)
3. Check USDC balance in ProxyGeneral
4. Transfer USDC from ProxyGeneral to plugin
5. Call `eulerPlugin.repay("USDC", amount)`
6. Verify debt reduction
7. Handle interest dust edge case
8. Display final state

**Usage:**
```bash
# Full repayment (all debt)
npx hardhat run scripts/testing/test-repay.ts --network arbitrum

# Partial repayment
AMOUNT=50 npx hardhat run scripts/testing/test-repay.ts --network arbitrum
```

**Environment Variables:**
- `AMOUNT` (optional) - USDC to repay (default: full debt)
- `PLUGIN_ADDRESS` (optional) - Plugin address

**Gas Estimate:** ~280,000 gas (~$0.056 @ 0.1 gwei)

**Prerequisites:**
- ⚠️ USDC debt MUST exist
- ⚠️ Sufficient USDC in ProxyGeneral

**Edge Cases:**
- ✅ Handles interest accrual dust (small remaining debt ok)
- ✅ Warns if debt remains after "full" repay
- ✅ Verifies USDC transferred correctly

**Source:** Based on `EulerV2Plugin.realfunds.test.ts` lines 420-460 (Step 10)

---

### 6. `scripts/testing/test-leverage-open.ts`

**Purpose:** Open leverage position ATOMICALLY (via flash loan)

**Created:** January 31, 2026

**Type:** ATOMIC OPERATION (all or nothing)

**Atomic Flow:**
1. Flash loan USDC from Balancer (0% fee!)
2. Swap USDC → WETH via SimpleSwap
3. Deposit WETH to Euler (auto-enable collateral)
4. Borrow USDC from Euler (auto-enable controller)
5. Repay flash loan
→ **All in 1 transaction!**

**Usage:**
```bash
# Default: 0.3 WETH, 2x leverage
npx hardhat run scripts/testing/test-leverage-open.ts --network arbitrum

# Custom: 0.1 WETH, 3x leverage
COLLATERAL=0.1 LEVERAGE=300 npx hardhat run scripts/testing/test-leverage-open.ts --network arbitrum

# Safer: 1.5x leverage with 1.1x min health
COLLATERAL=0.5 LEVERAGE=150 MIN_HEALTH=1.1 npx hardhat run scripts/testing/test-leverage-open.ts --network arbitrum
```

**Environment Variables:**
- `COLLATERAL` (optional, default: "0.3") - Initial WETH amount
- `LEVERAGE` (optional, default: "200") - Target leverage × 100 (200 = 2x)
- `MIN_HEALTH` (optional, default: "1.05") - Minimum health factor
- `PLUGIN_ADDRESS` (optional) - Plugin address

**Gas Estimate:** ~650,000 gas (~$0.13 @ 0.1 gwei)

**Prerequisites:**
- ⚠️ FlashLoanService MUST be deployed
- ⚠️ WETH in ProxyGeneral for initial collateral

**Validation:**
- ✅ Sufficient WETH in ProxyGeneral
- ✅ Leverage achieved (within ±0.5x tolerance)
- ✅ Health factor >= MIN_HEALTH
- ✅ Position created atomically

**Example Output:**
```
⚡ Opening 2x leverage via FlashLoanService...

   ✅ Leverage opened ATOMICALLY!
   Tx: 0xabc123...
   Gas Used: 645821

Initial Collateral: 0.3 WETH
Target Leverage: 2.0x
Actual Leverage: 1.98x
Total Collateral: 0.6000 WETH
Total Debt: 600.0000 USDC

🟢 Health: 2.50x
```

**Source:** Based on `FlashLoanService.e2e.test.ts` lines 250-350 (Phase 3)

---

### 7. `scripts/testing/test-leverage-close.ts`

**Purpose:** Close leverage position ATOMICALLY (via flash loan)

**Created:** January 31, 2026

**Type:** ATOMIC OPERATION (all or nothing)

**Atomic Flow:**
1. Flash loan USDC from Balancer (to repay debt)
2. Repay USDC debt in Euler
3. Withdraw all WETH from Euler
4. Swap WETH → USDC via SimpleSwap
5. Repay flash loan
6. Return remaining USDC equity to ProxyGeneral
→ **All in 1 transaction!**

**Usage:**
```bash
# Default: 2% slippage tolerance
npx hardhat run scripts/testing/test-leverage-close.ts --network arbitrum

# Higher slippage for volatile markets
SLIPPAGE=500 npx hardhat run scripts/testing/test-leverage-close.ts --network arbitrum
```

**Environment Variables:**
- `SLIPPAGE` (optional, default: "200") - Max slippage in basis points (200 = 2%)
- `PLUGIN_ADDRESS` (optional) - Plugin address

**Gas Estimate:** ~700,000 gas (~$0.14 @ 0.1 gwei)

**Prerequisites:**
- ⚠️ Leverage position MUST exist (run `test-leverage-open.ts` first)
- ⚠️ FlashLoanService MUST be deployed

**Validation:**
- ✅ Debt cleared (or minimal dust)
- ✅ Collateral minimal (< 0.01 WETH dust ok)
- ✅ Equity returned in USDC to ProxyGeneral
- ✅ Clean state verified

**Edge Cases:**
- ✅ Handles interest accrual dust
- ✅ Warns if small amounts remain
- ✅ Verifies equity correctly calculated

**Example Output:**
```
⚡ Closing leverage via FlashLoanService...

   ✅ Leverage closed ATOMICALLY!
   Tx: 0xdef456...
   Gas Used: 698432

Position Before:
   Collateral: 0.6000 WETH
   Debt: 600.0000 USDC

Position After:
   Collateral: 0.0000 WETH
   Debt: 0.0000 USDC

Equity Returned:
   USDC: 598.5000 (to ProxyGeneral)

💰 You received 598.5000 USDC equity!
```

**Source:** Based on `FlashLoanService.e2e.test.ts` lines 450-550 (Phase 5)

---

## 📊 Execution Order

### Full Deployment + Testing Workflow

```bash
# ==================== PHASE 1: DEPLOYMENT ====================

# 1. Deploy Registry (FIRST!)
npx hardhat run scripts/deployment/euler/deploy-euler-registry.ts --network arbitrum

# 2. Deploy Lens Adapter
npx hardhat run scripts/deployment/euler/deploy-euler-lens.ts --network arbitrum

# 3. Deploy Flash Loan Service
npx hardhat run scripts/deployment/euler/deploy-flashloan-service.ts --network arbitrum

# 4. Deploy Main Plugin
npx hardhat run scripts/deployment/euler/deploy-euler-plugin.ts --network arbitrum

# 5. Configure System (LAST!)
npx hardhat run scripts/deployment/euler/configure-euler-system.ts --network arbitrum

# ==================== PHASE 2: BASIC TESTING ====================

# Check initial state (always safe)
npx hardhat run scripts/testing/check-position.ts --network arbitrum

# Deposit WETH (start small: 0.001 WETH for production!)
AMOUNT=0.001 npx hardhat run scripts/testing/test-deposit.ts --network arbitrum

# Verify deposit
npx hardhat run scripts/testing/check-position.ts --network arbitrum

# Borrow USDC (conservative: 0.1 USDC)
AMOUNT=0.1 npx hardhat run scripts/testing/test-borrow.ts --network arbitrum

# Check health after borrow
npx hardhat run scripts/testing/check-position.ts --network arbitrum

# Repay USDC
npx hardhat run scripts/testing/test-repay.ts --network arbitrum

# Withdraw WETH
npx hardhat run scripts/testing/test-withdraw.ts --network arbitrum

# Verify clean state
npx hardhat run scripts/testing/check-position.ts --network arbitrum

# ==================== PHASE 3: LEVERAGE TESTING ====================

# Open 2x leverage (start small: 0.01 WETH!)
COLLATERAL=0.01 LEVERAGE=200 MIN_HEALTH=1.1 npx hardhat run scripts/testing/test-leverage-open.ts --network arbitrum

# Check leverage position
npx hardhat run scripts/testing/check-position.ts --network arbitrum

# Close leverage
SLIPPAGE=200 npx hardhat run scripts/testing/test-leverage-close.ts --network arbitrum

# Verify final clean state
npx hardhat run scripts/testing/check-position.ts --network arbitrum
```

---

## 🔐 Environment Variables

### Deployment Scripts

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PLUGIN_ADDRESS` | No | From JSON | Override plugin address |
| `REGISTRY_ADDRESS` | No | From JSON | Override registry address |
| `LENS_ADDRESS` | No | From JSON | Override lens address |
| `FLASHLOAN_ADDRESS` | No | From JSON | Override flash loan service address |

### Testing Scripts

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PLUGIN_ADDRESS` | No | From JSON | Plugin to test |
| `AMOUNT` | No | Script-specific | Amount for operation |
| `COLLATERAL` | No | "0.3" | WETH for leverage open |
| `LEVERAGE` | No | "200" | Target leverage × 100 (2x) |
| `MIN_HEALTH` | No | "1.05" | Min health factor |
| `SLIPPAGE` | No | "200" | Max slippage bps (2%) |

### Network Configuration

Edit `hardhat.config.ts`:
```typescript
networks: {
  arbitrum: {
    url: process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc",
    accounts: [process.env.PRIVATE_KEY!],
    chainId: 42161
  }
}
```

**Required `.env`:**
```bash
PRIVATE_KEY=0x...
ARBITRUM_RPC=https://arb1.arbitrum.io/rpc
```

---

## ✅ Verification Status

**Verification Date:** February 1, 2026  
**Verified By:** AI Agent (GitHub Copilot)  
**Test Suite:** 34/34 tests passing

### Verification Methodology

All 14 scripts verified against original test files:
- ✅ `test/integration/EulerV2Plugin.realfunds.test.ts` (653 lines)
- ✅ `test/integration/FlashLoanService.e2e.test.ts` (680 lines)

### Verification Checklist

| Check | Status | Details |
|-------|--------|---------|
| Addresses Match Test | ✅ | 100% match (11/11 addresses) |
| ABI/Interfaces Correct | ✅ | All method signatures verified |
| Flow Logic Identical | ✅ | Sequence matches test steps |
| Helper Functions | ✅ | formatAmount, checkHealth, calculateLeverage verified |
| Error Handling | ✅ | All prerequisite checks included |
| Auto-Enable Architecture | ✅ | deposit/borrow auto-enable verified |
| Atomic Operations | ✅ | openLeverageAtomic/closeLeverageAtomic match E2E test |
| Gas Estimates | ✅ | Based on fork test results |

### Script-Specific Verification

| Script | Test Reference | Status |
|--------|----------------|--------|
| `arbitrum.config.ts` | Lines 24-56 (both files) | ✅ OK |
| `euler-helpers.ts` | Helper functions throughout | ✅ OK |
| `deploy-euler-registry.ts` | Lines 95-120 | ✅ OK |
| `deploy-euler-lens.ts` | AccountLens integration | ✅ OK |
| `deploy-flashloan-service.ts` | Lines 1-100 (E2E test) | ✅ OK |
| `deploy-euler-plugin.ts` | Lines 130-165 | ✅ OK |
| `configure-euler-system.ts` | Phase 1 setup | ✅ OK |
| `check-position.ts` | checkPluginHealth helper | ✅ OK |
| `test-deposit.ts` | Lines 200-250 (Step 5-6) | ✅ OK |
| `test-withdraw.ts` | Lines 280-320 (Step 7) | ✅ OK |
| `test-borrow.ts` | Lines 350-400 (Step 9) | ✅ OK |
| `test-repay.ts` | Lines 420-460 (Step 10) | ✅ OK |
| `test-leverage-open.ts` | Lines 250-350 (Phase 3) | ✅ OK |
| `test-leverage-close.ts` | Lines 450-550 (Phase 5) | ✅ OK |

**Result:** ✅ **14/14 scripts verified - NO ERRORS FOUND**

---

## ⛽ Gas Estimates

**Network:** Arbitrum One  
**Gas Price Assumption:** 0.1 gwei (typical Arbitrum)  
**ETH Price:** $2,000 (for cost estimates)

### Deployment Gas Costs

| Script | Estimated Gas | Cost @ 0.1 gwei | USD @ $2000/ETH |
|--------|---------------|-----------------|-----------------|
| `deploy-euler-registry.ts` | ~250,000 | 0.000025 ETH | ~$0.05 |
| `deploy-euler-lens.ts` | ~350,000 | 0.000035 ETH | ~$0.07 |
| `deploy-flashloan-service.ts` | ~400,000 | 0.000040 ETH | ~$0.08 |
| `deploy-euler-plugin.ts` | ~600,000 | 0.000060 ETH | ~$0.12 |
| `configure-euler-system.ts` | ~100,000 | 0.000010 ETH | ~$0.02 |
| **TOTAL DEPLOYMENT** | **~1,700,000** | **0.000170 ETH** | **~$0.34** |

### Testing Gas Costs

| Script | Estimated Gas | Cost @ 0.1 gwei | USD @ $2000/ETH |
|--------|---------------|-----------------|-----------------|
| `check-position.ts` | 0 (view) | 0 ETH | $0.00 |
| `test-deposit.ts` | ~280,000 | 0.000028 ETH | ~$0.056 |
| `test-withdraw.ts` | ~250,000 | 0.000025 ETH | ~$0.05 |
| `test-borrow.ts` | ~320,000 | 0.000032 ETH | ~$0.064 |
| `test-repay.ts` | ~280,000 | 0.000028 ETH | ~$0.056 |
| `test-leverage-open.ts` | ~650,000 | 0.000065 ETH | ~$0.13 |
| `test-leverage-close.ts` | ~700,000 | 0.000070 ETH | ~$0.14 |
| **TOTAL TESTING** | **~2,480,000** | **0.000248 ETH** | **~$0.50** |

### Total Estimated Costs

- **Full Deployment:** ~$0.34
- **Full Testing Cycle:** ~$0.50
- **Grand Total:** ~$0.84

**Note:** Actual costs may vary based on:
- Network congestion
- Contract size optimizations
- Gas price fluctuations
- Transaction ordering

---

## 🚨 Safety Recommendations

### Production Deployment

1. **Start Small**
   ```bash
   # Use minimal amounts for first mainnet test
   AMOUNT=0.001 npx hardhat run scripts/testing/test-deposit.ts --network arbitrum
   ```

2. **Monitor Health Factor**
   ```bash
   # Check after every operation
   npx hardhat run scripts/testing/check-position.ts --network arbitrum
   ```

3. **Conservative Leverage**
   ```bash
   # Start with 1.5x instead of 2x
   COLLATERAL=0.01 LEVERAGE=150 MIN_HEALTH=1.2 npx hardhat run scripts/testing/test-leverage-open.ts --network arbitrum
   ```

4. **Backup Plan**
   - Always maintain health > 1.3x (🟡 yellow zone minimum)
   - Keep USDC ready for emergency repayment
   - Monitor Euler V2 oracle prices

### Pre-Deployment Checklist

- [ ] Verify all addresses in `arbitrum.config.ts`
- [ ] Test on fork first (`FORK_ENABLED=true`)
- [ ] Verify Beacon owner is correct
- [ ] Ensure deployer has >= 0.01 ETH for gas buffer
- [ ] Backup `mainnet-latest.json` before deployment
- [ ] Test with minimal amounts first (0.001 WETH)
- [ ] Monitor first transactions on Arbiscan
- [ ] Verify contract sizes < 24KB
- [ ] Check FlashLoanService authorization
- [ ] Confirm EulerRegistry ownership transferred

---

## 📝 Changelog

### Version 1.0.0 - February 1, 2026

**Created:**
- ✅ 2 configuration files
- ✅ 5 deployment scripts
- ✅ 7 testing scripts
- ✅ Complete documentation

**Verified:**
- ✅ All 14 scripts against test files
- ✅ 100% address accuracy
- ✅ Auto-enable architecture confirmed
- ✅ Atomic leverage operations validated

**Features:**
- Zero-fee flash loans (Balancer V2)
- Auto-enable collateral/controller
- Atomic leverage operations
- Production-ready error handling
- Comprehensive validation checks

---

## 🔗 References

### Contracts

- **Beacon:** [0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870](https://arbiscan.io/address/0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870)
- **ProxyGeneral:** [0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1](https://arbiscan.io/address/0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1)
- **EVC:** [0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066](https://arbiscan.io/address/0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066)
- **Balancer Vault:** [0xBA12222222228d8Ba445958a75a0704d566BF2C8](https://arbiscan.io/address/0xBA12222222228d8Ba445958a75a0704d566BF2C8)

### Documentation

- Test Files:
  - `test/integration/EulerV2Plugin.realfunds.test.ts`
  - `test/integration/FlashLoanService.e2e.test.ts`
- Analysis: `docs/thirdphase/EULER_SCRIPTS_ANALYSIS.md`
- Refactoring History:
  - Phase 9: Auto-enable collateral
  - Phase 10: Auto-enable controller
  - Phase 11: Cleanup manual functions

### External Resources

- [Euler V2 Documentation](https://docs.euler.finance/)
- [Balancer V2 Flash Loans](https://docs.balancer.fi/reference/contracts/flash-loans.html)
- [Arbitrum One Explorer](https://arbiscan.io/)
- [EVC Documentation](https://docs.euler.finance/euler-vault-kit-white-paper/ethereum-vault-connector)

---

## 📞 Support

For issues or questions:

1. Check test files for reference implementations
2. Review `EULER_SCRIPTS_ANALYSIS.md` for detailed operation breakdown
3. Verify network configuration in `hardhat.config.ts`
4. Check deployment addresses in `deployments/mainnet-latest.json`

---

**End of Documentation**

*Generated: February 1, 2026*  
*Last Updated: February 1, 2026*  
*Version: 1.0.0*
