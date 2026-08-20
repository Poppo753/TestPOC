# Revised execution order

The order is repository-derived and keeps legacy and target lanes separately buildable.

## M0 — Decision and reproducibility gate

**Can start immediately.** Approve target invariants/trust/executable-envelope/package/backend ADRs; choose `jethos-web` as canonical candidate; repair test discovery and ABI contract checks; pin toolchains; create immutable address/code/state snapshot. Send external-gate requests in parallel.

Exit: architectural decisions are explicit; all target packages know their forbidden imports/capabilities; baseline commands are reproducible; legacy state universe is bounded or named unknown.

## M1-L — Immediate legacy containment lane

Using only the pinned legacy ABI/deployed bytecode baseline, prove the holder-specific zero-loss runbook (`MIG-002`) and then freeze new deposits, allocations and automation (`MIG-003`). This lane starts immediately after `MIG-001`/`ABI-001`/`OPS-002A`; it must not wait for a shared engine, Coinbase CDP or direct Aave implementation.

Depends on: immutable snapshot, reproducible current test/ABI baseline, security/operator approval of the runbook.  
Exit: no new exposure after the recorded freeze block and the proven safe exit remains reachable.

## M1-T — Shared non-signing foundation, in parallel

Extract browser-safe domain, amount, chain/account/asset identity, registry loader, plan types, deterministic serialization, dependency graph, decoder contracts and simulation interfaces from `scripts/framework`. No protocol submitter or provider connector is enabled.

Depends on: M0 package decision, registry/provenance schema, ABI baseline.  
Exit: pure tests and plan snapshots deterministic across Node/browser; no signer/fs/Hardhat dependency in the shared package.

## M2-T — CDP direct-call proof plus Aave slice

After external CDP evidence, implement a PoC adapter for user-owned account provisioning/re-entry, a single call and atomic batch, whole-envelope verification, receipt tracking and recovery. Build direct Arbitrum Aave USDC supply/withdraw from the shared engine; user authorizes every plan.

Depends on: M1-T, CDP gates, official Aave registry, exact simulation.  
Exit: same decoded financial envelope is planned, simulated, authorized and reconciled to the receipt; user can exit natively with Jethos unavailable.

## M2-L — Legacy settlement and decommission, independently coordinated

As soon as the frozen legacy runbook and required holder/operator authorization are available, redeem every holder without the clamp/burn loss mode, unwind any protocol state (`MIG-004`), revoke approvals/modules and attest final disposition (`MIG-005`). This lane may run alongside M1-T/M2-T and does not depend on the new Aave path. New direct positions are separate user actions, never automatic migration.

Depends on: M1-L, complete holder/state evidence and separately authorized production runbook.  
Exit: zero pool assets/LPT/debt/shares/allowances, no ingress or product consumer, final signed snapshot.

## M3 — Protocol expansion

Add Morpho Blue and MetaMorpho separately, then Euler only after EVC/Smart Account atomicity proof, and Uniswap through a direct DEX adapter. Borrow, leverage, flash loans, session keys and rebalancing execution remain out of V1.

Depends on: M2 pattern approval, protocol-specific official metadata/fork fixtures.  
Exit: direct user ownership, exact plan, independent native exit and property suite per capability.

## M4 — Provider control plane and identity

Build the minimal non-signing provider control plane only after BACK-001/002. Integrate Sumsub hosted identity/consent/token sharing against mocks then sandbox. Establish webhook authenticity/idempotency, secrets, data retention/export/delete and provider outage behavior.

Depends on: provider compatibility evidence and privacy/security boundary.  
Exit: provider state is explicit, minimal and recoverable; no financial call/relay import or key material.

## M5 — Cash, card and securities handoff

- Monerium: only after Italian personal/role, Gateway token, SC-wallet ownership and direct user-authorized outgoing path are proven.
- Reap: only after individual/EEA, role/issuer, Gateway, funding chain and PCI boundaries are proven.
- 21X V1: disclosure + external handoff/read-only only.
- 21X V2: remains blocked until browser self-custodial APIs, ACE/CCID, technical-role and specialist MiFID gates all pass.

Exit: each provider has an isolated feature gate, outage path, disclosure, contract/data-flow evidence and no Jethos order relay.

## M6 — Public real-money gate and cleanup

Run full security/privacy/legal/continuity acceptance. Remove/deprecate legacy source only after migration proof; rotate the legacy browser credential; retire `dapp-new`; establish canonical documentation; publish recovery metadata and release provenance.

Exit: all P0 acceptance evidence stored, no reachable critical findings, legal/provider go/no-go recorded, rollback and Jethos-disappearance tests passed.

## Work explicitly deferred

Borrow/repay, leverage/flash loans, automated/session-key execution, custom Jethos contracts, implicit bridges and 21X V2 are not hidden within earlier milestones. Each requires a new scope/gate after V1 direct supply/withdraw and recovery are stable.
