# Component classification

Each component in `04_COMPONENT_INVENTORY.md` has exactly one primary classification. The target location names below are recommendations, not folders created by this audit.

## Counts

| Classification | Count |
|---|---:|
| KEEP | 1 |
| KEEP_AND_HARDEN | 5 |
| EXTRACT_TO_CLIENT | 1 |
| EXTRACT_TO_SHARED_TS | 8 |
| REPLACE_WITH_DIRECT_PROTOCOL_CALL | 6 |
| SPLIT | 20 |
| REMOVE | 8 |
| MIGRATION_ONLY | 7 |
| ONCHAIN_REQUIRED | 0 |
| **Total** | **56** |

`ONCHAIN_REQUIRED = 0` is intentional. No inspected custom contract proves an invariant that cannot be enforced by protocol-native contracts, a user-owned Smart Account, explicit user authorization, and deterministic client validation. A future exception requires a new ADR answering all five tests in the source directive; provider convenience, gas saving, or reuse of existing Solidity is not sufficient.

## Classification and target map

| ID | Current role / architectural dependency | Useful logic vs obsolete coupling | Class | Recommended target | Migration and dependencies | Risk | Checklist IDs |
|---|---|---|---|---|---|---|---|
| C001 | pooled treasury/LPT; foundation of all current flows | module/rate checks useful; custody/shares obsolete | SPLIT | shared safety tests + legacy lane | snapshot→exit→freeze→retire; depends MIG-001..006 | Critical | MIG-*, OPS-002B |
| C002 | pooled ingress/egress and NAV shares | rounding/balance invariants useful; share economics obsolete | SPLIT | `packages/financial-engine` math/tests | port invariants before disabling deposit; C001/C007 | Critical | BLD-020*, MIG-* |
| C003 | privileged protocol router | selector/capability inventory useful; operator execution obsolete | SPLIT | capability registry only | repair drift for migration, then direct adapters | Critical | ABI-001, AAVE/MORPHO/EULER |
| C004 | mutable on-chain address locator | historical routing useful; “proxy upgrade” premise false | MIGRATION_ONLY | immutable deployment evidence | record route/code hash; never repoint stateful module without migration | High | MIG-001/005 |
| C005 | global financial policy | validation/timelock lessons useful; global user policy obsolete | SPLIT | user RuleSet + provider admin config | port schemas; legacy state frozen with pool | High | BLD-001*, MIG-003 |
| C006 | symbol registry | metadata checks useful; symbol/global identity unsafe | EXTRACT_TO_SHARED_TS | `registry/assets.ts` | require `(chainId,address)` and provenance | High | ARCH-004, CHAIN-001 |
| C007 | pooled valuation/risk aggregation | decimals/freshness/HF tests useful; pooled NAV obsolete | SPLIT | `pricing/`, protocol readers, test corpus | implement fail closed; do not share-price | Critical | SEC-001, OPS-002B |
| C008 | pooled swap orchestrator | minOut/balance delta/error taxonomy useful; custody/selection obsolete | SPLIT | DEX adapter + security invariants | DEX-001 after registry/simulation | Critical | DEX-001, BLD-030* |
| C009 | owner emergency coordinator | unwind knowledge only | MIGRATION_ONLY | legacy migration runbook/tooling | prohibit as target exit dependency | Critical | MIG-002/003/004 |
| C010 | pooled WETH deposit wrapper | no unique invariant | REMOVE | none; direct WETH/protocol calls | after legacy exit | Medium | MIG-003 |
| C011 | oracle normalization | decimal/freshness concepts useful; missing L2 guard | EXTRACT_TO_SHARED_TS | `pricing/chainlink.ts` + fixtures | add sequencer/freshness/fail-closed rules | High | SEC-001, OPS-002B |
| C012 | plugin-owned Aave execution | ABI/risk cases useful; account/custody model obsolete | REPLACE_WITH_DIRECT_PROTOCOL_CALL | `protocols/aave/` | user SA as `onBehalfOf`; V1 supply/withdraw | Critical | AAVE-*, FLASH-001 |
| C013 | owner Aave registry | addresses/capabilities useful; mutable on-chain source obsolete | EXTRACT_TO_SHARED_TS | versioned chain registry | official-source provenance/code hash | High | AAVE-002, ARCH-004 |
| C014 | plugin Aave reader | normalization/error cases useful; wrong account/APY semantics | EXTRACT_TO_SHARED_TS | `protocols/aave/read.ts` | explicit account/block; correct APY | High | AAVE-003/021 |
| C015 | plugin-owned Morpho Blue execution | market params/rounding useful; pooled leverage obsolete | REPLACE_WITH_DIRECT_PROTOCOL_CALL | `protocols/morpho-blue/` | user direct market calls; leverage gated | Critical | MORPHO-*, FLASH-001 |
| C016 | plugin-owned MetaMorpho vault execution | ERC-4626 conversion useful; pooled owner obsolete | REPLACE_WITH_DIRECT_PROTOCOL_CALL | `protocols/metamorpho/` | separate capability namespace | High | MORPHO-001*/010/012 |
| C017 | mutable Morpho registry | market identity useful; string/mutable trust obsolete | EXTRACT_TO_SHARED_TS | verified market registry | chain + full market params + block provenance | High | MORPHO-002 |
| C018 | Morpho risk reader | formulas/tests useful; plugin account and HF bug obsolete | EXTRACT_TO_SHARED_TS | `morpho-blue/read.ts` | explicit user; verified rounding/scales | Critical | MORPHO-003/014 |
| C019 | MetaMorpho share reader | ERC-4626 rounding useful; plugin owner obsolete | EXTRACT_TO_SHARED_TS | `metamorpho/read.ts` | explicit user and vault asset identity | High | MORPHO-012/014 |
| C020 | Euler EVC plugin execution | EVC/subaccount knowledge useful; pooled callbacks obsolete | REPLACE_WITH_DIRECT_PROTOCOL_CALL | `protocols/euler/` | PoC exact batching/account semantics first | Critical | EULER-*, FLASH-001 |
| C021 | Euler config/subaccount allocation | vault metadata useful; global account allocation obsolete | SPLIT | Euler registry + explicit account model | external deployment validation; SA/EVC PoC | High | EULER-001*/002 |
| C022 | Euler aggregate lens | failure cases/formulas useful; hardcoded LTV/double count obsolete | EXTRACT_TO_SHARED_TS | `euler/read.ts` | fail closed and test against protocol lens | Critical | EULER-003/013 |
| C023 | caller-funded Uniswap execution | ABIs useful; flow inconsistent with sibling | REPLACE_WITH_DIRECT_PROTOCOL_CALL | `protocols/uniswap/` | canonical quote→minOut→call→delta | Critical | DEX-001 |
| C024 | Proxy-funded Uniswap execution | negative fixtures only; zero-minOut/spot obsolete | REPLACE_WITH_DIRECT_PROTOCOL_CALL | same DEX adapter | never reuse unsafe defaults | Critical | DEX-001, SEC-002 |
| C025 | unfinished Dolomite path | no proven production IP | REMOVE | backlog only | DOL-001 records evidence before removal | High | DOL-001 |
| C026 | pooled flash-loan leverage | unwind topology useful; V1 product excluded | MIGRATION_ONLY | legacy unwind tool | only if a position is proven; otherwise archive | Critical | FLASH-001, MIG-002/004 |
| C027 | parent/leaf pooled execution | none compatible with INV-11 | REMOVE | none | deployment/state proof first | High | INT-001, MIG-001 |
| C028 | meta-vault registry | migration evidence only | REMOVE | none | retain snapshot then archive | High | INT-001 |
| C029 | recursive pooled lens | adversarial recursion/fail-closed cases useful | REMOVE | generic negative tests | extract tests before deletion | High | INT-001, OPS-002B |
| C030 | current interfaces/mocks | protocol ABIs/adversarial tokens useful; drifted Jethos ABIs obsolete | SPLIT | pinned protocol ABI package + fixtures | ABI reconciliation precedes port | High | ABI-001, OPS-002B |
| C031 | signer-free plan model | structure highly useful; target/Jethos ABI coupling obsolete | SPLIT | `packages/financial-engine/{domain,planner}` | browser-safe extraction after `ARCH-011` and `WEB-001` | High | ARCH-003*, BLD-* |
| C032 | simulation + signer executor | simulation/error handling useful; backend signer forbidden | SPLIT | shared simulator + migration-only CLI executor | hard boundary enforced by imports/CI | Critical | BACK-001, SEC-002 |
| C033 | Node manifests and ABI lookup | chain/plan metadata useful; fs/default-Arbitrum unsafe | SPLIT | registry package + immutable history | require signatures/code hashes/version | High | ARCH-004, ABI-001 |
| C034 | pooled observer/risk/alerts | deterministic thresholding useful; global account obsolete | SPLIT | per-user read/notification evaluator | explicit user RuleSet; no execution | High | BLD-050*, OPS-012 |
| C035 | fixed strategy/planner/store | dependency planner fragments useful; recommendations/stale ABI obsolete | SPLIT | planner + client preference storage | remove fixed targetBps; ABI-001 | Critical | BLD-001*/050* |
| C036 | runtime/Safe executor | admin proposal may aid migration; no target user role | REMOVE | migration tool moved under C038 if needed | CI ban from product packages | Critical | BACK-001, BLD-052 |
| C037 | deploy/config scripts | deployment evidence and read/config logic useful only for old stack | MIGRATION_ONLY | `tools/legacy-migration/` | pin manifest/source/block; no new target deployment | High | MIG-* |
| C038 | privileged admin scripts | needed for freeze/unwind; unsafe as steady state | MIGRATION_ONLY | sealed runbook/tooling | dual review, dry run, least privilege | Critical | MIG-003/004/005 |
| C039 | read-only diagnostics | directly reusable after chain/provenance hardening | KEEP_AND_HARDEN | `tools/diagnostics/` | add block, chain, manifest, code-hash assertions | Medium | MIG-001, OPS-011 |
| C040 | vault app transactions | UI lifecycle useful; independently built vault calls obsolete | SPLIT | plan review/receipt UI | switch consumer only after exactness tests | Critical | WEB-002, BLD-031*/040 |
| C041 | EIP-1193 wallet | connect/read/switch useful; EOA signer assumption incomplete | SPLIT | wallet read adapter + CDP SA adapter | CDP PoC and account ownership proof | High | CDP-*, CHAIN-002* |
| C042 | pooled frontend readers | client architecture useful; vault/NAV target obsolete | EXTRACT_TO_CLIENT | per-protocol position readers | explicit chain/account/block | High | WEB-002, protocol `*-003` |
| C043 | one-chain deployment config | environment shape useful; hard-coded global deployment obsolete | SPLIT | registry loader/runtime validation | ARCH-004 before consumers | High | CHAIN-001/003 |
| C044 | Astro presentation system | independent of custody and passes build/tests | KEEP | canonical `jethos-web` | approve WEB-001; keep financial claims reviewed | Low | WEB-001, UX-* |
| C045 | illustrative pure demo engine | rounding/test patterns useful; local balance model non-authoritative | SPLIT | examples/tests only | label illustrative; no financial source of truth | Medium | BLD-020*, WEB-002 |
| C046 | recommendation/strategy UI | conflicts directly with user-decision invariant | REMOVE | neutral catalogue/comparison | content audit plus regression grep/tests | High | UX-020/021/022 |
| C047 | legacy static frontend | route/content evidence only; duplicate deploy target unsafe | MIGRATION_ONLY | temporary parity input | fix/replace parity, then retire | High | WEB-001, SEC-LEG-001 |
| C048 | typed content repository | reusable but claims/provenance need control | KEEP_AND_HARDEN | canonical local content | add status/source; legal/product review | Medium | DOC-001, UX-003 |
| C049 | current Hardhat tests | many invariants useful; pooled behavior and stale selectors mixed | SPLIT | legacy migration suite + ported invariant corpus | inventory each suite; fix runner/drift | High | OPS-002B/011, OPS-002* |
| C050 | Foundry/fuzz harness | methodology reusable; local execution unavailable | KEEP_AND_HARDEN | security CI/test package | pin/install Foundry; distinguish legacy/target | High | OPS-002B/011 |
| C051 | property catalogue | strong reusable security IP | KEEP_AND_HARDEN | target invariant catalogue | map each property to TS/SA/protocol test | High | SEC-001/002 |
| C052 | existing CI | substantial base; paths/globs and scope drift | SPLIT | legacy migration lane + target package gates | repair before relying on green status | High | OPS-002*, OPS-002A |
| C053 | manifests/env/deployment state | required evidence; divergent/unbound to commit | MIGRATION_ONLY | immutable migration ledger | reconcile address families and code hashes | Critical | MIG-001/005 |
| C054 | old docs/scratch/backup | possible unique history; not canonical | REMOVE | version-control history/archive index | DOC-001 before any deletion | Medium | DOC-001, GMX/DOL-001 |
| C055 | generated artifacts/types | ABI/bytecode evidence useful; source/version drift | SPLIT | pinned protocol types + immutable legacy artifacts | bind deployment bytecode; regenerate target types | High | ABI-001, MIG-001 |
| C056 | web tests | buildable reusable client safety net | KEEP_AND_HARDEN | canonical web test suite | add wallet/plan/chain/provider tests | Medium | WEB-001/002, OPS-002* |

## Target package recommendation

Do not create a root `engine/` folder immediately. The existing plan framework and canonical Astro consumer support a workspace boundary:

```text
packages/financial-engine/
  src/domain/          # AssetId, AccountId, RuleSet, Amount, Position
  src/registry/        # chain/address/ABI/capability metadata + provenance
  src/protocols/       # aave, morpho-blue, metamorpho, euler, uniswap
  src/planner/         # dependency graph, approval policy, canonical plan
  src/simulation/      # block-bound simulate/decode/post-state
  src/presentation/    # neutral typed explanation, no UI framework
jethos-web/src/features/financial-os/
  adapters/wallet/     # EIP-1193 reads and CDP Smart Account handoff
  adapters/providers/  # calls to minimal provider control plane
  application/         # user flows, plan review, receipts
tools/legacy-migration/
  # current owner/signer/deployment scripts, not importable by product packages
services/provider-control-plane/  # only if BACK-001 approves exact boundary
```

The package name/location remains blocked by `ARCH-011/WEB-001` until repository ownership and build tooling are approved; this audit recommends the boundary, it does not create production structure.
