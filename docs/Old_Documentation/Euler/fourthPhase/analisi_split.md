## 📊 ANALISI SPLIT: CORE vs LEVERAGE

### 🔢 Dati Attuali
- **Contratto attuale**: 24,670 bytes (94 bytes sopra limite 24,576)
- **Righe totali**: 1,414 righe
- **Problema**: NON deployabile su mainnet senza optimizer

---

### 📦 SPLIT PROPOSTO

#### **CORE Plugin** (EulerV2PluginCore.sol)
Funzioni base lending/borrowing:

```
SEZIONI DA MANTENERE:
├── Imports & Interfaces (20 righe)
├── Contract header + docs (100 righe)  
├── Immutables + Constants (20 righe)
├── State variables (15 righe)
├── Errors (base) (10 righe)
├── Events (base) (10 righe)
├── Modifiers (30 righe)
├── Constructor (10 righe)
├── DEPOSIT/WITHDRAW (115 righe)
├── BORROW/REPAY (87 righe)
├── DEBT + VIEW functions (107 righe)
├── emergencyWithdrawAll (20 righe)
├── Internal helpers (58 righe)
│   ├── _resolveToken()
│   ├── _getProxyGeneral()
│   ├── _getVaultRegistry()
│   ├── _getVault()
│   └── _getVaultSafe()
├── setCircuitBreaker (5 righe)
└── activateCircuitBreaker (5 righe)

TOTALE CORE: ~612 righe (~43%)
STIMA BYTECODE: ~10-11 KB
```

**Interfacce implementate**:
- `IProtocolAdapter` (parziale: deposit, withdraw, getBalance)
- `ILendingProtocol` (completo: borrow, repay, getDebt, getHealthFactor)

---

#### **LEVERAGE Plugin** (EulerV2PluginLeverage.sol)
Funzioni leverage atomico con flash loans:

```
SEZIONI DA SPOSTARE:
├── Imports & Interfaces (20 righe)
├── IFlashLoanService interface (10 righe)
├── Contract header (50 righe)
├── Immutables (beacon, evc) (10 righe)
├── State variables (10 righe)
│   ├── _inFlashLoanCallback
│   └── _flashLoanContext
├── FlashLoanCallbackContext struct (8 righe)
├── Errors (leverage-specific) (8 righe)
│   ├── PositionNotFound
│   ├── NoPositionToClose
│   ├── SlippageExceeded
│   ├── InvalidLeverage
│   ├── UnauthorizedFlashLoanCallback
│   └── FlashLoanServiceNotFound
├── Events (leverage) (25 righe)
│   ├── LeverageOpenedAtomic
│   ├── LeverageClosedAtomic
│   └── LeveragePositionClosed
├── LEVERAGE ATOMIC (382 righe)
│   ├── OpenLeverageAtomicParams
│   ├── openLeverageAtomic()
│   ├── CloseLeverageAtomicParams
│   ├── closeLeverageAtomic()
│   ├── onFlashLoanReceived()
│   ├── _handleOpenLeverageCallback()
│   └── _handleCloseLeverageCallback()
├── POSITION MANAGEMENT (70 righe)
│   ├── addCollateralToPosition()
│   └── removeCollateralFromPosition()
├── FLASH LOAN HELPERS (61 righe)
│   ├── _getFlashLoanService()
│   ├── _calculateFlashLoanAmount()
│   └── _deriveSubAccount()
├── IProtocolAdapter (260 righe)
│   ├── closePosition()
│   ├── closePositionsForWeth()
│   ├── _closeNormalDepositsForWeth()
│   ├── _closeLeverageAtomicForWeth()
│   └── _getPositionState()
└── Internal helpers condivisi (30 righe)
    ├── _getVaultRegistry()
    ├── _getVault() 
    └── _deriveSubAccount()

TOTALE LEVERAGE: ~802 righe (~57%)
STIMA BYTECODE: ~13-14 KB
```

**Interfacce implementate**:
- `IEulerV2PluginSpecific` (leverage operations)
- `IFlashLoanCallback` (flash loan handler)
- `IProtocolAdapter` (parziale: closePosition, closePositionsForWeth)

---

### 🔗 DIPENDENZE CONDIVISE

**Entrambi i contratti necessitano**:

1. **Beacon** (immutable):
   - Resolve ProxyGeneral
   - Resolve EulerRegistry
   - Resolve TokenManager
   - Resolve FlashLoanService (solo Leverage)

2. **EVC** (immutable):
   - Enable collateral
   - Enable controller
   - Batch operations

3. **Helper functions** (duplicabili ~50 bytes ciascuna):
   ```solidity
   _getVaultRegistry()
   _getVault(tokenCode)
   _getVaultSafe(tokenCode)
   ```

---

### 💾 RISPARMIO BYTECODE STIMATO

| Scenario | Core KB | Leverage KB | Totale | vs Attuale |
|----------|---------|-------------|--------|------------|
| **Attuale (monolitico)** | - | - | 24.1 KB | Baseline |
| **Split senza duplicazione** | 10.5 KB | 13.5 KB | 24.0 KB | -100 bytes ⚠️ |
| **Split con helpers duplicati** | 10.8 KB | 13.8 KB | 24.6 KB | +500 bytes ❌ |
| **Split + optimizer (200 runs)** | 7.4 KB | 9.5 KB | 16.9 KB | **-7.2 KB** ✅ |

**Nota**: Lo split DA SOLO non risolve il problema. **SERVE OPTIMIZER**.

---

### ⚙️ ARCHITETTURA SPLIT

```
┌─────────────────────────────────────────────────────┐
│             PROTOCOL MANAGER                        │
└─────────────────────────────────────────────────────┘
                    │
        ┌───────────┴────────────┐
        │                        │
        ▼                        ▼
┌──────────────────┐    ┌──────────────────────┐
│  EulerV2Core     │    │  EulerV2Leverage     │
│                  │    │                      │
│ - deposit()      │    │ - openLeverageAtomic()│
│ - withdraw()     │    │ - closeLeverageAtomic()│
│ - borrow()       │    │ - closePosition()    │
│ - repay()        │    │ - addCollateral()    │
│ - getBalance()   │    │ - removeCollateral() │
│ - getDebt()      │    │ - closePositionsForWeth()│
│ - getHealthFactor()│  │                      │
└──────────────────┘    └──────────────────────┘
        │                        │
        └───────────┬────────────┘
                    │
                    ▼
        ┌─────────────────────┐
        │   EULER REGISTRY    │
        │  (Position Storage) │
        └─────────────────────┘
                    │
                    ▼
        ┌─────────────────────┐
        │    EULER VAULTS     │
        │   (EVC + Vaults)    │
        └─────────────────────┘
```

---

### 🔧 MODIFICHE NECESSARIE

#### 1. **ProtocolManager** (minime)
```solidity
// PRIMA
address eulerPlugin = beacon.getImplementation("EulerV2Plugin");

// DOPO  
address eulerCore = beacon.getImplementation("EulerV2Core");
address eulerLeverage = beacon.getImplementation("EulerV2Leverage");

// Routing intelligente
function deposit(string protocol, ...) {
    if (protocol == "Euler") {
        IEulerV2Core(eulerCore).deposit(...);
    }
}

function openLeverage(...) {
    IEulerV2Leverage(eulerLeverage).openLeverageAtomic(...);
}
```

#### 2. **Beacon** (configurazione)
```solidity
registerImplementation("EulerV2Core", coreAddress);
registerImplementation("EulerV2Leverage", leverageAddress);
```

#### 3. **LiquidityManager**
```solidity
// Chiamate a closePositionsForWeth() → Leverage contract
address leveragePlugin = beacon.getImplementation("EulerV2Leverage");
IEulerV2Leverage(leveragePlugin).closePositionsForWeth(amount);
```

---

### ⚠️ **PROBLEMI DELLO SPLIT**

#### ❌ **1. Duplicazione helpers** (+500 bytes)
```solidity
// Entrambi i contratti hanno bisogno:
function _getVaultRegistry() internal view returns (address) {
    return IBeacon(beacon).getImplementation("EulerRegistry");
}

function _getVault(string memory tokenCode) internal view returns (address) {
    // ~50 bytes duplicati
}
```

#### ❌ **2. Complessità deployment**
- Deploy 2 contratti invece di 1
- Configurare Beacon con 2 indirizzi
- Modificare ProtocolManager routing
- Aggiornare LiquidityManager

#### ❌ **3. Gas overhead chiamate cross-contract**
```solidity
// PRIMA (monolitico): 1 chiamata
protocolManager.openLeverage() → eulerPlugin.openLeverageAtomic()

// DOPO (split): 1 chiamata (uguale)
protocolManager.openLeverage() → eulerLeverage.openLeverageAtomic()
```
Gas overhead minimo (~2.1k per CALL), ma **stesso numero di chiamate**.

#### ❌ **4. Maintenance overhead**
- 2 contratti da testare
- 2 contratti da auditare
- 2 contratti da upgradare

---

### ✅ **SOLUZIONE RACCOMANDATA**

**NON fare lo split**. Invece:

### **Opzione 1: OPTIMIZER (SEMPLICE)** ✅✅✅
```javascript
// hardhat.config.ts
optimizer: {
    enabled: true,
    runs: 200  // Ottimizza per bytecode, non gas runtime
}
```

**Risultato**:
- Bytecode: 24.1 KB → **~16-17 KB** (-33%)
- Gas deployment: +10-15%
- Gas runtime: +5-8%
- **DEPLOYABLE** ✅

---

### **Opzione 2: OPTIMIZER + Pulizia Aggressiva** ✅✅
Oltre all'optimizer, rimuovi:

1. **Eventi verbose** (-200 bytes)
   ```solidity
   // Riduci parametri eventi non critici
   ```

2. **Error strings** (-300 bytes)
   ```solidity
   // Usa custom errors (già fatto)
   ```

3. **Documentazione inline** (-500 bytes)
   ```solidity
   // Sposta NatSpec in file separato
   ```

**Risultato totale**: ~15 KB ✅

---

### 📊 **CONFRONTO FINALE**

| Soluzione | Complessità | Bytecode | Deploy | Gas Runtime | Raccomandato |
|-----------|-------------|----------|---------|-------------|--------------|
| **Nessuna modifica** | ⭐ | 24.1 KB ❌ | - | - | ❌ |
| **Optimizer solo** | ⭐⭐ | 16.5 KB ✅ | +10% | +5% | ✅✅✅ |
| **Split Core+Leverage** | ⭐⭐⭐⭐⭐ | 24.6 KB ❌ | +20% | +2% | ❌ |
| **Split + Optimizer** | ⭐⭐⭐⭐⭐ | 16.9 KB ✅ | +25% | +6% | ⚠️ |
| **Optimizer + Cleanup** | ⭐⭐⭐ | 15.0 KB ✅ | +12% | +5% | ✅✅ |

---

### 🎯 **RACCOMANDAZIONE FINALE**

**NON fare lo split**. 

Procedi così:
1. ✅ Abilita optimizer (runs: 200)
2. ✅ Rimuovi documentazione header verbose (80 righe → 20 righe)
3. ✅ Testa deployment

Lo split aggiungerebbe **complessità** 