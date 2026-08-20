# Sprint 2 - Post Deploy Enhancements

## Overview
Questo documento contiene le specifiche per implementazioni da fare **DOPO** il deploy iniziale del sistema, come enhancement per migliorare robustezza e flessibilità del SwapManager.

---

## Enhancement 1: Safe Swap Wrapper (Opzione 3)

### **Obiettivo**
Implementare una funzione wrapper `performSwapSafe()` che **non reverte mai**, permettendo ai caller di gestire gli errori manualmente e implementare retry logic. Questo risolve anche il problema del tracking degli errori (HIGH-008).

### **Problema Attuale**
```solidity
// Attuale comportamento:
function performSwap(...) returns (uint256) {
    // Se fallisce → REVERT
    // swapErrors[hash]++ viene annullato dal revert
}

// Risultato:
- Non puoi implementare retry logic
- Error counter non persiste
- Contratti chiamanti non possono gestire errori gracefully
```

---

## **Specifiche Implementazione**

### **1. Aggiungere Struct SwapResult**

Localizzazione: `contracts/SwapManager.sol` - dopo le struct esistenti (circa linea 50-60)

```solidity
/**
 * @notice Risultato di uno swap safe (non-reverting)
 * @dev Usato da performSwapSafe per restituire successo/fallimento senza revert
 */
struct SwapResult {
    bool success;              // True se swap riuscito
    uint256 amountReceived;    // Quantità effettivamente ricevuta (0 se fallito)
    string errorMessage;       // Messaggio errore (vuoto se successo)
    uint256 errorCode;         // Codice errore categorizzato (0 se successo)
    uint256 gasUsed;          // Gas consumato (per analytics)
}
```

### **2. Aggiungere Error Codes Enum/Constants**

```solidity
/**
 * @notice Codici errore per categorizzazione
 */
uint256 constant ERROR_NONE = 0;
uint256 constant ERROR_DEADLINE_EXPIRED = 1;
uint256 constant ERROR_SLIPPAGE_EXCEEDED = 2;
uint256 constant ERROR_INSUFFICIENT_BALANCE = 3;
uint256 constant ERROR_INVALID_TOKEN = 4;
uint256 constant ERROR_ROUTER_ERROR = 5;
uint256 constant ERROR_SWAPS_DISABLED = 6;
uint256 constant ERROR_UNAUTHORIZED = 7;
uint256 constant ERROR_UNKNOWN = 999;
```

### **3. Implementare performSwapSafe()**

Localizzazione: Dopo `performSwapAuto()` (circa linea 250)

```solidity
/**
 * @notice Esegue swap SAFE (non reverte mai)
 * @dev Wrapper non-reverting per performSwap - permette error handling da caller
 * @dev Incrementa swapErrors anche in caso di fallimento (risolve HIGH-008)
 * @param spendTokenCode Token da vendere
 * @param receiveTokenCode Token da ricevere
 * @param amountIn Quantità da swappare
 * @param deadline Timestamp massimo per esecuzione
 * @return result Struct con successo/fallimento e dettagli
 */
function performSwapSafe(
    string memory spendTokenCode,
    string memory receiveTokenCode,
    uint256 amountIn,
    uint256 deadline
) 
    public
    nonReentrant
    returns (SwapResult memory result)
{
    uint256 gasStart = gasleft();
    bytes32 pairHash = keccak256(abi.encodePacked(spendTokenCode, receiveTokenCode));
    
    // PRE-VALIDATIONS (senza revert)
    
    // Check: Swaps enabled
    if (!swapsEnabled) {
        swapErrors[pairHash]++;
        emit SwapFailed(spendTokenCode, receiveTokenCode, amountIn, "Swaps are disabled", msg.sender, block.timestamp);
        return SwapResult({
            success: false,
            amountReceived: 0,
            errorMessage: "Swaps are disabled",
            errorCode: ERROR_SWAPS_DISABLED,
            gasUsed: gasStart - gasleft()
        });
    }
    
    // Check: Authorized caller
    if (!authorizedCallers[msg.sender] && msg.sender != owner()) {
        swapErrors[pairHash]++;
        emit SwapFailed(spendTokenCode, receiveTokenCode, amountIn, "Unauthorized caller", msg.sender, block.timestamp);
        return SwapResult({
            success: false,
            amountReceived: 0,
            errorMessage: "Unauthorized caller",
            errorCode: ERROR_UNAUTHORIZED,
            gasUsed: gasStart - gasleft()
        });
    }
    
    // Check: Deadline
    if (block.timestamp > deadline) {
        swapErrors[pairHash]++;
        emit SwapFailed(spendTokenCode, receiveTokenCode, amountIn, "Swap deadline expired", msg.sender, block.timestamp);
        return SwapResult({
            success: false,
            amountReceived: 0,
            errorMessage: "Swap deadline expired",
            errorCode: ERROR_DEADLINE_EXPIRED,
            gasUsed: gasStart - gasleft()
        });
    }
    
    // TRY EXECUTE SWAP
    try this.performSwap(spendTokenCode, receiveTokenCode, amountIn, deadline) returns (uint256 received) {
        // SUCCESS PATH
        return SwapResult({
            success: true,
            amountReceived: received,
            errorMessage: "",
            errorCode: ERROR_NONE,
            gasUsed: gasStart - gasleft()
        });
        
    } catch Error(string memory reason) {
        // ERROR PATH - MA NESSUN REVERT!
        swapErrors[pairHash]++;  // ✅ PERSISTE perché non c'è revert dopo
        
        emit SwapFailed(spendTokenCode, receiveTokenCode, amountIn, reason, msg.sender, block.timestamp);
        
        // Categorizza errore
        uint256 errorCode = _parseErrorCode(reason);
        
        return SwapResult({
            success: false,
            amountReceived: 0,
            errorMessage: reason,
            errorCode: errorCode,
            gasUsed: gasStart - gasleft()
        });
        
    } catch (bytes memory) {
        // CATCH LOW-LEVEL ERRORS
        swapErrors[pairHash]++;
        emit SwapFailed(spendTokenCode, receiveTokenCode, amountIn, "Low-level error", msg.sender, block.timestamp);
        
        return SwapResult({
            success: false,
            amountReceived: 0,
            errorMessage: "Low-level error occurred",
            errorCode: ERROR_UNKNOWN,
            gasUsed: gasStart - gasleft()
        });
    }
}
```

### **4. Implementare Helper _parseErrorCode()**

```solidity
/**
 * @notice Categorizza error message in error code
 * @dev Helper interno per performSwapSafe
 * @param reason Error message da categorizzare
 * @return errorCode Codice numerico dell'errore
 */
function _parseErrorCode(string memory reason) private pure returns (uint256) {
    bytes32 reasonHash = keccak256(bytes(reason));
    
    if (reasonHash == keccak256("Swap deadline expired")) return ERROR_DEADLINE_EXPIRED;
    if (reasonHash == keccak256("Slippage exceeds maximum allowed")) return ERROR_SLIPPAGE_EXCEEDED;
    if (reasonHash == keccak256("Insufficient balance")) return ERROR_INSUFFICIENT_BALANCE;
    if (reasonHash == keccak256("Token not registered")) return ERROR_INVALID_TOKEN;
    if (reasonHash == keccak256("Token not active")) return ERROR_INVALID_TOKEN;
    if (reasonHash == keccak256("Swaps are disabled")) return ERROR_SWAPS_DISABLED;
    if (reasonHash == keccak256("Unauthorized caller")) return ERROR_UNAUTHORIZED;
    
    // Check for router errors (substring match)
    if (_contains(reason, "router") || _contains(reason, "Router")) return ERROR_ROUTER_ERROR;
    if (_contains(reason, "swap") || _contains(reason, "Swap")) return ERROR_ROUTER_ERROR;
    
    return ERROR_UNKNOWN;
}

/**
 * @notice Helper per substring matching
 */
function _contains(string memory source, string memory search) private pure returns (bool) {
    bytes memory sourceBytes = bytes(source);
    bytes memory searchBytes = bytes(search);
    
    if (searchBytes.length > sourceBytes.length) return false;
    if (searchBytes.length == 0) return false;
    
    for (uint i = 0; i <= sourceBytes.length - searchBytes.length; i++) {
        bool found = true;
        for (uint j = 0; j < searchBytes.length; j++) {
            if (sourceBytes[i + j] != searchBytes[j]) {
                found = false;
                break;
            }
        }
        if (found) return true;
    }
    return false;
}
```

### **5. Aggiungere performSwapSafeAuto() per Convenience**

```solidity
/**
 * @notice Versione auto-deadline di performSwapSafe
 * @dev Usa defaultDeadlineWindow per calcolare deadline automaticamente
 */
function performSwapSafeAuto(
    string memory spendTokenCode,
    string memory receiveTokenCode,
    uint256 amountIn
) 
    public
    returns (SwapResult memory)
{
    uint256 deadline = block.timestamp + defaultDeadlineWindow;
    return performSwapSafe(spendTokenCode, receiveTokenCode, amountIn, deadline);
}
```

---

## **Testing Specifiche**

### **Test File:** `test/unit/SwapManager.safe.test.ts`

### **Test Cases da Implementare:**

```typescript
describe("🛡️ performSwapSafe() - Safe Wrapper Tests", function () {
  
  // SAFE-001: Success case returns correct struct
  it("SAFE-001: should return success struct on successful swap", async function () {
    const result = await swapManager.performSwapSafe("USDC", "WBTC", swapAmount, deadline);
    
    expect(result.success).to.be.true;
    expect(result.amountReceived).to.be.gt(0);
    expect(result.errorMessage).to.equal("");
    expect(result.errorCode).to.equal(0);
  });
  
  // SAFE-002: Failure case returns error struct (NO REVERT)
  it("SAFE-002: should return error struct on failure WITHOUT reverting", async function () {
    await mockRouter.setShouldFail(true);
    
    // NO expect().to.be.reverted - deve NON revertare
    const result = await swapManager.performSwapSafe("USDC", "WBTC", swapAmount, deadline);
    
    expect(result.success).to.be.false;
    expect(result.amountReceived).to.equal(0);
    expect(result.errorMessage).to.not.equal("");
    expect(result.errorCode).to.be.gt(0);
  });
  
  // SAFE-003: Error counter incremented on failure (HIGH-008 FIX)
  it("SAFE-003: should increment error counter on failed swap", async function () {
    const statsBefore = await swapManager.getSwapStats("USDC", "WBTC");
    
    await mockRouter.setShouldFail(true);
    const result = await swapManager.performSwapSafe("USDC", "WBTC", swapAmount, deadline);
    
    const statsAfter = await swapManager.getSwapStats("USDC", "WBTC");
    expect(statsAfter[1] - statsBefore[1]).to.equal(1n); // errorCount increased
  });
  
  // SAFE-004: Deadline expired returns correct error code
  it("SAFE-004: should return ERROR_DEADLINE_EXPIRED when deadline passed", async function () {
    const expiredDeadline = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    
    const result = await swapManager.performSwapSafe("USDC", "WBTC", swapAmount, expiredDeadline);
    
    expect(result.success).to.be.false;
    expect(result.errorCode).to.equal(1); // ERROR_DEADLINE_EXPIRED
  });
  
  // SAFE-005: Slippage exceeded returns correct error code
  it("SAFE-005: should return ERROR_SLIPPAGE_EXCEEDED on slippage", async function () {
    await swapManager.setMaxSlippage(0); // No slippage allowed
    await mockRouter.setExpectedOutput(mockUSDC.target, mockWBTC.target, expectedOutput - 1n);
    
    const result = await swapManager.performSwapSafe("USDC", "WBTC", swapAmount, deadline);
    
    expect(result.success).to.be.false;
    expect(result.errorCode).to.equal(2); // ERROR_SLIPPAGE_EXCEEDED
  });
  
  // SAFE-006: Retry logic example
  it("SAFE-006: should allow retry logic implementation", async function () {
    // First attempt fails
    await mockRouter.setShouldFail(true);
    let result = await swapManager.performSwapSafe("USDC", "WBTC", swapAmount, deadline);
    expect(result.success).to.be.false;
    
    // Fix issue and retry
    await mockRouter.setShouldFail(false);
    result = await swapManager.performSwapSafe("USDC", "WBTC", swapAmount, deadline);
    expect(result.success).to.be.true;
  });
  
  // SAFE-007: Gas tracking
  it("SAFE-007: should track gas used in result", async function () {
    const result = await swapManager.performSwapSafe("USDC", "WBTC", swapAmount, deadline);
    expect(result.gasUsed).to.be.gt(0);
  });
  
  // SAFE-008: Auto version works
  it("SAFE-008: should work with performSwapSafeAuto", async function () {
    const result = await swapManager.performSwapSafeAuto("USDC", "WBTC", swapAmount);
    expect(result.success).to.be.true;
  });
  
  // SAFE-009: SwapFailed event emitted
  it("SAFE-009: should emit SwapFailed event on error", async function () {
    await mockRouter.setShouldFail(true);
    
    await expect(swapManager.performSwapSafe("USDC", "WBTC", swapAmount, deadline))
      .to.emit(swapManager, "SwapFailed")
      .withArgs("USDC", "WBTC", swapAmount, anyValue, signerAddress, anyValue);
  });
  
  // SAFE-010: Multiple failures tracked correctly
  it("SAFE-010: should track multiple failures correctly", async function () {
    await mockRouter.setShouldFail(true);
    
    const statsBefore = await swapManager.getSwapStats("USDC", "WBTC");
    
    // 3 failed attempts
    await swapManager.performSwapSafe("USDC", "WBTC", swapAmount, deadline);
    await swapManager.performSwapSafe("USDC", "WBTC", swapAmount, deadline);
    await swapManager.performSwapSafe("USDC", "WBTC", swapAmount, deadline);
    
    const statsAfter = await swapManager.getSwapStats("USDC", "WBTC");
    expect(statsAfter[1] - statsBefore[1]).to.equal(3n);
  });
});
```

---

## **Frontend/Integration Examples**

### **Esempio 1: Simple Swap con Error Handling**

```typescript
// Frontend TypeScript
async function executeSwapSafe(tokenIn: string, tokenOut: string, amount: BigNumber) {
  const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes
  
  const result = await swapManager.performSwapSafe(tokenIn, tokenOut, amount, deadline);
  
  if (result.success) {
    console.log(`✅ Swap successful! Received: ${result.amountReceived}`);
    return result.amountReceived;
  } else {
    console.error(`❌ Swap failed: ${result.errorMessage}`);
    
    // Handle specific errors
    switch (result.errorCode) {
      case 1: // Deadline expired
        throw new Error("Transaction took too long");
      case 2: // Slippage exceeded
        throw new Error("Price moved too much. Try increasing slippage tolerance");
      case 3: // Insufficient balance
        throw new Error("Not enough tokens in wallet");
      default:
        throw new Error(result.errorMessage);
    }
  }
}
```

### **Esempio 2: Retry Logic con Exponential Backoff**

```typescript
async function executeSwapWithRetry(
  tokenIn: string, 
  tokenOut: string, 
  amount: BigNumber,
  maxRetries: number = 3
): Promise<BigNumber> {
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const deadline = Math.floor(Date.now() / 1000) + 1200;
    const result = await swapManager.performSwapSafe(tokenIn, tokenOut, amount, deadline);
    
    if (result.success) {
      console.log(`✅ Swap succeeded on attempt ${attempt}`);
      return result.amountReceived;
    }
    
    // Decide if retry is appropriate
    if (result.errorCode === 2) { // Slippage
      console.log(`⚠️ Attempt ${attempt} failed due to slippage, retrying...`);
      
      // Increase slippage tolerance
      const currentSlippage = await swapManager.maxSlippageBps();
      await swapManager.setMaxSlippage(currentSlippage + 100); // +1%
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      continue;
    }
    
    // Non-retryable error
    throw new Error(`Swap failed: ${result.errorMessage} (code: ${result.errorCode})`);
  }
  
  throw new Error(`Swap failed after ${maxRetries} attempts`);
}
```

### **Esempio 3: Batch Swaps con Error Aggregation**

```typescript
async function executeBatchSwaps(swaps: Array<{tokenIn: string, tokenOut: string, amount: BigNumber}>) {
  const results = await Promise.all(
    swaps.map(swap => swapManager.performSwapSafeAuto(swap.tokenIn, swap.tokenOut, swap.amount))
  );
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ ${successful.length} swaps successful`);
  console.log(`❌ ${failed.length} swaps failed`);
  
  // Aggregate error statistics
  const errorCounts = failed.reduce((acc, r) => {
    acc[r.errorCode] = (acc[r.errorCode] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  
  console.log("Error breakdown:", errorCounts);
  
  return {
    successful: successful.map(r => r.amountReceived),
    failed: failed.map(r => ({ code: r.errorCode, message: r.errorMessage }))
  };
}
```

---

## **Benefits Summary**

### **✅ Risolve HIGH-008**
- Error counter incrementato correttamente (nessun revert che annulla)
- Test HIGH-008 può essere ri-abilitato e passerà

### **✅ Migliora UX**
- Caller può gestire errori gracefully
- No transaction revert → risparmio gas su errori recuperabili
- Retry logic implementabile

### **✅ Better Analytics**
- Error codes categorizzati
- Gas tracking per optimization
- Tutti gli errori contati (anche quelli gestiti)

### **✅ Backward Compatible**
- `performSwap()` originale intatto
- Adoption graduale possibile
- No breaking changes per contratti esistenti

---

## **Deployment Plan**

### **Fase 1: Implement & Test (Post-Deploy)**
1. Implementare codice in SwapManager.sol
2. Scrivere test completi in SwapManager.safe.test.ts
3. Test coverage: target 100% per performSwapSafe
4. Gas profiling: verificare overhead accettabile

### **Fase 2: Audit (Se richiesto)**
1. Security review del nuovo codice
2. Verificare no revert in performSwapSafe
3. Test error handling edge cases

### **Fase 3: Deploy Upgrade**
1. Deploy nuovo SwapManager (con Beacon pattern)
2. Update implementation nel Beacon
3. Verify su Arbiscan

### **Fase 4: Frontend Migration**
1. Aggiornare SDK con performSwapSafe
2. Documentazione per integratori
3. Example implementations per retry logic

### **Fase 5: Monitoring**
1. Traccia adoption di performSwapSafe vs performSwap
2. Monitor error codes distribution
3. Optimize based on real-world data

---

## **Gas Estimates**

| Operation | Standard performSwap | performSwapSafe | Delta |
|-----------|---------------------|-----------------|-------|
| Success swap | ~180,000 gas | ~192,000 gas | +12k (+6.7%) |
| Failed swap (revert) | ~85,000 gas (wasted) | ~98,000 gas (tracked) | +13k (+15.3%) |
| Failed swap (handled) | N/A | ~98,000 gas | - |

**Note:** L'overhead è accettabile considerando i benefici in error handling e analytics.

---

## **Priority: MEDIUM-HIGH**
Implementare dopo deploy iniziale ma prima di adoption massiva in produzione.

**Estimated Effort:** 4-6 ore (implementation + testing)

**Dependencies:** 
- Opzione 1 (SwapFailed events) già implementata
- Nessuna dipendenza esterna

**Blockers:** Nessuno

---

## **References**
- Issue: HIGH-008 Error Counter Tracking
- Related: Opzione 1 (Events) già implementata in Sprint 1
- Pattern: Try-Catch Safe Wrapper (Solidity best practice)
