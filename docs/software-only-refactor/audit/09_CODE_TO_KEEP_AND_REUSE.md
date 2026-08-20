# Code to keep and reuse

Reuse is responsibility-level, not file-level. Nothing in this document authorizes copying a known finding or a custody assumption into the target.

## Highest-value reusable code

| Source | Preserve | Required hardening/extraction | Target consumer |
|---|---|---|---|
| `scripts/framework/types.ts` | signer-independent plan/call shapes; bigint serialization | add chain/account/registry/schema/state/validity domains; remove Jethos target assumptions | shared domain/planner |
| `scripts/framework/plans.ts` | deterministic calldata construction, dependencies, encode-only behavior | pinned direct protocol ABIs; canonical ordering/fingerprint; browser-safe imports | shared planner/protocol adapters |
| `scripts/framework/preflight.ts`, `retry.ts`, `errors.ts` | structured deterministic/transient error distinction | no silent fail-open; state/block/freshness semantics | simulation/control plane |
| `scripts/framework/manifest.ts` | normalization and chain-aware manifest concept | remove fallback Arbitrum constants and Node-fs coupling; bind source/code hash/version | registry package |
| `scripts/automation/observer.ts`, `risk.ts`, `alerts.ts` | read/threshold/alert patterns | explicit user account/RuleSet; notification-only; no pooled targetBps | user notifications |
| protocol registries/lenses/plugins | ABI knowledge, decimals, market IDs, conversions, failure cases | extract from plugin account/custody; independently verify formulas/addresses | Aave/Morpho/Euler adapters |
| `security/properties/PROPERTY_CATALOG.md` | named oracle, slippage, approval, scale, state, access, leakage properties | mark pooled-only properties legacy; add plan/SA/registry properties | target test contract |
| mocks/fuzz tests | stale oracle, reentrant token, revert, rounding and balance fixtures | retarget to pure TS and direct-call integration; preserve legacy suite until exit | adapter/security tests |
| `scripts/verification/**` and diagnostics | bytecode/address/state/protocol observations | emit chain/block/code/manifest hash and machine-readable evidence | migration and production observability |
| Astro design system/layout/site shell | accessible static presentation and route/build system | content/legal review and financial feature isolation | canonical `jethos-web` |
| content schemas/local repository | typed content validation | source/status/date/provenance and claim linting | product/docs content |
| `jethos-web` Vitest/Playwright setup | working unit/e2e infrastructure | add wallet/plan/chain/provider fixtures; repair aggregate parity | client CI |

## Security logic to preserve

- normalize decimals at every protocol/token boundary; never infer decimals from symbol;
- reject missing, stale, non-positive, or sequencer-unsafe price state;
- require explicit slippage, receiver, deadline and actual balance-delta checks;
- model share/asset rounding direction and sentinel maximum values per protocol;
- validate target code/address/selector/capability against a versioned registry;
- treat unknown/reverted position reads as incomplete, not zero/healthy;
- verify all markets/controllers/subaccounts, not a convenient first element;
- cap approvals and expose spender/value/revocation to the user;
- preserve structured revert decoding and deterministic vs transient errors;
- keep legacy LP/NAV/accounting properties active until assets and LPT supply are zero.

## Reuse constraints

1. A contract formula is not trustworthy because it compiled; high/critical findings require independent vectors.
2. Existing Safe code is admin tooling, not a CDP wallet abstraction.
3. Current plan execution with a Hardhat signer is migration tooling, not a product backend.
4. Current manifests are historical evidence, not a verified target registry.
5. Demo/local-storage balances are illustrative, never a user financial ledger.
6. Frontend transaction lifecycle/toast/receipt UI may be reused only after calls originate from the canonical plan object.

## Evidence-preservation rule

Before any source removal, tag or archive the deployment-matched ABI/bytecode, migration snapshot, property/test disposition, and the last consumer graph. Historical artifacts should be immutable and clearly labeled; they must not remain importable as active product capabilities.
