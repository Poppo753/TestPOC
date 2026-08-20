# Multi-chain gap

## Current reality

Arbitrum is a global default throughout the repository. At least 84 non-document source files mention Arbitrum or `42161`. Hard-coded/copy-pasted assumptions appear in Hardhat config, deployment manifests, frontend config, readers, CSP/RPC allowlists, diagnostics, Chainlink setup, content, scripts, tests and legacy assets.

The existing `ExecutionPlan.chainId` and manifest schema are useful starts, but identity is frequently a string token code or a single address. There is no evidence that a CDP Smart Account exists on any chain or that it has the same address across chains.

## Required identity model

| Object | Required key | Forbidden shortcut |
|---|---|---|
| chain account | `(userId, chainId, accountKind, address)` | one global wallet/account address |
| asset | `(chainId, tokenAddress)` plus issuer/instrument metadata | `USDC`, `EURe`, symbol-only identity |
| protocol deployment | `(chainId, protocol, version, contractAddress, codeHash)` | one protocol address globally |
| market/vault | chain + protocol-specific full identifier | friendly name alone |
| balance/position | chain + account + asset/market + observation block | net amount without source/chain |
| transaction plan | chain + account + registry version + validity | implicit current network |
| provider account | provider + legal entity/user + supported funding rail/chain | equating it to a wallet balance |

## Chain-specific validation matrix

| Topic | Arbitrum | Base | Polygon | Gate |
|---|---|---|---|---|
| CDP Smart Account ownership/address | unproven | unproven | unproven | separate empirical CDP-003* task per chain |
| initial DeFi adapters | current deployments/read knowledge | no repo integration | no repo integration | V1 starts with approved Arbitrum Aave scope only |
| Chainlink/L2 safety | missing sequencer check finding | must verify feed/sequencer model | verify chain/feed model | registry + pricing tests |
| Monerium/EURe | target hypothesis | unknown | unknown | external provider confirmation |
| Reap funding | target mentions Base/Polygon candidates | unconfirmed | unconfirmed | REAP-004/041 + CHAIN-012 |
| 21X | not target trading chain | not target trading chain | supplied target assumes 21X | all X21 V2 gates unresolved |
| gas/paymaster | unproven | unproven | unproven | CDP/paymaster task per chain |
| RPC fallback/freshness | one public RPC hard-coded in web | absent | absent | CHAIN-021 |

## Breakpoints to remove

1. `jethos-web` hard-coded `42161` and one deployment object;
2. duplicated manifest/data/JS/TS addresses with no generation or live code parity;
3. browser CSP allowing only current RPC assumptions;
4. root Hardhat/default manifest fallback to Arbitrum/WETH;
5. contract registries keyed by strings/symbols instead of chain/address/full market ID;
6. frontend aggregation that can erase issuer, legal instrument, token contract or chain;
7. signer/session state that assumes one current network;
8. simulation without recorded chain/block/RPC/registry version;
9. product flows that imply an automatic Jethos bridge;
10. release manifest lacking Git SHA and financial-registry hash.

## Bridging boundary

V1 has no implicit Jethos bridge. Cross-chain movement is either:

- a separately reviewed, user-authorized direct bridge plan with explicit provider, fees, destination token/address and recovery; or
- a provider-owned funding rail confirmed in writing and represented as provider state.

It never passes through a Jethos treasury, pooled account, backend signer or hidden intermediate asset. Economic aggregation in the UI preserves chain/token/issuer drill-down.

## Rollout recommendation

Build the type model and registry for all three chains first, but enable one proven action on one chain. Add a chain only when account ownership/recovery, deployment/code provenance, asset metadata, simulation, gas, provider scope and exit behavior pass independently. “Same code deployed” is not evidence of equivalent chain behavior.
