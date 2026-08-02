# Halmos — configurazione e primo check

**Fase checklist:** S8.
**Version pin:** halmos 0.2.0 (con solver Z3 built-in).

## 1. Setup

```bash
pip install halmos --only-binary :all:
halmos --version   # 0.2.0
```

Windows/Python 3.13: usa `--only-binary :all:` per evitare la compilazione di `safe-pysha3` che non ha wheel per 3.13.

## 2. File in questa directory

| File | Ruolo |
|---|---|
| `README.md` | Questo documento. |

I check symbolic vivono in `test/foundry/halmos/*.check.t.sol` (Foundry-compatible test format).

## 3. Comando standard

```bash
cd C:/Personal/TestPOC

# Check singolo
halmos --contract HFScaleSymbolic --function check_hf_alwaysInWAD --loop 3

# Tutti i check nel path halmos/
halmos --match-contract "^HF.*Symbolic$" --root .

# Con json output per CI
halmos --contract HFScaleSymbolic --json-output /tmp/halmos-hf.json
```

Halmos usa `foundry.toml` per solc, remapping, ecc.

## 4. Check attivi

### HFScaleSymbolic.check.t.sol

- `check_hf_alwaysInWAD` — Property HF-001: buggy formula deve fallire (bug PLG-005 dimostrato).
- `check_hf_fixed_alwaysInWAD` — La versione fixed deve passare (nessun counterexample).

**Atteso:**
- `check_hf_alwaysInWAD`: **FAIL** con counterexample concreto (dimostrazione simbolica del bug).
- `check_hf_fixed_alwaysInWAD`: **PASS** (proprietà mantenuta per tutti gli input nel dominio).

## 5. Interpretazione output

Halmos exit codes:
- `0` — tutte le proprietà PASS.
- `1` — almeno una property FAIL con counterexample (bug dimostrato o property errata).
- `2` — timeout/inconclusive.

Counterexample formato:
```
[FAIL] check_hf_alwaysInWAD(uint256,uint256,uint256) (paths: X)
Counterexample:
    collateral = 1000000000000000000000
    debtAssets = 500000000
    lltv = 860000000000000000
```

Un `timeout` NON è una prova di sicurezza. È inconclusive — va documentato e possibilmente rifatto con bound più stretti o `--loop` diverso.

## 6. Target proprietà

Da `security/properties/PROPERTY_CATALOG.md`, i target Halmos-adatti sono:

- `HF-001` (WAD scale HF) — **IMPLEMENTED** in `HFScaleSymbolic.check.t.sol`.
- `LP-005` (rounding bound) — PLANNED.
- `ORC-002` (future timestamp underflow) — PLANNED.
- `SWP-004` (minOut only defense) — PLANNED.

Target NON adatti (fork/state esteso/loop non bounded):
- Aave/Euler/Morpho integration reale.
- LP-001 (state history multi-attore).

## 7. Regola di aggiornamento

- Un check che va in timeout: **NON è passato**. Registrare come `inconclusive` in un log.
- Bound stretti (`vm.assume`) sono necessari — ma non devono eliminare gli scenari interessanti.
- Un counterexample: verificare manualmente che sia sensato e registrarlo come `HAL-NNN` in `register.json`.
