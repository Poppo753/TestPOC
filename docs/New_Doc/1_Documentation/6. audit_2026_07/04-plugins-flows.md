# 04 — Plugins: Flussi operativi (sequence diagrams)

Documento di audit (rev. 2026-07) — flussi step-by-step per ogni operazione dei plugin, con attore → contratto → destinazione. I diagrammi sono in ASCII con notazione tempo verticale.

Legenda:
- `User` = EOA finale (utente o keeper)
- `PM` = `ProtocolManager` (orchestratore centrale)
- `PG` = `ProxyGeneral` (custodian dei fondi)
- `FLS` = `FlashLoanService` (wrapper Balancer)
- `Plugin` = specifico plugin (Aave/Euler/Morpho/Univ3)
- `Aave/Euler/Morpho/Router` = protocollo esterno
- `Registry` = registry associato

---

## 1. AaveV3Plugin

### 1.1 Deposit (supply)

```
User → PM  : requestDeposit("WETH", 1e18)
PM → PG    : (PG holds WETH)
PM → PG    : proxy.transfer(WETH, AaveV3Plugin, 1e18)
PM → Plugin: deposit("WETH", 1e18)
Plugin     : _resolveToken("WETH") → underlying via TokenManager/Beacon
Plugin     : balance = WETH.balanceOf(this)   // must be ≥ 1e18
Plugin     : WETH.safeIncreaseAllowance(aavePool, 1e18)
Plugin     : aToken = registry.getAToken("WETH")
Plugin     : aTokenBefore = aWETH.balanceOf(this)
Plugin → aavePool : supply(WETH, 1e18, this, 0)
aavePool → Plugin : mints aWETH (auto-enable collateral first-time)
Plugin     : aTokenReceived = aWETH.balanceOf(this) - aTokenBefore
Plugin     : emit AaveDeposit("WETH", WETH, 1e18, aTokenReceived)
Plugin     : emit Deposited("WETH", 1e18)
Plugin → PM: return true
```

### 1.2 Withdraw

```
User → PM  : requestWithdraw("WETH", 1e18)
PM → Plugin: withdraw("WETH", 1e18)
Plugin     : aToken = registry.getAToken("WETH")
Plugin     : aTokenBalance = aWETH.balanceOf(this)  // reverte se 0
Plugin     : withdrawAmount = (amount == 0) ? uint256.max : amount
Plugin     : proxyGeneral = beacon.getImplementation("ProxyGeneral")
Plugin → aavePool : withdraw(WETH, withdrawAmount, proxyGeneral)
aavePool → PG : direct transfer WETH
Plugin     : emit AaveWithdrawal / Withdrawn
Plugin → PM: return true
```

### 1.3 Borrow

```
User → PM  : requestBorrow("USDC", 1000e6)
PM → Plugin: borrow("USDC", 1000e6)
Plugin → aavePool : borrow(USDC, 1000e6, VARIABLE_RATE_MODE=2, 0, this)
aavePool → Plugin : mint variableDebtUSDC, transfer USDC to plugin
Plugin → PG: USDC.safeTransfer(proxyGeneral, 1000e6)
Plugin     : emit AaveBorrow / Borrowed
Plugin → PM: return true
```

### 1.4 Repay

```
User → PM  : requestRepay("USDC", 1000e6)
PM → PG    : proxy.transfer(USDC, Plugin, 1000e6)
PM → Plugin: repay("USDC", 1000e6)
Plugin     : variableDebtToken = registry.getVariableDebtToken("USDC")
Plugin     : currentDebt = debtUSDC.balanceOf(this)
Plugin     : repayAmount = (amount == 0 || amount >= currentDebt) ? uint256.max : amount
Plugin     : needed = repayAmount == max ? currentDebt : repayAmount
Plugin     : approveAmount = (repayAmount == max) ? currentDebt + currentDebt/100 : repayAmount
Plugin     : if (approveAmount > balance) approveAmount = balance
Plugin     : USDC.safeIncreaseAllowance(aavePool, approveAmount)
Plugin → aavePool : repay(USDC, repayAmount, VARIABLE_RATE_MODE, this)
aavePool → Plugin : burn variableDebtUSDC, pull USDC
Plugin → PM: return true
```

### 1.5 Open leverage atomic

```
Owner → Plugin: openLeverageAtomic(params={ collat="WETH", borrow="USDC", collatAmount, targetLev, minHF, deadline })
Plugin: validate deadline, targetLev ∈ [110, 500]
Plugin: WETH.safeTransferFrom(msg.sender, this, collatAmount)
Plugin: flashLoanAmount = FLS.getExpectedOutput(WETH, USDC, collatAmount) * (targetLev-100) / 100
Plugin: _flashLoanContext = { OPEN, user, initialCollat, 0, "WETH", "USDC" }
Plugin: _inFlashLoanCallback = true
Plugin → FLS: executeFlashLoan([USDC], [flashLoanAmount], "")
   FLS → Balancer: flashLoan(USDC, amount)
   Balancer → FLS: transfer USDC
   FLS → Plugin: transfer USDC (flashLoanAmount)
   FLS → Plugin: onFlashLoanReceived(...)
      Plugin: msg.sender == FLS?  ✓
      Plugin: _inFlashLoanCallback == true?  ✓
      Plugin → FLS: safeIncreaseAllowance(FLS, flashLoanAmount)
      Plugin → FLS: swap(USDC, WETH, flashLoanAmount) [NO minOut]
      FLS → UniV3: exactInputSingle(USDC→WETH)
      Plugin: totalCollat = initialCollat + collateralFromSwap
      Plugin → aavePool: safeIncreaseAllowance(pool, totalCollat)
      Plugin → aavePool: supply(WETH, totalCollat, this, 0)
      Plugin → aavePool: borrow(USDC, flashLoanAmount+fee, VARIABLE, 0, this)
      Plugin → FLS: transfer USDC (repay Balancer)
   FLS → Balancer: return flashLoan
Plugin: _inFlashLoanCallback = false
Plugin: read aToken.balanceOf, debtToken.balanceOf, getUserAccountData
Plugin: if (healthFactor < minHF) REVERT HealthFactorTooLow  // full rollback
Plugin: emit LeverageOpenedAtomic(...)
Plugin: delete _flashLoanContext
```

### 1.6 Close leverage atomic

```
Owner|LiquidityManager|self → Plugin: closeLeverageAtomic(params={ collat, borrow, maxSlippageBps, deadline })
Plugin: currentDebt = debtToken.balanceOf(this)  // reverte se 0
Plugin: _flashLoanContext = { CLOSE, msg.sender, 0, maxSlippageBps, collat, borrow }
Plugin → FLS: executeFlashLoan([USDC], [currentDebt], "")
   FLS → Plugin: onFlashLoanReceived(...)
      Plugin → aavePool: safeIncreaseAllowance(pool, flashLoanAmount)
      Plugin → aavePool: repay(USDC, flashLoanAmount, VARIABLE, this)
      Plugin → aavePool: withdraw(WETH, uint256.max, this)  // to self
      Plugin → FLS: safeIncreaseAllowance(FLS, collateralBalance)
      Plugin → FLS: swap(WETH, USDC, collateralBalance) [NO minOut]
      Plugin: if (borrowReceived < flashLoanAmount+fee) REVERT SlippageExceeded
      Plugin → FLS: transfer USDC (repay Balancer)
Plugin: collateralReturned = WETH.balanceOf(this)
Plugin → msg.sender: transfer WETH (whatever remains)
Plugin: borrowExcess = USDC.balanceOf(this)
Plugin → msg.sender: transfer USDC (excess after repay)
Plugin: emit LeverageClosedAtomic
```

> **⚠** Se `msg.sender == LiquidityManager` allora il collaterale/USDC escess **non va a ProxyGeneral** — dipende dall'implementazione di LiquidityManager. Vedi PLG-009.

### 1.7 Emergency withdraw all

```
Owner → Plugin: emergencyWithdrawAll(["WETH", "USDC"])
Plugin: for each tokenCode:
   aToken = registry.getATokenSafe(tokenCode) // may return address(0)
   if aTokenBalance > 0:
      Plugin → aavePool: withdraw(underlying, uint256.max, proxyGeneral)
      emit EmergencyWithdraw
// NB: nessun try/catch — se una withdraw fallisce (es. HF < 1) tutto reverte
```

---

## 2. EulerV2Plugin

### 2.1 Deposit (batch EVC)

```
User → PM → PG → Plugin: (WETH landed on plugin)
PM → Plugin: deposit("WETH", 1e18)
Plugin: token = _resolveToken, vault = registry.getVault("WETH")
Plugin: balance ≥ 1e18? if not REVERT
Plugin → WETH: safeIncreaseAllowance(vault, 1e18)
Plugin: needEnableCollateral = !evc.isCollateralEnabled(this, vault)
Plugin: build items = [ maybe(enableCollateral), deposit(1e18, this) ]
Plugin → EVC: batch(items)
   EVC → EVC: enableCollateral(this, vault)  [conditional]
   EVC → vault: deposit(1e18, this)          [onBehalfOfAccount = this]
   vault: pulls WETH from plugin, mints shares to plugin
   EVC → EVC: deferred requireAccountStatusCheck
Plugin: sharesReceived = balanceOf delta
Plugin: emit EulerDeposit
```

### 2.2 Withdraw (non-batch)

```
PM → Plugin: withdraw("WETH", 1e18)
Plugin: vault = registry.getVault("WETH"); shares = vault.balanceOf(this); reverte se 0
Plugin: maxW = vault.maxWithdraw(this); withdrawAmount = clamp(amount, maxW)
Plugin → vault: withdraw(withdrawAmount, this, this)  // receiver=self, owner=self
vault → Plugin: transfer WETH
Plugin → PG: WETH.safeTransfer(proxyGeneral, withdrawAmount)
Plugin: emit EulerWithdrawal
```

### 2.3 Borrow (batch EVC)

```
PM → Plugin: borrow("USDC", 1000e6)
Plugin: vault = registry.getVault("USDC")
Plugin: needEnableController = !evc.isControllerEnabled(this, vault)
Plugin: items = [ maybe(enableController), borrow(1000e6, this) ]
Plugin → EVC: batch(items)
   EVC → vault: borrow(1000e6, this)
   vault → Plugin: transfer USDC
Plugin → PG: USDC.safeTransfer(proxyGeneral, 1000e6)
Plugin: emit EulerBorrow
```

### 2.4 Repay (non-batch, dust handling)

```
PM → PG → Plugin: USDC landed on plugin
PM → Plugin: repay("USDC", amount)
Plugin: currentDebt = vault.debtOf(this); if 0 return true
Plugin: repayAmount = (amount==0 || amount≥debt) ? debt : amount
Plugin → USDC: safeIncreaseAllowance(vault, repayAmount)
Plugin → vault: repay(repayAmount, this)
Plugin: remainingDebt = vault.debtOf(this)
if remainingDebt > 0 && remainingDebt < 1000:
   Plugin → USDC: safeIncreaseAllowance(vault, remainingDebt)
   Plugin → vault: repay(remainingDebt, this)
Plugin: emit EulerRepay
```

### 2.5 Close position (repay + disable controller + redeem + disable collateral)

```
PM → Plugin: closePosition("USDC", "WETH")   // strings
Plugin: pre-batch approve of USDC for repay
Plugin: build batch items dynamically:
   [0] repay(uint256.max, this) — su borrowVault
   [1] IEVault.disableController() — su borrowVault (auto EVC call)
   [2] redeem(uint256.max, this, this) — su collateralVault
   [3] IEVC.disableCollateral(this, collateralVault) — se enabled
Plugin → EVC: batch(items)
Plugin → PG: safeTransfer(collateralToken, collateralBalance)
```

### 2.6 Open leverage atomic (batch EVC in callback)

```
Owner → Plugin: openLeverageAtomic({collat, borrow, collatAmount, targetLev, minHF, deadline})
Plugin: validate; collat = IEVault(collatVault).asset(); borrow = IEVault(borrowVault).asset()
Plugin: WETH.safeTransferFrom(user, this, collatAmount)
Plugin: flashLoanAmount = FLS.getExpectedOutput(collat, borrow, collatAmount) * mult / 100
Plugin: _flashLoanContext = {OPEN, user, collatVault, borrowVault, initialCollat, 0}
Plugin: _inFlashLoanCallback = true
Plugin → FLS: executeFlashLoan([borrow], [flashLoanAmount], "")
   FLS → Plugin: onFlashLoanReceived
      Plugin → FLS: safeIncreaseAllowance(FLS, flashLoanAmount)
      Plugin → FLS: swap(borrow, collat, flashLoanAmount)  [NO minOut]
      Plugin → collateralVault: safeIncreaseAllowance
      Plugin → EVC.batch:
         [0] enableCollateral(this, collateralVault)
         [1] IEVault.deposit(totalCollat, this)
         [2] enableController(this, borrowVault)
         [3] IEVault.borrow(flashLoanAmount+fee, this)
      Plugin → FLS: transfer borrow token (repay Balancer)
Plugin: totalCollat, totalDebt, HF = _getPositionState
Plugin: if HF < minHF REVERT
Plugin → EulerRegistry: createPositionOnDemand(collatVault, borrowVault, initialCollat, totalDebt)
Plugin: emit LeverageOpenedAtomic; delete ctx
```

> ⚠ Tutte le operazioni EVC eseguite su `address(this)` (main account, sub-id 0). Il sub-account allocato in registry rimane meramente contabile.

### 2.7 Close leverage atomic

```
Owner|LiquidityManager|self → Plugin: closeLeverageAtomic({collat, borrow, maxSlippageBps, deadline})
Plugin: currentDebt = IEVault(borrowVault).debtOf(this); REVERT se 0
Plugin: _flashLoanContext = {CLOSE, ...}
Plugin → FLS: executeFlashLoan([borrow], [currentDebt], "")
   FLS → Plugin: onFlashLoanReceived
      Plugin → borrow: safeIncreaseAllowance(borrowVault, flashLoanAmount)
      Plugin → EVC.batch:
         [0] IEVault.repay(flashLoanAmount, this)  // su borrowVault
         [1] IEVault.redeem(shares, this, this)   // su collateralVault
         [2] IEVault.disableController()          // su borrowVault
         [3] IEVC.disableCollateral(this, collateralVault)
      Plugin → FLS: safeIncreaseAllowance(FLS, collateralWithdrawn)
      Plugin → FLS: swap(collat, borrow, collateralWithdrawn)  [NO minOut]
      Plugin: if usdcReceived < flashLoanAmount+fee REVERT SlippageExceeded
      Plugin → FLS: transfer borrow (repay Balancer)
Plugin: collateralReturned = collat.balanceOf(this)
Plugin → msg.sender: transfer collat
Plugin → msg.sender: transfer borrow excess
Plugin → EulerRegistry: find active position for pair → closePositionRecord
Plugin: emit LeverageClosedAtomic; delete ctx
```

### 2.8 Add/Remove collateral to leverage position

```
Owner → Plugin: addCollateralToPosition(positionId, amount)
Plugin: pos = registry.getPosition(id)
Plugin: positionAccount = _getPositionAccount(pos)  // sub-account if it has state, else main
Plugin: if positionAccount == this:
   safeIncreaseAllowance(collateralVault, amount)
Plugin: else:
   safeTransfer(collateralToken, positionAccount, amount)
   evc.call(collateralToken, positionAccount, 0, IERC20.approve(collateralVault, amount))
   ⚠ NB: EVC.call passa msg.sender = EVC al token, non il sub-account → approve settato su allowance EVC, non su sub-account
Plugin: evc.call(collateralVault, positionAccount, 0, IEVault.deposit(amount, positionAccount))
Plugin: emit CollateralAdded
```

### 2.9 closePosition(uint256) — ATTENZIONE: no access control

```
ANYONE → Plugin: closePosition(positionId)  ⚠ NO MODIFIER
Plugin: pos = registry.getPosition(id); reverte se !isActive
Plugin: collateralTokenCode = registry.getTokenCode(collateralVault)
Plugin: borrowTokenCode = registry.getTokenCode(borrowVault)
Plugin → this.closeLeverageAtomic(...)  // external self-call
   inside closeLeverageAtomic, msg.sender = this (autorizzato in onlyOwnerOrLiquidityManager)
Plugin: if still active → closePositionRecord
Plugin: return baseAssetReturned
```

Ne consegue che chiunque può forzare la chiusura di una posizione tramite `closePosition(id)`.

---

## 3. MorphoPlugin

### 3.1 supplyCollateral

```
PM → PG → Plugin: WETH landed
PM → Plugin: supplyCollateral("WETH", "USDC", 1e18)
Plugin: params = registry.getMarketParams("WETH","USDC")   // { loanToken, collateralToken, oracle, irm, lltv }
Plugin: balance ≥ 1e18? if not REVERT
Plugin → WETH: safeIncreaseAllowance(morpho, 1e18)
Plugin → Morpho: supplyCollateral(params, 1e18, this, "")
Plugin: emit MorphoSupplyCollateral / Deposited
```

`deposit("WETH", amount)` risolve il primo market che ha WETH come collateral via `_findMarketForCollateral` (routing implicito).

### 3.2 withdrawCollateral

```
PM → Plugin: withdrawCollateral("WETH", "USDC", 1e18)
Plugin: params = registry.getMarketParams("WETH","USDC")
Plugin: pos = morpho.position(marketId, this); collateral > 0
Plugin: withdrawAmount = (amount == 0) ? pos.collateral : amount
Plugin → Morpho: withdrawCollateral(params, withdrawAmount, this, proxyGeneral)
Morpho → PG: direct transfer WETH
Plugin: emit MorphoWithdrawCollateral / Withdrawn
```

### 3.3 Borrow

```
PM → Plugin: borrow("WETH", "USDC", 1000e6)
Plugin: params = getMarketParams
Plugin → Morpho: borrow(params, 1000e6, 0, this, proxyGeneral)
Morpho → PG: transfer USDC
Plugin: emit MorphoBorrow / Borrowed
```

### 3.4 Repay (full via shares to handle dust)

```
PM → PG → Plugin: USDC landed
PM → Plugin: repay("WETH", "USDC", amount)
Plugin: pos = morpho.position(marketId, this); if borrowShares == 0 return true
Plugin: balance = USDC.balanceOf(this)
Plugin → USDC: safeIncreaseAllowance(morpho, balance)  ⚠ approva TUTTO il balance
if amount == 0 || amount ≥ balance:
   Plugin → Morpho: repay(params, 0, pos.borrowShares, this, "")  // shares path
else:
   Plugin → Morpho: repay(params, amount, 0, this, "")            // assets path
Plugin: emit MorphoRepay / Repaid
```

### 3.5 Close market position

```
PM → Plugin: closeMarketPosition("WETH", "USDC")
Plugin: params = registry.getMarketParams
Plugin: pos = morpho.position(marketId, this)
if pos.borrowShares > 0 && USDC balance > 0:
   safeIncreaseAllowance(morpho, balance)
   morpho.repay(params, 0, pos.borrowShares, this, "")
Plugin: re-read pos after repay
if pos.collateral > 0:
   morpho.withdrawCollateral(params, pos.collateral, this, proxyGeneral)
```

### 3.6 Open leverage atomic

```
Owner → Plugin: openLeverageAtomic(params)
Plugin: WETH.safeTransferFrom(user, this, collatAmount)
Plugin: flashLoanAmount = FLS.getExpectedOutput(...) * (targetLev-100) / 100
Plugin: _flashLoanContext = {OPEN,...}
Plugin → FLS: executeFlashLoan([USDC],[flashLoanAmount],"")
   FLS → Plugin: onFlashLoanReceived
      Plugin → FLS: safeIncreaseAllowance
      Plugin → FLS: swap(USDC, WETH, flashLoanAmount) [NO minOut]
      Plugin → Morpho: safeIncreaseAllowance(morpho, totalCollat)
      Plugin → Morpho: supplyCollateral(params, totalCollat, this, "")
      Plugin → Morpho: borrow(params, flashLoanAmount+fee, 0, this, this)
      Plugin → FLS: transfer USDC (repay Balancer)
Plugin: totalCollat = pos.collateral; totalDebt from shares math
Plugin: HF = _computeHealthFactor
Plugin: if HF < minHF REVERT   ⚠ HF has scaling bug (see PLG-049) → openLeverageAtomic sempre REVERT
Plugin: emit LeverageOpenedAtomic
```

**PROBLEMA CRITICO**: la HF ritornata da `_computeHealthFactor` è in raw ratio, non 1e18. Il confronto `HF < 1.05e18` è sempre vero → `openLeverageAtomic` reverte sempre con `HealthFactorTooLow`. Vedi PLG-049.

### 3.7 Close leverage atomic

Analogo ad Aave/Euler: flash loan del debito, repay via shares, withdrawCollateral to self, swap, repay flash, invia excess a `msg.sender`.

Il buffer di `currentDebt + currentDebt/100` (L.765) è arbitrario e insufficiente per rate di interesse molto alti sul singolo block.

---

## 4. MorphoVaultPlugin

### 4.1 Deposit (via default vault)

```
PM → PG → Plugin: USDC landed
PM → Plugin: deposit("USDC", 1000e6)
Plugin: vault = registry.getDefaultVault("USDC"); reverte se address(0)
Plugin → _vaultDeposit(vault, 1000e6):
   asset = vault.asset()
   balance ≥ amount?; maxDep = vault.maxDeposit(this); amount ≤ maxDep?
   safeIncreaseAllowance(vault, 1000e6)
   shares = vault.deposit(1000e6, this)   // ERC-4626 standard
   _addActiveVault(vault)
   emit VaultDeposited(vault, asset, 1000e6, shares); emit Deposited("VAULT", 1000e6)
```

### 4.2 Withdraw

```
PM → Plugin: withdraw("USDC", 1000e6)
Plugin: vault = registry.getDefaultVault("USDC")
Plugin → _vaultWithdraw(vault, 1000e6):
   maxW = vault.maxWithdraw(this)
   withdrawAmount = (amount == 0) ? maxW : amount
   if withdrawAmount > maxW REVERT WithdrawExceedsMax
   sharesBurned = vault.withdraw(withdrawAmount, proxyGeneral, this)   // asset direttamente a PG
   if balance == 0 → _removeActiveVault
   emit VaultWithdrawn / Withdrawn("VAULT", withdrawAmount)
```

### 4.3 Vault-specific redeem (per shares)

```
PM → Plugin: vaultRedeem(vault, shares)
Plugin: onlyApprovedVault(vault)
Plugin: sharesToRedeem = (shares == 0) ? balanceOf : shares
Plugin: assetsReceived = vault.redeem(sharesToRedeem, proxyGeneral, this)
if balance == 0 → _removeActiveVault
emit VaultRedeemed
```

### 4.4 Emergency withdraw

```
Owner → Plugin: emergencyWithdrawAll(tokenCodes)
Plugin: _redeemAllVaults(proxyGeneral):
   for each activeVault:
      try v.redeem(shares, proxyGeneral, this) {} catch {}
   ⚠ silently ignore failures
Plugin: sweep leftover asset tokens from plugin to PG
Plugin: delete activeVaults
```

---

## 5. UniswapV3Plugin (wrapper SimpleSwap)

### 5.1 inputSwap

```
Caller → Plugin: inputSwap(WETH, USDC, 1e18)
Plugin: valida params (non-zero, non-same)
Plugin → WETH: safeTransferFrom(caller, this, 1e18)
Plugin → WETH: safeApprove(simpleSwap, 0); safeApprove(simpleSwap, 1e18)
Plugin → SimpleSwap: inputSwap(WETH, USDC, 1e18)  // internally uses Uniswap V3
Plugin: amountOut received
Plugin → USDC: safeTransfer(caller, amountOut)  // return to caller
```

### 5.2 outputSwap

```
Caller → Plugin: outputSwap(WETH, USDC, maxIn, exactOut)
Plugin → WETH: safeTransferFrom(caller, this, maxIn)
Plugin → WETH: safeApprove(0) / safeApprove(maxIn)
Plugin → SimpleSwap: outputSwap(WETH, USDC, maxIn, exactOut)
amountUsed returned
Plugin: excess = maxIn - amountUsed
Plugin → WETH: safeTransfer(caller, excess)
Plugin → USDC: safeTransfer(caller, exactOut)
```

Nessun access control: chiunque con approve valido può usare il plugin.

---

## 6. UniswapV3PluginDirect

### 6.1 inputSwap

```
SwapManager → Plugin: inputSwap(WETH, USDC, 1e18)   // approve pre-esistente da PG a plugin via proxy.approveSpender
Plugin: validate
Plugin → WETH: transferFrom(proxyGeneral, this, 1e18)  // NOT SafeERC20
Plugin → WETH: approve(uniswapRouter, 1e18)             // NOT SafeERC20
try uniswapRouter.exactInputSingle({
   tokenIn: WETH, tokenOut: USDC,
   fee: 3000,                       // HARDCODED
   recipient: this,
   deadline: block.timestamp,        // NO deadline window
   amountIn: 1e18,
   amountOutMinimum: 0,              // ⚠ NO slippage protection
   sqrtPriceLimitX96: 0              // ⚠ NO price limit
}) returns (uint256 outputAmount) → USDC in plugin
Plugin → USDC: transfer(proxyGeneral, outputAmount)
```

### 6.2 outputSwap (analogo)

```
Plugin → uniswapRouter: exactOutputSingle({
   fee: 3000, deadline: block.timestamp, sqrtPriceLimitX96: 0,
   amountOut: exactOut, amountInMaximum: maxIn
})
Plugin → USDC: transfer(proxyGeneral, exactOut)
if unused > 0: transfer refund to proxyGeneral
```

### 6.3 getExpectedOutput (⚠ spot manipulation)

```
Plugin: pool = _getPoolAddress(WETH, USDC, 3000)   // CREATE2 salt
if pool.code.length == 0 → return 0
Plugin: (sqrtPriceX96, tick, ...) = pool.slot0()
Plugin: priceRatio = sqrtPriceX96^2
if spendToken < receiveToken:
   expectedOutput = (amountIn * priceRatio) >> 192
else:
   expectedOutput = (amountIn << 192) / priceRatio
expectedOutput *= (1_000_000 - 3000) / 1_000_000
return expectedOutput * 85 / 100
```

Nota: `quoterV2` immutable è impostato in constructor ma NON viene mai chiamato — la NatSpec dichiara di usare Quoter V2 ma l'implementazione legge da `slot0()`. Doc-drift + spot vulnerability.

---

## 7. Onboarding registry / configurazione

### 7.1 AaveV3Registry — configureToken

```
Owner → AaveV3Registry: configureToken("WETH", underlying, aToken, variableDebtToken)
Registry: validate non-zero
Registry: _tokenConfigs["WETH"] = {underlying, aToken, variableDebtToken, isActive=true}
Registry: se nuovo → append a _registeredTokens
emit TokenConfigured
```

No validazione contro `aavePool.getReserveAToken(underlying)`. Trust-owner totale.

### 7.2 EulerRegistry — setVault + createPositionOnDemand

```
Owner → EulerRegistry: setVault("WETH", vault)
Registry: valida non-zero, non collide con altro token
Registry: _vaults["WETH"] = vault; _tokenCodes[vault] = "WETH"
Registry: append a _registeredTokens
emit VaultSet

Plugin (owner) → EulerRegistry: createPositionOnDemand(collVault, borrowVault, initColl, borrowedAmt)
Registry: positionKey = keccak256(abi.encode(collVault, borrowVault))
Registry: subAccountId = positionKeyToSubAccount[key]
if subAccountId == 0:
   nextSubAccountId++       // ⚠ uint8 overflow reverte alla 255ma allocation
   positionKeyToSubAccount[key] = subAccountId
else:
   check no active for pair
Registry: _positions[id] = {subAccountId, collVault, borrowVault, initColl, borrowedAmt, isActive=true, createdAt=now}
Registry: append id to _activePositionIds
emit PositionCreated
```

### 7.3 MorphoRegistry — configureMarket

```
Owner → MorphoRegistry: configureMarket(collCode, loanCode, collToken, loanToken, oracle, irm, lltv)
Registry: valida non-zero, string non-empty
Registry: params = MarketParams{...}
Registry: marketId = keccak256(abi.encode(params))
Registry: _marketConfigs[keccak(collCode|loanCode)] = {params, marketId, isActive=true}
Registry: append a _collateralCodes, _loanCodes
emit MarketConfigured
```

Vault side: `configureVault(vault, assetCode)` + `setDefaultVault(assetCode, vault)`.

---

## 8. Flusso circuit breaker

Tutti i plugin di lending espongono:

```
Owner → Plugin: activateCircuitBreaker()
Plugin: circuitBreakerTripped = true
Plugin: emit CircuitBreakerActivated(owner) (Aave/Morpho)
        emit CircuitBreakerSet(true) (Euler)

Owner → Plugin: deactivateCircuitBreaker()   // Aave, Morpho — non in interfaccia
Plugin: circuitBreakerTripped = false
        (nessun evento emesso in Aave, Morpho, MorphoVault)
```

Da questo momento, il modifier `notCircuitBroken` blocca deposit/withdraw/borrow/repay/close, ma NON `emergencyWithdrawAll` (che è `onlyOwner`).

---

## 9. Note sulla custody durante `closeLeverageAtomic`

Un pattern condiviso tra Aave/Euler/Morpho è che il collaterale residuo e l'eccedenza di token di debito, dopo `closeLeverageAtomic`, vengono trasferiti a `msg.sender`:

```
Plugin → msg.sender: safeTransfer(collateralToken, collateralReturned)
Plugin → msg.sender: safeTransfer(borrowToken, borrowExcess)
```

Poiché `closeLeverageAtomic` è callable da `owner || LiquidityManager || address(this)`, il `msg.sender` cambia:

| msg.sender | Destinazione fondi |
| ---------- | ------------------ |
| `owner()` (deployer) | owner riceve i fondi (⚠ non ProxyGeneral) |
| `LiquidityManager` | funzionale solo se LiquidityManager gestisce forwarding |
| `address(this)` (via `closePosition(uint256)`) | il plugin stesso li accumula, poi trasferisce (in Euler) a proxyGeneral in `closePositionsForBaseAsset` |

⚠ Il flusso di custody dopo il close leverage NON invia direttamente a ProxyGeneral. Se il caller non lo forwarda, i fondi restano sotto il suo controllo. Vedi PLG-009, PLG-030, PLG-056.
