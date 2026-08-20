# Echidna — configurazione e primo harness

**Fase checklist:** S7.
**Version pin:** Echidna v2.2.5 (in `.github/workflows/echidna-nightly.yml`).

## 1. Contenuto

| File | Ruolo |
|---|---|
| `echidna.yaml` | Configurazione autorevole per tutte le campagne. |
| `README.md` | Questo documento. |
| `corpus/` | Corpus persistente (creato dalla prima run; NON versionato). |

Gli harness Solidity vivono in `contracts/echidna/*.sol` (compilato con la stessa toolchain del progetto).

## 2. Setup locale

**Windows (dev environment):** installazione locale è complessa. Preferire:
- Docker: `docker pull trailofbits/echidna:v2.2.5` + volume mount.
- WSL2 con `apt install echidna` (Ubuntu).

**Linux CI:** action ufficiale `crytic/echidna-action@v2`.

Non è obbligatoria l'installazione locale per Windows — S7 è primariamente nightly-CI-driven.

## 3. Comando standard

```bash
# Locale (via docker su Windows)
docker run --rm -v $(pwd):/src -w /src trailofbits/echidna:v2.2.5 \
  echidna contracts/echidna/EchidnaLPPool.sol \
  --config security/echidna/echidna.yaml \
  --contract EchidnaLPPool

# CI (via action)
# vedi .github/workflows/echidna-nightly.yml
```

## 4. Harness attivi

### EchidnaLPPool.sol

**Coverage properties:**
- `echidna_shareAccounting` — LP-006
- `echidna_noSingleUserProfitAtCost` — LP-003 (donation attack)
- `echidna_noFreeShares` — LP-004

**Attori simulati:** Alice/Bob/Carl fissi + i senders random di Echidna.

**Bound:** amount ∈ [1e6, 1000 ether], donation ∈ [1, 100 ether], shares ∈ [1, userShares].

**Atteso:** `echidna_noSingleUserProfitAtCost` viola in poche migliaia di sequenze (bug NEW-001/003 già catturato dal pilot Foundry).

## 5. Interpretazione output

Echidna produce:
- `corpus/reproducers/*.txt` — sequenze counterexample deterministiche.
- `corpus/coverage/*` — statistiche coverage.
- console output JSON parsabile.

Per convertire un counterexample in test Foundry di regressione:
1. Leggere la sequenza in `corpus/reproducers/`.
2. Tradurre in una funzione `test_regression_LP001_seed_X()` in `test/foundry/regression/`.
3. Verificare che il test fallisca su codice pre-fix e passi post-fix.

## 6. Policy CI

**PR:** Echidna NON gira sulle PR (troppo lento). Gate su Foundry invariant è sufficiente.

**Nightly:** Echidna gira ogni notte con `testLimit: 500000` (via profile CI in workflow).

**Release:** dry-run manuale con `testLimit: 1000000`.

**Blocking:** una property violata blocca il merge di `main` verso `release-*`.

## 7. Corpus persistence

Il `corpus/` locale cresce ad ogni run — Echidna impara e memoria i test più informativi. In CI:
- artifact upload post-run con 60 giorni retention.
- primo run: 0 corpus → learning fase (più lenta).
- run successivi: warm start con corpus → accelerato.

## 8. Regola di aggiornamento

- Non modificare `echidna.yaml` per silenziare property.
- Non abbassare `testLimit` per fare passare un PR.
- Ogni counterexample: registrare in `security/findings/register.json` come `ECH-NNN`.
