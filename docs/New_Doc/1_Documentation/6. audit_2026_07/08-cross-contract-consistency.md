# 08 — Cross-contract Consistency Findings (TestPOC audit 2026-07)

Scope: drift between `contracts/interfaces/**` and the implementations under
`contracts/*.sol`, `contracts/adapters/*.sol`, `contracts/plugins/*.sol` (excluding `plugins/old/`),
`contracts/services/*.sol`. Files whose name contains `dolomite` or `gmx` are out of scope.

Every finding cites `file:line` for both the interface declaration and the implementation.
Findings are grouped by severity to match the JSON at the end of the parent audit response.

---

## HIGH — will revert at runtime or corrupt off-chain indexers

### IFC-001 — `ProxyGeneral.emergencyTransfer(address,uint256,address)` does not exist
- Interface: `IProxyGeneral.sol:293` declares `function emergencyTransfer(address token, uint256 amount, address to) external`.
- Implementation: `ProxyGeneral.sol:459` implements `emergencyTransferAll(address recipient)` only. No `emergencyTransfer(address,uint256,address)` selector on the deployed contract.
- Callers that will revert:
  - `EmergencyHandler.sol:330`: `try proxy.emergencyTransfer(tokenAddress, balance, owner()) { … }` — inside the emergency-withdraw loop, will always fall into `catch { }` (already a swallowed error).
  - `EmergencyHandler.sol:363`: same call for the base asset.
  - `EmergencyHandler.sol:952`: `IProxyGeneral(proxyGeneral).emergencyTransfer(token, amount, recipient)` — the interface-compliance override at `EmergencyHandler.sol:948` will revert bubbling to the caller.
- Impact: emergency-withdraw and emergency-transfer paths are effectively broken from an off-contract call, and `EmergencyHandler.emergencyWithdraw()` reports "successful" while transferring nothing because all inner calls silently fail.

### IFC-002 — `event EmergencyTransferExecuted` — topic-hash drift
- Interface: `IProxyGeneral.sol:325` — `event EmergencyTransferExecuted(address token, uint256 amount, address indexed to)`.
- Implementation: `ProxyGeneral.sol:91` — `event EmergencyTransferExecuted(address indexed recipient, uint256 timestamp)`.
- Different arity, different indexed pattern → different keccak256 topic0. Off-chain indexers subscribed to the interface ABI will never decode the impl's emissions and vice-versa.
- The impl-declared event is what is actually emitted (`ProxyGeneral.sol:481`).

### IFC-003 — `Beacon.upgradeImplementation` missing
- Interface: `IBeacon.sol:6` declares `upgradeImplementation(string,address)`.
- Implementation: `Beacon.sol:109` has `updateImplementation(...)` only. No alias.
- Impact: any typed call `IBeacon(beacon).upgradeImplementation(...)` reverts. Currently no in-tree call uses this selector, but external tooling / upgrade scripts written against the ABI will fail.

### IFC-004 — `ProtocolManager` calls `ILendingProtocol(morphoPlugin).borrow(string,uint256)` — selector does not exist on MorphoPlugin
- Interface: `ILendingProtocol.sol:73` — `function borrow(string memory tokenCode, uint256 amount) external returns (bool)`.
- Implementation used at runtime: `MorphoPlugin.sol:340` — `function borrow(string memory collateralCode, string memory loanCode, uint256 amount)`. NO 2-arg overload exists on `MorphoPlugin`.
- Caller: `ProtocolManager.sol:320` — `bool success = ILendingProtocol(plugin).borrow(tokenCode, amount);`.
- Same drift applies to:
  - `ProtocolManager.sol:351` → `ILendingProtocol(plugin).repay(tokenCode, amount)` vs `MorphoPlugin.sol:379` `repay(string,string,uint256)`.
  - `ProtocolManager.sol:402` → `ILendingProtocol(plugin).getDebt(tokenCode)` vs `MorphoPlugin.sol:575` `getDebt(string,string)`.
  - `ProtocolManager.sol:414` → `ILendingProtocol(plugin).getHealthFactor()` vs `MorphoPlugin.sol:614` `getHealthFactor(string,string)`.
- Impact: whenever ProtocolManager is invoked with `protocolName == "MorphoPlugin"`, all four selectors resolve to functions that DO NOT exist on MorphoPlugin. Call reverts. Morpho positions cannot be managed via the generic `ProtocolManager` API — only via direct `MorphoPlugin` calls.

### IFC-005 — `event ParameterRegistered` topic-hash drift
- Interface: `IParameterManager.sol:244` — `event ParameterRegistered(string key, bytes defaultValue, string description)`.
- Implementation: `ParameterManager.sol:64-70` — `event ParameterRegistered(string indexed parameterName, uint256 initialValue, uint256 minValue, uint256 maxValue, bool requiresTimelock)`.
- Same name, incompatible fields → different topic0 hashes. Both are declared visible in the same compilation unit (the impl inherits `IParameterManager` — this is a legit compile error in modern Solidity versions where events cannot be shadowed). The `emit` at `ParameterManager.sol:173` and `ParameterManager.sol:645` refer to the local one (5-arg) whereas the interface consumer expects the 3-arg one.

### IFC-006 — `event EmergencyContactAdded` / `EmergencyContactRemoved` topic-hash drift
- Interface: `IEmergencyHandler.sol:214-215` — `event EmergencyContactAdded(address indexed contact, string role, uint256 timestamp)`; `event EmergencyContactRemoved(address indexed contact, uint256 timestamp)`.
- Implementation: `EmergencyHandler.sol:113-114` — `event EmergencyContactAdded(address indexed contact)`; `event EmergencyContactRemoved(address indexed contact)`.
- Same-name / different arity → different topic0. Impl emits its 1-arg form at lines 548 and 574; the 3-arg / 2-arg interface events are never emitted.

### IFC-007 — `IParameterManagerForModules.isPaused()` not implemented
- Interface: `IParameterManagerForModules.sol:6` declares `isPaused() external view returns (bool)`.
- Implementation: `ParameterManager.sol` — no `isPaused` function. Only `ProxyGeneral.sol:450` has `isPaused()` (unrelated typed target).
- Impact: any module that casts `IParameterManagerForModules(paramManager).isPaused()` will revert. Currently no caller uses it (grep confirmed), so the surface is broken-but-unreachable. Recommendation: either remove `isPaused` from the interface, or route through `IProxyGeneral(proxyGeneral).paused()`.

### IFC-008 — `SwapExecuted` event topic-hash drift
- Interface: `ISwapManager.sol:127-134` — `event SwapExecuted(address indexed user, string tokenIn, string tokenOut, uint256 amountIn, uint256 amountOut, uint256 timestamp)`.
- Implementation: `SwapManager.sol:111-118` — `event SwapExecuted(string indexed tokenIn, string indexed tokenOut, uint256 amountIn, uint256 amountOut, uint256 slippageBps, address indexed executor)`.
- Different arg types, different indexed pattern, different semantics (`timestamp` vs `slippageBps`, `user` vs `executor`) → different topic0.

### IFC-009 — `TokenDeposited` / `TokenWithdrawn` indexed-string drift
- Interface: `IProxyGeneral.sol:306-307` — `event TokenDeposited(string tokenCode, uint256 amount, address indexed from)`; `event TokenWithdrawn(string tokenCode, uint256 amount, address indexed to)`.
- Implementation: `ProxyGeneral.sol:105-106` — `event TokenDeposited(string indexed tokenCode, uint256 amount, address indexed from)`; `event TokenWithdrawn(string indexed tokenCode, uint256 amount, address indexed to)`.
- Marking `string` as `indexed` changes it from a data field to a keccak-hashed topic → topic0 changes AND the tokenCode string is no longer decodable from logs. Off-chain listeners built on the interface ABI will lose the tokenCode.

### IFC-010 — `EulerLensAdapter.isCircuitBreakerActive` calls non-existent selector on plugin
- Reference to plugin at `EulerLensAdapter.sol:886`: `try IEulerV2PluginView(plugin).isCircuitBreakerActive() returns (bool active) { … }`.
- Local forward-decl at `EulerLensAdapter.sol:34` declares the selector `isCircuitBreakerActive()`.
- Actual selector on plugin: `circuitBreakerTripped()` (public state var at `EulerV2Plugin.sol:128`). The plugin does not expose `isCircuitBreakerActive()`.
- Impact: the `try…catch` at line 886 always falls into `catch` and returns `true` (adapter reports "circuit breaker active" even when it isn't). Ripple: `ValueCalculator` and `LiquidityManager` risk paths that consult the lens will treat the plugin as broken.

---

## MEDIUM — semantic drift, dead surfaces, silent divergence

### IFC-011 — `ProxyGeneral` renames vs `IProxyGeneral`
- `IProxyGeneral.addAuthorizedModule(address,string)` (line 261) → impl `authorizeModule(address,string)` (`ProxyGeneral.sol:395`).
- `IProxyGeneral.removeAuthorizedModule(address)` (line 267) → impl `deauthorizeModule(address)` (`ProxyGeneral.sol:408`).
- `IProxyGeneral.paused()` (line 285) — impl has `paused` state var (`ProxyGeneral.sol:28`) whose auto-getter satisfies the interface, PLUS an explicit `isPaused()` (line 450) that is NOT in the interface.
- `IProxyGeneral.emergencyTransfer(address,uint256,address)` → impl `emergencyTransferAll(address)` (see IFC-001).
- `IProxyGeneral` missing altogether from the impl: `depositETH`, `withdrawETH`, `getETHBalance`, `wrapETH`, `unwrapWETH`, `getTokenBalance(string)`, `getAllTokenBalances`, `calculateTotalValue`, `getValuePerLPToken`, `getPoolStatistics`.

### IFC-012 — `ProxyGeneral.RateLimitExceeded` param name drift
- Interface: `IProxyGeneral.sol:316` — `event RateLimitExceeded(address indexed user, string operationType, uint256 requested, uint256 allowed)`.
- Implementation: `ProxyGeneral.sol:101` — `event RateLimitExceeded(address indexed user, string operationType, uint256 amount, uint256 remaining)`.
- Same topic0 (types identical, indexed identical), but the last two field NAMES are inverted-in-meaning: "requested" vs "amount" and "allowed" vs "remaining" — off-chain UIs may render backwards.

### IFC-013 — `ProxyGeneral.ContractPaused/ContractUnpaused` renamed to `Paused/Unpaused`
- Interface: `IProxyGeneral.sol:323-324` — `event ContractPaused(address indexed pausedBy)`; `event ContractUnpaused(address indexed unpausedBy)`.
- Implementation: `ProxyGeneral.sol:85, 88` — `event Paused(address indexed account)`; `event Unpaused(address indexed account)`.
- Different event names → different topic0. Off-chain listeners on the interface events will never fire.

### IFC-014 — `ILendingProtocol` extends `IProtocolManager` but plugins don't implement `IProtocolManager` methods
- `ILendingProtocol` (`ILendingProtocol.sol:24`) `is IProtocolManager` — inherits `deposit`, `withdraw`, `getBalance`, `getTotalValue`, `getProtocolInfo`, `emergencyWithdrawAll`, `closePositionsForBaseAsset`, `getAllProtocolsValue`, `getProtocolPositionBreakdown`.
- `AaveV3Plugin`, `EulerV2Plugin`, `MorphoPlugin`, `MorphoVaultPlugin` implement `IProtocolAdapter` (deposit/withdraw/getBalance/…) but NOT `IProtocolManager` (`getTotalValue()` returns uint256, `getProtocolInfo()` returns 3 strings, `getAllProtocolsValue()`, `getProtocolPositionBreakdown(string)`).
- Therefore `ILendingProtocol(plugin).getTotalValue()`, `.getProtocolInfo()`, `.getAllProtocolsValue()`, `.getProtocolPositionBreakdown(...)` all revert on any plugin.
- The `ILendingProtocol` interface is architecturally incoherent: it extends `IProtocolManager` (a *manager* concept) but is used to cast plugins. Suggest splitting into `IProtocolAdapter` + `ILendingActions` (see recommendation in `07-interfaces-catalog.md`).

### IFC-015 — `EulerRegistry` does not inherit `IEulerRegistry`
- Declaration: `plugins/EulerRegistry.sol:24` — `contract EulerRegistry is Ownable {`.
- Interface: `interfaces/IEulerRegistry.sol:9` — never imported in impl.
- Impact: no compile-time enforcement of the 18 interface selectors. Return-name drift on `isRegistered` (interface names `registered`, impl unnamed at line 511), `hasActivePositionForPair` (interface `exists`, impl unnamed at line 677). Interface has zero events; impl declares 12 events and 9 errors that consumers of the interface cannot see.

### IFC-016 — `EulerRegistry.PositionClosed` event name collides with `IProtocolAdapter.PositionClosed`
- `EulerRegistry.sol:129` — `event PositionClosed(uint256 indexed positionId);` (1 arg).
- `IProtocolAdapter.sol:143` — `event PositionClosed(uint256 indexed positionId, uint256 baseAssetReturned);` (2 args).
- Different topic0 (different arity), but off-chain indexers subscribing to "PositionClosed" as a generic event will mis-decode.

### IFC-017 — Duplicate `Position` struct in `IProtocolAdapter` and `ILensAdapter`
- `IProtocolAdapter.sol:54` and `ILensAdapter.sol:46` both define `struct Position { positionId, protocolName, status, collateralValue, debtValue, netValue, healthFactor, openTimestamp, collateralToken, debtToken }` with `PositionStatus` also duplicated (line 42 vs line 35).
- Any future divergence will silently misalign callers. Recommend: `ILensAdapter` should reference `IProtocolAdapter.Position` directly (as it already does for `ProtocolType` at line 130).

### IFC-018 — `IMorphoRegistry.MarketRemoved` dead surface + `MarketAlreadyConfigured` unused error
- `IMorphoRegistry.sol:47` declares `event MarketRemoved` but `MorphoRegistry` has no `removeMarket()` function → event is never emitted (searched: no `emit MarketRemoved` in impl).
- `IMorphoRegistry.sol:60` declares `error MarketAlreadyConfigured` but `MorphoRegistry.configureMarket` (line 83) silently overwrites without checking; error is dead.

### IFC-019 — `MorphoLensAdapter.getValueBreakdown.availableToWithdraw` semantic bug
- `MorphoLensAdapter.sol:253-255` computes `availableToWithdraw = netValue - totalDebt`, where `netValue = collateral - debt`. Result is `collateral - 2*debt`, which does not match the interface docstring in `ILensAdapter.sol:91` ("`availableToWithdraw In base asset`" i.e. remaining borrow capacity).

### IFC-020 — `MorphoVaultLensAdapter.getProtocolLimits.minHealthFactor = type(uint256).max`
- `MorphoVaultLensAdapter.sol:286` returns `type(uint256).max` for `minHealthFactor`.
- `MorphoLensAdapter.sol:615` returns `1.05e18` (a real HF threshold).
- Callers comparing HF against `minHealthFactor` will always report "unhealthy" for the vault plugin (any HF < uint256.max is a fail).

### IFC-021 — Mutability drift `pure` vs `view` across all lens adapters
- `ILensAdapter` declares view functions (e.g., `protocolName`, `protocolType`, `getYieldInfo`, `getNetAPY`, `getPositionsAtRisk`, `getLiquidationThreshold`, `estimatePositionAfterSwap`, `getProtocolLimits`).
- Impls mark many as `pure` because they return constants. Instances:
  - `MorphoLensAdapter.sol:184, 189, 533, 543, 603, 611` — pure vs view.
  - `MorphoVaultLensAdapter.sol:121, 125, 154, 159, 167, 199, 247, 256, 270, 276, 282` — pure vs view.
  - `EulerLensAdapter.sol:875` — `protocolType` marked `pure`.
- Solidity accepts this (pure narrows view) but the drift is visible in generated ABIs and stops any refactor that needs storage reads.

### IFC-022 — `EulerLensAdapter` missing `override` on 4 ILensAdapter methods
- `getActivePositionCount()` at `EulerLensAdapter.sol:189` — no override.
- `getProtocolSummary()` at line 200 — no override.
- `protocolType()` at line 875 — no override.
- `isCircuitBreakerActive()` at line 882 — no override.
- Under Solidity ≥0.8.8 this raises `TypeError: Overriding function is missing "override" specifier`. The file's pragma is `^0.8.19` so the missing override should already fail compilation. Either these are `virtual` on the interface (they aren't — interfaces have implicit virtual) or this file has never been compiled against the current interface. Verify with a fresh `forge build`.

### IFC-023 — `EulerV2Plugin.closePosition(string,string)` missing `override`
- `EulerV2Plugin.sol:482` — implements `closePosition(string,string)` without the `override` keyword; the sibling `closePosition(uint256)` at line 1373 has `override`.
- `IEulerV2Plugin.sol:120` declares the 2-string form.
- Compile hazard identical to IFC-022.

### IFC-024 — `SwapManager` missing `override` on all `ISwapManager` implementations
- `SwapManager.sol:18` declares `is ISwapManager, Ownable, ReentrancyGuard`.
- None of `calculateMinAmountOut` (line 1171), `setSimpleSwapRouter` (1226), `getSimpleSwapRouter` (1318), `setSwapsEnabled` (1264), `areSwapsEnabled` (1326), `getTokenBaseAssetPrice` (1335), `estimateSwapGas` (1357), `canSwap` (1464), `validateSwapParams` (1526), `emergencyTokenRecovery` (1558) uses `override`. Compile hazard identical to IFC-022.

### IFC-025 — `SwapRouterUpdated` renamed
- Interface: `ISwapManager.sol:135` — `event SwapRouterUpdated(address indexed oldRouter, address indexed newRouter)`.
- Implementation: `SwapManager.sol:108` — `event SimpleSwapRouterUpdated(address oldRouter, address newRouter)` (also drops both `indexed`).
- Different name → different topic0. The interface event is never emitted.

### IFC-026 — `SwapManager` does not declare `ISwapManagerForModules`
- Interface: `ISwapManagerForModules.sol:4`.
- Implementation: `SwapManager.sol:18` inheritance chain omits it.
- `performSwap` (`SwapManager.sol:265`), `performSwapAuto` (line 343), `validateSwapParameters` (line 736) match by selector but no compile-time enforcement. `LiquidityManager` casts `ISwapManagerForModules(swapManager)` at runtime (`Liquiditymanager.sol` — see agent report).

### IFC-027 — `UniswapV3Plugin` vs `UniswapV3PluginDirect` — incompatible custody assumptions
- `UniswapV3Plugin.inputSwap` (`plugins/UniswapV3Plugin.sol:48`, line ~59): pulls tokens from `msg.sender` via `safeTransferFrom(msg.sender, ...)`.
- `UniswapV3PluginDirect.inputSwap` (`plugins/UniswapV3PluginDirect.sol:117`, line ~132): pulls tokens from `proxyGeneral`.
- `SwapManager` grants approvals from `ProxyGeneral` to the plugin (per agent report on `SwapManager.sol:566, 621, 679`) but does NOT hold tokens itself. → **Only `UniswapV3PluginDirect` is compatible with the current `SwapManager` flow**; wiring the wrapper `UniswapV3Plugin` will revert on `transferFrom`.

### IFC-028 — `ChainlinkAdapter.getPrice` never emits `PriceRetrieved` (interface says MUST)
- Interface: `IOracleAdapter.sol:58-63,76` documents "MUST emit PriceRetrieved event".
- Implementation: `ChainlinkAdapter.getPrice` (`ChainlinkAdapter.sol:337`) is `external view` — cannot emit events. The interface's `MUST emit` requirement is unsatisfiable for a `view` function. Either the interface docstring is wrong or `getPrice` should be non-view.

### IFC-029 — `IMorphoRegistry.isVaultApproved` bundles two flags
- `MorphoRegistry.sol:251` — `return _vaultApproved[vault] && _vaultConfigs[vault].isActive`.
- Interface docstring `IMorphoRegistry.sol:89-90` only says "Check if a vault is approved".
- Deposits routed via `MorphoRegistry.getDefaultVault` (line 260) do NOT re-check `isActive`, so a paused vault still receives deposits through the default path. Cross-contract behavior contradicts the intent of `setVaultStatus(false)`.

### IFC-030 — `MorphoVaultPlugin` emits `Deposited("VAULT", …)` / `Withdrawn("VAULT", …)` instead of tokenCode
- `MorphoVaultPlugin.sol` (lines 391, 410) uses the literal string `"VAULT"` for the tokenCode field.
- `MorphoPlugin.sol` (line ~280) emits the real code (`collateralCode`).
- Inconsistent event payloads across two implementations of the same `IProtocolAdapter` event.

### IFC-031 — Return-name drift on `closePositionsForBaseAsset`
- Interface `IProtocolAdapter.sol:98-99` — `returns (uint256 baseAssetObtained, uint256 positionsClosed)`.
- Implementations rename first return to `obtained`:
  - `EulerV2Plugin.sol:1407`.
  - `MorphoPlugin.sol:536`.
  - `MorphoVaultPlugin.sol:202`.
- ABI-compatible but generated Natspec / typechain names diverge.

### IFC-032 — `IEulerLensAdapter` structs `PositionValues` / `LiquidationStatus` unused
- Declared at `interfaces/IEulerLensAdapter.sol:35, 46`.
- `getEulerPositionValues` (`EulerLensAdapter.sol:361`) returns 3 raw uints instead of `PositionValues memory`.
- No function in the file returns `LiquidationStatus`.
- Dead surface / mis-planned struct.

---

## LOW — dead / redundant / cosmetic

### IFC-033 — Duplicated Euler vault-registry interfaces
- `interfaces/IEulerRegistry.sol` (full — includes position management)
- `interfaces/euler/IEulerVaultRegistry.sol` (subset — vault mappings only, has `getRegisteredCount()` not in `IEulerRegistry`)
- Neither is inherited by `plugins/EulerRegistry.sol`. `IEulerVaultRegistry` has zero in-tree callers → **LEGACY**.

### IFC-034 — Lens events never emitted
- `ILensAdapter.HealthChecked` and `RiskAlertTriggered` (`interfaces/ILensAdapter.sol:306-307`) — no `emit` in `AaveV3LensAdapter`, `EulerLensAdapter`, `MorphoLensAdapter`, `MorphoVaultLensAdapter`.
- `IEulerV2PluginSpecific.LeveragePositionOpened` / `LeveragePositionClosed` — plugin emits `LeverageOpenedAtomic` / `LeverageClosedAtomic` instead (`EulerV2Plugin.sol:181, 192`). Interface events dead.
- `IProtocolAdapter.PositionOpened`, `PositionLiquidated`, `CircuitBreakerActivated` — never emitted by any adapter/plugin.
- `ISwapPlugin.ConfigurationUpdated`, `HealthStatusChanged` — never emitted by either Uniswap plugin.
- `ISwapManager.SlippageExceeded` — never emitted by `SwapManager` (searched).

### IFC-035 — Declared-but-unthrown custom errors
- `IAaveV3Registry.TokenAlreadyConfigured` (interface line 34) — never reverted; impl re-configures idempotently.
- `AaveV3LensAdapter` `AaveV3PluginNotFound`, `AaveV3RegistryNotFound`, `TokenManagerNotFound` — declared, never reverted.
- `EulerRegistry.InvalidSubAccountId` — declared at line 141, never reverted.
- `EulerLensAdapter.EulerVaultRegistryNotFound`, `PositionNotFound(uint256)` — declared at lines 96, 98; never reverted (paths use `require`-strings instead).
- `MorphoLensAdapter.MorphoPluginNotFound`, `MorphoRegistryNotFound`, `TokenManagerNotFound` — declared (lines 69-71), never reverted.

### IFC-036 — Locally-redeclared errors shadow interface-provided ones
- `AaveV3Plugin.InvalidAddress` / `TokenNotConfigured(string)` (`plugins/AaveV3Plugin.sol:121, 123`) shadow `IAaveV3Registry` errors of the same names (`IAaveV3Registry.sol:32, 31`).
- `MorphoPlugin.InvalidAddress` / `MarketNotConfigured(string,string)` (`plugins/MorphoPlugin.sol:129, 131`) shadow `IMorphoRegistry.InvalidAddress` / `MarketNotConfigured` (`IMorphoRegistry.sol:58, 57`).
- `MorphoVaultPlugin.InvalidAddress` (`plugins/MorphoVaultPlugin.sol:70`) — same.
- These live in different scopes (interfaces are imported but the errors are re-declared locally). Solidity allows it, but generated ABIs contain duplicate 4-byte selectors from different origin files → observability confusion.

### IFC-037 — Overloaded / extra function on `UniswapV3Plugin`
- 3-arg `getExpectedOutput(address,address,uint256)` at `plugins/UniswapV3Plugin.sol:102` — not in `ISimpleSwap` (which requires the 5-arg form). Not present in `UniswapV3PluginDirect`. Function overloading legal; risks off-chain-tooling confusion.

### IFC-038 — Pragma inconsistency
- `AaveV3LensAdapter.sol:2` uses `^0.8.19`.
- `AaveV3Plugin.sol:2` and `AaveV3Registry.sol:2` use `^0.8.27`.
- Same for other pairs. Compiles under the highest floor, but 0.8.19-declared files miss ≥0.8.20 features (e.g., custom-error import improvements). Standardize to a single pragma.

### IFC-039 — `_isPaused` alias exposure
- `ProxyGeneral.sol:28` — public state var `paused` (auto-getter returns bool) AND explicit `isPaused()` at line 450 also returning `paused`. Two selectors for the same state, one of them (`paused()`) matches the interface.

### IFC-040 — `IParameterManager.getStringParameter` returns empty string
- Implementation: `ParameterManager.sol:791-794` — always returns `""`. Comment admits "would need different storage mechanism". Interface (`IParameterManager.sol:203`) does not signal partial implementation. Consumers unaware.

### IFC-041 — `IParameterManager.getAddressParameter` truncates
- Implementation: `ParameterManager.sol:787-789` — `return address(uint160(parameters[key].currentValue))`. If callers ever store address bit-widths in the uint256 storage, high bits are discarded silently. Interface docstring does not disclose this narrowing.

---

## Cross-cutting recommendations (not new findings, actionable summary)

1. Add `is IProxyGeneral, IBeacon, IProtocolManager, ITokenManagerForModules, IValueCalculatorForModules, IParameterManagerForModules, IEulerRegistry` on the respective concrete contracts. All drift above would surface as compile errors.
2. Deprecate `ILendingProtocol` — replace with `IProtocolAdapter` + optional `ILendingActions` (still overloaded for Morpho's 2-string flavor).
3. Fix `ProxyGeneral.emergencyTransfer` signature (or fix all callers) — IFC-001 is a real security surface: emergency-withdraw silently fails.
4. Standardize event names + indexed patterns between interfaces and impls (IFC-002, IFC-005, IFC-006, IFC-008, IFC-009, IFC-013, IFC-016, IFC-025).
5. Standardize pragma to a single `^0.8.27`.
6. Remove dead events / errors / structs (IFC-032, IFC-033, IFC-034, IFC-035).
7. Fix `EulerLensAdapter.isCircuitBreakerActive` to call `circuitBreakerTripped()` (IFC-010).
8. Fix `MorphoLensAdapter.getValueBreakdown.availableToWithdraw` formula (IFC-019) and `MorphoVaultLensAdapter.getProtocolLimits.minHealthFactor` (IFC-020).
9. Consolidate the two `Position` struct definitions (IFC-017).
10. Fix `SwapManager` custody flow or remove the incompatible `UniswapV3Plugin` (IFC-027).
