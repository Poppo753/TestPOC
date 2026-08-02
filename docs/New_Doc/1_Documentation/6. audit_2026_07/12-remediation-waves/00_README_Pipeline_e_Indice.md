# Remediation Waves — Pipeline di lavoro e indice

**Sezione:** `12-remediation-waves`
**Scopo:** documentare, in modo tracciabile e ripetibile, ogni fix applicato ai contratti a seguito dell'audit 2026-07. Ogni "ondata" (wave) raggruppa i fix di uno Sprint; ogni fix ha la propria sottocartella.

📌 **Rimandati/skippati:** l'elenco unico di ciò che abbiamo consapevolmente saltato o rimandato (con motivo e dove si riprende) è in [`DEFERRED_e_SKIPPED.md`](DEFERRED_e_SKIPPED.md).

Questa sezione è il complemento **implementativo** di:
- `security/findings/SPRINT0-DECISIONS.md` — le decisioni approvate.
- `security/DECISIONS.md` — il registro autorevole (DEC-001..008).
- `security/findings/S1.6-remediation-plan.md` — il piano tecnico di remediation.
- `security/execution-log.md` — il log di handover cross-session.

---

## La pipeline (6 step) — da seguire per OGNI fix

Ogni fix segue **esattamente** questi 6 step, nell'ordine. Nessuno step si salta.

| Step | Cosa | Artefatto prodotto |
|------|------|--------------------|
| **1** | Creo la sottocartella del fix dentro la wave dello Sprint corrente | `Sprint0/<ID>_<slug>/` |
| **2** | Scrivo il documento **Idea** — la soluzione in sintesi, comprensibile | `01_Idea.md` |
| **3** | Scrivo il documento **Idea Dettagliata** — espansione massima, precisione su ogni dettaglio (file, righe, firme, edge case, test) | `02_Idea_Dettagliata.md` |
| **4** | **Rileggo** l'Idea Dettagliata, la rianalizzo, verifico la correttezza e correggo quanto serve (sezione "Revisione" in coda a `02`) | aggiornamento di `02_Idea_Dettagliata.md` |
| **5** | Creo la **Checklist di implementazione** — ogni singolo task al minimo dettaglio, con tutte le specifiche | `03_Checklist_Implementazione.md` |
| **6** | **Implemento** seguendo la checklist alla lettera, spuntando ogni task completato | codice + checklist aggiornata |

### Regole operative della pipeline
- **Human gate (§1.4):** ogni fix che tocca semantica economica/core richiede la review di `@Poppo753` prima del merge. Il flusso è **test-red → fix → test-green → review**.
- **Test masking:** se un test esistente passava perché "adattato al bug", va corretto (documentato nel fix relativo).
- **Register:** ad ogni fix completato, i finding coinvolti passano a `state = fixed-pending-verification` in `security/findings/register.json`.
- **Execution log:** ogni fix chiuso aggiunge una entry in `security/execution-log.md`.
- **Encoding:** tutti i file scritti con UTF-8 (lezione appresa: `→` rompe cp1252 su Windows).

---

## Indice delle ondate

### Wave — Sprint 0 (blocker critici pre-deploy)

Ordine di esecuzione approvato da @Poppo753: **C1-09 → C1-08 + C1-04 (insieme) → resto**.

| Fix | Titolo | Decisione | Stato | Cartella |
|-----|--------|-----------|-------|----------|
| **C1-09** | encode-packed-collision in SwapManager | ✅ helper `_pairHash` (abi.encode) | ✅ approvato (attesa commit) | `Sprint0/C1-09_encode-packed-collision/` |
| **C1-08 + C1-04** | Interfaccia universale pair-based + Emergency No-drain | DEC-006/007/008/009 | 🟢 codice DONE + verificato (build verde, Foundry unit 7/7, register aggiornato); manca test Hardhat E2E + storage-layout + Slither (per il merge) | `Sprint0/C1-08+C1-04_interfaccia-universale-emergency/` |
| C1-05 | Morpho HF scale bug | ✅ rimosso `* WAD` errato | 🟢 code done, build verde (test fork da eseguire) | `Sprint0/C1-05_morpho-hf-scale/` |
| C1-06 | minOut end-to-end nei flash-loan callback | proposta | ⚪ non iniziato | — |
| C1-02 | Withdrawal clamp silenzioso | da decidere (A/B) | ⚪ non iniziato | — |
| C1-03 | First-depositor + donation attack | da decidere (A/B) | ⚪ non iniziato | — |
| C1-01 | VALUATION-001 fail-closed | da decidere (A/B/C) | ⚪ non iniziato | — |
| C1-07 | Parameter execution rewrite | da decidere | ⚪ non iniziato | — |

Legenda stato: ⚪ non iniziato · 🟡 in corso · 🟢 test-green (attesa review) · ✅ merged

---

## Decisioni di riferimento (snapshot)

| DEC | Sintesi |
|-----|---------|
| DEC-006 | Interfaccia lending **pair-based** `(collateral, loan, amount)`. Morpho è già corretto; si adattano Aave/Euler. |
| DEC-007 | Emergency **No-drain**: pausa + unwind uniforme (sort-by-risk, stile Euler) + LP withdraw pro-rata. Nessun drain-to-owner. |
| DEC-008 | Access control: `onlyOperator` = owner + registro VAC (A2). Emergency trigger = owner + emergency contacts (B2). VAC = tutte le operazioni di ribilanciamento (C). |
