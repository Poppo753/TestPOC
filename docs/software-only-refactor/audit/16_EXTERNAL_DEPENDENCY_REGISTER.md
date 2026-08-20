# External dependency register

No external capability below is inferred from marketing language. Dates and claims in the supplied documents are planning inputs dated around 2026-08-16 and require written reconfirmation for production.

Status vocabulary is restricted to: `CONFIRMED_IN_CODE`, `CONFIRMED_IN_SUPPLIED_DOCS`, `EXTERNAL_CONFIRMATION_REQUIRED`, `UNKNOWN`.

| Provider/dependency | Assumption | Confirmed? | Evidence | Impact if false | Blocking phase |
|---|---|---|---|---|---|
| Coinbase CDP | target product is User/Embedded Wallet plus user-owned Smart Account, not Server Wallet | CONFIRMED_IN_SUPPLIED_DOCS | target DOCX/checklist decision only | core account model invalid | M0/CDP PoC |
| Coinbase CDP | developer delegation can be disabled and ordinary flow cannot be signed by Jethos | EXTERNAL_CONFIRMATION_REQUIRED | no SDK/config/code in repo | violates INV-02/03 | M0/CDP PoC |
| Coinbase CDP | atomic batching, ERC-1271, recovery/export and Jethos-independent access meet acceptance | EXTERNAL_CONFIRMATION_REQUIRED | no empirical tests | exact plan and exitability blocked | M0/M1 |
| Coinbase CDP | per-chain address/ownership behavior for Arbitrum, Base, Polygon | EXTERNAL_CONFIRMATION_REQUIRED | supplied docs explicitly warn not to assume parity | registry/account model blocked | M0 |
| Coinbase CDP | bundler/paymaster permits call-envelope verification and non-sponsored fallback | EXTERNAL_CONFIRMATION_REQUIRED | target concept only | exactness/gas UX blocked | M1 |
| Sumsub | Jethos qualifies as Gateway Integrator | EXTERNAL_CONFIRMATION_REQUIRED | `GATE-001`; no code/contract | reusable identity module may be unavailable | external gate |
| Sumsub | Gateway token accepted by Reap recipient | EXTERNAL_CONFIRMATION_REQUIRED | supplied docs call it unconfirmed | “one KYC” card flow invalid | Reap sandbox |
| Sumsub | Gateway token accepted by Monerium recipient | EXTERNAL_CONFIRMATION_REQUIRED | supplied docs call it unconfirmed | Monerium onboarding flow invalid | Monerium sandbox |
| Sumsub | ACE/CCID can be issued/shared for 21X target users/chains | EXTERNAL_CONFIRMATION_REQUIRED | no provider evidence | 21X V2 blocked | 21X V2 |
| Sumsub | OIDC/PKCE, recipient-specific short-lived opaque sharing works as modeled | EXTERNAL_CONFIRMATION_REQUIRED | target specification, no implementation | identity architecture changes | Sumsub sandbox |
| Monerium | whitelabel/personal service supports Italian users and intended Jethos role | EXTERNAL_CONFIRMATION_REQUIRED | `GATE-003`; no contract/code | Cash/IBAN module blocked | external/legal gate |
| Monerium | CDP Smart Account ownership proof/ERC-1271 linking is accepted | EXTERNAL_CONFIRMATION_REQUIRED | no sandbox evidence | EURe cannot reach intended account | Monerium sandbox |
| Monerium | Sumsub share token accepted without incompatible data relay | EXTERNAL_CONFIRMATION_REQUIRED | no written recipient confirmation | reusable KYC promise invalid | Monerium sandbox |
| Monerium | outgoing SEPA can remain user-authorized without Jethos backend order relay | EXTERNAL_CONFIRMATION_REQUIRED | checklist `MON-040` is architecturally ambiguous | violates INV-06 or feature unavailable | before outgoing SEPA |
| Monerium | EURe chain/token/fee/IBAN/webhook model and outage recovery | EXTERNAL_CONFIRMATION_REQUIRED | target hypotheses only | registry, balance and payment state invalid | sandbox→production |
| Reap | available to individual Italian/EEA cardholders | EXTERNAL_CONFIRMATION_REQUIRED | target calls Reap a candidate | Card module unavailable | external gate |
| Reap | Jethos contractual/regulatory role preserves software-only boundary | EXTERNAL_CONFIRMATION_REQUIRED | `GATE-002`; no agreement | legal/architecture blocker | external/legal gate |
| Reap | Sumsub Gateway recipient compatibility | EXTERNAL_CONFIRMATION_REQUIRED | no evidence | duplicate KYC or flow failure | sandbox |
| Reap | program mode, issuer, custody/funding model and Base/Polygon routes are compatible | EXTERNAL_CONFIRMATION_REQUIRED | no code/contract | fund flow may require forbidden custody/relay | before integration |
| Reap | card details remain provider-hosted and Jethos avoids PAN/CVV scope | EXTERNAL_CONFIRMATION_REQUIRED | target requirement only | PCI/security scope expands | before card reveal |
| 21X | V1 is disclosure plus external provider frontend/handoff; no Jethos order endpoint | CONFIRMED_IN_SUPPLIED_DOCS | explicit DOCX/checklist scope | V1 scope must be redefined | V1 |
| 21X | Italian retail onboarding is available | EXTERNAL_CONFIRMATION_REQUIRED | `GATE-004`; no evidence | Invest unavailable | V1/V2 gate |
| 21X | ACE/CCID and Sumsub model accepted | EXTERNAL_CONFIRMATION_REQUIRED | target hypothesis | V2 identity flow blocked | V2 |
| 21X | browser/self-custodial JS SDK or ABI/builder API exists; public examples are suitable | EXTERNAL_CONFIRMATION_REQUIRED | supplied checklist notes current Python/private-key mismatch | embedded V2 not implementable | V2 architecture gate |
| 21X | technical frontend role and direct order/cancel path avoid backend relay and are contractually/regulatorily accepted | EXTERNAL_CONFIRMATION_REQUIRED | written answer and MiFID counsel requested | V2 prohibited | V2 legal gate |
| 21X | Polygon account/gas/funding and contract metadata are available | EXTERNAL_CONFIRMATION_REQUIRED | no repository integration | direct V2 calls cannot be built safely | V2 |
| RPC/bundler providers | chain history, simulation, rate limits and availability meet block-bound design | UNKNOWN | current app uses a public Arbitrum RPC; target vendors undecided | unreliable/centralized reads and handoff | M0/M1 |
| protocol deployments | official Aave/Morpho/Euler/Uniswap addresses/ABIs/code for each enabled chain | EXTERNAL_CONFIRMATION_REQUIRED | repo manifests/registries exist but provenance/source diverges | wrong-address loss | each adapter gate |
| Italian/EU counsel | software-only flows and provider contracts remain outside custody/order/discretion boundaries | EXTERNAL_CONFIRMATION_REQUIRED | supplied docs request a specialist memo | public launch/legal role blocked | launch; some provider V2 |

## Confirmed repository negatives

Search and dependency inspection confirm in code that the current product has **no integration** with Coinbase CDP, Sumsub, Monerium, Reap or 21X, and no application backend/database. This is `CONFIRMED_IN_CODE` absence, not evidence that any provider capability exists.

## Fail-closed gate policy

- External-gate request tasks can start immediately and are not themselves blocked.
- A task whose acceptance requires a provider answer, sandbox credential, signed contract or legal memo is `[!]` until that artifact is stored with owner/date/scope/version.
- Downstream tasks remain pending with explicit dependency; they do not silently reinterpret an adverse answer.
- 21X V2 stays disabled regardless of V1 handoff success.
- If Monerium/Reap requires Jethos to hold/sign/relay a financial instruction, the feature is blocked pending a target-invariant decision; it is not “fixed” by changing terminology.
