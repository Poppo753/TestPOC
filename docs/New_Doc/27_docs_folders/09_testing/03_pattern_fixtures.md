# 9.3 Pattern e Fixtures

## Base Asset Abstraction (Phase 0)

Il refactoring Phase 0 ha introdotto **base asset abstraction**: tutti i contratti ora referenziano il base asset (es. WETH) tramite un codice stringa registrato nel Beacon, anziché un indirizzo hardcoded.

### Impatto sui Costruttori

I costruttori sono cambiati per accettare un `_baseAssetCode` (string):

| Contratto | Costruttore Pre-Refactoring | Costruttore Post-Refactoring |
|-----------|---------------------------|------------------------------|
| ParameterManager | `(beacon)` | `(beacon, 18)` — decimali base asset |
| LiquidityManager | `(beacon)` | `(beacon, "WETH")` |
| ProxyGeneral | `(beacon)` | `(beacon, "WETH")` |
| ValueCalculator | `(beacon)` | `(beacon, "WETH")` |
| SwapManager | `(beacon)` | `(beacon, "WETH")` |
| AaveV3Plugin | `(beacon)` | `(beacon, "WETH")` |
| EulerV2Plugin | `(beacon)` | `(beacon, "WETH")` |
| MorphoPlugin | `(beacon)` | `(beacon, "WETH")` |
| AaveV3LensAdapter | `(beacon)` | `(beacon, "WETH")` |
| EulerLensAdapter | `(beacon)` | `(beacon, "WETH")` |
| MorphoLensAdapter | `(beacon)` | `(beacon, "WETH")` |
| MorphoVaultLensAdapter | `(beacon)` | `(beacon, "WETH")` |
| MorphoVaultPlugin | `(beacon)` | `(beacon)` — **invariato** |
| FlashLoanService | `(beacon)` | `(beacon)` — **invariato** |

### Registrazione BASE_ASSET nel Beacon (OBBLIGATORIO)

Ogni test che usa i contratti refactored **deve** registrare l'indirizzo BASE_ASSET nel Beacon:

```typescript
// Con MockBeacon
await mockBeacon.setImplementation("BASE_ASSET", WETH_ADDRESS);

// Con Beacon reale (e.g. fork tests)
await beacon.updateImplementation("BASE_ASSET", WETH_ADDRESS);
```

Senza questa registrazione, i contratti non possono risolvere l'indirizzo del base asset e falliranno.

### Struct ILensAdapter — Rename dei Campi

```typescript
// PRIMA
struct PositionData {
  uint256 totalCollateralEth;    // → totalCollateral
  uint256 totalDebtEth;          // → totalDebt
  uint256 netValueEth;           // → netValue
  ...
}

// DOPO
struct PositionData {
  uint256 totalCollateral;
  uint256 totalDebt;
  uint256 netValue;
  ...
}
```

### Funzioni Rinominate

| Prima | Dopo |
|-------|------|
| `closePositionsForWeth()` | `closePositionsForBaseAsset()` |
| `estimateWethFromCloseAll()` | `estimateBaseAssetFromCloseAll()` |

### Funzione Rimossa

`getPositionValue(positionId)` è stata rimossa. Usare:
```typescript
const breakdown = await lensAdapter.getValueBreakdown();
// breakdown.totalCollateral, breakdown.totalDebt, breakdown.netValue, breakdown.availableToWithdraw
```

---

## Fixture di Deploy Standard

Il file `test/helpers/fixtures/contracts.ts` fornisce `deploySystemFixture()`:

```typescript
import { deploySystemFixture } from "../helpers/fixtures/contracts";

describe("MyTest", () => {
  let system: SystemContracts;
  
  beforeEach(async () => {
    system = await loadFixture(deploySystemFixture);
  });
});
```

Deploya: Beacon, ProxyGeneral, LiquidityManager, SwapManager, EmergencyHandler, ParameterManager, TokenManager, ValueCalculator e li registra nel Beacon.

---

## Mock Contracts

### MockBeacon
Beacon semplificato per unit tests, con `setImplementation(name, address)`.

### MockWETH
ERC20 wrapper per WETH con `deposit()` e `withdraw()`. Deployato e registrato come `BASE_ASSET`.

### MockTokenManager
Gestione token con `setTokenPrice(code, price)`. **CRITICO** per fork tests — vedi sezione successiva.

### MockChainlinkOracle
Simula price feed Chainlink con `setLatestAnswer(price)`.

---

## Pattern Critico: setTokenPrice nei Fork Tests

I `LensAdapter` usano `_toBaseAsset()` per convertire valori di posizione nel base asset. Questa funzione chiama `TokenManager.getTokenPriceForModule()` per ottenere i prezzi dei token.

**Se i prezzi non sono impostati, `getTotalValue()` restituisce 0.**

```typescript
// OBBLIGATORIO per fork tests con MockTokenManager
await mockTokenManager.setTokenPrice("WETH", ethers.parseUnits("2500", 8));
await mockTokenManager.setTokenPrice("USDC", ethers.parseUnits("1", 8));
```

Questo pattern è necessario in tutti i fork tests che verificano valori di posizione.

---

## Pattern: EulerRegistry TransferOwnership

Per i test che usano `openLeverageAtomic` / `createPositionOnDemand`, il plugin deve essere il proprietario dell'EulerRegistry:

```typescript
const EulerRegistryFactory = await ethers.getContractFactory("EulerRegistry");
const eulerRegistry = EulerRegistryFactory.attach(EULER_REGISTRY_ADDRESS);
await eulerRegistry.transferOwnership(await eulerPlugin.getAddress());
```

---

## Pattern: WETH Funding via Whale

Per fork tests che necessitano WETH nel ProxyGeneral:

```typescript
const WETH_WHALE = "0xC3E5607Cd4ca0D5Fe51e09B60Ed97a0Ae6F874dd";

// Impersonate whale e trasferisci WETH
await network.provider.request({
  method: "hardhat_impersonateAccount",
  params: [WETH_WHALE],
});
const whaleSigner = await ethers.getSigner(WETH_WHALE);
const weth = await ethers.getContractAt("IWETH", WETH_ADDRESS);
await weth.connect(whaleSigner).transfer(proxyGeneralAddress, ethers.parseEther("0.01"));
```

---

## Utility Helpers

### TimeHelpers (`test/helpers/utils/test-utils.ts`)

```typescript
await TimeHelpers.advanceTime(3600);          // Avanza di 1 ora
await TimeHelpers.advanceToTime(timestamp);   // Avanza a timestamp specifico
const now = await TimeHelpers.getCurrentTime();
```

### TestAssertions

```typescript
await TestAssertions.expectRevertWithMessage(
  contract.dangerousFunction(),
  "Unauthorized"
);
```
