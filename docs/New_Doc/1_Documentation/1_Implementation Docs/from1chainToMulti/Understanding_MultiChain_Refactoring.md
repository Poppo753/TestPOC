# Understanding the Multi-Chain Refactoring (from1chainToMulti)

## 1. What This Refactoring Does and Why

The codebase currently has protocol contract addresses (e.g., Aave V3 Pool, Euler EVC, Morpho Blue) **baked in as Solidity `constant` variables**. A `constant` is compiled directly into the bytecode — it cannot change after deployment. This means:

- The same compiled bytecode can **only ever work on one chain** (the one whose addresses were hardcoded).
- Deploying to a different chain (Ethereum mainnet, Base, Optimism) requires **recompiling every affected contract** with new addresses.
- There is no way to deploy a second instance on the same chain (e.g., a staging environment pointing at a different Aave fork).

The refactoring moves all protocol addresses from `constant` variables to **constructor parameters stored as `immutable` state variables**. An `immutable` is set once in the constructor and baked into bytecode, but its value is **provided at deploy time**, not at compile time. The result:

- One compiled artifact works on any chain.
- The deployment script selects which addresses to pass based on the target chain.
- No recompilation required for new networks.

---

## 2. The Pattern: `constant` → `immutable` + Constructor Parameter

### Before (chain-locked)
```solidity
// ❌ Hardcoded — only works on Arbitrum
address public constant AAVE_POOL_ADDRESS = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;

constructor(address _beacon, string memory _baseAssetCode) Ownable() {
    aavePool = IAaveV3Pool(AAVE_POOL_ADDRESS);  // constant used
}
```

### After (chain-agnostic)
```solidity
// ✅ Injected at deploy time — works on any chain
IAaveV3Pool public immutable aavePool;

constructor(address _beacon, string memory _baseAssetCode, address _aavePool) Ownable() {
    aavePool = IAaveV3Pool(_aavePool);  // caller provides address
}
```

**Key properties of `immutable`:**
- Value is set in the constructor (once, forever).
- Stored directly in bytecode (gas-efficient, like `constant`).
- Accessible as a public variable from outside (tests, scripts).
- Can be validated: `if (_aavePool == address(0)) revert InvalidAddress();`

---

## 3. Contracts Affected: Full Inventory

### 3.1 `contracts/plugins/AaveV3Plugin.sol`

| What | Before | After |
|------|--------|-------|
| Chain-specific state | `address public constant AAVE_POOL_ADDRESS = 0x794a...` | **Removed** |
| Immutable | `IAaveV3Pool public immutable aavePool` | Kept (already existed) |
| Constructor signature | `(address _beacon, string memory _baseAssetCode)` | `(address _beacon, string memory _baseAssetCode, address _aavePool)` |
| Constructor body | `aavePool = IAaveV3Pool(AAVE_POOL_ADDRESS)` | `aavePool = IAaveV3Pool(_aavePool)` |

Constants that **stay** (not chain-specific protocol addresses):
- `uint256 public constant VARIABLE_RATE_MODE = 2`
- `uint256 public constant MIN_HEALTH_FACTOR = 1.05e18`

---

### 3.2 `contracts/adapters/AaveV3LensAdapter.sol`

| What | Before | After |
|------|--------|-------|
| Chain-specific state | `address public constant AAVE_POOL = 0x794a...` | **Removed** |
| Immutable | *(did not exist)* | `IAaveV3Pool public immutable aavePool` (new) |
| Constructor signature | `(address _beacon, string memory _baseAssetCode)` | `(address _beacon, string memory _baseAssetCode, address _aavePool)` |
| Constructor body | *(nothing)* | `aavePool = IAaveV3Pool(_aavePool)` |
| Usages in functions | `IAaveV3Pool(AAVE_POOL).getUserAccountData(...)` × 12 | `aavePool.getUserAccountData(...)` × 12 |

Constants that **stay**:
- `uint256 public constant DEFAULT_SAFE_HEALTH_FACTOR = 1.5e18`

> **Note:** The `AAVE_POOL` constant was used in 12 call sites across the adapter. All of these become `aavePool` (the immutable). The function bodies do not need `IAaveV3Pool(...)` casts anymore since `aavePool` is already typed.

---

### 3.3 `contracts/plugins/EulerV2Plugin.sol`

| What | Before | After |
|------|--------|-------|
| Chain-specific state | `address public constant EVC_ADDRESS = 0x6302...` | **Removed** |
| Chain-specific state | `address public constant ACCOUNT_LENS_ADDRESS = 0x90a5...` | **Removed** |
| Immutable (EVC) | `IEVC public immutable evc` | Kept (already existed) |
| Immutable (AccountLens) | *(did not exist)* | `address public immutable accountLensAddress` (new) |
| Constructor signature | `(address _beacon, string memory _baseAssetCode)` | `(address _beacon, string memory _baseAssetCode, address _evcAddress, address _accountLensAddress)` |
| Constructor body | `evc = IEVC(EVC_ADDRESS)` | `evc = IEVC(_evcAddress)` |
| Constructor body | *(nothing for ACCOUNT_LENS)* | `accountLensAddress = _accountLensAddress` |
| Usages of `ACCOUNT_LENS_ADDRESS` | inline constant | → `accountLensAddress` |

---

### 3.4 `contracts/adapters/EulerLensAdapter.sol`

| What | Before | After |
|------|--------|-------|
| `address public constant ACCOUNT_LENS = 0x90a5...` | **Removed** | `address public immutable accountLens` |
| `address public constant VAULT_LENS = 0xc99F...` | **Removed** | `address public immutable vaultLens` |
| `address public constant UTILS_LENS = 0xDAf4...` | **Removed** | `address public immutable utilsLens` |
| `address public constant EVC_ADDRESS = 0x6302...` | **Removed** | `address public immutable evcAddress` |
| Constructor signature | `(address _beacon, string memory _baseAssetCode)` | `(address _beacon, string memory _baseAssetCode, address _accountLens, address _vaultLens, address _utilsLens, address _evcAddress)` |
| Constructor body | *(nothing for these addresses)* | Sets all 4 immutables |

Constants that **stay** (semantic values, not addresses):
- `uint256 public constant TTL_LIQUIDATION`
- `uint256 public constant TTL_INFINITY`
- `uint256 public constant TTL_MORE_THAN_ONE_YEAR`
- `uint256 public constant TTL_ERROR`
- `uint256 public constant DEFAULT_SAFE_HEALTH_FACTOR`

---

### 3.5 `contracts/plugins/MorphoPlugin.sol`

| What | Before | After |
|------|--------|-------|
| Chain-specific state | `address public constant MORPHO_ADDRESS = 0x6c24...` | **Removed** |
| Immutable | `IMorpho public immutable morpho` | Kept (already existed) |
| Constructor signature | `(address _beacon, string memory _baseAssetCode)` | `(address _beacon, string memory _baseAssetCode, address _morphoAddress)` |
| Constructor body | `morpho = IMorpho(MORPHO_ADDRESS)` | `morpho = IMorpho(_morphoAddress)` |

Constants that **stay**:
- `uint256 public constant ORACLE_PRICE_SCALE = 1e36`
- `uint256 public constant WAD = 1e18`
- `uint256 public constant MIN_HEALTH_FACTOR = 1.05e18`

---

### 3.6 `contracts/adapters/MorphoLensAdapter.sol`

| What | Before | After |
|------|--------|-------|
| Chain-specific state | `address public constant MORPHO = 0x6c24...` | **Removed** |
| Immutable | *(did not exist)* | `address public immutable morpho` (new) |
| Constructor signature | `(address _beacon, string memory _baseAssetCode)` | `(address _beacon, string memory _baseAssetCode, address _morphoAddress)` |
| Constructor body | *(nothing)* | `morpho = _morphoAddress` |
| `_getMorpho()` | `private pure returns (IMorpho)` → `return IMorpho(MORPHO)` | `private view returns (IMorpho)` → `return IMorpho(morpho)` |

Constants that **stay**:
- `uint256 public constant ORACLE_PRICE_SCALE`
- `uint256 public constant WAD`
- `uint256 public constant DEFAULT_SAFE_HEALTH_FACTOR`

---

## 4. Contracts NOT Affected

These contracts have no chain-specific hardcoded addresses and require **no changes**:

- `contracts/plugins/MorphoVaultPlugin.sol` — addresses come from registry/beacon
- `contracts/adapters/MorphoVaultLensAdapter.sol` — no protocol addresses
- `contracts/adapters/AaveV3Registry.sol` — stores user-configured data
- `contracts/Beacon.sol` — pure registry
- `contracts/ProtocolManager.sol`, `LiquidityManager.sol`, etc. — no protocol addresses
- All interfaces (`contracts/interfaces/`)
- `contracts/oracle/ChainlinkAdapter.sol` — feed addresses are configured externally

---

## 5. Impact on Tests

### 5.1 Unit Tests: `test/unit/LensAdapters.test.ts`

Every `beforeEach` that deploys an adapter now needs the extra address argument(s):

| Adapter | Old deploy | New deploy |
|---------|-----------|-----------|
| `AaveV3LensAdapter` | `Factory.deploy(beacon, "WETH")` | `Factory.deploy(beacon, "WETH", AAVE_POOL)` |
| `EulerLensAdapter` | `Factory.deploy(beacon, "WETH")` | `Factory.deploy(beacon, "WETH", ACCOUNT_LENS, VAULT_LENS, UTILS_LENS, EVC)` |
| `MorphoLensAdapter` | `Factory.deploy(beacon, "WETH")` | `Factory.deploy(beacon, "WETH", MORPHO)` |

Additionally, the existing test:
```typescript
it("AAVE_POOL constant should be correct", async function () {
    expect(await adapter.AAVE_POOL()).to.equal("0x794a61358D6845594F94dc1DB02A252b5b4814aD");
});
```
This test must be **removed** (the `AAVE_POOL` constant no longer exists). Optionally, replace with a test that verifies the injected immutable value:
```typescript
it("aavePool immutable should match injected address", async function () {
    expect(await adapter.aavePool()).to.equal(ARBITRUM_AAVE_POOL);
});
```

### 5.2 E2E Tests (Fork — Arbitrum mainnet)

All these files deploy against a fork and use real Arbitrum addresses:

| File | Contracts requiring new args |
|------|------------------------------|
| `test/e2e/USDC.BaseAsset.e2e.test.ts` | `AaveV3Plugin.deploy(beacon, "USDC", AAVE_POOL)`, `AaveV3LensAdapter.deploy(beacon, "USDC", AAVE_POOL)` |
| `test/e2e/WETH.BaseAsset.e2e.test.ts` | Same pattern with "WETH" |
| `test/e2e/WBTC.BaseAsset.e2e.test.ts` | Same pattern with "WBTC" |
| `test/e2e/USDT.BaseAsset.e2e.test.ts` | Same pattern with "USDT" |
| `test/e2e/Euler.USDC.e2e.test.ts` | `EulerV2Plugin.deploy(beacon, "USDC", EVC, ACCOUNT_LENS)`, `EulerLensAdapter.deploy(beacon, "USDC", ACCOUNT_LENS, VAULT_LENS, UTILS_LENS, EVC)` |
| `test/e2e/Morpho.WETH.e2e.test.ts` | `MorphoPlugin.deploy(beacon, "WETH", MORPHO)`, `MorphoLensAdapter.deploy(beacon, "WETH", MORPHO)` |
| `test/e2e/MorphoVault.USDC.e2e.test.ts` | **No change** (MorphoVaultPlugin unaffected) |

### 5.3 Integration Tests

| File | Change needed |
|------|---------------|
| `test/integration/ProtocolManager.euler.test.ts` | `EulerPluginFactory.deploy(beacon)` → `EulerPluginFactory.deploy(beacon, "USDC", EVC, ACCOUNT_LENS)` *(note: currently passes only 1 arg — must also add baseAssetCode)* |
| `test/integration/MorphoPlugin.fork.test.ts` | `MorphoPlugin.deploy(beacon, baseAsset)` → `MorphoPlugin.deploy(beacon, baseAsset, MORPHO)`, same for adapter |
| `test/integration/MorphoVaultPlugin.fork.test.ts` | **No change** |

---

## 6. Impact on Deploy Scripts

### Primary deploy scripts (canonical):

| Script | Change needed |
|--------|---------------|
| `scripts/deploy-aave-v3-plugin.ts` | Already has `AAVE_POOL` const defined. Update: `PluginFactory.deploy(BEACON, BASE_ASSET_CODE, AAVE_POOL)`, `AdapterFactory.deploy(BEACON, BASE_ASSET_CODE, AAVE_POOL)` |
| `scripts/deploy-euler-plugin.ts` | Add EVC/AccountLens consts; update deploy call |
| `scripts/deploy-morpho-plugin.ts` | Already has `MORPHO_ADDRESS` const. Update: `PluginFactory.deploy(BEACON, BASE_ASSET_CODE, MORPHO_ADDRESS)`, `AdapterFactory.deploy(BEACON, BASE_ASSET_CODE, MORPHO_ADDRESS)` |

### Euler-specific deployment scripts (all in `scripts/deployment/euler/`):

| Script | Change needed |
|--------|---------------|
| `deploy-euler-plugin.ts` | Add EVC + AccountLens to `EulerV2Plugin.deploy(...)` |
| `deploy-euler-lens.ts` | Add 4 address args to `EulerLensAdapter.deploy(...)` |
| `simulate-full-deploy.ts` | Both plugin and adapter |
| `upgrade-euler-plugin.ts` | Plugin deploy args |

### Other scripts:

| Script | Change needed |
|--------|---------------|
| `scripts/testing/redeploy-euler-ecosystem.ts` | `EulerLensAdapter.deploy(...)` and `EulerV2Plugin.deploy(...)` |
| `scripts/redeploy-morpho-fixed.ts` | `MorphoPlugin.deploy(...)` and `MorphoLensAdapter.deploy(...)` |
| `scripts/redeploy-aave3-flashloan.ts` | `AaveV3Plugin.deploy(...)` — likely needs AAVE_POOL arg |
| `scripts/deployment/deployModules.mainnet.ts` | **No change** (only deploys core modules, not plugins) |
| `scripts/deployment/deployAll.mainnet.ts` | Check if plugins are deployed here |

---

## 7. Protocol Addresses Reference

### Arbitrum Mainnet (chainId: 42161) — Current Environment

```
Aave V3 Pool:           0x794a61358D6845594F94dc1DB02A252b5b4814aD
Euler EVC:              0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066
Euler AccountLens:      0x90a52DDcb232e7bb003DD9258fA1235c553eC956
Euler VaultLens:        0xc99FCEE6174Bc92eBe9C78690fFD5067018a8380
Euler UtilsLens:        0xDAf44060DCe217Fd603908A49fcaa1FA900304BE
Morpho Blue:            0x6c247b1F6182318877311737BaC0844bAa518F5e
```

### Ethereum Mainnet (chainId: 1)

```
Aave V3 Pool:           0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2
Euler EVC:              0x0C9a3dd6b8F28529d72d7f9cE918D493519EE383
Morpho Blue:            0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb
```

### Base (chainId: 8453)

```
Aave V3 Pool:           0xA238Dd80C259a72e81d7e4664a9801593F98d1c5
```

### Optimism (chainId: 10)

```
Aave V3 Pool:           0x794a61358D6845594F94dc1DB02A252b5b4814aD  (same as Arbitrum)
```

> **Important:** Morpho Blue's canonical address `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` is NOT deployed on Arbitrum. Arbitrum uses a different deployment: `0x6c247b1F6182318877311737BaC0844bAa518F5e`.

---

## 8. Design Decisions and Trade-offs

### Why `immutable` and not a `setXxx()` setter function?

| Option | Pro | Con |
|--------|-----|-----|
| `constant` | Gas efficient, readable | Compile-time only, one chain per bytecode |
| `immutable` (chosen) | Gas efficient, deploy-time injection, one bytecode per chain | Cannot change after deploy (intentional) |
| Mutable `address public` with setter | Flexible | Centralization risk, storage slot, security attack surface |
| Read from Beacon | Fully dynamic | Gas overhead per call, extra coupling |

`immutable` is the correct trade-off: **security** (cannot be changed after deploy), **efficiency** (same gas as `constant`), and **flexibility** (value injected at deploy time).

### Why not store addresses in the Beacon?

The Beacon already stores module addresses (contracts owned by this system). Protocol addresses (Aave, Euler, Morpho) are **external third-party contracts** — putting them in the Beacon would blur the separation of concerns. Immutables in constructors make the dependency explicit and auditable.

### Constructor argument ordering convention

For consistency across all contracts, the new address arguments are appended **after** the existing arguments:
```
constructor(address _beacon, string memory _baseAssetCode, address _protocolAddress1, ...)
```
This ensures minimal disruption to callers that only need to add the new args at the end.

### Zero-address validation

Each contract should add a `require` / custom error check for the new address arguments:
```solidity
if (_aavePool == address(0)) revert InvalidAavePool();
```
This catches misconfiguration at deploy time rather than producing silent failures at runtime.

---

## 9. Summary of All Changes

| Contract | Remove | Add | Constructor args added |
|----------|--------|-----|----------------------|
| `AaveV3Plugin.sol` | `AAVE_POOL_ADDRESS` constant | — (immutable already exists) | `address _aavePool` |
| `AaveV3LensAdapter.sol` | `AAVE_POOL` constant | `IAaveV3Pool public immutable aavePool` | `address _aavePool` |
| `EulerV2Plugin.sol` | `EVC_ADDRESS`, `ACCOUNT_LENS_ADDRESS` constants | `address public immutable accountLensAddress` | `address _evcAddress, address _accountLensAddress` |
| `EulerLensAdapter.sol` | 4 address constants | 4 `address public immutable` fields | 4 address params |
| `MorphoPlugin.sol` | `MORPHO_ADDRESS` constant | — (immutable already exists) | `address _morphoAddress` |
| `MorphoLensAdapter.sol` | `MORPHO` constant | `address public immutable morpho` | `address _morphoAddress` |

**Total files requiring code changes:**
- Solidity contracts: **6**
- Unit test files: **1**
- E2E test files: **6** (of 7 — MorphoVault unaffected)
- Integration test files: **2** (of 3 — MorphoVault unaffected)
- Deploy scripts: **~10** (various)
