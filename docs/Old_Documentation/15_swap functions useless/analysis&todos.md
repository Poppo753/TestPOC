# Piano Strategico: Rimozione Wrapper Functions SwapManager

## Analisi

### Contesto

**Progetto**: Sistema DeFi modulare con architettura Beacon-based per gestione liquidità ETH  
**Branch corrente**: `fix/script-verification-errors`  
**Problema identificato**: 
- Bug di reentrancy in SwapManager.sol causato da nested `nonReentrant` modifiers
- Funzioni wrapper `swapTokenForWETH()` e `swapWETHForToken()` ridondanti
- 2 test skipped in TEST-002 a causa del bug

**Analisi Documentazione Folder 15**:
Il documento `swap func uiseless.md` fornisce un'analisi completa che identifica:

1. **Bug Reentrancy**: 
   - `swapTokenForWETH()` ha modifier `nonReentrant` (Lock #1)
   - Chiama `performSwap()` che ha anch'esso `nonReentrant` (Lock #2)
   - Risultato: "ReentrancyGuard: reentrant call" → test bloccati

2. **Ridondanza Funzionale**:
   - Wrapper validano `deadline` (già fatto da `performSwap`)
   - Wrapper validano `minAmountOut` (ridondante con protezione `maxSlippage` interna)
   - Wrapper NON sono `payable` (non gestiscono ETH nativo)
   - Wrapper NON fanno wrap/unwrap ETH ↔ WETH (delegato a `LiquidityManager`)

3. **Confronto Industry**:
   - Uniswap V2: wrapper necessari per gestione ETH nativo (payable, wrap/unwrap)
   - Uniswap V3: nessun wrapper speciale, architettura semplificata
   - Progetto attuale: più simile a V3 (wrap/unwrap in `LiquidityManager`)

### Vincoli / Requisiti

**Funzionali**:
- ✅ Mantenere protezione slippage (già garantita da `maxSlippage` in `_performSwapInternal`)
- ✅ Mantenere validazione deadline (presente in `performSwap`)
- ✅ Garantire backward compatibility interfaccia pubblica per moduli interni
- ✅ Fix bug reentrancy
- ✅ Riabilitare 2 test in `PerformanceBenchmarks.test.ts`

**Tecnici**:
- Contratti da analizzare: SwapManager.sol, `ISwapManager.sol`, test files
- Pattern architetturale: Beacon-based module system con ProxyGeneral custody
- Testing framework: Hardhat + TypeScript
- Deployment: già in produzione (valutare breaking changes)

**Non-Funzionali**:
- Minimizzare breaking changes per contratti dipendenti
- Mantenere o migliorare gas efficiency
- Ridurre code complexity
- Mantenere test coverage al 100%

### Rischi / Incertezze

**Rischio 1: Dipendenze Esterne** [SEVERITY: HIGH]
```
Risk: Contratti esterni potrebbero chiamare swapTokenForWETH/swapWETHForToken
Impact: Breaking change → contratti esterni falliscono
Probabilità: MEDIA (sistema modulare, potrebbero esserci integrazioni)
```

**Rischio 2: Protezione Slippage Percepita** [SEVERITY: MEDIUM]
```
Risk: Utenti/dev percepiscono perdita controllo senza minAmountOut esplicito
Impact: Resistance al cambiamento, richieste di rollback
Probabilità: BASSA (maxSlippage già configurabile, più flessibile)
```

**Rischio 3: Test Coverage Gaps** [SEVERITY: LOW]
```
Risk: Rimozione wrapper riduce path coverage
Impact: Edge cases non testati
Probabilità: BASSA (performSwap già testato, wrapper sono thin wrappers)
```

**Rischio 4: Migration Complexity** [SEVERITY: MEDIUM]
```
Risk: Update simultaneo di più componenti (contratti + test + docs)
Impact: Errori di sincronizzazione, deployment parziale
Probabilità: BASSA (change scope limitato)
```

## Strategia

### Approccio Scelto: **Opzione A - Rimozione Completa Wrapper** ✅

**Rationale**:
La documentazione propone 3 opzioni:
- **Opzione A**: Rimozione completa wrapper
- Opzione B: Fix reentrancy mantenendo wrapper (refactor interno)
- Opzione C: Redesign wrapper con valore aggiunto

**Scelta Opzione A per**:
1. **Fix Definitivo**: Elimina root cause bug (nested locks impossibili)
2. **Semplicità**: -40 lines codice, single entry point pubblico
3. **Allineamento Industry**: Pattern Uniswap V3 (no wrapper speciali)
4. **Manutenibilità**: Meno superficie di attacco, meno complessità
5. **Già Protetto**: Slippage protection via `maxSlippage` (3% default, configurabile)

### Alternative e Trade-off

#### **Opzione B: Fix Reentrancy + Mantieni Wrapper**

**Come funzionerebbe**:
```solidity
// Creare _performSwapCore() internal (NO nonReentrant)
function _performSwapCore(...) internal returns (uint256) {
    return _performSwapInternal(...);
}

// performSwap() chiama _performSwapCore()
function performSwap(...) public nonReentrant {
    return _performSwapCore(...);
}

// Wrapper chiamano _performSwapCore()
function swapTokenForWETH(...) external nonReentrant {
    uint256 received = _performSwapCore(...);
    require(received >= minAmountOut, "...");
    return received;
}
```

**Pro**:
- ✅ Nessun breaking change (API esistente preservata)
- ✅ User-friendly naming (`swapTokenForWETH` più descrittivo)
- ✅ Validazione `minAmountOut` esplicita

**Contro**:
- ❌ Codice più complesso (+1 funzione interna)
- ❌ Wrapper ancora ridondanti (validazioni duplicate)
- ❌ Maggiore superficie attacco
- ❌ Manutenibilità ridotta (più punti di failure)

**Verdict**: Subottimale - complessità senza valore reale

---

#### **Opzione C: Redesign Wrapper con Valore Aggiunto**

**Come funzionerebbe**:
Mantenere wrapper MA aggiungere funzionalità uniche:
- Gas optimization con pre-calcolo off-chain
- Batch operations (swap multipli)
- Advanced slippage strategies personalizzate
- Analytics tracking per coppia

**Pro**:
- ✅ Valore reale per utenti avanzati
- ✅ Differenziazione funzionale

**Contro**:
- ❌ Overkill per uso attuale (swap chiamati solo da `LiquidityManager`)
- ❌ Complessità aumentata significativamente
- ❌ Timeline estesa (design + implementazione + testing)
- ❌ Scope creep (feature non richiesta)

**Verdict**: Fuori scope - può essere aggiunto in futuro se necessario

---

### Motivazioni Scelta Opzione A

**Evidenze dalla documentazione**:

1. **Wrapper NON gestiscono ETH nativo**:
```
SwapManager NON è payable
↓
NO wrap ETH → WETH
NO unwrap WETH → ETH
↓
Tutto gestito da LiquidityManager (entry/exit point)
```

2. **Validazioni già coperte**:
```solidity
// Deadline: già in performSwap() line 218-238
require(block.timestamp <= deadline, "Deadline expired");

// Slippage: già in _validateSwapParameters() line 590-610
uint256 minAcceptableOutput = (expectedOutput * (10000 - maxSlippage)) / 10000;
require(actualOutput >= minAcceptableOutput, "Slippage too high");
```

3. **Pattern Uniswap V3**:
```
V2: Wrapper necessari per ETH handling (payable, wrap/unwrap)
V3: NO wrapper speciali, tutto è ERC20 (incluso WETH)
Progetto: Allineato con V3 (wrap/unwrap in LiquidityManager)
```

4. **Benefici Immediati**:
- Fix reentrancy bug automatico
- Test coverage 100% (18/18 TEST-002)
- Codice più pulito e manutenibile
- Preparazione per refactoring futuro (Swap Modularity folder 12)

---

## Documentazione

### Schema Logico / Architetturale

#### **Stato Attuale (BEFORE)**:

```
┌─────────────────────────────────────────────────────────────┐
│                      SwapManager.sol                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ PUBLIC API (3 entry points)                         │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │                                                       │   │
│  │  swapTokenForWETH() ←──── nonReentrant (Lock #1)   │   │
│  │         ↓                                            │   │
│  │         └──→ performSwap() ←──── nonReentrant #2   │   │  ❌ BUG!
│  │                    ↓                                 │   │
│  │                                                       │   │
│  │  swapWETHForToken() ←──── nonReentrant (Lock #1)   │   │
│  │         ↓                                            │   │
│  │         └──→ performSwap() ←──── nonReentrant #2   │   │  ❌ BUG!
│  │                    ↓                                 │   │
│  │                                                       │   │
│  │  performSwap() ←──────── nonReentrant              │   │
│  │         ↓                                            │   │
│  │         └──→ _performSwapInternal()                │   │
│  │                                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  Chiamato da: LiquidityManager (solo performSwap)          │
│  Lines: ~1050 (include wrapper ridondanti)                  │
│  Test: 16/18 passing (2 skipped a causa bug)               │
└─────────────────────────────────────────────────────────────┘
```

**Problemi identificati**:
- 🔴 Nested `nonReentrant` modifiers → revert
- 🟡 Validazione `deadline` duplicata (wrapper + performSwap)
- 🟡 Validazione `minAmountOut` ridondante (wrapper + maxSlippage interno)
- 🟡 Wrapper non aggiungono funzionalità uniche (no ETH handling)

---

#### **Stato Futuro (AFTER)**:

```
┌─────────────────────────────────────────────────────────────┐
│                      SwapManager.sol                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ PUBLIC API (1 entry point - SEMPLIFICATO)          │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │                                                       │   │
│  │  performSwap() ←──────── nonReentrant (single lock)│   │  ✅ NO BUG
│  │         ↓                                            │   │
│  │         └──→ _performSwapInternal()                │   │
│  │                    ↓                                 │   │
│  │                    └─→ Slippage protection         │   │  ✅ maxSlippage
│  │                                                       │   │
│  │  performSwapAuto() ←──── nonReentrant (automatic)  │   │
│  │         ↓                                            │   │
│  │         └──→ _performSwapInternal()                │   │
│  │                                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  Chiamato da: LiquidityManager (performSwap + Auto)        │
│  Lines: ~1010 (-40 lines, -4%)                             │
│  Test: 18/18 passing (100% coverage)                       │
│  API: Backward compatible per moduli interni               │
└─────────────────────────────────────────────────────────────┘
```

**Miglioramenti**:
- ✅ Bug reentrancy eliminato (single lock point)
- ✅ Codice semplificato (-40 lines)
- ✅ Single entry point pubblico (meno superficie attacco)
- ✅ Protezione slippage mantenuta (maxSlippage configurabile)
- ✅ Test coverage completo (18/18)

---

### API / Interfacce

#### **Interfacce da Modificare**:

**1. ISwapManager.sol** - Rimuovere dichiarazioni wrapper

```solidity
// FILE: contracts/interfaces/ISwapManager.sol

// ❌ DA RIMUOVERE:
function swapTokenForWETH(
    string calldata tokenCode,
    uint256 amountIn,
    uint256 minAmountOut,
    uint256 deadline
) external returns (uint256);

function swapWETHForToken(
    string calldata tokenCode,
    uint256 amountIn,
    uint256 minAmountOut,
    uint256 deadline
) external returns (uint256);

// ✅ DA MANTENERE:
function performSwap(
    string calldata tokenCodeFrom,
    string calldata tokenCodeTo,
    uint256 amountIn,
    uint256 deadline
) external returns (uint256);

function performSwapAuto(
    string calldata tokenCodeFrom,
    string calldata tokenCodeTo,
    uint256 amountIn
) external returns (uint256);
```

---

**2. SwapManager.sol** - API pubblica risultante

```solidity
// FILE: contracts/SwapManager.sol

// ======================== PUBLIC API ========================

/// @notice Esegue swap tra token tramite SimpleSwap router
/// @param tokenCodeFrom Codice token di partenza (es: "USDC")
/// @param tokenCodeTo Codice token di arrivo (es: "WETH")
/// @param amountIn Quantità token input
/// @param deadline Timestamp massimo per esecuzione swap
/// @return amountOut Quantità token ricevuti
/// @dev Slippage automaticamente limitato da maxSlippage (default 3%)
function performSwap(
    string calldata tokenCodeFrom,
    string calldata tokenCodeTo,
    uint256 amountIn,
    uint256 deadline
) external nonReentrant returns (uint256 amountOut);

/// @notice Esegue swap automatico con deadline calcolato internamente
/// @param tokenCodeFrom Codice token di partenza
/// @param tokenCodeTo Codice token di arrivo
/// @param amountIn Quantità token input
/// @return amountOut Quantità token ricevuti
/// @dev Usato da LiquidityManager per withdraw automatici
function performSwapAuto(
    string calldata tokenCodeFrom,
    string calldata tokenCodeTo,
    uint256 amountIn
) external nonReentrant returns (uint256 amountOut);

// ======================== VIEW FUNCTIONS ========================

/// @notice Preview swap output senza eseguire transazione
/// @param tokenCodeFrom Codice token di partenza
/// @param tokenCodeTo Codice token di arrivo
/// @param amountIn Quantità token input
/// @return estimatedOutput Output stimato
/// @return minOutput Output minimo garantito (dopo slippage)
function estimateSwapOutput(
    string calldata tokenCodeFrom,
    string calldata tokenCodeTo,
    uint256 amountIn
) external view returns (uint256 estimatedOutput, uint256 minOutput);
```

---

#### **Migration Guide per Contratti Esterni**:

**PRIMA (deprecated)**:
```solidity
// Swap USDC → WETH con minAmountOut esplicito
uint256 wethReceived = swapManager.swapTokenForWETH(
    "USDC",
    1000e6,      // 1000 USDC
    950e18,      // Min 950 WETH (5% slippage)
    deadline
);

// Swap WETH → USDC con minAmountOut esplicito
uint256 usdcReceived = swapManager.swapWETHForToken(
    "USDC",
    10e18,       // 10 WETH
    9500e6,      // Min 9500 USDC (5% slippage)
    deadline
);
```

**DOPO (nuovo pattern)**:
```solidity
// Opzione 1: Usa maxSlippage globale (raccomandato)
// Default: 3% (300 basis points)
uint256 wethReceived = swapManager.performSwap(
    "USDC",
    "WETH",
    1000e6,
    deadline
);
// Protezione slippage: automatica via maxSlippage

// Opzione 2: Configura maxSlippage custom prima dello swap
swapManager.setMaxSlippage(500); // 5% slippage
uint256 usdcReceived = swapManager.performSwap(
    "WETH",
    "USDC",
    10e18,
    deadline
);
// Restore default
swapManager.setMaxSlippage(300); // Back to 3%

// Opzione 3: Preview + validazione off-chain
(uint256 estimated, uint256 minOut) = swapManager.estimateSwapOutput(
    "USDC",
    "WETH",
    1000e6
);
require(minOut >= myThreshold, "Slippage too high");
uint256 received = swapManager.performSwap("USDC", "WETH", 1000e6, deadline);
```

---

### Impatti / Note Tecniche

#### **1. Impatto su Contratti Esistenti**

**LiquidityManager.sol** ✅ **NESSUN IMPATTO**
```solidity
// Location: contracts/Liquiditymanager.sol
// Lines: ~400-450 (withdraw flow)

// ✅ CURRENT: Usa già performSwap (NO wrapper)
function _executeAutomaticSwap(...) internal {
    uint256 received = ISwapManagerForModules(swapManager).performSwap(
        tokenCode,
        "WETH",
        swapAmount,
        deadline
    );
}

// ✅ CURRENT: Usa anche performSwapAuto
function _performSwapIfNeeded(...) internal {
    uint256 received = ISwapManagerForModules(swapManager).performSwapAuto(
        selectedToken,
        "WETH",
        requiredAmount
    );
}

// ✅ NESSUNA MODIFICA NECESSARIA
```

**Test Files** ⚠️ **VERIFICARE CHIAMATE**
```typescript
// Files da controllare:
- test/performance/PerformanceBenchmarks.test.ts (2 test skipped)
- test/integration/*.test.ts
- test/unit/SwapManager.test.ts (se esiste)
```

**Contratti Esterni** ⚠️ **POSSIBILE BREAKING CHANGE**
```
Risk: Se esistono integrazioni esterne che chiamano wrapper
Mitigation: Verificare con grep search nel codebase
Action: Se trovate, valutare:
  - Deprecation period (mantieni 1-2 settimane)
  - Migration guide nella documentazione
  - Backward compatibility wrapper (se critico)
```

---

#### **2. Impatto su Gas Cost**

**Analisi Teorica**:
```
BEFORE (con wrapper):
├─ swapTokenForWETH() entry
├─ validation deadline          (+~300 gas)
├─ performSwap() call           (+~2000 gas - call overhead)
├─ validation deadline (again)  (+~300 gas - duplicato!)
├─ _performSwapInternal()
└─ validation minAmountOut      (+~500 gas)
TOTAL OVERHEAD: ~3100 gas

AFTER (senza wrapper):
├─ performSwap() entry
├─ validation deadline          (+~300 gas)
├─ _performSwapInternal()
│   └─ validation slippage      (+~500 gas - già presente)
TOTAL OVERHEAD: ~800 gas

RISPARMIO: ~2300 gas per swap (-74%)
```

**Nota**: Risparmio reale per `LiquidityManager` = 0 (usa già `performSwap` direttamente)

---

#### **3. Protezione Slippage Dettagliata**

**Meccanismo Attuale in `_validateSwapParameters()`**:
```solidity
// Location: SwapManager.sol lines ~590-610
function _validateSwapParameters(...) private view returns (...) {
    // 1. Ottieni expected output da SimpleSwap
    uint256 expectedOutput = _getExpectedOutput(tokenIn, tokenOut, amountIn);
    
    // 2. Applica maxSlippage (es: 3% = 300 basis points)
    uint256 minAcceptableOutput = (expectedOutput * (10000 - maxSlippage)) / 10000;
    // Esempio: expectedOutput = 1000 WETH
    //          maxSlippage = 300 (3%)
    //          minAcceptable = 1000 * 9700 / 10000 = 970 WETH
    
    // 3. Validazione in _performSwapInternal()
    require(
        actualOutput >= minAcceptableOutput,
        "Slippage too high"
    );
    
    return (..., minAcceptableOutput, ...);
}
```

**Confronto wrapper `minAmountOut` vs `maxSlippage`**:

| Feature | Wrapper minAmountOut | maxSlippage interno |
|---------|---------------------|---------------------|
| **Configurazione** | Per-call (hardcoded) | Globale (configurabile) |
| **Flessibilità** | Bassa (richiede calcolo off-chain) | Alta (admin può aggiustare) |
| **Gas Cost** | +500 gas (validazione extra) | Già incluso (no overhead) |
| **UX Developer** | Complesso (calcolo manuale) | Semplice (automatico) |
| **Sicurezza** | Uguale | Uguale |

**Conclusione**: `maxSlippage` è **superiore** per flessibilità e gas efficiency.

---

#### **4. Funzionalità View Opzionale**

**Aggiunta Raccomandata** (opzionale ma utile):
```solidity
/// @notice Preview swap output con protezione slippage applicata
/// @dev Utile per validazione pre-transaction da frontend/script
/// @param tokenCodeFrom Codice token input
/// @param tokenCodeTo Codice token output
/// @param amountIn Quantità input
/// @return estimatedOutput Output stimato da oracle/router
/// @return minOutput Output minimo dopo applicazione maxSlippage
function estimateSwapOutput(
    string calldata tokenCodeFrom,
    string calldata tokenCodeTo,
    uint256 amountIn
) external view returns (uint256 estimatedOutput, uint256 minOutput) {
    // Resolve addresses
    address tokenIn = _resolveTokenAddress(tokenCodeFrom);
    address tokenOut = _resolveTokenAddress(tokenCodeTo);
    
    // Get expected output from router
    estimatedOutput = _getExpectedOutput(tokenIn, tokenOut, amountIn);
    
    // Apply maxSlippage
    minOutput = (estimatedOutput * (10000 - maxSlippage)) / 10000;
    
    return (estimatedOutput, minOutput);
}
```

**Use Case**:
```typescript
// Frontend preview prima di chiamare performSwap
const [estimated, minOut] = await swapManager.estimateSwapOutput("USDC", "WETH", usdcAmount);
console.log(`Expected: ${estimated} WETH, Minimum: ${minOut} WETH`);

// User approva → esegue swap
await swapManager.performSwap("USDC", "WETH", usdcAmount, deadline);
```

---

#### **5. Security Considerations**

**Before**:
```
Attack Surface: 3 entry points pubblici
├─ swapTokenForWETH()  ← nonReentrant (ma nested bug)
├─ swapWETHForToken()  ← nonReentrant (ma nested bug)
└─ performSwap()       ← nonReentrant
Risk: Nested locks possono essere exploited in upgrade futuri
```

**After**:
```
Attack Surface: 2 entry points pubblici (ridotta -33%)
├─ performSwap()       ← nonReentrant (single lock, safe)
└─ performSwapAuto()   ← nonReentrant (single lock, safe)
Risk: Minimizzato, pattern più sicuro
```

**Audit Checklist Post-Implementazione**:
- [ ] Slither analysis: `slither contracts/SwapManager.sol`
- [ ] Reentrancy check: Verify single lock pattern
- [ ] Access control: Verify ProxyGeneral authorization preserved
- [ ] Slippage validation: Verify maxSlippage correctly applied
- [ ] Event emissions: Verify SwapExecuted emitted correttamente

---

## TODO

### 📋 **Pre-Implementation Phase (Preparation)**

- [ ] **TODO-001**: Analisi dipendenze esterne
  ```bash
  # Cerca chiamate ai wrapper in tutto il codebase
  grep -r "swapTokenForWETH" contracts/ test/ scripts/
  grep -r "swapWETHForToken" contracts/ test/ scripts/
  
  # Verifica contratti che importano ISwapManager
  grep -r "ISwapManager" contracts/ --include="*.sol"
  
  # Output atteso: Solo test files (nessun contratto core dipende da wrapper)
  ```
  **Criteri Successo**: 
  - Nessun contratto core (`LiquidityManager`, `ValueCalculator`, etc.) usa wrapper
  - Solo test files potrebbero usarli (ok, saranno aggiornati)
  - Se trovate dipendenze esterne → escalate, valuta deprecation period

---

- [ ] **TODO-002**: Backup e branch setup
  ```bash
  # Assicurati di essere su branch corretto
  git status
  # Current branch: fix/script-verification-errors ✅
  
  # Crea backup locale
  cp contracts/SwapManager.sol contracts/SwapManager.sol.backup
  cp contracts/interfaces/ISwapManager.sol contracts/interfaces/ISwapManager.sol.backup
  
  # Crea checkpoint commit (prima di modifiche)
  git add .
  git commit -m "checkpoint: before removing swap wrapper functions"
  ```
  **Criteri Successo**: 
  - Branch `fix/script-verification-errors` attivo
  - Backup files creati
  - Checkpoint commit creato

---

- [ ] **TODO-003**: Compilazione baseline e test suite baseline
  ```bash
  # Compila contratti (should pass)
  npx hardhat compile
  
  # Run full test suite
  npx hardhat test
  
  # Save test results baseline
  npx hardhat test > test_results_before.txt
  
  # Focus on PerformanceBenchmarks (TEST-002)
  npx hardhat test test/performance/PerformanceBenchmarks.test.ts
  
  # Output atteso:
  # - Compilation: ✅ Success
  # - TEST-002: 16/16 passing, 2 skipped (swap tests blocked by reentrancy bug)
  ```
  **Criteri Successo**: 
  - Compilazione clean (no errors)
  - TEST-002: 16/18 test (2 skipped come atteso)
  - Baseline salvato per confronto post-fix

---

### 🔧 **Implementation Phase**

#### **Step 1: Modifica Contratti**

- [ ] **TODO-004**: Rimuovi wrapper functions da SwapManager.sol
  ```solidity
  // FILE: contracts/SwapManager.sol
  
  // Lines da RIMUOVERE: 158-183 (swapTokenForWETH + commenti)
  // Lines da RIMUOVERE: 184-209 (swapWETHForToken + commenti)
  
  // DETTAGLIO:
  // 1. Locate function swapTokenForWETH(...) external nonReentrant
  // 2. Delete entire function (including docstring)
  // 3. Locate function swapWETHForToken(...) external nonReentrant
  // 4. Delete entire function (including docstring)
  
  // ✅ MANTENERE:
  // - function performSwap(...) external nonReentrant (line ~218)
  // - function performSwapAuto(...) external nonReentrant (line ~245)
  // - function _performSwapInternal(...) internal (line ~275)
  // - Tutte le altre funzioni
  ```
  **Criteri Successo**: 
  - File compila senza errori
  - Riduzione ~40-50 lines
  - Solo 2 entry point pubblici: `performSwap` e `performSwapAuto`

---

- [ ] **TODO-005**: Aggiorna interface `ISwapManager.sol`
  ```solidity
  // FILE: contracts/interfaces/ISwapManager.sol
  
  // RIMUOVI dichiarazioni:
  function swapTokenForWETH(
      string calldata tokenCode,
      uint256 amountIn,
      uint256 minAmountOut,
      uint256 deadline
  ) external returns (uint256);
  
  function swapWETHForToken(
      string calldata tokenCode,
      uint256 amountIn,
      uint256 minAmountOut,
      uint256 deadline
  ) external returns (uint256);
  
  // ✅ MANTIENI tutto il resto (performSwap, performSwapAuto, view functions, events)
  ```
  **Criteri Successo**: 
  - Interface compila
  - Nessun errore di type mismatch
  - SwapManager implementa correttamente ISwapManager (dopo rimozione)

---

- [ ] **TODO-006**: (OPZIONALE) Aggiungi view function `estimateSwapOutput`
  ```solidity
  // FILE: contracts/SwapManager.sol
  // Location: Dopo performSwapAuto, prima delle internal functions
  
  /// @notice Preview swap output con protezione slippage
  /// @param tokenCodeFrom Codice token input
  /// @param tokenCodeTo Codice token output
  /// @param amountIn Quantità input
  /// @return estimatedOutput Output stimato
  /// @return minOutput Output minimo (dopo maxSlippage)
  function estimateSwapOutput(
      string calldata tokenCodeFrom,
      string calldata tokenCodeTo,
      uint256 amountIn
  ) external view returns (uint256 estimatedOutput, uint256 minOutput) {
      // Resolve addresses
      address tokenManager = IBeacon(beacon).getImplementation("TokenManager");
      address tokenIn = ITokenManagerForModules(tokenManager).getTokenAddress(tokenCodeFrom);
      address tokenOut = ITokenManagerForModules(tokenManager).getTokenAddress(tokenCodeTo);
      
      require(tokenIn != address(0) && tokenOut != address(0), "Invalid tokens");
      
      // Get expected output
      estimatedOutput = _getExpectedOutput(tokenIn, tokenOut, amountIn);
      
      // Apply maxSlippage
      minOutput = (estimatedOutput * (10000 - maxSlippage)) / 10000;
      
      return (estimatedOutput, minOutput);
  }
  ```
  **Criteri Successo**: 
  - Funzione view (no state changes)
  - Return correct values based on current maxSlippage
  - Utile per frontend preview

---

- [ ] **TODO-007**: Compilazione post-modifiche
  ```bash
  # Compila contratti modificati
  npx hardhat compile
  
  # Output atteso:
  # - Compilation successful ✅
  # - No errors
  # - Contract size within limits
  
  # Verifica gas report (opzionale)
  REPORT_GAS=true npx hardhat compile
  ```
  **Criteri Successo**: 
  - Compilazione clean
  - No warnings critici
  - Contract size < 24KB (EIP-170 limit)

---

#### **Step 2: Aggiornamento Test**

- [ ] **TODO-008**: Identifica test files che usano wrapper
  ```bash
  # Cerca test che chiamano wrapper
  grep -r "swapTokenForWETH\|swapWETHForToken" test/
  
  # Output atteso (probabile):
  # - test/performance/PerformanceBenchmarks.test.ts (2 skipped tests)
  # - Possibile: test/unit/SwapManager.test.ts
  # - Possibile: test/integration/*.test.ts
  ```
  **Criteri Successo**: 
  - Lista completa test files da aggiornare
  - Priorità: `PerformanceBenchmarks.test.ts` (contiene 2 test skipped)

---

- [ ] **TODO-009**: Aggiorna `PerformanceBenchmarks.test.ts`
  ```typescript
  // FILE: test/performance/PerformanceBenchmarks.test.ts
  // Lines: ~307-368 (swap tests skipped)
  
  // BEFORE:
  describe.skip("Swap Operations", function() {
      it("Should benchmark USDC → WETH swap", async function() {
          await swapManager.swapTokenForWETH("USDC", amount, minOut, deadline);
      });
      
      it("Should benchmark WETH → USDC swap", async function() {
          await swapManager.swapWETHForToken("USDC", amount, minOut, deadline);
      });
  });
  
  // AFTER:
  describe("Swap Operations", function() { // ✅ Remove .skip
      it("Should benchmark USDC → WETH swap", async function() {
          // Setup: Ensure ProxyGeneral has USDC balance
          const usdcAmount = parseUnits("1000", 6);
          // ... transfer USDC to ProxyGeneral ...
          
          // Execute swap
          const tx = await swapManager.performSwap(
              "USDC",
              "WETH",
              usdcAmount,
              deadline
          );
          const receipt = await tx.wait();
          
          // Assertions
          expect(receipt.gasUsed).to.be.lt(350000);
          // ... altri assertions ...
      });
      
      it("Should benchmark WETH → USDC swap", async function() {
          // Setup: Ensure ProxyGeneral has WETH balance
          const wethAmount = parseEther("10");
          // ... transfer WETH to ProxyGeneral ...
          
          // Execute swap
          const tx = await swapManager.performSwap(
              "WETH",
              "USDC",
              wethAmount,
              deadline
          );
          const receipt = await tx.wait();
          
          // Assertions
          expect(receipt.gasUsed).to.be.lt(350000);
          // ... altri assertions ...
      });
  });
  ```
  **Criteri Successo**: 
  - `.skip` rimosso
  - Chiamate aggiornate a `performSwap(from, to, amount, deadline)`
  - Setup corretto (ProxyGeneral ha balance necessario)
  - Assertions preserved

---

- [ ] **TODO-010**: Aggiorna altri test files (se necessario)
  ```typescript
  // Per ogni test file identificato in TODO-008:
  
  // Pattern di migrazione:
  
  // OLD:
  await swapManager.swapTokenForWETH(tokenCode, amount, minOut, deadline);
  
  // NEW:
  await swapManager.performSwap(tokenCode, "WETH", amount, deadline);
  
  // ---
  
  // OLD:
  await swapManager.swapWETHForToken(tokenCode, amount, minOut, deadline);
  
  // NEW:
  await swapManager.performSwap("WETH", tokenCode, amount, deadline);
  ```
  **Criteri Successo**: 
  - Tutti i test compilano
  - No reference a wrapper functions
  - Logic preservation (stessi assertion, diversa API call)

---

- [ ] **TODO-011**: (OPZIONALE) Aggiungi test per `estimateSwapOutput`
  ```typescript
  // FILE: test/unit/SwapManager.test.ts (o nuovo file)
  
  describe("estimateSwapOutput", function() {
      it("Should return estimated and min output", async function() {
          const [estimated, minOut] = await swapManager.estimateSwapOutput(
              "USDC",
              "WETH",
              parseUnits("1000", 6)
          );
          
          expect(estimated).to.be.gt(0);
          expect(minOut).to.be.gt(0);
          expect(minOut).to.be.lt(estimated); // minOut < estimated (slippage applied)
          
          // Verify maxSlippage application (3% default)
          const expectedMin = (estimated * 9700n) / 10000n;
          expect(minOut).to.equal(expectedMin);
      });
      
      it("Should reflect maxSlippage changes", async function() {
          // Get quote with 3% slippage
          const [est1, min1] = await swapManager.estimateSwapOutput("USDC", "WETH", amount);
          
          // Change maxSlippage to 5%
          await swapManager.setMaxSlippage(500);
          
          // Get quote again
          const [est2, min2] = await swapManager.estimateSwapOutput("USDC", "WETH", amount);
          
          // Estimated should be same, min should be lower (higher slippage)
          expect(est1).to.equal(est2);
          expect(min2).to.be.lt(min1);
      });
  });
  ```
  **Criteri Successo**: 
  - View function testata
  - Correttezza calcolo slippage verificata
  - Edge cases coperti

---

### ✅ **Verification Phase**

- [ ] **TODO-012**: Run full test suite
  ```bash
  # Clean compile
  npx hardhat clean
  npx hardhat compile
  
  # Run ALL tests
  npx hardhat test
  
  # Save results
  npx hardhat test > test_results_after.txt
  
  # Compare with baseline
  diff test_results_before.txt test_results_after.txt
  
  # Focus on TEST-002 (dovrebbe essere 18/18 ora)
  npx hardhat test test/performance/PerformanceBenchmarks.test.ts
  ```
  **Criteri Successo**: 
  - ✅ TEST-002: 18/18 passing (100% coverage)
  - ✅ Nessun test regressione (altri test ancora passing)
  - ✅ 2 swap tests ora enabled e passing
  - ✅ Gas usage entro limiti (<350k per swap)

---

- [ ] **TODO-013**: Gas benchmarking
  ```bash
  # Run con gas reporting
  REPORT_GAS=true npx hardhat test test/performance/PerformanceBenchmarks.test.ts
  
  # Analizza output gas per:
  # - performSwap() gas cost
  # - Confronto con baseline (se disponibile)
  # - Verifica < 350k gas limit
  
  # Opzionale: Genera gas report dettagliato
  npx hardhat test --grep "Swap Operations" | tee gas_report.txt
  ```
  **Criteri Successo**: 
  - `performSwap()` gas cost documentato
  - Risparmio gas visibile (se baseline disponibile)
  - Tutti gli swap < 350k gas
  - No regressions su altri functions

---

- [ ] **TODO-014**: Security analysis
  ```bash
  # Slither static analysis
  slither contracts/SwapManager.sol
  
  # Checklist manuale:
  # - [ ] Single nonReentrant per entry point (no nesting)
  # - [ ] ProxyGeneral authorization preserved
  # - [ ] Slippage protection correttamente applicata
  # - [ ] Events emessi correttamente (SwapExecuted)
  # - [ ] No new vulnerabilities introdotte
  
  # Mythril (se installato - opzionale)
  myth analyze contracts/SwapManager.sol
  ```
  **Criteri Successo**: 
  - Slither: no critical/high severity issues
  - Reentrancy fix confermato (no nested locks)
  - Security checklist completato
  - No regressioni security

---

- [ ] **TODO-015**: Code review checklist
  ```markdown
  # Code Review Checklist
  
  ## Funzionalità
  - [ ] Wrapper functions completamente rimossi
  - [ ] performSwap() preservato e funzionante
  - [ ] performSwapAuto() preservato e funzionante
  - [ ] Slippage protection via maxSlippage funzionante
  - [ ] Deadline validation presente
  
  ## Testing
  - [ ] TEST-002: 18/18 passing
  - [ ] Swap tests riabilitati e passing
  - [ ] Gas benchmarks passing
  - [ ] No test regressions
  
  ## Documentazione Code
  - [ ] NatSpec comments aggiornati
  - [ ] Interface comments aggiornati
  - [ ] Esempi usage corretti
  
  ## Security
  - [ ] Reentrancy bug eliminato
  - [ ] Slither analysis clean
  - [ ] Access control preserved
  - [ ] No new attack vectors
  
  ## Performance
  - [ ] Gas efficiency mantenuta/migliorata
  - [ ] Contract size entro limiti (<24KB)
  - [ ] No performance regressions
  ```
  **Criteri Successo**: 
  - Tutti i checkbox ✅
  - Peer review completato (se team)
  - Approval per merge

---

### 📚 **Documentation Phase**

- [ ] **TODO-016**: Aggiorna documentazione tecnica
  ```markdown
  # Files da aggiornare:
  
  1. docs/03_analysis/Technical_Module_Analysis.md
     - Update SwapManager section
     - Remove references to wrapper functions
     - Document new API pattern
  
  2. docs/02_developers/DEVELOPER_GUIDE.md
     - Update examples con performSwap()
     - Remove swapTokenForWETH/Token examples
     - Add migration guide section
  
  3. README.md (if applicable)
     - Update swap examples
     - Update API reference
  
  4. CHANGELOG.md
     - Add entry for wrapper removal
     - Document breaking change (se applicabile)
     - List bug fixes (reentrancy)
  ```
  **Criteri Successo**: 
  - Documentazione accurata e aggiornata
  - Esempi funzionanti con nuovo API
  - Migration guide chiara per esterni

---

- [ ] **TODO-017**: Crea migration guide per utenti
  ```markdown
  # FILE: docs/MIGRATION_GUIDE_SWAP_WRAPPER.md
  
  # Migration Guide: Swap Wrapper Removal
  
  ## What Changed
  - Removed: swapTokenForWETH()
  - Removed: swapWETHForToken()
  - Use instead: performSwap(from, to, amount, deadline)
  
  ## Why
  - Fix reentrancy bug
  - Simplify API
  - Better gas efficiency
  - Aligned with industry patterns (Uniswap V3)
  
  ## How to Migrate
  
  ### Before
  ```solidity
  uint256 weth = swapManager.swapTokenForWETH("USDC", 1000e6, 950e18, deadline);
  uint256 usdc = swapManager.swapWETHForToken("USDC", 10e18, 9500e6, deadline);
  ```
  
  ### After
  ```solidity
  uint256 weth = swapManager.performSwap("USDC", "WETH", 1000e6, deadline);
  uint256 usdc = swapManager.performSwap("WETH", "USDC", 10e18, deadline);
  ```
  
  ## Slippage Protection
  - Old: Manual minAmountOut per call
  - New: Automatic via maxSlippage (default 3%)
  - Configuration: swapManager.setMaxSlippage(300) // 3%
  
  ## Questions?
  Contact: dev@yourdomain.com
  ```
  **Criteri Successo**: 
  - Migration guide chiara e concisa
  - Esempi pratici inclusi
  - Contact info per supporto

---

### 🚀 **Deployment Phase** (se necessario)

- [ ] **TODO-018**: Prepara deployment script (se upgrade necessario)
  ```typescript
  // FILE: scripts/upgrade/upgrade-swap-manager.ts
  
  import { ethers, upgrades } from "hardhat";
  
  async function main() {
      console.log("Upgrading SwapManager...");
      
      // Get current beacon
      const beacon = await ethers.getContractAt("Beacon", BEACON_ADDRESS);
      
      // Deploy new SwapManager implementation
      const SwapManager = await ethers.getContractFactory("SwapManager");
      const newImpl = await SwapManager.deploy(BEACON_ADDRESS);
      await newImpl.deployed();
      
      console.log("New SwapManager deployed at:", newImpl.address);
      
      // Update beacon pointer
      const tx = await beacon.updateImplementation("SwapManager", newImpl.address);
      await tx.wait();
      
      console.log("Beacon updated successfully");
      
      // Verify upgrade
      const currentImpl = await beacon.getImplementation("SwapManager");
      console.log("Current implementation:", currentImpl);
      console.log("Expected:", newImpl.address);
      
      if (currentImpl === newImpl.address) {
          console.log("✅ Upgrade successful");
      } else {
          console.log("❌ Upgrade failed - implementation mismatch");
      }
  }
  
  main()
      .then(() => process.exit(0))
      .catch((error) => {
          console.error(error);
          process.exit(1);
      });
  ```
  **Criteri Successo**: 
  - Script tested su testnet
  - Rollback plan preparato
  - Beacon update verificato

---

- [ ] **TODO-019**: Testnet deployment (se necessario)
  ```bash
  # Deploy to testnet (es: Arbitrum Sepolia)
  npx hardhat run scripts/upgrade/upgrade-swap-manager.ts --network arbitrumSepolia
  
  # Verify contract
  npx hardhat verify --network arbitrumSepolia NEW_IMPL_ADDRESS BEACON_ADDRESS
  
  # Test on testnet
  # - Call performSwap() via frontend/script
  # - Verify slippage protection works
  # - Verify gas costs as expected
  # - Monitor for 24-48 hours
  ```
  **Criteri Successo**: 
  - Testnet deployment successful
  - Verification successful
  - Functional testing passed
  - No issues in monitoring period

---

- [ ] **TODO-020**: Mainnet deployment (se necessario)
  ```bash
  # PREREQUISITI:
  # - [ ] Testnet deployment successful (TODO-019)
  # - [ ] Security audit completed (TODO-014)
  # - [ ] Team approval obtained
  # - [ ] Rollback plan prepared
  
  # Deploy to mainnet
  npx hardhat run scripts/upgrade/upgrade-swap-manager.ts --network arbitrum
  
  # Verify contract
  npx hardhat verify --network arbitrum NEW_IMPL_ADDRESS BEACON_ADDRESS
  
  # Monitor closely
  # - Watch for any errors
  # - Monitor gas costs
  # - Check swap success rate
  # - Be ready to rollback if issues
  ```
  **Criteri Successo**: 
  - Mainnet deployment successful
  - Beacon updated correctly
  - LiquidityManager still functioning
  - No errors in first 24 hours
  - Rollback plan ready (non utilizzato)

---

### 📊 **Post-Deployment Monitoring**

- [ ] **TODO-021**: Setup monitoring & alerts
  ```typescript
  // Metriche da monitorare:
  
  // 1. Swap success rate
  //    - Target: >99%
  //    - Alert se: <95%
  
  // 2. Gas costs
  //    - Target: <350k per swap
  //    - Alert se: >400k
  
  // 3. Slippage occurrences
  //    - Track "Slippage too high" reverts
  //    - Alert se: >5% dei swap
  
  // 4. Error rate
  //    - Track SwapFailed events
  //    - Alert se: >1% dei swap
  
  // Tools:
  // - Tenderly (monitoring)
  // - Grafana (dashboard)
  // - PagerDuty (alerts)
  ```
  **Criteri Successo**: 
  - Dashboard configurato
  - Alerts attivi
  - Baseline metrics registrati

---

- [ ] **TODO-022**: Post-implementation review
  ```markdown
  # Post-Implementation Review
  
  ## Obiettivi Raggiunti
  - [ ] Bug reentrancy risolto
  - [ ] TEST-002 coverage 100% (18/18)
  - [ ] Codice semplificato (-40 lines)
  - [ ] Gas efficiency migliorata
  - [ ] API semplificata (single entry point)
  
  ## Metriche
  - Lines of code removed: ~40
  - Test coverage: 100% (18/18)
  - Gas saving: ~2300 gas per swap (se wrapper usati prima)
  - Deployment time: [TO FILL]
  - Downtime: 0 (se upgrade via beacon)
  
  ## Lessons Learned
  - [TO FILL based on actual experience]
  
  ## Future Improvements
  - Implement plugin system (folder 12)
  - Add more DEX integrations
  - Optimize gas further
  
  ## Sign-off
  - Developer: [NAME]
  - Reviewer: [NAME]
  - Date: [DATE]
  ```
  **Criteri Successo**: 
  - Review completato
  - Metriche documentate
  - Lessons learned registrate
  - Sign-off ottenuto

---

## 📈 **Success Metrics**

### **Pre-Implementation (Baseline)**
```
├─ TEST-002: 16/18 passing (88.9%)
├─ Swap tests: 2 skipped
├─ Reentrancy bug: ACTIVE
├─ Code lines: ~1050 in SwapManager.sol
├─ Public API: 3 entry points (swapTokenForWETH, swapWETHForToken, performSwap)
└─ Gas cost: Unknown (test blocked)
```

### **Post-Implementation (Target)**
```
├─ TEST-002: 18/18 passing (100%) ✅
├─ Swap tests: 0 skipped, 2 passing ✅
├─ Reentrancy bug: FIXED ✅
├─ Code lines: ~1010 (-40 lines, -4%) ✅
├─ Public API: 2 entry points (performSwap, performSwapAuto) ✅
└─ Gas cost: <350k per swap ✅
```

### **KPIs**
```
Test Coverage: 88.9% → 100% (+12.5%)
Code Complexity: -4%
Security Issues: 1 → 0 (-100%)
Gas Efficiency: +~2300 gas saved (vs wrapper usage)
API Simplicity: 3 → 2 entry points (-33%)
```

---

## ⏱️ **Estimated Timeline**

```
Phase 1: Preparation (TODO-001 to TODO-003)
├─ Analisi dipendenze: 30 min
├─ Backup e setup: 15 min
└─ Baseline testing: 30 min
SUBTOTAL: ~1.5 ore

Phase 2: Implementation (TODO-004 to TODO-007)
├─ Rimozione wrapper: 30 min
├─ Update interface: 15 min
├─ Add estimateSwapOutput (opzionale): 30 min
└─ Compilation: 15 min
SUBTOTAL: ~1.5 ore

Phase 3: Testing (TODO-008 to TODO-011)
├─ Identifica test: 15 min
├─ Update PerformanceBenchmarks: 45 min
├─ Update altri test: 30 min
└─ Aggiungi test estimateSwapOutput (opzionale): 30 min
SUBTOTAL: ~2 ore

Phase 4: Verification (TODO-012 to TODO-015)
├─ Full test suite: 30 min
├─ Gas benchmarking: 20 min
├─ Security analysis: 30 min
└─ Code review: 45 min
SUBTOTAL: ~2 ore

Phase 5: Documentation (TODO-016 to TODO-017)
├─ Update tech docs: 45 min
└─ Migration guide: 30 min
SUBTOTAL: ~1.25 ore

Phase 6: Deployment (TODO-018 to TODO-020) [SE NECESSARIO]
├─ Prepare scripts: 1 ora
├─ Testnet deployment: 1 ora
└─ Mainnet deployment: 1 ora
SUBTOTAL: ~3 ore (opzionale)

Phase 7: Monitoring (TODO-021 to TODO-022)
├─ Setup monitoring: 1 ora
└─ Post-review: 30 min
SUBTOTAL: ~1.5 ore

TOTAL (no deployment): ~8-9 ore
TOTAL (with deployment): ~11-12 ore
```

**Quick Win Scenario** (minimal path):
```
TODO-004 + TODO-005 + TODO-009 + TODO-012 = ~2.5 ore
Result: Bug fixed, tests passing
```

---

## 🎯 **Raccomandazione Finale**

### **Priorità: CRITICA ⚡**

**Motivi**:
1. **Bug Fix**: Risolve reentrancy bug attivo
2. **Quick Win**: 2-3 ore per implementazione core
3. **Test Enablement**: Sblocca 2 test, porta coverage a 100%
4. **Foundation**: Prepara codebase per Swap Modularity (folder 12)
5. **Zero Risk**: Nessun breaking change per contratti core (`LiquidityManager` usa già `performSwap`)

**Next Steps Immediati**:
```
1. Start con TODO-001 (analisi dipendenze) - 30 min
2. Procedi con implementazione (TODO-004 a TODO-007) - 1.5 ore
3. Update test (TODO-008 a TODO-009) - 1 ora
4. Verifica (TODO-012 a TODO-013) - 1 ora
TOTAL: ~4 ore per victory completa
```
