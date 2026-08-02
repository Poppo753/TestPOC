# C1-09 — encode-packed-collision in SwapManager — IDEA

**Fix ID:** C1-09
**Finding:** C1-09 (SPRINT0-DECISIONS.md), cluster encode-packed-collision
**Severity:** medium (latent bug, non tocca fondi oggi)
**Decisione:** ✅ approvata da @Poppo753 — procedi con `abi.encode`
**Ordine:** primo dello Sprint 0 (fix "pilota" per rodare la pipeline)

---

## Il problema in una frase

`SwapManager.sol` calcola l'hash della coppia di token con `abi.encodePacked` in 7 punti, e questo può produrre **collisioni** tra coppie diverse.

## Perché è una collisione

`abi.encodePacked` concatena i byte **senza delimitatori né lunghezze**. Con due `string` a lunghezza variabile:

```
abi.encodePacked("AB", "CD")  →  bytes "ABCD"
abi.encodePacked("ABC", "D")  →  bytes "ABCD"   ← STESSO risultato
```

Quindi `keccak256(abi.encodePacked("AB","CD")) == keccak256(abi.encodePacked("ABC","D"))`.
Due coppie logicamente distinte finiscono sullo **stesso `pairHash`**.

## Perché è grave (e perché non lo è ancora)

- **Oggi:** il `pairHash` è usato solo come chiave dei mapping `swapSuccesses` / `swapErrors` — semplici contatori statistici. Una collisione mescola le statistiche di due coppie, ma **non muove fondi**.
- **Domani (latent):** se qualcuno usasse `pairHash` per una gate condition (es. "solo coppie con >100 swap riusciti possono avere leverage"), la collisione diventerebbe un **exploit path**. Meglio chiuderlo ora che costa 30 minuti.

## La soluzione

Sostituire `abi.encodePacked` con **`abi.encode`** in tutti e 7 i punti.

`abi.encode` codifica ogni argomento in slot da 32 byte con **offset e lunghezza espliciti** per i tipi dinamici (`string`). Il risultato è **non ambiguo**: `abi.encode("AB","CD") != abi.encode("ABC","D")`. La collisione sparisce.

## Effetto collaterale accettato

Il `pairHash` cambia valore → i contatori `swapSuccesses`/`swapErrors` esistenti diventano orfani e ripartono da 0. **Non è distruttivo:** sono statistiche, non fondi, e in fase test il pool è vuoto. Nessuna migrazione necessaria.

## Impatto API

Nessuno. Nessuna firma pubblica cambia. È un cambio interno di calcolo hash.

## I 7 punti (contracts/SwapManager.sol)

| # | Riga | Contesto |
|---|------|----------|
| 1 | 505  | `_performSwap...` success tracking `(spendTokenCode, receiveTokenCode)` |
| 2 | 592  | route via base asset — leg 1 `(spendTokenCode, baseAssetCode)` |
| 3 | 647  | route via base asset — leg 2 `(baseAssetCode, receiveTokenCode)` |
| 4 | 708  | `(spendTokenCode, receiveTokenCode)` |
| 5 | 1113 | `(spendTokenCode, receiveTokenCode)` |
| 6 | 1154 | `(spendTokenCode, receiveTokenCode)` |
| 7 | 1316 | `(spendTokenCode, receiveTokenCode)` |

## Come lo dimostro (test)

Un test Foundry che prova la collisione **prima** del fix (rosso) e la sua assenza **dopo** (verde):
- Costruisce due coppie che collidono con `encodePacked` (`"AB"/"CD"` vs `"ABC"/"D"`).
- Verifica che `keccak256(abi.encodePacked(...))` sono uguali (documenta il bug).
- Verifica che `keccak256(abi.encode(...))` sono diversi (documenta il fix).

→ dettaglio completo in `02_Idea_Dettagliata.md`.
