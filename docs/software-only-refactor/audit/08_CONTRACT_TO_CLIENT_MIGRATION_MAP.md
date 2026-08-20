# Contract-to-client migration map

The table decomposes each current financial contract by responsibility. “Client” means the shared deterministic TypeScript engine or its browser adapter; “legacy” means a time-bounded migration tool. It does not imply that untrusted frontend calculations replace protocol enforcement.

| Contract(s) | Current responsibilities | Useful responsibility destination | Obsolete responsibility | Verification before shrink/remove | Checklist |
|---|---|---|---|---|---|
| `ProxyGeneral` | custody, LPT ERC-20, authorized modules, token transfer, rate limits, pause | rate/balance/authorization negative tests → shared security corpus | all custody, LPT, global module treasury | holder/balance/allowance/module snapshot; full exit; zero assets/supply; freeze | MIG-001..006, OPS-002B |
| `Liquiditymanager` | transferFrom deposit, fee, global NAV share math, burn/withdraw, auto-unwind | amount validation, decimal/rounding/balance-delta properties → domain/planner tests | pooled shares, fee collection, auto portfolio unwind | regression test critical clamp bug; ingress off; all LPT redeemed | MIG-002/003/004, BLD-020* |
| `ProtocolManager` | owner/operator routing, protocol activation, selector allowlist, low-level call | capability/action/selector metadata → versioned registry | privileged pooled execution | repair ABI only to support exit; prove no target consumer imports it | ABI-001, protocol modules |
| `Beacon` | mutable service locator, history/freeze | address history → migration ledger; freeze semantics → registry governance requirements | “upgrade” routing in financial path | record every route/code hash/state owner; ban stateful repoint during exit | MIG-001/005, ARCH-004 |
| `ParameterManager` | global flags/fees/limits/timelock proposals | validated limit types → user RuleSet; provider flags → control plane config | global investment policy and fee-on-pool | state snapshot; preserve only exit flags; test no deposit after freeze | BLD-001*, MIG-003 |
| `TokenManager` | symbol/token/oracle registry | asset metadata validation → chain registry | symbol-only and owner-mutated identity | compare manifest/on-chain/frontend; code-hash/provenance tests | ARCH-004, CHAIN-001 |
| `ValueCalculator` | aggregate pool NAV, per-token price, lens aggregation/HF | decimals, freshness, scale and fail-closed reads → pricing/protocol adapters | share price/global NAV as user balance | property mapping and differential fixtures before retirement | OPS-002B, BLD-032* |
| `SwapManager` | plugin selection, approvals, pooled swaps, stats/error handling | typed errors, exact minOut, allowance and balance-delta checks → DEX adapter | pooled/privileged selection and max approvals | adversarial direct-call tests; revoke legacy allowances | DEX-001, MIG-005 |
| `EmergencyHandler` | global pause/unwind | runbook/call graph → legacy tool | permanent user recovery dependency | legacy dry-run/unwind; separate native target exit acceptance | MIG-002/004/006, ACC-030 |
| `DepositHelper` | wrap ETH then pooled deposit | none beyond standard WETH ABI | helper and pool entry | confirm no balance/allowance/users; remove frontend refs | MIG-003, WEB-002 |
| `ChainlinkAdapter` | feed mapping, decimal normalization/freshness | `pricing/chainlink.ts`, registry metadata, fork fixtures | mutable owner routing and fail-open behavior | sequencer/freshness/decimal test vectors | SEC-001, OPS-002B |
| `AaveV3Plugin` | approve, supply/withdraw/borrow/repay, flash leverage for plugin | ABI/action encoding, HF/slippage failure cases → Aave TS adapter/tests | plugin ownership, PG transfers, leverage V1 | direct user SA fork/testnet supply+withdraw and independent exit | AAVE-*, FLASH-001 |
| `AaveV3Registry` | reserve/asset config | verified address/capability registry | on-chain mutable Jethos copy | official-source, chain code and registry hash checks | AAVE-002, ARCH-004 |
| `AaveV3LensAdapter` | plugin balance/HF/yield reads | normalized explicit-account reader | plugin implicit account and index-as-APY | differential test against Aave data provider | AAVE-003/021 |
| `MorphoPlugin` | plugin market supply/collateral/debt/repay/leverage | market ID/rounding/call logic → Morpho Blue TS | plugin custody/global leverage | direct SA fixtures and zero legacy market positions | MORPHO-*, MIG-001/004 |
| `MorphoRegistry` | mutable market config | full market tuple registry | owner/global strings | official/code validation and deterministic MarketId | MORPHO-002 |
| `MorphoLensAdapter` | collateral/debt/HF aggregation | explicit user market reader and scale tests | plugin account/fail-open/silent scaling | differential/rounding/HF property suite | MORPHO-003/014 |
| `MorphoVaultPlugin` | plugin-owned ERC-4626 shares | deposit/redeem ABI/rounding → MetaMorpho adapter | plugin share custody | direct user vault share/asset tests; zero legacy shares | MORPHO-001*/010/011 |
| `MorphoVaultLensAdapter` | vault share/value reads | explicit user ERC-4626 reader | pooled yield view | preview/actual and rounding differential tests | MORPHO-012/014 |
| `EulerV2Plugin` | EVC/vault/subaccount and leverage execution | EVC batch/account semantics → Euler adapter after PoC | plugin/subaccount custody, callbacks/leverage V1 | whole-batch simulation; all-controller HF; zero legacy positions | EULER-*, FLASH-001 |
| `EulerRegistry` | vault/controller/subaccount allocation | verified vault metadata → registry; account mapping → explicit domain model | global subaccount allocation | chain-specific SA/EVC test and provenance | EULER-001*/002 |
| `EulerLensAdapter` | aggregate value/HF/yield | explicit user/subaccount reader, negative fixtures | controllers[0], hardcoded LTV, double count | protocol-lens differential tests | EULER-003/013 |
| `UniswapV3Plugin` + `Direct` | incompatible token source, router approvals/swaps/quotes | router/quoter ABI, path/decimal cases → one DEX adapter | PG/caller pull ambiguity, spot/zero-minOut, hardcoded fee | exact balance-delta/slippage/adversarial suite | DEX-001, SEC-002 |
| `FlashLoanService` | Balancer flash liquidity, callbacks, swaps | position-unwind topology → sealed legacy runbook | normal leverage/execution path | prove no live debt; simulate unwind or mark no-op with evidence | FLASH-001, MIG-002/004 |
| `InterVaultPlugin` | parent/leaf pooled capital | none; generic recursion failure cases only | entire meta-pool model | deployment/code/event/balance search; zero state | INT-001, MIG-001 |
| `InterVaultRegistry` | parent/leaf/cap/lifecycle state | historical deployment snapshot | entire target capability | confirm absent from all production manifests or unwind | INT-001 |
| `InterVaultLensAdapter` | recursive NAV | fail-closed recursion test concept | recursive pool valuation | extract generic tests; no target import | INT-001, OPS-002B |
| `DolomitePlugin` | unfinished protocol calls | none until separate product decision | apparent supported capability | prove no deployment/state; remove configs/docs/tests consistently | DOL-001 |
| Solidity interfaces | compile-time surfaces | official protocol ABIs → pinned ABI package | stale Jethos manager/plugin interfaces | ABI/code selector reconciliation and consumer graph | ABI-001 |
| mocks/Echidna harness | adversarial tokens, oracles, reentrancy, pool invariants | portable failure vectors → shared/adapter tests | pooled share-specific expectations after exit | property-by-property disposition recorded | OPS-002B |

## Universal properties that must survive Solidity removal

1. every asset amount carries decimals and chain/address identity;
2. price reads fail closed on missing, stale, invalid, or L2-sequencer-unsafe data;
3. quote and simulation do not substitute for `minOut` and actual receiver balance delta;
4. approvals are bounded, target-visible, and revocable;
5. plan targets/selectors/values/order are allowlisted and decoded;
6. state assumptions are block-bound and expire;
7. share/asset conversions use protocol-defined rounding direction;
8. health-factor scales and all relevant controllers/markets are included;
9. external-call errors are not silently converted into healthy/complete state;
10. user exit uses protocol-native interfaces and does not depend on a Jethos signer/service.

Pooled-only properties—LPT conservation, global NAV/share equality, donation handling, module custody accounting—remain mandatory in the legacy migration suite until pool supply and assets are proven zero. They are not ported as target product behavior.
