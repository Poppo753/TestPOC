# Repository reality

## Baseline and scope

The audit inspected branch `dev-26` at commit `51905af`. The worktree was clean. There was no `AGENTS.md`. No existing user changes were overwritten. Only audit documentation and the revised checklist are intended as permanent changes.

The repository is a mixed-generation monorepo rather than the greenfield TypeScript application implied by the target pack.

| Area | Observed scale | Current purpose |
|---|---:|---|
| `contracts/` | 91 Solidity files | pooled custody, accounting, orchestration, pricing, registries, protocol plugins |
| all first-party Solidity outside dependencies | 118 files | contracts plus test/support code |
| `scripts/` | 385 TS + 3 JS | deployment, configuration, admin, diagnostics, plan framework, automation |
| `test/` | 170 files; 153 TS | unit, integration, fork, e2e, security, invariants, scripts |
| `jethos-web/src/` | 61 TS + 67 Astro | current static website and vault application |
| `dapp-new/` | 181 files | legacy/static source and parity input |
| first-party Markdown | 621 files | current, legacy, generated, duplicated, and audit documentation |

Generated directories (`artifacts`, `cache`, `out-foundry`, `typechain-types`) were used as evidence but are not independent architecture.

## Runtime surfaces

### Smart contracts

Hardhat compiles Solidity 0.8.27 with optimizer and `viaIR`. The default network assumptions target Arbitrum (`42161`). Foundry is configured as a parity/property-test sidecar, but `forge` was not installed in this audit environment.

The current contracts are deployed as separate stateful modules registered through `Beacon`. `Beacon` has implementation history/freeze controls, but it is not an EIP-1967/beacon proxy and no delegatecall path exists. Changing a registry address switches callers to a different state container; it does not upgrade or migrate the old state.

### Frontends

`jethos-web` is an Astro 7 static-output site. `/app` loads a legacy application controller and browser-side Ethers code. It has no API routes, database, session store, or server-side financial execution. `dapp-new` is an older static tree used by parity/sync scripts. Its expected `assets/brand` input is missing, so the aggregate verification command stops before the otherwise healthy Astro checks.

The browser flow uses `window.ethereum`/EIP-1193 and an EOA-style signer. It assumes one hard-coded Arbitrum deployment and directly calls Jethos vault contracts. There is no Coinbase CDP SDK, ERC-4337 UserOperation, session-key permission model, paymaster, Sumsub, Monerium, Reap, or 21X integration in the application code.

### Backend and persistence

No product backend, API route tree, queue, relational database, provider webhook receiver, or identity state store was found. Node/Hardhat scripts are operator tooling, not an application backend. The target provider connectors therefore cannot be described as an extraction from an existing service; they introduce a new control-plane component.

### Operational TypeScript

`scripts/framework/` already contains:

- serializable signer-independent `PlannedCall` and `ExecutionPlan` types;
- Ethers `Interface` calldata construction;
- chain/target/dependency validation;
- encode-only and snapshot simulation modes;
- a separate runtime signer/executor;
- a chain-aware manifest model.

This is the strongest reusable transaction-planning IP. It is currently coupled to Node/Hardhat and a stale ABI. `scripts/framework/abis.ts` and `scripts/automation/planner.ts` refer to `ProtocolManager.deposit/withdraw` and old borrow/repay arity; the current contract exposes `supplyCollateral/withdrawCollateral` and pair-aware methods.

`scripts/automation/` contains observer, risk, strategy, planner, store, direct-executor and Safe proposal paths. The committed config is observe-only and execution-disabled, but the code is capable of runtime-signer execution. Fixed target basis points and portfolio “recommendations” are incompatible with the target user-decision boundary unless converted to explicit user configuration and notification-only evaluation.

## Protocols actually present

| Protocol/primitive | Current implementation | Target relevance |
|---|---|---|
| Aave V3 | plugin, registry, lens, leverage/flash callbacks | direct supply/withdraw V1; port read/risk logic |
| Morpho Blue | plugin, registry, lens, pair-based positions | direct market calls; preserve market/rounding semantics |
| MetaMorpho/Morpho Vault | separate plugin and lens | optional direct vault deposit/redeem; do not confuse with Morpho Blue |
| Euler V2/EVC | plugin, registry, large lens, subaccounts | separate empirical PoC; direct calls may require Smart Account/EVC batching |
| Uniswap V3 | manager plus two incompatible plugins | add omitted DEX TS adapter; no spot quote or zero-minOut path |
| Dolomite | unfinished plugin and explicitly rejected bundle | remove from V1 or require a separate decision/gate |
| InterVault/meta-vault | registry, lens, plugin, tests/scripts | contradicts no-pooling V1; removal/migration disposition required |
| flash-loan leverage | service plus plugin callbacks | out of V1; migration/security/legal gated |
| GMX/Pendle/Odos | legacy/scratch/docs references | no supported current bundle; classify/remove references explicitly |

## Deployment evidence

Two repository deployment families were inspected:

- `deployments/mainnet-latest.json`: April 2026 Arbitrum deployment. Bytecode remains at recorded addresses; the observed pool state was zero.
- `scripts/manifests/arbitrum-usdc-poc-1.json`: July 2026 Arbitrum USDC PoC with 22 recorded contracts and transaction hashes.

An exploratory read-only `latest` inspection on 2026-08-17 showed:

- 21 owner-bearing components owned by `0x8390e98483a9b39265428c8610371134B5d11C3F`;
- deposits and withdrawals enabled and the system unpaused;
- `ProxyGeneral` holding 3,100,000 raw USDC units (3.1 USDC);
- total LPT supply 3,100,000 raw units and the sole positive LPT holder equal to the same owner/deployer EOA;
- Aave, Euler, Morpho Blue, and Morpho Vault reported active but net position value zero.

The observation block, RPC identity and literal diagnostic command were not archived. These values are therefore non-migration-grade FACTs about that transient observation, not a reproducible current-state baseline. They support the inference that the remaining capital was operator test capital, not the conclusion that there are no users. `MIG-001` must rerun the state/code/owner/holder/allowance query at one finalized block through two named RPC sources before any mutation; event range, historical deployment coverage and off-repository records must also be bounded.

## Bytecode pressure

Artifact deployed-bytecode sizes show that Solidity complexity is already at a practical limit:

| Contract | Bytes | Margin to 24,576 |
|---|---:|---:|
| `EulerV2Plugin` | 24,567 | 9 |
| `SwapManager` | 24,430 | 146 |
| `MorphoPlugin` | 22,066 | 2,510 |
| `LiquidityManager` | 21,937 | 2,639 |
| `EulerLensAdapter` | 18,844 | 5,732 |
| `AaveV3Plugin` | 18,318 | 6,258 |

Artifact bytecode differs from some live deployments, confirming that current source cannot be assumed to describe every deployed instance.

## Build/test reality

- Root compile and script typecheck pass.
- The root Windows `test:unit` script passes a literal glob to Hardhat and fails before executing tests.
- An exploratory selected cross-section ran 392 Hardhat cases: 371 passed, 21 failed. Failures were caused by removed emergency APIs, stale ProtocolManager selectors/arity, stale revert-string expectations, and automation planner drift. The literal nine-file command/suite list was not archived, so the count is diagnostic only and must not be treated as reproducible CI evidence.
- Operational scripts ran 40 cases: 39 passed; the protocol lifecycle reverted because its generated selector is obsolete.
- `jethos-web`: isolated typecheck (179 files), lint, static build (33 pages), release validation, performance budget, and 50 unit tests pass.
- `jethos-web` formatting fails across 189 files. The aggregate `verify` command fails earlier because `dapp-new/assets/brand` is absent.
- Foundry tests were not executed because `forge` was unavailable.

## Documentation drift

Old deployment, withdrawal, architecture, audit, security, and site documents coexist with newer source. Documentation is evidence of intent, not current behavior. A future documentation cleanup must retain migration and security history, declare canonical documents, and only then archive duplicates; broad deletion is not justified during this audit.
