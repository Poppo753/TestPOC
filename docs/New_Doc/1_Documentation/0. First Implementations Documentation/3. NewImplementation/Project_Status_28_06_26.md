# Project Status — 28 Giugno 2026

## Overview

Sessione completa di implementazione e testing. Due grandi blocchi completati:

1. **Unified Price Conversion Architecture** — centralizzazione del base asset in `TokenManager`, supporto multi-token (USDC, WETH, WBTC, USDT), fix bug critico `getPriceInUsd`
2. **Fork E2E Testing** — copertura E2E per tutti e 3 i protocolli (Aave, Euler, Morpho Blue, MorphoVault) con Arbitrum mainnet fork

---

## Cosa è stato implementato

### 1. Architettura "Unified Price Conversion" (`TokenManager.sol`)

**Stato: ✅ COMPLETO**

| Cosa | File | Dettaglio |
|------|------|-----------|
| `string public baseAssetCode` | `TokenManager.sol` | Stato centralizzato — "USDC", "WETH", "WBTC", ecc. |
| `setBaseAssetCode(string)` | `TokenManager.sol` | Setter `onlyOwner`, valida con `oracleAdapter.supportsToken` |
| `getBaseAssetPrice()` | `TokenManager.sol` | Sostituisce `getPriceFromOracle` — chiama `oracleAdapter.getPrice(baseAssetCode)` |
| `convertUsdToBaseAsset(uint256, uint8)` | `TokenManager.sol` | Converte valore USD nel base asset usando `getPriceInUsd` |
| `event BaseAssetCodeSet(string)` | `TokenManager.sol` | Emesso su `setBaseAssetCode` |

### 2. Fix Bug Critico: `getPriceInUsd()`

**Stato: ✅ COMPLETO**

**Problema:** `convertUsdToBaseAsset` usava `getPrice()` che restituisce il prezzo *relativo alla denominazione target* (per WETH con `targetDenomination = "WETH"` → ritorna 1.0, non $3100). Il risultato era un valore 1568x errato nel Aave LensAdapter per base asset non-USDC.

**Fix:** aggiunta `getPriceInUsd()` — restituisce sempre il prezzo raw USD normalizzato a 18 decimali, ignorando la denominazione target.

| File modificato | Cosa aggiunto |
|----------------|---------------|
| `contracts/interfaces/IOracleAdapter.sol` | Firma `getPriceInUsd(string) returns (uint256, uint256, bool)` |
| `contracts/adapters/ChainlinkAdapter.sol` | Implementazione: legge raw feed, normalizza a 18 dec, nessuna conversione |
| `contracts/mocks/MockOracleAdapter.sol` | Implementazione mock con mapping `usdPrices[]` + fallback su `prices[]` |
| `contracts/TokenManager.sol` | `convertUsdToBaseAsset` ora usa `oracleAdapter.getPriceInUsd(baseAssetCode)` |

### 3. Interfacce aggiornate

**Stato: ✅ COMPLETO**

- `contracts/interfaces/ITokenManagerForModules.sol`:
  - Rimossa: `getPriceFromOracle(string)`
  - Aggiunte: `getBaseAssetPrice()`, `baseAssetCode()`, `convertUsdToBaseAsset(uint256, uint8)`

### 4. Refactoring LensAdapter

**Stato: ✅ COMPLETO**

| File | Cosa cambiato |
|------|---------------|
| `contracts/adapters/AaveV3LensAdapter.sol` | Rimossa `IAaveOracle` e `AAVE_ORACLE`; `_usdToBaseAsset` → `TokenManager.convertUsdToBaseAsset(v, 8)` |
| `contracts/adapters/EulerLensAdapter.sol` | `getPriceFromOracle(baseAssetCode)` → `getBaseAssetPrice()` |
| `contracts/adapters/MorphoLensAdapter.sol` | Idem |
| `contracts/adapters/MorphoVaultLensAdapter.sol` | Idem |

### 5. Script di deploy aggiornati

**Stato: ✅ COMPLETO**

- `scripts/deployment/deployModules.mainnet.ts` — aggiunta `await tokenManager.setBaseAssetCode(BASE_ASSET_CODE)`
- `scripts/deployment/deployAll.mainnet.ts` — idem

### 6. Unit Tests aggiornati/aggiunti

**Stato: ✅ COMPLETO — 226 test passanti**

| File test | Test | Note |
|-----------|------|------|
| `test/unit/TokenManager.test.ts` | 87 (+20 nuovi) | `setBaseAssetCode` (7), `getBaseAssetPrice` (4), `convertUsdToBaseAsset` (9) |
| `test/unit/LensAdapters.test.ts` | 29 (-1) | Rimosso test `AAVE_ORACLE constant` non più valido |
| `test/unit/ValueCalculator.test.ts` | 61 | Fix timeout: `this.timeout(120000)` — `beforeEach` deploya ~10 contratti |
| `test/unit/ChainlinkAdapter.test.ts` | 49 | Invariato |

### 7. E2E Fork Tests — Multi-token Base Asset (Aave)

**Stato: ✅ COMPLETO — 48/48 test passanti**

Tutti eseguiti su Arbitrum mainnet fork (`FORK_ENABLED=true`). Ogni file: 12/12.

| File | Base asset | Dec | Lens result | Test |
|------|-----------|-----|-------------|------|
| `test/e2e/USDC.BaseAsset.e2e.test.ts` | USDC | 6 | ~100.xxx USDC | 12/12 ✅ |
| `test/e2e/WETH.BaseAsset.e2e.test.ts` | WETH | 18 | ~1.000009 WETH | 12/12 ✅ |
| `test/e2e/WBTC.BaseAsset.e2e.test.ts` | WBTC | 8 | ~0.049997 WBTC | 12/12 ✅ |
| `test/e2e/USDT.BaseAsset.e2e.test.ts` | USDT | 6 | ~100.003 USDT | 12/12 ✅ |

Flusso testato: `deposit → Aave supply → lens value check → Aave withdraw → user withdraw`

### 8. E2E Fork Tests — Protocolli (Euler, Morpho Blue, MorphoVault)

**Stato: ✅ COMPLETO — 47/47 test passanti**

| File | Plugin | Vaults/Markets | Lens result | Test |
|------|--------|---------------|-------------|------|
| `test/e2e/Euler.USDC.e2e.test.ts` | `EulerV2Plugin` | USDC Vault `0x0a1eCC5` | `99.999999 USDC` | 15/15 ✅ |
| `test/e2e/Morpho.WETH.e2e.test.ts` | `MorphoPlugin` | WETH/USDC 86% LLTV | `0.049983 WETH` | 16/16 ✅ |
| `test/e2e/MorphoVault.USDC.e2e.test.ts` | `MorphoVaultPlugin` | HexaOne USDC `0xaE738` | `99.999999 USDC` | 16/16 ✅ |

Flusso testato: `pool deposit → protocol supply → lens reads → protocol withdraw → user withdraw`

---

## Bug trovati e risolti

| # | Bug | Sintomo | Fix applicato |
|---|-----|---------|---------------|
| 1 | `getPrice()` sbagliato in `convertUsdToBaseAsset` | WETH lens → 1568 WETH invece di 1 | Aggiunto `getPriceInUsd()` a oracle, usato in `convertUsdToBaseAsset` |
| 2 | Timeout `ValueCalculator.test.ts` | Fail su macchine lente | `this.timeout(120000)` nel `describe` |
| 3 | Checksum WBTC whale errato | Revert al setup WBTC test | Corretto a `0x078f...DED33A249` |
| 4 | Parametri WBTC già al default | Revert "Same as current value" | Rimossi proposal ridondanti nel setup WBTC |
| 5 | `getActivePositionCount` Morpho = 1 non 0 | Test assertion errata | Il metodo conta mercati con collaterale > 0, non solo leverage |

---

## Pattern riutilizzabili nei test E2E

```typescript
// 1. Heartbeat esteso per fork test (feed Chainlink stale)
const FORK_HEARTBEAT = 31536000; // 1 anno

// 2. Config denominazione base asset
await chainlinkAdapter.setTargetDenomination("TOKEN");
await chainlinkAdapter.setReferenceFeed("USD", FEED, 8, FORK_HEARTBEAT);

// 3. Set baseAssetCode OBBLIGATORIO prima di qualsiasi query prezzi
await tokenManager.setBaseAssetCode("TOKEN");

// 4. ParameterManager decimali = decimali del base asset
const pm = await ParameterManager.deploy(beacon, TOKEN_DECIMALS); // 6/8/18

// 5. Per WBTC: i default (minDeposit, maxDeposit) già funzionano per amm. piccoli → NON proporre parametri identici
```

---

## Indirizzi Arbitrum di riferimento

```
USDC:              0xaf88d065e77c8cC2239327C5EDb3A432268e5831
WETH:              0x82aF49447D8a07e3bd95BD0d56f35241523fBab1
WBTC:              0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f
USDT:              0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9

Chainlink ETH/USD: 0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612
Chainlink BTC/USD: 0x6ce185860a4963106506C203335A2910413708e9
Chainlink USDC/USD:0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3
Chainlink USDT/USD:0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7

Aave V3 Pool:      0x794a61358D6845594F94dc1DB02A252b5b4814aD
Morpho Blue:       0x6c247b1F6182318877311737BaC0844bAa518F5e
Euler EVC:         0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066
Euler AccountLens: 0x90a52DDcb232e7bb003DD9258fA1235c553eC956

Euler USDC Vault:  0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899
Euler WETH Vault:  0x78E3E051D32157AACD550fBB78458762d8f7edFF
HexaOne USDC Vault:0xaE73875437c86abb60cD7fA77286D63cb94F9a25

Morpho WETH/USDC Oracle: 0x282FEB10549fde52bD61A6979424Ddf18A4971A2
Morpho IRM:              0x66F30587FB8D4206918deb78ecA7d5eBbafD06DA
Morpho LLTV (86%):       860000000000000000
```

---

---

## TODO RIMANENTI

---

### TODO #1 — Multi-chain: Refactoring indirizzi hardcoded nei plugin

**Priorità:** Alta (blocca deploy su qualsiasi chain diversa da Arbitrum)  
**Stato:** ❌ Non iniziato

#### Il problema

Attualmente 3 plugin hanno indirizzi di protocollo hardcoded come `public constant`:

**`contracts/plugins/AaveV3Plugin.sol`**
```solidity
address public constant AAVE_POOL_ADDRESS = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;
```

**`contracts/plugins/EulerV2Plugin.sol`**
```solidity
address public constant EVC_ADDRESS = 0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066;
address public constant ACCOUNT_LENS_ADDRESS = 0x90a52DDcb232e7bb003DD9258fA1235c553eC956;
```

**`contracts/adapters/EulerLensAdapter.sol`**
```solidity
address public constant ACCOUNT_LENS = 0x90a52DDcb232e7bb003DD9258fA1235c553eC956;
address public constant VAULT_LENS = 0xc99FCEE6174Bc92eBe9C78690fFD5067018a8380;
address public constant UTILS_LENS = 0xDAf44060DCe217Fd603908A49fcaa1FA900304BE;
address public constant EVC_ADDRESS = 0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066;
```

**`contracts/plugins/MorphoPlugin.sol`**
```solidity
address public constant MORPHO_ADDRESS = 0x6c247b1F6182318877311737BaC0844bAa518F5e;
```

**`contracts/adapters/MorphoLensAdapter.sol`**
```solidity
address public constant MORPHO = 0x6c247b1F6182318877311737BaC0844bAa518F5e;
```

#### Cosa fare

**Opzione A (semplice):** Passare gli indirizzi come parametri del costruttore e salvarli come `immutable`. Esempio:

```solidity
// Prima:
address public constant AAVE_POOL_ADDRESS = 0x794a61...;
constructor(address _beacon, string memory _baseAssetCode) {
    ...
}

// Dopo:
address public immutable aavePool;
constructor(address _beacon, string memory _baseAssetCode, address _aavePool) {
    aavePool = _aavePool;
    ...
}
```

**File da modificare:**
1. `AaveV3Plugin.sol` — rimuovere `AAVE_POOL_ADDRESS`, aggiungere costruttore con `_aavePool`; aggiornare `aavePool = IAaveV3Pool(_aavePool)`
2. `EulerV2Plugin.sol` — rimuovere `EVC_ADDRESS` e `ACCOUNT_LENS_ADDRESS`, passarli al costruttore; `evc = IEVC(_evcAddress)`
3. `EulerLensAdapter.sol` — stessa cosa per `EVC_ADDRESS`, `ACCOUNT_LENS`, `VAULT_LENS`, `UTILS_LENS`
4. `MorphoPlugin.sol` — rimuovere `MORPHO_ADDRESS`, passare al costruttore
5. `MorphoLensAdapter.sol` — idem per `MORPHO`

**Test da aggiornare:**
- Tutti i test che deployano questi contratti dovranno passare gli indirizzi Arbitrum come argomento
- `test/e2e/Euler.USDC.e2e.test.ts`, `test/e2e/Morpho.WETH.e2e.test.ts`, ecc.
- `test/unit/LensAdapters.test.ts`
- `test/integration/MorphoPlugin.fork.test.ts`, `test/integration/MorphoVaultPlugin.fork.test.ts`
- `test/integration/ProtocolManager.euler.test.ts`
- Script deploy `scripts/deployment/deployModules.mainnet.ts`

**Scope:** ~5 contratti Solidity + ~8 file di test

---

### TODO #2 — GMX Integration (Plugin + Lens + Registry + Tests)

**Priorità:** Media  
**Stato:** ❌ Non iniziato

#### Il problema

GMX non ha ancora nessun contratto, interfaccia, o test nel progetto. Va implementato da zero seguendo il pattern "3 Musketeers" (Plugin + LensAdapter + Registry).

#### Cosa fare

**Step 1 — Interfacce**
- Creare `contracts/interfaces/IGMXPlugin.sol` — estende `IProtocolAdapter`
- Creare `contracts/interfaces/IGMXRegistry.sol`
- Creare `contracts/interfaces/gmx/IGMXRouter.sol`, `IGMXVault.sol`, `IGMXReader.sol`
  - Router: `0xaBBc5F99639c9B6bCb58544ddf04EFA6802F4064`
  - Vault: `0x489ee077994B6658eAfA855C308275EAd8097C4A` (da verificare — GMX V2 su Arbitrum)
  - ExchangeRouter: GMX V2 usa `ExchangeRouter` + `DataStore`

**Step 2 — Contratti**
- `contracts/plugins/GMXPlugin.sol`
  - Implementa `IProtocolAdapter`
  - Gestisce: apertura/chiusura posizioni, deposit/withdraw collaterale
  - Interagisce con GMX V2 Router via `createOrder`
  - Key addresses GMX V2 Arbitrum:
    - ExchangeRouter: `0x900173A2C16B8c197Aa1a87A36B8d2B1e95bFf7d` (verificare versione aggiornata)
    - DataStore: `0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8`
    - OrderVault: `0x31eF83a530Fde1B38EE9A18093A333D8Bbbc40d5`
    - USDC Market: market address per GMX V2 perp trading
  
- `contracts/plugins/GMXRegistry.sol`
  - Mappa `tokenCode` → market address GMX V2
  - Salva collateral types supportati per ogni market

- `contracts/adapters/GMXLensAdapter.sol`
  - Implementa `ILensAdapter`
  - Legge posizioni da GMX V2 Reader
  - Calcola: posizione attiva, PnL, health factor (leverage ratio), collaterale, debt virtuale
  - Converte valore posizione in base asset via `TokenManager.getBaseAssetPrice()`

**Step 3 — Unit Tests**
- `test/unit/GMXPlugin.test.ts`
- `test/unit/GMXLensAdapter.test.ts`
- `test/unit/GMXRegistry.test.ts`

**Step 4 — Fork E2E Test**
- `test/e2e/GMX.USDC.e2e.test.ts`
- Flusso: `deposit USDC → GMX open long position → lens value check → close position → user withdraw`

**Nota importante:** GMX V2 usa un sistema di ordini asincrono (i keeper processano gli ordini off-chain). I test E2E su fork potrebbero richiedere impersonare un keeper o usare `executeOrder` manualmente.

**Complessità stimata:** Alta — GMX V2 è più complesso di Aave/Euler per la natura async degli ordini

---

### TODO #3 — Compound Integration (Plugin + Lens + Registry + Tests)

**Priorità:** Media  
**Stato:** ❌ Non iniziato

#### Il problema

Compound non ha ancora nessun contratto nel progetto. Va implementato da zero seguendo il pattern "3 Musketeers".

**Nota:** Compound V3 (Comet) è diverso da V2. Su Arbitrum è presente solo **Compound V3**.

#### Cosa fare

**Step 1 — Interfacce**
- Creare `contracts/interfaces/ICompoundPlugin.sol`
- Creare `contracts/interfaces/ICompoundRegistry.sol`
- Creare `contracts/interfaces/compound/IComet.sol`:
  - `supply(address asset, uint256 amount)`
  - `withdraw(address asset, uint256 amount)`
  - `balanceOf(address account) returns (int256)` — positivo = supply, negativo = borrow
  - `collateralBalanceOf(address account, address asset) returns (uint128)`
  - `getPrice(address priceFeed) returns (uint128)`
  - Compound V3 Arbitrum USDC Comet: `0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA`
  - Compound V3 Arbitrum WETH Comet: `0x6f7D514bbD4aFf3BcD1140B7344b32f063dEe486`

**Step 2 — Contratti**
- `contracts/plugins/CompoundPlugin.sol`
  - Implementa `IProtocolAdapter`
  - Gestisce: `supply`, `withdraw`, `borrow` (Compound V3 supporta borrowing del base token)
  - **Differenza chiave vs Aave/Euler:** In Compound V3 ogni Comet ha UN solo token di prestito (base asset) e N collaterali
  - Per supply del base token: `comet.supply(baseToken, amount)` → genera interesse
  - Per collaterale: `comet.supply(collateralToken, amount)` → NON genera interesse, abilita borrowing
  
- `contracts/plugins/CompoundRegistry.sol`
  - Mappa `tokenCode` → Comet address (es. "USDC" → USDC Comet, "WETH" → WETH Comet)
  - Salva collateral asset list per ogni Comet

- `contracts/adapters/CompoundLensAdapter.sol`
  - Implementa `ILensAdapter`
  - Legge `comet.balanceOf(plugin)` → supply position
  - Legge `comet.collateralBalanceOf(plugin, asset)` → collateral positions
  - Calcola health factor manuale: `(collateralValue * borrowCollateralFactor) / borrowBalance`
  - Converte in base asset via `TokenManager`

**Step 3 — Unit Tests**
- `test/unit/CompoundPlugin.test.ts`
- `test/unit/CompoundLensAdapter.test.ts`
- `test/unit/CompoundRegistry.test.ts`

**Step 4 — Fork E2E Test**
- `test/e2e/Compound.USDC.e2e.test.ts`
- Whale USDC su Arbitrum: `0x489ee077994B6658eAfA855C308275EAd8097C4A`
- Flusso: `deposit USDC → Compound supply → lens value check → withdraw → user withdraw`

**Complessità stimata:** Media — Compound V3 è più semplice di GMX (operazioni sincrone), simile ad Aave nel flusso ma con logica diversa per base token vs collateral

---

## Struttura test E2E attuale

```
test/e2e/
├── USDC.BaseAsset.e2e.test.ts      ✅  Aave, USDC base (12/12)
├── WETH.BaseAsset.e2e.test.ts      ✅  Aave, WETH base (12/12)
├── WBTC.BaseAsset.e2e.test.ts      ✅  Aave, WBTC base (12/12)
├── USDT.BaseAsset.e2e.test.ts      ✅  Aave, USDT base (12/12)
├── Euler.USDC.e2e.test.ts          ✅  Euler V2, USDC base (15/15)
├── Morpho.WETH.e2e.test.ts         ✅  Morpho Blue, WETH base (16/16)
├── MorphoVault.USDC.e2e.test.ts    ✅  MorphoVault, USDC base (16/16)
└── OracleAdapter.e2e.test.ts       ✅  ChainlinkAdapter fork test
```

## Struttura unit test attuale

```
test/unit/
├── TokenManager.test.ts            ✅  87 test
├── LensAdapters.test.ts            ✅  29 test
├── ValueCalculator.test.ts         ✅  61 test
├── ChainlinkAdapter.test.ts        ✅  49 test
└── ...altri
```

**Totale: 226 unit test passanti, 95 E2E test passanti**
