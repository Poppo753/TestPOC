# C1-09 — encode-packed-collision — IDEA DETTAGLIATA

> Documento di espansione massima (pipeline step 3). Contiene ogni dettaglio: file, righe,
> firme, edge case, strategia di test, rischi. In coda la **Revisione** (step 4).

---

## 1. Contesto tecnico completo

### 1.1 Dove vive il bug
File: `contracts/SwapManager.sol` (solidity `^0.8.19`, deployato con toolchain 0.8.27).
Contract: `SwapManager is ISwapManager, Ownable, ReentrancyGuard`.

Storage coinvolto:
```solidity
mapping(bytes32 => uint256) private swapErrors;     // riga 55
mapping(bytes32 => uint256) private swapSuccesses;  // riga 58
```
La chiave `bytes32` è l'hash della coppia di token code (string → string).

### 1.2 I 7 punti che calcolano la chiave

| # | Riga | Funzione | Argomenti | Operazione |
|---|------|----------|-----------|------------|
| 1 | 505  | `_performSwapInternal` (fine) | `(spendTokenCode, receiveTokenCode)` | `swapSuccesses[h]++` (write) |
| 2 | 592  | `_swapToBaseAsset` | `(spendTokenCode, baseAssetCode)` | `swapSuccesses[h]++` (write) |
| 3 | 647  | `_swapFromBaseAsset` | `(baseAssetCode, receiveTokenCode)` | `swapSuccesses[h]++` (write) |
| 4 | 708  | `_swap...` (multi-hop success) | `(spendTokenCode, receiveTokenCode)` | `swapSuccesses[h]++` (write) |
| 5 | 1113 | `_handleSwapError` | `(spendTokenCode, receiveTokenCode)` | `swapErrors[h]++` (write) |
| 6 | 1154 | `getSwapStats` (view) | `(spendTokenCode, receiveTokenCode)` | read `swapSuccesses[h]`, `swapErrors[h]` |
| 7 | 1316 | `resetSwapStats` (onlyOwner) | `(spendTokenCode, receiveTokenCode)` | `delete` entrambi |

### 1.3 Vincolo di coerenza (importante)
I punti **6** (read) e **7** (delete) DEVONO produrre lo **stesso** hash dei punti di scrittura (1,4,5) per la stessa coppia logica `(spend, receive)`, altrimenti `getSwapStats`/`resetSwapStats` guarderebbero uno slot diverso da quello scritto durante gli swap. Questo significa:
- **Il fix deve toccare tutti e 7 i punti insieme.** Cambiare solo i write e non i read/reset (o viceversa) romperebbe il collegamento fra scrittura e lettura.
- Poiché il fix applica la **stessa** trasformazione (`encodePacked → encode`) a tutti e 7, la coerenza è preservata by construction.

### 1.4 Nota (fuori scope C1-09, solo osservazione)
I punti 2 e 3 tracciano le due "gambe" di una rotta multi-hop sotto chiavi `(spend, base)` e `(base, receive)`, mentre `getSwapStats(spend, receive)` legge la chiave `(spend, receive)` diretta. Quindi gli swap multi-hop non compaiono in `getSwapStats` della coppia diretta. **Questo è comportamento preesistente e NON è il bug C1-09** — non lo tocchiamo qui (eventuale finding separato di analytics, non di sicurezza).

---

## 2. Perché `abi.encodePacked` collide e `abi.encode` no

### 2.1 encodePacked (packed encoding)
- Concatena i valori **senza padding e senza lunghezze** per i tipi dinamici.
- `abi.encodePacked("AB","CD")` = `0x41 42 43 44` = `"ABCD"`.
- `abi.encodePacked("ABC","D")` = `0x41 42 43 44` = `"ABCD"`.
- → **identici** → `keccak256(...)` identici → collisione di chiave.
- Regola nota (Solidity docs): "se usi `keccak256(abi.encodePacked(a, b))` e sia `a` che `b` sono dinamici, è facile costruire collisioni spostando i caratteri da `a` a `b`". È esattamente questo caso (due `string`).

### 2.2 encode (standard ABI encoding)
- Ogni argomento occupa slot allineati a 32 byte; per i tipi dinamici (`string`) inserisce **offset** e **lunghezza** espliciti.
- `abi.encode("AB","CD")` include `len=2` per il primo e `len=2` per il secondo, in posizioni fisse.
- `abi.encode("ABC","D")` include `len=3` e `len=1`.
- → codifiche **diverse** → hash diversi. Nessuna collisione possibile per costruzione (l'encoding è iniettivo sulla tupla di input).

### 2.3 Costo
- `abi.encode` produce più byte in memoria (padding + offset/len) → keccak su input più lungo → **manciata di gas in più** per chiamata. Irrilevante: questi hash sono calcolati una volta per swap, non in loop. Il costo è trascurabile rispetto a uno swap DEX.

---

## 3. La soluzione: helper `_pairHash` + `abi.encode`

### 3.1 Scelta di design (con motivazione)
Invece di 7 sostituzioni inline `abi.encodePacked → abi.encode`, introduco **un helper unico**:

```solidity
/// @notice Chiave canonica per i mapping di statistiche swap per coppia di token.
/// @dev Usa abi.encode (NON encodePacked) per evitare collisioni tra coppie di
///      string a lunghezza variabile (es. "AB"+"CD" vs "ABC"+"D"). Vedi C1-09.
function _pairHash(string memory a, string memory b) internal pure returns (bytes32) {
    return keccak256(abi.encode(a, b));
}
```

E sostituisco i 7 punti con `_pairHash(x, y)`.

**Perché l'helper e non 7 sostituzioni inline:**
1. **Single source of truth per l'encoding.** Un futuro contributor non può reintrodurre `encodePacked` in un solo punto e disallineare read/write: c'è un solo posto che definisce la chiave. Chiude il bug per sempre, non solo oggi.
2. **Testabilità a livello di contratto.** L'helper è invocabile da una harness di test (`internal pure` → esposto da un contratto figlio), quindi possiamo asserire l'assenza di collisione **sul codice reale**, non solo su un frammento abi replicato nel test.
3. **Rischio comportamentale nullo.** `internal pure`, viaIR + optimizer lo inlina; il bytecode risultante è equivalente a 7 chiamate inline a `abi.encode`.
4. **Leggibilità.** `_pairHash(spend, receive)` dice l'intento; `keccak256(abi.encode(spend, receive))` è rumore ripetuto 7 volte.

**Tradeoff / trasparenza per la review:** questo è leggermente più del cambio letterale "7 righe `encodePacked → encode`" che era stato approvato. Ho scelto l'helper perché è strettamente migliore e rende il fix verificabile. **Se preferisci il cambio puramente minimale** (7 sostituzioni inline, nessun helper, nessuna harness — con test solo a livello abi), è una riga di feedback e lo faccio così. Segnalo la scelta al gate di review.

### 3.2 Diff concettuale
- **Aggiungere** `_pairHash` nella sezione internal/private helper di SwapManager (vicino a `_handleSwapError` o nella zona helper).
- **Sostituire** ai 7 punti:
  - `keccak256(abi.encodePacked(spendTokenCode, receiveTokenCode))` → `_pairHash(spendTokenCode, receiveTokenCode)` (punti 1,4,5,6,7)
  - `keccak256(abi.encodePacked(spendTokenCode, baseAssetCode))` → `_pairHash(spendTokenCode, baseAssetCode)` (punto 2)
  - `keccak256(abi.encodePacked(baseAssetCode, receiveTokenCode))` → `_pairHash(baseAssetCode, receiveTokenCode)` (punto 3)

Dopo il fix, in `SwapManager.sol` non deve restare **nessun** `abi.encodePacked` (verifica con grep = 0 match).

---

## 4. Effetti collaterali e migrazione

- **Chiavi storage cambiano** (encode ≠ encodePacked): i contatori `swapSuccesses`/`swapErrors` scritti col vecchio schema diventano orfani → `getSwapStats` riparte da 0 per tutte le coppie.
- **Distruttività:** nulla di finanziario. Sono contatori statistici. In fase test/POC il pool non ha storia rilevante.
- **Migrazione:** nessuna. Non serve script di reindicizzazione (i dati vecchi sono solo statistiche).
- **API pubblica:** invariata. `getSwapStats`, `resetSwapStats`, `performSwap`, `SwapExecuted`/`SwapFailed` non cambiano firma né semantica osservabile (a parte i contatori che ripartono).

---

## 5. Strategia di test (test-red → test-green)

### 5.1 File
Nuovo: `test/foundry/SwapManagerPairHash.t.sol`.

### 5.2 Harness
```solidity
contract SwapManagerHarness is SwapManager {
    constructor() SwapManager(address(0xBEEF), "WETH") {}
    function pairHash(string memory a, string memory b) external pure returns (bytes32) {
        return _pairHash(a, b);
    }
}
```
Il costruttore di SwapManager richiede solo `beacon != 0` e `baseAssetCode` non vuoto, e **non** chiama il beacon → deploy della harness a costo trascurabile, nessuna dipendenza esterna montata.

### 5.3 Test case

1. **`test_OldEncodePacked_WasColliding()`** — documenta il bug preesistente (non tocca la harness):
   ```solidity
   assertEq(
       keccak256(abi.encodePacked("AB", "CD")),
       keccak256(abi.encodePacked("ABC", "D"))
   ); // il vecchio schema COLLIDEVA
   ```
   Questo è il "rosso" storico: prova perché il fix serviva.

2. **`test_PairHash_NoCollision_KnownCase()`** — il "verde" sul codice reale:
   ```solidity
   assertTrue(h.pairHash("AB","CD") != h.pairHash("ABC","D"));
   ```

3. **`test_PairHash_NoCollision_MoreCases()`** — altri casi noti di shift:
   - `("A","BC")` vs `("AB","C")`
   - `("USD","CETH")` vs `("USDC","ETH")`
   - `("","ABCD")` vs `("ABCD","")`
   Tutti devono dare hash distinti.

4. **`test_PairHash_Deterministic()`** — stesso input → stesso hash (i read/reset devono ritrovare la chiave):
   ```solidity
   assertEq(h.pairHash("WETH","USDC"), h.pairHash("WETH","USDC"));
   ```

5. **`test_PairHash_OrderMatters()`** — `(a,b)` != `(b,a)` (la direzione dello swap è significativa):
   ```solidity
   assertTrue(h.pairHash("WETH","USDC") != h.pairHash("USDC","WETH"));
   ```

6. **`testFuzz_PairHash_NoAccidentalCollision(string a, string b, string c, string d)`** — fuzz: se `(a,b) != (c,d)` come tuple, allora `pairHash(a,b) != pairHash(c,d)` (skip il caso in cui le tuple sono uguali). Prova l'iniettività empiricamente su input casuali.

### 5.4 Ordine di esecuzione della prova
- Prima del fix, `SwapManagerHarness` non compila (non esiste `_pairHash`). Quindi il "rosso→verde" per il fix vero si osserva così: scrivo prima il test con la sola asserzione abi (test 1) → verde subito (documenta il bug); poi implemento `_pairHash`; poi aggiungo la harness + test 2-6 → verdi. Documento entrambi gli stati nel commit/checklist.
- In alternativa scrivo tutti i test subito: la suite non compila finché `_pairHash` non esiste (è il "rosso" di compilazione), poi compila e passa (verde). Uso questo approccio (più pulito come red→green).

### 5.5 Comandi
```bash
forge test --match-path test/foundry/SwapManagerPairHash.t.sol -vvv
```
Prerequisito: remapping `@openzeppelin` presente in `remappings.txt`/`foundry.toml` (verificare in step 6; le suite Foundry esistenti già compilano contratti che importano OZ, quindi dovrebbe esserci).

---

## 6. Rischi e mitigazioni

| Rischio | Probabilità | Mitigazione |
|---------|-------------|-------------|
| SwapManager non compila standalone in Foundry (remapping OZ mancante) | bassa | verificare remappings; le suite esistenti già compilano contratti con OZ |
| Un `abi.encodePacked` residuo sfugge | bassa | grep finale = 0 match in SwapManager.sol |
| Regressione su read/write disallineati | molto bassa | helper unico → impossibile disallineare; test 4 (deterministic) copre |
| Contatori orfani interpretati come "bug" | bassa | documentato in §4; atteso e innocuo |
| Scope creep (helper non richiesto) | — | flaggato al gate di review §3.1; fallback minimale pronto |

---

## 7. Definition of Done
- [ ] `_pairHash` presente, `internal pure`, usa `abi.encode`.
- [ ] 0 occorrenze di `abi.encodePacked` in `contracts/SwapManager.sol`.
- [ ] Tutti e 7 i punti usano `_pairHash`.
- [ ] `test/foundry/SwapManagerPairHash.t.sol` verde (6 test).
- [ ] `forge build` verde (nessuna regressione di compilazione).
- [ ] register.json: finding C1-09 → `state = fixed-pending-verification`.
- [ ] execution-log.md: nuova entry.
- [ ] Review di @Poppo753 prima del merge.

---

## 8. REVISIONE (pipeline step 4 — rilettura e rianalisi)

Rileggo il documento sopra e verifico ogni punto.

**Verifica 1 — I 7 punti sono davvero tutti pairHash?** ✅ Confermato via lettura del sorgente: righe 505, 592, 647, 708, 1113 (write), 1154 (read), 1316 (reset). Grep su `abi.encodePacked` in SwapManager.sol = esattamente 7 match, tutti pairHash. Nessun `encodePacked` legittimo (es. calldata building) da preservare.

**Verifica 2 — Il vincolo di coerenza read/write regge?** ✅ Sì. I punti 6/7 usano `(spend, receive)` come 1/4/5. Applicando lo stesso helper ovunque, read e write restano allineati. Nota: i punti 2/3 (multi-hop legs) usano chiavi diverse già oggi — comportamento preesistente non toccato dal fix. Corretto averlo escluso.

**Verifica 3 — L'helper introduce rischi?** ✅ No. `internal pure`, nessuno stato, nessuna dipendenza. Inline dall'optimizer. Cambia solo il valore della chiave (già previsto in §4).

**Verifica 4 — La harness è davvero deployabile a costo zero?** ✅ Costruttore richiede solo `beacon != address(0)` e `baseAssetCode` non vuoto; nessuna interazione col beacon in costruzione. `new SwapManagerHarness()` con `address(0xBEEF)` e `"WETH"` basta.

**Verifica 5 — Il test red→green è onesto?** ⚠️ Corretto in §5.4: uso l'approccio "la suite non compila finché `_pairHash` non esiste" come rosso di compilazione, poi verde. Il test 1 (asserzione abi su encodePacked) documenta storicamente la collisione ma è verde anche dopo il fix (perché testa l'operatore abi, non il contratto) — quindi NON è il "rosso" del fix, è documentazione. Chiarito: il rosso reale è la mancata compilazione pre-helper. Va bene così, ma nel commit specifico che il test 1 è "documentazione del bug class", non "regression guard del fix". Il regression guard vero è il test 2 (che fallirebbe se qualcuno rimettesse encodePacked nell'helper... ma solo se la harness usasse encodePacked — poiché la harness chiama `_pairHash`, il test 2 fallisce se e solo se `_pairHash` torna a collidere. ✅ è un vero regression guard).

**Verifica 6 — Manca qualcosa?** Una cosa: dopo il fix va rilanciata **l'intera** suite Foundry esistente (non solo il nuovo file) per escludere che qualche test dipendesse dal vecchio valore di pairHash (improbabile: i contatori sono private, letti solo via getSwapStats). Aggiungo alla checklist un task "run full foundry suite".

**Conclusione revisione:** documento corretto nei punti §5.4 (natura del test 1) e §7/checklist (aggiungere run suite completa). Nessun cambio all'approccio di fix. Procedo con la checklist.
