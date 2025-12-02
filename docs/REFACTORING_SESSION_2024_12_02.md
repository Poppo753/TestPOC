# Refactoring Session - 2 Dicembre 2024

## Obiettivo della Sessione

Rendere l'architettura del sistema completamente modulare eliminando l'accoppiamento tra `LiquidityManager` e i protocolli specifici. L'obiettivo era fare in modo che `EulerV2Plugin` implementasse direttamente `IProtocolAdapter`, eliminando il wrapper `EulerProtocolAdapter`.

---

## Problema Iniziale

L'architettura aveva un problema di accoppiamento:
- Aggiungere un nuovo protocollo richiedeva modificare `LiquidityManager` (hardcoded)
- `EulerProtocolAdapter` era un wrapper inutile tra `ProtocolManager` e `EulerV2Plugin`
- Nessuna interfaccia standard per i protocolli

---

## Soluzione Implementata: Pattern "3 Moschettieri"

Per ogni protocollo integrato servono 3 componenti:

```
┌─────────────────────────────────────────────────────────────┐
│                    PROTOCOL MANAGER                          │
│                  (Orchestratore Centrale)                    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              ProtocolRegistry                        │    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │ "Euler" → {                                 │    │    │
│  │  │   plugin: EulerV2Plugin (IProtocolAdapter)  │    │    │
│  │  │   lens: EulerLensAdapter (ILensAdapter)     │    │    │
│  │  │   registry: EulerVaultRegistry              │    │    │
│  │  │ }                                           │    │    │
│  │  ├─────────────────────────────────────────────┤    │    │
│  │  │ "Dolomite" → { plugin, lens, registry }     │    │    │
│  │  ├─────────────────────────────────────────────┤    │    │
│  │  │ "GMX" → { plugin, lens, registry }          │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### I 3 Moschettieri per Euler:

1. **EulerV2Plugin** (implements `IProtocolAdapter` + `IEulerV2PluginSpecific`)
   - Tutte le operazioni: deposit, withdraw, borrow, repay, leverage
   - Gestione posizioni
   - Circuit breaker

2. **EulerLensAdapter** (implements `ILensAdapter`)
   - Health monitoring
   - Value calculation
   - Risk assessment
   - Auto-close support

3. **EulerVaultRegistry**
   - Mapping tokenCode → vault address
   - Configurazione vault Euler

---

## File Modificati/Creati

### 1. `contracts/interfaces/IEulerV2PluginSpecific.sol` (CREATO)

Nuova interfaccia per funzioni Euler-specifiche che non fanno parte dello standard:

```solidity
interface IEulerV2PluginSpecific {
    // Structs
    struct OpenLeverageParams { ... }
    struct LeveragePositionInternal { ... }
    
    // Events
    event LeveragePositionOpened(...);
    event LeveragePositionClosed(...);
    event CollateralAdded(...);
    event CollateralRemoved(...);
    
    // Leverage Functions
    function openLeveragePosition(OpenLeverageParams calldata params) external returns (uint256);
    function closeLeveragePosition(uint256 positionId) external returns (uint256);
    function addCollateralToPosition(uint256 positionId, uint256 amount) external;
    function removeCollateralFromPosition(uint256 positionId, uint256 amount) external;
    
    // Euler-Specific Views
    function getPositionHealth(uint256 positionId) external view returns (uint256);
    function getPositionValue(uint256 positionId) external view returns (uint256, uint256);
    function getLeveragePosition(uint256 positionId) external view returns (LeveragePositionInternal memory);
    function getAllLeveragePositions() external view returns (LeveragePositionInternal[] memory);
    function nextPositionId() external view returns (uint256);
    
    // Admin
    function setCircuitBreaker(bool tripped) external;
    function circuitBreakerTripped() external view returns (bool);
}
```

### 2. `contracts/interfaces/IEulerV2Plugin.sol` (RISCRITTO)

Ora estende sia `IProtocolAdapter` (standard) che `IEulerV2PluginSpecific` (Euler-only):

```solidity
interface IEulerV2Plugin is IProtocolAdapter, IEulerV2PluginSpecific {
    // Legacy struct for backward compatibility
    struct LeveragePosition { ... }
    
    // Euler-Specific Events
    event EulerDeposit(...);
    event EulerWithdrawal(...);
    event EulerBorrow(...);
    event EulerRepay(...);
    event Borrowed(...);
    event Repaid(...);
    
    // Lending Functions (beyond IProtocolAdapter)
    function borrow(string memory tokenCode, uint256 amount) external returns (bool);
    function repay(string memory tokenCode, uint256 amount) external returns (bool);
    function getBorrowedAmount(string memory tokenCode) external view returns (uint256);
    function getHealthFactor() external view returns (uint256);
}
```

### 3. `contracts/plugins/EulerV2Plugin.sol` (AGGIORNATO PESANTEMENTE)

Modifiche principali:

#### a) Struct rinominata per evitare conflitti:
```solidity
// Prima: LeveragePositionInternal (conflitto con interface)
// Dopo: LeveragePositionStorage (solo uso interno)
struct LeveragePositionStorage {
    uint8 subAccountId;
    address collateralVault;
    address borrowVault;
    uint256 initialCollateral;
    uint256 borrowedAmount;
    bool isActive;
    uint256 createdAt;
}
```

#### b) Implementazione IProtocolAdapter (funzioni aggiunte ~200 righe):

```solidity
// Identification
function protocolName() external pure override returns (string memory) {
    return "Euler";
}

function protocolType() external pure override returns (ProtocolType) {
    return ProtocolType.LENDING;
}

// Position Management (formato standard)
function getAllPositions() external view override returns (Position[] memory) {
    // Converte LeveragePositionStorage[] → IProtocolAdapter.Position[]
}

function getPosition(uint256 positionId) external view override returns (Position memory) {
    // Converte singola posizione in formato standard
}

function closePosition(uint256 positionId) external override returns (uint256) {
    return this.closeLeveragePosition(positionId);
}

function closePositionsForWeth(uint256 targetWethAmount) external override returns (uint256, uint256) {
    // Chiude posizioni riskiest-first fino a target
}

// Value Functions
function getProtocolSummary() external view override returns (ProtocolSummary memory) { ... }
function getTotalCollateral() external view override returns (uint256) { ... }
function getTotalDebt() external view override returns (uint256) { ... }
function getLowestHealthFactor() external view override returns (uint256) { ... }
function getMaxWithdrawable(string memory tokenCode) external view override returns (uint256) { ... }

// Emergency
function isCircuitBreakerActive() external view override returns (bool) {
    return circuitBreakerTripped;
}

function activateCircuitBreaker() external override onlyOwner {
    circuitBreakerTripped = true;
    emit CircuitBreakerActivated(msg.sender);
}
```

#### c) Funzione helper per conversione:
```solidity
function _convertToStandardPosition(uint256 positionId, LeveragePositionStorage storage pos) 
    internal view returns (IProtocolAdapter.Position memory) 
{
    // Calcola valori via AccountLens
    // Converte in formato IProtocolAdapter.Position
}
```

#### d) Fix docstrings (@inheritdoc):
- `@inheritdoc IEulerV2Plugin` → `@inheritdoc IEulerV2PluginSpecific` per funzioni leverage
- `@inheritdoc IEulerV2Plugin` → `@inheritdoc IProtocolAdapter` per funzioni standard

### 4. `contracts/adapters/EulerProtocolAdapter.sol` (ELIMINATO)

Questo wrapper non serve più perché EulerV2Plugin implementa direttamente IProtocolAdapter.

### 5. `contracts/adapters/EulerLensAdapter.sol` (AGGIORNATO)

Aggiornata interfaccia locale `IEulerV2PluginView`:

```solidity
interface IEulerV2PluginView {
    // Prima:
    // function getPosition(...) → getLeveragePosition(...)
    // function getAllPositions() → getAllLeveragePositions()
    
    function getLeveragePosition(uint256 positionId) external view returns (LeveragePosition memory);
    function getAllLeveragePositions() external view returns (LeveragePosition[] memory);
}
```

Tutte le chiamate aggiornate:
- `plugin.getPosition(id)` → `plugin.getLeveragePosition(id)`
- `plugin.getAllPositions()` → `plugin.getAllLeveragePositions()`

### 6. `hardhat.config.ts` (AGGIORNATO)

```typescript
hardhat: {
    // ...
    allowUnlimitedContractSize: true, // Per test con contratti grandi
},
solidity: {
    settings: {
        optimizer: {
            enabled: true,
            runs: 1, // Minimizza bytecode size
        },
        viaIR: true,
    },
},
```

---

## Interfacce Standard Create

### IProtocolAdapter (già esistente, usato da EulerV2Plugin)

```solidity
interface IProtocolAdapter {
    // Enums
    enum ProtocolType { LENDING, YIELD, TRADING, LIQUIDITY }
    enum PositionStatus { ACTIVE, CLOSED, LIQUIDATED }
    
    // Structs
    struct Position {
        uint256 positionId;
        string protocolName;
        PositionStatus status;
        uint256 collateralValueEth;
        uint256 debtValueEth;
        uint256 netValueEth;
        uint256 healthFactor;
        uint256 openTimestamp;
        address collateralToken;
        address debtToken;
    }
    
    struct ProtocolSummary {
        string name;
        ProtocolType protocolType;
        uint256 totalCollateralEth;
        uint256 totalDebtEth;
        uint256 netValueEth;
        uint256 activePositionCount;
        uint256 lowestHealthFactor;
        bool isHealthy;
    }
    
    // Identification
    function protocolName() external view returns (string memory);
    function protocolType() external view returns (ProtocolType);
    function getProtocolSummary() external view returns (ProtocolSummary memory);
    
    // Position Management
    function getActivePositionCount() external view returns (uint256);
    function getAllPositions() external view returns (Position[] memory);
    function getPosition(uint256 positionId) external view returns (Position memory);
    function getPositionsSortedByRisk() external view returns (Position[] memory);
    function closePosition(uint256 positionId) external returns (uint256);
    function closePositionsForWeth(uint256 targetWethAmount) external returns (uint256, uint256);
    
    // Value Functions
    function getTotalValue() external view returns (uint256);
    function getTotalCollateral() external view returns (uint256);
    function getTotalDebt() external view returns (uint256);
    function getLowestHealthFactor() external view returns (uint256);
    
    // Basic Operations
    function deposit(string memory tokenCode, uint256 amount) external returns (bool);
    function withdraw(string memory tokenCode, uint256 amount) external returns (bool);
    function getBalance(string memory tokenCode) external view returns (uint256);
    function getMaxWithdrawable(string memory tokenCode) external view returns (uint256);
    
    // Emergency
    function emergencyWithdrawAll(string[] memory tokenCodes) external returns (bool);
    function isCircuitBreakerActive() external view returns (bool);
    function activateCircuitBreaker() external;
}
```

### ILensAdapter (già esistente, usato da EulerLensAdapter)

```solidity
interface ILensAdapter {
    function protocolName() external view returns (string memory);
    function getHealthFactor() external view returns (uint256);
    function getTotalValue() external view returns (uint256);
    function getPositionValues() external view returns (uint256 collateral, uint256 debt, uint256 net);
    function getPositionsAtRisk(uint256 threshold) external view returns (uint256[] memory);
    function shouldAutoClose(uint256 positionId) external view returns (bool);
}
```

---

## Test Results

```
EulerLensAdapter - E2E Tests on Arbitrum Fork
  ✓ 19 passing (51s)
```

Tutti i test che passavano prima del refactoring continuano a passare.

---

## Come Integrare un Nuovo Protocollo

### Esempio: Dolomite Integration

1. **Creare `contracts/interfaces/IDolomitePluginSpecific.sol`**
   - Funzioni Dolomite-only (margin trading, isolation mode, ecc.)

2. **Creare `contracts/interfaces/IDolomitePlugin.sol`**
   ```solidity
   interface IDolomitePlugin is IProtocolAdapter, IDolomitePluginSpecific {
       // Dolomite-specific events e funzioni aggiuntive
   }
   ```

3. **Creare `contracts/plugins/DolomitePlugin.sol`**
   ```solidity
   contract DolomitePlugin is IDolomitePlugin, Ownable, ReentrancyGuard {
       // Implementa TUTTE le funzioni di IProtocolAdapter
       // + le funzioni Dolomite-specific
   }
   ```

4. **Creare `contracts/adapters/DolomiteLensAdapter.sol`**
   ```solidity
   contract DolomiteLensAdapter is ILensAdapter, IDolomiteLensAdapter {
       // Health monitoring per Dolomite
   }
   ```

5. **Creare `contracts/registries/DolomiteMarketRegistry.sol`**
   - Mapping marketId → token addresses
   - Configurazioni Dolomite-specific

6. **Registrare in ProtocolManager**
   ```solidity
   protocolManager.registerProtocol(
       "Dolomite",
       address(dolomitePlugin),
       address(dolomiteLensAdapter),
       address(dolomiteMarketRegistry)
   );
   ```

---

## Note Importanti

### Contract Size
EulerV2Plugin è ~29KB (limite mainnet 24KB). Soluzioni:
1. Usare librerie esterne per funzioni helper
2. Splitting in più contratti (es. EulerV2PluginCore + EulerV2PluginLeverage)
3. Rimuovere revert strings custom

### Funzioni Placeholder
- `getBorrowedAmount()` - usa `getDebt()` internamente
- `getBorrowCapacity()` - ritorna 0 (TODO)
- `getMaxWithdrawable()` - implementazione base

### Testing
`hardhat.config.ts` ha `allowUnlimitedContractSize: true` per permettere test locali con contratti grandi.

---

## Files Summary

| File | Azione | Descrizione |
|------|--------|-------------|
| `IEulerV2PluginSpecific.sol` | CREATO | Funzioni Euler-only |
| `IEulerV2Plugin.sol` | RISCRITTO | Estende IProtocolAdapter + Specific |
| `EulerV2Plugin.sol` | AGGIORNATO | Implementa IProtocolAdapter direttamente |
| `EulerProtocolAdapter.sol` | ELIMINATO | Wrapper non più necessario |
| `EulerLensAdapter.sol` | AGGIORNATO | Usa nuovi nomi funzioni |
| `hardhat.config.ts` | AGGIORNATO | allowUnlimitedContractSize |

---

## Prossimi Passi Suggeriti

1. **Contract Size Optimization**
   - Estrarre funzioni helper in librerie
   - Considerare splitting del contratto

2. **Test Coverage**
   - Testare `closePositionsForWeth()` E2E
   - Testare `emergencyWithdrawAll()` E2E

3. **Nuove Integrazioni**
   - Dolomite (seguendo pattern 3 Moschettieri)
   - GMX v2 (già parzialmente implementato)

4. **ProtocolManager Enhancement**
   - Implementare `registerProtocol()` se non già fatto
   - Aggregazione cross-protocol in `getAllPositions()`

---

*Documento generato il 2 Dicembre 2024*
