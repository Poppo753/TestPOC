# Slither suppressions register

**Ultimo aggiornamento:** 2026-07-15 al commit `786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89`.
**Reviewer:** `@Poppo753` (single-maintainer, DEC-001).

## 1. Regola generale

Nessuna suppression **globale** è ammessa se non per detector che rappresentano rumore stilistico (già esclusi in `slither.config.json`):
- `naming-convention`, `solc-version`, `pragma`, `too-many-digits`, `assembly-usage`, `low-level-calls`.

Suppression **per path** (via `filter_paths` in `slither.config.json`) sono legate direttamente a `security/scope/exclusions.md` e ne condividono le motivazioni.

Suppression **per line/detector** (via commento in-code `// slither-disable-next-line`) sono elencate in questo registro.

## 2. Suppressions per path (auto da filter_paths)

| Path | Motivazione | Ref |
|---|---|---|
| `test/` | Non production | S0.2 §4.1 |
| `node_modules/` | Dipendenze | dep management |
| `typechain-types/` | Generato | auto-gen |
| `contracts/plugins/old/` | Legacy | S0.2 §2.1 |
| `contracts/plugins/DolomitePlugin.sol` | Non deploy target | S0.2 §2.2 |
| `contracts/mocks/` | Mock | S0.2 §3.2 |
| `contracts/MockChainlinkOracle.sol` | Mock in root | S0.2 §3.1 |
| `contracts/MockERC20.sol` | Mock in root | S0.2 §3.1 |
| `contracts/MockWETH.sol` | Mock in root | S0.2 §3.1 |
| `contracts/SwapManager.sol.backup` | Backup | S0.2 §2.4 |

## 3. Suppressions per linea/detector (registro attivo)

Al momento **vuoto**. Nessuna suppression inline è stata applicata.

Formato per future entry:

```
## SUPPR-NNN — <breve titolo>

- File: contracts/X.sol:LINE
- Detector: reentrancy-benign
- Aggiunta: YYYY-MM-DD @ commit XXXXXXX
- Reviewer: @handle
- Motivazione tecnica: <perché il pattern non è un bug in questo contesto>
- Scenario di rischio residuo: <cosa succederebbe se la motivazione diventa invalida>
- Condizione di invalidazione: <se cambia X, la suppression decade automaticamente>
- Expiry / review date: YYYY-MM-DD (max 6 mesi dalla creazione)
- Rispetta DEC-003 cooling-off? <sì / no + motivazione>
```

## 4. Suppression pianificate ma non applicate

### Candidate suppression: `calls-loop` in ValueCalculator/LiquidityManager

**Contesto:** Slither ha marcato 452 `calls-loop` sull'intero progetto. Molti sono in loop legittimi (iterazione su `activeTokens`, ecc.).

**Decisione attuale:** **NON sopprimere**. Il pattern è comune ma va valutato entry-by-entry. Alcuni possono nascondere DoS (loop unbounded su input controllato dall'utente).

**Follow-up:** in S4.1 fare triage entry-by-entry. Se un `calls-loop` è dimostrato safe (owner-only + N bounded), suppression puntuale con `// slither-disable-next-line calls-loop` e entry in questo file.

### Candidate suppression: `timestamp` nei protocolli di lending

**Contesto:** 50 uso di `block.timestamp` — pattern normale in DeFi (deadline, rate accrual).

**Decisione attuale:** **NON sopprimere** globalmente. Alcuni usi sono legittimi (deadline check), altri no (rate-limit bucket in LiquidityManager — vedi NEW-030). Da valutare entry-by-entry.

## 5. Regola di aggiornamento

- Ogni nuova suppression richiede una entry qui **prima** del commit.
- Ogni suppression ha `expiry / review date` (max 6 mesi). Alla scadenza va rivalutata: rimossa o rinnovata con nuova motivazione.
- Il gate S4 differenziale **deve** verificare che nuove suppression siano registrate qui prima di permettere il merge.
- Rimozione di una suppression: aggiornare la entry con `state: removed` + `removed_at`, non cancellare.

## 6. Cross-reference con register.json

Suppression collegate a finding audit (per non silenziare bug reali):

Al momento nessuna. La regola è: **una suppression non può coprire un finding in state `confirmed` o `triaged`** in `register.json`.
