# Sprint 0 — decisioni da approvare

**Data:** 2026-07-17
**Autore preparazione:** agente
**Reviewer richiesto:** `@Poppo753`
**Riferimenti:** `security/findings/S1.6-remediation-plan.md` (dettaglio tecnico)

## Come leggere questo documento

Per ognuno dei 9 blocker Sprint 0 trovi:

- **Problema** — cosa non va, in una frase.
- **Perché è grave** — impact concreto.
- **Proposta agente** — la mia proposta di soluzione.
- **Alternative** — se ce ne sono, con trade-off.
- **Impact API** — se il fix cambia signature/behaviour visibile all'esterno.
- **La domanda che ti faccio** — cosa devo sapere per procedere.

## Come rispondere

Alla fine del documento c'è la **cheat sheet** con solo le domande. Puoi rispondere in 4 modi per ognuna:

- ✅ **"Ok, procedi con la proposta"** — il caso più semplice.
- 🔄 **"Opzione X"** — quando ho proposto più opzioni.
- ✏️ **"Cambia così: [descrizione]"** — se vuoi una variante.
- ⛔ **"Blocca — non fare"** — se non vuoi il fix (diventa `accepted-risk`).

---

## Blocker C1-09 — encode-packed-collision in SwapManager

### Problema
`SwapManager.sol` calcola l'hash della coppia (spendTokenCode, receiveTokenCode) con `abi.encodePacked` in 7 punti. Due coppie diverse possono produrre lo stesso hash: `"AB"+"CD"` == `"ABC"+"D"`.

### Perché è grave
Attualmente il hash è usato solo per i counter `swapSuccesses` e `swapErrors` — statistiche, no soldi diretti. Ma è un **latent bug**: se in futuro qualcuno usa `pairHash` per gate condition (es. "solo pair con >100 success possono avere leverage"), la collisione diventa exploit path. Meglio fixarlo ora quando costa 30 minuti.

### Proposta agente
Sostituire `abi.encodePacked(spendTokenCode, receiveTokenCode)` con `abi.encode(spendTokenCode, receiveTokenCode)` in tutti i 7 punti. `abi.encode` produce output size-prefixed, elimina la collisione.

### Alternative
Nessuna alternativa sensata. `abi.encode` è la best-practice universale.

### Impact API
- **Storage cambia:** i mapping `swapSuccesses` e `swapErrors` sono keyed by hash. Il nuovo hash è diverso → i counter esistenti restano orfani (partono da 0). Non è distruttivo per fondi, i counter sono statistica.
- **API pubblica:** nessun cambio.

### Domanda #1
✅ Procedi con `abi.encode`? (default se non rispondi diversamente)

---

## Blocker C1-08 — Migrazione a interfaccia universale pair-based ✅ DECISO (DEC-006)

> **STATO: DECISO il 2026-07-17.** Opzione A (pair-based) approvata da @Poppo753.
> Documento di design completo: `security/design/UNIVERSAL_LENDING_INTERFACE.md`.
> Decisione registrata: `security/DECISIONS.md` DEC-006.

### Problema
`ProtocolManager` chiama `ILendingProtocol(plugin).borrow(tokenCode, amount)` (interfaccia mono-token, Aave-centrica), ma `MorphoPlugin` implementa `borrow(collateralCode, loanCode, amount)` (pair-based). Quando ProtocolManager punta a Morpho → **selector non trovato → reverta** (IFC-004). Inoltre il bypass `owner()` nei modifier ha nascosto questo bug (PLG-084).

### Perché è grave
L'integrazione Morpho non funziona via ProtocolManager. E l'interfaccia a 1 token non generalizza ai lender futuri (è il caso particolare Aave).

### Decisione presa (era Proposta, ora APPROVATA)
**Migrazione a interfaccia universale pair-based (NON overload):**
1. `ILendingProtocol` diventa pair-based: `(string collateral, string loan, uint256 amount)` per ogni operazione.
2. Nuova `ILeverageProtocol` con `OpenLeverageParams`/`CloseLeverageParams` (include `minCollateralAfterSwap`, `maxSlippageBps`).
3. `ProtocolManager` unico punto di ingresso: espone supply/withdraw/borrow/repay/openLeverage/closeLeverage + `onlyOperator`.
4. Rimozione bypass `owner()` (chiude PLG-084) + escape hatch `emergencyClosePosition` onlyOwner.
5. Migrazione: **Morpho già corretto** (solo override); Aave/Euler aggiungono il param collateral; MorphoVault supply-only.
6. Test riscritti come user-journey via ProtocolManager.

### Ribaltamento vs proposta originale
Non "aggiungere overload dual-token a Morpho" ma "migrare tutti a pair-based". **Morpho non si tocca**, si adattano Aave/Euler. È l'interfaccia a 1 token quella da abbandonare (Aave-centrica, non universale).

### Impact API
- **Breaking**: `ILendingProtocol` riscritta. Tutti i plugin + ProtocolManager + Lens adapter + script + test da aggiornare.
- Chiude: IFC-004, PLG-084, IFC-022/23/24, parzialmente PLG-030..035.

### Domanda #2 — ✅ RISPOSTA REGISTRATA
✅ **DECISO: migrazione pair-based (Opzione A).** Vedi DEC-006 + `UNIVERSAL_LENDING_INTERFACE.md`.
Stima: 8-16 ore (blocker più grande dello Sprint 0).

---

## Blocker C1-04 — Emergency selector rotto (CRITICAL)

### Problema
`EmergencyHandler.emergencyWithdraw()` chiama `IProxyGeneral(proxy).emergencyTransfer(token, amount, to)`. Ma **`ProxyGeneral.emergencyTransfer(...)` non esiste** — c'è solo `emergencyTransferAll(recipient)`. Ogni chiamata reverta, il `try/catch` intorno la nasconde, l'evento `EmergencyWithdrawCompleted(0, 0, N)` viene emesso ma **0 asset trasferiti**.

Inoltre `emergencyWithdraw()` non ha `whenPaused` → se fixiamo il selector, diventa **backdoor rug** (owner può drenare senza pausare).

Inoltre `emergencyTransferAll` sweepa solo base asset + ETH, i token secondari restano bloccati.

### Perché è grave
**In una vera emergenza, il path standard non funziona.** Anche il flag "emergencyExecuted = true" viene comunque settato a fine loop → non si può ritentare. Combinato con NEW-018 (no `whenPaused`), il fix del selector aprirebbe una backdoor.

### Decisione presa — ✅ "No drain" (Opzione 1, DEC-007)

> **STATO: DECISO il 2026-07-17.** Modello "No drain" approvato da @Poppo753 ("deve implementare soluzione 1 no drain").
> Decisione registrata: `security/DECISIONS.md` DEC-007.
>
> **Ribaltamento vs proposta originale:** NON fixare `emergencyWithdraw`-to-owner, ma **rimuoverlo**. Un drain-to-owner è un rug vector; i protocolli reputati (Aave/Yearn) non ce l'hanno.

**Design "No drain":**
1. **Rimuovere** `emergencyWithdraw()`-to-owner + `emergencyTransfer`/`emergencyTransferAll`-verso-owner. Nessuna funzione permette all'owner di prendere custody dei fondi.
2. **Emergenza = pausa + unwind + LP withdraw:**
   - `pause()` ferma nuovi deposit/posizioni
   - **unwind uniforme** su tutti i plugin: chiude TUTTE le posizioni (leverage + supply) → base asset in ProxyGeneral
   - modalità "withdraw-only": gli LP ritirano pro-rata via `LiquidityManager.withdraw`
3. Layer opzionale futuro (NON v1): recovery timelocked (7gg) verso multisig != owner, SOLO se il withdraw normale è rotto.

**Finding chiusi (rimossi, non fixati):** CORE-001, CORE-015, NEW-018, CORE-010, NEW-010.

**Prerequisito:** risolvere l'incoerenza di `closePositionsForBaseAsset` (Aave=solo supply, Euler=solo leverage, Morpho=solo base-collateral, MorphoVault=tutto). Serve semantica uniforme "unwind TUTTO a base asset" — si aggancia a C1-08 (interfaccia universale). Nuovo finding: **EMERGENCY-UNWIND**.

### Impact API
- **Rimozione**: `emergencyWithdraw()`, `emergencyTransfer(a,u,r)`, `emergencyTransferAll(recipient)` verso owner.
- **Aggiunta/modifica**: funzione di unwind uniforme (probabilmente `ProtocolManager.emergencyUnwindAll()` che itera i plugin) + modalità withdraw-only.
- Script off-chain / VAC: aggiornare (non c'è più drain, c'è unwind + withdraw).

### Domanda #3 — ✅ RISPOSTA REGISTRATA
✅ **DECISO: "No drain" (Opzione 1).** Vedi DEC-007. Trade-off accettato: nessuna botola di drain; il path withdraw+unwind va coperto da property test robusti prima del deploy.

---

## Blocker C1-05 — Morpho HF scale bug (CRITICAL)

### Problema
`MorphoPlugin._computeHealthFactor` linea 1009 e `MorphoLensAdapter._computeMarketHF` linea 178 hanno la stessa formula sbagliata:
```solidity
return (collateralValue * params.lltv) / (debtAssets * WAD);
```

Il `* WAD` in denominatore è di troppo. La formula corretta è:
```solidity
return (collateralValue * params.lltv) / debtAssets;
```

Risultato: HF viene ritornato come intero raw (1, 2, 3) invece che in scala WAD (1e18, 2e18, 3e18). `MIN_HEALTH_FACTOR = 1.05e18` non viene mai raggiunto → **`openLeverageAtomic` reverte SEMPRE** su Morpho.

### Perché è grave
La feature "atomic leverage" su Morpho è **completamente inutilizzabile**. E il monitoring dashboard vede posizioni sane come "liquidazione imminente" (falso allarme).

### Proposta agente
1. **Rimuovere** il `* WAD` dal denominatore in entrambi i punti.
2. **Importare** la libreria ufficiale Morpho `SharesMathLib` con `VIRTUAL_ASSETS = 1` e `VIRTUAL_SHARES = 1e6` per `toAssetsUp` invece della formula manuale (chiude anche ADP-039).
3. **Aggiornare** il test Hardhat corrente `test/integration/morpho/MorphoPlugin.fork.test.ts` linea 674 che oggi passa `minHealthFactor: 1` (adattato al bug!) → cambiarlo a `1.05e18`.

### Alternative
Nessuna sensata. È un bug matematico chiaro.

### Impact API
- **Return value cambia scala**: da raw a WAD. Breaking change per chi legge HF da MorphoPlugin/MorphoLensAdapter e lo confronta con costanti (es. `hf >= 1`).
- Script off-chain, dashboard, VAC: da aggiornare.

### Domanda #4
✅ Procedi con fix + SharesMathLib import + correzione test masking?

---

## Blocker C1-06 — minOut end-to-end nei flash-loan callback

### Problema
- 3 plugin (Aave, Euler, Morpho) memorizzano `maxSlippageBps` in `_flashLoanContext` ma **non lo leggono mai** durante le callback.
- 3 `openLeverageAtomic` non accettano `minCollateralAfterSwap`.
- `IFlashLoanService.swap(tokenIn, tokenOut, amountIn)` non accetta `minAmountOut`.
- `UniswapV3PluginDirect.inputSwap` usa `amountOutMinimum: 0` (MEV totale).
- `SwapManager.swapWithBestPlugin` verifica solo il quote pre-swap, non il balance delta post-swap.

### Perché è grave
Ogni flash loan callback è **esposto a sandwich attack** senza protezione. Combinato con `getExpectedOutput` che usa spot `slot0` (PLG-021), un attaccante può manipolare il pool per estrarre il massimo consentito dal quote.

### Proposta agente
**Cambio coordinato di 3 signature:**
1. **`IFlashLoanService.swap(...)` → `swap(..., uint256 minAmountOut)`**: nuova firma con parametro obbligatorio.
2. **`OpenLeverageAtomicParams` aggiunge `minCollateralAfterSwap`**: nuovo campo obbligatorio per l'utente.
3. **`SwapManager.swapWithBestPlugin`**: verifica il balance delta post-swap, non solo quote pre-swap.
4. **`UniswapV3PluginDirect.inputSwap/outputSwap`**: aggiungere `deadline` esplicito propagato dal caller (invece di `block.timestamp` tautologico).
5. **Enforce `maxSlippageBps` nei callback**: calcolare `minAmountOut = expectedOut * (10000 - maxSlippageBps) / 10000` prima di chiamare swap.

### Alternative
- Alternativa: usare TWAP invece di quote spot. Rifiutata: complessità alta, richiede TWAP oracle setup per ogni pair.
- Alternativa: cap globale su slippage in `ParameterManager`. Ok, complementare non sostitutivo.

### Impact API
- **Breaking**: `IFlashLoanService.swap` cambia firma. Ogni plugin che la chiama deve aggiornare.
- **Breaking**: `OpenLeverageAtomicParams` ha nuovo campo obbligatorio.
- **Breaking**: `ISimpleSwap.inputSwap`/`outputSwap` cambia firma.

### Domanda #5
✅ Procedi con cambio di 3 signature in modo coordinato (una PR unica per non spezzare integrazioni)?

---

## Blocker C1-02 — Withdrawal clamp silenzioso (CRITICAL)

### Problema
`LiquidityManager._withdrawInternal` linea 329:
```solidity
if (newBalance < netWithdraw) {
    netWithdraw = newBalance;  // ← silent clamp
}
proxy.burn(msg.sender, _shares);  // ← burn TUTTE le shares
```

Se il pool non ha abbastanza liquidità dopo auto-swap, l'utente **riceve meno del previsto ma perde tutte le shares comunque**.

### Perché è grave
Perdita silente per LP. Nessun revert, nessuna notifica → l'utente pensa di aver ricevuto quanto voluto ma ha perso valore.

### Proposta agente
**Due opzioni:**

**Opzione A (raccomandata)**: revert se `newBalance < netWithdraw`. L'utente riprova con `_shares` minore.
- Pro: chiaro, no perdita silente
- Con: UX rigido, richiede all'utente di calcolare quanto shares può withdraw in periodi di illiquidità

**Opzione B**: burn shares **proporzionali** al `newBalance`. Es. voleva 100 base asset per 10 shares → riceve 80 → brucia 8 shares (proporzionale).
- Pro: UX friendly, no revert
- Con: cambia il concetto di "shares" — non più fixed exchange rate

**Aggiunta comune (entrambe le opzioni):**
- Nuovo parametro obbligatorio `withdraw(uint256 shares, uint256 minAmountOut)`. L'utente specifica il minimo accettabile.
- Se `receivedAmount < minAmountOut` → revert.

### Impact API
- **Breaking**: `withdraw(uint256 shares)` diventa `withdraw(uint256 shares, uint256 minAmountOut)`.
- Script off-chain, VAC: da aggiornare.

### Domanda #6
- 🔄 **Opzione A** (revert su illiquidità) o **Opzione B** (burn proporzionale)?
- ✅ Aggiunta `minAmountOut` obbligatorio in entrambe le opzioni?

---

## Blocker C1-03 — First-depositor + donation attack

### Problema
Nessuna protezione al primo deposito. Un attaccante:
1. Fa bootstrap con 1 wei (`totalSupply = 1`, `poolBalance = 1`)
2. Dona direttamente 1 base asset al proxyGeneral (`poolBalance = 1 + 1e18`, `totalSupply = 1`)
3. Vittima deposita 2 base asset → riceve `2e18 * 1 / (1e18 + 1) = 1` share
4. Attaccante withdraw sua 1 share → riceve metà del pool

### Perché è grave
Classic ERC-4626 vulnerability. **NEW-001/003 dimostrato dal pilot Foundry in 2 runs.**

### Proposta agente
**Due opzioni per la protezione (non mutuamente esclusive, meglio entrambe):**

**Livello 1 — Bootstrap protection (una tra):**

**Opzione A — Minimum liquidity (Uniswap V2 style)**: al primo deposit, mint `MINIMUM_LIQUIDITY = 1e3` shares a `address(0)` (bruciate per sempre). Costo: primo depositor perde 1e3 shares.
- Pro: semplice, ampiamente testato in produzione (Uniswap V2)
- Con: primo depositor paga un "toll" fisso

**Opzione B — Virtual shares (OZ ERC4626 style)**: setta `_decimalsOffset = 6`. Le formule usano `totalShares + 10^offset` come denominatore. Costo: leggera dilution costante.
- Pro: no primo depositor toll
- Con: più complesso da spiegare, tolerance costante nel pricing

**Livello 2 — Tracked balance (obbligatorio in entrambi i casi):**
- Introdurre `_totalDeposited[tokenCode]` mapping aggiornato solo su deposit/withdraw ufficiali.
- `ValueCalculator.getTotalPoolValue` legge `min(balanceOf, _totalDeposited)` invece di solo `balanceOf`.
- Donation dirette al proxyGeneral **non impattano il NAV**.

**Livello 3 — minLpTokensOut (obbligatorio):**
- `deposit(uint256 amount)` diventa `deposit(uint256 amount, uint256 minLpTokensOut)`.
- Revert se `sharesReceived < minLpTokensOut`.
- Protegge da manipolazione di NAV in-blocco.

### Impact API
- **Breaking**: `deposit(uint256)` → `deposit(uint256 amount, uint256 minLpTokensOut)`.
- **`DepositHelper.depositETH` idem**: `depositETH(uint256 minLpTokensOut)`.
- **Nuovo mapping storage** `_totalDeposited` in ProxyGeneral. Migrazione necessaria: al deploy fresh non c'è. Su un pool esistente serve inizializzarlo con i balance correnti.
- **Nuova costante** `MINIMUM_LIQUIDITY` in LiquidityManager (se Opzione A).

### Domanda #7
- 🔄 **Bootstrap: Opzione A** (minimum liquidity) o **Opzione B** (virtual shares)?
- ✅ Tracked balance `_totalDeposited` obbligatorio (default sì).
- ✅ Aggiunta `minLpTokensOut` obbligatorio a deposit (default sì).

---

## Blocker C1-01 — VALUATION-001 fail-closed (root)

### Problema
Il NAV del pool viene calcolato sommando: token balance + protocol positions. Se un token oracle fallisce **`ValueCalculator.getTotalPoolValue` continua silenziosamente** con quel token a 0. Il NAV è parziale ma **spacciato come completo**. Deposit/withdraw normali procedono su NAV falso.

Coinvolge 9 sub-findings: silent zero on oracle failure (CORE-049), Lens fail-open (ADP-018/IFC-010), legacy Euler fallback (CORE-052), stale price mask (CORE-044), circuit breaker inerte (ADP-003), health mask con max (PLG-037), reserve ratio pre-swap (CORE-075).

### Perché è grave
**Sistemico.** Un attaccante che riesce a far fallire temporaneamente un oracle (es. stale timestamp) → NAV sottostimato → deposit al prezzo scontato → oracle torna online → withdraw a NAV pieno = profit.

### Proposta agente
**Ristrutturare `ValueCalculator` in due API distinte:**

1. **`getTotalPoolValueStrict()` (usata dai path economici)**:
   - Se anche un solo token/Lens fallisce → **revert** con errore custom `NAVInvalidComponent(tokenCode)`.
   - Chiamata da: `LiquidityManager.deposit/withdraw`, `ProtocolManager.rebalance`, `VAC` per operazioni economiche.

2. **`getTotalPoolValueBestEffort() returns (uint256 value, bool isValid, address[] failedTokens)` (usata dalla UI/diagnostica)**:
   - Non reverta mai, ritorna un tuple con `isValid=false` + lista di componenti falliti.
   - Chiamata da: dashboard, monitoring, view esterne.

3. **Emergency path**: `EmergencyHandler.emergencyWithdraw` legge `IERC20.balanceOf` diretto, NON il NAV. Non dipende dal calcolo che è appena fallito.

4. **Rimuovere** il fallback legacy Euler (`_getEulerPositionValue` in ValueCalculator).

### Trade-off da decidere
**Un oracle stale su un token minor = pool bloccato per tutti?**

- **Opzione A (strict pura)**: sì, pool completamente pausato finché oracle non torna online. Semplice ma frágile.
- **Opzione B (threshold)**: se il token fallito rappresenta < 1% del TVL, ignoralo. Rischio: attaccante manipola per rendere "minore" un asset.
- **Opzione C (grace period)**: se oracle stale < 30 min tollerato, > 30 min block. Compromesso.

### Impact API
- **Breaking**: `ValueCalculator.getTotalPoolValue()` (esistente) → deprecare + aggiungere le due nuove.
- **Migration**: script off-chain, VAC, dashboard chiamano la vecchia API. Da aggiornare tutti.
- **Compatibilità evento**: `PoolValueUpdated` continua a emettere per compatibilità off-chain.

### Domanda #8
- 🔄 **Opzione A** (strict pura), **B** (threshold), o **C** (grace period)?
- ✅ Split API in `Strict` + `BestEffort`?
- ✅ Emergency path indipendente dal NAV (default sì).
- ✅ Rimuovere legacy Euler fallback (default sì).

---

## Blocker C1-07 — Parameter execution rewrite

### Problema
`ParameterManager` è pieno di bug intersecanti:
- `updateMultipleParameters` bypassa il timelock (CORE-005).
- `cancelParameterProposal(id)` ignora l'`id`, cancella il primo proposal (CORE-006).
- `executeParameterChange(uint256)` è dead code (CORE-007).
- `setParameterEmergency(bytes)` non applica bounds (CORE-067).
- `proposeParameterChange(bytes)` idem (CORE-068).

### Perché è grave
La governance timelock è **aggirabile** in 3 modi diversi. Owner compromesso o admin con `authorizedUpdater` role può cambiare qualsiasi parametro istantaneamente.

### Proposta agente
**Riscrittura mirata di ParameterManager (non totale — pattern minimal-invasive):**

1. **Rimuovere** `updateMultipleParameters` (o forzarla a rifiutare parametri con `requiresTimelock=true`).
2. **Riscrivere** `cancelParameterProposal(id)` per lookup by `proposalById[id]`, non iterazione su `parameterNames`.
3. **Rimuovere** `executeParameterChange(uint256)` (dead code) OR riscriverla per lookup by `proposalById[id]`.
4. **Fissare** i bytes overload di `setParameterEmergency` e `proposeParameterChange` per applicare bounds coerenti con string overload.
5. **Introdurre** un event `TimelockBypassAttempted` che loga tentativi (per off-chain alerting).

### Alternative
- Rewrite completo di ParameterManager: rifiutato, alto rischio regressione.
- Deprecare ParameterManager e migrare a OZ Governor: rifiutato, over-engineering per fase test.

### Impact API
- **Breaking**: `updateMultipleParameters` rimossa (o comportamento cambia).
- **Breaking**: `executeParameterChange(uint256)` rimossa.
- Script che le usano: da aggiornare.

### Domanda #9
- ✅ Procedi con rewrite mirato?
- 🔄 `updateMultipleParameters`: **rimossa** o **rifiutare timelocked params** solamente?
- 🔄 `executeParameterChange(uint256)`: **rimossa** o **riscritta per lookup by id**?

---

## CHEAT SHEET — le tue risposte

Puoi copiare questo blocco e rispondere in linea. Se un campo lo lasci vuoto, prendo la mia proposta di default (indicata con ✅).

```
C1-09 encode-packed:          [✅] procedi con abi.encode

C1-08 interface drift:        [x] DECISO (DEC-006): migrazione pair-based (Opzione A) — NON overload.
                              Include: ProtocolManager unico ingresso + rimozione bypass owner (PLG-084)
                              + openLeverage/closeLeverage esposti + test user-journey.

C1-04 emergency selector:     [x] DECISO (DEC-007): "No drain" (Opzione 1) — RIMUOVERE emergencyWithdraw-to-owner.
                              Emergenza = pausa + unwind uniforme + LP withdraw pro-rata.
                              Nessun drain-to-owner. Chiude CORE-001/015, NEW-010/018, CORE-010.
                              Prerequisito: EMERGENCY-UNWIND (uniformare closePositionsForBaseAsset).

C1-05 Morpho HF scale:        [ ] procedi con fix + SharesMathLib + test masking correction

C1-06 minOut end-to-end:      [ ] procedi con cambio 3 signature in una PR

C1-02 withdrawal clamp:       [ ] A revert su illiquidità  [ ] B burn proporzionale
                              minAmountOut obbligatorio: [ ] sì (default)

C1-03 first-depositor:        Bootstrap: [ ] A minimum liquidity  [ ] B virtual shares
                              Tracked balance _totalDeposited: [ ] sì (default)
                              minLpTokensOut obbligatorio: [ ] sì (default)

C1-01 VALUATION-001:          [ ] A strict pura  [ ] B threshold 1%  [ ] C grace period 30min
                              Split API Strict + BestEffort: [ ] sì (default)
                              Emergency indipendente dal NAV: [ ] sì (default)
                              Rimuovere legacy Euler fallback: [ ] sì (default)

C1-07 parameter execution:    [ ] procedi con rewrite mirato
                              updateMultipleParameters: [ ] rimossa  [ ] rifiuta timelocked
                              executeParameterChange(uint256): [ ] rimossa  [ ] riscritta lookup
```

## Cosa succede dopo la tua approvazione

1. Registro tutte le tue scelte in `security/DECISIONS.md` (DEC-006 a DEC-014, una per blocker).
2. Parto con C1-09 (primo in ordine). Ciclo: test rosso → fix → test verde → suite → aggiornamento `register.json` (state=fixed-pending-verification per ogni finding).
3. Ad ogni fix completato: **aspetto la tua review** del codice modificato prima del merge.
4. Continuo in sequenza fino a C1-07.

Tempo stimato totale Sprint 0: **25-45 ore** di lavoro agente + le tue review intermedie (~15-30 min per fix).
