# C1-09 — CHECKLIST DI IMPLEMENTAZIONE

> Pipeline step 5. Ogni task va spuntato quando completato (step 6). Ordine vincolante.
> Riferimento tecnico: `02_Idea_Dettagliata.md`.

## Legenda
`[ ]` da fare · `[~]` in corso · `[x]` fatto · `[!]` bloccato/problema

---

## Fase A — Preparazione test (rosso)

- [x] **A1** — Verificato il remapping `@openzeppelin` in `foundry.toml` (riga 30: `@openzeppelin/=node_modules/@openzeppelin/`). Già presente. Test collocato in `test/foundry/unit/` (le suite esistenti usano sottocartelle unit/fuzz/invariant/halmos).
- [x] **A2** — Creato `test/foundry/unit/SwapManagerPairHash.t.sol` con:
  - `import "forge-std/Test.sol";`
  - `import {SwapManager} from "../../contracts/SwapManager.sol";` (verificare path relativo corretto rispetto a `test=test/foundry`).
  - `contract SwapManagerHarness is SwapManager` con costruttore `SwapManager(address(0xBEEF), "WETH")` ed `external pure` `pairHash(string,string)` che chiama `_pairHash`.
  - `contract SwapManagerPairHashTest is Test` con i 6 test di §5.3 del doc dettagliato:
    - `test_OldEncodePacked_WasColliding` (documentazione bug class)
    - `test_PairHash_NoCollision_KnownCase`
    - `test_PairHash_NoCollision_MoreCases`
    - `test_PairHash_Deterministic`
    - `test_PairHash_OrderMatters`
    - `testFuzz_PairHash_NoAccidentalCollision`
- [x] **A3** — `forge build` → **FALLITO** come atteso: `Error (7576): Undeclared identifier. Did you mean "pairHash"? return _pairHash(a, b);`. Rosso confermato.

## Fase B — Implementazione fix (verde)

- [x] **B1** — Aggiunto l'helper `_pairHash` in `contracts/SwapManager.sol` (riga ~1114, prima di `_handleSwapError`):
  ```solidity
  /// @notice Chiave canonica dei mapping statistiche swap per coppia di token.
  /// @dev abi.encode (NON encodePacked) per evitare collisioni tra string
  ///      dinamiche ("AB"+"CD" == "ABC"+"D" con encodePacked). Vedi C1-09.
  function _pairHash(string memory a, string memory b) internal pure returns (bytes32) {
      return keccak256(abi.encode(a, b));
  }
  ```
  - Posizione: nella zona helper internal (es. subito prima o dopo `_handleSwapError`, ~riga 1107-1117). Deve stare nel contract, non fuori.
- [x] **B2** — Sostituiti i 5 punti `(spendTokenCode, receiveTokenCode)` via `replace_all` → ora righe 505, 708, 1127, 1168, 1330 usano `_pairHash(spendTokenCode, receiveTokenCode)`.
- [x] **B3** — Sostituito il punto 2 (riga 592) → `_pairHash(spendTokenCode, baseAssetCode)`.
- [x] **B4** — Sostituito il punto 3 (riga 647) → `_pairHash(baseAssetCode, receiveTokenCode)`.
- [x] **B5** — Grep verifica: `abi.encodePacked` in codice = **0** (1 sola occorrenza, nel commento NatSpec dell'helper che spiega cosa NON usare). 7 call site di `_pairHash` confermati via grep.

## Fase C — Verifica (verde)

- [x] **C1** — `forge build` → **verde** (`Compiler run successful with warnings`, solo lint pre-esistenti).
- [x] **C2** — `forge test --match-contract SwapManagerPairHashTest -vv` → **6 test PASS** (fuzz 1000 runs incluso). 39ms.
- [x] **C3** — `forge test` (intera suite) → 11 pass / 4 fail. I 4 fail sono i canary PRE-ESISTENTI di C1-03 (`ShareRounding.fuzz`: shareInflationAttack, conservationOfValue; `LPPoolInvariant`: INV-3 + underflow). Verificato via `grep` che NON citano SwapManager e via `git status` che l'unico contratto modificato è SwapManager.sol → **nessuna regressione**.

## Fase D — Tracciabilità

- [x] **D1** — `register.json`: SLIT-005…SLIT-011 (7 finding = i 7 siti) → `state = "fixed-pending-verification"` + history entry. Scritto con `encoding='utf-8', newline='\n'`, nessun trailing newline (parità col file originale). 379 finding, tutti schema-valid (validati per-item).
- [x] **D2** — `security/execution-log.md`: Entry 017 aggiunta (DEC-008 + pipeline + fix C1-09) + handover aggiornato a 2026-07-27.
- [x] **D3** — README ondate: stato C1-09 → 🟢 test-green (attesa review).
- [x] **D4** — Tutti i task Fase A-D spuntati.

## Fase E — Gate umano

- [x] **E1** — Review @Poppo753: **APPROVATO** l'helper `_pairHash` (2026-07-27, "hai fatto una cosa migliore... procedi").
- [ ] **E2** — Commit: lasciato all'utente (regola: commit solo su richiesta esplicita). Fix in working tree, approvato.

---

## Note di esecuzione (step 6)

- **Toolchain:** forge 1.7.1 (`~/.foundry/bin`, non in PATH → invocato con PATH inline).
- **Compilazione progetto sotto Foundry:** l'intero `contracts/` compila (exit 0), quindi l'import di SwapManager nel test funziona.
- **Red confermato:** `Error (7576): Undeclared identifier` su `_pairHash` prima del fix.
- **Green:** `Suite result: ok. 6 passed; 0 failed` in 38.97ms.
- **File modificati:** `contracts/SwapManager.sol` (helper + 7 siti), `test/foundry/unit/SwapManagerPairHash.t.sol` (nuovo), `security/findings/register.json` (7 finding), `security/execution-log.md` (Entry 017), `security/DECISIONS.md` (DEC-008), README ondate.
- **Nessuna deviazione dall'idea dettagliata** salvo: (a) test collocato in `unit/` non nella root di `test/foundry/`; (b) scelta helper vs inline flaggata al gate di review.
