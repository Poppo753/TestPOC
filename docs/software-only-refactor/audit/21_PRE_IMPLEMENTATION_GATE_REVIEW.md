# Pre-implementation gate review

## Gate criteria

| Criterion | Result | Evidence |
|---|---|---|
| repository reality understood | PASS | inventory, architecture, fund flow, deployment and test evidence in 01–05 |
| target invariants internally coherent | CONDITIONAL PASS | corrected target in 06; no custom on-chain need proven |
| every meaningful component classified | PASS | 56 components, one primary class each; C-ID→task refs in 04/05 and exhaustive task-family→C-ID crosswalk in 17 |
| supplied checklist fully reviewed/revised | PASS | 228 reviewed; canonical 278-task replacement; crosswalk in 17 |
| dependency/execution/migration order defined | PASS | 18–20 |
| external assumptions distinguished from facts | PASS | 16; 58 directly blocked tasks |
| no unresolved architecture blocker prevents target financial implementation | FAIL | four preconditions below remain decisions/evidence, not implementation-ready facts |

## Blocking architectural decisions/evidence

1. **Canonical executable envelope is not approved.** `AA-001` must define serialization/domain separation, simulation state/expiry, account batch decoding, UserOperation mutation policy, and wallet-handoff equality. Building adapters first would recreate the preview/sign mismatch.
2. **Target code ownership/runtime boundary is not approved.** `ARCH-011`, `WEB-001`, and `BACK-001` must decide the workspace package, canonical frontend cutover, and minimal provider control plane with enforceable no-signer/no-relay imports and data responsibilities.
3. **CDP control and exitability are unproven.** Written/product evidence and an empirical PoC must prove user ownership, disabled developer delegation, ERC-1271, batching, per-chain accounts, recovery/export and Jethos-independent exit.
4. **Legacy state and regression baseline are not sufficiently bounded for financial mutation.** The 3.1 USDC/LPT `latest` observation is not migration-grade because its block/RPC/command were not archived. Divergent deployment families, owner/module/allowance state, source/live bytecode and possible holders require an immutable two-RPC snapshot; ABI/test runners and zero-loss properties must be reproducible before freezing or moving funds.

## Security blockers for any real-money path

- confirmed critical partial-payout/full-share-burn, fail-open valuation and swap/minOut/spot-price findings remain reachable in the legacy architecture;
- 21 contracts share one owner EOA and emergency/pause/close semantics are inconsistent;
- target registry/frontend/UserOperation threat controls do not yet exist;
- Foundry was unavailable locally, root test discovery is broken, and source/test/ABI drift produces known failures.

These do not prohibit read-only evidence work, ADR approval, test-runner repair, pure non-financial package extraction, or the separately authorized legacy safety lane. They do prohibit beginning a target financial path whose interface/ownership/exactness boundary is still undecided.

## Exact actions to clear the gate

1. Approve `ARCH-001/002/011`, `AA-001`, `WEB-001`, `BACK-001`, `BLD-001A/B`, and `UX-021` with explicit negative capabilities.
2. Complete `ABI-001` and `OPS-002A`; pin Foundry/Node/npm and produce a reproducible baseline report.
3. Complete `MIG-001` across all address families with code hashes, holder events, balances, allowances, roles and protocol state.
4. Complete the legacy-only `MIG-002` fork proof and, after its explicit review, `MIG-003` freeze without waiting for the target engine/CDP/Aave lane; production exit remains separately authorized in `MIG-004`.
5. Obtain CDP capability evidence and run the owner/delegation/batch/recovery/three-chain PoC.
6. Demonstrate a canonical no-value mock/Aave testnet plan whose reviewed, simulated, account-encoded and receipt-decoded financial envelope is identical under the AA-001 mutation policy.
7. Re-run this gate. External Sumsub/Monerium/Reap/21X gates may remain blocked because they do not prevent the first shared-engine phase.

## Recorded second pass

- Repository coverage was rechecked across contracts, scripts/automation/ops, tests/property suites, both frontends, configuration, CI, protocols, deployment/live state, generated evidence and documentation.
- All 22 required audit filenames are present and no extra file exists in the audit directory; the revised checklist is the single additional document.
- Both component tables contain the same 56 unique IDs and identical primary classifications: 1 keep, 5 keep-and-harden, 1 client extraction, 8 shared-TS extractions, 6 direct-call replacements, 20 splits, 8 removals, 7 migration-only and 0 on-chain-required.
- All 228 source task IDs are accounted for as one of 200 retained/revised IDs, one of 10 retired IDs, or one of 18 split families. The revised checklist has 278 unique IDs, all required fields, 208 pending, 58 directly blocked and 12 completed audit tasks.
- Every task routes to mandatory verification profiles that define inputs, tools/procedure, outputs, artifact hashes and reviewer, and all evidence paths have one repository-relative root.
- The executable checklist dependency graph has 798 deduplicated edges, no unknown task reference, no self-dependency and no cycle. 21X V1 dependencies are separate from V2 ACE/browser/legal gates; legacy freeze has no target-engine/CDP/Aave dependency.
- Every `REMOVE` row names useful logic to port or states that none is target-compatible, plus state/consumer evidence required before deletion. Universal security properties and pooled migration-only properties are separately listed.
- An adversarial target scan found no approved path that reintroduces Jethos custody, pooled claims, user-key control, normal backend signing, financial-order relay, personalized allocation or an unjustified custom contract. Provider secret/webhook infrastructure remains a non-signing control plane.
- Git isolation was rechecked: all 23 new files are under `docs/software-only-refactor/`; no production, test, configuration, dependency or deployment source file was modified.

NOT_READY_FOR_IMPLEMENTATION
