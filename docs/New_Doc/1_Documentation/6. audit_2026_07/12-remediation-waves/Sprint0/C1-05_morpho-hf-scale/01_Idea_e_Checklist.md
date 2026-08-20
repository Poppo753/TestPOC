# C1-05 — Morpho HF scale bug — IDEA + DETTAGLIO + CHECKLIST

> Fix piccolo e chiuso (2 righe identiche) → pipeline compattata in un unico documento.
> Finding: PLG-005 / NEW-007 (formula HF), ADP-039 (virtual shares, secondario).
> Severity: CRITICAL (rende `openLeverageAtomic` inutilizzabile su Morpho).

## 1. Idea
La formula dell'health factor Morpho ha un `* WAD` di troppo al denominatore, in 2 punti identici:
- `contracts/plugins/MorphoPlugin.sol:1020` (`_computeHealthFactor`)
- `contracts/adapters/MorphoLensAdapter.sol:178` (`_computeMarketHF`)

```solidity
return (collateralValue * params.lltv) / (debtAssets * WAD);   // ❌ SBAGLIATO
return (collateralValue * params.lltv) / debtAssets;           // ✅ CORRETTO
```

## 2. Dettaglio / prova matematica
HF deve essere in scala WAD (1e18 = 1.0). Con:
- `collateralValue` = collateral·oraclePrice/ORACLE_PRICE_SCALE → unità del loan token
- `params.lltv` = già in scala WAD (es. 0.8e18 = 80%)
- `debtAssets` = debito in unità del loan token

Formula corretta: `(collateralValue · lltv) / debtAssets` = `(loanUnits · 1e18) / loanUnits` = **1e18 scala**. ✅
Formula bugata: divide ancora per `WAD` (1e18) → risultato in scala **raw** (HF ~1 invece di 1e18).
Conseguenza: `MIN_HEALTH_FACTOR = 1.05e18` non è mai raggiunto → ogni apertura leva Morpho reverta con `HealthFactorTooLow`. Il monitoring vede posizioni sane come "liquidazione imminente".

Il commento a `MorphoPlugin.sol:1018-1019` descrive già la formula corretta (`collateralValue * lltv / debtAssets`): è solo il codice a divergere. Prova a livello formula già in `test/foundry/unit/HFScaleMath.t.sol` (dimostra buggy vs corretto).

**ADP-039 (secondario, NON in questo fix):** `debtAssets` è calcolato con round-up manuale senza i virtual shares/assets di Morpho (VIRTUAL_SHARES=1e6, VIRTUAL_ASSETS=1). Differenza trascurabile per mercati non vuoti; l'import di `SharesMathLib.toAssetsUp` è un raffinamento di accuratezza rimandato (aggiunge bytecode). Il blocker è il `* WAD`, non questo.

## 3. Revisione (rilettura)
- ✅ I 2 punti sono identici e isolati (nessun altro `* WAD` in denominatore HF: grep).
- ✅ Il fix non cambia scala di altri ritorni: entrambi i metodi ritornano HF, consumato da confronti con `MIN_HEALTH_FACTOR` (WAD) → dopo il fix il confronto è corretto.
- ⚠️ Breaking di scala per chi leggeva il valore bugato: nessun consumatore si affidava al valore sbagliato (era sempre ~1 → sempre revert), quindi il fix non rompe logica esistente, la sblocca.
- Test masking: `test/integration/morpho/MorphoPlugin.fork.test.ts` passa `minHealthFactor: 1` (adattato al bug) → va portato a scala WAD (`ethers.parseUnits("1.05", 18)`), altrimenti dopo il fix non testa nulla di sensato. (Hardhat/fork, non eseguibile qui.)

## 4. Checklist implementazione
- [x] **1** — `MorphoPlugin.sol:1020`: rimosso `* WAD`. Ora `/ debtAssets`.
- [x] **2** — `MorphoLensAdapter.sol:178`: rimosso `* WAD`. Ora `/ debtAssets`.
- [x] **3** — Grep verifica: **0** occorrenze residue di `debtAssets * WAD` in contracts/.
- [x] **4** — `forge build` **verde** (0 errori).
- [x] **5** — Test masking corretto: `MorphoPlugin.fork.test.ts` riga 674 `minHealthFactor` → `ethers.parseEther("1.05")`; riga 696 assert `gte(1)` → `gte(parseEther("1"))` (WAD); righe 709/722 allineate. ⚠️ **non eseguibile qui** (serve ARBITRUM_RPC_URL).
- [x] **6** — register.json: PLG-005 / NEW-007 → `fixed-pending-verification`; ADP-039 nota (virtual-shares rimandato). 380 finding schema-valid.
- [x] **7** — execution-log + README aggiornati.
