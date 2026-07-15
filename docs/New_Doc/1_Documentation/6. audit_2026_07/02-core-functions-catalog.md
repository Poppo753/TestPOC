# 02 - Core Functions Catalog (TestPOC / Project4)

> Function-by-function catalogue of the core contracts. For each function:
> **signature**, **visibility & modifiers**, **preconditions**,
> **postconditions**, **outward calls**, **events emitted**, **edge cases /
> notes**. Numbering follows the file order.
>
> Companion to `01-core-architecture.md`. Findings are enumerated in the
> JSON returned in the audit reply.

---

## Table of contents

1. `Beacon.sol`
2. `ProxyGeneral.sol`
3. `LiquidityManager.sol`
4. `SwapManager.sol`
5. `TokenManager.sol`
6. `ValueCalculator.sol`
7. `ProtocolManager.sol`
8. `ParameterManager.sol`
9. `EmergencyHandler.sol`
10. `DepositHelper.sol`

---

## 1. Beacon.sol

### 1.1 `constructor()`
- **Vis / mod**: public.
- **Pre**: none.
- **Post**: `owner = msg.sender`.
- **Edge**: no pendingOwner initialization; nothing else initialized.

### 1.2 `updateImplementation(string module, address newImplementation)`
- **Vis / mod**: `external onlyOwner validModule notFrozen(module)`.
- **Pre**: `newImplementation != 0`, `_isContract(newImpl)`,
  `newImpl != implementations[module]`.
- **Post**: `implementations[module] = newImpl`, `lastUpdate[module] =
  block.timestamp`; if new, added to `registeredModules`; old
  implementation appended to `implementationHistory`.
- **Calls**: `extcodesize(newImplementation)`.
- **Events**: `ImplementationUpdated`.
- **Edge**: cannot register a contract during its own constructor
  (extcodesize returns 0). No timelock — one-tx swap. `notFrozen` allows
  `notFrozen(module)` on a *not-yet-registered* module because
  `moduleFrozen[module] == false` by default.

### 1.3 `getImplementation(string module) → address`
- **Vis / mod**: `external view validModule`.
- **Pre**: registered + not globally frozen + not module-frozen.
- **Post**: returns implementation.
- **Edge**: **reverts** with `"Implementation not found"` or `"Module
  access frozen"` — callers without try/catch will bubble up.

### 1.4 `checkModuleExists`, `getRegisteredModules`, `getImplementationHistory`, `getModuleInfo`
- All view; return storage. `getRegisteredModules` returns the full
  string array (unbounded → gas-heavy for callers).

### 1.5 `freezeModule` / `unfreezeModule`
- **Vis / mod**: `external onlyOwner validModule`.
- **Pre**: `moduleExists[module]`; not already in target state.
- **Post**: toggles `moduleFrozen[module]`.
- **Events**: `ModuleFrozen` / `ModuleUnfrozen`.
- **Edge**: cannot freeze `"BASE_ASSET"` because `moduleExists` was set
  when `updateImplementation` first registered it — actually YES,
  BASE_ASSET can be frozen and would break every downstream module
  (finding CORE-070 informational).

### 1.6 `activateGlobalFreeze` / `deactivateGlobalFreeze`
- **Vis / mod**: `external onlyOwner`.
- **Pre**: not already in target state.
- **Events**: `GlobalFreezeActivated` / `GlobalFreezeDeactivated`.
- **Edge**: global freeze prevents any `getImplementation`, effectively
  bricking every module operation.

### 1.7 `transferOwnership(address newOwner)` / `acceptOwnership()` / `cancelOwnershipTransfer()`
- Two-step ownership pattern.
- **Edge**: `cancelOwnershipTransfer` requires `pendingOwner != 0`. Good.

### 1.8 `batchUpdateImplementations(string[] modules, address[] impls)`
- **Vis / mod**: `external onlyOwner`.
- **Pre**: arrays same length, ≤ 10 items, `!globalFreeze`, and for
  each: valid name, non-zero, contract, not module-frozen, different
  from current.
- **Edge**: like `updateImplementation` but batched — same failure modes.

### 1.9 `getBeaconStatus() / checkSystemHealth()`
- View helpers. `checkSystemHealth` uses fixed 20-slot temp array; **any
  issue beyond the 20th is silently dropped**.

---

## 2. ProxyGeneral.sol

`ProxyGeneral is ERC20, Ownable, ReentrancyGuard`. Does NOT declare
`is IProxyGeneral` — see finding CORE-052.

### 2.1 `constructor(address _beacon, string memory _baseAssetCode)`
- **Pre**: `_beacon != 0`, `_baseAssetCode` non-empty.
- **Post**: `beacon` (immutable), `baseAssetCode`, `paused = false`.
- **Edge**: does not authorize any module by default.

### 2.2 `mint(address to, uint256 amount)`
- **Vis / mod**: `external onlyAuthorizedModule whenNotPaused`.
- **Pre**: `to != 0`, `amount > 0`.
- **Post**: `_mint(to, amount)`.
- **Events**: `LPTokenMinted` (custom, differs from ERC20 `Transfer(0,to,amount)`).
- **Edge**: neither ERC20 mint nor burn are pausable at the transfer
  level. Standard LP transfers between users are not gated by `paused`.

### 2.3 `burn(address from, uint256 amount)`
- **Vis / mod**: `external onlyAuthorizedModule whenNotPaused`.
- **Pre**: `from != 0`, `amount > 0`, `balanceOf(from) ≥ amount`.
- **Post**: `_burn`.
- **Events**: `LPTokenBurned`.

### 2.4 `transferFunds(address to, address asset, uint256 amount)`
- **Vis / mod**: `external onlyAuthorizedModule whenNotPaused`.
- **Pre**: `to != 0`, `amount > 0`, sufficient balance.
- **Post**: transfers ETH (via `call`) or ERC20 (via raw `.transfer`).
- **Events**: `AssetTransferred`.
- **Edge**: uses `IERC20.transfer` **not** `SafeERC20.safeTransfer`.
  USDT-like tokens without a return value will always fail here.

### 2.5 `getAssetBalance(address asset) view`
- Returns `address(this).balance` if `asset == 0`, else `IERC20.balanceOf(this)`.

### 2.6 `withdrawToken(string tokenCode, uint256 amount, address to)`
- **Vis / mod**: `external onlyAuthorizedModule whenNotPaused`.
- **Pre**: non-empty code, amount > 0, `to != 0`, sufficient balance.
- **Post**: `IERC20(tokenAddress).safeTransfer(to, amount)`.
- **Calls**: `_resolveTokenAddress` → Beacon + TokenManager.
- **Events**: `TokenWithdrawn`.

### 2.7 `depositToken(string tokenCode, uint256 amount, address from)`
- **Vis / mod**: `external onlyAuthorizedModule whenNotPaused`.
- **Pre**: token code non-empty, amount > 0, `from != 0`.
- **Post**: `IERC20(tokenAddress).safeTransferFrom(from, this, amount)`.
- **Events**: `TokenDeposited`.

### 2.8 `_resolveTokenAddress(string tokenCode) internal view`
- Returns `Beacon.getImplementation("BASE_ASSET")` if code matches
  baseAssetCode, else `TokenManager.getTokenInfo(...).tokenAddress`.
- **Edge**: `getTokenInfo` reverts on inactive tokens (finding CORE-072).

### 2.9 `approveSpender(address token, address spender, uint256 amount)`
- **Vis / mod**: `external onlyAuthorizedModule`. **No pause check.**
- **Post**: `IERC20(token).approve(spender, amount)`.
- **Events**: `SpenderApproved`.
- **Edge**: uses raw `.approve`. USDT reverts if allowance is non-zero
  on second call (needs zero-then-set). See finding CORE-062.

### 2.10 `transferToModule` / `transferFromModule`
- **Vis / mod**: `external onlyAuthorizedModule`. No pause check.
- Uses raw `.transfer` / `.transferFrom` — same USDT issue.

### 2.11 `authorizeModule(address module, string memory moduleType)`
- **Vis / mod**: `external onlyOwner`.
- **Pre**: `module != 0`, not already authorized.
- **Post**: `authorizedModules[module] = true`.
- **Events**: `ModuleAuthorized`.
- **Edge**: string `moduleType` is only informational.

### 2.12 `deauthorizeModule(address module)`
- Symmetric. Emits `ModuleDeauthorized`.

### 2.13 `isAuthorizedModule(address module) view`
- Public view.

### 2.14 `pause() / unpause() / isPaused()`
- `pause`: `external onlyAuthorizedModule` — **ANY authorized module can
  halt the entire protocol**. That includes SwapManager, LiquidityManager,
  every plugin adapter, and every lens adapter. See finding CORE-055.
- `unpause`: `external onlyOwner`.
- `isPaused` view — but `paused` public state already exists → redundant.

### 2.15 `emergencyTransferAll(address recipient)`
- **Vis / mod**: `external onlyOwner whenPaused`.
- **Pre**: `recipient != 0`, system paused.
- **Post**: sweeps base asset (via `safeTransfer`) and ETH (via `.call`).
- **Events**: `EmergencyTransferExecuted`.
- **Edge**: **DOES NOT** sweep tracked ERC20s registered in TokenManager;
  finding CORE-054.

### 2.16 Rate-limit surface (`setRateLimit`, `checkRateLimit`, `trackOperation`)
- `setRateLimit(string opType, uint256 hourly, uint256 daily)` —
  `onlyOwner`; requires `hourly ≤ daily || daily == 0`.
- `checkRateLimit(user, opType, amount) view` — returns
  `(allowed, remainingHourly, remainingDaily)`. Considers the 1-hour /
  1-day rolling windows via `lastHourReset`/`lastDayReset`.
- `trackOperation(user, opType, amount)` — `onlyAuthorizedModule`;
  refreshes counters, checks overflow via `require(a + b >= a)`.
- **Edge**: `checkRateLimit` uses `>=`, so a request of exactly
  `remainingHourly` passes. `trackOperation` will THEN add and possibly
  fill / exceed the limit — the pattern “check then track” is racy
  cross-tx but atomic within a single tx, so OK if both are called
  in-order by the same caller. LiquidityManager does exactly this.
- The value returned by `checkRateLimit` for `amount == 0` is “allowed =
  (remainingHourly ≥ 0 && remainingDaily ≥ 0)” which is always true
  when a limit is configured — allows using it as a “remaining” getter.

### 2.17 Legacy hourly tracking (`setHourlyWithdrawn`, `getHourlyWithdrawn`, `incrementHourlyWithdrawn`)
- Setters are `onlyAuthorizedModule`.
- **NO PRODUCTION CALLER** writes to these. LiquidityManager reads them
  in `checkWithdrawLimits`. Consequence: the withdraw hourly/daily
  budget check always sees 0 used → passes. Finding CORE-022.

### 2.18 `setModuleParameter` / `getModuleParameter`
- Owner-only setter, public getter, entirely unused elsewhere. Finding
  CORE-064 (informational — dead code).

### 2.19 `receive()` and `fallback()`
- `receive() external payable` — silently accepts ETH.
- `fallback() external payable` — reverts with “Function does not exist”.

---

## 3. LiquidityManager.sol

`LiquidityManager is ILiquidityManager, ReentrancyGuard, Ownable`.
Uses `SafeERC20`.

### 3.1 `constructor(address _beacon, string memory _baseAssetCode)`
- Sets `beacon`, `baseAssetCode`. Initializes `WithdrawLimits` scaled to
  base asset decimals via `IERC20Metadata(baseAsset).decimals()`.
- **Pre**: `_beacon != 0`, non-empty base asset code.
- **Edge**: constructor calls `IBeacon.getImplementation("BASE_ASSET")`
  and expects it to already be registered. If not, deployment reverts.

### 3.2 `deposit(uint256 amount)`
- **Vis / mod**: `external nonReentrant whenNotPaused whenDepositsEnabled`.
- **Pre**: amount > 0; between `minDeposit`/`maxDeposit`; rate-limit OK.
- **Effect**: computes fee, calls `trackOperation`, computes `shares`
  based on `getTotalPoolValueView` (or 1:1 bootstrap), `safeTransferFrom`
  from user to ProxyGeneral for `netDeposit`, `safeTransferFrom` from
  user to `feeRecipient` for the fee, `proxy.mint(user, shares)`.
- **Calls**: ParameterManager (twice), ProxyGeneral (rate-limit,
  supply, mint), ValueCalculator (`getTotalPoolValueView`), BASE_ASSET.
- **Events**: `Deposit`.
- **Edge**: does not use `SafeERC20.safeIncreaseAllowance` internally
  because the transfer is direct from user (user must have approved LM
  for the FULL `amount`, otherwise the fee `safeTransferFrom` reverts —
  this is a UX subtlety NOT documented in ILiquidityManager).
- **Edge**: rate-limit uses `amount` (gross) not `netDeposit`.
- **Edge**: post-conditions assert supply and balance changes — good.

### 3.3 `withdraw(uint256 _shares)`
- **Vis / mod**: `external nonReentrant whenNotPaused whenWithdrawsEnabled`.
- Uses hardcoded 20-minute deadline; delegates to `_withdrawInternal`.

### 3.4 `withdrawWithDeadline(uint256 _shares, uint256 deadline)`
- **Vis / mod**: `external nonReentrant whenNotPaused whenWithdrawsEnabled`.
- **Pre**: `block.timestamp ≤ deadline`.
- Delegates to `_withdrawInternal`.

### 3.5 `_withdrawInternal(uint256 _shares, uint256 deadline) internal`
- **Steps** (line 243–397):
  1. reads `poolReserveRatio`;
  2. resolves ProxyGeneral / BASE_ASSET / ValueCalculator;
  3. `require(balanceOf(user) ≥ _shares)`;
  4. `poolInfo = calculator.getTotalPoolValue()`;
  5. `amount = _shares * totalValue / totalSupply`;
  6. `checkWithdrawLimits(user, amount)` — see finding CORE-022;
  7. compute fee;
  8. `checkRateLimit`, `trackOperation` (on gross `amount`);
  9. initial reserve ratio check;
  10. if base asset balance < netWithdraw → `_executeAutomaticSwap(...)`;
  11. **silently clamps `netWithdraw` down to obtained balance** (line 329);
  12. post-swap reserve-ratio check;
  13. `proxy.burn(user, _shares)`;
  14. `proxy.withdrawToken(baseAssetCode, netWithdraw + fee, this)`;
  15. `BASE_ASSET.safeTransfer(user, netWithdraw)`;
  16. optional `safeTransfer` to feeRecipient;
  17. supply-change assertion;
  18. events.
- **Edge**: step 11 breaks I-04 (finding CORE-021).
- **Edge**: step 12 uses `totalValue - netWithdraw` in the denominator
  but `totalValue` was captured pre-swap. If tokens were consumed to
  pay the withdraw, `totalValue` is over-stated. Off by up to `maxSlippage`.

### 3.6 `_executeAutomaticSwap(uint256 baseAssetNeeded, IValueCalculatorForModules calculator, uint256 deadline) internal`
- Loop max 10 iterations.
- Selects a token via `calculator.selectTokenForSwap(stillNeeded)`.
- If `selectTokenForSwap` returns empty → falls back to
  `_swapLiquidTokensForBaseAsset` and then
  `_closeProtocolPositionsForBaseAsset`.
- Accepts partial fill at ≥ 97% (hardcoded).
- **Reverts** with `"Could not obtain enough base asset after multiple swaps"`
  if final `stillNeeded > 0` — BUT the earlier `netWithdraw = newBalance`
  clamp means callers usually don’t reach this line.

### 3.7 `_closeProtocolPositionsForBaseAsset(uint256, address proxyGeneral, address baseAssetAddr) internal → uint256`
- try/catch on ProtocolManager resolution and on
  `IProtocolManager(protocolManager).closePositionsForBaseAsset(...)`.
- Uses `balanceAfter - balanceBefore` if positive, else `obtained`.
- **Edge**: on catch, returns 0. Silent failure hides adapter issues.

### 3.8 `_swapLiquidTokensForBaseAsset(uint256, address, address) internal → uint256`
- Iterates `TokenManager.getActiveTokens()`; for each, `balanceOf` in
  ProxyGeneral; calls `SwapManager.performSwapAuto(token, baseAsset,
  balance)`. Try/catch: on failure, continue.
- **Edge**: uses `performSwapAuto` — 20-min internal deadline; may be
  tighter than the caller’s deadline. Also uses the entire balance of
  each token, potentially over-swapping (dust plus dust).

### 3.9 Fee management setters — `setDepositFee`, `setWithdrawFee`, `setFeeRecipient`
- `onlyOwner`; MAX_FEE = 500 bps (5%). Emits update events.
- **Edge**: `setFeeRecipient` requires non-zero; but reverts if zero.
  There is no way to *disable* the fee recipient after setting one
  except `newRecipient != 0`. Fee still charged (line 188) only when
  `feeAmount > 0 && feeRecipient != address(0)` — but `depositFee` can
  be set to 0 to effectively disable.

### 3.10 `setDepositsEnabled(bool)` / `setWithdrawsEnabled(bool)`
- Owner-only toggles; emit dedicated events.

### 3.11 `setWithdrawLimits(hourlyLimit, dailyLimit, minWithdraw, maxWithdraw)`
- Owner-only; three internal consistency checks (`min ≤ max`, `hourly ≤
  daily`, `max ≤ hourly`).
- **Edge**: setting `hourlyLimit == dailyLimit == 0` disables all
  hourly/daily limits.

### 3.12 `checkWithdrawLimits(address user, uint256 amount) public view → (bool, string)`
- Reads `ProxyGeneral.getHourlyWithdrawn(user, hour)` for `hour ∈
  [currentHour, currentHour-23]`.
- **Edge**: `currentHour - i` for `i ≥ currentHour` underflows and
  reverts (0.8+). On a chain older than 24 hours this is impossible,
  but tests using cheat-code time-warp to `< 24h` will break.
- **Edge**: because nothing writes `hourlyWithdrawnAmounts`, both loops
  return 0.

### 3.13 `getRemainingHourlyLimit(address user) view`
- Reads current-hour hourlyWithdrawnAmounts (always 0 → returns
  `hourlyLimit`). Broken as above.

### 3.14 `getRemainingDailyLimit(address user) view`
- 24-hour loop; same underflow risk; same “always returns limit” bug.

### 3.15 `receive() external payable`
- Comment says: “Only accept ETH from known contracts”, but there is NO
  filtering — any address can `send` ETH here. ETH accumulates and is
  not accounted anywhere.

### 3.16 `calculateDepositShares(uint256 amount) view`
- Read-only preview. Applies `depositFee`, uses `getTotalPoolValueView`.
- **Edge**: does not apply `minDeposit`/`maxDeposit` bounds — a UI could
  advertise a share count that the real `deposit()` refuses.

### 3.17 `calculateWithdrawAmount(uint256 lpTokens) view`
- Preview.
- **Edge**: does not consider the automatic-swap path or slippage —
  advertises a value that may not be delivered.

### 3.18 `canWithdraw(address user, uint256 shares) view`
- Uses local `paused` (never written) — inconsistent with
  `whenNotPaused` modifier.

### 3.19 `getPoolStats() view / validatePoolState() view`
- Aggregate reads via ProxyGeneral, ValueCalculator, TokenManager.

### 3.20 `checkWithdrawRateLimit`, `checkDepositRateLimit`, `setRateLimit`, `getRateLimitInfo`
- Thin pass-through to ProxyGeneral.
- **Edge**: `getRateLimitInfo` hardcodes `hourlyLimit = 100 * unit`,
  `dailyLimit = 1000 * unit` (line 1074–75) *regardless of the actual
  configured limits* — this is dead information leakage in a getter.

### 3.21 `fallback() external payable → revert`
- Blocks accidental calls; but `receive()` still accepts value.

---

## 4. SwapManager.sol

`SwapManager is ISwapManager, Ownable, ReentrancyGuard`.

### 4.1 `constructor(address _beacon, string memory _baseAssetCode)`
- **Pre**: `_beacon != 0`; base asset non-empty.
- **Post**: `beacon` immutable, `baseAssetCode`. Defaults: `maxSlippage
  = 300`, `defaultDeadlineWindow = 20m`, `activeSwapPlugin =
  "UniswapV3Plugin"`, `swapsEnabled = true`.

### 4.2 `performSwap(spend, receive, amountIn, deadline)`
- **Vis / mod**: `public nonReentrant onlyAuthorizedCaller whenSwapsEnabled`.
- **Pre**: `block.timestamp ≤ deadline`.
- **Effect**: emits `SwapStarted`, delegates to `_performSwapInternal`,
  emits `SwapCompleted`.
- **Events**: `SwapStarted`, `TightDeadlineWarning` (<5m),
  `DeadlineCritical` (<2m), `SwapCompleted`, plus downstream
  `SwapExecuted`.
- **Edge**: caller can pass a deadline anywhere in the future — no
  enforced upper bound on `deadline - block.timestamp`.

### 4.3 `performSwapAuto(spend, receive, amountIn)`
- **Vis / mod**: `public onlyAuthorizedCaller whenSwapsEnabled` — **NO
  `nonReentrant`** (delegates to `performSwap` which has it). If someone
  refactors `performSwap` this becomes unsafe. Finding CORE-004.
- **Effect**: computes `deadline = block.timestamp +
  defaultDeadlineWindow` and calls `performSwap`.

### 4.4 `swapWithBestPlugin(spend, receive, amountIn, minAmountOut, deadline)`
- **Vis / mod**: `external nonReentrant onlyAuthorizedCaller whenSwapsEnabled`.
- **Pre**: deadline OK, `amountIn > 0`, `minAmountOut > 0`, different tokens.
- **Effect**: resolves TokenManager, gets quotes via `getAllQuotes`,
  picks highest, `require(bestQuote ≥ minAmountOut)`,
  `ProxyGeneral.approveSpender(inToken, plugin, amountIn)`,
  `bestPlugin.inputSwap(...)`, emits events.
- **Edge**: **does not verify received amount against `minAmountOut`
  after swap** — critical regression, finding CORE-002.
- **Edge**: quotes may be manipulable if any plugin uses instantaneous
  Uniswap pool state (as UniswapV3Plugin does). This is why
  `minAmountOut` should also be a real post-swap check.

### 4.5 `_performSwapInternal(spend, receive, amountIn) internal`
- **Steps**:
  1. `amountIn > 0`;
  2. `spendCode != receiveCode`;
  3. `_validateSwapParameters(...)` — full validation with slippage;
  4. Resolve ProxyGeneral;
  5. `_getActivePlugin()` (Beacon or fallback simpleSwapRouter);
  6. Dispatch to `_swapToBaseAsset`, `_swapFromBaseAsset`, or
     `_swapTokenToToken`.

### 4.6 `_swapToBaseAsset(spendCode, amountIn, validation, proxy, swapper)`
- **Effect**: reads baseAssetAddr, captures pre-balance, sets allowance
  if needed (approves `type(uint256).max` when short), tries
  `swapper.inputSwap`, computes actual received, requires ≥
  `minAcceptableOutput`, emits `SwapExecuted`. On revert: emits
  `SwapFailed`, tracks error, re-reverts.
- **Edge**: MAX approval — plugin can drain if compromised.
- **Edge**: `require(actualReceived >= minAcceptableOutput)` — uses the
  computed slippage floor from `_validateSwapParameters`, not a caller-
  provided `minAmountOut`. Users can’t override.

### 4.7 `_swapFromBaseAsset(...)` and `_swapTokenToToken(...)`
- Structurally identical to `_swapToBaseAsset` with different addresses.

### 4.8 `validateSwapParameters(spend, receive, amountIn) view → (bool, string)`
- External wrapper over `_validateSwapParameters`.

### 4.9 `_getActivePlugin() view internal → ISimpleSwap`
- Tries `Beacon.getImplementation(activeSwapPlugin)`; falls back to
  `simpleSwapRouter`; reverts if both empty.
- **Edge**: `try/catch` around a *view* function that itself reverts
  when `implementation == 0` — swallowed. Then falls back to legacy
  `simpleSwapRouter` (finding CORE-013 info).

### 4.10 `_getSwapPluginNames() view internal`
- Enumerates Beacon modules; filters by `_isSwapPlugin` (name ends
  with “Plugin”); returns at most 10.

### 4.11 `_isSwapPlugin(string) pure internal → bool`
- Length ≥ 6, last 6 bytes == “Plugin”. Considers name `"Plugin"` alone
  as valid — finding CORE-014 info.

### 4.12 `getAllQuotes(spend, receive, amountIn) view → QuoteResult[]`
- **Pre**: non-empty codes, different tokens, amountIn > 0, TokenManager
  configured, valid token addresses.
- **Effect**: enumerates plugin names, resolves via Beacon (try/catch),
  filters non-contracts, invokes `plugin.getExpectedOutput(...)`
  (try/catch Error and generic).
- **Edge**: reverts on token address 0 (via `require(tokenIn != 0)`),
  but SILENTLY treats plugins that revert as `isValid=false`.

### 4.13 `_validateSwapParameters(spend, receive, amountIn) view internal → SwapValidation`
- Resolves TokenManager / ProxyGeneral / swapper. Handles base-asset as
  a special case (fetches BASE_ASSET from Beacon, skips `isTokenActive`).
- Checks: token active (unless base asset), spend/receive addresses
  non-zero, sufficient balance in pool, min/max swap amounts, expected
  output > 0. Applies `maxSlippage` to compute `minAcceptableOutput`.
- **Edge**: expects TokenManager to have `getTokenInfo(baseAssetCode)`
  succeed; when base asset is not registered (correct per design) it
  falls through — but the try/catch on `getTokenInfo` for decimals
  silently returns `18` even for USDC/WBTC. Finding CORE-011.

### 4.14 `_handleSwapError(...) internal`
- Only increments `swapErrors[hash]`.

### 4.15 `getExpectedSwapOutput / getSwapStats / getSwapQuote / calculateMinAmountOut`
- Views. `calculateMinAmountOut` subtracts `slippageAmount` from
  `expectedOutput` — returns 0 if inputs invalid (silent).
- **Edge**: `getSwapQuote(tokenCode, amountIn)` implicitly targets
  `baseAssetCode` — if `amountIn > pool balance`, `_validateSwapParameters`
  returns invalid and the getter returns 0 (misleading — a “quote”
  shouldn’t depend on pool balance).

### 4.16 Admin setters
- `setSwapLimits(tokenCode, min, max)`, `setMaxSlippage(newSlippage ≤
  2000 bps)`, `setSimpleSwapRouter` (deprecated),
  `setActiveSwapPlugin`, `setSwapsEnabled`, `setDefaultDeadlineWindow`,
  `resetSwapStats` — all `onlyOwner`, standard patterns.

### 4.17 Utility & view: `getSimpleSwapRouter`, `areSwapsEnabled`,
`getTokenBaseAssetPrice`, `estimateSwapGas`, `_tryGetRouterEstimate`,
`_isDirectPair`, `canSwap`, `validateSwapParams`,
`emergencyTokenRecovery`.
- `emergencyTokenRecovery`: `onlyOwner`, calls
  `ProxyGeneral.transferFunds(recipient, tokenAddress, amount)`. **Not
  gated by `paused`** — owner can extract at any time. Finding CORE-016.
- `_tryGetRouterEstimate`: `external view`, gated by `msg.sender ==
  address(this)` — pattern for internal try/catch. OK.

---

## 5. TokenManager.sol

`TokenManager is Ownable`. Does NOT implement any interface directly.

### 5.1 `constructor(address _beacon, address _oracleAdapter)`
- **Pre**: both non-zero.
- **Post**: `beacon`, `oracleAdapter`; `tokenCodesCount = 0`.

### 5.2 `setOracleAdapter(address _newAdapter)`
- `onlyOwner`. Emits `OracleAdapterUpdated`.
- **Edge**: instant swap — no timelock. Owner can point at any adapter.

### 5.3 `setBaseAssetCode(string _code)`
- `onlyOwner`. Length 1..16. Requires `oracleAdapter.supportsToken(code)`.
- **Edge**: no consistency check against Beacon “BASE_ASSET”; the two
  can be inconsistent (finding CORE-071).

### 5.4 `manageTokenData(string, address, uint8, uint256)` — new
- `onlyOwner`. Length checks, non-zero address, heartbeat > 0, oracle
  must support, must not equal base asset address (Beacon), max count
  check. Overwrites entry in `tokenData`; pushes to array if new.
- **Edge**: on re-registration of an existing token, `errorCount`
  resets and the array is untouched — OK. But `tokenErrors[code] = 0`
  is set outside the struct, correct.

### 5.5 `manageTokenData(string, address, address, uint8, uint8, uint256)` — legacy
- Same body, ignores the two extra params. Duplicate logic; owner-only.
- **Edge**: overload with same name causes ABI ambiguity for tools that
  select by name (finding CORE-024).

### 5.6 `removeToken(string _tokenCode)`
- `onlyOwner`. Requires active. Sets `isActive = false`; swap-and-pop
  array; decrements `tokenCodesCount`.
- **Edge**: does NOT delete `tokenData[code]` — old fields (lastPrice,
  timestamps, heartbeat, errorCount, decimals) remain in storage
  forever. Re-adding overwrites via `manageTokenData`.

### 5.7 `updateHeartbeat`
- Owner-only. Standard.

### 5.8 `getTokenPrice(string) public view → (uint256, uint256, bool)`
- Requires `isActive`. Delegates to `oracleAdapter.getPrice`; reverts
  with `StalePrice(timestamp, 0)` when adapter marks invalid.
- **Edge**: hard-coded `maxAge = 0` in revert (loses heartbeat) —
  finding CORE-025.
- **Edge**: `isStale` return value is always `false` (dead output).

### 5.9 `getTokenPriceWithEvents(string) public → (uint256, uint256)`
- Wraps `this.getTokenPrice` (external self-call). Updates storage and
  emits events; on revert, increments error counters.
- **Edge**: external self-call (extra 700-2600 gas). Also, storage
  update happens only on `!isStale` — but `isStale` from `getTokenPrice`
  is *always false* (see 5.8). So storage always updates when the price
  is not reverting — fine, but the branch is dead code.

### 5.10 View getters
- `getTokenCount`, `getActiveTokens` (double-iteration), `isTokenActive`,
  `getTokenAddress`, `getTokenInfo`, `getTokenPriceForModule`,
  `getBaseAssetPrice`, `getPriceDecimals`, `validatePriceFeed`.
- **Edge**: `getTokenAddress` and `getTokenInfo` require `isActive` and
  therefore *revert* on inactive tokens — this is exactly what
  ProxyGeneral relies on for the deposit/withdraw path. But callers
  that expected `address(0)` on unknown will bubble.

### 5.11 `convertUsdToBaseAsset(uint256 valueInUsd, uint8 usdDecimals) view → uint256`
- Formula: `exponent = baseDecimals + 18 - usdDecimals`; multiplies or
  divides accordingly.
- **Edge**: no overflow guard; `valueInUsd * 10^exp` for `exp=28` (WETH
  base, 8-dec USD) and `valueInUsd = 2^250` overflows. Realistic values
  are safe, but not formally guarded (finding CORE-026 info).

### 5.12 Error management: `getTokenErrors`, `resetTokenErrors`, `setMaxErrors`, `setMaxTokensPerOperation`
- Owner-only setters; view getter.

---

## 6. ValueCalculator.sol

`ValueCalculator is Ownable`.

### 6.1 `constructor(address _beacon, string _baseAssetCode)`
- Sets `beacon`, `baseAssetCode`.

### 6.2 `calculateTokenValuePure(string) public view → uint256`
- Uses cache if valid. Else fetches price via TokenManager, requires
  `!isStale && block.timestamp - timestamp ≤ maxPriceAge`, computes
  `(balance * price) / 10^tokenDecimals`.
- **Edge**: relies on price being in wei-per-whole-token; if adapter
  returns USD-scaled prices, math is wrong (finding CORE-031).

### 6.3 `calculateTokenValue(string) public → uint256`
- Non-view wrapper. Uses `this.calculateTokenValuePure` (external self-
  call) in try/catch. Updates cache, resets errors on success. On
  revert, increments `tokenErrors[code]`, emits `TokenError`, re-reverts.
- **Edge**: `onlyAuthorized` NOT applied here — anyone can pay gas to
  refresh a token cache. Probably intentional (public view refresh) but
  it lets external actors bump `tokenErrors` counters. Finding CORE-033
  info.

### 6.4 `calculateTokenValueView(string) external view → uint256`
- Same as `calculateTokenValuePure` but reverts on staleness.

### 6.5 `getTotalPoolValue() external view → PoolValueInfo`
- Sums base asset balance + `calculateTokenValuePure` for each active
  token + `_getAllProtocolsValue()`. Returns per-token breakdown with
  bp percentages.
- **Edge**: base asset value assumed to be in same unit as token
  values (line 234 sets `pricePerToken = 1e18` regardless of base
  asset decimals — misleading for USDC-6-dec pools). Finding CORE-032.
- **Edge**: uses `try/catch` around `calculateTokenValuePure` — a
  stale/failing token becomes silently zero-valued (finding CORE-030).

### 6.6 `getTotalPoolValueView() external view → uint256`
- Sums baseAssetBalance + `calculateTokenValueView` (try/catch) +
  `_getAllProtocolsValue`.

### 6.7 `_getAllProtocolsValue() internal view → uint256`
- Try/catch on Beacon lookup and on `ProtocolManager.getAllProtocolsValue()`.
- On any failure, falls back to `_getEulerPositionValue()`.

### 6.8 `getProtocolPositionBreakdown(string) external view → (col, debt, net)`
- Delegates to ProtocolManager. Try/catch → returns `(0, 0, 0)` on
  failure.

### 6.9 `_getEulerPositionValue() internal view → uint256`
- Legacy fallback to EulerLensAdapter. Try/catch → 0.

### 6.10 `getEulerPositionBreakdown() external view → (col, debt, net)`
- Direct call to EulerLensAdapter; no try/catch.

### 6.11 Cache management: `getCachedTokenValue`, `getCachedTokenPrice`,
`invalidateCache` (`onlyAuthorized`), `invalidateAllCache` (`onlyOwner`).

### 6.12 `selectTokenForSwap(uint256 targetValue) external view → (string, uint256)`
- Full algorithm: fetches active tokens, calculates value & price per
  token, sorts ascending by percentage of swappableValue, iterates trying
  buffers 10% → 5% → 0%; last-resort “≥95%” fallback; final “largest
  value” fallback; returns `("", 0)` if nothing works.
- **Edge**: intentionally allows returning “too much” token to over-
  swap (last-resort branches). Assumes the swap will absorb slippage.

### 6.13 `getTokenValueInfo(string)`, `validatePoolValue()`
- Convenience views. `validatePoolValue` uses `try/catch` on
  `getTotalPoolValueView` and returns the caller-friendly form.

### 6.14 Parameters: `setCacheDuration`, `setMaxPriceAge`, `setMaxErrors`
- `onlyOwner`, bounded.

---

## 7. ProtocolManager.sol

Pragma `^0.8.27`. `ProtocolManager is Ownable`. Uses SafeERC20 but never
holds tokens directly.

### 7.1 `constructor(address _beacon)`
- Sets immutable beacon.

### 7.2 `deposit(name, tokenCode, amount) onlyOwner`
- Resolves plugin by name. Withdraws token from ProxyGeneral to plugin.
- Calls `IProtocolManager(plugin).deposit(...)`. Reverts if false.
- **Edge**: NO pause check. NO reentrancy guard. Return value only —
  the plugin can return true without actually depositing (a lying
  plugin would leave funds on the plugin address and still succeed).

### 7.3 `withdraw(name, tokenCode, amount) onlyOwner`
- Symmetric: no ProxyGeneral pull; plugin is expected to push to
  ProxyGeneral.
- **Edge**: no verification that funds actually arrived. Finding
  CORE-043.

### 7.4 `getBalance`, `getTotalValue` — view pass-through.

### 7.5 `borrow(name, tokenCode, amount) onlyOwner`
- Delegates to plugin. Plugin transfers borrowed asset to ProxyGeneral.

### 7.6 `repay(name, tokenCode, amount) onlyOwner`
- Withdraws token from ProxyGeneral to plugin; calls plugin.repay.
- **Edge**: `amount == 0` special-case (full repay) — comment says
  “handled by plugin”. There is no compile-time contract for this.

### 7.7 `closePosition(name, debtCode, collCode) onlyOwner` — LOW-LEVEL CALL
- Uses `plugin.call(abi.encodeWithSignature("closePosition(string,string)", debtCode, collCode))`.
- **Edge**: bypasses the interface — the plugin can implement whatever
  ABI. Selector collisions are possible. Finding CORE-044.

### 7.8 `getDebt`, `getHealthFactor` — view pass-through.

### 7.9 `setAllowedSelectors(name, selectors[], allowed) onlyOwner`
- Modifies `allowedSelectors[plugin][selector]`. Emits per selector.

### 7.10 `executeProtocolCall(name, data) onlyOwner → (bool, bytes)`
- Rejects `data.length < 4`. Extracts selector via assembly. Verifies
  `allowedSelectors[plugin][selector]`. Low-level `plugin.call(data)`.
- **Edge**: no return-length or return-format checks.

### 7.11 `emergencyWithdrawAll(name, tokenCodes) onlyOwner`
- Delegates to plugin. Returns success.

### 7.12 Protocol registry:
- `registerProtocol(name, plugin, lensAdapter, registry) onlyOwner`
- `updateProtocol(name, plugin, lensAdapter, registry) onlyOwner`
- `setProtocolActive(name, isActive) onlyOwner`
- `getProtocolInfo(name)`, `getAllProtocolNames()`,
  `getActiveProtocolCount()`.
- **Edge**: `updateProtocol` re-emits `ProtocolRegistered` (misleading
  event name — finding CORE-047 info).

### 7.13 Aggregate views:
- `getAllProtocolsValue()`, `getProtocolPositionBreakdown(name)`,
  `getGlobalHealthFactor()`, `getAllPositionsSortedByRisk()`,
  `getAllProtocolSummaries()`.
- **Edge**: silent try/catch on lens adapter calls; sums valid results
  and drops failed ones. NAV can silently drift on adapter failure.

### 7.14 `closePositionsForBaseAsset(uint256 targetAmount) onlyOwnerOrLiquidityManager`
- Iterates registered protocols (in registration order, NOT by risk /
  HF) calling `IProtocolAdapter.closePositionsForBaseAsset(stillNeeded)`.
- **Edge**: comment says “riskiest first”; code doesn’t sort. Also,
  each adapter’s `closePositionsForBaseAsset` may return `got` unrelated
  to base asset delivered (the caller relies on that number).

### 7.15 `closePosition(name, positionId) onlyOwner`
- **Overload** of 7.7 with different signature. Uses `IProtocolAdapter`.

---

## 8. ParameterManager.sol

`ParameterManager is IParameterManager, Ownable`.

### 8.1 `constructor(address _beacon, uint8 _baseDecimals)`
- Sets beacon; `parameterTimelock = 24h`. Calls `_initializeDefaultParameters`.

### 8.2 `_initializeDefaultParameters(uint8 baseDecimals) internal`
- Seeds parameters (see §3.8 of architecture doc). **Note**:
  `poolReserveRatio` default is `0` → LiquidityManager’s reserve check
  is a no-op by default (finding CORE-035 info).

### 8.3 `_registerParameter(name, val, min, max, requiresTimelock) internal`
- Bounds check, non-existence check. Writes Parameter struct + default,
  pushes to array, appends history.

### 8.4 `getCurrentParameterValue(string) public view`
- Requires active, returns currentValue.

### 8.5 `getAllParameterNames` / `getParameterInfo`
- Standard views.

### 8.6 `proposeParameterChange(string, uint256) external onlyAuthorizedUpdater`
- If `requiresTimelock`: writes proposed fields + `proposalById[nextProposalId++]`.
- Else: immediate update, appends history, emits `ParameterUpdated`.
- **Edge**: `proposalById[id]` receives a copy of the *current* struct
  (line 227) — not the proposal itself. `getProposal(id)` returns
  whatever was there at proposal time.

### 8.7 `executeParameterChange(string) external onlyAuthorizedUpdater`
- Requires active, `requiresTimelock`, `proposedValue > 0`, timelock
  expired. Commits `currentValue = proposedValue`.
- **Edge**: `proposedValue > 0` blocks committing a change to zero (a
  legitimate value for e.g. `poolReserveRatio`). Finding CORE-037.

### 8.8 `emergencySetParameter(string, uint256) external onlyAuthorizedUpdater`
- Requires the ProxyGeneral to be paused. Bounds check. Immediate write.
- **Edge**: not gated by any timelock; requires pause, which the
  authorized updater (EmergencyHandler) can trigger.

### 8.9 `updateMultipleParameters(string[], uint256[]) external onlyAuthorizedUpdater`
- ≤ 20 items, arrays same length. For each: `_isValidParameterValue`
  and write DIRECTLY to `currentValue` — **bypasses timelock entirely**.
- **Edge**: this is the biggest governance-bypass hole in the system,
  finding CORE-036.

### 8.10 `isValidParameterValue(name, value) view / canExecuteParameterChange(name)`
- Standard validation views.

### 8.11 `registerParameter(string, uint256, uint256, uint256, bool) external onlyOwner`
- Public wrapper of `_registerParameter`.

### 8.12 `setParameterTimelock(uint256) external onlyOwner`
- Bounds: [1h, 7d].

### 8.13 `resetParameterToDefault(string) external onlyOwner`
- Resets to `defaultValues[name]`.

### 8.14 Interface-compliance overloads (bytes-typed):
- `proposeParameterChange(string, bytes, string) external onlyOwner → proposalId`
  — decodes uint256; always sets `effectiveAt` regardless of
  `requiresTimelock`; issues an ID as keccak256(key, timestamp).
- `executeParameterChange(uint256) external override`
  — **BROKEN**: iterates `parameterNames`, requires `param.isActive ==
  false` before commit, but all live parameters are active. So this
  function *always* reverts with “No executable proposal found”.
  Finding CORE-041.
- `cancelParameterProposal(uint256 proposalId) external onlyOwner`
  — iterates and cancels the FIRST proposal it finds; **`proposalId`
  is ignored**. Finding CORE-042.
- `getParameter(string) view → bytes` — abi-encodes currentValue.
- `setParameterEmergency(string, bytes, string)` — **NO pause check**;
  immediate write; no bounds check via `_isValidParameterValue`. Finding
  CORE-039.
- `parameterExists`, `validateParameterValue`, `registerParameter(bytes)`,
  `getRegisteredParameters`, `unregisterParameter`,
  `getParameterTimelock`, `getProposal(uint256)`, `getActiveProposals`,
  `getExecutableProposals`, `getParameterHistory`, `getLastParameterChange`,
  `getUintParameter`, `getBoolParameter`, `getAddressParameter`,
  `getStringParameter` (returns `""` always).

### 8.15 Batch operations:
- `proposeBatchParameterChanges(keys, values, description) onlyOwner → uint256[]`
  — calls `this.proposeParameterChange(key, value, description)`; every
  such call is subject to `onlyOwner` (self-call keeps the modifier).
- `executeBatchProposals(uint256[]) external`
  — calls `this.executeParameterChange(proposalId)` for each; because
  the (uint256) override always reverts, this whole batch always
  reverts. Finding CORE-041 propagates.

---

## 9. EmergencyHandler.sol

`EmergencyHandler is IEmergencyHandler, Ownable`.

### 9.1 `constructor(address _beacon)`
- Sets beacon; `unpauseTimelock = 6h`.

### 9.2 `emergencyPause(string reason) public onlyEmergencyAuthorized`
- Requires `!emergencyState.isActive` and cooldown expired
  (`lastEmergencyTimestamp == 0 || block.timestamp - last ≥ 1 day`).
- Sets emergencyState (activatedBy, activatedAt, lastActionAt, reason,
  cooldownUntil=0). Calls `ProxyGeneral.pause()`. Sets flags. Notifies
  contacts via events.
- **Edge**: cooldown is enforced strictly from `lastEmergencyTimestamp`
  regardless of whether the previous emergency was resolved — finding
  CORE-048.

### 9.3 `emergencyUnpause() public onlyOwner`
- Requires `emergencyState.isActive` and `block.timestamp -
  activatedAt ≥ unpauseTimelock`. Calls `ProxyGeneral.unpause()`. Emits
  events. Resets state.

### 9.4 `canUnpause() external view → (bool, string)`
- Simple view; formats a countdown string via `_uint2str`.

### 9.5 `_uint2str(uint256) internal pure → string`
- Homemade conversion. Reinvents OpenZeppelin `Strings.toString`.

### 9.6 `getEmergencyState() view`
- Standard.

### 9.7 `emergencyWithdraw() external onlyOwner → WithdrawResult[]`
- Only callable once (`emergencyExecuted["withdraw"]` flag).
- Iterates active tokens + base asset, calling
  `proxy.emergencyTransfer(...)` inside try/catch.
- **Edge**: `ProxyGeneral.emergencyTransfer(address,uint256,address)`
  is **not implemented** — every try/catch bucket goes to the outer
  catch and returns `success = false`. Finding CORE-051.
- **Edge**: hardcodes `owner()` as recipient.

### 9.8 `generateEmergencyReport() external → EmergencyReport`
- Aggregates pool value, base-asset balance, pause state, tokens count.
- Sums *raw balances* of tokens as `totalTokensValue` — meaningless
  because tokens have different decimals and are quoted differently.
- **Edge**: state-modifying (writes `lastReport`).

### 9.9 Views: `getLastEmergencyReport`, `isEmergencyExecuted`,
`getEmergencyStats`, `getSystemHealthStatus`
- Standard.

### 9.10 Emergency contacts: `addEmergencyContact(address, string role) onlyOwner`
- Requires `contact != 0`, `!isEmergencyContact`, ≤ 10 total, non-empty role.
- Writes contactAddedAt, contactRole.

### 9.11 `removeEmergencyContact(address) onlyOwner`
- Swap-and-pop; cleans mapping timestamps and role.

### 9.12 `isAuthorizedForEmergency` / `getEmergencyContactsCount` /
`getContactInfo` / `getEmergencyContacts` / `checkIsEmergencyContact`
- Standard views. `getContactInfo` requires `isEmergencyContact` = true.

### 9.13 `_getCurrentTotalValue`, `_logAssetSnapshot`, `_getTotalPoolValue` internal
- Try/catch around ValueCalculator + TokenManager. On failure emit
  `AssetTransferred("ERROR", 0, recipient)` — noisy but not harmful.

### 9.14 `setUnpauseTimelock(uint256) public onlyOwner`
- Bounds: [1h, 7d].

### 9.15 `resetEmergencyState(string) external onlyOwner`
- Clears `emergencyExecuted[type]`; if type == "pause", also deletes
  emergencyState. **Edge**: doesn’t unpause the system if that was on —
  finding CORE-050 info.

### 9.16 Interface compliance: `activateEmergency`, `deactivateEmergency`,
`isEmergencyActive`, `getEmergencyContacts`, `checkIsEmergencyContact`,
`setEmergencyTimelock`, `getEmergencyTimelock`, `isTimelockExpired`,
`setEmergencyCooldown`, `isInCooldown`, `getRemainingCooldown`
- Aliases and thin wrappers.
- **Edge**: `isEmergencyActive()` returns `IProxyGeneral(...).paused()`
  — not `emergencyState.isActive`. Discrepancy between the two.
- **Edge**: `setEmergencyCooldown` writes `emergencyState.cooldownUntil
  = block.timestamp + cooldownPeriod` — but the `EMERGENCY_COOLDOWN`
  constant (`1 days`) is what `emergencyPause` actually reads.
  `cooldownUntil` is only used by `isInCooldown/getRemainingCooldown`.
  Finding CORE-049.

### 9.17 Asset snapshots
- `createAssetSnapshot() external → uint256`
  — anyone can call (no modifier!). Increments counter, iterates active
  tokens + base asset, writes `AssetSnapshot` to `snapshots[id]`,
  pushes `id` to `snapshotIds`.
- **Edge**: no access control — griefing DoS by spamming snapshots
  (unbounded `snapshotIds`). Finding CORE-053.
- `getAssetSnapshot(uint256) / getAllSnapshots() / getSnapshotCount()`
  — reads.

### 9.18 `validateSystemHealth / checkAssetIntegrity / pauseAllOperations
/ resumeAllOperations`
- Delegates to ValueCalculator; `pauseAllOperations` reuses
  `emergencyPause` with a fixed reason.

### 9.19 `emergencyWithdraw(address, uint256, address) external override onlyOwner`
- Direct pass-through to `ProxyGeneral.emergencyTransfer`.
- **Edge**: as above, ProxyGeneral doesn’t implement the function. Also,
  NO pause check, so owner can drain at will without the timelock path.

### 9.20 `emergencyTransfer(address payable, uint256) external override onlyOwner`
- Sends ETH from the EmergencyHandler contract (not ProxyGeneral!). Uses
  `.transfer(amount)` — 2300 gas → fails for contracts with fallback
  logic. Finding CORE-057.

### 9.21 `checkEmergencyAccess(address) view`
- Returns (isOwner || isEmergencyContact, role string).

---

## 10. DepositHelper.sol

Very thin — 55 LOC.

### 10.1 `constructor(address _beacon)`
- Resolves `weth = IWETH(IBeacon(_beacon).getImplementation("BASE_ASSET"))`
  at construction time.
- **Edge**: no zero-check on beacon; but the `.getImplementation` call
  would revert if beacon is zero (external call to 0 address, EVM
  low-level fails).

### 10.2 `depositETH() external payable → uint256`
- Reverts `ZeroDeposit` on 0 value.
- `weth.deposit{value: msg.value}()`.
- Resolves `LiquidityManager` at call time.
- `safeIncreaseAllowance` (LM, msg.value).
- `lpTokens = ILiquidityManager(lm).deposit(msg.value)`.
- Retrieves ProxyGeneral, transfers LP tokens to `msg.sender`.
- **Edge**: `msg.sender` in `LM.deposit` is **the helper contract**,
  not the user. As a result:
  - Deposit fee `safeTransferFrom(msg.sender, feeRecipient, fee)`
    requires the helper to have approved LM for the fee amount. But the
    helper only approves `msg.value = amount`, and LM tries to move
    `netDeposit + fee`. The two `safeTransferFrom` calls in LM add up
    to `netDeposit + fee = amount`. WETH deposit provided the helper
    with exactly `amount`, and the helper approves `amount`. So the
    transfers succeed. OK, but subtle.
  - Rate limits key on `msg.sender = DepositHelper` → shared bucket for
    every ETH user. Finding CORE-058.
  - `Deposit` event has `user = DepositHelper`. Off-chain accounting
    must reconstruct real depositors from a separate DepositHelper log.
- **Edge**: No slippage / minShares parameter. User cannot bound
  minimum LP received.

### 10.3 `receive() external payable`
- Silently accepts ETH but never uses it. No withdraw mechanism.
  Finding CORE-059.

---

*(End of catalogue. The findings JSON is delivered in the audit reply.)*
