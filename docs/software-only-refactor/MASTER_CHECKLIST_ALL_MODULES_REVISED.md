# Jethos — revised executable checklist for the software-only refactor

Revision date: 2026-08-17  
Source reviewed: `C:\Users\l.botta\Downloads\MASTER_CHECKLIST_ALL_MODULES.md`  
Canonical audit: `docs/software-only-refactor/audit/00_AUDIT_EXECUTIVE_SUMMARY.md`

This is the repository executable replacement for the immutable downloaded checklist. Source: 228 unique tasks, all initially `[ ]`; P0 147, P1 73, P2 8. Revision: 10 duplicate epics retired, 18 tasks split into 47 atomic replacements, and 31 repository-specific tasks added; final total 278.

Status: `[ ]` not started; `[~]` in progress; `[x]` completed and verified; `[!]` blocked by a named external, legal, provider, security or authorization artifact. Only `AUD-001..012` are verified complete. Exactly 58 tasks are directly blocked; downstream tasks remain pending with explicit dependencies.

All `evidence/<ID>.md` paths are repository-relative to `docs/software-only-refactor/`; machine-readable artifacts for that task belong under `docs/software-only-refactor/evidence/<ID>/` and must be linked from the Markdown evidence record.

Every task contains stable ID, status, priority, rationale, exact action, affected components, dependencies, acceptance criteria, verification, expected evidence and external gate. Evidence paths are implementation deliverables, not fabricated existing files.

## Normative verification protocol

The `Verification` field is not an “appropriate test” choice. It requires every profile assigned below, applied to that task's exact Action and Acceptance criteria. Each evidence record must contain the literal command or review procedure, tool/API version, environment, inputs, exit/result, redacted raw output or immutable link, SHA-256 of stored artifacts, date and named reviewer. A screenshot or successful transaction alone never passes.

| Profile | Mandatory method and evidence |
|---|---|
| `V-REPO` | Pin Git SHA and dirty state; run and archive the exact read-only `rg`/compiler/test/RPC commands; map every claim to repository path/line or dated observation; a second reviewer repeats sampled queries. |
| `V-ADR` | Version a decision with context, alternatives, chosen boundary, forbidden capabilities, consequences and rollback; obtain two named reviews; store document SHA-256 and the linked task/component IDs. |
| `V-STATIC` | Run the committed owner-package typecheck, lint, build, forbidden-import/address/secret scans and relevant CI job locally or in CI; record literal commands, toolchain lock versions, exit codes and artifact links. |
| `V-UNIT` | Run deterministic unit/property/snapshot tests in the owning package; record test names, fixtures, random seed, exact command and result; include negative and boundary vectors from the task acceptance criterion. |
| `V-FORK` | Pin chainId, finalized block, RPC identity, registry version and runtime code hashes; simulate/execute only on the fork; decode calls/envelope and assert pre/post balances, shares, debt, allowances, events, revert cases and native exit as applicable. |
| `V-SANDBOX` | Pin provider product/API/SDK version and sandbox environment; use a named synthetic test identity/account; archive redacted request/response IDs, timestamps, webhook sequence/replay results and provider-side final state. |
| `V-PROVIDER` | Archive a dated written provider response; map every submitted question to yes/no/condition/unknown; identify product, country, customer type, Jethos role, API version, commercial owner and expiry/reconfirmation date. |
| `V-LEGAL` | Obtain a dated memo from the named qualified adviser for the exact Italy/EU flow and commercial model; include assumptions, role-by-role conclusion, prohibited path, conditions, open questions and next review date. |
| `V-E2E` | Run the committed browser/client E2E for the exact user/account/chain; record registry/block/expiry, decoded reviewed and simulated envelope, authorization, receipt input and post-state; run outage/retry/native-recovery paths required by the task. |
| `V-SEC` | Link threat/property IDs; run static, mutation, replay, authorization, fuzz/property or adversarial cases named by the task; attach failures/fixes and independent security review; no reachable unresolved Critical may pass a release gate. |
| `V-PRIV` | Exercise synthetic/canary data through collection, logs, storage, export/delete and retention; scan outputs for PII/secrets; prove consent, minimization, webhook replay resistance and deletion SLA where relevant. |
| `V-MIG` | Use two RPC sources at one finalized block and exact live code hashes; inventory holders/roles/balances/positions/allowances; fork-dry-run mutations; require separate production authorization, per-step deltas/stop conditions and signed before/after snapshots. |
| `V-OBS` | Emit only privacy-safe synthetic events; verify schema, deduplication, alert threshold, delivery, suppression and outage behavior; archive query/dashboard/alert identifiers and sample redacted payloads. |
| `V-ACCEPT` | Re-run and hash every prerequisite evidence artifact; independently trace acceptance to receipts/tests/provider/legal decisions, verify all blockers/expiries and record named go/no-go approval. |

### Verification routing (exhaustive by stable ID)

| Task IDs | Required profiles |
|---|---|
| `AUD-*` | `V-REPO` |
| `GATE-*` | `V-PROVIDER` |
| `POC-001`, `ARCH-001/002/005/006/007/011/012/013`, `WEB-001`, `BACK-001`, `AA-001` | `V-ADR`, `V-STATIC` |
| `ARCH-003A`, `ARCH-010A..G`, `ABI-001` | `V-REPO`, `V-STATIC` |
| `ARCH-003B/C`, `ARCH-004` | `V-ADR`, `V-UNIT`, `V-STATIC` |
| `CDP-*` | `V-PROVIDER`, `V-SANDBOX`, `V-E2E`, `V-SEC` |
| `SUM-*`, `MON-*`, `REAP-*` | `V-PROVIDER`, `V-SANDBOX`, `V-PRIV`, `V-SEC`; add `V-E2E` when the action crosses browser/provider state |
| `X21-*` | `V-PROVIDER`, `V-LEGAL`, `V-SANDBOX`, `V-SEC`; V1 handoff tasks also require `V-E2E` |
| `BLD-*` | `V-UNIT`, `V-STATIC`; `BLD-030A/B`, `BLD-032A/B`, `BLD-040`, `BLD-051` also require `V-FORK` and `V-SEC`; `BLD-041/042/052` also require `V-E2E` and `V-SEC` |
| `AAVE-*`, `MORPHO-*`, `EULER-*`, `DEX-001` | `V-UNIT`, `V-FORK`, `V-E2E`, `V-SEC` |
| `CHAIN-*` | `V-UNIT`, `V-E2E`, `V-SEC`; any provider-managed bridge decision also requires `V-PROVIDER` and `V-LEGAL` |
| `UX-*`, `WEB-002` | `V-STATIC`, `V-UNIT`, `V-E2E` |
| `SEC-*`, `SEC-LEG-001` | `V-SEC`, `V-STATIC`; add `V-FORK` for on-chain financial properties |
| `PRIV-*` | `V-PRIV`, `V-SEC` |
| `LEGAL-*` | `V-LEGAL`; provider-role tasks also require `V-PROVIDER` |
| `OPS-*` | `V-STATIC`, `V-UNIT`, `V-OBS`; fork/security jobs also require `V-FORK` and `V-SEC` |
| `TEST-001/002/006` | `V-E2E`, `V-SEC`; `TEST-002` also requires `V-FORK` |
| `TEST-003/004/005` | `V-SANDBOX`, `V-E2E`, `V-PRIV`, `V-SEC` |
| `ACC-*` | `V-ACCEPT` plus every profile required by its prerequisite task IDs |
| `MIG-001..005` | `V-MIG`, `V-SEC`; `MIG-003/004/005` require separately recorded production authorization |
| `MIG-006` | `V-E2E`, `V-FORK`, `V-SEC` |
| `BACK-002` | `V-STATIC`, `V-UNIT`, `V-PRIV`, `V-SEC` |
| `DOL-001`, `INT-001`, `FLASH-001`, `GMX-001`, `DOC-001` | `V-REPO`, `V-ADR`; add `V-MIG` if live state or authority is discovered |


## External evidence requests

- [ ] **GATE-001 — Send Sumsub Gateway integration request** `P0`
  - **Rationale:** The one-KYC architecture depends on Jethos being accepted as a non-regulated Gateway Integrator and on recipient-specific sharing.
  - **Action:** Send the prepared technical description: Italian SaaS, self-custodial Smart Account, no KYC document storage, Sumsub ID OIDC, Gateway share token, Reap/Monerium as recipients, ACE/CCID as optional credential path.
  - **Affected components:** external evidence register
  - **Depends on:** `AUD-012`
  - **Acceptance criteria:** Written answer covers integrator eligibility, commercial setup, sandbox, data visible to Jethos, recipient configuration and whether Sumsub ID share tokens can be used with the target recipients.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/GATE-001.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None — this task obtains the missing artifact.

- [ ] **GATE-002 — Send Reap product/regulatory/Gateway compatibility request** `P0`
  - **Rationale:** Reap is only viable if the intended individual EEA/Italy card program exists and Jethos can remain a technical/platform integrator.
  - **Action:** Ask about consumer eligibility, issuer/cardholder counterparty, required Jethos status, program minimums, sandbox, full embedded APIs, Sumsub ID Gateway token compatibility, funding networks and direct access if Jethos disappears.
  - **Affected components:** external evidence register
  - **Depends on:** `AUD-012`
  - **Acceptance criteria:** Reap gives explicit yes/no answers for Italy/EEA individuals, contractual role, Sumsub Gateway token path and program availability.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/GATE-002.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None — this task obtains the missing artifact.

- [ ] **GATE-003 — Send Monerium whitelabel/Gateway compatibility request** `P0`
  - **Rationale:** Monerium is the cash/IBAN rail; the critical unknown is whether the exact Sumsub ID Gateway token from Jethos can feed its documented Sumsub KYC-sharing endpoint.
  - **Action:** Ask about Italian personal users, whitelabel availability, `/profiles/{profile}/share`, Sumsub ID Gateway tokens, Jethos contractual role, payment-agent/distributor status, Arbitrum Smart Account linking, pricing/minimums and direct user recovery.
  - **Affected components:** external evidence register
  - **Depends on:** `AUD-012`
  - **Acceptance criteria:** Written confirmation resolves every question and identifies the production onboarding path.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/GATE-003.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None — this task obtains the missing artifact.

- [ ] **GATE-004 — Send 21X V1/V2 + ACE/CCID request** `P0`
  - **Rationale:** Securities are the most sensitive perimeter and the current 21X SDK is not a drop-in browser SDK; V2 needs both technical and regulatory confirmation.
  - **Action:** Ask: Italian retail eligibility; V1 external frontend; Sumsub-issued CCID acceptance; browser/self-custodial signing path; whether Jethos can remain a technical frontend; required agreements/status; JS/browser SDK or ABI/middleware alternative to Python SDK/private-key examples.
  - **Affected components:** external evidence register
  - **Depends on:** `AUD-012`
  - **Acceptance criteria:** Written answer separates V1 and V2, confirms supported account/network model and states Jethos's expected role.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/GATE-004.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None — this task obtains the missing artifact.

- [ ] **GATE-005 — Open Coinbase CDP clarification ticket only for unresolved wallet controls** `P0`
  - **Rationale:** The core can be built immediately, but recovery/export, cross-chain Smart Account behavior and any delegation defaults must be unambiguous.
  - **Action:** Validate selected User/Embedded Wallet model, delegation disabled/not provisioned, recovery/export, Arbitrum/Base/Polygon Smart Account support, bundler/paymaster constraints and backend secret requirements.
  - **Affected components:** external evidence register
  - **Depends on:** `AUD-012`
  - **Acceptance criteria:** All wallet-control assumptions are documented and tested, not merely inferred.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/GATE-005.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None — this task obtains the missing artifact.


## Implementation workspace

- [ ] **POC-001 — Create isolated PoC branch/workspace** `P0`
  - **Rationale:** External provider negotiations must not block the Jethos-owned core.
  - **Action:** Create a dedicated branch/worktree and `/docs/poc/` decision log; record architecture invariants before implementation.
  - **Affected components:** workspace and integration milestones
  - **Depends on:** `AUD-012`, `WEB-001`
  - **Acceptance criteria:** PoC can be developed independently and no legacy vault/adapter assumption is required.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/POC-001.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None


## Foundation and target architecture

- [ ] **ARCH-001 — Write Architecture Decision Record: 'Jethos compiles; user executes'** `P0`
  - **Rationale:** This is the refactor's central boundary and prevents reintroduction of backend execution.
  - **Action:** Create ADR with allowed and forbidden transaction paths, direct-call default, batch model and a deny-by-default exception process. Any proposed Jethos execution contract must prove: the invariant cannot be enforced off-chain or by the user Smart Account; it introduces no Jethos custody/signing/relay; state and upgrade authority are explicit and minimized; users retain native exit; and its additional trust/cost is accepted.
  - **Affected components:** architecture ADRs, domain and registry
  - **Depends on:** `AUD-012`
  - **Acceptance criteria:** ADR approved; every integration references it; `ONCHAIN_REQUIRED` remains zero unless a separately reviewed ADR passes all five tests; CI rejects a new custom Jethos execution contract without that ADR identifier.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ARCH-001.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **ARCH-002 — Define trust-boundary diagram** `P0`
  - **Rationale:** Developers need a precise distinction between Jethos, user wallet, provider and protocol responsibilities.
  - **Action:** Diagram who controls keys, funds, KYC decision, order execution, provider terms, protocol state and cached data.
  - **Affected components:** architecture ADRs, domain and registry
  - **Depends on:** `AUD-012`
  - **Acceptance criteria:** Every data/fund/signature path has a named controller and no ambiguous 'Jethos account balance'.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ARCH-002.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **ARCH-004 — Create chain-aware address and asset registry** `P0`
  - **Rationale:** Arbitrum, Base and Polygon may all be used; addresses cannot be globally hardcoded.
  - **Action:** Create typed registry keyed by chainId + protocol + deployment + token; bind source URL/version/date, release/git provenance and runtime code hash where applicable; validate chain, address, decimals and registry version at runtime.
  - **Affected components:** architecture ADRs, domain and registry
  - **Depends on:** `ARCH-001`, `ARCH-003C`, `ARCH-011`, `AUD-006`
  - **Acceptance criteria:** Wrong-chain or unprovenanced address use is impossible through normal builder APIs and a released registry entry is immutable/revocable rather than silently editable.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ARCH-004.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **ARCH-005 — Create provider capability matrix** `P1`
  - **Rationale:** The UI must degrade gracefully while agreements/features differ by geography/program.
  - **Action:** Represent capabilities such as `kycReuse`, `iban`, `card`, `physicalCard`, `applePay`, `googlePay`, `securities`, `chain`, `sandbox`, `countryEligibility`.
  - **Affected components:** architecture ADRs, domain and registry
  - **Depends on:** `AUD-012`
  - **Acceptance criteria:** Feature availability is data-driven and can be disabled without redeploying financial logic.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ARCH-005.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **ARCH-006 — Define external-service state machines** `P1`
  - **Rationale:** Providers are asynchronous; a boolean 'connected' is insufficient.
  - **Action:** Model states such as not_started/pending/action_required/approved/rejected/suspended/unavailable per provider without inventing a universal regulatory state.
  - **Affected components:** architecture ADRs, domain and registry
  - **Depends on:** `AUD-012`
  - **Acceptance criteria:** UI can represent provider-specific asynchronous states without conflating them.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ARCH-006.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **ARCH-007 — Define 'provider outage / Jethos outage' recovery behavior** `P0`
  - **Rationale:** Exitability is a core architecture invariant.
  - **Action:** Document direct protocol/provider recovery routes and what remains possible if Jethos backend/frontend is unavailable.
  - **Affected components:** architecture ADRs, domain and registry
  - **Depends on:** `AUD-012`
  - **Acceptance criteria:** User assets/positions are not stranded behind Jethos-only infrastructure.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ARCH-007.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **ARCH-011 — Approve shared-engine package/runtime and extraction boundary** `P0`
  - **Rationale:** Existing pure planning code is mixed with Node, Hardhat, filesystem and signer runtime; package ownership must be decided before extraction.
  - **Action:** Approve the package path (recommended `packages/financial-engine`), Node and browser targets, consumers, source files to extract, public API and forbidden dependencies (`Signer`, filesystem, Hardhat, submission/relay imports); leave implementation to the BLD extraction tasks.
  - **Affected components:** architecture ADRs, domain and registry
  - **Depends on:** `ARCH-001`, `ARCH-002`, `WEB-001`, `AUD-002`
  - **Acceptance criteria:** A reviewed package/runtime decision names owner, consumers, extraction sources and import boundaries; browser and Node test strategy is executable without choosing a UI framework or transaction submitter.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ARCH-011.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **ARCH-012 — Create provider connector boundary** `P1`
  - **Rationale:** Monerium/Reap/Sumsub/21X APIs change independently.
  - **Action:** Define server-side connector interfaces for authentication, webhook validation and non-signing API calls; keep provider-specific DTOs out of core domain where possible.
  - **Affected components:** architecture ADRs, domain and registry
  - **Depends on:** `AUD-012`
  - **Acceptance criteria:** A provider can be replaced without rewriting wallet/Builder domain.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ARCH-012.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **ARCH-013 — Create feature-gate system** `P1`
  - **Rationale:** External approval can be delayed or country-specific.
  - **Action:** Add server-controlled feature gates for provider modules and V2 capabilities; never use a feature flag to bypass compliance/provider state.
  - **Affected components:** architecture ADRs, domain and registry
  - **Depends on:** `AUD-012`
  - **Acceptance criteria:** Unavailable service fails closed and displays correct provider status.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ARCH-013.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None


## Coinbase CDP wallet and Smart Account

- [!] **CDP-001 — Freeze use of CDP User/Embedded Wallet + Smart Account** `P0`
  - **Rationale:** Server Wallets or developer-controlled accounts would contradict the target control model.
  - **Action:** Record exact CDP wallet product/API version and forbid Server Wallet use for user assets.
  - **Affected components:** wallet/account adapter, shared engine and web
  - **Depends on:** `ARCH-001`, `ARCH-002`, `AA-001`, `GATE-005`
  - **Acceptance criteria:** Architecture/config review proves user wallet ownership model.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/CDP-001.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Coinbase CDP evidence via `GATE-005`.

- [!] **CDP-002 — Prove delegation is not enabled in ordinary flow** `P0`
  - **Rationale:** CDP supports developer delegation; accidental enablement would materially alter the trust model.
  - **Action:** Audit configuration and API usage; add automated test/grep guard against account-scoped delegation creation in production path.
  - **Affected components:** wallet/account adapter, shared engine and web
  - **Depends on:** `ARCH-001`, `ARCH-002`, `AA-001`, `GATE-005`
  - **Acceptance criteria:** No ordinary user financial action can be signed by Jethos.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/CDP-002.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Coinbase CDP evidence via `GATE-005`.

- [ ] **CDP-010 — Create CDP project/environment separation** `P0`
  - **Rationale:** Sandbox/dev/staging/prod secrets and domains must never mix.
  - **Action:** Create separate CDP projects or isolated credentials/config; allowlist expected domains; document secret ownership.
  - **Affected components:** wallet/account adapter, shared engine and web
  - **Depends on:** `ARCH-001`, `ARCH-002`, `AA-001`, `GATE-005`
  - **Acceptance criteria:** A dev build cannot access production wallet credentials/config.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/CDP-010.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Coinbase CDP evidence via `GATE-005`.

- [ ] **CDP-011 — Implement sign-in and account provisioning** `P0`
  - **Rationale:** The first-run experience must deterministically create/link the user-owned account.
  - **Action:** Configure Smart Account creation on login; handle returning users idempotently; persist only identifiers/address metadata needed by Jethos.
  - **Affected components:** wallet/account adapter, shared engine and web
  - **Depends on:** `ARCH-001`, `ARCH-002`, `AA-001`, `GATE-005`
  - **Acceptance criteria:** New and returning users resolve to expected owner/Smart Account without duplicates.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/CDP-011.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Coinbase CDP evidence via `GATE-005`.

- [ ] **CDP-012 — Persist chain-specific Smart Account metadata** `P1`
  - **Rationale:** Do not assume one address/one deployment across all networks.
  - **Action:** Store owner identity plus `ChainAccount` records for Arbitrum/Base/Polygon, deployment status and address.
  - **Affected components:** wallet/account adapter, shared engine and web
  - **Depends on:** `ARCH-001`, `ARCH-002`, `AA-001`, `GATE-005`
  - **Acceptance criteria:** UI and Builder always know the selected chain account.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/CDP-012.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Coinbase CDP evidence via `GATE-005`.

- [!] **CDP-013 — Implement recovery/export/user-control runbook** `P0`
  - **Rationale:** The user must not lose access if Jethos disappears.
  - **Action:** Document and test provider-supported recovery/export/direct access path; add user-facing recovery help.
  - **Affected components:** wallet/account adapter, shared engine and web
  - **Depends on:** `ARCH-001`, `ARCH-002`, `AA-001`, `GATE-005`
  - **Acceptance criteria:** A test user can regain/control account without Jethos-specific signing infrastructure.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/CDP-013.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Coinbase CDP evidence via `GATE-005`.

- [ ] **CDP-020 — Implement single direct call from Smart Account** `P0`
  - **Rationale:** Baseline proof that the user account can call protocols directly.
  - **Action:** Build a harmless/testnet call with exact target/data/value and submit through user authorization.
  - **Affected components:** wallet/account adapter, shared engine and web
  - **Depends on:** `ARCH-001`, `ARCH-002`, `AA-001`, `GATE-005`
  - **Acceptance criteria:** Confirmed receipt and no Jethos on-chain intermediary.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/CDP-020.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Coinbase CDP evidence via `GATE-005`.

- [ ] **CDP-021 — Implement atomic multi-call batch** `P0`
  - **Rationale:** Builder's multi-protocol UX depends on batched execution.
  - **Action:** Encode 2+ calls, display them before signature, submit one UserOperation, test full revert when a call fails.
  - **Affected components:** wallet/account adapter, shared engine and web
  - **Depends on:** `ARCH-001`, `ARCH-002`, `AA-001`, `GATE-005`
  - **Acceptance criteria:** Successful batch executes in order; failing batch behavior is understood and surfaced.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/CDP-021.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Coinbase CDP evidence via `GATE-005`.

- [ ] **CDP-022 — Integrate Builder call format** `P0`
  - **Rationale:** Wallet transport must consume the exact call objects produced by the Builder.
  - **Action:** Create one typed `Call {to,data,value,chainId}` contract between Builder and CDP layer; prohibit hidden mutation.
  - **Affected components:** wallet/account adapter, shared engine and web
  - **Depends on:** `ARCH-001`, `ARCH-002`, `AA-001`, `GATE-005`
  - **Acceptance criteria:** Bytes shown/simulated are the bytes passed to wallet transport.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/CDP-022.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Coinbase CDP evidence via `GATE-005`.

- [ ] **CDP-023 — Add receipt and UserOperation lifecycle tracking** `P1`
  - **Rationale:** ERC-4337 has pending/bundler/chain states the UX must explain.
  - **Action:** Track user-op hash, tx hash, confirmations, revert reasons and post-state trigger.
  - **Affected components:** wallet/account adapter, shared engine and web
  - **Depends on:** `ARCH-001`, `ARCH-002`, `AA-001`, `GATE-005`
  - **Acceptance criteria:** User can distinguish signing, submission, pending, confirmed and failed.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/CDP-023.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Coinbase CDP evidence via `GATE-005`.

- [ ] **CDP-030 — Decide PoC paymaster scope** `P1`
  - **Rationale:** Gas sponsorship improves Revolut-like UX but is not necessary to prove architecture.
  - **Action:** Start without or with restricted sponsorship; if enabled, allowlist supported targets/methods and enforce budget.
  - **Affected components:** wallet/account adapter, shared engine and web
  - **Depends on:** `ARCH-001`, `ARCH-002`, `AA-001`, `GATE-005`
  - **Acceptance criteria:** Paymaster cannot sponsor arbitrary attacker transactions using Jethos credits.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/CDP-030.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Coinbase CDP evidence via `GATE-005`.

- [ ] **CDP-031 — Proxy/protect paymaster secrets as required** `P0`
  - **Rationale:** Raw paymaster URLs/keys must not become public attack surfaces.
  - **Action:** Follow CDP recommended integration pattern; never put secret credentials in browser bundles.
  - **Affected components:** wallet/account adapter, shared engine and web
  - **Depends on:** `ARCH-001`, `ARCH-002`, `AA-001`, `GATE-005`
  - **Acceptance criteria:** Secret scan and network inspection show no sensitive endpoint/key leakage.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/CDP-031.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Coinbase CDP evidence via `GATE-005`.

- [ ] **CDP-032 — Create owner-only security tests** `P0`
  - **Rationale:** The key control invariant must be executable, not documentation-only.
  - **Action:** Test unauthorized signer, wrong chain, replay, modified calldata, malformed batch and recovery cases.
  - **Affected components:** wallet/account adapter, shared engine and web
  - **Depends on:** `ARCH-001`, `ARCH-002`, `AA-001`, `GATE-005`
  - **Acceptance criteria:** All unauthorized paths fail and test suite runs in CI.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/CDP-032.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Coinbase CDP evidence via `GATE-005`.

- [ ] **CDP-033 — Add CDP failure modes** `P1`
  - **Rationale:** Bundler/paymaster/provider outages must not look like asset loss.
  - **Action:** Handle auth outage, bundler timeout, user-op rejected, paymaster denied, unsupported network and wallet reconnect.
  - **Affected components:** wallet/account adapter, shared engine and web
  - **Depends on:** `ARCH-001`, `ARCH-002`, `AA-001`, `GATE-005`
  - **Acceptance criteria:** Each failure maps to actionable UI and safe retry.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/CDP-033.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Coinbase CDP evidence via `GATE-005`.


## Sumsub identity

- [!] **SUM-001 — Confirm Jethos Gateway Integrator eligibility** `P0`
  - **Rationale:** Gateway is useful specifically because Jethos wants to be a non-regulated integrator that does not hold KYC documents.
  - **Action:** Obtain written Sumsub confirmation, plan/tier, sandbox access, production prerequisites and contract type.
  - **Affected components:** provider control plane, identity connector and privacy state
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-001`
  - **Acceptance criteria:** Jethos is explicitly accepted in the intended Integrator role.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SUM-001.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Sumsub evidence via `GATE-001`.

- [!] **SUM-002 — Confirm Reap recipient compatibility for Sumsub ID Gateway token** `P0`
  - **Rationale:** Reap documents token sharing from a platform's own Sumsub account, which is not automatically identical to Sumsub ID Gateway.
  - **Action:** Coordinate Sumsub + Reap; test the exact Sumsub ID share-token format/recipient configuration used by Jethos.
  - **Affected components:** provider control plane, identity connector and privacy state
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-001`, `GATE-002`
  - **Acceptance criteria:** A sandbox Jethos user can be reused by Reap without second document upload, or the architecture records a fallback.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SUM-002.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Sumsub evidence via `GATE-001`.

- [!] **SUM-003 — Confirm Monerium recipient compatibility for Sumsub ID Gateway token** `P0`
  - **Rationale:** Monerium supports Sumsub applicant-token sharing, but exact Gateway compatibility must be proven.
  - **Action:** Coordinate partner setup and run `/profiles/{profile}/share` using the intended Gateway-generated token.
  - **Affected components:** provider control plane, identity connector and privacy state
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-001`, `GATE-003`
  - **Acceptance criteria:** Monerium accepts the flow or fallback is explicitly documented.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SUM-003.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Sumsub evidence via `GATE-001`.

- [!] **SUM-004 — Clarify ACE/CCID issuance availability and commercial path** `P1`
  - **Rationale:** CCID is strategically useful for future regulated on-chain services but should not block V1.
  - **Action:** Confirm how a Sumsub ID verified user proves wallet ownership, receives/links CCID, supported chains and what Jethos can observe.
  - **Affected components:** provider control plane, identity connector and privacy state
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-001`
  - **Acceptance criteria:** Documented sandbox/production issuance flow exists.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SUM-004.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Sumsub evidence via `GATE-001`.

- [ ] **SUM-010 — Implement OIDC discovery and PKCE flow** `P0`
  - **Rationale:** Hosted identity should avoid collecting credentials/documents in Jethos.
  - **Action:** Use Sumsub ID OIDC discovery; implement state, nonce, PKCE, redirect URI allowlist and callback validation.
  - **Affected components:** provider control plane, identity connector and privacy state
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-001`
  - **Acceptance criteria:** CSRF/replay/callback-tampering tests pass.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SUM-010.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Sumsub evidence via `GATE-001`.

- [ ] **SUM-011 — Create minimal `IdentityConnection` model** `P0`
  - **Rationale:** The database should not silently become a KYC dossier.
  - **Action:** Store Jethos user ID, opaque Sumsub subject, connection status, token metadata, timestamps and consent references only as required.
  - **Affected components:** provider control plane, identity connector and privacy state
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-001`
  - **Acceptance criteria:** Schema contains no document/selfie/biometric fields.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SUM-011.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Sumsub evidence via `GATE-001`.

- [ ] **SUM-012 — Encrypt and scope Sumsub tokens** `P0`
  - **Rationale:** OIDC/share tokens can be sensitive even without raw PII.
  - **Action:** Encrypt at rest; prohibit application logs; restrict service access; define TTL/refresh/revocation handling.
  - **Affected components:** provider control plane, identity connector and privacy state
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-001`
  - **Acceptance criteria:** Secret/token audit shows no plaintext logging or unnecessary access.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SUM-012.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Sumsub evidence via `GATE-001`.

- [ ] **SUM-013 — Implement user-visible identity state without pretending to be the KYC decision-maker** `P1`
  - **Rationale:** Jethos should not display a fake universal 'Jethos approved KYC' state.
  - **Action:** Use wording like identity connected/verification available and provider-specific onboarding status.
  - **Affected components:** provider control plane, identity connector and privacy state
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-001`
  - **Acceptance criteria:** UI distinguishes Sumsub identity connection from Reap/Monerium/21X acceptance.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SUM-013.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Sumsub evidence via `GATE-001`.

- [ ] **SUM-020 — Implement recipient partner abstraction** `P0`
  - **Rationale:** Share tokens are recipient-specific and recipients have independent rules.
  - **Action:** Model recipient client ID/config, consent text, token-request endpoint and state separately per provider.
  - **Affected components:** provider control plane, identity connector and privacy state
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-001`
  - **Acceptance criteria:** A Reap token cannot accidentally be used for Monerium.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SUM-020.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Sumsub evidence via `GATE-001`.

- [ ] **SUM-021 — Implement consent before each recipient share** `P0`
  - **Rationale:** Identity sharing is not implicit merely because the user verified once.
  - **Action:** Render recipient identity/purpose, collect consent, timestamp it and support cancel/retry.
  - **Affected components:** provider control plane, identity connector and privacy state
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-001`
  - **Acceptance criteria:** No share token is generated without explicit recipient-specific user action/consent.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SUM-021.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Sumsub evidence via `GATE-001`.

- [ ] **SUM-022 — Treat share tokens as opaque and one-use/short-lived** `P0`
  - **Rationale:** Sumsub explicitly says token format is not stable and tokens are temporary.
  - **Action:** Never parse claims from the token; generate immediately before recipient call; handle expiration/retry.
  - **Affected components:** provider control plane, identity connector and privacy state
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-001`
  - **Acceptance criteria:** Integration passes if token representation changes while remaining a string.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SUM-022.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Sumsub evidence via `GATE-001`.

- [ ] **SUM-023 — Build sandbox reusable-KYC test harness** `P1`
  - **Rationale:** Recipient compatibility must be regression-tested.
  - **Action:** Create test fixtures for approved, incompatible-doc, expired-token, consumed-token, recipient-recheck and action-required states.
  - **Affected components:** provider control plane, identity connector and privacy state
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-001`
  - **Acceptance criteria:** Tests produce deterministic provider-state outcomes.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SUM-023.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Sumsub evidence via `GATE-001`.

- [ ] **SUM-030 — Create identity data-flow inventory / GDPR map** `P0`
  - **Rationale:** Wallet address + identity connection remains personal data even if documents stay at Sumsub.
  - **Action:** Document controller/processor roles, purposes, fields, retention, deletion/export and subprocessors.
  - **Affected components:** provider control plane, identity connector and privacy state
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-001`
  - **Acceptance criteria:** Privacy inventory matches implementation and provider contracts.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SUM-030.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Sumsub evidence via `GATE-001`.

- [ ] **SUM-031 — Implement consent/audit ledger** `P1`
  - **Rationale:** Jethos needs evidence of which recipient the user authorized.
  - **Action:** Record consent version, recipient, timestamp and outcome without storing shared KYC documents.
  - **Affected components:** provider control plane, identity connector and privacy state
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-001`
  - **Acceptance criteria:** Support/debug can reconstruct sharing event history without raw identity data.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SUM-031.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Sumsub evidence via `GATE-001`.

- [!] **SUM-032 — Spike wallet-ownership proof + CCID on target chains** `P1`
  - **Rationale:** ACE/CCID should link identity to the same user-controlled account model.
  - **Action:** Test wallet signature flow on Arbitrum first; record whether credential binds owner EOA, Smart Account or both and how cross-chain mapping works.
  - **Affected components:** provider control plane, identity connector and privacy state
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-001`
  - **Acceptance criteria:** Documented credential/account binding prevents accidental mismatch.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SUM-032.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Sumsub evidence via `GATE-001`.


## Monerium cash and IBAN

- [!] **MON-001 — Confirm whitelabel for Italian personal users** `P0`
  - **Rationale:** The PoC is useful only if the intended market/program is commercially available.
  - **Action:** Get written confirmation of Italy/EEA personal profile eligibility, onboarding agreement, minimums/pricing and Jethos role.
  - **Affected components:** Monerium connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-003`, `SUM-003`
  - **Acceptance criteria:** Commercial path and sandbox/production owner are identified.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MON-001.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Monerium evidence via `GATE-003`.

- [!] **MON-002 — Confirm exact Sumsub ID Gateway token acceptance** `P0`
  - **Rationale:** Monerium documents KYC Sharing with Sumsub, but exact Gateway-origin token must be tested.
  - **Action:** Run the intended share-token flow against sandbox and monitor `profile.updated`.
  - **Affected components:** Monerium connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-003`, `SUM-003`
  - **Acceptance criteria:** Profile data/verifications populate without a second document upload.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MON-002.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Monerium evidence via `GATE-003`.

- [!] **MON-003 — Confirm Smart Contract Wallet ownership-proof path for CDP Smart Account** `P0`
  - **Rationale:** A CDP Smart Account is not necessarily an EOA; address linking must support contract-wallet signatures safely.
  - **Action:** Use Monerium's documented smart-contract-wallet ownership method; test ERC-1271/off-chain or on-chain variant appropriate to CDP.
  - **Affected components:** Monerium connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-003`, `SUM-003`
  - **Acceptance criteria:** Smart Account can be linked without exposing owner private key.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MON-003.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Monerium evidence via `GATE-003`.

- [!] **MON-010 — Create Monerium sandbox application and credentials** `P0`
  - **Rationale:** Client secret/API tokens belong server-side.
  - **Action:** Create whitelabel app, secret storage and environment-specific endpoint config.
  - **Affected components:** Monerium connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-003`, `SUM-003`
  - **Acceptance criteria:** No Monerium credential appears in frontend bundle.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MON-010.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Monerium evidence via `GATE-003`.

- [ ] **MON-011 — Implement OAuth/client-credentials token service** `P0`
  - **Rationale:** All Monerium API calls require controlled server authentication.
  - **Action:** Implement token acquisition, expiry/refresh, retry and metrics; keep access token in server memory/secure store.
  - **Affected components:** Monerium connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-003`, `SUM-003`
  - **Acceptance criteria:** Connector survives token expiry and never returns provider credentials to browser.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MON-011.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Monerium evidence via `GATE-003`.

- [ ] **MON-012 — Implement signed webhook endpoint** `P0`
  - **Rationale:** Profile, IBAN and payment state are asynchronous and webhook-driven.
  - **Action:** Validate signatures/authenticity per Monerium docs, enforce idempotency and persist raw event ID + normalized state.
  - **Affected components:** Monerium connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-003`, `SUM-003`
  - **Acceptance criteria:** Duplicate/forged webhooks cannot corrupt state.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MON-012.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Monerium evidence via `GATE-003`.

- [!] **MON-020 — Create personal profile idempotently** `P0`
  - **Rationale:** Profile UUID is required for downstream actions.
  - **Action:** Create profile only after user intentionally enables cash/IBAN; map provider profile to Jethos `ExternalServiceAccount`.
  - **Affected components:** Monerium connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-003`, `SUM-003`
  - **Acceptance criteria:** Retries do not create duplicate profiles.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MON-020.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Monerium evidence via `GATE-003`.

- [ ] **MON-021 — Submit Sumsub KYC share token** `P0`
  - **Rationale:** This is the core one-KYC bridge.
  - **Action:** Call `/profiles/{profile}/share` with `provider: sumsub`, map asynchronous states, handle incompatibility/source-of-funds follow-up.
  - **Affected components:** Monerium connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-003`, `SUM-003`, `MON-002`
  - **Acceptance criteria:** Profile reaches expected state or displays provider-required action without Jethos inventing KYC status.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MON-021.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Monerium evidence via `GATE-003`.

- [ ] **MON-022 — Handle source-of-funds/document follow-up as provider-owned flow** `P1`
  - **Rationale:** Monerium may require additional information beyond reusable KYC.
  - **Action:** Design hosted/provider-compliant upload/action path so Jethos does not unnecessarily retain sensitive files.
  - **Affected components:** Monerium connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-003`, `SUM-003`
  - **Acceptance criteria:** Additional compliance requests do not silently flow into generic Jethos storage.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MON-022.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Monerium evidence via `GATE-003`.

- [!] **MON-030 — Link CDP Smart Account to Monerium profile** `P0`
  - **Rationale:** The linked address determines where minted EURe arrives.
  - **Action:** Build fixed-message ownership proof through user wallet, submit proof server-side and verify returned address/chain/profile.
  - **Affected components:** Monerium connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-003`, `SUM-003`
  - **Acceptance criteria:** Wrong address/chain cannot be linked by UI state manipulation.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MON-030.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Monerium evidence via `GATE-003`.

- [ ] **MON-031 — Provision IBAN** `P0`
  - **Rationale:** This creates the Revolut-like cash ingress without Jethos accepting deposits.
  - **Action:** Call `POST /ibans` after profile approval + wallet link; handle 202, existing-IBAN/move case and `iban.updated` webhook.
  - **Affected components:** Monerium connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-003`, `SUM-003`
  - **Acceptance criteria:** Dedicated IBAN is displayed with provider disclosure and linked chain/address.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MON-031.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Monerium evidence via `GATE-003`.

- [ ] **MON-032 — Display incoming SEPA → EURe state** `P1`
  - **Rationale:** User must understand that EUR becomes EURe on-chain, not a Jethos bank deposit.
  - **Action:** Normalize incoming payment events and on-chain EURe balance; show pending/settled and transaction reference where available.
  - **Affected components:** Monerium connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-003`, `SUM-003`
  - **Acceptance criteria:** After sandbox incoming payment, UI and wallet balance reconcile.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MON-032.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Monerium evidence via `GATE-003`.

- [ ] **MON-033 — Implement EURe token registry and balance reader** `P0`
  - **Rationale:** Cash dashboard needs chain-accurate token metadata.
  - **Action:** Use verified Monerium token address/decimals for each supported chain; never hardcode from memory.
  - **Affected components:** Monerium connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-003`, `SUM-003`
  - **Acceptance criteria:** Balance reader passes decimals/address tests and source metadata is documented.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MON-033.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Monerium evidence via `GATE-003`.

- [ ] **MON-041 — Implement payment status lifecycle** `P1`
  - **Rationale:** Bank payments are asynchronous and can fail/return.
  - **Action:** Map submitted/processing/completed/failed/returned provider states and webhook updates.
  - **Affected components:** Monerium connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-003`, `SUM-003`
  - **Acceptance criteria:** User sees accurate provider status and retries are safe.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MON-041.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Monerium evidence via `GATE-003`.

- [ ] **MON-042 — Implement optional EURe ↔ USDC conversion through Jethos Builder** `P1`
  - **Rationale:** Monerium mints EURe; DeFi may use USDC.
  - **Action:** Treat conversion as a separate user-selected on-chain swap, built/simulated client-side and signed by Smart Account.
  - **Affected components:** Monerium connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-003`, `SUM-003`
  - **Acceptance criteria:** No automatic backend conversion; rate/fees/slippage shown before approval.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MON-042.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Monerium evidence via `GATE-003`.

- [ ] **MON-043 — Verify fee presentation dynamically** `P1`
  - **Rationale:** Current public pricing may be zero but can change and B2B terms can differ.
  - **Action:** Do not hardcode 'free forever'; source provider fee configuration/terms and present bank/chain/DEX costs separately.
  - **Affected components:** Monerium connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-003`, `SUM-003`
  - **Acceptance criteria:** Pricing copy can change without code refactor.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MON-043.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Monerium evidence via `GATE-003`.

- [ ] **MON-050 — Test Jethos outage recovery** `P0`
  - **Rationale:** The provider account must not be captive to Jethos.
  - **Action:** Document how the user/provider can recover or re-link access if Jethos is unavailable; test address/IBAN continuity.
  - **Affected components:** Monerium connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-003`, `SUM-003`
  - **Acceptance criteria:** No funds are stranded behind Jethos credentials.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MON-050.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Monerium evidence via `GATE-003`.

- [!] **MON-051 — Production readiness review with Monerium compliance** `P0`
  - **Rationale:** Monerium requires production onboarding alignment.
  - **Action:** Review KYC pre-checks, source-of-funds behavior, wording, webhook/security and country rules with Monerium.
  - **Affected components:** Monerium connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-003`, `SUM-003`
  - **Acceptance criteria:** Provider signs off on production flow.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MON-051.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Monerium evidence via `GATE-003`.


## Reap card

- [!] **REAP-001 — Confirm product is available for individual Italian/EEA cardholders** `P0`
  - **Rationale:** Reap has strong embedded-card APIs, but generic API availability does not prove the desired consumer program exists.
  - **Action:** Obtain written eligibility, countries, age/residency rules, issuing entity/scheme and program launch requirements.
  - **Affected components:** Reap connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-002`, `SUM-002`
  - **Acceptance criteria:** Target market is explicitly supported.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/REAP-001.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Reap evidence via `GATE-002`.

- [!] **REAP-002 — Confirm Jethos contractual/regulatory role** `P0`
  - **Rationale:** A card program agreement can impose agent/distributor responsibilities even if the code is API-only.
  - **Action:** Get exact role wording and required licenses/registrations/oversight for Jethos.
  - **Affected components:** Reap connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-002`, `SUM-002`
  - **Acceptance criteria:** Role is compatible with legal strategy or marked no-go until redesigned.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/REAP-002.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Reap evidence via `GATE-002`.

- [!] **REAP-003 — Confirm Sumsub ID Gateway token compatibility** `P0`
  - **Rationale:** Reap docs currently describe token sharing from the platform's own Sumsub account; Gateway is not assumed equivalent.
  - **Action:** Test/obtain confirmation that Sumsub ID Gateway share tokens can be accepted, or define a compliant alternate one-KYC setup.
  - **Affected components:** Reap connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-002`, `SUM-002`
  - **Acceptance criteria:** User is reused without duplicate document upload in the approved program.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/REAP-003.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Reap evidence via `GATE-002`.

- [!] **REAP-004 — Confirm program mode/funding model/networks** `P0`
  - **Rationale:** Card funding design affects multi-chain architecture and whether funds sit in a Reap account.
  - **Action:** Document account type, user-funded model, supported stablecoins/networks, Base/Polygon/CCTP behavior and custody/funding semantics.
  - **Affected components:** Reap connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-002`, `SUM-002`
  - **Acceptance criteria:** Exact fund flow diagram is approved by Reap.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/REAP-004.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Reap evidence via `GATE-002`.

- [!] **REAP-010 — Create sandbox business/program** `P0`
  - **Rationale:** All card lifecycle work must be tested with the actual program configuration.
  - **Action:** Obtain sandbox credentials; configure program mode, funding model, webhook secret and allowed features.
  - **Affected components:** Reap connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-002`, `SUM-002`
  - **Acceptance criteria:** Program metadata is version-controlled in non-secret config.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/REAP-010.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Reap evidence via `GATE-002`.

- [ ] **REAP-011 — Implement Reap user/account creation idempotently** `P0`
  - **Rationale:** Card creation depends on approved user + active account.
  - **Action:** Create provider user/account only after explicit card enable action; map IDs into `ExternalServiceAccount`.
  - **Affected components:** Reap connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-002`, `SUM-002`
  - **Acceptance criteria:** Retries do not create duplicate cardholders/accounts.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/REAP-011.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Reap evidence via `GATE-002`.

- [ ] **REAP-012 — Implement Sumsub Token Sharing application step** `P0`
  - **Rationale:** This is the one-KYC bridge if approved.
  - **Action:** Generate fresh recipient token then advance Reap application using `SUMSUB_TOKEN_SHARING`; handle success/failure/rate limit/expired token.
  - **Affected components:** Reap connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-002`, `SUM-002`, `REAP-003`
  - **Acceptance criteria:** Sandbox user reaches `APPROVED` without a second KYC SDK flow.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/REAP-012.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Reap evidence via `GATE-002`.

- [ ] **REAP-013 — Implement application-status webhooks** `P0`
  - **Rationale:** Reap state changes asynchronously and should be webhook-led.
  - **Action:** Verify webhook signatures, idempotency and event ordering; normalize application status.
  - **Affected components:** Reap connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-002`, `SUM-002`
  - **Acceptance criteria:** UI matches Reap source of truth after duplicate/out-of-order events.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/REAP-013.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Reap evidence via `GATE-002`.

- [!] **REAP-020 — Issue virtual card** `P0`
  - **Rationale:** Virtual card is the fastest card MVP.
  - **Action:** Call create-card only when user approved/account active; persist card ID/type/status but not PAN/CVV.
  - **Affected components:** Reap connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-002`, `SUM-002`
  - **Acceptance criteria:** Sandbox card becomes active and usable in provider test environment.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/REAP-020.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Reap evidence via `GATE-002`.

- [ ] **REAP-021 — Implement secure card detail reveal session** `P0`
  - **Rationale:** PAN/CVV should not transit Jethos backend/database.
  - **Action:** Create short-lived reveal session server-side and render Reap `revealUrl` in iframe/WebView with appropriate CSP/frame rules.
  - **Affected components:** Reap connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-002`, `SUM-002`
  - **Acceptance criteria:** Network/log/database review shows no PAN/CVV stored by Jethos.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/REAP-021.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Reap evidence via `GATE-002`.

- [ ] **REAP-022 — Implement freeze/unfreeze lifecycle** `P1`
  - **Rationale:** Basic card management must feel native in Jethos.
  - **Action:** Use provider endpoints and update only after confirmed response/webhook.
  - **Affected components:** Reap connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-002`, `SUM-002`
  - **Acceptance criteria:** Freeze/unfreeze state reconciles with Reap.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/REAP-022.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Reap evidence via `GATE-002`.

- [ ] **REAP-023 — Implement card-status failure states** `P1`
  - **Rationale:** BLOCKED/EXPIRED are not equivalent to user freeze.
  - **Action:** Display provider-owned reason/action; do not allow Jethos to pretend it can unblock compliance/risk blocks.
  - **Affected components:** Reap connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-002`, `SUM-002`
  - **Acceptance criteria:** All documented status variants have UX.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/REAP-023.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Reap evidence via `GATE-002`.

- [!] **REAP-024 — Implement PIN flow only if program supports it** `P2`
  - **Rationale:** PIN handling is sensitive and may be unnecessary for virtual-card MVP.
  - **Action:** Use provider API/secure UI flow without persisting PIN; add rate/error handling.
  - **Affected components:** Reap connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-002`, `SUM-002`
  - **Acceptance criteria:** Jethos never logs/stores PIN.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/REAP-024.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Reap evidence via `GATE-002`.

- [!] **REAP-030 — Physical-card shipping spike** `P2`
  - **Rationale:** Physical cards add address, logistics and compliance complexity.
  - **Action:** Implement only after virtual-card MVP: address validation, card design, shipment state/webhooks, activation.
  - **Affected components:** Reap connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-002`, `SUM-002`
  - **Acceptance criteria:** No unnecessary shipping PII retained beyond documented purpose.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/REAP-030.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Reap evidence via `GATE-002`.

- [!] **REAP-031 — Apple Pay / Google Pay provisioning spike** `P2`
  - **Rationale:** Mobile-wallet provisioning materially improves UX but has platform/program prerequisites.
  - **Action:** Follow Reap digital-wallet path; isolate device/platform entitlements and provider verification.
  - **Affected components:** Reap connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-002`, `SUM-002`
  - **Acceptance criteria:** Provisioning works without exposing card secrets to Jethos.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/REAP-031.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Reap evidence via `GATE-002`.

- [ ] **REAP-041 — Handle Base/Polygon funding path explicitly** `P1`
  - **Rationale:** The card rail may use networks different from Arbitrum.
  - **Action:** Model chain switch and provider-managed CCTP/bridging where supported; do not silently bridge through a Jethos backend.
  - **Affected components:** Reap connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-002`, `SUM-002`
  - **Acceptance criteria:** User sees source chain, destination/funding chain, amount and fees.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/REAP-041.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Reap evidence via `GATE-002`.

- [ ] **REAP-042 — Implement card transactions + webhooks** `P1`
  - **Rationale:** Unified UX needs reliable spend history.
  - **Action:** Consume provider transaction lifecycle events; normalize merchant/amount/status without making Jethos accounting authoritative over provider.
  - **Affected components:** Reap connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-002`, `SUM-002`
  - **Acceptance criteria:** Card history reconciles with provider sandbox.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/REAP-042.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Reap evidence via `GATE-002`.

- [ ] **REAP-043 — Implement spend-policy controls only as user/program settings** `P2`
  - **Rationale:** Reap can enforce spend policies, but Jethos should not become discretionary financial manager.
  - **Action:** Expose supported controls transparently and submit user-selected settings; distinguish program-level mandatory controls from user controls.
  - **Affected components:** Reap connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-002`, `SUM-002`
  - **Acceptance criteria:** Every rule has clear owner and provider enforcement semantics.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/REAP-043.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Reap evidence via `GATE-002`.

- [ ] **REAP-050 — Define PCI/card-data boundary** `P0`
  - **Rationale:** Card UI can accidentally drag Jethos into sensitive PCI scope.
  - **Action:** Document which card data ever touches Jethos systems; prefer provider-hosted reveal; run logs/telemetry review.
  - **Affected components:** Reap connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-002`, `SUM-002`
  - **Acceptance criteria:** PAN/CVV do not enter Jethos storage/logging unless explicitly required and scoped.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/REAP-050.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Reap evidence via `GATE-002`.

- [ ] **REAP-051 — Test provider/Jethos outage behavior** `P1`
  - **Rationale:** A cardholder needs a support/recovery path when Jethos is down.
  - **Action:** Document direct provider support and card emergency controls; ensure Jethos does not represent itself as issuer.
  - **Affected components:** Reap connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-002`, `SUM-002`
  - **Acceptance criteria:** Support runbook covers unavailable API and blocked card.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/REAP-051.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Reap evidence via `GATE-002`.

- [!] **REAP-052 — Production go-live checklist with Reap program manager** `P0`
  - **Rationale:** Program capabilities are enabled per account/program.
  - **Action:** Review KYC method, webhook security, designs, physical/digital wallet features, funding model, limits, country eligibility and disclosures.
  - **Affected components:** Reap connector, control plane and client
  - **Depends on:** `ARCH-005`, `BACK-001`, `GATE-002`, `SUM-002`
  - **Acceptance criteria:** Reap approves production program configuration.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/REAP-052.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Reap evidence via `GATE-002`.


## 21X securities handoff/integration

- [!] **X21-001 — Confirm Italian retail onboarding availability** `P0`
  - **Rationale:** V1 only works if the target user can actually become a 21X participant.
  - **Action:** Ask 21X for eligibility, onboarding requirements, supported jurisdictions, accounts and production access.
  - **Affected components:** 21X isolated module, client and feature gates
  - **Depends on:** `GATE-004`
  - **Acceptance criteria:** Written confirmation for intended Italian retail profile.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/X21-001.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** 21X evidence via `GATE-004`; V2 is legal-gated.

- [!] **X21-002 — Confirm V1 deep-link / external frontend model** `P0`
  - **Rationale:** This is the low-regulatory-complexity first securities experience.
  - **Action:** Agree permitted branding/linking, whether Jethos may show market/catalog data and required disclosures.
  - **Affected components:** 21X isolated module, client and feature gates
  - **Depends on:** `GATE-004`
  - **Acceptance criteria:** Jethos can direct user into 21X-controlled onboarding/trading without capturing an order.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/X21-002.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** 21X evidence via `GATE-004`; V2 is legal-gated.

- [!] **X21-003 — Confirm Sumsub-issued ACE/CCID acceptance** `P1`
  - **Rationale:** ACE adoption plus Sumsub CCID support does not prove 21X trusts that issuer/claim set.
  - **Action:** Ask exact trusted issuer/claims, wallet-binding requirements and fallback KYC.
  - **Affected components:** 21X isolated module, client and feature gates
  - **Depends on:** `GATE-004`, `SUM-004`
  - **Acceptance criteria:** Documented yes/no and required additional checks.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/X21-003.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** 21X evidence via `GATE-004`; V2 is legal-gated.

- [ ] **X21-010 — Build provider-isolated Invest module** `P1`
  - **Rationale:** Securities must not leak into DeFi order-builder semantics accidentally.
  - **Action:** Create separate `21XProvider`/Invest domain with read-only catalogue/eligibility/link actions; do not reuse generic 'execute financial order' backend.
  - **Affected components:** 21X isolated module, client and feature gates
  - **Depends on:** `X21-002`, `ARCH-013`
  - **Acceptance criteria:** No V1 API endpoint accepts a securities order.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/X21-010.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** 21X evidence via `GATE-004`; V2 is legal-gated.

- [ ] **X21-011 — Implement provider disclosure and external handoff** `P0`
  - **Rationale:** User must know 21X, not Jethos, provides trading.
  - **Action:** Show 'Trading provided by 21X', external transition and relevant terms/eligibility status before opening provider frontend.
  - **Affected components:** 21X isolated module, client and feature gates
  - **Depends on:** `X21-010`, `X21-002`
  - **Acceptance criteria:** Handoff contains no signed order payload.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/X21-011.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** 21X evidence via `GATE-004`; V2 is legal-gated.

- [!] **X21-012 — Add optional read-only market data if contract/API permits** `P2`
  - **Rationale:** A richer Jethos UX can show available assets without executing trades.
  - **Action:** Use public/permitted REST data and cache with timestamps; do not present personalized recommendations.
  - **Affected components:** 21X isolated module, client and feature gates
  - **Depends on:** `X21-010`, `X21-002`
  - **Acceptance criteria:** Data source/time is visible and stale data is handled.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/X21-012.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** 21X evidence via `GATE-004`; V2 is legal-gated.

- [!] **X21-020 — Resolve browser integration mismatch in current SDK** `P0`
  - **Rationale:** Current public 21X SDK is Python and examples use Web3.py/private-key signing; that is not acceptable as a browser self-custodial integration by default.
  - **Action:** Ask for JS/browser SDK, contract ABIs, transaction-builder API or supported external signing middleware. Do not put user private keys in Jethos or server-side Python.
  - **Affected components:** 21X isolated module, client and feature gates
  - **Depends on:** `X21-003`, `GATE-004`
  - **Acceptance criteria:** A documented path exists where wallet signs directly and Jethos receives no private key.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/X21-020.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** 21X evidence via `GATE-004`; V2 is legal-gated.

- [!] **X21-021 — Get written 'technical frontend' regulatory/contractual answer** `P0`
  - **Rationale:** Client-side signing alone does not automatically exclude MiFID RTO/execution.
  - **Action:** Provide exact sequence diagram and ask whether 21X requires investment-firm/agent status or can contract with Jethos as technical frontend.
  - **Affected components:** 21X isolated module, client and feature gates
  - **Depends on:** `X21-020`
  - **Acceptance criteria:** Written role answer obtained and later validated by counsel.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/X21-021.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** 21X evidence via `GATE-004`; V2 is legal-gated.

- [!] **X21-022 — Obtain specialist MiFID legal gate for V2** `P0`
  - **Rationale:** Tokenized stocks/bonds/funds are a different regulatory perimeter from generic DeFi.
  - **Action:** Give counsel exact code path: market data → local order construction → wallet signature → direct 21X smart contract/venue; no Jethos relay.
  - **Affected components:** 21X isolated module, client and feature gates
  - **Depends on:** `X21-021`, `LEGAL-021`
  - **Acceptance criteria:** Written approval/required constraints recorded.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/X21-022.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** 21X evidence via `GATE-004`; V2 is legal-gated.

- [!] **X21-030 — Implement Polygon/21X chain account mapping** `P1`
  - **Rationale:** Current smart-contract docs use Polygon; Jethos's main DeFi account may be Arbitrum.
  - **Action:** Create/resolve appropriate user wallet/account for 21X, gas asset, allowlist/whitelist status and chain switching.
  - **Affected components:** 21X isolated module, client and feature gates
  - **Depends on:** `X21-020`, `CDP-003C`
  - **Acceptance criteria:** No assumption that Arbitrum Smart Account can trade on Polygon.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/X21-030.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** 21X evidence via `GATE-004`; V2 is legal-gated.

- [!] **X21-031 — Implement read-only trading-pair/orderbook discovery** `P1`
  - **Rationale:** Order construction needs authoritative pair/orderbook addresses and token metadata.
  - **Action:** Fetch 21X REST data client-side or through a non-order backend cache; validate addresses/network.
  - **Affected components:** 21X isolated module, client and feature gates
  - **Depends on:** `X21-030`
  - **Acceptance criteria:** Order target derives from 21X source, not hardcoded stale data.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/X21-031.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** 21X evidence via `GATE-004`; V2 is legal-gated.

- [!] **X21-032 — Implement direct allowance transaction** `P1`
  - **Rationale:** 21X orderbooks require token allowances.
  - **Action:** Construct allowance call for user's wallet, show spender/amount and require user approval.
  - **Affected components:** 21X isolated module, client and feature gates
  - **Depends on:** `X21-031`
  - **Acceptance criteria:** No unlimited allowance unless intentionally selected/explained.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/X21-032.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** 21X evidence via `GATE-004`; V2 is legal-gated.

- [!] **X21-033 — Implement direct buy/sell order construction** `P1`
  - **Rationale:** V2 value depends on preserving self-custodial signing.
  - **Action:** Use approved browser/ABI/middleware path to construct exact order call locally; display quantity, limit price, token, fees and target.
  - **Affected components:** 21X isolated module, client and feature gates
  - **Depends on:** `X21-032`, `BLD-030B`
  - **Acceptance criteria:** User wallet signs/submits directly; Jethos backend never sees signed order.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/X21-033.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** 21X evidence via `GATE-004`; V2 is legal-gated.

- [!] **X21-034 — Implement direct order cancellation** `P1`
  - **Rationale:** User must control open-order lifecycle without Jethos discretion.
  - **Action:** Read user's open orders and construct cancel call locally.
  - **Affected components:** 21X isolated module, client and feature gates
  - **Depends on:** `X21-033`
  - **Acceptance criteria:** Cancellation is user-authorized and direct.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/X21-034.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** 21X evidence via `GATE-004`; V2 is legal-gated.

- [!] **X21-035 — Prove no-order-relay invariant technically** `P0`
  - **Rationale:** Regulatory design must be enforced in code.
  - **Action:** Add network/backend tests ensuring no endpoint accepts signed 21X orders/private keys/raw order submission payloads.
  - **Affected components:** 21X isolated module, client and feature gates
  - **Depends on:** `X21-033`, `X21-034`, `BACK-001`, `LEGAL-021`
  - **Acceptance criteria:** CI regression fails if a relay endpoint is introduced.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/X21-035.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** 21X evidence via `GATE-004`; V2 is legal-gated.


## Financial plan Builder

- [ ] **BLD-002 — Create neutral option catalogue** `P0`
  - **Rationale:** Protocol discovery can become personalized advice if ranking logic is opaque/personalized.
  - **Action:** Expose objective data fields with source/timestamp and deterministic neutral sorting/filter options; no `recommendedForUser` field.
  - **Affected components:** shared financial engine and wallet/client adapters
  - **Depends on:** `ARCH-003C`, `ARCH-004`, `AA-001`, `WEB-001`
  - **Acceptance criteria:** Tests prove the same input rules produce the same eligible options regardless of personal profile.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-002.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **BLD-003 — Version generic templates** `P1`
  - **Rationale:** Templates are useful but changes must be auditable.
  - **Action:** Create generic templates with version, assumptions, supported assets/protocols and no personal suitability claim.
  - **Affected components:** shared financial engine and wallet/client adapters
  - **Depends on:** `ARCH-003C`, `ARCH-004`, `AA-001`, `WEB-001`
  - **Acceptance criteria:** User can inspect/edit every parameter before building transactions.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-003.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **BLD-010 — Define TypeScript `ProtocolAdapter` interface** `P0`
  - **Rationale:** Protocol-specific encoding should not contaminate planner logic.
  - **Action:** Define typed read/build methods returning normalized positions and immutable `Call[]`; no provider sends transaction itself.
  - **Affected components:** shared financial engine and wallet/client adapters
  - **Depends on:** `ARCH-003C`, `ARCH-004`, `AA-001`, `WEB-001`
  - **Acceptance criteria:** Adapters cannot submit/sign by interface design.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-010.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **BLD-012 — Create protocol capability model** `P1`
  - **Rationale:** Not every protocol supports same actions/assets.
  - **Action:** Expose supported action types, asset constraints, collateral/borrow capabilities and required approval style.
  - **Affected components:** shared financial engine and wallet/client adapters
  - **Depends on:** `ARCH-003C`, `ARCH-004`, `AA-001`, `WEB-001`
  - **Acceptance criteria:** Planner cannot ask an adapter for unsupported action.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-012.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **BLD-023 — Implement plan fingerprint/hash** `P1`
  - **Rationale:** Preview, simulation and signed bytes must stay linked.
  - **Action:** Hash the AA-001 canonical domain: ordered calls, chain/account identity, registry version/code provenance, observed block/state assumptions, validity deadline, user RuleSet/limits and permission scope; persist the fingerprint and link it to the decoded account envelope.
  - **Affected components:** shared financial engine and wallet/client adapters
  - **Depends on:** `ARCH-003C`, `ARCH-004`, `AA-001`, `WEB-001`
  - **Acceptance criteria:** Any financial-domain mutation invalidates prior preview/simulation; only AA-001-allowed gas/paymaster fields may change without changing the reviewed financial fingerprint.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-023.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **BLD-033 — Display gas/fees/slippage separately** `P1`
  - **Rationale:** Unified UX must not hide protocol/chain costs.
  - **Action:** Show gas estimate, protocol fee if known, swap LP fee/spread/slippage and provider fee where applicable.
  - **Affected components:** shared financial engine and wallet/client adapters
  - **Depends on:** `ARCH-003C`, `ARCH-004`, `AA-001`, `WEB-001`
  - **Acceptance criteria:** No 'zero fee' claim is hardcoded when fee source is variable.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-033.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **BLD-040 — Verify the CDP executable Smart Account envelope before authorization** `P0`
  - **Rationale:** Builder must not submit transactions, but inner `Call[]` equality alone does not prove what the Smart Account will execute.
  - **Action:** Pass the canonical plan to the client wallet adapter, obtain account calldata/UserOperation, decode ordered target/value/data plus chain/account/validity/permission scope, compare it with the reviewed and simulated plan, reject mismatch, and never route the signed result through a Jethos backend.
  - **Affected components:** shared financial engine and wallet/client adapters
  - **Depends on:** `BLD-023`, `BLD-030B`, `BLD-031B`, `CDP-021`, `CDP-022`, `AA-001`, `WEB-001`
  - **Acceptance criteria:** Decoded executable financial fields equal the approved plan and simulated envelope; only explicitly allowed gas/paymaster mutation passes; transaction receipt input/account/chain reconcile to that envelope.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-040.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **BLD-041 — Require user approval for V1 every financial plan** `P0`
  - **Rationale:** Manual approval keeps discretion with user and simplifies initial legal/security model.
  - **Action:** No scheduled/autonomous transaction is enabled in V1.
  - **Affected components:** shared financial engine and wallet/client adapters
  - **Depends on:** `ARCH-003C`, `ARCH-004`, `AA-001`, `WEB-001`
  - **Acceptance criteria:** Every execution has a user authorization event.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-041.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **BLD-042 — Persist execution receipt without creating a Jethos balance ledger** `P1`
  - **Rationale:** History is useful, but Jethos must not become source of truth for ownership.
  - **Action:** Store tx/user-op IDs, plan hash, decoded action summary and observed post-state; balances remain chain/provider-derived.
  - **Affected components:** shared financial engine and wallet/client adapters
  - **Depends on:** `ARCH-003C`, `ARCH-004`, `AA-001`, `WEB-001`
  - **Acceptance criteria:** Deleting Jethos history does not affect asset access.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-042.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **BLD-051 — Build an expiring rebalance plan from pinned state** `P1`
  - **Rationale:** Rebalancing stale quantities can be unsafe.
  - **Action:** When the user opens a notification, read a finalized observation `{chainId, account, block, registryVersion}`, record freshness policy/state assumptions, compile with a validity deadline, and require re-simulation plus user review after expiry or a state-bound failure.
  - **Affected components:** shared financial engine and wallet/client adapters
  - **Depends on:** `ARCH-003C`, `ARCH-004`, `AA-001`, `WEB-001`, `BLD-030B`, `BLD-032B`
  - **Acceptance criteria:** Plan records the exact observation block/registry/deadline, fails closed when stale, and remains editable/cancellable before a new authorization.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-051.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **BLD-052 — Gate any V2 session-key automation behind new ADR + legal/security review** `P2`
  - **Rationale:** Delegated automation changes the control model.
  - **Action:** Require bounded targets/methods/value/token/expiry/revocation/deterministic condition and independent keeper design.
  - **Affected components:** shared financial engine and wallet/client adapters
  - **Depends on:** `ARCH-003C`, `ARCH-004`, `AA-001`, `WEB-001`
  - **Acceptance criteria:** No general `execute(anyTarget,anyCalldata)` or Jethos discretionary trigger.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-052.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None


## Aave direct adapter

- [ ] **AAVE-002 — Load official deployment/token metadata through registry** `P0`
  - **Rationale:** Stale contract addresses can cause loss.
  - **Action:** Record Pool/PoolAddressesProvider/token addresses, decimals and source/version for target network.
  - **Affected components:** Aave TS adapter, registry, readers and legacy evidence
  - **Depends on:** `ARCH-004`, `BLD-010`, `BLD-020B`
  - **Acceptance criteria:** Automated chain-code/address validation passes.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/AAVE-002.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **AAVE-003 — Implement read position adapter** `P0`
  - **Rationale:** Builder needs normalized current balance/position before planning.
  - **Action:** Read supplied balance and relevant account data; normalize to Jethos `ProtocolPosition`.
  - **Affected components:** Aave TS adapter, registry, readers and legacy evidence
  - **Depends on:** `ARCH-004`, `BLD-010`, `BLD-020B`
  - **Acceptance criteria:** Known test account reconciles with protocol UI/on-chain reads.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/AAVE-003.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **AAVE-010 — Build USDC supply call** `P0`
  - **Rationale:** First end-to-end Builder primitive.
  - **Action:** Resolve allowance, encode Aave Pool supply with user Smart Account as beneficiary where appropriate, no Jethos recipient.
  - **Affected components:** Aave TS adapter, registry, readers and legacy evidence
  - **Depends on:** `ARCH-004`, `BLD-010`, `BLD-020B`
  - **Acceptance criteria:** Decoded call shows exact asset/amount/on-behalf-of target; testnet execution succeeds.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/AAVE-010.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **AAVE-011 — Build withdraw call** `P0`
  - **Rationale:** Exitability is as important as deposit.
  - **Action:** Encode withdraw to user Smart Account; support exact amount and max semantics safely.
  - **Affected components:** Aave TS adapter, registry, readers and legacy evidence
  - **Depends on:** `ARCH-004`, `BLD-010`, `BLD-020B`
  - **Acceptance criteria:** User can fully exit position to own account.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/AAVE-011.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **AAVE-012 — Test approval strategies** `P1`
  - **Rationale:** Unlimited approvals are a user risk.
  - **Action:** Compare exact approval, limited buffer and Permit2 where applicable; choose documented MVP policy.
  - **Affected components:** Aave TS adapter, registry, readers and legacy evidence
  - **Depends on:** `ARCH-004`, `BLD-010`, `BLD-020B`
  - **Acceptance criteria:** UI explains spender and amount; revoke path documented.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/AAVE-012.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **AAVE-020 — Create fork/testnet simulation fixtures** `P0`
  - **Rationale:** Real protocol state is needed to test success and revert conditions.
  - **Action:** Test supply/withdraw, insufficient balance, insufficient allowance, paused/reserve-disabled and wrong-chain cases.
  - **Affected components:** Aave TS adapter, registry, readers and legacy evidence
  - **Depends on:** `ARCH-004`, `BLD-010`, `BLD-020B`
  - **Acceptance criteria:** Expected success/revert results are deterministic.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/AAVE-020.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **AAVE-021 — Post-state verification** `P1`
  - **Rationale:** Receipt success alone does not prove expected economic state.
  - **Action:** After transaction re-read wallet and Aave position; compare expected deltas.
  - **Affected components:** Aave TS adapter, registry, readers and legacy evidence
  - **Depends on:** `ARCH-004`, `BLD-010`, `BLD-020B`
  - **Acceptance criteria:** Mismatch is surfaced and logged.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/AAVE-021.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **AAVE-022 — Document future borrow/repay gate** `P2`
  - **Rationale:** Borrowing introduces health factor/liquidation and more risk presentation.
  - **Action:** Create separate decision record/tasks before enabling borrow, repay, collateral toggles or leverage.
  - **Affected components:** Aave TS adapter, registry, readers and legacy evidence
  - **Depends on:** `ARCH-004`, `BLD-010`, `BLD-020B`
  - **Acceptance criteria:** No hidden borrowing path exists in MVP.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/AAVE-022.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None


## Morpho Blue and MetaMorpho

- [ ] **MORPHO-002 — Create verified market/vault registry model** `P0`
  - **Rationale:** Addresses/market IDs may differ from Aave-style pool architecture.
  - **Action:** Store authoritative contract addresses, market IDs/vaults, assets and chain source metadata.
  - **Affected components:** Morpho Blue/MetaMorpho adapters, registry and readers
  - **Depends on:** `ARCH-004`, `BLD-010`, `BLD-020B`
  - **Acceptance criteria:** Unsupported/stale market cannot be selected silently.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MORPHO-002.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **MORPHO-003 — Implement normalized position reader** `P0`
  - **Rationale:** Unified UX needs a common position abstraction without hiding product differences.
  - **Action:** Read shares/assets/market data appropriate to chosen primitive and normalize with protocol-specific metadata retained.
  - **Affected components:** Morpho Blue/MetaMorpho adapters, registry and readers
  - **Depends on:** `ARCH-004`, `BLD-010`, `BLD-020B`
  - **Acceptance criteria:** Position reconciles with on-chain source.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MORPHO-003.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **MORPHO-010 — Implement supply/deposit call builder** `P0`
  - **Rationale:** Builder must call protocol directly from user account.
  - **Action:** Resolve approvals, encode exact chosen Morpho action and set receiver/beneficiary to user Smart Account as appropriate.
  - **Affected components:** Morpho Blue/MetaMorpho adapters, registry and readers
  - **Depends on:** `ARCH-004`, `BLD-010`, `BLD-020B`
  - **Acceptance criteria:** No Jethos address receives funds/shares.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MORPHO-010.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **MORPHO-011 — Implement withdraw/redeem call builder** `P0`
  - **Rationale:** Exit path must be first-class.
  - **Action:** Encode asset/share withdrawal semantics correctly and return assets to user Smart Account.
  - **Affected components:** Morpho Blue/MetaMorpho adapters, registry and readers
  - **Depends on:** `ARCH-004`, `BLD-010`, `BLD-020B`
  - **Acceptance criteria:** Full exit works in test fixture.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MORPHO-011.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **MORPHO-012 — Handle share/asset conversion and rounding** `P0`
  - **Rationale:** Vault/share accounting can introduce rounding errors.
  - **Action:** Use protocol-native preview/conversion methods and exact integer arithmetic; never float.
  - **Affected components:** Morpho Blue/MetaMorpho adapters, registry and readers
  - **Depends on:** `ARCH-004`, `BLD-010`, `BLD-020B`
  - **Acceptance criteria:** Boundary/rounding tests pass.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MORPHO-012.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **MORPHO-013 — Create simulation/revert fixtures** `P1`
  - **Rationale:** Market/vault constraints differ from Aave.
  - **Action:** Test cap, liquidity, paused/frozen state, min shares/assets, allowance and stale configuration cases.
  - **Affected components:** Morpho Blue/MetaMorpho adapters, registry and readers
  - **Depends on:** `ARCH-004`, `BLD-010`, `BLD-020B`
  - **Acceptance criteria:** Builder explains or fails closed on unsupported state.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MORPHO-013.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **MORPHO-014 — Post-state verification and unified display** `P1`
  - **Rationale:** The user should see one Earn page while preserving protocol truth.
  - **Action:** Re-read resulting position and map principal/current value/yield metadata with source.
  - **Affected components:** Morpho Blue/MetaMorpho adapters, registry and readers
  - **Depends on:** `ARCH-004`, `BLD-010`, `BLD-020B`
  - **Acceptance criteria:** Unified dashboard matches protocol state.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MORPHO-014.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None


## Euler V2 and EVC

- [ ] **EULER-002 — Implement verified deployment/market registry** `P0`
  - **Rationale:** Builder must never discover critical targets from untrusted arbitrary input.
  - **Action:** Pin approved markets/vaults with chain/source/version and capability metadata.
  - **Affected components:** Euler/EVC adapter, registry and readers
  - **Depends on:** `ARCH-004`, `BLD-010`, `BLD-020B`
  - **Acceptance criteria:** Only allowlisted Euler targets are buildable in MVP.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/EULER-002.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **EULER-003 — Implement normalized position reader** `P0`
  - **Rationale:** Multi-protocol allocation requires current Euler position.
  - **Action:** Read protocol-native shares/assets/position and preserve product-specific fields.
  - **Affected components:** Euler/EVC adapter, registry and readers
  - **Depends on:** `ARCH-004`, `BLD-010`, `BLD-020B`
  - **Acceptance criteria:** Test account reconciles with on-chain state.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/EULER-003.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **EULER-010 — Implement supply/deposit builder** `P0`
  - **Rationale:** Third protocol proves adapter extensibility.
  - **Action:** Encode direct action with user as receiver/beneficiary; resolve allowance and exact decimals.
  - **Affected components:** Euler/EVC adapter, registry and readers
  - **Depends on:** `ARCH-004`, `BLD-010`, `BLD-020B`
  - **Acceptance criteria:** Successful fork/test execution.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/EULER-010.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **EULER-011 — Implement withdraw/redeem builder** `P0`
  - **Rationale:** Users must be able to exit independently.
  - **Action:** Encode direct withdrawal to Smart Account and handle max/liquidity cases.
  - **Affected components:** Euler/EVC adapter, registry and readers
  - **Depends on:** `ARCH-004`, `BLD-010`, `BLD-020B`
  - **Acceptance criteria:** Full and partial withdrawal tests pass.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/EULER-011.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **EULER-012 — Handle share conversions/caps/liquidity constraints** `P1`
  - **Rationale:** Vault-like semantics can differ materially.
  - **Action:** Use native previews/checks; validate caps and liquidity before user signing.
  - **Affected components:** Euler/EVC adapter, registry and readers
  - **Depends on:** `ARCH-004`, `BLD-010`, `BLD-020B`
  - **Acceptance criteria:** Simulation catches expected constraint failures.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/EULER-012.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **EULER-013 — Post-state verification** `P1`
  - **Rationale:** Unified portfolio must reflect actual Euler result.
  - **Action:** Re-read after receipt and reconcile expected asset/position deltas.
  - **Affected components:** Euler/EVC adapter, registry and readers
  - **Depends on:** `ARCH-004`, `BLD-010`, `BLD-020B`
  - **Acceptance criteria:** Mismatch warning path tested.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/EULER-013.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None


## Multi-chain

- [ ] **CHAIN-001 — Treat chain as first-class in every financial object** `P0`
  - **Rationale:** Arbitrum/Base/Polygon may host different services.
  - **Action:** Require chainId on account, asset, protocol position, call, provider funding address and transaction plan.
  - **Affected components:** domain identity, registry, wallet and client
  - **Depends on:** `ARCH-003C`, `ARCH-004`
  - **Acceptance criteria:** No financial identifier is ambiguous across chains.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/CHAIN-001.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **CHAIN-002 — Prove CDP account/address behavior on Arbitrum/Base/Polygon** `P0`
  - **Rationale:** Do not assume one Smart Account address is reproduced across networks.
  - **Action:** Create test user and record owner/Smart Account addresses/deployment state on all target chains.
  - **Affected components:** domain identity, registry, wallet and client
  - **Depends on:** `ARCH-003C`, `ARCH-004`
  - **Acceptance criteria:** Empirical mapping documented and reflected in domain model.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/CHAIN-002.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **CHAIN-003 — Create explicit chain-switch UX** `P1`
  - **Rationale:** A Revolut-like UX should hide complexity without hiding which network receives value.
  - **Action:** Before cross-chain-required action show source/destination network and required account deployment/gas.
  - **Affected components:** domain identity, registry, wallet and client
  - **Depends on:** `ARCH-003C`, `ARCH-004`
  - **Acceptance criteria:** User cannot sign a call on unintended chain.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/CHAIN-003.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **CHAIN-010 — Ban implicit Jethos custodial bridging** `P0`
  - **Rationale:** Multi-chain convenience must not put funds through a Jethos wallet.
  - **Action:** Any bridge/CCTP operation must be a user-authorized direct protocol/provider call or provider-managed flow.
  - **Affected components:** domain identity, registry, wallet and client
  - **Depends on:** `ARCH-003C`, `ARCH-004`
  - **Acceptance criteria:** No backend deposit address or treasury wallet is used as bridge hop.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/CHAIN-010.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **CHAIN-011 — Create bridge-provider abstraction only when needed** `P1`
  - **Rationale:** Do not build multi-chain complexity before Reap/21X requirements are confirmed.
  - **Action:** Represent optional transfer plan with provider/route/fees/source/destination and separate user approval.
  - **Affected components:** domain identity, registry, wallet and client
  - **Depends on:** `ARCH-003C`, `ARCH-004`
  - **Acceptance criteria:** Core DeFi works single-chain without bridge dependency.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/CHAIN-011.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [!] **CHAIN-012 — Reap funding route decision** `P0`
  - **Rationale:** Card funding may require Base/Polygon while user's liquid cash may be on Arbitrum.
  - **Action:** After Reap confirms program, choose: maintain Base balance, provider-managed route, direct CCTP, or alternate provider.
  - **Affected components:** domain identity, registry, wallet and client
  - **Depends on:** `ARCH-003C`, `ARCH-004`, `REAP-004`
  - **Acceptance criteria:** One documented non-custodial funding path exists.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/CHAIN-012.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Reap funding-chain evidence.

- [!] **CHAIN-013 — 21X Polygon gas/funding decision** `P1`
  - **Rationale:** A user with only Arbitrum assets may need Polygon quote token/gas for V2.
  - **Action:** Document onboarding/funding requirement and keep it outside V1 handoff where possible.
  - **Affected components:** domain identity, registry, wallet and client
  - **Depends on:** `ARCH-003C`, `ARCH-004`
  - **Acceptance criteria:** V2 has clear funding UX without Jethos custody.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/CHAIN-013.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** 21X Polygon evidence.

- [ ] **CHAIN-020 — Aggregate balances by economic asset without erasing token/legal differences** `P1`
  - **Rationale:** USDC, EURe and fiat-provider balances are not the same instrument even if shown under 'Cash'.
  - **Action:** Create grouping layer for UI while preserving token, issuer, chain and source fields.
  - **Affected components:** domain identity, registry, wallet and client
  - **Depends on:** `ARCH-003C`, `ARCH-004`
  - **Acceptance criteria:** Drill-down always reveals exact asset/provider/chain.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/CHAIN-020.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **CHAIN-021 — Create cross-chain stale-data and RPC fallback strategy** `P1`
  - **Rationale:** One chain outage should not break total portfolio.
  - **Action:** Use per-chain freshness timestamp, retry/fallback RPC and partial-result state.
  - **Affected components:** domain identity, registry, wallet and client
  - **Depends on:** `ARCH-003C`, `ARCH-004`
  - **Acceptance criteria:** UI never presents stale aggregate as live without indicator.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/CHAIN-021.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None


## User experience and decision boundary

- [ ] **UX-001 — Define top-level navigation: Home/Cash/Card/Invest/Earn/Identity** `P1`
  - **Rationale:** One UX is the product, but module boundaries must remain visible.
  - **Action:** Map each screen to authoritative source/provider and action owner.
  - **Affected components:** jethos-web, design system and content
  - **Depends on:** `ARCH-002`, `WEB-001`, `BLD-001A`
  - **Acceptance criteria:** No screen implies Jethos is the provider of a regulated service.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/UX-001.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **UX-002 — Create universal provider disclosure component** `P0`
  - **Rationale:** Provider boundaries must be consistent and not depend on developer copy.
  - **Action:** Reusable component shows provider name, role, terms link/status and external transition where relevant.
  - **Affected components:** jethos-web, design system and content
  - **Depends on:** `ARCH-002`, `WEB-001`, `BLD-001A`
  - **Acceptance criteria:** Cash/Card/Invest modules all use it.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/UX-002.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **UX-003 — Ban misleading bank/broker language in component library** `P0`
  - **Rationale:** Copy can undermine the software-only design.
  - **Action:** Add content lint/rules for 'deposit with Jethos', 'Jethos bank account', 'we invest', 'recommended for you', 'Jethos card issuer'.
  - **Affected components:** jethos-web, design system and content
  - **Depends on:** `ARCH-002`, `WEB-001`, `BLD-001A`
  - **Acceptance criteria:** CI/content review flags prohibited strings/context.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/UX-003.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **UX-010 — Build service-connection cards** `P1`
  - **Rationale:** Users need one place to understand which external capabilities are enabled.
  - **Action:** Show Sumsub identity, Monerium cash, Reap card, 21X invest states with provider-specific status/actions.
  - **Affected components:** jethos-web, design system and content
  - **Depends on:** `ARCH-002`, `WEB-001`, `BLD-001A`
  - **Acceptance criteria:** No universal KYC/provider state is fabricated.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/UX-010.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **UX-011 — Build net-worth aggregation with source drill-down** `P1`
  - **Rationale:** Revolut-like experience depends on one overview.
  - **Action:** Aggregate on-chain balances/positions and provider-read balances while preserving source, chain and freshness.
  - **Affected components:** jethos-web, design system and content
  - **Depends on:** `ARCH-002`, `WEB-001`, `BLD-001A`
  - **Acceptance criteria:** Every total can be traced to underlying source.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/UX-011.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **UX-012 — Build transaction-plan review screen** `P0`
  - **Rationale:** This is the moment the software-only control model becomes visible to user.
  - **Action:** Render exact decoded calls, protocol, chain, assets, approvals, fees, post-state estimate and risk warnings before wallet prompt.
  - **Affected components:** jethos-web, design system and content
  - **Depends on:** `ARCH-002`, `WEB-001`, `BLD-001A`
  - **Acceptance criteria:** Wallet bytes are cryptographically tied to reviewed plan.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/UX-012.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **UX-013 — Build provider action-required workflow** `P1`
  - **Rationale:** Regulated providers can request additional steps.
  - **Action:** Show provider-owned action and route to hosted/provider flow; do not create generic Jethos compliance decision.
  - **Affected components:** jethos-web, design system and content
  - **Depends on:** `ARCH-002`, `WEB-001`, `BLD-001A`
  - **Acceptance criteria:** User always knows who requires the action.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/UX-013.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **UX-020 — Implement objective DeFi comparison table** `P1`
  - **Rationale:** The user wants options, not personalized advice.
  - **Action:** Show data source/time, APR/APY, liquidity/TVL/risk metadata/fees; permit user-selected sorting/filtering.
  - **Affected components:** jethos-web, design system and content
  - **Depends on:** `ARCH-002`, `WEB-001`, `BLD-001A`
  - **Acceptance criteria:** No ranking uses personal attributes.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/UX-020.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **UX-021 — Separate generic templates from recommendations** `P0`
  - **Rationale:** Templates can be useful while avoiding suitability claims.
  - **Action:** Label generic templates, show assumptions, allow full edit and never auto-select based on user profile.
  - **Affected components:** jethos-web, design system and content
  - **Depends on:** `ARCH-002`, `WEB-001`, `BLD-001A`
  - **Acceptance criteria:** Same template catalogue is available regardless of personal KYC/profile data.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/UX-021.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **UX-022 — Do not use Sumsub/KYC data for product ranking** `P0`
  - **Rationale:** Identity data should not leak into personalized finance logic.
  - **Action:** Architect separate data-access boundary; Builder has no access to KYC dossier/claims beyond service eligibility flags strictly needed.
  - **Affected components:** jethos-web, design system and content
  - **Depends on:** `ARCH-002`, `WEB-001`, `BLD-001A`
  - **Acceptance criteria:** Static analysis/data-flow review confirms separation.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/UX-022.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None


## Security

- [ ] **SEC-001 — Write end-to-end threat model** `P0`
  - **Rationale:** Jethos can cause loss by generating malicious calldata even without custody.
  - **Action:** Threat model frontend compromise, dependency attack, registry tampering, API credential leak, webhook forgery, wallet phishing, provider outage and chain failure.
  - **Affected components:** security architecture, client, CI and registry
  - **Depends on:** `ARCH-001`, `ARCH-002`, `AA-001`, `BACK-001`
  - **Acceptance criteria:** Mitigations/owners/tests exist for every P0 threat.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SEC-001.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **SEC-002 — Enforce exact-bytes preview invariant** `P0`
  - **Rationale:** A UI preview is useless if signing bytes are reconstructed later.
  - **Action:** Generate the canonical plan, account-encode it, decode the executable account calldata/UserOperation, render and simulate the same financial envelope, then authorize it client-side; mutation-test target, value, data, order, chain, account, deadline and permission scope plus the narrowly allowed gas/paymaster fields.
  - **Affected components:** security architecture, client, CI and registry
  - **Depends on:** `ARCH-001`, `ARCH-002`, `AA-001`, `BACK-001`
  - **Acceptance criteria:** Every unauthorized financial mutation blocks authorization; allowed gas/paymaster mutation is explicit; confirmed receipt input/account/chain reconciles to the approved decoded envelope.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SEC-002.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **SEC-004 — Create contract/address allowlist governance** `P0`
  - **Rationale:** Compromised metadata could redirect user funds.
  - **Action:** Separate code-reviewed registry from remote display metadata; require reviewed update process and chain/code checks.
  - **Affected components:** security architecture, client, CI and registry
  - **Depends on:** `ARCH-001`, `ARCH-002`, `AA-001`, `BACK-001`
  - **Acceptance criteria:** Remote API cannot arbitrarily replace financial target address.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SEC-004.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **SEC-010 — Create provider-secret vault and least-privilege scopes** `P0`
  - **Rationale:** Sumsub/Monerium/Reap credentials must not imply wallet signing authority.
  - **Action:** Store secrets server-side; separate per environment/provider; rotate; log access; prohibit shared master secret.
  - **Affected components:** security architecture, client, CI and registry
  - **Depends on:** `ARCH-001`, `ARCH-002`, `AA-001`, `BACK-001`
  - **Acceptance criteria:** Secret leak of one provider cannot sign user transactions or access other provider credentials.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SEC-010.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **SEC-011 — Standardize webhook authenticity/idempotency framework** `P0`
  - **Rationale:** Multiple providers depend on asynchronous events.
  - **Action:** Provider-specific signature verification plug-ins + replay window + unique event ledger + ordered state reconciliation.
  - **Affected components:** security architecture, client, CI and registry
  - **Depends on:** `ARCH-001`, `ARCH-002`, `AA-001`, `BACK-001`
  - **Acceptance criteria:** Forged, duplicate and out-of-order webhook tests pass.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SEC-011.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **SEC-012 — Redact sensitive logs and telemetry** `P0`
  - **Rationale:** Tokens/PII/card data commonly leak through debug logs.
  - **Action:** Central log scrubber; denylist authorization headers, share tokens, PAN/CVV, provider secrets and KYC payloads.
  - **Affected components:** security architecture, client, CI and registry
  - **Depends on:** `ARCH-001`, `ARCH-002`, `AA-001`, `BACK-001`
  - **Acceptance criteria:** Automated log tests demonstrate redaction.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SEC-012.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None


## Privacy

- [ ] **PRIV-001 — Create personal-data inventory** `P0`
  - **Rationale:** Public wallet data becomes personal when linked to an account.
  - **Action:** Map auth ID, wallet, Sumsub opaque identity, provider IDs, portfolio analytics, device/security data and consent logs.
  - **Affected components:** provider control plane, privacy schema and telemetry
  - **Depends on:** `BACK-001`
  - **Acceptance criteria:** Every field has purpose, retention and deletion/export rule.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/PRIV-001.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **PRIV-002 — Minimize KYC data at Jethos** `P0`
  - **Rationale:** Gateway's value is lost if Jethos copies identity data anyway.
  - **Action:** No passport/selfie/raw KYC report/downstream recipient result storage; block accidental webhook/body persistence.
  - **Affected components:** provider control plane, privacy schema and telemetry
  - **Depends on:** `BACK-001`, `BACK-002`
  - **Acceptance criteria:** Database/schema/log scan confirms absence.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/PRIV-002.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **PRIV-003 — Implement data export/delete workflows** `P1`
  - **Rationale:** SaaS account deletion must not pretend to delete provider/blockchain records.
  - **Action:** Delete Jethos-controlled data per policy and tell user which external/provider/on-chain records remain.
  - **Affected components:** provider control plane, privacy schema and telemetry
  - **Depends on:** `BACK-001`, `BACK-002`
  - **Acceptance criteria:** Workflow is tested and auditable.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/PRIV-003.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None


## Security

- [ ] **SEC-020 — Create compromised-frontend incident runbook** `P0`
  - **Rationale:** This is the highest-impact Jethos-specific security incident.
  - **Action:** Define deploy freeze, domain/banner response, address-registry verification, user warning and forensic steps.
  - **Affected components:** security architecture, client, CI and registry
  - **Depends on:** `ARCH-001`, `ARCH-002`, `AA-001`, `BACK-001`
  - **Acceptance criteria:** Tabletop exercise completed.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SEC-020.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **SEC-021 — Create provider API credential leak runbooks** `P1`
  - **Rationale:** Each provider has different blast radius.
  - **Action:** Rotation/revocation steps for Sumsub, Monerium, Reap, 21X; identify what attacker can/cannot do.
  - **Affected components:** security architecture, client, CI and registry
  - **Depends on:** `ARCH-001`, `ARCH-002`, `AA-001`, `BACK-001`
  - **Acceptance criteria:** Runbook owner and emergency contacts recorded.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SEC-021.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **SEC-022 — Test Jethos disappearance/continuity** `P0`
  - **Rationale:** Exitability is a product and trust invariant.
  - **Action:** Simulate Jethos backend unavailable: access Smart Account with provider-supported wallet/recovery and withdraw DeFi using protocol-native UI.
  - **Affected components:** security architecture, client, CI and registry
  - **Depends on:** `ARCH-001`, `ARCH-002`, `AA-001`, `BACK-001`
  - **Acceptance criteria:** Core assets remain recoverable.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SEC-022.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None


## Legal and business gates

- [ ] **LEGAL-001 — Meet commercialista on activity classification** `P1`
  - **Rationale:** A proprietary SaaS may fit software publishing better than generic consultancy.
  - **Action:** Discuss ATECO 58.29.00 as candidate primary and 62.10.00 / 62.20.10 as possible secondary codes based on actual revenue activities.
  - **Affected components:** provider contracts and architecture/legal evidence
  - **Depends on:** `AUD-010`
  - **Acceptance criteria:** Written accounting recommendation reflects real business model.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/LEGAL-001.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Qualified provider-contract or Italian/EU legal artifact where named.

- [ ] **LEGAL-002 — Draft software-focused corporate object** `P1`
  - **Rationale:** Company documents should match technology operations without casually claiming reserved financial services.
  - **Action:** Cover software publication, SaaS, DLT/software integration, APIs, analytics and licensing; legal review wording.
  - **Affected components:** provider contracts and architecture/legal evidence
  - **Depends on:** `AUD-010`
  - **Acceptance criteria:** Corporate object supports provider onboarding and product without misleading financial activity claims.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/LEGAL-002.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Qualified provider-contract or Italian/EU legal artifact where named.

- [ ] **LEGAL-003 — Choose entity/timing for B2B partner contracting** `P1`
  - **Rationale:** Some providers may require a company before production/sandbox agreement.
  - **Action:** Compare S.r.l./S.r.l.s. and provider requirements; do not incorporate solely to run local code if unnecessary.
  - **Affected components:** provider contracts and architecture/legal evidence
  - **Depends on:** `AUD-010`
  - **Acceptance criteria:** Formation trigger and budget are defined.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/LEGAL-003.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Qualified provider-contract or Italian/EU legal artifact where named.

- [ ] **LEGAL-010 — Create provider-role contract review template** `P0`
  - **Rationale:** The same technical integration can have a different legal role depending on contract wording.
  - **Action:** For Reap/Monerium/21X/Sumsub extract: Jethos role, customer counterparty, funds, order handling, KYC roles, agency/distribution, remuneration, liability, data roles and termination.
  - **Affected components:** provider contracts and architecture/legal evidence
  - **Depends on:** `AUD-010`
  - **Acceptance criteria:** Every signed agreement has completed role matrix.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/LEGAL-010.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Qualified provider-contract or Italian/EU legal artifact where named.

- [ ] **LEGAL-011 — Reject/renegotiate terms incompatible with software-only invariants** `P0`
  - **Rationale:** A contract can defeat the target architecture.
  - **Action:** Escalate terms that make Jethos issuer, custodian, discretionary manager, RTO/execution provider, payment initiator/agent without intended authorization.
  - **Affected components:** provider contracts and architecture/legal evidence
  - **Depends on:** `AUD-010`
  - **Acceptance criteria:** No incompatible term enters production agreement.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/LEGAL-011.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Qualified provider-contract or Italian/EU legal artifact where named.

- [ ] **LEGAL-020 — Prepare final sequence-diagram evidence pack** `P0`
  - **Rationale:** Counsel needs implementation facts rather than marketing summary.
  - **Action:** Include auth/key flow, DeFi exact-call flow, Monerium payment flow, Reap card flow, Sumsub data flow, 21X V1 and proposed V2.
  - **Affected components:** provider contracts and architecture/legal evidence
  - **Depends on:** `AUD-010`
  - **Acceptance criteria:** Diagrams show every signer, API hop, fund holder and contracting party.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/LEGAL-020.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Qualified provider-contract or Italian/EU legal artifact where named.

- [!] **LEGAL-021 — Commission MiCA/PSD2/MiFID perimeter memo after provider answers** `P0`
  - **Rationale:** This is the launch gate, not a PoC gate.
  - **Action:** Ask the exact questions already defined in the master architecture; require yes/no/conditions and recommended changes.
  - **Affected components:** provider contracts and architecture/legal evidence
  - **Depends on:** `AUD-010`, `LEGAL-020`
  - **Acceptance criteria:** Written memo covers production design.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/LEGAL-021.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Qualified provider-contract or Italian/EU legal artifact where named.

- [!] **LEGAL-022 — Run GDPR/DPIA assessment** `P0`
  - **Rationale:** Identity linkage + financial behavior may warrant enhanced privacy assessment even without KYC docs.
  - **Action:** Confirm controller/processor roles, legal bases, retention, international transfers/subprocessors and DPIA need.
  - **Affected components:** provider contracts and architecture/legal evidence
  - **Depends on:** `AUD-010`
  - **Acceptance criteria:** Privacy docs/data model updated to counsel/DPO conclusion.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/LEGAL-022.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Qualified provider-contract or Italian/EU legal artifact where named.

- [ ] **LEGAL-023 — Review marketing language** `P0`
  - **Rationale:** A clean architecture can be undermined by claims that Jethos itself is a bank/broker/adviser.
  - **Action:** Review 'Build Your Own Bank', account/cash/card/invest copy, disclaimers and provider attribution.
  - **Affected components:** provider contracts and architecture/legal evidence
  - **Depends on:** `AUD-010`
  - **Acceptance criteria:** Approved wording ships; prohibited claims are linted.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/LEGAL-023.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Qualified provider-contract or Italian/EU legal artifact where named.

- [ ] **LEGAL-030 — Freeze SaaS-first monetization for V1** `P1`
  - **Rationale:** Flat software revenue keeps incentives/product positioning clearer.
  - **Action:** Define Free/Plus/Pro feature matrix and billing independent of assets/yield/orders.
  - **Affected components:** provider contracts and architecture/legal evidence
  - **Depends on:** `AUD-010`
  - **Acceptance criteria:** No AUM/performance/deposit/order-routing fee in V1.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/LEGAL-030.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Qualified provider-contract or Italian/EU legal artifact where named.

- [ ] **LEGAL-031 — Review any provider referral/revenue share before enabling** `P2`
  - **Rationale:** Remuneration tied to financial routing/distribution can change regulatory analysis.
  - **Action:** Add legal gate to any affiliate/commission configuration.
  - **Affected components:** provider contracts and architecture/legal evidence
  - **Depends on:** `AUD-010`
  - **Acceptance criteria:** No partner remuneration goes live without written review.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/LEGAL-031.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Qualified provider-contract or Italian/EU legal artifact where named.


## Testing, operations and release

- [ ] **OPS-001 — Create dev/sandbox/staging/prod environment matrix** `P0`
  - **Rationale:** Provider sandboxes, testnets and production credentials must never mix.
  - **Action:** Define URLs, networks, provider accounts, secret stores and allowed domains per environment.
  - **Affected components:** CI, environments, observability and release pipeline
  - **Depends on:** `WEB-001`, `OPS-002A`
  - **Acceptance criteria:** Automated config validation prevents mixed environment.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/OPS-001.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **OPS-003 — Create provider mock servers/fixtures** `P1`
  - **Rationale:** Real sandboxes are slow/rate-limited and cannot cover every failure.
  - **Action:** Mock Sumsub/Monerium/Reap/21X status transitions, webhooks, expiry and error responses.
  - **Affected components:** CI, environments, observability and release pipeline
  - **Depends on:** `WEB-001`, `OPS-002A`
  - **Acceptance criteria:** E2E tests can run deterministically offline except explicit live suites.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/OPS-003.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **OPS-010 — Define privacy-safe event taxonomy** `P1`
  - **Rationale:** We need debugging without logging sensitive financial identity data.
  - **Action:** Log correlation ID, module, provider state transition, plan hash, tx/user-op hash and error code; exclude secrets/PII/card data.
  - **Affected components:** CI, environments, observability and release pipeline
  - **Depends on:** `WEB-001`, `OPS-002A`
  - **Acceptance criteria:** Support can trace a failed flow using correlation ID.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/OPS-010.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **OPS-011 — Create provider/API health dashboards** `P1`
  - **Rationale:** Unified UX depends on external providers.
  - **Action:** Track latency/error/webhook lag per provider and chain RPC/bundler; surface degraded-state feature flags.
  - **Affected components:** CI, environments, observability and release pipeline
  - **Depends on:** `WEB-001`, `OPS-002A`
  - **Acceptance criteria:** Outage is distinguishable from user account failure.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/OPS-011.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **OPS-012 — Create transaction-builder anomaly alerts** `P0`
  - **Rationale:** Wrong target/decoder/simulation mismatch should be treated as security events.
  - **Action:** Alert on unknown selector, unapproved target, simulation/signing hash mismatch, unexpected post-state.
  - **Affected components:** CI, environments, observability and release pipeline
  - **Depends on:** `WEB-001`, `OPS-002A`
  - **Acceptance criteria:** Security alert path is tested.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/OPS-012.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None


## End-to-end tests

- [ ] **TEST-001 — CDP login/account E2E** `P0`
  - **Rationale:** Core account lifecycle must survive real browser flow.
  - **Action:** Test new user, returning user, logout/relogin, recovery and wrong network.
  - **Affected components:** test suites, mocks and sandbox/fork environments
  - **Depends on:** `OPS-002A`, `CDP-003A`, `CDP-011`, `CDP-013`, `WEB-002`
  - **Acceptance criteria:** Repeatable green E2E proves the expected owner/account, recovery without Jethos signing infrastructure and explicit wrong-chain failure.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/TEST-001.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **TEST-002 — Builder → Aave batch E2E** `P0`
  - **Rationale:** This is the product core.
  - **Action:** Fund a sandbox/fork Smart Account; build supply/withdraw; pin registry/block/expiry; decode and mutation-test the account envelope; render and simulate that envelope; authorize client-side; reconcile receipt input and Aave post-state; then prove native exit with Jethos unavailable.
  - **Affected components:** test suites, mocks and sandbox/fork environments
  - **Depends on:** `OPS-002A`, `OPS-002B`, `BLD-030B`, `BLD-031B`, `BLD-032B`, `CDP-022`, `AAVE-010`, `AAVE-011`, `AAVE-012`, `WEB-002`
  - **Acceptance criteria:** Planned, rendered, simulated, authorized and receipt-decoded financial fields match; mutation fails; post-state and native exit pass; no backend relay or Jethos execution contract is observed.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/TEST-002.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [!] **TEST-003 — Sumsub hosted identity E2E** `P1`
  - **Rationale:** OIDC and callback security need browser-level validation.
  - **Action:** Test success/cancel/state mismatch/token expiry and reconnect.
  - **Affected components:** test suites, mocks and sandbox/fork environments
  - **Depends on:** `OPS-002A`, `OPS-002C`, `SUM-010`, `SUM-020`, `SUM-021`, `BACK-002`
  - **Acceptance criteria:** No PII appears in logs/database.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/TEST-003.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Corresponding provider sandbox/capability gate.

- [!] **TEST-004 — Monerium sandbox E2E** `P0`
  - **Rationale:** Cash module depends on asynchronous provider states.
  - **Action:** Profile→share→link wallet→IBAN→incoming→outgoing.
  - **Affected components:** test suites, mocks and sandbox/fork environments
  - **Depends on:** `OPS-002A`, `OPS-002C`, `MON-020`, `MON-030`, `MON-031`, `MON-040C`, `BACK-002`
  - **Acceptance criteria:** All steps reconcile with webhooks/provider state.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/TEST-004.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Corresponding provider sandbox/capability gate.

- [!] **TEST-005 — Reap sandbox E2E** `P0`
  - **Rationale:** Card lifecycle is broad.
  - **Action:** User→KYC reuse→account→virtual card→reveal→freeze→transaction/funding webhook.
  - **Affected components:** test suites, mocks and sandbox/fork environments
  - **Depends on:** `OPS-002A`, `OPS-002C`, `REAP-011`, `REAP-020`, `REAP-040B`, `BACK-002`
  - **Acceptance criteria:** No PAN/CVV storage; state reconciles.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/TEST-005.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Corresponding provider sandbox/capability gate.

- [ ] **TEST-006 — 21X V1 handoff E2E** `P1`
  - **Rationale:** V1 must prove no order capture.
  - **Action:** Open Invest, provider disclosure, external handoff; assert no backend order endpoint/network request.
  - **Affected components:** test suites, mocks and sandbox/fork environments
  - **Depends on:** `OPS-002A`, `X21-002`, `X21-011`, `WEB-002`
  - **Acceptance criteria:** Order flow remains outside Jethos.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/TEST-006.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Corresponding provider sandbox/capability gate.


## Testing, operations and release

- [ ] **OPS-020 — Create production readiness checklist per module** `P0`
  - **Rationale:** A module should not ship simply because its frontend appears finished.
  - **Action:** Require external gate, sandbox E2E, security, legal role, provider contract, monitoring and rollback before feature flag ON.
  - **Affected components:** CI, environments, observability and release pipeline
  - **Depends on:** `WEB-001`, `OPS-002A`
  - **Acceptance criteria:** Feature-gate owner signs release record.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/OPS-020.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **OPS-021 — Create safe rollback strategy** `P1`
  - **Rationale:** Provider integrations can break without touching user assets.
  - **Action:** Rollback UI/connector version or disable module while leaving wallet/protocol assets accessible.
  - **Affected components:** CI, environments, observability and release pipeline
  - **Depends on:** `WEB-001`, `OPS-002A`
  - **Acceptance criteria:** Disabling Jethos module never blocks protocol-native exit.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/OPS-021.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None


## Acceptance

- [!] **ACC-001 — External gate responses recorded** `P0`
  - **Rationale:** A PoC should distinguish confirmed capabilities from assumptions.
  - **Action:** Store Reap/Monerium/21X/Sumsub responses in `/docs/provider-validation/` with date and decision summary.
  - **Affected components:** end-to-end product and evidence gate
  - **Depends on:** `GATE-001`, `GATE-002`, `GATE-003`, `GATE-004`, `GATE-005`
  - **Acceptance criteria:** Every red/yellow architecture assumption links to evidence.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ACC-001.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Corresponding external/legal artifact and upstream acceptance.

- [ ] **ACC-002 — Go/no-go matrix updated** `P0`
  - **Rationale:** One provider 'no' should trigger a defined alternative rather than vague redesign.
  - **Action:** Score each dependency: confirmed / workaround / blocker / alternate provider.
  - **Affected components:** end-to-end product and evidence gate
  - **Depends on:** `ACC-001`, `ARCH-005`
  - **Acceptance criteria:** Product path remains explicit.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ACC-002.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **ACC-010 — User creates/re-enters Jethos account and Smart Account** `P0`
  - **Rationale:** Account layer is prerequisite.
  - **Action:** Demonstrate fresh user + returning user.
  - **Affected components:** end-to-end product and evidence gate
  - **Depends on:** `CDP-011`, `CDP-013`, `CDP-003A`
  - **Acceptance criteria:** User retains control; no developer signing.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ACC-010.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **ACC-011 — User sees unified balance/position overview** `P1`
  - **Rationale:** One UX is a core product claim.
  - **Action:** Show at least wallet cash + one DeFi position with source/chain.
  - **Affected components:** end-to-end product and evidence gate
  - **Depends on:** `AAVE-003`, `MORPHO-003`, `EULER-003`, `CHAIN-020`
  - **Acceptance criteria:** Values trace to on-chain reads.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ACC-011.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **ACC-012 — User creates a neutral multi-protocol rule/config** `P0`
  - **Rationale:** Builder differentiates Jethos.
  - **Action:** User manually selects protocols/allocations; no recommendation engine.
  - **Affected components:** end-to-end product and evidence gate
  - **Depends on:** `BLD-001B`, `BLD-002`, `BLD-003`
  - **Acceptance criteria:** Config is explicit/editable.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ACC-012.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **ACC-013 — Jethos builds, simulates and explains exact plan** `P0`
  - **Rationale:** The product thesis must be visible.
  - **Action:** Show calls, approvals, fees and expected state.
  - **Affected components:** end-to-end product and evidence gate
  - **Depends on:** `BLD-030B`, `BLD-031B`, `BLD-032B`
  - **Acceptance criteria:** Plan hash matches wallet handoff.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ACC-013.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **ACC-014 — User signs Smart Account batch directly** `P0`
  - **Rationale:** This is the software-only execution boundary.
  - **Action:** Submit batch to protocol(s) without Jethos backend relay.
  - **Affected components:** end-to-end product and evidence gate
  - **Depends on:** `CDP-022`, `BLD-040`, `BLD-041`
  - **Acceptance criteria:** On-chain trace confirms direct account→protocol calls.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ACC-014.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [!] **ACC-020 — Sumsub hosted identity connected** `P0`
  - **Rationale:** One identity UX is key to provider integration.
  - **Action:** Complete hosted verification/connection with minimal Jethos storage.
  - **Affected components:** end-to-end product and evidence gate
  - **Depends on:** `SUM-010`, `SUM-020`, `SUM-021`
  - **Acceptance criteria:** No raw KYC data at Jethos.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ACC-020.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Corresponding external/legal artifact and upstream acceptance.

- [!] **ACC-021 — Monerium IBAN sandbox enabled from Jethos** `P0`
  - **Rationale:** Demonstrates embedded cash rail.
  - **Action:** Profile/KYC reuse/wallet link/IBAN all initiated from Jethos UX.
  - **Affected components:** end-to-end product and evidence gate
  - **Depends on:** `MON-020`, `MON-030`, `MON-031`
  - **Acceptance criteria:** IBAN is provider-owned/disclosed.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ACC-021.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Corresponding external/legal artifact and upstream acceptance.

- [!] **ACC-022 — Incoming EUR becomes EURe at user's linked address** `P0`
  - **Rationale:** This proves the 'cash onto chain' loop.
  - **Action:** Run sandbox incoming flow and reconcile on-chain balance.
  - **Affected components:** end-to-end product and evidence gate
  - **Depends on:** `MON-031`, `MON-032`, `MON-033`
  - **Acceptance criteria:** Jethos never receives the funds.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ACC-022.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Corresponding external/legal artifact and upstream acceptance.

- [!] **ACC-023 — Reap virtual card sandbox enabled from Jethos** `P0`
  - **Rationale:** Demonstrates embedded card layer.
  - **Action:** KYC reuse → account → issue card → provider-hosted secure reveal.
  - **Affected components:** end-to-end product and evidence gate
  - **Depends on:** `REAP-011`, `REAP-020`, `REAP-040B`
  - **Acceptance criteria:** Jethos stores no PAN/CVV/card balance.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ACC-023.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Corresponding external/legal artifact and upstream acceptance.

- [!] **ACC-024 — 21X external handoff works** `P1`
  - **Rationale:** Securities coverage exists without embedded order flow.
  - **Action:** Open 21X with correct provider disclosure.
  - **Affected components:** end-to-end product and evidence gate
  - **Depends on:** `X21-002`, `X21-011`
  - **Acceptance criteria:** No order captured by Jethos.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ACC-024.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Corresponding external/legal artifact and upstream acceptance.

- [ ] **ACC-030 — Kill Jethos backend and recover DeFi assets independently** `P0`
  - **Rationale:** The strongest proof of non-custodial architecture is operational independence.
  - **Action:** Disable Jethos and access wallet/protocol position through recovery/native tooling.
  - **Affected components:** end-to-end product and evidence gate
  - **Depends on:** `CDP-013`, `MIG-006`, `AAVE-011`
  - **Acceptance criteria:** User can withdraw/operate core assets.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ACC-030.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [ ] **ACC-031 — Provider failure test** `P1`
  - **Rationale:** The unified app must not misrepresent outage as lost money.
  - **Action:** Simulate Reap/Monerium/21X unavailable and show degraded module + direct provider support/recovery.
  - **Affected components:** end-to-end product and evidence gate
  - **Depends on:** `ARCH-007`, `OPS-003`
  - **Acceptance criteria:** Other modules remain functional.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ACC-031.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** None

- [!] **ACC-032 — Legal/security gates clearly marked before real-money public beta** `P0`
  - **Rationale:** PoC success is not regulatory approval.
  - **Action:** Block production feature flags until legal memo, contract review, security review and production provider approval are attached.
  - **Affected components:** end-to-end product and evidence gate
  - **Depends on:** `LEGAL-021`, `LEGAL-022`, `OPS-020`, `SEC-001`
  - **Acceptance criteria:** No real-money public launch can bypass gate in release process.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ACC-032.md` plus referenced machine-readable logs, hashes, diagrams, provider response or receipts.
  - **External gate:** Corresponding external/legal artifact and upstream acceptance.


## Atomic replacements for split source tasks

- [ ] **ARCH-003A — Document the current repository domain model** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Derive current entities, ownership, state and identifiers from contracts, scripts and both frontends; mark pooled/global concepts.
  - **Affected components:** audit and architecture docs
  - **Depends on:** `AUD-003`, `AUD-007`
  - **Acceptance criteria:** Every current financial concept has an owner, source and lifecycle.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ARCH-003A.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **ARCH-003B — Define the target software-only domain model** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Specify User, ChainAccount, AssetId, ProtocolPosition, RuleSet, TransactionPlan, SimulationResult, ExecutionReceipt and ProviderConnection without a Jethos balance.
  - **Affected components:** shared engine architecture
  - **Depends on:** `ARCH-003A`, `ARCH-001`, `ARCH-002`
  - **Acceptance criteria:** No target entity implies custody, pooled claims, Jethos signing, relay or discretionary allocation.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ARCH-003B.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **ARCH-003C — Validate target types and canonical serialization** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Define branded chain/account/address/amount types, canonical serialization and stable validation errors across Node/browser.
  - **Affected components:** shared engine domain
  - **Depends on:** `ARCH-003B`, `AA-001`
  - **Acceptance criteria:** Invalid/ambiguous identities fail and valid canonical values round-trip byte-identically.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ARCH-003C.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **ARCH-010A — Inventory production Solidity and roles** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Record every production contract, inheritance/role, storage/custody, external calls and deployment relevance.
  - **Affected components:** contracts and artifacts
  - **Depends on:** `AUD-001`
  - **Acceptance criteria:** All production Solidity maps to an inventory component and disposition.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ARCH-010A.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **ARCH-010B — Inventory TypeScript and JavaScript architecture** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Map framework, automation, operations, legacy scripts and generated consumers with signer/runtime boundaries.
  - **Affected components:** scripts and generated types
  - **Depends on:** `AUD-001`
  - **Acceptance criteria:** Every architecture-significant TS/JS group has callers, dependencies and disposition.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ARCH-010B.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **ARCH-010C — Inventory both frontend transaction surfaces** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Map entrypoints, wallet/read/transaction code, config, content, parity and release paths in both web trees.
  - **Affected components:** dapp-new and jethos-web
  - **Depends on:** `AUD-001`
  - **Acceptance criteria:** Every financial call/config/auth source and canonical candidate is documented.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ARCH-010C.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **ARCH-010D — Inventory deployment, admin and automation entrypoints** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Map deploy/config/upgrade/emergency/direct/Safe/observe commands, signer requirements and broken targets.
  - **Affected components:** scripts, ops and package commands
  - **Depends on:** `ARCH-010B`
  - **Acceptance criteria:** Every privileged or financial entrypoint is target, migration-only or removal.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ARCH-010D.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **ARCH-010E — Classify test suites and properties** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Assign keep, port, migration-only, obsolete or missing to Hardhat, Foundry, Echidna, Vitest and Playwright coverage.
  - **Affected components:** test, web tests and security properties
  - **Depends on:** `ARCH-010A`, `ARCH-010B`, `ARCH-010C`
  - **Acceptance criteria:** Every important suite/property has a target disposition and baseline.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ARCH-010E.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **ARCH-010F — Reconcile configuration, manifests and deployed bytecode** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Map every address family, config copy, source/artifact/runtime code hash and owner state.
  - **Affected components:** deployments, manifests, env and frontend config
  - **Depends on:** `ARCH-010A`
  - **Acceptance criteria:** No deployment family is silently assumed canonical; unknown provenance is explicit.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ARCH-010F.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **ARCH-010G — Classify documentation and scratch sources** `P1`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Identify canonical, historical, generated, duplicate and unsupported docs/prototypes before cleanup.
  - **Affected components:** docs, vari and backups
  - **Depends on:** `ARCH-010A`, `ARCH-010B`, `ARCH-010C`
  - **Acceptance criteria:** Every architecture-critical document group has retention/disposition.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ARCH-010G.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **CDP-003A — Prove CDP Smart Account behavior on Arbitrum** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Provision/re-enter a sandbox account and record owner/address, delegation, ERC-1271, batch, recovery and gas behavior.
  - **Affected components:** CDP wallet adapter
  - **Depends on:** `CDP-001`, `CDP-002`, `CDP-011`
  - **Acceptance criteria:** A dated bundle proves user control and recoverable execution on Arbitrum.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/CDP-003A.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** Coinbase CDP sandbox/product evidence.

- [ ] **CDP-003B — Prove CDP Smart Account behavior on Base** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Repeat the complete ownership/address/batch/recovery protocol on Base without assuming address parity.
  - **Affected components:** CDP wallet adapter
  - **Depends on:** `CDP-003A`
  - **Acceptance criteria:** Base identity and behavior are independently evidenced.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/CDP-003B.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** Coinbase CDP sandbox/product evidence.

- [ ] **CDP-003C — Prove CDP Smart Account behavior on Polygon** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Repeat the complete ownership/address/batch/recovery protocol on Polygon without assuming address parity.
  - **Affected components:** CDP wallet adapter
  - **Depends on:** `CDP-003A`
  - **Acceptance criteria:** Polygon identity and limitations are independently evidenced.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/CDP-003C.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** Coinbase CDP sandbox/product evidence.

- [!] **MON-040A — Confirm a non-relay outgoing SEPA submission path** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Obtain written evidence distinguishing direct/provider-hosted user submission from Jethos forwarding a signed order.
  - **Affected components:** Monerium boundary
  - **Depends on:** `GATE-003`, `BACK-001`, `LEGAL-010`
  - **Acceptance criteria:** Sequence and provider answer prove Jethos is not the order relay; otherwise feature stays disabled.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MON-040A.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** Monerium written API/role and sandbox evidence.

- [ ] **MON-040B — Build the exact user-authorized SEPA instruction** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Construct/decode the supported user authorization with beneficiary, amount, currency, fees and expiry; never sign it at Jethos.
  - **Affected components:** client and Monerium adapter
  - **Depends on:** `MON-040A`, `MON-031`, `UX-012`
  - **Acceptance criteria:** The user reviews the exact instruction and Jethos cannot mutate/sign it.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MON-040B.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** Monerium written API/role and sandbox evidence.

- [ ] **MON-040C — Prove direct/provider-hosted SEPA submission and recovery** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Submit through the approved user/provider channel, stop Jethos services and observe provider status/recovery.
  - **Affected components:** client and provider control plane
  - **Depends on:** `MON-040B`, `MON-012`, `MON-041`
  - **Acceptance criteria:** Submission/status/recovery work without a Jethos financial relay or key.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MON-040C.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** Monerium written API/role and sandbox evidence.

- [!] **REAP-040A — Document the exact Reap funding-account model** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Obtain/model account owner, issuer, token/chain, receiver, finality, reversal and outage behavior.
  - **Affected components:** Reap connector and domain
  - **Depends on:** `REAP-004`, `REAP-010`, `CHAIN-012`
  - **Acceptance criteria:** Every funding state/owner is explicit and no Jethos treasury appears.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/REAP-040A.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** Reap written funding/program and sandbox evidence.

- [ ] **REAP-040B — Build and verify the user funding action** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Build the exact direct user transfer or provider-hosted flow; decode fees, chain, token and receiver.
  - **Affected components:** Builder and Reap adapter
  - **Depends on:** `REAP-040A`, `BLD-031A`, `CDP-022`
  - **Acceptance criteria:** User authorizes exact funding destination/amount and can recover status without Jethos custody.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/REAP-040B.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** Reap written funding/program and sandbox evidence.

- [ ] **BLD-001A — Define the explicit-user RuleSet schema** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Define actions, assets, chains, protocols, amounts, limits, slippage and notification thresholds with choice provenance.
  - **Affected components:** shared engine domain
  - **Depends on:** `ARCH-003C`
  - **Acceptance criteria:** Every input is an explicit choice or versioned neutral template; no profile ranking.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-001A.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **BLD-001B — Implement deterministic RuleSet validation** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Validate totals, decimals, chain/account/capability compatibility, contradictions and unsupported leverage/automation.
  - **Affected components:** shared engine domain
  - **Depends on:** `BLD-001A`, `ARCH-004`
  - **Acceptance criteria:** Valid inputs normalize identically; invalid inputs return stable typed errors.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-001B.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **BLD-020A — Normalize amounts, decimals and identifiers** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Convert inputs to integer base units using registry decimals and chain/address identity; reject lossy/ambiguous values.
  - **Affected components:** shared engine domain and registry
  - **Depends on:** `BLD-001B`, `ARCH-004`
  - **Acceptance criteria:** No float/symbol-only value enters a call and rounding direction is explicit.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-020A.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **BLD-020B — Compile a deterministic ordered action graph** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Compile normalized rules into ordered actions with source-rule, dependency and atomicity annotations; expose no signer.
  - **Affected components:** shared engine planner
  - **Depends on:** `BLD-020A`, `BLD-010`
  - **Acceptance criteria:** Same inputs/registry produce byte-identical action graphs.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-020B.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **BLD-021A — Define approval and revocation policy** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Specify bounded defaults, zero-reset, spender allowlist, permit capability, expiry and revoke plans.
  - **Affected components:** shared engine security policy
  - **Depends on:** `ARCH-004`, `BLD-012`
  - **Acceptance criteria:** Unknown spenders/unapproved unlimited allowances fail closed.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-021A.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **BLD-021B — Resolve approval and revoke calls** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Read allowance at an explicit block and emit only required ordered approval/reset/revoke calls.
  - **Affected components:** shared engine planner
  - **Depends on:** `BLD-021A`, `BLD-020B`
  - **Acceptance criteria:** Calls are minimal, decoded, ordered and invalidated when allowance changes.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-021B.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **BLD-022A — Build the dependency and atomicity DAG** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Translate typed actions into an acyclic graph with prerequisites, failure domains and justified atomic groups.
  - **Affected components:** shared engine planner
  - **Depends on:** `BLD-020B`, `BLD-021B`
  - **Acceptance criteria:** Cycles fail and every atomic group has a protocol/account rationale.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-022A.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **BLD-022B — Assemble the account-specific batch** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Encode approved DAG groups in the target Smart Account format without reordering/substitution.
  - **Affected components:** shared engine and CDP adapter
  - **Depends on:** `BLD-022A`, `CDP-021`, `AA-001`
  - **Acceptance criteria:** Decoded account calldata reproduces exact ordered calls, values and groups.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-022B.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **BLD-030A — Implement block-bound exact-call simulation** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Simulate exact account calldata with explicit chain/account/block/registry; record gas/logs/reverts/completeness.
  - **Affected components:** shared simulation
  - **Depends on:** `BLD-022B`, `ARCH-004`
  - **Acceptance criteria:** Result is reproducible or explicitly stale/incomplete, never silently healthy.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-030A.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **BLD-030B — Enforce simulation-to-executable equality** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Compare canonical, simulated and wallet/UserOperation calldata; invalidate forbidden mutation or expiry.
  - **Affected components:** shared engine and wallet adapter
  - **Depends on:** `BLD-030A`, `AA-001`
  - **Acceptance criteria:** Any target/value/data/order/account/chain/scope mutation is rejected.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-030B.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **BLD-031A — Decode only verified targets, ABIs and selectors** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Resolve code/ABI/capability from the pinned registry and decode every nested call and approval.
  - **Affected components:** shared decoder and registry
  - **Depends on:** `ARCH-004`, `BLD-022B`
  - **Acceptance criteria:** Unknown code/target/selector/nested call fails closed and decode round-trips.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-031A.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **BLD-031B — Render a neutral exact-plan explanation** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Render decoded chain/account/target/asset/amount/spender/receiver/slippage/fees/deadline without rebuilding calls.
  - **Affected components:** shared presentation and web
  - **Depends on:** `BLD-031A`, `UX-012`
  - **Acceptance criteria:** Every displayed value derives from decoded bytes/registry; no recommendation is added.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-031B.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **BLD-032A — Define expected-state assertions** `P1`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Derive bounded token, allowance, share, debt, controller and event expectations per adapter action.
  - **Affected components:** shared engine and adapters
  - **Depends on:** `BLD-020B`, `BLD-031A`
  - **Acceptance criteria:** Every enabled action has measurable pre/postconditions without a Jethos ledger.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-032A.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **BLD-032B — Reconcile receipt and post-state** `P1`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** At a confirmed block compare receipts/events and direct reads with expectations; distinguish incomplete from violated.
  - **Affected components:** shared engine and client readers
  - **Depends on:** `BLD-032A`, `BLD-030B`
  - **Acceptance criteria:** Unexpected deltas fail acceptance; unavailable reads never become zero/healthy.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-032B.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **BLD-050A — Extract reusable VAC observation and risk primitives** `P1`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Separate thresholds/errors/notifications from pooled manifests, fixed targets, Safe and executor imports.
  - **Affected components:** automation and shared engine
  - **Depends on:** `AUD-002`, `ARCH-003C`
  - **Acceptance criteria:** Extracted code accepts explicit user account/rules and has no signer/pool import.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-050A.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **BLD-050B — Evaluate only explicit user notification rules** `P1`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Evaluate state against user-authored thresholds/templates and output explanation/notification, never orders.
  - **Affected components:** shared rule evaluator
  - **Depends on:** `BLD-050A`, `BLD-001B`
  - **Acceptance criteria:** No targetBps/profile/KYC-derived decision exists and output is deterministic.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-050B.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **BLD-050C — Deliver notification-only rebalance prompts** `P1`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Deep-link alerts to fresh reads/compilation and expire stale suggestions; require a new user approval.
  - **Affected components:** web and notification control plane
  - **Depends on:** `BLD-050B`, `BLD-051`, `OPS-010`
  - **Acceptance criteria:** Notification carries no authority and always builds a fresh plan.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BLD-050C.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **AAVE-001A — Freeze direct Aave V1 scope to supply and withdraw** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Define exact chain/asset/reserve and only read, supply and withdraw capabilities.
  - **Affected components:** Aave adapter and registry
  - **Depends on:** `ARCH-004`, `BLD-012`
  - **Acceptance criteria:** UI/registry expose only approved actions and reject deferred selectors.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/AAVE-001A.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **AAVE-001B — Disposition legacy Aave borrow and leverage** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Map borrow/repay/flash/swap/emergency code/tests to migration-only, reusable negative fixture or removal.
  - **Affected components:** legacy Aave code/tests
  - **Depends on:** `AAVE-001A`, `AUD-008`, `MIG-001`
  - **Acceptance criteria:** No V1 path reaches borrow/leverage and live positions are zero or unwindable.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/AAVE-001B.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **MORPHO-001A — Decide Morpho Blue V1 capability** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Choose exact chain/market/actions and record full market parameters, rounding and user ownership.
  - **Affected components:** Morpho Blue adapter and registry
  - **Depends on:** `ARCH-004`, `BLD-012`
  - **Acceptance criteria:** Decision names exact markets/actions and excludes hidden leverage.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MORPHO-001A.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **MORPHO-001B — Decide MetaMorpho capability separately** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Choose/defer exact ERC-4626 vault deposit/redeem, rounding, caps and exit.
  - **Affected components:** MetaMorpho adapter and registry
  - **Depends on:** `ARCH-004`, `BLD-012`
  - **Acceptance criteria:** No generic Morpho capability conflates Blue positions and vault shares.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MORPHO-001B.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **EULER-001A — Choose exact Euler V1 vault and actions** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Name chain, vaults, assets and supply/withdraw; defer borrow/leverage.
  - **Affected components:** Euler adapter and registry
  - **Depends on:** `ARCH-004`, `BLD-012`
  - **Acceptance criteria:** Capability model exposes only exact verified deployment/actions.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/EULER-001A.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** Coinbase CDP and official Euler deployment/test evidence.

- [ ] **EULER-001B — Prove CDP Smart Account and Euler EVC batching** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Test SA owner/caller through EVC, controllers, subaccounts, supply, withdraw and recovery.
  - **Affected components:** Euler and CDP adapters
  - **Depends on:** `EULER-001A`, `CDP-021`, `CDP-003A`
  - **Acceptance criteria:** Whole batch is atomic, all controllers are read and user exits without Jethos contract.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/EULER-001B.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** Coinbase CDP and official Euler deployment/test evidence.

- [ ] **SEC-003A — Enforce dependency and artifact integrity** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Pin/verify lockfiles, ABI sources, compiler/toolchain and generated artifacts; add SCA/secrets gates.
  - **Affected components:** packages, CI and ABI registry
  - **Depends on:** `OPS-002A`, `ABI-001`
  - **Acceptance criteria:** Unpinned/changed inputs fail CI and release evidence records hashes.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SEC-003A.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **SEC-003B — Harden client runtime, CSP and release provenance** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Constrain scripts/RPCs, remove client credentials and record Git/registry hashes.
  - **Affected components:** jethos-web and edge config
  - **Depends on:** `WEB-001`, `SEC-LEG-001`, `ARCH-004`
  - **Acceptance criteria:** Release cannot load unapproved financial code/RPC and provenance is inspectable.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SEC-003B.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **SEC-003C — Govern registry and feature metadata** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Require reviewed append-only versions, code-hash checks, rollback/revocation and fail-closed flags.
  - **Affected components:** registry and release pipeline
  - **Depends on:** `ARCH-004`, `SEC-003A`, `SEC-003B`
  - **Acceptance criteria:** Unauthorized/stale/wrong-code registry entries cannot enable an action.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SEC-003C.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **OPS-002A — Repair and pin the existing CI baseline** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Replace nonportable discovery, resolve missing commands and pin Node/npm/Foundry.
  - **Affected components:** package scripts and workflows
  - **Depends on:** `AUD-001`, `AUD-005`
  - **Acceptance criteria:** Clean supported environments discover intended suites and produce reproducible results.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/OPS-002A.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **OPS-002B — Add shared-engine and direct-adapter CI gates** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Run type/lint/unit/property/golden plan/ABI/address/fork tests per enabled adapter.
  - **Affected components:** engine, adapters and workflows
  - **Depends on:** `OPS-002A`, `BLD-030B`, `SEC-003A`
  - **Acceptance criteria:** Each capability has deterministic plan/decode/simulation/post-state/exit gates.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/OPS-002B.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None

- [ ] **OPS-002C — Add provider, privacy and release CI gates** `P0`
  - **Rationale:** The source task combined multiple independently verifiable responsibilities; this task isolates one atomic outcome.
  - **Action:** Run mocks, webhook replay/idempotency, privacy/log, secret/SCA, feature-gate and provenance checks.
  - **Affected components:** control plane, web and workflows
  - **Depends on:** `OPS-002A`, `BACK-001`, `PRIV-001`
  - **Acceptance criteria:** No connector ships without external artifact, security tests and fail-closed flag.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/OPS-002C.md` plus machine-readable tests, hashes, decoded calls, diagrams or external response.
  - **External gate:** None


## Completed audit tasks

- [x] **AUD-001 — Capture Git, toolchain and baseline state** `P0`
  - **Rationale:** The audit directive requires this evidence before implementation.
  - **Action:** Record branch/commit/status, tool versions, source counts and baseline commands without product changes.
  - **Affected components:** repository and toolchains
  - **Depends on:** None — root evidence task
  - **Acceptance criteria:** Working-tree baseline and commands/results are auditable.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `audit/00 and audit/01` within `docs/software-only-refactor/audit/`.
  - **External gate:** None

- [x] **AUD-002 — Inventory all non-Solidity architecture** `P0`
  - **Rationale:** The audit directive requires this evidence before implementation.
  - **Action:** Inspect/classify TS/JS, both web trees, scripts, tests, CI, config, deployment and docs.
  - **Affected components:** repository excluding generated dependencies
  - **Depends on:** `AUD-001`
  - **Acceptance criteria:** Every significant non-Solidity group appears in C031–C056.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `audit/01 and audit/04` within `docs/software-only-refactor/audit/`.
  - **External gate:** None

- [x] **AUD-003 — Trace current call, fund and signing flows** `P0`
  - **Rationale:** The audit directive requires this evidence before implementation.
  - **Action:** Trace user, browser, managers, treasury, plugins, protocols and operator for all key flows.
  - **Affected components:** contracts, scripts and web
  - **Depends on:** `AUD-002`
  - **Acceptance criteria:** Signer, owner, mover, pooled/global state and builder location are explicit.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `audit/02 and audit/03` within `docs/software-only-refactor/audit/`.
  - **External gate:** None

- [x] **AUD-004 — Audit contract graph, storage, bytecode and authority** `P0`
  - **Rationale:** The audit directive requires this evidence before implementation.
  - **Action:** Inspect important contracts for roles, state, owner/admin, calls, approvals, upgrade semantics, size, emergency and tests.
  - **Affected components:** contracts, artifacts and deployments
  - **Depends on:** `AUD-003`
  - **Acceptance criteria:** Every production module is covered and Beacon is correctly identified as a locator.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `audit/02, audit/04 and audit/15` within `docs/software-only-refactor/audit/`.
  - **External gate:** None

- [x] **AUD-005 — Classify tests and portable invariants** `P0`
  - **Rationale:** The audit directive requires this evidence before implementation.
  - **Action:** Run representative suites and map tests/properties to keep, port, migration-only, obsolete or missing.
  - **Affected components:** test, security properties and web tests
  - **Depends on:** `AUD-004`
  - **Acceptance criteria:** Baseline results and universal Solidity-to-TS invariants are recorded.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `audit/01, audit/08 and audit/09` within `docs/software-only-refactor/audit/`.
  - **External gate:** None

- [x] **AUD-006 — Verify deployment, live state and user evidence** `P0`
  - **Rationale:** The audit directive requires this evidence before implementation.
  - **Action:** Reconcile manifests/config and make read-only queries for bytecode, balances, LPT holders, owners and positions.
  - **Affected components:** deployments, manifests and Arbitrum
  - **Depends on:** `AUD-004`
  - **Acceptance criteria:** Observed state and limitations are documented without claiming user absence.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `audit/01 and audit/12` within `docs/software-only-refactor/audit/`.
  - **External gate:** None

- [x] **AUD-007 — Classify every meaningful component** `P0`
  - **Rationale:** The audit directive requires this evidence before implementation.
  - **Action:** Assign one allowed class, target relevance, action, risk and task trace to every component.
  - **Affected components:** audit inventory
  - **Depends on:** `AUD-002`, `AUD-004`
  - **Acceptance criteria:** Exactly 56 components have one primary classification and counts reconcile.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `audit/04 and audit/05` within `docs/software-only-refactor/audit/`.
  - **External gate:** None

- [x] **AUD-008 — Map contract responsibilities to client or migration lanes** `P0`
  - **Rationale:** The audit directive requires this evidence before implementation.
  - **Action:** Decompose shrinking/disappearing contracts into reusable, obsolete and migration responsibilities.
  - **Affected components:** contracts and target engine
  - **Depends on:** `AUD-007`
  - **Acceptance criteria:** Every removed/shrunk contract has a destination and verification gate.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `audit/08 through audit/11` within `docs/software-only-refactor/audit/`.
  - **External gate:** None

- [x] **AUD-009 — Audit multi-chain assumptions** `P0`
  - **Rationale:** The audit directive requires this evidence before implementation.
  - **Action:** Search chain IDs, RPCs, addresses, symbols and accounts; assess Arbitrum, Base and Polygon.
  - **Affected components:** repository code/config/docs
  - **Depends on:** `AUD-002`
  - **Acceptance criteria:** Breakpoints and explicit target identity keys are recorded.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `audit/14` within `docs/software-only-refactor/audit/`.
  - **External gate:** None

- [x] **AUD-010 — Register current-target contradictions** `P0`
  - **Rationale:** The audit directive requires this evidence before implementation.
  - **Action:** Compare code with all invariants and provider/regulatory boundaries; rate contradictions.
  - **Affected components:** audit set and supplied docs
  - **Depends on:** `AUD-003`, `AUD-007`, `AUD-009`
  - **Acceptance criteria:** Custody, signer, relay, pooling, discretion, exactness, exit and provider conflicts are explicit.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `audit/06, audit/07, audit/15 and audit/16` within `docs/software-only-refactor/audit/`.
  - **External gate:** None

- [x] **AUD-011 — Build component-task traceability and dependency graph** `P0`
  - **Rationale:** The audit directive requires this evidence before implementation.
  - **Action:** Map C001–C056 to revised tasks and construct immediate/external/legal/security lanes.
  - **Affected components:** inventory, checklist and DAG
  - **Depends on:** `AUD-007`, `AUD-010`
  - **Acceptance criteria:** Every component has tasks and each material task names components/dependencies/evidence.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `audit/17 through audit/20` within `docs/software-only-refactor/audit/`.
  - **External gate:** None

- [x] **AUD-012 — Run contradiction hunt, second pass and gate review** `P0`
  - **Rationale:** The audit directive requires this evidence before implementation.
  - **Action:** Re-scan repository categories, invariants, REMOVE destinations, references and DAG; issue one gate token.
  - **Affected components:** all audit artifacts
  - **Depends on:** `AUD-001`, `AUD-002`, `AUD-003`, `AUD-004`, `AUD-005`, `AUD-006`, `AUD-007`, `AUD-008`, `AUD-009`, `AUD-010`, `AUD-011`
  - **Acceptance criteria:** Second-pass checks are recorded and gate document ends in exactly one allowed decision.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `audit/21` within `docs/software-only-refactor/audit/`.
  - **External gate:** None


## Repository-specific migration and architecture tasks

- [ ] **MIG-001 — Create a verified legacy deployment and state snapshot** `P0`
  - **Rationale:** Known manifests diverge and the July PoC holds 3.1 USDC/LPT.
  - **Action:** At a finalized block reconcile all address families, code hashes/source, roles/modules, holders, balances, allowances and positions.
  - **Affected components:** deployments, contracts and diagnostics
  - **Depends on:** `AUD-006`, `ABI-001`
  - **Acceptance criteria:** A signed machine-readable ledger covers April, July, env, frontend and discovered deployments or bounded unknowns.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MIG-001.md` plus machine-readable state, tests, hashes, diagrams, receipts or decision artifact.
  - **External gate:** None

- [ ] **MIG-002 — Prove zero-loss legacy redemption and approve the runbook** `P0`
  - **Rationale:** The current withdraw path has a confirmed full-burn/partial-payout defect.
  - **Action:** Fork-test each evidenced holder and position against the exact deployed bytecode; reproduce the clamp/full-burn defect; define a safe redemption/make-whole sequence, rollback triggers and monitoring; obtain separate security/operator approval without executing production mutations in this task.
  - **Affected components:** ProxyGeneral, LiquidityManager and holders
  - **Depends on:** `MIG-001`, `ABI-001`, `OPS-002A`
  - **Acceptance criteria:** At the pinned fork block every evidenced holder can receive the full claim without unpaid share burn; the signed runbook names signer, per-step deltas, stop/rollback conditions and production authorization boundary.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MIG-002.md` plus machine-readable state, tests, hashes, diagrams, receipts or decision artifact.
  - **External gate:** None — this task creates the deployed-bytecode security proof; production authorization is excluded.

- [!] **MIG-003 — Freeze pooled ingress and new allocation** `P0`
  - **Rationale:** Migration cannot converge while deposits/positions continue.
  - **Action:** After exit proof disable deposits, new protocol actions and automation while retaining only verified safe recovery.
  - **Affected components:** LiquidityManager, ProtocolManager, automation and web
  - **Depends on:** `MIG-001`, `MIG-002`
  - **Acceptance criteria:** No new deposit/allocation occurs after the recorded freeze block, the frontend rejects legacy ingress, and the MIG-002 safe exit remains reachable.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MIG-003.md` plus machine-readable state, tests, hashes, diagrams, receipts or decision artifact.
  - **External gate:** Separate operator/security authorization to mutate live controls after MIG-002 safe-exit proof; this checklist does not grant it.

- [!] **MIG-004 — Execute legacy holder exits and protocol unwind** `P0`
  - **Rationale:** A proven runbook and frozen ingress do not settle the existing claim or any newly discovered position.
  - **Action:** Under separate production authorization, execute the approved holder redemption/make-whole and protocol unwind sequence with per-transaction stop checks; never bundle reinvestment into the target product.
  - **Affected components:** ProxyGeneral, LiquidityManager, protocol plugins, holders and migration tooling
  - **Depends on:** `MIG-002`, `MIG-003`
  - **Acceptance criteria:** Every evidenced holder is settled in full; legacy assets, LPT supply, protocol shares and debt are zero, or any exceptional residual has a named owner and approved recovery path.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MIG-004.md` plus machine-readable state, tests, hashes, diagrams, receipts or decision artifact.
  - **External gate:** Operator/security authorization for production mutation and holder coordination.

- [!] **MIG-005 — Decommission and attest the legacy privilege surface** `P0`
  - **Rationale:** After balances settle, old approvals, modules and the single-owner surface remain drain or reactivation paths; Beacon replacement does not migrate state.
  - **Action:** Revoke token/router/protocol allowances and modules/operators in dependency-safe order; for each owner-controlled address choose frozen, time-bounded recovery, ownership transition or retirement; record final code/state/responsibility.
  - **Affected components:** all deployed Jethos contracts
  - **Depends on:** `MIG-001`, `MIG-004`
  - **Acceptance criteria:** Every legacy contract has known final state/control, no unnecessary allowance/module/operator, no ingress or active product consumer, and any time-bounded recovery authority has expiry and named reviewer.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MIG-005.md` plus machine-readable state, tests, hashes, diagrams, receipts or decision artifact.
  - **External gate:** Separate operator/security authorization for live revocation, ownership or freeze mutations; this checklist does not grant it.

- [!] **MIG-006 — Prove target rollback and Jethos-independent exit** `P0`
  - **Rationale:** A direct architecture is incomplete until the user can recover and exit the target position without the Jethos UI, backend, signer or contract.
  - **Action:** For the approved CDP+Aave slice, disable Jethos services and feature flag, exercise provider/account recovery and protocol-native withdrawal, and reconcile receipt/post-state; document stop and rollback behavior for failed target releases.
  - **Affected components:** target wallet, shared engine, web and protocol adapter
  - **Depends on:** `CDP-013`, `AAVE-011`, `BLD-040`, `TEST-002`
  - **Acceptance criteria:** A test user regains account control and exits natively with Jethos unavailable; rollback disables construction without moving or trapping the direct position.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/MIG-006.md` plus machine-readable state, tests, hashes, diagrams, receipts or decision artifact.
  - **External gate:** Security and CDP recovery evidence.

- [ ] **WEB-001 — Choose the canonical frontend and workspace cutover** `P0`
  - **Rationale:** Two deployable web trees and broken parity make ownership ambiguous.
  - **Action:** Approve the canonical consumer, package/workspace boundaries, route/content migration, parity replacement and single-origin deployment.
  - **Affected components:** jethos-web, dapp-new and workspace config
  - **Depends on:** `AUD-002`, `AUD-010`
  - **Acceptance criteria:** Exactly one frontend is canonical and shared-engine browser/build ownership is documented.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/WEB-001.md` plus machine-readable state, tests, hashes, diagrams, receipts or decision artifact.
  - **External gate:** None

- [ ] **WEB-002 — Extract reusable web code without vault assumptions** `P0`
  - **Rationale:** Current web modules mix useful lifecycle UX with pooled Arbitrum calls.
  - **Action:** Separate connect/read/receipt/presentation adapters and replace vault/global deployment assumptions with typed engine interfaces.
  - **Affected components:** jethos-web app infrastructure and web3
  - **Depends on:** `WEB-001`, `ARCH-011`, `ARCH-004`
  - **Acceptance criteria:** Target client consumes explicit chain/account plans/readers and cannot call legacy vault methods.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/WEB-002.md` plus machine-readable state, tests, hashes, diagrams, receipts or decision artifact.
  - **External gate:** None

- [ ] **BACK-001 — Approve the minimal provider control-plane boundary** `P0`
  - **Rationale:** Provider secrets/webhooks may require a backend but signer/relay capability is forbidden.
  - **Action:** Define allowed auth/OAuth/webhook/status operations, forbidden key/sign/order/investment operations, data/network/import boundaries.
  - **Affected components:** target provider service and security architecture
  - **Depends on:** `AUD-010`, `ARCH-001`, `ARCH-002`
  - **Acceptance criteria:** Service has no signer/planner/protocol-submit API or user asset ledger; negative capabilities are testable.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BACK-001.md` plus machine-readable state, tests, hashes, diagrams, receipts or decision artifact.
  - **External gate:** None

- [ ] **BACK-002 — Define provider state, idempotency and retention** `P0`
  - **Rationale:** Webhook/OAuth flows need state without a financial ledger or KYC store.
  - **Action:** Specify provider connection/status, opaque tokens, consent, replay/idempotency, audit, retention/export/delete and outage states.
  - **Affected components:** provider control plane and data model
  - **Depends on:** `BACK-001`, `PRIV-001`, `ARCH-006`
  - **Acceptance criteria:** Every stored field has purpose/controller/retention; no raw KYC, asset ledger or signing material.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/BACK-002.md` plus machine-readable state, tests, hashes, diagrams, receipts or decision artifact.
  - **External gate:** Provider/privacy contract evidence where required.

- [ ] **AA-001 — Specify the exact Smart Account executable-envelope contract** `P0`
  - **Rationale:** Hashing inner calls does not prove wallet execution of the reviewed plan.
  - **Action:** Approve an implementation-neutral contract for canonical domain, registry/chain/account/state/deadline, ordered batch decoding, permission scope and allowed UserOperation gas/paymaster mutation; define rejection rules and conformance vectors. Empirical CDP proof remains in CDP/BLD tasks.
  - **Affected components:** shared engine and CDP wallet adapter
  - **Depends on:** `ARCH-001`, `AUD-010`
  - **Acceptance criteria:** Reviewed schema and conformance vectors define every financial field and the only allowed transport mutation; no Coinbase capability claim is needed to approve this contract.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/AA-001.md` plus machine-readable state, tests, hashes, diagrams, receipts or decision artifact.
  - **External gate:** None

- [ ] **ABI-001 — Reconcile ABI, planner, source and deployed selectors** `P0`
  - **Rationale:** Framework/automation emits removed methods and live/source bytecode can differ.
  - **Action:** Generate selector inventories, pin migration ABIs, repair contract tests and prevent target use of stale Jethos selectors.
  - **Affected components:** framework ABIs, automation planner, artifacts and tests
  - **Depends on:** `AUD-004`, `AUD-005`, `AUD-006`
  - **Acceptance criteria:** No consumer emits an unknown selector/arity for its pinned destination.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/ABI-001.md` plus machine-readable state, tests, hashes, diagrams, receipts or decision artifact.
  - **External gate:** None

- [ ] **DEX-001 — Create a direct Uniswap/DEX TypeScript adapter** `P0`
  - **Rationale:** The source checklist omits DEX while current paths are unsafe and pooled.
  - **Action:** Implement verified quote metadata, path/fee/deadline/minOut, bounded approval, user receiver, simulation and balance-delta checks.
  - **Affected components:** shared engine Uniswap adapter and registry
  - **Depends on:** `BLD-021B`, `BLD-030B`, `BLD-032B`, `ARCH-004`
  - **Acceptance criteria:** User SA performs decoded direct swap with received delta >= minOut and no Jethos custody.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/DEX-001.md` plus machine-readable state, tests, hashes, diagrams, receipts or decision artifact.
  - **External gate:** Official deployment/quoter metadata.

- [ ] **DOL-001 — Disposition Dolomite explicitly** `P0`
  - **Rationale:** Dolomite source exists but bundles reject it and V1 need is unproven.
  - **Action:** Search deployments/config/callers/state; record removal or separately gated future direct-adapter decision.
  - **Affected components:** Dolomite code, scripts, tests and docs
  - **Depends on:** `AUD-002`, `AUD-006`
  - **Acceptance criteria:** No state is missed and V1 registry/UI cannot advertise Dolomite.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/DOL-001.md` plus machine-readable state, tests, hashes, diagrams, receipts or decision artifact.
  - **External gate:** None

- [ ] **INT-001 — Disposition InterVault as removal or migration-only** `P0`
  - **Rationale:** InterVault is forbidden pooling and incompletely audited.
  - **Action:** Search deployments/parent/leaf/balances/config; unwind if present; otherwise preserve evidence and remove active capability.
  - **Affected components:** InterVault plugin, registry, lens, tests and scripts
  - **Depends on:** `AUD-004`, `AUD-006`, `MIG-001`
  - **Acceptance criteria:** All InterVault state is zero/absent or safely exited and no target surface exposes it.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/INT-001.md` plus machine-readable state, tests, hashes, diagrams, receipts or decision artifact.
  - **External gate:** Security gate if state exists.

- [ ] **FLASH-001 — Keep flash-loan and leverage out of V1** `P0`
  - **Rationale:** Current leverage has critical/high slippage, HF and callback findings.
  - **Action:** Inventory debt/positions and retain only verified unwind tooling; require new architecture/legal/security gate for future leverage.
  - **Affected components:** FlashLoanService, protocol callbacks and capability registry
  - **Depends on:** `AUD-004`, `MIG-001`, `AAVE-001B`
  - **Acceptance criteria:** V1 rejects leverage/flash selectors and legacy positions have evidenced unwind.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/FLASH-001.md` plus machine-readable state, tests, hashes, diagrams, receipts or decision artifact.
  - **External gate:** Security/legal gate for future enablement.

- [ ] **GMX-001 — Disposition GMX and other legacy protocol references** `P0`
  - **Rationale:** Broken scripts/docs can imply unsupported capability.
  - **Action:** Locate GMX/Pendle/Odos commands/config/tests/docs; preserve evidence then remove or label unsupported.
  - **Affected components:** package scripts, docs, vari and legacy scripts
  - **Depends on:** `AUD-002`, `DOC-001`
  - **Acceptance criteria:** No build/CI/product surface invokes or advertises a nonexistent integration.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/GMX-001.md` plus machine-readable state, tests, hashes, diagrams, receipts or decision artifact.
  - **External gate:** None

- [ ] **SEC-LEG-001 — Remove and rotate the legacy client credential** `P0`
  - **Rationale:** dapp-new contains a browser-visible friction credential.
  - **Action:** Remove it from deployable assets, rotate reuse, inspect history/artifacts/logs and move access control to approved edge/provider auth.
  - **Affected components:** dapp-new auth and web deployment
  - **Depends on:** `WEB-001`, `SEC-003A`
  - **Acceptance criteria:** No deployable bundle/active store contains the value and access control is not client-side secrecy.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/SEC-LEG-001.md` plus machine-readable state, tests, hashes, diagrams, receipts or decision artifact.
  - **External gate:** None

- [ ] **DOC-001 — Establish canonical documentation and archive policy** `P0`
  - **Rationale:** Old/New/scratch documentation is numerous and contradictory.
  - **Action:** Index canonical docs with owner/date/status; preserve unique migration evidence; archive/remove duplicates only after link review.
  - **Affected components:** docs, vari, README and backups
  - **Depends on:** `AUD-002`, `AUD-010`
  - **Acceptance criteria:** Current truth is identifiable, history remains accessible and unsupported capabilities are labeled.
  - **Verification:** Execute every profile assigned to this stable ID in the normative routing table against this task's Action and Acceptance criteria; record the required literal commands/steps, versions, inputs, outputs, result, hashes and reviewer at the Expected evidence path.
  - **Expected evidence:** `evidence/DOC-001.md` plus machine-readable state, tests, hashes, diagrams, receipts or decision artifact.
  - **External gate:** None


## Retired and split source IDs

The following source IDs are intentionally absent from the executable task set and remain traceable in `audit/17_CHECKLIST_AUDIT.md`: `POC-002..007`, `LAUNCH-001..003`, and `BLD-011`. The 18 split source IDs are replaced by the 47 suffixed atomic tasks above.
