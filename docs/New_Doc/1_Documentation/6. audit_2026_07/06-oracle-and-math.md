# 06 — Oracle & Math: analisi delle formule

Documento di audit (rev. 2026-07) — verifica di **tutta** la matematica usata da adapter, lens e services: **formule di health factor**, **LTV/liquidation threshold**, **conversioni unit/decimals**, **oracle scaling**, **arrotondamenti**, **precision loss**.

Ogni sezione confronta la **formula attesa** (secondo la documentazione del protocollo) con la **formula effettivamente implementata**.

Convenzioni notazionali:
- `wad = 1e18`, `ray = 1e27`, `rad = 1e45`, `Morpho.ORACLE_PRICE_SCALE = 1e36`.
- `HF` = health factor scalato in wad (1.0 = 1e18).
- `LTV` = loan-to-value, `LLTV` = liquidation LTV (Morpho), `LT` = liquidation threshold (Aave).

---

## 1. Chainlink price normalizzazione

**Path**: `contracts/adapters/ChainlinkAdapter.sol`.

### 1.1 Feed price → 18 decimals
Formula (righe 399, 494):
```
normalizedPrice = rawPrice * 10^(18 - config.decimals)
```

**Assunzione**: `config.decimals ≤ 18`. Costruttore/setter forza `decimals > 0 && decimals <= 18` (riga 149). ✅

**Edge case**: se `config.decimals == 18`, moltiplicazione per `10^0 = 1` no-op. ✅

**Perdita di precisione**: solo divisioni (per rescaling) causano loss. Qui non c'è divisione → precision preservata. ✅

### 1.2 Cross-rate conversion (denomination)
Formula (riga 403):
```
convertedPrice = (normalizedTokenPrice * 1e18) / normalizedRefPrice
```

Dove entrambi sono a 18 decimals.

**Semantica**: se `tokenPrice = USDC/USD = 1e18` e `refPrice = ETH/USD = 3000e18`, allora:
```
convertedPrice = (1e18 * 1e18) / 3000e18 = 3.33e14 (0.000333 in wad)
```
→ USDC in ETH. ✅ Corretto.

**Assunzione critica non validata**: `refConfig.denomination == targetDenomination`. Se questa assunzione viola, il risultato non è "USDC in ETH" ma "USDC in [qualcosa incorrelato]". Vedi ADP-002.

**Precision**: `normalizedTokenPrice * 1e18` può overflow se `normalizedTokenPrice > 2^256 / 1e18 ≈ 1.15e59`. Poiché `rawPrice ≤ 2^255` e `10^(18-decimals) ≤ 1e18`, il prodotto `rawPrice * 10^(18-decimals) ≤ 1.6e95` NO, aspetta:
- `int256 rawPrice` è castato a `uint256` (max 2^256 - 1)
- Chainlink `int256 answer` è realisticamente `< 2^128`.
- `rawPrice * 10^10` (se decimals=8) è realisticamente `< 2^170`.
- `* 1e18` = `< 2^230`. **Safe** in 256-bit. ✅

Ma per un feed con `decimals = 0` (raro/impossibile su Chainlink) e `rawPrice = 2^170`, il prodotto per `1e36` (10^18 * 10^18) si avvicina a `2^290`. Overflow. **Non gestito** ma bloccato dal `decimals > 0` check. ✅

### 1.3 Staleness
Formula (riga 441):
```
isFresh = block.timestamp - updatedAt <= config.heartbeat
```

Problema: se `updatedAt > block.timestamp` (impossibile normalmente ma il timestamp è controllato dal feed), `block.timestamp - updatedAt` **underflow** in Solidity 0.8.x → revert. Il `try/catch` esterno cattura → `revert OracleCallFailed("Chainlink call failed")`. Non ritorna `false`, reverta. Comportamento diverso da altre validazioni. Minor.

**Non implementato**: Chainlink L2 Sequencer Uptime Feed (per Arbitrum/Optimism). Su Arbitrum, se il sequencer è down + grace period 3600s, i feed continuano ad avere `updatedAt` fresco (perché ricevono aggiornamenti dal L1 quando torna), ma i prezzi possono essere stale rispetto alla realtà. Deve essere aggiunto un check separato del sequencer feed. **Manca completamente**. Vedi ADP-001.

---

## 2. Aave V3

**Path**: `contracts/adapters/AaveV3LensAdapter.sol`.

### 2.1 Health factor
Formula attesa (Aave V3 docs):
```
HF = Σ(collateral_i * LT_i) / Σ(debt_i)                     [in USD, 8 decimals]
```
scalato a 1e18. `HF = type(uint256).max` se `totalDebt == 0`.

Formula implementata: `hf = aavePool.getUserAccountData(plugin).healthFactor` (righe 189–197). ✅ **Nativa, corretta**.

**Edge case**: quando `totalDebtBase == 0`, il codice override manuale a `type(uint256).max` (riga 194). Aave stesso restituisce `type(uint256).max` in questo caso, quindi il check è ridondante. Non è bug.

### 2.2 Liquidation threshold
Formula attesa: Aave ritorna basis points weighted average (es. 8250 = 82.5%).

Formula implementata (riga 451):
```
threshold = currentLiquidationThreshold * 1e14
```
`8250 * 1e14 = 8.25e17 = 0.825e18`. ✅ Corretto (assume BP a 4 cifre = max 10000 = 100%). Se Aave cambia lo scaling (ipotesi remota), rotto.

### 2.3 Yield / APY — **BUG MATEMATICO**
Formula attesa (Aave V3 docs, `IPool.getReserveData`):
- `supplyAPY = (1 + liquidityRate/ray)^SECONDS_PER_YEAR - 1`   dove `liquidityRate = ray-scaled instant rate` (linear approx: `liquidityRate / ray = APR/SECONDS_PER_YEAR ratio`).
- **Non è** `(normalizedIncome - 1) / 1` — quello è la crescita cumulata dell'index.

Formula implementata (righe 393–394):
```
supplyAPY = (liquidityRate - 1e27) * 1e18 / 1e27
```
Dove `liquidityRate = aavePool.getReserveNormalizedIncome(underlying)`.

**Errore fondamentale**: `getReserveNormalizedIncome` ritorna un **index cumulativo** (partito a 1e27 all'inizio del reserve, cresce nel tempo secondo `(1 + APR/SECONDS_PER_YEAR)^t`). Quindi `(index - 1e27) / 1e27` è la **crescita totale** dell'index dall'inizio della vita del reserve — è APR × età_reserve **non** APY istantaneo.

Es: reserve WETH attivo da 2 anni con 3% APY. `normalizedIncome ≈ 1.06 * 1e27`. La formula dà `supplyAPY = 0.06e18 = 6%`. Ma il vero APY corrente è ~3%. Il valore ritornato è **ampiamente sovrastimato** e cresce nel tempo.

**Formula corretta** (usando `ReserveData.currentLiquidityRate`, non normalized income):
```
supplyAPR = currentLiquidityRate / ray                            // instantaneous APR
supplyAPY = (1 + supplyAPR / SECONDS_PER_YEAR)^SECONDS_PER_YEAR - 1
// oppure semplicemente APR se serve un rate lineare
```

Vedi ADP-007.

### 2.4 `estimateBaseAssetFromCloseAll` (righe 414–431)
Formula:
```
netVal = _usdToBaseAsset(max(totalCollateral - totalDebt, 0))
amount = netVal * 95 / 100
```

**Concettualmente OK**: 5% slippage buffer. Ma:
- Non considera slippage differente per token diversi.
- Se il collaterale è illiquido, 5% è ottimista.
- Non considera fee di flash loan (Balancer=0%, ma se cambia provider…).

### 2.5 `getProtocolLimits`
Ritorna `minHealthFactor = 1.05e18` (5% buffer sopra liquidation), `maxLeverage = 500` (5x). Ok, ma **hard-coded** per Aave adapter — parametro dovrebbe essere configurabile via governance o `ParameterManager`. Vedi ADP-036.

---

## 3. Euler V2

**Path**: `contracts/adapters/EulerLensAdapter.sol`.

### 3.1 Health factor per posizione
Formula attesa (Euler V2 doc): usando `IAccountLens.getAccountLiquidityInfo`, `collateralValueBorrowing` è già "risk-adjusted" (pesato per LTV_borrow del vault), `liabilityValueBorrowing` è il debito in unit-of-account:
```
HF = collateralValueBorrowing / liabilityValueBorrowing
```
Scalato in wad → moltiplicare per 1e18.

Formula implementata (righe 287, 307, 827):
```
HF = collateralValueBorrowing * 1e18 / liabilityValueBorrowing
```
✅ **Corretta**.

**Edge cases gestiti**:
- `queryFailure` → return max (safe).
- `liabilityValueBorrowing == 0` → return max.

### 3.2 Health factor **aggregato** — **INCOERENZA**
Formula implementata (righe 175–184):
```
totalCollateral, totalDebt = _calculateTotalValues()    // in base asset units
HF = (totalCollateral * 80 * 1e18) / (totalDebt * 100)
   = (totalCollateral / totalDebt) * 0.8 * 1e18
```

**Problemi**:
1. LTV hard-coded a 80% — Euler ha LTV **diverso per ogni coppia collateral/borrow** (LTV_borrow ≠ LTV_liq). 80% è un valore inventato.
2. `_calculateTotalValues` include `_calculateLeverageValues` che ha bug di doppio-conteggio (ADP-012).
3. Il valore aggregato è concettualmente diverso dal HF di una posizione singola. In un lending isolato (Euler è cross-collateralized via EVC controller), l'HF **aggregato** non esiste — ogni controller ha il suo. La formula è quindi **semanticamente errata**.

**Formula corretta**: iterare i controller di ogni sub-account, computare HF per controller, ritornare il **minimo** (che è il constraint binding). Vedi ADP-011.

### 3.3 Cross-rate conversion (righe 780–787)
```
valueInBaseAsset = amount * tokenPrice * 10^baseDecimals / (baseAssetPrice * 10^tokenDecimals)
```

Dove `tokenPrice` e `baseAssetPrice` sono in wad (18 decimals canonical per TokenManager).

Verifica dimensionale:
- `amount` in `10^tokenDecimals`.
- `tokenPrice` in wad → unità di "USD-wad per token unit" (o "ETH-wad per token unit" a seconda della denominazione).
- `10^baseDecimals` per aggiungere decimals del base asset.
- Divido per `baseAssetPrice` (wad) e `10^tokenDecimals` (per cancellare le token unit).

Semplificando:
```
[amount / 10^tokenDecimals] * [tokenPrice / baseAssetPrice] * 10^baseDecimals
= [amount * (tokenPrice / baseAssetPrice)] * (10^baseDecimals / 10^tokenDecimals)
```

Semanticamente: "quanti units di base-asset valgono `amount` di token". ✅ Corretto.

**Precision loss**: divisione al fondo. Se `baseAssetPrice * 10^tokenDecimals > amount * tokenPrice * 10^baseDecimals`, risultato **0**. Es: WETH (18 dec, `baseAssetPrice = 3000e18`) vs 1 wei di USDC (6 dec, `tokenPrice = 1e18`):
```
(1 * 1e18 * 1e18) / (3000e18 * 1e6) = 1e36 / 3e27 = ~3.3e8 wei = 3.3e-10 WETH
```
OK, non underflow. Ma:
- Per USDC (6 dec) `1e6` unità = 1 dollaro. `1e6 * 1e18 * 1e18 / (3000e18 * 1e6) = ~3.3e11 wei = 3.3e-7 WETH`. ✅

**Overflow**: `amount * tokenPrice * 10^baseDecimals`. Se `amount = 1e30` (1e12 WBTC in wei con 18 dec, impossibile realisticamente) × `tokenPrice = 1e23` (100000 USD) × `10^18 = 1e18`: `1e30 * 1e23 * 1e18 = 1e71`. Vicino a 2^256 ≈ 1.16e77 ma dentro. ✅

### 3.4 Available to withdraw (righe 164–171 in `getValueBreakdown`)
```
requiredCollateral = (totalDebt * 10) / 8            // /0.8
availableToWithdraw = max(totalCollateral - requiredCollateral, 0)
```

Hard-coded LTV 80%. Stesso problema di ADP-011.

### 3.5 Withdrawable amount (righe 415–428)
```
minCollateralNeeded = liabilityValueBorrowing * 1.05
excessValue = collateralValueBorrowing - minCollateralNeeded
excessRatio = excessValue * 1e18 / collateralValueBorrowing
amount = balance * excessRatio / 1e18
```

**Bug logico**:
- `balance` è in token units, `excessRatio` è ratio del **valore** (in unit-of-account).
- Convertire ratio di valore → ratio di token assume che tutto il collaterale sia composto **solo** da questo token. Se il sub-account ha WETH + WSTETH come collateral e vogliamo withdrawable di WETH, moltiplicare `balance_WETH * excessRatio_total` non ha senso — dovrebbe essere `excessValue / WETH_price`.
- Assume implicitamente 1 token per sub-account. Non generale.

Vedi ADP-037.

### 3.6 Leverage collateral calculation — **BUG DOPPIO CONTEGGIO**
Formula in `_calculateLeverageValues` (righe 717–727):
```
initialVal = _convertToBaseAssetValue(collateralAsset, pos.initialCollateral)
borrowVal = _convertToBaseAssetValue(borrowAsset, pos.borrowedAmount)
collateral += initialVal + borrowVal    // "leverage collateral"
debt += borrowVal
```

**Problemi**:
1. `pos.initialCollateral` è **valore storico** (snapshot dal registry alla creazione). Non riflette il collaterale attuale (che può includere interessi maturati, price movement, etc.).
2. `initialVal + borrowVal` assume 1-loop leverage: initial + borrowed (nella stessa denominazione). Ma leverage con multipli loop o con conversioni ha collaterale diverso.
3. **Doppio conteggio con `_calculateTotalValues`**: il ciclo principale (`_calculateTotalValues`) chiama `plugin.getBalance(tokenCode)` che restituisce il **balance corrente** del plugin (incluso le shares nei vault leverage). Poi si aggiunge di nuovo `initialVal + borrowVal` dalle leverage positions.
   - Il plugin non ha `pluginBalance = onlyDirectDeposits` e `positionsBalance = onlyLeverage`; da quello che si evince dal codice del Plugin (non incluso nella review ma inferito), i sub-account sono derivati dal plugin address ma `plugin.getBalance` legge tipicamente il main account. Se le leverage sono su sub-accounts, allora `plugin.getBalance` NON include le leverage → nessun doppio conteggio ma comunque `initialVal` è storico.
   - Serve verificare il comportamento esatto di `EulerV2Plugin.getBalance`. Se legge solo main → OK per collateral, ma il **debt** deve essere anch'esso solo main → allora `_calculateLeverageValues` aggiunge correttamente. Se `getBalance/getDebt` include già sub-account → doppio.

Vedi ADP-012 (HIGH — richiede verifica cross-Plugin).

### 3.7 Position value (`_getPositionValue`, righe 1078–1092)
```
collateralBalance = IEVault(collateralVault).maxWithdraw(subAccount)
debtBalance = IEVault(borrowVault).debtOf(subAccount)
```

- `maxWithdraw` include gli interessi maturati come lender (share × exchange_rate). ✅
- `debtOf` include interessi maturati come borrower. ✅
- Converte via `_convertToBaseAssetValue` (usa prezzi Chainlink) → **differenza con prezzi Euler oracle** (usato per HF): possibile inconsistenza tra HF (Euler oracle) e valore reportato (Chainlink oracle). Se sono lo stesso feed, no problem; se sono diversi, il valore mostrato in `PositionWithRisk` può discordare dalla condizione `hf < minHealthFactor`.

### 3.8 Vault APY (righe 531–561)
Formula implementata:
```
utilization = totalBorrows * 1e18 / totalAssets
borrowAPY = 0.03e18 + (0.15e18 - 0.03e18) * utilization / 1e18
supplyAPY = borrowAPY * utilization * 90 / (1e18 * 100)
```

**Interamente inventata**. Non riflette Euler's IRM (Kink model, Adaptive Curve IRM, etc.). Il rate reale è nel `VaultLens.getVaultInfoFull()`. **Dovrebbe** delegare a `vaultLens`. Vedi ADP-017.

### 3.9 Time to liquidation (righe 1097–1118)
Formula:
```
buffer = hf - 1e18
annualRate = 0.1e18
ttl = buffer * secondsPerYear / annualRate
```

Assume che HF decresce a 10% annuo. **Inventato**. Non usa `IAccountLens.getTimeToLiquidation` (che è **disponibile** — chiamato in `getTimeToLiquidation(account, vault)` righe 313–335). Perché non usarlo qui? Inconsistenza. Vedi ADP-038.

---

## 4. Morpho Blue

**Path**: `contracts/adapters/MorphoLensAdapter.sol`.

### 4.1 Debt from shares (righe 150, 171)
Formula attesa (Morpho `MathLib.wMulUp`, `SharesMathLib.toAssetsUp`):
```
debtAssets = ceil(borrowShares * totalBorrowAssets / totalBorrowShares)
           = (borrowShares * totalBorrowAssets + totalBorrowShares - 1) / totalBorrowShares
```

Formula implementata:
```
debtAssets = (uint256(pos.borrowShares) * uint256(mkt.totalBorrowAssets) + uint256(mkt.totalBorrowShares) - 1) / uint256(mkt.totalBorrowShares)
```
✅ **Match esatto** con round-up di Morpho. Corretto.

**Attenzione**: Morpho ha anche un `VIRTUAL_ASSETS = 1` e `VIRTUAL_SHARES = 1e6` per prevenire share manipulation. La formula ufficiale è:
```
toAssetsUp(shares, totalAssets, totalShares) = ceilDiv(shares * (totalAssets + VIRTUAL_ASSETS), totalShares + VIRTUAL_SHARES)
```

Se `totalBorrowAssets` e `totalBorrowShares` dal `IMorpho.market()` **includono** già i virtual, la formula qui è OK. Se **non** li includono, mancano.

Guardando l'interfaccia `Market` in `interfaces/morpho/IMorpho.sol` (righe 24–31), `totalBorrowAssets` e `totalBorrowShares` sono i valori raw storage. **NON** includono i virtual.

**Formula corretta**:
```
debtAssets = ceilDiv(borrowShares * (totalBorrowAssets + 1),
                     totalBorrowShares + 1e6)
```

L'implementazione attuale sottostima leggermente `debtAssets` (perché aggiunge `-1` invece di `+1` come Morpho fa nel numeratore, e non include i virtual). L'effetto è che l'HF calcolato è leggermente **più alto** del vero HF Morpho → possibile mancata detection di posizioni al limite. Impatto: **medio-alto**. Vedi ADP-039.

### 4.2 Health factor per market
Formula attesa (Morpho docs, `_isHealthy`):
```
maxBorrowValue = collateral * price / ORACLE_PRICE_SCALE * lltv / WAD
isHealthy = borrowValue <= maxBorrowValue
```

O equivalentemente:
```
HF = collateral * price * lltv / (borrowValue * ORACLE_PRICE_SCALE * WAD) * WAD    (per esprimerlo come rapporto scalato)
```

Formula implementata (righe 174–178):
```
oraclePrice = IMorphoOracle(params.oracle).price()
collateralValue = collateral * oraclePrice / ORACLE_PRICE_SCALE     // in loan token units
HF = collateralValue * lltv / (debtAssets * WAD)
```

Espansione:
```
HF = (collateral * oraclePrice / 1e36) * lltv / (debtAssets * 1e18)
   = (collateral * oraclePrice * lltv) / (1e36 * debtAssets * 1e18)
   = (collateral * oraclePrice * lltv) / (debtAssets * 1e54)
```

Dove `lltv` è in wad, quindi `lltv = 0.86e18` per 86% LLTV.

Semanticamente: HF > 1 quando `collateralValue * lltv > debtAssets * WAD`, ovvero `collateralValue * lltv / debtAssets > WAD = 1`. ✅ Corretto.

**Precision considerations**:
- `collateral` in `10^collDecimals` (uint128).
- `oraclePrice` = 1e36-scaled ratio.
- Prodotto intermedio: `collateral * oraclePrice`. Se `collateral = 1e30` (impossibile realisticamente) e `oraclePrice = 1e40`: overflow. Realisticamente `collateral < 2^128 ≈ 3.4e38`, `oraclePrice < 1e60` (ratios estremi) → prodotto < 1e98 = safe.
- Divisione per `1e36` prima di moltiplicare per `lltv` — **precision loss**: `collateralValue` perde 36 digits di precisione. Se `collateral * oraclePrice < 1e36`, `collateralValue = 0` → HF diventa 0 → liquidatable. Nel practical use, `collateral * oraclePrice >> 1e36`, quindi safe. Ma per micro-posizioni (dust) può falsare.

**Round direction**: `HF = (collateralValue * lltv) / (debtAssets * WAD)`. Solidity default **round-down**. Round-down su HF significa che HF calcolato è ≤ HF reale, quindi il codice potrebbe segnalare "liquidatable" quando non lo è. Prudente. ✅

Ma combinato con la sotto-stima di `debtAssets` (ADP-039), HF può essere ora sovra-stimato. Analisi complessiva richiesta.

### 4.3 Formula MorphoBlue liquidazione ufficiale
Dalla Morpho lib `MathLib`:
```
function _isHealthy(MarketParams memory params, Id id, address borrower) internal view returns (bool) {
    Position memory pos = _position[id][borrower];
    if (pos.borrowShares == 0) return true;
    uint256 borrowed = pos.borrowShares.toAssetsUp(market[id].totalBorrowAssets, market[id].totalBorrowShares);
    uint256 maxBorrow = uint256(pos.collateral).mulDivDown(
        IOracle(params.oracle).price(),
        ORACLE_PRICE_SCALE
    ).wMulDown(params.lltv);
    return maxBorrow >= borrowed;
}
```

Espanso:
```
maxBorrow = (collateral * price / 1e36) * lltv / 1e18
          = collateral * price * lltv / 1e54
```

`isHealthy` iff `maxBorrow >= borrowed`. In HF-form: `HF = maxBorrow / borrowed * WAD`.

L'implementazione qui replica esattamente questa logica. ✅ **Formula corretta**.

L'unica differenza è la formula `toAssetsUp` — se assumiamo Morpho **non** usa virtual assets (contrariamente alla nostra assunzione precedente), OK. **Verifica necessaria**.

Ricercando: Morpho V1 Blue **usa** virtual (constant `VIRTUAL_SHARES = 1e6`, `VIRTUAL_ASSETS = 1`). Vedi codice ufficiale morpho-blue `src/libraries/SharesMathLib.sol`. Quindi ADP-039 confermato.

### 4.4 Liquidation threshold ritornato (righe 583–595)
```
return params.lltv;
```
✅ Corretto — è **effettivamente** il liquidation threshold Morpho. In wad (0.86e18 = 86%).

### 4.5 Available to withdraw (righe 249–255 in `getValueBreakdown`)
```
availableToWithdraw = breakdown.netValue > breakdown.totalDebt
    ? breakdown.netValue - breakdown.totalDebt
    : 0
```

`netValue = totalCollateral - totalDebt`. Quindi:
```
availableToWithdraw = (totalCollateral - totalDebt) - totalDebt = totalCollateral - 2 * totalDebt (se positivo)
```

**Semanticamente errato**. La formula corretta è "collateral - required_collateral(debt, lltv)":
```
required = totalDebt / lltv          [in wad]
available = totalCollateral - required
```

L'implementazione sottrae `totalDebt` due volte → sotto-stima il withdrawable. Non catastrofico (conservativo), ma matematicamente incoerente. Vedi ADP-040.

### 4.6 Cross-market HF aggregate (righe 264–278)
Ritorna il **minimo HF** su tutti i markets. Semanticamente giusto per un lens: la posizione "più a rischio" determina l'urgenza. ✅

Ma se il caller usa `getHealthFactor()` per decisioni di aggregate risk, deve sapere che questo è il **min**, non un weighted average.

### 4.7 Oracle interaction — Morpho oracle vs Chainlink
- Per calcolare HF: usa `IMorphoOracle.price()` (righe 141, 174).
- Per calcolare value in base asset: usa `TokenManager` (Chainlink) via `_toBaseAsset`.

Se i due oracoli divergono (es. Morpho oracle è manipolato, Chainlink no), il TVL reportato è "safe" mentre il HF è "unsafe" (o vice-versa). Non c'è **cross-check di deviazione**. Vedi ADP-019.

---

## 5. MetaMorpho Vault (MorphoVaultLensAdapter)

### 5.1 Value formula
```
totalValue = Σ_i _toBaseAsset(vault[i].asset(), balances[i])
```
Dove `balances[i]` è **assumed** già in asset units (post-convertToAssets).

Se `MorphoVaultPlugin.getAllVaultPositions()` ritorna **shares** invece di **assets**, il valore sarà completamente errato. **Da verificare**.

### 5.2 Nessun health / debt
Coerente col fatto che i MetaMorpho vaults sono supply-only lending markets (aggregatori di Morpho markets).

---

## 6. FlashLoanService — math

### 6.1 Fee handling (righe 216, 226)
```
repayAmount = amounts[i] + feeAmounts[i]
```
Balancer V2 → `feeAmounts[i] == 0` sempre. Ma il codice **rispetta** `feeAmounts[i]` — se Balancer un giorno introduce fee, il codice si adatta. ✅ Coerente col principio "trust the callback data".

### 6.2 Swap fallback (righe 322–335)
```
// Se getExpectedOutput e TokenManager falliscono:
return (amountIn * 10^decimalsOut) / 10^decimalsIn
```

Questa formula è una **conversione 1:1** ignorando i prezzi. Se `tokenIn = WBTC` (8 dec, ~$70000) e `tokenOut = USDC` (6 dec, $1), la formula dà:
```
(1e8 * 1e6) / 1e8 = 1e6 = 1 USDC
```
Per 1 WBTC che vale 70000 USDC. **Errore di 70000x** silenziosamente ritornato al caller. Vedi ADP-030 (HIGH).

### 6.3 Cross-rate estimate (righe 369–370)
```
amountOut = (amountIn * priceIn * 10^decimalsOut) / (priceOut * 10^decimalsIn)
```

`priceIn`, `priceOut` in wad. Analisi dimensionale identica a Euler `_convertToBaseAssetValue`. ✅

**Precision**: assume che prezzi e ammontari non producano overflow. Analisi precedente vale.

---

## 7. Sommario formule per protocollo

### 7.1 Health Factor
| Protocollo | Formula ufficiale | Implementazione | Match |
| ---------- | ----------------- | --------------- | ----- |
| Aave V3 | Nativo Aave, `sum(coll*LT)/sum(debt)` in wad | `aavePool.getUserAccountData().healthFactor` | ✅ |
| Euler V2 (per pos.) | `collateralValueBorrowing / liabilityValueBorrowing` × 1e18 | Identica | ✅ |
| Euler V2 (aggregato) | Nessuna (protocollo cross-margined per controller) | LTV 80% hard-coded | ❌ ADP-011 |
| Morpho Blue | `(collateral*price/1e36)*lltv/(borrowAssets*1e18)` | Identica | ✅ formula, ⚠️ virtual (ADP-039) |
| MorphoVault | N/A (no liquidation) | `type(uint256).max` | ✅ |

### 7.2 Liquidation threshold
| Protocollo | Fonte reale | Implementazione |
| ---------- | ----------- | --------------- |
| Aave V3 | `currentLiquidationThreshold` (BP) | `× 1e14` ✅ |
| Euler V2 | Dipende da vault config (LTV_liq) | Hard-coded `debt * 10000 / 8300` ❌ ADP-016 |
| Morpho | `params.lltv` in wad | Identica ✅ |
| MorphoVault | N/A | `0` ✅ |

### 7.3 APY
| Protocollo | Fonte reale | Implementazione |
| ---------- | ----------- | --------------- |
| Aave V3 | `currentLiquidityRate`, `currentVariableBorrowRate` (ray) | Usa `normalizedIncome` (WRONG) ❌ ADP-007 |
| Euler V2 | Vault interest rate model + VaultLens | Linear interpolation 3–15% (INVENTED) ❌ ADP-017 |
| Morpho | IRM query | `0` (documented) ⚠️ ADP-020 |
| MorphoVault | Vault-specific | `0` (documented) |

### 7.4 Time to liquidation
| Protocollo | Fonte reale | Implementazione |
| ---------- | ----------- | --------------- |
| Aave V3 | N/A | `3600` seconds costante per WARNING band ❌ ADP-008 |
| Euler V2 | `IAccountLens.getTimeToLiquidation` (usato in una funzione, non in altra!) | Usato in `getTimeToLiquidation()`, ignorato in `_getTimeToLiquidationInternal` (10% annuo hard) ❌ ADP-038 |
| Morpho | N/A (approx from HF) | `3600` seconds costante ⚠️ (documented as estimate) |
| MorphoVault | N/A | `max` (no liquidation) ✅ |

---

## 8. Unit / decimals cheatsheet

| Sorgente | Unità | Decimals | Note |
| -------- | ----- | -------- | ---- |
| Chainlink USD feed | USD | 8 | Standard |
| Chainlink ETH feed | ETH | 18 | Meno comune |
| Aave `totalCollateralBase` | USD | 8 | Per Arbitrum (may differ per chain) |
| Aave `healthFactor` | wad | 18 | ✅ |
| Aave `currentLiquidationThreshold` | BP | 4-digit | ×1e14 per wad ✅ |
| Aave `getReserveNormalizedIncome` | ray | 27 | Cumulative index — **not** rate! |
| Euler `collateralValue*/liabilityValue*` | unit-of-account | 18 (typically) | Depends on vault unit |
| Euler `EVault.balanceOf/debtOf` | asset token units | asset decimals | Native |
| Euler `EVault.convertToAssets` | asset units | asset decimals | ✅ |
| Morpho `IMorphoOracle.price()` | ratio | 36 (ORACLE_PRICE_SCALE) | Collateral price in loan-token units |
| Morpho `params.lltv` | wad | 18 | ✅ |
| Morpho `Position.collateral` | asset units | collateral decimals | ✅ uint128 |
| Morpho `Position.borrowShares` | shares | 6 (VIRTUAL_SHARES) | ⚠️ |
| Morpho `Market.totalBorrowAssets/Shares` | assets / shares | Native / 6 | ⚠️ virtual |
| TokenManager `getTokenPrice*` | wad | 18 | Canonical for whole codebase |
| ChainlinkAdapter `getPrice` | wad (converted) | 18 | ✅ |

---

## 9. Punti aperti (matematica)

1. **Morpho virtual shares** (ADP-039): confermare se `toAssetsUp` deve includere virtual (1 asset + 1e6 shares). Attuale implementazione non li include.
2. **Aave APY math** (ADP-007): completamente errata, cambia formula a `currentLiquidityRate`.
3. **Euler aggregate HF** (ADP-011): sostituire con min HF cross-controller.
4. **Euler leverage double-counting** (ADP-012): verificare con `EulerV2Plugin.getBalance` semantica.
5. **Chainlink L2 sequencer** (ADP-001): aggiungere check.
6. **Chainlink min/maxAnswer** (ADP-002): aggiungere se il feed espone bounds.
7. **Withdrawable formula** in Euler (ADP-037): fix ratio balance vs value.
8. **Withdrawable formula** in Morpho (ADP-040): fix double-sub of debt.
9. **FlashLoanService 1:1 fallback** (ADP-030): rimuovere fallback silenzioso o richiedere `minAmountOut`.
