# 07 — Interfaces Catalog (TestPOC audit 2026-07)

Scope: full `contracts/interfaces/**` (root + `aave/`, `balancer/`, `euler/`, `morpho/`).
Excluded per audit brief: files containing `dolomite` or `gmx`, the `plugins/old/` folder,
`SwapManager.sol.backup`, `EulerV2Plugin copy.sol.md`.

Legend for **Status**:
- `OK` — implementation inherits the interface, all functions present with matching signatures.
- `PARTIAL` — implementation inherits the interface but has drift (missing override, name / mutability / event mismatch, missing function).
- `IMPLICIT` — implementation does NOT declare inheritance but exposes selectors used through the interface type at call sites.
- `ORPHAN` — no implementation found in-tree.
- `LEGACY` — declared but not referenced by any current caller.

---

## Root interfaces (`contracts/interfaces/*.sol`)

| Interface | File:line | Implementation(s) | Used by (typed casts) | Status | Notes |
|---|---|---|---|---|---|
| `IBeacon` | `interfaces/IBeacon.sol:4` | `Beacon` (`contracts/Beacon.sol:9`) does NOT inherit it | 20+ modules cast `IBeacon(beacon)` | **IMPLICIT + PARTIAL** | Interface declares `upgradeImplementation` but `Beacon` only has `updateImplementation` (`Beacon.sol:109`) → any typed `IBeacon(...).upgradeImplementation(...)` would revert. |
| `IProxyGeneral` | `interfaces/IProxyGeneral.sol:8` | `ProxyGeneral` (`ProxyGeneral.sol:18`, does NOT inherit) | `Liquiditymanager`, `EmergencyHandler`, `SwapManager`, `ProtocolManager`, plugins, `TokenManager` | **IMPLICIT + PARTIAL** | Multiple missing / renamed functions and event drift. See findings IFC-001 … IFC-006. |
| `IEmergencyHandler` | `interfaces/IEmergencyHandler.sol:8` | `EmergencyHandler` (`EmergencyHandler.sol:17`, `is IEmergencyHandler, Ownable`) | `Beacon` resolves it, admin scripts | **PARTIAL** | Event-name topic-hash mismatches on `EmergencyContactAdded`, `EmergencyContactRemoved`; `emergencyPause` / `emergencyUnpause` public alongside interface aliases; internal calls to `proxy.emergencyTransfer(address,uint256,address)` target a non-existent selector on `ProxyGeneral`. |
| `IParameterManager` | `interfaces/IParameterManager.sol:8` | `ParameterManager` (`ParameterManager.sol:14`, `is IParameterManager, Ownable`) | Rarely used through this interface — `IParameterManagerForModules` is preferred | **PARTIAL** | Two `proposeParameterChange` overloads coexist (one not in interface); `event ParameterRegistered` in impl (`ParameterManager.sol:64`) collides in name with interface version (`IParameterManager.sol:244`) — different arity → topic-hash drift. Several typed getters return semantically-wrong values (`getStringParameter` returns empty, `getAddressParameter` truncates via `uint160`). |
| `IParameterManagerForModules` | `interfaces/IParameterManagerForModules.sol:4` | `ParameterManager` implicitly | `Liquiditymanager.sol:132,250`, `TokenManager.sol:8` | **PARTIAL** | Interface declares `isPaused()` — **NOT implemented** on `ParameterManager`. Any caller invoking `IParameterManagerForModules(paramManager).isPaused()` will revert. Currently no in-tree caller uses it, but the surface is broken. |
| `ILiquidityManager` | `interfaces/ILiquidityManager.sol:8` | `LiquidityManager` (`Liquiditymanager.sol:23`, `is ILiquidityManager, ReentrancyGuard, Ownable`) | External / scripts | **PARTIAL** | Interface event `Deposit(address indexed user, uint256 amount, uint256 sharesReceived, uint256 totalPoolBaseAsset, uint256 totalSupply)` — need to confirm impl emits the exact 5-arg signature (drift risk). |
| `ISwapManager` | `interfaces/ISwapManager.sol:8` | `SwapManager` (`SwapManager.sol:18`, `is ISwapManager, Ownable, ReentrancyGuard`) | External | **PARTIAL** | `SwapExecuted` in impl (`SwapManager.sol:111-118`) has 6 fields but a **different signature** than interface (`ISwapManager.sol:127-134`) → topic-hash drift. `SwapRouterUpdated` renamed to `SimpleSwapRouterUpdated` (impl line 108). No `override` keyword used on any function. `SlippageExceeded` never emitted. |
| `ISwapManagerForModules` | `interfaces/ISwapManagerForModules.sol:4` | `SwapManager` implicitly | `LiquidityManager` (via `ISwapManagerForModules(swapManager)`) | **IMPLICIT** | `SwapManager` (`SwapManager.sol:18`) does NOT declare `ISwapManagerForModules` in its inheritance list. Selectors `performSwap`, `performSwapAuto`, `validateSwapParameters` all present (lines 265, 343, 736) — no compile-time enforcement. |
| `ITokenManagerForModules` | `interfaces/ITokenManagerForModules.sol:4` | `TokenManager` implicitly (`TokenManager.sol:17`, `is Ownable`, does NOT inherit) | `Liquiditymanager`, `EmergencyHandler`, `ValueCalculator`, `ProxyGeneral._resolveTokenAddress`, `SwapManager` | **IMPLICIT** | Not inherited. Consumers rely on selector match. Risk: any rename to `TokenManager.getTokenAddress`, `getTokenPrice`, etc. silently breaks callers. |
| `IValueCalculatorForModules` | `interfaces/IValueCalculatorForModules.sol:4` | `ValueCalculator` implicitly (`ValueCalculator.sol:17`, `is Ownable`) | `Liquiditymanager`, `EmergencyHandler`, `ProxyGeneral.getPoolStatistics()` (indirectly) | **IMPLICIT** | Not inherited. |
| `IProtocolManager` | `interfaces/IProtocolManager.sol:19` | `ProtocolManager` (`ProtocolManager.sol:55`, `is Ownable`, does NOT inherit) | Very few typed casts | **IMPLICIT + PARTIAL** | Not inherited. Interface declares `getAllProtocolsValue`, `getProtocolPositionBreakdown` — verify against impl. Many extras in impl. |
| `IProtocolAdapter` | `interfaces/IProtocolAdapter.sol:25` | `AaveV3Plugin`, `EulerV2Plugin` (via `IEulerV2Plugin`), `MorphoPlugin` (via `IMorphoPlugin`), `MorphoVaultPlugin` (`MorphoVaultPlugin.sol:54`, `is IProtocolAdapter, Ownable, ReentrancyGuard`) | `ProtocolManager`, `LensAdapters` | **PARTIAL** | Return-name drift on `closePositionsForBaseAsset` (`baseAssetObtained` → `obtained`) in EulerV2Plugin and both Morpho plugins. Interface events `PositionOpened`, `PositionLiquidated`, `CircuitBreakerActivated`, `Deposited`, `Withdrawn` never emitted by most implementations. |
| `IProtocolAdapter.Position` / `.ProtocolSummary` structs | `IProtocolAdapter.sol:54,70` | Duplicated in `ILensAdapter.Position` / `ProtocolSummary` (`ILensAdapter.sol:46,62`) | Both — dual definitions | **DRIFT** | Two independent struct definitions for `Position` exist across `IProtocolAdapter` (line 54) and `ILensAdapter` (line 46). Fields overlap but any future divergence will silently misalign. |
| `ILendingProtocol` | `interfaces/ILendingProtocol.sol:24` | Nothing explicitly inherits it | `ProtocolManager.sol:8,320,351,402,414` casts plugins to `ILendingProtocol` at runtime | **IMPLICIT + BROKEN for Morpho** | `MorphoPlugin` implements `borrow(string,string,uint256)` (`MorphoPlugin.sol:340`), NOT `borrow(string,uint256)`. `ProtocolManager.borrow` calls `ILendingProtocol(plugin).borrow(tokenCode, amount)` (line 320) — for `plugin==MorphoPlugin`, the selector `borrow(string,uint256)` does not exist and the call reverts. Same for `repay`, `getDebt`, `getHealthFactor`. |
| `ILensAdapter` | `interfaces/ILensAdapter.sol:28` | `AaveV3LensAdapter` (`AaveV3LensAdapter.sol:41`), `EulerLensAdapter` (`EulerLensAdapter.sol:59`, dual `IEulerLensAdapter, ILensAdapter`), `MorphoLensAdapter` (`MorphoLensAdapter.sol:41`), `MorphoVaultLensAdapter` (`MorphoVaultLensAdapter.sol:43`) | `ValueCalculator`, `LiquidityManager`, `ProtocolManager` | **PARTIAL** | Events `HealthChecked`, `RiskAlertTriggered` (interface lines 306-307) never emitted anywhere → dead surface. Mutability drift: several implementations mark `protocolType`, `getYieldInfo`, `getNetAPY`, `getPositionsAtRisk`, `getProtocolLimits`, `estimatePositionAfterSwap` as `pure` where interface says `view`. `EulerLensAdapter` is missing `override` on 4 functions (189, 200, 875, 882). |
| `IAaveV3Plugin` | `interfaces/IAaveV3Plugin.sol:32` | `AaveV3Plugin` (`AaveV3Plugin.sol:57`, `is IAaveV3Plugin, IFlashLoanCallback, Ownable, ReentrancyGuard`) | `ProtocolManager` casts via `ILendingProtocol` (not `IAaveV3Plugin`) | **OK** | Every interface function present with `override`. Events `Borrowed`/`Repaid` emitted with 3 args, matches interface. |
| `IAaveV3Registry` | `interfaces/IAaveV3Registry.sol:13` | `AaveV3Registry` (`AaveV3Registry.sol:27`, `is IAaveV3Registry, Ownable`) | `AaveV3Plugin`, `AaveV3LensAdapter` | **PARTIAL** | Error `TokenAlreadyConfigured` (interface line 34) is declared but never reverted (impl is idempotent on re-configuration). Errors `InvalidAddress` / `TokenNotConfigured` shadowed by local redeclarations in `AaveV3Plugin.sol:121,123`. |
| `IEulerV2Plugin` | `interfaces/IEulerV2Plugin.sol:36` | `EulerV2Plugin` (`plugins/EulerV2Plugin.sol:101`, `is IEulerV2Plugin, IFlashLoanCallback, Ownable, ReentrancyGuard`) | `EulerLensAdapter`, `ProtocolManager` | **PARTIAL** | `closePosition(string,string)` at `EulerV2Plugin.sol:482` is missing the `override` keyword. Struct `LeveragePosition` (interface line 45) and `OpenLeverageParams` (`IEulerV2PluginSpecific.sol:30`) are declared but the plugin uses its own private `OpenLeverageAtomicParams` (line 685). |
| `IEulerV2PluginSpecific` | `interfaces/IEulerV2PluginSpecific.sol:16` | `EulerV2Plugin` (via inheritance of `IEulerV2Plugin`) | Same | **PARTIAL** | Events `LeveragePositionOpened` / `LeveragePositionClosed` (interface lines 42, 49) never emitted — plugin emits its own `LeverageOpenedAtomic` / `LeverageClosedAtomic` instead. |
| `IEulerRegistry` | `interfaces/IEulerRegistry.sol:9` | `EulerRegistry` (`plugins/EulerRegistry.sol:24`, `is Ownable`) does NOT inherit | Consumers cast implicitly | **IMPLICIT** | Contract declaration lacks `IEulerRegistry` — no compile-time enforcement of any of the 18 interface methods. Return-name drift on `isRegistered`, `hasActivePositionForPair`. Interface has no events; impl declares many. |
| `IEulerLensAdapter` | `interfaces/IEulerLensAdapter.sol:25` | `EulerLensAdapter` (`adapters/EulerLensAdapter.sol:59`, dual with `ILensAdapter`) | `ValueCalculator`, `LiquidityManager`, protocol scripts | **PARTIAL** | `IEulerLensAdapter.PositionValues` / `LiquidationStatus` structs are declared but never returned (`getEulerPositionValues` returns 3 raw uints, `EulerLensAdapter.sol:361`). |
| `IMorphoPlugin` | `interfaces/IMorphoPlugin.sol:36` | `MorphoPlugin` (`plugins/MorphoPlugin.sol:61`, `is IMorphoPlugin, IFlashLoanCallback, Ownable, ReentrancyGuard`) | `ProtocolManager` casts via `ILendingProtocol` (wrong — signature mismatch) | **PARTIAL** | `borrow`, `repay`, `getDebt`, `getHealthFactor` all take TWO string params — incompatible with `ILendingProtocol.borrow(string,uint256)` used by `ProtocolManager.sol:320`. Local error redeclarations shadow registry errors. |
| `IMorphoRegistry` | `interfaces/IMorphoRegistry.sol:21` | `MorphoRegistry` (`plugins/MorphoRegistry.sol:28`, `is IMorphoRegistry, Ownable`) | `MorphoPlugin`, `MorphoVaultPlugin`, `MorphoLensAdapter` | **PARTIAL** | Event `MarketRemoved` declared (interface line 47) but no `removeMarket()` function exists → dead event. Error `MarketAlreadyConfigured` (line 60) declared but never reverted — impl silently overwrites. `setDefaultVault` allows selecting an approved+active vault but subsequent status-flip is not re-verified in the deposit path. |
| `IFlashLoanCallback` | `interfaces/IFlashLoanCallback.sol:24` | `AaveV3Plugin.onFlashLoanReceived`, `EulerV2Plugin.onFlashLoanReceived`, `MorphoPlugin.onFlashLoanReceived` | `FlashLoanService.receiveFlashLoan` (`services/FlashLoanService.sol:204`) | **OK** | Interface function present with `override` on all three plugins. |
| `ISwapPlugin` (extends `ISimpleSwap`) | `interfaces/ISwapPlugin.sol:27` | `UniswapV3Plugin` (`plugins/UniswapV3Plugin.sol:14`), `UniswapV3PluginDirect` (`plugins/UniswapV3PluginDirect.sol:21`) | `SwapManager` | **PARTIAL** | Mutability drift on `supportsTokenPair`, `isHealthy` (`pure` vs `view`). Events `ConfigurationUpdated`, `HealthStatusChanged` never emitted. `UniswapV3Plugin.getExpectedOutput` overload (3 args) not in interface. **Behavioral drift**: `UniswapV3Plugin.inputSwap` pulls tokens from `msg.sender` (line 59), `UniswapV3PluginDirect.inputSwap` pulls from `proxyGeneral` (line 132) — incompatible custody assumptions. |
| `ISimpleSwap` | `interfaces/ISimpleSwap.sol:9` | Same two plugins above; `mocks/MockSimpleSwap.sol` | `SwapManager` for legacy path | **OK** | 3 functions each present. |
| `IOracleAdapter` | `interfaces/IOracleAdapter.sol:21` | `ChainlinkAdapter` (`adapters/ChainlinkAdapter.sol:21`), `mocks/MockOracleAdapter.sol:25` | `TokenManager` | **OK** | Errors `TokenNotSupported`, `InvalidPrice`, `StalePrice`, `OracleCallFailed` and event `PriceRetrieved` all declared. Verify emission coverage in ChainlinkAdapter. |
| `IUniswapV3Pool` | `interfaces/IUniswapV3Pool.sol:8` | External / on-chain contract | `ChainlinkAdapter` (if any TWAP), plugins | **EXTERNAL** | Interface for third-party contracts, not implemented in-tree. |
| `IUniswapV3QuoterV2` | `interfaces/IUniswapV3QuoterV2.sol:9` | External | `UniswapV3PluginDirect` | **EXTERNAL** | Same. |
| `IUniswapV3Router` | `interfaces/IUniswapV3Router.sol:9` | External | `UniswapV3PluginDirect` | **EXTERNAL** | Same. |
| `IWETH` | `interfaces/IWETH.sol:4` | External WETH; `contracts/MockWETH.sol` for tests | Some plugins | **EXTERNAL** | Not implemented in-tree by a production contract. |

## Sub-directory interfaces

### `interfaces/aave/`

| Interface | File:line | Type | Notes |
|---|---|---|---|
| `IAaveV3Pool` | `aave/IAaveV3Pool.sol:12` | Third-party (Aave Pool on Arbitrum) | Used by `AaveV3Plugin`, `AaveV3LensAdapter`. Not implemented in-tree. |

### `interfaces/balancer/`

| Interface | File:line | Type | Notes |
|---|---|---|---|
| `IFlashLoanRecipient` | `balancer/IBalancerVault.sol:11` | Implemented by `FlashLoanService` (`services/FlashLoanService.sol:45`) | OK. |
| `IBalancerVault` | `balancer/IBalancerVault.sol:46` | Third-party (Balancer V2 Vault) | Used by `FlashLoanService`. |

### `interfaces/euler/`

| Interface | File:line | Type | Notes |
|---|---|---|---|
| `IAccountLens` | `euler/IAccountLens.sol:14` | Third-party (Euler AccountLens on Arbitrum) | Used by `EulerLensAdapter`. |
| `IEVault` | `euler/IEVault.sol:17` | Third-party (Euler EVK) | Used by plugin + lens + registry. |
| `IEVC` | `euler/IEVC.sol:23` | Third-party (Ethereum Vault Connector) | Used by `EulerV2Plugin`. |
| `IEulerVaultRegistry` | `euler/IEulerVaultRegistry.sol:9` | **Duplicate** — signatures mostly overlap with root `IEulerRegistry` (`interfaces/IEulerRegistry.sol`). Neither is inherited by `EulerRegistry`. | **DUPLICATION**: two competing "vault registry" interfaces for the same Euler concept. `IEulerVaultRegistry` has `getRegisteredCount()`, while `IEulerRegistry` doesn't (has `getAllVaults()` + position-management additions). Consumers must know which to import; risk of drift over time. Currently no in-tree cast to `IEulerVaultRegistry` — treat as **LEGACY**. |
| `ISwapper` / `ISwapVerifier` | `euler/ISwapper.sol:29,135` | Third-party (Euler evk-periphery) | Used by `EulerV2Plugin` for leverage swaps. |

### `interfaces/morpho/`

| Interface | File:line | Type | Notes |
|---|---|---|---|
| `IMorpho` | `morpho/IMorpho.sol:36` | Third-party (Morpho Blue singleton) | Used by `MorphoPlugin`, `MorphoLensAdapter`. Includes shared `MarketParams`, `Id`, `Position`, `Market` structs. |
| `IMorphoOracle` | `morpho/IMorpho.sol:143` | Third-party oracle wrapper | Used by lens for HF computation. |
| `IERC4626` | `morpho/IERC4626.sol:8` | Standard (used for MetaMorpho vaults) | Used by `MorphoVaultPlugin`, `MorphoVaultLensAdapter`. |

Note: the codebase has **two independent `Position` struct definitions**:
- Solidity native `Position` in `interfaces/morpho/IMorpho.sol:17` (Morpho on-chain layout: `{supplyShares, borrowShares, collateral}`).
- Aggregator `Position` in `interfaces/IProtocolAdapter.sol:54` and `interfaces/ILensAdapter.sol:46`.
These live in separate scopes (no compile clash) but any file importing both must fully-qualify.

---

## Interfaces without any in-tree implementation (ORPHAN or LEGACY)

| Interface | Status | Rationale |
|---|---|---|
| `ILendingProtocol` | **LEGACY / MIS-USED** | Only casts (never inherited). Callers assume signatures that Morpho does not satisfy — see IFC-014. |
| `IEulerVaultRegistry` | **LEGACY** | Overlaps with root `IEulerRegistry`; no code casts to it. |
| `IParameterManagerForModules.isPaused` | **UNIMPLEMENTED SURFACE** | Method declared but no impl. |

---

## Ambiguity — `IProtocolAdapter` vs `ILendingProtocol`

Both interfaces cover "protocol plugin" but the codebase actually uses **`IProtocolAdapter` as the true north**:
- `AaveV3Plugin`, `EulerV2Plugin`, `MorphoPlugin`, `MorphoVaultPlugin` inherit `IProtocolAdapter` (directly or via `IAaveV3Plugin` / `IEulerV2Plugin` / `IMorphoPlugin`).
- `ILendingProtocol` is only used as a **runtime cast** inside `ProtocolManager` for lending-specific ops (`borrow`, `repay`, `getDebt`, `getHealthFactor`).
- `ILendingProtocol` extends `IProtocolManager` (line 24), a THIRD interface at the same level → `deposit/withdraw/getBalance/getTotalValue/getProtocolInfo/getAllProtocolsValue/getProtocolPositionBreakdown`. None of the plugins inherit `IProtocolManager` — so those inherited selectors are also unavailable on the plugin instances the manager casts to `ILendingProtocol(plugin)`.

Recommendation for the audit doc `08-cross-contract-consistency.md`: consolidate to `IProtocolAdapter` + optional `ILendingActions` (borrow/repay/getDebt/getHealthFactor/getBorrowCapacity) that Morpho does NOT satisfy (its variants take 2 tokenCodes), or add a Morpho-aware branch in `ProtocolManager`.

---

## `IParameterManager` vs `IParameterManagerForModules`

- `IParameterManager` is the **admin surface**: propose/execute/cancel with `bytes`-encoded values, batch operations, timelock, history, typed getters (uint/bool/address/string). Implemented by `ParameterManager` (`ParameterManager.sol:14, is IParameterManager`).
- `IParameterManagerForModules` is the **read-only cross-module surface**: `getCurrentParameterValue(string)` returning `uint256`, and `isPaused()`. Meant for `LiquidityManager` / `TokenManager` to avoid dragging the whole admin ABI into their imports.
- **NOT** a strict subset — `getCurrentParameterValue(string)` is not in `IParameterManager` (which only has `getParameter(string) returns (bytes)` and `getUintParameter(string)`).
- **Coherency gap**: `getUintParameter` and `getCurrentParameterValue` do the same thing but only the latter is exposed to modules. And `isPaused()` on `IParameterManagerForModules` has no `ParameterManager` implementation. See IFC-007.

---

## Contracts NOT inheriting the interface they de-facto implement

These contracts have a matching interface in `interfaces/` but their contract declaration does **not** list the interface in the inheritance chain, meaning the compiler does not verify conformance:

| Contract | File:line | Interface | Casts |
|---|---|---|---|
| `Beacon` | `Beacon.sol:9` | `IBeacon` | Every module casts `IBeacon(beacon)` |
| `ProxyGeneral` | `ProxyGeneral.sol:18` | `IProxyGeneral` | 500+ casts across managers |
| `ProtocolManager` | `ProtocolManager.sol:55` | `IProtocolManager` | Rarely cast |
| `TokenManager` | `TokenManager.sol:17` | `ITokenManagerForModules` | Many |
| `ValueCalculator` | `ValueCalculator.sol:17` | `IValueCalculatorForModules` | Many |
| `ParameterManager` | `ParameterManager.sol:14` | `IParameterManagerForModules` (only) — it inherits `IParameterManager` but NOT the modules variant | `Liquiditymanager.sol:132,250` |
| `EulerRegistry` | `plugins/EulerRegistry.sol:24` | `IEulerRegistry` | Direct plugin usage |

Adding these inheritances is a low-risk mechanical change and would catch all signature/return-name/mutability drift at compile time.
