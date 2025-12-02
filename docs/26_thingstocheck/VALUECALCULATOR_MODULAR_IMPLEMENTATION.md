# ValueCalculator Modular Implementation

**Data:** 2 Dicembre 2025  
**Sessione:** Rendere ValueCalculator modulare per supportare multi-protocollo

---

## 🎯 Obiettivo

Rendere `ValueCalculator` completamente modulare: invece di avere codice hardcoded per Euler, ora delega a `ProtocolManager.getAllProtocolsValue()` che loopa automaticamente su TUTTI i protocolli registrati (Euler, Morpho, Dolomite, futuri...).

---

## 📊 Prima vs Dopo

### PRIMA (Hardcoded per Euler)

```
ValueCalculator.getTotalPoolValue()
    ├── Calcolo token wallet
    └── _getEulerPositionValue() → Solo Euler hardcoded
```

**Problema:** Per aggiungere Morpho/Dolomite, serviva modificare ValueCalculator.

### DOPO (Modulare)

```
ValueCalculator.getTotalPoolValue()
    ├── Calcolo token wallet
    └── _getAllProtocolsValue() → MODULARE
        └── ProtocolManager.getAllProtocolsValue()
            ├── EulerLensAdapter.getTotalValue()
            ├── MorphoLensAdapter.getTotalValue() [FUTURO]
            ├── DolomiteLensAdapter.getTotalValue() [FUTURO]
            └── ...qualsiasi nuovo protocollo
```

**Beneficio:** Aggiungere un nuovo protocollo = creare i 3 Moschettieri (Plugin, LensAdapter, Registry) e registrarlo in ProtocolManager. ValueCalculator lo includerà automaticamente!

---

## 📁 File Modificati

### 1. `contracts/interfaces/IProtocolManager.sol`

**Aggiunte:**

```solidity
// ========== MODULAR VALUE CALCULATION ==========

/**
 * @notice Get total value across ALL active protocols (MODULAR)
 * @dev Loops through all registered protocols and sums their net values via LensAdapters
 */
function getAllProtocolsValue() external view returns (uint256 totalValueEth);

/**
 * @notice Get position breakdown for a specific protocol
 * @param protocolName Name of the protocol (e.g., "EulerV2", "Morpho", "Dolomite")
 * @return collateral Total collateral value in ETH
 * @return debt Total debt value in ETH
 * @return netValue Net value (collateral - debt) in ETH
 */
function getProtocolPositionBreakdown(string memory protocolName) 
    external 
    view 
    returns (uint256 collateral, uint256 debt, uint256 netValue);
```

---

### 2. `contracts/ProtocolManager.sol`

**Aggiunta funzione `getProtocolPositionBreakdown()`:**

```solidity
function getProtocolPositionBreakdown(string memory protocolName) 
    external 
    view 
    returns (uint256 collateral, uint256 debt, uint256 netValue) 
{
    ProtocolInfo storage info = protocols[protocolName];
    
    // Check if protocol is registered and active
    if (!isProtocolRegistered[protocolName] || !info.isActive) {
        return (0, 0, 0);
    }
    
    // Get value breakdown from LensAdapter
    try ILensAdapter(info.lensAdapter).getValueBreakdown() 
        returns (ILensAdapter.ValueBreakdown memory breakdown) 
    {
        return (breakdown.totalCollateralEth, breakdown.totalDebtEth, breakdown.netValueEth);
    } catch {
        // Fallback to getTotalValue
        try ILensAdapter(info.lensAdapter).getTotalValue() returns (uint256 value) {
            return (value, 0, value);
        } catch {
            return (0, 0, 0);
        }
    }
}
```

**Nota:** `getAllProtocolsValue()` esisteva già, ho solo aggiunto la dichiarazione all'interfaccia.

---

### 3. `contracts/ValueCalculator.sol`

**Modifiche:**

#### 3.1 Nuovo import

```solidity
import "./interfaces/IProtocolManager.sol";
```

#### 3.2 Nuova sezione `PROTOCOL INTEGRATION (MODULAR)`

```solidity
// ==================== PROTOCOL INTEGRATION (MODULAR) ====================

/**
 * @notice Get total value across ALL registered protocols (MODULAR)
 * @dev Delegates to ProtocolManager which loops through all active LensAdapters
 */
function _getAllProtocolsValue() internal view returns (uint256 protocolsValue) {
    try IBeacon(beacon).getImplementation("ProtocolManager") returns (address protocolManager) {
        if (protocolManager != address(0)) {
            try IProtocolManager(protocolManager).getAllProtocolsValue() returns (uint256 value) {
                return value;
            } catch {
                // Fallback to legacy Euler-only calculation
                return _getEulerPositionValue();
            }
        }
    } catch {
        return _getEulerPositionValue();
    }
    return 0;
}

/**
 * @notice Get position breakdown for a specific protocol
 */
function getProtocolPositionBreakdown(string memory protocolName) 
    external 
    view 
    returns (uint256 collateral, uint256 debt, uint256 netValue) 
{
    address protocolManager = IBeacon(beacon).getImplementation("ProtocolManager");
    if (protocolManager != address(0)) {
        try IProtocolManager(protocolManager).getProtocolPositionBreakdown(protocolName) 
            returns (uint256 col, uint256 dbt, uint256 net) 
        {
            return (col, dbt, net);
        } catch {
            return (0, 0, 0);
        }
    }
    return (0, 0, 0);
}
```

#### 3.3 Sostituzione chiamate in `getTotalPoolValue()` e `getTotalPoolValueView()`

**Da:**
```solidity
// ADD EULER LENDING POSITION VALUES
totalValue += _getEulerPositionValue();
```

**A:**
```solidity
// ADD ALL REGISTERED PROTOCOLS VALUE (MODULAR)
totalValue += _getAllProtocolsValue();
```

#### 3.4 Deprecazione funzioni legacy

```solidity
// ==================== LEGACY EULER INTEGRATION (DEPRECATED) ====================

/**
 * @notice DEPRECATED - Use _getAllProtocolsValue() instead
 * @dev Kept for backward compatibility as fallback when ProtocolManager is not available
 */
function _getEulerPositionValue() internal view returns (uint256 eulerValue) { ... }

/**
 * @notice DEPRECATED - Use getProtocolPositionBreakdown("EulerV2") instead
 * @dev Kept for backward compatibility
 */
function getEulerPositionBreakdown() external view returns (...) { ... }
```

---

## 🔄 Flusso Completo

```
Utente/Frontend chiede valore pool
        ↓
ValueCalculator.getTotalPoolValue()
        ↓
    1. Calcola WETH balance in ProxyGeneral
    2. Loop su tutti i token attivi (USDC, WBTC, ecc.)
    3. _getAllProtocolsValue() ← NUOVO MODULARE
        ↓
ProtocolManager.getAllProtocolsValue()
        ↓
    for each protocol in registeredProtocolNames:
        if (protocol.isActive):
            totalValue += ILensAdapter(protocol.lensAdapter).getTotalValue()
        ↓
Ritorna somma di:
    - EulerLensAdapter.getTotalValue() → 5 ETH
    - MorphoLensAdapter.getTotalValue() → 3 ETH [FUTURO]
    - DolomiteLensAdapter.getTotalValue() → 2 ETH [FUTURO]
    = 10 ETH totale
```

---

## ✅ Checklist Completamento

| Task | Stato |
|------|-------|
| Aggiungere `getAllProtocolsValue()` a IProtocolManager | ✅ |
| Aggiungere `getProtocolPositionBreakdown()` a IProtocolManager | ✅ |
| Implementare `getProtocolPositionBreakdown()` in ProtocolManager | ✅ |
| Aggiungere import IProtocolManager a ValueCalculator | ✅ |
| Creare `_getAllProtocolsValue()` in ValueCalculator | ✅ |
| Creare `getProtocolPositionBreakdown()` in ValueCalculator | ✅ |
| Sostituire `_getEulerPositionValue()` in getTotalPoolValue | ✅ |
| Sostituire `_getEulerPositionValue()` in getTotalPoolValueView | ✅ |
| Deprecare `_getEulerPositionValue()` | ✅ |
| Deprecare `getEulerPositionBreakdown()` | ✅ |
| Verificare compilazione | ⏳ Da fare |

---

## 🚀 Come Aggiungere un Nuovo Protocollo (es. Morpho)

Con questa implementazione, per aggiungere Morpho basta:

1. **Creare i 3 Moschettieri:**
   - `MorphoPlugin.sol` (implementa `IProtocolAdapter`)
   - `MorphoLensAdapter.sol` (implementa `ILensAdapter`)
   - `MorphoVaultRegistry.sol` (opzionale)

2. **Registrare in ProtocolManager:**
   ```solidity
   protocolManager.registerProtocol(
       "Morpho",
       morphoPluginAddress,
       morphoLensAdapterAddress,
       morphoRegistryAddress
   );
   ```

3. **FATTO!** ValueCalculator includerà automaticamente il valore Morpho nel calcolo del pool.

---

## 📝 Note Tecniche

### Backward Compatibility

- `_getEulerPositionValue()` è mantenuta come fallback
- Se `ProtocolManager` non è disponibile, usa ancora il vecchio metodo
- `getEulerPositionBreakdown()` continua a funzionare (deprecated ma attiva)

### Error Handling

Tutte le chiamate sono wrappate in `try/catch`:
- Se un protocollo fallisce, viene skippato (non blocca il calcolo)
- Log degli errori può essere aggiunto in futuro

### Gas Optimization

- Una sola chiamata a `getAllProtocolsValue()` invece di multiple
- ProtocolManager fa il loop interno (più efficiente)

---

## 📊 Riepilogo Architettura Finale

```
┌─────────────────────────────────────────────────────────────────┐
│                      ValueCalculator                             │
│  getTotalPoolValue() / getTotalPoolValueView()                  │
│         │                                                        │
│         └── _getAllProtocolsValue() ─────┐                      │
└─────────────────────────────────────────────┼───────────────────┘
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ProtocolManager                             │
│  getAllProtocolsValue() ──► Loop su registeredProtocolNames     │
│  getProtocolPositionBreakdown(name)                             │
│         │                                                        │
│         ├── protocols["EulerV2"].lensAdapter ────────┐          │
│         ├── protocols["Morpho"].lensAdapter ─────────┼─► FUTURO │
│         └── protocols["Dolomite"].lensAdapter ───────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│EulerLensAdapter│   │MorphoLensAdapter│  │DolomiteLensAdapter│
│ getTotalValue()│   │ getTotalValue() │  │ getTotalValue()  │
│getValueBreakdown│  │getValueBreakdown│  │getValueBreakdown │
└───────────────┘    └───────────────┘    └───────────────┘
      ✅ ATTIVO           🔮 FUTURO           🔮 FUTURO
```

---

## 🔗 File Correlati

- `docs/26_thingstocheck/SESSION_2024_12_02_MODULAR_WITHDRAWAL.md` - Sessione precedente sul withdrawal modulare
- `docs/23_Euler/Euler_Lending/IntegrationPlan/08_Integration_Plan*.md` - Piano originale di integrazione
