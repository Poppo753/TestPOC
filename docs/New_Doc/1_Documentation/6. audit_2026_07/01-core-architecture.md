# 01 - Core Architecture (TestPOC / Project4)

> Enterprise-grade audit — architectural documentation of the core smart-contract
> layer for the pool of one base asset (e.g. WETH, USDC, WBTC).
>
> Scope of this document: `Beacon`, `ProxyGeneral`, `LiquidityManager`,
> `TokenManager`, `ValueCalculator`, `SwapManager`, `ProtocolManager`,
> `ParameterManager`, `EmergencyHandler`, `DepositHelper` (contracts in
> `TestPOC/contracts/*.sol`, excluding `/old/`, `gmx`, `dolomite`).
>
> The plugin layer (`plugins/*`), lens adapters (`adapters/*`) and
> `FlashLoanService` are referenced only where they interact with a core
> contract.

---

## Table of contents

1.  System topology
2.  Roles and access control
3.  Storage layout per contract
4.  Upgradability model (Beacon-by-name registry, non-proxy contracts)
5.  Cross-contract flow diagrams (textual)
    - 5.1 ETH → WETH deposit path
    - 5.2 Plain ERC20 base-asset deposit path
    - 5.3 Withdraw path (happy path + automatic swap + protocol close)
    - 5.4 Multi-plugin best-quote swap
    - 5.5 Protocol lifecycle (deposit → borrow → repay → withdraw)
    - 5.6 Emergency pause & drain path
    - 5.7 Parameter change lifecycle
6.  Invariants expected to hold
7.  External integration surfaces
8.  Trust assumptions and threat model
9.  Known architectural anti-patterns identified during this audit

---

## 1. System topology

There are two kinds of contracts in the core:

- **Custody / registry contracts** (single instance):
  - `Beacon` — module registry keyed by `string moduleName`. All other
    core contracts (and plugins) resolve their peers by name via this
    registry. It is also the single-authority registry for `BASE_ASSET`.
  - `ProxyGeneral` — owner of all assets. Also implements the LP token
    ERC20 (`"LP Token"` / `"LPT"`). ProxyGeneral IS the pool.

- **Module contracts** (single instance each, one deployment per pool):
  - `TokenManager` — token registry (non-base tokens); oracle facade.
  - `ValueCalculator` — pool valuation and cache.
  - `SwapManager` — swap orchestrator, plugin selection, deadline/slippage.
  - `LiquidityManager` — user-facing deposit/withdraw and automatic-swap
    orchestration during withdraw.
  - `ProtocolManager` — orchestrator for lending/yield adapters (Aave,
    Euler, Morpho, etc.).
  - `ParameterManager` — parameter store with timelock + emergency override.
  - `EmergencyHandler` — pause / drain / snapshot orchestrator.
  - `DepositHelper` — thin wrapper that wraps ETH→WETH and forwards to
    LiquidityManager (only usable when `BASE_ASSET == WETH`).

The **base asset** for a given pool (WETH, USDC, WBTC …) is *not* registered
inside `TokenManager` — it is exposed under the Beacon key `"BASE_ASSET"`.
Every module resolves it as:

```
IBeacon(beacon).getImplementation("BASE_ASSET")
```

Note this is a semantic overload: the `_isContract()` check in
`Beacon.updateImplementation()` requires all registered addresses to be
contracts. That is fine for a WETH/USDC token address, but it prevents
`BASE_ASSET` from ever being a native token (address(0)).

---

## 2. Roles and access control

The system does **not** use OpenZeppelin `AccessControl`. It combines:

- `Ownable` (per-contract owner) on every core module.
- `Beacon.owner` (custom two-step ownership) on the module registry.
- `ProxyGeneral.authorizedModules` — a *contract-level* whitelist of
  module addresses. This is the effective role for privileged operations
  that touch custody.
- `EmergencyHandler.emergencyContacts` — a small whitelist (max 10) of
  addresses that may execute `emergencyPause`.

### 2.1 Role matrix

| Actor | Rights (across the core) |
|---|---|
| Beacon `owner` | Update any module implementation, freeze modules, activate global freeze, initiate 2-step ownership transfer. |
| Each module `owner()` (`Ownable`) | Change fees, slippage, timelocks, parameters, add/remove emergency contacts, run emergency withdraw. |
| ProxyGeneral `owner()` | Authorize/deauthorize modules, unpause, emergency transfer all. |
| ProxyGeneral `authorizedModules[msg.sender] == true` | Mint / burn LP; withdraw/deposit tokens from custody; `approveSpender` on any token; call `pause()`; `trackOperation` for rate limits; `setHourlyWithdrawn` etc. |
| `EmergencyHandler.emergencyContacts` | `emergencyPause(...)`; `pauseAllOperations()`. Cannot unpause (owner-only). |
| SwapManager’s `onlyAuthorizedCaller` | Anyone that is `msg.sender == owner()` OR the current `LiquidityManager` (resolved from Beacon) OR any address in `ProxyGeneral.authorizedModules`. |
| ValueCalculator’s `onlyAuthorized` | `owner()` OR `LiquidityManager` (Beacon-resolved) OR `ProxyGeneral` (Beacon-resolved). |
| ParameterManager’s `onlyAuthorizedUpdater` | `owner()` OR `EmergencyHandler` (Beacon-resolved). |
| ProtocolManager | Almost every state-changing function is `onlyOwner`. `closePositionsForBaseAsset` is `onlyOwnerOrLiquidityManager`. |
| End users | `LiquidityManager.deposit`, `.withdraw*`, `DepositHelper.depositETH`, `Beacon` view functions. |

### 2.2 Concentration risk

Almost every privileged path collapses to a single EOA-controlled `owner()`
per contract. There is no multi-sig or timelock at the contract level for:

- `Beacon.updateImplementation` (instant module swap → total control).
- `ProxyGeneral.authorizeModule` (instant privilege escalation).
- `ProxyGeneral.emergencyTransferAll` (drain when paused).
- `ProtocolManager.registerProtocol` / `updateProtocol` (register a
  hostile plugin and route funds through it).
- `TokenManager.setOracleAdapter` (swap oracle instantly).
- `SwapManager.setActiveSwapPlugin` / `.setSimpleSwapRouter`.

`ParameterManager` DOES have a 24h timelock for a subset of parameters,
but the `updateMultipleParameters` and `setParameterEmergency` codepaths
BYPASS that timelock (see finding CORE-036 below).

### 2.3 “Authorized module” escalation

`ProxyGeneral.authorizedModules` is a boolean per address. It gives
**identical privileges** to every module in the set: any authorized
module can call `mint`, `burn`, `withdrawToken`, `depositToken`,
`transferFunds`, `transferToModule`, `transferFromModule`,
`approveSpender`, `pause`, `trackOperation`, `setHourlyWithdrawn`,
`incrementHourlyWithdrawn`. Because SwapManager, LiquidityManager,
EmergencyHandler, ProtocolManager, plugins, and lens adapters all end up
in the same `authorizedModules` set, a compromise of **any one** of these
is sufficient to drain custody. There is no per-operation authorization.

---

## 3. Storage layout per contract

Because the system is **not** upgraded via delegatecall/UUPS proxies, but
by pointing the Beacon to a fresh implementation address, storage
collision between versions is not a concern in the classical proxy sense.
However, callers *do* keep the same address across upgrades if that
address is stored (e.g. `SwapManager.beacon` immutable is fine, but
addresses obtained through `Beacon.getImplementation(...)` are looked up
per call — see §4).

### 3.1 `Beacon`

```
mapping(string => address)  implementations
address                     owner
address                     pendingOwner
string[]                    registeredModules
mapping(string => bool)     moduleExists
mapping(string => address[]) implementationHistory
mapping(string => uint256)  lastUpdate
mapping(string => bool)     moduleFrozen
bool                        globalFreeze
```

Notes:
- `_isContract` uses `extcodesize`; a contract cannot register itself in
  its own constructor.
- `getImplementation` **reverts** when `implementation == address(0)`,
  or when `globalFreeze` or `moduleFrozen[module]` is set. Every caller
  MUST wrap this in try/catch if it wants graceful degradation. Several
  callers do not — see findings.

### 3.2 `ProxyGeneral`

Inherits `ERC20("LP Token","LPT")`, `Ownable`, `ReentrancyGuard`. In
addition:

```
address                     beacon (immutable)
string                      baseAssetCode
bool                        paused

mapping(address => bool)    authorizedModules
address                     emergencyRecipient
uint256                     emergencyExecutedAt

mapping(address => mapping(uint256 => uint256)) hourlyWithdrawnAmounts   // LEGACY
mapping(string => uint256)  moduleParameters                              // never consumed

struct RateLimit { hourlyLimit, dailyLimit, hourlyUsed, dailyUsed,
                   lastHourReset, lastDayReset }
mapping(address => mapping(string => RateLimit)) userRateLimits
mapping(string => RateLimit) globalRateLimits
```

Two parallel rate-limit systems coexist. LiquidityManager writes to
`userRateLimits` (via `trackOperation`) but reads from
`hourlyWithdrawnAmounts` in `checkWithdrawLimits(...)`. Nothing writes to
`hourlyWithdrawnAmounts` → the withdraw-limit accounting there is a
no-op.

### 3.3 `LiquidityManager`

```
address     beacon (immutable)
string      baseAssetCode
uint256     lastHourlyReset      // unused (dead)
uint256     hourlyWithdrawnAmount // unused (dead)
bool        paused               // never mutated (dead)

uint256     depositFee, withdrawFee
address     feeRecipient
bool        depositsEnabled, withdrawsEnabled
WithdrawLimits { hourlyLimit, dailyLimit, minWithdraw, maxWithdraw }
```

Note there is no `SafeERC20 for IERC20` at the ProxyGeneral custody
boundary; ProxyGeneral uses raw `IERC20.transfer` internally (see §9).

### 3.4 `SwapManager`

```
address    beacon (immutable)
string     baseAssetCode

uint256    maxSlippage = 300            // 3%
address    simpleSwapRouter             // deprecated fallback
bool       swapsEnabled = true

mapping(string => uint256) minSwapAmounts
mapping(string => uint256) maxSwapAmounts
mapping(bytes32 => uint256) swapErrors     // private
mapping(bytes32 => uint256) swapSuccesses  // private

uint256    defaultDeadlineWindow = 20 minutes
uint256    constant MIN_DEADLINE_WINDOW = 1 minute
uint256    constant MAX_DEADLINE_WINDOW = 1 hour

string     activeSwapPlugin = "UniswapV3Plugin"
```

### 3.5 `TokenManager`

```
struct TokenInfo { tokenAddress, tokenDecimals, tokenCode, isActive,
                   lastPriceTimestamp, lastPrice, heartbeat, errorCount }
IOracleAdapter                     oracleAdapter
mapping(string => TokenInfo)       tokenData (private)
string[]                           tokenCodes (private)
uint256                            tokenCodesCount
mapping(string => uint256)         tokenErrors
uint256                            maxErrors = 3
uint256                            maxTokensPerOperation = 10
address                            beacon (immutable)
string                             baseAssetCode
```

`getTokenPrice()` delegates to `oracleAdapter.getPrice()`, reverts when
oracle marks price invalid; therefore the returned `isStale` flag is
always `false` (dead output).

### 3.6 `ValueCalculator`

```
address                                 beacon (immutable)
string                                  baseAssetCode
mapping(string => TokenValueCache)      tokenValueCache
mapping(string => uint256)              tokenErrors
uint256   cacheDuration = 5 minutes
uint256   maxPriceAge   = 1 hour
uint256   maxErrors     = 3
```

### 3.7 `ProtocolManager`

Solidity 0.8.27 (different pragma from the rest of the core!).

```
address                       beacon (immutable)
mapping(address => mapping(bytes4 => bool)) allowedSelectors
struct ProtocolInfo { plugin, lensAdapter, registry, isActive, registeredAt }
mapping(string => ProtocolInfo) protocols
string[]                        registeredProtocolNames
mapping(string => bool)         isProtocolRegistered
```

### 3.8 `ParameterManager`

```
address                                    beacon (immutable)
mapping(string => Parameter)               parameters
mapping(string => uint256)                 defaultValues
string[]                                   parameterNames
mapping(string => ParameterHistory[])      parameterHistory
uint256                                    parameterTimelock = 24h
uint256                                    constant MIN_TIMELOCK = 1h
uint256                                    constant MAX_TIMELOCK = 7d
mapping(uint256 => Parameter)              proposalById
uint256                                    nextProposalId = 1
```

Parameters seeded in the constructor (values scaled to base-asset
decimals; timelocked entries marked *):
- `maxDeposit`*, `maxWithdrawPerTx`*, `minDeposit`, `minWithdraw`,
  `withdrawLimitPerHour`*, `maxSlippage`*, `poolReserveRatio`* (default
  `0`!), `cacheDuration`, `maxPriceAge`, `maxTokensPerOperation`,
  `maxErrors`.

### 3.9 `EmergencyHandler`

```
address                                              beacon (immutable)
mapping(string => bool)                              emergencyExecuted
EmergencyReport                                      lastReport
address[]                                            emergencyContacts
mapping(address => bool)                             isEmergencyContact
mapping(address => uint256)                          contactAddedAt
mapping(address => string)                           contactRole
uint256                                              unpauseTimelock = 6h
uint256                                              constant MIN_TIMELOCK = 1h
uint256                                              constant MAX_TIMELOCK = 7d
IEmergencyHandler.EmergencyState                     emergencyState
uint256                                              constant EMERGENCY_COOLDOWN = 1d
uint256                                              lastEmergencyTimestamp
mapping(uint256 => IEmergencyHandler.AssetSnapshot)  snapshots (private)
uint256                                              snapshotCount
uint256[]                                            snapshotIds
```

### 3.10 `DepositHelper`

```
address        beacon (immutable)
IWETH          weth   (immutable)     // resolved at deploy time
```

Because `weth` is `immutable`, once deployed the helper is bound to the
address returned by `Beacon.getImplementation("BASE_ASSET")` **at
deployment time**. If the pool later changes its base asset in the
Beacon, DepositHelper is stale and must be redeployed.

---

## 4. Upgradability model

The system uses a **named-registry** pattern, not a standard OpenZeppelin
proxy pattern (UUPS / Transparent / Beacon-proxy).

- Every module stores `address public immutable beacon`.
- Every cross-module call is preceded by a lookup:
  `IBeacon(beacon).getImplementation("SwapManager")` etc.
- Upgrading a module is a *new deployment* + `Beacon.updateImplementation`.

Consequences:

1. **Storage layout collision is not an issue**: a new deployment starts
   fresh, and old storage is orphaned. Callers already look up the new
   address the next call.
2. **State migration is a manual concern**: e.g. registered tokens,
   parameter values, snapshot history, rate-limit counters — none of
   this migrates automatically. A new `TokenManager` starts empty; every
   `manageTokenData` call must be replayed by the owner.
3. **No storage gaps** needed; there are no initializers; every module
   uses a constructor. `disableInitializers` is not applicable.
4. **Beacon `owner` compromise = full protocol takeover** in one tx by
   pointing every module (`ProxyGeneral`, `TokenManager`,
   `SwapManager`, …) at attacker-controlled implementations. Because
   many modules cache the Beacon address in `immutable`, the attacker
   just needs to swap the *modules* the Beacon points to.
5. **Beacon `getImplementation` reverts on frozen/missing** — modules
   without try/catch will therefore *fully brick* if the Beacon owner
   freezes them or a module name is misspelled. See findings.
6. **Beacon `_isContract` in `updateImplementation`** blocks address(0)
   or EOA registration — but does not prevent registering a *malicious*
   contract, and it also blocks self-registration during construction.

---

## 5. Cross-contract flow diagrams

Notation: `A → B.foo(...)` means A calls B.foo. `[N]` markers are used
in the invariants list (§6).

### 5.1 Deposit path — ETH into WETH pool

```
User (EOA)
  ├─ DepositHelper.depositETH{value:v}()
  │     ├─ weth.deposit{value:v}()                          -- IWETH.deposit
  │     ├─ WETH.safeIncreaseAllowance(LM, v)
  │     ├─ LiquidityManager.deposit(v)                      -- msg.sender == DepositHelper
  │     │     ├─ ParameterManager.getCurrentParameterValue("minDeposit"/"maxDeposit")
  │     │     ├─ ProxyGeneral.checkRateLimit(DepositHelper, "deposit", v)   -- !! DepositHelper is the "user"
  │     │     ├─ ProxyGeneral.trackOperation(DepositHelper, "deposit", v)
  │     │     ├─ ValueCalculator.getTotalPoolValueView()   -- (only if totalSupply > 0)
  │     │     ├─ WETH.safeTransferFrom(DepositHelper, ProxyGeneral, netDeposit)
  │     │     ├─ WETH.safeTransferFrom(DepositHelper, feeRecipient, fee)   -- !! two allowances needed
  │     │     ├─ ProxyGeneral.mint(DepositHelper, shares)
  │     │     └─ ← shares (returned to DepositHelper)
  │     └─ ProxyGeneral.safeTransfer(User, shares)          -- LP tokens forwarded
```

Rate-limit accounting is keyed on `msg.sender = DepositHelper`, so
**all ETH deposits share a single rate-limit bucket**. Same problem for
deposit fees: the fee is taken from `msg.sender = DepositHelper`, not
from the actual user.

### 5.2 Deposit path — plain ERC20 base asset

```
User (EOA)
  ├─ ERC20.approve(LiquidityManager, amount)
  ├─ LiquidityManager.deposit(amount)                        -- msg.sender == User
  │     ├─ (same steps as above, but the “user” is the real EOA)
```

### 5.3 Withdraw path

Simplified for the case where the base asset in custody is sufficient:

```
User → LM.withdraw(shares) / withdrawWithDeadline(shares, dl)
  ├─ ParameterManager.getCurrentParameterValue("poolReserveRatio")
  ├─ ProxyGeneral.balanceOf(user)                           -- check balance
  ├─ ValueCalculator.getTotalPoolValue()                    -- PoolValueInfo
  ├─ compute amount = shares * totalValue / totalSupply
  ├─ checkWithdrawLimits(user, amount)                       -- READS legacy hourlyWithdrawnAmounts (empty)
  ├─ compute fee, netWithdraw
  ├─ ProxyGeneral.checkRateLimit(user, "withdraw", amount)
  ├─ ProxyGeneral.trackOperation(user, "withdraw", amount)
  ├─ reserve-ratio check
  ├─ ProxyGeneral.burn(user, shares)                         -- CEI: state before external
  ├─ ProxyGeneral.withdrawToken(baseAssetCode, netWithdraw+fee, address(this))
  ├─ BASE_ASSET.safeTransfer(user, netWithdraw)
  ├─ BASE_ASSET.safeTransfer(feeRecipient, fee)
```

When `poolBaseAssetBalance < netWithdraw`, an **automatic-swap loop** is
executed BEFORE burning shares (line 321-334). It iterates up to
`maxIterations = 10`:

```
_executeAutomaticSwap(baseAssetNeeded)
  loop up to 10 iterations:
      ValueCalculator.selectTokenForSwap(stillNeeded)   -- try/catch
      if ("", 0):
          _swapLiquidTokensForBaseAsset(...)             -- iterates active tokens
          if (still not enough) _closeProtocolPositionsForBaseAsset(...)   -- ProtocolManager.closePositionsForBaseAsset
          if (totalObtained >= 97% * needed) accept       -- HARDCODED 3% slippage!
          else revert
      else:
          SwapManager.performSwap(token, baseAsset, amt, deadline)
```

Key invariant risk here: if the loop cannot obtain enough base asset,
`netWithdraw` is **silently clamped** to whatever the pool has (line 329
of `_withdrawInternal`). The user receives less than they asked for and
their `_shares` are still burned in full → NAV-per-share silently
increases for the remaining LPs. See finding CORE-021.

### 5.4 Multi-plugin best-quote swap

`SwapManager.swapWithBestPlugin(spend, receive, amountIn, minAmountOut, dl)`

```
1. deadline / amountIn / minAmountOut / same-token checks
2. TokenManager.getTokenAddress(spend/receive)
3. getAllQuotes(...) — iterates every Beacon module whose name ends with "Plugin"
      for each plugin: try plugin.getExpectedOutput(inAddr, outAddr, amountIn, decIn, decOut)
4. pick plugin with highest valid quote
5. require(bestQuote >= minAmountOut)
6. ProxyGeneral.approveSpender(spend, bestPlugin, amountIn)  -- exact-amount approve
7. bestPlugin.inputSwap(spend, receive, amountIn) → amountOut  -- ★
8. emit BestPluginSelected(...)
9. successes[hash]++
```

Note (★): unlike the internal `_swapTokenToToken` / `_swapToBaseAsset`
paths, this new function **never verifies the actual received amount
against `minAmountOut`**. It only compared the pre-swap *quote* against
`minAmountOut`. Between quote and execution the pool state can change
(sandwich, in-block reorg, front-run) and the plugin can legitimately
return less than `bestQuote` — with zero protection. This is a
regression from the older internal paths, which balance-diff and
`require(actualReceived >= minAcceptableOutput)`. See finding CORE-002.

### 5.5 Protocol lifecycle

```
Owner
  ├─ ProtocolManager.registerProtocol("Euler", plugin, lensAdapter, registry)
  ├─ ProtocolManager.deposit("Euler","WETH", 1e18)
  │     ├─ Beacon.getImplementation("Euler") → plugin
  │     ├─ ProxyGeneral.withdrawToken("WETH", 1e18, plugin)
  │     └─ IProtocolManager(plugin).deposit("WETH", 1e18)
  ├─ ProtocolManager.borrow("Euler","USDC", 1000e6)
  │     └─ ILendingProtocol(plugin).borrow("USDC", 1000e6)   -- plugin transfers USDC to ProxyGeneral
  ├─ ProtocolManager.repay("Euler","USDC", 500e6)
  │     ├─ ProxyGeneral.withdrawToken("USDC", 500e6, plugin)
  │     └─ ILendingProtocol(plugin).repay("USDC", 500e6)
  └─ ProtocolManager.withdraw("Euler","WETH", 5e17)
        └─ IProtocolManager(plugin).withdraw("WETH", 5e17)   -- plugin transfers WETH to ProxyGeneral
```

ProtocolManager does NOT check `ProxyGeneral.paused()` before performing
these operations — an emergency pause does not stop leverage/deleverage
via ProtocolManager (finding CORE-045). It also uses raw `plugin.call(...)`
for `closePosition(string,string)` (line 377) and for `executeProtocolCall`
(line 473); return data is not decoded.

### 5.6 Emergency pause & drain

```
Emergency contact / owner
  └─ EmergencyHandler.emergencyPause(reason)                 -- onlyEmergencyAuthorized
        ├─ require(!emergencyState.isActive)
        ├─ require(block.timestamp - lastEmergencyTimestamp >= 1 day)   -- HARD cooldown even if resolved!
        ├─ set emergencyState  (all fields)
        ├─ ProxyGeneral.pause()
        └─ emit EmergencyPauseExecuted + notify contacts

Wait ≥ unpauseTimelock (6h default)
Owner (only!)
  └─ EmergencyHandler.emergencyUnpause()
        ├─ require(block.timestamp - emergencyState.activatedAt >= unpauseTimelock)
        ├─ ProxyGeneral.unpause()
        └─ delete emergencyState

Owner (once):
  └─ EmergencyHandler.emergencyWithdraw()      -- iterates active tokens + base asset
        ├─ for each: ProxyGeneral.emergencyTransfer(token, balance, owner())   -- ★ MISSING FN
        └─ …
```

★ `ProxyGeneral.emergencyTransfer(address,uint256,address)` is declared
in `IProxyGeneral` but **not implemented** in `ProxyGeneral.sol` (the
fallback reverts with “Function does not exist”). This makes
`EmergencyHandler.emergencyWithdraw()` and its overload always revert on
the try-catch path. See finding CORE-051.

`ProxyGeneral.emergencyTransferAll(recipient)` DOES exist but it only
moves the base asset and ETH — it silently ignores every non-base ERC20
in custody (finding CORE-054).

### 5.7 Parameter change lifecycle

Timelocked parameter:

```
Owner or EmergencyHandler
  └─ ParameterManager.proposeParameterChange(name, newValue)
        └─ writes proposedValue, proposedAt, effectiveAt = now + timelock
Wait ≥ parameterTimelock (default 24h)
  └─ ParameterManager.executeParameterChange(name)
        └─ commits param.currentValue = param.proposedValue
```

Bypass paths that erase timelock protection (see findings):

- `updateMultipleParameters(names[], values[])` — writes `currentValue`
  directly, even for `requiresTimelock == true` (CORE-036).
- `setParameterEmergency(key, valueBytes, reason)` — instant, no pause
  check (CORE-039).
- `emergencySetParameter(name, newValue)` — instant, but at least
  requires `ProxyGeneral.paused()` (CORE-038).
- Two overloads of `proposeParameterChange` with different semantics
  (`(string, uint256)` and `(string, bytes, string)`) coexist; the
  second bypasses the `requiresTimelock` check entirely (CORE-040).
- `executeParameterChange(uint256)` and `cancelParameterProposal(uint256)`
  ignore the proposalId and iterate blindly (CORE-041 / CORE-042).

---

## 6. Invariants expected to hold

The following invariants are what a well-behaved deployment SHOULD keep.
Multiple of them are violated by identified findings — the JSON at the
end of this audit lists which finding breaks which.

| # | Invariant | Type |
|---|---|---|
| I-01 | For every LP token in circulation there is proportional pool NAV: `totalSupply * pricePerShare ≈ totalValue`. | Solvency |
| I-02 | Only `ProxyGeneral.authorizedModules` can mint / burn LP or move custody assets. | Access |
| I-03 | Deposit only enters the pool if user got `≥ 1 wei` of shares AND the base asset transfer succeeded. | Accounting |
| I-04 | Every user withdrawal either delivers `≥ netWithdraw` of base asset OR reverts. | Accounting (broken by CORE-021) |
| I-05 | Fee accounting: `feeAmount + netAmount == amount` for both deposits and withdrawals. | Fee |
| I-06 | `SwapManager.performSwap` reverts if received amount < expected × (1 – maxSlippage). | Slippage |
| I-07 | Timelocked parameters cannot be changed instantly without emergency pause. | Governance (broken by CORE-036, CORE-040) |
| I-08 | Emergency pause halts *all* pool state changes (deposit, withdraw, swap, borrow, repay, protocol deposit/withdraw). | Emergency (broken by CORE-045) |
| I-09 | Emergency withdraw drains all custody assets (base + all active tokens + all protocol positions). | Emergency (broken by CORE-051, CORE-054) |
| I-10 | Base asset resolution is consistent across modules (`baseAssetCode` string per module + Beacon `"BASE_ASSET"` address). | Config |
| I-11 | Oracle price is validated at each read (not stale, not zero) and normalised to the base asset for value calculation. | Pricing |
| I-12 | `checkWithdrawLimits` accurately reflects the user’s consumed hourly/daily limit. | Rate-limit (broken by CORE-022) |
| I-13 | Protocol operations (deposit / withdraw / borrow / repay) cannot happen while the pool is paused. | Emergency (broken by CORE-045) |
| I-14 | Only one non-cancelled proposal per parameter at a time. | Governance (broken by CORE-041) |
| I-15 | `ProxyGeneral.emergencyTransferAll` transfers all custody assets (base + tokens + ETH) to the recipient. | Emergency (broken by CORE-054) |

---

## 7. External integration surfaces

- **Oracle**: `IOracleAdapter` (Chainlink adapter today, Pyth planned).
  Consumed by `TokenManager` (`getTokenPrice`, `getPriceInUsd`,
  `getPriceDecimals`, `supportsToken`). Feeds MUST return a positive
  price and MUST revert with `StalePrice(timestamp,maxAge)` when stale;
  `TokenManager` re-emits `StalePrice(_, 0)` which loses the heartbeat.
- **Swap plugins**: `ISimpleSwap` (`inputSwap`, `outputSwap`,
  `getExpectedOutput(...)`). Discovered by name convention (`*Plugin`)
  in the Beacon.
- **Balancer flash loans**: `FlashLoanService` calls Balancer V2 vault
  `0xBA12...F2C8`. Assumes 0% fee (Balancer’s current setting). If
  Balancer starts charging, callers will need to fund the difference
  (finding CORE-060, informational).
- **DepositHelper ⇄ WETH**: assumes canonical wrapped-ether interface.
- **Protocol adapters/lens** (`ProtocolManager` → `IProtocolAdapter`,
  `ILensAdapter`): black boxes to the core. The core’s only defence
  against a malicious adapter is `_validateProtocol(pluginAddress != 0)`
  — see finding CORE-046.

---

## 8. Trust assumptions and threat model

- The owner EOA / multisig behind every `Ownable` contract is trusted.
- The Beacon owner is trusted to keep the module registry in a coherent
  state (in particular, `"BASE_ASSET"`, `"ProxyGeneral"`,
  `"LiquidityManager"`, `"SwapManager"`, `"TokenManager"`,
  `"ValueCalculator"`, `"ParameterManager"`, `"EmergencyHandler"` must
  be simultaneously registered and pointing at compatible contracts).
- All plugins registered by name in the Beacon are trusted enough to be
  granted `authorizedModules` on ProxyGeneral and to be handed
  `type(uint256).max` allowances on any spend token (see finding
  CORE-006).
- The oracle adapter is trusted to enforce staleness/heartbeat.
- Users are untrusted (including in the presence of MEV) → hence the
  deadline / minAmountOut mechanisms in swap flows, HOWEVER many
  view-facing paths that go through the automatic-swap loop **inherit
  their slippage protection only from `maxSlippage` (a global bps)**;
  users cannot specify their own `minAmountOut` on a plain `withdraw`.

---

## 9. Architectural anti-patterns identified

Detailed in the JSON at the end of this audit, summary here:

1. **Dual, inconsistent rate-limit systems** (`hourlyWithdrawnAmounts`
   legacy path vs. `userRateLimits` new path). LiquidityManager writes
   to the new one but reads from the old one → withdraw hourly/daily
   limits are effectively unenforced.
2. **Broken interface conformance** in `IProxyGeneral`: half the
   functions are declared but not implemented in `ProxyGeneral.sol`
   (`emergencyTransfer`, `depositETH`, `withdrawETH`, `wrapETH`,
   `unwrapWETH`, `addAuthorizedModule`, `removeAuthorizedModule`,
   `getTokenBalance`, `getAllTokenBalances`, `calculateTotalValue`,
   `getValuePerLPToken`, `getPoolStatistics`). Callers that route
   through `IProxyGeneral(...)` invoke the fallback (`revert "Function
   does not exist"`).
3. **String-based module resolution on every call** — high gas cost
   (keccak-string comparisons + external calls). Also creates a single
   point of failure at the Beacon.
4. **Duplicated 3% slippage tolerance** — configured in three places
   (`SwapManager.maxSlippage`, hardcoded `97%` accept ratio in
   `_executeAutomaticSwap`, `poolReserveRatio` default `0`). The latter
   two are unreachable via governance without redeploy.
5. **Overlapping / redundant contracts**:
   - `SwapManager.performSwap` vs `performSwapAuto` vs
     `swapWithBestPlugin` — three entry points with divergent slippage
     semantics.
   - `TokenManager.manageTokenData(...)` overloaded — same body, one
     ignores its params.
   - `ProtocolManager.closePosition(name, debt, coll)` vs
     `closePosition(name, positionId)` — silent shadowing.
6. **Missing pause propagation to `ProtocolManager`** — deposit/borrow
   continues during pause.
7. **Missing pause propagation to `SwapManager`** — swaps are gated by
   `swapsEnabled` (local flag), not by `ProxyGeneral.paused()`.
8. **Legacy `simpleSwapRouter` fallback still active** in `_getActivePlugin`
   — if the active plugin resolution fails, an old (potentially
   deprecated) router is silently used.
9. **`Beacon.getImplementation` reverts** rather than returning
   `address(0)` — callers that don’t use try/catch fully break on module
   freeze/removal.
10. **Different pragmas** across the core (`^0.8.19`, `^0.8.24`,
    `^0.8.27`). This is fine at the ABI level but complicates verified
    deployment metadata and forces a lowest-common-denominator compiler
    for hardhat.

---

*(Function-by-function catalogue continues in `02-core-functions-catalog.md`;
findings JSON is delivered inline in the audit response.)*
