# 📋 TEST IMPLEMENTATION CHECKLIST

**Project**: DeFi Protocol Test Suite  
**Total Tests**: 624 (341 existing ✅ + 283 missing ❌)  
**Missing Tests**: 283  
**Implementation Time**: ~87 hours

---

## 📊 Progress Dashboard

### Overall Progress
- [ ] Phase 1: BLOCKERS (39 hours) - 0/75 tests complete
- [ ] Phase 2: HIGH PRIORITY (26 hours) - 0/147 tests complete  
- [ ] Phase 3: MEDIUM PRIORITY (22 hours) - 0/58 tests complete
- [ ] Phase 4: LOW PRIORITY (3 hours) - 0/3 tests complete

### Module Progress
- [ ] LiquidityManager: 0/98 missing tests complete (26% coverage)
- [ ] SwapManager: 0/98 missing tests complete (25% coverage)
- [ ] EmergencyHandler: 0/52 missing/broken tests complete (47% coverage)
- [ ] ProxyGeneral: 0/11 edge cases complete (81% coverage)
- [ ] TokenManager: 0/15 edge cases complete (78% coverage)
- [ ] ValueCalculator: 0/12 edge cases complete (80% coverage)
- [ ] ParameterManager: 0/9 edge cases complete (86% coverage)
- [ ] Beacon: 0/7 edge cases complete (86% coverage)

---

## 🔴 PHASE 1: BLOCKERS (Must Complete Before Production)

**Priority**: IMMEDIATE  
**Time**: 39 hours  
**Tests**: 75 (19 fixes + 56 new)

### EmergencyHandler - FIX BROKEN TESTS (5 hours)

#### Event Signature Fixes (1 hour)
- [ ] **EH-FIX-001**: Fix EmergencyUnpause event signature mismatch (15 min)
- [ ] **EH-FIX-002**: Fix AssetRecovered event signature mismatch (15 min)
- [ ] **EH-FIX-003**: Fix EmergencyContactAdded event ambiguity (15 min)
- [ ] **EH-FIX-004**: Fix EmergencyContactRemoved event ambiguity (15 min)

#### Function Return Fixes (1.5 hours)
- [ ] **EH-FIX-005**: Fix generateEmergencyReport() return struct (25 min)
- [ ] **EH-FIX-006**: Fix getLastEmergencyReport() struct mismatch (25 min)
- [ ] **EH-FIX-007**: Fix getEmergencyStats() struct mismatch (20 min)
- [ ] **EH-FIX-008**: Fix getSystemHealthStatus() return type (20 min)
- [ ] **EH-FIX-009**: Fix emergencyWithdraw() balance check (20 min)

#### Logic Fixes (1.5 hours)
- [ ] **EH-FIX-010**: Fix emergency cooldown enforcement (20 min)
- [ ] **EH-FIX-011**: Fix unpause error message (15 min)
- [ ] **EH-FIX-012**: Fix emergency withdraw pause requirement (20 min)
- [ ] **EH-FIX-013**: Fix empty reason handling (15 min)
- [ ] **EH-FIX-014**: Fix emergency state integrity (20 min)

#### State Management Fixes (1 hour)
- [ ] **EH-FIX-015**: Fix emergency state fields (isActive, activatedAt) (15 min)
- [ ] **EH-FIX-016**: Fix multiple contacts state consistency (15 min)
- [ ] **EH-FIX-017**: Fix report persistence (15 min)
- [ ] **EH-FIX-018**: Fix statistics tracking (10 min)
- [ ] **EH-FIX-019**: Fix health status computation (15 min)

### LiquidityManager - Core Functions (22 hours)

#### deposit() - CRITICAL Tests (6.5 hours)
- [ ] **LM-DEP-CRIT-001**: Successful ETH deposit with correct LP minting (25 min)
- [ ] **LM-DEP-CRIT-002**: Deposit fee correctly deducted (20 min)
- [ ] **LM-DEP-CRIT-003**: Rate limiting enforced (maxDepositsPerPeriod) (20 min)
- [ ] **LM-DEP-CRIT-004**: Deposit when rate limit exceeded (revert) (20 min)
- [ ] **LM-DEP-CRIT-005**: Min deposit amount enforced (20 min)
- [ ] **LM-DEP-CRIT-006**: Max deposit amount enforced (20 min)
- [ ] **LM-DEP-CRIT-007**: Deposits disabled (revert with "Deposits are disabled") (15 min)
- [ ] **LM-DEP-CRIT-008**: Deposit when contract paused (revert) (15 min)
- [ ] **LM-DEP-CRIT-009**: ETH → WETH conversion correct (25 min)
- [ ] **LM-DEP-CRIT-010**: WETH transferred to ProxyGeneral custody (20 min)
- [ ] **LM-DEP-CRIT-011**: LP tokens minted to depositor (20 min)
- [ ] **LM-DEP-CRIT-012**: ValueCalculator integration (pool value updated) (25 min)

#### deposit() - HIGH Priority Tests (3.5 hours)
- [ ] **LM-DEP-HIGH-001**: DepositExecuted event emitted with correct params (15 min)
- [ ] **LM-DEP-HIGH-002**: Multiple deposits from same user (accumulation) (20 min)
- [ ] **LM-DEP-HIGH-003**: Concurrent deposits from different users (20 min)
- [ ] **LM-DEP-HIGH-004**: First deposit (totalSupply = 0) calculates shares correctly (25 min)
- [ ] **LM-DEP-HIGH-005**: Deposit with existing LP supply (proportional shares) (25 min)
- [ ] **LM-DEP-HIGH-006**: Fee recipient receives fee correctly (20 min)
- [ ] **LM-DEP-HIGH-007**: Zero fee scenario (no fee deduction) (15 min)
- [ ] **LM-DEP-HIGH-008**: 100% fee scenario (entire deposit as fee) (15 min)
- [ ] **LM-DEP-HIGH-009**: Deposit amount exactly at minDeposit (15 min)
- [ ] **LM-DEP-HIGH-010**: Deposit amount exactly at maxDeposit (15 min)
- [ ] **LM-DEP-HIGH-011**: Rate limiting resets after period expires (20 min)

#### withdraw() - CRITICAL Tests (6 hours)
- [ ] **LM-WTH-CRIT-001**: Successful withdraw with LP burn (25 min)
- [ ] **LM-WTH-CRIT-002**: Withdraw fee correctly deducted (20 min)
- [ ] **LM-WTH-CRIT-003**: Daily withdraw limit enforced (25 min)
- [ ] **LM-WTH-CRIT-004**: User-specific withdraw limit enforced (25 min)
- [ ] **LM-WTH-CRIT-005**: Withdraw exceeds daily limit (revert) (20 min)
- [ ] **LM-WTH-CRIT-006**: Withdraw exceeds user limit (revert) (20 min)
- [ ] **LM-WTH-CRIT-007**: Withdrawals disabled (revert) (15 min)
- [ ] **LM-WTH-CRIT-008**: Withdraw when paused (revert) (15 min)
- [ ] **LM-WTH-CRIT-009**: Insufficient LP balance (revert) (15 min)
- [ ] **LM-WTH-CRIT-010**: WETH → ETH conversion correct (25 min)
- [ ] **LM-WTH-CRIT-011**: ETH transferred to user (25 min)

#### withdraw() - HIGH Priority Tests (6 hours)
- [ ] **LM-WTH-HIGH-001**: WithdrawExecuted event with correct params (15 min)
- [ ] **LM-WTH-HIGH-002**: LP tokens burned correctly (25 min)
- [ ] **LM-WTH-HIGH-003**: Multiple withdraws from same user (20 min)
- [ ] **LM-WTH-HIGH-004**: _executeAutomaticSwap() triggered when WETH insufficient (30 min)
- [ ] **LM-WTH-HIGH-005**: Automatic swap successful (integration with SwapManager) (30 min)
- [ ] **LM-WTH-HIGH-006**: Automatic swap fails (revert with "Insufficient WETH") (25 min)
- [ ] **LM-WTH-HIGH-007**: Proportional withdraw amount calculation (25 min)
- [ ] **LM-WTH-HIGH-008**: Withdraw all LP tokens (full withdrawal) (20 min)
- [ ] **LM-WTH-HIGH-009**: Fee recipient receives withdraw fee (20 min)
- [ ] **LM-WTH-HIGH-010**: Zero withdraw fee scenario (15 min)
- [ ] **LM-WTH-HIGH-011**: Withdraw limits reset after period expires (20 min)
- [ ] **LM-WTH-HIGH-012**: checkWithdrawLimits integration (25 min)

### SwapManager - Core Functions (12 hours)

#### performSwap() - CRITICAL Tests (6 hours)
- [ ] **SM-SWAP-CRIT-001**: Successful swap TokenA → WETH (30 min)
- [ ] **SM-SWAP-CRIT-002**: Successful swap WETH → TokenB (30 min)
- [ ] **SM-SWAP-CRIT-003**: Successful swap TokenA → TokenB (via WETH) (30 min)
- [ ] **SM-SWAP-CRIT-004**: Slippage protection (revert if exceeded) (25 min)
- [ ] **SM-SWAP-CRIT-005**: Swap when swaps disabled (revert) (15 min)
- [ ] **SM-SWAP-CRIT-006**: Swap when paused (revert) (15 min)
- [ ] **SM-SWAP-CRIT-007**: Insufficient balance (revert) (15 min)
- [ ] **SM-SWAP-CRIT-008**: Zero amount swap (revert) (15 min)
- [ ] **SM-SWAP-CRIT-009**: Identical from/to tokens (revert) (15 min)
- [ ] **SM-SWAP-CRIT-010**: Token not registered (revert) (15 min)
- [ ] **SM-SWAP-CRIT-011**: Deadline expired (revert) (15 min)
- [ ] **SM-SWAP-CRIT-012**: Balance verification after swap (25 min)

#### performSwap() - HIGH Priority Tests (4.5 hours)
- [ ] **SM-SWAP-HIGH-001**: SwapExecuted event with correct params (15 min)
- [ ] **SM-SWAP-HIGH-002**: Slippage calculation correct (20 min)
- [ ] **SM-SWAP-HIGH-003**: _swapToWETH() internal routing (20 min)
- [ ] **SM-SWAP-HIGH-004**: _swapFromWETH() internal routing (20 min)
- [ ] **SM-SWAP-HIGH-005**: _swapTokenToToken() internal routing (25 min)
- [ ] **SM-SWAP-HIGH-006**: Token approvals to DEX router (20 min)
- [ ] **SM-SWAP-HIGH-007**: Success counter incremented (15 min)
- [ ] **SM-SWAP-HIGH-008**: Error counter incremented on failure (20 min)
- [ ] **SM-SWAP-HIGH-009**: Multiple swaps in sequence (20 min)
- [ ] **SM-SWAP-HIGH-010**: Swap with maxSlippage = 0 (revert) (15 min)
- [ ] **SM-SWAP-HIGH-011**: Swap with maxSlippage = 2000 bps (20%) (15 min)
- [ ] **SM-SWAP-HIGH-012**: DEX router call correct parameters (20 min)
- [ ] **SM-SWAP-HIGH-013**: getSwapStats() updated correctly (15 min)
- [ ] **SM-SWAP-HIGH-014**: getExpectedSwapOutput() integration (20 min)

#### Swap Wrappers - HIGH Priority Tests (1.5 hours)
- [ ] **SM-WRAP-HIGH-001**: swapTokenForWETH() correct execution (20 min)
- [ ] **SM-WRAP-HIGH-002**: swapWETHForToken() correct execution (20 min)
- [ ] **SM-WRAP-HIGH-003**: Deadline parameter working (15 min)
- [ ] **SM-WRAP-HIGH-004**: Events emitted from wrappers (15 min)
- [ ] **SM-WRAP-HIGH-005**: Integration with performSwap() (20 min)

---

## 🟠 PHASE 2: HIGH PRIORITY (Pre-Launch Required)

**Priority**: HIGH  
**Time**: 26 hours  
**Tests**: 147

### EmergencyHandler - HIGH Priority Tests (5 hours)

#### Emergency Operations (2 hours)
- [ ] **EH-UNPAUSE-HIGH-001**: Only authorized can unpause (15 min)
- [ ] **EH-UNPAUSE-HIGH-002**: Revert if not paused (15 min)
- [ ] **EH-UNPAUSE-HIGH-003**: Emergency state cleared after unpause (20 min)
- [ ] **EH-WITHDRAW-HIGH-001**: Multi-token withdrawal succeeds (20 min)
- [ ] **EH-WITHDRAW-HIGH-002**: EmergencyWithdrawInitiated event (15 min)
- [ ] **EH-WITHDRAW-HIGH-003**: TokenWithdrawAttempted per token (20 min)
- [ ] **EH-WITHDRAW-HIGH-004**: EmergencyWithdrawCompleted event (15 min)
- [ ] **EH-WITHDRAW-HIGH-005**: Revert if not paused (20 min)

#### Reporting Functions (3 hours)
- [ ] **EH-REPORT-HIGH-001**: Report contains all pool data (20 min)
- [ ] **EH-REPORT-HIGH-002**: Report saved to lastReport (15 min)
- [ ] **EH-LASTREP-HIGH-001**: Returns correct report data (20 min)
- [ ] **EH-STATS-HIGH-001**: Returns correct pause count (20 min)
- [ ] **EH-STATS-HIGH-002**: Returns correct withdraw count (20 min)
- [ ] **EH-HEALTH-HIGH-001**: Returns HEALTHY when normal (20 min)
- [ ] **EH-HEALTH-HIGH-002**: Returns EMERGENCY when paused (20 min)
- [ ] **EH-CAN-HIGH-001**: canUnpause() returns true after timelock (15 min)
- [ ] **EH-CAN-HIGH-002**: canUnpause() returns false before timelock (15 min)

### LiquidityManager - HIGH Priority Tests (11 hours)

#### deposit() Additional HIGH Tests (see PHASE 1 for first 11 HIGH tests)
- [ ] **LM-DEP-HIGH-012**: Gas usage within expected range (15 min)
- [ ] **LM-DEP-HIGH-013**: Deposit from contract address (vs EOA) (15 min)
- [ ] **LM-DEP-HIGH-014**: ProxyGeneral.mint() authorization check (20 min)

#### withdraw() Additional HIGH Tests (see PHASE 1 for first 12 HIGH tests)
- [ ] **LM-WTH-HIGH-013**: Gas usage within expected range (15 min)
- [ ] **LM-WTH-HIGH-014**: ProxyGeneral.burn() authorization check (20 min)
- [ ] **LM-WTH-HIGH-015**: Withdraw to different address (recipient param) (20 min)

#### setDepositFee() / setWithdrawFee() - HIGH Tests (2 hours)
- [ ] **LM-FEE-HIGH-001**: Change fee during active operations (20 min)
- [ ] **LM-FEE-HIGH-002**: Fee applied to next deposit immediately (15 min)
- [ ] **LM-FEE-HIGH-003**: Fee change event tracking (15 min)
- [ ] **LM-FEE-HIGH-004**: Multiple fee changes in sequence (15 min)
- [ ] **LM-FEE-HIGH-005**: Fee bounds validation edge cases (20 min)
- [ ] **LM-FEE-HIGH-006**: Withdraw fee change during pending withdraws (20 min)

#### setWithdrawLimits() - HIGH Tests (1.5 hours)
- [ ] **LM-LIM-HIGH-001**: Limit change during active withdrawals (20 min)
- [ ] **LM-LIM-HIGH-002**: Decrease limit below current usage (15 min)
- [ ] **LM-LIM-HIGH-003**: Set limit to 0 (effectively disable withdrawals) (15 min)
- [ ] **LM-LIM-HIGH-004**: Increase limit allows immediate withdrawals (15 min)
- [ ] **LM-LIM-HIGH-005**: Multiple tokens limit update (20 min)

#### Toggles & Views - HIGH Tests (1 hour)
- [ ] **LM-TOG-HIGH-001**: Disable deposits during deposit transaction (20 min)
- [ ] **LM-TOG-HIGH-002**: Disable withdrawals during withdraw transaction (20 min)
- [ ] **LM-VIEW-HIGH-001**: calculateDepositShares() accuracy vs actual (20 min)

### SwapManager - HIGH Priority Tests (see PHASE 1)
**Note**: Most HIGH priority SwapManager tests are in Phase 1 (CRITICAL section)

#### Admin Functions - HIGH Tests (2 hours)
- [ ] **SM-ADMIN-HIGH-001**: setMaxSlippage during active swaps (20 min)
- [ ] **SM-ADMIN-HIGH-002**: setSimpleSwapRouter to different router (20 min)
- [ ] **SM-ADMIN-HIGH-003**: setSwapsEnabled(false) blocks new swaps (15 min)
- [ ] **SM-ADMIN-HIGH-004**: setSwapLimits during pending swaps (20 min)
- [ ] **SM-ADMIN-HIGH-005**: emergencyTokenRecovery() execution (25 min)
- [ ] **SM-ADMIN-HIGH-006**: emergencyTokenRecovery() when not paused (revert) (15 min)

#### Validation Functions - HIGH Tests (2 hours)
- [ ] **SM-VAL-HIGH-001**: _validateSwapParameters() comprehensive (25 min)
- [ ] **SM-VAL-HIGH-002**: _validateTokenAddress() inactive token (15 min)
- [ ] **SM-VAL-HIGH-003**: _checkSlippage() calculation (20 min)
- [ ] **SM-VAL-HIGH-004**: _verifySwapResult() balance verification (20 min)
- [ ] **SM-VAL-HIGH-005**: Validation with edge case amounts (20 min)

### Integration Tests - HIGH Priority (5 hours)

#### Deposit Flow Integration (2 hours)
- [ ] **INT-DEP-HIGH-001**: Full deposit flow (ETH → WETH → LP) (30 min)
- [ ] **INT-DEP-HIGH-002**: Deposit → ValueCalculator → pool value update (25 min)
- [ ] **INT-DEP-HIGH-003**: Deposit → ProxyGeneral custody transfer (20 min)
- [ ] **INT-DEP-HIGH-004**: Deposit → fee → FeeRecipient balance (20 min)
- [ ] **INT-DEP-HIGH-005**: Multiple deposits → totalSupply tracking (25 min)

#### Withdraw Flow Integration (2 hours)
- [ ] **INT-WTH-HIGH-001**: Full withdraw flow (LP burn → WETH → ETH) (30 min)
- [ ] **INT-WTH-HIGH-002**: Withdraw → SwapManager → automatic swap (30 min)
- [ ] **INT-WTH-HIGH-003**: Withdraw → ProxyGeneral custody release (25 min)
- [ ] **INT-WTH-HIGH-004**: Withdraw → limit tracking → remaining limits (25 min)

#### Emergency Integration (1 hour)
- [ ] **INT-EMG-HIGH-001**: Pause → all operations blocked (20 min)
- [ ] **INT-EMG-HIGH-002**: Pause propagation across modules (20 min)
- [ ] **INT-EMG-HIGH-003**: Emergency withdraw → asset recovery (20 min)

### Edge Cases - HIGH Priority (3 hours)

#### ProxyGeneral Edge Cases (1 hour)
- [ ] **PG-EDGE-HIGH-001**: Mint/burn atomicity during pause (15 min)
- [ ] **PG-EDGE-HIGH-002**: Approve MAX_UINT256 and spend (20 min)
- [ ] **PG-EDGE-HIGH-003**: Multiple modules access custody (20 min)

#### TokenManager Edge Cases (2 hours)
- [ ] **TM-EDGE-HIGH-001**: Oracle reverts during price fetch (20 min)
- [ ] **TM-EDGE-HIGH-002**: Multiple simultaneous price updates (20 min)
- [ ] **TM-EDGE-HIGH-003**: Token removed while in use (20 min)
- [ ] **TM-EDGE-HIGH-004**: maxTokensPerOperation boundary (10 tokens) (20 min)
- [ ] **TM-EDGE-HIGH-005**: Heartbeat = 0 (instant stale) (20 min)
- [ ] **TM-EDGE-HIGH-006**: Price overflow (uint256 max) (20 min)

---

## 🟡 PHASE 3: MEDIUM PRIORITY (Post-Launch Improvement)

**Priority**: MEDIUM  
**Time**: 22 hours  
**Tests**: 58

### LiquidityManager - MEDIUM Tests (4.5 hours)

#### deposit() - MEDIUM Tests (2 hours)
- [ ] **LM-DEP-MED-001**: Rate limit edge case (exactly at limit) (15 min)
- [ ] **LM-DEP-MED-002**: Rate limit period boundary (15 min)
- [ ] **LM-DEP-MED-003**: Multiple users hitting rate limit (20 min)
- [ ] **LM-DEP-MED-004**: Deposit with msg.value < msg.value claimed (15 min)
- [ ] **LM-DEP-MED-005**: Deposit with extremely small amount (wei) (15 min)
- [ ] **LM-DEP-MED-006**: Deposit with extremely large amount (near uint256 max) (20 min)
- [ ] **LM-DEP-MED-007**: WETH conversion failure handling (20 min)

#### withdraw() - MEDIUM Tests (2 hours)
- [ ] **LM-WTH-MED-001**: Withdraw limit edge (exactly at limit) (15 min)
- [ ] **LM-WTH-MED-002**: Daily limit vs user limit interaction (20 min)
- [ ] **LM-WTH-MED-003**: Withdraw with dust LP amount (15 min)
- [ ] **LM-WTH-MED-004**: Withdraw all users simultaneously (stress test) (20 min)
- [ ] **LM-WTH-MED-005**: Automatic swap slippage scenarios (20 min)
- [ ] **LM-WTH-MED-006**: Withdraw when pool value = 0 (20 min)
- [ ] **LM-WTH-MED-007**: ETH transfer failure (recipient rejects) (20 min)

#### Admin Functions - MEDIUM Tests (30 min)
- [ ] **LM-ADMIN-MED-001**: setFeeRecipient to contract address (10 min)
- [ ] **LM-ADMIN-MED-002**: Toggle functions called rapidly (10 min)
- [ ] **LM-ADMIN-MED-003**: Authorization edge cases (10 min)

### SwapManager - MEDIUM Tests (4 hours)

#### performSwap() - MEDIUM Tests (2.5 hours)
- [ ] **SM-SWAP-MED-001**: Swap with slippage exactly at maxSlippage (20 min)
- [ ] **SM-SWAP-MED-002**: Swap amount exactly at swap limit (20 min)
- [ ] **SM-SWAP-MED-003**: Multiple swaps same pair in sequence (15 min)
- [ ] **SM-SWAP-MED-004**: Swap failure recovery (retry logic) (20 min)
- [ ] **SM-SWAP-MED-005**: DEX router returns less than expected (20 min)
- [ ] **SM-SWAP-MED-006**: Balance verification boundary cases (20 min)
- [ ] **SM-SWAP-MED-007**: Gas usage for complex routing (15 min)
- [ ] **SM-SWAP-MED-008**: Swap stats accuracy over time (20 min)
- [ ] **SM-SWAP-MED-009**: Error tracking per token pair (20 min)

#### Swap Wrappers - MEDIUM Tests (30 min)
- [ ] **SM-WRAP-MED-001**: Wrapper deadline edge cases (15 min)
- [ ] **SM-WRAP-MED-002**: Wrapper parameter validation (15 min)

#### Admin & Validation - MEDIUM Tests (1 hour)
- [ ] **SM-ADMIN-MED-001**: Multiple admin changes in sequence (15 min)
- [ ] **SM-ADMIN-MED-002**: emergencyTokenRecovery edge cases (20 min)
- [ ] **SM-VAL-MED-001**: Validation function gas costs (15 min)
- [ ] **SM-VAL-MED-002**: Edge case validation scenarios (10 min)

### EmergencyHandler - MEDIUM Tests (3 hours)

#### Emergency Operations - MEDIUM Tests (1.5 hours)
- [ ] **EH-PAUSE-MED-001**: Revert if already paused (15 min)
- [ ] **EH-PAUSE-MED-002**: Emergency contacts notified (15 min)
- [ ] **EH-UNPAUSE-MED-001**: Event params correctness (15 min)
- [ ] **EH-UNPAUSE-MED-002**: Cooldown reset after unpause (15 min)
- [ ] **EH-WITHDRAW-MED-001**: Partial failure handling (15 min)
- [ ] **EH-WITHDRAW-MED-002**: Zero balance tokens skipped (15 min)

#### Reporting - MEDIUM Tests (1 hour)
- [ ] **EH-REPORT-MED-001**: Event emitted with correct data (20 min)
- [ ] **EH-REPORT-MED-002**: Multiple reports update lastReport (15 min)
- [ ] **EH-LASTREP-MED-001**: Returns empty if no report (15 min)
- [ ] **EH-STATS-MED-001**: Stats persist across operations (20 min)
- [ ] **EH-HEALTH-MED-001**: Different status levels work (20 min)

#### Contact Management - MEDIUM Tests (30 min)
- [ ] **EH-CONTACT-MED-001**: Multiple contacts managed correctly (15 min)
- [ ] **EH-CONTACT-MED-002**: Contact roles stored/retrieved (15 min)
- [ ] **EH-CAN-MED-001**: canUnpause() if not paused (15 min)

### ProxyGeneral - MEDIUM Tests (30 min)
- [ ] **PG-EDGE-MED-001**: Empty custody withdrawals (10 min)
- [ ] **PG-EDGE-MED-002**: LP decimals consistency check (10 min)
- [ ] **PG-EDGE-MED-003**: Module deauthorization during operation (10 min)

### TokenManager - MEDIUM Tests (1 hour)
- [ ] **TM-EDGE-MED-001**: Token code collision handling (15 min)
- [ ] **TM-EDGE-MED-002**: Empty string token code (15 min)
- [ ] **TM-EDGE-MED-003**: Oracle with wrong decimals (15 min)
- [ ] **TM-EDGE-MED-004**: Get price for non-existent token (15 min)

### ValueCalculator - MEDIUM Tests (30 min)
- [ ] **VC-EDGE-MED-001**: Cache duration changed during calculation (10 min)
- [ ] **VC-EDGE-MED-002**: View vs state-changing consistency (10 min)
- [ ] **VC-EDGE-MED-003**: Event emission for batch calculations (10 min)

### ParameterManager - MEDIUM Tests (30 min)
- [ ] **PM-EDGE-MED-001**: Multiple pending proposals management (15 min)
- [ ] **PM-EDGE-MED-002**: Parameter bounds validation edge cases (15 min)

### Beacon - MEDIUM Tests (20 min)
- [ ] **BCN-EDGE-MED-001**: Empty module name handling (10 min)
- [ ] **BCN-EDGE-MED-002**: Implementation address verification (10 min)

---

## 🟢 PHASE 4: LOW PRIORITY (Nice to Have)

**Priority**: LOW  
**Time**: 3 hours  
**Tests**: 12

### LiquidityManager - LOW Tests (1.5 hours)
- [ ] **LM-DEP-LOW-001**: Deposit gas optimization validation (20 min)
- [ ] **LM-DEP-LOW-002**: Event parameter completeness (15 min)
- [ ] **LM-DEP-LOW-003**: Deposit documentation test (code comments) (10 min)
- [ ] **LM-WTH-LOW-001**: Withdraw gas optimization validation (20 min)
- [ ] **LM-WTH-LOW-002**: Withdraw documentation test (10 min)
- [ ] **LM-ADMIN-LOW-001**: Admin function documentation (15 min)

### SwapManager - LOW Tests (1 hour)
- [ ] **SM-SWAP-LOW-001**: Swap gas optimization (complex routing) (20 min)
- [ ] **SM-SWAP-LOW-002**: Event completeness check (15 min)
- [ ] **SM-SWAP-LOW-003**: Documentation validation (15 min)
- [ ] **SM-ADMIN-LOW-001**: Admin documentation check (10 min)

### EmergencyHandler - LOW Tests (30 min)
- [ ] **EH-PAUSE-LOW-001**: Multiple pause attempts tracked (15 min)
- [ ] **EH-CONTACT-LOW-001**: Contact timestamps tracked (15 min)

---

## 📊 Priority Summary

| Priority | Tests | Time | % Complete |
|----------|-------|------|------------|
| 🔴 CRITICAL | 66 | 22 hours | 0% |
| 🟠 HIGH | 147 | 44 hours | 0% |
| 🟡 MEDIUM | 58 | 18 hours | 0% |
| 🟢 LOW | 12 | 3 hours | 0% |
| **TOTAL** | **283** | **87 hours** | **0%** |

---

## 📝 Implementation Notes

### How to Use This Checklist

1. **Start with Phase 1 (BLOCKERS)**
   - Begin with EmergencyHandler fixes (highest priority)
   - Move to LiquidityManager core tests
   - Complete SwapManager core tests
   - Do NOT proceed to Phase 2 until Phase 1 is 100% complete

2. **Progress Tracking**
   - Check off `[ ]` → `[x]` as each test is completed
   - Update "Progress Dashboard" percentages daily
   - Track time spent vs estimated time

3. **Test Implementation Order**
   - Within each phase: follow CRITICAL → HIGH → MEDIUM → LOW
   - Within each module: follow the order listed (dependencies matter)
   - Some tests have prerequisites (noted in COMPLETE_TEST_SPECIFICATION.md)

4. **Code Organization**
   - Group related tests in same describe() block
   - Follow existing test file naming conventions
   - Add test ID as comment: `// LM-DEP-CRIT-001`

5. **Quality Standards**
   - Every test must be self-contained (no dependencies on other tests)
   - Use beforeEach() for setup, afterEach() for cleanup
   - Follow Arrange-Act-Assert pattern
   - Include both positive and negative cases
   - Verify events, state changes, and balances

### Time Tracking Template

Create a separate file `TEST_PROGRESS.md` to track:

```markdown
# Test Progress Log

## Week 1 (Date - Date)
### Day 1
- [x] EH-FIX-001 (Actual: 12 min, Estimated: 15 min)
- [x] EH-FIX-002 (Actual: 18 min, Estimated: 15 min)
- [ ] EH-FIX-003 (In progress)

**Daily Summary**: 2/20 tests completed, 30 min spent

### Week Summary
**Tests Completed**: X/283
**Time Spent**: X hours
**Remaining**: X hours
```

---

## ✅ Definition of Done

A test is considered complete when:

1. ✅ Test code written and compiles
2. ✅ Test passes consistently (run 3+ times)
3. ✅ Test follows project conventions
4. ✅ Test ID added as comment
5. ✅ Relevant events verified
6. ✅ State changes validated
7. ✅ Gas usage checked (if applicable)
8. ✅ Error messages validated
9. ✅ Code reviewed (if pair programming)
10. ✅ Checkbox marked in this file

---

## 🚀 Quick Start

**To begin implementation:**

1. Open `COMPLETE_TEST_SPECIFICATION.md` for detailed test requirements
2. Start with **EH-FIX-001** (first test in Phase 1)
3. Implement test following specification
4. Run test: `npx hardhat test test/unit/EmergencyHandler.test.ts`
5. Mark checkbox in this file when passing
6. Move to next test

**Command to run specific test:**
```bash
npx hardhat test test/unit/<ModuleName>.test.ts --grep "<test description>"
```

---

**Checklist Version**: 1.0  
**Last Updated**: 2024  
**Total Tests**: 283  
**Estimated Completion**: 87 hours (2-3 weeks with 2-3 developers)

---
