# Slither — configurazione e prima campagna

**Fase checklist:** S3 (Slither report-only). Baseline S4 in fase successiva.
**Commit di riferimento:** `786a5b92d3bb7e60ef0bdfb37a7f07a3f60d7c89` (2026-07-15).
**Versioni fissate:** Slither 0.11.5, solc 0.8.27, Python 3.13.5.

## 1. File in questa directory

| File | Ruolo |
|---|---|
| `slither.config.json` | Configurazione autorevole (detector esclusi, filter_paths). Path canonico da §1.2. |
| `baseline-raw.json` | Output JSON grezzo di Slither (50 MB). Include tutti i dettagli source-mapping. Non versionato in modo standard; usato per triage. |
| `baseline-raw.sarif` | SARIF format per GitHub code scanning (1.1 MB). |
| `baseline-console.txt` | Testo console (288 KB). |
| `baseline.json` | **Baseline compatta** (fingerprint + impact + confidence + file:line). ~420 KB. **Fonte autorevole** per il gate S4. |
| `suppressions.md` | Suppressions per path/detector con motivazione e reviewer. |
| `README.md` | Questo documento. |

## 2. Installazione

### Windows locale (dev environment)

```bash
python -m pip install slither-analyzer solc-select
solc-select install 0.8.27
solc-select use 0.8.27

# Verifica
slither --version   # 0.11.5
solc --version      # 0.8.27+commit.40a35a09
```

### Linux CI (GitHub Actions)

Da configurare in `.github/workflows/slither.yml` in S3.3. Uso dell'action ufficiale `crytic/slither-action@v0.4.0` con:
- `slither-config: security/slither/slither.config.json`
- `fail-on: none` (report-only per S3, prima del gate S4)
- `sarif: security/slither/output.sarif`

## 3. Comando locale unico

```bash
cd C:/Personal/TestPOC

# 1. Assicurarsi che Hardhat compili senza errori
npx hardhat compile

# 2. Eseguire Slither
slither . \
  --config-file security/slither/slither.config.json \
  --json security/slither/baseline-raw.json \
  --sarif security/slither/baseline-raw.sarif \
  > security/slither/baseline-console.txt 2>&1
```

**Exit code:** Slither ritorna il numero di detector che hanno prodotto findings (non è un errore). Exit 0 = zero findings. Exit > 0 = N findings triggered.

## 4. Configurazione applicata

Vedi `slither.config.json`. Riassunto:

- **Filter paths** (esclusi dall'analisi):
  - `test/`, `node_modules/`, `typechain-types/` — non production
  - `contracts/plugins/old/` — legacy (S0.2 §2.1)
  - `contracts/plugins/DolomitePlugin.sol` — non deploy target (S0.2 §2.2)
  - `contracts/mocks/` — mock (S0.2 §3.2)
  - `contracts/MockChainlinkOracle.sol`, `contracts/MockERC20.sol`, `contracts/MockWETH.sol` — mock in root (S0.2 §3.1)
  - `contracts/SwapManager.sol.backup` — backup (S0.2 §2.4)

- **Detector esclusi** (rumore accademico, non falsi positivi silenziati):
  - `naming-convention` — stile
  - `solc-version` — pragma
  - `pragma` — versioning
  - `too-many-digits` — numeric literal style
  - `assembly-usage` — flag informativo, non bug
  - `low-level-calls` — flag informativo (i low-level call sono review-driven)

- **NON esclusi** (deliberatamente):
  - `reentrancy-*` — tutti attivi (High/Med/Low)
  - `arbitrary-send-*` — tutti attivi
  - `unchecked-*` — tutti attivi
  - `uninitialized-*` — tutti attivi
  - `shadowing-*` — tutti attivi
  - `divide-before-multiply` — attivo
  - `weak-prng`, `timestamp` — attivi
  - `unused-return` — attivo
  - `encode-packed-collision` — attivo (**ha trovato 7 finding new, vedi baseline**)

## 5. Risultati della prima campagna (S3.3)

```
Total detector findings:  828
By impact:      High=49, Medium=151, Low=571, Informational=27, Optimization=30
By confidence:  High=98, Medium=730

High/High matrix:  12
Med/High matrix:   34
High/Med matrix:   37
```

### High/High (12) — priorità triage

| Count | Detector | Cross-ref audit |
|---:|---|---|
| 7 | `encode-packed-collision` | **Nuovo finding** — non censito nell'audit 2026-07 (`SwapManager.sol` usa `abi.encodePacked` con più string dinamici per pair hash). Da registrare come `SLIT-001..007` nel register (o come unico `SLIT-ENCODE-COLLISION`). |
| 4 | `arbitrary-send-erc20` | Coerente con `CORE-055`, `CORE-056` (`ProxyGeneral` raw `transferFrom`) e `IFC-027` (`UniswapV3PluginDirect` transferFrom da proxyGeneral). |
| 1 | `uninitialized-state` | **Nuovo finding** — da verificare quale variabile. |

### Top detector by count

```
452  calls-loop                (external calls dentro loop, pattern comune)
 64  unused-return             (return value ignorati)
 50  timestamp                 (uso di block.timestamp)
 37  reentrancy-balance
 33  incorrect-equality
 32  uninitialized-local
 28  reentrancy-events
 26  reentrancy-benign
 22  cache-array-length
 12  divide-before-multiply
 10  costly-loop
  9  reentrancy-no-eth
  8  shadowing-local
  7  encode-packed-collision
  6  events-maths
```

### Compile/tool errors

Nessuno. Slither ha compilato correttamente 99 file Solidity via crytic-compile → Hardhat.

## 6. Policy suppressions

Suppression per path/detector sono gestite via `filter_paths` nel config (per path interi) e via commento in-code `// slither-disable-next-line <detector>` (per linee singole).

**Regola d'oro:**
- Nessuna suppression globale per detector.
- Ogni suppression puntuale richiede commento accanto con:
  - motivazione tecnica;
  - reviewer (`@Poppo753` in fase single-maintainer, DEC-001);
  - condizione di invalidazione (se cambia X, la suppression decade).

Vedi `suppressions.md` per il registro delle suppression attive.

## 7. Interpretazione dei numeri di S3.3

**Non tutti i 828 finding sono bug.** In particolare:
- I 452 `calls-loop` sono in gran parte pattern legittimi (external call dentro un for su tokens). Vanno letti a fondo prima di derivare azioni.
- I 571 Low sono spesso pattern comuni (uso `timestamp`, variabili non usate).
- I 12 High/High sono i **primi da triare** in S4.

## 8. Prossimi passi (S4)

1. Triage puntuale dei 12 High/High e dei 34 Medium/High.
2. Deduplicazione contro il `register.json` esistente (arbitrary-send-erc20 sono già CORE-055/56 + IFC-027).
3. Creazione di finding `SLIT-*` per i nuovi bug (encode-packed-collision, uninitialized-state).
4. Definizione della baseline revisionata (fingerprint stabile + owner + review date).
5. Gate differenziale: PR nuova → fallire su nuovo High/High o Med/High.

Fino a S4 chiuso, il workflow Slither in CI **non blocca**.

## 9. Comando di validazione baseline (post-S4)

```bash
# Comparare una nuova run con la baseline (S4)
slither . --config-file security/slither/slither.config.json \
  --json /tmp/current.json 2>&1 > /dev/null
python security/slither/compare.py \
  --baseline security/slither/baseline.json \
  --current /tmp/current.json \
  --fail-on new-high-high,new-med-high
```

`compare.py` sarà scritto in S4.2.
