# 📋 Test Planning Strategy - Complete Test Specification

**Created**: 25 Ottobre 2025  
**Goal**: 100% Test Coverage con approccio sistematico  
**Estimated Total Time**: 12-15 ore

---

## 🎯 Obiettivo

Creare un **documento master di test specification** che:
1. Lista TUTTE le funzioni di ogni contratto
2. Identifica TUTTI i test già scritti per ogni funzione
3. Lista TUTTI i test mancanti per ogni funzione
4. Prioritizza ogni test (CRITICAL, HIGH, MEDIUM, LOW)
5. Stima tempo di implementazione

---

## 📊 Struttura Documento Finale

```
COMPLETE_TEST_SPECIFICATION.md
│
├─ Module 1: LiquidityManager
│  ├─ Overview (contratto, dependencies, priority)
│  ├─ Function 1: deposit()
│  │  ├─ Signature & Purpose
│  │  ├─ ✅ Existing Tests (da test file corrente)
│  │  ├─ ❌ Missing Tests
│  │  │  ├─ CRITICAL (security, funds safety)
│  │  │  ├─ HIGH (core logic)
│  │  │  ├─ MEDIUM (edge cases)
│  │  │  └─ LOW (nice to have)
│  │  └─ Time Estimate
│  ├─ Function 2: withdraw()
│  │  └─ ... (stessa struttura)
│  └─ Summary (totale test needed, time estimate)
│
├─ Module 2: SwapManager
│  └─ ... (stessa struttura)
│
├─ Module 3: EmergencyHandler
│  └─ ... (stessa struttura)
│
└─ Module 4-8: Altri moduli
   └─ ... (già completati al 100%)
```

---

## 🔍 Metodologia di Analisi

### Step 1: Inventario Funzioni
**Per ogni contratto:**
```bash
1. Leggi il file .sol
2. Estrai TUTTE le funzioni external/public
3. Categorizza per tipo:
   - Admin functions (onlyOwner)
   - User functions (depositi, withdraw, swap)
   - View functions (query dati)
   - Internal/helper functions (se rilevanti)
```

### Step 2: Analisi Test Esistenti
**Per ogni funzione:**
```bash
1. Apri il file test corrispondente (.test.ts o .simple.test.ts)
2. Cerca tutti gli "it()" che testano quella funzione
3. Identifica COSA viene testato:
   - Success case?
   - Revert cases?
   - Edge cases?
   - Integration with other modules?
4. Marca con ✅ i test già presenti
```

### Step 3: Gap Analysis
**Per ogni funzione:**
```bash
1. Analizza la logica interna della funzione
2. Identifica TUTTE le condizioni/branches:
   - require() statements
   - if/else branches
   - Loop iterations
   - External calls
   - State changes
   - Events
3. Per ogni branch, verifica se esiste un test
4. Se manca, aggiungilo alla lista "Missing Tests"
```

### Step 4: Prioritizzazione
**Criteri:**
```
CRITICAL:
- Security controls (access control, reentrancy)
- Funds safety (transfers, calculations)
- State integrity (balances, supply)

HIGH:
- Core business logic (deposit, withdraw, swap)
- Fee calculations
- Limit enforcement
- Event emissions (audit trail)

MEDIUM:
- Edge cases (zero amounts, max values)
- Error messages correctness
- Gas optimization
- Integration with dependencies

LOW:
- Nice to have (extra validations)
- Documentation tests
- Code coverage fillers
```

---

## 📝 Template per Ogni Funzione

```markdown
### Function: deposit(tokenCode, amount)

**Signature:**
```solidity
function deposit(string memory tokenCode, uint256 amount) 
    external 
    whenNotPaused 
    nonReentrant 
    returns (uint256 shares)
```

**Purpose:** Accept user deposits, mint LP tokens

**Dependencies:** ProxyGeneral, ValueCalculator, TokenManager

---

#### ✅ Existing Tests (Total: 3)

| Test ID | Description | Location | Status |
|---------|-------------|----------|--------|
| EXIST-001 | Should allow deposit when enabled | LiquidityManager.simple.test.ts:L125 | ✅ Pass |
| EXIST-002 | Should revert when deposits disabled | LiquidityManager.simple.test.ts:L132 | ✅ Pass |
| EXIST-003 | Should calculate shares correctly (view) | LiquidityManager.simple.test.ts:L178 | ✅ Pass |

---

#### ❌ Missing Tests (Total: 29)

##### 🔴 CRITICAL Priority (8 tests)

| Test ID | Description | Rationale | Time Est. |
|---------|-------------|-----------|-----------|
| CRIT-001 | Revert if reentrancy attempted | Security: Funds safety | 15 min |
| CRIT-002 | Revert if contract paused | Security: Emergency control | 10 min |
| CRIT-003 | Correct amount transferred to ProxyGeneral | Funds: Transfer accuracy | 20 min |
| CRIT-004 | LP tokens minted to correct user | Funds: Ownership | 15 min |
| CRIT-005 | TotalSupply increases by shares | State: Supply integrity | 15 min |
| CRIT-006 | Fee correctly sent to feeRecipient | Funds: Fee collection | 20 min |
| CRIT-007 | ProxyGeneral balance increases correctly | State: Custody | 15 min |
| CRIT-008 | Revert if transferFrom fails | Security: Transfer validation | 15 min |

**Subtotal CRITICAL: ~2 hours**

##### 🟠 HIGH Priority (12 tests)

| Test ID | Description | Rationale | Time Est. |
|---------|-------------|-----------|-----------|
| HIGH-001 | Revert if amount = 0 | Logic: Input validation | 10 min |
| HIGH-002 | Revert if amount < minDeposit | Logic: Minimum enforcement | 10 min |
| HIGH-003 | Revert if tokenCode not registered | Logic: Token validation | 10 min |
| HIGH-004 | Revert if user has insufficient balance | Logic: Balance check | 15 min |
| HIGH-005 | Revert if user has insufficient allowance | Logic: Approval check | 15 min |
| HIGH-006 | First deposit: shares = amount | Logic: Initial deposit | 20 min |
| HIGH-007 | Shares calculated as (amount * supply) / poolValue | Logic: Share formula | 20 min |
| HIGH-008 | Fee = (amount * depositFee) / 10000 | Logic: Fee calculation | 15 min |
| HIGH-009 | NetAmount = amount - fee | Logic: Net calculation | 10 min |
| HIGH-010 | Deposited event emitted with correct params | Audit: Event tracking | 15 min |
| HIGH-011 | ValueCalculator.getTotalPoolValue() called | Integration: Value fetch | 15 min |
| HIGH-012 | ProxyGeneral.mint() called with correct params | Integration: LP minting | 15 min |

**Subtotal HIGH: ~3 hours**

##### 🟡 MEDIUM Priority (7 tests)

| Test ID | Description | Rationale | Time Est. |
|---------|-------------|-----------|-----------|
| MED-001 | Large deposit doesn't cause overflow | Edge: Max values | 15 min |
| MED-002 | Small deposit doesn't round to 0 shares | Edge: Min values | 15 min |
| MED-003 | Pool value = 0 handled correctly | Edge: Empty pool | 20 min |
| MED-004 | Deposit with depositFee = 0 (no fee) | Edge: Zero fee | 10 min |
| MED-005 | Multiple consecutive deposits increase supply | State: Accumulation | 15 min |
| MED-006 | Gas usage within acceptable range (<250k) | Optimization: Gas | 10 min |
| MED-007 | Correct revert message for each error | UX: Error clarity | 15 min |

**Subtotal MEDIUM: ~1.5 hours**

##### 🟢 LOW Priority (2 tests)

| Test ID | Description | Rationale | Time Est. |
|---------|-------------|-----------|-----------|
| LOW-001 | Deposit from different users in same block | Concurrency: Ordering | 10 min |
| LOW-002 | Deposit with ERC20 tokens of different decimals | Compatibility: Decimals | 15 min |

**Subtotal LOW: ~30 min**

---

#### 📊 Function Summary

| Category | Existing | Missing | Total Needed |
|----------|----------|---------|--------------|
| CRITICAL | 0 | 8 | 8 |
| HIGH | 3 | 12 | 15 |
| MEDIUM | 0 | 7 | 7 |
| LOW | 0 | 2 | 2 |
| **TOTAL** | **3** | **29** | **32** |

**Time Estimate:** 
- CRITICAL: 2h
- HIGH: 3h  
- MEDIUM: 1.5h
- LOW: 0.5h
- **Total: ~7 hours**

---
```

---

## 🗂️ Moduli da Analizzare

### Priority 1: CRITICAL (Gaps maggiori)
```
1. LiquidityManager (4 funzioni non testate)
   - deposit()
   - withdraw()
   - processDeposit() [internal ma critical]
   - processWithdrawal() [internal ma critical]

2. SwapManager (9 funzioni non testate)
   - executeSwap()
   - executeMultiHopSwap()
   - calculateMinAmountOut()
   - validateSwapParameters()
   - _executeUniswapV3Swap()
   - _executeCamelotSwap()
   - _execute1inchSwap()
   - getSwapQuote()
   - estimateGas()

3. EmergencyHandler (8 funzioni con problemi)
   - emergencyUnpause()
   - emergencyWithdraw()
   - getLastEmergencyReport()
   - getEmergencyStats()
   - getSystemHealthStatus()
   - Asset snapshot logic
   - Cooldown enforcement
   - Cross-module pause
```

### Priority 2: COMPLETENESS (Già al 100% funzioni, ma logiche mancanti)
```
4. ProxyGeneral (logiche edge case)
5. TokenManager (oracle failure scenarios)
6. ValueCalculator (complex portfolio cases)
7. ParameterManager (timelock edge cases)
8. Beacon (upgrade scenarios)
```

---

## ⏱️ Time Estimates

### Per Modulo
```
LiquidityManager:  ~12 ore (4 funzioni × 3h media)
SwapManager:       ~18 ore (9 funzioni × 2h media)
EmergencyHandler:  ~6 ore  (8 funzioni × 45min media)
Altri moduli:      ~8 ore  (edge cases completion)
────────────────────────────────────────────────
TOTALE:            ~44 ore test implementation

Document creation: ~6 ore
Review & refine:   ~2 ore
────────────────────────────────────────────────
GRAND TOTAL:       ~52 ore
```

### Breakdown per Phase
```
Phase 1: Document Creation (6h)
├─ LiquidityManager analysis: 1.5h
├─ SwapManager analysis: 2h
├─ EmergencyHandler analysis: 1h
├─ Altri moduli analysis: 1h
└─ Review & formatting: 0.5h

Phase 2: CRITICAL Tests (12h)
├─ LiquidityManager CRITICAL: 4h
├─ SwapManager CRITICAL: 6h
└─ EmergencyHandler CRITICAL: 2h

Phase 3: HIGH Tests (20h)
├─ LiquidityManager HIGH: 8h
├─ SwapManager HIGH: 10h
└─ EmergencyHandler HIGH: 2h

Phase 4: MEDIUM Tests (10h)
├─ All modules MEDIUM tests
└─ Edge cases completion

Phase 5: LOW + Integration (10h)
├─ LOW priority tests: 4h
├─ Integration tests: 6h
```

---

## 🎯 Deliverables

### 1. COMPLETE_TEST_SPECIFICATION.md
**Content:**
- Inventario completo di TUTTE le funzioni
- Test esistenti mappati 1:1
- Test mancanti categorizzati e prioritizzati
- Stime tempo per implementazione

**Size:** ~3000-4000 righe

### 2. TEST_IMPLEMENTATION_CHECKLIST.md
**Content:**
- Checklist operativa per implementazione
- Test IDs da implementare in ordine
- Progress tracking (checkboxes)

**Size:** ~500-800 righe

### 3. Updated Test Files
**Content:**
- Nuovi test implementati seguendo la spec
- Organizzati per priorità
- Con commenti // TEST ID: CRIT-001

---

## 🔄 Workflow

```
Step 1: Create Strategy Doc (questo file) ✅
   └─ Define methodology
   └─ Create templates
   └─ Estimate time

Step 2: Analyze Module 1 (LiquidityManager)
   └─ Read contract → extract functions
   └─ Read test file → map existing tests
   └─ Gap analysis → identify missing tests
   └─ Categorize by priority
   └─ Write to COMPLETE_TEST_SPECIFICATION.md

Step 3: Repeat for Module 2 (SwapManager)
   └─ Same process as Step 2

Step 4: Repeat for Module 3 (EmergencyHandler)
   └─ Same process as Step 2

Step 5: Quick pass on Modules 4-8
   └─ Identify missing edge cases only
   └─ (già 100% funzioni coperte)

Step 6: Create Implementation Checklist
   └─ Extract all test IDs
   └─ Order by priority
   └─ Add checkboxes

Step 7: Review & Validation
   └─ Cross-check completeness
   └─ Validate time estimates
   └─ Get user approval

Step 8: Implementation (separate phase)
   └─ Follow checklist
   └─ Write tests in order
   └─ Track progress
```

---

## 📋 TODO List

### Phase 1: Document Creation
- [ ] **Task 1.1**: Analyze LiquidityManager.sol
  - [ ] Extract all functions (signatures)
  - [ ] Identify dependencies
  - [ ] Categorize by type (admin, user, view)
  - **Time**: 30 min

- [ ] **Task 1.2**: Analyze LiquidityManager tests
  - [ ] Read LiquidityManager.simple.test.ts
  - [ ] Read LiquidityManager.test.ts (if exists)
  - [ ] Map existing tests to functions
  - [ ] Identify what each test covers
  - **Time**: 45 min

- [ ] **Task 1.3**: LiquidityManager Gap Analysis
  - [ ] For deposit(): list all missing tests
  - [ ] For withdraw(): list all missing tests
  - [ ] For other functions: list missing tests
  - [ ] Categorize by priority (CRIT/HIGH/MED/LOW)
  - **Time**: 1 hour

- [ ] **Task 1.4**: Write LiquidityManager section
  - [ ] Create structured markdown section
  - [ ] Add tables with test IDs
  - [ ] Add time estimates
  - [ ] Add summary stats
  - **Time**: 45 min

- [ ] **Task 1.5**: Repeat for SwapManager
  - [ ] Extract functions (30 min)
  - [ ] Analyze tests (45 min)
  - [ ] Gap analysis (1.5h)
  - [ ] Write section (1h)
  - **Time**: 3.25 hours

- [ ] **Task 1.6**: Repeat for EmergencyHandler
  - [ ] Extract functions (20 min)
  - [ ] Analyze tests (30 min)
  - [ ] Gap analysis (45 min)
  - [ ] Write section (30 min)
  - **Time**: 2 hours

- [ ] **Task 1.7**: Quick pass on other modules
  - [ ] ProxyGeneral: edge cases only (30 min)
  - [ ] TokenManager: edge cases only (30 min)
  - [ ] ValueCalculator: edge cases only (30 min)
  - [ ] ParameterManager: edge cases only (20 min)
  - [ ] Beacon: edge cases only (10 min)
  - **Time**: 2 hours

- [ ] **Task 1.8**: Create summary & statistics
  - [ ] Total tests by priority
  - [ ] Total time estimates
  - [ ] Coverage projections
  - **Time**: 30 min

- [ ] **Task 1.9**: Review & validation
  - [ ] Cross-check completeness
  - [ ] Validate categories
  - [ ] Proofread
  - **Time**: 1 hour

**Phase 1 Total: ~6 hours**

---

### Phase 2: Implementation Planning
- [ ] **Task 2.1**: Create TEST_IMPLEMENTATION_CHECKLIST.md
  - [ ] Extract all test IDs from spec
  - [ ] Order by priority (CRIT → HIGH → MED → LOW)
  - [ ] Add checkboxes for tracking
  - [ ] Add notes/dependencies
  - **Time**: 1 hour

- [ ] **Task 2.2**: Setup test templates
  - [ ] Create boilerplate for each priority
  - [ ] Setup fixtures if needed
  - [ ] Prepare mock contracts
  - **Time**: 1 hour

**Phase 2 Total: ~2 hours**

---

### Phase 3: User Review & Approval
- [ ] **Task 3.1**: Present document to user
- [ ] **Task 3.2**: Discuss priorities
- [ ] **Task 3.3**: Adjust based on feedback
- [ ] **Task 3.4**: Get approval to proceed

**Phase 3 Total: ~1 hour (user interaction)**

---

### Phase 4: Implementation (Future)
*This will be a separate phase after approval*

---

## 📊 Expected Outcomes

### After Document Creation:
```
✅ Complete inventory of all functions (72 functions)
✅ All existing tests mapped (343 tests)
✅ All missing tests identified (~150-200 tests)
✅ Priority assigned to each missing test
✅ Time estimates for implementation
✅ Clear roadmap for 100% coverage
```

### After Implementation:
```
✅ 493+ total tests (vs 363 current)
✅ 95%+ function coverage
✅ 90%+ line coverage
✅ 85%+ branch coverage
✅ All CRITICAL paths tested
✅ Production-ready test suite
```

---

## 🎨 Document Format Standards

### Test ID Format
```
PRIORITY-SEQUENCE
Examples:
- CRIT-001, CRIT-002, ...
- HIGH-001, HIGH-002, ...
- MED-001, MED-002, ...
- LOW-001, LOW-002, ...
```

### Table Format
```markdown
| Test ID | Description | Rationale | Time Est. | Status |
|---------|-------------|-----------|-----------|--------|
| CRIT-001 | Test description | Why critical | 15 min | ⬜ |
```

### Section Hierarchy
```
# Module Name
## Function Name
### ✅ Existing Tests
### ❌ Missing Tests
#### 🔴 CRITICAL
#### 🟠 HIGH
#### 🟡 MEDIUM
#### 🟢 LOW
### 📊 Summary
```

---

## ✨ Success Criteria

**Document is complete when:**
- ✅ All 8 modules analyzed
- ✅ All functions inventoried
- ✅ All existing tests mapped
- ✅ All missing tests identified
- ✅ All tests prioritized
- ✅ All time estimates provided
- ✅ Summary statistics calculated
- ✅ User reviewed and approved

**Implementation is complete when:**
- ✅ All CRITICAL tests passing
- ✅ All HIGH tests passing
- ✅ 90%+ MEDIUM tests passing
- ✅ Integration tests passing
- ✅ Coverage report shows 95%+
- ✅ No known gaps remaining

---

## 🚀 Next Steps

1. **User confirms strategy** ✅ (this document)
2. **Agent starts Task 1.1** (LiquidityManager analysis)
3. **Iterate through TODO list** (systematic execution)
4. **Present final document** (review & approval)
5. **Begin implementation** (Phase 4)

---

**Document Version**: 1.0  
**Status**: APPROVED - Ready to execute  
**Estimated Completion**: Phase 1-3 in ~9 hours  
**Next Action**: Begin Task 1.1 (LiquidityManager.sol analysis)
