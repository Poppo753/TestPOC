# ⚠️ Liquidazioni in Euler V2

**Fonte:** https://docs.euler.finance/developers/evc-integration/liquidations  
**Data:** 29 Novembre 2025  
**Network:** Arbitrum

---

## 📋 Indice

1. [Come Funzionano le Liquidazioni](#come-funzionano-le-liquidazioni)
2. [Quando Avviene una Liquidazione](#quando-avviene-una-liquidazione)
3. [Parametri di Liquidazione](#parametri-di-liquidazione)
4. [controlCollateral vs Liquidazione Standard](#controlcollateral-vs-liquidazione-standard)
5. [Protezione dalla Liquidazione](#protezione-dalla-liquidazione)
6. [Calcolo Health Score](#calcolo-health-score)
7. [Esempi di Codice](#esempi-di-codice)

---

## Come Funzionano le Liquidazioni

Le liquidazioni in Euler V2 usano un meccanismo chiamato **controlCollateral**, che è una caratteristica unica dell'EVC (Ethereum Vault Connector).

### Flusso di Liquidazione

```
1. Liquidatore chiama EVC.liquidate(violator, vault, data)
                    ↓
2. EVC verifica che il violator sia effettivamente in violazione
                    ↓
3. EVC chiama vault.controlCollateral(liquidator, collateral, data)
                    ↓
4. Liquidatore riceve il collaterale (con discount)
                    ↓
5. Debito del violator viene ridotto
                    ↓
6. Account status check viene eseguito
```

### Caratteristiche Chiave

| Caratteristica | Descrizione |
|----------------|-------------|
| **Esecuzione Atomica** | L'intera liquidazione avviene in una singola transazione |
| **Discount Dinamico** | Il bonus del liquidatore dipende dalla severità della violazione |
| **Partial Liquidation** | Possibile liquidare solo parte della posizione |
| **Flash Liquidations** | Supportate via EVC batching |

---

## Quando Avviene una Liquidazione

Una posizione diventa liquidabile quando il **Health Score scende sotto 1.0**.

### Formula Health Score

```
healthScore = collateralValueLiquidation / liabilityValueLiquidation
```

### Condizione di Liquidazione

```
Se healthScore ≤ 1.0:
    → La posizione è in VIOLAZIONE
    → Può essere liquidata da chiunque
```

### Esempio Pratico

```
Depositi: 10 ETH (valore $30,000)
Prendi in prestito: $24,000 USDC
LTV liquidation: 85%

collateralValueLiquidation = $30,000 * 0.85 = $25,500
liabilityValueLiquidation = $24,000

healthScore = $25,500 / $24,000 = 1.0625 ✅ Sicuro

--- ETH scende a $2,700 ---

collateralValueLiquidation = $27,000 * 0.85 = $22,950
liabilityValueLiquidation = $24,000

healthScore = $22,950 / $24,000 = 0.956 ❌ LIQUIDABILE
```

---

## Parametri di Liquidazione

### LTV (Loan-to-Value)

| Parametro | Descrizione |
|-----------|-------------|
| **borrowLTV** | Massimo LTV per prendere in prestito (es. 80%) |
| **liquidationLTV** | LTV alla quale scatta la liquidazione (es. 85%) |

### Liquidation Discount

Il liquidatore riceve un bonus (discount) sul collaterale:

```
Valore collaterale ricevuto = debito_ripagato + discount
```

Il discount è configurato a livello di vault e tipicamente è tra **2-10%**.

### Cool-off Period

Dopo una liquidazione, può esserci un cool-off period prima che altre liquidazioni siano possibili.

---

## controlCollateral vs Liquidazione Standard

### Approccio Tradizionale (es. Aave, Compound)

```solidity
// Liquidatore chiama direttamente il vault
lendingPool.liquidate(violator, debtAsset, collateralAsset, amount);
```

### Approccio Euler V2 (controlCollateral)

```solidity
// Liquidatore opera attraverso l'EVC
evc.controlCollateral(violator, collateralVault, liquidatorData);
```

### Vantaggi di controlCollateral

| Vantaggio | Descrizione |
|-----------|-------------|
| **Flessibilità** | Il liquidatore ha controllo su come gestire il collaterale |
| **Composabilità** | Può essere combinato con flash loans e swap in un batch |
| **Efficienza Gas** | Una sola transazione per operazioni complesse |

### Esempio: Flash Liquidation

```solidity
// Esempio di flash liquidation via batch
IEVC.BatchItem[] memory items = new IEVC.BatchItem[](3);

// 1. Flash borrow per avere capitale
items[0] = IEVC.BatchItem({
    targetContract: flashLoanVault,
    value: 0,
    onBehalfOfAccount: address(0),
    data: abi.encodeCall(IEVault.borrow, (flashAmount, liquidator))
});

// 2. Liquidare il violator
items[1] = IEVC.BatchItem({
    targetContract: evc,
    value: 0,
    onBehalfOfAccount: address(0),
    data: abi.encodeCall(IEVC.controlCollateral, (violator, collateralVault, liquidationData))
});

// 3. Ripagare il flash loan
items[2] = IEVC.BatchItem({
    targetContract: flashLoanVault,
    value: 0,
    onBehalfOfAccount: address(0),
    data: abi.encodeCall(IEVault.repay, (flashAmount + fee, liquidator))
});

evc.batch(items);
```

---

## Protezione dalla Liquidazione

### 1. Monitorare Costantemente

```javascript
const SAFE_HEALTH_THRESHOLD = 1.5;
const WARNING_HEALTH_THRESHOLD = 1.25;
const DANGER_HEALTH_THRESHOLD = 1.1;

async function checkPositionHealth(account, vault) {
    const accountLens = new ethers.Contract(ACCOUNT_LENS, ABI, provider);
    const info = await accountLens.getAccountInfo(account, vault);
    const liquidity = info.vaultAccountInfo.liquidityInfo;
    
    const healthScore = Number(liquidity.collateralValueLiquidation) /
                        Number(liquidity.liabilityValueLiquidation);
    
    if (healthScore < DANGER_HEALTH_THRESHOLD) {
        console.log("🚨 PERICOLO: Liquidazione imminente!");
        return 'DANGER';
    } else if (healthScore < WARNING_HEALTH_THRESHOLD) {
        console.log("⚠️ ATTENZIONE: Health score basso");
        return 'WARNING';
    } else if (healthScore < SAFE_HEALTH_THRESHOLD) {
        console.log("🔶 Monitorare la posizione");
        return 'CAUTION';
    } else {
        console.log("✅ Posizione sicura");
        return 'SAFE';
    }
}
```

### 2. Impostare Alert

```javascript
// Controllare time to liquidation
async function setLiquidationAlert(account, vault) {
    const accountLens = new ethers.Contract(ACCOUNT_LENS, ABI, provider);
    const ttl = await accountLens.getTimeToLiquidation(account, vault);
    
    // Se meno di 24 ore alla liquidazione
    if (ttl > 0n && ttl < 86400n) {
        console.log(`⏰ ALERT: ${Number(ttl) / 3600} ore alla liquidazione!`);
        // Invia notifica, email, telegram, etc.
        sendAlert("Liquidation imminent", ttl);
    }
}
```

### 3. Aggiungere Collaterale

```solidity
// Aumentare il collaterale per migliorare health score
function addCollateral(
    address vault,
    uint256 amount
) external {
    IERC20(asset).approve(vault, amount);
    IEVault(vault).deposit(amount, msg.sender);
    // Health score migliora automaticamente
}
```

### 4. Ripagare Parte del Debito

```solidity
// Ridurre il debito per migliorare health score
function repayDebt(
    address vault,
    uint256 amount
) external {
    IERC20(asset).approve(vault, amount);
    IEVault(vault).repay(amount, msg.sender);
    // Health score migliora automaticamente
}
```

### 5. Usare Stop-Loss Automatici

```solidity
contract AutoDeleverager {
    IEVault public vault;
    IEVC public evc;
    uint256 public minHealthScore; // es. 1.2e18
    
    function checkAndDeleverage(address account) external {
        // Query health score
        (uint256 collValue, uint256 liabValue) = getPositionValues(account);
        uint256 healthScore = (collValue * 1e18) / liabValue;
        
        if (healthScore < minHealthScore) {
            // Ripaga parte del debito automaticamente
            uint256 amountToRepay = calculateRepayAmount(liabValue, minHealthScore);
            _repayDebt(account, amountToRepay);
        }
    }
}
```

---

## Calcolo Health Score

### Formula Dettagliata

```
collateralValueLiquidation = Σ (collateral_i * price_i * liquidationLTV_i)
liabilityValueLiquidation = borrowed_amount * borrow_price

healthScore = collateralValueLiquidation / liabilityValueLiquidation
```

### Esempio Multi-Collaterale

```
Collaterali:
- 5 ETH @ $3,000 = $15,000, liquidationLTV = 85%
- 10,000 USDC @ $1 = $10,000, liquidationLTV = 95%

collateralValueLiquidation = ($15,000 * 0.85) + ($10,000 * 0.95)
                           = $12,750 + $9,500
                           = $22,250

Debito:
- 6,000 WBTC @ $3.50 = $21,000

liabilityValueLiquidation = $21,000

healthScore = $22,250 / $21,000 = 1.059

→ Ancora sicuro ma vicino al limite!
```

### Codice TypeScript

```typescript
interface CollateralPosition {
    value: number;
    liquidationLTV: number;
}

function calculateHealthScore(
    collaterals: CollateralPosition[],
    totalLiability: number
): number {
    if (totalLiability === 0) return Infinity;
    
    const collateralValueLiquidation = collaterals.reduce(
        (sum, c) => sum + (c.value * c.liquidationLTV),
        0
    );
    
    return collateralValueLiquidation / totalLiability;
}

// Esempio
const collaterals = [
    { value: 15000, liquidationLTV: 0.85 },
    { value: 10000, liquidationLTV: 0.95 }
];

const liability = 21000;
const health = calculateHealthScore(collaterals, liability);
console.log(`Health Score: ${health.toFixed(3)}`); // 1.059
```

---

## Esempi di Codice

### Monitor di Liquidazione Completo

```typescript
import { ethers } from "ethers";

const ADDRESSES = {
    ACCOUNT_LENS: "0x90a52DDcb232e7bb003DD9258fA1235c553eC956",
    UTILS_LENS: "0xDAf44060DCe217Fd603908A49fcaa1FA900304BE"
};

class LiquidationMonitor {
    private provider: ethers.Provider;
    private accountLens: ethers.Contract;
    
    constructor(rpcUrl: string) {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.accountLens = new ethers.Contract(
            ADDRESSES.ACCOUNT_LENS,
            AccountLensABI,
            this.provider
        );
    }
    
    async getPositionStatus(account: string, vault: string) {
        const info = await this.accountLens.getAccountInfo(account, vault);
        const liq = info.vaultAccountInfo.liquidityInfo;
        
        const healthScore = liq.liabilityValueLiquidation === 0n
            ? Infinity
            : Number(liq.collateralValueLiquidation) / Number(liq.liabilityValueLiquidation);
        
        const ttl = liq.timeToLiquidation;
        
        return {
            healthScore,
            timeToLiquidation: ttl,
            isLiquidatable: healthScore <= 1.0,
            collateralValue: liq.collateralValueLiquidation,
            liabilityValue: liq.liabilityValueLiquidation,
            riskLevel: this.getRiskLevel(healthScore)
        };
    }
    
    getRiskLevel(healthScore: number): string {
        if (healthScore <= 1.0) return "🔴 LIQUIDABILE";
        if (healthScore < 1.1) return "🟠 CRITICO";
        if (healthScore < 1.25) return "🟡 ATTENZIONE";
        if (healthScore < 1.5) return "🟢 MODERATO";
        return "✅ SICURO";
    }
    
    async startMonitoring(
        account: string,
        vault: string,
        intervalMs: number = 60000
    ) {
        console.log(`Monitoraggio posizione ${account} su vault ${vault}`);
        
        setInterval(async () => {
            try {
                const status = await this.getPositionStatus(account, vault);
                
                console.log(`\n=== ${new Date().toISOString()} ===`);
                console.log(`Health Score: ${status.healthScore.toFixed(4)}`);
                console.log(`Risk Level: ${status.riskLevel}`);
                
                if (status.healthScore <= 1.1) {
                    this.sendAlert(status);
                }
            } catch (error) {
                console.error("Errore nel monitoraggio:", error);
            }
        }, intervalMs);
    }
    
    sendAlert(status: any) {
        // Implementa invio notifica (Telegram, Discord, email, etc.)
        console.log("🚨 ALERT INVIATO:", status);
    }
}

// Uso
const monitor = new LiquidationMonitor("https://arb1.arbitrum.io/rpc");
monitor.startMonitoring(
    "0x...", // tuo indirizzo
    "0x...", // vault controller
    60000    // ogni minuto
);
```

### Contratto Auto-Deleverage

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@euler-xyz/euler-interfaces/interfaces/IEVault.sol";
import "@euler-xyz/euler-interfaces/interfaces/IEVC.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AutoDeleverage {
    IEVC public immutable evc;
    uint256 public constant MIN_HEALTH_SCORE = 1.2e18; // 1.2x
    
    constructor(address _evc) {
        evc = IEVC(_evc);
    }
    
    struct Position {
        address vault;
        address collateralVault;
        uint256 borrowed;
        uint256 collateral;
    }
    
    // Keeper può chiamare questa funzione per auto-deleveraggiare
    function checkAndDeleverage(
        address account,
        address vault,
        uint256 repayAmount
    ) external {
        // Verifica che l'account abbia bisogno di deleverage
        // (logica semplificata - in produzione usa AccountLens)
        
        uint256 borrowed = IEVault(vault).debtOf(account);
        require(borrowed > 0, "No debt");
        
        // Esegui il repay per conto dell'utente
        // NOTA: richiede che l'utente abbia pre-approvato questo contratto
        address asset = IEVault(vault).asset();
        IERC20(asset).transferFrom(msg.sender, address(this), repayAmount);
        IERC20(asset).approve(vault, repayAmount);
        
        // Repay usando EVC batch
        IEVC.BatchItem[] memory items = new IEVC.BatchItem[](1);
        items[0] = IEVC.BatchItem({
            targetContract: vault,
            onBehalfOfAccount: account,
            value: 0,
            data: abi.encodeCall(IEVault.repay, (repayAmount, account))
        });
        
        evc.batch(items);
    }
}
```

---

## 📚 Best Practices

### Per Evitare Liquidazioni

1. ✅ **Mantieni health score > 1.5** per un margine di sicurezza
2. ✅ **Monitora costantemente** usando i Lens contracts
3. ✅ **Imposta alert automatici** per health score < 1.3
4. ✅ **Diversifica i collaterali** per ridurre rischio
5. ✅ **Considera la volatilità** dell'asset quando decidi l'LTV
6. ✅ **Prepara capitale extra** per emergenze

### Per Liquidatori

1. ✅ **Usa flash loans** per liquidazioni senza capitale
2. ✅ **Batch le operazioni** per efficienza gas
3. ✅ **Monitora mempool** per opportunità
4. ✅ **Calcola profittabilità** considerando gas e slippage

---

## 📚 Riferimenti

- [EVK Liquidations](https://docs.euler.finance/developers/evk-integration/liquidations)
- [controlCollateral](https://docs.euler.finance/developers/evc-integration/liquidations)
- [Risk Management](https://docs.euler.finance/developers/evk-integration/risk-management)
- [AccountLens](https://github.com/euler-xyz/evk-periphery/blob/master/src/Lens/AccountLens.sol)
