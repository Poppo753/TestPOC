# Implementation Checklist: from1chainToMulti Refactoring

> **How to use this checklist:**
> Work through each section in order. Mark each item `[x]` when done.
> After each contract, run `npx hardhat compile` to catch errors early.
> Full test suite at the very end.

---

## Prerequisites

- [ ] Read `Understanding_MultiChain_Refactoring.md` in this folder

---

## Phase 1 — Smart Contracts (6 files)

Work through contracts in this order. The order matters for mental bookkeeping but not for compilation.

---

### 1.1 `contracts/plugins/AaveV3Plugin.sol`

**Goal:** Remove `AAVE_POOL_ADDRESS` constant; add `address _aavePool` constructor param.

- [ ] **Find** the `AAVE_POOL_ADDRESS` constant line:
  ```solidity
  address public constant AAVE_POOL_ADDRESS = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;
  ```
  **Delete** this entire line.

- [ ] **Find** the existing immutable declaration (keep it, just verify it's there):
  ```solidity
  IAaveV3Pool public immutable aavePool;
  ```
  No change needed here.

- [ ] **Update** the constructor signature — add `address _aavePool` as the third parameter:
  ```solidity
  // Before:
  constructor(address _beacon, string memory _baseAssetCode) Ownable() {
  // After:
  constructor(address _beacon, string memory _baseAssetCode, address _aavePool) Ownable() {
  ```

- [ ] **Add** zero-address validation for the new parameter (inside constructor body, after existing checks):
  ```solidity
  if (_aavePool == address(0)) revert InvalidBeacon(); // or add a new error: InvalidAavePool()
  ```

- [ ] **Update** the line that initializes `aavePool` in the constructor body:
  ```solidity
  // Before:
  aavePool = IAaveV3Pool(AAVE_POOL_ADDRESS);
  // After:
  aavePool = IAaveV3Pool(_aavePool);
  ```

- [ ] **Compile check:**
  ```powershell
  npx hardhat compile
  ```
  Expected: 0 errors.

---

### 1.2 `contracts/adapters/AaveV3LensAdapter.sol`

**Goal:** Remove `AAVE_POOL` constant; add `IAaveV3Pool public immutable aavePool`; update all 12 call sites.

- [ ] **Find** and **delete** the constant:
  ```solidity
  address public constant AAVE_POOL = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;
  ```

- [ ] **Add** the immutable declaration in the STATE section (below `string public baseAssetCode`):
  ```solidity
  IAaveV3Pool public immutable aavePool;
  ```

- [ ] **Update** the constructor signature:
  ```solidity
  // Before:
  constructor(address _beacon, string memory _baseAssetCode) Ownable() {
  // After:
  constructor(address _beacon, string memory _baseAssetCode, address _aavePool) Ownable() {
  ```

- [ ] **Add** zero-address validation (inside constructor body):
  ```solidity
  if (_aavePool == address(0)) revert InvalidBeacon(); // reuse existing error or add new one
  ```

- [ ] **Add** initialization in constructor body:
  ```solidity
  aavePool = IAaveV3Pool(_aavePool);
  ```

- [ ] **Replace all 12 call sites** — find every occurrence of `IAaveV3Pool(AAVE_POOL)` and replace with `aavePool`:
  ```solidity
  // Before (appears 12 times):
  IAaveV3Pool(AAVE_POOL).getUserAccountData(plugin)
  IAaveV3Pool(AAVE_POOL).getReserveNormalizedIncome(underlying)
  IAaveV3Pool(AAVE_POOL).getReserveNormalizedVariableDebt(underlying)
  
  // After:
  aavePool.getUserAccountData(plugin)
  aavePool.getReserveNormalizedIncome(underlying)
  aavePool.getReserveNormalizedVariableDebt(underlying)
  ```
  
  > Tip: Use VS Code "Find & Replace" in file: search `IAaveV3Pool(AAVE_POOL)`, replace with `aavePool`.

- [ ] **Compile check:**
  ```powershell
  npx hardhat compile
  ```
  Expected: 0 errors.

---

### 1.3 `contracts/plugins/EulerV2Plugin.sol`

**Goal:** Remove `EVC_ADDRESS` and `ACCOUNT_LENS_ADDRESS` constants; add `accountLensAddress` immutable; update constructor.

- [ ] **Find** and **delete** both constants:
  ```solidity
  address public constant EVC_ADDRESS = 0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066;
  address public constant ACCOUNT_LENS_ADDRESS = 0x90a52DDcb232e7bb003DD9258fA1235c553eC956;
  ```

- [ ] **Verify** the existing EVC immutable is present (no change needed):
  ```solidity
  IEVC public immutable evc;
  ```

- [ ] **Add** the new AccountLens immutable in the STATE section (right after `evc`):
  ```solidity
  address public immutable accountLensAddress;
  ```

- [ ] **Update** the constructor signature — add two new parameters:
  ```solidity
  // Before:
  constructor(address _beacon, string memory _baseAssetCode) Ownable() {
  // After:
  constructor(address _beacon, string memory _baseAssetCode, address _evcAddress, address _accountLensAddress) Ownable() {
  ```

- [ ] **Add** zero-address validation for both new params inside constructor:
  ```solidity
  if (_evcAddress == address(0)) revert InvalidBeacon();        // or custom errors
  if (_accountLensAddress == address(0)) revert InvalidBeacon();
  ```

- [ ] **Update** the EVC initialization line:
  ```solidity
  // Before:
  evc = IEVC(EVC_ADDRESS);
  // After:
  evc = IEVC(_evcAddress);
  ```

- [ ] **Add** the AccountLens initialization in constructor body:
  ```solidity
  accountLensAddress = _accountLensAddress;
  ```

- [ ] **Search** the entire file for `ACCOUNT_LENS_ADDRESS` usages in function bodies and replace each with `accountLensAddress`:
  > Use VS Code Find in file: `ACCOUNT_LENS_ADDRESS` → `accountLensAddress`

- [ ] **Compile check:**
  ```powershell
  npx hardhat compile
  ```
  Expected: 0 errors.

---

### 1.4 `contracts/adapters/EulerLensAdapter.sol`

**Goal:** Remove 4 address constants; add 4 `address public immutable` fields; update constructor with 4 new params.

- [ ] **Find** and **delete** all 4 address constants:
  ```solidity
  address public constant ACCOUNT_LENS = 0x90a52DDcb232e7bb003DD9258fA1235c553eC956;
  address public constant VAULT_LENS = 0xc99FCEE6174Bc92eBe9C78690fFD5067018a8380;
  address public constant UTILS_LENS = 0xDAf44060DCe217Fd603908A49fcaa1FA900304BE;
  address public constant EVC_ADDRESS = 0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066;
  ```
  > Keep all non-address constants (`TTL_*`, `DEFAULT_SAFE_HEALTH_FACTOR`) — those are NOT chain-specific.

- [ ] **Add** 4 immutable declarations in the STATE section (below `string public baseAssetCode`):
  ```solidity
  address public immutable accountLens;
  address public immutable vaultLens;
  address public immutable utilsLens;
  address public immutable evcAddress;
  ```

- [ ] **Update** the constructor signature — add 4 new parameters:
  ```solidity
  // Before:
  constructor(address _beacon, string memory _baseAssetCode) Ownable() {
  // After:
  constructor(
      address _beacon,
      string memory _baseAssetCode,
      address _accountLens,
      address _vaultLens,
      address _utilsLens,
      address _evcAddress
  ) Ownable() {
  ```

- [ ] **Add** zero-address validation for all 4 new params inside constructor:
  ```solidity
  if (_accountLens == address(0)) revert InvalidBeacon();
  if (_vaultLens == address(0)) revert InvalidBeacon();
  if (_utilsLens == address(0)) revert InvalidBeacon();
  if (_evcAddress == address(0)) revert InvalidBeacon();
  ```

- [ ] **Add** initialization in constructor body:
  ```solidity
  accountLens = _accountLens;
  vaultLens = _vaultLens;
  utilsLens = _utilsLens;
  evcAddress = _evcAddress;
  ```

- [ ] **Update all usages** in function bodies — the constants are used as:
  - `ACCOUNT_LENS` → `accountLens`
  - `VAULT_LENS` → `vaultLens`
  - `UTILS_LENS` → `utilsLens`
  - `EVC_ADDRESS` → `evcAddress`
  
  > Tip: Do 4 separate Find & Replace passes, one per constant name.

- [ ] **Compile check:**
  ```powershell
  npx hardhat compile
  ```
  Expected: 0 errors.

---

### 1.5 `contracts/plugins/MorphoPlugin.sol`

**Goal:** Remove `MORPHO_ADDRESS` constant; update constructor to inject it.

- [ ] **Find** and **delete** the constant:
  ```solidity
  address public constant MORPHO_ADDRESS = 0x6c247b1F6182318877311737BaC0844bAa518F5e;
  ```

- [ ] **Verify** the existing immutable (keep it):
  ```solidity
  IMorpho public immutable morpho;
  ```

- [ ] **Update** the constructor signature:
  ```solidity
  // Before:
  constructor(address _beacon, string memory _baseAssetCode) Ownable() {
  // After:
  constructor(address _beacon, string memory _baseAssetCode, address _morphoAddress) Ownable() {
  ```

- [ ] **Add** zero-address validation:
  ```solidity
  if (_morphoAddress == address(0)) revert InvalidBeacon();
  ```

- [ ] **Update** the initialization line:
  ```solidity
  // Before:
  morpho = IMorpho(MORPHO_ADDRESS);
  // After:
  morpho = IMorpho(_morphoAddress);
  ```

- [ ] **Compile check:**
  ```powershell
  npx hardhat compile
  ```
  Expected: 0 errors.

---

### 1.6 `contracts/adapters/MorphoLensAdapter.sol`

**Goal:** Remove `MORPHO` constant; add `address public immutable morpho`; fix `_getMorpho()` mutability.

- [ ] **Find** and **delete** the constant:
  ```solidity
  address public constant MORPHO = 0x6c247b1F6182318877311737BaC0844bAa518F5e;
  ```

- [ ] **Add** the immutable declaration in the STATE section:
  ```solidity
  address public immutable morpho;
  ```

- [ ] **Update** the constructor signature:
  ```solidity
  // Before:
  constructor(address _beacon, string memory _baseAssetCode) Ownable() {
  // After:
  constructor(address _beacon, string memory _baseAssetCode, address _morphoAddress) Ownable() {
  ```

- [ ] **Add** zero-address validation:
  ```solidity
  if (_morphoAddress == address(0)) revert InvalidBeacon();
  ```

- [ ] **Add** initialization in constructor body:
  ```solidity
  morpho = _morphoAddress;
  ```

- [ ] **Fix** the `_getMorpho()` helper — change from `pure` to `view` and update its body:
  ```solidity
  // Before:
  function _getMorpho() private pure returns (IMorpho) {
      return IMorpho(MORPHO);
  }
  // After:
  function _getMorpho() private view returns (IMorpho) {
      return IMorpho(morpho);
  }
  ```

- [ ] **Compile check:**
  ```powershell
  npx hardhat compile
  ```
  Expected: 0 errors.

---

### Phase 1 Final Compile Check

- [ ] Run full compilation to confirm no cross-contract issues:
  ```powershell
  npx hardhat compile
  ```
  Expected: All contracts compile, 0 errors, 0 critical warnings.

- [ ] Check for TypeChain regeneration (happens automatically during compile, but verify):
  ```powershell
  # Confirm typechain-types/ was updated (check modification timestamp)
  Get-Item typechain-types\factories\contracts\plugins\AaveV3Plugin__factory.ts | Select-Object LastWriteTime
  ```

---

## Phase 2 — Unit Tests

### 2.1 `test/unit/LensAdapters.test.ts`

#### Address constants to add at the top of the file (or near the top, after imports):
```typescript
// Arbitrum Mainnet protocol addresses (used for unit test deploys)
const ARBITRUM_AAVE_POOL    = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
const ARBITRUM_EVC          = "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066";
const ARBITRUM_ACCOUNT_LENS = "0x90a52DDcb232e7bb003DD9258fA1235c553eC956";
const ARBITRUM_VAULT_LENS   = "0xc99FCEE6174Bc92eBe9C78690fFD5067018a8380";
const ARBITRUM_UTILS_LENS   = "0xDAf44060DCe217Fd603908A49fcaa1FA900304BE";
const ARBITRUM_MORPHO       = "0x6c247b1F6182318877311737BaC0844bAa518F5e";
```

#### AaveV3LensAdapter section:

- [ ] **Update** `beforeEach` deploy call (add AAVE_POOL):
  ```typescript
  // Before:
  adapter = await Factory.deploy(await mockBeacon.getAddress(), "WETH");
  // After:
  adapter = await Factory.deploy(await mockBeacon.getAddress(), "WETH", ARBITRUM_AAVE_POOL);
  ```

- [ ] **Update** the zero-beacon revert test (add AAVE_POOL as third arg):
  ```typescript
  // Before:
  Factory.deploy(ethers.ZeroAddress, "WETH")
  // After:
  Factory.deploy(ethers.ZeroAddress, "WETH", ARBITRUM_AAVE_POOL)
  ```

- [ ] **Remove** the test checking the `AAVE_POOL` constant (it no longer exists as a constant):
  ```typescript
  // DELETE this entire test block:
  it("AAVE_POOL constant should be correct", async function () {
      expect(await adapter.AAVE_POOL()).to.equal("0x794a61358D6845594F94dc1DB02A252b5b4814aD");
  });
  ```

- [ ] **Optionally add** a replacement test verifying the immutable:
  ```typescript
  it("aavePool immutable should match injected address", async function () {
      expect(await adapter.aavePool()).to.equal(ARBITRUM_AAVE_POOL);
  });
  ```

#### EulerLensAdapter section:

- [ ] **Update** `beforeEach` deploy call (add 4 addresses):
  ```typescript
  // Before:
  adapter = await Factory.deploy(await mockBeacon.getAddress(), "WETH");
  // After:
  adapter = await Factory.deploy(
      await mockBeacon.getAddress(), "WETH",
      ARBITRUM_ACCOUNT_LENS, ARBITRUM_VAULT_LENS, ARBITRUM_UTILS_LENS, ARBITRUM_EVC
  );
  ```

- [ ] **Update** the zero-beacon revert test (add 4 address args):
  ```typescript
  // Before:
  Factory.deploy(ethers.ZeroAddress, "WETH")
  // After:
  Factory.deploy(ethers.ZeroAddress, "WETH", ARBITRUM_ACCOUNT_LENS, ARBITRUM_VAULT_LENS, ARBITRUM_UTILS_LENS, ARBITRUM_EVC)
  ```

#### MorphoLensAdapter section:

- [ ] **Update** `beforeEach` deploy call (add MORPHO):
  ```typescript
  // Before:
  adapter = await Factory.deploy(await mockBeacon.getAddress(), "WETH");
  // After:
  adapter = await Factory.deploy(await mockBeacon.getAddress(), "WETH", ARBITRUM_MORPHO);
  ```

- [ ] **Update** the zero-beacon revert test (add MORPHO as third arg):
  ```typescript
  // Before:
  Factory.deploy(ethers.ZeroAddress, "WETH")
  // After:
  Factory.deploy(ethers.ZeroAddress, "WETH", ARBITRUM_MORPHO)
  ```

#### Run unit tests:

- [ ] **Run the unit test to verify:**
  ```powershell
  $env:FORK_ENABLED="false"; npx hardhat test test/unit/LensAdapters.test.ts
  ```
  Expected: All tests pass (previously ~30 tests, now slightly fewer due to removed constant test, or same count if you added the replacement).

---

## Phase 3 — E2E Tests (Fork)

These tests run against an Arbitrum fork. The address constants are already defined inside each test file (or can be added). In each case, you're adding the extra argument(s) to the `deploy(...)` calls.

---

### 3.1 `test/e2e/USDC.BaseAsset.e2e.test.ts`

- [ ] **Find** the `AaveV3Plugin` deploy call and add `AAVE_POOL` arg:
  ```typescript
  // Find pattern (exact args may vary):
  await AaveV3PluginFactory.deploy(beaconAddr, "USDC")
  // Change to:
  await AaveV3PluginFactory.deploy(beaconAddr, "USDC", AAVE_V3_POOL)
  ```
  > `AAVE_V3_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD"` — add as a const at the top of the file if not already present.

- [ ] **Find** the `AaveV3LensAdapter` deploy call and add `AAVE_POOL` arg:
  ```typescript
  await AaveV3LensAdapterFactory.deploy(beaconAddr, "USDC", AAVE_V3_POOL)
  ```

### 3.2 `test/e2e/WETH.BaseAsset.e2e.test.ts`

- [ ] Same pattern as 3.1, with `"WETH"` as baseAssetCode.

### 3.3 `test/e2e/WBTC.BaseAsset.e2e.test.ts`

- [ ] Same pattern as 3.1, with `"WBTC"` as baseAssetCode.

### 3.4 `test/e2e/USDT.BaseAsset.e2e.test.ts`

- [ ] Same pattern as 3.1, with `"USDT"` as baseAssetCode.

---

### 3.5 `test/e2e/Euler.USDC.e2e.test.ts`

- [ ] **Add** address constants at top of file (if not present):
  ```typescript
  const EULER_EVC          = "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066";
  const EULER_ACCOUNT_LENS = "0x90a52DDcb232e7bb003DD9258fA1235c553eC956";
  const EULER_VAULT_LENS   = "0xc99FCEE6174Bc92eBe9C78690fFD5067018a8380";
  const EULER_UTILS_LENS   = "0xDAf44060DCe217Fd603908A49fcaa1FA900304BE";
  ```

- [ ] **Update** `EulerV2Plugin` deploy call:
  ```typescript
  // Before:
  await EulerV2PluginFactory.deploy(beaconAddr, "USDC")
  // After:
  await EulerV2PluginFactory.deploy(beaconAddr, "USDC", EULER_EVC, EULER_ACCOUNT_LENS)
  ```

- [ ] **Update** `EulerLensAdapter` deploy call:
  ```typescript
  // Before:
  await EulerLensAdapterFactory.deploy(beaconAddr, "USDC")
  // After:
  await EulerLensAdapterFactory.deploy(beaconAddr, "USDC", EULER_ACCOUNT_LENS, EULER_VAULT_LENS, EULER_UTILS_LENS, EULER_EVC)
  ```

---

### 3.6 `test/e2e/Morpho.WETH.e2e.test.ts`

- [ ] **Add** address constant at top of file (if not present):
  ```typescript
  const MORPHO_BLUE = "0x6c247b1F6182318877311737BaC0844bAa518F5e";
  ```

- [ ] **Update** `MorphoPlugin` deploy call:
  ```typescript
  // Before:
  await MorphoPluginFactory.deploy(beaconAddr, "WETH")
  // After:
  await MorphoPluginFactory.deploy(beaconAddr, "WETH", MORPHO_BLUE)
  ```

- [ ] **Update** `MorphoLensAdapter` deploy call:
  ```typescript
  // Before:
  await MorphoLensAdapterFactory.deploy(beaconAddr, "WETH")
  // After:
  await MorphoLensAdapterFactory.deploy(beaconAddr, "WETH", MORPHO_BLUE)
  ```

### 3.7 `test/e2e/MorphoVault.USDC.e2e.test.ts`

- [ ] **No changes required** — MorphoVaultPlugin has no hardcoded address constants.

---

### Run E2E Tests:

- [ ] **Run each E2E test individually to verify (all require fork):**
  ```powershell
  $env:FORK_ENABLED="true"; npx hardhat test test/e2e/USDC.BaseAsset.e2e.test.ts --network hardhat
  $env:FORK_ENABLED="true"; npx hardhat test test/e2e/WETH.BaseAsset.e2e.test.ts --network hardhat
  $env:FORK_ENABLED="true"; npx hardhat test test/e2e/WBTC.BaseAsset.e2e.test.ts --network hardhat
  $env:FORK_ENABLED="true"; npx hardhat test test/e2e/USDT.BaseAsset.e2e.test.ts --network hardhat
  $env:FORK_ENABLED="true"; npx hardhat test test/e2e/Euler.USDC.e2e.test.ts --network hardhat
  $env:FORK_ENABLED="true"; npx hardhat test test/e2e/Morpho.WETH.e2e.test.ts --network hardhat
  $env:FORK_ENABLED="true"; npx hardhat test test/e2e/MorphoVault.USDC.e2e.test.ts --network hardhat
  ```
  Expected: `12/12`, `12/12`, `12/12`, `12/12`, `15/15`, `16/16`, `16/16` ✅

---

## Phase 4 — Integration Tests

### 4.1 `test/integration/ProtocolManager.euler.test.ts`

- [ ] **Locate** the `EulerV2Plugin` deploy call (~line 101):
  ```typescript
  eulerPlugin = await EulerPluginFactory.deploy(await mockBeacon.getAddress());
  ```
  > **Note:** This currently only passes 1 argument. The contract now requires 4.

- [ ] **Add** Euler address constants at top of file (in the constants/config section):
  ```typescript
  const EULER_EVC          = "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066";
  const EULER_ACCOUNT_LENS = "0x90a52DDcb232e7bb003DD9258fA1235c553eC956";
  ```

- [ ] **Update** the deploy call to pass all 4 arguments:
  ```typescript
  // Before:
  eulerPlugin = await EulerPluginFactory.deploy(await mockBeacon.getAddress());
  // After:
  eulerPlugin = await EulerPluginFactory.deploy(
      await mockBeacon.getAddress(),
      "USDC",           // baseAssetCode — add the appropriate value
      EULER_EVC,
      EULER_ACCOUNT_LENS
  );
  ```
  > **Check** what `baseAssetCode` the test expects — look for how `"USDC"` or `"WETH"` is used in the test assertions.

---

### 4.2 `test/integration/MorphoPlugin.fork.test.ts`

- [ ] **Add** address constant at top of file (if not present):
  ```typescript
  const MORPHO_BLUE = "0x6c247b1F6182318877311737BaC0844bAa518F5e";
  ```

- [ ] **Find** the `MorphoPlugin` deploy call and add `MORPHO_BLUE`:
  ```typescript
  // Before:
  await MorphoPluginFactory.deploy(beaconAddr, baseAssetCode)
  // After:
  await MorphoPluginFactory.deploy(beaconAddr, baseAssetCode, MORPHO_BLUE)
  ```

- [ ] **Find** the `MorphoLensAdapter` deploy call and add `MORPHO_BLUE`:
  ```typescript
  // Before:
  await MorphoLensAdapterFactory.deploy(beaconAddr, baseAssetCode)
  // After:
  await MorphoLensAdapterFactory.deploy(beaconAddr, baseAssetCode, MORPHO_BLUE)
  ```

### 4.3 `test/integration/MorphoVaultPlugin.fork.test.ts`

- [ ] **No changes required.**

---

## Phase 5 — Deploy Scripts

### 5.1 `scripts/deploy-aave-v3-plugin.ts`

The file already defines `const AAVE_POOL = "0x794a..."` near the top.

- [ ] **Find** the `AaveV3Plugin` deploy call (~line 127):
  ```typescript
  // Before:
  const plugin = await PluginFactory.deploy(BEACON, BASE_ASSET_CODE);
  // After:
  const plugin = await PluginFactory.deploy(BEACON, BASE_ASSET_CODE, AAVE_POOL);
  ```

- [ ] **Find** the `AaveV3LensAdapter` deploy call (~line 154):
  ```typescript
  // Before:
  const lensAdapter = await AdapterFactory.deploy(BEACON, BASE_ASSET_CODE);
  // After:
  const lensAdapter = await AdapterFactory.deploy(BEACON, BASE_ASSET_CODE, AAVE_POOL);
  ```

---

### 5.2 `scripts/deploy-euler-plugin.ts`

- [ ] **Add** address constants near the top (after `BASE_ASSET_CODE`):
  ```typescript
  // Euler V2 addresses on Arbitrum
  const EVC_ADDRESS          = "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066";
  const ACCOUNT_LENS_ADDRESS = "0x90a52DDcb232e7bb003DD9258fA1235c553eC956";
  ```

- [ ] **Find** the `EulerV2Plugin` deploy call:
  ```typescript
  // Before:
  const eulerPlugin = await EulerV2Plugin.deploy(BEACON, BASE_ASSET_CODE);
  // After:
  const eulerPlugin = await EulerV2Plugin.deploy(BEACON, BASE_ASSET_CODE, EVC_ADDRESS, ACCOUNT_LENS_ADDRESS);
  ```

---

### 5.3 `scripts/deploy-morpho-plugin.ts`

The file already defines `const MORPHO_ADDRESS = "0x6c24..."`.

- [ ] **Find** the `MorphoPlugin` deploy call (~line 159):
  ```typescript
  // Before:
  const plugin = await PluginFactory.deploy(BEACON, BASE_ASSET_CODE);
  // After:
  const plugin = await PluginFactory.deploy(BEACON, BASE_ASSET_CODE, MORPHO_ADDRESS);
  ```

- [ ] **Find** the `MorphoLensAdapter` deploy call (~line 190):
  ```typescript
  // Before:
  const lensAdapter = await LensFactory.deploy(BEACON, BASE_ASSET_CODE);
  // After:
  const lensAdapter = await LensFactory.deploy(BEACON, BASE_ASSET_CODE, MORPHO_ADDRESS);
  ```

---

### 5.4 `scripts/deployment/euler/deploy-euler-plugin.ts`

- [ ] **Add** Euler address constants near the top.
- [ ] **Update** `EulerV2Plugin.deploy(...)` — add `EVC_ADDRESS, ACCOUNT_LENS_ADDRESS`.

### 5.5 `scripts/deployment/euler/deploy-euler-lens.ts`

- [ ] **Add** all 4 Euler address constants.
- [ ] **Update** `EulerLensAdapter.deploy(...)` — add 4 address args in order: `_accountLens, _vaultLens, _utilsLens, _evcAddress`.

### 5.6 `scripts/deployment/euler/simulate-full-deploy.ts`

- [ ] **Add** address constants.
- [ ] **Update** both `EulerV2Plugin.deploy(...)` and `EulerLensAdapter.deploy(...)`.

### 5.7 `scripts/deployment/euler/upgrade-euler-plugin.ts`

- [ ] **Add** address constants.
- [ ] **Update** `EulerV2Plugin.deploy(...)`.

---

### 5.8 `scripts/testing/redeploy-euler-ecosystem.ts`

- [ ] **Add** Euler address constants.
- [ ] **Update** `EulerLensAdapter.deploy(...)` (line ~50).
- [ ] **Update** `EulerV2Plugin.deploy(...)` (line ~65).

### 5.9 `scripts/redeploy-morpho-fixed.ts`

- [ ] **Add** `const MORPHO_ADDRESS = "0x6c247b1F6182318877311737BaC0844bAa518F5e"` if not present.
- [ ] **Update** `MorphoPlugin` deploy call (~line 159).
- [ ] **Update** `MorphoLensAdapter` deploy call (~line 190).

### 5.10 `scripts/redeploy-aave3-flashloan.ts`

- [ ] **Check** whether this script deploys `AaveV3Plugin` or `AaveV3LensAdapter` (~line 137).
- [ ] If yes: add `const AAVE_POOL = "0x794a..."` and pass it to the deploy call.

### 5.11 `scripts/deployment/deployModules.mainnet.ts`

- [ ] **No changes required** — this script only deploys core modules (TokenManager, SwapManager, etc.). No plugin or adapter is deployed here.

### 5.12 `scripts/deployment/deployAll.mainnet.ts`

- [ ] **Read** the file to check if it deploys any plugins or adapters.
- [ ] If yes: add the relevant address constants for target chain and pass them to deploy calls.
- [ ] If no: **No changes required**.

---

## Phase 6 — Final Verification

### 6.1 Full Compilation

- [x] Run:
  ```powershell
  npx hardhat compile --force
  ```
  Expected: 0 errors. TypeChain types regenerated.

### 6.2 TypeScript Type Check

- [x] Run:
  ```powershell
  npx tsc --noEmit
  ```
  Expected: 0 errors. (If new constructor args mismatch TypeChain types, this will catch it.)

### 6.3 Unit Tests (no fork)

- [x] Run:
  ```powershell
  $env:FORK_ENABLED="false"; npx hardhat test
  ```
  Expected: All 226+ tests pass (same count as before, minus the removed `AAVE_POOL constant` test + optional replacement).

### 6.4 E2E Tests (fork required — Arbitrum mainnet)

Run each individually or all at once:

- [x] `$env:FORK_ENABLED="true"; npx hardhat test test/e2e/USDC.BaseAsset.e2e.test.ts --network hardhat` → **12/12** ✅
- [x] `$env:FORK_ENABLED="true"; npx hardhat test test/e2e/WETH.BaseAsset.e2e.test.ts --network hardhat` → **12/12** ✅
- [x] `$env:FORK_ENABLED="true"; npx hardhat test test/e2e/WBTC.BaseAsset.e2e.test.ts --network hardhat` → **12/12** ✅
- [x] `$env:FORK_ENABLED="true"; npx hardhat test test/e2e/USDT.BaseAsset.e2e.test.ts --network hardhat` → **12/12** ✅
- [x] `$env:FORK_ENABLED="true"; npx hardhat test test/e2e/Euler.USDC.e2e.test.ts --network hardhat` → **15/15** ✅
- [x] `$env:FORK_ENABLED="true"; npx hardhat test test/e2e/Morpho.WETH.e2e.test.ts --network hardhat` → **16/16** ✅
- [x] `$env:FORK_ENABLED="true"; npx hardhat test test/e2e/MorphoVault.USDC.e2e.test.ts --network hardhat` → **16/16** ✅

### 6.5 Integration Tests (fork required)

- [x] `$env:FORK_ENABLED="true"; npx hardhat test test/integration/ProtocolManager.euler.test.ts --network hardhat` → all pass
- [x] `$env:FORK_ENABLED="true"; npx hardhat test test/integration/MorphoPlugin.fork.test.ts --network hardhat` → all pass
- [x] `$env:FORK_ENABLED="true"; npx hardhat test test/integration/MorphoVaultPlugin.fork.test.ts --network hardhat` → all pass

---

## Phase 7 — Git

- [x] Stage all changes:
  ```powershell
  git add contracts/plugins/AaveV3Plugin.sol
  git add contracts/adapters/AaveV3LensAdapter.sol
  git add contracts/plugins/EulerV2Plugin.sol
  git add contracts/adapters/EulerLensAdapter.sol
  git add contracts/plugins/MorphoPlugin.sol
  git add contracts/adapters/MorphoLensAdapter.sol
  git add test/unit/LensAdapters.test.ts
  git add test/e2e/
  git add test/integration/
  git add scripts/
  ```

- [x] Write commit message:
  ```
  refactor(contracts): remove hardcoded protocol addresses for multi-chain support

  Convert chain-specific address constants to constructor-injected immutables
  in AaveV3Plugin, AaveV3LensAdapter, EulerV2Plugin, EulerLensAdapter,
  MorphoPlugin, and MorphoLensAdapter. Update all test files and deploy scripts
  to pass Arbitrum mainnet addresses at deploy time.

  Enables deploying the same compiled bytecode to any EVM chain by providing
  protocol addresses as constructor arguments instead of compile-time constants.
  ```

- [x] Commit:
  ```powershell
  git commit -m "refactor(contracts): remove hardcoded protocol addresses for multi-chain support"
  ```

---

## Troubleshooting

### "TypeError: contract.deploy is not a constructor" or similar
- TypeChain types are stale. Run `npx hardhat compile --force` to regenerate.

### Constructor arg count mismatch (e.g., "Expected 3 args but got 2")
- Double-check every deploy call updated in test/scripts.
- Run `npx tsc --noEmit` to catch TypeScript type mismatches.

### `AAVE_POOL` not a function error in unit tests
- The test calling `await adapter.AAVE_POOL()` was not removed. Delete that test block.

### `_getMorpho()` function reverts in tests
- Check that `_getMorpho()` was changed from `pure` to `view` in `MorphoLensAdapter.sol`.

### Fork tests failing with "address not a contract"
- The injected address is wrong or zero. Verify the Arbitrum addresses are typed correctly.

### Integration test `ProtocolManager.euler.test.ts` deployment failing
- This test previously passed only 1 arg to `EulerV2Plugin.deploy`. It now needs 4. See Phase 4.1.

---

## Summary Checklist (Quick Reference)

| Phase | Files | Status |
|-------|-------|--------|
| 1.1 | `contracts/plugins/AaveV3Plugin.sol` | [x] |
| 1.2 | `contracts/adapters/AaveV3LensAdapter.sol` | [x] |
| 1.3 | `contracts/plugins/EulerV2Plugin.sol` | [x] |
| 1.4 | `contracts/adapters/EulerLensAdapter.sol` | [x] |
| 1.5 | `contracts/plugins/MorphoPlugin.sol` | [x] |
| 1.6 | `contracts/adapters/MorphoLensAdapter.sol` | [x] |
| 2 | `test/unit/LensAdapters.test.ts` | [x] |
| 3 | `test/e2e/*.e2e.test.ts` (6 files) | [x] |
| 4 | `test/integration/*.test.ts` (2 files) | [x] |
| 5 | Deploy scripts (~10 files) | [x] |
| 6 | Full verify (compile + all tests) | [x] |
| 7 | Git commit | [x] |
