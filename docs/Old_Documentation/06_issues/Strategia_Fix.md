# 📋 ANALISI PROBLEMI E STRATEGIA RISOLUTIVA

---

## 🔍 ANALISI

### Contesto

Il progetto è un **sistema DeFi modulare** composto da 8 smart contracts Solidity (Beacon, ProxyGeneral, TokenManager, ValueCalculator, LiquidityManager, SwapManager, EmergencyHandler, ParameterManager) su blockchain Arbitrum.

Sono stati condotti **3 livelli di analisi**:
1. **Implementation vs Specs** (1972 righe)
2. **Warnings e Dettagli Minori** (7 issue aggiuntivi)
3. **Complete Function Verification** (104 funzioni totali)

**Overall Compliance:** 91% (94/104 funzioni conformi)

### Vincoli / Requisiti

**Vincoli Tecnici:**
- Solidity 0.8.19 (no overflow checks needed)
- Hardhat test environment
- Arbitrum mainnet deployment target
- OpenZeppelin contracts dependencies
- Chainlink oracle integration

**Requisiti Funzionali:**
- Sistema DeFi production-ready
- Audit compliance required
- Gas optimization desirable
- Emergency controls operational
- User-facing functions complete

**Requisiti Non-Funzionali:**
- Security: No critical vulnerabilities
- Performance: Gas-efficient operations
- Maintainability: Clear code structure
- Testability: Full test coverage

### Rischi / Incertezze

**Rischi Identificati:**
1. 🔴 **CRITICAL:** 1 stub function blocca withdraw automatico
2. 🟡 **MEDIUM:** 5 funzioni con logica semplificata/incompleta
3. 🟢 **LOW:** 9 placeholder/enhancement opzionali

**Incertezze:**
- Priorità business tra fix critici vs enhancement
- Timeline deployment (imminente vs pianificato)
- Governance requirements per alcune features
- Budget gas disponibile per optimization

---

## 📊 LISTA COMPLETA PROBLEMI RISCONTRATI

### 🔴 CATEGORIA CRITICAL (1 issue - BLOCKING)

#### **Issue #1 (CRITICAL) - `selectTokenForSwap()` STUB**
- **Modulo:** ValueCalculator.sol line 315
- **Status:** Funzione ritorna `("", 0)` invece di logica completa
- **Impatto:** Sistema NON può fare auto-swap quando WETH insufficiente per withdraw
- **Blocco:** ❌ AUDIT-BLOCKING
- **Effort:** ~150 lines code, 6 ore development
- **Logica Richiesta:**
  1. Get all active tokens and their values
  2. Select token with lowest percentage (avoid depleting single asset)
  3. Calculate amount needed to reach targetValue + 10% buffer
  4. Ensure amount doesn't exceed token balance
- **Specs Reference:** Functional_Specifications_Part1.md lines 1050-1100

---

### 🟡 CATEGORIA MEDIUM (5 issues - SHOULD FIX)

#### **Issue #2 (MEDIUM) - `checkWithdrawLimits()` Logic Simplified**
- **Modulo:** LiquidityManager.sol line ~600
- **Status:** No hourly/daily accumulation calculation
- **Impatto:** Rate limiting works but user info inaccurate
- **Blocco:** ⚠️ Functional but imprecise
- **Effort:** 3 ore (loop implementation + testing)
- **Logica Mancante:** 
  - Loop through last 24 hours calling `proxyGeneral.getHourlyWithdrawn()`
  - Accumulate total withdrawn per hour/day
- **Workaround Attuale:** Delega a ProxyGeneral.trackOperation()

#### **Issue #3 (MEDIUM) - `getRemainingHourlyLimit()` & `getRemainingDailyLimit()` STUB**
- **Modulo:** LiquidityManager.sol lines ~650
- **Status:** Return max limits without usage calculation
- **Impatto:** UI shows incorrect remaining limits
- **Blocco:** 🟢 Non-blocking (UI only)
- **Effort:** 2 ore (integrate with Issue #2 fix)
- **Logica Mancante:** Calculate actual usage and subtract from limits

#### **Issue #4 (MEDIUM) - `authorizeModule()` Breaking Change**
- **Modulo:** ProxyGeneral.sol line 256
- **Status:** Extra parameter `string memory moduleType` not in specs
- **Impatto:** API breaking change - old calls fail
- **Blocco:** 📋 Documentation issue
- **Effort:** 30 minuti (update docs)
- **Scelte:**
  - Option A: Keep new signature, update API_Reference
  - Option B: Remove moduleType parameter (breaking backward compat)
  - **Raccomandazione:** Option A (keep enhancement)

#### **Issue #8 (MEDIUM-LOW) - `estimateSwapGas()` Placeholder**
- **Modulo:** SwapManager.sol line 638
- **Status:** Uses fixed gas estimates instead of router query
- **Impatto:** Inaccurate gas preview for UI
- **Blocco:** 🟢 Non-critical (UI preview only)
- **Effort:** 2 ore (router integration)
- **Note:** Function NOT in specs - enhancement feature

#### **Issue #9 (MEDIUM-LOW) - `getProposal(uint256)` Placeholder**
- **Modulo:** ParameterManager.sol line 731
- **Status:** Returns empty proposal instead of storage retrieval
- **Impatto:** Alternative governance query method unavailable
- **Blocco:** 🟢 Non-critical (name-based queries work)
- **Effort:** 3 ore (storage refactor)
- **Note:** `getActiveProposals()` already works with names

---

### 🟢 CATEGORIA LOW (9 issues - OPTIONAL)

#### **Issue #5 (LOW) - Interface Documentation Incomplete**
- **Modulo:** All interfaces
- **Status:** API_Reference missing 31 enhancement functions
- **Impatto:** Documentation gap
- **Blocco:** 📋 Docs only
- **Effort:** 2 ore (documentation update)

#### **Issue #7 (LOW) - `getPoolInfo()` Token Count Hardcoded**
- **Modulo:** LiquidityManager.sol line 660
- **Status:** Returns `tokensCount = 10` instead of real count
- **Impatto:** UI cosmetic issue
- **Blocco:** 🟢 Non-functional
- **Effort:** 5 minuti
- **Fix:** Call `tokenManager.getTokenCount()`

#### **Issue #10 (LOW) - Asset Snapshot Storage Missing**
- **Modulo:** EmergencyHandler.sol lines 772-788
- **Status:** `getAssetSnapshot()` & `getAllSnapshots()` placeholders
- **Impatto:** No permanent snapshot storage (events exist)
- **Blocco:** 🟢 Enhancement
- **Effort:** 4 ore (storage + gas optimization)

#### **Issue #11 (INFO) - Emergency Contact Timestamp Placeholder**
- **Modulo:** EmergencyHandler.sol line 689
- **Status:** `addedAt` returns current timestamp not actual
- **Impatto:** Cosmetic only
- **Blocco:** 🟢 Non-functional
- **Effort:** 2 ore (storage upgrade)

#### **Issue #12 (INFO) - Obsolete Comment**
- **Modulo:** ValueCalculator.sol line 338
- **Status:** Comment about view compatibility outdated
- **Impatto:** None (implementation correct)
- **Blocco:** 🟢 Cleanup
- **Effort:** 30 secondi

#### **Issue #13 (INFO) - Units Clarification Comment**
- **Modulo:** EmergencyHandler.sol line 329
- **Status:** Helpful comment for maintenance
- **Impatto:** Positive (prevents confusion)
- **Blocco:** ✅ Keep as-is
- **Effort:** 0

#### **Issue #15/19 (LOW) - `getCachedTokenValue()` Visibility Change**
- **Modulo:** ValueCalculator.sol line 282
- **Status:** `external` → `public` (NOT breaking)
- **Impatto:** More flexible, backward compatible
- **Blocco:** ✅ Acceptable
- **Effort:** 0 (optional docs update)

#### **Issue #16/14 (MEDIUM) - Already counted as Issue #4**

#### **Issue #17 (CRITICAL) - Already counted as Issue #1**

#### **Issue #18 (INFO) - 31 Enhancement Functions Not in API_Reference**
- **Modulo:** Various
- **Status:** Documented in ORIGIN_ANALYSIS
- **Impatto:** Documentation gap
- **Blocco:** 📋 Docs expansion needed
- **Effort:** 4 ore (full documentation)
- **Breakdown:**
  - 23 Enhancement working (74%)
  - 8 In specs but not documented (26%)

#### **Issue #20 (MEDIUM) - Already counted as Issue #2-3**

---

## 📈 STATISTICHE PROBLEMI

### Per Severity

```
TOTAL ISSUES: 20 (con duplicati consolidati = 13 unique)

🔴 CRITICAL:  1 (7.7%)  - BLOCKING per audit
🟡 MEDIUM:    5 (38.5%) - SHOULD FIX pre-production  
🟢 LOW:       7 (53.8%) - OPTIONAL enhancements
```

### Per Tipo

```
STUB Functions:        2 (Issue #1, #9)
Simplified Logic:      3 (Issue #2, #3, #8)
Breaking Changes:      1 (Issue #4)
Documentation Gaps:    3 (Issue #5, #18, #12)
Placeholder Storage:   2 (Issue #10, #11)
Cosmetic/Info:         2 (Issue #13, #15)
```

### Per Modulo

```
ValueCalculator:    3 issues (1 CRITICAL)
LiquidityManager:   4 issues (2 MEDIUM)
ProxyGeneral:       1 issue (1 MEDIUM)
SwapManager:        1 issue (1 MEDIUM-LOW)
ParameterManager:   1 issue (1 MEDIUM-LOW)
EmergencyHandler:   3 issues (3 LOW)
Documentation:      2 issues (2 INFO)
```

### Effort Totale

```
MANDATORY (Audit):       6h    (Issue #1)
RECOMMENDED (Prod):      11h   (Issues #2-4, #7-9)
OPTIONAL (Enhancement):  12h   (Issues #5, #10-11, #18)
────────────────────────────────
TOTAL:                   29h   (~4 giorni di lavoro)
```

---

## 🎯 STRATEGIA

### Approccio Scelto

**STRATEGIA INCREMENTALE A 3 SPRINT:**

```
Sprint 1: AUDIT-READY (1 day)
├─ Fix Issue #1 (CRITICAL)
└─ Test coverage + smoke tests

Sprint 2: PRODUCTION-READY (2 days)
├─ Fix Issues #2-4 (MEDIUM core)
├─ Fix Issues #7-9 (MEDIUM-LOW utility)
└─ Full regression testing

Sprint 3: ENHANCEMENT (1.5 days - OPTIONAL)
├─ Complete documentation (Issues #5, #18)
├─ Storage enhancements (Issues #10-11)
└─ Code cleanup (Issue #12)
```

**Motivazione Approccio:**
- ✅ Priorità chiara: BLOCKING → FUNCTIONAL → COSMETIC
- ✅ Testing incrementale ad ogni sprint
- ✅ Sprint 3 opzionale (post-launch)
- ✅ Minimizza regressioni (small batches)

---

### Alternative e Trade-off

#### **Alternativa A: Big Bang Fix (SCONSIGLIATA)**
```
Pro:
+ Tutto risolto in una volta
+ Effort totale leggermente minore (25h vs 29h)

Contro:
- Alto rischio regressioni
- Testing complesso
- No deployment intermedio
- Difficile code review
```

#### **Alternativa B: Solo Critical Fix (MINIMALISTA)**
```
Pro:
+ Audit-ready rapidamente (6h)
+ Rischio minimo
+ Deploy veloce

Contro:
- UI issues rimangono (limiti withdraw)
- Documentation gaps
- Tech debt accumulato
```

#### **Alternativa C: Parallel Tracks (COMPLESSA)**
```
Pro:
+ Development parallelo
+ Più veloce se team > 1
+ Isolamento modifiche

Contro:
- Richiede coordinamento team
- Rischio merge conflicts
- Testing dependencies complesse
```

### Motivazioni Scelta

**Scelto: STRATEGIA INCREMENTALE** perché:

1. ✅ **Risk Management:** Testing ad ogni sprint riduce regressioni
2. ✅ **Flexibility:** Sprint 3 opzionale se timeline stretta
3. ✅ **Audit Focus:** Sprint 1 garantisce audit-ready velocemente
4. ✅ **Production Quality:** Sprint 2 completa funzionalità business-critical
5. ✅ **Maintainability:** Sprint 3 riduce tech debt documentale

**Trade-off Accettati:**
- Effort totale leggermente maggiore (+4h per testing incrementale)
- Timeline più lunga (4.5 giorni vs 3 giorni big bang)
- **Guadagno:** Qualità superiore, rischio inferiore

---

## 📐 DOCUMENTAZIONE

### Schema Logico / Architetturale

```
┌─────────────────────────────────────────────────────────────┐
│                    STRATEGIA RISOLUTIVA                      │
└─────────────────────────────────────────────────────────────┘

SPRINT 1: AUDIT-READY (6h + 2h testing = 8h)
┌──────────────────────────────────────────────────────────────┐
│ Issue #1 (CRITICAL): ValueCalculator.selectTokenForSwap()   │
│                                                               │
│ INPUT:  targetValue (uint256 in wei)                        │
│ OUTPUT: (tokenCode: string, amount: uint256)                │
│                                                               │
│ LOGIC FLOW:                                                  │
│ 1. Get active tokens from TokenManager                      │
│ 2. For each token:                                           │
│    - Get balance from ProxyGeneral                           │
│    - Get price from TokenManager                             │
│    - Calculate value = balance * price / 10^decimals        │
│    - Calculate percentage = value / totalPoolValue          │
│ 3. Sort by percentage (ascending)                            │
│ 4. Select token with LOWEST percentage (protect diversity)  │
│ 5. Calculate amountToSwap:                                   │
│    targetValue * 1.1 (10% buffer) / tokenPrice              │
│ 6. Validate: amountToSwap <= tokenBalance                   │
│ 7. Return (selectedToken, amountToSwap)                     │
│                                                               │
│ EDGE CASES:                                                  │
│ - No tokens available → revert "No swappable tokens"        │
│ - Insufficient balance → try next token                     │
│ - All tokens insufficient → revert "Insufficient liquidity" │
│                                                               │
│ TESTS REQUIRED:                                              │
│ ✓ Normal case: 3 tokens, select lowest %                    │
│ ✓ Edge: target > single token balance                       │
│ ✓ Edge: no tokens available                                 │
│ ✓ Edge: all balances zero                                   │
└──────────────────────────────────────────────────────────────┘

SPRINT 2: PRODUCTION-READY (11h + 4h testing = 15h)
┌──────────────────────────────────────────────────────────────┐
│ Issue #2-3: LiquidityManager Rate Limiting                  │
│                                                               │
│ CURRENT STATE:                                               │
│ - checkWithdrawLimits() validates but no accumulation       │
│ - getRemainingLimits() return max without usage calc        │
│                                                               │
│ NEW IMPLEMENTATION:                                          │
│ 1. checkWithdrawLimits():                                    │
│    - Loop last 24 hours (block.timestamp/3600)              │
│    - Call proxyGeneral.getHourlyWithdrawn(user, hour)       │
│    - Accumulate hourly total                                │
│    - Accumulate daily total (last 24h)                      │
│    - Validate against limits                                │
│                                                               │
│ 2. getRemainingHourlyLimit():                                │
│    currentHour = block.timestamp / 3600                      │
│    used = proxyGeneral.getHourlyWithdrawn(user, currentHour)│
│    return withdrawLimits.hourlyLimit - used                 │
│                                                               │
│ 3. getRemainingDailyLimit():                                 │
│    totalUsed = 0                                             │
│    for (i = 0; i < 24; i++):                                │
│        hour = (currentHour - i)                              │
│        totalUsed += proxyGeneral.getHourlyWithdrawn(u, hour)│
│    return withdrawLimits.dailyLimit - totalUsed             │
│                                                               │
│ GAS OPTIMIZATION:                                            │
│ - Cache currentHour calculation                              │
│ - Early exit if totalUsed > limit                           │
│                                                               │
│ TESTS:                                                       │
│ ✓ Multiple withdraws within hour                            │
│ ✓ Withdraws spanning multiple hours                         │
│ ✓ 24-hour boundary crossing                                 │
│ ✓ Limit enforcement                                          │
└──────────────────────────────────────────────────────────────┘
│ Issue #4: authorizeModule() Documentation                   │
│ - Update API_Reference.md with moduleType parameter         │
│ - Update event signature documentation                       │
│ - Add migration notes if needed                              │
└──────────────────────────────────────────────────────────────┘
│ Issue #7: getPoolInfo() Token Count Fix                     │
│ - Replace hardcoded 10 with:                                 │
│   ITokenManager(beacon.getImplementation("TokenManager"))   │
│     .getTokenCount()                                         │
└──────────────────────────────────────────────────────────────┘
│ Issue #8-9: Placeholder Functions                           │
│ - estimateSwapGas(): Call router.getAmountsOut() for real   │
│ - getProposal(): Add proposalById mapping + nextProposalId  │
└──────────────────────────────────────────────────────────────┘

SPRINT 3: ENHANCEMENT (OPTIONAL - 12h)
┌──────────────────────────────────────────────────────────────┐
│ Issue #5, #18: Complete API Documentation                   │
│ - Document 31 enhancement functions                          │
│ - Add "Implementation Notes" sections                        │
│ - Mark placeholder functions                                 │
│ - Update function signatures                                 │
└──────────────────────────────────────────────────────────────┘
│ Issue #10-11: Storage Enhancements                          │
│ - EmergencyHandler snapshot storage                          │
│ - Contact timestamp tracking                                 │
│ - Gas analysis + optimization                                │
└──────────────────────────────────────────────────────────────┘
│ Issue #12: Code Cleanup                                      │
│ - Remove obsolete comments                                   │
│ - Update inline documentation                                │
└──────────────────────────────────────────────────────────────┘
```

### API / Interfacce

**Nessuna modifica alle interfacce pubbliche richiesta** tranne:

```solidity
// Issue #4: API_Reference documentation update (no code change)
// Current implementation KEPT as-is (backward compat with extra param):
function authorizeModule(address module, string memory moduleType) 
    external onlyOwner;

// Issue #1: Implementation required (interface già presente):
interface IValueCalculator {
    function selectTokenForSwap(uint256 targetValue) 
        external view 
        returns (string memory tokenCode, uint256 amount);
}
```

### Impatti / Note Tecniche

#### **Issue #1 - selectTokenForSwap()**

**Dipendenze:**
- TokenManager: `getActiveTokens()`, `getTokenPrice()`, `getTokenInfo()`
- ProxyGeneral: `getAssetBalance()`
- ValueCalculator: `getTotalPoolValue()` (for percentage calc)

**Gas Cost Estimate:**
- Base: ~50k gas
- Per token iteration: ~5k gas
- Total (3 tokens): ~65k gas
- **Ottimizzazione:** Cache token prices se chiamato più volte

**Security Considerations:**
- ✅ No reentrancy risk (view function)
- ✅ No overflow risk (Solidity 0.8+)
- ⚠️ **Oracle manipulation:** Use Chainlink price validations
- ⚠️ **Slippage:** 10% buffer potrebbe non bastare in volatilità alta

#### **Issue #2-3 - Rate Limiting**

**Dipendenze:**
- ProxyGeneral: `getHourlyWithdrawn()` (già presente)
- Withdraw limits storage (già presente)

**Gas Cost Estimate:**
- checkWithdrawLimits(): +~15k gas (24 SLOAD iterations)
- getRemainingLimits(): +~30k gas (24 SLOAD + accumulation)

**Ottimizzazioni Possibili:**
- Cache mapping reads in memory
- Early exit strategies
- Consider recent hours only (8h instead of 24h)

**Breaking Changes:**
- ❌ None - solo enhancement logica interna

#### **Issue #8 - estimateSwapGas()**

**Dipendenze:**
- SimpleSwap router: `getAmountsOut()` or equivalent
- Token pair addresses

**Gas Cost:**
- Current (placeholder): ~3k gas
- New (router call): ~25k gas
- **Trade-off:** Accuracy vs cost

**Alternative:**
- Keep placeholder per UI fast preview
- Add `estimateSwapGasAccurate()` per real estimation

#### **Issue #9 - getProposal()**

**Storage Impact:**
```solidity
// New storage needed:
mapping(uint256 => Parameter) private proposalById;
uint256 private nextProposalId;

// Modified function:
function proposeParameterChange(...) {
    // ... existing logic
    proposalById[nextProposalId] = parameters[parameterName];
    nextProposalId++;
}
```

**Migration:** Not needed (additive change)

---

## 📝 TODO

### Sprint 1: AUDIT-READY (1 day)

- [ ] **Step 1.1:** Implementare `selectTokenForSwap()` in ValueCalculator.sol
  - [ ] 1.1a: Scrivere logica core (get tokens, calc values, sort)
  - [ ] 1.1b: Implementare selezione token con lowest percentage
  - [ ] 1.1c: Calcolare amount con 10% buffer
  - [ ] 1.1d: Gestire edge cases (no tokens, insufficient balance)
  - [ ] 1.1e: Add comprehensive NatSpec documentation
  - **Effort:** 4-5 ore
  - **Files:** ValueCalculator.sol lines 315-330

- [ ] **Step 1.2:** Scrivere unit tests per `selectTokenForSwap()`
  - [ ] 1.2a: Test normal case (3 tokens, select lowest %)
  - [ ] 1.2b: Test edge case (target > single token)
  - [ ] 1.2c: Test edge case (no tokens available)
  - [ ] 1.2d: Test edge case (all balances zero)
  - [ ] 1.2e: Test buffer calculation (10% extra)
  - **Effort:** 2 ore
  - **Files:** `test/ValueCalculator.test.ts` (new or extend existing)

- [ ] **Step 1.3:** Run smoke tests + verify no regressions
  - [ ] 1.3a: Compile contracts (`npx hardhat compile`)
  - [ ] 1.3b: Run full test suite
  - [ ] 1.3c: Test integration withdraw + swap scenario
  - **Effort:** 1 ora

- [ ] **Step 1.4:** Code review Sprint 1
  - [ ] 1.4a: Security review (oracle manipulation, overflow)
  - [ ] 1.4b: Gas optimization review
  - [ ] 1.4c: Documentation completeness
  - **Effort:** 1 ora

**Sprint 1 Deliverable:** Sistema audit-ready con Issue #1 risolto

---

### Sprint 2: PRODUCTION-READY (2 days)

- [ ] **Step 2.1:** Implementare rate limiting accumulation (Issue #2-3)
  - [ ] 2.1a: Refactor `checkWithdrawLimits()` con loop 24h
  - [ ] 2.1b: Implementare `getRemainingHourlyLimit()` con calcolo real
  - [ ] 2.1c: Implementare `getRemainingDailyLimit()` con accumulo 24h
  - [ ] 2.1d: Gas optimization (caching, early exit)
  - [ ] 2.1e: Update NatSpec documentation
  - **Effort:** 3 ore
  - **Files:** `contracts/LiquidityManager.sol` lines 600-680

- [ ] **Step 2.2:** Unit tests rate limiting
  - [ ] 2.2a: Test multiple withdraws within hour
  - [ ] 2.2b: Test withdraws spanning multiple hours
  - [ ] 2.2c: Test 24-hour boundary crossing
  - [ ] 2.2d: Test limit enforcement accuracy
  - [ ] 2.2e: Test getRemainingLimits() accuracy
  - **Effort:** 2 ore
  - **Files:** `test/LiquidityManager.test.ts`

- [ ] **Step 2.3:** Fix getPoolInfo() token count (Issue #7)
  - [ ] 2.3a: Replace hardcoded 10 with TokenManager call
  - [ ] 2.3b: Add error handling for TokenManager unavailable
  - [ ] 2.3c: Test con 0, 1, 5, 10 tokens
  - **Effort:** 30 minuti
  - **Files:** `contracts/LiquidityManager.sol` line 660

- [ ] **Step 2.4:** Update API documentation (Issue #4)
  - [ ] 2.4a: Update authorizeModule signature in API_Reference.md
  - [ ] 2.4b: Update ModuleAuthorized event documentation
  - [ ] 2.4c: Add migration notes se necessario
  - **Effort:** 30 minuti
  - **Files:** API_Reference.md

- [ ] **Step 2.5:** Implementare estimateSwapGas() (Issue #8 - OPTIONAL)
  - [ ] 2.5a: Integrate con SimpleSwap router getAmountsOut()
  - [ ] 2.5b: Handle router unavailable gracefully
  - [ ] 2.5c: Add tests per accuracy
  - **Effort:** 2 ore (OPTIONAL - può essere skippato)
  - **Files:** SwapManager.sol line 638

- [ ] **Step 2.6:** Implementare getProposal(uint256) (Issue #9 - OPTIONAL)
  - [ ] 2.6a: Add proposalById mapping storage
  - [ ] 2.6b: Update proposeParameterChange() per salvare con ID
  - [ ] 2.6c: Implement retrieval logic
  - [ ] 2.6d: Add tests
  - **Effort:** 3 ore (OPTIONAL)
  - **Files:** ParameterManager.sol line 731

- [ ] **Step 2.7:** Full regression testing
  - [ ] 2.7a: Run complete test suite
  - [ ] 2.7b: Integration tests deposit → withdraw → swap
  - [ ] 2.7c: Gas benchmarking (before vs after)
  - [ ] 2.7d: Load testing (multiple users, edge cases)
  - **Effort:** 3 ore

- [ ] **Step 2.8:** Code review Sprint 2
  - [ ] 2.8a: Security review
  - [ ] 2.8b: Gas optimization review
  - [ ] 2.8c: User experience validation (UI limits correct)
  - **Effort:** 1 ora

**Sprint 2 Deliverable:** Sistema production-ready con funzionalità complete

---

### Sprint 3: ENHANCEMENT (1.5 days - OPTIONAL)

- [ ] **Step 3.1:** Complete API_Reference documentation (Issue #5, #18)
  - [ ] 3.1a: Document 31 enhancement functions
  - [ ] 3.1b: Add Implementation Notes sections
  - [ ] 3.1c: Mark placeholder functions clearly
  - [ ] 3.1d: Update all function signatures
  - [ ] 3.1e: Add usage examples per enhancement functions
  - **Effort:** 4 ore
  - **Files:** API_Reference.md

- [ ] **Step 3.2:** Implement snapshot storage (Issue #10)
  - [ ] 3.2a: Add snapshot storage mapping
  - [ ] 3.2b: Update captureAssetSnapshot() to persist
  - [ ] 3.2c: Implement getAssetSnapshot() retrieval
  - [ ] 3.2d: Implement getAllSnapshots() with pagination
  - [ ] 3.2e: Gas analysis + optimization
  - [ ] 3.2f: Tests per storage/retrieval
  - **Effort:** 4 ore
  - **Files:** EmergencyHandler.sol lines 772-788

- [ ] **Step 3.3:** Implement contact timestamp tracking (Issue #11)
  - [ ] 3.3a: Upgrade ContactInfo struct with addedAt
  - [ ] 3.3b: Update addEmergencyContact() to store timestamp
  - [ ] 3.3c: Update getAllEmergencyContacts() to return real timestamps
  - [ ] 3.3d: Tests per timestamp accuracy
  - **Effort:** 2 ore
  - **Files:** EmergencyHandler.sol line 689

- [ ] **Step 3.4:** Code cleanup (Issue #12)
  - [ ] 3.4a: Remove obsolete comment in ValueCalculator line 338
  - [ ] 3.4b: Update inline documentation where needed
  - [ ] 3.4c: Format code consistency check
  - **Effort:** 30 minuti
  - **Files:** ValueCalculator.sol

- [ ] **Step 3.5:** Final documentation pass
  - [ ] 3.5a: Update README.md with deployment notes
  - [ ] 3.5b: Generate Solidity docs (natspec → markdown)
  - [ ] 3.5c: Create CHANGELOG.md
  - **Effort:** 1 ora

- [ ] **Step 3.6:** Final regression + documentation review
  - [ ] 3.6a: Full test suite
  - [ ] 3.6b: Documentation accuracy check
  - [ ] 3.6c: Gas benchmarking final
  - **Effort:** 1 ora

**Sprint 3 Deliverable:** Sistema con documentazione completa e enhancements opzionali

---

## 📈 METRICHE SUCCESS

### Sprint 1 Success Criteria
- ✅ Issue #1 risolto e testato
- ✅ `selectTokenForSwap()` ritorna token corretto
- ✅ All tests passing
- ✅ No regressions
- ✅ Code review completato

### Sprint 2 Success Criteria
- ✅ Issues #2-4 risolti
- ✅ Rate limiting accuracy al 100%
- ✅ UI limits display corretti
- ✅ Documentation aggiornata
- ✅ Full regression tests passing
- ✅ Gas cost < +20% rispetto a baseline

### Sprint 3 Success Criteria
- ✅ API_Reference completo (100% functions documented)
- ✅ Snapshot storage operativo
- ✅ Contact timestamps accurati
- ✅ Code cleanup completato
- ✅ CHANGELOG pubblicato

---

## ⚠️ RISCHI E MITIGAZIONI

### Rischi Tecnici

**Rischio 1:** Regressioni in Sprint 2
- **Probabilità:** MEDIA
- **Impatto:** ALTO
- **Mitigazione:** 
  - Testing incrementale dopo ogni fix
  - Code review obbligatorio
  - Smoke tests automatizzati

**Rischio 2:** Gas cost troppo alto per rate limiting
- **Probabilità:** BASSA
- **Impatto:** MEDIO
- **Mitigazione:**
  - Gas benchmarking preventivo
  - Optimization strategies pronte (caching, early exit)
  - Fallback: reduce time window (8h instead of 24h)

**Rischio 3:** Oracle manipulation in selectTokenForSwap
- **Probabilità:** BASSA
- **Impatto:** CRITICO
- **Mitigazione:**
  - Use existing Chainlink validations (answeredInRound, updatedAt)
  - 10% buffer già presente
  - Slippage protection in SwapManager

### Rischi Organizzativi

**Rischio 4:** Timeline deployment imminente
- **Probabilità:** ?
- **Impatto:** ALTO
- **Mitigazione:**
  - Sprint 1 priorità assoluta (audit-ready)
  - Sprint 2-3 opzionali se timeline stretta
  - Parallel track documentation (non-blocking)

**Rischio 5:** Scope creep in Sprint 3
- **Probabilità:** MEDIA
- **Impatto:** MEDIO
- **Mitigazione:**
  - Sprint 3 chiaramente marcato OPTIONAL
  - Time-boxing rigoroso
  - Can be done post-launch

---

## 🎯 DECISIONI ARCHITETTURALI

### Decisione 1: Keep authorizeModule() Extra Parameter
**Rationale:** Enhancement non rompe backward compatibility se gestito correttamente
**Alternative:** Remove parameter (breaking existing calls)
**Chosen:** Keep + update docs
**Impact:** Positive (better event tracking)

### Decisione 2: 24-Hour Window per Rate Limiting
**Rationale:** Specs richiedono daily limits, 24h è standard
**Alternative:** 8h window (less gas)
**Chosen:** 24h full compliance
**Impact:** +15k gas per check (acceptable)

### Decisione 3: 10% Buffer in selectTokenForSwap
**Rationale:** Specs specification + slippage protection
**Alternative:** Configurable buffer
**Chosen:** Fixed 10% (simplicity)
**Impact:** Slightly over-swap (acceptable trade-off)

### Decisione 4: Sprint 3 Optional
**Rationale:** Documentation/enhancements non-blocking
**Alternative:** Make Sprint 3 mandatory
**Chosen:** Optional (flexibility)
**Impact:** Faster time-to-audit if needed

---

**Fine Piano Strategico**