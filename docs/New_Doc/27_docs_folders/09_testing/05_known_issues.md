# 9.5 Known Issues

Tutti i test failure sono **pre-esistenti** e non introdotti dal refactoring Phase 0 (Base Asset Abstraction).

## Beacon.test.ts — 2 Failing

**Causa:** Il contratto Beacon non implementa il check `isContract()` per validare gli indirizzi delle implementazioni. Due test che verificano questo comportamento falliscono.

**Fix potenziale:** Aggiungere `Address.isContract()` check in `updateImplementation()`.

---

## AaveV3Plugin.leverage.test.ts — 3 Failing

**Causa:** Il sistema FlashLoan leverage non applica correttamente il ratio. I test aspettano leverage ratio ≥ 1.5x, ma il ratio effettivo è ~1.0x.

**Test falliti:**
- Leverage con WETH collateral
- Leverage con target health factor
- Leverage con amount massimo

**Correlato:** Stessa root cause dei 2 failing in FlashLoanService.e2e.test.ts.

---

## EulerV2Plugin.leverage.e2e.test.ts — 1 Failing

**Causa:** ERC20 allowance error in `addCollateral()` durante una sequenza di apertura posizione leverage. L'EVC (Euler Vault Controller) richiede una approval specifica che non viene gestita correttamente.

**Errore:** `ERC20: insufficient allowance`

---

## EulerV2Plugin.closePositionsForWeth.test.ts — 3 Failing

**Causa (2 test):** Tentativo di creare posizioni duplicate in EulerRegistry — una coppia collateral-borrow identica non può essere registrata due volte.

**Causa (1 test):** Arithmetic overflow durante il calcolo del valore posizione per condizioni edge case.

---

## EulerV2Plugin.phase3.test.ts — 1 Failing

**Causa:** Il test tenta di aprire una posizione leverage ma il ProxyGeneral non ha sufficiente WETH per il collateral richiesto. Il test usa fondi reali su fork e il balance è insufficiente.

---

## EulerV2Plugin.realfunds.test.ts — 13 Pending

**Causa:** Tutti i test sono skip (`it.skip()`) perché richiedono setup specifici con fondi reali che non sono disponibili nell'ambiente di test standard.

---

## FlashLoanService.e2e.test.ts — 2 Failing

**Causa:** Come AaveV3Plugin.leverage — il leverage ratio effettivo è ~1.0x anziché ≥ 1.5x. Il FlashLoan viene eseguito ma il leverage non viene applicato correttamente ai collateral.

---

## FlashLoanPlugin.e2e.test.ts — 11 Failing, 3 Pending

**Causa:** Il contratto `FlashLoanPlugin` non esiste come artifact compilato. Il `getContractFactory("FlashLoanPlugin")` fallisce con `MODULE_NOT_FOUND`. Il plugin è stato rimosso o rinominato ma i test non sono stati aggiornati.

---

## GMXv2Plugin.simple.test.ts — 15 Failing

**Causa:** GMX V2 integration **non è implementata**. Confermato dall'utente: "dolomite e gmx è corretto che non funzionino! non sono da testare in quanto non implementati."

---

## MigrationScripts.test.ts — 17 Pending

**Causa:** Test pending per script di migrazione che non sono ancora stati implementati o finalizzati.

---

## Troubleshooting Comune

### Token prices a zero nei fork tests
**Sintomo:** `getTotalValue()` restituisce 0 anche con posizioni aperte.
**Causa:** `MockTokenManager.setTokenPrice()` non è stato chiamato per tutti i token coinvolti.
**Fix:** Aggiungere `setTokenPrice("USDC", ethers.parseUnits("1", 8))` e simili per ogni token usato.

### "BASE_ASSET not registered" o address(0)
**Sintomo:** Contratti falliscono all'inizializzazione o restituiscono address(0) per il base asset.
**Causa:** Manca la registrazione nel Beacon.
**Fix:** `await beacon.setImplementation("BASE_ASSET", WETH_ADDRESS)`

### "Ownable: caller is not the owner" in Euler leverage tests
**Sintomo:** `createPositionOnDemand` fallisce con errore di ownership.
**Causa:** Il plugin non è owner dell'EulerRegistry.
**Fix:** `await eulerRegistry.transferOwnership(await plugin.getAddress())`

### MORPHO address mismatch
**Sintomo:** Morpho fork tests falliscono con "invalid address" o contratti vuoti.
**Causa:** Ethereum mainnet Morpho address (`0xBBBBBbbBBb...`) usato invece di Arbitrum (`0x6c247b1F6182318877311737BaC0844bAa518F5e`).
**Fix:** Usare l'address Arbitrum corretto.

### Terminal output encoding (Windows)
**Sintomo:** Emoji e caratteri Unicode non leggibili nell'output dei test.
**Fix:** Usare `Get-Content ... -Encoding UTF8` o redirigere con `Out-File` e verificare encoding.
