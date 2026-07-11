# EulerV2Plugin - Function Inventory & Analysis

**Date:** January 31, 2026  
**Current Bytecode:** 29742 bytes  
**Target:** <24576 bytes  
**Gap:** 5166 bytes to remove  

---

## Bytecode Summary

| Contract | Bytecode Size | Status |
|----------|--------------|--------|
| **EulerV2Plugin** | 29742 bytes | ❌ 21.0% over limit |
| **EulerLensAdapter** | 17457 bytes | ✅ Under limit |
| **EulerRegistry** | 7580 bytes | ✅ Under limit |

**Total System:** 54779 bytes

---

## Function Inventory (60 Functions Total)

### Category Breakdown

| Category | Count | Total Bytes | Movable? | Priority |
|----------|-------|-------------|----------|----------|
| **Write Operations** | 7 | ~6000 | ❌ CORE | KEEP |
| **Leverage Operations** | 5 | ~8000 | ⚠️ PARTIAL | MEDIUM |
| **Flash Loan Callbacks** | 3 | ~2500 | ❌ CORE | KEEP |
| **View Functions (Remaining)** | 8 | ~2000 | ✅ YES | **HIGH** |
| **Position Management** | 5 | ~1200 | ⚠️ PARTIAL | MEDIUM |
| **EVC Configuration** | 9 | ~1500 | ✅ YES | **HIGH** |
| **Internal Helpers** | 15 | ~4500 | ⚠️ LIBRARY | MEDIUM |
| **Protocol Info** | 4 | ~800 | ✅ YES | LOW |
| **Circuit Breaker** | 2 | ~200 | ✅ YES | LOW |
| **FlashLoanService Interface** | 2 | ~50 | ❌ INTERFACE | KEEP |

---

## Detailed Function Analysis

### 1. WRITE OPERATIONS (CORE - MUST KEEP)

**Total: ~6000 bytes | Movable: 0 bytes**

| # | Function | Lines | Bytes | Type | Can Move? | Reason |
|---|----------|-------|-------|------|-----------|--------|
| 1 | `deposit(string tokenCode, uint256 amount)` | 35 | ~900 | External | ❌ NO | Core lending operation |
| 2 | `withdraw(string tokenCode, uint256 amount)` | 41 | ~1000 | External | ❌ NO | Core lending operation |
| 3 | `borrow(string tokenCode, uint256 amount)` | 30 | ~800 | External | ❌ NO | Core lending operation |
| 4 | `repay(string tokenCode, uint256 amount)` | 35 | ~900 | External | ❌ NO | Core lending operation |
| 5 | `emergencyWithdrawAll(string[] tokenCodes)` | 57 | ~1400 | External | ❌ NO | Emergency function |

**Analysis:** These are the core IProtocolAdapter functions that ProtocolManager calls directly. Cannot be moved.

---

### 2. LEVERAGE OPERATIONS (CRITICAL PATH)

**Total: ~8000 bytes | Movable: ~800 bytes**

| # | Function | Lines | Bytes | Type | Can Move? | Notes |
|---|----------|-------|-------|------|-----------|-------|
| 6 | `openLeverageAtomic(...)` | 130 | ~3500 | External | ❌ NO | Main leverage entry point |
| 7 | `closeLeverageAtomic(...)` | 88 | ~2500 | External | ❌ NO | Main leverage exit point |
| 8 | `addCollateralToPosition(uint256, uint256)` | 35 | ~400 | External | ✅ **YES** | Simple operation, rarely used |
| 9 | `removeCollateralFromPosition(uint256, uint256)` | 28 | ~400 | External | ✅ **YES** | Simple operation, rarely used |
| 10 | `closePositionsForWeth(uint256)` | 63 | ~1200 | External | ⚠️ PARTIAL | Could simplify/delegate |

**Movable Candidates:**
- `addCollateralToPosition()` - **~400 bytes** → Move to helper contract
- `removeCollateralFromPosition()` - **~400 bytes** → Move to helper contract
- **Total Savings:** ~800 bytes

---

### 3. FLASH LOAN CALLBACKS (MUST KEEP)

**Total: ~2500 bytes | Movable: 0 bytes**

| # | Function | Lines | Bytes | Type | Can Move? |
|---|----------|-------|-------|------|-----------|
| 11 | `onFlashLoanReceived(...)` | 26 | ~400 | External | ❌ NO |
| 12 | `_handleOpenLeverageCallback(...)` | 52 | ~1100 | Private | ❌ NO |
| 13 | `_handleCloseLeverageCallback(...)` | 66 | ~1000 | Private | ❌ NO |

**Analysis:** Part of IFlashLoanCallback interface. Must stay in Plugin.

---

### 4. VIEW FUNCTIONS (HIGH PRIORITY TO MOVE)

**Total: ~2000 bytes | Movable: ~1800 bytes** ⭐

| # | Function | Lines | Bytes | Type | Can Move? | Target |
|---|----------|-------|-------|------|-----------|--------|
| 14 | `getDebt(string tokenCode)` | 33 | ~300 | External | ✅ **YES** | → LensAdapter |
| 15 | `getHealthFactor()` | 45 | ~400 | External | ✅ **YES** | → LensAdapter |
| 16 | `getBorrowCapacity(string tokenCode)` | 14 | ~150 | External | ✅ **YES** | → LensAdapter |
| 17 | `getBalance(string tokenCode)` | 20 | ~200 | External | ✅ **YES** | → LensAdapter |
| 18 | `getTotalCollateral()` | 15 | ~250 | External | ✅ **YES** | → LensAdapter |
| 19 | `getTotalDebt()` | 14 | ~250 | External | ✅ **YES** | → LensAdapter |
| 20 | `getLowestHealthFactor()` | 22 | ~300 | External | ✅ **YES** | → LensAdapter |
| 21 | `getProtocolInfo()` | 11 | ~150 | External | ⚠️ MAYBE | → LensAdapter (low value) |

**CRITICAL FINDING:** 7 view functions still in Plugin that should be in LensAdapter!

**Estimated Savings:** ~1800 bytes

**Action Required:**
1. Move these 7 functions to EulerLensAdapter
2. Update IProtocolAdapter (remove signatures)
3. Update callers to use LensAdapter

---

### 5. POSITION MANAGEMENT (PARTIAL MOVE)

**Total: ~1200 bytes | Movable: ~800 bytes**

| # | Function | Lines | Bytes | Type | Can Move? | Notes |
|---|----------|-------|-------|------|-----------|-------|
| 22 | `getAllPositions()` | 20 | ~300 | External | ✅ **YES** | Delegates to Registry → Move to LensAdapter |
| 23 | `getPosition(uint256)` | 14 | ~200 | External | ✅ **YES** | Delegates to Registry → Move to LensAdapter |
| 24 | `getActivePositionCount()` | 16 | ~200 | External | ✅ **YES** | Delegates to Registry → Move to LensAdapter |
| 25 | `_toExternalPosition(uint256)` | 23 | ~300 | Internal | ⚠️ MAYBE | Helper for conversion |
| 26 | `_convertToStandardPosition(...)` | 35 | ~200 | Internal | ⚠️ MAYBE | Used in remaining functions |

**Movable:**
- `getAllPositions()` - **~300 bytes**
- `getPosition()` - **~200 bytes**
- `getActivePositionCount()` - **~200 bytes**

**Total Savings:** ~700 bytes

---

### 6. EVC CONFIGURATION (HIGH PRIORITY)

**Total: ~1500 bytes | Movable: ~1500 bytes** ⭐

| # | Function | Lines | Bytes | Type | Can Move? | Notes |
|---|----------|-------|-------|------|-----------|-------|
| 27 | `enableCollateral(address vault)` | 12 | ~150 | External | ✅ **YES** | Admin only → Separate admin contract |
| 28 | `enableController(address vault)` | 11 | ~150 | External | ✅ **YES** | Admin only |
| 29 | `disableCollateral(address vault)` | 11 | ~150 | External | ✅ **YES** | Admin only |
| 30 | `disableController(address vault)` | 11 | ~150 | External | ✅ **YES** | Admin only |
| 31 | `setupBorrowConfig(address, address)` | 21 | ~250 | External | ✅ **YES** | Admin only |
| 32 | `isCollateralEnabled(address vault)` | 9 | ~100 | External | ✅ **YES** | View function |
| 33 | `isControllerEnabled(address vault)` | 8 | ~100 | External | ✅ **YES** | View function |
| 34 | `getEnabledCollaterals()` | 8 | ~150 | External | ✅ **YES** | View function |
| 35 | `getEnabledControllers()` | 8 | ~150 | External | ✅ **YES** | View function |

**CRITICAL FINDING:** All 9 EVC configuration functions can be moved!

**Strategy:** Create `EulerV2PluginAdmin` contract for administrative operations.

**Estimated Savings:** ~1500 bytes

---

### 7. INTERNAL HELPERS (LIBRARY CANDIDATES)

**Total: ~4500 bytes | Movable: ~2000 bytes (via library)**

| # | Function | Lines | Bytes | Type | Can Move? | Notes |
|---|----------|-------|-------|------|-----------|-------|
| 36 | `_resolveToken(string)` | 13 | ~150 | Internal | ⚠️ LIBRARY | TokenManager call |
| 37 | `_getProxyGeneral()` | 8 | ~100 | Internal | ⚠️ LIBRARY | Beacon resolution |
| 38 | `_getVaultRegistry()` | 8 | ~100 | Internal | ⚠️ LIBRARY | Beacon resolution |
| 39 | `_getVault(string)` | 9 | ~150 | Internal | ⚠️ LIBRARY | Registry call |
| 40 | `_getVaultSafe(string)` | 9 | ~150 | Internal | ⚠️ LIBRARY | Registry call |
| 41 | `_deriveSubAccount(uint8)` | 9 | ~100 | Internal | ❌ NO | Uses EVC (must stay) |
| 42 | `_getFlashLoanService()` | 13 | ~150 | Internal | ⚠️ LIBRARY | Beacon resolution |
| 43 | `_getVaultWithFallback(string)` | 11 | ~150 | Internal | ⚠️ LIBRARY | Redundant with _getVaultSafe |
| 44 | `_calculateFlashLoanAmount(...)` | 37 | ~500 | Internal | ⚠️ LIBRARY | Pure calculation |
| 45 | `_estimateFlashLoanAmount(...)` | 12 | ~200 | Internal | ⚠️ LIBRARY | Simple calc |
| 46 | `_getPositionState(...)` | 30 | ~400 | Internal | ⚠️ LIBRARY | State query |
| 47 | `_closeNormalDepositsForWeth(...)` | 65 | ~1200 | Internal | ❌ NO | Complex, uses state |
| 48 | `_getTokenCodeFromVault(address)` | 13 | ~150 | Internal | ⚠️ LIBRARY | Registry call |
| 49 | `_closeLeverageAtomicForWeth(...)` | 83 | ~800 | Internal | ❌ NO | Complex, uses state |
| 50 | `_estimateWethForUsdc(uint256, uint256)` | 21 | ~150 | Internal | ✅ **LIBRARY** | Pure function |

**Library Candidates:** Create `EulerHelpers` library

Functions to extract:
- `_calculateFlashLoanAmount()` - **~500 bytes**
- `_estimateFlashLoanAmount()` - **~200 bytes**
- `_getPositionState()` - **~400 bytes**
- `_estimateWethForUsdc()` - **~150 bytes**

**Estimated Savings:** ~1250 bytes (library reduces inline code)

**Beacon Resolution Helpers:** Could create `BeaconHelpers` library but savings minimal (~300 bytes).

---

### 8. PROTOCOL INFO (LOW PRIORITY)

**Total: ~800 bytes | Movable: ~600 bytes**

| # | Function | Lines | Bytes | Type | Can Move? |
|---|----------|-------|-------|------|-----------|
| 51 | `protocolName()` | 5 | ~50 | External | ❌ NO |
| 52 | `protocolType()` | 5 | ~50 | External | ❌ NO |
| 53 | `getProtocolSummary()` | 49 | ~600 | External | ✅ **YES** → LensAdapter |
| 54 | `closePosition(uint256)` | 30 | ~500 | External | ❌ NO |

**Movable:**
- `getProtocolSummary()` - **~600 bytes** (delegates to view functions)

---

### 9. CIRCUIT BREAKER (LOW PRIORITY)

**Total: ~200 bytes | Movable: 0 bytes**

| # | Function | Lines | Bytes | Type | Can Move? |
|---|----------|-------|-------|------|-----------|
| 55 | `setCircuitBreaker(bool)` | 12 | ~100 | External | ❌ NO |
| 56 | `isCircuitBreakerActive()` | 5 | ~50 | External | ❌ NO |
| 57 | `activateCircuitBreaker()` | 10 | ~50 | External | ❌ NO |

**Analysis:** Emergency functions, must stay for safety.

---

### 10. INTERFACE DECLARATIONS (NOT IN BYTECODE)

| # | Item | Lines | Type |
|---|------|-------|------|
| 58 | `IFlashLoanService.executeFlashLoan()` | 5 | Interface |
| 59 | `IFlashLoanService.swap()` | 1 | Interface |
| 60 | `IFlashLoanService.getExpectedOutput()` | 1 | Interface |

**Analysis:** Forward declarations don't add to bytecode. Could extract to separate file but no savings.

---

## Summary: Functions To Move

### HIGH PRIORITY (Total: ~4000 bytes)

#### 1. Move to LensAdapter (~2500 bytes)

| Function | Bytes | Complexity |
|----------|-------|------------|
| `getDebt(string)` | 300 | Low |
| `getHealthFactor()` | 400 | Medium |
| `getBorrowCapacity(string)` | 150 | Low |
| `getBalance(string)` | 200 | Low |
| `getTotalCollateral()` | 250 | Low |
| `getTotalDebt()` | 250 | Low |
| `getLowestHealthFactor()` | 300 | Medium |
| `getProtocolSummary()` | 600 | Medium |
| `getAllPositions()` | 300 | Low (delegate) |
| `getPosition(uint256)` | 200 | Low (delegate) |
| `getActivePositionCount()` | 200 | Low (delegate) |
| **TOTAL** | **~3150 bytes** | **11 functions** |

#### 2. Move to Admin Contract (~1500 bytes)

| Function | Bytes | Type |
|----------|-------|------|
| `enableCollateral()` | 150 | Admin |
| `enableController()` | 150 | Admin |
| `disableCollateral()` | 150 | Admin |
| `disableController()` | 150 | Admin |
| `setupBorrowConfig()` | 250 | Admin |
| `isCollateralEnabled()` | 100 | View |
| `isControllerEnabled()` | 100 | View |
| `getEnabledCollaterals()` | 150 | View |
| `getEnabledControllers()` | 150 | View |
| **TOTAL** | **~1350 bytes** | **9 functions** |

#### 3. Move to Helper Contract (~800 bytes)

| Function | Bytes | Usage |
|----------|-------|-------|
| `addCollateralToPosition()` | 400 | Rare |
| `removeCollateralFromPosition()` | 400 | Rare |
| **TOTAL** | **~800 bytes** | **2 functions** |

### MEDIUM PRIORITY (Total: ~1250 bytes)

#### 4. Extract to Library

| Function | Bytes | Type |
|----------|-------|------|
| `_calculateFlashLoanAmount()` | 500 | Pure calc |
| `_estimateFlashLoanAmount()` | 200 | Pure calc |
| `_getPositionState()` | 400 | View |
| `_estimateWethForUsdc()` | 150 | Pure |
| **TOTAL** | **~1250 bytes** | **4 functions** |

---

## Recommended Action Plan

### Phase 9: Move View Functions to LensAdapter

**Target:** Remove 11 view functions → **~3150 bytes savings**

**Steps:**
1. Add 11 function implementations to EulerLensAdapter
2. Remove from IProtocolAdapter interface (signatures)
3. Remove from EulerV2Plugin (implementations)
4. Update all callers to use LensAdapter

**Expected Result:** EulerV2Plugin: 29742 → **~26600 bytes** (-11%)

---

### Phase 10: Extract Admin Functions

**Target:** Create EulerV2PluginAdmin contract → **~1350 bytes savings**

**Steps:**
1. Create new contract `EulerV2PluginAdmin`
2. Move 9 EVC configuration functions
3. Add access control (only ProtocolManager can call Plugin via Admin)
4. Update deployment scripts

**Expected Result:** EulerV2Plugin: 26600 → **~25250 bytes** (-5%)

---

### Phase 11: Extract Helper Contract (Optional)

**Target:** Create EulerV2PluginHelpers → **~800 bytes savings**

**Steps:**
1. Create `EulerV2PluginHelpers` contract
2. Move `addCollateral` and `removeCollateral` functions
3. Add delegation logic in main Plugin

**Expected Result:** EulerV2Plugin: 25250 → **~24450 bytes** (-3%)

**Status:** ✅ **UNDER LIMIT** (24576 bytes)

---

### Phase 12: Extract to Library (If Needed)

**Target:** Create `EulerCalculations` library → **~1250 bytes savings**

**This would get us well under the limit:** 24450 → **~23200 bytes** (-5%)

---

## Final Projection

| Phase | Action | Bytecode Before | Savings | Bytecode After | Status |
|-------|--------|-----------------|---------|----------------|--------|
| **Current** | After Phase 8 | 29742 | - | 29742 | ❌ Over |
| **Phase 9** | Move 11 views to Lens | 29742 | -3150 | 26592 | ❌ Over |
| **Phase 10** | Admin contract | 26592 | -1350 | 25242 | ❌ Over (by 666) |
| **Phase 11** | Helper contract | 25242 | -800 | 24442 | ✅ **UNDER** |
| **Phase 12** | Library (optional) | 24442 | -1250 | 23192 | ✅ Safe margin |

---

## Conclusion

**Key Findings:**

1. **7 view functions** still in Plugin that MUST move to LensAdapter (~1800 bytes)
2. **9 EVC admin functions** can be extracted to admin contract (~1350 bytes)
3. **2 position helpers** rarely used, can extract (~800 bytes)
4. **4 calculation helpers** can become library (~1250 bytes)

**Total Available Savings:** ~5200 bytes (exactly what we need!)

**Recommended Path:**
- Execute Phases 9-11 to get **under limit**
- Keep Phase 12 as optimization reserve

**Next Step:** Should I proceed with Phase 9 (move 11 view functions to LensAdapter)?
