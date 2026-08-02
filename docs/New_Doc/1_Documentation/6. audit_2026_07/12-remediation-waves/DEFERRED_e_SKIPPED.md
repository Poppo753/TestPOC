# Rimandati / Skippati — registro unico

> Elenco **unico** di tutto ciò che, durante le ondate di fix, abbiamo consapevolmente
> **saltato** o **rimandato** (con motivo + dove verrà ripreso). Serve a non dimenticare nulla.
> La fonte di verità sullo *stato* dei finding resta `security/findings/register.json`; qui c'è
> la vista umana "cosa abbiamo deciso di NON fare ora e perché".
>
> Convenzione: ogni voce ha **Cosa · Perché rimandato · Dove si riprende · Stato register**.

---

## 1. ADP-039 — virtual shares in `toAssetsUp` (Morpho)
- **Cosa:** il calcolo del debito Morpho (`toAssetsUp`) non usa i virtual shares/assets (`VIRTUAL_SHARES=1e6`, `VIRTUAL_ASSETS=1`) → debito leggermente meno preciso.
- **Perché rimandato:** in C1-05 abbiamo fixato solo il blocker vero (il `* WAD`). ADP-039 è un raffinamento di accuratezza: differenza trascurabile per mercati non vuoti, e richiede di importare `SharesMathLib` (aggiunge bytecode, e Euler è al limite EIP-170).
- **Dove si riprende:** fix dedicato futuro (basso rischio, basso impatto). Richiede import libreria Morpho.
- **Stato register:** `confirmed` (aperto).

## 2. CORE-081 — unwind uniforme sort-by-risk **con swap collaterale→base asset**
- **Cosa:** l'unwind (DEC-007) deve riportare i fondi a **base asset**; per posizioni con collaterale ≠ base serve uno **swap** del collaterale liberato.
- **Perché rimandato:** in C1-08/C1-04 abbiamo fatto la parte strutturale (ordinamento per rischio, guard unificato, MorphoVault rispetta il target). Lo swap ha bisogno della protezione slippage/`minOut` che è **esattamente C1-06**.
- **Dove si riprende:** **C1-06** (accoppiato).
- **Stato register:** `fix-in-progress`.

## 3. `openLeverage`/`closeLeverage` su ProtocolManager + adozione `ILeverageProtocol` dai plugin
- **Cosa:** esporre la leva via ProtocolManager e unificare i 3 struct leverage divergenti nell'interfaccia `ILeverageProtocol` (già creata, non ancora implementata dai plugin).
- **Perché rimandato:** i campi nuovi dello struct (`minCollateralAfterSwap`, `maxSlippageBps`) **sono** la protezione slippage di C1-06. Farlo prima significherebbe scrivere due volte.
- **Dove si riprende:** **C1-06**. Per ora i plugin tengono `openLeverageAtomic` onlyOwner col struct locale.
- **Stato register:** collegato a PLG-030..035 (slippage), `confirmed`.

## 4. PLG-125 — `EulerV2Plugin` a filo di EIP-170 (margine 9 byte)
- **Cosa:** dopo C1-08, Euler è a 24567B (limite 24576B). Deployabile ma con **9 byte** di margine.
- **Perché rimandato:** il blocco al deploy è tolto (era 25200B, ora sotto). Ma il margine è troppo sottile per aggiungere altro codice.
- **Dove si riprende:** passata di **size-optimization prima del deploy** (library extraction della logica leverage/flash di Euler → headroom).
- **Stato register:** `fixed-pending-verification` (il blocker è risolto; l'ottimizzazione è follow-up).

## 5. Sub-fase G1 — riscrittura dei ~55 test Hardhat E2E/fork
- **Cosa:** aggiornare i test Hardhat alle nuove firme pair-based + flusso No-drain + `addOperator`.
- **Perché rimandato:** richiedono un **fork Arbitrum live** (`ARBITRUM_RPC_URL`) non disponibile in questo ambiente → non ri-eseguibili né verificabili qui.
- **Dove si riprende:** dove c'è il fork. **Guida pronta:** `Sprint0/C1-08+C1-04_.../04_Guida_Migrazione_Test.md`. La correttezza delle nuove behavior è già coperta a livello unit (Foundry).
- **Stato register:** n/a (verifica, non finding).

## 6. Verifiche pesanti C1-08/C1-04 rimandate (pre-merge)
- **Cosa:** `forge inspect storage-layout` before/after su ogni plugin; **Slither differenziale**; esecuzione full suite su fork.
- **Perché rimandato:** parte richiede fork; lo storage-layout va fatto come check finale pre-merge.
- **Dove si riprende:** Checkpoint 3 (pre-merge di C1-08/C1-04).
- **Stato register:** n/a (verifica).

## 7. IFC-022 / IFC-023 / IFC-024 — override mancanti (lens / SwapManager)
- **Cosa:** override mancanti su ILensAdapter (IFC-022), closePosition(string,string) (IFC-023), SwapManager/ISwapManager (IFC-024).
- **Perché rimandato:** fuori dallo scope diretto di C1-08 (riguardano lens e SwapManager, non la migrazione pair-based dei plugin). La build è verde, quindi non sono compile-blocker attuali.
- **Dove si riprende:** valutare in un fix dedicato override/lens.
- **Stato register:** `confirmed`.

## 8. Dolomite — non toccato (fuori scope)
- **Cosa:** DolomitePlugin usa ancora l'interfaccia legacy `ILendingProtocol`.
- **Perché rimandato:** **escluso dallo scope** fin dall'inizio (utente: "non considerare old, dolomite, gmx").
- **Dove si riprende:** non pianificato. `ILendingProtocol` tenuta (deprecata) apposta per non rompere Dolomite.
- **Stato register:** out-of-scope.

---

## Come aggiornare questo file
Ogni volta che in un'ondata si **salta** o **rimanda** qualcosa: aggiungere una voce qui (Cosa · Perché · Dove si riprende · Stato register) **e** aggiornare lo stato in `register.json`.
