# 03 — Plugins: Architettura di dettaglio

Documento di audit (rev. 2026-07) — analisi architetturale dei plugin di integrazione DeFi contenuti in `contracts/plugins/` (escluse cartelle `old/`, `Dolomite`, `Gmx`).

I plugin oggetto di questa analisi sono:

| Contract | Ruolo | Righe |
| -------- | ----- | ----- |
| `AaveV3Plugin.sol` | Adattatore Aave V3 (single pool, single account) | 939 |
| `EulerV2Plugin.sol` | Adattatore Euler V2 (EVK + EVC + sub-account lazy) | 1463 |
| `MorphoPlugin.sol` | Adattatore Morpho Blue (isolated markets) | 1074 |
| `MorphoVaultPlugin.sol` | Adattatore MetaMorpho ERC-4626 | 450 |
| `UniswapV3Plugin.sol` | Wrapper `ISwapPlugin` verso `SimpleSwap` | 120 |
| `UniswapV3PluginDirect.sol` | Chiamata diretta al Router V3 | 341 |
| `AaveV3Registry.sol` | Registry (tokenCode → aToken/debtToken) | 237 |
| `EulerRegistry.sol` | Registry vault + position manager + sub-account allocator | 712 |
| `MorphoRegistry.sol` | Registry di markets + MetaMorpho vaults | 271 |

Le sezioni che seguono sono focalizzate su: storage, chiamate al protocollo esterno, invariants, ipotesi implicite.

---

## 1. Panoramica del pattern comune

Tutti i plugin di lending seguono lo stesso pattern architetturale “3 Musketeers”:

```
              ProtocolManager
                    │
                    ▼
            <Plugin> (deposit / withdraw / borrow / repay / leverage)
                    │        │
                    │        ▼
                    │   FlashLoanService (Balancer, per leverage atomica)
                    ▼
            <Registry> (tokenCode ↔ pool/vault/market params)
```

Elementi trasversali:

1. **Beacon resolution**: Ogni plugin dipende da `IBeacon(beacon).getImplementation("<module>")` per risolvere `ProtocolManager`, `TokenManager`, `ProxyGeneral`, `FlashLoanService`, `<Protocol>Registry`, `EulerLensAdapter`, `LiquidityManager`.
2. **Custody model**: Il `ProtocolManager` trasferisce i token IN al plugin prima di chiamare `deposit/repay`; i plugin trasferiscono i token OUT direttamente a `ProxyGeneral` dopo `withdraw/borrow`.
3. **Access control**: modifier `onlyProtocolManager` (plugin `.owner()` è white-listato). `emergencyWithdrawAll`, `activateCircuitBreaker`, `openLeverageAtomic` sono `onlyOwner`. `closeLeverageAtomic`, `closePositionsForBaseAsset` accettano `owner || LiquidityManager || address(this)`.
4. **Circuit breaker**: bool `circuitBreakerTripped`; modifier `notCircuitBroken` blocca tutte le operazioni non emergenziali.
5. **ReentrancyGuard OZ v4**: import `@openzeppelin/contracts/security/ReentrancyGuard.sol` (deprecato in OZ v5, path moved).
6. **Flash loan callback**: implementazione di `IFlashLoanCallback.onFlashLoanReceived(...)` con doppio guard:
   - `msg.sender == FlashLoanService` (risolto via Beacon)
   - `_inFlashLoanCallback == true` (flag settato dal plugin prima di invocare `executeFlashLoan`)
7. **Ownable single-step** (`@openzeppelin/contracts/access/Ownable.sol`, versione 4). Nessun `Ownable2Step`.

Interfacce IProtocolAdapter (`contracts/interfaces/IProtocolAdapter.sol`) è comune a tutti i plugin di lending; obbliga a:
- `deposit(string, uint256)`, `withdraw(string, uint256)`, `getBalance(string)`
- `closePosition(uint256) → uint256`
- `closePositionsForBaseAsset(uint256) → (uint256, uint256)`
- `emergencyWithdrawAll(string[])`, `activateCircuitBreaker()`
- Eventi: `Deposited`, `Withdrawn`, `PositionClosed`, `CircuitBreakerActivated`

---

## 2. AaveV3Plugin

**Fonte**: `contracts/plugins/AaveV3Plugin.sol`

### 2.1 Storage & Immutables

| Var | Slot | Note |
| --- | ---- | ---- |
| `beacon` (imm) | — | risoluzione moduli |
| `aavePool` (imm `IAaveV3Pool`) | — | Aave V3 Pool (Arbitrum: `0x794a61...`) |
| `baseAssetCode` (string) | 0 | e.g. `"WETH"` |
| `circuitBreakerTripped` (bool) | 1 | override IProtocolAdapter |
| `_flashLoanContext` (struct) | 2..7 | contesto callback (`FlashLoanOperation`, user, initialCollateral, maxSlippageBps, collateralTokenCode, borrowTokenCode) |
| `_inFlashLoanCallback` (bool) | 8 | reentrancy guard flash loan |

Costanti: `VARIABLE_RATE_MODE = 2`, `MIN_HEALTH_FACTOR = 1.05e18`.

### 2.2 Chiamate al protocollo Aave V3

| Operazione plugin | Chiamata Aave | Parametri |
| ----------------- | ------------- | --------- |
| `deposit(tc, a)` | `pool.supply(asset, a, address(this), 0)` (L.233) | referralCode=0 |
| `withdraw(tc, a)` | `pool.withdraw(asset, a\|max, proxyGeneral)` (L.273) | Aave invia direttamente a proxyGeneral |
| `borrow(tc, a)` | `pool.borrow(asset, a, VARIABLE_RATE_MODE, 0, address(this))` (L.302), poi `safeTransfer` a proxyGeneral | interestRateMode=2 |
| `repay(tc, a)` | `pool.repay(asset, a\|max, VARIABLE_RATE_MODE, address(this))` (L.362) | uint256.max = repay all |
| `closePosition(collat,debt)` | repay + withdraw a proxyGeneral (L.377..412) | non usa `disableCollateral` (implicito in Aave) |
| `getUserAccountData` | letto in `getHealthFactor` (L.504) e `getBorrowCapacity` (L.529) | HF già scalato 1e18 |

Approve pattern: `safeIncreaseAllowance` (nessun reset a zero, non usa `forceApprove`).

### 2.3 Leverage atomico

`openLeverageAtomic(params)` (L.565)
- Trasferisce collaterale iniziale dall'utente al plugin.
- Calcola `flashLoanAmount = _calculateFlashLoanAmount(...)` usando `FlashLoanService.getExpectedOutput()` (dipendente da spot).
- Setta `_flashLoanContext` con `FlashLoanOperation.OPEN`.
- Chiama `FlashLoanService.executeFlashLoan(borrowToken, flashLoanAmount)`.
- Nella callback (L.728..759):
  1. Swap borrow→collateral via `IFlashLoanService.swap` (nessun minOut).
  2. `pool.supply(collateralToken, totalCollateral, address(this), 0)`.
  3. `pool.borrow(borrowToken, flashLoanAmount+fee, VARIABLE_RATE_MODE, 0, address(this))`.
  4. Trasferisce a FlashLoanService per ripagare Balancer.
- Post-callback: rilegge `getUserAccountData` e verifica `healthFactor >= minHealthFactor` (default `1.05e18`).

`closeLeverageAtomic(params)` (L.647)
- Flash loan pari a `currentDebt`.
- Callback (L.765..798):
  1. `pool.repay(borrowToken, flashLoanAmount, VARIABLE_RATE_MODE, address(this))`.
  2. `pool.withdraw(collateralToken, max, address(this))`.
  3. Swap collateralBalance → borrowToken via FlashLoanService.
  4. Verifica `borrowReceived >= flashLoanAmount + fee`.
- Post-callback: eventuale collateralBalance residuo e `borrowExcess` inviati a `msg.sender` (che è owner/LiquidityManager/self, NON necessariamente ProxyGeneral).

### 2.4 Invariants attesi

- Health factor post-open/close ≥ `MIN_HEALTH_FACTOR` (`1.05e18`). Se sfumato → reverte con `HealthFactorTooLow` post-callback.
- Nessuna posizione con `debtToken == collateralToken` (implicito).
- L'allowance su `aavePool` viene incrementata ma non reset; residui rimangono tra chiamate.

### 2.5 Dipendenze runtime (Beacon)

`BASE_ASSET`, `TokenManager`, `ProtocolManager`, `LiquidityManager`, `AaveV3Registry`, `ProxyGeneral`, `FlashLoanService`.

---

## 3. EulerV2Plugin

**Fonte**: `contracts/plugins/EulerV2Plugin.sol` (1463 righe — plugin più grande)

### 3.1 Storage & Immutables

| Var | Slot | Note |
| --- | ---- | ---- |
| `beacon` (imm) | — | |
| `evc` (imm `IEVC`) | — | `0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066` su Arbitrum |
| `accountLensAddress` (imm) | — | Euler AccountLens |
| `baseAssetCode` (string) | 0 | |
| `circuitBreakerTripped` (bool) | 1 | |
| `_inFlashLoanCallback` (bool) | 2 | |
| `_flashLoanContext` (struct) | 3..8 | (operation, user, collateralVault, borrowVault, initialCollateral, maxSlippageBps) |

Costante: `MIN_HEALTH_FACTOR = 1.05e18`.

### 3.2 Modello EVC + sub-account (Opzione C — Lazy allocation)

Le decisioni chiave sono documentate a L.31-99 del file:

- Un `subAccountId` per la coppia `(collateralVault, borrowVault)` è allocato **on-demand** dal `EulerRegistry.createPositionOnDemand()` alla prima apertura leverage.
- Riuso: se la posizione viene chiusa, il sub-account resta allocato e viene riutilizzato per un'apertura successiva della stessa coppia.
- Formula sub-account: `subAccountAddress = uint160(address(this)) ^ uint160(subAccountId)` (L.1288-1290 `_deriveSubAccount`).
- **⚠ Osservazione critica** (vedi findings PLG-026): i callback flash-loan di apertura leverage (`_handleOpenLeverageCallback`, L.972-1028) NON usano il sub-account allocato — tutte le operazioni EVC vengono eseguite su `address(this)` (main account, ID 0). Il sub-account allocato nella registry è quindi meramente contabile e non riflette lo stato on-chain di EVC. Questo rende impossibile mantenere posizioni leverage multiple in parallelo su vault diversi (EVC ammette un solo controller per account).

### 3.3 Chiamate al protocollo Euler V2

Operazioni di base (deposito/prelievo/borrow/repay) sono orchestrate tramite `evc.batch(BatchItem[])` (L.281-299, 380-398, ecc.). Ogni `BatchItem` ha campi:
```
targetContract, onBehalfOfAccount, value, data
```

`onBehalfOfAccount == address(0)` per chiamate a EVC stesso (`enableCollateral`, `enableController`, `disableCollateral`).
`onBehalfOfAccount == address(this)` per chiamate ai vault.

| Operazione plugin | Batch content |
| ----------------- | ------------- |
| `deposit(tc, a)` (L.257) | `[enableCollateral*, deposit(a, self)]` |
| `withdraw(tc, a)` (L.312) | `IEVault.withdraw(a, self, self)` (fuori batch) |
| `borrow(tc, a)` (L.366) | `[enableController*, borrow(a, self)]` |
| `repay(tc, a)` (L.416) | `IEVault.repay(a, self)` (fuori batch) + gestione dust < 1000 wei |
| `closePosition(debt,coll)` (L.482) | batch dinamico `[repay(max), disableController, redeem(max), disableCollateral]` |
| Leverage OPEN callback (L.972) | `[enableCollateral, deposit(total, self), enableController, borrow(flash+fee, self)]` |
| Leverage CLOSE callback (L.1038) | `[repay(flash), redeem(all, self, self), disableController, disableCollateral]` |

**Approve pattern**: `safeIncreaseAllowance` senza reset.

### 3.4 Registry (position manager)

Ogni open leverage → `EulerRegistry.createPositionOnDemand(collateralVault, borrowVault, initialCollateral, totalDebt)` (L.792).
Ogni close leverage → cerca posizione attiva con quella coppia e chiama `EulerRegistry.closePositionRecord(id)` (L.916-928).

### 3.5 Health Factor

`getHealthFactor()` (L.597-632)
- Legge `evc.getControllers(address(this))` → prende solo il PRIMO (limitazione).
- Interroga `AccountLens.getAccountLiquidityInfo(this, controller)` (struct decodificata da ABI on-chain).
- Se `queryFailure == true` → return `type(uint256).max` (**maschera situazioni di degrado**).
- Se `liabilityValueBorrowing == 0` → return `type(uint256).max`.
- Altrimenti: `HF = collateralValueBorrowing * 1e18 / liabilityValueBorrowing`.

### 3.6 Custody & flussi speciali

- `_getPositionAccount(pos)` (L.1292): se il sub-account ha debito/collateral, ritorna sub-account, altrimenti main. Ambiguo dopo apertura sub-account "vuoto".
- `addCollateralToPosition` (L.1130) invia collaterale al `positionAccount` e poi tenta `evc.call(token, positionAccount, 0, IERC20.approve(...))`. **Approve tramite EVC.call ha msg.sender = EVC, non il sub-account** — pattern potenzialmente non funzionante (vedi findings PLG-167/168).

### 3.7 Flusso `closePosition(uint256 positionId)` (L.1373) 
- Legge la posizione da `EulerRegistry`, chiama `this.closeLeverageAtomic(params)` con `maxSlippageBps=200`, `deadline=block.timestamp+300`.
- Post-call: se ancora attiva nella registry → `closePositionRecord(id)`.
- **⚠ Nessun modifier di access control** — chiunque può forzare la chiusura di qualsiasi posizione (vedi PLG-034/035).

### 3.8 Invariants attesi

- Un solo controller enabled per account. **Violato** se un utente prova ad aprire una seconda leverage in parallelo (vedi PLG-026).
- `EulerRegistry.positionKeyToSubAccount[hash(collat, borrow)]` è deterministic + append-only.
- `_flashLoanContext` deve essere clear all'inizio di ogni open/close.

---

## 4. MorphoPlugin

**Fonte**: `contracts/plugins/MorphoPlugin.sol`

### 4.1 Storage & Immutables

| Var | Slot | Note |
| --- | ---- | ---- |
| `beacon` (imm) | — | |
| `morpho` (imm `IMorpho`) | — | Morpho Blue singleton |
| `baseAssetCode` (string) | 0 | |
| `circuitBreakerTripped` (bool) | 1 | |
| `_flashLoanContext` (struct) | 2..7 | |
| `_inFlashLoanCallback` (bool) | 8 | |

Costanti: `ORACLE_PRICE_SCALE = 1e36`, `WAD = 1e18`, `MIN_HEALTH_FACTOR = 1.05e18`.

Header (L.55-56) menziona indirizzo `0x6c247b1F6182318877311737BaC0844bAa518F5e` per Morpho Blue su Arbitrum; il singleton ufficiale documentato in `contracts/interfaces/morpho/IMorpho.sol` (L.35) è `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb`. L'indirizzo effettivo è iniettato via constructor (L.196), quindi il commento diverge dalla ABI ma non impatta runtime — solo doc-drift.

### 4.2 Chiamate al protocollo Morpho Blue

Ogni operazione richiede `MarketParams` completi (loanToken, collateralToken, oracle, irm, lltv).

| Operazione plugin | Chiamata Morpho |
| ----------------- | --------------- |
| `supplyCollateral(cc, lc, a)` (L.244) | `morpho.supplyCollateral(params, a, address(this), "")` |
| `withdrawCollateral(cc, lc, a)` (L.290) | `morpho.withdrawCollateral(params, a, address(this), proxyGeneral)` |
| `borrow(cc, lc, a)` (L.340) | `morpho.borrow(params, a, 0, address(this), proxyGeneral)` |
| `repay(cc, lc, a)` (L.379) | full → `morpho.repay(params, 0, borrowShares, address(this), "")`; partial → `morpho.repay(params, a, 0, ...)` |
| `deposit(tc, a)` / `withdraw(tc, a)` | Wrapper che chiama `_findMarketForCollateral(tc)` — routing implicito al primo market che matcha |

**Nota di custody**: Morpho supporta receiver diretto in `withdrawCollateral` e `borrow` → il plugin usa `proxyGeneral` come receiver quando disponibile.

**Approve**: `safeIncreaseAllowance` a Morpho, ma in `_repay` viene approvato l'INTERO `balance` del plugin, non solo l'importo di repay (L.413). Residuo → allowance restante sopra Morpho.

### 4.3 Health Factor (⚠ scaling bug — CRITICAL)

`_computeHealthFactor(cc, lc)` (L.983-1010):

```solidity
oraclePrice   = IMorphoOracle(params.oracle).price();     // scaled 1e36
collateralValue = (pos.collateral * oraclePrice) / ORACLE_PRICE_SCALE;   // loan token units
debtAssets    = (pos.borrowShares * mkt.totalBorrowAssets + totalBorrowShares - 1) / totalBorrowShares;
return (collateralValue * params.lltv) / (debtAssets * WAD);
```

Il termine `debtAssets * WAD` al denominatore introduce un fattore extra `1e18` che rimuove la scala della HF: il risultato non è in 1e18 ma in unità intere (raw ratio). Con collateral 2000 USDC, lltv=0.86e18, debt=1000 USDC:

- Numeratore: `2000e6 * 0.86e18 = 1.72e27`
- Denominatore: `1000e6 * 1e18 = 1e27`
- Risultato: `1` (int truncation di 1.72)

**Impatto**: qualsiasi confronto contro `MIN_HEALTH_FACTOR = 1.05e18` fallisce sempre → `openLeverageAtomic` reverte sempre con `HealthFactorTooLow(1, 1.05e18)`. Vedi PLG-049/137.

### 4.4 Flusso leverage

Analogo a Aave: OPEN swappa borrow→collateral, `supplyCollateral` + `borrow`; CLOSE flash-loan del debito, `repay` (via shares), `withdrawCollateral` a self, swap, invia excess a `msg.sender` (owner/LiquidityManager/self).

### 4.5 `closePosition(uint256)` e routing multi-market

Poiché Morpho non ha positionId nativi, `closePosition(uint256)` (L.488) ITERA su tutti i market registrati chiamando `_getRegistry().getRegisteredMarkets()` e chiudendo qualunque market in cui il plugin abbia collateral/debito.

`closePositionsForBaseAsset` (L.530) itera i market e chiude solo quelli con `params.collateralToken == baseAsset`.

`_findMarketForCollateral` (L.1059) risolve `deposit("WETH", ...)` prendendo il primo market che matcha il collateral — routing dipendente dall'ordine di registrazione (**warn**: vedi PLG-050/053).

---

## 5. MorphoVaultPlugin (ERC-4626)

**Fonte**: `contracts/plugins/MorphoVaultPlugin.sol`

### 5.1 Storage

| Var | Slot | Note |
| --- | ---- | ---- |
| `beacon` (imm) | — | |
| `circuitBreakerTripped` (bool) | 0 | |
| `activeVaults` (address[]) | 1 | runtime tracking di quali vault hanno posizioni |

### 5.2 Routing ERC-4626

- `deposit(tc, a)` / `withdraw(tc, a)` risolvono `defaultVault = MorphoRegistry.getDefaultVault(tc)`.
- `vaultDeposit(vault, a)` / `vaultWithdraw(vault, a)` / `vaultRedeem(vault, shares)` operano su vault specifici, gated da `onlyApprovedVault(vault)` (L.102-105).
- `_vaultDeposit` (L.376):
  1. `maxDep = v.maxDeposit(address(this))` — check limits.
  2. `safeIncreaseAllowance(vault, amount)` — senza reset.
  3. `v.deposit(amount, address(this))` (ERC-4626 standard).
- `_vaultWithdraw` (L.395):
  1. `maxWith = v.maxWithdraw(...)`.
  2. `v.withdraw(withdrawAmount, proxyGeneral, address(this))` (invia asset direttamente a ProxyGeneral).
- `vaultRedeem` (L.294): usa `v.redeem(shares, proxyGeneral, address(this))`; se `shares == 0` redime tutto.

### 5.3 Rounding

Il plugin usa unicamente `convertToAssets` (per `getBalance`, `getVaultBalance`, `getAllVaultPositions`, `getTotalVaultValue`) — round-down per default (compliant ERC-4626 read-only).

Non usa `previewDeposit`/`previewWithdraw` (che dovrebbero essere usati per determinare `expected assets`/`shares` con precisione). Nessun check di `expectedShares` post-`v.deposit`.

### 5.4 Invariants attesi

- `activeVaults` contiene esattamente i vault con shares > 0 nel plugin. Manutenzione tramite `_addActiveVault` (dedup lineare) e `_removeActiveVault` in `_vaultWithdraw`/`vaultRedeem`.
- `closePositionsForBaseAsset` ignora `targetAmount` e redime tutto (vedi PLG-070).

---

## 6. UniswapV3Plugin

**Fonte**: `contracts/plugins/UniswapV3Plugin.sol` (120 righe)

Wrapper minimale che delega a `SimpleSwap` (address `simpleSwap` immutable, iniettato in constructor).

Espone `inputSwap`, `outputSwap`, `getExpectedOutput(3-param)`, `getExpectedOutput(5-param)`, oltre a `getProtocolInfo`, `supportsTokenPair`, `isHealthy` (interfaccia `ISwapPlugin`).

- Custody: `inputSwap` (L.48-73) trasferisce token dal caller (`safeTransferFrom`), approva `simpleSwap` con pattern `safeApprove(0) → safeApprove(amount)` (L.62-63, canonico OZ v4 per USDT-like), invoca `ISimpleSwap.inputSwap(...)`, ritorna output al caller.
- `getProtocolInfo` (L.30-36) dichiara `features: 3` (BASIC_SWAP | MULTI_HOP), ma l'implementazione supporta solo il routing di `SimpleSwap` sottostante.
- `supportsTokenPair(*, *)` ritorna sempre `true`.
- `isHealthy()` è hardcoded `(true, "")`.
- Nessun access control (`inputSwap`/`outputSwap` sono callable da chiunque).

---

## 7. UniswapV3PluginDirect

**Fonte**: `contracts/plugins/UniswapV3PluginDirect.sol` (341 righe)

Integrazione diretta con Uniswap V3 SwapRouter + Quoter V2, senza intermediari.

### 7.1 Storage

| Var | Slot | Note |
| --- | ---- | ---- |
| `uniswapRouter` (imm) | — | `0xE592...` |
| `quoterV2` (imm) | — | `0x61fF...` |
| `proxyGeneral` (imm) | — | custody |
| `DEFAULT_FEE` (const) | — | `3000` (0.3%) — HARDCODED |

### 7.2 Custody & Approve

Il plugin trasferisce da `proxyGeneral` (via `transferFrom` — richiede allowance pre-esistente) i token, approva il Router e chiama `exactInputSingle` o `exactOutputSingle`.

**Approve raw**: usa `IERC20(token).approve(router, amount)` (L.138, 196) — non SafeERC20. Su USDT questa forma fallisce con allowance non-zero. Vedi PLG-085/188.

### 7.3 Parametri Uniswap V3

`exactInputSingle` params (L.144-153):
- `fee: DEFAULT_FEE (3000)` — non parametrizzabile.
- `recipient: address(this)` — poi transfer manuale a proxyGeneral.
- `deadline: block.timestamp` — nessuna finestra di deadline (vedi PLG-080).
- `amountOutMinimum: 0` — **NESSUNA SLIPPAGE PROTECTION** (vedi PLG-078).
- `sqrtPriceLimitX96: 0` — nessun price limit (MEV completo).

`exactOutputSingle` params (L.202-211): `amountInMaximum: amountInMax`, altri identici.

### 7.4 `getExpectedOutput` (⚠ vulnerabilità a spot manipulation)

L.250-306: legge `pool.slot0()` per ottenere `sqrtPriceX96`, calcola `priceRatio = sqrtPriceX96^2`, applica formula:

```
expectedOutput = amountIn * priceRatio / 2^192      (spendToken < receiveToken)
              = amountIn * 2^192 / priceRatio      (else)
expectedOutput = expectedOutput * (1_000_000 - 3000) / 1_000_000
return expectedOutput * 85 / 100        // 15% haircut arbitrario
```

Il valore restituito è basato su **spot price** e ha uno sconto arbitrario del 15%. Il constructor imposta anche `quoterV2` — presumibilmente per essere usato — ma **non viene mai chiamato**, malgrado la NatSpec dichiari "Returns ACTUAL quote from Uniswap V3 Quoter V2".

Impatto: se un altro contratto (es. `FlashLoanService.getExpectedOutput`) delega qui per calcoli on-chain di leverage size, l'attaccante può manipolare lo spot per gonfiare/deflazionare i flash loans → vedi PLG-082/174.

### 7.5 `_getPoolAddress` (CREATE2)

L.315-340: computa deterministicamente l'indirizzo del pool via CREATE2 (`POOL_INIT_CODE_HASH = 0xe34f199b...54`, corretto per Uniswap V3). Ritorna `address(0)` se `pool.code.length == 0`.

---

## 8. AaveV3Registry

**Fonte**: `contracts/plugins/AaveV3Registry.sol`

Registry singleton che mappa `tokenCode → { underlying, aToken, variableDebtToken, isActive }`.

### 8.1 Storage

- `_tokenConfigs: mapping(string => TokenConfig)`.
- `_registeredTokens: string[]`, `_tokenIndex: mapping(string => uint256)`, `_isRegistered: mapping(string => bool)` — pattern swap-and-pop per `removeToken`.

### 8.2 API

Owner-only: `configureToken`, `configureTokensBatch`, `removeToken`, `setTokenActive`.

Views: `getTokenConfig`, `getUnderlying`, `getAToken`, `getVariableDebtToken`, `isTokenConfigured`, `getRegisteredTokens`, `getRegisteredTokenCount`, oltre a varianti `-Safe` che ritornano `address(0)` in caso di token non registrato.

Invariants:
- `_registeredTokens[_tokenIndex[tc]] == tc` per ogni `tc` registrato.
- Nessuna validazione che `aToken == aavePool.getReserveAToken(underlying)` — la configurazione è trust-owner.
- `isActive` non è mai controllato dal plugin (dormant flag). Vedi PLG-094.

---

## 9. EulerRegistry

**Fonte**: `contracts/plugins/EulerRegistry.sol` (712 righe)

Registry ibrido: gestisce (a) mapping vault ↔ tokenCode, (b) storage centralizzato delle posizioni leverage, (c) lazy allocation dei sub-account (Opzione C).

### 9.1 Storage

**Vault registry**:
- `_vaults: mapping(string => address)`
- `_tokenCodes: mapping(address => string)` (reverse lookup)
- `_registeredTokens: string[]`
- `_tokenIndex`, `_isRegistered` (swap-and-pop)

**Position manager**:
- `nextPositionId: uint256`
- `_positions: mapping(uint256 => LeveragePositionStorage)`
- `_activePositionIds: uint256[]`, `_activePositionIndex`, `_isInActiveArray`

**Sub-account allocator**:
- `positionKeyToSubAccount: mapping(bytes32 => uint8)` — hash `keccak256(abi.encode(collateralVault, borrowVault))`.
- `nextSubAccountId: uint8` (private, starts at 1).

### 9.2 API critica

`createPositionOnDemand(collateralVault, borrowVault, initialCollateral, borrowedAmount)` (L.283):
- Se allocation esiste → verifica no active per pair (`_hasActivePositionForPair`), riusa `subAccountId`.
- Altrimenti → alloca `nextSubAccountId++`, salva in `positionKeyToSubAccount`.
- Emette `PositionCreated(id, subId, collat, borrow)`.

**⚠ Bug**: la guardia `if (nextSubAccountId > 255) revert(...)` (L.306-308) è codice morto — `uint8` non può superare 255. In realtà `nextSubAccountId++` reverte con Panic 0x11 (overflow) quando arriva a 255 (perché uint8 in 0.8.x reverte). Vedi PLG-097.

`closePositionRecord(id)` (L.233): swap-and-pop su `_activePositionIds`, marca `isActive = false`. Il subAccountId NON viene deallocato (design intenzionale — permette riuso).

### 9.3 Invariants

- `_registeredTokens` e `_tokenCodes` sono bijective (`_tokenCodes[_vaults[tc]] == tc`).
- `positionKeyToSubAccount[hash]` monotonic — appena assegnato, non cambia.
- Nessun ownership recovery / timelock. Un solo owner (il Plugin dopo `transferOwnership`).

---

## 10. MorphoRegistry

**Fonte**: `contracts/plugins/MorphoRegistry.sol` (271 righe)

Registry condiviso market (per MorphoPlugin) + vault (per MorphoVaultPlugin).

### 10.1 Storage market

- `_marketConfigs: mapping(bytes32 => MarketConfig)`, key = `keccak256(abi.encodePacked(collateralCode, "|", loanCode))` (L.66-68).
- `_collateralCodes`, `_loanCodes` (parallel arrays), `_isRegistered`.

**⚠ Nota**: `abi.encodePacked` con delimiter `"|"` NON è collision-free se i token code contengono il carattere `|`. Vedi PLG-108. In pratica tokenCode è ASCII short (WETH/USDC/…), quindi il rischio è basso.

### 10.2 Storage vault

- `_vaultConfigs: mapping(address => VaultConfig)`
- `_vaultApproved: mapping(address => bool)`
- `_registeredVaults: address[]`
- `_defaultVaults: mapping(string => address)` (assetCode → default vault)

### 10.3 API

Owner-only: `configureMarket`, `setMarketStatus`, `configureVault`, `removeVault`, `setVaultStatus`, `setDefaultVault`.

Views: `getMarketParams`, `getMarketId`, `isMarketConfigured`, `getRegisteredMarkets`, e analoghi per vault.

Invariants:
- `MarketConfig.marketId == params.id()` (computato in `configureMarket` L.107).
- Nessuna validazione che `oracle`, `irm` siano approved on Morpho (`morpho.isIrmEnabled(irm)`, `morpho.isLltvEnabled(lltv)`).
- `_registeredVaults` mai svuotato in caso di rimozione parziale (rimuove ma non compatta altrove).

---

## 11. Dipendenze incrociate ed elementi ricorrenti

- Tutti i plugin definiscono localmente un'interfaccia `IFlashLoanService` con la stessa firma (in Morpho è `IFlashLoanServiceMorpho`) → duplicazione di sorgente della verità (vedi PLG-136).
- Tutti i plugin di lending emettono `Deposited(tokenCode, amount)` e `Withdrawn(tokenCode, amount)` (ereditati da `IProtocolAdapter`), oltre a eventi protocol-specific (`AaveDeposit`, `EulerDeposit`, `MorphoSupplyCollateral`, `VaultDeposited`, …).
- Nessuno usa `Ownable2Step` (accidental owner transfer = perdita permanente).
- Nessuno è dietro proxy/beacon per l'implementazione (immutable code), ma dipende da `IBeacon` per moduli esterni.
- Nessun plugin implementa storage-aware upgradability layout (nessun gap `__gap[]` in caso di futura migrazione).

---

## 12. Superficie di attacco cross-plugin

| Vector | Descrizione | Plugin affetti |
| ------ | ----------- | -------------- |
| Spot manipulation su `getExpectedOutput` | usato per determinare `flashLoanAmount` in `openLeverageAtomic` | Aave, Euler, Morpho (via FlashLoanService → UniswapV3Direct) |
| Slippage assente in swap durante callback | `IFlashLoanService.swap(tokenIn, tokenOut, amountIn)` senza minOut | Aave (L.742), Euler (L.986), Morpho (L.847), UniV3Direct (L.151) |
| Callback flash loan non validata contro tokens | `tokens[0]` non confrontato con `_flashLoanContext` | Aave, Euler, Morpho |
| Owner senza timelock / senza 2-step | rug/typo | Tutti |
| `msg.sender == LiquidityManager` che riceve fondi da closeLeverageAtomic | dipende dall'implementazione del LiquidityManager | Aave (L.683/689), Euler (L.894/900), Morpho (L.793/799) |

Vedi il documento `04-plugins-flows.md` per i sequence diagrams dei flussi.

