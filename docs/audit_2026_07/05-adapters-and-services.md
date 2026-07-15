# 05 — Adapters & Services: analisi dettagliata

Documento di audit (rev. 2026-07) — analisi esaustiva degli adapter di lens/oracle e del servizio centralizzato di flash loan / swap.

File analizzati (path assoluti):

| Contract | Path | Righe |
| -------- | ---- | ----- |
| `ChainlinkAdapter` | `C:/Personal/TestPOC/contracts/adapters/ChainlinkAdapter.sol` | 543 |
| `AaveV3LensAdapter` | `C:/Personal/TestPOC/contracts/adapters/AaveV3LensAdapter.sol` | 485 |
| `EulerLensAdapter` | `C:/Personal/TestPOC/contracts/adapters/EulerLensAdapter.sol` | 1276 |
| `MorphoLensAdapter` | `C:/Personal/TestPOC/contracts/adapters/MorphoLensAdapter.sol` | 618 |
| `MorphoVaultLensAdapter` | `C:/Personal/TestPOC/contracts/adapters/MorphoVaultLensAdapter.sol` | 289 |
| `FlashLoanService` | `C:/Personal/TestPOC/contracts/services/FlashLoanService.sol` | 425 |
| `MockChainlinkOracle` | `C:/Personal/TestPOC/contracts/MockChainlinkOracle.sol` | 161 |
| `MockERC20` | `C:/Personal/TestPOC/contracts/MockERC20.sol` | 72 |
| `MockWETH` | `C:/Personal/TestPOC/contracts/MockWETH.sol` | 43 |

Interfacce di supporto: `contracts/interfaces/**` (in particolare `IOracleAdapter`, `ILensAdapter`, `IEulerLensAdapter`, `IAaveV3Pool`, `morpho/IMorpho`, `euler/IAccountLens`, `euler/IEVault`, `euler/IEVC`, `balancer/IBalancerVault`, `IFlashLoanCallback`, `ITokenManagerForModules`, `IBeacon`).

---

## 1. Pattern comune degli adapter

Tutti i **LensAdapter** condividono l'architettura seguente:

- **Beacon-based resolution**: `IBeacon(beacon).getImplementation("<ModuleName>")` per risolvere `TokenManager`, `<Protocol>Registry`, `<Protocol>Plugin`, `BASE_ASSET`.
- **`baseAssetCode`**: stringa immutabile-ish (in realtà `public string`, non `immutable`) usata per il denominazione dei valori.
- **`Ownable`**: adapters ereditano da `Ownable` v4 (single-step). Tuttavia — vale la pena notarlo — **nessuno degli adapter espone funzioni `onlyOwner`**: l'`Ownable` è sostanzialmente unused surface, ma occupa storage slot 0 (byte-32 del slot immediatamente dopo il layout Ownable).
- **Pragma non uniforme**: `ChainlinkAdapter` e `AaveV3LensAdapter` usano `^0.8.19`, `EulerLensAdapter` `^0.8.19`, `Morpho*` usano `^0.8.27`. Inconsistente ma tutti compatibili con `>=0.8.19`.

Per ogni adapter descriveremo: **scopo**, **unit/decimals**, **oracle chiamato**, **integrazione**, **flow di calcolo**.

---

## 2. ChainlinkAdapter

**Path**: `contracts/adapters/ChainlinkAdapter.sol` (`^0.8.19`, `IOracleAdapter, Ownable`).

### 2.1 Scopo
Wrapper unificato di `AggregatorV3Interface`. Espone `getPrice(tokenCode)`, `getPriceInUsd(tokenCode)`, `getPriceDecimals`, `supportsToken`. Usato principalmente da `TokenManager`.

### 2.2 Configurazione per feed
Struct `PriceFeedConfig` (righe 34–41):
- `feedAddress`, `decimals`, `heartbeat` (secondi), `denomination` (stringa), `isActive`, `errorCount`.
- `errorCount` è nel `PriceFeedConfig`, ma **`getPrice` è `view` — non incrementa mai `errorCount`** (righe 337–409). `errorCount` esiste solo per essere resettato manualmente da owner. Il "circuit breaker" annunciato in header di file è di fatto **inerte** perché nessun codepath incrementa `errorCount` (deriva solo dalla `PriceFeedConfig` costruita in `setPriceFeed`, sempre 0).

### 2.3 Validazioni (righe 429–452, `_getRawPrice`)
- `price > 0`
- `updatedAt > 0` ("round complete")
- `answeredInRound >= roundId` ("not stale")
- `block.timestamp - updatedAt <= config.heartbeat` ("fresh")
- Tutti e quattro compressi in un unico bool `allValid`. Se una qualsiasi è falsa → `(uint256(rawPrice), updatedAt, false)`.

### 2.4 Conversione di denominazione (righe 370–408)
Se `config.denomination != targetDenomination`, chiama `_getRawPrice(refConfig)` sul reference feed. La conversione è:
```
normalizedTokenPrice = rawPrice * 10^(18 - config.decimals)
normalizedRefPrice   = refPrice * 10^(18 - refConfig.decimals)
convertedPrice       = (normalizedTokenPrice * 1e18) / normalizedRefPrice
```
Assunzioni forti:
- **Entrambi** i feed devono essere denominati nella **stessa** valuta intermedia. Es: convertire USDC/USD ($1) → USDC/ETH divide per ETH/USD ($3000). Se il `referenceFeeds[denomination]` non è ETH/USD ma ETH/BTC, il risultato non ha senso ed **il contratto non lo controlla**.
- Il commento riga 279 memorizza `denomination: targetDenomination` per un reference feed, che è concettualmente confuso: se il reference è ETH/USD (per convertire USD in ETH), il pair è "ETH per USD", ma la struct dice `denomination = targetDenomination = "ETH"`. Nessun controllo effettivo.

### 2.5 `getPriceInUsd` (righe 461–496)
Non applica conversione di denominazione. Richiede `config.denomination == "USD"`. Ritorna `rawPrice * 10^(18 - config.decimals)`. Usato da `TokenManager.convertUsdToBaseAsset()` — permette al lens Aave (che riceve USD 8-dec da Aave) di riconvertire.

### 2.6 Cose che NON sono implementate
- **Sequencer uptime check** (Chainlink L2 Sequencer Uptime Feed, Arbitrum!). Vedi `ADP-001`.
- **`min/maxAnswer` bounds del feed** — nessuna verifica che `rawPrice` non sia clamped al min/max del aggregator (Luna-style). Vedi `ADP-002`.
- **Vero circuit breaker** che incrementa `errorCount`. Vedi `ADP-003`.
- **`decimals normalization`** quando `config.decimals > 18` — non è gestito. Il `require(decimals > 0 && decimals <= 18)` (riga 149) previene la config, ma se un feed espone `decimals()` diversi dopo la config, la validazione (righe 174–178) è **inside** `try` ma opzionale (`catch` accetta il valore dichiarato). Un feed con `decimals()` reverting può quindi accettare qualsiasi valore. Vedi `ADP-004`.
- **`startedAt` viene scartato** (righe 158–164 e 430–435) — questo è OK secondo best practice OpenZeppelin, ma non è documentato.

### 2.7 Reference feed handling
- Se `getPrice` è chiamato ma `referenceFeeds[config.denomination]` non è configurato **e** `needsConversion == true`, `revert("No reference feed for denomination conversion")` (riga 385). Questo trasforma una view function in reverting per unsupported → il caller (es. `TokenManager`) deve `try/catch`.

### 2.8 Round bassi / precision loss
- Se `config.decimals == 8` e `rawPrice == 0` non passa `priceValid`, ok.
- Se `rawPrice < 10^(config.decimals - 18)` (impossibile con `decimals <= 18`), `normalizedTokenPrice` diventa 0 senza revert (`rawPrice * 10^(18 - 8) = rawPrice * 1e10`, safe).
- **Division precision**: `(normalizedTokenPrice * 1e18) / normalizedRefPrice`. Se `normalizedRefPrice > normalizedTokenPrice * 1e18` (raro), risultato 0.

---

## 3. AaveV3LensAdapter

**Path**: `contracts/adapters/AaveV3LensAdapter.sol` (`^0.8.19`, `ILensAdapter, Ownable`).

### 3.1 Scopo
Query health/value delle posizioni Aave V3 possedute dal `AaveV3Plugin`. Aave V3 espone `getUserAccountData()` che aggrega tutto in USD 8-dec + healthFactor nativo scalato 1e18.

### 3.2 Immutables & config (righe 51–58)
- `beacon` (address immutable) → resolver.
- `aavePool` (IAaveV3Pool immutable) → **chain-injected**, es. `0x794a...4aD` su Arbitrum.
- `baseAssetCode` — **NON immutabile** (`string public`), sovrascrivibile a runtime? No, non c'è setter. Ma neanche `immutable`. Il gas cost è più alto del necessario. Vedi `ADP-005`.

### 3.3 Unit di lavoro
- **Aave "base"** = USD 8-decimals per convenzione Aave V3 (Arbitrum: la base è USD).
- **`_usdToBaseAsset` (righe 94–98)** delega a `TokenManager.convertUsdToBaseAsset(valueInUsd, 8)`.
- **`healthFactor`**: 1e18 scale nativo Aave. `type(uint256).max` quando no debt.
- **`currentLiquidationThreshold`**: Aave ritorna basis points (es. 8250 = 82.5%). Il codice moltiplica per `1e14` (riga 451) → `8250 * 1e14 = 8.25e17 = 0.825e18`. **Formula corretta** solo se i BP sono max 4 digits (10000 = 100%). Aave usa effettivamente 4 digits BP → OK.

### 3.4 Chi chiama chi
- `getUserAccountData(plugin)` — legge posizione dell'`AaveV3Plugin` risolto via Beacon.
- Ogni funzione (`getTotalValue`, `getValueBreakdown`, `getHealthFactor`, `getAccountHealth`, `getPositionHealth`, `getActivePositionCount`, `getProtocolSummary`, `getPositionsAtRisk`, `getPositionsSortedByRisk`, `estimateBaseAssetFromCloseAll`, `getLiquidationThreshold`) chiama **separatamente** `getUserAccountData(plugin)`. **No caching**: se ValueCalculator chiama `getValueBreakdown` seguito da `getHealthFactor`, sono due chiamate cross-contract identiche. Gas spreco moderato. Vedi `ADP-006`.

### 3.5 Yield info (righe 382–397)
- Chiama `aavePool.getReserveNormalizedIncome(underlying)` e `getReserveNormalizedVariableDebt`.
- **BUG matematico riga 393–394**: `getReserveNormalizedIncome` **NON** è un rate, è un **index cumulativo** partito a 1e27 (ray) che cresce nel tempo. `((index - 1e27) * 1e18) / 1e27` non è né APY né rate — è la crescita cumulativa dell'index dall'inizio della vita del reserve. Un reserve vecchio 2 anni potrebbe mostrare `supplyAPY = 5e17` (50%) totalmente falso. Per l'APY corretto si dovrebbe leggere `ReserveDataLegacy.currentLiquidityRate` (rate a ray). Vedi `ADP-007`.

### 3.6 Edge cases
- `estimatePositionAfterSwap` (riga 455–473): ritorna `(0, 0, 0)`. **Simplified / non implementata**. Non è un bug ma un no-op documentato.
- `getNetAPY` (riga 400–403): ritorna `0` (`pure`).
- `getPositionsSortedByRisk` (riga 333–377): quando `totalDebtBase == 0`, il codice usa `type(uint256).max` per `healthFactor` (riga 370) — corretto — ma `timeToLiquidation` per `hf < 1e18` è **hard-coded a `int256(3600)`** anziché `-1`; l'espressione condizionale è: `totalDebtBase == 0 ? type(int256).max : (hf < 1e18 ? int256(-1) : int256(3600))`. Il ramo `hf < 1e18` è effettivamente `-1`, ok. Ma `WARNING` branch usa 3600 secondi senza giustificazione — vedi `ADP-008`.

### 3.7 Assunzioni implicite
- Il `AaveV3Plugin` ha esattamente **una** address on-chain; non ci sono sub-accounts. Aave V3 usa un singolo account per address, corretto.
- L'`aavePool` non cambia dopo deploy (immutable). Se Aave upgrade cambia il pool address (via ACL), va rideployato. **Nessun setter**. Coerente con security model, ma peggiora upgradeability.

---

## 4. EulerLensAdapter

**Path**: `contracts/adapters/EulerLensAdapter.sol` (`^0.8.19`, `IEulerLensAdapter, ILensAdapter, Ownable`).

### 4.1 Scopo
Query health/value di **posizioni Euler V2** (leverage + simple deposits) del `EulerV2Plugin`. Diversamente da Aave, ogni posizione è isolata via sub-account XOR (Euler V2 model).

### 4.2 Immutables (righe 74–90)
- `beacon`, `accountLens`, `vaultLens`, `utilsLens`, `evcAddress`. Tutti `immutable`.
- `baseAssetCode` — **NON immutable** (stessa nota di Aave).
- Constructor: revert con `InvalidBeacon` per **tutti** i validation failures (righe 123–127). Poco preciso: se `_vaultLens == address(0)` reverte con `InvalidBeacon`. Vedi `ADP-009`.

### 4.3 Sub-account derivation
Righe 837–844 (`_getSubAccountAddress`) e 1232–1236 (`_deriveSubAccount`):
```
subAccount = address(uint160(main) ^ uint160(subAccountId))
```
**Duplicazione**: due helper equivalenti (`_getSubAccountAddress(main, id)` e `_deriveSubAccount(id)`), il secondo cabla `_getEulerV2Plugin()`. Cleanup opportuno. Vedi `ADP-010`.

### 4.4 Formula health factor (righe 175–184, 287, 307, 827)
```
HF = collateralValueBorrowing * 1e18 / liabilityValueBorrowing
```
- `collateralValueBorrowing` e `liabilityValueBorrowing` provengono da `IAccountLens.getAccountLiquidityInfo(subAccount, controllerVault)`.
- Secondo la doc Euler V2, `collateralValueBorrowing` è già **weighted per LTV** (borrow context = LTV borrowing applicato). Quindi `HF = weighted_collateral / debt`. Formula OK.
- Ma in `getHealthFactor()` (implementazione ILensAdapter, riga 175–184) c'è invece:
  ```
  healthFactor = (totalCollateral * 80 * 1e18) / (totalDebt * 100)
  ```
  → HF assumendo LTV 80% **hard-coded**. Questo è un **secondo modello di HF**, diverso da quello per posizione singola (righe 287, 307, 827). Inconsistenza pesante: aggregata usa 80% fisso, per-position usa Euler lens. Vedi `ADP-011`.

### 4.5 `_calculateTotalValues` (righe 643–693)
- Itera `getAllRegisteredTokens()`, per ciascuno prende `plugin.getBalance(tokenCode)` e `plugin.getDebt(tokenCode)`, poi converte a base asset.
- Aggiunge `_calculateLeverageValues()`: itera **tutte** le `LeveragePositionStorage` (attive e non!) con `if (!positions[i].isActive) continue`.
- **Bug logico riga 700–728 (`_calculateLeverageValues`)**:
  - `collateral += initialVal + borrowVal` (riga 723)
  - `debt += borrowVal` (riga 726)
  - Assume che la leverage sia **1 loop**: initial collateral + borrowed value convertito nella stessa denomination. Ma:
    - `initialVal` e `borrowVal` sono ENTRAMBI in base asset, quindi somma dimensionalmente valida.
    - Non considera che il valore reale del collaterale può essere diverso (interest accrued, price movement). Usa dati **iniziali** memorizzati in registry, non lo stato corrente del vault. `pos.initialCollateral` è un valore storico.
  - **Doppio conteggio**: `_calculateTotalValues` somma `balance` da `plugin.getBalance(tokenCode)` (che include il collaterale corrente della leverage!) più `initialVal + borrowVal` da leverage. Se il plugin traccia balance = shares nel vault, viene contato due volte. Vedi `ADP-012` (severity HIGH).

### 4.6 `_convertToBaseAssetValue` (righe 736–789)
- Cerca `tokenCode` iterando `getAllVaults()` per matching `IEVault(vault).asset() == token`. **O(n)** per ogni conversione, chiamata più volte per position.
- Se `token == BASE_ASSET`, ritorna `amount` senza conversione. Assume che `BASE_ASSET` sia sempre in unità coerenti col resto.
- Formula cross-rate riga 785:
  ```
  valueInBaseAsset = amount * tokenPrice * 10^baseDecimals / (baseAssetPrice * 10^tokenDecimals)
  ```
  - `tokenPrice` e `baseAssetPrice` da `TokenManager.getTokenPriceForModule` (18-dec canonical). OK dimensionalmente.
  - Precision loss se `amount` piccolo e `baseAssetPrice` grande: `amount * tokenPrice * 10^baseDecimals` potrebbe overflow se `amount` è grande (es. `1e30 * 3000e18 * 1e18 = 3e69` — supera `2^256 ~ 1.15e77` OK, ma vicino al bordo). Vedi `ADP-013`.
- `IERC20Metadata(token).decimals()` chiamato **due** volte per ogni conversione senza caching. Gas waste. Vedi `ADP-014`.

### 4.7 Bubble sort O(n²) — `getPositionsSortedByHealth` (righe 599–608)
Bubble sort su tutte le posizioni. Se il registry ha centinaia di posizioni, la view function può eccedere il gas limit del block (view può leggere fino a `blockGasLimit` in eth_call, ma se chiamata on-chain overhead è pesante). MorphoLensAdapter usa insertion sort (`getPositionsSortedByRisk`, righe 519–527). Vedi `ADP-015`.

### 4.8 `getLiquidationThreshold` (righe 1125–1148)
```
threshold = (debtVal * 10000) / 8300
```
Hard-coded LTV 83% e "1.05 buffer". Non ha significato reale: il liquidation threshold di Euler dipende dal `LTV_LIQ` per la specifica coppia collateral/borrow del vault. Ritornare valore hard-coded è **fuorviante**. Vedi `ADP-016`.

### 4.9 `getVaultAPYs` (righe 531–561)
- Utilizzazione = `totalBorrows / totalAssets` (OK).
- APY interpolato linearmente tra `0.03e18` (3%) e `0.15e18` (15%). **Completamente inventato** — non riflette il vero interest rate model di Euler. Documentato "simplified model" ma esposto senza warning al chiamante. Vedi `ADP-017`.

### 4.10 Timing anomalie
- `_getTimeToLiquidationInternal` (righe 1097–1118): rate annuo `0.1e18` (10%) hard-coded per calcolo `ttl`. Non ha alcun senso quantitativo.

### 4.11 Fallback path leverage HF (righe 810–828)
```solidity
liquidity = lens.getAccountLiquidityInfo(subAccount, pos.borrowVault);
if (liquidity.queryFailure || liquidity.liabilityValueBorrowing == 0) {
    liquidity = lens.getAccountLiquidityInfo(pluginAddr, pos.borrowVault);
}
```
Fallback al `pluginAddr` (main) se sub-account non ha debt. Commento spiega il caso "atomic leverage prima che sub-account fosse completato". Ma:
- Se il main **ha una posizione diversa** dallo stesso `borrowVault`, l'HF ritornato è quello del main — non quello della leverage specifica. **Confusione** tra posizioni. Vedi `ADP-018`.

---

## 5. MorphoLensAdapter

**Path**: `contracts/adapters/MorphoLensAdapter.sol` (`^0.8.27`, `ILensAdapter, Ownable`).

### 5.1 Scopo
Query health/value delle posizioni Morpho Blue del `MorphoPlugin`. Morpho è a **markets isolati** — ogni market è identificato da `(loanToken, collateralToken, oracle, irm, lltv)`.

### 5.2 Costanti (righe 47–53)
- `ORACLE_PRICE_SCALE = 1e36` (Morpho standard, prezzo di 1 unit collateral in loan token units, scalato).
- `WAD = 1e18`.
- `DEFAULT_SAFE_HEALTH_FACTOR = 1.5e18`.

### 5.3 Formula Health Factor (righe 159–179, `_computeMarketHF`)
```
debtAssets = ceil(borrowShares * totalBorrowAssets / totalBorrowShares)
collateralValue = collateral * oraclePrice / 1e36    // in loan token units
HF = collateralValue * lltv / (debtAssets * WAD)
```
- Confronto con la formula ufficiale Morpho (`libraries/MorphoBalancesLib`): HF = `collateralValue * lltv / (borrowAssets * WAD)`, dove `collateralValue = collateral * price / ORACLE_PRICE_SCALE`. **Match esatto**. OK.
- `debtAssets` usa **round-up** (`+ totalBorrowShares - 1`) — coerente col round-up di Morpho su repay. OK.

### 5.4 Precision considerations
- `collateral * oraclePrice`: collateral è `uint128` (fino a `2^128 - 1 ≈ 3.4e38`), `oraclePrice` è tipicamente 1e36 × ratio. Overflow teorico solo per collateral > 2^128 / 1e36 ≈ 340e2 = 34000 nell'ordine di grandezza di 10^38. Praticamente OK.
- `debtAssets * WAD`: `debtAssets` è `uint256` (senza cap). Se `debtAssets > 2^256 / 1e18 ≈ 1.15e59`, overflow. Impossibile.
- **Round-down HF** vs **round-up debtAssets**: il round-up `debtAssets` rende HF più **basso** (più prudente per liquidazioni). OK.
- **Precision loss**: se `lltv` è espresso in WAD (0.8e18 per 80% lltv), `collateralValue * lltv / (debtAssets * WAD)` è quindi divisione di due WAD-scaled numbers → 1.0 = 1e18. OK.

### 5.5 `_getPositionValue` (righe 129–154)
- Converte collateral in loan-token units usando oracle Morpho.
- Poi converte a base asset via `_toBaseAsset(loanToken, loanCode, collateralValueInLoan)`.
- **Assunzione**: il prezzo Morpho oracle e il prezzo Chainlink (via TokenManager) sono coerenti. Non c'è alcun cross-check. Vedi `ADP-019`.
- Non usa il prezzo di collateralToken separato — assume che l'oracle Morpho sia già un buon proxy del rapporto. Corretto per il calcolo HF, ma **il valore in base asset è basato sul prezzo del loanToken**, non del collateralToken. Se un utente ha WETH come collateral e USDC come loan, il valore reale della collateral è `WETH_price * amount`, ma qui lo calcoliamo come `(collateral * oraclePrice / 1e36) * USDC_price / baseAssetPrice`. Se `oraclePrice = WETH/USDC` e `USDC_price = 1e18`, il risultato è `collateral * WETH_price_relative_to_USDC / baseAssetPrice`. Semanticamente OK ma **dipende** dalla correttezza di `oraclePrice`. Rischio: se l'oracle Morpho è manipolato o obsoleto, il TVL è sbagliato.

### 5.6 `_toBaseAsset` (righe 105–124)
Formula identica a Euler: `amount * tokenPrice * 10^baseDecimals / (baseAssetPrice * 10^tokenDecimals)`. Coerente.

### 5.7 `getYieldInfo` / `getNetAPY` (righe 533–546)
Ritornano `0` (`pure`). Nessuna query all'IRM del market. **Silenziosamente inutile**, ma coerente con il fatto che Morpho borrow rate richiede una chiamata separata. Vedi `ADP-020` (bassa gravità).

### 5.8 Iterazione mercati
Ogni funzione (`getTotalValue`, `getValueBreakdown`, `getHealthFactor`, `getAccountHealth`, `getActivePositionCount`, `getProtocolSummary`, `getPositionsAtRisk`, `getPositionsSortedByRisk`, `estimateBaseAssetFromCloseAll`) itera `registry.getRegisteredMarkets()` **da capo**. **Nessuna cache**. Ogni iterazione fa: `registry.getMarketParams(...)` → `params.id()` (keccak256!) → `morpho.position(id, plugin)` + `morpho.market(id)` + `oracle.price()`. Costoso. Vedi `ADP-021`.

### 5.9 `getPositionsAtRisk` — bug potenziale
Righe 419–431: nel primo pass conta solo posizioni con `borrowShares > 0`. Nel secondo pass, popola l'array con la stessa condizione. Coerente.
Ma **non chiama `_getPositionValue`** per posizioni con `borrowShares == 0 && collateral > 0` (posizioni con solo collaterale ma nessun debito → HF infinito → mai a rischio → correttamente escluse).

### 5.10 `getVaultForToken` — semantica strana (righe 550–564)
Se `tokenCode` compare come **collateral** in almeno un market, ritorna l'address di `morpho` (il singleton!). Altrimenti `address(0)`. Interpretazione: "esiste un market per questo token" → ritorna il router Morpho. Semanticamente confuso perché Morpho non ha "vault per token", ha markets. Vedi `ADP-022`.

---

## 6. MorphoVaultLensAdapter

**Path**: `contracts/adapters/MorphoVaultLensAdapter.sol` (`^0.8.27`, `ILensAdapter, Ownable`).

### 6.1 Scopo
Query dei balance in **MetaMorpho vaults** (ERC-4626) del `MorphoVaultPlugin`. **No liquidation risk** (supply-only).

### 6.2 Registry condiviso
Legge `MorphoRegistry.getRegisteredVaults()`, `getVaultConfig(vault)`, `getDefaultVault(assetCode)`.

### 6.3 `_toBaseAsset` (righe 69–102)
- Itera `getRegisteredVaults()` per matching `IERC4626(vaults[i]).asset() == token`. **O(n)** per ogni conversione.
- Restituisce `0` se `!found`. **Silent failure**: se il vault non è registrato in `MorphoRegistry` ma il plugin ha comunque balance nel vault, il valore viene contato come 0 e non c'è alcun warning.

### 6.4 `_getTotalVaultValue` (righe 107–117)
- Chiama `plugin.getAllVaultPositions()` per `(vaults[], balances[])`.
- **Assunzione fondamentale**: `balances[i]` è **già in asset units** (già convertito da shares → assets dal plugin). Se il plugin restituisce shares, l'output è totalmente scorretto. Da verificare in `MorphoVaultPlugin.getAllVaultPositions()`.

### 6.5 Health functions
`getHealthFactor`, `getPositionHealth`, `getAccountHealth` — tutti ritornano `type(uint256).max` (SAFE). `getPositionsAtRisk` ritorna array vuoto. Coerente col caso supply-only. OK.

### 6.6 `getProtocolLimits` — semantica strana
```
minHealthFactor = type(uint256).max
maxLeverage = 100     // 1x only
```
`minHealthFactor = max` significa "infinito minimo richiesto" — questo è **fuorviante**: dovrebbe essere `type(uint256).max` = "nessun limite" o `1e18` = safe threshold. Se un `LiquidityManager` scan questo lens con condizione `hf < minHealthFactor`, con `minHealthFactor = max`, TUTTE le posizioni sono "at risk". Coincidenza fortunata: `getPositionsAtRisk` ritorna sempre `[]`. Ma la semantica è confusa. Vedi `ADP-023`.

---

## 7. FlashLoanService

**Path**: `contracts/services/FlashLoanService.sol` (`^0.8.27`, `IFlashLoanRecipient, ReentrancyGuard`).

### 7.1 Scopo
Wrapper unificato per flash loans **Balancer V2** (0% fee) + swap centralizzato via `SimpleSwap` (Uniswap V3 wrapper). Deployato una sola volta, riusato da tutti i plugin.

### 7.2 Constants (righe 51–54)
- `BALANCER_VAULT = 0xBA12222222228d8Ba445958a75a0704d566BF2C8` — **stesso indirizzo** su tutte le chain. Hard-coded.
- `SIMPLE_SWAP = 0xa0DB78167CBAccD47524a261b7741C6B41Bbd096` — **specifico Arbitrum**. Se deployato su altra chain, questo indirizzo è scorretto e non c'è possibilità di override. Vedi `ADP-024`.

### 7.3 Immutable `beacon` (righe 58–59, 113–116)
Beacon usato per verifica plugin registrati.

### 7.4 State
- `_inFlashLoan` (bool): flag durante `executeFlashLoan → receiveFlashLoan`.
- `_swapping` (bool): reentrancy guard manuale per `swap()` fuori flash loan.
- `_context: FlashLoanContext`: caller + callbackData salvati per callback.

### 7.5 `executeFlashLoan` (righe 130–171)
- `nonReentrant` (OZ) + check `!_inFlashLoan` (defense-in-depth).
- Layer 1: `_isRegisteredPlugin(msg.sender)` (righe 383–397 — itera **tutti** i moduli del Beacon cercando match).
- Salva `_context`, chiama `IBalancerVault.flashLoan(this, tokens, amounts, "")`.
- Cleanup: `_inFlashLoan = false; delete _context;`.

**Issue**: Il chiamante può essere **qualsiasi plugin registrato**, incluso plugin che non implementano `IFlashLoanCallback`. Se il plugin non implementa `onFlashLoanReceived`, `receiveFlashLoan` reverta al `IFlashLoanCallback(ctx.caller).onFlashLoanReceived(...)` (riga 204). OK, il revert propaga. Ma potrebbero esserci plugin registrati **NON pensati** per flash loan (es. registry, oracle-adapter registrati anch'essi). Se qualcuno riesce a chiamare `executeFlashLoan` da uno di questi contratti (ad es. tramite delegate call), avrebbe successo il layer 1 check. Vedi `ADP-025`.

### 7.6 `receiveFlashLoan` (righe 182–228)
- Check `msg.sender == BALANCER_VAULT`.
- Check `_inFlashLoan == true` (previene chiamate dirette Balancer→noi non iniziate).
- Trasferisce token al `caller`.
- Chiama `caller.onFlashLoanReceived(...)`.
- Ripaga Balancer: `amounts[i] + feeAmounts[i]` per ciascun token. Assume che il caller abbia trasferito i token indietro **al FlashLoanService** (non a Balancer direttamente).

**Issue**: nessun controllo che `initiator == address(this)` (il pattern classico Aave). Balancer V2 flashLoan non passa initiator nel callback, quindi il pattern usato qui (flag storage) è l'unico modo. **Sufficiente** se `_inFlashLoan` è settato correttamente. OK.

### 7.7 Nested flash loan
- `_inFlashLoan` viene messo a true prima di `flashLoan` (riga 152). Se durante `onFlashLoanReceived` il plugin chiama di nuovo `executeFlashLoan`, questa **è protetta dall'OZ `nonReentrant`** modifier (riga 134). ✅
- Ma **swap() è chiamabile durante flash loan** (righe 250–254 saltano il `_swapping` check se `_inFlashLoan`). Corretto per lo use case (swap all'interno del flash loan), ma **elimina il ReentrancyGuard sullo swap**. Se `SIMPLE_SWAP` (esterno, non-trusted?) ha reentrancy, potrebbe rientrare. Rischio basso perché `SIMPLE_SWAP` è controllato dal team, ma vale la pena flag.

### 7.8 `swap` (righe 243–284)
- Se `!_inFlashLoan`, applica reentrancy guard manuale (`_swapping` bool). **Non usa `nonReentrant`**. Perché? Perché `nonReentrant` blocca anche il caso `flashLoan→swap`. Ok, ma la gestione manuale del reentrancy è meno robusta.
- Trasferisce da `msg.sender` a `this`, chiama `SIMPLE_SWAP.inputSwap`, ritorna a `msg.sender`.
- `safeIncreaseAllowance` (riga 266): OK, no double-approval issue.
- Manca **`safeApprove(0)`** o azzeramento dell'allowance dopo lo swap. Se `SIMPLE_SWAP` non consuma esattamente `amountIn`, residuo di allowance rimane. Best practice: azzerare. Vedi `ADP-026`.
- **Slippage**: `inputSwap` non passa `minAmountOut`, il servizio si affida al check `amountOut == 0 → revert`. Ma `amountOut > 0` non implica assenza di sandwich attack. Il caller DOVREBBE passare `minAmountOut`. **Manca** questo parametro. Vedi `ADP-027` (severity HIGH).
- Dopo lo swap, `IERC20(tokenOut).safeTransfer(msg.sender, amountOut)`: OK.
- Cleanup `_swapping = false` fatto in **3 branch diversi** (righe 258, 272, 281). Se un revert avviene tra `_swapping = true` e reset, `_swapping` rimane a `true` per sempre (poiché la revert unwinda tutto MA il storage è già stato scritto? No: in EVM, revert unwind tutto lo storage. OK.). Ma se il revert è **catchato** (`try/catch` esterno), lo storage viene mantenuto. `swap()` è external, quindi in un `try/catch` — il revert non ripristina lo state se qualcun altro cattura. Vedi `ADP-028`.

### 7.9 `_isRegisteredPlugin` (righe 383–397)
Itera `beacon.getRegisteredModules()`. **O(n) per ogni chiamata**. Se il Beacon ha 20 moduli, 20 calls di `getImplementation` per ogni flash loan / swap. Gas moderato. Vedi `ADP-029` (bassa gravità).

### 7.10 `getExpectedOutput` (righe 293–308) + fallback
- Chiama `SIMPLE_SWAP.getExpectedOutput` con try/catch.
- Fallback: `_estimateViaTokenManager` (via `this.estimateFromTokenManager`, external, per beneficiare di `try/catch`).
- Ultimo fallback: conversione 1:1 (`amountIn * 10^decimalsOut / 10^decimalsIn`). **PERICOLOSO** se questo output viene usato per slippage / preview di deposito. Un caller che si fida ciecamente di `getExpectedOutput` (che non revert e ritorna sempre qualcosa) potrebbe accettare valori totalmente scorretti. Vedi `ADP-030` (HIGH).

### 7.11 `estimateFromTokenManager` (righe 342–371)
- Itera `getActiveTokens()` per matching address. **O(n)**.
- `require(priceIn > 0 && priceOut > 0, "Price not found")` — se falla, `try/catch` nel wrapper svela `catch` che ritorna 0 → cascata al fallback 1:1 (**pericoloso**).

---

## 8. Mocks

### 8.1 MockChainlinkOracle
**Path**: `contracts/MockChainlinkOracle.sol` (`^0.8.19`).

- `setAnsweredInRound`, `setUpdatedAt`, `setShouldFail`, `makeStale` — helper utili per test negativo.
- Missing check nel constructor: `initialPrice > 0` non è richiesto. Con `initialPrice = 0`, il feed si comporta come "invalid price" → `ChainlinkAdapter.setPriceFeed` reverta correttamente. OK.
- **`updatePrice` è NON permissioned**: chiunque può cambiare il prezzo. Ovviamente per test è OK, ma se il mock viene deployato in un ambiente pseudo-prod (es. testnet pubblica), è manipolabile. Vedi `ADP-031`.
- `getRoundData(_roundId_)` (righe 122–143) ritorna **`_price` corrente** per QUALSIASI round richiesto. Non è realistico — un vero Chainlink aggregator ha storico. Test negativi che verificano round data storiche NON funzionano. Vedi `ADP-032`.
- `startedAt = _updatedAt - 100` hard-coded. Ok per test.

### 8.2 MockERC20
**Path**: `contracts/MockERC20.sol` (`^0.8.19`).

- Implementation di base, senza `SafeERC20`.
- `mint` e `burn` sono **PUBBLICI e non permissioned** (righe 60–71). Chiunque può mintare `type(uint256).max` a qualsiasi indirizzo. Ovviamente OK per test, catastrofico in prod. Vedi `ADP-033`.
- `totalSupply` viene incrementato in `mint` senza check di overflow (0.8.19 ha SafeMath integrato, quindi va in revert). OK.
- **Non conforme completo a ERC-20**: manca `Approval` event su alcune transitions (es. `transferFrom` non emette `Approval` per il decrement dell'allowance) — noto pattern minore che alcune integrazioni si aspettano.
- **Missing** `permit` (EIP-2612) — non è richiesto per compliance ERC-20 base.

### 8.3 MockWETH
**Path**: `contracts/MockWETH.sol` (`^0.8.19`, eredita `ERC20` OZ).

- `deposit` e `receive` mintano 1:1.
- `withdraw` (righe 28–34): burn e `msg.sender.call{value: amount}("")`. **No reentrancy guard**! Ma il pattern è checks-effects-interactions (`_burn` prima di `call`), quindi safe per il classico reentrancy. Comunque non ha guardia esplicita. OK.
- **Rischio uso in prod**: molto meno grave di MockERC20 (non ha mint arbitrario). Ma la deposit ha `require(msg.value > 0)` mentre `receive` no. Divergenza minore. Vedi `ADP-034` (bassa).

### 8.4 Rischio "mock in prod"
- **Nessun mock è marcato `abstract` o ha una guard di deploy**. Un errore di deploy script può portarli in mainnet.
- **Nessun costruttore aggiuntivo** che richieda flag "TEST_ONLY" (pattern comune).
- Il file `MockChainlinkOracle.sol` è in `contracts/` (root), **NON** in `contracts/mocks/` (esiste `contracts/mocks/`), il che è preoccupante per il deployment tooling. Vedi `ADP-035`.

---

## 9. Integrazioni cross-module

| Componente | Legge da | Scrive/interagisce con |
| ---------- | -------- | ---------------------- |
| ChainlinkAdapter | Chainlink AggregatorV3 | — (view) |
| TokenManager (esterno) | ChainlinkAdapter | Espone `getTokenPriceForModule`, `getBaseAssetPrice`, `convertUsdToBaseAsset` |
| AaveV3LensAdapter | `aavePool.getUserAccountData`, `TokenManager.convertUsdToBaseAsset`, `AaveV3Plugin.circuitBreakerTripped()` (staticcall) | — (view) |
| EulerLensAdapter | `AccountLens.getAccountLiquidityInfo`, `EVC.getControllers`, `EVault.balanceOf/debtOf/convertToAssets/asset`, `EulerRegistry`, `EulerV2Plugin.getBalance/getDebt/isCircuitBreakerActive` | — (view) |
| MorphoLensAdapter | `Morpho.position/market`, `IMorphoOracle.price()`, `MorphoRegistry`, `MorphoPlugin.circuitBreakerTripped` | — (view) |
| MorphoVaultLensAdapter | `IERC4626.asset`, `MorphoRegistry`, `MorphoVaultPlugin.getAllVaultPositions/getActiveVaultCount/circuitBreakerTripped` | — (view) |
| FlashLoanService | `Beacon.getRegisteredModules`, `TokenManager` (fallback), `SimpleSwap` | `BalancerVault.flashLoan`, plugin.`onFlashLoanReceived`, `SimpleSwap.inputSwap`, IERC20 transfers |

---

## 10. Contract size warning

`EulerLensAdapter` ha ~1276 righe e importa molte interfacce. Alcune funzioni sono duplicate (bubble sort + insertion sort altrove, sub-account derivation duplicata, `_getPositionHealthFactor` ha branch di fallback). Rischio di eccedere il limite EIP-170 (24 KiB deployed code). Si dovrebbe controllare `hardhat compile --show-stack-traces`.

`MorphoLensAdapter` è ~618 righe, più contenuto ma ancora sostanzioso.

---

## 11. Sintesi rischi cross-adapter

1. **Nessun adapter cache il risultato di query esterne** dentro la stessa transazione. Ogni funzione top-level rilegge da capo.
2. **Nessun adapter valida che `msg.sender`** sia un caller autorizzato — sono view, va bene, ma **non ci sono guard su chi può stampare eventi**. Nessuno emesso da funzioni view, quindi OK.
3. **`Ownable` non usato** in nessun adapter (nessuna funzione `onlyOwner`). Ereditarietà inutile. Sostituibile con nessuna.
4. **Discrepanza tra logica per-position e aggregata** in Euler adapter (LTV 80% hard-coded vs valori Euler lens).
5. **Denomination checking per Chainlink referenceFeed è assente** — assumere che l'operator configuri correttamente.
6. **Nessun adapter L2 sequencer check**. Su Arbitrum, se il sequencer è down, i feed possono avere prezzi obsoleti che passano l'heartbeat check.
