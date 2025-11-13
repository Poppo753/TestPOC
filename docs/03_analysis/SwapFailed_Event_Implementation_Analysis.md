# 📊 Analisi Implementazione SwapFailed Event

**Documento:** Analisi Tecnica e Piano Implementativo  
**Data Creazione:** 27 Ottobre 2025  
**Tipo:** Planning & Analysis Document  
**Priorità:** MEDIUM (Test Coverage Improvement)  
**Status:** READY FOR IMPLEMENTATION  

---

## 📋 Executive Summary

### **Obiettivo Primario**
Implementare un sistema di tracking errori swap resiliente ai revert tramite eventi blockchain, risolvendo il test HIGH-008 attualmente skippato e migliorando l'observability del contratto SwapManager.

### **Problema Attuale**
Il test `SM-SWAP-HIGH-008` è attualmente disabilitato (`.skip`) perché il contatore `swapErrors[pairHash]++` viene annullato quando la transazione reverte. Gli eventi Solidity invece **persistono nei transaction logs anche con revert**, permettendo tracking off-chain affidabile.

### **Soluzione Proposta**
Aggiungere evento `SwapFailed` con 6 parametri (3 indexed) ed emetterlo in tutti i catch blocks PRIMA del revert. Modificare il test per verificare l'emissione dell'evento invece del contatore on-chain.

### **Impatto Atteso**
- ✅ Test HIGH-008 passa (14/14 invece di 13/14)
- ✅ Zero breaking changes (backward compatible)
- ✅ Observability migliorata per monitoring/analytics
- ✅ Foundation per future integrazioni (The Graph, frontend)
- ⚠️ Gas cost aggiuntivo minimo (~375 gas per swap fallito)

---

## 🔍 Analisi Tecnica Approfondita

### **1. Root Cause Analysis**

#### **Problema Esistente:**
```solidity
function _handleSwapError(...) internal {
    bytes32 pairHash = keccak256(abi.encodePacked(spendTokenCode, receiveTokenCode));
    swapErrors[pairHash]++;  // ❌ ANNULLATO DA REVERT
    // Swap failed event - logged internally
}

} catch Error(string memory reason) {
    _handleSwapError(...);  // Storage write tentato
    revert(reason);          // Storage rollback!
}
```

**Flow attuale problematico:**
1. Swap execution fallisce (es. slippage, insufficient liquidity)
2. Catch block invoca `_handleSwapError()`
3. Counter `swapErrors[pairHash]++` viene incrementato IN MEMORY
4. `revert(reason)` viene eseguito
5. **TUTTO LO STORAGE VIENE ROLLBACK** (counter torna a valore precedente)
6. Solo i LOGS (eventi) persistono nella transaction receipt

#### **Perché gli Eventi Persistono:**
Gli eventi Solidity sono memorizzati nei **transaction logs** (parte della receipt), NON nello storage del contratto. Durante un revert:
- ✅ **LOGS persistono** → accessibili via `eth_getLogs`, The Graph, frontend
- ❌ **STORAGE viene rollback** → mapping `swapErrors` ritorna a valore precedente
- ❌ **BALANCE changes rollback** → token transfers annullati
- ❌ **STATE variables rollback** → nessuna modifica permanente

**Riferimento EVM:**
- Opcode `LOG0-LOG4` scrive in receipt logs (immutabili)
- Opcode `REVERT` rollback solo SSTORE/BALANCE, non logs

---

### **2. Soluzione Tecnica: SwapFailed Event**

#### **Design dell'Evento:**

```solidity
/// @notice Emitted when a swap fails with error details
/// @dev Questo evento persiste anche se la transazione reverte
/// @param tokenIn Token code being sold (indexed for filtering)
/// @param tokenOut Token code being bought (indexed for filtering)
/// @param amountIn Amount attempted to swap
/// @param reason Error message from failed swap
/// @param executor Address that initiated the swap (indexed)
/// @param timestamp Block timestamp when error occurred
event SwapFailed(
    string indexed tokenIn,
    string indexed tokenOut,
    uint256 amountIn,
    string reason,
    address indexed executor,
    uint256 timestamp
);
```

#### **Parametri Indexed vs Non-Indexed:**

| Parametro | Tipo | Indexed? | Rationale |
|-----------|------|----------|-----------|
| `tokenIn` | `string` | ✅ YES | Filtering per token specifico (es. "USDC errors only") |
| `tokenOut` | `string` | ✅ YES | Filtering per destination token |
| `amountIn` | `uint256` | ❌ NO | Amount può variare, non utile per filtering |
| `reason` | `string` | ❌ NO | String dinamico, troppo costoso per indexing |
| `executor` | `address` | ✅ YES | Filtering per wallet (es. "user X errors") |
| `timestamp` | `uint256` | ❌ NO | Per analytics, non per filtering (range queries via blocknumber) |

**Limite EVM:** Max 3 indexed parameters per evento (4 topics totali, topic[0] è event signature)

#### **Gas Cost Analysis:**

**Baseline (current):**
```solidity
swapErrors[pairHash]++;  // ~5000 gas (SSTORE non-zero → non-zero)
// Annullato da revert quindi gas sprecato
```

**Con SwapFailed Event:**
```solidity
emit SwapFailed(...);  // ~375 gas per parametro × 6 = ~2250 gas
// + 375 gas per topic indexed × 3 = ~1125 gas
// TOTALE: ~3375 gas
```

**⚠️ Ma attenzione:** Con revert, il gas viene consumato comunque (transaction fail cost). L'evento aggiunge ~3375 gas ma fornisce valore (tracking permanente).

---

### **3. Pattern Implementativo nei Catch Blocks**

#### **Pattern Standard (da applicare a 3 funzioni):**

```solidity
} catch Error(string memory reason) {
    // 🔴 STEP 1: Emit event FIRST (persists through revert)
    emit SwapFailed(
        spendTokenCode,      // or "WETH" depending on function
        receiveTokenCode,    // or "WETH" depending on function
        amountIn,
        reason,
        msg.sender,
        block.timestamp
    );
    
    // 🟡 STEP 2: Call error handler (for backwards compatibility)
    _handleSwapError(spendTokenCode, receiveTokenCode, amountIn, reason);
    
    // 🔴 STEP 3: Revert (rollback storage, keep logs)
    revert(reason);
}
```

**⚠️ ORDINE CRITICO:** Se `revert()` viene prima di `emit`, l'evento NON viene loggato.

#### **Funzioni da Modificare:**

| Funzione | Linea Appross. | TokenIn Value | TokenOut Value |
|----------|---------------|---------------|----------------|
| `_swapToWETH()` | ~342-345 | `spendTokenCode` | `"WETH"` (literal) |
| `_swapFromWETH()` | ~394-397 | `"WETH"` (literal) | `receiveTokenCode` |
| `_swapTokenToToken()` | ~447-450 | `spendTokenCode` | `receiveTokenCode` |

**Note Implementative:**
- Usa string literals `"WETH"` dove applicabile (gas saving vs variable)
- `msg.sender` rappresenta il chiamante (solitamente LiquidityManager)
- `block.timestamp` fornisce contesto temporale per analytics

---

### **4. Test Implementation Strategy**

#### **Test HIGH-008 - Refactoring:**

**BEFORE (Current - Skipped):**
```typescript
it.skip("SM-SWAP-HIGH-008: should increment error counter on failed swap", async function () {
  // Configure router to fail
  await mockRouter.setShouldFail(true);
  
  // Expect revert (transaction fails)
  await expect(swapManager.performSwapAuto("USDC", "WBTC", amount))
    .to.be.reverted;
  
  // ❌ FAILS: Counter non persiste con revert
  const stats = await swapManager.getSwapStats("USDC", "WBTC");
  expect(stats[1]).to.equal(1n);  // errorCount should be 1
});
```

**AFTER (New - Event-Based):**
```typescript
it("SM-SWAP-HIGH-008: should emit SwapFailed event on failed swap", async function () {
  const swapAmount = ethers.parseUnits("1000", 6);
  
  // Get caller address for event verification
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  
  // Configure mock router to fail with specific error
  await mockRouter.setShouldFail(true);
  
  // Act & Assert: Verify BOTH revert AND event emission
  await expect(
    swapManager.performSwapAuto("USDC", "WBTC", swapAmount)
  )
    .to.be.revertedWith("MockSimpleSwap: Swap failed")
    .and.to.emit(swapManager, "SwapFailed")
    .withArgs(
      "USDC",                           // tokenIn
      "WBTC",                           // tokenOut
      swapAmount,                       // amountIn
      "MockSimpleSwap: Swap failed",   // reason
      signerAddress,                    // executor
      anyValue                          // timestamp (can't predict exactly)
    );
});
```

#### **Test Assertions Breakdown:**

1. **`.to.be.revertedWith("MockSimpleSwap: Swap failed")`**
   - Verifica che transazione reverte con messaggio corretto
   - Conferma comportamento esistente non cambia

2. **`.and.to.emit(swapManager, "SwapFailed")`**
   - Verifica che evento viene emesso NONOSTANTE il revert
   - Questo è il cuore del test - dimostra persistenza eventi

3. **`.withArgs(...)`**
   - Verifica parametri evento sono corretti
   - `anyValue` per timestamp (dipende da `block.timestamp` non prevedibile)

#### **Note su anyValue Import:**

Il test potrebbe richiedere:
```typescript
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
```

**Alternativa (se anyValue non disponibile):**
```typescript
// Cattura timestamp dal block
const latestBlock = await ethers.provider.getBlock('latest');
const expectedTimestamp = latestBlock.timestamp;

// Usa timestamp approssimato nel test
// (con tolleranza ±2 secondi per mining)
```

---

### **5. Backwards Compatibility Analysis**

#### **Impatti sul Codice Esistente:**

✅ **ZERO BREAKING CHANGES:**
- `_handleSwapError()` ancora chiamato (counter incrementato in memoria anche se rollback)
- Tutti i revert messages mantenuti identici
- Storage mappings `swapErrors` non modificati
- Interfacce pubbliche invariate

✅ **ADDITIVE ONLY:**
- Nuovo evento aggiunto
- Catch blocks arricchiti con emit (non modificati logicamente)
- Test HIGH-008 passa da `.skip` a passing

#### **Modifiche Non-Breaking:**

| Componente | Change Type | Breaking? |
|------------|-------------|-----------|
| Event definition | ADD | ❌ No |
| Catch blocks emit | ENHANCE | ❌ No |
| _handleSwapError() | NO CHANGE | ❌ No |
| Storage variables | NO CHANGE | ❌ No |
| Public functions | NO CHANGE | ❌ No |
| Test HIGH-008 | MODIFY | ❌ No (era skippato) |

#### **Upgrade Path per Utenti Esistenti:**

**Frontend/Analytics Services:**
- Possono iniziare ad ascoltare `SwapFailed` event immediatamente
- Non richiesto (evento supplementare, non sostitutivo)
- The Graph subgraph può indexare nuovo evento senza migration

**Smart Contracts Dipendenti:**
- Nessuna modifica richiesta (interfacce invariate)
- Possono aggiungere listener per `SwapFailed` opzionalmente

---

### **6. Future Extensibility**

#### **Use Cases Abilitati:**

1. **Off-Chain Analytics Dashboard:**
   ```typescript
   // Query SwapFailed events per token pair
   const failedSwaps = await contract.queryFilter(
     contract.filters.SwapFailed("USDC", "WBTC")
   );
   
   // Calculate error rate
   const successEvents = await contract.queryFilter(
     contract.filters.SwapExecuted("USDC", "WBTC")
   );
   
   const errorRate = failedSwaps.length / (successEvents.length + failedSwaps.length);
   ```

2. **The Graph Integration:**
   ```graphql
   type SwapFailed @entity {
     id: ID!
     tokenIn: String!
     tokenOut: String!
     amountIn: BigInt!
     reason: String!
     executor: Bytes!
     timestamp: BigInt!
     transactionHash: Bytes!
   }
   ```

3. **Alert System:**
   ```javascript
   contract.on("SwapFailed", (tokenIn, tokenOut, amount, reason, executor, timestamp) => {
     if (reason.includes("slippage")) {
       alertOps(`High slippage on ${tokenIn}→${tokenOut}: ${reason}`);
     }
   });
   ```

4. **Forensic Analysis:**
   - Analyze patterns in failed swaps (time of day, token pairs, amounts)
   - Identify malicious MEV attacks vs legitimate failures
   - Optimize slippage parameters based on historical data

#### **Potential Enhancements (Future):**

- **v2.0:** Add `errorCode` parameter (uint8) for categorization
- **v2.1:** Include `slippageAttempted` to diagnose slippage-related failures
- **v3.0:** Safe wrapper pattern (Opzione 3 in Sprint_Due_Post_Deploy.md)

---

## 📊 Implementation Plan

### **8-Step Implementation Checklist**

| Step | Task | File | Lines | Effort | Risk |
|------|------|------|-------|--------|------|
| 1 | Add `SwapFailed` event | SwapManager.sol | ~95 | 5 min | LOW |
| 2 | Update `_swapToWETH()` catch | SwapManager.sol | ~342-345 | 3 min | LOW |
| 3 | Update `_swapFromWETH()` catch | SwapManager.sol | ~394-397 | 3 min | LOW |
| 4 | Update `_swapTokenToToken()` catch | SwapManager.sol | ~447-450 | 3 min | LOW |
| 5 | Modify HIGH-008 test | SwapManager.test.ts | ~846-869 | 10 min | MEDIUM |
| 6 | Compile contracts | CLI | N/A | 2 min | LOW |
| 7 | Run HIGH-008 test | CLI | N/A | 2 min | LOW |
| 8 | Run full HIGH suite | CLI | N/A | 3 min | LOW |

**Total Estimated Effort:** ~30 minuti  
**Overall Risk:** LOW (additive changes only)

---

## 🎯 Success Criteria

### **Definizione di "Done":**

1. ✅ **Compilation:**
   ```bash
   npx hardhat compile
   # Expected: Compiled 1 Solidity file successfully
   ```

2. ✅ **Test HIGH-008 Passing:**
   ```bash
   npx hardhat test --grep "SM-SWAP-HIGH-008"
   # Expected: 1 passing (was: 1 pending)
   ```

3. ✅ **Full HIGH Suite:**
   ```bash
   npx hardhat test --grep "SM-SWAP-HIGH"
   # Expected: 14 passing (was: 13 passing, 1 pending)
   ```

4. ✅ **No Regressions:**
   - Tutti i test CRITICAL ancora passano (11/11)
   - Nessun test precedentemente passing ora fallisce

5. ✅ **Code Quality:**
   - Nessun warning di compilazione (eccetto quelli pre-esistenti)
   - Evento documentato con NatSpec completo
   - Catch blocks consistenti tra le 3 funzioni

---

## ⚠️ Risk Assessment

### **Rischi Identificati:**

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Ordine emit/revert errato** | MEDIUM | HIGH | Test fallirà immediatamente se emit dopo revert |
| **Parametri evento sbagliati** | LOW | MEDIUM | Test withArgs() verificherà parametri corretti |
| **Gas cost troppo alto** | LOW | LOW | ~3375 gas è trascurabile vs costo swap (~100k gas) |
| **Import anyValue mancante** | LOW | LOW | Fallback: usa timestamp approssimato |
| **Test intermittente** | VERY LOW | LOW | Timestamp con anyValue risolve race conditions |

### **Fallback Strategy:**

Se implementazione fallisce:
1. **Revert commit:** `git reset --hard HEAD~1`
2. **Test ancora skip:** Nessun impatto su prod (test era già disabilitato)
3. **Analizza logs:** Usa `--verbose` per debug
4. **Iterazione:** Fixare issue specifico e ricompilare

---

## 🔬 Testing Strategy

### **Test Execution Plan:**

#### **Phase 1: Unit Test (HIGH-008)**
```bash
# Step 1: Compile
npx hardhat compile

# Step 2: Run specific test
npx hardhat test test/unit/SwapManager.test.ts --grep "SM-SWAP-HIGH-008"

# Expected Output:
# ✔ SM-SWAP-HIGH-008: should emit SwapFailed event on failed swap
# 1 passing (1s)
```

#### **Phase 2: Integration Test (Full HIGH Suite)**
```bash
# Run all HIGH priority tests
npx hardhat test test/unit/SwapManager.test.ts --grep "SM-SWAP-HIGH"

# Expected Output:
# 14 passing (2s)
# 0 pending
```

#### **Phase 3: Regression Test (All Tests)**
```bash
# Optional: Run entire test suite
npx hardhat test test/unit/SwapManager.test.ts

# Expected: All existing tests still pass
```

### **Manual Verification (Optional):**

```bash
# Verbose mode to see event logs
npx hardhat test test/unit/SwapManager.test.ts --grep "HIGH-008" --verbose

# Should see in output:
# SwapFailed(
#   tokenIn: "USDC",
#   tokenOut: "WBTC",
#   amountIn: 1000000000,  // 1000 USDC (6 decimals)
#   reason: "MockSimpleSwap: Swap failed",
#   executor: 0x...,
#   timestamp: 1729123456
# )
```

---

## 📚 Reference Documentation

### **Related Documents:**

1. **PROMPT_SwapFailed_Event_Implementation.md**
   - Source document con specifiche dettagliate
   - Contiene codice esempi copy-paste ready

2. **docs/Sprint_Due_Post_Deploy.md**
   - Opzione 3: Safe Wrapper pattern (future enhancement)
   - Alternative approaches analysis

3. **TEST_IMPLEMENTATION_CHECKLIST.md**
   - Overall test strategy
   - Coverage requirements

4. **MISSING_IMPLEMENTATIONS_FROM_TESTS.md**
   - Section 6.3: HIGH-008 documented as architectural limitation
   - Will be updated to ✅ RESOLVED after implementation

### **External References:**

- **Solidity Docs - Events:** https://docs.soliditylang.org/en/latest/contracts.html#events
- **Hardhat Chai Matchers:** https://hardhat.org/hardhat-chai-matchers/docs/reference
- **EVM Opcodes - LOG:** https://www.evm.codes/#a0
- **Ethereum Yellow Paper - Section 4.3:** Transaction receipt logs

---

## 💡 Key Insights

### **1. Eventi vs Storage per Error Tracking:**

**Problema Fondamentale:**
```
Storage writes (SSTORE) → Rollback con revert ❌
Event logs (LOG0-4) → Persistono sempre ✅
```

**Implicazione:**
Per tracking che deve sopravvivere ai revert, gli eventi sono l'UNICA soluzione on-chain affidabile.

### **2. Pattern Try-Catch in Solidity:**

```solidity
try externalCall() returns (uint256 result) {
    // ✅ Success path - storage changes persist
    counter++;
    emit Success(result);
} catch Error(string memory reason) {
    // ⚠️ Error path - storage rollback imminent
    emit Error(reason);    // ✅ Persists
    counter++;             // ❌ Rollback by revert
    revert(reason);        // Rollback tutto EXCEPT logs
}
```

**Golden Rule:** Emit events BEFORE revert for persistent tracking.

### **3. Gas Economics:**

- **SwapFailed event:** ~3375 gas
- **Typical swap transaction:** ~100,000-200,000 gas
- **Overhead percentuale:** ~1.7-3.4%
- **Value proposition:** Observability permanente vs <2% gas overhead

**Conclusione:** Trade-off altamente favorevole.

### **4. Indexed Parameters Trade-off:**

| Aspect | Indexed | Non-Indexed |
|--------|---------|-------------|
| **Filterability** | ✅ Queryable | ❌ Must scan all |
| **Gas Cost** | ~375 gas/param | ~68 gas/param |
| **Storage** | In topics (32 bytes) | In data payload |
| **Limit** | Max 3 per event | Unlimited |

**Design Decision:** Index solo parametri critici per filtering (tokenIn, tokenOut, executor).

---

## 🚀 Post-Implementation Actions

### **Immediate (After Tests Pass):**

1. **Update Documentation:**
   - Mark HIGH-008 as ✅ RESOLVED in MISSING_IMPLEMENTATIONS_FROM_TESTS.md
   - Add SwapFailed event to API_Reference.md

2. **Git Commit:**
   ```bash
   git add contracts/SwapManager.sol test/unit/SwapManager.test.ts
   git commit -m "feat: Add SwapFailed event for error tracking (HIGH-008)
   
   - Add SwapFailed event with 6 parameters (3 indexed)
   - Update catch blocks in 3 swap functions to emit event
   - Modify HIGH-008 test to verify event emission
   - Tests: 14/14 HIGH passing (was 13/14 with 1 skip)
   
   Events persist through revert, enabling off-chain analytics.
   Gas overhead: ~3375 gas per failed swap (~2% of typical swap cost)."
   ```

3. **Branch Strategy:**
   ```bash
   # Current branch: dev-25-operative
   # Merge to main when stable
   git checkout main
   git merge dev-25-operative
   ```

### **Short-Term (Next Sprint):**

1. **Frontend Integration:**
   - Add event listener for `SwapFailed` in frontend
   - Display error history to users
   - Show error rate statistics per token pair

2. **Monitoring Setup:**
   - Configure alerts for high error rates (>10% of swaps)
   - Track most common error reasons
   - Monitor by token pair and time of day

3. **Analytics Dashboard:**
   - Query historical `SwapFailed` events
   - Visualize error patterns
   - Correlate with market volatility

### **Long-Term (Future Versions):**

1. **The Graph Integration:**
   - Create subgraph entity for `SwapFailed`
   - Enable GraphQL queries for error analytics
   - Build comprehensive swap history API

2. **Safe Wrapper Pattern (Opzione 3):**
   - Implement `tryPerformSwap()` function
   - Return (bool success, uint256 amountOut) instead of revert
   - Allow callers to handle errors gracefully

3. **Enhanced Error Categorization:**
   - Add `errorCode` enum parameter
   - Categories: SLIPPAGE, INSUFFICIENT_LIQUIDITY, DEADLINE, ORACLE, etc.
   - Enable programmatic error handling

---

## 📊 Metrics & KPIs

### **Success Metrics:**

| Metric | Current | Target | Post-Implementation |
|--------|---------|--------|---------------------|
| **HIGH Tests Passing** | 13/14 (92.9%) | 14/14 (100%) | ✅ 14/14 (100%) |
| **HIGH Tests Pending** | 1 | 0 | ✅ 0 |
| **Test Coverage** | Incomplete | Complete | ✅ Complete |
| **Error Observability** | ❌ None | ✅ Full | ✅ Event-based |
| **Gas Overhead** | N/A | <5% | ✅ ~2% |

### **Long-Term KPIs:**

- **Error Rate by Token Pair:** Track over time, target <5%
- **Most Common Error Reasons:** Identify patterns for fixes
- **Error Recovery Time:** Monitor how quickly errors resolve
- **MEV Attack Detection:** Identify suspicious error patterns

---

## 🎓 Lessons Learned (Pre-Implementation)

### **Design Insights:**

1. **Eventi sono First-Class Citizens per Observability:**
   - Storage è per stato contrattuale
   - Eventi sono per audit trail e analytics
   - Per tracking che deve sopravvivere ai revert, eventi sono OBBLIGATORI

2. **Test-Driven Approach Benefici:**
   - Test HIGH-008 già scritto (anche se skippato)
   - Specifica comportamento desiderato chiara
   - Implementation è solo matter of making test pass

3. **Backwards Compatibility è Critical:**
   - Mantenere `_handleSwapError()` anche se inefficace
   - Permette future migration senza breaking changes
   - Gradual enhancement path

### **Architectural Decisions:**

1. **Perché non rimuovere `_handleSwapError()`?**
   - Future upgrade potrebbe usare pattern diverso (safe wrapper)
   - Mantenere interface stabile per dependent contracts
   - Code archaeology: mostra evoluzione del design

2. **Perché 3 indexed parameters?**
   - Balance tra filterability e gas cost
   - `reason` string è troppo variabile per indexing
   - `timestamp` è meglio filtrato via block range

3. **Perché non usare error codes enum?**
   - Simplicità first (eventi string-based più leggibili)
   - Errori vengono da external contracts (SimpleSwap)
   - Future enhancement può aggiungere `errorCode` parameter

---

## ✅ Pre-Implementation Checklist

Prima di iniziare implementazione, verificare:

- [x] Analisi completata e documentata
- [x] TODO list creata (8 steps)
- [x] Test strategy definita
- [x] Success criteria chiari
- [x] Risk mitigation plan in place
- [x] Backup strategy definita (git commit)
- [x] Estimated effort reasonabile (~30 min)
- [x] No dependencies blocking
- [x] Environment ready (hardhat, node, etc.)
- [x] Documentation structure prepared

**✅ READY TO PROCEED WITH IMPLEMENTATION**

---

## 📞 Support & Questions

Per domande durante implementazione:

1. **Compilazione fallisce?**
   - Verifica syntax evento (parentesi, virgole, semicolon)
   - Check positioning (dopo `TightDeadlineWarning`)

2. **Test fallisce con "event not emitted"?**
   - Verifica ordine: emit DEVE essere prima di revert
   - Check parametri in withArgs() matchano emit

3. **Gas troppo alto?**
   - Normale per eventi con 6 parametri
   - ~3375 gas è accettabile (<2% overhead)

4. **Import anyValue fallisce?**
   - Fallback: usa `latestBlock.timestamp` nel test
   - O omit timestamp check (verifica solo primi 5 parametri)

**Contact:** Riferimento a questo documento per rationale decisioni.

---

**DOCUMENTO PRONTO PER IMPLEMENTATION PHASE** 🚀

*Generato il 27 Ottobre 2025*  
*Basato su: PROMPT_SwapFailed_Event_Implementation.md*  
*Target: SwapManager v1.2 - Error Tracking Enhancement*
