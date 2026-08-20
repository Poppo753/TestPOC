# Current versus target gap analysis

## System-level gaps

| Dimension | Current fact | Target | Gap / severity | Required task |
|---|---|---|---|---|
| asset ownership | underlying in PG; positions in plugins | assets/positions in user SA | architecture replacement / Critical | MIG-*, direct adapters |
| user representation | LPT balance against global pool | direct per-chain account and native positions | no transferable state mapping / Critical | CDP-*, protocol readers |
| signing | EOA signs deposits; operator signs allocations; script executor exists | user authorizes every V1 plan | operator/backend execution must be isolated / Critical | BACK-001, BLD-040/041 |
| transaction construction | browser vault calls; Node pooled planner | shared signer-free direct planner | extraction + ABI replacement / High | ARCH-011, WEB-001, BLD-* |
| preview/simulation | separate estimates; optional script simulation | same executable envelope, decoded and block-bound | missing canonical exactness / Critical | AA-001, SEC-002 |
| custody exit | LM/PG/global liquidity required | protocol-native account exit without Jethos | migration + CDP recovery proof / Critical | MIG-*, CDP-013 |
| accounting | global NAV and LPT shares | no Jethos ledger; direct positions | delete pooled semantics, retain normalized views / High | C001/C002/C007 dispositions |
| decision making | fixed targetBps, presets, recommendations | explicit user RuleSet/neutral catalogue | content/code conflict / High | UX-020/021/022, BLD-001* |
| addresses | multiple divergent manifests/constants; symbol lookup | signed versioned `(chainId,address)` registry | provenance and multi-chain gap / Critical | ARCH-004, CHAIN-001 |
| wallet/account | EIP-1193 EOA; no batching/4337 | CDP user-owned SA | new external integration and empirical proof / Critical | CDP-*, AA-001 |
| backend | none | provider-secret/webhook control plane only | new architecture boundary / High | BACK-001/002 |
| protocols | Jethos plugins own state | TS adapters call protocol for user | six execution replacements / Critical | AAVE/MORPHO/EULER/DEX |
| external providers | none implemented | CDP/Sumsub/Monerium/Reap/21X | assumptions unconfirmed / High | GATE-*, provider modules |
| multichain | mostly Arbitrum; copied addresses | Arbitrum/Base/Polygon explicit | identity/account/RPC breakpoints / High | CHAIN-* |
| security | 380 findings; 5 confirmed critical | fail-closed target invariants | public-money blocker / Critical | SEC-*, OPS-002B |
| testing | broad suite but broken runners/drift | reproducible legacy + target lanes | cannot trust aggregate green / High | OPS-002*, OPS-002A |
| frontend | two trees; parity missing asset | one canonical Astro app | cutover decision and credential removal / High | WEB-001, SEC-LEG-001 |
| deployment | service-locator replacement, no storage migration | minimal/no Jethos financial deployment | state/allowance retirement / Critical | MIG-* |

## Protocol-by-protocol migration analysis

### Aave V3

1. **Current implementation:** `AaveV3Plugin` supplies/borrows for the plugin and sends returned assets to PG; leverage uses flash/swap callbacks.
2. **Solidity:** plugin, registry, lens, interfaces; current source and tests include borrow/leverage beyond target MVP.
3. **TS/backend:** framework/automation build calls through ProtocolManager; ABI is stale. No browser direct adapter.
4. **Addresses/config:** July PoC manifest and mutable registry; provenance is not tied to source/code hash.
5. **Useful logic:** reserve/token mapping, normalized reads, allowance and health-factor negative cases.
6. **Custody coupling:** complete; `onBehalfOf`/position is plugin, funded by PG.
7. **Future `readPosition`:** query Aave for `{chainId,userSmartAccount,reserve}` at an explicit block.
8. **Future `buildSupply`:** optional exact approval plus Pool `supply(asset,amount,userSA,referralCode)`.
9. **Future `buildWithdraw`:** Pool `withdraw(asset,amount,userSA)` from user SA.
10. **Allowance:** exact/bounded by default; zero-reset compatibility; revoke action available.
11. **Simulation:** exact SA batch against pinned Pool/token code and fresh oracle/sequencer state.
12. **Post-state:** balance delta, aToken delta, allowance, receipt/events; fail on unexpected target/asset.
13. **Eliminate:** plugin custody, PM route, global registry state, flash leverage V1.
14. **Tests to migrate:** decimals, stale oracle, min/balance delta, supply/withdraw rounding, pause/revert decoding; retain pooled tests only for exit.

### Morpho Blue

1. **Current:** pair-based plugin positions owned by the plugin; borrow/leverage and silent emergency paths exist.
2. **Solidity:** `MorphoPlugin`, registry, lens, Morpho/ERC-4626 interfaces.
3. **TS:** ProtocolManager plan paths are stale; no direct market-param adapter.
4. **Config:** market identity is split across mutable registry/manifest.
5. **Useful:** full market params, share/asset rounding, collateral/debt/HF formulas and error cases.
6. **Custody coupling:** plugin is supplier/borrower/collateral account.
7. **`readPosition`:** explicit user SA plus full market ID; expose assets and shares without lossy conversion.
8. **`buildSupply`:** direct Morpho `supply` with user as beneficiary and explicit callback-data policy.
9. **`buildWithdraw`:** direct assets-or-shares withdrawal with receiver user SA.
10. **Allowance:** exact token→Morpho approval; explicit revoke and permit capability only if verified.
11. **Simulation:** pinned market parameters, liquidity/cap/oracle state, rounding boundary fixtures.
12. **Post-state:** user supply shares/assets, token delta, market totals and receipt events.
13. **Eliminate:** plugin/PG route, global strategy allocation, V1 leverage.
14. **Tests:** WAD scale, share rounding, market identity, liquidity/revert, fail-closed HF.

### MetaMorpho / Morpho Vault

1. **Current:** separate plugin owns ERC-4626 shares.
2. **Solidity:** `MorphoVaultPlugin`, `MorphoVaultLensAdapter`, IERC4626 interface.
3. **TS:** yield-only script reader exists; no client adapter.
4. **Config:** vault addresses in registry/manifest; must be separated from Blue markets.
5. **Useful:** preview/convert rounding, caps/liquidity, yield-read negative cases.
6. **Custody:** shares belong to plugin, not user.
7. **Read:** explicit user share balance, `convertToAssets`, underlying identity at explicit block.
8. **Supply:** `deposit(assets,userSA)` or `mint` chosen explicitly; never implicit conversion.
9. **Withdraw:** `redeem(shares,userSA,userSA)` or `withdraw` with preview-bound limits.
10. **Allowance:** bounded underlying→vault approval.
11. **Simulation:** ERC-4626 preview plus exact call; reject preview/call inconsistency.
12. **Post-state:** share and underlying deltas/cap state.
13. **Eliminate:** plugin custody and pooled yield aggregation.
14. **Tests:** asset/share rounding directions, cap, liquidity, zero/maximum sentinel behavior.

### Euler V2 / EVC

1. **Current:** plugin/EVC subaccounts own pooled positions and support leverage callbacks.
2. **Solidity:** near-limit plugin, registry, large lens, Euler interfaces.
3. **TS:** registry/config scripts exist; no browser-safe EVC batch builder.
4. **Config:** vault/controller/subaccount allocation is mutable and global.
5. **Useful:** EVC batching, controller/collateral discovery, caps/liquidity and callback failure knowledge.
6. **Custody:** plugin/subaccount derived from plugin; not portable to user.
7. **Read:** user SA and each explicit EVC subaccount/controller; no `controllers[0]` shortcut.
8. **Supply:** direct vault/EVC call sequence proven against CDP account semantics.
9. **Withdraw:** direct vault/EVC disable-controller/withdraw sequence when required.
10. **Allowance:** EVC/vault-specific, bounded and decoded; verify caller context.
11. **Simulation:** whole atomic account/EVC batch; controller/HF/cap/liquidity and callback checks.
12. **Post-state:** vault shares, collateral/controller sets, user/subaccount balances and HF.
13. **Eliminate:** Jethos plugin, fixed global subaccounts, leverage V1, fail-open lens behavior.
14. **Tests:** account derivation, all controllers, HF scale, double count, liquidity/cap, exact batch atomicity.

### Uniswap V3 / DEX

1. **Current:** SwapManager selects between incompatible caller-funded and PG-funded plugins.
2. **Solidity:** two plugins, router/quoter/pool interfaces; unsafe zero-minOut/spot paths.
3. **TS:** no supported direct DEX adapter; legacy references only.
4. **Config:** hard-coded fee tier in a direct path and mutable plugin addresses.
5. **Useful:** token direction/decimal knowledge, revert/balance-delta tests.
6. **Custody:** current swaps use pooled assets/allowances.
7. **Read:** quote metadata with source/block/path, never treated as guaranteed execution.
8. **Supply analogue:** build exact-input direct user-SA swap with explicit path/fee/deadline.
9. **Withdraw analogue:** same adapter for reverse path; no hidden automatic pooled unwind.
10. **Allowance:** exact token→router/Permit2 scope with user-visible spender and revoke plan.
11. **Simulation:** exact calldata, minOut, deadline, price impact policy, L2 state freshness.
12. **Post-state:** actual receiver balance delta >= minOut; token spent <= max input.
13. **Eliminate:** SwapManager/plugin selection, max approval, spot quote, `amountOutMin=0`.
14. **Tests:** adversarial quote/MEV/slippage, fee/path, decimals, fee-on-transfer rejection, balance delta.

### Dolomite, InterVault, flash leverage, and legacy references

Dolomite is explicitly rejected by the supported bundle and has no demonstrated V1 need. InterVault implements the forbidden pooled/meta-vault model and was not in the July PoC deployment. Flash-loan leverage is security-sensitive and unnecessary for a supply/withdraw V1. GMX/Pendle/Odos references are not supported active integrations. They receive explicit disposition tasks so their code, configs, tests, and docs cannot silently survive as apparent capabilities.

## Dependency-critical gap order

1. architecture/trust/executable-envelope decisions;
2. canonical frontend/package/backend boundaries;
3. deployment/state/allowance evidence and migration controls;
4. chain/address/asset/ABI registry provenance;
5. signer-free domain/plan extraction;
6. CDP ownership/batch/recovery empirical PoC;
7. exact simulation/decoder/handoff enforcement;
8. Aave direct vertical slice;
9. Morpho/MetaMorpho then Euler/DEX adapters;
10. provider integrations only within confirmed commercial/legal capabilities.
