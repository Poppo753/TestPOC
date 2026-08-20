# Security findings — registro autorevole

## 1. File in questa directory

| File | Ruolo |
|---|---|
| `schema.json` | JSON Schema draft 2020-12 che valida ogni entry del registro. |
| `register.json` | Registro autorevole di tutti i finding (production). |
| `accepted-risk.md` | Firma umana per accepted risk (formato Markdown, controfirmato dal reviewer). |
| `README.md` | Questo documento. |

Il registro deve essere l'**unica** fonte di verità operativa. Altri documenti (es. `docs/audit_2026_07/ISSUES.md`) restano come storicità/narrativa ma non sono più autorevoli dopo S1.

## 2. Ciclo di vita di un finding

```
candidate ─────► triaged ─┬─► confirmed ──► fix-in-progress ──► fixed-pending-verification ──► closed
                          ├─► false-positive
                          ├─► duplicate  (richiede root_finding o aliases)
                          ├─► accepted-risk  (richiede firma in accepted-risk.md)
                          └─► out-of-scope
```

Un finding **non** può passare a `closed` senza:
- fix.commit valorizzato,
- regression.was_red_before_fix = true (o motivazione registrata),
- last_verified aggiornato,
- reviewer valorizzato,
- entry in history con lo stato `closed`.

## 3. Cosa NON è un finding

- Debiti tecnici puri (naming, refactor) → tracciare in issue GitHub, non qui.
- Suggerimenti gas non riproducibili → categoria `gas`, severity `low` o `info`; ammessi ma flagged.
- Documentazione mancante → categoria `docs`, severity `info`.

## 4. Validazione

Comando manuale (verrà automatizzato in S2):

```bash
# validare register.json contro schema.json
npx ajv-cli validate -s security/findings/schema.json -d security/findings/register.json --spec=draft2020

# in alternativa con Python:
python -c "import json, jsonschema; \
  s=json.load(open('security/findings/schema.json')); \
  d=json.load(open('security/findings/register.json')); \
  jsonschema.validate(d, {'type':'array','items':s})"
```

Il registro è un array di oggetti conformi allo schema.

## 5. Convenzioni ID

Vedi `schema.json` → `$defs.id_prefix_convention`.

Nuove famiglie di finding (es. da Slither, Echidna, Halmos) usano prefissi dedicati (`SLIT`, `ECH`, `HAL`) per non collidere con i prefissi dell'audit manuale.

## 6. Deduplicazione

Due finding sono duplicati quando **condividono root cause e remediation**, anche se hanno scenari diversi.

- Il duplicato passa a stato `duplicate` con `root_finding` valorizzato.
- Il canonico raccoglie gli scenari come `sub_findings`.
- Nessun ID viene cancellato: la storia è preservata via `history`.

Esempio (VALUATION-001):

```
VALUATION-001 Critical valuation fail-open (root)
├── CORE-049 token silent zero
├── NEW-028 token silent zero — attack scenario (duplicate di CORE-049)
├── ADP-018 Lens failure masked
├── CORE-052 Euler legacy fallback
└── PLG-037 health adapter max mask
```

## 7. Reviewer e accepted risk

- Al momento single-maintainer (`Poppo753`).
- Cooling-off period **disabilitato** in fase test (DEC-003).
- Ogni accepted risk viene comunque registrato in `accepted-risk.md` con:
  - motivazione tecnica;
  - scenario di rischio residuo;
  - trigger di invalidazione automatica (se cambia X, l'accepted risk decade).
- Al primo deploy mainnet il cooling-off si riattiva automaticamente (DEC-003).

## 8. Manutenzione

- Le modifiche a `register.json` devono passare per PR (quando la CI sarà pronta).
- Nessuna cancellazione: gli ID rimossi restano nel registro con stato `false-positive` o `duplicate` per storicità.
- La `history` di ogni entry deve essere append-only: gli agent non riscrivono le entry esistenti, solo aggiungono nuove.
