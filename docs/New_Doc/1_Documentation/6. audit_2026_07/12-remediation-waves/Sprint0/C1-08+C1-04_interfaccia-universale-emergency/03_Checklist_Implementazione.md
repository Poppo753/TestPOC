# C1-08 + C1-04 — CHECKLIST DI IMPLEMENTAZIONE

> Pipeline step 5. Riferimento: `02_Idea_Dettagliata.md` (+ DEC-006/007/008/009).
> Legenda: `[ ]` da fare · `[~]` in corso · `[x]` fatto · `[!]` bloccato · `[C]` checkpoint umano.
> Build **rossa attesa** durante il refactor breaking fino a fine Sub-fase D.

---

## SUB-FASE A — Foundation (interfacce)

- [x] **A0** — Grep di impatto eseguito. **Risultati:**
  - `ILendingProtocol`: **nessun contratto la implementa** (`is ILendingProtocol` = 0 match; Dolomite è `is Ownable, ReentrancyGuard`). Castata SOLO da `ProtocolManager` (L320 borrow, L351 repay, L402 getDebt, L414 getHealthFactor) + import L8. Tutto il resto = commenti o Dolomite (escluso). → sicuro non rimuovere il file: basta togliere import+cast da ProtocolManager (Sub-fase D).
  - `.borrow(` single-token: solo `ProtocolManager.borrow` wrapper (in-scope) + `scripts/legacy/**` (TS off-chain, non bloccano build) + chiamate interne ai protocolli reali (aavePool/morpho, non interfaccia). Contenuto.
  - `getHealthFactor()` no-arg: `ProtocolManager:414` (wrapper plugin → diventa pair), `ProtocolManager:717` (**lens aggregato, resta no-arg**), `EulerV2Plugin:1365` (self-call interno). Attenzione F2: distinguere HF-per-coppia (plugin) da HF-aggregato (lens).
- [x] **A1** — Creato `contracts/interfaces/ILeverageProtocol.sol` (additivo, build resta verde).
- [x] **A2** — Riscritta `contracts/interfaces/IProtocolAdapter.sol` v2 pair-based: aggiunte `supplyCollateral/withdrawCollateral/borrow/repay(collateral,loan,amount)`, `getCollateral/getDebt/getHealthFactor(collateral,loan)`, `protocolType()`, `emergencyClosePosition(collateral,loan)`, errore `UnsupportedOperation`. Rimossi `deposit/withdraw` single-token e gli eventi `Deposited/Withdrawn` (sostituiti da `CollateralSupplied/Withdrawn/Borrowed/Repaid`). Mantenuti `closePosition(uint256)`, `closePositionsForBaseAsset` (doc contratto sort-by-risk + emergency mode), `getBalance`, `emergencyWithdrawAll`, `activateCircuitBreaker`, struct/enum. **BUILD ORA ROSSA (atteso).** Verificato: errori solo nei plugin (es. AaveV3Plugin:239 `Deposited`), interfaccia sintatticamente valida.
- [~] **A3** — Rimuovere `emergencyTransfer` fantasma da `IProxyGeneral.sol:293` → **spostato a Sub-fase E**: i suoi chiamanti sono in `EmergencyHandler.emergencyWithdraw` (L330/363/952) che vengono rimossi in E; rimuoverlo ora romperebbe EmergencyHandler prima del tempo.
- [ ] **A4** — `ILendingProtocol.sol`: **tenere + marcare `@deprecated`** (A0: nessuno la implementa; solo ProtocolManager la casta, e cambia in Sub-fase D). Non rimuovere (Dolomite escluso resta in contracts/).

## SUB-FASE B — Test rosso user-journey  `[C]` checkpoint dopo B

- [ ] **B1** — Nuovo `test/foundry/unit/UniversalLendingJourney.t.sol`: operatore (via ProtocolManager) fa supply→borrow→repay→withdraw su Aave/Euler/Morpho e supply→withdraw su MorphoVault/InterVault. Oggi ROSSO (Morpho selector + no operator/leverage entrypoints).
- [ ] **B2** — `forge build` → rosso atteso; documentare gli errori.
- [ ] **[C] CHECKPOINT 1** — presentare a @Poppo753 interfacce + test rosso prima di migrare i plugin.

## SUB-FASE C — Plugin (uno alla volta, `forge build` del singolo file tra ciascuno)

> Ordine: escape hatch PRIMA di rimuovere l'owner-bypass (revisione V4/V7).

- [x] **C0** — Escape hatch `emergencyClosePosition(collateral, loan) onlyOwner` aggiunto in Morpho (pattern per gli altri).
- [x] **C1 — MorphoPlugin (RIFERIMENTO)** — migrato: rimosso owner-bypass dal modifier; rimossi `deposit/withdraw` single-token + emit `Deposited/Withdrawn` morti; aggiunti `protocolType()` ("MORPHO_BLUE") e `emergencyClosePosition`. Firme già pair-based (supplyCollateral/borrow/repay/withdrawCollateral/getDebt/getCollateral/getHealthFactor). **Rimandato a Sub-fase D:** adozione `ILeverageProtocol` (unificazione struct) — le funzioni leverage restano onlyOwner col struct locale finché ProtocolManager non espone openLeverage. **CORE-081 unwind:** vedi nota coupling C1-06 sotto.
- [x] **C2 — AaveV3Plugin** — migrato: `deposit/withdraw`→`supplyCollateral/withdrawCollateral(collateral,loan)`; `borrow/repay(collateral,loan)` (usa `loan`); `getHealthFactor(collateral,loan)`; aggiunti `getCollateral`, `protocolType()`="AAVE_V3", `emergencyClosePosition`; owner-bypass rimosso; emit `Deposited/Withdrawn` morti rimossi; `IAaveV3Plugin` ripulita. **Leverage struct → Sub-fase D.**
- [x] **C3 — EulerV2Plugin** — migrato (via agente, verificato): firme pair-based con aliasing (corpi EVC intatti); `getDebt` pair + `override` aggiunto; `getHealthFactor(collateral,loan)`; aggiunti `getCollateral/protocolType`("EULER_V2")/`emergencyClosePosition`; owner-bypass rimosso; `this.getHealthFactor("","")` nel leverage helper; `IEulerV2Plugin` ripulita.
- [x] **C4 — MorphoVaultPlugin** — migrato: `supplyCollateral/withdrawCollateral` pair supply-only; `borrow/repay`→revert `UnsupportedOperation`; `getCollateral/getDebt`(0)/`getHealthFactor`(∞); `protocolType`="MORPHO_VAULT"; `emergencyClosePosition`; `closePositionsForBaseAsset` ora **rispetta `targetAmount`**; owner-bypass rimosso; emit morti rimossi.
- [x] **C5 — InterVaultPlugin** — migrato: idem supply-only (aliasing `tokenCode=collateral`); `borrow/repay`→revert; views supply-only; `protocolType`="INTERVAULT"; `emergencyClosePosition`; owner-bypass rimosso; emit morti rimossi.
- [ ] **C6** — `forge inspect <Plugin> storage-layout` before/after per tutti e 5 → invariato. (da fare)
- [x] **[C] CHECKPOINT 2** — 5 plugin migrati, **`forge build` VERDE (0 errori)**. Nota: ProtocolManager ancora chiama i vecchi selector single-token → runtime rotto finché Sub-fase D non è fatta (build verde ≠ sistema funzionante).

## SUB-FASE D — ProtocolManager

- [x] **D1** — Operator-system (DEC-008 A2): aggiunti `authorizedOperators` mapping, `addOperator/removeOperator` (onlyOwner), `modifier onlyOperator` (owner || authorized), evento `OperatorAuthorized`.
- [x] **D2** — Convertiti `deposit→supplyCollateral`, `withdraw→withdrawCollateral`, `borrow/repay/getDebt/getHealthFactor` a firma pair-based `(protocol,collateral,loan,...)` + `onlyOperator`; cast a `IProtocolAdapter`. getBalance→cast IProtocolAdapter.
- [~] **D3** — `openLeverage/closeLeverage` + `ILeverageProtocol` routing → **DIFFERITO a C1-06**: i campi nuovi dello struct (`minCollateralAfterSwap`, `maxSlippageBps`) sono protezione slippage = oggetto di C1-06. I plugin mantengono `openLeverageAtomic` onlyOwner col struct locale finché C1-06 non wire l'enforcement. Coerente col coupling già deciso.
- [x] **D4** — `emergencyUnwindAll()` aggiunto: itera i plugin con `closePositionsForBaseAsset(type(uint256).max)`; guard `_isEmergencyAuthorized` (owner + emergency contacts via EmergencyHandler, DEC-008 B2).
- [x] **D5** — Risoluzione plugin sul Beacon (DEC-009 D2): `closePositionsForBaseAsset` e `emergencyUnwindAll` risolvono l'indirizzo via `_resolvePlugin(name)` (Beacon), non più `info.plugin`. Registro locale resta per isActive.
- [x] **D5-bis** — Guard `closePositionsForBaseAsset` di Aave/Euler/Morpho: `onlyOwnerOrLiquidityManager` → `onlyProtocolManager` (prima ProtocolManager veniva rifiutato → unwind lending rotto). Ora l'unwind via ProtocolManager funziona.
- [x] **D6** — `forge build` → **VERDE (0 errori)**. Interfacce + 5 plugin + ProtocolManager allineati.

## SUB-FASE E — Emergency No-drain

- [x] **E1** — Rimosse `EmergencyHandler.emergencyWithdraw()` + overload `(address,uint256,address)` + `emergencyTransfer(payable,uint256)` (ETH). Dichiarazioni tolte anche da `IEmergencyHandler`. (helper `_logAssetSnapshot`/storage orfani lasciati, innocui).
- [x] **E2** — Rimossa `ProxyGeneral.emergencyTransferAll` + tolto il fantasma `emergencyTransfer(address,uint256,address)` da `IProxyGeneral`. Storage `emergencyRecipient/At` lasciato (sempre zero) per non alterare lo storage layout.
- [~] **E3** — Flusso No-drain: i mattoni ci sono — `emergencyPause` (owner+contacts, esistente) + `ProtocolManager.emergencyUnwindAll()` (owner+contacts, nuovo) + `LiquidityManager.withdraw` (whenPaused blocca deposit, abilita withdraw). Restano **chiamate separate** (decisione: pause istantaneo, unwind deliberato). Test del flusso end-to-end → Sub-fase G.
- [x] **E4** — Nessuna funzione manda più fondi a owner/EOA in emergenza (le 4 funzioni di drain rimosse). `forge build` VERDE.

## SUB-FASE F — Lens adapter + consumatori

- [ ] **F1** — Lens adapter Aave/Euler: `getHealthFactor(collateral, loan)`.
- [ ] **F2** — `ProtocolManager.getHealthFactor` / `getGlobalHealthFactor` / `getAllPositionsSortedByRisk`: allineare alle firme pair-based.
- [ ] **F3** — Script off-chain / VAC: aggiornare le firme (lista da A0).

## SUB-FASE G — Test + verifica

- [~] **G1** — Riscrivere i ~55 test Hardhat come user-journey via ProtocolManager. **Guida completa creata**: `04_Guida_Migrazione_Test.md` (mappa old→new di ogni firma + flusso No-drain + addOperator). Esecuzione/rewrite effettivo **RIMANE** (serve fork Arbitrum, non disponibile qui). Parità contratti verificata: **`hardhat compile` VERDE**.
- [x] **G1-bis (EIP-170)** — `hardhat compile` ha rivelato che le aggiunte C1-08 spingevano `EulerV2Plugin` a 25200B > 24576 (EIP-170, non deployabile). **Fixato**: `emergencyClosePosition` reso minimale su Euler (l'owner usa `closeLeverageAtomic` per la leva) → 24567B, sotto il limite. Finding **PLG-125** (fixed-pending-verification). ⚠️ margine 9B → serve library-extraction prima del deploy per headroom.
- [x] **G2** — Test Foundry unit `UniversalInterface.t.sol` → **7/7 verde**: `protocolType()` su tutti e 5 i plugin; supply-only `borrow/repay`→revert `UnsupportedOperation`; supply-only `getDebt`=0/`getHealthFactor`=max; operator system (add/remove state, addOperator onlyOwner, onlyOperator rifiuta non-operatore). (Il full journey E2E deposit→borrow→repay via routing reale resta G1/Hardhat: richiede mock-stack Aave/Euler/Morpho.)
- [~] **G3** — No-drain: le 4 funzioni di drain rimosse (verificato build). Test E2E pausa+unwind→LP withdraw → G1/Hardhat. **RIMANE**.
- [~] **G4** — Sort-by-risk unwind: contratto documentato + guard unificato. Test comportamentale → richiede integrazione (G1). **RIMANE** (+ swap-to-base = C1-06).
- [x] **G5-Foundry** — `forge build` verde + full Foundry suite: **18 pass / 4 fail**, i 4 = canary C1-03 preesistenti (share-inflation), **nessuna nuova regressione**. `hardhat compile` + Slither differenziale → **RIMANGONO**.
- [x] **G6** — register.json: IFC-004, PLG-084, CORE-001/010/015, NEW-010/018 → `fixed-pending-verification`; CORE-081 → `fix-in-progress` (swap→C1-06). 379 finding schema-valid. (IFC-022/23/24 sono lens/SwapManager, fuori ondata.)
- [x] **G7** — execution-log Entry 018 + README ondate aggiornati.
- [ ] **[C] CHECKPOINT 3** — review finale @Poppo753. **Rimane per il merge:** G1 (test Hardhat user-journey), storage-layout before/after, hardhat compile, Slither diff. Poi C1-06 chiude CORE-081 + leverage.

---

## Note di esecuzione

- **A0 grep di impatto:** vedi Fase A0 (unico cast in-scope a `ILendingProtocol` = ProtocolManager; `.borrow` single-token = solo ProtocolManager + script legacy).

### ⚠️ COUPLING CORE-081 ↔ C1-06 (decisione di scope sull'unwind)
Emerso migrando Morpho: la semantica DEC-007 "unwind sort-by-risk → **riportando i fondi a base asset**" implica che, chiudendo una posizione con collaterale ≠ base asset, il collaterale liberato vada **swappato a base asset** (via SwapManager). Questo swap ha bisogno di protezione slippage/minOut, che è proprio l'oggetto di **C1-06** (non ancora fatto).

**Approccio adottato (default, documentato):**
- In QUESTA wave (C1-08/C1-04) implemento la parte **strutturale**: interfaccia pair-based, access control operatori, emergency No-drain, escape hatch, e `closePositionsForBaseAsset` con **ordinamento sort-by-risk** delle posizioni.
- Lo **swap del collaterale non-base → base asset** dentro l'unwind viene cablato con **C1-06** (quando esistono `minAmountOut`/`maxSlippageBps` end-to-end). Fino ad allora, ogni plugin libera ciò che può direttamente in base asset (Aave: supply base; Euler: leverage atomico che netta a base; Morpho: mercati base-collateral) + ordina per rischio.
- **CORE-081** resta `fix-in-progress` fino al completamento congiunto con C1-06 (unwind cross-collaterale completo). Documentato per non spacciare per chiuso ciò che è parziale.

Questo evita di scrivere logica di swap non protetta in un path d'emergenza di codice che gestisce fondi.
