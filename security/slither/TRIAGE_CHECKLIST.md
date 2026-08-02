# Slither triage — protocollo di lavoro

**Fase:** T1 (Slither triage — sotto-fase di S3.3 estesa).
**Commit di riferimento:** `786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89`.
**Slither version:** 0.11.5, solc 0.8.27.

Questo documento definisce **come** classificare uno alla volta i finding di Slither. Applicabile
al primo triage (46 gravi) e a ogni run futura del gate differenziale che introduce nuovi finding.

## 1. Priorità di triage

Ordine obbligatorio:

1. **P1 — 12 High/High** (impact alto + confidence alto). Priorità massima.
2. **P2 — 34 Medium/High** (medium impact ma detector affidabile).
3. **P3 — 37 High/Medium** (potenziale alto impatto ma confidence più bassa).
4. **P4 — 782 Low/Info/Optimization**: skim veloce alla ricerca di pattern sistemici, NON entry-by-entry.

## 2. Stati ammessi post-triage

Ogni finding deve finire in uno di questi 5 stati (mutex):

| Stato | Quando applicarlo | Effetto sul register |
|---|---|---|
| `duplicate` | Slither ha trovato lo stesso bug di un finding già in `register.json` (audit) | crea entry `SLIT-NNN` con `state=duplicate` + `root_finding: <ID audit>` |
| `confirmed` | Nuovo bug reale non censito nell'audit | crea entry `SLIT-NNN` con `state=confirmed`, `confidence=high` |
| `false-positive` | Pattern che Slither segnala ma non è un bug (in contesto motivato) | crea entry `SLIT-NNN` con `state=false-positive` + motivazione |
| `accepted-risk` | Riconosciuto ma non fixato (con firma) | crea entry + entry in `accepted-risk.md` |
| `out-of-scope` | File escluso dallo scope production (es. mock, backup) | crea entry `SLIT-NNN` con `state=out-of-scope` |

## 3. Protocollo per ogni finding (step-by-step)

### 3.1 Identificazione

Per ogni entry in `security/slither/baseline-raw.json`:

1. Leggere `check`, `impact`, `confidence`.
2. Leggere `elements[0].source_mapping.filename_relative` + `lines[]`.
3. Leggere `description` (prima riga).
4. Calcolare fingerprint: `check::file#firstline`.

### 3.2 Search per duplicati

Cercare in `register.json` finding con:
- Stesso `file` (o file collegato per catena di call).
- Stesso pattern semantico (es. `arbitrary-send-erc20` → cercare finding audit su `transferFrom` raw).

Usare `grep` per parole chiave nel field `title` e `impact`:

```bash
python -c "
import json
reg = json.load(open('security/findings/register.json', encoding='utf-8'))
KEYWORDS = ['approve', 'transferFrom', 'nonReentrant', 'arbitrary']  # esempio
for e in reg:
    for k in KEYWORDS:
        if k.lower() in e['title'].lower():
            print(f\"{e['id']}: {e['title']}\")
            break
"
```

### 3.3 Verifica sul codice

Aprire il file al `line_start` indicato. Verificare che il pattern esista **al commit corrente** (`786a5b92`).

Se il codice **non è più presente** → stato `false-positive` con nota "STALE line reference".

### 3.4 Classificazione motivata

Per ogni finding, produrre una motivazione **almeno una frase** in `note` del history entry. Non:
- "Duplicato" (senza dire di cosa).
- "Falso positivo" (senza dire perché).

Sì:
- "Duplicato di CORE-055: `ProxyGeneral.approveSpender:351` usa `IERC20.approve` raw (non SafeERC20); Slither lo ha classificato come `arbitrary-send-erc20` perché lo spender può essere plugin arbitrario, ma è già coperto dal fix Sprint 0 di CORE-055."
- "Falso positivo: `SwapManager._getActivePlugin` legge `simpleSwapRouter` da state var, ma è settato solo da funzioni onlyOwner → non c'è arbitrary send in senso Slither. Suppression NON applicata perché sarebbe visibile su nuovi PR."

### 3.5 Registrazione

Aggiungere entry a `security/findings/register.json` con schema completo:

```json
{
  "id": "SLIT-NNN",
  "title": "<check>: <first line description>",
  "commit": "786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89",
  "component": "<file production>",
  "location": { "file": "...", "line_start": N, "line_end": N },
  "category": "<mapping check → category>",
  "severity": "<H|M|L mapping da Slither impact>",
  "confidence": "<H|M mapping da Slither confidence>",
  "state": "duplicate|confirmed|false-positive|accepted-risk|out-of-scope",
  "root_finding": "<ID audit se duplicate>",
  "actor": "<attore stimato>",
  "impact": "<cosa succede se sfruttato>",
  "history": [{
    "date": "2026-07-15",
    "state": "<stato scelto>",
    "commit": "786a5b92...",
    "actor": "agent-T1-slither-triage",
    "note": "<motivazione dettagliata>"
  }]
}
```

Numerazione `SLIT-001` in poi, sequenziale.

### 3.6 Cross-linking

Se `duplicate`, aggiungere `SLIT-NNN` a `sub_findings` dell'entry audit corrispondente.

## 4. Mapping check → category (per campo `category` schema)

| Slither detector | Category schema | Motivazione |
|---|---|---|
| `arbitrary-send-*` | `access-control` | Uscita di fondi verso indirizzo controllato |
| `encode-packed-collision` | `logic` | Hash collision su pair identifier |
| `uninitialized-*` | `storage` | Storage non inizializzato |
| `reentrancy-eth`, `reentrancy-no-eth` | `reentrancy` | Reentrancy con fondi/state |
| `reentrancy-benign`, `reentrancy-events` | `reentrancy` | Reentrancy senza asset diretti a rischio |
| `unused-return` | `logic` | Silent failure di transfer/call |
| `unchecked-transfer` | `logic` | Come sopra ma specifico per ERC20 |
| `divide-before-multiply` | `precision` | Precision loss |
| `timestamp` | `mev` | `block.timestamp` manipolabile |
| `weak-prng` | `mev` | Randomness debole |
| `shadowing-*` | `logic` | Override accidentale |
| `calls-loop` | `gas` | Costo O(n) su input |
| `costly-loop` | `gas` | Loop non ottimo |
| `cache-array-length` | `gas` | Optimization |
| `incorrect-equality` | `logic` | == su address/state |
| `dead-code` | `code-quality` | Codice non raggiungibile |

## 5. Mapping severity Slither → severity schema

Slither ha 5 livelli (High, Medium, Low, Informational, Optimization). Nel nostro schema abbiamo 5 severity (critical, high, medium, low, info).

- Slither `High/High` (impact + confidence) → schema `high` (mai `critical` senza verifica manuale addizionale)
- Slither `Medium/High` → schema `medium`
- Slither `High/Medium` → schema `medium` (confidence lower degrade la severity effettiva)
- Slither `Low` → schema `low`
- Slither `Informational`, `Optimization` → schema `info`

**Escalation manuale a `critical`:**
Solo se il triager verifica direttamente sul codice che il pattern porta a **perdita fondi in scenario esplicitamente reachable**. La escalation richiede reviewer (DEC-001: `@Poppo753` in fase single-maintainer).

## 6. Regola d'oro triage

**Non sopprimere per far passare la CI.**

Se un finding è vero e non lo puoi fixare subito → `state=accepted-risk` con motivazione + trigger di invalidazione, MAI `false-positive` per convenienza.

## 7. Skim dei 782 baseline (P4)

Non entry-by-entry. Approccio "pattern hunting":

### 7.1 Query di aggregazione

```python
# Aggregare per (check, file, function) e cercare cluster sospetti
from collections import Counter
findings = json.load(...)
by_check_file = Counter()
for r in findings:
    if r['impact'] in ['Low', 'Informational', 'Optimization']:
        key = (r['check'], r.get('file', 'unknown'))
        by_check_file[key] += 1

# Top 20 cluster
for (check, file), count in by_check_file.most_common(20):
    print(f"{count:>3}  {check}  {file}")
```

### 7.2 Pattern di sospetto (fuori dai 46 gravi)

- **`unused-return` in path economici** (deposit/withdraw/swap) → potenziale silent transfer failure. Da verificare individualmente.
- **`timestamp` in funzioni di rate-limit / bucket** → possibile manipolazione validator (NEW-030 già sospettato).
- **`incorrect-equality` in path critici** → strict-equality su address zero, o su state var che potrebbe cambiare.
- **`uninitialized-local` in loop iteration** → possibile off-by-one o uso di zero-default.
- **`reentrancy-benign` in emergency path** → benign non significa safe in emergency.

Per ogni cluster sospetto (> 5 occorrenze in path economici):
- Aggiungere entry `SLIT-CLUSTER-NNN` in register con `severity=low` `state=triaged` + description del cluster.
- **Non** registrare le singole occorrenze (rumore).

### 7.3 Output atteso skim

- 3-8 pattern registrati come `SLIT-CLUSTER-*`
- Nessuna modifica al codice production
- Nota nell'`execution-log` degli aggregati esaminati e degli aggregati skippati

## 8. Timing e reviewer

- **Triage 46 gravi:** 4-8 ore agente (background OK).
- **Skim 782:** 1-2 ore agente.
- **Review:** `@Poppo753` legge il summary post-triage, approva/richiede modifiche.

## 9. Deliverable

Al termine:

1. **`security/findings/register.json`** aggiornato con:
   - 46 nuove entry `SLIT-001..SLIT-046` (o range appropriato per i realmente registrati — alcuni potrebbero essere skippati se duplicati esatti).
   - History entry per ognuno.
   - Cross-link `sub_findings` verso audit finding per i duplicati.
2. **`security/slither/TRIAGE_REPORT.md`** (nuovo): summary con conteggio per stato + lista dettagliata.
3. **`security/execution-log.md`** Entry 014 aggiornato.
4. **`register.json` continua a validare** contro `schema.json` (test in CI job `findings-schema`).

## 10. Anti-pattern da evitare

- **Auto-classificare tutti H/H come `confirmed`** senza verifica → falsi positivi entrano nel register.
- **Marcare come `duplicate` senza indicare il finding root** → cross-link rotto.
- **Silenziare massivamente `reentrancy-*` come benign** → i 37 reentrancy-* meritano triage individuale.
- **Ridurre lo scope Slither** (`filter_paths` più aggressivo) per far scomparire finding → è baseline manipulation.
- **Aggiungere suppression inline** per far passare tutto → richiede reviewer per §S4.1.

## 11. Handover

Il file `TRIAGE_REPORT.md` deve concludere con:
- Prossimo task esatto (es. "iniziare S9 Ciclo 1 con C1-05 Morpho HF").
- Findings che richiedono decisione umana (es. borderline severity).
- Cross-reference con `S1.6-remediation-plan.md` per bug che dovrebbero rientrare nei fix di Sprint 0.
