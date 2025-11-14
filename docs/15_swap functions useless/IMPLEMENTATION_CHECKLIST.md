# 🚀 Implementation Checklist - Rimozione Wrapper Functions SwapManager

**Branch**: `fix/script-verification-errors`  
**Started**: 2025-11-14  
**Objective**: Eliminare bug reentrancy e semplificare API rimuovendo wrapper ridondanti

---

## 📋 Pre-Implementation Phase

### ✅ TODO-001: Analisi dipendenze esterne
- [x] Grep search `swapTokenForWETH` in contracts/
- [x] Grep search `swapWETHForToken` in contracts/
- [x] Grep search wrapper calls in test/
- [x] Grep search wrapper calls in scripts/
- [x] Verificare ISwapManager imports
- [x] **Result**: 
  - **Contracts**: Solo SwapManager.sol e ISwapManager.sol (funzioni da rimuovere)
  - **LiquidityManager**: ✅ USA GIÀ performSwap (NO wrapper)
  - **Test files**: 3 files trovati (SwapManager.test.ts, SwapManager.simple.test.ts, PerformanceBenchmarks.test.ts)
  - **Scripts**: Nessuna dipendenza
  - **Conclusione**: SAFE TO REMOVE - nessun modulo core dipende dai wrapper

### ⬜ TODO-002: Backup e branch setup
- [ ] Verificare branch corrente (fix/script-verification-errors)
- [ ] Backup SwapManager.sol
- [ ] Backup ISwapManager.sol
- [ ] Checkpoint commit creato
- [ ] **Commit hash**: ___________

### ⬜ TODO-003: Compilazione baseline
- [ ] `npx hardhat compile` - Success
- [ ] `npx hardhat test` - Baseline results
- [ ] Save test results to `test_results_before.txt`
- [ ] TEST-002 status: __/18 passing, __ skipped
- [ ] **Gas baseline**: ___________

---

## 🔧 Implementation Phase

### ⬜ TODO-004: Rimuovere wrapper da SwapManager.sol
- [ ] Delete `swapTokenForWETH()` function (lines ~158-183)
- [ ] Delete `swapWETHForToken()` function (lines ~184-209)
- [ ] Verify `performSwap()` preserved
- [ ] Verify `performSwapAuto()` preserved
- [ ] File compiles without errors
- [ ] **Lines removed**: ___________

### ⬜ TODO-005: Aggiornare ISwapManager.sol
- [ ] Remove `swapTokenForWETH()` declaration
- [ ] Remove `swapWETHForToken()` declaration
- [ ] Verify interface consistency
- [ ] File compiles without errors

### ⬜ TODO-006: Aggiungere estimateSwapOutput (OPZIONALE)
- [ ] Add `estimateSwapOutput()` view function
- [ ] Implement logic (resolve addresses, get output, apply slippage)
- [ ] Add to interface ISwapManager.sol
- [ ] Test function manually
- [ ] **Status**: SKIPPED / COMPLETED

### ⬜ TODO-007: Compilazione post-modifiche
- [ ] `npx hardhat compile`
- [ ] Compilation successful
- [ ] No warnings
- [ ] Contract size < 24KB
- [ ] **Contract size**: ___________ KB

---

## ✅ Testing Phase

### ⬜ TODO-008: Identificare test con wrapper
- [ ] Grep search in test/
- [ ] List files to update: ___________
- [ ] Priority: PerformanceBenchmarks.test.ts

### ⬜ TODO-009: Aggiornare PerformanceBenchmarks.test.ts
- [ ] Remove `.skip` from "Swap Operations" describe block
- [ ] Update "USDC → WETH swap" test
- [ ] Update "WETH → USDC swap" test
- [ ] Replace wrapper calls with `performSwap(from, to, amount, deadline)`
- [ ] Verify test setup (ProxyGeneral balance)
- [ ] **Tests updated**: ___________

### ⬜ TODO-010: Aggiornare altri test files
- [ ] Update file: ___________
- [ ] Update file: ___________
- [ ] All wrapper calls migrated to performSwap
- [ ] **Total files updated**: ___________

### ⬜ TODO-011: Aggiungere test per estimateSwapOutput (OPZIONALE)
- [ ] Create test file or add to existing
- [ ] Test basic functionality
- [ ] Test edge cases
- [ ] **Status**: SKIPPED / COMPLETED

---

## ✅ Verification Phase

### ⬜ TODO-012: Run full test suite
- [ ] `npx hardhat test`
- [ ] All tests passing: __/__ (100%)
- [ ] TEST-002: __/18 passing, __ skipped
- [ ] No reentrancy errors
- [ ] Compare with baseline
- [ ] **Result**: PASS / FAIL

### ⬜ TODO-013: Gas benchmarking
- [ ] `REPORT_GAS=true npx hardhat test`
- [ ] performSwap gas cost: ___________ gas
- [ ] Compare with baseline (if available)
- [ ] Verify < 350k gas limit
- [ ] **Gas efficiency**: IMPROVED / SAME / REGRESSED

### ⬜ TODO-014: Security analysis
- [ ] Run Slither: `slither contracts/SwapManager.sol`
- [ ] Verify no new vulnerabilities
- [ ] Check reentrancy protection (single lock)
- [ ] Verify access control preserved
- [ ] **Security status**: PASS / ISSUES FOUND

### ⬜ TODO-015: Code review checklist
- [ ] SwapExecuted events emitted correctly
- [ ] ProxyGeneral authorization preserved
- [ ] Slippage validation working
- [ ] Deadline validation working
- [ ] Documentation updated in code
- [ ] **Review status**: APPROVED / CHANGES NEEDED

---

## 📚 Documentation Phase

### ⬜ TODO-016: Aggiornare docs tecnici
- [ ] Update README.md
- [ ] Update API documentation
- [ ] Document breaking changes
- [ ] Add migration examples
- [ ] **Docs updated**: ___________

### ⬜ TODO-017: Crea migration guide
- [ ] Document old pattern
- [ ] Document new pattern
- [ ] Provide code examples
- [ ] Add troubleshooting section
- [ ] **Guide location**: ___________

---

## 📊 Final Results

### Success Metrics
```
✅ TEST-002: __/18 passing (___%)
✅ Swap tests: __ skipped, __ passing
✅ Reentrancy bug: FIXED / PENDING
✅ Code lines: ____ (-___ lines, -__%)
✅ Public API: __ entry points
✅ Gas cost: _____ per swap
```

### Timeline
- **Start**: 2025-11-14 __:__
- **End**: ___________
- **Duration**: ___________ hours

### Issues Encountered
1. ___________
2. ___________

### Notes
___________

---

## ✅ Sign-off

- [ ] Implementation complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Ready for PR/merge

**Implementer**: GitHub Copilot  
**Reviewer**: ___________  
**Date**: ___________
