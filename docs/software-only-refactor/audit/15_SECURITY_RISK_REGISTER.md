# Security risk register

## Existing finding baseline

`security/findings/register.json` contains 380 records: 8 critical, 91 high, 131 medium, 95 low and 55 info. By state: 91 confirmed, 17 fixed-pending-verification, 1 fix-in-progress, 220 triaged, 5 candidate, 12 duplicate and 34 false-positive. Among critical findings, 5 are confirmed, 2 fixed-pending-verification and 1 false-positive. Seventy-one high findings are confirmed; 289 total records lack `last_verified`.

The register is evidence of an active backlog, not proof that every entry affects live bytecode. Conversely, a source fix does not prove a deployed contract was remediated.

## Architecture risk register

| ID | Risk | Current code/evidence | Target impact | Severity | Required mitigation |
|---|---|---|---|---|---|
| SR-001 | partial payout burns full user shares | `Liquiditymanager.sol`; `CORE-003` confirmed | legacy exit can cause irreversible loss | CRITICAL | block unsafe redemption; fork test exact deployed bytecode; zero-loss migration route |
| SR-002 | valuation silently omits failed data | `ValueCalculator.sol`; `VALUATION-001` confirmed | wrong preview, limits, exit and risk | CRITICAL | fail closed; completeness flags; differential property tests |
| SR-003 | swap does not enforce actual received amount | `SwapManager.sol`; `CORE-002` confirmed | slippage/MEV loss in legacy and ported logic | CRITICAL | receiver balance delta >= minOut; direct adapter; adversarial tests |
| SR-004 | Uniswap path uses zero minOut/spot quote | `UniswapV3PluginDirect.sol`; `PLG-019/021` confirmed | total MEV exposure if reused | CRITICAL | never port; verified quote, minOut/deadline/path, exact simulation |
| SR-005 | one EOA controls 21 PoC components | live owner reads; Ownable modules | key compromise can route/freeze/move pooled state | CRITICAL | minimize legacy window; dual-reviewed freeze/unwind; no admin in target financial path |
| SR-006 | “Beacon upgrade” abandons storage | service locator, no delegatecall; `NEW-005` confirmed | state/asset/config split during migration | HIGH | prohibit stateful repoint; explicit state migration/code-hash ledger |
| SR-007 | pause does not cover ProtocolManager | `CORE-009` confirmed | allocations may continue during emergency | HIGH | freeze all mutation routes during migration; target has no privileged manager |
| SR-008 | broad/permanent approvals | SwapManager/plugins; `CORE-012` and plugin findings | compromised spender drains legacy/user assets | HIGH | snapshot/revoke legacy; bounded user-visible target approvals |
| SR-009 | arbitrary/authorized module asset movement | PG module transfer paths; `NEW-006` | one compromised module drains pool | CRITICAL | deauthorize/revoke in order; eliminate pooled treasury |
| SR-010 | oracle lacks Arbitrum sequencer guard/freshness | Chainlink adapter `ADP-001` | unsafe plan/read during L2 outage | HIGH | chain-specific sequencer/freshness fail-closed policy |
| SR-011 | health factor/formula drift | Morpho/Euler lens/plugin findings | false healthy state or blocked action | HIGH | scale test vectors and official-source differential tests |
| SR-012 | emergency close semantics inconsistent/silent | `CORE-081`, plugin findings | migration falsely reports successful unwind | CRITICAL | per-protocol post-state proof; no boolean/silent success acceptance |
| SR-013 | source/test/ABI selectors diverge | scripts/tests vs current ProtocolManager | wrong calldata and false confidence | HIGH | ABI-001 selector/code contract tests; pin deployment matched ABI |
| SR-014 | exact preview differs from signed calls | web estimates/transactions built separately | compromised/stale UI can alter destination/value | CRITICAL | canonical immutable plan; executable envelope decode/fingerprint equality |
| SR-015 | bundler/paymaster/account wrapper mutation | target not yet implemented/proven | inner-call hash may give false assurance | CRITICAL | AA-001 mutation taxonomy and whole-envelope validation |
| SR-016 | registry/address poisoning or stale copy | divergent env/manifests/frontend constants | direct call to wrong/malicious contract | CRITICAL | versioned signed registry, code hash, provenance, release hash and runtime validation |
| SR-017 | wrong chain/account/token identity | global Arbitrum/symbol assumptions | funds/actions on unintended chain/token/account | CRITICAL | first-class chain/account/address types; pre-sign chain switch and decode |
| SR-018 | simulation state race | optional `latest` simulation | authorized call executes under materially changed state | HIGH | bind block/assumptions/deadline; re-simulate at handoff; user-set limits |
| SR-019 | frontend supply-chain compromise | static client constructs financial calls; current scope incomplete | attacker replaces reviewed calls | CRITICAL | CSP/SRI/provenance/dependency gate; independent wallet decode; incident runbook |
| SR-020 | provider secrets/browser leakage | target requires OAuth/webhooks; no backend exists | account/data/provider compromise | HIGH | minimal secret service, vault/scopes/rotation, redaction, no financial imports |
| SR-021 | webhook replay/forgery | connectors absent | false KYC/payment/card state | HIGH | signature, timestamp, idempotency, replay store, provider-specific fixtures |
| SR-022 | backend becomes signer/order relay | runtime signer code exists; MON-040 ambiguity | violates trust/regulatory boundary | CRITICAL | build/import/network egress guards; no key material; direct/provider-hosted submission |
| SR-023 | personalized/fixed allocation presented as neutral | strategy scripts/UI content | discretionary/recommendation boundary failure | HIGH | explicit user provenance; remove targetBps/recommendations; content tests |
| SR-024 | CDP ownership/recovery/delegation differs from assumptions | no integration/evidence | Jethos/provider could control or strand account | CRITICAL | empirical owner/delegation/recovery/export/ERC-1271 tests |
| SR-025 | user cannot exit if Jethos/provider disappears | current pool and target CDP unproven | stranded assets | CRITICAL | offline metadata/recovery and protocol-native exit acceptance |
| SR-026 | contract size has no evolution margin | Euler plugin 9 bytes and SwapManager 146 bytes below EIP-170 | emergency fix/deploy may fail | HIGH | no feature additions; migration-only; size gate for any legacy patch |
| SR-027 | test/CI green signal is incomplete | broken globs/missing scripts/Foundry unavailable | unsafe change accepted | HIGH | repair reproducible matrix and require evidence per lane |
| SR-028 | client-side credential and dual frontend | `dapp-new` friction credential; broken parity | unauthorized preview access/conflicting releases | HIGH | rotate/remove credential, edge auth, canonical cutover |
| SR-029 | logs/analytics leak identity/financial data | target telemetry/provider state undefined | privacy/security exposure | HIGH | minimization, typed privacy-safe events, redaction/retention/deletion |
| SR-030 | external provider compatibility assumed | all five integrations absent | unsafe workaround/architecture drift | HIGH | fail-closed feature gates and written, dated evidence |

## Release-blocking security gates

Before public real-money use:

- no confirmed critical finding may remain reachable in any enabled path;
- fixed-pending findings affecting migration must be verified against deployed bytecode or the exact fork state;
- every target call must pass registry, decode, exactness, simulation and post-state properties;
- the legacy pooled path must be ingress-frozen with safe exits and monitored state;
- CDP ownership/recovery/delegation and frontend/control-plane boundaries must be independently reviewed;
- CI must run the documented unit/integration/property/security matrix reproducibly.

Removing a vulnerable feature can be the mitigation, but only after proving no assets/users/permissions depend on it.
