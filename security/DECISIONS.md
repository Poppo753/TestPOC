# Security suite — decision log

Registro autorevole delle decisioni di configurazione, ownership e policy della
suite di sicurezza. Richiesto dai path canonici della checklist §1.2.

Ogni decisione qui registrata è **vincolante** finché non viene esplicitamente
sovrascritta con una nuova entry datata. Le decisioni sono ordinate cronologicamente.

Formato canonico:

```
## DEC-NNN — <titolo breve>
- Data:
- Autore (autorizzatore):
- Commit di riferimento:
- Fase checklist:
- Motivazione:
- Decisione:
- Alternative valutate:
- Trigger di revisione automatica:
- Impatto operativo:
```

---

## DEC-001 — Ownership tecnico della suite (single-maintainer)

- **Data:** 2026-07-15
- **Autore (autorizzatore):** Poppo753 (autorizzazione esplicita in-conversation, 2026-07-15)
- **Commit di riferimento:** `786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89`
- **Fase checklist:** S0.3
- **Motivazione:** al momento del deploy della suite il progetto è single-maintainer. Nominare owner fittizi violerebbe la §1.4 della checklist e creerebbe accountability finta.
- **Decisione:**
  - **Owner tecnico della suite di sicurezza:** `@Poppo753`
    - Responsabile: manutenzione di `security/**`, dei workflow security in `.github/workflows/`, delle baseline (Slither, Foundry corpus, Echidna corpus), delle configurazioni tool (`slither.config.json`, `foundry.toml`, `echidna.yaml`, `halmos/**`).
  - **Reviewer indipendente per accepted risk e suppression:** **TBD** — al momento non esiste. Fino all'ingresso di un secondo maintainer, si applica DEC-003 (self-review con cooling-off condizionale).
- **Alternative valutate:**
  - Nominare owner fittizi/team virtuali: rifiutato, viola §1.4.
  - Ritardare S0.3 fino a ingresso secondo maintainer: rifiutato, bloccherebbe tutto S1-S10 indefinitamente.
- **Trigger di revisione automatica:**
  - Ingresso di un secondo maintainer nel progetto → aggiornare questa DEC assegnandogli il ruolo di reviewer indipendente.
  - Progetto passa a multi-org/DAO → nominare un reviewer esterno.
- **Impatto operativo:** `Poppo753` è single point of failure per la security suite. Le PR future su path security sono self-approved. La regola compensativa è DEC-003 (cooling-off condizionale).

---

## DEC-002 — CODEOWNERS come marcatore, senza required review

- **Data:** 2026-07-15
- **Autore (autorizzatore):** Poppo753 (autorizzazione esplicita: "opzione B", 2026-07-15)
- **Commit di riferimento:** `786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89`
- **Fase checklist:** S0.3
- **Motivazione:** in modalità single-maintainer, attivare `required review` di GitHub bloccherebbe l'autore dalle proprie PR (GitHub impedisce di approvare le proprie review). Il file CODEOWNERS resta comunque utile come **marcatore documentale** di responsabilità.
- **Decisione:**
  - Creare `.github/CODEOWNERS` con `@Poppo753` associato ai path security (`security/**`, `.github/workflows/security*.yml`, `slither.config.json`, `foundry.toml`, `echidna.yaml`, `halmos/**`, `test/foundry/**`).
  - **NON** attivare "Require review from Code Owners" nelle branch protection rules di GitHub.
  - **NON** attivare "Require pull request before merging with required approvals" finché single-maintainer.
- **Alternative valutate:**
  - Saltare completamente CODEOWNERS (opzione C proposta): rifiutato — la struttura è utile in prospettiva e non costa niente.
  - Attivare required review con `@Poppo753`: rifiutato — bloccherebbe l'autore.
  - Creare bot account per fingere secondo reviewer: rifiutato — sicurezza teatrale.
- **Trigger di revisione automatica:**
  - Ingresso di un secondo maintainer → attivare "Require review from Code Owners".
  - Primo deploy su mainnet → **valutare** attivazione required review (indipendentemente dal team size).
- **Impatto operativo:** GitHub segnala Poppo753 come owner ma non blocca il merge. Le modifiche a path security restano tracciate ma non enforced tramite gate.

---

## DEC-003 — Cooling-off period per accepted risk: disabilitato in fase test

- **Data:** 2026-07-15
- **Autore (autorizzatore):** Poppo753 (autorizzazione esplicita: "concordo con proposta cooling-off condizionale", 2026-07-15)
- **Commit di riferimento:** `786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89`
- **Fase checklist:** S0.3
- **Motivazione:** il cooling-off (attesa 24h tra dichiarazione di accepted-risk e firma) protegge contro decisioni impulsive che comprometteno capitale utente. In fase test/POC senza capitale reale, l'unico impatto di un accepted-risk sbagliato è tempo perso dell'autore. L'overhead diventa procedimento senza beneficio. Il rischio principale è "dimenticarsi di riattivare" al momento del deploy — mitigato dal trigger automatico.
- **Decisione:**
  - **Attualmente disabilitato**: gli accepted risk possono essere firmati immediatamente da `@Poppo753` senza attendere 24h.
  - **Documentazione obbligatoria** anche in stato disabilitato: ogni accepted risk deve comunque comparire in `security/findings/accepted-risk.md` con motivazione, commit e data.
- **Trigger di riattivazione automatica (basta uno qualsiasi):**
  1. Primo deploy di un contratto su mainnet (qualsiasi capitale, anche $1).
  2. Primo canary con capitale reale > $10.
  3. Ingresso di un secondo maintainer.
  4. Comparsa di un accepted risk di severity `critical` (in questo caso la firma richiede comunque 24h di attesa, anche se la regola generale è disabilitata).
  5. Passaggio del progetto a una struttura DAO/multi-sig di produzione.
- **Al momento della riattivazione, la regola sarà:**
  - 24h di attesa tra proposta e firma di un accepted risk `critical` o `high`.
  - 4h di attesa per `medium`.
  - Nessuna attesa per `low` e `info`.
  - La regola resta disattivabile temporaneamente **solo** per finestre di emergenza pubblicamente documentate (es. incident response).
- **Alternative valutate:**
  - Cooling-off 24h sempre attivo: rifiutato, overhead senza beneficio in fase test.
  - Cooling-off ridotto a 4h anche in fase test: rifiutato, complicazione senza guadagno.
  - Cooling-off disabilitato senza trigger di riattivazione: rifiutato, rischio di dimenticarsene.
- **Impatto operativo:** un solo dev può accettare rischi ora senza attese, ma la regola si autoattiva prima di qualsiasi deploy con impatto economico.

---

## DEC-004 — Branch protection: raccomandazioni non ancora applicate

- **Data:** 2026-07-15
- **Autore (autorizzatore):** Poppo753 (autorizzazione esplicita, 2026-07-15)
- **Commit di riferimento:** `786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89`
- **Fase checklist:** S0.3
- **Motivazione:** modifica delle regole di protezione branch richiede accesso alle Settings del repository GitHub, non delegabile all'agente (§1.4 checklist). L'agente registra la raccomandazione; l'utente la applica manualmente quando pronto.
- **Decisione (raccomandata per applicazione utente):**
  - **Su `main`:**
    - Attivare "Require a pull request before merging" **senza** required approvals (Poppo753 apre PR, la CI verifica, poi mergia lui stesso).
    - Attivare "Require status checks to pass before merging" → selezionare tutti i job del workflow security una volta creati (S2-S8).
    - Attivare "Do not allow bypassing the above settings" per prevenire push forzati anche da admin.
  - **Su `dev-26`:** nessuna protezione ora (branch di lavoro attivo, protezione bloccherebbe l'attività quotidiana).
  - **Su qualsiasi branch di release futuro (es. `release-*`):** stesse regole di `main` più eventuale required review quando entrerà un secondo maintainer.
- **Ambito NON coperto (rimane responsabilità dell'utente):**
  - L'agente **non** applica queste impostazioni. Deve essere Poppo753 dall'interfaccia GitHub (Settings → Branches → Add rule).
- **Trigger di revisione:**
  - Alla creazione del primo workflow security funzionante (fine S3 o S5), aggiornare la lista di "required status checks" nell'interfaccia GitHub.
  - Al primo deploy mainnet, valutare l'attivazione di required review.
- **Impatto operativo:** oggi zero. Diventa attivo quando l'utente applica le regole a mano.

---

## DEC-005 — Autorizzazione a procedere con S1 (audit normalization)

- **Data:** 2026-07-15
- **Autore (autorizzatore):** Poppo753 (autorizzazione implicita: risposta a S0.3 senza obiezioni al piano)
- **Commit di riferimento:** `786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89`
- **Fase checklist:** S0.3 → S1
- **Motivazione:** dopo DEC-001…DEC-004, il Gate S0 della checklist è formalmente chiuso. L'agente è autorizzato a procedere con S1 mantenendo tutti gli altri gate umani della §1.4 attivi.
- **Decisione:**
  - Sblocco S1 (audit normalization: schema JSON dei finding, correzione totali, deduplica, ingresso InterVault nel registro).
  - S1.3 (finding root `critical valuation fail-open`), S1.4 (verification), S1.5 (priorità), S1.6 (cicli di remediation) restano nell'ambito lavoro agente.
  - Ogni modifica a `docs/audit_2026_07/ISSUES.md` deve preservare la storicità: nessuna cancellazione, solo update con status.
- **Gate umani che restano attivi:**
  - Approvazione di un accepted risk (S1.4/S1.6): richiede firma di Poppo753 in `accepted-risk.md`.
  - Modifica di semantica economica (fix core NAV/share/fee/withdraw): human gate.
  - Deploy, Safe, canary, transazioni: human gate assoluto.
- **Trigger di revisione:** ad ogni entry in `security/execution-log.md`, verificare che nessun gate umano sia stato saltato per errore.
- **Impatto operativo:** l'agente riprende esecuzione da S1.1 dopo aver aggiornato la checklist con checkbox spuntate.

---

## DEC-006 — Interfaccia universale di lending: pair-based (Opzione A)

- **Data:** 2026-07-17
- **Autore (autorizzatore):** Poppo753 (autorizzazione esplicita in-conversation: "concordo in pieno idea. deve diventare pair based (opzione A) assolutamente")
- **Commit di riferimento:** `786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89`
- **Fase checklist:** S9 Ciclo 1 / blocker C1-08 (architetturale)
- **Documento di design:** `security/design/UNIVERSAL_LENDING_INTERFACE.md`
- **Motivazione:** l'interfaccia a 1 token è Aave-centrica e non generalizza. L'interfaccia a coppia (collateral, loan) è universale per pooled/vault-controller/isolated e future-proof (Compound, Spark, Fluid, Silo, Aave V4).
- **Decisione:**
  1. **`ILendingProtocol` diventa pair-based**: ogni operazione prende `(string collateral, string loan, uint256 amount)`.
  2. **Nuova `ILeverageProtocol`** separata con `OpenLeverageParams`/`CloseLeverageParams` che includono `collateral`, `loan`, `minCollateralAfterSwap`, `maxSlippageBps`.
  3. **ProtocolManager è l'UNICO punto di ingresso**: espone supplyCollateral/withdrawCollateral/borrow/repay/openLeverage/closeLeverage con routing pair-based. Access control `onlyOperator` (owner + VAC autorizzati).
  4. **Rimozione del bypass `owner()`** dai modifier `onlyProtocolManager` dei plugin (chiude PLG-084). Un solo escape hatch `emergencyClosePosition` onlyOwner documentato.
  5. **Migrazione plugin**: MorphoPlugin è già pair-based (solo override+nomi); Aave/Euler aggiungono il parametro collateral; MorphoVault supply-only con `loan==collateral`.
  6. **Test riscritti** come user-journey via ProtocolManager (non `plugin.connect(owner)`).
- **Ribaltamento rispetto al piano C1-08 originale:** non "aggiungere overload dual-token a Morpho" ma "migrare l'interfaccia universale a pair-based". **Morpho NON viene cambiato** (è già corretto); si adattano Aave/Euler.
- **Finding chiusi da questa decisione:** IFC-004 (root), PLG-084 (owner bypass), IFC-022/23/24 (override), parzialmente PLG-030/31/32/33/34/35 (slippage params entrano negli struct).
- **Gate umano applicato:** questa è una modifica architetturale core (§1.4). L'implementazione segue test-red → fix → test-green come da §12 del documento di design. Ogni fix richiede review di Poppo753 prima del merge.
- **Trigger di revisione:** se emerge un lender futuro che non mappa su (collateral, loan), rivalutare (improbabile: tutti i modelli conosciuti mappano).
- **Impatto operativo:** C1-08 diventa il blocker più grande dello Sprint 0 (8-16 ore). Va fatto in fase test (nessun capitale a rischio) perché cambiare l'architettura di accesso post-deploy è molto più costoso.

---

## DEC-007 — Emergency design: "No drain" (Opzione 1, stile Aave/Yearn)

- **Data:** 2026-07-17
- **Autore (autorizzatore):** Poppo753 (autorizzazione esplicita: "deve implementare soluzione 1 no drain")
- **Commit di riferimento:** `786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89`
- **Fase checklist:** S9 Ciclo 1 / blocker C1-04 (ridefinito)
- **Motivazione:** un `emergencyWithdraw()` che manda tutti i fondi a `owner()` è un rug vector (rilevato dall'utente). I protocolli reputati (Aave, Compound, Morpho, Yearn, Lido) NON hanno drain-to-admin. L'emergenza corretta è pausa + unwind + gli LP ritirano la loro quota pro-rata. I fondi restano in custody (ProxyGeneral) e vanno agli LP, MAI all'owner.
- **Decisione:**
  1. **Rimuovere** `EmergencyHandler.emergencyWithdraw()` che manda a `owner()` e `ProxyGeneral.emergencyTransfer(...)` / `emergencyTransferAll(recipient)` verso l'owner.
  2. **Emergenza = pausa + unwind + LP withdraw:**
     - `pause()` ferma deposit / nuove posizioni (freeze)
     - **unwind uniforme**: chiudere TUTTE le posizioni (leverage E supply) su TUTTI i plugin, riportando i fondi a base asset in ProxyGeneral
     - il pool entra in modalità "withdraw-only": gli LP ritirano la loro quota pro-rata via `LiquidityManager.withdraw`
  3. **Nessuna funzione permette all'owner di prendere custody dei fondi.** L'owner può solo: pausare, ordinare l'unwind, e (opzionale) triggerare un recovery TIMELOCCATO verso un multisig di recovery SOLO se il withdraw normale è rotto — con timelock lungo (es. 7 giorni) e indirizzo != owner. Questo layer opzionale NON è richiesto per la v1.
- **Finding chiusi da questa decisione:**
  - CORE-001 (emergencyTransfer selector rotto) — la funzione pericolosa viene rimossa, non fixata
  - CORE-015 (recipient hardcoded a owner) — rimosso
  - NEW-018 (no whenPaused → backdoor) — rimosso
  - CORE-010 (emergencyTransferAll sweepa solo base+ETH) — rimosso
  - NEW-010 (executed flag anche su 0 transfer) — rimosso
- **Prerequisito tecnico:** l'unwind uniforme richiede di risolvere l'**incoerenza di `closePositionsForBaseAsset`** (vedi EMERGENCY-UNWIND finding sotto): oggi Aave chiude solo il supply, Euler solo leverage, Morpho solo base-asset-collateral, MorphoVault tutto. Serve una semantica uniforme "unwind TUTTO a base asset" nell'interfaccia universale (si aggancia a C1-08 DEC-006).
- **Trade-off accettato:** senza una botola di drain, se il `withdraw` normale ha un bug che lo blocca, non c'è un salvataggio immediato. Mitigazione: il path di withdraw + unwind deve essere coperto da property test robusti (WDR-*, VAL-007) prima del deploy. Layer di recovery timelocked opzionale come rete di sicurezza futura.
- **Gate umano:** modifica core emergency (§1.4). Implementazione test-red → fix → test-green. Review Poppo753 prima del merge.
- **Modello di fiducia scelto:** orientato trustless per gli LP — l'owner gestisce le allocazioni ma NON può appropriarsi dei fondi. Coerente con "vault gestito ma non custodiale".
- **Semantica unwind uniforme (deciso da Poppo753 2026-07-17):** l'unwind deve funzionare **stile Euler** per TUTTI i plugin:
  1. Raccogliere TUTTE le posizioni (leverage + supply) su tutti i protocolli.
  2. Ordinarle per **rischio** (health factor crescente — le più rischiose prima).
  3. Chiuderle **progressivamente**:
     - **Modalità withdrawal** (liquidità insufficiente per un ritiro utente): chiudere finché non si ottiene `targetAmount` di base asset, poi fermarsi (unwind parziale, minimizza il disturbo alle posizioni sane).
     - **Modalità emergency**: chiudere TUTTO indipendentemente dal target.
  4. Applica a `closePositionsForBaseAsset` (già oggi Euler fa così — è il modello da propagare ad Aave/Morpho/MorphoVault/InterVault).
  Questo risolve il finding CORE-081 (EMERGENCY-UNWIND) e diventa parte dell'interfaccia universale (DEC-006).

---

## DEC-009 — Riconciliazione design pair-based col codice reale (target interfaccia, struttura, risoluzione plugin)

- **Data:** 2026-07-27
- **Autore (autorizzatore):** Poppo753 (autorizzazione esplicita in-conversation: "unica interfaccia revert se non supportato" + "unica fonte dovrebbe essere il beacon")
- **Commit di riferimento:** `786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89`
- **Fase checklist:** S9 Ciclo 1 / C1-08 implementazione
- **Motivazione:** la mappatura del codice reale (2026-07-27) ha rivelato che `security/design/UNIVERSAL_LENDING_INTERFACE.md` (DEC-006) conteneva 3 assunzioni non allineate al sorgente. DEC-009 le riconcilia senza cambiare la direzione (pair-based resta), solo il *target* tecnico.
- **Scoperte (verificate sul sorgente):**
  1. I plugin implementano `IProtocolAdapter` (via `I<Nome>Plugin is IProtocolAdapter`), **non** `ILendingProtocol`. Quest'ultima è legacy semi-abbandonata (`is IProtocolManager`); l'interfaccia Euler documenta "ILendingProtocol is being replaced by IProtocolAdapter". `ProtocolManager` casta a `ILendingProtocol` → root di IFC-004.
  2. `ProtocolManager` ha solo `onlyOwner` (OZ Ownable). Nessun `onlyOperator`/`authorizedOperators` → l'operator-system di DEC-008 va **costruito da zero**.
  3. `ProtocolManager` non ha `openLeverage`/`closeLeverage`; la leva vive in 3 struct per-plugin divergenti → esporla + unificare in `ILeverageProtocol` è lavoro netto.
  4. Bonus: l'emergency drain è **già rotto** — `EmergencyHandler.emergencyWithdraw` chiama `ProxyGeneral.emergencyTransfer(...)` che non esiste (solo nell'interfaccia); revert mascherato dal try/catch, "funziona" solo contro il mock. Rafforza C1-04/DEC-007.
  5. Il commento di `IProtocolAdapter.closePositionsForBaseAsset` **già specifica** "Closes riskiest positions first (lowest HF)" → CORE-081 è un mismatch spec-vs-impl (Aave/Morpho/MorphoVault/InterVault non lo rispettano).
- **Decisione:**
  1. **D1a — Target = `IProtocolAdapter`.** Il pair-based si applica a `IProtocolAdapter` (l'interfaccia reale), non a `ILendingProtocol`. La legacy `ILendingProtocol`/i cast in ProtocolManager vengono rimossi/allineati (cleanup, previa grep di sicurezza sugli usi residui).
  2. **D1b — Unica interfaccia + revert (scelta utente).** Niente split `IBorrowingProtocol`. `IProtocolAdapter` v2 contiene anche `borrow`/`repay` pair-based; i plugin supply-only (MorphoVault, InterVault) li dichiarano e revertano `UnsupportedOperation`. **Chiarimento vincolante:** "supply-only" tocca SOLO borrow/repay; `supplyCollateral`/`withdrawCollateral` (deposit/ritiro del capitale) restano pienamente operativi — è così che InterVault "restituisce" i fondi.
  3. **D2 — Risoluzione plugin unica sul Beacon.** ProtocolManager risolve l'indirizzo del plugin SEMPRE dal Beacon by-name (fonte unica). Il registro locale `protocols[name]` resta solo per metadati iterabili (isActive, lensAdapter), ma l'indirizzo del plugin non è più duplicato lì.
  4. **D3 — Implementazione a sub-fasi con checkpoint** (A interfacce → B test rosso → C plugin → D ProtocolManager → E emergency → F lens/consumatori → G test/verifica). Review di Poppo753 dopo B e dopo C. La build resta rossa durante il refactor breaking (atteso) fino al green di fine C/D.
- **Alternative valutate:**
  - Split `IProtocolAdapter` + `IBorrowingProtocol` (mia raccomandazione iniziale): scartata dall'utente a favore dell'unica interfaccia (meno file). Trade-off accettato: `borrow`/`repay` esistono ma revertano sui supply-only.
  - Tenere i due sistemi di risoluzione plugin: scartato (rischio disallineamento latente).
- **Trigger di revisione:** se un plugin futuro non-lending (YIELD/TRADING) rende scomodo avere borrow/repay in `IProtocolAdapter`, rivalutare lo split.
- **Impatto operativo:** definisce il target di C1-08. `UNIVERSAL_LENDING_INTERFACE.md` va annotato: "target = IProtocolAdapter (vedi DEC-009)". La stima 8-16h sale (operator-system + leverage netti).

---

## DEC-008 — Access control: operatori, emergenza, ambito VAC

- **Data:** 2026-07-27
- **Autore (autorizzatore):** Poppo753 (autorizzazione esplicita in-conversation: "decisione A: A2 / decisione B: B2 / decisione C: nono il VAC deve poter fare tutte le operazioni di ribilanciamento possibili")
- **Commit di riferimento:** `786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89`
- **Fase checklist:** S9 Ciclo 1 / prerequisito architetturale di C1-08 (DEC-006) e C1-04 (DEC-007)
- **Motivazione:** l'interfaccia universale (DEC-006) introduce un `modifier onlyOperator` su ProtocolManager e l'emergenza (DEC-007) introduce un trigger di unwind. Prima di scrivere il codice serve definire CHI può fare COSA. Senza queste tre definizioni non si può implementare l'access control né i test user-journey.
- **Decisione:**
  1. **`onlyOperator` = owner + registro di automazione (Opzione A2).**
     - ProtocolManager mantiene un `mapping(address => bool) authorizedOperators` gestito **solo dall'owner** (`addOperator`/`removeOperator`, `onlyOwner`).
     - Sono operatori: `owner()` **sempre** (hardcoded, non revocabile) + qualsiasi indirizzo in `authorizedOperators` (tipicamente la VAC — Vault Automation Controller).
     - Tutte le operazioni di gestione posizioni (supplyCollateral/withdrawCollateral/borrow/repay/openLeverage/closeLeverage/rebalance/unwind-withdrawal) sono `onlyOperator`.
     - Evento `OperatorAuthorized(address, bool)` per audit trail off-chain.
  2. **Emergency trigger = owner + emergency contacts (Opzione B2).**
     - `pause()` e `emergencyUnwindAll()` sono richiamabili da `owner()` **oppure** dagli emergency contacts già presenti in EmergencyHandler.
     - NON serve multi-firma (B3 scartato per la v1): singola firma di un contatto autorizzato è sufficiente per pausare + unwind. Rationale: in emergenza la velocità conta; l'unwind No-drain (DEC-007) non manda fondi all'owner, quindi il rischio di abuso è limitato (peggio che può fare un contatto compromesso è chiudere tutte le posizioni → i fondi restano in custody per gli LP).
     - `unpause()` resta **solo owner** (rientrare in operatività è una decisione più pesante del fermarsi).
  3. **Ambito VAC = tutte le operazioni di ribilanciamento (Opzione C).**
     - La VAC (indirizzo in `authorizedOperators`) può eseguire **qualsiasi** operazione di ribilanciamento: aprire/chiudere posizioni, spostare capitale tra lender, aprire/chiudere leverage, triggerare unwind preventivi. Non è limitata al solo path di withdraw utente.
     - La VAC **NON** può: cambiare owner, aggiungere/rimuovere operatori, cambiare parametri timelockati, `unpause`, o prendere custody dei fondi (coerente con DEC-007 No-drain — nessun operatore, VAC inclusa, può drenare verso un EOA).
- **Confini di sicurezza (invarianti che i test devono verificare):**
  - Un operatore autorizzato può muovere capitale **solo** tra protocolli/posizioni interni al vault (custody resta in ProxyGeneral). MAI verso un indirizzo esterno arbitrario.
  - Rimuovere un operatore è istantaneo (`onlyOwner`), non timelockato (deve essere veloce se la VAC è compromessa).
  - Gli LP **non** sono operatori: non possono muovere fondi interni, solo `deposit`/`withdraw` della propria quota.
- **Alternative valutate:**
  - A1 (solo owner operatore): scartato — impedirebbe l'automazione VAC, che è il cuore del "vault gestito".
  - B1 (solo owner triggera emergenza): scartato — se l'owner è offline in un incident, nessuno può pausare.
  - B3 (multi-firma soft su emergenza): scartato per v1 — overhead che rallenta la risposta; il No-drain limita già il danno.
- **Trigger di revisione automatica:**
  - Passaggio a struttura multi-sig/DAO → rivalutare B (l'emergenza potrebbe richiedere quorum).
  - Se la VAC gestisce capitale reale significativo → valutare rate-limit / bounds sulle operazioni VAC (non solo boolean authorized).
- **Impatto operativo:** definisce la firma di `onlyOperator` in ProtocolManager (C1-08) e il gating di `pause`/`emergencyUnwindAll` (C1-04). Sblocca la scrittura del codice di access control e dei test user-journey (LP vs operatore vs owner).
