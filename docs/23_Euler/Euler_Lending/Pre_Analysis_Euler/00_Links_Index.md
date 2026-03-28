# 📚 Euler V2 - Indice Completo dei Link della Documentazione

**Data creazione:** 29 Novembre 2025  
**Network target:** Arbitrum (Chain ID: 42161)  
**Obiettivo:** Depositare token (ETH, USDC, USDT, WBTC), gestire posizioni con leva, monitorare health factor

---

## 🏠 Documentazione Principale

| Link | Descrizione |
|------|-------------|
| https://docs.euler.finance/developers/ | Developer Guide - Pagina principale |
| https://docs.euler.finance/developers/getting-started | Getting Started - Setup ambiente |
| https://docs.euler.finance/concepts/ | Concetti core di Euler V2 |

---

## 🔗 EVC (Ethereum Vault Connector)

L'EVC è il cuore di Euler V2 - punto di ingresso raccomandato per tutte le interazioni avanzate.

| Link | Descrizione | Documento |
|------|-------------|-----------|
| https://docs.euler.finance/developers/evc/ | **EVC Overview** - Batching, sub-accounts, operators, deferred checks | `03_EVC_Integration_Guide.md` |
| https://docs.euler.finance/developers/evc/integration-guide | **Integration Guide** - Guida completa: batching, sub-accounts, deposit/borrow, liquidations | `03_EVC_Integration_Guide.md` |
| https://docs.euler.finance/developers/evc/evc-utils | **EVC Utils** - `EVCUtil.sol` per autenticazione, modifiers | - |
| https://docs.euler.finance/developers/evc/security | **Security Considerations** - Lockdown Mode, Permit Disabled Mode | - |
| https://evc.wtf/ | **EVC Website** - Sito dedicato all'EVC | - |
| https://github.com/euler-xyz/ethereum-vault-connector/blob/master/docs/whitepaper.md | **EVC Whitepaper** - Documentazione tecnica completa | - |

---

## 🏦 EVK (Euler Vault Kit)

I vault sono contratti ERC-4626 con funzionalità di borrowing.

| Link | Descrizione | Documento |
|------|-------------|-----------|
| https://docs.euler.finance/developers/evk/ | **EVK Overview** - Architettura vault, exchange rate, shares, LTV, liquidazioni | `02_EVK_Interacting_Vaults.md` |
| https://docs.euler.finance/developers/evk/interacting-with-vaults | ⭐ **Interacting with Vaults** - `deposit`, `withdraw`, `borrow`, `repay`, Permit2, batching | `02_EVK_Interacting_Vaults.md` |
| https://docs.euler.finance/developers/evk/creating-managing-vaults | Creating & Managing Vaults - Deployment e gestione vault | - |
| https://docs.euler.finance/developers/evk/hooks-custom-logic | Hooks & Custom Logic - Hook system per access control | - |
| https://github.com/euler-xyz/euler-vault-kit/blob/master/docs/whitepaper.md | **EVK Whitepaper** - Documentazione tecnica completa | - |

---

## 💱 Swaps e Leverage

Per aprire posizioni con leva (borrow → swap → deposit).

| Link | Descrizione | Documento |
|------|-------------|-----------|
| https://docs.euler.finance/developers/periphery/swaps | ⭐ **Swaps** - Open leverage, swap collateral, swap-to-repay, Swapper e SwapVerifier | `04_Swaps_Leverage.md` |
| https://docs.euler.finance/developers/euler-swap/ | EulerSwap Overview - AMM integrato | - |
| https://docs.euler.finance/developers/euler-swap/how-it-works | How EulerSwap Works - Meccaniche tecniche | - |

---

## 📊 Data Querying / Lens Contracts

Per monitorare health factor, APY, time to liquidation.

| Link | Descrizione | Documento |
|------|-------------|-----------|
| https://docs.euler.finance/developers/data-querying/ | Data Querying Overview - Lens contracts, event logs, subgraph | `05_Lens_Contracts.md` |
| https://docs.euler.finance/developers/data-querying/lens-contracts | **Lens Contracts** - AccountLens, VaultLens, OracleLens, IRMLens, UtilsLens | `05_Lens_Contracts.md` |
| https://docs.euler.finance/developers/data-querying/using-lens-contracts | ⭐ **Using Lens Contracts** - `getAccountInfo`, health score, collateral values, `timeToLiquidation`, APYs | `05_Lens_Contracts.md` |
| https://docs.euler.finance/developers/data-querying/pyth-oracles | Working with Pyth Oracles - Pull-based oracles, price updates | - |
| https://docs.euler.finance/developers/data-querying/subgraphs | Subgraphs - GraphQL endpoints per tutte le network | - |
| https://docs.euler.finance/developers/data-querying/off-chain-prices | Off-Chain Prices - API endpoint `https://app.euler.finance/api/v1/price` | - |

---

## ⚠️ Risk Management / Liquidazioni

| Link | Descrizione | Documento |
|------|-------------|-----------|
| https://docs.euler.finance/concepts/risk/liquidations | ⭐ **Liquidations** - Come funzionano, parametri, protezione, best practices | `07_Liquidations.md` |
| https://docs.euler.finance/concepts/risk/vault-types | Vault Types - Tipi di vault e profili di rischio | - |
| https://docs.euler.finance/concepts/risk/risk-curators | Risk Curators - Ruolo dei curatori del rischio | - |

---

## 📍 Contract Addresses

| Link | Descrizione | Documento |
|------|-------------|-----------|
| https://docs.euler.finance/developers/contract-addresses | Contract Addresses - Indirizzi per tutte le network | `06_Contract_Addresses_Arbitrum.md` |

---

## 📦 Repository GitHub Ufficiali

### Repository Principali

| Repository | Descrizione |
|------------|-------------|
| https://github.com/euler-xyz | **Euler Organization** - Organizzazione GitHub principale |
| https://github.com/euler-xyz/ethereum-vault-connector | **EVC Repository** - Ethereum Vault Connector source code |
| https://github.com/euler-xyz/euler-vault-kit | **EVK Repository** - Euler Vault Kit source code |
| https://github.com/euler-xyz/euler-price-oracle | **Euler Price Oracle (EPO)** - Oracle adapters e routers |
| https://github.com/euler-xyz/euler-earn | **Euler Earn (EE)** - Meta-vault per yield aggregation |
| https://github.com/euler-xyz/evk-periphery | **EVK Periphery** - Lens contracts, Swapper, SwapVerifier |

### Contratti Lens (Source Code)

| Repository | Descrizione |
|------------|-------------|
| https://github.com/euler-xyz/evk-periphery/tree/master/src/Lens | Lens Contracts Source - Codice sorgente |
| https://github.com/euler-xyz/evk-periphery/blob/master/src/Lens/LensTypes.sol | LensTypes.sol - Definizioni struct e tipi |
| https://github.com/euler-xyz/evk-periphery/blob/master/src/Lens/AccountLens.sol | AccountLens.sol - Account data aggregation |
| https://github.com/euler-xyz/evk-periphery/blob/master/src/Lens/VaultLens.sol | VaultLens.sol - Vault data aggregation |
| https://github.com/euler-xyz/evk-periphery/blob/master/src/Lens/UtilsLens.sol | UtilsLens.sol - APY, time to liquidation |

### Interfacce e ABI

| Repository | Descrizione |
|------------|-------------|
| https://github.com/euler-xyz/euler-interfaces | **euler-interfaces** - ABI, indirizzi e interfacce Solidity |
| https://github.com/euler-xyz/euler-interfaces/tree/master/addresses/42161 | **Indirizzi Arbitrum** - Tutti i contratti su Arbitrum |

### Altri Repository Utili

| Repository | Descrizione |
|------------|-------------|
| https://github.com/euler-xyz/liquidation-bot-v2 | **Liquidation Bot** - Bot open-source per liquidazioni |
| https://github.com/euler-xyz/reward-streams | **Reward Streams** - Sistema di reward distribution |
| https://github.com/euler-xyz/euler-subgraph | **Euler Subgraphs** - Subgraph per data indexing |

---

## 🌐 Apps e Dashboard

| Link | Descrizione |
|------|-------------|
| https://app.euler.finance/ | **Euler App** - Interfaccia principale |
| https://www.explorer.euler.finance/ | **Vault Explorer** - Esplora tutti i vault |
| https://oracles.euler.finance/1 | **Oracle Dashboard** - Dashboard oracoli |
| https://create.euler.finance/ | **Vault Creator Tool** - UI per creare vault senza codice |

---

## 📝 Riepilogo per Funzionalità

### ✅ Depositare Token (ETH, USDC, USDT, WBTC)
- **Doc principale:** https://docs.euler.finance/developers/evk/interacting-with-vaults#depositing-assets
- **Documento locale:** `02_EVK_Interacting_Vaults.md`

### ✅ Posizioni con Leva (Leveraged Positions)
- **Doc principale:** https://docs.euler.finance/developers/periphery/swaps#common-swap-flows (Open Leverage flow)
- **Flash liquidity:** https://docs.euler.finance/developers/evk/interacting-with-vaults#flash-liquidity
- **Documento locale:** `04_Swaps_Leverage.md`

### ✅ Withdraware dai Vault
- **Doc principale:** https://docs.euler.finance/developers/evk/interacting-with-vaults#withdrawing-assets
- **Swap-to-repay:** https://docs.euler.finance/developers/periphery/swaps
- **Documento locale:** `02_EVK_Interacting_Vaults.md`

### ✅ Monitorare Health Factor / Liquidation
- **Doc principale:** https://docs.euler.finance/developers/data-querying/using-lens-contracts#position-health-collateral-value-and-health-score
- **Liquidations:** https://docs.euler.finance/concepts/risk/liquidations
- **Funzione chiave:** `AccountLens.getAccountInfo()` → `liquidityInfo.timeToLiquidation`, `healthScore`
- **Documento locale:** `05_Lens_Contracts.md`, `07_Liquidations.md`

---

## 📋 Documenti Locali Creati

| # | Documento | Contenuto |
|---|-----------|-----------|
| 00 | `00_Links_Index.md` | Questo file - Indice di tutti i link |
| 01 | `01_TODO_Reading_List.md` | Checklist TODO degli step da completare |
| 02 | `02_EVK_Interacting_Vaults.md` | Deposit, withdraw, borrow, repay - Dettagli completi |
| 03 | `03_EVC_Integration_Guide.md` | Batching, sub-accounts, operators, simulazioni |
| 04 | `04_Swaps_Leverage.md` | Posizioni con leva, Swapper, SwapVerifier |
| 05 | `05_Lens_Contracts.md` | Health monitoring, APY, time to liquidation |
| 06 | `06_Contract_Addresses_Arbitrum.md` | Tutti gli indirizzi per Arbitrum |
| 07 | `07_Liquidations.md` | Come funzionano le liquidazioni, protezione |
