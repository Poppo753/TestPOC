# Checklist audit

## Source and method

Source reviewed: `C:\Users\l.botta\Downloads\MASTER_CHECKLIST_ALL_MODULES.md`, 2,185 lines, 124,340 characters, 228 unique task IDs. Every task was read with its rationale, action, acceptance and dependency. All source tasks were `[ ]`; priorities were P0 147, P1 73 and P2 8. There were no literal duplicate IDs.

The source attachment was treated as immutable input. Its executable replacement is `docs/software-only-refactor/MASTER_CHECKLIST_ALL_MODULES_REVISED.md`. Removed and split history remains in this audit.

## Quantitative disposition

The disposition is defined mechanically. A retained task keeps its source ID; a split or removed source ID is absent from the executable checklist. `Revised` below includes retained IDs plus split source tasks; `Removed` is exclusive.

| Metric | Count |
|---|---:|
| source tasks reviewed | 228 |
| retained stable IDs with revised dependencies/evidence metadata | 200 |
| retained IDs with core wording or priority corrected | 10 |
| retained IDs preserving source title/priority/rationale/action/acceptance | 190 |
| source tasks revised (200 retained + 18 split) | 218 |
| removed | 10 |
| split source tasks | 18 |
| replacement tasks produced by splits | 47 |
| repository-specific tasks added | 31 |
| source tasks already completed | 0 |
| newly added audit tasks completed by this audit | 12 |
| directly external/legal/provider/authorization blocked | 58 |
| pending | 208 |
| revised executable total | 278 |

Arithmetic: `228 - 10 removed - 18 split originals + 47 split replacements + 31 repository additions = 278`. Equivalently, 78 executable IDs are new (`47 + 31`).

The biggest measurable defect is dependency quality: only 26/228 source tasks named a dependency other than `None`; 202 claimed none despite clear architectural/provider/security prerequisites. All 200 retained source IDs now have a changed dependency expression; 52 also have a changed status. Ten retained IDs have a core wording/priority correction: `ARCH-001`, `ARCH-004`, `ARCH-011`, `BLD-023`, `BLD-040`, `BLD-051`, `GATE-005`, `SEC-002`, `TEST-001`, `TEST-002`. The other 190 retain the source's core request but gain normalized affected-component, verification, evidence and gate fields.

## Disposition by supplied checklist/module

| Checklist/module | Reviewed | Retained/revised IDs | Removed | Split source IDs | Already complete in source | Material revision |
|---|---:|---:|---:|---:|---:|---|
| Master execution | 15 | 6 | 9 | 0 | 0 | POC/LAUNCH duplicate epics become milestone views; CDP gate promoted |
| Foundation/architecture | 11 | 9 | 0 | 2 | 0 | current repo/state, exact package boundary and on-chain exception tests added |
| Coinbase CDP | 15 | 14 | 0 | 1 | 0 | per-chain empirical proof; Safe ≠ user SA; whole-envelope exactness |
| Sumsub | 15 | 15 | 0 | 0 | 0 | recipient evidence, consent, token/data boundary and blockers explicit |
| Monerium | 19 | 18 | 0 | 1 | 0 | backend order-relay wording corrected; direct/provider path required |
| Reap | 22 | 21 | 0 | 1 | 0 | individual/EEA/program/funding model gates precede implementation |
| 21X | 15 | 15 | 0 | 0 | 0 | V1 handoff fixed; V2 Python/private-key/browser mismatch and legal gate |
| Builder | 20 | 11 | 1 | 8 | 0 | existing framework reused; executable-envelope, state/provenance and atomicity added |
| Aave | 9 | 8 | 0 | 1 | 0 | existing plugin/lens/tests mapped; direct supply/withdraw only |
| Morpho | 8 | 7 | 0 | 1 | 0 | Blue vs MetaMorpho separated and existing share logic mapped |
| Euler | 7 | 6 | 0 | 1 | 0 | EVC/subaccount/SA batching PoC added |
| Multi-chain | 9 | 9 | 0 | 0 | 0 | chain/account/asset identity and registry provenance made explicit |
| UX | 10 | 10 | 0 | 0 | 0 | current recommendation/strategy content becomes removal work |
| Security/privacy | 13 | 12 | 0 | 1 | 0 | actual 380-finding backlog and frontend/control-plane threats added |
| Legal/business | 11 | 11 | 0 | 0 | 0 | provider answer ordering and no-definitive-opinion boundary clarified |
| Testing/DevOps | 14 | 13 | 0 | 1 | 0 | current CI repaired; E2E depends on implemented features; target/legacy lanes separated |
| Acceptance | 15 | 15 | 0 | 0 | 0 | dependencies and evidence made machine-auditable; no source item pre-complete |
| **Total** | **228** | **200** | **10** | **18** | **0** | |

## Removed task history

| Old task | Decision | Replacement/history |
|---|---|---|
| POC-002 | remove duplicate epic | milestone view of CDP-011/013/020, TEST-001, ACC-010 |
| POC-003 | remove duplicate epic | milestone view of Builder/CDP/Aave exact-plan tasks and TEST-002 |
| POC-004 | remove duplicate epic | SUM-010/011/012, TEST-003, ACC-020 |
| POC-005 | remove duplicate epic | detailed MON-* plus TEST-004 and ACC-021/022 |
| POC-006 | remove duplicate epic | detailed REAP-* plus TEST-005 and ACC-023 |
| POC-007 | remove duplicate epic | X21-010/011, TEST-006, ACC-024 |
| LAUNCH-001 | remove duplicate gate epic | LEGAL-020 plus audit/trust/data-flow evidence |
| LAUNCH-002 | remove duplicate gate epic | LEGAL-021 |
| LAUNCH-003 | remove duplicate gate epic | SEC-*, OPS-020 and ACC-032 |
| BLD-011 | remove duplicate registry task | ARCH-004 canonical registry |

## Split history

| Old task | Decision | New task family |
|---|---|---|
| ARCH-003 | split | current model, target model, invariant/type validation |
| ARCH-010 | split | Solidity, TS, frontend, scripts, tests, config/deploy, docs/classification inventories |
| CDP-003 | split | Arbitrum, Base and Polygon empirical account tests |
| MON-040 | split/correct | provider capability, user-authorized construction, direct/provider submission proof |
| REAP-040 | split | provider funding-account model and direct user funding call |
| BLD-001 | split | RuleSet schema and validator |
| BLD-020 | split | normalization and deterministic compilation/ordering |
| BLD-021 | split | approval policy and approval/revoke resolver |
| BLD-022 | split | dependency/atomicity graph and batch assembly |
| BLD-030 | split | simulation transport and exact executable equality |
| BLD-031 | split | ABI/selector decode and neutral presentation |
| BLD-032 | split | expected-state model and post-state reconciliation |
| BLD-050 | split | legacy VAC extraction, user rule evaluation, notification-only delivery |
| AAVE-001 | split | V1 direct scope and legacy borrow/leverage disposition |
| MORPHO-001 | split | Morpho Blue and MetaMorpho capability decisions |
| EULER-001 | split | V1 vault/market decision and CDP/EVC account-batch PoC |
| SEC-003 | split | dependency integrity, runtime/CSP, build/registry provenance |
| OPS-002 | split | repair current CI, add target engine gates, add provider/security gates |

## Auditable source-to-revised crosswalk

The crosswalk is set-based rather than an unverifiable “unchanged/modified” judgment:

- **Retained/revised:** every source ID that still exists in the revised checklist, exactly 200. All 200 have a revised dependency expression and normalized metadata; the ten core wording/priority changes are named in the quantitative section.
- **Removed:** exactly the ten IDs in “Removed task history”; none exists in the revised checklist.
- **Split:** exactly the eighteen old IDs in “Split history”; none exists in the revised checklist, and the table names all 47 replacement IDs/families.
- Validation computes `source IDs = retained ∪ removed ∪ split`, with disjoint sets, and fails on any unaccounted ID. This is the review disposition for every one of the 228 source tasks.

## Task-family to component crosswalk

`04_COMPONENT_INVENTORY.md` and `05_COMPONENT_CLASSIFICATION.md` map every C-ID to checklist work. The inverse routing below makes the relationship formally bidirectional; a task's textual `Affected components` field narrows the listed family scope. “Target-only” means no current implementation was found and is itself an audited result.

| Task IDs | Current component scope |
|---|---|
| `AUD-*`, `ACC-*` | `C001..C056` as selected by the task acceptance/dependencies |
| `POC-001`, `ARCH-*`, `AA-001` | `C004..C007`, `C011`, `C013..C022`, `C031..C033`, `C040..C045`, `C048`, `C052`, `C053`, `C055`, `C056` |
| `CDP-*` | `C031`, `C040`, `C041`, `C043`, `C052`, `C056`; CDP runtime itself is target-only |
| `GATE-*`, `LEGAL-*` | external evidence/decision scope; documentation consumers `C044`, `C048`, `C054` |
| `SUM-*`, `MON-*`, `REAP-*`, `X21-*`, `BACK-*` | provider runtimes are target-only; current consumer/control surfaces `C032`, `C040`, `C044`, `C048`, `C052`, `C056` |
| `BLD-*` | `C005..C008`, `C011`, `C013..C024`, `C031..C035`, `C040..C046`, `C049..C052`, `C055`, `C056` |
| `AAVE-*` | `C012..C014`, plus planner/web/test consumers `C031`, `C040..C043`, `C049..C056` |
| `MORPHO-*` | `C015..C019`, plus planner/web/test consumers `C031`, `C040..C043`, `C049..C056` |
| `EULER-*` | `C020..C022`, plus planner/web/test consumers `C031`, `C040..C043`, `C049..C056` |
| `DEX-001` | `C008`, `C023`, `C024`, `C031`, `C040`, `C049..C052`, `C055`, `C056` |
| `CHAIN-*` | `C006`, `C031`, `C033`, `C039..C043`, `C053`, `C055`, `C056` |
| `UX-*`, `WEB-*` | `C040..C048`, `C052`, `C056` |
| `SEC-*`, `PRIV-*` | financial/security surfaces `C001..C043` plus web/CI/security surfaces `C044..C056`, narrowed by task |
| `OPS-*`, `TEST-*`, `ABI-001` | `C030..C039`, `C049..C056`, plus the feature components named by each test |
| `MIG-*` | `C001..C009`, `C012`, `C015`, `C016`, `C020`, `C026..C029`, `C037..C039`, `C047`, `C053`, `C055` |
| `DOL-001`, `INT-001`, `FLASH-001`, `GMX-001`, `DOC-001` | respectively `C025/C054`, `C027..C029`, `C012/C015/C020/C026`, `C054`, `C047/C048/C054` |

## Repository-specific additions

Twelve `AUD-*` tasks capture the completed audit/evidence/second pass. Six `MIG-*` tasks govern live-state exit. Thirteen architecture-specific tasks cover the frontend cutover, shared/client extraction, minimal backend, whole-UserOperation exactness, ABI drift, omitted DEX/Dolomite/InterVault/flash/GMX dispositions, client credential, and canonical documentation.

## Major wording and ordering corrections

1. “Create engine” becomes “approve package/runtime boundary, then extract existing pure plan code.”
2. “Create CI” becomes “repair current CI/reproducibility, then add separate target gates.”
3. Protocol tasks start from existing Solidity/lens/test IP, not greenfield.
4. `MON-040` cannot route a signed payment order through a Jethos backend without an explicit invariant/legal decision.
5. `Call[]` exactness becomes whole Smart Account executable-envelope exactness.
6. External-gate evidence tasks are `[!]`; sending the request remains immediately actionable.
7. 21X V1 is only handoff/read-only; V2 remains blocked by browser/self-custody and legal gates.
8. Provider connectors depend on a newly approved minimal backend boundary; that service has explicit forbidden capabilities.
9. Deployment/state/allowances and the non-zero PoC are predecessors of pooled-code removal.
10. Critical security findings and test drift block real-money enablement even when a build compiles.
11. Legacy zero-loss proof/freeze uses the pinned current baseline and runs before, not after, the new CDP+Aave path.
12. Generic verification boilerplate is replaced by fourteen normative profiles with exhaustive stable-ID routing and a single repository-relative evidence root.

## Final task quality contract

Every revised task contains stable ID, status, priority, title, rationale, exact action, affected components, dependencies, acceptance, verification, expected evidence, and external gate. The verification field normatively points to profiles that define exact inputs, execution/review method, output and evidence metadata. `[x]` is limited to the 12 audit tasks whose evidence is the generated audit set and validation output. `[!]` means a named external, legal, provider, security-authorization or production-authorization artifact is currently missing; downstream tasks remain `[ ]` with the blocker as a dependency.
