# Test Coverage Gap Analysis

**Date**: April 2026  
**Project**: TestSmartContract (DeFi / Arbitrum)

---

## 1. Complete Contract Inventory

### Real Contracts (Core)
| # | Contract | Path |
|---|----------|------|
| 1 | Beacon | contracts/Beacon.sol |
| 2 | DepositHelper | contracts/DepositHelper.sol |
| 3 | EmergencyHandler | contracts/EmergencyHandler.sol |
| 4 | LiquidityManager | contracts/Liquiditymanager.sol |
| 5 | ParameterManager | contracts/ParameterManager.sol |
| 6 | ProtocolManager | contracts/ProtocolManager.sol |
| 7 | ProxyGeneral | contracts/ProxyGeneral.sol |
| 8 | SwapManager | contracts/SwapManager.sol |
| 9 | TokenManager | contracts/TokenManager.sol |
| 10 | ValueCalculator | contracts/ValueCalculator.sol |

### Plugins
| # | Contract | Path |
|---|----------|------|
| 11 | AaveV3Plugin | contracts/plugins/AaveV3Plugin.sol |
| 12 | AaveV3Registry | contracts/plugins/AaveV3Registry.sol |
| 13 | DolomitePlugin | contracts/plugins/DolomitePlugin.sol |
| 14 | EulerV2Plugin | contracts/plugins/EulerV2Plugin.sol |
| 15 | EulerRegistry | contracts/plugins/EulerRegistry.sol |
| 16 | MorphoPlugin | contracts/plugins/MorphoPlugin.sol |
| 17 | MorphoRegistry | contracts/plugins/MorphoRegistry.sol |
| 18 | MorphoVaultPlugin | contracts/plugins/MorphoVaultPlugin.sol |
| 19 | UniswapV3Plugin | contracts/plugins/UniswapV3Plugin.sol |
| 20 | UniswapV3PluginDirect | contracts/plugins/UniswapV3PluginDirect.sol |

### Services
| # | Contract | Path |
|---|----------|------|
| 21 | FlashLoanService | contracts/services/FlashLoanService.sol |

### Adapters
| # | Contract | Path |
|---|----------|------|
| 22 | ChainlinkAdapter | contracts/adapters/ChainlinkAdapter.sol |
| 23 | EulerLensAdapter | contracts/adapters/EulerLensAdapter.sol |
| 24 | AaveV3LensAdapter | contracts/adapters/AaveV3LensAdapter.sol |
| 25 | MorphoLensAdapter | contracts/adapters/MorphoLensAdapter.sol |
| 26 | MorphoVaultLensAdapter | contracts/adapters/MorphoVaultLensAdapter.sol |

### Mocks (NOT tested directly — test helpers only)
- MockBeacon, MockChainlinkAggregator, MockChainlinkOracle, MockDepositHelper, MockERC20, MockFlashLoanService, MockLiquidityManager, MockMorpho, MockOracleAdapter, MockProxyGeneral, MockSimpleSwap, MockTokenManager, MockWETH

### Interfaces (NOT tested — ABIs only)
- All files under `contracts/interfaces/` (30+ interfaces)

---

## 2. Per-Contract Coverage Matrix

### Legend
- ✅ = Yes, dedicated test file exists  
- ⚠️ = Partial (only "simple" or subset tests)  
- ❌ = No dedicated test  
- 🔀 = Fork test (requires mainnet fork)

| Contract | Unit Test | Integration Test | Fork/E2E Test | Notes |
|----------|-----------|-----------------|---------------|-------|
| **Beacon** | ✅ `Beacon.test.ts` | ✅ `BeaconModules.integration.test.ts` | ❌ | Good coverage |
| **DepositHelper** | ❌ **NONE** | ❌ **NONE** | ❌ | **CRITICAL GAP** — Only used indirectly via MockDepositHelper in LiquidityManager.test.ts |
| **EmergencyHandler** | ✅ `EmergencyHandler.test.ts` + `EmergencyHandler.simple.test.ts` | ✅ `Emergency.integration.test.ts` | ❌ | Well covered |
| **LiquidityManager** | ✅ `LiquidityManager.test.ts` + `LiquidityManager.simple.test.ts` | ✅ `LF-001` through `LF-005`, `LiquidityFlow`, `Deposit`, `Withdraw` | ✅ `e2e-deposit-withdraw.fork.test.ts` | Extensively covered |
| **ParameterManager** | ✅ `ParameterManager.test.ts` | ✅ `PG-001` through `PG-005` | ❌ | Well covered |
| **ProtocolManager** | ✅ `ProtocolManager.test.ts` | ✅ `ProtocolManager.integration.test.ts`, `ProtocolManager.euler.test.ts` | ❌ | Good |
| **ProxyGeneral** | ⚠️ `ProxyGeneral.simple.test.ts` ONLY | ❌ (only implicitly) | ❌ | **GAP** — No full `ProxyGeneral.test.ts`. See details below. |
| **SwapManager** | ✅ `SwapManager.test.ts` + `Phase1B.test.ts` + `Phase1A-1B.Integration.test.ts` + `simple.test.ts` | ✅ `SF-001` through `SF-005`, `SwapManager.Phase1B.integration.test.ts` | ❌ | Very well covered |
| **TokenManager** | ✅ `TokenManager.test.ts` | ❌ (only implicitly) | ❌ | Unit tests adequate, no dedicated integration |
| **ValueCalculator** | ✅ `ValueCalculator.test.ts` | ❌ (only implicitly via other tests) | ✅ `PoolValueBreakdown.test.ts`, `LPPriceBreakdown.test.ts` | Unit test + e2e views |
| **AaveV3Plugin** | ❌ **NONE** | ✅ `AaveV3Plugin.fork.test.ts`, `AaveV3Plugin.leverage.test.ts` | 🔀 Fork tests only | **No unit test** |
| **AaveV3Registry** | ❌ **NONE** | ❌ (only indirectly) | ❌ | **CRITICAL GAP** |
| **DolomitePlugin** | ✅ `DolomitePlugin.test.ts` | ✅ `DolomitePlugin.fork.test.ts`, `DolomitePlugin.borrow.fork.test.ts` | 🔀 | Good |
| **EulerV2Plugin** | ❌ **NONE** | ✅ Many: `fork`, `batch`, `leverage`, `realfunds`, `phase3`, `closePositions`, `manualLeverage` | 🔀 | No unit test; heavily fork-tested |
| **EulerRegistry** | ❌ **NONE** | ❌ (only indirectly) | ❌ | **CRITICAL GAP** |
| **MorphoPlugin** | ❌ **NONE** | ✅ `MorphoPlugin.fork.test.ts` | 🔀 | No unit test |
| **MorphoRegistry** | ❌ **NONE** | ❌ (only indirectly) | ❌ | **CRITICAL GAP** |
| **MorphoVaultPlugin** | ❌ **NONE** | ✅ `MorphoVaultPlugin.fork.test.ts` | 🔀 | No unit test |
| **UniswapV3Plugin** | ✅ `UniswapV3Plugin.test.ts` | ❌ | ❌ | Unit test only |
| **UniswapV3PluginDirect** | ❌ **NONE** | ❌ | ❌ | **CRITICAL GAP** |
| **FlashLoanService** | ❌ **NONE** | ✅ `FlashLoanService.e2e.test.ts`, `FlashLoanPlugin.e2e.test.ts` | 🔀 | No unit test |
| **ChainlinkAdapter** | ✅ `ChainlinkAdapter.test.ts` | ✅ `OracleAdapter.integration.test.ts` | ✅ `OracleAdapter.e2e.test.ts` | Very well covered |
| **EulerLensAdapter** | ❌ **NONE** | ✅ `EulerLensAdapter.e2e.test.ts` | 🔀 | No unit test |
| **AaveV3LensAdapter** | ❌ **NONE** | ❌ (only indirectly) | ❌ | **CRITICAL GAP** |
| **MorphoLensAdapter** | ❌ **NONE** | ❌ (only indirectly) | ❌ | **CRITICAL GAP** |
| **MorphoVaultLensAdapter** | ❌ **NONE** | ❌ (only indirectly) | ❌ | **CRITICAL GAP** |

---

## 3. Detailed Gap Analysis Per Contract

### 3.1 DepositHelper.sol — ❌ ZERO TESTS

**Functions (1 external):**
- `depositETH() external payable` — Wraps ETH → WETH, deposits via LiquidityManager, transfers LP tokens to caller

**What should be tested:**
- Happy path: deposit ETH, receive LP tokens
- Zero deposit revert (`ZeroDeposit()`)
- WETH wrapping works correctly
- LP tokens arrive at `msg.sender`, not the contract
- `receive()` fallback behavior
- Re-entrancy via receive()

**Current state:** Only `MockDepositHelper` used indirectly in LiquidityManager.test.ts — the **real** DepositHelper has zero test coverage.

---

### 3.2 ProxyGeneral.sol — ⚠️ PARTIAL ("simple" only)

Only `ProxyGeneral.simple.test.ts` exists (59 `it()` blocks). This covers:

**TESTED (✅ by simple.test.ts):**
- `authorizeModule()` / `deauthorizeModule()` / `isAuthorizedModule()`
- `pause()` / `unpause()` / `isPaused()`
- `mint()` / `burn()` — access control + whenNotPaused
- `transferFunds()` — authorized + paused guards
- `approveSpender()` — authorized guard
- `transferToModule()` — authorized guard
- `getAssetBalance()` — correctness
- `setHourlyWithdrawn()` / `getHourlyWithdrawn()` / `incrementHourlyWithdrawn()`
- `setModuleParameter()` / `getModuleParameter()`
- `emergencyTransferAll()` — whenPaused + onlyOwner
- Edge cases: mint/burn atomicity, MAX_UINT256 approval, concurrent module access
- Proxy patterns: delegate calls, state isolation, upgrade scenarios, storage collision, fallback
- Integration patterns: cross-module state, module interaction security, concurrent ops, emergency coordination

**NOT TESTED (❌ missing from simple.test.ts):**
- `transferFromModule()` — no dedicated test (only `transferToModule` tested)
- ERC20 transfer/transferFrom/approve standard behavior
- Token name/symbol/decimals verification beyond basic check
- Receive ETH behavior (if any)
- Reentrancy attack vectors on custody operations
- Gas limits for iteration-heavy operations (many modules)

---

### 3.3 SwapManager Test Overlap Analysis

**SwapManager.test.ts** (full unit test — 21 describe blocks):
- Deployment, admin functions (`setMaxSlippage`, `setSimpleSwapRouter`, `setSwapsEnabled`, `setSwapLimits`)
- `validateSwapParameters()` validation
- View functions: `calculateMinAmountOut`, `getSwapStats`, `getSwapQuote`, `getExpectedSwapOutput`
- **performSwap()** — CRITICAL & HIGH priority (access control, paused, disabled, slippage, events, gas)
- Swap wrappers, admin HIGH tests, security tests, validation HIGH tests

**SwapManager.Phase1B.test.ts** (multi-plugin query):
- `getAllQuotes()` — multi-plugin query, best plugin identification, invalid tokens, same token, zero amount, empty plugins, failing plugins
- `swapWithBestPlugin()` — full swap execution, events, tight deadline warning, all invalid quotes revert, slippage revert, minAmountOut validation, best selection, deadline expired

**SwapManager.Phase1A-1B.Integration.test.ts** (integration of specific + best plugin):
- Swap with specific plugin (performSwap + performSwapAuto)
- Switch activeSwapPlugin and use new plugin
- `SwapPluginChanged` event
- Plugin not registered revert
- `swapWithBestPlugin()` selecting best regardless of activeSwapPlugin
- User choice demonstration: specific vs best price

**Overlap:** Phase1B tests are complementary (multi-plugin queries, not covered in main test). Phase1A-1B is an integration test of both modes together. **Minimal overlap — they're complementary.**

**NOT TESTED across all SwapManager tests:**
- `emergencyTokenRecovery()` — no test
- `canSwap()` (public view) — no dedicated test
- `validateSwapParams()` (public) — no dedicated test  
- `estimateSwapGas()` — no test
- `resetSwapStats()` — no test
- `getTokenBaseAssetPrice()` — no test
- `setDefaultDeadlineWindow()` / `getDefaultDeadlineWindow()` — no test
- `setActiveSwapPlugin()` — only tested in Phase1A-1B, not in main unit test

---

### 3.4 LiquidityManager Test Overlap Analysis

**LiquidityManager.simple.test.ts** (18 describe blocks):
- Deployment & basic functions
- Fee management: `setDepositFee`, `setWithdrawFee`, `setFeeRecipient`
- Deposit/withdraw toggles: `setDepositsEnabled`, `setWithdrawsEnabled`
- Withdrawal limits: `checkWithdrawLimits`, `getRemainingHourlyLimit`, `getRemainingDailyLimit`
- View functions: `calculateDepositShares`, `calculateWithdrawAmount`
- Gas optimization, security tests

**LiquidityManager.test.ts** (29 describe blocks, superset):
- Everything in simple.test.ts PLUS:
- **deposit()** — LP token minting, deposit shares calculation, fee charging, paused/disabled/zero guards, large deposits, CRITICAL execution tests, HIGH additional tests
- **withdraw()** — LP token burning, withdrawal amount calculation, fee deduction, paused/disabled guards, insufficient shares, CRITICAL execution tests, HIGH tests
- **calculateDepositShares / calculateWithdrawAmount** — deeper math tests
- **Withdrawal limits** — `setRateLimit`, deeper limit enforcement, hourly/daily tracking
- **Gas optimization** — per-function gas profiling
- **Security tests** — reentrancy, access control

**Overlap:** `LiquidityManager.simple.test.ts` is a STRICT SUBSET of `LiquidityManager.test.ts`. The simple version tests admin/view functions only. The full version adds all deposit/withdraw execution paths.

**NOT TESTED in either:**
- `withdrawWithDeadline()` — has its own separate test file `Withdraw.deadline.test.ts`, but only unit; also integration `Withdraw.integration.test.ts` and e2e `Withdraw.deadline.fork.test.ts`
- `validatePoolState()` — no dedicated test
- `getPoolStats()` — no dedicated test
- `canWithdraw()` — no dedicated test
- `setRateLimit()` with edge-case parameters (e.g. zero limits)

---

### 3.5 Registry Contracts — ❌ ALL UNTESTED

**EulerRegistry.sol** — 12+ external functions, ZERO dedicated tests:
- `setVault()`, `removeVault()`, `getVault()`, `getVaultSafe()`, `getTokenCode()`
- `isRegistered()`, `getAllRegisteredTokens()`, `getRegisteredCount()`
- `closePositionRecord()`, `getActivePositionCount()`, `isPositionActive()`, `getActivePositionIds()`

**AaveV3Registry.sol** — 12 external functions, ZERO dedicated tests:
- `registerToken()`, `removeToken()`, `setTokenActive()`, `getTokenConfig()`
- `getUnderlying()`, `getAToken()`, `getVariableDebtToken()`, all "Safe" variants

**MorphoRegistry.sol** — 10 external functions, ZERO dedicated tests:
- `configureMarket()`, `removeMarket()`, `configureVault()`, `removeVault()`
- `setVaultStatus()`, `setDefaultVault()`, `isVaultApproved()`, `getVaultConfig()`

---

### 3.6 Lens Adapters — Most UNTESTED

| Adapter | # External Fns | Has Test? |
|---------|----------------|-----------|
| EulerLensAdapter | 18 | ⚠️ e2e only (`EulerLensAdapter.e2e.test.ts`) |
| AaveV3LensAdapter | 15 | ❌ NONE |
| MorphoLensAdapter | 15 | ❌ NONE |
| MorphoVaultLensAdapter | 19 | ❌ NONE |

---

### 3.7 Plugin Unit Test Gaps

**EulerV2Plugin** — 0 unit tests, heavily fork-tested:
- Untested in isolation: `deposit()`, `withdraw()`, `borrow()`, `repay()`, `closePosition()`, `openLeverageAtomic()`, `closeLeverageAtomic()`, `onFlashLoanReceived()`, `addCollateralToPosition()`, `removeCollateralFromPosition()`, `setCircuitBreaker()`, `emergencyWithdrawAll()`, `closePositionsForBaseAsset()`, `activateCircuitBreaker()`

**AaveV3Plugin** — 0 unit tests:
- Same function set as EulerV2Plugin plus `deactivateCircuitBreaker()`, `getBorrowCapacity()`

**MorphoPlugin** — 0 unit tests:
- Extra functions: `supplyCollateral()`, `withdrawCollateral()`, `closeMarketPosition()`, `getDebt(collateral, loan)`, `getCollateral()`, `getHealthFactor(collateral, loan)`

**MorphoVaultPlugin** — 0 unit tests:
- `vaultDeposit()`, `vaultWithdraw()`, `vaultRedeem()`, `getVaultShares()`, `getVaultBalance()`, `getAllVaultPositions()`, `getTotalVaultValue()`

**UniswapV3PluginDirect** — 0 unit tests, 0 integration tests:
- `getProtocolInfo()`, `isHealthy()`, all swap functions inherited from ISwapPlugin

**FlashLoanService** — 0 unit tests:
- `executeFlashLoan()`, `receiveFlashLoan()`, `swap()`, `getExpectedOutput()`, `isAuthorizedPlugin()`

---

### 3.8 Deployment Scripts Test Coverage

**Test exists:** `test/integration/scripts/Phase1.Core.test.ts`  
- Tests: DepositETH, WithdrawETH, SystemStatus, CheckBalance, Cross-Script Integration, Error Handling

**No script tests exist for:**
- Plugin deployment scripts (`deploy-euler-plugin.ts`, `deploy-aave-v3-plugin.ts`, `deploy-morpho-plugin.ts`, `deploy-morpho-vault-plugin.ts`, `deployDolomitePlugin.ts`)
- Beacon update scripts (`UpdateBeacon.ts`, `RedeployValueCalculator.ts`, `RedeployLiquidityManager.ts`)
- GMXv2 plugin setup scripts (`setupGMXv2Plugin.ts`, `deployGMXv2PluginMainnet.ts`, `deployGMXv2PluginTestnet.ts`)
- Verification scripts (`verify-morpho-mainnet.ts`, `verify-aave3-postdeploy.ts`, etc.)
- Utility scripts (`register-new-plugin.ts`, `swap-eth-to-usdc.ts`, `UpdateAddresses.ts`)
- Migration script test exists: `test/integration/MigrationScripts.test.ts`

---

## 4. Critical Coverage Gaps Summary (Priority Ordered)

### 🔴 CRITICAL (No tests at all for production contracts)

1. **DepositHelper.sol** — The only user-facing entry point for ETH deposits. Zero tests. High risk for fund loss.
2. **UniswapV3PluginDirect.sol** — Swap plugin with no tests at any level.
3. **AaveV3Registry.sol** — Configuration contract for Aave positions; misconfiguration = fund lock.
4. **EulerRegistry.sol** — Configuration contract for Euler vaults; misconfiguration = fund lock.
5. **MorphoRegistry.sol** — Configuration contract for Morpho markets; misconfiguration = fund lock.
6. **AaveV3LensAdapter.sol** — 15 view functions, zero tests. Incorrect values = bad decisions.
7. **MorphoLensAdapter.sol** — 15 view functions, zero tests.
8. **MorphoVaultLensAdapter.sol** — 19 view functions, zero tests.

### 🟡 HIGH (No unit tests, fork tests only)

9. **EulerV2Plugin.sol** — Core lending plugin, heavily fork-tested but no isolated unit test. If fork breaks, all test coverage vanishes.
10. **AaveV3Plugin.sol** — Same issue as EulerV2Plugin.
11. **MorphoPlugin.sol** — Same issue.
12. **MorphoVaultPlugin.sol** — Same issue.
13. **FlashLoanService.sol** — Core infrastructure for leverage, only e2e tests.
14. **EulerLensAdapter.sol** — Only e2e test, no unit test.

### 🟠 MEDIUM (Partial coverage)

15. **ProxyGeneral.sol** — Has "simple" test (comprehensive at 59 tests) but missing `transferFromModule()` and some edge cases. No full `ProxyGeneral.test.ts`.
16. **TokenManager.sol** — Good unit test but no dedicated integration test.
17. **ValueCalculator.sol** — Good unit test but missing dedicated integration test for cross-module interaction.

---

## 5. Untested Function Signatures by Contract

### DepositHelper.sol
```solidity
function depositETH() external payable returns (uint256 lpTokens)  // ❌ UNTESTED
receive() external payable  // ❌ UNTESTED
```

### ProxyGeneral.sol (missing from simple.test.ts)
```solidity
function transferFromModule(address token, address module, uint256 amount) external onlyAuthorizedModule  // ❌ No dedicated test
```

### SwapManager.sol
```solidity
function emergencyTokenRecovery(...) external onlyOwner  // ❌ UNTESTED
function canSwap(...) external view  // ❌ UNTESTED
function validateSwapParams(...) external view  // ❌ UNTESTED
function estimateSwapGas(...) external view  // ❌ UNTESTED
function resetSwapStats(...) external onlyOwner  // ❌ UNTESTED
function getTokenBaseAssetPrice(string memory tokenCode) external view  // ❌ UNTESTED
function setDefaultDeadlineWindow(uint256) external onlyOwner  // ❌ UNTESTED
function getDefaultDeadlineWindow() external view  // ❌ UNTESTED
```

### LiquidityManager.sol
```solidity
function validatePoolState() external view  // ❌ UNTESTED
function getPoolStats() external view  // ❌ UNTESTED
function canWithdraw(address user, uint256 shares) external view  // ❌ UNTESTED
```

### EulerRegistry.sol (ALL untested)
```solidity
function closePositionRecord(uint256 positionId) external onlyOwner
function setVault(string memory tokenCode, address vault) external onlyOwner
function removeVault(string memory tokenCode) external onlyOwner
function getVault(string memory tokenCode) external view
function getVaultSafe(string memory tokenCode) external view
function getTokenCode(address vault) external view
function isRegistered(string memory tokenCode) external view
function getAllRegisteredTokens() external view
function getRegisteredCount() external view
function getActivePositionCount() external view
function isPositionActive(uint256 positionId) external view
function getActivePositionIds() external view
```

### AaveV3Registry.sol (ALL untested)
```solidity
function registerToken(...) external onlyOwner          // inherited, exact signature varies
function removeToken(string memory tokenCode) external onlyOwner
function setTokenActive(string memory tokenCode, bool active) external onlyOwner
function getTokenConfig(string memory tokenCode) external view
function getUnderlying(string memory tokenCode) external view
function getAToken(string memory tokenCode) external view
function getVariableDebtToken(string memory tokenCode) external view
function isTokenConfigured(string memory tokenCode) external view
function getRegisteredTokens() external view
function getRegisteredTokenCount() external view
function getUnderlyingSafe(string memory tokenCode) external view
function getATokenSafe(string memory tokenCode) external view
function getVariableDebtTokenSafe(string memory tokenCode) external view
```

### MorphoRegistry.sol (ALL untested)
```solidity
function configureVault(address vault, string memory assetCode) external onlyOwner
function removeVault(address vault) external onlyOwner
function setVaultStatus(address vault, bool isActive) external onlyOwner
function setDefaultVault(string memory assetCode, address vault) external onlyOwner
function isVaultApproved(address vault) external view
function getVaultConfig(address vault) external view
function getDefaultVault(string memory assetCode) external view
function getRegisteredVaults() external view
function getRegisteredVaultCount() external view
function getRegisteredMarketCount() external view
```

### UniswapV3PluginDirect.sol (ALL untested)
```solidity
function getProtocolInfo() external pure
function isHealthy() external view
// + all ISwapPlugin inherited functions (swap, getExpectedOutput, supportsTokenPair)
```

### FlashLoanService.sol (no unit tests)
```solidity
function executeFlashLoan(...) external                // ❌ no unit test
function receiveFlashLoan(...) external                // ❌ no unit test (callback)
function swap(address tokenIn, address tokenOut, uint256 amountIn) external  // ❌ no unit test
function getExpectedOutput(...) external view          // ❌ no unit test
function getBalancerVault() external pure              // ❌ no unit test
function getSimpleSwap() external pure                 // ❌ no unit test
function isAuthorizedPlugin(address plugin) external view  // ❌ no unit test
```

---

## 6. Security-Critical Tests Missing

| Risk Area | Contract | Status |
|-----------|----------|--------|
| Reentrancy on ETH deposit | DepositHelper | ❌ NOT TESTED |
| Registry misconfiguration (wrong vault address) | All Registry contracts | ❌ NOT TESTED |
| Flash loan callback validation | FlashLoanService.receiveFlashLoan | ❌ No unit test — only fork e2e |
| Circuit breaker bypass | All Plugins | ⚠️ Only tested in fork context |
| Emergency withdrawal fund recovery | EmergencyHandler → ProxyGeneral | ✅ Tested |
| Access control on state-changing registry functions | All Registry (onlyOwner) | ❌ NOT TESTED |
| Slippage manipulation | SwapManager | ✅ Tested in unit + integration |
| Oracle staleness | ChainlinkAdapter | ✅ Tested |
| LP token inflation attack | LiquidityManager.deposit | ✅ Tested |
| Rate limit bypass | LiquidityManager withdraw limits | ✅ Tested |

---

## 7. Recommendations

1. **Immediate**: Write unit tests for `DepositHelper.sol` — it's a user-facing contract with zero coverage.
2. **Immediate**: Write unit tests for all three Registry contracts — misconfiguration can lock funds.
3. **High**: Create `ProxyGeneral.test.ts` (full version) to cover `transferFromModule()` and deeper edge cases.
4. **High**: Write unit tests for `FlashLoanService.sol` using mock Balancer vault.
5. **High**: Write unit tests for `UniswapV3PluginDirect.sol`.
6. **Medium**: Create unit tests for all 4 Lens Adapters with mock plugins — they're relied on for pool value calculations.
7. **Medium**: Add unit tests for plugins (EulerV2, AaveV3, Morpho, MorphoVault) using mocks — don't rely solely on fork tests.
8. **Medium**: Test the untested SwapManager functions (`emergencyTokenRecovery`, `canSwap`, `estimateSwapGas`, etc.).
9. **Low**: Add deployment script integration tests.
10. **Low**: Test LiquidityManager view functions (`getPoolStats`, `validatePoolState`, `canWithdraw`).
