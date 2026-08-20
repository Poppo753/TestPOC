# Vault Aggregator — Full Project Plan

## What It Is

A **universal DeFi yield aggregator** — a pyramid of smart vaults that accept user assets (ETH, USDC, WBTC) and automatically distribute them across the best lending/yield protocols on each chain, optimizing return without user intervention.

Closest comparable: **Yearn Finance**, but with a more modular architecture designed to become the single access point to all major DeFi protocols.

---

## Current State (Arbitrum, not yet live)

One vault deployed on Arbitrum, not in production use. Architecture today:

```
User deposits ETH
    │
    ▼
LiquidityManager      (calculates shares, mints LP tokens)
    │
    ▼
ProxyGeneral          (sole custodian of all assets)
    │
    ├──► Aave V3       (lending: supply WETH, earn interest)
    ├──► Euler V2      (advanced lending with sub-accounts + leverage)
    └──► Morpho Blue   (optimized peer-to-peer lending)
    │
    ▼
ValueCalculator       (computes total pool value)
    │
    ▼
User withdraws ETH + accumulated yield
```

### The 9 Core Contracts

| Contract | Role |
|---|---|
| Beacon.sol | Central module registry — tracks all implementation addresses |
| ProxyGeneral.sol | Asset custodian — holds everything, enforces rate limits |
| LiquidityManager.sol | User entry point — deposit/withdraw, fee handling, LP token minting |
| ProtocolManager.sol | Orchestrator — routes operations to plugins with function whitelisting |
| TokenManager.sol | Token registry with Chainlink/Pyth oracle adapters |
| ValueCalculator.sol | Computes total pool value for share pricing |
| SwapManager.sol | Routes token swaps (Uniswap V3) with slippage protection |
| ParameterManager.sol | Governance parameters with timelock (1h–7d) |
| EmergencyHandler.sol | Pause, asset recovery, 1-day cooldown between emergencies |

### The "3 Musketeers" Plugin Pattern

Every integrated protocol has 3 components:
- **Registry** — maps token codes to protocol-specific market addresses
- **Plugin** — executes operations (deposit, withdraw, borrow, repay)
- **LensAdapter** — monitors position health (health factor, liquidation risk)

This means: adding a new protocol never touches the core.

---

## Dimension 1 — Multi-Pool (Base Asset Abstraction)

Today everything is WETH-hardcoded. The plan is to make "base asset" configurable so the same codebase runs as:

| Pool | Base Asset | Target user |
|---|---|---|
| ETH Pool | WETH | ETH holders wanting yield |
| USDC Pool | USDC | Stablecoin holders, risk-averse |
| WBTC Pool | WBTC | BTC holders on EVM |

**One refactoring** (replace all "WETH" references with "BASE_ASSET" from Beacon config) unlocks this. With 3 existing plugins to adapt now vs. 13+ plugins in the future — approximately 57% work reduction.

Key architectural choice: **core accepts ERC20 only**. For native ETH pools, a thin `DepositHelper` (~50 lines) wraps ETH↔WETH and calls the core. Same pattern as Uniswap.

---

## Dimension 2 — Multi-Protocol

From 3 protocols to 10+:

| Priority | Protocol | Specialty | Chain |
|---|---|---|---|
| High | Compound V3 | Lending, Aave-like | Arbitrum + Base |
| High | Silo V2 | Isolated lending | Arbitrum |
| Medium | Dolomite | Lending + margin | Arbitrum |
| Medium | Pendle | Yield tokenization (fixed vs variable rate) | Arbitrum |
| Medium | GMX V2 | Perp trading, GM pools | Arbitrum |
| Low | Venus | Compound fork | BNB |
| Low | Moonwell | Compound fork | Base |
| Future | Ethena | USDe staking | Multi-chain |
| Future | Sky Protocol | ex-MakerDAO, sDAI | Multi-chain |

Every plugin written after the base asset abstraction automatically works for ETH pool, USDC pool, and WBTC pool on any chain where the protocol exists.

---

## Dimension 3 — Multi-Chain

| Chain | Available Protocols | Status |
|---|---|---|
| **Arbitrum** | All (primary dev environment) | Active deployment |
| **Base** | Aave + Euler + Morpho + Compound + Moonwell | To be deployed |
| **BNB Chain** | Aave + Venus | To be deployed |

Protocol availability matrix:

| Protocol | Arbitrum | Base | BNB |
|---|---|---|---|
| Aave V3 | ✅ | ✅ | ✅ |
| Euler V2 | ✅ | ✅ | ❌ |
| Morpho Blue | ✅ | ✅ | ❌ |
| Compound V3 | ✅ | ✅ | ❌ |
| Dolomite | ✅ | ❌ | ❌ |
| GMX V2 | ✅ | ❌ | ❌ |
| Pendle | ✅ | ❌ | ❌ |
| Silo V2 | ✅ | ❌ | ❌ |
| Venus | ❌ | ❌ | ✅ |
| Moonwell | ❌ | ✅ | ❌ |

---

## The Vault Pyramid (Final Architecture)

Vaults at higher levels invest in lower-level vaults. Each connection uses a **VaultPlugin** — a plugin that treats another vault exactly like an external protocol.

```
╔══════════════════════════════════════════════════════════╗
║  LEVEL 4 (top)           USDC General                   ║
║                  Single entry point for retail users     ║
╚══════════════════════════════════════════════════════════╝
                              │ invests in
╔══════════════════════════════════════════════════════════╗
║  LEVEL 3      ETH Low/Med/High Risk                     ║
║               USDC Low/Med/High Risk                    ║
║               WBTC Low/Med/High Risk                    ║
╚══════════════════════════════════════════════════════════╝
                              │ invests in
╔══════════════════════════════════════════════════════════╗
║  LEVEL 2      ETH Delta Neutral                         ║
║               USDC Delta Neutral                        ║
║               BTC Delta Neutral                         ║
║               Strategy Vault (various)                  ║
╚══════════════════════════════════════════════════════════╝
                              │ invests in
╔══════════════════════════════════════════════════════════╗
║  LEVEL 1      Lending Vault   │ Stable Vault            ║
║  (base)       No-Risk Vault   │ Degen Vault             ║
╚══════════════════════════════════════════════════════════╝
                              │ deposits in
╔══════════════════════════════════════════════════════════╗
║  EXTERNAL     Aave │ Euler │ Morpho │ GMX │ Pendle      ║
║  PROTOCOLS    Compound │ Dolomite │ Silo │ Ethena │ ...  ║
╚══════════════════════════════════════════════════════════╝
```

---

## Build Sequence (Solo Developer)

```
[Now]
  PHASE 0 — Base Asset Abstraction
     Adapt 3 existing plugins (small effort now)
     instead of 13+ future plugins (large effort later)
       │
       ▼
  PHASE 1 — 3 Pools on Arbitrum (ETH + USDC + WBTC)
     Validate architecture works for all pool types
       │
       ▼
  PHASE 2 — Multi-chain config layer
     Parameterized deploy scripts per chain
       │
       ├──► PHASE 3a — New plugins (Compound, Silo, Dolomite)
       ├──► PHASE 3b — Chain-specific (Venus for BNB, Moonwell for Base)
       └──► PHASE 3c — Complex plugins (Pendle, GMX V2, Ethena, Sky)
                               │
                               ▼
                       PHASE 4 — Vault Pyramid
                       (after 2–3 base vaults working)
```

Phases 3a/3b/3c are independent — can be done in any order.

---

## Technical Challenges

### Decimals
- WETH: 18 decimals | USDC: 6 | USDT: 6 | WBTC: 8
- Formula `value = (balance × price) / 10^decimals` is already parametrized — no change needed
- LP tokens always 18 decimals; first USDC deposit scaling factor to evaluate

### USDT Compatibility
- `transfer()` doesn't return bool → requires SafeERC20 (`safeTransfer`)
- `approve()` requires reset to 0 → requires `forceApprove`
- OpenZeppelin SafeERC20 handles both

### Oracle Per Pool Type
- All prices denominated in USD uniformly (Chainlink feeds)
- ETH/USD: `0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612`
- USDC/USD: `0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3`
- WBTC/USD: `0xd0C7101eACbB49F3deCcCc166d238410D6D46d57`

### Morpho Blue — USDC as Collateral
USDC is typically the loan token on Morpho, not the collateral. For USDC pool: use Morpho vault plugins or loan-side strategy. Requires market research via GraphQL API.

---

## Key Principle

> Perfect Arbitrum first. Abstract the base asset with 3 plugins (small work). Every new plugin written afterwards works automatically for ETH, USDC, and WBTC pools. Base and BNB are "deploy when ready".
