# 📊 Complete Function Inventory - Euler V2 3 Musketeers

**Data**: 2026-01-30  
**Scopo**: Analisi completa di tutte le funzioni per identificare duplicazioni e ottimizzare bytecode size

---

## 🎯 EulerV2Plugin.sol (76 funzioni totali)

### External/Public Functions (48)

#### IProtocolAdapter Interface (Required - DO NOT REMOVE)
1. `deposit(string tokenCode, uint256 amount)` - Line 278 ✅ REQUIRED
2. `withdraw(string tokenCode, uint256 amount)` - Line 313 ✅ REQUIRED  
3. `borrow(string tokenCode, uint256 amount)` - Line 354 ✅ REQUIRED (ILendingProtocol)
4. `repay(string tokenCode, uint256 amount)` - Line 384 ✅ REQUIRED (ILendingProtocol)
5. `getDebt(string tokenCode)` - Line 419 ✅ REQUIRED (ILendingProtocol)
6. `getBalance(string tokenCode)` - Line 511 ✅ REQUIRED
7. `getTotalValue()` - Line 530 ✅ REQUIRED
8. `emergencyWithdrawAll(string[] tokenCodes)` - Line 557 ✅ REQUIRED
9. `getAllPositions()` - Line 1112 ✅ REQUIRED
10. `getPosition(uint256 positionId)` - Line 1138 ✅ REQUIRED
11. `getActivePositionCount()` - Line 1151 ✅ REQUIRED
12. `protocolName()` - Line 1508 ✅ REQUIRED
13. `protocolType()` - Line 1513 ✅ REQUIRED
14. `getProtocolSummary()` - Line 1518 ✅ REQUIRED
15. `getPositionsSortedByRisk()` - Line 1562 ✅ REQUIRED
16. `closePosition(uint256 positionId)` - Line 1596 ✅ REQUIRED
17. `closePositionsForWeth(uint256 targetWethAmount)` - Line 1628 ✅ REQUIRED
18. `getTotalCollateral()` - Line 1841 ✅ REQUIRED
19. `getTotalDebt()` - Line 1853 ✅ REQUIRED
20. `getLowestHealthFactor()` - Line 1864 ✅ REQUIRED
21. `getMaxWithdrawable(string tokenCode)` - Line 1883 ✅ REQUIRED
22. `isCircuitBreakerActive()` - Line 1890 ✅ REQUIRED
23. `activateCircuitBreaker()` - Line 1895 ✅ REQUIRED

#### ILendingProtocol Specific (Required)
24. `getHealthFactor()` - Line 452 ✅ REQUIRED (Called by ProtocolManager)

#### Atomic Leverage (Core Features)
25. `openLeverageAtomic(OpenLeverageAtomicParams)` - Line 614 ✅ CORE
26. `closeLeverageAtomic(CloseLeverageAtomicParams)` - Line 746 ✅ CORE
27. `onFlashLoanReceived(...)` - Line 834 ✅ CORE (Callback)

#### Position Management (IEulerV2PluginSpecific)
28. `addCollateralToPosition(uint256 positionId, uint256 amount)` - Line 999 ✅ UTILITY
29. `removeCollateralFromPosition(uint256 positionId, uint256 amount)` - Line 1034 ✅ UTILITY
30. `getPositionHealth(uint256 positionId)` - Line 1062 ⚠️ **DUPLICATED in EulerLensAdapter**
31. `getPositionValue(uint256 positionId)` - Line 1089 ⚠️ **DUPLICATED in EulerLensAdapter**
32. `getLeveragePosition(uint256 positionId)` - Line 1903 ⚠️ **DUPLICATED in EulerLensAdapter**
33. `getAllLeveragePositions()` - Line 1921 ⚠️ **DUPLICATED in EulerLensAdapter**

#### Circuit Breaker
34. `setCircuitBreaker(bool tripped)` - Line 1167 ✅ REQUIRED (IEulerV2PluginSpecific)
35. `tripCircuitBreaker()` - Line 1175 ❌ **WRAPPER** (calls setCircuitBreaker(true))
36. `resetCircuitBreaker()` - Line 1183 ❌ **WRAPPER** (calls setCircuitBreaker(false))

#### EVC Configuration
37. `enableCollateral(address vault)` - Line 1195 ✅ ADMIN
38. `enableController(address vault)` - Line 1207 ✅ ADMIN
39. `disableCollateral(address vault)` - Line 1218 ✅ ADMIN
40. `disableController(address vault)` - Line 1229 ✅ ADMIN
41. `setupBorrowConfig(address, address)` - Line 1241 ❌ **UTILITY WRAPPER** (calls enable x2)
42. `isCollateralEnabled(address vault)` - Line 1262 ✅ VIEW
43. `isControllerEnabled(address vault)` - Line 1271 ✅ VIEW
44. `getEnabledCollaterals()` - Line 1279 ✅ VIEW
45. `getEnabledControllers()` - Line 1287 ✅ VIEW

#### Legacy/Stubs
46. `getBorrowCapacity(string tokenCode)` - Line 497 ❌ **STUB** (returns 0)
47. `getProtocolInfo()` - Line 546 ❌ **LEGACY** (returns hardcoded values)
48. `getCurrentLeverage()` - Line 1489 ❌ **UNUSED** (no external calls)

#### Wrapper (External for try/catch)
49. `getVaultExternal(string tokenCode)` - Line 1398 ⚠️ **INTERNAL WRAPPER**

### Internal/Private Functions (28)

#### Flash Loan Callbacks
1. `_handleOpenLeverageCallback(...)` - Line 860
2. `_handleCloseLeverageCallback(...)` - Line 912

#### Helpers
3. `_estimateWethForUsdc(uint256, uint256)` - Line 978
4. `_resolveToken(string tokenCode)` - Line 1297
5. `_getProxyGeneral()` - Line 1310
6. `_getVault(string tokenCode)` - Line 1318
7. `_getVaultSafe(string tokenCode)` - Line 1327
8. `_toExternalPosition(uint256)` - Line 1336
9. `_deriveSubAccount(uint8)` - Line 1358
10. `_getFlashLoanService()` - Line 1367
11. `_getVaultWithFallback(string tokenCode)` - Line 1379
12. `_calculateFlashLoanAmount(...)` - Line 1409
13. `_estimateFlashLoanAmount(...)` - Line 1446
14. `_getPositionState(...)` - Line 1458
15. `_closeNormalDepositsForWeth(...)` - Line 1686
16. `_getTokenCodeFromVault(address)` - Line 1749
17. `_closeLeverageAtomicForWeth(...)` - Line 1761
18. `_convertToStandardPosition(...)` - Line 1947

---

## 🔍 EulerLensAdapter.sol (51 funzioni totali)

### External/Public Functions (37)

#### ILensAdapter Interface (Required)
1. `protocolName()` - Line 783 ✅ REQUIRED
2. `getPlugin()` - Line 788 ✅ REQUIRED
3. `getHealthFactor()` - Line 793 ✅ REQUIRED (different signature from Plugin!)
4. `getAccountHealth()` - Line 842 ✅ REQUIRED
5. `getTotalValue()` - Line 949 ✅ REQUIRED
6. `getValueBreakdown()` - Line 954 ✅ REQUIRED
7. `getNetAPY()` - Line 1007 ✅ REQUIRED
8. `estimateWethFromCloseAll()` - Line 1022 ✅ REQUIRED

#### Health Monitoring (Euler-Specific)
9. `getHealthFactor(address account)` - Line 127 ✅ PARAMETRIZED (vs Plugin's no-param version)
10. `getSubAccountHealth(address, address)` - Line 163 ✅ REPLACES Plugin's getHealthFactorForVault()
11. `getTimeToLiquidation(address, address)` - Line 183 ✅ PARAMETRIZED (vs Plugin's wrapper)
12. `getPositionHealth(uint256)` - Line 799 🔄 **DUPLICATES Plugin**
13. `getPositionHealthFactor(uint256)` - Line 529 🔄 **DUPLICATES Plugin.getPositionHealth()**
14. `getTimeToLiquidation(uint256)` - Line 863 🔄 **OVERLOAD** (by positionId)

#### Position Analysis
15. `getTotalEulerValue()` - Line 212 ✅ EULER-SPECIFIC
16. `getEulerPositionValues()` - Line 231 ✅ EULER-SPECIFIC
17. `getPositionCollateralInEth(uint256)` - Line 247 ✅ EULER-SPECIFIC
18. `getWithdrawableAmount(string)` - Line 291 ✅ PRACTICAL
19. `getEulerPositionsAtRisk(uint256)` - Line 348 ✅ RISK MANAGEMENT
20. `shouldAutoClosePosition(uint256, uint256)` - Line 389 ✅ AUTOMATION
21. `shouldAutoClose(uint256, uint256)` - Line 909 🔄 **DUPLICATES shouldAutoClosePosition()**

#### Vault Information
22. `getPrimaryControllerVault(address)` - Line 411 ✅ HELPER
23. `getVaultForToken(string)` - Line 428 ✅ HELPER
24. `getVaultAPYs(address)` - Line 443 ✅ YIELD INFO

#### Position Sorting/Filtering
25. `getPositionsSortedByHealth()` - Line 482 ✅ RISK SORTING
26. `getPositionsAtRisk(uint256)` - Line 879 🔄 **DUPLICATES getEulerPositionsAtRisk()**
27. `getPositionsSortedByRisk()` - Line 916 🔄 **DUPLICATES getPositionsSortedByHealth()**

#### Position Value
28. `getPositionValue(uint256)` - Line 969 🔄 **DUPLICATES Plugin**

#### Yield Information
29. `getYieldInfo(string)` - Line 983 ✅ YIELD ANALYSIS
30. `getMaxWithdrawable(string)` - Line 1015 ✅ WITHDRAWAL PLANNING

### Internal/Private Functions (14)

1. `_calculateTotalValues()` - Line 555
2. `_calculateLeverageValues(...)` - Line 613
3. `_convertToEthValue(address, uint256)` - Line 648
4. `_getPositionHealthFactor(...)` - Line 710
5. `_getSubAccountAddress(address, uint8)` - Line 742
6. `_getEulerV2Plugin()` - Line 756
7. `_getEulerVaultRegistry()` - Line 765
8. `_getTokenManager()` - Line 774
9. `_getPositionValueInEth(...)` - Line 1033
10. `_getTimeToLiquidationInternal(...)` - Line 1052

---

## 🗄️ EulerVaultRegistry.sol (10 funzioni totali)

### External/Public Functions (10)

#### Admin Functions
1. `setVault(string tokenCode, address vault)` - Line 89 ✅ ADMIN
2. `setVaultsBatch(string[], address[])` - Line 127 ✅ BATCH ADMIN
3. `removeVault(string tokenCode)` - Line 174 ✅ ADMIN

#### View Functions
4. `getVault(string tokenCode)` - Line 207 ✅ CORE
5. `getVaultSafe(string tokenCode)` - Line 217 ✅ CORE (no revert)
6. `getTokenCode(address vault)` - Line 226 ✅ REVERSE LOOKUP
7. `isRegistered(string tokenCode)` - Line 236 ✅ CHECK
8. `getAllRegisteredTokens()` - Line 244 ✅ ENUMERATION
9. `getRegisteredCount()` - Line 252 ✅ COUNT
10. `getAllVaults()` - Line 261 ✅ FULL LIST

### Internal/Private Functions
**NONE** - All logic is external

---

## 🔴 DUPLICATIONS FOUND

### Critical Duplicates (EulerV2Plugin ↔ EulerLensAdapter)

| Function | EulerV2Plugin | EulerLensAdapter | Status |
|----------|---------------|------------------|--------|
| `getPositionHealth(uint256)` | Line 1062 | Line 799 + 529 | 🔴 DUPLICATE |
| `getPositionValue(uint256)` | Line 1089 | Line 969 | 🔴 DUPLICATE |
| `getLeveragePosition(uint256)` | Line 1903 | Line 37 (interface) | 🔴 DUPLICATE |
| `getAllLeveragePositions()` | Line 1921 | Line 38 (interface) | 🔴 DUPLICATE |

### Wrapper Functions (Can Remove)

| Function | Line | Reason |
|----------|------|--------|
| `tripCircuitBreaker()` | 1175 | Calls `setCircuitBreaker(true)` |
| `resetCircuitBreaker()` | 1183 | Calls `setCircuitBreaker(false)` |
| `setupBorrowConfig()` | 1241 | Calls `enableCollateral() + enableController()` |
| `getBorrowCapacity()` | 497 | Stub returning 0 |
| `getProtocolInfo()` | 546 | Returns hardcoded values |
| `getCurrentLeverage()` | 1489 | Not used anywhere |
| `getVaultExternal()` | 1398 | Wrapper for internal try/catch |

### Internal Duplicates (EulerLensAdapter only)

| Function Set | Lines | Reason |
|--------------|-------|--------|
| `getEulerPositionsAtRisk()` / `getPositionsAtRisk()` | 348 / 879 | Same logic |
| `getPositionsSortedByHealth()` / `getPositionsSortedByRisk()` | 482 / 916 | Same logic |
| `shouldAutoClosePosition()` / `shouldAutoClose()` | 389 / 909 | Same logic |
| `getPositionHealthFactor()` / `getPositionHealth()` | 529 / 799 | Same logic |

---

## 📈 REMOVAL CANDIDATES TO REDUCE BYTECODE

### High Priority (EulerV2Plugin - Est. 2-3 KB saving)

1. ✅ **REMOVED**: `getHealthFactorForVault()` → Use `EulerLensAdapter.getSubAccountHealth()` (-247 bytes)
2. ✅ **REMOVED**: `getTimeToLiquidation()` → Use `EulerLensAdapter.getTimeToLiquidation()` (-included in #1)
3. ✅ **REMOVED**: `getPositionHealth()` → Use `EulerLensAdapter.getPositionHealthFactor()` (-300 bytes)
4. ✅ **REMOVED**: `getPositionValue()` → Use `EulerLensAdapter.getPositionValue()` (-228 bytes)
5. ⛔ **KEEP**: `getLeveragePosition()` → CRITICAL - Called by EulerLensAdapter (8 times)
6. ⛔ **KEEP**: `getAllLeveragePositions()` → CRITICAL - Called by EulerLensAdapter (3 times, performance)

### Medium Priority (EulerV2Plugin - Est. 0.5-1 KB saving)

7. ✅ **REMOVED**: `tripCircuitBreaker()` → Use `setCircuitBreaker(true)` (-91 bytes total with #8)
8. ✅ **REMOVED**: `resetCircuitBreaker()` → Use `setCircuitBreaker(false)` (-included in #7)
9. 🔍 **SKIP**: `setupBorrowConfig()` → Wrapper, but keeping for convenience
10. ⛔ **KEEP**: `getBorrowCapacity()` → Required by ILendingProtocol interface (stub returning 0)
11. ⛔ **KEEP**: `getProtocolInfo()` → Legacy but referenced in IProtocolManager  
12. ✅ **REMOVED**: `getCurrentLeverage()` → Hardcoded, use getLeveragePosition() instead (-687 bytes!)
13. 🔍 **NEXT**: `getVaultExternal()` → Internal wrapper, analyze usage

### Low Priority (EulerLensAdapter - Cleanup)

14. Merge duplicate position risk functions
15. Merge duplicate health check functions

---

## 💡 RECOMMENDATIONS

### Immediate Actions (Target: -6 KB)

1. **Remove 4 position view functions from EulerV2Plugin** (~1.5 KB)
   - Plugin should focus on ACTIONS
   - Lens should handle all VIEW logic
   
2. **Remove 7 wrapper/stub functions** (~1 KB)
   - Direct interface calls preferred
   
3. **Consider moving internal helpers to library** (~3-4 KB)
   - `_calculateFlashLoanAmount()`
   - `_handleOpenLeverageCallback()`
   - `_handleCloseLeverageCallback()`
   - `_estimateWethForUsdc()`

### Architecture Principle

**SEPARATION OF CONCERNS**:
- **EulerV2Plugin**: Write operations (deposit, borrow, leverage)
- **EulerLensAdapter**: Read operations (health, values, analytics)
- **EulerVaultRegistry**: Configuration (vault mappings)

---

**Total Functions**: 137 (76 + 51 + 10)  
**Duplicates Found**: 13  
**Removal Candidates**: 13  
**Est. Bytecode Saving**: 3-6 KB (enough to reach <24 KB limit!)
