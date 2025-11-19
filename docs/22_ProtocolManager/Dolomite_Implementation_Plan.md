# Piano Implementazione: ProtocolManager per Dolomite

## Analisi

### Contesto

**Situazione attuale:**
- Sistema con 8 smart contract core (Beacon, ProxyGeneral, TokenManager, SwapManager, LiquidityManager-ETH/USDC/WBTC, ParameterManager, ValueCalculator)
- SwapManager gestisce DEX plugins (Uniswap, Camelot) per operazioni di swap pure
- DolomitePlugin implementato con chiamate dirette (bypass architettura core)
- **Focus immediato:** integrare Dolomite (lending) come primo protocollo complesso

**Obiettivo proposto:**
Creare un **ProtocolManager** che:
1. Gestisca protocolli non-swap (lending, yield, trading) - architettura scalabile per futuri protocolli
2. Fornisca interfaccia comune per operazioni base (deposit, withdraw, borrow, repay)
3. Supporti operazioni protocol-specific via chiamate generiche
4. Mantenga custody centralizzato (ProxyGeneral)
5. **PRIORITÀ: Integrazione completa con DolomitePlugin come caso d'uso primario**

### Vincoli / Requisiti

**Vincoli tecnici:**
1. ✅ **Non modificare 8 contratti core esistenti** - solo aggiunta 9° contratto (ProtocolManager)
2. ✅ **Custody SEMPRE ProxyGeneral** - token flow: ProxyGeneral ↔ ProtocolManager ↔ Plugin ↔ External Protocol
3. ✅ **Access control: onlyOwner** (futuro multi-sig) - operazioni immediate senza timelock
4. ✅ **Beacon resolution** - ProtocolManager e Plugin registrati in Beacon
5. ✅ **Backward compatibility** - SwapManager continua a gestire DEX plugins indipendentemente
6. ✅ **Gas efficiency** - minimizzare proxy calls, evitare storage ridondante

**Requisiti funzionali (focus Dolomite):**
1. **Operazioni comuni:** deposit, withdraw, getBalance, getTotalValue
2. **Operazioni lending:** borrow, repay, getDebt, getHealthFactor
3. **Operazioni Dolomite-specific:** openBorrowPosition, borrowFromPosition, repayBorrowPosition, closeBorrowPosition, executeFlashLoan (via executeProtocolCall)
4. **Emergency functions:** emergencyWithdrawAll per recupero fondi

**Requisiti non funzionali:**
1. **Estensibilità:** architettura permette aggiungere Aave/Pendle/GMX in futuro senza modificare ProtocolManager
2. **Type safety:** interfacce stratificate per compile-time checks
3. **Observability:** eventi dettagliati per tracking operazioni
4. **Testabilità:** mock plugins per unit testing
5. **Documentazione:** NatSpec completo + guide integrazione

### Rischi / Incertezze

**Rischi architetturali:**

1. **🔴 ALTO - Generic call security**
   - `executeProtocolCall(protocolName, bytes data)` permette chiamate arbitrarie
   - **Rischio:** owner compromesso può chiamare funzioni pericolose
   - **Mitigazione:** 
     - ✅ Access control rigoroso (onlyOwner, futuro multi-sig)
     - ✅ Event logging dettagliato per audit trail (tracciamento completo operazioni)
     - ❌ ~~Timelock~~ (rimosso - incompatibile con trading istantaneo)
     - 🔄 **Whitelist function selectors dinamica** (configurabile runtime, nessun redeploy)

2. **🟡 MEDIO - Interface compatibility**
   - Plugin devono implementare interfacce stratificate correttamente
   - **Rischio:** plugin non conformi causano runtime errors
   - **Mitigazione:**
     - Interface registry in Beacon (check implementation conformità)
     - Try/catch wrapping in ProtocolManager per graceful failures
     - Validation functions `supportsInterface()` (ERC165-style)

3. **🟡 MEDIO - Token flow complexity**
   - Custody chain: ProxyGeneral → ProtocolManager → Plugin → External Protocol
   - **Rischio:** token stuck in intermediari, accounting errors
   - **Mitigazione:**
     - Strict token accounting (pre/post balance checks)
     - Plugin MUST return tokens to ProxyGeneral (enforced in interface)
     - Sweep functions per recupero token stuck

4. **🟢 BASSO - Gas overhead**
   - Proxy pattern aggiunge ~5-10k gas per operazione
   - **Rischio:** operazioni complesse diventano troppo costose
   - **Mitigazione:**
     - Batch operations (multi-call in single tx)
     - Gas profiling pre-deployment

**Rischi implementativi:**

5. **🟡 MEDIO - Dolomite-specific edge cases**
   - Dolomite ha quirks: account numbers, isolated positions, flash loan callbacks
   - **Rischio:** logica generica non copre casi specifici
   - **Mitigazione:**
     - DolomitePlugin gestisce logica specifica
     - ProtocolManager è thin wrapper (orchestrazione, non business logic)
     - Extensive integration tests con Dolomite mainnet fork

6. **🟡 MEDIO - Upgrade path**
   - Come aggiornare ProtocolManager senza interrompere servizio?
   - **Rischio:** downtime, loss of positions/tracking
   - **Mitigazione:**
     - ProtocolManager è upgradeable (proxy pattern)
     - State migration strategy documentata
     - Gradual rollout (testnet → mainnet)

**Incertezze:**

- **Dolomite API stability:** depositRouter/borrowRouter potrebbero cambiare → aggiornare IDolomite interface
- **User experience:** owner deve conoscere function signatures per executeProtocolCall → tool/UI necessario

---

## Strategia

### Approccio scelto: **Interfaccia Stratificata con Generic Fallback**

**Architettura a 2 layer (focus Dolomite):**

```
Layer 1: IProtocolManager (base comune)
    ↓ extends
Layer 2: ILendingProtocol (lending operations)
    ↓ implements
DolomitePlugin (Dolomite-specific logic)
```

**Note:** Layer 3 protocol-specific interfaces (IDolomiteLendingProtocol, IPendleYieldProtocol, ecc.) verranno create in futuro quando si integreranno più protocolli lending.

**Flow operativo:**

```
1. Owner chiama ProtocolManager.deposit("DolomitePlugin", "WETH", 1 ether)
   ↓
2. ProtocolManager.deposit():
   - Resolve: dolomitePlugin = Beacon.getImplementation("DolomitePlugin")
   - Withdraw: ProxyGeneral.withdrawToken("WETH", 1e18, dolomitePlugin)
   - Delegate: IProtocolManager(dolomitePlugin).deposit("WETH", 1e18)
   ↓
3. DolomitePlugin.deposit():
   - Receive WETH from ProxyGeneral
   - Call: depositRouter.depositWei(...)
   - Update internal accounting
   - (WETH now on Dolomite, owned by dolomitePlugin account #0)
   ↓
4. Return success to ProtocolManager
   ↓
5. Emit: ProtocolOperationExecuted("DolomitePlugin", "deposit", "WETH", 1e18)
```

**Per operazioni Dolomite-specific:**

```
1. Owner chiama ProtocolManager.executeProtocolCall(
       "DolomitePlugin",
       abi.encodeWithSignature("openBorrowPosition(string,uint256)", "WETH", 5e17)
   )
   ↓
2. ProtocolManager.executeProtocolCall():
   - Resolve: dolomitePlugin = Beacon.getImplementation("DolomitePlugin")
   - [Optional] Check whitelist: allowedSelectors[dolomitePlugin][0x12345678]
   - Generic call: dolomitePlugin.call(data)
   - Return: abi.decode(returnData, (uint256)) // accountNumber
   ↓
3. DolomitePlugin.openBorrowPosition():
   - Expect WETH already in contract (ProtocolManager must have transferred)
   - Call: dolomiteMargin.operate([Transfer action])
   - Return: accountNumber = 1
   ↓
4. Emit: ProtocolSpecificCallExecuted("DolomitePlugin", 0x12345678, data)
```

### Security: Whitelist Dinamica (Opzionale)

**Problema identificato:** Whitelist hardcoded al deploy = redeploy ProtocolManager per ogni nuovo protocollo

**Soluzione proposta:**

```solidity
// In ProtocolManager.sol
mapping(address => mapping(bytes4 => bool)) public allowedSelectors;

function setAllowedSelectors(
    string memory protocolName,
    bytes4[] memory selectors,
    bool allowed
) external onlyOwner {
    address plugin = _resolvePlugin(protocolName);
    for (uint i = 0; i < selectors.length; i++) {
        allowedSelectors[plugin][selectors[i]] = allowed;
        emit SelectorAllowanceChanged(plugin, selectors[i], allowed);
    }
}

function executeProtocolCall(...) external onlyOwner {
    address plugin = _resolvePlugin(protocolName);
    bytes4 selector = bytes4(data);
    
    // Optional check - può essere disabilitato se troppo restrittivo
    if (allowedSelectors[plugin][selector] == false) {
        revert("Selector not allowed");
    }
    
    // ... rest of logic
}
```

**Workflow:**
1. Deploy DolomitePlugin
2. Registra in Beacon
3. `setAllowedSelectors("DolomitePlugin", [openBorrowPosition.selector, borrowFromPosition.selector, ...], true)`
4. **ZERO redeploy ProtocolManager** per aggiungere Aave/Pendle in futuro

**Alternative:**
- ~~Opzione A: Whitelist disabilitata by default~~ (meno sicuro)
- ~~Opzione B: Whitelist con "trusted protocol" flag~~ (wildcard troppo permissivo)

**✅ DECISIONE FINALE: Whitelist dinamica implementata e testata prima di deploy**
- Mapping `allowedSelectors[plugin][selector]` in ProtocolManager
- Function `setAllowedSelectors()` per configurazione runtime
- Validation in `executeProtocolCall()` con revert se selector non allowed
- Testing completo in Phase 4 (unit + integration + fork tests)
- Deploy con whitelist configurata per funzioni Dolomite-specific

---

## Documentazione

### Schema logico / architetturale

```
┌────────────────────────────────────────────────────────────────┐
│                        USER / OWNER                            │
│              (EOA, futuro multi-sig Gnosis Safe)               │
└────────────────────────────────────────────────────────────────┘
                               │
                               │ onlyOwner calls
                               ▼
┌────────────────────────────────────────────────────────────────┐
│                    CORE MODULES LAYER                          │
├────────────────┬───────────────┬───────────────┬───────────────┤
│ LiquidityMgr   │ SwapManager   │ ProtocolMgr   │ ParameterMgr  │
│ -ETH/USDC/WBTC │ (DEX swaps)   │ (Lending/     │ (Config)      │
│ (User deposits)│               │  Yield/Trade) │               │
└────────────────┴───────────────┴───────────────┴───────────────┘
                               │
                               │ onlyAuthorizedModule
                               ▼
┌────────────────────────────────────────────────────────────────┐
│                     PROXYGENERAL                               │
│                  (Custody centralizzato)                       │
│  - LP Token (ERC20)                                            │
│  - Asset custody (WETH, USDC, WBTC, ARB, ...)                 │
│  - authorizedModules mapping                                   │
│  - Rate limiting                                               │
└────────────────────────────────────────────────────────────────┘
                               │
                               │
                               ▼
                    ┌───────────────────┐
                    │ LENDING PLUGINS   │
                    │ (ProtocolMgr)     │
                    ├───────────────────┤
                    │ DolomitePlugin    │ ← FOCUS IMMEDIATO
                    └───────────────────┘
                               │
                               │
                               ▼
                    ┌───────────────────┐
                    │ Dolomite Protocol │
                    │ (Arbitrum One)    │
                    └───────────────────┘
```

---

### Component Diagram: ProtocolManager Internals

```
┌──────────────────────────────────────────────────────────────┐
│                    ProtocolManager.sol                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  State Variables:                                            │
│  - address immutable beacon                                  │
│  - mapping(address => mapping(bytes4 => bool))               │
│    allowedSelectors  [OPTIONAL - whitelist dinamica]        │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         COMMON OPERATIONS                          │    │
│  │  deposit(protocolName, tokenCode, amount)          │    │
│  │  withdraw(protocolName, tokenCode, amount)         │    │
│  │  getBalance(protocolName, tokenCode) → uint256     │    │
│  │  getTotalValue(protocolName) → uint256             │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         LENDING OPERATIONS                         │    │
│  │  borrow(protocolName, tokenCode, amount)           │    │
│  │  repay(protocolName, tokenCode, amount)            │    │
│  │  getDebt(protocolName, tokenCode) → uint256        │    │
│  │  getHealthFactor(protocolName) → uint256           │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         GENERIC OPERATIONS                         │    │
│  │  executeProtocolCall(protocolName, bytes data)     │    │
│  │    → bytes returnData                              │    │
│  │                                                     │    │
│  │  [OPTIONAL] setAllowedSelectors(protocol, sels[])  │    │
│  │                                                     │    │
│  │  Internal:                                         │    │
│  │  - _resolvePlugin(protocolName) → address          │    │
│  │  - _validateProtocol(address) → bool               │    │
│  │  - _executeWithChecks(address, bytes) → bytes      │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  Events:                                                     │
│  - ProtocolOperationExecuted(protocol, op, token, amount)   │
│  - ProtocolSpecificCallExecuted(protocol, selector, data)   │
│  - SelectorAllowanceChanged(plugin, selector, allowed)      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

### Interface Hierarchy (Focus Dolomite)

```
IProtocolManager (base)
├─ deposit(tokenCode, amount) → bool
├─ withdraw(tokenCode, amount) → bool
├─ getBalance(tokenCode) → uint256
├─ getTotalValue() → uint256
├─ getProtocolInfo() → (name, version, isActive)
└─ emergencyWithdrawAll(tokenCodes[]) → bool

    ↓ extends

ILendingProtocol
├─ [inherits all IProtocolManager]
├─ borrow(tokenCode, amount) → bool
├─ repay(tokenCode, amount) → bool
├─ getDebt(tokenCode) → uint256
├─ getHealthFactor() → uint256
└─ getBorrowCapacity(tokenCode) → uint256
```

**Note:** 
- DolomitePlugin implementa `ILendingProtocol`
- Funzioni Dolomite-specific (openBorrowPosition, closeBorrowPosition, executeFlashLoan) accessibili via `executeProtocolCall()`
- Interfacce protocol-specific (IDolomiteLendingProtocol, IPendleYieldProtocol, ecc.) create in futuro quando necessario

---

### API / Interfacce

**ProtocolManager.sol - Public API (Focus Dolomite):**

```solidity
// ========== COMMON OPERATIONS ==========

function deposit(
    string memory protocolName,  // "DolomitePlugin"
    string memory tokenCode,     // "WETH", "USDC", etc.
    uint256 amount
) external onlyOwner;

function withdraw(
    string memory protocolName,
    string memory tokenCode,
    uint256 amount
) external onlyOwner;

function getBalance(
    string memory protocolName,
    string memory tokenCode
) external view returns (uint256 balance);

function getTotalValue(
    string memory protocolName
) external view returns (uint256 totalValueETH);

// ========== LENDING OPERATIONS ==========

function borrow(
    string memory protocolName,
    string memory tokenCode,
    uint256 amount
) external onlyOwner;

function repay(
    string memory protocolName,
    string memory tokenCode,
    uint256 amount
) external onlyOwner;

function getDebt(
    string memory protocolName,
    string memory tokenCode
) external view returns (uint256 debtAmount);

function getHealthFactor(
    string memory protocolName
) external view returns (uint256 healthFactor);

// ========== GENERIC OPERATIONS (Dolomite-specific) ==========

function executeProtocolCall(
    string memory protocolName,
    bytes calldata data           // abi.encodeWithSignature(...)
) external onlyOwner returns (bytes memory returnData);

// ========== SECURITY (Optional Whitelist) ==========

function setAllowedSelectors(
    string memory protocolName,
    bytes4[] memory selectors,
    bool allowed
) external onlyOwner;

// ========== EMERGENCY ==========

function emergencyWithdrawAll(
    string memory protocolName,
    string[] memory tokenCodes
) external onlyOwner;
```

---

**Usage Examples (Dolomite):**

```solidity
// Example 1: Deposit to Dolomite
protocolManager.deposit("DolomitePlugin", "WETH", 1 ether);

// Example 2: Borrow from Dolomite (main account)
protocolManager.borrow("DolomitePlugin", "USDC", 1000e6);

// Example 3: Repay debt
protocolManager.repay("DolomitePlugin", "USDC", 1000e6);

// Example 4: Open isolated borrow position (protocol-specific)
bytes memory data = abi.encodeWithSignature(
    "openBorrowPosition(string,uint256)",
    "WETH",
    5e17  // 0.5 WETH collateral
);
bytes memory result = protocolManager.executeProtocolCall("DolomitePlugin", data);
uint256 accountNumber = abi.decode(result, (uint256));

// Example 5: Borrow from isolated position
bytes memory data = abi.encodeWithSignature(
    "borrowFromPosition(uint256,string,uint256)",
    accountNumber,
    "USDC",
    1000e6
);
protocolManager.executeProtocolCall("DolomitePlugin", data);

// Example 6: Execute flash loan
bytes memory flashLoanData = abi.encode(
    /* custom callback data */
);
bytes memory data = abi.encodeWithSignature(
    "executeFlashLoan(string,uint256,address,bytes)",
    "WETH",
    10 ether,
    callbackContract,
    flashLoanData
);
protocolManager.executeProtocolCall("DolomitePlugin", data);

// Example 7: Configure whitelist (optional)
bytes4[] memory selectors = new bytes4[](3);
selectors[0] = bytes4(keccak256("openBorrowPosition(string,uint256)"));
selectors[1] = bytes4(keccak256("borrowFromPosition(uint256,string,uint256)"));
selectors[2] = bytes4(keccak256("executeFlashLoan(string,uint256,address,bytes)"));
protocolManager.setAllowedSelectors("DolomitePlugin", selectors, true);
```

---

### Impatti / Note tecniche

**Modifiche necessarie a contratti esistenti:**

1. **ProxyGeneral.sol:** ✅ Nessuna modifica
   - Già supporta `authorizedModules` mapping
   - Già ha `withdrawToken()` e `depositToken()`
   - Aggiungere solo: `authorizeModule(protocolManager, "ProtocolManager")`

2. **Beacon.sol:** ✅ Nessuna modifica
   - Già supporta registrazione moduli
   - Aggiungere solo: `registerModule("ProtocolManager", address)`

3. **LiquidityManager / SwapManager:** ✅ Nessuna modifica
   - Operano indipendentemente
   - ProtocolManager è modulo parallelo

4. **DolomitePlugin.sol:** ⚠️ **MODIFICHE RICHIESTE**
   - Implementare `IProtocolManager` interface
   - Implementare `ILendingProtocol` interface
   - Modificare custody flow (return tokens to ProxyGeneral)
   - Dettagli in Phase 3

**Nuovi contratti da creare:**

1. **ProtocolManager.sol** - Manager unificato
2. **interfaces/IProtocolManager.sol** - Base interface
3. **interfaces/ILendingProtocol.sol** - Lending extension

**Contratti NON necessari per Dolomite (futuri):**
- ~~interfaces/IYieldProtocol.sol~~ (Pendle)
- ~~interfaces/ITradingProtocol.sol~~ (GMX)
- ~~interfaces/IDolomiteLendingProtocol.sol~~ (protocol-specific layer 3 - opzionale)

**Gas cost analysis (stimato):**

| Operation | Current (direct) | With ProtocolManager | Overhead |
|-----------|-----------------|---------------------|----------|
| deposit() | 80k gas | 95k gas | +15k gas |
| borrow() | 120k gas | 140k gas | +20k gas |
| repay() | 100k gas | 115k gas | +15k gas |
| executeProtocolCall() | N/A | base + 10k | +10k gas |

**Overhead breakdown:**
- Beacon resolution: ~3k gas
- ProxyGeneral withdrawToken: ~5k gas
- Interface call overhead: ~5k gas
- Event emission: ~2k gas

**Security considerations:**

1. **Access control:**
   - ✅ ProtocolManager: `onlyOwner` su tutte le funzioni (futuro multi-sig)
   - ✅ ProxyGeneral: `authorizedModules[protocolManager]` required
   - ✅ Nessun timelock (operazioni immediate)
   - ⚠️ Plugins: NON devono avere `onlyOwner` (chiamati da ProtocolManager, non da owner)

2. **Reentrancy:**
   - ✅ ProtocolManager: no state changes (stateless orchestrator)
   - ✅ DolomitePlugin: ReentrancyGuard se necessario
   - ⚠️ Dolomite protocol: assume non-reentrant (validare in tests)

3. **Token accounting:**
   - ✅ Strict pre/post balance checks in DolomitePlugin
   - ✅ ProxyGeneral custody always verified
   - ⚠️ Dust accumulation: sweep functions in plugin

4. **Upgrade strategy:**
   - ✅ ProtocolManager upgradeable (TransparentUpgradeableProxy pattern)
   - ✅ DolomitePlugin upgradeable via Beacon
   - ⚠️ State migration plan documented per upgrade

---

## TODO

### Phase 1: Foundation & Interfaces (1 giorno)

- [ ] **T1.1** - Creare struttura directory
  ```
  contracts/
  ├── ProtocolManager.sol
  └── interfaces/
      ├── IProtocolManager.sol
      └── ILendingProtocol.sol
  ```

- [ ] **T1.2** - Implementare `IProtocolManager.sol` (base interface)
  - Definire: deposit(), withdraw(), getBalance(), getTotalValue()
  - Definire: getProtocolInfo(), emergencyWithdrawAll()
  - NatSpec completo per ogni funzione
  - Events: ProtocolOperationExecuted

- [ ] **T1.3** - Implementare `ILendingProtocol.sol` (extends IProtocolManager)
  - Definire: borrow(), repay(), getDebt()
  - Definire: getHealthFactor(), getBorrowCapacity()
  - NatSpec completo

- [ ] **T1.4** - Code review interfaces
  - Verificare naming consistency
  - Validare parameter types (string vs bytes32 per tokenCode?)
  - Check gas optimization opportunities

---

### Phase 2: ProtocolManager Core (2 giorni)

- [ ] **T2.1** - Creare `ProtocolManager.sol` skeleton
  - Constructor con Beacon address
  - Imports: Ownable, IBeacon, IProxyGeneral
  - State variables: immutable beacon
  - Events definition

- [ ] **T2.2** - Implementare common operations
  - `deposit(protocolName, tokenCode, amount)`
    1. Resolve plugin via Beacon
    2. Withdraw from ProxyGeneral to plugin
    3. Delegate to plugin.deposit()
    4. Emit event
  - `withdraw(protocolName, tokenCode, amount)`
    1. Resolve plugin
    2. Delegate to plugin.withdraw() (plugin returns to ProxyGeneral)
    3. Emit event
  - `getBalance(protocolName, tokenCode) view`
  - `getTotalValue(protocolName) view`

- [ ] **T2.3** - Implementare lending operations
  - `borrow(protocolName, tokenCode, amount)`
  - `repay(protocolName, tokenCode, amount)`
    1. Withdraw repayment tokens from ProxyGeneral
    2. Delegate to plugin.repay()
  - `getDebt(protocolName, tokenCode) view`
  - `getHealthFactor(protocolName) view`

- [ ] **T2.4** - Implementare `executeProtocolCall()` + whitelist dinamica
  - Aggiungere state: `mapping(address => mapping(bytes4 => bool)) public allowedSelectors`
  - Implementare `setAllowedSelectors(protocolName, selectors[], allowed)`
  - Generic low-level call: `protocolPlugin.call(data)` con validation selector
  - Validation: `require(allowedSelectors[plugin][selector], "Selector not allowed")`
  - Error handling: require(success, "Protocol call failed")
  - Extract function selector per event
  - Emit ProtocolSpecificCallExecuted + SelectorAllowanceChanged
  - **✅ WHITELIST OBBLIGATORIA** - testare estensivamente in Phase 4

- [ ] **T2.5** - Implementare emergency functions
  - `emergencyWithdrawAll(protocolName, tokenCodes[])`
  - Event logging

- [ ] **T2.6** - Add internal helpers
  - `_resolvePlugin(protocolName) internal view returns (address)`
  - `_validateProtocol(address) internal view returns (bool)`
  - `_getProxyGeneral() internal view returns (address)`

- [ ] **T2.7** - NatSpec documentation completo
  - Contract-level documentation
  - Function-level documentation con esempi Dolomite
  - Parameter descriptions
  - Return value descriptions

- [ ] **T2.8** - Code review ProtocolManager
  - Security audit (access control, reentrancy, overflow)
  - Gas optimization
  - Error messages clarity

---

### Phase 3: DolomitePlugin Refactoring (2 giorni)

- [ ] **T3.1** - Modificare DolomitePlugin.sol per implementare interfaces
  - Add: `contract DolomitePlugin is ILendingProtocol, ISwapPlugin`
  - Implementare funzioni IProtocolManager (deposit, withdraw, getBalance, getTotalValue)
  - Implementare funzioni ILendingProtocol (borrow, repay, getDebt, getHealthFactor)

- [ ] **T3.2** - Refactor custody flow in DolomitePlugin
  - **deposit(tokenCode, amount):**
    ```solidity
    function deposit(string memory tokenCode, uint256 amount) external returns (bool) {
        // Expect tokens already in this contract (sent by ProtocolManager)
        address tokenAddr = _resolveToken(tokenCode);
        uint256 balance = IERC20(tokenAddr).balanceOf(address(this));
        require(balance >= amount, "Insufficient balance");
        
        // Deposit to Dolomite
        uint256 marketId = dolomiteMargin.getMarketIdByTokenAddress(tokenAddr);
        IERC20(tokenAddr).approve(address(depositRouter), amount);
        depositRouter.depositWei(0, MAIN_ACCOUNT, marketId, amount, EventFlag.None);
        
        return true;
    }
    ```

- [ ] **T3.3** - Refactor borrow/repay to return tokens to ProxyGeneral
  - **borrow(tokenCode, amount):**
    ```solidity
    function borrow(string memory tokenCode, uint256 amount) external returns (bool) {
        // Borrow from Dolomite (MAIN_ACCOUNT)
        address tokenAddr = _resolveToken(tokenCode);
        uint256 marketId = dolomiteMargin.getMarketIdByTokenAddress(tokenAddr);
        
        // Build Operation (Withdraw action to create debt)
        Account.Info[] memory accounts = new Account.Info[](1);
        accounts[0] = Account.Info(address(this), MAIN_ACCOUNT);
        
        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](1);
        actions[0] = Actions.ActionArgs({
            actionType: Actions.ActionType.Withdraw,
            accountId: 0,
            amount: TypesExtended.AssetAmount({
                sign: false,
                denomination: TypesExtended.AssetDenomination.Wei,
                ref: TypesExtended.AssetReference.Delta,
                value: amount
            }),
            primaryMarketId: marketId,
            secondaryMarketId: 0,
            otherAddress: address(this),
            otherAccountId: 0,
            data: ""
        });
        
        dolomiteMargin.operate(accounts, actions);
        
        // Transfer borrowed tokens to ProxyGeneral
        address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
        IERC20(tokenAddr).safeTransfer(proxyGeneral, amount);
        
        return true;
    }
    ```

- [ ] **T3.4** - Mantenere funzioni Dolomite-specific esistenti
  - `openBorrowPosition(collateralToken, amount)` - crea isolated position
  - `borrowFromPosition(accountNum, token, amount)` - borrow da isolated
  - `repayBorrowPosition(accountNum, token, amount)` - repay isolated
  - `closeBorrowPosition(accountNum, tokens[])` - chiudi isolated
  - `executeFlashLoan(token, amount, callback, data)` - flash loan
  - Aggiusta custody: expect tokens in contract, return to ProxyGeneral
  - **NON** richiedere msg.sender check (chiamate da ProtocolManager via executeProtocolCall)

- [ ] **T3.5** - Implementare view functions
  - `getBalance(tokenCode) → uint256` (Dolomite deposits)
  - `getDebt(tokenCode) → uint256` (Dolomite debt su MAIN_ACCOUNT)
  - `getHealthFactor() → uint256` (calcolare da Dolomite account data)
  - `getTotalValue() → uint256` (sum all deposits in ETH equivalent)
  - `getProtocolInfo() → (name, version, isActive)`
  - `getBorrowCapacity(tokenCode) → uint256`

- [ ] **T3.6** - Add emergency function
  - `emergencyWithdrawAll(tokenCodes[]) → bool`
  - Withdraw all positions from Dolomite (MAIN_ACCOUNT + all isolated accounts)
  - Transfer everything to ProxyGeneral

- [ ] **T3.7** - Update DolomitePlugin tests
  - Modificare test per chiamare via ProtocolManager
  - Test custody flow (ProxyGeneral → ProtocolManager → DolomitePlugin)
  - Verificare token accounting
  - Test isolated borrow positions via executeProtocolCall

---

### Phase 4: Testing & Validation (2 giorni)

- [ ] **T4.1** - Unit tests: ProtocolManager
  - Test deploy e initialization
  - Test access control (onlyOwner)
  - Test plugin resolution (Beacon mock)
  - Test deposit/withdraw flow (ProxyGeneral mock)
  - **✅ Test whitelist (OBBLIGATORIO):**
    - Test setAllowedSelectors: add/remove selectors
    - Test executeProtocolCall con selector allowed (success)
    - Test executeProtocolCall con selector NOT allowed (revert)
    - Test setAllowedSelectors unauthorized (revert onlyOwner)
    - Test whitelist per multiple protocols (isolation)
  - Test executeProtocolCall with various Dolomite functions (dopo whitelist config)

- [ ] **T4.2** - Unit tests: DolomitePlugin (refactored)
  - Test IProtocolManager functions
  - Test ILendingProtocol functions
  - Test custody flow (tokens in → operations → tokens out to ProxyGeneral)
  - Test Dolomite-specific functions (openBorrowPosition, etc.)

- [ ] **T4.3** - Integration tests: ProtocolManager + DolomitePlugin
  - Deploy full stack (Beacon, ProxyGeneral, ProtocolManager, DolomitePlugin)
  - Register modules in Beacon
  - Authorize ProtocolManager in ProxyGeneral
  - Test full workflow:
    1. Deposit WETH to ProxyGeneral (via LiquidityManager)
    2. ProtocolManager.deposit("DolomitePlugin", "WETH", 1e18)
    3. Verify WETH on Dolomite
    4. ProtocolManager.borrow("DolomitePlugin", "USDC", 1000e6)
    5. Verify USDC in ProxyGeneral
    6. ProtocolManager.repay("DolomitePlugin", "USDC", 1000e6)
    7. ProtocolManager.withdraw("DolomitePlugin", "WETH", 1e18)
    8. Verify WETH back in ProxyGeneral

- [ ] **T4.4** - Integration tests: Dolomite isolated positions
  - Test openBorrowPosition via executeProtocolCall
  - Test borrowFromPosition
  - Test repayBorrowPosition
  - Test closeBorrowPosition
  - Verify isolated account separation

- [ ] **T4.5** - Integration tests: Dolomite flash loans
  - Deploy mock flash loan callback contract
  - Test executeFlashLoan via executeProtocolCall
  - Verify flash loan repayment
  - Test failed flash loan (insufficient repayment)

- [ ] **T4.6** - Fork tests: Arbitrum mainnet
  - Fork Arbitrum One (Dolomite production contracts)
  - Deploy ProtocolManager + DolomitePlugin
  - Test real Dolomite integration
  - Test all operations con real liquidity
  - Monitor gas costs

- [ ] **T4.7** - Edge case tests
  - Test insufficient balance scenarios
  - Test protocol not found (Beacon returns address(0))
  - Test unauthorized caller (not owner)
  - Test reentrancy attempts
  - Test token accounting errors (balance mismatch)

- [ ] **T4.8** - Gas profiling
  - Measure gas costs per operation
  - Compare vs direct plugin calls (baseline)
  - Optimize hotspots se overhead > 30k gas

---

### Phase 5: Documentation & Deployment Prep (1 giorno)

- [ ] **T5.1** - Creare `docs/23_ProtocolManager/DOLOMITE_INTEGRATION.md`
  - Diagramma architettura completo
  - Interface hierarchy spiegato
  - Custody flow dettagliato per Dolomite
  - Esempi uso: deposit, borrow, isolated positions, flash loans
  - Security considerations

- [ ] **T5.2** - Aggiornare DEPLOYMENT_CHECKLIST.md
  - Pre-deployment checks
  - Deployment sequence:
    1. Deploy ProtocolManager (proxy + implementation)
    2. Register in Beacon
    3. Authorize in ProxyGeneral
    4. Deploy DolomitePlugin (refactored)
    5. Register in Beacon
    6. **[SE WHITELIST]** Configure allowed selectors
  - Post-deployment verification
  - Rollback plan

- [ ] **T5.3** - Creare deployment scripts
  - `scripts/deployProtocolManager.ts`
  - `scripts/registerProtocolManagerInBeacon.ts`
  - `scripts/authorizeProtocolManagerInProxyGeneral.ts`
  - `scripts/deployDolomitePluginRefactored.ts`
  - `scripts/configureWhitelist.ts` (se implementata)

- [ ] **T5.4** - Security audit preparation
  - Documentare assumptions
  - Threat model: owner compromesso, reentrancy, token accounting
  - Attack vectors analysis
  - Mitigation strategies implemented

---

## Success Criteria

**Phase 1-3 (Foundation + Implementation):**
- ✅ ProtocolManager compiles without errors
- ✅ IProtocolManager + ILendingProtocol interfaces defined e documented
- ✅ DolomitePlugin refactored e conforms to ILendingProtocol
- ✅ Custody flow: ProxyGeneral → ProtocolManager → DolomitePlugin → Dolomite → ProxyGeneral
- ✅ executeProtocolCall supporta tutte le funzioni Dolomite-specific

**Phase 4 (Testing):**
- ✅ 100% test coverage su ProtocolManager core functions
- ✅ Integration tests pass (full workflow deposit → borrow → repay → withdraw)
- ✅ Integration tests pass (isolated positions: open → borrow → repay → close)
- ✅ Integration tests pass (flash loans: execute → callback → repay)
- ✅ Fork tests pass con Dolomite mainnet contracts
- ✅ Gas overhead < 20k gas per operation (acceptable threshold)

**Phase 5 (Docs + Deployment):**
- ✅ Dolomite integration documentation complete
- ✅ Deployment scripts tested su testnet (Arbitrum Sepolia)
- ✅ Deployment checklist validated

**Production Readiness:**
- ✅ Security audit completato (internal review minimo)
- ✅ No critical/high findings
- ✅ Testnet deployment successful (Arbitrum Sepolia)
- ✅ Mainnet deployment plan validated
- ✅ Emergency procedures documented e testati

---

## Notes

**Key Decisions Made:**
1. Unified ProtocolManager vs separate managers → **Unified wins** (scalability, maintainability)
2. Interface stratificata (2 layer per Dolomite) → **IProtocolManager + ILendingProtocol**
3. Generic executeProtocolCall per funzioni Dolomite-specific → **Hybrid approach**
4. ProxyGeneral custody → **Sempre centralizzato**
5. ~~Timelock~~ → **Rimosso** (incompatibile con trading istantaneo)
6. Whitelist selectors → **✅ DINAMICA, IMPLEMENTATA** (obbligatoria, testare prima di deploy)

**Pending Decisions:**
1. **[T1.4]** TokenCode as `string` vs `bytes32`? 
   - Current: `string` (più leggibile, compatibile con esistente)
   - Alternative: `bytes32` (gas optimization ~2k gas per call)
   - **Raccomandazione:** Mantenere `string` per consistency con SwapManager

**Scope Limitato (Dolomite Only):**
- ❌ NON creare IYieldProtocol (Pendle - futuro)
- ❌ NON creare ITradingProtocol (GMX - futuro)
- ❌ NON creare IDolomiteLendingProtocol (layer 3 - opzionale, può essere aggiunto dopo)
- ❌ NON creare templates per altri protocolli (Aave, Pendle - futuro)
- ✅ Architettura scalabile permette aggiungere protocolli senza modificare ProtocolManager

**Dependencies:**
- OpenZeppelin Contracts: v4.9.0+ (Ownable, IERC20, SafeERC20)
- Hardhat: testing framework
- Existing contracts: Beacon, ProxyGeneral, TokenManager (no modifications)
- Dolomite Protocol: mainnet addresses (DolomiteMargin, DepositRouter, BorrowRouter)

**Timeline Estimate (Focus Dolomite):**
- Phase 1: 1 giorno (interfaces)
- Phase 2: 2 giorni (ProtocolManager core)
- Phase 3: 2 giorni (DolomitePlugin refactor)
- Phase 4: 2 giorni (testing completo)
- Phase 5: 1 giorno (docs + deployment)
- **Total: 8 giorni development time**

**Next Steps After Dolomite:**
1. Validate architecture con primo protocollo funzionante
2. Security audit
3. Mainnet deployment
4. Aggiungere protocolli futuri (Aave, Pendle, GMX):
   - Creare IYieldProtocol se necessario
   - Creare plugin-specific interfaces (layer 3)
   - Deploy + register plugin
   - Configure whitelist (se attiva)
   - **ZERO modifiche a ProtocolManager**
