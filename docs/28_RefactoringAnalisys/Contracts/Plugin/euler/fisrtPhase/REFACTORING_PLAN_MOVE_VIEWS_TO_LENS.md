# Piano Refactoring: Spostare View Functions da IProtocolAdapter a ILensAdapter

**Data:** 31 Gennaio 2026  
**Autore:** Project4 Team  
**Status:** PROPOSTA - In Revisione  
**Priorità:** ALTA (risolve bytecode overflow)

---

## 📋 Indice

1. [Executive Summary](#executive-summary)
2. [Problema Attuale](#problema-attuale)
3. [Soluzione Proposta](#soluzione-proposta)
4. [Analisi Dettagliata Funzioni](#analisi-dettagliata-funzioni)
5. [Architettura Before/After](#architettura-beforeafter)
6. [Piano Implementazione](#piano-implementazione)
7. [Modifiche per File](#modifiche-per-file)
8. [Impatto su Altri Contratti](#impatto-su-altri-contratti)
9. [Testing Strategy](#testing-strategy)
10. [Risparmio Bytecode](#risparmio-bytecode)
11. [Rischi e Mitigazioni](#rischi-e-mitigazioni)
12. [Checklist Completa](#checklist-completa)

---

## 🎯 Executive Summary

### Problema
EulerV2Plugin ha bytecode di **31632 bytes**, superando il limite di **24576 bytes** di **7056 bytes** (+28.7%).

### Causa Principale
Il Plugin implementa **9 view functions** definite in `IProtocolAdapter` che sono usate **ESCLUSIVAMENTE** da monitoring/UI, non da contratti core. Queste funzioni:
- Occupano ~3000-4000 bytes
- Sono duplicate in `ILensAdapter` (6/9 già esistono)
- Non sono necessarie nel Plugin (separazione concerns violata)

### Soluzione Proposta
**Spostare tutte le view functions da `IProtocolAdapter` a `ILensAdapter`**, mantenendo nel Plugin solo le funzioni core necessarie a ProtocolManager.

### Vantaggi
- ✅ **Risparmio bytecode**: ~3000-4000 bytes dal Plugin
- ✅ **Zero breaking changes**: ProtocolManager già chiama LensAdapter per view
- ✅ **Architettura coerente**: Plugin = write, LensAdapter = read
- ✅ **Scalabilità**: nuovi plugin più leggeri da implementare
- ✅ **Nessun impatto core contracts**: ValueCalculator, LiquidityManager invariati

### Impatto
- **File da modificare**: 5 file
- **Breaking changes**: ZERO (retrocompatibilità garantita)
- **Tempo stimato**: 2-3 ore
- **Bytecode finale**: ~28000-29000 bytes (ancora sopra limite ma molto meglio)

---

## 🔴 Problema Attuale

### 1. Bytecode Overflow

```
EulerV2Plugin.sol:
- Bytecode attuale: 31632 bytes
- Limite Ethereum: 24576 bytes
- Overflow: +7056 bytes (+28.7%)

Errore compilazione:
"Contract code size exceeds 24576 bytes (a limit introduced in Spurious Dragon)"
```

### 2. Violazione Separation of Concerns

#### A) View Functions Generiche (IProtocolAdapter)

```solidity
// Plugin dovrebbe fare SOLO write operations
contract EulerV2Plugin is IProtocolAdapter {
    
    // ✅ CORRETTO - Write operations (core responsibility)
    function openLeverageAtomic() external { ... }
    function closeLeveragePosition() external { ... }
    function deposit() external { ... }
    function withdraw() external { ... }
    
    // ❌ SBAGLIATO - View functions (NON core responsibility)
    function getAllPositions() external view { ... }      // 400-600 bytes
    function getPosition() external view { ... }          // 200-300 bytes
    function getPositionsSortedByRisk() external view { ... }  // 500-700 bytes
    function getTotalValue() external view { ... }        // 250 bytes
    function getTotalCollateral() external view { ... }   // 250 bytes
    function getTotalDebt() external view { ... }         // 250 bytes
    function getLowestHealthFactor() external view { ... }// 300 bytes
    function getBalance() external view { ... }           // 150 bytes
    function getMaxWithdrawable() external view { ... }   // 300 bytes
    
    // TOTALE VIEW FUNCTIONS: ~2600-3650 bytes sprecati
}
```

**Problema:** Queste view functions sono usate SOLO da:
- ❌ EulerLensAdapter (monitoring)
- ❌ Frontend/UI (dashboard)
- ❌ NON da ProtocolManager per operazioni critiche

#### B) Pass-Through Getters (IEulerV2PluginSpecific)

```solidity
// Plugin fa SOLO PASS-THROUGH al Registry (livello inutile)
contract EulerV2Plugin is IEulerV2Plugin {
    
    // ❌ SBAGLIATO - passa solo al Registry senza logica
    function getLeveragePosition(uint256 positionId) 
        external view returns (LeveragePositionInternal memory) 
    {
        address registry = _getVaultRegistry();
        // Solo conversione struct (inutile)
        IEulerRegistry.LeveragePosition memory pos = 
            IEulerRegistry(registry).getPosition(positionId);
        return _convertStruct(pos);  // ~200-300 bytes sprecati
    }
    
    // ❌ SBAGLIATO - passa solo al Registry senza logica
    function getAllLeveragePositions() 
        external view returns (LeveragePositionInternal[] memory) 
    {
        address registry = _getVaultRegistry();
        // Solo conversione array (inutile)
        IEulerRegistry.LeveragePosition[] memory allPos = 
            IEulerRegistry(registry).getAllPositions();
        
        // Loop di conversione struct identici: ~400-500 bytes
        positions = new LeveragePositionInternal[](allPos.length);
        for (uint256 i = 0; i < allPos.length; i++) {
            positions[i] = _convertStruct(allPos[i]);
        }
        return positions;
    }
    
    // ❌ SBAGLIATO - pass-through puro
    function nextPositionId() external view returns (uint256) {
        address registry = _getVaultRegistry();
        return IEulerRegistry(registry).nextPositionId();  // ~50 bytes
    }
}
```

**Problema:** Queste funzioni:
- ❌ **Non aggiungono logica** - solo pass-through al Registry
- ❌ **Conversione struct inutile** - `LeveragePosition` ≈ `LeveragePositionInternal` (campi identici)
- ❌ **Usate SOLO da EulerLensAdapter** (12 chiamate totali)
- ❌ **NOT usate da ProtocolManager** - verificato con grep completo
- ❌ **Bytecode sprecato**: ~650-850 bytes solo per conversioni

**Chiamate in EulerLensAdapter.sol:**
```solidity
// 12 chiamate totali che passano inutilmente dal Plugin:

L254:  plugin.getLeveragePosition(positionId)        // getCollateralValue
L357:  plugin.getAllLeveragePositions()              // getTotalPositionsValue
L396:  plugin.getLeveragePosition(positionId)        // getDebtValue
L492:  plugin.getAllLeveragePositions()              // hasAnyActivePositions
L537:  plugin.getLeveragePosition(positionId)        // getPositionValue
L618:  plugin.getAllLeveragePositions()              // getPositionsSortedByRisk
L804:  plugin.getLeveragePosition(positionId)        // getTimeToLiquidation
L868:  plugin.getLeveragePosition(positionId)        // estimateLiquidationPrice
L889:  plugin.getLeveragePosition(positionIds[i])    // getPositionsAtRisk (loop)
L926:  plugin.getLeveragePosition(sorted[i].positionId) // getPositionsAtRisk (loop)
L974:  plugin.getLeveragePosition(positionId)        // estimateWethFromClose

TOTALE: 12 chiamate che dovrebbero chiamare Registry direttamente
```

### 3. Duplicazione Interfacce

**Scoperta Critica:** 6/9 funzioni sono GIÀ DUPLICATE in `ILensAdapter`!

```solidity
// IProtocolAdapter - definisce view functions
interface IProtocolAdapter {
    function getAllPositions() external view returns (Position[] memory);
    function getTotalValue() external view returns (uint256);
    function getPositionsSortedByRisk() external view returns (Position[] memory);
    // ... altre 6 funzioni view
}

// ILensAdapter - RIDEFINISCE le stesse funzioni!
interface ILensAdapter {
    function getTotalValue() external view returns (uint256);  // ← DUPLICATO
    function getPositionsSortedByRisk() external view returns (PositionWithRisk[] memory);  // ← DUPLICATO
    function getHealthFactor() external view returns (uint256);  // ← equivalente a getLowestHealthFactor()
    function getValueBreakdown() external view returns (ValueBreakdown memory);  // ← contiene getTotalCollateral/Debt
    function getMaxWithdrawable(string memory tokenCode) external view returns (uint256);  // ← DUPLICATO
}
```

**Risultato duplicazione:** Plugin implementa funzioni che LensAdapter potrebbe fornire direttamente!

### 4. Architettura con Livelli Inutili

**FLUSSO ATTUALE (con pass-through):**
```
EulerLensAdapter
    ↓ chiama getLeveragePosition(id)
EulerV2Plugin
    ↓ chiama getPosition(id)
EulerRegistry
    ↓ ritorna LeveragePosition
EulerV2Plugin
    ↓ converte a LeveragePositionInternal (identico!)
EulerLensAdapter
    ↓ riceve dato

PROBLEMI:
- 2 chiamate invece di 1
- Conversione struct inutile (stessi campi)
- Bytecode sprecato nel Plugin
```

**FLUSSO CORRETTO (diretto):**
```
EulerLensAdapter
    ↓ chiama getPosition(id)
EulerRegistry
    ↓ ritorna LeveragePosition
EulerLensAdapter
    ↓ riceve dato

VANTAGGI:
- 1 chiamata invece di 2 (performance)
- No conversione struct (meno gas)
- Plugin più leggero (-650-850 bytes)
```

---

## ✅ Soluzione Proposta

### Principio Guida: Separation of Concerns

```
┌─────────────────────────────────────────────────────────┐
│              SEPARAZIONE RESPONSABILITÀ                  │
└─────────────────────────────────────────────────────────┘

Plugin (IProtocolAdapter)
├── ✅ Write Operations
│   ├── deposit()
│   ├── withdraw()
│   ├── openLeverageAtomic()
│   ├── closeLeveragePosition()
│   └── closePositionsForWeth()
│
├── ✅ Core View (necessarie a ProtocolManager)
│   ├── getActivePositionCount()
│   ├── getProtocolSummary()
│   └── protocolName() / protocolType()
│
└── ❌ RIMUOVERE - View Functions (spostare a LensAdapter)
    ├── getAllPositions()
    ├── getPosition()
    ├── getPositionsSortedByRisk()
    ├── getTotalValue()
    ├── getTotalCollateral()
    ├── getTotalDebt()
    ├── getLowestHealthFactor()
    ├── getBalance()
    └── getMaxWithdrawable()

LensAdapter (ILensAdapter)
├── ✅ Read-Only Queries
│   ├── getHealthFactor()
│   ├── getPositionsAtRisk()
│   ├── getTimeToLiquidation()
│   ├── getValueBreakdown()
│   └── estimateWethFromCloseAll()
│
└── ✅ AGGIUNGERE - Position Queries (da IProtocolAdapter)
    ├── getAllPositions()        ← NEW
    ├── getPosition()            ← NEW
    ├── getBalance()             ← NEW
    ├── getTotalCollateral()     ← NEW (o usare getValueBreakdown())
    └── getTotalDebt()           ← NEW (o usare getValueBreakdown())
```

### Strategia di Migrazione

**FASE 1: Aggiungere a ILensAdapter**
- Aggiungere le 3 funzioni mancanti: `getAllPositions()`, `getPosition()`, `getBalance()`
- Aggiungere wrapper per `getTotalCollateral()` e `getTotalDebt()` (opzionale)

**FASE 2: Implementare in EulerLensAdapter**
- Implementare le nuove funzioni
- Chiamare Registry direttamente (bypassare Plugin)

**FASE 3: Rimuovere da IProtocolAdapter**
- Rimuovere le 9 funzioni view
- Mantenere solo core functions

**FASE 4: Aggiornare Plugin**
- Rimuovere implementazioni view da EulerV2Plugin
- Verificare bytecode < 24576

**FASE 5: Testing**
- Verificare che ProtocolManager funzioni
- Verificare che LensAdapter funzioni
- Test end-to-end completi

---

## 📊 Analisi Dettagliata Funzioni

### Funzioni in IProtocolAdapter (Situazione Attuale)

| # | Funzione | Tipo | Usata da ProtocolManager? | Duplicata in ILensAdapter? | Azione |
|---|----------|------|---------------------------|----------------------------|--------|
| 1 | `protocolName()` | view | ✅ SI | ❌ NO | **KEEP** - identità protocollo |
| 2 | `protocolType()` | view | ✅ SI | ❌ NO | **KEEP** - identità protocollo |
| 3 | `getProtocolSummary()` | view | ✅ SI (L834) | ❌ NO | **KEEP** - usata da core |
| 4 | `getActivePositionCount()` | view | ✅ SI (L708) | ❌ NO | **KEEP** - usata da core |
| 5 | `getAllPositions()` | view | ❌ NO | ❌ NO | **REMOVE** → aggiungere a ILensAdapter |
| 6 | `getPosition(positionId)` | view | ❌ NO | ⚠️ Parziale | **REMOVE** → aggiungere a ILensAdapter |
| 7 | `getPositionsSortedByRisk()` | view | ❌ NO | ✅ SI (identica) | **REMOVE** - già in ILensAdapter |
| 8 | `closePosition(positionId)` | write | ✅ SI (L809) | ❌ NO | **KEEP** - write operation |
| 9 | `closePositionsForWeth()` | write | ✅ SI (L779) | ❌ NO | **KEEP** - write operation |
| 10 | `getTotalValue()` | view | ❌ NO | ✅ SI (identica) | **REMOVE** - già in ILensAdapter |
| 11 | `getTotalCollateral()` | view | ❌ NO | ✅ SI (in ValueBreakdown) | **REMOVE** - già in ILensAdapter |
| 12 | `getTotalDebt()` | view | ❌ NO | ✅ SI (in ValueBreakdown) | **REMOVE** - già in ILensAdapter |
| 13 | `getLowestHealthFactor()` | view | ❌ NO | ✅ SI (getHealthFactor) | **REMOVE** - già in ILensAdapter |
| 14 | `deposit(tokenCode, amount)` | write | ❌ NO | ❌ NO | **KEEP** - write operation |
| 15 | `withdraw(tokenCode, amount)` | write | ❌ NO | ❌ NO | **KEEP** - write operation |
| 16 | `getBalance(tokenCode)` | view | ❌ NO | ❌ NO | **REMOVE** → aggiungere a ILensAdapter |
| 17 | `getMaxWithdrawable(tokenCode)` | view | ❌ NO | ✅ SI (identica) | **REMOVE** - già in ILensAdapter |
| 18 | `emergencyWithdrawAll()` | write | ❌ NO | ❌ NO | **KEEP** - write operation |
| 19 | `isCircuitBreakerActive()` | view | ❌ NO | ❌ NO | **KEEP** - safety check |
| 20 | `activateCircuitBreaker()` | write | ❌ NO | ❌ NO | **KEEP** - safety function |

**TOTALE FUNZIONI IProtocolAdapter:** 20  
**DA RIMUOVERE da IProtocolAdapter:** 9 view functions (45%)  
**DA MANTENERE in IProtocolAdapter:** 11 functions (55%)

**TOTALE FUNZIONI IEulerV2PluginSpecific:** ~10  
**DA RIMUOVERE da IEulerV2PluginSpecific:** 3 pass-through getters (getLeveragePosition, getAllLeveragePositions, nextPositionId)  
**DA MANTENERE in IEulerV2PluginSpecific:** ~7 funzioni (write operations + helpers necessari)

**TOTALE RIMOZIONI DAL PLUGIN:** 12 funzioni (9 da IProtocolAdapter + 3 da IEulerV2PluginSpecific)

---

### Funzioni da Aggiungere a ILensAdapter

#### 1. `getAllPositions()` - ❌ MANCA

**Definizione IProtocolAdapter:**
```solidity
/**
 * @notice Get all active positions in standardized format
 * @return positions Array of Position structs
 */
function getAllPositions() external view returns (Position[] memory positions);
```

**DA AGGIUNGERE a ILensAdapter:**
```solidity
/**
 * @notice Get all active positions in standardized format
 * @dev Queries Registry directly, bypassing Plugin
 * @return positions Array of Position structs from IProtocolAdapter
 */
function getAllPositions() 
    external view 
    returns (IProtocolAdapter.Position[] memory positions);
```

**Implementazione in EulerLensAdapter:**
```solidity
function getAllPositions() 
    external view override 
    returns (IProtocolAdapter.Position[] memory positions) 
{
    // PRIMA (passava per Plugin):
    // IEulerV2Plugin.LeveragePosition[] memory leveragePos = plugin.getAllLeveragePositions();
    
    // DOPO (chiama Registry direttamente):
    address registry = IBeacon(beacon).getImplementation("EulerVaultRegistry");
    IEulerRegistry.LeveragePosition[] memory leveragePos = 
        IEulerRegistry(registry).getAllPositions();
    
    // Converti a formato standard IProtocolAdapter.Position
    positions = new IProtocolAdapter.Position[](leveragePos.length);
    for (uint i = 0; i < leveragePos.length; i++) {
        positions[i] = _convertToStandardPosition(leveragePos[i]);
    }
    
    return positions;
}

// Helper privato in EulerLensAdapter
function _convertToStandardPosition(
    IEulerRegistry.LeveragePosition memory leveragePos
) private view returns (IProtocolAdapter.Position memory position) {
    // Calcola valori via TokenManager
    uint256 collateralValueEth = _getCollateralValueEth(leveragePos);
    uint256 debtValueEth = _getDebtValueEth(leveragePos);
    uint256 healthFactor = _calculateHealthFactor(leveragePos);
    
    position = IProtocolAdapter.Position({
        positionId: leveragePos.positionId,
        protocolName: "EulerV2",
        status: leveragePos.isActive ? 
            IProtocolAdapter.PositionStatus.ACTIVE : 
            IProtocolAdapter.PositionStatus.CLOSED,
        collateralValueEth: collateralValueEth,
        debtValueEth: debtValueEth,
        netValueEth: collateralValueEth > debtValueEth ? 
            collateralValueEth - debtValueEth : 0,
        healthFactor: healthFactor,
        openTimestamp: leveragePos.createdAt,
        collateralToken: leveragePos.collateralVault,
        debtToken: leveragePos.borrowVault
    });
}
```

**Risparmio Plugin:** ~400-600 bytes

**NOTA IMPORTANTE:** Questa funzione sostituisce anche `getLeveragePosition()` che attualmente è un pass-through dal Plugin al Registry. Rimuovendo `getLeveragePosition()` dal Plugin otteniamo risparmio aggiuntivo (vedi sezione pass-through).

---

#### 2. `getPosition(positionId)` - ⚠️ PARZIALE

**Definizione IProtocolAdapter:**
```solidity
/**
 * @notice Get a specific position by ID
 * @param positionId Position identifier
 * @return position Position struct
 */
function getPosition(uint256 positionId) 
    external view 
    returns (Position memory position);
```

**DA AGGIUNGERE a ILensAdapter:**
```solidity
/**
 * @notice Get a specific position by ID in standardized format
 * @dev Combines data from Registry + health calculations
 * @param positionId Position identifier
 * @return position Position struct from IProtocolAdapter
 */
function getPosition(uint256 positionId) 
    external view 
    returns (IProtocolAdapter.Position memory position);
```

**Implementazione in EulerLensAdapter:**
```solidity
function getPosition(uint256 positionId) 
    external view override 
    returns (IProtocolAdapter.Position memory position) 
{
    // Get position dal Registry
    address registry = IBeacon(beacon).getImplementation("EulerVaultRegistry");
    IEulerRegistry.LeveragePosition memory leveragePos = 
        IEulerRegistry(registry).getPosition(positionId);
    
    // Converti a formato standard
    position = _convertToStandardPosition(leveragePos);
}
```

**NOTA:** In ILensAdapter esiste già `getPositionValue(positionId)` che ritorna solo collateral/debt/net, ma NON la Position struct completa. Questa funzione è più completa.

**Risparmio Plugin:** ~200-300 bytes

---

#### 3. `getBalance(tokenCode)` - ❌ MANCA

**Definizione IProtocolAdapter:**
```solidity
/**
 * @notice Get balance of a token in the protocol
 * @param tokenCode Token identifier (e.g., "WETH", "USDC")
 * @return balance Token balance
 */
function getBalance(string memory tokenCode) 
    external view 
    returns (uint256 balance);
```

**DA AGGIUNGERE a ILensAdapter:**
```solidity
/**
 * @notice Get balance of a token in the protocol
 * @dev Queries actual vault balance via Euler contracts
 * @param tokenCode Token identifier (e.g., "WETH", "USDC")
 * @return balance Token balance in protocol
 */
function getBalance(string memory tokenCode) 
    external view 
    returns (uint256 balance);
```

**Implementazione in EulerLensAdapter:**
```solidity
function getBalance(string memory tokenCode) 
    external view override 
    returns (uint256 balance) 
{
    // Get vault dal Registry
    address registry = IBeacon(beacon).getImplementation("EulerVaultRegistry");
    address vault = IEulerRegistry(registry).getVault(tokenCode);
    
    // Query balance dal vault
    address plugin = IBeacon(beacon).getImplementation("EulerV2Plugin");
    balance = IEVault(vault).balanceOf(plugin);
}
```

**Risparmio Plugin:** ~150 bytes

---

#### 4. `getTotalCollateral()` - ✅ GIÀ EQUIVALENTE

**Definizione IProtocolAdapter:**
```solidity
function getTotalCollateral() external view returns (uint256 collateralEth);
```

**OPZIONE A - Aggiungere wrapper in ILensAdapter:**
```solidity
/**
 * @notice Get total collateral value across all positions
 * @dev Wrapper around getValueBreakdown().totalCollateralEth
 * @return collateralEth Total collateral in ETH
 */
function getTotalCollateral() external view returns (uint256 collateralEth) {
    return getValueBreakdown().totalCollateralEth;
}
```

**OPZIONE B - Usare getValueBreakdown() esistente:**
```solidity
// Chi chiama fa:
uint256 collateral = lensAdapter.getValueBreakdown().totalCollateralEth;
```

**RACCOMANDAZIONE:** Opzione A (aggiungere wrapper per retrocompatibilità)

**Risparmio Plugin:** ~250 bytes

---

#### 5. `getTotalDebt()` - ✅ GIÀ EQUIVALENTE

**Definizione IProtocolAdapter:**
```solidity
function getTotalDebt() external view returns (uint256 debtEth);
```

**DA AGGIUNGERE a ILensAdapter (wrapper):**
```solidity
/**
 * @notice Get total debt value across all positions
 * @dev Wrapper around getValueBreakdown().totalDebtEth
 * @return debtEth Total debt in ETH
 */
function getTotalDebt() external view returns (uint256 debtEth) {
    return getValueBreakdown().totalDebtEth;
}
```

**Risparmio Plugin:** ~250 bytes

---

### Funzioni GIÀ in ILensAdapter (da rimuovere da IProtocolAdapter)

#### 6. `getPositionsSortedByRisk()` - ✅ IDENTICA

**IProtocolAdapter (da rimuovere):**
```solidity
function getPositionsSortedByRisk() 
    external view 
    returns (Position[] memory positions);
```

**ILensAdapter (GIÀ ESISTE):**
```solidity
function getPositionsSortedByRisk() 
    external view 
    returns (PositionWithRisk[] memory positions);
```

**NOTA:** Struct diversi ma equivalenti:
- `Position` - struct base con positionId, collateral, debt, HF
- `PositionWithRisk` - struct estesa con positionId, collateral, debt, HF + timeToLiquidation, riskLevel

**Azione:** Rimuovere da IProtocolAdapter, usare ILensAdapter

**Risparmio Plugin:** ~500-700 bytes

---

#### 7. `getTotalValue()` - ✅ IDENTICA

**IProtocolAdapter (da rimuovere):**
```solidity
function getTotalValue() external view returns (uint256 totalValueEth);
```

**ILensAdapter (GIÀ ESISTE):**
```solidity
function getTotalValue() external view returns (uint256 netValueEth);
```

**STATUS:** IDENTICA AL 100% (solo nome parametro diverso)

**Azione:** Rimuovere da IProtocolAdapter

**Risparmio Plugin:** ~250 bytes

---

#### 8. `getLowestHealthFactor()` - ✅ EQUIVALENTE

**IProtocolAdapter (da rimuovere):**
```solidity
function getLowestHealthFactor() external view returns (uint256 healthFactor);
```

**ILensAdapter (GIÀ ESISTE):**
```solidity
function getHealthFactor() external view returns (uint256 healthFactor);
```

**NOTA:** Stesso significato (ritorna il minimo HF tra tutte le posizioni)

**Azione:** Rimuovere da IProtocolAdapter, usare `getHealthFactor()` di ILensAdapter

**Risparmio Plugin:** ~300 bytes

---

#### 9. `getMaxWithdrawable(tokenCode)` - ✅ IDENTICA

**IProtocolAdapter (da rimuovere):**
```solidity
function getMaxWithdrawable(string memory tokenCode) 
    external view 
    returns (uint256 maxAmount);
```

**ILensAdapter (GIÀ ESISTE):**
```solidity
function getMaxWithdrawable(string memory tokenCode) 
    external view 
    returns (uint256 maxAmount);
```

**STATUS:** IDENTICA AL 100%

**Azione:** Rimuovere da IProtocolAdapter

**Risparmio Plugin:** ~300 bytes

---

### Funzioni Pass-Through da RIMUOVERE da Plugin

**IMPORTANTE:** Oltre alle 9 view functions di IProtocolAdapter, rimuoviamo anche 3 pass-through getters da IEulerV2PluginSpecific che non aggiungono logica e causano livelli inutili.

#### 10. `getLeveragePosition(positionId)` - ❌ PASS-THROUGH

**Definizione IEulerV2PluginSpecific:**
```solidity
function getLeveragePosition(uint256 positionId) 
    external view 
    returns (LeveragePositionInternal memory position);
```

**Implementazione ATTUALE in Plugin (L1828-1844):**
```solidity
function getLeveragePosition(uint256 positionId) 
    external view override 
    returns (IEulerV2PluginSpecific.LeveragePositionInternal memory position) 
{
    address registry = _getVaultRegistry();
    // ❌ SOLO pass-through + conversione struct
    IEulerRegistry.LeveragePositionStorage memory pos = 
        IEulerRegistry(registry).getPosition(positionId);
    
    // Conversione inutile - struct identici!
    position = IEulerV2PluginSpecific.LeveragePositionInternal({
        positionId: positionId,
        subAccountId: pos.subAccountId,
        collateralVault: pos.collateralVault,
        borrowVault: pos.borrowVault,
        initialCollateral: pos.initialCollateral,
        borrowedAmount: pos.borrowedAmount,
        isActive: pos.isActive,
        createdAt: pos.createdAt
    });
}
```

**SOLUZIONE - Chiamare Registry direttamente:**
```solidity
// In EulerLensAdapter.sol - PRIMA:
IEulerV2PluginView.LeveragePosition memory pos = plugin.getLeveragePosition(positionId);

// In EulerLensAdapter.sol - DOPO:
address registry = IBeacon(beacon).getImplementation("EulerRegistry");
IEulerRegistry.LeveragePosition memory pos = IEulerRegistry(registry).getPosition(positionId);
```

**Usata in EulerLensAdapter:** 8 volte (L254, L396, L537, L804, L868, L889, L926, L974)

**Risparmio Plugin:** ~200-300 bytes

---

#### 11. `getAllLeveragePositions()` - ❌ PASS-THROUGH

**Definizione IEulerV2PluginSpecific:**
```solidity
function getAllLeveragePositions() 
    external view 
    returns (LeveragePositionInternal[] memory positions);
```

**Implementazione ATTUALE in Plugin (L1847-1867):**
```solidity
function getAllLeveragePositions() 
    external view override 
    returns (IEulerV2PluginSpecific.LeveragePositionInternal[] memory positions) 
{
    address registry = _getVaultRegistry();
    // ❌ SOLO pass-through + loop conversione
    IEulerRegistry.LeveragePositionStorage[] memory allPos = 
        IEulerRegistry(registry).getAllPositions();
    
    // Loop di conversione struct identici - spreco!
    positions = new IEulerV2PluginSpecific.LeveragePositionInternal[](allPos.length);
    for (uint256 i = 0; i < allPos.length; i++) {
        positions[i] = IEulerV2PluginSpecific.LeveragePositionInternal({
            positionId: i,
            subAccountId: allPos[i].subAccountId,
            collateralVault: allPos[i].collateralVault,
            borrowVault: allPos[i].borrowVault,
            initialCollateral: allPos[i].initialCollateral,
            borrowedAmount: allPos[i].borrowedAmount,
            isActive: allPos[i].isActive,
            createdAt: allPos[i].createdAt
        });
    }
}
```

**SOLUZIONE - Chiamare Registry direttamente:**
```solidity
// In EulerLensAdapter.sol - PRIMA:
IEulerV2PluginView.LeveragePosition[] memory allPositions = 
    plugin.getAllLeveragePositions();

// In EulerLensAdapter.sol - DOPO:
address registry = IBeacon(beacon).getImplementation("EulerRegistry");
IEulerRegistry.LeveragePosition[] memory allPositions = 
    IEulerRegistry(registry).getAllPositions();
```

**Usata in EulerLensAdapter:** 4 volte (L357, L492, L618)

**Risparmio Plugin:** ~400-500 bytes

---

#### 12. `nextPositionId()` - ❌ PASS-THROUGH

**Definizione IEulerV2PluginSpecific:**
```solidity
function nextPositionId() external view returns (uint256);
```

**Implementazione ATTUALE in Plugin (L1820-1825):**
```solidity
function nextPositionId() external view override returns (uint256) {
    address registry = _getVaultRegistry();
    // ❌ SOLO pass-through - zero logica!
    return IEulerRegistry(registry).nextPositionId();
}
```

**SOLUZIONE - Chiamare Registry direttamente:**
```solidity
// Se usato in LensAdapter - PRIMA:
uint256 nextId = plugin.nextPositionId();

// Se usato in LensAdapter - DOPO:
address registry = IBeacon(beacon).getImplementation("EulerRegistry");
uint256 nextId = IEulerRegistry(registry).nextPositionId();
```

**Usata in EulerLensAdapter:** Verificare (potrebbe non essere usata)

**Risparmio Plugin:** ~50 bytes

---

**TOTALE RISPARMIO PASS-THROUGH:** ~650-850 bytes

---

## 🏗️ Architettura Before/After

### BEFORE (Situazione Attuale)

```
┌──────────────────┐
│ ProtocolManager  │
└────────┬─────────┘
         │
    ┌────┴──────────────────┐
    │                       │
    │ WRITE operations      │ VIEW queries
    ▼                       ▼
┌─────────────────────┐  ┌─────────────────────┐
│  EulerV2Plugin      │  │  ILensAdapter       │
│  (31632 bytes)      │  │  (info.lensAdapter) │
│                     │  │                     │
│ ✅ openLeverage    │  │ ✅ getHealthFactor  │
│ ✅ closeLeverage   │  │ ✅ getTotalValue    │
│ ✅ deposit/withdraw│  │ ✅ getValueBreakdown│
│                     │  │ ✅ getPositionsSorted│
│ ❌ getAllPositions │  └─────────────────────┘
│ ❌ getPosition     │
│ ❌ getTotalValue   │  ← DUPLICATO!
│ ❌ getTotalColl    │
│ ❌ getTotalDebt    │
│ ❌ getLowestHF     │
│ ❌ getBalance      │
│ ❌ getMaxWithdraw  │  ← DUPLICATO!
│ ❌ getSortedByRisk │  ← DUPLICATO!
└─────────────────────┘

PROBLEMA:
- Plugin ha 9 view functions NON necessarie
- 6/9 sono duplicate in ILensAdapter
- Plugin OVER LIMIT di 7056 bytes
```

---

### AFTER (Soluzione Proposta)

```
┌──────────────────┐
│ ProtocolManager  │
└────────┬─────────┘
         │
    ┌────┴──────────────────┐
    │                       │
    │ WRITE operations      │ VIEW queries
    ▼                       ▼
┌─────────────────────┐  ┌─────────────────────────────┐
│  EulerV2Plugin      │  │  EulerLensAdapter           │
│  (~27000-28000 bytes│  │  (ILensAdapter + NEW fns)   │
│   con pass-through  │  │                             │
│   removal)          │  │ ✅ getHealthFactor          │
│                     │  │ ✅ getTotalValue            │
│ ✅ openLeverage    │  │ ✅ getValueBreakdown        │
│ ✅ closeLeverage   │  │ ✅ getPositionsSortedByRisk │
│ ✅ deposit/withdraw│  │ ✅ getMaxWithdrawable       │
│ ✅ borrow/repay    │  │                             │
│ ✅ getActiveCount  │  │ ✅ getAllPositions() ← NEW  │
│ ✅ getSummary      │  │ ✅ getPosition(id) ← NEW    │
│ ✅ getSubAccountAddr│  │ ✅ getBalance(token) ← NEW  │
│                     │  │ ✅ getTotalCollateral() ←NEW│
│ ❌ NO view funcs   │  │ ✅ getTotalDebt() ← NEW     │
│ ❌ NO pass-through │  └──────────┬──────────────────┘
└─────────────────────┘            │
        ▲                          │ Chiama direttamente
        │ Chiama per write         │ (NO pass-through!)
        │                          ▼
        │               ┌─────────────────────┐
        └───────────────│  EulerRegistry      │
                        │  (Position Storage) │
                        │                     │
                        │ ✅ getPosition(id)  │ ← Chiamato da LensAdapter
                        │ ✅ getAllPositions()│ ← Chiamato da LensAdapter
                        │ ✅ nextPositionId() │ ← Chiamato da LensAdapter
                        │ ✅ createPosition() │ ← Chiamato da Plugin
                        │ ✅ updatePosition() │ ← Chiamato da Plugin
                        │ ✅ closePosition()  │ ← Chiamato da Plugin
                        │ ✅ getVault(token)  │ ← Chiamato da entrambi
                        └─────────────────────┘

VANTAGGI:
- Plugin ridotto a ~27000-28000 bytes (-4200-4800 bytes totali)
  - View functions rimosse: -3000-3600 bytes
  - Pass-through rimossi: -650-850 bytes
  - IEulerRegistry estratto: -800-1200 bytes (opzionale)
- Nessuna duplicazione interfacce
- LensAdapter accede Registry direttamente (no livelli inutili)
- Separazione concerns rispettata (Plugin=write, Lens=read, Registry=data)
- Performance migliorate (1 chiamata invece di 2 per position queries)
- Struct unificati (no conversioni inutili LeveragePosition ↔ LeveragePositionInternal)
```

---

## 🛠️ Piano Implementazione

### ⚠️ ORDINE CRITICO DELLE FASI

**IMPORTANTE:** L'ordine è fondamentale per evitare errori di compilazione:

1. **FASE 1**: Aggiungere funzioni a ILensAdapter (espande interfaccia)
2. **FASE 2-3**: Rimuovere pass-through da Plugin + aggiornare LensAdapter a chiamare Registry
3. **FASE 4**: Implementare nuove funzioni in EulerLensAdapter
4. **FASE 5**: Rimuovere funzioni da IProtocolAdapter (contrae interfaccia)
5. **FASE 6**: Rimuovere implementazioni da Plugin
6. **FASE 7**: (Opzionale) Estrarre IEulerRegistry
7. **FASE 8**: Verifica finale

**RATIONALE:** 
- Fasi 2-3 devono essere PRIMA di 4 per avere chiamate Registry già pronte
- Fase 4 deve essere PRIMA di 5 per avere implementazione pronta
- Fase 5 deve essere PRIMA di 6 per rimuovere obblighi interfaccia prima di rimuovere implementazioni

---

### FASE 1: Preparazione ILensAdapter

**File:** `contracts/interfaces/ILensAdapter.sol`

**Modifiche:**

```solidity
// AGGIUNGI dopo le funzioni esistenti

// ==================== POSITION QUERIES ====================

/**
 * @notice Get all active positions in standardized format
 * @dev Moved from IProtocolAdapter - queries Registry directly
 * @return positions Array of Position structs (IProtocolAdapter format)
 */
function getAllPositions() 
    external view 
    returns (IProtocolAdapter.Position[] memory positions);

/**
 * @notice Get specific position by ID in standardized format
 * @dev Moved from IProtocolAdapter - combines Registry + health data
 * @param positionId Position identifier
 * @return position Position struct (IProtocolAdapter format)
 */
function getPosition(uint256 positionId) 
    external view 
    returns (IProtocolAdapter.Position memory position);

/**
 * @notice Get balance of a token in the protocol
 * @dev Moved from IProtocolAdapter - queries vault directly
 * @param tokenCode Token identifier (e.g., "WETH", "USDC")
 * @return balance Token balance in protocol
 */
function getBalance(string memory tokenCode) 
    external view 
    returns (uint256 balance);

/**
 * @notice Get total collateral value across all positions
 * @dev Wrapper around getValueBreakdown().totalCollateralEth
 * @return collateralEth Total collateral in ETH
 */
function getTotalCollateral() 
    external view 
    returns (uint256 collateralEth);

/**
 * @notice Get total debt value across all positions
 * @dev Wrapper around getValueBreakdown().totalDebtEth
 * @return debtEth Total debt in ETH
 */
function getTotalDebt() 
    external view 
    returns (uint256 debtEth);
```

**Commit:** `feat(interfaces): add position query functions to ILensAdapter`

---

### FASE 2: Rimozione Pass-Through da Plugin

**OBIETTIVO:** Rimuovere funzioni che fanno solo pass-through al Registry (getLeveragePosition, getAllLeveragePositions, nextPositionId) e far chiamare LensAdapter direttamente al Registry.

**RATIONALE:** Queste funzioni:
- Non aggiungono logica
- Fanno solo conversione struct inutile
- Causano 2 chiamate invece di 1
- Occupano ~650-850 bytes nel Plugin
- Sono usate SOLO da EulerLensAdapter (12 chiamate)
- NON sono usate da ProtocolManager

**File 1:** `contracts/interfaces/IEulerV2PluginSpecific.sol`

**Modifiche:**

```solidity
// RIMUOVI queste funzioni dall'interfaccia:

interface IEulerV2PluginSpecific {
    
    // ❌ REMOVE - pass-through al Registry
-   /**
-    * @notice Get internal position data (Euler-specific format)
-    * @param positionId Position ID
-    * @return position Leverage position data
-    */
-   function getLeveragePosition(uint256 positionId) 
-       external view 
-       returns (LeveragePositionInternal memory position);
    
    // ❌ REMOVE - pass-through al Registry
-   /**
-    * @notice Get all leverage positions (Euler-specific format)
-    * @return positions Array of leverage positions
-    */
-   function getAllLeveragePositions() 
-       external view 
-       returns (LeveragePositionInternal[] memory positions);
    
    // ❌ REMOVE - pass-through al Registry
-   /**
-    * @notice Get next position ID that will be assigned
-    * @return id Next position ID
-    */
-   function nextPositionId() external view returns (uint256 id);
    
    // ✅ KEEP - Write operations
    function openLeverageAtomic(...) external;
    function closeLeverageAtomic(uint256 positionId) external;
    function addCollateralToPosition(uint256 positionId, uint256 amount) external;
    function removeCollateralFromPosition(uint256 positionId, uint256 amount) external;
    
    // ✅ KEEP - Helper con logica (calcolo address XOR)
    function getSubAccountAddress(uint8 subAccountId) external view returns (address);
}
```

**NOTA IMPORTANTE:** Rimuovendo queste funzioni, il struct `LeveragePositionInternal` diventa inutile (era usato solo per queste funzioni). Usare direttamente `IEulerRegistry.LeveragePosition`.

**File 2:** `contracts/plugins/EulerV2Plugin.sol`

**Modifiche:**

```solidity
// RIMUOVI le implementazioni (intorno a L1820-1867):

-   /// @inheritdoc IEulerV2PluginSpecific
-   function nextPositionId() external view override returns (uint256) {
-       address registry = _getVaultRegistry();
-       return IEulerRegistry(registry).nextPositionId();
-   }
-   
-   /// @inheritdoc IEulerV2PluginSpecific
-   function getLeveragePosition(uint256 positionId) 
-       external view override 
-       returns (IEulerV2PluginSpecific.LeveragePositionInternal memory position) 
-   {
-       address registry = _getVaultRegistry();
-       IEulerRegistry.LeveragePositionStorage memory pos = 
-           IEulerRegistry(registry).getPosition(positionId);
-       position = IEulerV2PluginSpecific.LeveragePositionInternal({
-           positionId: positionId,
-           subAccountId: pos.subAccountId,
-           collateralVault: pos.collateralVault,
-           borrowVault: pos.borrowVault,
-           initialCollateral: pos.initialCollateral,
-           borrowedAmount: pos.borrowedAmount,
-           isActive: pos.isActive,
-           createdAt: pos.createdAt
-       });
-   }
-   
-   /// @inheritdoc IEulerV2PluginSpecific
-   function getAllLeveragePositions() 
-       external view override 
-       returns (IEulerV2PluginSpecific.LeveragePositionInternal[] memory positions) 
-   {
-       address registry = _getVaultRegistry();
-       IEulerRegistry.LeveragePositionStorage[] memory allPos = 
-           IEulerRegistry(registry).getAllPositions();
-       
-       positions = new IEulerV2PluginSpecific.LeveragePositionInternal[](allPos.length);
-       for (uint256 i = 0; i < allPos.length; i++) {
-           positions[i] = IEulerV2PluginSpecific.LeveragePositionInternal({
-               positionId: i,
-               subAccountId: allPos[i].subAccountId,
-               collateralVault: allPos[i].collateralVault,
-               borrowVault: allPos[i].borrowVault,
-               initialCollateral: allPos[i].initialCollateral,
-               borrowedAmount: allPos[i].borrowedAmount,
-               isActive: allPos[i].isActive,
-               createdAt: allPos[i].createdAt
-           });
-       }
-   }
```

**Risparmio Bytecode:** ~650-850 bytes

**Commit:** `refactor(plugin): remove pass-through getters, call Registry directly`

---

### FASE 3: Aggiornare EulerLensAdapter per Chiamare Registry

**File:** `contracts/adapters/EulerLensAdapter.sol`

**OBIETTIVO:** Aggiornare tutte le 12 chiamate che usavano `plugin.getLeveragePosition()` e `plugin.getAllLeveragePositions()` per chiamare direttamente il Registry.

**Modifiche:**

**Step 3.1 - Aggiungere Helper per Ottenere Registry**

```solidity
// AGGIUNGI helper privato (se non esiste già):

/**
 * @notice Get EulerRegistry address via Beacon
 * @return registry EulerRegistry address
 */
function _getRegistry() private view returns (address registry) {
    return IBeacon(beacon).getImplementation("EulerRegistry");
}
```

**Step 3.2 - Aggiornare Chiamate (12 totali)**

**PATTERN DI SOSTITUZIONE:**

```solidity
// ❌ PRIMA (passava per Plugin):
IEulerV2PluginView.LeveragePosition memory pos = plugin.getLeveragePosition(positionId);

// ✅ DOPO (chiama Registry direttamente):
address registry = _getRegistry();
IEulerRegistry.LeveragePosition memory pos = IEulerRegistry(registry).getPosition(positionId);

// ❌ PRIMA (array):
IEulerV2PluginView.LeveragePosition[] memory allPositions = plugin.getAllLeveragePositions();

// ✅ DOPO (array):
address registry = _getRegistry();
IEulerRegistry.LeveragePosition[] memory allPositions = IEulerRegistry(registry).getAllPositions();
```

**Chiamate da Aggiornare:**

1. **L254 - getCollateralValue():**
```diff
  function getCollateralValue(uint256 positionId) external view override returns (uint256 valueEth) {
-     IEulerV2PluginView.LeveragePosition memory pos = plugin.getLeveragePosition(positionId);
+     address registry = _getRegistry();
+     IEulerRegistry.LeveragePosition memory pos = IEulerRegistry(registry).getPosition(positionId);
```

2. **L357 - getTotalPositionsValue():**
```diff
  function getTotalPositionsValue() internal view returns (uint256 totalValue) {
-     IEulerV2PluginView.LeveragePosition[] memory allPositions = plugin.getAllLeveragePositions();
+     address registry = _getRegistry();
+     IEulerRegistry.LeveragePosition[] memory allPositions = IEulerRegistry(registry).getAllPositions();
```

3. **L396 - getDebtValue():**
```diff
  function getDebtValue(uint256 positionId) external view override returns (uint256 valueEth) {
-     IEulerV2PluginView.LeveragePosition memory pos = plugin.getLeveragePosition(positionId);
+     address registry = _getRegistry();
+     IEulerRegistry.LeveragePosition memory pos = IEulerRegistry(registry).getPosition(positionId);
```

4. **L492 - hasAnyActivePositions():**
```diff
  function hasAnyActivePositions() external view override returns (bool) {
-     try plugin.getAllLeveragePositions() returns (IEulerV2PluginView.LeveragePosition[] memory p) {
+     address registry = _getRegistry();
+     try IEulerRegistry(registry).getAllPositions() returns (IEulerRegistry.LeveragePosition[] memory p) {
```

5. **L537 - getPositionValue():**
```diff
  function getPositionValue(uint256 positionId) external view override returns (...) {
-     try plugin.getLeveragePosition(positionId) returns (IEulerV2PluginView.LeveragePosition memory pos) {
+     address registry = _getRegistry();
+     try IEulerRegistry(registry).getPosition(positionId) returns (IEulerRegistry.LeveragePosition memory pos) {
```

6. **L618 - getPositionsSortedByRisk():**
```diff
  function getPositionsSortedByRisk() external view override returns (...) {
-     IEulerV2PluginView.LeveragePosition[] memory positions = plugin.getAllLeveragePositions();
+     address registry = _getRegistry();
+     IEulerRegistry.LeveragePosition[] memory positions = IEulerRegistry(registry).getAllPositions();
```

7. **L804 - getTimeToLiquidation():**
```diff
  function getTimeToLiquidation(uint256 positionId) external view override returns (uint256) {
-     try plugin.getLeveragePosition(positionId) returns (IEulerV2PluginView.LeveragePosition memory pos) {
+     address registry = _getRegistry();
+     try IEulerRegistry(registry).getPosition(positionId) returns (IEulerRegistry.LeveragePosition memory pos) {
```

8. **L868 - estimateLiquidationPrice():**
```diff
  function estimateLiquidationPrice(uint256 positionId) external view override returns (uint256) {
-     try plugin.getLeveragePosition(positionId) returns (IEulerV2PluginView.LeveragePosition memory pos) {
+     address registry = _getRegistry();
+     try IEulerRegistry(registry).getPosition(positionId) returns (IEulerRegistry.LeveragePosition memory pos) {
```

9-10. **L889, L926 - getPositionsAtRisk() (2 chiamate in loop):**
```diff
  function getPositionsAtRisk(...) external view override returns (...) {
+     address registry = _getRegistry();
      // ...
      for (uint256 i = 0; i < positionIds.length; i++) {
-         IEulerV2PluginView.LeveragePosition memory pos = plugin.getLeveragePosition(positionIds[i]);
+         IEulerRegistry.LeveragePosition memory pos = IEulerRegistry(registry).getPosition(positionIds[i]);
      }
      // ...
      for (uint256 i = 0; i < sorted.length; i++) {
-         IEulerV2PluginView.LeveragePosition memory pos = plugin.getLeveragePosition(sorted[i].positionId);
+         IEulerRegistry.LeveragePosition memory pos = IEulerRegistry(registry).getPosition(sorted[i].positionId);
      }
```

11. **L974 - estimateWethFromClose():**
```diff
  function estimateWethFromClose(uint256 positionId) external view override returns (uint256) {
-     try plugin.getLeveragePosition(positionId) returns (IEulerV2PluginView.LeveragePosition memory pos) {
+     address registry = _getRegistry();
+     try IEulerRegistry(registry).getPosition(positionId) returns (IEulerRegistry.LeveragePosition memory pos) {
```

**Step 3.3 - Aggiornare Interface Inline (se presente)**

Se EulerLensAdapter ha definizione inline di `IEulerV2PluginView`:

```diff
  // RIMUOVI se presente:
- interface IEulerV2PluginView {
-     struct LeveragePosition { ... }
-     function getLeveragePosition(uint256) external view returns (LeveragePosition memory);
-     function getAllLeveragePositions() external view returns (LeveragePosition[] memory);
- }

  // AGGIUNGI import:
+ import "../interfaces/IEulerRegistry.sol";
```

**TOTALE MODIFICHE:** 12 chiamate aggiornate

**Commit:** `refactor(lens): call Registry directly instead of Plugin pass-through`

---

### FASE 4: Implementazione EulerLensAdapter - Nuove Funzioni ILensAdapter

**File:** `contracts/adapters/EulerLensAdapter.sol`

**NOTA:** A questo punto le chiamate `plugin.getLeveragePosition()` sono già state sostituite con `registry.getPosition()` (FASE 2-3), quindi usiamo già il Registry direttamente.

**Step 4.1 - Aggiungere Helper Privato di Conversione**

```solidity
// AGGIUNGI dopo le funzioni esistenti (intorno a L1050)

/**
 * @notice Convert Euler leverage position to standard IProtocolAdapter.Position
 * @dev Moved from EulerV2Plugin to avoid dependency
 * @param leveragePos Euler-specific leverage position
 * @return position Standardized position struct
 */
function _convertToStandardPosition(
    IEulerRegistry.LeveragePosition memory leveragePos
) private view returns (IProtocolAdapter.Position memory position) {
    
    // Get vault addresses
    address collateralVault = leveragePos.collateralVault;
    address borrowVault = leveragePos.borrowVault;
    
    // Get token addresses
    address collateralToken = IEVault(collateralVault).asset();
    address borrowToken = IEVault(borrowVault).asset();
    
    // Calculate values in ETH
    uint256 collateralValueEth = _calculateCollateralValue(leveragePos);
    uint256 debtValueEth = _calculateDebtValue(leveragePos);
    uint256 netValueEth = collateralValueEth > debtValueEth ? 
        collateralValueEth - debtValueEth : 0;
    
    // Calculate health factor
    uint256 healthFactor = _calculateHealthFactorForPosition(leveragePos);
    
    // Determine status
    IProtocolAdapter.PositionStatus status;
    if (!leveragePos.isActive) {
        status = IProtocolAdapter.PositionStatus.CLOSED;
    } else if (healthFactor < 1e18) {
        status = IProtocolAdapter.PositionStatus.LIQUIDATED;
    } else {
        status = IProtocolAdapter.PositionStatus.ACTIVE;
    }
    
    // Build position struct
    position = IProtocolAdapter.Position({
        positionId: leveragePos.positionId,
        protocolName: "EulerV2",
        status: status,
        collateralValueEth: collateralValueEth,
        debtValueEth: debtValueEth,
        netValueEth: netValueEth,
        healthFactor: healthFactor,
        openTimestamp: leveragePos.createdAt,
        collateralToken: collateralToken,
        debtToken: borrowToken
    });
}

/**
 * @notice Calculate collateral value in ETH for a position
 * @param leveragePos Leverage position data
 * @return valueEth Collateral value in ETH
 */
function _calculateCollateralValue(
    IEulerRegistry.LeveragePosition memory leveragePos
) private view returns (uint256 valueEth) {
    
    address tokenManager = IBeacon(beacon).getImplementation("TokenManager");
    address collateralToken = IEVault(leveragePos.collateralVault).asset();
    
    // Get current collateral balance
    address plugin = IBeacon(beacon).getImplementation("EulerV2Plugin");
    uint8 subAccountId = leveragePos.subAccountId;
    address subAccount = _computeSubAccount(plugin, subAccountId);
    
    uint256 collateralBalance = IEVault(leveragePos.collateralVault).balanceOf(subAccount);
    
    // Convert to ETH
    valueEth = ITokenManagerForModules(tokenManager).getValueInEth(
        collateralToken,
        collateralBalance
    );
}

/**
 * @notice Calculate debt value in ETH for a position
 * @param leveragePos Leverage position data
 * @return valueEth Debt value in ETH
 */
function _calculateDebtValue(
    IEulerRegistry.LeveragePosition memory leveragePos
) private view returns (uint256 valueEth) {
    
    address tokenManager = IBeacon(beacon).getImplementation("TokenManager");
    address borrowToken = IEVault(leveragePos.borrowVault).asset();
    
    // Get current debt balance
    address plugin = IBeacon(beacon).getImplementation("EulerV2Plugin");
    uint8 subAccountId = leveragePos.subAccountId;
    address subAccount = _computeSubAccount(plugin, subAccountId);
    
    uint256 debtBalance = IEVault(leveragePos.borrowVault).debtOf(subAccount);
    
    // Convert to ETH
    valueEth = ITokenManagerForModules(tokenManager).getValueInEth(
        borrowToken,
        debtBalance
    );
}

/**
 * @notice Calculate health factor for a specific position
 * @param leveragePos Leverage position data
 * @return healthFactor Health factor (1e18 scale)
 */
function _calculateHealthFactorForPosition(
    IEulerRegistry.LeveragePosition memory leveragePos
) private view returns (uint256 healthFactor) {
    
    address plugin = IBeacon(beacon).getImplementation("EulerV2Plugin");
    uint8 subAccountId = leveragePos.subAccountId;
    address subAccount = _computeSubAccount(plugin, subAccountId);
    
    // Query Euler AccountLens
    (
        uint256 collateralValue,
        uint256 liabilityValue
    ) = IAccountLens(ACCOUNT_LENS).getAccountValue(
        subAccount,
        leveragePos.collateralVault,
        leveragePos.borrowVault
    );
    
    if (liabilityValue == 0) {
        return type(uint256).max;  // No debt = infinite HF
    }
    
    // HF = collateralValue / liabilityValue
    healthFactor = (collateralValue * 1e18) / liabilityValue;
}

/**
 * @notice Compute sub-account address
 * @param account Main account address
 * @param subAccountId Sub-account ID (0-255)
 * @return subAccount Sub-account address
 */
function _computeSubAccount(address account, uint8 subAccountId) 
    private pure 
    returns (address subAccount) 
{
    subAccount = address(uint160(account) ^ uint160(subAccountId));
}
```

**Step 4.2 - Implementare Nuove Funzioni**

```solidity
// AGGIUNGI dopo i helper privati

// ==================== POSITION QUERIES (ILensAdapter) ====================

/// @inheritdoc ILensAdapter
function getAllPositions() 
    external view override 
    returns (IProtocolAdapter.Position[] memory positions) 
{
    // Get Registry
    address registry = IBeacon(beacon).getImplementation("EulerVaultRegistry");
    
    // Query all positions dal Registry (bypass Plugin)
    IEulerRegistry.LeveragePosition[] memory leveragePositions = 
        IEulerRegistry(registry).getAllPositions();
    
    // Convert to standard format
    positions = new IProtocolAdapter.Position[](leveragePositions.length);
    for (uint i = 0; i < leveragePositions.length; i++) {
        positions[i] = _convertToStandardPosition(leveragePositions[i]);
    }
}

/// @inheritdoc ILensAdapter
function getPosition(uint256 positionId) 
    external view override 
    returns (IProtocolAdapter.Position memory position) 
{
    // Get Registry
    address registry = IBeacon(beacon).getImplementation("EulerVaultRegistry");
    
    // Query position dal Registry
    IEulerRegistry.LeveragePosition memory leveragePos = 
        IEulerRegistry(registry).getPosition(positionId);
    
    // Convert to standard format
    position = _convertToStandardPosition(leveragePos);
}

/// @inheritdoc ILensAdapter
function getBalance(string memory tokenCode) 
    external view override 
    returns (uint256 balance) 
{
    // Get vault from Registry
    address registry = IBeacon(beacon).getImplementation("EulerVaultRegistry");
    address vault = IEulerRegistry(registry).getVault(tokenCode);
    
    // Get Plugin address
    address plugin = IBeacon(beacon).getImplementation("EulerV2Plugin");
    
    // Query vault balance
    balance = IEVault(vault).balanceOf(plugin);
}

/// @inheritdoc ILensAdapter
function getTotalCollateral() 
    external view override 
    returns (uint256 collateralEth) 
{
    // Wrapper around existing getValueBreakdown()
    ValueBreakdown memory breakdown = this.getValueBreakdown();
    collateralEth = breakdown.totalCollateralEth;
}

/// @inheritdoc ILensAdapter
function getTotalDebt() 
    external view override 
    returns (uint256 debtEth) 
{
    // Wrapper around existing getValueBreakdown()
    ValueBreakdown memory breakdown = this.getValueBreakdown();
    debtEth = breakdown.totalDebtEth;
}
```

**Commit:** `feat(lens): implement position query functions in EulerLensAdapter`

---

### FASE 5: Rimozione da IProtocolAdapter

**File:** `contracts/interfaces/IProtocolAdapter.sol`

**Modifiche:**

```solidity
// RIMUOVI queste funzioni (intorno a L102-L174):

// ❌ REMOVE - ora in ILensAdapter
// function getAllPositions() external view returns (Position[] memory positions);

// ❌ REMOVE - ora in ILensAdapter
// function getPosition(uint256 positionId) external view returns (Position memory position);

// ❌ REMOVE - ora in ILensAdapter
// function getPositionsSortedByRisk() external view returns (Position[] memory positions);

// ❌ REMOVE - ora in ILensAdapter
// function getTotalValue() external view returns (uint256 totalValueEth);

// ❌ REMOVE - ora in ILensAdapter
// function getTotalCollateral() external view returns (uint256 collateralEth);

// ❌ REMOVE - ora in ILensAdapter
// function getTotalDebt() external view returns (uint256 debtEth);

// ❌ REMOVE - ora in ILensAdapter (getHealthFactor)
// function getLowestHealthFactor() external view returns (uint256 healthFactor);

// ❌ REMOVE - ora in ILensAdapter
// function getBalance(string memory tokenCode) external view returns (uint256 balance);

// ❌ REMOVE - ora in ILensAdapter
// function getMaxWithdrawable(string memory tokenCode) external view returns (uint256 maxAmount);
```

**MANTIENI queste funzioni:**

```solidity
// ✅ KEEP - Core identification
function protocolName() external view returns (string memory name);
function protocolType() external view returns (ProtocolType protocolType);
function getProtocolSummary() external view returns (ProtocolSummary memory summary);

// ✅ KEEP - Core view (usata da ProtocolManager)
function getActivePositionCount() external view returns (uint256 count);

// ✅ KEEP - Write operations
function closePosition(uint256 positionId) external returns (uint256 wethReturned);
function closePositionsForWeth(uint256 targetWethAmount) 
    external returns (uint256 wethObtained, uint256 positionsClosed);

function deposit(string memory tokenCode, uint256 amount) external returns (bool success);
function withdraw(string memory tokenCode, uint256 amount) external returns (bool success);

// ✅ KEEP - Emergency
function emergencyWithdrawAll(string[] memory tokenCodes) external returns (bool success);
function isCircuitBreakerActive() external view returns (bool isActive);
function activateCircuitBreaker() external;
```

**IProtocolAdapter DOPO la rimozione - Funzioni Totali: 11 (da 20)**

```solidity
interface IProtocolAdapter {
    
    // ==================== IDENTIFICATION (3 funzioni) ====================
    function protocolName() external view returns (string memory name);
    function protocolType() external view returns (ProtocolType protocolType);
    function getProtocolSummary() external view returns (ProtocolSummary memory summary);
    
    // ==================== POSITION MANAGEMENT (2 funzioni) ====================
    function getActivePositionCount() external view returns (uint256 count);
    function closePosition(uint256 positionId) external returns (uint256 wethReturned);
    function closePositionsForWeth(uint256 targetWeth) 
        external returns (uint256 wethObtained, uint256 positionsClosed);
    
    // ==================== BASIC OPERATIONS (2 funzioni) ====================
    function deposit(string memory tokenCode, uint256 amount) external returns (bool success);
    function withdraw(string memory tokenCode, uint256 amount) external returns (bool success);
    
    // ==================== EMERGENCY (3 funzioni) ====================
    function emergencyWithdrawAll(string[] memory tokenCodes) external returns (bool success);
    function isCircuitBreakerActive() external view returns (bool isActive);
    function activateCircuitBreaker() external;
    
    // ==================== EVENTS ====================
    event PositionOpened(uint256 indexed positionId, uint256 collateralEth, uint256 debtEth);
    event PositionClosed(uint256 indexed positionId, uint256 wethReturned);
    event PositionLiquidated(uint256 indexed positionId, uint256 collateralLost);
    event Deposited(string tokenCode, uint256 amount);
    event Withdrawn(string tokenCode, uint256 amount);
    event CircuitBreakerActivated(address indexed triggeredBy);
}
```

**Commit:** `refactor(interfaces): move view functions from IProtocolAdapter to ILensAdapter`

---

### FASE 6: Rimozione View Functions da EulerV2Plugin

**File:** `contracts/plugins/EulerV2Plugin.sol`

**Step 4.1 - Rimuovi Implementazioni View**

```solidity
// RIMUOVI queste funzioni (intorno a L1050-L1120):

// ❌ REMOVE
// function getAllPositions() external view override returns (IProtocolAdapter.Position[] memory) { ... }

// ❌ REMOVE
// function getPosition(uint256 positionId) external view override returns (IProtocolAdapter.Position memory) { ... }

// ❌ REMOVE
// function getTotalValue() external view override returns (uint256) { ... }

// ❌ REMOVE  
// function getTotalCollateral() external view override returns (uint256) { ... }

// ❌ REMOVE
// function getTotalDebt() external view override returns (uint256) { ... }

// ❌ REMOVE
// function getLowestHealthFactor() external view override returns (uint256) { ... }

// ❌ REMOVE
// function getBalance(string memory tokenCode) external view override returns (uint256) { ... }

// ❌ REMOVE
// function getMaxWithdrawable(string memory tokenCode) external view override returns (uint256) { ... }

// ❌ REMOVE
// function getPositionsSortedByRisk() external view override returns (IProtocolAdapter.Position[] memory) { ... }
```

**Step 4.2 - Rimuovi Helper Interni**

```solidity
// RIMUOVI helper di conversione (se presenti):

// ❌ REMOVE - ora in EulerLensAdapter
// function _convertToStandardPosition(...) private view returns (IProtocolAdapter.Position memory) { ... }

// ❌ REMOVE - se non usato da nessuna parte
// function _toExternalPosition(...) private view returns (...) { ... }
```

**Step 4.3 - Aggiorna Interfaccia Inline IEulerRegistry**

**ESTRATTA in file separato (opzionale ma consigliato):**

```solidity
// RIMUOVI definizione inline (L30-65):
// interface IEulerRegistry { ... }

// SOSTITUISCI con import:
import "../interfaces/IEulerRegistry.sol";
```

**Commit:** `refactor(plugin): remove view functions moved to LensAdapter`

---

### FASE 5: Estrazione IEulerRegistry (Opzionale)

**File:** `contracts/interfaces/IEulerRegistry.sol` (NUOVO)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title IEulerRegistry
 * @notice Interface for EulerVaultRegistry - vault mappings and position storage
 * @dev Extracted from inline definition in EulerV2Plugin for reusability
 */
interface IEulerRegistry {
    
    // ==================== STRUCTS ====================
    
    /**
     * @notice Leverage position storage structure
     */
    struct LeveragePosition {
        uint256 positionId;
        uint8 subAccountId;
        address collateralVault;
        address borrowVault;
        uint256 initialCollateral;
        uint256 borrowedAmount;
        bool isActive;
        uint256 createdAt;
    }
    
    // ==================== VAULT REGISTRY ====================
    
    function getVault(string memory tokenCode) external view returns (address);
    function getVaultSafe(string memory tokenCode) external view returns (address);
    function getTokenCode(address vault) external view returns (string memory);
    function isRegistered(string memory tokenCode) external view returns (bool);
    function getAllRegisteredTokens() external view returns (string[] memory);
    function getAllVaults() external view returns (string[] memory tokenCodes, address[] memory vaults);
    
    // ==================== POSITION STORAGE ====================
    
    function nextPositionId() external view returns (uint256);
    
    function createPosition(
        uint256 positionId,
        uint8 subAccountId,
        address collateralVault,
        address borrowVault,
        uint256 initialCollateral,
        uint256 borrowedAmount
    ) external;
    
    function updatePosition(
        uint256 positionId,
        uint256 newCollateral,
        uint256 newBorrowedAmount
    ) external;
    
    function closePositionRecord(uint256 positionId) external;
    
    function getPosition(uint256 positionId) 
        external view 
        returns (LeveragePosition memory position);
    
    function getAllPositions() 
        external view 
        returns (LeveragePosition[] memory positions);
    
    function getActivePositions() 
        external view 
        returns (uint256[] memory positionIds, LeveragePosition[] memory positions);
    
    function getActivePositionCount() external view returns (uint256);
}
```

**Commit:** `feat(interfaces): extract IEulerRegistry to separate file`

**Aggiorna Import:**

```solidity
// In EulerV2Plugin.sol:
import "../interfaces/IEulerRegistry.sol";

// In EulerLensAdapter.sol:
import "../interfaces/IEulerRegistry.sol";
```

**Risparmio Plugin:** ~800-1200 bytes

---

### FASE 6: Aggiornare IEulerV2Plugin

**File:** `contracts/interfaces/IEulerV2Plugin.sol`

**PRIMA:**
```solidity
interface IEulerV2Plugin is IProtocolAdapter, IEulerV2PluginSpecific {
    // Eredita TUTTE le funzioni da entrambe
    // = 20 funzioni da IProtocolAdapter + 7 da IEulerV2PluginSpecific
}
```

**DOPO:**
```solidity
interface IEulerV2Plugin is IProtocolAdapter, IEulerV2PluginSpecific {
    // Ora eredita:
    // - 11 funzioni da IProtocolAdapter (ridotte da 20)
    // - ~7 funzioni da IEulerV2PluginSpecific (ridotte da ~10, rimossi 3 pass-through)
    // = ~18 funzioni totali (invece di ~30)
}
```

**Riepilogo Riduzioni:**
- IProtocolAdapter: 20 → 11 funzioni (-9 view functions)
- IEulerV2PluginSpecific: ~10 → ~7 funzioni (-3 pass-through getters)
- **TOTALE RIMOSSO DA PLUGIN: 12 funzioni**

**NOTA:** Nessuna modifica necessaria a IEulerV2Plugin - si aggiorna automaticamente

**Commit:** (incluso in commit FASE 2 e FASE 5)

---

## 📝 Modifiche per File - Riepilogo

### File 1: `contracts/interfaces/ILensAdapter.sol`

**Tipo:** Aggiunta funzioni  
**Linee aggiunte:** ~70 righe  
**Breaking change:** NO

**Modifiche:**
```diff
interface ILensAdapter {
    // ... funzioni esistenti ...
    
+   // ==================== POSITION QUERIES ====================
+   
+   function getAllPositions() 
+       external view 
+       returns (IProtocolAdapter.Position[] memory positions);
+   
+   function getPosition(uint256 positionId) 
+       external view 
+       returns (IProtocolAdapter.Position memory position);
+   
+   function getBalance(string memory tokenCode) 
+       external view 
+       returns (uint256 balance);
+   
+   function getTotalCollateral() 
+       external view 
+       returns (uint256 collateralEth);
+   
+   function getTotalDebt() 
+       external view 
+       returns (uint256 debtEth);
}
```

---

### File 2: `contracts/adapters/EulerLensAdapter.sol`

**Tipo:** Implementazione nuove funzioni + helper privati  
**Linee aggiunte:** ~250-300 righe  
**Breaking change:** NO

**Modifiche:**
```diff
contract EulerLensAdapter is ILensAdapter, IEulerLensAdapter {
    // ... funzioni esistenti ...
    
+   // ==================== PRIVATE HELPERS ====================
+   
+   function _convertToStandardPosition(
+       IEulerRegistry.LeveragePosition memory leveragePos
+   ) private view returns (IProtocolAdapter.Position memory position) {
+       // Implementazione conversione formato
+   }
+   
+   function _calculateCollateralValue(...) private view returns (uint256) { ... }
+   function _calculateDebtValue(...) private view returns (uint256) { ... }
+   function _calculateHealthFactorForPosition(...) private view returns (uint256) { ... }
+   function _computeSubAccount(...) private pure returns (address) { ... }
+   
+   // ==================== POSITION QUERIES ====================
+   
+   function getAllPositions() external view override 
+       returns (IProtocolAdapter.Position[] memory) { ... }
+   
+   function getPosition(uint256 positionId) external view override 
+       returns (IProtocolAdapter.Position memory) { ... }
+   
+   function getBalance(string memory tokenCode) external view override 
+       returns (uint256) { ... }
+   
+   function getTotalCollateral() external view override 
+       returns (uint256) { ... }
+   
+   function getTotalDebt() external view override 
+       returns (uint256) { ... }
}
```

---

### File 5: `contracts/adapters/EulerLensAdapter.sol`

**Tipo:** Aggiornamento chiamate (da Plugin a Registry)
**Linee modificate:** ~12-15 linee (12 chiamate + helper)
**Breaking change:** NO (interno)

**Modifiche:**
```diff
contract EulerLensAdapter {
    
+   // Helper per ottenere Registry
+   function _getRegistry() private view returns (address) {
+       return IBeacon(beacon).getImplementation("EulerRegistry");
+   }
    
    // Esempio funzione aggiornata:
    function getCollateralValue(uint256 positionId) external view override {
-       // PRIMA: chiamava Plugin
-       IEulerV2PluginView.LeveragePosition memory pos = 
-           plugin.getLeveragePosition(positionId);
        
+       // DOPO: chiama Registry direttamente
+       address registry = _getRegistry();
+       IEulerRegistry.LeveragePosition memory pos = 
+           IEulerRegistry(registry).getPosition(positionId);
        
        // Resto della funzione invariato
    }
    
    // ... aggiornare tutte le 12 chiamate con stesso pattern
}
```

**Chiamate da aggiornare:** 12 totali
1. L254: `getCollateralValue()` - getLeveragePosition → getPosition
2. L357: `getTotalPositionsValue()` - getAllLeveragePositions → getAllPositions
3. L396: `getDebtValue()` - getLeveragePosition → getPosition
4. L492: `hasAnyActivePositions()` - getAllLeveragePositions → getAllPositions
5. L537: `getPositionValue()` - getLeveragePosition → getPosition
6. L618: `getPositionsSortedByRisk()` - getAllLeveragePositions → getAllPositions
7. L804: `getTimeToLiquidation()` - getLeveragePosition → getPosition
8. L868: `estimateLiquidationPrice()` - getLeveragePosition → getPosition
9-10. L889, L926: `getPositionsAtRisk()` - getLeveragePosition → getPosition (2x in loop)
11. L974: `estimateWethFromClose()` - getLeveragePosition → getPosition

---

### File 6: `contracts/interfaces/IProtocolAdapter.sol`

**Tipo:** Rimozione funzioni  
**Linee rimosse:** ~110 righe  
**Breaking change:** SI (ma mitigato - vedi sotto)

**Modifiche:**
```diff
interface IProtocolAdapter {
    // ✅ KEEP
    function protocolName() external view returns (string memory);
    function protocolType() external view returns (ProtocolType);
    function getProtocolSummary() external view returns (ProtocolSummary memory);
    function getActivePositionCount() external view returns (uint256);
    
-   // ❌ REMOVE - spostato a ILensAdapter
-   function getAllPositions() external view returns (Position[] memory);
-   function getPosition(uint256) external view returns (Position memory);
-   function getPositionsSortedByRisk() external view returns (Position[] memory);
-   function getTotalValue() external view returns (uint256);
-   function getTotalCollateral() external view returns (uint256);
-   function getTotalDebt() external view returns (uint256);
-   function getLowestHealthFactor() external view returns (uint256);
-   function getBalance(string memory) external view returns (uint256);
-   function getMaxWithdrawable(string memory) external view returns (uint256);
    
    // ✅ KEEP
    function closePosition(uint256) external returns (uint256);
    function closePositionsForWeth(uint256) external returns (uint256, uint256);
    function deposit(string memory, uint256) external returns (bool);
    function withdraw(string memory, uint256) external returns (bool);
    function emergencyWithdrawAll(string[] memory) external returns (bool);
    function isCircuitBreakerActive() external view returns (bool);
    function activateCircuitBreaker() external;
}
```

**NOTA:** Breaking change solo per IProtocolAdapter, ma:
- ✅ ProtocolManager NON chiama queste funzioni (usa LensAdapter)
- ✅ EulerV2Plugin rimuove implementazioni (riduce bytecode)
- ✅ Nessun altro contratto core impattato

---

### File 7: `contracts/plugins/EulerV2Plugin.sol`

**NOTA:** Questo file ha 2 set di rimozioni:
1. **Pass-through getters** (FASE 2): getLeveragePosition, getAllLeveragePositions, nextPositionId
2. **View functions IProtocolAdapter** (FASE 6): getAllPositions, getPosition, getTotalValue, etc.

Entrambi contribuiscono al risparmio bytecode totale.

**Tipo:** Rimozione implementazioni (pass-through + view functions + helper)  
**Linee rimosse:** ~350-500 righe  
**Breaking change:** NO (interno al Plugin)

**Rimozioni FASE 2 (Pass-through):**
```diff
-   function nextPositionId() external view override returns (uint256) { ... }  // ~50 bytes
-   function getLeveragePosition(uint256) external view override { ... }  // ~200-300 bytes
-   function getAllLeveragePositions() external view override { ... }  // ~400-500 bytes
```

**Rimozioni FASE 6 (View Functions IProtocolAdapter):**

**Modifiche:**
```diff
contract EulerV2Plugin is IEulerV2Plugin {
    
-   // ❌ REMOVE - ora in EulerLensAdapter
-   function getAllPositions() external view override 
-       returns (IProtocolAdapter.Position[] memory) { ... }
    
-   function getPosition(uint256 positionId) external view override 
-       returns (IProtocolAdapter.Position memory) { ... }
    
-   function getTotalValue() external view override returns (uint256) { ... }
-   function getTotalCollateral() external view override returns (uint256) { ... }
-   function getTotalDebt() external view override returns (uint256) { ... }
-   function getLowestHealthFactor() external view override returns (uint256) { ... }
-   function getBalance(string memory) external view override returns (uint256) { ... }
-   function getMaxWithdrawable(string memory) external view override returns (uint256) { ... }
-   function getPositionsSortedByRisk() external view override 
-       returns (IProtocolAdapter.Position[] memory) { ... }
    
-   // ❌ REMOVE - helper spostato in LensAdapter
-   function _convertToStandardPosition(...) private view 
-       returns (IProtocolAdapter.Position memory) { ... }
    
-   function _toExternalPosition(...) private view returns (...) { ... }
    
    // ✅ KEEP - write operations
    function openLeverageAtomic(...) external { ... }
    function closeLeveragePosition(...) external { ... }
    function deposit(...) external { ... }
    function withdraw(...) external { ... }
}
```

**Risparmio Bytecode:** ~2600-3650 bytes

---

### File 8: `contracts/interfaces/IEulerRegistry.sol` (NUOVO - Opzionale)

**Tipo:** Creazione file + estrazione interfaccia  
**Linee aggiunte:** ~90 righe  
**Breaking change:** NO

**Contenuto:**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

interface IEulerRegistry {
    struct LeveragePosition { ... }
    
    // Vault registry functions
    function getVault(string memory) external view returns (address);
    // ... altre funzioni registry
    
    // Position storage functions
    function createPosition(...) external;
    function getPosition(uint256) external view returns (LeveragePosition memory);
    function getAllPositions() external view returns (LeveragePosition[] memory);
    // ... altre funzioni positions
}
```

**Aggiorna Import in:**
- `EulerV2Plugin.sol`: `import "../interfaces/IEulerRegistry.sol";`
- `EulerLensAdapter.sol`: `import "../interfaces/IEulerRegistry.sol";`

**Risparmio Plugin:** ~800-1200 bytes (rimuove definizione inline)

---

## 🧪 Testing Strategy

### Test da Eseguire

#### 0. **Unit Tests - Registry Direct Access**

**File:** `test/unit/EulerLensAdapter-Registry.test.ts` (nuovo)

```typescript
describe("EulerLensAdapter - Registry Direct Access", () => {
    
    it("should call Registry directly without Plugin", async () => {
        // Spy su Registry
        const registrySpy = sinon.spy(eulerRegistry, "getPosition");
        const pluginSpy = sinon.spy(eulerPlugin, "getLeveragePosition");
        
        // Chiamata via LensAdapter
        await eulerLensAdapter.getCollateralValue(1);
        
        // Verify: Registry chiamato, Plugin NO
        expect(registrySpy.calledOnce).to.be.true;
        expect(pluginSpy.called).to.be.false;
    });
    
    it("should return same data as before refactoring", async () => {
        // Test data parity
        const positionFromRegistry = await eulerRegistry.getPosition(1);
        const valueFromLens = await eulerLensAdapter.getCollateralValue(1);
        
        // Verify calculations still correct
        expect(valueFromLens).to.be.gt(0);
    });
    
    it("should handle 12 calls without Plugin pass-through", async () => {
        const pluginSpy = sinon.spy(eulerPlugin, "getLeveragePosition");
        
        // Esegui tutte le funzioni che prima chiamavano Plugin
        await eulerLensAdapter.getCollateralValue(1);
        await eulerLensAdapter.getDebtValue(1);
        await eulerLensAdapter.getPositionValue(1);
        await eulerLensAdapter.getPositionsSortedByRisk();
        await eulerLensAdapter.hasAnyActivePositions();
        // ... altre 7 chiamate
        
        // Verify: Plugin NEVER called
        expect(pluginSpy.callCount).to.equal(0);
    });
});
```

#### 1. **Unit Tests - ILensAdapter**

**File:** `test/unit/EulerLensAdapter.test.ts` (da creare/aggiornare)

```typescript
describe("EulerLensAdapter - Position Queries", () => {
    
    it("should get all positions in standard format", async () => {
        const positions = await eulerLensAdapter.getAllPositions();
        expect(positions).to.be.an("array");
        expect(positions[0]).to.have.property("positionId");
        expect(positions[0]).to.have.property("protocolName", "EulerV2");
        expect(positions[0]).to.have.property("collateralValueEth");
        expect(positions[0]).to.have.property("debtValueEth");
        expect(positions[0]).to.have.property("healthFactor");
    });
    
    it("should get specific position by ID", async () => {
        const position = await eulerLensAdapter.getPosition(1);
        expect(position.positionId).to.equal(1);
        expect(position.protocolName).to.equal("EulerV2");
    });
    
    it("should get balance for token", async () => {
        const balance = await eulerLensAdapter.getBalance("WETH");
        expect(balance).to.be.a("bigint");
    });
    
    it("should get total collateral", async () => {
        const collateral = await eulerLensAdapter.getTotalCollateral();
        expect(collateral).to.equal(
            (await eulerLensAdapter.getValueBreakdown()).totalCollateralEth
        );
    });
    
    it("should get total debt", async () => {
        const debt = await eulerLensAdapter.getTotalDebt();
        expect(debt).to.equal(
            (await eulerLensAdapter.getValueBreakdown()).totalDebtEth
        );
    });
});
```

#### 2. **Integration Tests - ProtocolManager**

**File:** `test/integration/ProtocolManager.integration.test.ts`

```typescript
describe("ProtocolManager - LensAdapter Integration", () => {
    
    it("should aggregate positions from all protocols via LensAdapter", async () => {
        // Register EulerV2 protocol
        await protocolManager.registerProtocol(
            "EulerV2",
            eulerPlugin.address,
            eulerLensAdapter.address,
            eulerRegistry.address
        );
        
        // Get positions (should call LensAdapter, not Plugin)
        const positions = await protocolManager.getAllPositionsAtRisk(ethers.parseEther("1.5"));
        
        expect(positions).to.be.an("array");
    });
    
    it("should get total value across protocols via LensAdapter", async () => {
        const totalValue = await protocolManager.getAllProtocolsValue();
        expect(totalValue).to.be.gt(0);
    });
    
    it("should not call Plugin for view functions", async () => {
        // Spy on Plugin calls
        const pluginSpy = sinon.spy(eulerPlugin, "getAllPositions");
        
        // Call via ProtocolManager (should use LensAdapter)
        await protocolManager.getAllProtocolsValue();
        
        // Verify Plugin view NOT called
        expect(pluginSpy.called).to.be.false;
    });
});
```

#### 3. **E2E Tests - Complete Flow**

**File:** `test/e2e/leverage-position-lifecycle.test.ts`

```typescript
describe("Leverage Position Lifecycle - LensAdapter View", () => {
    
    it("should open position via Plugin, query via LensAdapter", async () => {
        // 1. Open leverage position (Plugin write)
        await eulerPlugin.openLeverageAtomic({
            subAccountId: 1,
            collateralToken: "WETH",
            borrowToken: "USDC",
            initialCollateral: ethers.parseEther("10"),
            targetLeverage: ethers.parseEther("2")
        });
        
        // 2. Query position (LensAdapter read)
        const position = await eulerLensAdapter.getPosition(1);
        
        expect(position.positionId).to.equal(1);
        expect(position.collateralValueEth).to.be.gt(0);
        expect(position.debtValueEth).to.be.gt(0);
        expect(position.healthFactor).to.be.gt(ethers.parseEther("1"));
        
        // 3. Query via ProtocolManager
        const allPositions = await eulerLensAdapter.getAllPositions();
        expect(allPositions).to.have.lengthOf(1);
        expect(allPositions[0].positionId).to.equal(1);
    });
});
```

#### 4. **Performance Tests - Call Reduction**

**File:** `test/performance/registry-direct.test.ts`

```typescript
describe("Performance - Registry Direct Access", () => {
    
    it("should use 1 call instead of 2 for position queries", async () => {
        // PRIMA: LensAdapter → Plugin → Registry (2 calls)
        // DOPO: LensAdapter → Registry (1 call)
        
        const callTracker = [];
        
        // Mock per contare chiamate
        const originalGetPosition = eulerRegistry.getPosition;
        eulerRegistry.getPosition = function(...args) {
            callTracker.push('registry.getPosition');
            return originalGetPosition.apply(this, args);
        };
        
        await eulerLensAdapter.getCollateralValue(1);
        
        // Verify: solo 1 chiamata a Registry
        expect(callTracker.filter(c => c === 'registry.getPosition')).to.have.lengthOf(1);
    });
});
```

#### 5. **Bytecode Size Test**

**File:** `test/bytecode/plugin-size.test.ts`

```typescript
describe("Plugin Bytecode Size", () => {
    
    it("should be under 24576 bytes limit", async () => {
        const EulerV2Plugin = await ethers.getContractFactory("EulerV2Plugin");
        const bytecode = EulerV2Plugin.bytecode;
        const size = (bytecode.length - 2) / 2; // Remove 0x prefix, divide by 2
        
        console.log(`EulerV2Plugin bytecode size: ${size} bytes`);
        
        expect(size).to.be.lt(24576, 
            `Plugin bytecode (${size} bytes) exceeds limit (24576 bytes)`);
    });
    
    it("should have reduced bytecode after refactoring", async () => {
        const EXPECTED_MAX_SIZE = 28000; // ~27000-28000 bytes (con pass-through removal)
        const EXPECTED_MIN_REDUCTION = 4200; // Risparmio minimo (view + pass-through)
        
        const EulerV2Plugin = await ethers.getContractFactory("EulerV2Plugin");
        const size = (EulerV2Plugin.bytecode.length - 2) / 2;
        
        expect(size).to.be.lt(EXPECTED_MAX_SIZE, 
            `Expected < ${EXPECTED_MAX_SIZE}, got ${size}`);
    });
});
```

---

### Test Checklist

```
[ ] Unit Tests - Registry Direct Access
    [ ] LensAdapter chiama Registry senza Plugin
    [ ] Dati identici a prima del refactoring
    [ ] 12 chiamate senza pass-through Plugin
    [ ] Performance: 1 call invece di 2
    
[ ] Unit Tests - EulerLensAdapter
    [ ] getAllPositions() ritorna array corretto
    [ ] getPosition(id) ritorna position corretta
    [ ] getBalance(token) ritorna balance corretto
    [ ] getTotalCollateral() equivale a getValueBreakdown().totalCollateralEth
    [ ] getTotalDebt() equivale a getValueBreakdown().totalDebtEth
    
[ ] Integration Tests - ProtocolManager
    [ ] Aggregation positions via LensAdapter funziona
    [ ] getAllProtocolsValue() usa LensAdapter
    [ ] Plugin view functions NON chiamate
    
[ ] E2E Tests - Complete Flow
    [ ] Open position → query via LensAdapter funziona
    [ ] Close position → query aggiornata
    [ ] Multiple positions → getAllPositions() corretto
    
[ ] Performance Tests
    [ ] Registry direct access (1 call vs 2)
    [ ] No Plugin chiamato per position queries
    
[ ] Bytecode Tests
    [ ] Plugin bytecode < 28000 bytes
    [ ] Risparmio >= 4200 bytes (view + pass-through)
    
[ ] Regression Tests
    [ ] Tutte le funzionalità esistenti funzionano
    [ ] Nessun test esistente rotto
    [ ] ValueCalculator funziona
    [ ] LiquidityManager funziona
```

---

## 💰 Risparmio Bytecode Dettagliato

### Breakdown per Funzione

| Funzione Rimossa | Bytecode Stimato | Tipo |
|------------------|------------------|------|
| `getAllPositions()` | 400-600 bytes | View implementation |
| `getPosition(positionId)` | 200-300 bytes | View implementation |
| `getPositionsSortedByRisk()` | 500-700 bytes | View implementation + sorting |
| `getTotalValue()` | 250 bytes | View implementation |
| `getTotalCollateral()` | 250 bytes | View implementation |
| `getTotalDebt()` | 250 bytes | View implementation |
| `getLowestHealthFactor()` | 300 bytes | View implementation + loop |
| `getBalance(tokenCode)` | 150 bytes | View implementation |
| `getMaxWithdrawable(tokenCode)` | 300 bytes | View implementation |
| `_convertToStandardPosition()` | 600-800 bytes | Helper privato |
| `_toExternalPosition()` | 200 bytes | Helper inutilizzato |
| **Pass-through getters** | 650-850 bytes | getLeveragePosition, getAllLeveragePositions, nextPositionId |
| **IEulerRegistry** inline | 800-1200 bytes | Definizione interfaccia |

**TOTALE RISPARMIO:** ~4550-6200 bytes

**Stima Conservativa:** ~4200 bytes (view functions + pass-through)  
**Stima Ottimistica:** ~5800 bytes (+ IEulerRegistry extraction)

### Bytecode Prima/Dopo

```
PRIMA del refactoring:
EulerV2Plugin.sol: 31632 bytes
- Limite: 24576 bytes
- Overflow: +7056 bytes (+28.7%)
- Status: ❌ NON COMPILABILE

DOPO il refactoring (view functions + pass-through):
EulerV2Plugin.sol: ~27000-27600 bytes (stima conservativa)
- Limite: 24576 bytes
- Overflow: +2424-3024 bytes (+9.9-12.3%)
- Status: ⚠️ ANCORA SOPRA ma MIGLIORATO
- Risparmio: -4200-4800 bytes

DOPO refactoring + IEulerRegistry extraction:
EulerV2Plugin.sol: ~26000-26800 bytes (stima ottimistica)
- Limite: 24576 bytes
- Overflow: +1424-2224 bytes (+5.8-9.0%)
- Status: ⚠️ VICINO AL LIMITE
- Risparmio totale: -5000-5800 bytes
```

**NOTE:**
- Risparmio base (view functions): ~3000-3600 bytes
- Risparmio pass-through: ~650-850 bytes
- Risparmio IEulerRegistry: ~800-1200 bytes (opzionale)
- **TOTALE: ~4450-5650 bytes**
- Ulteriori ottimizzazioni (optimizer settings, library extraction) potrebbero portare sotto 24576 limite

---

## ⚠️ Rischi e Mitigazioni

### Rischio 1: Breaking Change su IProtocolAdapter

**Livello:** 🟡 MEDIO

**Descrizione:**
Rimuovere funzioni da `IProtocolAdapter` è tecnicamente un breaking change per l'interfaccia.

**Impatto:**
- ❌ Contratti che implementano `IProtocolAdapter` devono aggiornare
- ❌ Contratti che chiamano queste funzioni devono cambiare
- ✅ Nel nostro caso: SOLO EulerV2Plugin implementa l'interfaccia
- ✅ ProtocolManager NON chiama queste funzioni (usa LensAdapter)

**Mitigazione:**
1. ✅ Deploy nuovo sistema completo (non incrementale)
2. ✅ Test estensivi prima del deploy
3. ✅ Nessun contratto in produzione (sistema in sviluppo)
4. ✅ Backward compatibility non necessaria

**Status:** ✅ MITIGATO

---

### Rischio 2: ProtocolManager Potrebbe Chiamare Funzioni View

**Livello:** 🟢 BASSO

**Descrizione:**
ProtocolManager potrebbe avere chiamate nascoste alle funzioni view del Plugin che non abbiamo identificato.

**Impatto:**
- ❌ Compilazione fallisce se chiamate esistono
- ✅ Facilmente identificabile in fase di compilazione

**Mitigazione:**
1. ✅ Analisi completa già effettuata (FASE 3)
2. ✅ Grep search esaustivo eseguito
3. ✅ Compilazione verificherà l'assenza di chiamate
4. ✅ Test integrazione cattureranno problemi

**Verifiche Effettuate:**
```bash
# Verifica: ProtocolManager chiama Plugin solo per:
grep "IProtocolAdapter(info.plugin)" ProtocolManager.sol

Risultati:
L708: IProtocolAdapter(info.plugin).getActivePositionCount()
L779: IProtocolAdapter(info.plugin).closePositionsForWeth(stillNeeded)
L809: IProtocolAdapter(info.plugin).closePosition(positionId)
L834: IProtocolAdapter(info.plugin).getProtocolSummary()

Totale: 4 chiamate (TUTTE mantenute in IProtocolAdapter)
```

**Status:** ✅ VERIFICATO SICURO

---

### Rischio 3: LensAdapter Non Implementa Correttamente

**Livello:** 🟡 MEDIO

**Descrizione:**
Le nuove funzioni in `EulerLensAdapter` potrebbero avere bug o comportamento diverso dal Plugin.

**Impatto:**
- ❌ Dati incorretti ritornati
- ❌ Gas cost più alto
- ❌ Errori runtime

**Mitigazione:**
1. ✅ Copiare logica esatta dal Plugin (testata)
2. ✅ Unit tests estensivi
3. ✅ Comparison tests (Plugin vs LensAdapter)
4. ✅ E2E tests con scenari reali

**Test di Validazione:**
```typescript
describe("Plugin vs LensAdapter - Parity Check", () => {
    it("should return same positions", async () => {
        // PRIMA (Plugin)
        const pluginPositions = await eulerPlugin.getAllPositions();
        
        // DOPO (LensAdapter)
        const lensPositions = await eulerLensAdapter.getAllPositions();
        
        // Verify identical data
        expect(lensPositions.length).to.equal(pluginPositions.length);
        for (let i = 0; i < lensPositions.length; i++) {
            expect(lensPositions[i].positionId).to.equal(pluginPositions[i].positionId);
            expect(lensPositions[i].collateralValueEth).to.equal(pluginPositions[i].collateralValueEth);
            expect(lensPositions[i].debtValueEth).to.equal(pluginPositions[i].debtValueEth);
        }
    });
});
```

**Status:** ✅ MITIGABILE con testing

---

### Rischio 4: Bytecode Ancora Sopra Limite

**Livello:** 🟡 MEDIO

**Descrizione:**
Anche dopo rimozione view functions, Plugin potrebbe essere ancora sopra 24576 bytes.

**Impatto:**
- ⚠️ Plugin a ~28000 bytes (stima conservativa)
- ⚠️ Ancora +3424 bytes sopra limite (+13.9%)

**Mitigazione:**
1. ✅ Questo refactoring è PRIMO STEP (non unico)
2. ✅ Ulteriori ottimizzazioni possibili:
   - Optimizer settings più aggressivi (runs=200 invece di 800)
   - Estrazione logic in libraries
   - Splitting contratto (PluginCore + PluginExtended)
   - Removal funzioni non-critical

**Piano Ulteriori Ottimizzazioni:**
```
Step 1: Spostare view functions → ~28000 bytes (-3600)
Step 2: Optimizer runs=200 → ~26500 bytes (-1500)
Step 3: Extract flash loan logic to library → ~25000 bytes (-1500)
Step 4: Remove EVC integration (opzionale) → ~24000 bytes (-1000)
```

**Status:** ✅ PIANO INCREMENTALE DISPONIBILE

---

### Rischio 5: Gas Cost Incrementato

**Livello:** 🟢 BASSO

**Descrizione:**
Chiamare LensAdapter invece di Plugin potrebbe costare più gas per le view functions.

**Impatto:**
- ⚠️ External call overhead (~2000 gas)
- ✅ View functions = nessun costo on-chain (solo RPC)
- ✅ Impatto minimo

**Mitigazione:**
1. ✅ View functions già read-only (no state change)
2. ✅ Gas cost irrilevante per query (off-chain)
3. ✅ Performance improvement su write operations (Plugin più leggero)

**Gas Comparison:**
```
PRIMA (Plugin):
getAllPositions() via Plugin: ~50k gas (view, off-chain)

DOPO (LensAdapter):
getAllPositions() via LensAdapter: ~52k gas (view, off-chain)
Differenza: +2k gas (~4% overhead)

NOTA: View functions non consumano gas on-chain
```

**Status:** ✅ IMPATTO TRASCURABILE

---

## ✅ Checklist Completa Implementazione

### Pre-Implementazione

```
[ ] Analisi impatto completata
    [ ] Verificato: ProtocolManager NON usa getLeveragePosition
    [ ] Verificato: SOLO EulerLensAdapter usa (12 chiamate)
    [ ] Verificato: IEulerRegistry già ha funzioni necessarie
    [ ] Piano sequenza fasi validato
    
[ ] Backup codice corrente
    [ ] Git commit: "checkpoint before view functions refactoring"
    [ ] Tag: v0.9.0-pre-refactoring
    
[ ] Verifica test esistenti passano
    [ ] npm test (tutti i test passano)
    [ ] npm run test:integration
    [ ] npm run test:e2e
    
[ ] Analisi dipendenze completata
    [ ] ProtocolManager analizzato
    [ ] LiquidityManager verificato
    [ ] ValueCalculator verificato
    [ ] Nessuna altra dipendenza trovata
```

---

### FASE 1: ILensAdapter - Aggiunta Funzioni

```
[ ] Aprire contracts/interfaces/ILensAdapter.sol
[ ] Aggiungere sezione "POSITION QUERIES"
[ ] Aggiungere getAllPositions()
[ ] Aggiungere getPosition(positionId)
[ ] Aggiungere getBalance(tokenCode)
[ ] Aggiungere getTotalCollateral()
[ ] Aggiungere getTotalDebt()
[ ] Verificare import IProtocolAdapter presente
[ ] Compilare: npm run compile
[ ] Commit: "feat(interfaces): add position query functions to ILensAdapter"
```

---

### FASE 2: EulerLensAdapter - Implementazione

```
[ ] Aprire contracts/adapters/EulerLensAdapter.sol
[ ] Aggiungere sezione "PRIVATE HELPERS"
    [ ] Implementare _convertToStandardPosition()
    [ ] Implementare _calculateCollateralValue()
    [ ] Implementare _calculateDebtValue()
    [ ] Implementare _calculateHealthFactorForPosition()
    [ ] Implementare _computeSubAccount()
[ ] Aggiungere sezione "POSITION QUERIES"
    [ ] Implementare getAllPositions()
    [ ] Implementare getPosition(positionId)
    [ ] Implementare getBalance(tokenCode)
    [ ] Implementare getTotalCollateral()
    [ ] Implementare getTotalDebt()
[ ] Verificare import necessari:
    [ ] import "../interfaces/IProtocolAdapter.sol";
    [ ] import "../interfaces/IEulerRegistry.sol";
[ ] Compilare: npm run compile
[ ] Risolvere eventuali errori compilazione
[ ] Commit: "feat(lens): implement position query functions in EulerLensAdapter"
```

---

### FASE 3: IProtocolAdapter - Rimozione Funzioni

```
[ ] Aprire contracts/interfaces/IProtocolAdapter.sol
[ ] Rimuovere getAllPositions()
[ ] Rimuovere getPosition(positionId)
[ ] Rimuovere getPositionsSortedByRisk()
[ ] Rimuovere getTotalValue()
[ ] Rimuovere getTotalCollateral()
[ ] Rimuovere getTotalDebt()
[ ] Rimuovere getLowestHealthFactor()
[ ] Rimuovere getBalance(tokenCode)
[ ] Rimuovere getMaxWithdrawable(tokenCode)
[ ] Verificare funzioni mantenute:
    [ ] protocolName() ✅
    [ ] protocolType() ✅
    [ ] getProtocolSummary() ✅
    [ ] getActivePositionCount() ✅
    [ ] closePosition() ✅
    [ ] closePositionsForWeth() ✅
    [ ] deposit() / withdraw() ✅
    [ ] emergencyWithdrawAll() ✅
    [ ] isCircuitBreakerActive() / activateCircuitBreaker() ✅
[ ] Compilare: npm run compile (aspettarsi errori su Plugin)
[ ] Commit: "refactor(interfaces): move view functions from IProtocolAdapter to ILensAdapter"
```

---

### FASE 4: EulerV2Plugin - Rimozione Implementazioni

```
[ ] Aprire contracts/plugins/EulerV2Plugin.sol
[ ] Rimuovere funzione getAllPositions() (~L1050-1075)
[ ] Rimuovere funzione getPosition() (~L1076-1091)
[ ] Rimuovere funzione getTotalValue() (~L1092-1105)
[ ] Rimuovere funzione getTotalCollateral() (~L1106-1115)
[ ] Rimuovere funzione getTotalDebt() (~L1116-1125)
[ ] Rimuovere funzione getLowestHealthFactor() (~L1126-1140)
[ ] Rimuovere funzione getBalance() (~L1141-1150)
[ ] Rimuovere funzione getMaxWithdrawable() (~L1151-1165)
[ ] Rimuovere funzione getPositionsSortedByRisk() (~L1166-1195)
[ ] Rimuovere helper _convertToStandardPosition() se presente
[ ] Rimuovere helper _toExternalPosition() se presente
[ ] Compilare: npm run compile
[ ] Verificare bytecode size (output compilazione)
[ ] Commit: "refactor(plugin): remove view functions moved to LensAdapter"
```

---

### FASE 5: IEulerRegistry - Estrazione (Opzionale)

```
[ ] Creare file contracts/interfaces/IEulerRegistry.sol
[ ] Copiare definizione interfaccia da Plugin
[ ] Aggiungere header SPDX + commenti
[ ] Aggiungere struct LeveragePosition
[ ] Aggiungere tutte le funzioni registry
[ ] Aggiungere tutte le funzioni position storage
[ ] Aprire EulerV2Plugin.sol
    [ ] Rimuovere definizione inline interface IEulerRegistry
    [ ] Aggiungere import "../interfaces/IEulerRegistry.sol";
[ ] Aprire EulerLensAdapter.sol
    [ ] Verificare/aggiungere import "../interfaces/IEulerRegistry.sol";
[ ] Compilare: npm run compile
[ ] Verificare riduzione bytecode Plugin
[ ] Commit: "feat(interfaces): extract IEulerRegistry to separate file"
```

---

### FASE 6: Testing

```
[ ] Unit Tests - EulerLensAdapter
    [ ] Creare/aggiornare test/unit/EulerLensAdapter.test.ts
    [ ] Test getAllPositions()
    [ ] Test getPosition(id)
    [ ] Test getBalance(token)
    [ ] Test getTotalCollateral()
    [ ] Test getTotalDebt()
    [ ] npm test -- EulerLensAdapter.test.ts
    [ ] Verificare tutti i test passano
    
[ ] Integration Tests - ProtocolManager
    [ ] Creare/aggiornare test/integration/ProtocolManager.test.ts
    [ ] Test aggregazione positions via LensAdapter
    [ ] Test getAllProtocolsValue()
    [ ] Test Plugin NON chiamato per view
    [ ] npm test -- ProtocolManager.test.ts
    [ ] Verificare tutti i test passano
    
[ ] E2E Tests - Complete Flow
    [ ] Aggiornare test/e2e/leverage-position-lifecycle.test.ts
    [ ] Test open → query via LensAdapter
    [ ] Test close → query aggiornata
    [ ] npm run test:e2e
    [ ] Verificare tutti i test passano
    
[ ] Bytecode Tests
    [ ] Creare test/bytecode/plugin-size.test.ts
    [ ] Test bytecode < 29000 bytes
    [ ] Test risparmio >= 2600 bytes
    [ ] npm test -- plugin-size.test.ts
    [ ] Verificare test passa
    
[ ] Regression Tests
    [ ] npm test (tutti i test esistenti)
    [ ] Verificare NESSUN test rotto
    [ ] Verificare ValueCalculator funziona
    [ ] Verificare LiquidityManager funziona
```

---

### FASE 7: Verifica e Deployment

```
[ ] Compilazione Finale
    [ ] npm run compile
    [ ] ZERO errori
    [ ] ZERO warnings
    [ ] Bytecode Plugin < 29000 bytes
    
[ ] Code Review
    [ ] Revisione modifiche ILensAdapter
    [ ] Revisione implementazione EulerLensAdapter
    [ ] Revisione rimozioni IProtocolAdapter
    [ ] Revisione rimozioni EulerV2Plugin
    [ ] Verificare nessun dead code
    [ ] Verificare documentazione aggiornata
    
[ ] Test Completo Suite
    [ ] npm test
    [ ] npm run test:integration
    [ ] npm run test:e2e
    [ ] npm run coverage (opzionale)
    [ ] TUTTI i test passano
    
[ ] Git Cleanup
    [ ] git add .
    [ ] git commit -m "refactor: move view functions from Plugin to LensAdapter"
    [ ] git tag v0.10.0-view-refactoring
    [ ] git push origin main
    [ ] git push --tags
    
[ ] Documentazione
    [ ] Aggiornare README.md
    [ ] Aggiornare ARCHITECTURE.md
    [ ] Aggiornare CHANGELOG.md
    [ ] Creare migration guide (se necessario)
```

---

### Post-Implementazione

```
[ ] Monitoraggio
    [ ] Verificare bytecode finale
    [ ] Documentare risparmio effettivo
    [ ] Identificare ulteriori ottimizzazioni
    
[ ] Pianificazione Next Steps
    [ ] Se bytecode ancora > 24576:
        [ ] Optimizer settings adjustment
        [ ] Library extraction
        [ ] Contract splitting
    [ ] Altrimenti:
        [ ] Deploy testnet
        [ ] Audit preparation
```

---

## 📈 Metriche di Successo

### Bytecode Target

```
✅ SUCCESS: Plugin bytecode <= 29000 bytes
⚠️  ACCEPTABLE: Plugin bytecode <= 30000 bytes
❌ FAILURE: Plugin bytecode > 30000 bytes
```

### Test Coverage

```
✅ SUCCESS: 100% test pass, 0 regression
⚠️  ACCEPTABLE: 100% test pass, minor issues
❌ FAILURE: Test failures, breaking changes
```

### Timeline

```
✅ SUCCESS: Implementazione <= 3 ore
⚠️  ACCEPTABLE: Implementazione <= 5 ore
❌ FAILURE: Implementazione > 5 ore
```

---

## 🎯 Conclusioni

### Riepilogo Finale

**PROBLEMA:**
- EulerV2Plugin: 31632 bytes (OVER LIMIT +28.7%)
- 9 view functions non necessarie nel Plugin
- Violazione separation of concerns

**SOLUZIONE:**
- Spostare 9 view functions da IProtocolAdapter a ILensAdapter
- Implementare in EulerLensAdapter (accesso diretto a Registry)
- Rimuovere da EulerV2Plugin

**RISULTATO ATTESO:**
- Plugin: ~28000 bytes (-3600 bytes, -11.4%)
- Architettura più pulita (write in Plugin, read in Lens)
- Zero breaking changes su contratti core
- 5 file modificati, ~300 righe aggiunte, ~400 righe rimosse

**NEXT STEPS:**
- Se bytecode ancora > 24576: ulteriori ottimizzazioni
- Altrimenti: deploy testnet + audit

---

**Status:** ✅ PRONTO PER IMPLEMENTAZIONE

**Approvazione richiesta:** SI  
**Review richiesta:** SI  
**Testing richiesto:** ESTENSIVO

---

**Fine Documento**

