# C1-06 — Protezione slippage/minOut end-to-end — IDEA

**Fix ID:** C1-06 (minOut end-to-end nei flash-loan callback + swap)
**Severity:** CRITICAL (ogni flash-loan callback è esposto a sandwich attack senza protezione)
**Accoppiato con:** CORE-081 (swap collaterale→base nell'unwind) + esposizione leva su ProtocolManager (`ILeverageProtocol`) — vedi `DEFERRED_e_SKIPPED.md` voci 2 e 3.
**Riferimento:** `security/findings/SPRINT0-DECISIONS.md` Blocker C1-06.

---

## Il problema in una frase
Ogni swap eseguito dentro i flash-loan callback (apertura/chiusura leva) parte **senza `minAmountOut`** → un attaccante può fare **sandwich** e prosciugare lo slippage massimo consentito.

## I punti bugati (dalla triage)
1. **`maxSlippageBps` salvato ma mai letto:** 3 plugin (Aave/Euler/Morpho) salvano `maxSlippageBps` in `_flashLoanContext` ma **non lo usano** nei callback.
2. **`openLeverageAtomic` senza `minCollateralAfterSwap`:** l'utente non può fissare il collaterale minimo accettato dopo lo swap.
3. **`IFlashLoanService.swap(tokenIn, tokenOut, amountIn)` senza `minAmountOut`:** la firma dello swap non accetta un minimo.
4. **`UniswapV3PluginDirect.inputSwap` usa `amountOutMinimum: 0`:** MEV totale (accetta qualsiasi output).
5. **`SwapManager.swapWithBestPlugin` verifica solo il quote pre-swap**, non il **balance delta post-swap** (potrebbe ricevere meno del quote).

## Perché è grave
Combinato con `getExpectedOutput` che usa lo spot `slot0` (PLG-021), un attaccante manipola il pool e estrae il massimo consentito dal quote. In un path a leva con flash loan, questo si traduce in perdita diretta di capitale del vault ad ogni apertura/chiusura.

## L'idea di soluzione (cambio coordinato di firme, una PR unica)
1. **`IFlashLoanService.swap(...)` → `swap(..., uint256 minAmountOut)`**: parametro obbligatorio; lo swap reverta se riceve meno.
2. **`ILeverageProtocol.OpenLeverageParams`** (già creata in C1-08!) ha già `minCollateralAfterSwap` + `maxSlippageBps`. → **ora i plugin la implementano davvero** (adozione differita da C1-08).
3. **Enforce `maxSlippageBps` nei callback:** `minAmountOut = expectedOut * (10000 - maxSlippageBps) / 10000` calcolato prima di ogni swap nel callback.
4. **`UniswapV3PluginDirect.inputSwap/outputSwap`**: `amountOutMinimum` = il `minAmountOut` propagato (non più 0) + `deadline` esplicito propagato dal caller.
5. **`SwapManager.swapWithBestPlugin`**: verifica il **balance delta post-swap** ≥ `minAmountOut`, non solo il quote pre-swap.

## Cosa sblocca / chiude (accoppiamenti)
- **Chiude CORE-081:** con lo swap protetto disponibile, l'unwind sort-by-risk può convertire il collaterale non-base → base asset in sicurezza (con `minOut`). Si completa la semantica DEC-007.
- **Sblocca la leva su ProtocolManager:** i plugin adottano `ILeverageProtocol` (struct unificato con i campi slippage) → si possono esporre `openLeverage`/`closeLeverage` su ProtocolManager (parte differita di C1-08 / DEC-006).
- **Chiude/avanza:** PLG-030..035 (slippage params), parte di PLG-021 (spot quote — mitigato dal delta check post-swap).

## Alternative valutate (da SPRINT0-DECISIONS)
- TWAP invece di quote spot: rifiutata (complessità alta, serve TWAP oracle per ogni pair). Il delta-check post-swap è la mitigazione pragmatica.
- Cap globale slippage in ParameterManager: complementare, non sostitutivo.

## Impatto (breaking)
- `IFlashLoanService.swap` cambia firma → ogni plugin che la chiama si aggiorna.
- Gli struct leverage locali dei plugin → sostituiti da `ILeverageProtocol.OpenLeverageParams/CloseLeverageParams`.
- `ISimpleSwap.inputSwap`/`outputSwap` cambia firma (minOut + deadline).
- Script off-chain / VAC / test: da aggiornare (come C1-08).

→ mappa del codice attuale + piano file-per-file in `02_Idea_Dettagliata.md`.
