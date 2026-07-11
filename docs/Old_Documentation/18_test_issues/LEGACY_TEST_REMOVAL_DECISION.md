# Legacy Test Removal Decision

**Date**: 2025-11-14  
**Phase**: Phase A - Documentation & Transparency  
**Decision**: REMOVE legacy test file

---

## File Removed

**Path**: `test/old/LiquidityManager.rateLimiting.test.ts`

---

## Rationale

### Why Remove?

1. **Duplicate Coverage** ✅
   - Rate limiting functionality is already covered in unit tests
   - Unit tests: `test/unit/LiquidityManager.test.ts`
   - Coverage: Rate limiting logic fully tested in unit suite

2. **Environment Dependency** ❌
   - Test requires `process.env.EthResVaultAdress` to run
   - Skips if environment variable not set
   - Creates confusion about test suite completeness

3. **Already Archived** 📁
   - File was in `/old/` folder (legacy indicator)
   - File content was already commented out
   - Header explicitly marked as "ARCHIVED TEST FILE"
   - Archive date: October 24, 2025

4. **Sprint-Specific Test** 🏃
   - Test was created for "SPRINT 2.2: Rate Limiting Tests"
   - Sprint-specific tests are typically temporary
   - Main functionality should be covered in permanent test suite

### Verification of Coverage

Before removal, verified that rate limiting is covered elsewhere:

**Unit Tests Coverage**:
- ✅ `checkWithdrawLimits()` 24h accumulation logic
- ✅ `getRemainingHourlyLimit()` calculations
- ✅ `getRemainingDailyLimit()` 24h sliding window
- ✅ Multiple withdraws within single hour
- ✅ Withdraws spanning multiple hours
- ✅ 24-hour boundary crossing
- ✅ Limit enforcement accuracy

**Location**: `test/unit/LiquidityManager.test.ts`

---

## Alternative Considered

### Option B: Keep with Documentation

We could have kept the file and added a documentation header:

```typescript
/**
 * ⚠️ LEGACY TEST - ARCHIVED
 * This test is preserved for reference but is SKIPPED in CI.
 * Rate limiting functionality is covered in unit tests.
 * See: test/unit/LiquidityManager.test.ts
 */
```

**Why Not Chosen**:
- File was already commented out entirely
- No value in keeping commented-out code
- Git history preserves the test if needed for reference
- Reduces workspace clutter

---

## Impact Assessment

### Before Removal
- Tests passing: 209/211
- Skipped tests: 3 (2 reentrancy, 1 legacy)
- Test clarity: Confusing (skipped test status unclear)

### After Removal
- Tests passing: 209/211 (no change in passing tests)
- Skipped tests: 2 (only reentrancy tests)
- Test clarity: Improved (no legacy confusion)

### Coverage Impact
- **Real Coverage**: No change (test was skipped anyway)
- **Apparent Coverage**: Improved (removed false skip)
- **Test Suite Clarity**: Improved (cleaner structure)

---

## Git History Preservation

If this test is needed in the future, it can be retrieved from git history:

```bash
# View the deleted file
git log --all --full-history -- "test/old/LiquidityManager.rateLimiting.test.ts"

# Restore the file if needed
git checkout <commit-hash> -- "test/old/LiquidityManager.rateLimiting.test.ts"
```

---

## Decision Summary

✅ **APPROVED**: Remove `test/old/LiquidityManager.rateLimiting.test.ts`

**Justification**:
- Duplicate coverage (unit tests sufficient)
- Environment dependency creates confusion
- Already archived and commented out
- Git history preserves for future reference

**Outcome**:
- Cleaner test suite
- Reduced confusion about skipped tests
- No loss of actual test coverage

---

**Decision Made By**: Implementation Team  
**Date**: 2025-11-14  
**Phase A TODO-A2**: ✅ COMPLETE
