# Slither baseline burn-down plan

**Ultimo aggiornamento:** 2026-07-15 al commit `786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89`.
**Owner:** `@Poppo753` (DEC-001).
**Review date:** 2027-01-15 (6 mesi dalla creazione).

## 1. Situazione di partenza

- **828 finding** nella baseline iniziale (Slither 0.11.5, solc 0.8.27).
- Suddivisione per severity Slither:
  - 49 High impact
  - 151 Medium impact
  - 571 Low impact
  - 27 Informational
  - 30 Optimization
- Suddivisione per priority triage (metadata `state` nella baseline):
  - 12 `accepted-triage-priority` (High/High)
  - 34 `accepted-triage-review` (Medium/High)
  - 782 `accepted-baseline` (tutto il resto)

## 2. Regola fondamentale

**La baseline non è una whitelist eterna** (checklist §S4.3). Ogni voce accettata deve:
- avere un owner (default `@Poppo753`);
- avere una motivazione;
- avere una review date;
- decadere se cambia la funzione interessata (fingerprint drift → il finding "sparisce" e va rivalutato al prossimo comparator).

**La baseline non va rigenerata per rendere verde una PR** (§S4.3). Se una PR introduce un nuovo finding H/H o M/H, il gate deve fallire e il developer deve:
- fixare il bug, oppure
- documentare in `suppressions.md` con motivazione + reviewer + expiry, oppure
- convertire il finding in un accepted risk esplicito (con firma).

Se emerge il **legitimate need** di aggiornare la baseline (es. refactor architetturale con drift massivo di fingerprint), la PR deve includere:
- una spiegazione in commit message;
- **approvazione security** esplicita (@Poppo753 in fase single-maintainer, DEC-001);
- entry in `security/DECISIONS.md`.

## 3. Piano di riduzione

### Sprint 0 (Deploy blocker) — target riduzione: 12 H/H → 5 H/H

**Priorità 1 — encode-packed-collision (7 H/H)**

Tutti in `SwapManager.sol`:
- L.505 (`swapWithBestPlugin`)
- L.592 (`_swapToBaseAsset`)
- L.647 (`_swapFromBaseAsset`)
- L.708 (`_swapTokenToToken`)
- L.1113 (`_handleSwapError`)
- L.1154 (`getSwapStats`)
- L.1316 (`resetSwapStats`)

Root cause: `keccak256(abi.encodePacked(spendTokenCode, receiveTokenCode))` con 2 string dinamici → collisione teorica se `spend="AB", receive="CD"` == `spend="ABC", receive="D"`. In pratica quasi impossibile ma:
- se un utente riesce a registrare token con codici manipolati, può manipolare `pairHash`.
- se `pairHash` è usato per accounting (swapSuccesses/Errors), collision = accounting mescolato tra pair diversi.

**Fix proposto:** sostituire con `abi.encode` (produce output size-prefixed, no collision).

**Impact:** cambia il valore hash → `swapSuccesses` e `swapErrors` mappings esistenti si "azzerano" (le nuove hash sono diverse). Non è distruttivo (i counter non impattano fondi) ma richiede documentazione.

**Nuovo finding registrato:** `SLIT-001` in `register.json` (da aggiungere in S4.3 close).

**Priorità 2 — arbitrary-send-erc20 (4 H/H)**

Duplicato di `CORE-055`, `CORE-056`, `IFC-027`. Già in `register.json`. Si autoricheiude a Sprint 0 remediation.

**Priorità 3 — uninitialized-state (1 H/H)**

Da localizzare puntualmente. Priorità triage entro fine mese.

### Sprint 1 — target riduzione: 34 M/H → 20 M/H

Focus su Medium/High con impact economico:
- `reentrancy-no-eth` (9) — verificare quali sono su path con fondi.
- `divide-before-multiply` (12) — precision loss.
- `unused-return` (64 totali, non tutti M/H) — potenziali silent failure.

### Sprint 2 — target riduzione: 782 baseline → ~500

- Cleanup dei pattern legittimi (calls-loop) con suppression puntuale + registro.
- Rimozione di `unused-local`, `shadowing-local` in modo mirato.

## 4. Metriche di successo

Dopo Sprint 0:
- Nessun H/H nuovo introdotto per almeno 30 giorni.
- I 12 H/H originali chiusi o convertiti in accepted risk firmati.

Dopo Sprint 1:
- Meno di 15 M/H aperti.
- Ogni M/H aperto ha un fix in-progress con ETA.

Dopo Sprint 2:
- Baseline stabilizzata sotto 500 finding totali.
- Tutti i finding rimanenti hanno owner + motivazione + review date.

## 5. Riesame periodico

Ogni **6 mesi** (prossima: 2027-01-15):
- Ricontrollare la baseline: le suppression con `expiry` scaduto vanno rigenerate o rimosse.
- Aggiornare le motivazioni se il contesto tecnico è cambiato.
- Verificare che nessun accepted risk sia diventato exploitable per drift del codice.
- Registrare la revisione in `execution-log.md`.

## 6. Cosa NON è consentito

- Rigenerare la baseline in modo opportunistico ("git commit baseline.json") per far passare una PR.
- Aggiungere suppression inline senza commento e senza reviewer.
- Escludere un detector globalmente per silenziarlo.
- Marcare finding come `accepted-risk` senza motivazione tecnica scritta.
- Ridurre lo scope (`filter_paths`) per far sparire finding scomodi.

Ogni violazione richiede una entry di rollback in `DECISIONS.md` prima del merge.

## 7. Approvazione modifiche baseline

In fase single-maintainer:
- L'autore della PR può proporre modifica a `baseline.json`.
- L'approval self-review con cooling-off condizionale (DEC-003).
- Al primo deploy mainnet o all'ingresso di un secondo maintainer, l'approval richiede firma di un secondo owner.
