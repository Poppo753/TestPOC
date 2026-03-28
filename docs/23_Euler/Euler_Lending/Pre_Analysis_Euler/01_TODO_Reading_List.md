# ✅ TODO - Lista Lettura Documentazione Euler V2

**Data creazione:** 29 Novembre 2025  
**Obiettivo:** Leggere ogni link, estrarre informazioni rilevanti, creare documenti dettagliati

---

## 📋 Checklist Documenti da Creare

### Documento 02: EVK Interacting with Vaults
- [x] Leggere: https://docs.euler.finance/developers/evk/
- [x] Leggere: https://docs.euler.finance/developers/evk/interacting-with-vaults
- [x] Estrarre: Funzioni `deposit`, `withdraw`, `borrow`, `repay`
- [x] Estrarre: Utilizzo Permit2 per gasless approvals
- [x] Estrarre: Batching operations
- [x] Estrarre: Flash liquidity
- [x] Estrarre: Exchange rate e shares
- [x] Creare: `02_EVK_Interacting_Vaults.md`

### Documento 03: EVC Integration Guide
- [x] Leggere: https://docs.euler.finance/developers/evc/
- [x] Leggere: https://docs.euler.finance/developers/evc/integration-guide
- [x] Estrarre: Batching operations con `BatchItem`
- [x] Estrarre: Sub-accounts (256 per wallet)
- [x] Estrarre: Derivazione indirizzi sub-account (XOR)
- [x] Estrarre: Operator delegation
- [x] Estrarre: Liquidations con `controlCollateral`
- [x] Estrarre: Simulating transactions con `batchSimulation`
- [x] Estrarre: Permits (gasless transactions)
- [x] Estrarre: Emergency modes (Lockdown, Permit Disabled)
- [x] Creare: `03_EVC_Integration_Guide.md`

### Documento 04: Swaps e Leverage
- [x] Leggere: https://docs.euler.finance/developers/periphery/swaps
- [x] Estrarre: Open Leverage flow (borrow → swap → deposit)
- [x] Estrarre: Swap Collateral flow
- [x] Estrarre: Swap-to-Repay flow
- [x] Estrarre: Contratti `Swapper` e `SwapVerifier`
- [x] Estrarre: Swapping modes (Exact Input, Exact Output, Target Debt)
- [x] Estrarre: Security best practices
- [x] Creare: `04_Swaps_Leverage.md`

### Documento 05: Lens Contracts
- [x] Leggere: https://docs.euler.finance/developers/data-querying/
- [x] Leggere: https://docs.euler.finance/developers/data-querying/lens-contracts
- [x] Leggere: https://docs.euler.finance/developers/data-querying/using-lens-contracts
- [x] Estrarre: AccountLens - `getAccountInfo`, `getAccountEnabledVaultsInfo`
- [x] Estrarre: VaultLens - `getVaultInfoFull`
- [x] Estrarre: UtilsLens - `getAPYs`, `timeToLiquidation`
- [x] Estrarre: Health Score calculation
- [x] Estrarre: Collateral values (borrowing, liquidation, raw)
- [x] Estrarre: LTVInfo struct
- [x] Creare: `05_Lens_Contracts.md`

### Documento 06: Contract Addresses Arbitrum
- [x] Recuperare da: https://github.com/euler-xyz/euler-interfaces/tree/master/addresses/42161
- [x] Estrarre: CoreAddresses.json
- [x] Estrarre: LensAddresses.json
- [x] Estrarre: PeripheryAddresses.json
- [x] Formattare indirizzi in tabella
- [x] Creare: `06_Contract_Addresses_Arbitrum.md`

### Documento 07: Liquidations
- [x] Leggere: https://docs.euler.finance/concepts/risk/liquidations
- [x] Estrarre: Come funzionano le liquidazioni
- [x] Estrarre: Liquidation parameters (max discount, cool-off period)
- [x] Estrarre: Bad debt socialization
- [x] Estrarre: Liquidation protection
- [x] Estrarre: Best practices per evitare liquidazioni
- [x] Creare: `07_Liquidations.md`

---

## 📊 Stato Avanzamento

| # | Documento | Stato | Note |
|---|-----------|-------|------|
| 00 | `00_Links_Index.md` | ✅ Completato | Indice link creato |
| 01 | `01_TODO_Reading_List.md` | ✅ Completato | Questo file |
| 02 | `02_EVK_Interacting_Vaults.md` | ✅ Completato | Deposit/Withdraw/Borrow/Repay |
| 03 | `03_EVC_Integration_Guide.md` | ✅ Completato | Batching/Sub-accounts/Operators |
| 04 | `04_Swaps_Leverage.md` | ✅ Completato | Leverage/Swapper/SwapVerifier |
| 05 | `05_Lens_Contracts.md` | ✅ Completato | Health monitoring/APY |
| 06 | `06_Contract_Addresses_Arbitrum.md` | ✅ Completato | Indirizzi Arbitrum |
| 07 | `07_Liquidations.md` | ✅ Completato | Liquidations/Protection |

---

## 🎯 Prossimi Passi

Dopo aver completato la documentazione:

1. **Identificare i Vault specifici** per ETH, USDC, USDT, WBTC su Arbitrum
2. **Creare script di test** per interagire con Euler
3. **Integrare nel ProtocolManager** esistente
4. **Testare su fork Arbitrum** prima del deploy

---

## 📝 Note

- Tutti i documenti sono in italiano
- I termini tecnici sono mantenuti in inglese
- Ogni documento include esempi di codice Solidity/TypeScript
- Gli indirizzi sono specifici per Arbitrum (Chain ID: 42161)
