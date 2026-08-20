# Refactor migration plan

The plan uses a strangler pattern: add a separately testable target path, move one consumer/capability, observe and prove recovery, then deprecate the legacy path. It never leaves the repository intentionally broken. `L` and `T` are parallel legacy-containment and target-build lanes: Phase 1-L has safety priority and never waits for CDP/Aave; Phase 2-L runs as soon as holder/operator authorization exists.

| Phase | Objective | Components | Behavior introduced | Behavior removed/deferred | Tests/evidence | Rollback | Completion criteria | Blocker |
|---|---|---|---|---|---|---|---|---|
| 0 | approve boundaries and reproduce the baseline | docs/ADRs, CI, ABIs, manifests, web ownership | canonical invariants, package/control-plane/exact-envelope contracts, finalized state snapshot | none | baseline commands, selector checks, two-RPC code/state ledger | documentation decision reversal; no runtime change | decisions approved; state/config universe evidenced; CI commands deterministic | architecture/security |
| 1-L | prove safe legacy exit and freeze exposure | PG, LM, PM, plugins, automation, owner tooling | signed holder-specific runbook and monitored ingress/allocation freeze | deposits, new allocation/borrow/leverage | exact deployed-bytecode fork, holder/event/balance/allowance snapshot, stop/rollback drill | reviewed re-enable only if freeze blocks the proven exit | no ingress after recorded block; safe exit remains reachable | Phase 0 snapshot/ABI baseline; security/operator review |
| 1-T | create shared non-signing engine in parallel | framework pure code, approved workspace package, registry | chain/account/asset types, immutable plan, dependency graph, fingerprint/decoder/simulator interfaces | no current consumer yet | Node/browser deterministic snapshots; forbidden-import checks | remove new package/consumer flag | package has no signer/fs/Hardhat; registry provenance enforced | Phase 0 package decision |
| 2-L | settle and decommission legacy state when authorized | all deployments/holders/owners/allowances/positions | full redemption/unwind, final state ledger and direct recovery metadata | pool/LPT/plugin positions/privileged modules | per-transaction deltas, zero assets/supply/debt/shares/allowances, challenge window | time-bounded recovery owner before final retirement | final signed snapshot; no product consumer | Phase 1-L, holder completeness, separate production authorization |
| 2-T | prove user account and exact handoff | CDP adapter PoC, plan review UI | user-owned SA, single/batch calls, whole-envelope equality, recovery | EOA-only assumption in new path | owner/delegation/ERC-1271/3-chain/recovery/mutation tests | disable feature flag; no funds routed | empirical evidence and independent account recovery pass | Phase 1-T; CDP external gate |
| 3-T | add Aave direct vertical slice | Aave registry/read/build/sim/post-state, web feature | direct user USDC supply/withdraw on one approved chain | no Jethos plugin in new capability; borrow/leverage deferred | fork/testnet envelope equality, bounded approval, receipt/post-state, native exit, frontend E2E | feature flag off; user exits through Aave | reviewed/simulated/account-encoded/receipt fields match; user owns position | Phase 2-T/security |
| 4 | expand direct protocols | Morpho Blue, MetaMorpho, Euler, DEX | per-capability direct adapters and readers | plugin execution; Euler/leverage unless proven | protocol differential/fork/property/E2E and exit tests | feature flag per adapter | independent user ownership/exit and exactness per action | approved Aave pattern; protocol/SA gates |
| 5 | introduce provider control plane | new minimal service, Sumsub connector, webhook/consent state | secret-safe OAuth/webhook/status only | any possibility of signer/order relay/import | mocks, signature/replay/idempotency/privacy/outage tests | connector feature off; provider-hosted recovery | negative capability tests and sandbox identity acceptance | BACK/provider/privacy gates |
| 6 | integrate regulated providers | Monerium, Reap, 21X V1 | confirmed account/status/handoff flows | 21X V2 and incompatible relay/custody models | sandbox E2E, contract/data-flow/legal evidence, kill-Jethos tests | per-provider flag and provider-native continuation | gate-specific acceptance, disclosures, no financial relay | external/legal gates |
| 7 | cleanup and launch gate | dapp-new, legacy code/docs/scripts, release pipeline | one canonical app/docs/provenance/recovery package | obsolete duplicate source after evidence | full CI/security/privacy/legal/acceptance matrix | revert code cleanup from Git; legacy contracts stay inert | no reachable critical, all P0 evidence, public beta approval | all preceding gates |

## Consumer migration rule

For each capability:

1. the legacy-only lane proves safe exit and freezes unsafe/new pooled exposure without waiting for a replacement capability;
2. the new adapter and pure plan tests land without re-enabling or changing frozen legacy routing;
3. read-only UI can compare legacy and direct views with explicit labels;
4. testnet/fork Smart Account execution is enabled behind a fail-closed flag;
5. one direct capability becomes the only enabled new-money path;
6. receipts/post-state, recovery and independent native exit are observed;
7. separately authorized legacy settlement completes; only then are old imports/routes/source removed.

## Rollback invariants

- Rollback never moves a direct user position back into a Jethos pool.
- Disabling Jethos hides construction/UI but does not prevent protocol-native user exit.
- Registry versions are append-only; a bad version is revoked, not silently edited.
- A failed provider connector falls back to provider-hosted status/recovery, not a Jethos substitute decision.
- Legacy mutation rollback is defined before production execution and never uses unverified emergency semantics.

## Completion evidence package per phase

Each phase stores: source/commit and registry hashes; task IDs; test commands/results; chain/block/RPC where relevant; decoded calls and simulations; external/legal artifacts with dates; security findings disposition; feature flags; rollback drill; and named reviewer/approval. A screenshot or successful transaction alone is insufficient.
