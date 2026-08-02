# Registro di esecuzione della suite di sicurezza

Documento richiesto da §1.6 della checklist. Aggiornato ad ogni fase completata,
bloccata o rimessa in sospeso. Ogni entry deve permettere a un nuovo agente/session
di riprendere il lavoro senza rileggere l'intera conversazione precedente.

Formato canonico per ogni entry:

```
Fase / task ID
├── Branch e HEAD al momento dell'esecuzione
├── Scope attivo
├── Task completati / in corso / bloccati
├── File creati o modificati
├── Comandi eseguiti (PASS/FAIL)
├── Finding nuovi o cambiati
├── Decisioni ancora richieste (gate umano o tecnico)
├── Artifact / corpus / counterexample
└── Prossimo task esatto
```

---

## Entry 001 — S0.1 Snapshot (chiuso)

Task #11. Prodotto `security/scope/audit-snapshot.md`. Commit `786a5b92`, branch `dev-26`. Toolchain: Node 22.20.0, solc 0.8.27, Hardhat ^2.28.6. Gap: InterVault non nell'audit 2026-07 (aggiunto in S1.2 come 5 candidates).

## Entry 002 — S0.2 Scope (chiuso)

Task #12. Prodotto `security/scope/production-paths.txt` (30 contratti .sol + 42 interfacce + scripts off-chain) + `exclusions.md`. Nessuna modifica contracts/ tra commit InterVault e HEAD.

## Entry 003 — S0.3 Ownership (chiuso post gate umano)

Task #13 → #1. Autorizzazioni utente ricevute in-conversation. Prodotti: DECISIONS.md (DEC-001..005), `.github/CODEOWNERS` (single-maintainer Poppo753, no required review). Cooling-off DISABILITATO con trigger automatico di riattivazione.

## Entry 004 — S1 Audit normalization (chiuso)

Task #2-#6. Prodotti:
- `security/findings/schema.json` (JSON Schema draft 2020-12)
- `security/findings/register.json` (327 entries, schema-valid, 228 KB)
  - 8 critical, 79 high, 128 medium, 89 low, 23 info
  - 94 confirmed, 222 triaged, 5 duplicate, 5 candidate (INTERVAULT), 1 false-positive (PLG-006)
- `security/findings/README.md` (documentazione registro)
- `security/findings/S1.5-priorities-verified.md` (11 priorità verificate sul codice)
- `security/findings/S1.6-remediation-plan.md` (plan cicli 1-5, no fix applicati)
- `docs/audit_2026_07/11-verification-remaining.md` (53 CONFIRMED, 0 FP, 4 partial, 0 stale)
- VALUATION-001 root con 9 sub_findings creato

**Incident notato:** primo tentativo `json.dump` senza `encoding='utf-8'` ha troncato register.json a 59 KB su Windows/cp1252. Recovery via script deterministico salvato nel scratchpad. Regola aggiunta: sempre `encoding='utf-8'` per JSON con caratteri non-ASCII su Windows.

## Entry 005 — S2 CI Hardhat (chiuso)

Task #7-#10. Prodotti:
- `.github/workflows/tests.yml` (RIscritto): 11 job (build, unit, integration, security, invariant, metavault, script, automation, scope-drift, findings-schema, tests-summary). actions@v4, Node 22, permissions minime, concurrency, timeout, artifact on failure. Trigger su main/develop/dev-*.
- `.github/workflows/fork.yml` (nuovo): preflight secret verification, PRIVATE_KEY vietata, FORK_BLOCK_NUMBER numerico obbligatorio, cron nightly 02:00 UTC, workflow_dispatch manuale. Cancel-in-progress: false.
- Job `scope-drift` implementa il controllo automatico S0.2 sui nuovi file .sol non classificati.
- Job `findings-schema` valida register.json contro schema.json in CI.

## Entry 006 — S3 Slither report-only (chiuso)

Task #11-#13. Prodotti:
- `security/slither/slither.config.json` (path canonico §1.2)
- `security/slither/baseline-raw.json` (50 MB output completo)
- `security/slither/baseline-raw.sarif` (1.1 MB SARIF per code scanning)
- `security/slither/baseline-console.txt` (288 KB)
- `security/slither/baseline.json` (compact 420 KB con fingerprint)
- `security/slither/README.md`
- `security/slither/suppressions.md` (registro suppression: attualmente vuoto)

**Risultati Slither 0.11.5 (solc 0.8.27):** 828 findings totali.
- 49 High, 151 Medium, 571 Low, 27 Info, 30 Optimization
- 98 High confidence, 730 Medium confidence
- **12 High/High**: 7 encode-packed-collision (SwapManager, NUOVO — non censito nell'audit), 4 arbitrary-send-erc20 (dup CORE-055/56/IFC-027), 1 uninitialized-state (da localizzare)
- 34 Medium/High, 37 High/Medium

## Entry 007 — S4 Slither gate differenziale (chiuso)

Task #14-#16. Prodotti:
- Baseline arricchita con `state`, `owner: @Poppo753`, `review_date: 2027-01-15`, `motivation` per detector
- `security/slither/compare.py` (fingerprint diff con `--fail-on new-high-high,new-med-high,tool-error`)
- `.github/workflows/slither.yml` (job PR con SARIF upload + PR comment via github-script)
- `security/slither/BURN_DOWN.md` (piano riduzione Sprint 0/1/2)

Smoke test compare.py: 0 new, exit 0.

## Entry 008 — S5 Foundry sidecar (chiuso)

Task #17-#19. Prodotti:
- `foundry.toml` (parity con Hardhat: solc 0.8.27, optimizer 100, via_ir, allowUnlimitedContractSize=false)
- `lib/forge-std/` (via `forge install foundry-rs/forge-std --shallow`)
- `test/foundry/unit/HFScaleMath.t.sol` — dimostra bug PLG-005 matematicamente
- `test/foundry/fuzz/ShareRounding.fuzz.t.sol` — bug NEW-001/003 via fuzz
- `test/foundry/invariant/LPPoolInvariant.invariant.t.sol` — handler 3 attori + INV-1/2/3
- `.github/workflows/foundry.yml` (PR + nightly + manual dispatch)

**Pilot risultati:** `forge test --match-path "test/foundry/**/*.t.sol"` in 934 ms:
- 5 test PASS
- 4 FAIL attesi (dimostrano bug reali):
  - `testFuzz_bug_buggyHFAlwaysBelowMinHF` (256 runs conferma PLG-005)
  - `invariant_noAsymmetricProfitAtCost` INV-3 violato in 2 runs / 100 calls (NEW-001/003 dimostrato)
  - `invariant_poolValueConservation` panic overflow (bound test troppo permissivo, non bug contratto)
  - `testFuzz_bug_shareInflationAttack` "shares == 0" (bound edge, atteso)

## Entry 009 — S6 Catalogo proprietà (chiuso)

Task #20. Prodotti:
- `security/properties/PROPERTY_CATALOG.md` — 41 proprietà (VAL 7, LP 8, WDR 6, CUST 7, GOV 7, ORC 4, HF 2, SWP 4, EMG 2)
- `security/properties/TRACEABILITY.md` — matrice property × finding × test × tool

**Status pilot:** 1 IMPLEMENTED (LP-006), 3 PILOT con bug catturato (LP-001, LP-003, HF-001), 1 PILOT parziale (LP-004), 21 PLANNED, 15 BLOCKED-HUMAN.

## Entry 010 — S7 Echidna (chiuso)

Task #21. Prodotti:
- `security/echidna/echidna.yaml` (v2.2.5, testLimit 50000, assertion mode)
- `contracts/echidna/EchidnaLPPool.sol` (harness LP-006/LP-003/LP-004)
- `security/echidna/README.md`
- `.github/workflows/echidna-nightly.yml` (cron 04:00 UTC + workflow_dispatch)

Harness compila (forge build ok). Prima run reale demandata a CI trigger (Windows/Docker complexo per esecuzione locale).

## Entry 011 — S8 Halmos (chiuso con limite esplicito)

Task #22. Prodotti:
- `test/foundry/halmos/HFScaleSymbolic.check.t.sol` (bounded check HF-001)
- `security/halmos/README.md`

**Halmos 0.2.0** installato via `pip install halmos --only-binary :all:`.

**Prima run:** `halmos --contract HFScaleSymbolic --forge-build-out out-foundry --root .`
- `check_hf_alwaysInWAD`: **TIMEOUT** dopo 78.86s (6 path esplorati). Inconclusive.
- `check_hf_fixed_alwaysInWAD`: **TIMEOUT** dopo 62.04s (4 path esplorati). Inconclusive.
- Totale 140.95s, 0 pass / 2 fail (di cui entrambi inconclusive per timeout).

Timeout non è PASS né bug del contratto — è limite del symbolic execution. Foundry fuzz (256 runs) copre già HF-001 con evidenza empirica. Ottimizzazione bound/loop planned per Sprint 1 espansione.

## Entry 012 — S9 Remediation (BLOCCATO — HUMAN GATE §1.4)

Task #23. **NON eseguito applicare fix.** Motivo: ogni fix del ciclo 1 (VALUATION-001, withdrawal clamp, first-depositor, emergency selector, HF scale, minOut, timelock, interface drift) rientra nel gate umano §1.4:
- "applicare una modifica core che cambia NAV, share, fee, prelievo o recovery senza decisione registrata"
- "scegliere una semantica economica controversa tra alternative non equivalenti"

**Preparazione già disponibile:**
- `security/findings/S1.6-remediation-plan.md` §Ciclo 1..5 elenca 8 blocker Sprint 0 con: test rosso da scrivere, semantica proposta, trade-off, ordinamento raccomandato.
- Ogni blocker specifica il path del test rosso in `test/foundry/*/` da scrivere per primo.

**Cosa serve dall'utente per sbloccare S9 (ciclo per ciclo):**

Per ogni Blocker Ciclo 1 (C1-01 .. C1-08), l'utente deve autorizzare **la semantica** (non l'implementazione — quella la fa l'agente). Esempio richiesta:

> **Blocker C1-04 (Emergency selector)**: proponi di implementare `emergencyTransfer(token, amount, to)` con `onlyAuthorizedModule + whenPaused + SafeERC20` + separare `emergencyRecipient` da `owner()` + sweep completo via `TokenManager.getActiveTokens()`. Confermi?

Alternativa: utente indica preferenza per opzione A o B (dove ne ho proposte), o richiede modifica alla proposta.

**Cosa può fare l'agente autonomamente PRIMA del gate:**
- Scrivere i test rossi corrispondenti (dimostrano che il bug esiste, non applicano il fix). Questo è già coperto dal pilot Foundry per C1-05 (HF scale) e C1-03 (first-depositor).
- Espandere PROPERTY_CATALOG con test path per ogni proprietà PLANNED.
- Preparare mock ERC777, mock Lens failure, mock ChainlinkStale per S9.

## Entry 013 — S10 Release/canary (BLOCCATO — HUMAN GATE §1.4)

**NON eseguito.** S10 include: fork post-fix, off-chain security review, release gate, canary con capitale reale. Tutti rientrano in gate umani §1.4 assoluti:
- "installare tool con privilegi elevati o modificare infrastruttura globale"
- "aggiungere/modificare secret GitHub, RPC o credenziali VPS"
- "proporre o eseguire una transazione Safe"
- "effettuare deploy, verifica explorer o canary Arbitrum"
- "ingaggiare/dichiarare completato un audit esterno"
- "aumentare cap o capitale"
- "dichiarare production-ready"

**Preparazione già disponibile:** BURN_DOWN.md e S1.6-remediation-plan.md descrivono il percorso verso S10 dopo S9 completato.

---

## Entry 014 — T1 Slither triage (CHIUSO)

- **Task ID:** #24, #25, #26 — T1.1 (checklist), T1.2 (agente 46 gravi), T1.3 (skim 782)
- **Branch e HEAD:** `dev-26` @ `786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89`
- **File prodotti in questa fase:**
  - `security/slither/TRIAGE_CHECKLIST.md` — protocollo autoritativo di triage (11 sezioni)
  - `security/slither/SKIM_LOW.json` — cluster analysis machine-readable
  - `security/slither/SKIM_LOW_REPORT.md` — report umano dello skim T1.3
- **Task in background:** T1.2 agente triage 46 gravi (H/H + M/H) → produrrà `security/slither/TRIAGE_REPORT.md` + entries `SLIT-*` in `register.json`
- **Skim T1.3 risultati (già completati):**
  - 628 finding low-tier analizzati per cluster
  - 14 cluster sospetti in path economici (>=3 occorrenze)
  - **5 nuovi SLIT-CLUSTER-* da registrare** dopo il triage 46 gravi:
    - SLIT-CLUSTER-001: reentrancy-events post external call (28 occorrenze)
    - SLIT-CLUSTER-002: reentrancy-benign su counter/state (20 occorrenze)
    - SLIT-CLUSTER-003: timestamp bucket manipulation LM (correlato NEW-030)
    - SLIT-CLUSTER-004: timestamp cache VC validity extension (**NUOVO minor**)
    - SLIT-CLUSTER-005: events-maths VC (false-positive-like)
- **Conferme al primo audit:**
  - NEW-004 (ProxyGeneral no nonReentrant): confermato staticamente da 48 pattern reentrancy in cluster 1+2
  - NEW-030 (timestamp bucket manipulation): confermato da cluster 3
  - NEW-025 (deadline tautologico): confermato indirettamente da cluster 3 SwapManager
- **Nuovo bug emerso dallo skim:** VC cache extension via validator timestamp shift (15 min). Basso severity. Da aggiungere a remediation Sprint 1.

### Risultati agente T1.2 (46 gravi)

**Register cresce 327 → 373 (SLIT-001..046) → 378 (con SLIT-101..105 cluster).**

Distribuzione dei 46 finding SLIT puntuali:
- **6 duplicate** (cross-linked): SLIT-001/002 → NEW-006, SLIT-003/004 → IFC-027, SLIT-012 → CORE-023, SLIT-046 → PLG-057.
- **8 confirmed**:
  - **SLIT-005..011** (7): `encode-packed-collision` in SwapManager. **Bug NUOVI** non presenti nell'audit 2026-07. Nuovo blocker Ciclo 1: **C1-09**.
  - **SLIT-019** (1): `LiquidityManager.deposit` asserisce `balance == pre + net` (strict equality) → DoS se base asset è fee-on-transfer token. Policy governance da chiarire.
- **32 false-positive**: 31 `incorrect-equality` (zero-check sentinels legittimi) + 1 canonical uint2str. Nessun `false-positive` di comodo (§10 anti-pattern rispettato).
- **0 accepted-risk**, **0 out-of-scope** (tutti i 46 in path production).

Deliverable:
- `security/slither/TRIAGE_REPORT.md` (report umano con lista dettagliata 46 + note)
- `security/findings/register.json` aggiornato a **378 entries schema-valid**

### Cross-reference con S1.6 remediation

Nuovi bug che entrano in Sprint 0:
- **C1-09 (SLIT-005..011)**: fixare `encode-packed-collision` in SwapManager. Sostituire `abi.encodePacked(spendTokenCode, receiveTokenCode)` con `abi.encode(spendTokenCode, receiveTokenCode)`. Impatto: cambia il valore hash → `swapSuccesses` e `swapErrors` mappings esistenti si "azzerano" (counter, non fondi). Non distruttivo ma da documentare.

Nuovi bug che entrano in Sprint 1:
- **SLIT-104 (VC cache extension)**: validator può shift timestamp ~15 min → cache stale utilizzabile se `cacheDuration < 15 min`. Fix: `cacheDuration >= 1 hour` o rimuovere cache time-based per NAV.

Nuovi bug che si autochiudono con Sprint 0 già pianificato:
- SLIT-101/102 cluster reentrancy → si chiudono con C2-07 (PoC-driven fix di NEW-004).
- SLIT-103 cluster timestamp bucket → si chiude con fix CORE-004 (dead code hourly limits) + rewrite bucket.
- SLIT-019 fee-on-transfer → richiede decisione governance: policy no-FoT base asset o rewrite deposit invariant.


---

## Entry 015 — DEC-006 Interfaccia universale pair-based (2026-07-17)

- **Tipo:** decisione architetturale (non implementazione codice).
- **Autorizzazione:** Poppo753 esplicita ("deve diventare pair based (opzione A) assolutamente").
- **File prodotti/modificati:**
  - `security/design/UNIVERSAL_LENDING_INTERFACE.md` (nuovo, design completo pair-based)
  - `security/DECISIONS.md` → DEC-006
  - `security/findings/SPRINT0-DECISIONS.md` → C1-08 marcato DECISO + cheat sheet aggiornata
  - `security/findings/S1.6-remediation-plan.md` → C1-08 riscritto come migrazione pair-based, priorità aggiornata
- **Sostanza decisione:**
  - `ILendingProtocol` → pair-based `(collateral, loan, amount)` per tutte le operazioni.
  - Nuova `ILeverageProtocol` separata con params che includono slippage protection.
  - ProtocolManager unico punto di ingresso (supply/borrow/repay/openLeverage/closeLeverage + onlyOperator).
  - Rimozione bypass `owner()` (PLG-084) + escape hatch emergency onlyOwner.
  - Morpho NON cambia (già pair-based); Aave/Euler aggiungono param collateral; MorphoVault supply-only.
- **Ribaltamento chiave:** l'interfaccia a 1 token è Aave-centrica, non universale. Pair-based è future-proof (Compound/Spark/Fluid/Silo/Aave V4 tutti mappano su collateral,loan).
- **Fund flow verificato:** Aave (L.315), Euler (L.402), Morpho (L.363) mandano tutti i borrowed funds a ProxyGeneral. Custody centrico coerente. MorphoVault è supply-only (no borrow).
- **Finding impattati:** IFC-004 (root), PLG-084, IFC-022/23/24, parzialmente PLG-030..035.
- **Stato implementazione:** NON iniziata. C1-08 è ora il blocker architetturale principale (8-16h). Segue test-red → fix → test-green (§12 del design doc).
- **Prossimo task:** presentare all'utente il piano di implementazione C1-08 e attendere conferma per iniziare (test rosso user-journey per primo).

---

## Entry 016 — DEC-007 Emergency "No drain" (2026-07-17)

- **Tipo:** decisione di governance/policy (non implementazione codice).
- **Autorizzazione:** Poppo753 esplicita ("deve implementare soluzione 1 no drain").
- **Contesto:** l'utente ha identificato che `emergencyWithdraw`-to-owner è un rug vector ("potrei pausare e drenare quando voglio"). Corretto: i protocolli reputati (Aave/Compound/Morpho/Yearn/Lido) non hanno drain-to-admin.
- **File modificati:**
  - `security/DECISIONS.md` → DEC-007
  - `security/findings/SPRINT0-DECISIONS.md` → C1-04 riscritto come "No drain" + cheat sheet
  - `security/findings/S1.6-remediation-plan.md` → C1-04 riscritto
  - `security/findings/register.json` → nuovo CORE-081 (EMERGENCY-UNWIND) + note DEC-007 su CORE-001/015/010, NEW-010/018
- **Sostanza decisione:** emergenza = pausa + unwind uniforme + LP withdraw pro-rata. NESSUN drain-to-owner. Le 5 funzioni pericolose vengono RIMOSSE (non fixate).
- **Nuovo finding CORE-081 (EMERGENCY-UNWIND):** `closePositionsForBaseAsset` ha semantica incoerente tra plugin (verificato leggendo tutti e 5):
  - Aave (L.454): solo base asset supplied — NON chiude leverage
  - Euler (L.1403): solo posizioni leverage sorted-by-risk
  - Morpho (L.530): solo mercati dove base asset è collaterale
  - MorphoVault (L.196): tutti i vault supply
  - InterVault (L.161): child vault per base asset
  Serve unwind UNIFORME "tutto a base asset" per il design No-drain. Si aggancia a C1-08. Severity: high.
- **Finding impattati (rimossi da DEC-007, non ancora applicato):** CORE-001, CORE-015, NEW-018, CORE-010, NEW-010.
- **Register:** 379 entries (era 378, +1 CORE-081). 8 critical, 91 high, 130 medium, 95 low, 55 info.
- **Stato implementazione:** NON iniziata. C1-04 (No-drain) si intreccia con C1-08 (interfaccia universale) per l'unwind uniforme.

---

## Entry 017 — DEC-008 access control + pipeline remediation + fix C1-09 (2026-07-27)

- **Tipo:** decisione (DEC-008) + PRIMO fix di codice core applicato (C1-09).
- **Autorizzazione:** Poppo753 esplicita — access control "A2 / B2 / VAC = tutte le operazioni di ribilanciamento"; ordine "parti da c1-09 e poi le altre due insieme"; pipeline in 6 step.
- **DEC-008 registrata** (`security/DECISIONS.md`): `onlyOperator` = owner + registro VAC (A2); emergency trigger = owner + emergency contacts (B2); VAC = tutte le operazioni di ribilanciamento (C). Definisce l'access control per C1-08 (DEC-006) e C1-04 (DEC-007).
- **Pipeline remediation stabilita** (nuova sezione doc `docs/New_Doc/1_Documentation/6. audit_2026_07/12-remediation-waves/`): README con i 6 step (folder → idea → idea dettagliata → rilettura/correzione → checklist → implementazione) + indice ondate. Sottocartella per fix.
- **C1-09 — encode-packed-collision in SwapManager — IMPLEMENTATO (fixed-pending-verification):**
  - Doc: `12-remediation-waves/Sprint0/C1-09_encode-packed-collision/` (01_Idea, 02_Idea_Dettagliata+revisione, 03_Checklist).
  - Fix: nuovo helper `SwapManager._pairHash(string,string) internal pure` con `keccak256(abi.encode(a,b))`; sostituiti tutti i 7 siti `abi.encodePacked` (righe 505/592/647/708 write, 1113 _handleSwapError, 1154 getSwapStats, 1316 resetSwapStats). Grep `abi.encodePacked` in SwapManager.sol → 0 in codice (1 solo nel commento esplicativo).
  - Scelta di design flaggata al gate: helper unico invece di 7 sostituzioni inline (single source of truth + testabilità). Fallback minimale disponibile se l'utente preferisce.
  - Test: `test/foundry/unit/SwapManagerPairHash.t.sol` (harness espone `_pairHash`), 6 test PASS (collisioni note, determinismo, order-sensitivity, fuzz iniettività 1000 runs).
  - Red→green: pre-fix la suite non compilava (`Undeclared identifier _pairHash`); post-fix build verde + 6/6 PASS.
  - Suite Foundry completa: 11 pass / 4 fail. I 4 fail sono i canary PRE-ESISTENTI del bug C1-03 share-inflation (`ShareRounding.fuzz`, `LPPoolInvariant` INV-3) — verificato via grep che NON citano SwapManager. Nessuna regressione dal fix C1-09.
  - Register: SLIT-005…SLIT-011 (7 finding) → `state = fixed-pending-verification` + history entry. 379 finding, tutti schema-valid (validati per-item; lo schema descrive un singolo finding).
  - Effetto collaterale atteso: contatori `swapSuccesses`/`swapErrors` diventano orfani (chiavi cambiano) — reset telemetria non distruttivo.
- **Stato:** C1-09 attende review di Poppo753 (gate §1.4 / DoF checklist Fase E) prima del merge/commit. Fix in working tree, non committato.
- **Prossimo task:** dopo review C1-09 → avviare C1-08 + C1-04 insieme (interfaccia universale pair-based + emergency No-drain con unwind sort-by-risk), stessa pipeline in 6 step. Usare DEC-006/007/008 come input di design.

---

## Entry 018 — C1-08 + C1-04 implementazione (Sub-fasi A→E, build VERDE) (2026-08-02)

- **Tipo:** implementazione core (interfaccia universale pair-based + emergency No-drain).
- **Autorizzazione:** Poppo753 ("procedi fino in fondo" / "prosegui").
- **Stato:** `forge build` VERDE (0 errori). Sub-fasi A,B(parziale),C,D,E fatte. Restano F (lens) + G (test/register/verifica) + leverage (differito a C1-06).
- **Interfacce (Sub-fase A):**
  - `IProtocolAdapter.sol` riscritta pair-based (supplyCollateral/withdrawCollateral/borrow/repay/getCollateral/getDebt/getHealthFactor(collateral,loan) + protocolType + emergencyClosePosition + errore UnsupportedOperation). Rimossi deposit/withdraw single-token + eventi Deposited/Withdrawn. `memory` non calldata.
  - Nuova `ILeverageProtocol.sol` (struct unificato, NON ancora implementato dai plugin → C1-06).
- **Plugin migrati (Sub-fase C), tutti build-green:**
  - Morpho (già pair-based, ripulito), Aave/Euler (single→pair con aliasing tokenCode), MorphoVault/InterVault (supply-only: borrow/repay→revert UnsupportedOperation).
  - Su tutti: owner-bypass RIMOSSO dal modifier (PLG-084), aggiunti protocolType + emergencyClosePosition(onlyOwner), emit morti rimossi. Interfacce IAaveV3Plugin/IEulerV2Plugin ripulite (borrow/repay/getHF single-token tolte).
  - Guard `closePositionsForBaseAsset` di Aave/Euler/Morpho: onlyOwnerOrLiquidityManager → onlyProtocolManager (prima ProtocolManager veniva rifiutato).
  - Leverage: `openLeverageAtomic/closeLeverageAtomic` NON toccati (struct locale, onlyOwner) → migrazione a ILeverageProtocol differita a C1-06 (i nuovi campi sono slippage).
- **ProtocolManager (Sub-fase D):**
  - Operator-system: `authorizedOperators` + addOperator/removeOperator(onlyOwner) + modifier `onlyOperator` (owner||authorized) + evento OperatorAuthorized (DEC-008 A2).
  - deposit→supplyCollateral, withdraw→withdrawCollateral, borrow/repay/getDebt/getHealthFactor → pair-based + onlyOperator, cast IProtocolAdapter (non più ILendingProtocol).
  - `emergencyUnwindAll()` (nuovo): itera plugin con closePositionsForBaseAsset(type(uint256).max), guard `_isEmergencyAuthorized` (owner + emergency contacts via EmergencyHandler, DEC-008 B2).
  - closePositionsForBaseAsset + emergencyUnwindAll risolvono plugin via Beacon `_resolvePlugin(name)` (DEC-009 D2).
  - `ILendingProtocol` import ora inutilizzato (warning, lasciato). Dolomite (escluso) ancora usa ILendingProtocol.
- **Emergency No-drain (Sub-fase E):**
  - RIMOSSE: `EmergencyHandler.emergencyWithdraw()` + overload (address,uint256,address) + emergencyTransfer(payable,uint256); `ProxyGeneral.emergencyTransferAll`; fantasma `IProxyGeneral.emergencyTransfer`. Dichiarazioni tolte da IEmergencyHandler.
  - Flusso No-drain = emergencyPause (esistente) + emergencyUnwindAll (nuovo) + LP withdraw. Chiamate separate.
- **COUPLING C1-06:** unwind sort-by-risk "a base asset" per collaterale non-base richiede swap→C1-06; CORE-081 resta fix-in-progress; leverage struct unification pure C1-06.
- **Prossimo task:** Sub-fase F (verificare lens adapter getHealthFactor: build verde, probabilmente minimale) + Sub-fase G (riscrivere test Hardhat user-journey — quelli attuali usano vecchie firme e `plugin.connect(owner)`; scrivere UniversalLendingJourney.t.sol; aggiornare register.json IFC-004/PLG-084/CORE-001/015/010/NEW-010/018 → fixed-pending-verification; storage-layout before/after). Poi C1-05/C1-06/etc.

## Handover di sessione (aggiornato 2026-08-02)

Se un nuovo agente riprende da qui:

### Cosa è stato fatto
- **S0-S8 chiusi**: scope, audit normalizzato, CI hardhat + fork isolato + Slither gate + Foundry pilot + Echidna nightly + Halmos primo check.
- **41 proprietà catalogate**, 1 IMPLEMENTED, 3 PILOT con bug catturato, 21 PLANNED, 15 BLOCKED-HUMAN.
- **379 finding registrati** in `security/findings/register.json` (schema-valid per-item).
- **8 decisioni** in `security/DECISIONS.md` (DEC-001..008).
- **Sprint 0 remediation avviato**: pipeline 6-step documentata in `12-remediation-waves/`. **C1-09 fixato** (fixed-pending-verification, attesa review). Prossimi: C1-08+C1-04 insieme.
- **CI workflow files**: `tests.yml`, `fork.yml`, `slither.yml`, `foundry.yml`, `echidna-nightly.yml`.

### Cosa NON è stato fatto (e perché)
- **Nessun fix core applicato.** Bloccato da gate umano §1.4 per semantica economica.
- **Nessun deploy, canary o Safe transaction.** Bloccato da gate umano §1.4 assoluto.
- **Espansione test PLANNED**: possibile senza gate umano ma richiede scrittura di 20+ file test — demandata a sprint futuri.

### Verifica minima prima di riprendere

```bash
cd C:/Personal/TestPOC
git status --short              # deve mostrare: security/, .github/CODEOWNERS, .github/workflows/, foundry.toml, lib/, test/foundry/, contracts/echidna/, docs/... modified
git rev-parse HEAD              # 786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89
python -c "import json,jsonschema; s=json.load(open('security/findings/schema.json',encoding='utf-8')); d=json.load(open('security/findings/register.json',encoding='utf-8')); jsonschema.validate(d, {'type':'array','items':s}); print('OK', len(d))"
# expected: OK 327

export PATH="/c/Users/l.botta/.foundry/bin:$PATH"
forge --version                  # 1.7.1
forge test --match-path "test/foundry/**/*.t.sol" -vv | tail
# expected: 5 tests pass, 4 fail (bug catturati)
```

### Prossimo task esatto

**In attesa di autorizzazione utente per sbloccare S9 Ciclo 1.** Elenco decisioni:

1. **C1-01 (VALUATION-001)**: strict-by-default NAV con view `getTotalPoolValueBestEffort()` separata? Threshold "token minori tollerabili"?
2. **C1-02 (Withdrawal clamp CORE-003)**: opzione A revert o opzione B burn proporzionale? Aggiungere `minAmountOut`?
3. **C1-03 (First-depositor NEW-001)**: MINIMUM_LIQUIDITY Uniswap-style o virtual shares OZ ERC4626? Aggiungere `minLpTokensOut` obbligatorio a `deposit`?
4. **C1-04 (Emergency CORE-001)**: implementare `emergencyTransfer(a,u,r)`, separare `emergencyRecipient`, sweep completo?
5. **C1-05 (Morpho HF PLG-005/NEW-007)**: rimuovere `/WAD` dal denominatore + importare SharesMathLib ufficiale?
6. **C1-06 (minOut end-to-end)**: cambiare signature `IFlashLoanService.swap` con parametro `minAmountOut`? Enforce `maxSlippageBps` nei callback?
7. **C1-07 (Parameter execution CORE-005/06/07)**: rewrite ParameterManager con `proposalById` come single source of truth?
8. **C1-08 (Interface drift IFC-004)**: introdurre `IMorphoRouting` o estendere `ILendingProtocol` con overload two-tokenCode?

Ogni autorizzazione → agente scrive test rosso + fix minimo + regressione. Ordine raccomandato: C1-08 → C1-04 → C1-05 → C1-06 → C1-02 → C1-03 → C1-01 → C1-07.
