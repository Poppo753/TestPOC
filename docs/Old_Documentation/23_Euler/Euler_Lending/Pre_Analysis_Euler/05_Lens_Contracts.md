# 📊 Lens Contracts - Monitoraggio Posizioni

**Fonte:** https://docs.euler.finance/developers/data-querying/using-lens-contracts  
**Data:** 29 Novembre 2025  
**Network:** Arbitrum

---

## 📋 Indice

1. [Cosa Sono i Lens Contracts](#cosa-sono-i-lens-contracts)
2. [Tipi di Lens Contracts](#tipi-di-lens-contracts)
3. [AccountLens - Dati Account](#accountlens---dati-account)
4. [VaultLens - Dati Vault](#vaultlens---dati-vault)
5. [UtilsLens - APY e Utilità](#utilslens---apy-e-utilità)
6. [Health Score e Position Health](#health-score-e-position-health)
7. [Time to Liquidation](#time-to-liquidation)
8. [Esempi di Codice Completi](#esempi-di-codice-completi)

---

## Cosa Sono i Lens Contracts

I **Lens contracts** sono contratti smart **read-only** progettati per rendere facile l'accesso e l'aggregazione dei dati del protocollo Euler V2.

### Caratteristiche

| Caratteristica | Descrizione |
|----------------|-------------|
| **Read-only** | Non modificano lo stato del protocollo |
| **Off-chain** | Pensati per uso off-chain (scripts, dashboard, bot) |
| **Aggregatori** | Combinano informazioni da più contratti in una singola risposta strutturata |
| **Non gas-optimized** | Non ottimizzati per gas (uso off-chain only) |

### Casi d'Uso

- ✅ Recuperare informazioni complete su account e vault in una singola chiamata
- ✅ Accedere a metriche di rischio, tassi di interesse, cap e dettagli di configurazione
- ✅ Query dati reward on-chain
- ✅ Aggregare dati su multipli vault o account

---

## Tipi di Lens Contracts

### Indirizzi su Arbitrum

| Lens Contract | Indirizzo | Scopo |
|---------------|-----------|-------|
| **AccountLens** | `0x90a52DDcb232e7bb003DD9258fA1235c553eC956` | Dati account e posizioni |
| **VaultLens** | `0xc99FCEE6174Bc92eBe9C78690fFD5067018a8380` | Informazioni vault |
| **OracleLens** | `0x5D613b4eC0efAee328f6cA47C667EA49a2eB7884` | Info oracoli |
| **IRMLens** | `0x9ac753B76B56039e4164858f90c288AC1346EC3c` | Info Interest Rate Model |
| **UtilsLens** | `0xDAf44060DCe217Fd603908A49fcaa1FA900304BE` | APY, time to liquidation |
| **EulerEarnVaultLens** | `0xb0Fb95690a068DE87d60cAF050c2e8815154B97c` | Lens per Euler Earn vault |

---

## AccountLens - Dati Account

L'**AccountLens** aggrega tutte le informazioni rilevanti su un account utente e le sue posizioni.

### Funzioni Principali

| Funzione | Descrizione |
|----------|-------------|
| `getAccountInfo(account, vault)` | Snapshot completo della posizione di un utente in un vault |
| `getAccountEnabledVaultsInfo(evc, account)` | Dati per tutti i collateral e controller abilitati |
| `getAccountLiquidityInfo(account, vault)` | Solo informazioni di liquidità |
| `getTimeToLiquidation(account, vault)` | Tempo stimato alla liquidazione |

### Struct AccountInfo

```solidity
struct AccountInfo {
    EVCAccountInfo evcAccountInfo;       // Info generali EVC sub-account
    VaultAccountInfo vaultAccountInfo;   // Dati posizione nel vault
    AccountRewardInfo accountRewardInfo; // Dati reward e incentivi
}
```

### Struct EVCAccountInfo

```solidity
struct EVCAccountInfo {
    uint256 timestamp;
    address evc;
    address account;
    bytes19 addressPrefix;
    address owner;
    bool isLockdownMode;
    bool isPermitDisabledMode;
    uint256 lastAccountStatusCheckTimestamp;
    address[] enabledControllers;
    address[] enabledCollaterals;
}
```

### Struct VaultAccountInfo

```solidity
struct VaultAccountInfo {
    uint256 timestamp;
    address account;
    address vault;
    address asset;
    uint256 assetsAccount;                    // Balance asset sottostante
    uint256 shares;                           // Vault shares possedute
    uint256 assets;                           // Valore shares in asset
    uint256 borrowed;                         // Ammontare preso in prestito
    uint256 assetAllowanceVault;              // Allowance verso vault
    uint256 assetAllowanceVaultPermit2;       // Allowance Permit2
    uint256 assetAllowanceExpirationVaultPermit2;
    uint256 assetAllowancePermit2;
    bool balanceForwarderEnabled;
    bool isController;                        // Questo vault è controller?
    bool isCollateral;                        // Questo vault è collaterale?
    AccountLiquidityInfo liquidityInfo;       // Info liquidità
}
```

### Struct AccountLiquidityInfo

Questa è la struct più importante per monitorare la salute della posizione:

```solidity
struct AccountLiquidityInfo {
    bool queryFailure;
    bytes queryFailureReason;
    address account;
    address vault;
    address unitOfAccount;
    int256 timeToLiquidation;                  // ⭐ TEMPO ALLA LIQUIDAZIONE
    uint256 liabilityValueBorrowing;           // Valore debito per borrowing
    uint256 liabilityValueLiquidation;         // Valore debito per liquidation
    uint256 collateralValueBorrowing;          // Valore collaterale per borrowing
    uint256 collateralValueLiquidation;        // Valore collaterale per liquidation
    uint256 collateralValueRaw;                // Valore collaterale raw (non risk-adjusted)
    address[] collaterals;                     // Lista vault collaterali
    uint256[] collateralValuesBorrowing;       // Valori per ogni collaterale (borrowing)
    uint256[] collateralValuesLiquidation;     // Valori per ogni collaterale (liquidation)
    uint256[] collateralValuesRaw;             // Valori raw per ogni collaterale
}
```

### Esempio: Query AccountInfo

```javascript
const { ethers } = require("ethers");

const ACCOUNT_LENS_ADDRESS = "0x90a52DDcb232e7bb003DD9258fA1235c553eC956";

async function getAccountInfo(provider, account, vault) {
    const accountLens = new ethers.Contract(
        ACCOUNT_LENS_ADDRESS,
        AccountLensABI,
        provider
    );
    
    const info = await accountLens.getAccountInfo(account, vault);
    
    // Accedere ai dati nested
    console.log("Owner:", info.evcAccountInfo.owner);
    console.log("Vault shares:", info.vaultAccountInfo.shares);
    console.log("Borrowed:", info.vaultAccountInfo.borrowed);
    console.log("Is Controller:", info.vaultAccountInfo.isController);
    console.log("Time to Liquidation:", info.vaultAccountInfo.liquidityInfo.timeToLiquidation);
    
    return info;
}
```

---

## VaultLens - Dati Vault

Il **VaultLens** fornisce informazioni dettagliate su un vault specifico.

### Funzione Principale: getVaultInfoFull

```javascript
const vaultLens = new ethers.Contract(VAULT_LENS_ADDRESS, VaultLensABI, provider);
const vaultInfo = await vaultLens.getVaultInfoFull(vault);

console.log("Vault name:", vaultInfo.vaultName);
console.log("Total assets:", vaultInfo.totalAssets);
console.log("Interest rate model:", vaultInfo.interestRateModel);
console.log("Supply cap:", vaultInfo.supplyCap);
console.log("Recognized collaterals:", vaultInfo.collateralLTVInfo);
```

### Struct LTVInfo

Ogni collaterale riconosciuto ha parametri LTV (Loan-to-Value):

```solidity
struct LTVInfo {
    address collateral;           // Indirizzo vault collaterale
    uint256 borrowLTV;            // LTV per borrowing (es. 80%)
    uint256 liquidationLTV;       // LTV per liquidation (es. 85%)
    uint256 initialLiquidationLTV; // LTV iniziale per ramping
    uint256 targetTimestamp;      // Quando il ramping finisce
    uint256 rampDuration;         // Durata totale del ramp
}
```

> 💡 **TIP**: Gli array come `collateralLTVInfo` sono append-only. Un collaterale con `borrowLTV = 0` non è più accettato come collaterale. Itera solo attraverso entry con LTV non-zero.

### Calcolare LTV Corrente Durante Ramping

Se un vault sta facendo ramping down del liquidation LTV:

```javascript
function getCurrentLiquidationLTV(ltvInfo) {
    const now = Math.floor(Date.now() / 1000); // timestamp corrente
    
    if (
        now >= ltvInfo.targetTimestamp ||
        ltvInfo.liquidationLTV >= ltvInfo.initialLiquidationLTV
    ) {
        return ltvInfo.liquidationLTV;
    }
    
    const timeRemaining = ltvInfo.targetTimestamp - now;
    
    return (
        ltvInfo.liquidationLTV +
        ((ltvInfo.initialLiquidationLTV - ltvInfo.liquidationLTV) * timeRemaining) /
        ltvInfo.rampDuration
    );
}
```

---

## UtilsLens - APY e Utilità

L'**UtilsLens** fornisce funzioni di utilità per calcoli comuni.

### getAPYs - Tassi di Interesse

```javascript
const utilsLens = new ethers.Contract(UTILS_LENS_ADDRESS, UtilsLensABI, provider);

const [borrowAPY, supplyAPY] = await utilsLens.getAPYs(vault);

console.log("Borrow APY:", borrowAPY);
console.log("Supply APY:", supplyAPY);
```

### Conversione APY

I valori sono espressi in **ray units** (`1e27`). Per convertire in percentuale leggibile:

```javascript
// Convertire in percentuale con 2 decimali
const borrowAPYPercent = Number(borrowAPY) / 1e25;
const supplyAPYPercent = Number(supplyAPY) / 1e25;

console.log(`Borrow APY: ${borrowAPYPercent.toFixed(2)}%`);
console.log(`Supply APY: ${supplyAPYPercent.toFixed(2)}%`);
```

> ⚠️ **NOTA**: Gli APY ritornati includono solo i tassi Euler da lending/borrowing. NON includono:
> - APY intrinseco dell'asset sottostante (es. yield di staking di wstETH)
> - Reward aggiuntivi
> Per questi, devi integrare con data source esterni.

---

## Health Score e Position Health

Il **Health Score** è la metrica principale per valutare la sicurezza della tua posizione.

### Formula Health Score

```
healthScore = collateralValueLiquidation / liabilityValueLiquidation
```

Dove:
- `collateralValueLiquidation` = Valore collaterali risk-adjusted per liquidation
- `liabilityValueLiquidation` = Valore debito per liquidation

### Interpretazione

| Health Score | Stato |
|--------------|-------|
| > 1.5 | ✅ Sicuro - Buon margine |
| 1.2 - 1.5 | ⚠️ Attenzione - Monitorare |
| 1.0 - 1.2 | 🔴 Rischio - Vicino alla liquidazione |
| ≤ 1.0 | ❌ Liquidabile - Posizione in violazione |

### Calcolare Health Score

```javascript
async function getHealthScore(accountLens, account, vault) {
    const info = await accountLens.getAccountInfo(account, vault);
    const liquidity = info.vaultAccountInfo.liquidityInfo;
    
    if (liquidity.liabilityValueLiquidation === 0n) {
        return Infinity; // Nessun debito = infinitamente sicuro
    }
    
    const healthScore = Number(liquidity.collateralValueLiquidation) / 
                        Number(liquidity.liabilityValueLiquidation);
    
    return healthScore;
}
```

### Dove Trovare i Dati

Per ottenere i dati di health per una posizione di borrow:

1. **Query il vault da cui hai preso in prestito** (il controller vault)
2. In `getAccountEnabledVaultsInfo`, è il vault dove `isController = true`
3. I valori `collateralValueLiquidation` e `liabilityValueLiquidation` sono aggregati su tutti i collaterali abilitati

### Tipi di Collateral Value

| Tipo | Descrizione | Uso |
|------|-------------|-----|
| `collateralValueBorrowing` | Valore risk-adjusted per borrowing | Limite di quanto puoi prendere in prestito |
| `collateralValueLiquidation` | Valore risk-adjusted per liquidation (più conservativo) | Determina quando sei liquidabile |
| `collateralValueRaw` | Valore di mercato raw | Valore effettivo senza risk adjustments |

### Calcolare Valore Collaterale Off-Chain

Se vuoi calcolare il valore di mercato usando prezzi off-chain:

```javascript
// offChainCollateralValue = assetsAccount * assetPrice
const offChainValue = assetsAccount * assetPrice;
```

Dove:
- `assetsAccount` = Balance asset da `VaultAccountInfo.assetsAccount`
- `assetPrice` = Prezzo per unità dell'asset (da fonte esterna)

---

## Time to Liquidation

Il **Time to Liquidation** è una stima di quanto tempo manca prima che la posizione diventi liquidabile, assumendo che i tassi rimangano costanti.

### Valori Speciali

| Valore | Significato |
|--------|-------------|
| `TTL_LIQUIDATION` | Posizione già liquidabile |
| `TTL_INFINITY` | Posizione infinitamente sicura (nessun debito o surplus) |
| `TTL_MORE_THAN_ONE_YEAR` | Più di un anno alla liquidazione |
| `TTL_ERROR` | Errore nel calcolo |

### Query Time to Liquidation

```javascript
const accountLens = new ethers.Contract(ACCOUNT_LENS_ADDRESS, AccountLensABI, provider);

const ttl = await accountLens.getTimeToLiquidation(account, vault);

// Interpretare il risultato
if (ttl.eq(TTL_LIQUIDATION)) {
    console.log("⚠️ POSIZIONE GIÀ LIQUIDABILE!");
} else if (ttl.eq(TTL_INFINITY)) {
    console.log("✅ Posizione infinitamente sicura");
} else if (ttl.eq(TTL_MORE_THAN_ONE_YEAR)) {
    console.log("✅ Più di un anno alla liquidazione");
} else if (ttl.gt(0)) {
    const days = ttl.div(86400);
    const hours = ttl.mod(86400).div(3600);
    console.log(`⏱️ Time to liquidation: ${days} giorni, ${hours} ore`);
} else {
    console.log("❌ Errore nel calcolo TTL");
}
```

### Accesso via AccountLiquidityInfo

Il TTL è anche disponibile in `VaultAccountInfo.liquidityInfo.timeToLiquidation`:

```javascript
const info = await accountLens.getAccountInfo(account, vault);
const ttl = info.vaultAccountInfo.liquidityInfo.timeToLiquidation;
```

---

## Esempi di Codice Completi

### TypeScript - Monitor di Posizione Completo

```typescript
import { ethers } from 'ethers';

// Indirizzi Arbitrum
const ADDRESSES = {
    ACCOUNT_LENS: "0x90a52DDcb232e7bb003DD9258fA1235c553eC956",
    VAULT_LENS: "0xc99FCEE6174Bc92eBe9C78690fFD5067018a8380",
    UTILS_LENS: "0xDAf44060DCe217Fd603908A49fcaa1FA900304BE",
    EVC: "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066"
};

// Costanti TTL
const TTL_LIQUIDATION = -1n;
const TTL_INFINITY = ethers.constants.MaxInt256;
const TTL_MORE_THAN_ONE_YEAR = ethers.constants.MaxInt256.sub(1);
const TTL_ERROR = ethers.constants.MinInt256;

interface PositionHealth {
    healthScore: number;
    timeToLiquidation: bigint;
    timeToLiquidationFormatted: string;
    collateralValueRaw: bigint;
    collateralValueLiquidation: bigint;
    liabilityValue: bigint;
    isLiquidatable: boolean;
    riskLevel: 'safe' | 'warning' | 'danger' | 'liquidatable';
}

async function monitorPosition(
    provider: ethers.Provider,
    account: string,
    controllerVault: string
): Promise<PositionHealth> {
    const accountLens = new ethers.Contract(
        ADDRESSES.ACCOUNT_LENS,
        AccountLensABI,
        provider
    );
    
    // Query account info
    const info = await accountLens.getAccountInfo(account, controllerVault);
    const liquidity = info.vaultAccountInfo.liquidityInfo;
    
    // Calcolare health score
    let healthScore = Infinity;
    if (liquidity.liabilityValueLiquidation > 0n) {
        healthScore = Number(liquidity.collateralValueLiquidation) / 
                      Number(liquidity.liabilityValueLiquidation);
    }
    
    // Determinare risk level
    let riskLevel: 'safe' | 'warning' | 'danger' | 'liquidatable';
    if (healthScore <= 1.0) {
        riskLevel = 'liquidatable';
    } else if (healthScore < 1.2) {
        riskLevel = 'danger';
    } else if (healthScore < 1.5) {
        riskLevel = 'warning';
    } else {
        riskLevel = 'safe';
    }
    
    // Formattare TTL
    let ttlFormatted: string;
    const ttl = liquidity.timeToLiquidation;
    
    if (ttl === TTL_LIQUIDATION) {
        ttlFormatted = "LIQUIDABILE ORA";
    } else if (ttl === TTL_INFINITY) {
        ttlFormatted = "Infinito (nessun debito)";
    } else if (ttl === TTL_MORE_THAN_ONE_YEAR) {
        ttlFormatted = "> 1 anno";
    } else if (ttl === TTL_ERROR) {
        ttlFormatted = "Errore calcolo";
    } else if (ttl > 0n) {
        const days = Number(ttl / 86400n);
        const hours = Number((ttl % 86400n) / 3600n);
        const minutes = Number((ttl % 3600n) / 60n);
        ttlFormatted = `${days}d ${hours}h ${minutes}m`;
    } else {
        ttlFormatted = "Sconosciuto";
    }
    
    return {
        healthScore,
        timeToLiquidation: ttl,
        timeToLiquidationFormatted: ttlFormatted,
        collateralValueRaw: liquidity.collateralValueRaw,
        collateralValueLiquidation: liquidity.collateralValueLiquidation,
        liabilityValue: liquidity.liabilityValueLiquidation,
        isLiquidatable: healthScore <= 1.0,
        riskLevel
    };
}

async function getVaultAPYs(
    provider: ethers.Provider,
    vault: string
): Promise<{ borrowAPY: number; supplyAPY: number }> {
    const utilsLens = new ethers.Contract(
        ADDRESSES.UTILS_LENS,
        UtilsLensABI,
        provider
    );
    
    const [borrowAPY, supplyAPY] = await utilsLens.getAPYs(vault);
    
    return {
        borrowAPY: Number(borrowAPY) / 1e25,
        supplyAPY: Number(supplyAPY) / 1e25
    };
}

// Esempio di utilizzo
async function main() {
    const provider = new ethers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
    
    const account = "0x..."; // Il tuo indirizzo
    const controllerVault = "0x..."; // Vault da cui hai preso in prestito
    
    const health = await monitorPosition(provider, account, controllerVault);
    
    console.log("=== STATO POSIZIONE ===");
    console.log(`Health Score: ${health.healthScore.toFixed(4)}`);
    console.log(`Risk Level: ${health.riskLevel.toUpperCase()}`);
    console.log(`Time to Liquidation: ${health.timeToLiquidationFormatted}`);
    console.log(`Collateral Value (raw): ${ethers.formatUnits(health.collateralValueRaw, 18)}`);
    console.log(`Collateral Value (liquidation): ${ethers.formatUnits(health.collateralValueLiquidation, 18)}`);
    console.log(`Liability Value: ${ethers.formatUnits(health.liabilityValue, 18)}`);
    console.log(`Liquidatable: ${health.isLiquidatable ? "⚠️ SI!" : "No"}`);
    
    // APYs
    const apys = await getVaultAPYs(provider, controllerVault);
    console.log(`\nBorrow APY: ${apys.borrowAPY.toFixed(2)}%`);
    console.log(`Supply APY: ${apys.supplyAPY.toFixed(2)}%`);
}

main().catch(console.error);
```

### Solidity - Contratto Monitor On-Chain

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@euler-xyz/euler-interfaces/interfaces/IAccountLens.sol";
import "@euler-xyz/euler-interfaces/interfaces/IUtilsLens.sol";

contract EulerPositionMonitor {
    IAccountLens public immutable accountLens;
    IUtilsLens public immutable utilsLens;
    
    // Costanti TTL
    int256 public constant TTL_ERROR = type(int256).min;
    int256 public constant TTL_INFINITY = type(int256).max;
    int256 public constant TTL_MORE_THAN_ONE_YEAR = type(int256).max - 1;
    int256 public constant TTL_LIQUIDATION = -1;
    
    constructor(address _accountLens, address _utilsLens) {
        accountLens = IAccountLens(_accountLens);
        utilsLens = IUtilsLens(_utilsLens);
    }
    
    struct PositionSummary {
        uint256 healthScore;           // Scaled by 1e18
        int256 timeToLiquidation;
        uint256 collateralValue;
        uint256 liabilityValue;
        bool isLiquidatable;
        uint256 borrowAPY;
        uint256 supplyAPY;
    }
    
    function getPositionSummary(
        address account,
        address controllerVault
    ) external view returns (PositionSummary memory summary) {
        // Get account info
        IAccountLens.AccountInfo memory info = accountLens.getAccountInfo(
            account,
            controllerVault
        );
        
        IAccountLens.AccountLiquidityInfo memory liquidity = 
            info.vaultAccountInfo.liquidityInfo;
        
        // Calculate health score (scaled by 1e18)
        if (liquidity.liabilityValueLiquidation > 0) {
            summary.healthScore = (liquidity.collateralValueLiquidation * 1e18) /
                                  liquidity.liabilityValueLiquidation;
        } else {
            summary.healthScore = type(uint256).max;
        }
        
        summary.timeToLiquidation = liquidity.timeToLiquidation;
        summary.collateralValue = liquidity.collateralValueLiquidation;
        summary.liabilityValue = liquidity.liabilityValueLiquidation;
        summary.isLiquidatable = summary.healthScore <= 1e18;
        
        // Get APYs
        (summary.borrowAPY, summary.supplyAPY) = utilsLens.getAPYs(controllerVault);
    }
    
    function isPositionHealthy(
        address account,
        address controllerVault,
        uint256 minHealthScore  // es. 1.2e18 per 1.2x
    ) external view returns (bool) {
        PositionSummary memory summary = this.getPositionSummary(
            account,
            controllerVault
        );
        return summary.healthScore >= minHealthScore;
    }
}
```

---

## 📚 Riferimenti

- [Data Querying Overview](https://docs.euler.finance/developers/data-querying/)
- [Lens Contracts](https://docs.euler.finance/developers/data-querying/lens-contracts)
- [Using Lens Contracts](https://docs.euler.finance/developers/data-querying/using-lens-contracts)
- [LensTypes.sol](https://github.com/euler-xyz/evk-periphery/blob/master/src/Lens/LensTypes.sol)
- [AccountLens.sol](https://github.com/euler-xyz/evk-periphery/blob/master/src/Lens/AccountLens.sol)
- [VaultLens.sol](https://github.com/euler-xyz/evk-periphery/blob/master/src/Lens/VaultLens.sol)
- [UtilsLens.sol](https://github.com/euler-xyz/evk-periphery/blob/master/src/Lens/UtilsLens.sol)
