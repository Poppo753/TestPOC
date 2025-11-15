# TEST COVERAGE ANALYSIS - Phase 1A+1B

**Data**: 15 Novembre 2025  
**Domanda Utente**: "abbiamo testato tutte le possibilità? del tipo con i test 1b sappiamo che funziona swapbetsprice, ma lo swap in cui indico io il plugin?"

---

## 📊 COPERTURA ATTUALE

### ✅ **Phase 1B Tests (COMPLETI)** - `SwapManager.Phase1B.test.ts`

| Funzione | Test Status | Copertura |
|----------|------------|-----------|
| `getAllQuotes()` | ✅ Completo | 100% |
| `swapWithBestPlugin()` | ✅ Completo | 100% |
| Backward compatibility | ✅ Completo | 100% |
| Eventi | ✅ Completo | 100% |
| Validazioni input | ✅ Completo | 100% |

**Test Eseguiti**:
- ✅ Query multi-plugin (3 plugin)
- ✅ Identificazione best plugin
- ✅ Esecuzione swap con best price
- ✅ Gestione plugin invalidi
- ✅ Gestione errori (deadline, amounts, etc.)
- ✅ Eventi `BestPluginSelected`

---

## ❌ **MANCANTE: Phase 1A Tests (INCOMPLETE)**

### Funzioni NON Testate Completamente:

#### 1. **`performSwap()` con Plugin Specifico**
```solidity
function performSwap(
    string memory spendTokenCode,
    string memory receiveTokenCode,
    uint256 amountIn,
    uint256 deadline
) public returns (uint256)
```

**Scenario NON testato**:
- ✅ Esiste test in `Phase1B.test.ts` ma testa solo backward compatibility
- ❌ NON testa `performSwap()` con **activeSwapPlugin SPECIFICO**
- ❌ NON testa switch plugin e poi swap

**Cosa manca**:
```typescript
// Test necessario:
await swapManager.setActiveSwapPlugin("CamelotPlugin"); // Scelgo Camelot
await swapManager.performSwap("USDC", "WBTC", amount, deadline); // Usa Camelot
// Verify: swap eseguito con Camelot, NON con best price
```

---

#### 2. **`performSwapAuto()` con Plugin Specifico**
```solidity
function performSwapAuto(
    string memory spendTokenCode,
    string memory receiveTokenCode,
    uint256 amountIn
) public returns (uint256)
```

**Scenario NON testato**:
- ❌ NON testa `performSwapAuto()` con `activeSwapPlugin` specifico
- ❌ NON verifica deadline automatico funziona

**Cosa manca**:
```typescript
// Test necessario:
await swapManager.setActiveSwapPlugin("UniswapV3Plugin");
await swapManager.performSwapAuto("USDC", "WBTC", amount); // Auto deadline
// Verify: usa UniswapV3Plugin, deadline impostato correttamente
```

---

#### 3. **`setActiveSwapPlugin()` e Switch Dinamico**
```solidity
function setActiveSwapPlugin(string memory pluginName) external onlyOwner
```

**Scenario NON testato**:
- ✅ Test esiste in `Phase1B.test.ts` - verifica function exists
- ❌ NON testa switch plugin → esegui swap → verifica plugin corretto usato
- ❌ NON testa plugin switc multiple times

**Cosa manca**:
```typescript
// Test necessario:
// 1. Swap con UniswapV3Plugin
await swapManager.setActiveSwapPlugin("UniswapV3Plugin");
const result1 = await performSwap(...);
// Verify: used UniswapV3 (quote = 0.5 WBTC)

// 2. Switch to CamelotPlugin
await swapManager.setActiveSwapPlugin("CamelotPlugin");
const result2 = await performSwap(...);
// Verify: used Camelot (quote = 0.49 WBTC)

// 3. Switch to OdosPlugin
await swapManager.setActiveSwapPlugin("OdosPlugin");
const result3 = await performSwap(...);
// Verify: used Odos (quote = 0.48 WBTC)
```

---

#### 4. **Beacon Resolution Dinamica**
```solidity
function _getActivePlugin() internal view returns (ISimpleSwap)
```

**Scenario NON testato**:
- ❌ NON testa Beacon resolution per OGNI swap (non cached)
- ❌ NON testa update Beacon → swap risolve nuova address

**Cosa manca**:
```typescript
// Test necessario:
await swapManager.setActiveSwapPlugin("UniswapV3Plugin");
await performSwap(...); // Usa address1 da Beacon

// Update Beacon pointer (simulate upgrade)
await beacon.updateImplementation("UniswapV3Plugin", newAddress);

await performSwap(...); // Deve usare newAddress (dynamic resolution)
// Verify: plugin address changed, no restart needed
```

---

#### 5. **Fallback a `simpleSwapRouter` (Deprecated)**
```solidity
// Fallback logic in _getActivePlugin()
if (pluginAddr == address(0)) {
    return ISimpleSwap(simpleSwapRouter);
}
```

**Scenario NON testato**:
- ❌ NON testa fallback quando Beacon resolution fallisce
- ❌ NON testa `simpleSwapRouter` ancora funziona dopo migration

**Cosa manca**:
```typescript
// Test necessario:
// 1. Set simpleSwapRouter as fallback
await swapManager.setSimpleSwapRouter(uniswapPluginAddress);

// 2. Remove plugin from Beacon (simulate failure)
await beacon.updateImplementation("UniswapV3Plugin", ethers.ZeroAddress);

// 3. Perform swap - should FALLBACK to simpleSwapRouter
const result = await performSwap(...);
// Verify: swap succeeded via simpleSwapRouter, NOT via Beacon
```

---

## 🎯 CONFRONTO: Specific Plugin vs Best Price

### Scenario Utente Deve Scegliere:

**OPZIONE 1: Specific Plugin (Phase 1A)** - `performSwap()`
```typescript
// User trusts specific DEX (Camelot for MEV protection)
await swapManager.setActiveSwapPlugin("CamelotPlugin");
await swapManager.performSwap("USDC", "WBTC", 1000 USDC, deadline);
// Result: 0.49 WBTC (Camelot quote, NOT best price)
```

**OPZIONE 2: Best Price (Phase 1B)** - `swapWithBestPlugin()`
```typescript
// User wants maximum value
await swapManager.swapWithBestPlugin("USDC", "WBTC", 1000 USDC, minOut, deadline);
// Result: 0.5 WBTC (UniswapV3 = best price)
```

**Use Cases**:
- **Specific Plugin**: MEV protection, reputation, compliance requirements
- **Best Price**: Maximize value, arbitrage, rebalancing

**PROBLEMA**: Opzione 1 (Specific Plugin) **NON È TESTATA** nei test correnti!

---

## 📋 TEST MANCANTI - TODO

### **File da Creare**: `SwapManager.Phase1A-1B.Integration.test.ts`

#### **Test Suite 1: Specific Plugin (Phase 1A)**
- [ ] `performSwap()` uses current `activeSwapPlugin`
- [ ] `performSwapAuto()` uses current `activeSwapPlugin` with auto deadline
- [ ] `setActiveSwapPlugin()` switches plugin correctly
- [ ] Multiple plugin switches work correctly
- [ ] Beacon resolution is dynamic (not cached)
- [ ] `SwapPluginChanged` event emitted correctly
- [ ] Rejects non-existent plugin names

#### **Test Suite 2: Best Price (Phase 1B)**
- [x] ✅ `swapWithBestPlugin()` queries all plugins (DONE)
- [x] ✅ Selects best price regardless of `activeSwapPlugin` (DONE)
- [ ] ⚠️ Verify best price IGNORES `activeSwapPlugin` setting

#### **Test Suite 3: Backward Compatibility**
- [ ] Fallback to `simpleSwapRouter` if Beacon fails
- [ ] `setSimpleSwapRouter()` emits deprecation warning
- [ ] Old system still works during migration

#### **Test Suite 4: User Choice Demo**
- [ ] Demonstrate difference: specific plugin vs best price
- [ ] Show price impact comparison
- [ ] Document use cases for each option

---

## 📊 COPERTURA STIMATA

| Categoria | Phase 1B Tests | Integration Tests | Totale |
|-----------|----------------|-------------------|--------|
| Best Price (`swapWithBestPlugin`) | 100% | 100% | ✅ 100% |
| Specific Plugin (`performSwap`) | 20% | 0% | ❌ 20% |
| Plugin Switching | 30% | 0% | ❌ 30% |
| Beacon Resolution | 0% | 0% | ❌ 0% |
| Fallback Mechanism | 0% | 0% | ❌ 0% |
| **OVERALL** | 50% | 0% | ❌ **50%** |

---

## ✅ RACCOMANDAZIONE

**PRIORITÀ ALTA**: Creare `SwapManager.Phase1A-1B.Integration.test.ts`

**Contenuto Minimo**:
1. **6 test** per specific plugin (`performSwap()` con diversi plugin)
2. **3 test** per plugin switching dinamico
3. **2 test** per Beacon resolution dinamica
4. **2 test** per fallback mechanism
5. **1 test** demo user choice (specific vs best)

**Totale**: ~14 test aggiuntivi

**Tempo Stimato**: 2-3 ore development + testing

**Beneficio**: Copertura completa Phase 1A+1B (da 50% → 95%)

---

## 📌 CONCLUSIONE

**Risposta alla domanda utente**:
> "abbiamo testato tutte le possibilità?"

**NO** - Manca copertura per:
- ❌ `performSwap()` con plugin specifico
- ❌ `performSwapAuto()` con plugin specifico  
- ❌ Switch plugin dinamico e verifica
- ❌ Beacon resolution dinamica
- ❌ Fallback mechanism

**Soluzione**: Creare `SwapManager.Phase1A-1B.Integration.test.ts` con 14 test aggiuntivi.

---

**Status**: ⚠️ **TEST COVERAGE INCOMPLETA** - Action required prima di production deployment
