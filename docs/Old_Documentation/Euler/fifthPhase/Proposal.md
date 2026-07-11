## Plan: EVC Batch Refactor for EulerV2Plugin

**TL;DR**: Refactor EulerV2Plugin to use the official Euler V2 EVC batch pattern (`evc.batch(BatchItem[])`) instead of individual direct vault calls. This gives atomic multi-operation batches, deferred status checks (gas savings), and fixes a **critical interface bug** with `disableController`. The IEVC interface already has `BatchItem` and `batch()` defined.

---

### Critical Bug Found

The current `disableController` implementation is **BROKEN** and will revert on mainnet:
- **Current IEVC interface**: `disableController(address account, address vault)` (2 params)
- **Real EVC on-chain**: `disableController(address account)` (1 param — removes `msg.sender` as controller)
- **Different function selectors** → call will **REVERT** on mainnet
- **Correct approach**: Call the **vault's** `disableController()` (0 params, defined in [RiskManagerModule](https://github.com/euler-xyz/euler-vault-kit/blob/master/src/EVault/modules/RiskManager.sol)), which internally calls `evc.disableController(account)` where msg.sender = the vault (the actual controller)

---

### Current vs Official Approach

| Operation | Current (individual calls) | Official (EVC batch) |
|---|---|---|
| **deposit()** | `evc.enableCollateral()` then `IEVault.deposit()` — 2 calls, each triggers status checks | `evc.batch([enableCollateral, deposit])` — 1 atomic batch, checks deferred |
| **borrow()** | `evc.enableController()` then `IEVault.borrow()` — 2 calls | `evc.batch([enableController, borrow])` — 1 batch |
| **closePosition()** | `this.repay()` → `evc.disableController(WRONG!)` → `this.withdraw()` → `evc.disableCollateral()` — external self-calls + wrong interface | `evc.batch([repay, vault.disableController, redeem, disableCollateral])` — 1 atomic batch |
| **Flash loan open** | `deposit → enableCollateral → enableController → borrow` — 4 calls | `evc.batch([enableCollateral, deposit, enableController, borrow])` — 1 batch |
| **Flash loan close** | `repay → redeem` — no cleanup | `evc.batch([repay, redeem, vault.disableController, disableCollateral])` — full cleanup |

---

### Steps

**Phase 1: Fix Interfaces** *(prerequisite, blocks all other phases)*

1. **Fix IEVC.sol** — Change `disableController(address, address)` to `disableController(address)` to match real EVC. Also verify `setOperator` signature.
2. **Add `disableController()` to IEVault.sol** — The EVK vault exposes `disableController()` (0 params) in RiskManagerModule. This is the correct way to release controller.

**Phase 2: Add Batch Helper** *(parallel with Phase 1)*

3. **Add internal `_batchItem()` helper** in EulerV2Plugin — Reduces bytecode and repetition:
   `_batchItem(address target, address account, bytes memory data) → IEVC.BatchItem`

**Phase 3: Refactor Core Operations** *(depends on Phase 1+2)*

4. **Refactor `deposit()`** — Build 2-item batch: `[enableCollateral, deposit]`, call `evc.batch(items)`
5. **Refactor `borrow()`** — Build 2-item batch: `[enableController, borrow]`, call `evc.batch(items)`
6. **`repay()` and `withdraw()`** — Keep as single vault calls (simple operations, batch only adds complexity). Cleanup (disableController/disableCollateral) is handled in closePosition's batch.

**Phase 4: Refactor closePosition** *(depends on Phase 3)* — **BIGGEST WIN**

7. **Refactor `closePosition(string,string)`** — Replace external self-calls (`this.repay()`, `this.withdraw()`) with single atomic batch:
   - `[0]` repay on borrow vault
   - `[1]` vault.disableController() on borrow vault
   - `[2]` redeem on collateral vault
   - `[3]` disableCollateral on EVC
   - Post-batch: transfer assets to ProxyGeneral

**Phase 5: Refactor Flash Loan Callbacks** *(depends on Phase 3)*

8. **Refactor `_handleOpenLeverageCallback()`** — Token approvals stay outside batch, then:
   `evc.batch([enableCollateral, deposit, enableController, borrow])`
9. **Refactor `_handleCloseLeverageCallback()`** — Approvals outside, then:
   `evc.batch([repay, redeem])` + optionally `[vault.disableController, disableCollateral]`

**Phase 6: Bytecode Check** *(depends on Phase 5)*

10. **Measure bytecode** — Current: 23,302 bytes (1,274 bytes margin / 5.2%). Batch construction adds code but replaces individual calls. If over limit: extract `closePositionsForWeth` + helpers (~200 lines) into a separate contract.

**Phase 7: Testing** *(parallel with Phase 6)*

11. **Update test mocks** for EVC to handle `batch()` calls
12. **Verify** existing 34/34 tests still pass
13. **Add batch-specific tests**: correct batch item construction, gas comparison

---

### Relevant Files
- EulerV2Plugin.sol — Main file: all deposit/borrow/closePosition/flash loan refactoring
- IEVC.sol — Fix `disableController` signature
- IEVault.sol — Add vault's `disableController()`
- EulerRegistry.sol — No changes needed
- EulerLensAdapter.sol — No changes needed

### Verification
1. `npx hardhat compile` — Verify compilation after interface changes
2. `npx hardhat test` — Full test suite (after mock updates)
3. Check deployedBytecode length < 24,576 bytes in artifacts
4. Manual review: each batch array has correct selectors, targets, and `onBehalfOfAccount` values

### Decisions
- **disableController bug**: MUST fix (Phase 1) — blocks on-chain functionality
- **Batch scope**: Only batch multi-operation sequences; single-op functions stay as direct calls
- **Token approvals**: Stay outside batch (ERC-20 approve is on token contract, not vault/EVC)
- **Sub-account ops** (addCollateral/removeCollateral): Already use `evc.call()` — batch conversion is lower priority

### Further Considerations
1. **Bytecode risk**: If over limit after refactor, extract `closePositionsForWeth` + `_closeNormalDepositsForWeth` + `_closeLeverageAtomicForWeth` into helper contract. Recommend: implement first, measure, then optimize.
2. **IEVC.setOperator signature**: Current interface has `setOperator(address, bool)` but real EVC has `setAccountOperator(address account, address operator, bool authorized)` — should verify and fix.
3. **EVC Operator pattern**: Plugin could register as EVC operator for its sub-accounts for simpler authorization — defer to future iteration.