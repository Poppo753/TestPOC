# C1-06 — IDEA DETTAGLIATA

> Pipeline step 3. Mappa del codice reale (verificata 2026-08-03) + decisione di design critica
> + piano file-per-file. In coda: revisione (step 4) e la decisione da confermare.

## 0. SCOPERTA CRITICA — il minOut non può derivare dallo spot quote
L'`expectedOutput` di tutto lo stack swap viene da **`UniswapV3Pool.slot0()`** = prezzo **spot istantaneo** (manipolabile), non da un TWAP (PLG-021). Conseguenza: se il `minAmountOut` lo **calcoliamo dallo spot** (`expectedOut * (10000 - maxSlippageBps)/10000`, come proponeva la bozza), la protezione è **finta**: l'attaccante che sandwicha muove il pool → muove **sia il quote sia lo swap insieme** → il minOut "segue" il prezzo manipolato. Non protegge nulla.

**Fix onesto:** il `minAmountOut` deve essere un valore **assoluto fornito dal chiamante** (operatore/VAC), calcolato **off-chain** da una fonte di prezzo affidabile, e passato dentro i params. Questo valore esiste già: `ILeverageProtocol.OpenLeverageParams.minCollateralAfterSwap` (creato in C1-08). Lo spot quote resta utile solo per **dimensionare** il flash loan, NON come base della protezione. `maxSlippageBps` diventa un bound **secondario** (sanity) relativo al quote, ma la protezione **primaria** è il minOut assoluto del chiamante.

→ Questa è la decisione da confermare (§7).

## 1. MAPPA DEL CODICE ATTUALE (verificata)

### 1.1 Stack dello swap (3 layer da attraversare)
```
plugin callback (_handleOpen/CloseLeverageCallback)
  └─ IFlashLoanService(.swap(tokenIn, tokenOut, amountIn))     ← firma senza minOut
       └─ FlashLoanService.swap (contracts/services/FlashLoanService.sol:243)  ← solo guard amountOut==0
            └─ ISimpleSwap(SIMPLE_SWAP).inputSwap(tokenIn, tokenOut, amountIn)  ← firma senza minOut
                 └─ UniswapV3PluginDirect.inputSwap → exactInputSingle{ amountOutMinimum: 0, deadline: block.timestamp } ← MEV totale
```
Il `minOut` va **infilato in tutti e 3 i layer**.

### 1.2 Interfacce swap (locali per plugin)
- Aave/Euler: `interface IFlashLoanService { executeFlashLoan(...); swap(address,address,uint256) returns(uint256); getExpectedOutput(...) }` (AaveV3Plugin.sol:20-24, EulerV2Plugin.sol:21-29).
- Morpho: identica ma `IFlashLoanServiceMorpho` (MorphoPlugin.sol:20-24).
- Concreta: `contracts/services/FlashLoanService.sol` `swap` L243-284 (guard solo `amountOut==0`, L269 chiama `ISimpleSwap.inputSwap`). `SIMPLE_SWAP` router hardcoded L54.
- `contracts/interfaces/ISimpleSwap.sol`: `inputSwap(spend,receive,amountIn) returns(uint256)` L10; `outputSwap(spend,receive,amountInMax,amountOut)` L11.

### 1.3 `maxSlippageBps`: scritto ma MAI letto
`ctx.maxSlippageBps` popolato (Aave L736, Euler L896, Morpho L783) ma **zero letture** in `contracts/`. Write-only. Unico guard runtime: su CLOSE `received < repayAmount` (protegge solo il rimborso del flash loan, NON lo slippage dell'utente).

### 1.4 Callback per plugin (i 7 swap non protetti)
| # | Sito | File:line | Guard | minOut? |
|---|------|-----------|-------|---------|
| 1 | `FlashLoanService.swap` → `inputSwap` | FlashLoanService.sol:269 | `==0` | no |
| 2 | Aave OPEN swap | AaveV3Plugin.sol:815 | `==0` | no |
| 3 | Aave CLOSE swap | AaveV3Plugin.sol:861 | `< repayAmount` | no (user) |
| 4 | Euler OPEN swap | EulerV2Plugin.sol:1019 | `==0` | no |
| 5 | Euler CLOSE swap | EulerV2Plugin.sol:1137 | `< repayAmount` | no (user) |
| 6 | Morpho OPEN swap | MorphoPlugin.sol:858 | `==0` | no |
| 7 | Morpho CLOSE swap | MorphoPlugin.sol:907 | `< repayAmount` | no (user) |
| 8 | `UniswapV3PluginDirect.inputSwap` | UniswapV3PluginDirect.sol:151 | `amountOutMinimum:0` + deadline tautologico L149 | no |
| 9 | `UniswapV3PluginDirect.outputSwap` | UniswapV3PluginDirect.sol:201-211 | `amountInMaximum` ok, deadline tautologico L208 | — |
| 10 | `SwapManager.swapWithBestPlugin` | SwapManager.sol:490 | solo pre-swap `bestQuote>=minAmountOut` L474; delta post-swap MAI verificato | debole |

### 1.5 Struct leverage (da unificare in ILeverageProtocol)
OPEN (Aave L103, Euler L718, Morpho L111): `collateralToken, borrowToken, collateralAmount, targetLeverageX100, minHealthFactor, deadline` — **manca minCollateralAfterSwap + maxSlippageBps**.
CLOSE (Aave L112, Euler L852, Morpho L120): `collateralToken, borrowToken, maxSlippageBps, deadline` — ha maxSlippageBps (ma non consumato).
Target: `ILeverageProtocol.OpenLeverageParams`/`CloseLeverageParams` (già definiti in C1-08, con `minCollateralAfterSwap`, `minCollateralOut`, `maxSlippageBps`, `deadline`).

## 2. PIANO FILE-PER-FILE (cambio coordinato, una PR)

**Layer swap (thread del minOut):**
1. `ISimpleSwap.inputSwap` → `inputSwap(spend, receive, amountIn, uint256 minAmountOut, uint256 deadline)`. (outputSwap: aggiungere `deadline`.)
2. `UniswapV3PluginDirect.inputSwap`: `amountOutMinimum = minAmountOut` (non 0), `deadline = deadline` (non block.timestamp). outputSwap: deadline propagato.
3. `FlashLoanService.swap` → `swap(tokenIn, tokenOut, amountIn, uint256 minAmountOut, uint256 deadline)`; passa minOut/deadline a `inputSwap`; guard `amountOut >= minAmountOut`.
4. Interfacce plugin `IFlashLoanService`/`IFlashLoanServiceMorpho`: `swap(...)` con minOut + deadline.

**Leverage plugin (adozione ILeverageProtocol + enforce, i 3 plugin):**
5. Sostituire gli struct locali con `ILeverageProtocol.OpenLeverageParams`/`CloseLeverageParams`; `is ILeverageProtocol`, `override` su openLeverageAtomic/closeLeverageAtomic.
6. Salvare `minCollateralAfterSwap`/`minCollateralOut` + `maxSlippageBps` nel `FlashLoanCallbackContext`.
7. Nei callback: passare il `minAmountOut` allo swap. OPEN: `minAmountOut` = `ctx.minCollateralAfterSwap` (assoluto). CLOSE: `minAmountOut` = `max(repayAmount, ctx.minCollateralOut? )` — repay floor resta + eventuale min utente. maxSlippageBps come bound secondario opzionale.
8. Verifica finale post-callback: OPEN `totalCollateral >= minCollateralAfterSwap`; già c'è il check HF.

**SwapManager:**
9. `swapWithBestPlugin`: dopo lo swap, verificare il **balance delta post-swap** `>= minAmountOut` (non solo il quote). Propagare `deadline` a `inputSwap`.

**ProtocolManager (parte differita di C1-08):**
10. Esporre `openLeverage(protocol, OpenLeverageParams)` / `closeLeverage(protocol, CloseLeverageParams)` con routing a `ILeverageProtocol` + `onlyOperator`. Import `ILeverageProtocol`.

**CORE-081 (unwind → base asset):**
11. Nell'unwind (`closePositionsForBaseAsset` dei plugin), quando il collaterale liberato ≠ base asset, swap → base asset via SwapManager con `minAmountOut` assoluto (calcolato dal chiamante/target). Chiude CORE-081.

**Consumatori:**
12. Script off-chain/VAC + test: nuove firme (inputSwap, swap, leverage params, openLeverage su ProtocolManager).

## 3. STRATEGIA DI TEST
- Unit Foundry: `FlashLoanService.swap` reverta se `received < minAmountOut` (mock router che rende meno). `UniswapV3PluginDirect.inputSwap` passa `amountOutMinimum` corretto (mock router che verifica il param).
- `swapWithBestPlugin`: delta post-swap < minAmountOut → revert (mock plugin che rende meno del quote).
- Leverage: OPEN con `minCollateralAfterSwap` alto → revert se lo swap rende poco (mock).
- Fork (dove disponibile): apertura/chiusura leva reale con minOut sensato.

## 4. RISCHI
| Rischio | Mitigazione |
|---------|-------------|
| minOut spot-derived = teatro | **decisione §7**: minOut assoluto dal chiamante |
| Cambio firma su 4 layer rompe integrazioni | una PR coordinata; build dopo ogni layer |
| Euler già a 9B da EIP-170 | l'adozione ILeverageProtocol sostituisce struct locali (potrebbe non aumentare; misurare hardhat compile) — se sfora, size-optimization prima |
| deadline: chi lo fornisce | il caller (params.deadline già esiste negli struct leverage); per swapWithBestPlugin il caller lo passa |

## 5. IMPATTO (breaking)
`ISimpleSwap.inputSwap/outputSwap`, `IFlashLoanService(.Morpho).swap`, `FlashLoanService.swap`, struct leverage → `ILeverageProtocol`. + `ProtocolManager.openLeverage/closeLeverage` nuovi. Script/test da aggiornare.

## 6. REVISIONE (step 4) — DA COMPILARE dopo conferma §7

## 7. DECISIONE DA CONFERMARE
**D-C1-06 — origine del `minAmountOut`:**
- **Opzione A (raccomandata):** `minAmountOut` **assoluto, fornito dal chiamante** (operatore/VAC prezza off-chain). È `minCollateralAfterSwap`/`minCollateralOut` negli struct `ILeverageProtocol` (già creati). `maxSlippageBps` = bound secondario. **Protezione reale** anche con spot slot0.
- **Opzione B:** `minAmountOut` **derivato dallo spot** (`expectedOut*(1-maxSlippageBps)`). Semplice ma **NON protegge** da sandwich (attaccante muove spot). = quasi-teatro finché PLG-021 (spot) non è risolto con TWAP.
- **Opzione C:** TWAP oracle on-chain per l'expected output. Robusto ma pesante (setup TWAP per ogni pair). Scartato in SPRINT0.

Raccomando **A**: onesto, usa i campi già creati in C1-08, non richiede TWAP. La UI/VAC calcola `minCollateralAfterSwap` off-chain e lo passa.
