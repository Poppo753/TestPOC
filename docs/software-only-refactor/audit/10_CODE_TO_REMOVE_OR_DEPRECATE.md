# Code to remove or deprecate

Removal is the last strangler step. Any component that might hold assets, allowances, ownership, position state, or unique evidence is first handled by `12_STATE_AND_DEPLOYMENT_MIGRATION.md`.

## Target product removals

| Component | Why it leaves the target | Prerequisite | Removal proof |
|---|---|---|---|
| LPT/custody/share behavior in `ProxyGeneral` | violates no-custody/no-pooling and prevents native exit | every deployment/holder/balance/allowance known and exited | zero supply/assets; no product imports/calls |
| pooled `LiquidityManager` deposit/withdraw | maps user funds into global pool; critical loss findings | ingress frozen and all holders exited | chain events/state plus frontend/CI grep |
| privileged financial execution in `ProtocolManager` | operator decides/moves pooled assets | positions zero; direct adapters live | selectors unused by product; role revoked/retired |
| `DepositHelper` | only wraps into obsolete pool | pooled flow retired | zero balance/allowance and no callers |
| automation runtime/Safe financial execution | backend/admin signer conflicts with user execution | observe path split; legacy migration commands isolated | product dependency/import guards |
| fixed target allocations/recommendations | conflicts with explicit user choice | neutral RuleSet/catalogue/UI tests | content/code scan and behavioral tests |
| `DolomitePlugin` | unfinished and bundle rejects it | deployment/event/state search | no address/state/config/consumer remains |
| InterVault plugin/registry/lens | Jethos meta-pooling violates V1 invariant | prove undeployed/zero or unwind | state evidence and consumer removal |
| Uniswap plugin execution | pooled asset source and unsafe swap defaults | direct DEX adapter with adversarial tests | no product call to SwapManager/plugins |
| flash-loan/leverage normal path | outside V1; critical slippage/callback risk | prove debt/positions zero; retain unwind tool if needed | capability registry excludes it |
| global/mutable Jethos token/protocol registries | owner trust and symbol/chain ambiguity | signed/versioned target registry live | product reads only versioned registry |
| stale Jethos interfaces/generated types | selectors diverge from source | migration scripts pinned; target ABIs generated | no active imports and ABI contract tests |

## Repository deprecation/removal candidates

- `dapp-new/**`: retire after `jethos-web` is declared canonical, route/content parity is evidenced, the missing brand contract is resolved, and the hard-coded client-side credential is removed/rotated.
- `vari/**`, contract backups/copies, broken GMX/Pendle/Odos references, unfinished Ignition Lock scaffold, and missing-script package commands: preserve unique history in Git/a canonical index, then remove as non-capabilities.
- duplicate `docs/Old_Documentation/**` and `docs/New_Doc/**`: do not bulk-delete. `DOC-001` must identify canonical evidence, legal/security history, and external source dates first.
- generated caches (`cache`, `out-foundry`) remain ignored build outputs; deployment-matched artifacts are copied to an immutable migration evidence bundle before routine regeneration.

## Things explicitly not removed yet

- old contracts and owner scripts while any live state/allowance/user uncertainty remains;
- legacy tests that protect LPT/NAV/unwind behavior;
- protocol interfaces/fixtures needed to validate the direct replacement;
- security findings, including false-positive and fixed-pending history;
- deployment manifests even when divergent.

## Removal gates

For each component: inventory callers → move useful responsibility → add replacement/negative tests → switch all consumers → observe → prove zero state/permissions → deprecate → remove. A code search alone is not proof that a deployed contract is safe to abandon.
