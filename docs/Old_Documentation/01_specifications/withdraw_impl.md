Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/interfaces/IProxyGeneral.sol#110-110), lines 110 to 140

Searched text for `function withdrawToken|function depositToken` (`**/contracts/ProxyGeneral.sol`), no results

Searched text for `withdrawToken` (`**/contracts/Liquiditymanager.sol`), 2 results

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/interfaces/IProxyGeneral.sol#100-100), lines 100 to 120

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/Liquiditymanager.sol#290-290), lines 290 to 320

Searched text for `function getTokenInfo|struct TokenInfo` (`**/contracts/TokenManager.sol`), 2 results

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/TokenManager.sol#15-15), lines 15 to 45

Read [](file:///e%3A/Documents/Crypto/Defi/Arbitrum/Coding/Project4/TestSmartContract/contracts/TokenManager.sol#335-335), lines 335 to 355

Perfetto! Ora ho tutte le informazioni necessarie. Procedo con l'analisi strategica.

---

## Analisi

### Contesto

**Problema identificato:** Durante i test withdraw di LiquidityManager, è emerso che la funzione `withdrawToken()` è dichiarata nell'interfaccia IProxyGeneral.sol ma **non è implementata** in `ProxyGeneral.sol`.

**Chiamate attuali:**
1. `LiquidityManager.withdraw()` linea 297: `proxy.withdrawToken("WETH", netWithdraw, address(this))`
2. `LiquidityManager.withdraw()` linea 308: `proxy.withdrawToken("WETH", feeAmount, feeRecipient)`

**Risultato:** 8/11 test withdraw failing con errore `"Function does not exist"` al fallback di ProxyGeneral.

**Architettura del sistema:**
```
LiquidityManager.withdraw()
    └─> ProxyGeneral.withdrawToken("WETH", amount, to)
            └─> Beacon.getImplementation("TokenManager")
                └─> TokenManager.getTokenInfo("WETH")
                    └─> returns tokenAddress
            └─> IERC20(tokenAddress).transfer(to, amount)
```

### Vincoli / requisiti

**Tecnici:**
- Solidity ^0.8.19
- ProxyGeneral è custody contract → detiene tutti gli ERC20
- TokenManager ha mapping `tokenCode → TokenInfo` con `tokenAddress`
- Beacon pattern per module resolution
- OpenZeppelin IERC20 per token transfers

**Funzionali:**
- Trasferire ERC20 tokens da ProxyGeneral custody a destinatario
- Lookup token address tramite TokenManager via tokenCode
- Supportare sia transfer diretti (user) che a moduli
- Validare balance sufficiente prima del transfer
- Emettere eventi per tracking

**Sicurezza:**
- Solo `onlyAuthorizedModule` può chiamare `withdrawToken()`
- Validazione tokenCode valido e active
- Validazione amount > 0
- Validazione destinatario != address(0)
- Check balance prima transfer
- Reentrancy protection (ProxyGeneral ha già ReentrancyGuard)

**Compatibilità:**
- Interfaccia già definita (no breaking changes)
- Simmetrica a `depositToken()` (se esiste)
- Event `TokenWithdrawn` già dichiarato in interfaccia

### Rischi / incertezze

**Alto rischio:**
- 🔴 **8/11 test withdraw FAILING** → blocca completamente testing withdraw flow
- 🔴 Feature critica per produzione → senza withdraw il protocollo è inutilizzabile
- 🔴 TokenManager lookup failure → nessun fallback se token non trovato

**Medio rischio:**
- 🟡 ERC20 transfer failures → alcuni token non standard (USDT) richiedono handling speciale
- 🟡 Gas costs per Beacon resolution + TokenManager call
- 🟡 Reentrancy se destinatario è contratto malicious (mitigato da ReentrancyGuard)

**Basso rischio:**
- 🟢 Interfaccia già definita
- 🟢 Pattern simile a `transferFunds()` già implementato
- 🟢 Eventi già dichiarati

---

## Strategia

### Approccio scelto

**Implementazione completa e production-ready** con le seguenti caratteristiche:

#### 1. **Function Signature & Access Control**
```solidity
function withdrawToken(
    string memory tokenCode, 
    uint256 amount, 
    address to
) external onlyAuthorizedModule whenNotPaused
```

**Perché:**
- ✅ Matches interfaccia esattamente
- ✅ Solo moduli autorizzati (LiquidityManager, SwapManager, etc.)
- ✅ Rispetta pause global del sistema

#### 2. **Implementation Logic Flow**

```
Input: tokenCode ("WETH"), amount (1000000000000000000), to (0x123...)

1. VALIDATIONS
   ├─> require(bytes(tokenCode).length > 0, "Invalid token code")
   ├─> require(amount > 0, "Invalid amount")
   └─> require(to != address(0), "Invalid recipient")

2. RESOLVE TOKEN ADDRESS via TokenManager
   ├─> Get Beacon
   ├─> Resolve "TokenManager" implementation
   ├─> Call tokenManager.getTokenInfo(tokenCode)
   ├─> Extract tokenAddress from TokenInfo
   └─> Validate tokenAddress != address(0)

3. CHECK BALANCE
   ├─> currentBalance = IERC20(tokenAddress).balanceOf(address(this))
   └─> require(currentBalance >= amount, "Insufficient token balance")

4. EXECUTE TRANSFER
   ├─> success = IERC20(tokenAddress).transfer(to, amount)
   └─> require(success, "Token transfer failed")

5. EMIT EVENT
   └─> emit TokenWithdrawn(tokenCode, amount, to)
```

#### 3. **Error Handling Strategy**

| Scenario | Soluzione |
|----------|----------|
| Token non trovato | TokenManager.getTokenInfo() reverts con "Token not active" |
| Token non active | TokenManager validation |
| Balance insufficiente | require() con messaggio chiaro |
| Transfer fallisce | require() con messaggio |
| Destinatario zero address | require() upfront |
| Amount zero | require() upfront |

#### 4. **Gas Optimization**

```solidity
// OTTIMIZZAZIONE 1: Cache Beacon resolution
address tokenManagerAddr = IBeacon(beacon).getImplementation("TokenManager");

// OTTIMIZZAZIONE 2: Direct storage read invece di multiple calls
ITokenManagerForModules.TokenInfo memory tokenInfo = 
    ITokenManagerForModules(tokenManagerAddr).getTokenInfo(tokenCode);
address tokenAddress = tokenInfo.tokenAddress;

// OTTIMIZZAZIONE 3: Single balance check
uint256 currentBalance = IERC20(tokenAddress).balanceOf(address(this));
require(currentBalance >= amount, "Insufficient token balance");
```

**Gas cost stimato:** ~35-45k gas (Beacon resolution: 10k, TokenManager call: 15k, Transfer: 20k)

---

### Alternative e trade-off

#### **Alternative 1: Direct Address Lookup (No TokenManager)**

```solidity
function withdrawToken(address tokenAddress, uint256 amount, address to) external {
    require(tokenAddress != address(0), "Invalid token");
    // ... direct transfer
}
```

**Pro:**
- ⚡ Più veloce (no Beacon/TokenManager overhead)
- 🔧 Più semplice da implementare

**Contro:**
- ❌ Breaking change → cambia signature interfaccia
- ❌ Perde validazione token active
- ❌ LiquidityManager dovrebbe fare lookup prima
- ❌ Inconsistente con architettura sistema

**Quando usare:** Mai - breaks existing contracts.

---

#### **Alternative 2: Batch Withdrawal**

```solidity
function withdrawTokenBatch(
    string[] memory tokenCodes, 
    uint256[] memory amounts, 
    address[] memory recipients
) external {
    // Loop e withdraw multiple
}
```

**Pro:**
- ✅ Gas efficiente per operazioni multiple
- ✅ Utile per liquidazioni

**Contro:**
- ❌ Complessità maggiore
- ❌ Non richiesto attualmente
- ❌ Più difficile da debuggare

**Quando usare:** Future enhancement dopo implementazione base.

---

#### **Alternative 3: Implement depositToken() anche**

L'interfaccia dichiara anche `depositToken()` che attualmente non esiste.

**Pro:**
- ✅ Completezza interfaccia
- ✅ Simmetria deposit/withdraw

**Contro:**
- ❌ Non chiamato da nessuno attualmente
- ❌ Non blocca test

**Decisione:** Implementare **dopo** `withdrawToken()` se tempo disponibile.

---

### Motivazioni per Scelta Principale

**Perché Implementazione Completa con TokenManager Lookup?**

1. **Compatibilità Architettura**
   - ✅ Rispetta design pattern esistente (tokenCode → TokenManager → address)
   - ✅ Mantiene validazione centralized in TokenManager
   - ✅ Consistente con resto del sistema

2. **Sicurezza**
   - ✅ Validazione token active/valid
   - ✅ Protection da token malicious
   - ✅ Clear audit trail via eventi

3. **Test Coverage**
   - ✅ Sblocca 8/11 test withdraw CRITICAL
   - ✅ Validation coverage inclusa
   - ✅ Error scenarios testabili

4. **Maintenance**
   - ✅ Codice pulito e documentato
   - ✅ Segue pattern esistenti
   - ✅ Future-proof

5. **Timeline**
   - ⏱️ 1-2 ore implementazione
   - ⏱️ 30 min testing
   - ✅ ROI immediato: sblocca withdraw tests

---

## Documentazione

### Schema logico / architetturale

```
┌─────────────────────────────────────────────────────────┐
│                 LiquidityManager.sol                     │
│                                                           │
│  withdraw(shares)                                        │
│    │                                                      │
│    ├─> Calculate netWithdraw, feeAmount                 │
│    │                                                      │
│    ├─> proxy.withdrawToken("WETH", netWithdraw, this) ──┐
│    │                                                      │
│    └─> proxy.withdrawToken("WETH", feeAmount, fee) ─────┤
└─────────────────────────────────────────────────────────┼┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    ProxyGeneral.sol                         │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  withdrawToken() - NEW IMPLEMENTATION                 │ │
│  │                                                        │ │
│  │  1. Validations                                       │ │
│  │     ├─> tokenCode valid                              │ │
│  │     ├─> amount > 0                                   │ │
│  │     └─> to != address(0)                             │ │
│  │                                                        │ │
│  │  2. Resolve Token Address                            │ │
│  │     ├─> Beacon.getImplementation("TokenManager") ────┼─┐
│  │     └─> TokenManager.getTokenInfo(tokenCode)         │ │
│  │             └─> returns TokenInfo.tokenAddress       │ │
│  │                                                        │ │
│  │  3. Check Balance                                    │ │
│  │     └─> IERC20(tokenAddress).balanceOf(this)         │ │
│  │                                                        │ │
│  │  4. Execute Transfer                                 │ │
│  │     └─> IERC20(tokenAddress).transfer(to, amount)    │ │
│  │                                                        │ │
│  │  5. Emit Event                                       │ │
│  │     └─> emit TokenWithdrawn(tokenCode, amount, to)   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Existing Features:                                         │
│  - LP Token Management ✅                                   │
│  - Rate Limiting ✅ (just implemented)                      │
│  - Emergency Controls ✅                                    │
│  - transferFunds() ✅ (similar pattern)                     │
└──────────────────────────────────────────────────────────┼──┘
                                                            │
                                                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   TokenManager.sol                          │
│                                                              │
│  getTokenInfo(tokenCode) returns TokenInfo                  │
│    ├─> Check isActive                                      │
│    └─> Return {                                            │
│            tokenAddress,                                    │
│            tokenDecimals,                                   │
│            tokenCode,                                       │
│            priceFeed,                                       │
│            ...                                              │
│        }                                                    │
└─────────────────────────────────────────────────────────────┘
```

### API / interfacce

#### **Function Implementation**

```solidity
/**
 * @notice Preleva token dal custody ProxyGeneral
 * @dev Solo moduli autorizzati. Risolve tokenAddress tramite TokenManager.
 * @param tokenCode Codice token (es: "WETH", "USDC", "WBTC")
 * @param amount Quantità token in wei/smallest unit
 * @param to Indirizzo destinatario (user o modulo)
 * 
 * @custom:security onlyAuthorizedModule
 * @custom:validation tokenCode must be active in TokenManager
 * @custom:validation amount > 0
 * @custom:validation to != address(0)
 * @custom:validation sufficient balance in custody
 * 
 * @custom:emits TokenWithdrawn
 * @custom:reverts "Invalid token code" se tokenCode vuoto
 * @custom:reverts "Invalid amount" se amount == 0
 * @custom:reverts "Invalid recipient" se to == address(0)
 * @custom:reverts "Token not active" se token non trovato
 * @custom:reverts "Invalid token address" se resolution fallisce
 * @custom:reverts "Insufficient token balance" se balance < amount
 * @custom:reverts "Token transfer failed" se transfer ERC20 fallisce
 */
function withdrawToken(
    string memory tokenCode, 
    uint256 amount, 
    address to
) external onlyAuthorizedModule whenNotPaused {
    // Implementation details below
}
```

#### **Event**

```solidity
/**
 * @notice Emesso quando token è prelevato dal custody
 * @param tokenCode Codice token prelevato
 * @param amount Quantità prelevata
 * @param to Destinatario
 * 
 * @custom:indexed tokenCode per filtering efficiente
 * @custom:indexed to per tracking per-user
 */
event TokenWithdrawn(string indexed tokenCode, uint256 amount, address indexed to);
```

### Impatti / note tecniche

#### **Integration Points**

**Callers attuali:**
1. `LiquidityManager.withdraw()` - linea 297, 308
2. Future: `SwapManager` per token swaps
3. Future: `EmergencyHandler` per emergency withdrawals

**Dependencies:**
- `Beacon` → per resolution moduli
- `TokenManager` → per tokenCode → tokenAddress mapping
- `IERC20` → per token transfers
- OpenZeppelin imports già presenti

#### **Gas Costs (stimati)**

| Operazione | Gas Cost | Note |
|-----------|----------|------|
| Beacon resolution | ~10k gas | SLOAD + external call |
| TokenManager.getTokenInfo() | ~15k gas | Mapping lookup + struct read |
| IERC20.balanceOf() | ~5k gas | Standard ERC20 |
| IERC20.transfer() | ~20-50k gas | Varia per token |
| Event emission | ~2k gas | LOG3 |
| **TOTALE** | **~52-82k gas** | Dipende dal token |

**Confronto:**
- `transferFunds()` esistente: ~45k gas (no TokenManager lookup)
- Direct transfer: ~25k gas (no validation)
- **Overhead TokenManager: ~27k gas** (accettabile per sicurezza)

#### **Token Compatibility**

**Standard ERC20:** ✅ Compatibile
```solidity
function transfer(address to, uint256 amount) external returns (bool);
```

**Non-standard tokens (USDT old):** ⚠️ Potenziale issue
```solidity
function transfer(address to, uint256 amount) external; // No return value
```

**Mitigazione:**
```solidity
// Use OpenZeppelin SafeERC20 wrapper
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
using SafeERC20 for IERC20;

// Instead of:
bool success = IERC20(tokenAddress).transfer(to, amount);
require(success, "Transfer failed");

// Use:
IERC20(tokenAddress).safeTransfer(to, amount); // Auto-reverts on failure
```

**Decisione:** Implementare con `SafeERC20` per maximum compatibility.

#### **Breaking Changes**

**Nessuno:**
- ✅ Interfaccia già definita (no signature changes)
- ✅ Nuova funzione (append-only)
- ✅ No modifiche a storage layout
- ✅ Backward compatible

**Deployment Strategy:**
1. Deploy updated ProxyGeneral implementation
2. Update Beacon pointer (se upgradeable)
3. Run test suite withdraw
4. Validate con small transactions testnet
5. Deploy mainnet

#### **Security Considerations**

**Mitigazioni implementate:**

1. **Access Control**
   - ✅ `onlyAuthorizedModule` → solo LiquidityManager, SwapManager
   - ✅ `whenNotPaused` → emergency stop capability

2. **Input Validation**
   - ✅ tokenCode non vuoto
   - ✅ amount > 0
   - ✅ to != address(0)
   - ✅ TokenManager validation (active token)

3. **Balance Safety**
   - ✅ Check balance prima transfer
   - ✅ SafeERC20 per transfer failures

4. **Reentrancy**
   - ✅ ProxyGeneral già ha `ReentrancyGuard`
   - ✅ External calls dopo state changes (se presenti)

5. **Event Logging**
   - ✅ Emit event per audit trail
   - ✅ Indexed parameters per filtering

**Potenziali vulnerabilità residue:**
- 🟡 Token malicious con transfer hook → mitigato da whitelist TokenManager
- 🟡 Gas griefing da token con high transfer cost → accepted risk
- 🟢 No altre vulnerabilità identificate

#### **Testing Requirements**

**Unit Tests necessari:**
1. ✅ Successful withdraw WETH
2. ✅ Successful withdraw altri token (USDC, WBTC)
3. ❌ Revert invalid tokenCode
4. ❌ Revert amount == 0
5. ❌ Revert to == address(0)
6. ❌ Revert insufficient balance
7. ❌ Revert unauthorized caller
8. ❌ Revert quando paused
9. ✅ Event emitted correctly
10. ✅ Balance updated correctly

**Integration Tests:**
- ✅ LiquidityManager.withdraw() end-to-end
- ✅ Fee transfer to feeRecipient
- ✅ Multiple withdrawals same block

---

## TODO

### Implementazione - ProxyGeneral.sol

- [ ] **Step 1: Importare SafeERC20**
  - [ ] Aggiungere `import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";`
  - [ ] Aggiungere `using SafeERC20 for IERC20;` dopo imports
  - [ ] Verificare che OpenZeppelin v4/v5 sia installato

- [ ] **Step 2: Creare Interface per TokenManager**
  - [ ] Verificare se esiste `ITokenManagerForModules` con `getTokenInfo()`
  - [ ] Se manca, verificare signature in TokenManager.sol
  - [ ] Documentare struct TokenInfo necessaria

- [ ] **Step 3: Implementare withdrawToken()**
  - [ ] Signature: `function withdrawToken(string memory tokenCode, uint256 amount, address to) external onlyAuthorizedModule whenNotPaused`
  - [ ] Validazioni iniziali:
    - [ ] `require(bytes(tokenCode).length > 0, "Invalid token code")`
    - [ ] `require(amount > 0, "Invalid amount")`
    - [ ] `require(to != address(0), "Invalid recipient")`
  - [ ] Resolve token address:
    - [ ] Get TokenManager via Beacon
    - [ ] Call `getTokenInfo(tokenCode)`
    - [ ] Extract `tokenAddress` da TokenInfo
    - [ ] `require(tokenAddress != address(0), "Invalid token address")`
  - [ ] Check balance:
    - [ ] `currentBalance = IERC20(tokenAddress).balanceOf(address(this))`
    - [ ] `require(currentBalance >= amount, "Insufficient token balance")`
  - [ ] Execute transfer:
    - [ ] `IERC20(tokenAddress).safeTransfer(to, amount)`
  - [ ] Emit event:
    - [ ] `emit TokenWithdrawn(tokenCode, amount, to)`
  - [ ] Documentare con NatSpec completo

- [ ] **Step 4: Testing & Validation**
  - [ ] Compilare: `npx hardhat compile`
  - [ ] Fix compilation errors
  - [ ] Run withdraw tests: `npx hardhat test LiquidityManager.test.ts --grep "withdraw"`
  - [ ] Verificare 8 test precedentemente failing ora passing
  - [ ] Check gas costs in output
  - [ ] Verificare eventi emessi

### Testing - Validation

- [ ] **Step 5: Run Complete Test Suite**
  - [ ] `npx hardhat test LiquidityManager.test.ts --grep "CRITICAL"`
  - [ ] Target: 23/23 test passing (12 deposit + 11 withdraw)
  - [ ] Verificare no regression su test esistenti
  - [ ] Check coverage: `npx hardhat coverage`

### Documentazione

- [ ] **Step 6: Update Documentation**
  - [ ] Update `MISSING_IMPLEMENTATIONS_FROM_TESTS.md`:
    - [ ] Sezione "withdrawToken": ✅ IMPLEMENTED
    - [ ] Update test passing counts
    - [ ] Link commit implementation
  - [ ] Update `TEST_COVERAGE_REPORT.md`:
    - [ ] LiquidityManager withdraw: 11/11 CRITICAL passing
    - [ ] Phase 1 total: 23/23 CRITICAL passing (100%)
  - [ ] Aggiornare `API_Reference.md`:
    - [ ] Documentare `withdrawToken()` API
    - [ ] Examples di utilizzo
    - [ ] Gas costs

### Optional - Future Enhancements

- [ ] **Step 7: Implement depositToken() (se tempo)**
  - [ ] Stessa logica ma inversa (from → ProxyGeneral)
  - [ ] Requires approval upfront
  - [ ] Event `TokenDeposited`

- [ ] **Step 8: Batch Operations (post-MVP)**
  - [ ] `withdrawTokenBatch()` per multiple tokens
  - [ ] Gas optimization per operazioni bulk

---

## Metriche di Successo

### Pre-Implementation
- ❌ 12/12 deposit tests passing (100%)
- ❌ 3/11 withdraw tests passing (27%)
- ❌ 15/23 total LiquidityManager CRITICAL passing (65%)

### Post-Implementation Target
- ✅ 12/12 deposit tests passing (100%)
- ✅ 11/11 withdraw tests passing (100%)
- ✅ **23/23 total LiquidityManager CRITICAL passing (100%)**
- ✅ withdrawToken() funzionante in production
- ✅ No regression su test esistenti
- ✅ Gas costs < 100k per withdraw operation

---

## Risorse Necessarie

**Tempo stimato:**
- Coding: 1-1.5 ore
- Testing: 30-45 min
- Documentation: 15-30 min
- **Totale: 2-2.5 ore**

**Conoscenze:**
- Solidity token handling
- OpenZeppelin SafeERC20
- Beacon proxy pattern
- Hardhat testing

**Tools:**
- Hardhat
- OpenZeppelin Contracts (v4.x o v5.x)
- VS Code + Solidity extension
- Etherscan (gas cost reference)

---

**Note finale:** Questa implementazione è **più semplice** del rate limiting precedente perché:
1. ✅ Pattern simile a `transferFunds()` già esistente
2. ✅ No storage aggiuntivo necessario
3. ✅ No logica temporale complessa
4. ✅ Direct mapping lookup via TokenManager

L'implementazione dovrebbe richiedere **~2 ore totali** e sbloccare completamente il withdraw flow, portando a 100% coverage dei test CRITICAL Phase 1.