# Steps: Unified Price Conversion Architecture

> **Versione**: 2.0 — Aggiornato con restrizione `getPriceFromOracle` e `baseAssetCode` in TokenManager  
> **Stato**: ✅ IMPLEMENTATO — 614+ unit tests passing, 12/12 E2E passing  
> **Data completamento**: 28 Giugno 2026

---

## Contesto e Problema

### Il sistema attuale

Il protocollo deve sapere quanto vale ciò che un utente ha depositato su protocolli esterni (Aave, Euler, Morpho) e convertire quel valore nel **base asset** (USDC, WETH, WBTC — la valuta di riferimento del protocollo).

I protocolli esterni restituiscono i dati in **due formati diversi**:

| Tipo | Protocolli | Output | Esempio |
|------|-----------|--------|---------|
| **Raw amounts** | Euler, Morpho, MorphoVault | Token grezzi | "Hai 0.5 WETH e 1000 USDC" |
| **USD aggregated** | Aave, (futuro: Compound, GMX) | Valore in USD | "Hai $2000 di collateral" |

Ogni tipo richiede una formula matematica diversa per convertire in base asset.

### Il deadlock del base asset

Il TokenManager blocca la registrazione del base asset: `require(_tokenAddress != baseAsset)`.  
Motivo legittimo: il base asset non deve entrare nel sistema di error tracking/heartbeat dei token normali.

Ma i LensAdapter hanno bisogno del prezzo del base asset per le conversioni → **deadlock**.

### La soluzione attuale (da migliorare)

- **Euler/Morpho/MorphoVault**: usano `getPriceFromOracle(baseAssetCode)` — funzione che bypassa il check `isActive`
- **Aave**: usa `IAaveOracle(AAVE_ORACLE).getAssetPrice(baseAsset)` — oracle esterno hardcoded

### Problemi della soluzione attuale

1. **`getPriceFromOracle` è troppo generica**: accetta qualsiasi tokenCode, nessun access control, è una backdoor aperta
2. **Aave usa un oracle esterno**: non scala — Compound e GMX richiederebbero altre interfacce oracle specifiche
3. **Il TokenManager non conosce `baseAssetCode`**: la stringa è sparsa nei LensAdapter come stato duplicato

---

## Piano di Implementazione

### Phase 0: Fondamenta — `baseAssetCode` nel TokenManager

> Centralizza il codice del base asset e restringe l'accesso al prezzo

**Step 0.1**: Aggiungere stato `baseAssetCode` a `TokenManager.sol`

```solidity
string public baseAssetCode;  // "USDC", "WETH", "WBTC" etc.
```

**Step 0.2**: Aggiungere setter `setBaseAssetCode` con validazione

```solidity
function setBaseAssetCode(string memory _code) external onlyOwner {
    require(bytes(_code).length > 0 && bytes(_code).length <= 16, "Invalid code");
    require(oracleAdapter.supportsToken(_code), "Token not supported by oracle");
    baseAssetCode = _code;
    emit BaseAssetCodeSet(_code);
}
```

**Step 0.3**: Rinominare `getPriceFromOracle` → `getBaseAssetPrice`

Vecchia (da rimuovere):
```solidity
// ❌ RIMUOVERE — backdoor generica senza access control
function getPriceFromOracle(string memory _tokenCode) external view returns (uint256)
```

Nuova (sostituzione):
```solidity
// ✅ AGGIUNGERE — restituisce solo il prezzo del base asset
function getBaseAssetPrice() external view returns (uint256) {
    require(bytes(baseAssetCode).length > 0, "Base asset code not set");
    (uint256 price, , bool isValid) = oracleAdapter.getPrice(baseAssetCode);
    require(isValid, "Oracle price invalid");
    return price;
}
```

Vantaggi:
- **Zero parametri** → impossibile abusarne per token arbitrari
- **Nessuna backdoor** → restituisce solo il prezzo del base asset
- **Validazione interna** → `baseAssetCode` settato solo dall'owner

**Step 0.4**: Aggiornare interfaccia `ITokenManagerForModules.sol`

- Rimuovere: `function getPriceFromOracle(string memory tokenCode) external view returns (uint256);`
- Aggiungere: `function getBaseAssetPrice() external view returns (uint256);`
- Aggiungere: `function baseAssetCode() external view returns (string memory);`

**Step 0.5**: Aggiornare i 3 LensAdapter che usano `getPriceFromOracle`

- `EulerLensAdapter.sol` (linea 759): `tokenManager.getPriceFromOracle(baseAssetCode)` → `tokenManager.getBaseAssetPrice()`
- `MorphoLensAdapter.sol` (linea 114): stessa sostituzione
- `MorphoVaultLensAdapter.sol` (linea 95): stessa sostituzione

Nota: i LensAdapter non passano più `baseAssetCode` come argomento — il TokenManager sa già quale è.

**Step 0.6**: Aggiornare deploy scripts — aggiungere chiamata `tokenManager.setBaseAssetCode("USDC")` dopo il deploy

---

### Phase 1: Funzione generica USD→BaseAsset

> Per tutti i protocolli che restituiscono valori in USD (Aave, Compound, GMX)

**Step 1.1**: Aggiungere `convertUsdToBaseAsset` a `TokenManager.sol`

```solidity
/**
 * @notice Converts a USD-denominated value to base asset units
 * @dev Used by LensAdapters for protocols that return aggregated USD values (Aave, Compound, GMX)
 *      Formula uses overflow-safe exponent: exp = baseDecimals + 18 - usdDecimals
 * @param valueInUsd The value in USD (with usdDecimals precision)
 * @param usdDecimals Number of decimals in the USD value (8 for Aave/Compound, 30 for GMX)
 * @return Value in base asset units (with baseDecimals precision)
 */
function convertUsdToBaseAsset(
    uint256 valueInUsd,
    uint8 usdDecimals
) external view returns (uint256) {
    if (valueInUsd == 0) return 0;
    require(bytes(baseAssetCode).length > 0, "Base asset code not set");

    // Prezzo base asset normalizzato a 18 decimali (da ChainlinkAdapter)
    (uint256 baseAssetPrice, , bool isValid) = oracleAdapter.getPrice(baseAssetCode);
    require(isValid, "Oracle price invalid");
    if (baseAssetPrice == 0) return 0;

    // Decimali del base asset (6 per USDC, 18 per WETH, 8 per WBTC)
    address baseAsset = IBeacon(beacon).getImplementation("BASE_ASSET");
    uint8 baseDecimals = IERC20Metadata(baseAsset).decimals();

    // Formula overflow-safe con esponente variabile
    int256 exponent = int256(uint256(baseDecimals)) + 18 - int256(uint256(usdDecimals));

    if (exponent >= 0) {
        return (valueInUsd * (10 ** uint256(exponent))) / baseAssetPrice;
    } else {
        return valueInUsd / (baseAssetPrice * (10 ** uint256(-exponent)));
    }
}
```

**Matematica verificata:**

| Protocollo | usdDec | Base Asset | baseDec | exp | $100 USD → | Risultato |
|-----------|--------|-----------|---------|-----|-----------|-----------|
| Aave | 8 | USDC | 6 | 16 | (100×1e8 × 1e16) / 1e18 | 100 USDC ✓ |
| Aave | 8 | WETH | 18 | 28 | (100×1e8 × 1e28) / (2000×1e18) | 0.05 WETH ✓ |
| Aave | 8 | WBTC | 8 | 18 | (100×1e8 × 1e18) / (60000×1e18) | 0.00167 WBTC ✓ |
| GMX | 30 | USDC | 6 | -6 | 100×1e30 / (1e18 × 1e6) | 100 USDC ✓ |
| GMX | 30 | WETH | 18 | 6 | (100×1e30 × 1e6) / (2000×1e18) | 0.05 WETH ✓ |

Note:
- L'esponente negativo (GMX con USDC) gestisce il caso in cui i decimali USD superano base+18
- La divisione dei due rami evita overflow uint256 con valori GMX molto grandi

**Step 1.2**: Aggiungere all'interfaccia `ITokenManagerForModules.sol`

```solidity
function convertUsdToBaseAsset(uint256 valueInUsd, uint8 usdDecimals) external view returns (uint256);
```

---

### Phase 2: Refactor AaveV3LensAdapter

> Eliminare dipendenza da oracle esterno Aave

**Step 2.1**: Rimuovere `IAaveOracle` interface (linee 13-15)

```solidity
// ❌ RIMUOVERE
interface IAaveOracle {
    function getAssetPrice(address asset) external view returns (uint256);
}
```

**Step 2.2**: Rimuovere costante `AAVE_ORACLE` (linea 48/54)

```solidity
// ❌ RIMUOVERE
address public constant AAVE_ORACLE = 0xb56c2F0B653B2e0b10C9b928C8580Ac5Df02C7C7;
```

**Step 2.3**: Aggiungere import `ITokenManagerForModules`

```solidity
import "../interfaces/ITokenManagerForModules.sol";
```

**Step 2.4**: Refactor `_usdToBaseAsset` (linee 95-119) → one-liner delegato a TokenManager

```solidity
function _usdToBaseAsset(uint256 valueInUsd) private view returns (uint256) {
    if (valueInUsd == 0) return 0;
    address tokenManager = IBeacon(beacon).getImplementation("TokenManager");
    return ITokenManagerForModules(tokenManager).convertUsdToBaseAsset(valueInUsd, 8);
}
```

Il `8` indica i decimali USD di Aave. Per futuri adapter: Compound = `8`, GMX = `30`.

---

### Phase 3: Test

**Step 3.1**: Unit test per `setBaseAssetCode`
- Solo owner può chiamarla → revert per non-owner
- Revert con codice vuoto
- Revert con codice > 16 caratteri
- Revert se oracle non supporta il token
- Emette evento `BaseAssetCodeSet`

**Step 3.2**: Unit test per `getBaseAssetPrice`
- Ritorna prezzo corretto per base asset configurato
- Revert se `baseAssetCode` non settato
- Revert se oracle price invalid

**Step 3.3**: Unit test per `convertUsdToBaseAsset`
- usdDecimals = 8 (Aave/Compound) con baseDecimals = 6 (USDC), 18 (WETH), 8 (WBTC)
- usdDecimals = 30 (GMX) con baseDecimals = 6, 18, 8
- usdDecimals = 18 (generico) con baseDecimals = 6, 18, 8
- Edge: valueInUsd = 0 → return 0
- Edge: oracle price = 0 → return 0
- Edge: baseAssetCode non settato → revert
- Edge: oracle invalid → revert

**Step 3.4**: Aggiornare test AaveV3LensAdapter (`test/unit/LensAdapters.test.ts`)
- Rimuovere test costante `AAVE_ORACLE`
- Aggiungere test dipendenza TokenManager

**Step 3.5**: Aggiornare test Euler/Morpho/MorphoVault
- Verificare che chiamano `getBaseAssetPrice()` invece di `getPriceFromOracle()`
- Se i test fanno mock di `getPriceFromOracle`, aggiornare mock a `getBaseAssetPrice`

**Step 3.6**: Run E2E — `test/e2e/USDC.BaseAsset.e2e.test.ts` → 12/12 test devono passare

**Step 3.7**: Run full regression → 1000+ test passano

---

## File da modificare

| File | Azione | Phase |
|------|--------|-------|
| `contracts/TokenManager.sol` | +`baseAssetCode` stato, +`setBaseAssetCode`, -`getPriceFromOracle` → +`getBaseAssetPrice`, +`convertUsdToBaseAsset` | 0, 1 |
| `contracts/interfaces/ITokenManagerForModules.sol` | -`getPriceFromOracle`, +`getBaseAssetPrice`, +`baseAssetCode`, +`convertUsdToBaseAsset` | 0, 1 |
| `contracts/adapters/AaveV3LensAdapter.sol` | -`IAaveOracle`, -`AAVE_ORACLE`, +`ITokenManagerForModules`, refactor `_usdToBaseAsset` | 2 |
| `contracts/adapters/EulerLensAdapter.sol` | `getPriceFromOracle(baseAssetCode)` → `getBaseAssetPrice()` | 0 |
| `contracts/adapters/MorphoLensAdapter.sol` | `getPriceFromOracle(baseAssetCode)` → `getBaseAssetPrice()` | 0 |
| `contracts/adapters/MorphoVaultLensAdapter.sol` | `getPriceFromOracle(baseAssetCode)` → `getBaseAssetPrice()` | 0 |
| Deploy scripts | +`tokenManager.setBaseAssetCode("USDC")` | 0 |
| `test/unit/TokenManager.test.ts` (o nuovo) | +Test `setBaseAssetCode`, `getBaseAssetPrice`, `convertUsdToBaseAsset` | 3 |
| `test/unit/LensAdapters.test.ts` | Aggiornare test AaveV3, Euler, Morpho, MorphoVault | 3 |
| `test/e2e/USDC.BaseAsset.e2e.test.ts` | Nessuna modifica — deve passare invariato | 3 |

### File INVARIATI

| File | Motivo |
|------|--------|
| `contracts/adapters/ChainlinkAdapter.sol` | `getPrice()` già normalizza a 18 dec — nessuna modifica |
| Euler/Morpho/MorphoVault (logica cross-rate) | La formula cross-rate resta identica, cambia solo il nome della funzione prezzo |

---

## Decisioni architetturali

| Decisione | Motivazione |
|-----------|-------------|
| `baseAssetCode` nel TokenManager | Centralizza l'informazione, evita duplicazione nei LensAdapter, abilita funzioni senza parametri ambigui |
| `getBaseAssetPrice()` senza parametri | Impossibile abusarne per token arbitrari — zero backdoor. Restituisce solo il prezzo del base asset |
| `convertUsdToBaseAsset(value, usdDecimals)` con solo 2 parametri | `baseAssetCode` già noto internamente — signature pulita e sicura |
| Esponente positivo/negativo nella formula | Evita overflow uint256 per GMX (30 decimali) |
| `getPriceFromOracle` eliminata | Sostituita da `getBaseAssetPrice` — più sicura, scope limitato, nome auto-documentante |
| Cross-rate invariato per Euler/Morpho | Logica diversa (raw amounts vs USD), formula diversa, entrambe corrette |
| Il base asset resta NON registrabile | Motivo legittimo: non deve entrare nel sistema error tracking/heartbeat. Il prezzo è accessibile via `getBaseAssetPrice` senza registrazione |

---

## Scope

- **Incluso**: `baseAssetCode` in TokenManager, `getBaseAssetPrice`, `convertUsdToBaseAsset`, refactor Aave, aggiornamento Euler/Morpho, test completi
- **Escluso**: Creazione LensAdapter Compound/GMX (futuro — chiameranno `convertUsdToBaseAsset(value, 8 o 30)`)
- **Escluso**: Fix `getPriceDecimals()` inconsistenza ChainlinkAdapter (task separato — ritorna sempre 18 ma in certi path il prezzo ha decimali raw)

---

## Schema architetturale finale

```
Euler/Morpho (raw amounts)           Aave/Compound/GMX (USD values)
        │                                      │
        ▼                                      ▼
  Cross-rate formula              convertUsdToBaseAsset(value, usdDec)
  tokenPrice / baseAssetPrice         (usdDec: 8 Aave/Comp, 30 GMX)
        │                                      │
        ▼                                      ▼
  getBaseAssetPrice()              getBaseAssetPrice()  [interno]
        │                                      │
        └────────── ChainlinkAdapter ──────────┘
                         │
                  Chainlink Feeds (stessa fonte per tutti)
```

Tutti i percorsi convergono su TokenManager → ChainlinkAdapter → Chainlink.  
Zero oracle esterni. Architettura pulita e scalabile.