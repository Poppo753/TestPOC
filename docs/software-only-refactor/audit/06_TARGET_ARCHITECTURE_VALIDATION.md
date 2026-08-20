# Target architecture validation

## Invariant review

| Invariant | Current evidence | Corrected target mechanism | Result before implementation |
|---|---|---|---|
| INV-01 no Jethos custody | underlying in `ProxyGeneral`; positions in plugins | user SA is token/position owner; provider control plane never handles assets | Current fail; target coherent |
| INV-02 no Jethos user-key control | browser EOA signs; operator key controls pool, not user EOA | CDP user-owned account, recovery/export proof, no developer delegation | Current partial; external proof required |
| INV-03 no normal backend signer | app has none; scripts have runtime/operator signers | import/build boundary prevents provider service from signer packages | Target needs explicit boundary |
| INV-04 user-owned CDP Smart Account | absent; Safe tooling is admin-only | empirical owner/recovery/ERC-1271/chain-address PoC | External/architecture gate |
| INV-05 direct protocol default | all primary integrations use Jethos plugins | pinned protocol ABIs and direct SA calls | Target accepted; Euler atomicity PoC needed |
| INV-06 no backend order relay | live vault calls are browser→chain; `MON-040` target wording permits relay | browser/provider-native submission or provider-hosted handoff; otherwise block feature | Checklist corrected |
| INV-07 user decides | fixed targetBps, strategy presets, “recommendations” exist | explicit RuleSet + neutral data; no KYC/profile ranking | Current fail; content/code removal required |
| INV-08 Builder mainly TypeScript | useful Node plan framework exists; app bypasses it | browser-safe shared engine based on existing types/plans | Feasible after split |
| INV-09 exact bytes | preview/estimate independent; no canonical plan in app | canonical plan and executable-envelope fingerprints; decode/simulate/handoff equality | Target materially incomplete as supplied |
| INV-10 independent exit | user needs LM/PG/config/orchestration | protocol-native withdrawal from user SA; exported registry/ABI and recovery runbook | Target coherent if CDP recovery proven |
| INV-11 no V1 pooling | LPT/global NAV is core | no Jethos vault/share/accounting; protocol-native vault shares allowed when user-owned | Current fail; legacy lane required |
| INV-12 minimize custom Solidity | 91 contract files; plugins near EIP-170 | zero custom Jethos execution contracts unless exception ADR passes five tests | Target accepted |

## What the supplied target gets right

- “Jethos compiles; the user executes” is the correct responsibility boundary.
- Coinbase CDP user/embedded wallet plus user-owned Smart Account is preferable to a Jethos account contract if ownership and recovery are proven.
- Provider KYC/payment/card/trading decisions remain provider-owned.
- 21X V1 should be an external/provider frontend handoff; V2 must remain gated.
- A deterministic TypeScript adapter model is appropriate for direct DeFi interactions.
- Explicit user rules, notification-only rebalance V1, and separate legal/provider gates reduce hidden discretion.
- Arbitrum, Base, and Polygon must be modeled as separate chains; account addresses must not be assumed equal.

## Material corrections to the supplied target

### 1. Exact-bytes is an executable-envelope property

Hashing `Call[]` alone does not prove that the Smart Account executes the reviewed plan. The canonical object must include:

- schema and registry version;
- chain ID and user Smart Account address;
- ordered targets, values, calldata and dependency/atomicity groups;
- account-specific batch encoding and decoded inner calls;
- nonce/replay domain and validity deadline;
- simulation block/state reference and freshness policy;
- permission/session-key scope if ever enabled;
- a fingerprint of fields the wallet/bundler/paymaster may legally add or mutate.

Before user authorization, the CDP-generated account calldata/UserOperation must decode back to the same call graph. Any mutation of target, calldata, value, order, chain, account, permission scope, or validity invalidates preview and simulation. Gas/paymaster fields may be refreshed only under an explicitly defined non-financial envelope policy.

### 2. Browser-only does not mean backend-free

Sumsub OIDC/token sharing, Monerium/Reap credentials and signed webhooks may require secrets and persistent idempotency state. The correct target includes a minimal provider control plane that may:

- exchange OAuth credentials and validate webhooks;
- store minimal provider connection/status/consent records;
- enforce rate limits, replay protection, retention, and audit logging;
- deliver non-financial notifications.

It may not hold user keys, submit DeFi calls, transmit trading/payment orders where that creates a Jethos relay, select investments, or maintain a shadow asset ledger.

### 3. Simulation needs time/state binding

An `eth_call` at `latest` can become stale before authorization. Plans require a simulation block, RPC/provider identity, state assumptions, expiry, and re-simulation policy at wallet handoff. Post-state validation is a separate read and must not claim transaction failure solely because an RPC read is unavailable.

### 4. Direct calls do not guarantee equivalent atomicity

- Aave supply/withdraw is a safe first vertical slice.
- Morpho Blue market identifiers and share/asset rounding must be explicit.
- MetaMorpho is a separate ERC-4626 capability, not “Morpho” generically.
- Euler EVC, subaccounts, callbacks, and controller state require a CDP Smart Account batching PoC.
- Flash-loan leverage is not a V1 migration target and cannot be assumed recoverable as independent single calls.

If a protocol operation truly needs atomic multi-call, the user Smart Account batch is the first mechanism to test. A Jethos contract is considered only after proving that account batching and client checks cannot enforce the named invariant.

### 5. The proposed folder tree is not an implementation instruction

The repository already contains plan primitives in `scripts/framework` and has a canonical candidate consumer in `jethos-web`. The recommended boundary is a workspace package `packages/financial-engine`, not an unqualified root `src/engine`. `ARCH-011` and `WEB-001` must approve package ownership, build targets, browser compatibility, and dependency rules before moving code.

### 6. Position APIs need explicit identity

Every `readPosition`, `buildSupply`, and `buildWithdraw` accepts `{chainId, account, asset/market identity}`. No adapter may infer a global account, symbol-only token, default chain, or Jethos plugin address.

### 7. Deployment/provider provenance is part of safety

The current manifest, `.env.mainnet`, frontend constants, and live/source bytecode diverge. The target registry must bind each address/ABI/capability to chain, source, code hash, verification block/date, and registry version. A web release must record the registry hash and Git SHA.

## Adversarial contradiction hunt

| Attempt to falsify target | Finding | Consequence |
|---|---|---|
| CDP “user-owned” may still permit developer delegation | supplied docs acknowledge delegation but repository has no empirical proof | CDP control/recovery/delegation tests block wallet integration |
| Smart Account may not expose identical address on all chains | supplied target warns against assumption | persist per-chain account metadata; test three chains separately |
| bundler/paymaster may mutate a reviewed transaction | inner calls can be wrapped; gas fields can change | bind/decode full executable envelope and define allowed non-financial mutation |
| protocol action may require intermediary state/atomicity | Euler EVC/leverage are plausible cases | PoC account batching; exclude leverage V1; no automatic custom contract |
| client-only calculation may be compromised/stale | frontend supply-chain/RPC/state races remain | signed registry, CSP/provenance, independent decode, block-bound simulation |
| external provider may require Jethos to submit an order | `MON-040` wording allows this; 21X V2 unknown | direct/provider-hosted path or feature remains blocked |
| KYC/card providers may not accept CDP wallet ownership/ID tokens | unconfirmed in code | provider gates remain `[!]`; no invented compatibility |
| “no backend” may make OAuth/webhooks impossible | current repo has none, target services likely need one | introduce narrow non-signing control plane with explicit negative capabilities |
| existing pooled IP might justify keeping Solidity | useful logic is validation/math, not custody enforcement | extract/test it in TS; deployment sunk cost is not an invariant |
| user exit may fail if Jethos disappears | CDP recovery/export and protocol metadata availability unproven | offline/exported exit package is acceptance-critical |

## Regulatory-technical boundary review

This audit gives no legal opinion. Architecturally, the target must be rejected if implementation introduces any of the following: Jethos-controlled user keys; pooled Jethos claims; backend financial-order relay; provider decisions presented as Jethos decisions; opaque personalized ranking; discretionary allocations; or an exit path dependent on a running Jethos backend. Provider contracts and an Italian/EU perimeter memo remain legal gates, not facts inferred from code.

## Validated target statement

Jethos may compile a deterministic, provenance-bound plan from explicit user choices; display and simulate the exact executable Smart Account call graph; and observe the resulting user-owned protocol position. The user-owned account authorizes and executes direct protocol/provider-native actions. A minimal Jethos control plane handles only secret-bearing provider connectivity and status. Existing Jethos pooled contracts exist solely in a separately controlled migration lane until state, permissions, and users are proven exited.
