# Piano Strategico: ProtocolManager Unificato

## Analisi

### Contesto

**Situazione attuale:**
- Sistema con 8 smart contract core (Beacon, ProxyGeneral, TokenManager, SwapManager, LiquidityManager-ETH/USDC/WBTC, ParameterManager, ValueCalculator)
- SwapManager gestisce DEX plugins (Uniswap, Camelot) per operazioni di swap pure
- DolomitePlugin implementato con chiamate dirette (bypass architettura core)
- Necessità di integrare protocolli complessi: Dolomite (lending), Pendle (yield), Aave (lending), GMX (trading)
- **Problema architetturale:** ogni protocollo complesso richiederebbe un manager dedicato (DolomiteBorrowManager, PendleYieldManager, AaveLendingManager, ecc.)

**Obiettivo proposto:**
Creare un **ProtocolManager unificato** che:
1. Gestisca TUTTI i protocolli non-swap (lending, yield, trading)
2. Fornisca interfaccia comune per operazioni base (deposit, withdraw, borrow, repay)
3. Supporti operazioni protocol-specific via chiamate generiche
4. Mantenga custody centralizzato (ProxyGeneral)
5. Riduca proliferazione di manager (9°, 10°, 11° contratto core...)

### Vincoli / Requisiti

**Vincoli tecnici:**
1. ✅ **Non modificare 8 contratti core esistenti** - solo aggiunta 9° contratto (ProtocolManager)
2. ✅ **Custody SEMPRE ProxyGeneral** - token flow: ProxyGeneral ↔ ProtocolManager ↔ Plugin ↔ External Protocol
3. ✅ **Access control: onlyOwner** - solo owner può eseguire operazioni protocollo
4. ✅ **Beacon resolution** - ProtocolManager e Plugin registrati in Beacon
5. ✅ **Backward compatibility** - SwapManager continua a gestire DEX plugins indipendentemente
6. ✅ **Gas efficiency** - minimizzare proxy calls, evitare storage ridondante

**Requisiti funzionali:**
1. **Operazioni comuni:** deposit, withdraw, getBalance, getTotalValue (tutti i protocolli)
2. **Operazioni lending:** borrow, repay, getDebt, getHealthFactor (lending protocols)
3. **Operazioni specifiche:** chiamate custom via `executeProtocolCall()` con abi.encode
4. **Multi-protocol support:** gestire N protocolli contemporaneamente (Dolomite + Aave + Pendle + ...)
5. **Emergency functions:** emergencyWithdrawAll per recupero fondi

**Requisiti non funzionali:**
1. **Estensibilità:** aggiungere nuovo protocollo senza modificare ProtocolManager
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
     - ✅ **Whitelist function selectors dinamica** (configurabile runtime, nessun redeploy)
     - ✅ Event logging dettagliato per audit trail (tracciamento completo operazioni)
     - ❌ ~~Timelock~~ (rimosso - incompatibile con trading istantaneo)

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
     - Direct plugin calls per operazioni frequenti (se necessario)
     - Gas profiling pre-deployment

**Rischi implementativi:**

5. **🟡 MEDIO - Protocol-specific edge cases**
   - Ogni protocollo ha quirks (Dolomite account numbers, Aave rate modes, Pendle maturity)
   - **Rischio:** logica generica non copre casi specifici
   - **Mitigazione:**
     - Plugin gestiscono logica specifica
     - ProtocolManager è thin wrapper (orchestrazione, non business logic)
     - Extensive integration tests per ogni protocollo

6. **🟡 MEDIO - Upgrade path**
   - Come aggiornare ProtocolManager senza interrompere servizio?
   - **Rischio:** downtime, loss of positions/tracking
   - **Mitigazione:**
     - ProtocolManager è upgradeable (proxy pattern)
     - State migration strategy documentata
     - Gradual rollout (testnet → mainnet, protocollo per protocollo)

**Incertezze:**

- **Dolomite API stability:** depositRouter/borrowRouter potrebbero cambiare → aggiornare IDolomite interface
- **Performance multi-protocol:** latenza con 5+ protocolli attivi → profiling richiesto
- **User experience:** owner deve conoscere function signatures per executeProtocolCall → tool/UI necessario

---

## Strategia

### Approccio scelto: **Interfaccia Stratificata con Generic Fallback**

**Architettura a 3 layer:**

```
Layer 1: IProtocolManager (base comune)
    ↓ estende
Layer 2: ILendingProtocol / IYieldProtocol / ITradingProtocol (categorie)
    ↓ estende
Layer 3: Protocol-specific interfaces (IDolomiteLending, IAaveLending, IPendleYield)
```

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

**Per operazioni specifiche:**

```
1. Owner chiama ProtocolManager.executeProtocolCall(
       "DolomitePlugin",
       abi.encodeWithSignature("openBorrowPosition(string,uint256)", "WETH", 5e17)
   )
   ↓
2. ProtocolManager.executeProtocolCall():
   - Resolve: dolomitePlugin = Beacon.getImplementation("DolomitePlugin")
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

### Alternative e trade-off

**ALTERNATIVA A: Manager separati (status quo proposto)**

```
DolomiteBorrowManager.sol
PendleYieldManager.sol
AaveLendingManager.sol
GmxTradingManager.sol
```

**Pro:**
- ✅ Type safety completo (no generic calls)
- ✅ Logica business specifica nel manager
- ✅ Codice più leggibile (funzioni dedicate)

**Contro:**
- ❌ Proliferazione contratti (9°, 10°, 11°, 12°...)
- ❌ Codice duplicato (deposit/withdraw in ogni manager)
- ❌ Complessità deployment (N manager da registrare in Beacon)
- ❌ Gas overhead (N manager = N authorization checks)

**Verdict:** ❌ Rifiutata - troppo boilerplate, difficile mantenere

---

**ALTERNATIVA B: ProtocolManager unificato (SCELTA)**

```
ProtocolManager.sol (unico manager)
+ IProtocolManager (interface base)
+ ILendingProtocol / IYieldProtocol (extensions)
+ executeProtocolCall() per operazioni custom
```

**Pro:**
- ✅ Single entry point (semplifica architettura)
- ✅ Riuso codice operazioni comuni
- ✅ Facile aggiungere protocolli (solo plugin + interface)
- ✅ Gas efficiente (authorization check unico)

**Contro:**
- ⚠️ Generic calls meno type-safe (runtime errors)
- ⚠️ Richiede tool/UI per costruire abi.encode
- ⚠️ Documentazione critica per operazioni custom

**Verdict:** ✅ Scelta - pro > contro, flessibilità essenziale

---

**ALTERNATIVA C: Hybrid (common + specific)**

```
ProtocolManager.sol (operazioni comuni)
+ DolomiteBorrowExtension.sol (operazioni specifiche Dolomite)
+ PendleYieldExtension.sol (operazioni specifiche Pendle)
```

**Pro:**
- ✅ Type safety per operazioni specifiche
- ✅ Single manager per operazioni comuni

**Contro:**
- ❌ Complessità architetturale (manager + extensions)
- ❌ Ancora proliferazione contratti (hybrid worst of both worlds)

**Verdict:** ❌ Rifiutata - troppo complesso

---

### Motivazioni scelta finale

**Perché ProtocolManager unificato con interface stratificate:**

1. **Scalabilità:** aggiungere Pendle/Aave/GMX richiede solo:
   - Deploy plugin contract
   - Registra in Beacon
   - Implementa interfacce appropriate
   - **ZERO modifiche a ProtocolManager**

2. **Manutenibilità:** codice comune (deposit, withdraw, borrow, repay) in un unico posto
   - Bug fix → impatta tutti i protocolli
   - Security audit → focus su single contract

3. **Gas efficiency:** owner approval unico (ProxyGeneral.authorizedModules[protocolManager] = true)
   - Vs. N manager = N approval checks

4. **User experience:** interfaccia unificata
   - Owner impara pattern: `deposit(protocol, token, amount)`
   - Invece di: DolomiteBorrowManager.deposit vs AaveLendingManager.supply (nomi diversi)

5. **Future-proof:** supporta protocolli futuri con operazioni impreviste
   - executeProtocolCall() = escape hatch per qualsiasi funzione
   - Non richiede upgrade ProtocolManager per ogni nuovo protocollo

---

## Documentazione

### Schema logico / architetturale

```
┌────────────────────────────────────────────────────────────────┐
│                        USER / OWNER                            │
│                    (EOA con ownership)                         │
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
                ┌──────────────┼──────────────┐
                │              │              │
                ▼              ▼              ▼
┌───────────────────┐  ┌───────────────┐  ┌──────────────┐
│ DEX PLUGINS       │  │LENDING PLUGINS│  │YIELD PLUGINS │
│ (SwapManager)     │  │(ProtocolMgr)  │  │(ProtocolMgr) │
├───────────────────┤  ├───────────────┤  ├──────────────┤
│ UniswapV3Plugin   │  │DolomitePlugin │  │PendlePlugin  │
│ CamelotPlugin     │  │AavePlugin     │  │              │
│ OdosPlugin        │  │CompoundPlugin │  │              │
└───────────────────┘  └───────────────┘  └──────────────┘
        │                      │                  │
        │                      │                  │
        ▼                      ▼                  ▼
┌───────────────────┐  ┌───────────────┐  ┌──────────────┐
│ Uniswap V3        │  │ Dolomite      │  │ Pendle       │
│ Protocol          │  │ Protocol      │  │ Protocol     │
└───────────────────┘  └───────────────┘  └──────────────┘
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
│  │  Internal:                                         │    │
│  │  - _resolvePlugin(protocolName) → address          │    │
│  │  - _validateProtocol(address) → bool               │    │
│  │  - _executeWithChecks(address, bytes) → bytes      │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  Events:                                                     │
│  - ProtocolOperationExecuted(protocol, op, token, amount)   │
│  - ProtocolSpecificCallExecuted(protocol, selector, data)   │
│  - ProtocolRegistered(protocolName, pluginAddress)          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

### Interface Hierarchy

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

    ↓ extends

IDolomiteLendingProtocol
├─ [inherits all ILendingProtocol]
├─ openBorrowPosition(collateralToken, amount) → uint256
├─ borrowFromPosition(accountNum, token, amount)
├─ closeBorrowPosition(accountNum, tokens[])
└─ executeFlashLoan(token, amount, callback, data)

---

IProtocolManager (base)
    ↓ extends
IYieldProtocol
├─ [inherits all IProtocolManager]
├─ stake(tokenCode, amount) → uint256
├─ unstake(tokenCode, amount) → uint256
└─ claimRewards() → uint256

    ↓ extends

IPendleYieldProtocol
├─ [inherits all IYieldProtocol]
├─ tokenize(token, amount, maturity) → (ptAmount, ytAmount)
├─ swapYTforPT(ytToken, amount) → uint256
├─ redeemPT(ptToken, amount) → uint256
└─ addLiquidity(market, ptAmount, syAmount) → uint256
```

---

### API / Interfacce

**ProtocolManager.sol - Public API:**

```solidity
// ========== COMMON OPERATIONS ==========

function deposit(
    string memory protocolName,  // "DolomitePlugin", "AavePlugin", etc.
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

function getProtocolInfo(
    string memory protocolName
) external view returns (
    string memory name,
    string memory version,
    bool isActive
);

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

// ========== GENERIC OPERATIONS ==========

function executeProtocolCall(
    string memory protocolName,
    bytes calldata data           // abi.encodeWithSignature(...)
) external onlyOwner returns (bytes memory returnData);

// ========== EMERGENCY ==========

function emergencyWithdrawAll(
    string memory protocolName,
    string[] memory tokenCodes
) external onlyOwner;
```

---

**Usage Examples:**

```solidity
// Example 1: Deposit to Dolomite
protocolManager.deposit("DolomitePlugin", "WETH", 1 ether);

// Example 2: Borrow from Dolomite
protocolManager.borrow("DolomitePlugin", "USDC", 1000e6);

// Example 3: Open isolated borrow position (protocol-specific)
bytes memory data = abi.encodeWithSignature(
    "openBorrowPosition(string,uint256)",
    "WETH",
    5e17
);
bytes memory result = protocolManager.executeProtocolCall("DolomitePlugin", data);
uint256 accountNumber = abi.decode(result, (uint256));

// Example 4: Pendle tokenize (protocol-specific)
bytes memory data = abi.encodeWithSignature(
    "tokenize(string,uint256,uint256)",
    "WETH",
    1 ether,
    1735689600  // maturity: 2025-01-01
);
bytes memory result = protocolManager.executeProtocolCall("PendlePlugin", data);
(uint256 ptAmount, uint256 ytAmount) = abi.decode(result, (uint256, uint256));

// Example 5: Get total value across all protocols
uint256 dolomiteValue = protocolManager.getTotalValue("DolomitePlugin");
uint256 aaveValue = protocolManager.getTotalValue("AavePlugin");
uint256 pendleValue = protocolManager.getTotalValue("PendlePlugin");
uint256 totalValue = dolomiteValue + aaveValue + pendleValue;
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
   - Current code:
     ```solidity
     // ❌ WRONG (current)
     IERC20(borrowToken).safeTransfer(msg.sender, borrowAmount);
     
     // ✅ CORRECT (new)
     address proxyGeneral = IBeacon(beacon).getImplementation("ProxyGeneral");
     IERC20(borrowToken).safeTransfer(proxyGeneral, borrowAmount);
     ```

**Nuovi contratti da creare:**

1. **ProtocolManager.sol** - Manager unificato
2. **interfaces/IProtocolManager.sol** - Base interface
3. **interfaces/ILendingProtocol.sol** - Lending extension
4. **interfaces/IYieldProtocol.sol** - Yield extension
5. **interfaces/ITradingProtocol.sol** - Trading extension
6. **interfaces/IDolomiteLendingProtocol.sol** - Dolomite-specific (extends ILendingProtocol)
7. **interfaces/IProtocolPlugin.sol** - Common plugin interface (optional, for consistency)

**Gas cost analysis (estimato):**

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
   - ✅ ProtocolManager: `onlyOwner` su tutte le funzioni
   - ✅ ProxyGeneral: `authorizedModules[protocolManager]` required
   - ⚠️ Plugins: NON devono avere `onlyOwner` (chiamati da ProtocolManager, non da owner)

2. **Reentrancy:**
   - ✅ ProtocolManager: no state changes (stateless orchestrator)
   - ✅ Plugins: gestiscono reentrancy (ReentrancyGuard se necessario)
   - ⚠️ External protocols: assume non-reentrant (validare per ciascuno)

3. **Token accounting:**
   - ✅ Strict pre/post balance checks in plugins
   - ✅ ProxyGeneral custody always verified
   - ⚠️ Dust accumulation: sweep functions in plugins

4. **Upgrade strategy:**
   - ✅ ProtocolManager upgradeable (TransparentUpgradeableProxy pattern)
   - ✅ Plugins upgradeable via Beacon
   - ⚠️ State migration plan documented per upgrade

---

## TODO

### Phase 1: Foundation & Interfaces (1-2 giorni)

- [ ] **T1.1** - Creare struttura directory
  ```
  contracts/
  ├── ProtocolManager.sol
  └── interfaces/
      ├── IProtocolManager.sol
      ├── ILendingProtocol.sol
      ├── IYieldProtocol.sol
      ├── ITradingProtocol.sol
      └── IDolomiteLendingProtocol.sol
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

- [ ] **T1.4** - Implementare `IDolomiteLendingProtocol.sol` (extends ILendingProtocol)
  - Definire: openBorrowPosition(), borrowFromPosition()
  - Definire: closeBorrowPosition(), executeFlashLoan()
  - NatSpec completo con esempi Dolomite-specific

- [ ] **T1.5** - Implementare `IYieldProtocol.sol` (extends IProtocolManager)
  - Definire: stake(), unstake(), claimRewards()
  - Definire operazioni base yield farming
  - Preparare per Pendle integration

- [ ] **T1.6** - Code review interfaces
  - Verificare naming consistency
  - Validare parameter types (string vs bytes32 per tokenCode?)
  - Check gas optimization opportunities

---

### Phase 2: ProtocolManager Core (2-3 giorni)

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

- [ ] **T2.4** - Implementare `executeProtocolCall()`
  - Generic low-level call: `protocolPlugin.call(data)`
  - Error handling: require(success, "Protocol call failed")
  - Extract function selector per event
  - Emit ProtocolSpecificCallExecuted
  - Security consideration: validare selector whitelist? (optional)

- [ ] **T2.5** - Implementare emergency functions
  - `emergencyWithdrawAll(protocolName, tokenCodes[])`
  - Circuit breaker pattern (pause flag?)
  - Event logging

- [ ] **T2.6** - Add internal helpers
  - `_resolvePlugin(protocolName) internal view returns (address)`
  - `_validateProtocol(address) internal view returns (bool)`
  - `_getProxyGeneral() internal view returns (address)`

- [ ] **T2.7** - NatSpec documentation completo
  - Contract-level documentation
  - Function-level documentation con esempi
  - Parameter descriptions
  - Return value descriptions

- [ ] **T2.8** - Code review ProtocolManager
  - Security audit (access control, reentrancy, overflow)
  - Gas optimization
  - Error messages clarity

---

### Phase 3: DolomitePlugin Refactoring (2-3 giorni)

- [ ] **T3.1** - Modificare DolomitePlugin.sol per implementare interfaces
  - Add: `contract DolomitePlugin is IDolomiteLendingProtocol, ISwapPlugin`
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
        // Borrow from Dolomite
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

- [ ] **T3.4** - Implementare protocol-specific functions (openBorrowPosition, etc.)
  - Mantieni funzioni esistenti
  - Aggiusta custody: expect tokens in contract, return to ProxyGeneral
  - Add validation: require chiamata da ProtocolManager (msg.sender check)

- [ ] **T3.5** - Implementare view functions
  - `getBalance(tokenCode) → uint256`
  - `getDebt(tokenCode) → uint256`
  - `getHealthFactor() → uint256` (calcolare da Dolomite account data)
  - `getTotalValue() → uint256` (sum all deposits in ETH equivalent)
  - `getProtocolInfo() → (name, version, isActive)`

- [ ] **T3.6** - Add emergency function
  - `emergencyWithdrawAll(tokenCodes[]) → bool`
  - Withdraw all positions from Dolomite
  - Transfer everything to ProxyGeneral

- [ ] **T3.7** - Update DolomitePlugin tests
  - Modificare test per chiamare via ProtocolManager
  - Test custody flow (ProxyGeneral → ProtocolManager → DolomitePlugin)
  - Verificare token accounting

---

### Phase 4: Testing & Validation (2-3 giorni)

- [ ] **T4.1** - Unit tests: ProtocolManager
  - Test deploy e initialization
  - Test access control (onlyOwner)
  - Test plugin resolution (Beacon mock)
  - Test deposit/withdraw flow (ProxyGeneral mock)
  - Test executeProtocolCall with various data

- [ ] **T4.2** - Unit tests: DolomitePlugin (refactored)
  - Test IProtocolManager functions
  - Test ILendingProtocol functions
  - Test custody flow (tokens in → operations → tokens out to ProxyGeneral)
  - Test protocol-specific functions (openBorrowPosition, etc.)

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

- [ ] **T4.4** - Fork tests: Arbitrum mainnet
  - Fork Arbitrum One (Dolomite production contracts)
  - Deploy ProtocolManager + DolomitePlugin
  - Test real Dolomite integration
  - Test open/borrow/repay/close borrow positions
  - Test flash loans
  - Monitor gas costs

- [ ] **T4.5** - Edge case tests
  - Test insufficient balance scenarios
  - Test protocol not found (Beacon returns address(0))
  - Test unauthorized caller (not owner)
  - Test reentrancy attempts
  - Test token accounting errors (balance mismatch)

- [ ] **T4.6** - Gas profiling
  - Measure gas costs per operation
  - Compare vs direct plugin calls (baseline)
  - Optimize hotspots se overhead > 30k gas

---

### Phase 5: Documentation & Deployment Prep (1-2 giorni)

- [ ] **T5.1** - Creare `docs/23_ProtocolManager/ARCHITECTURE.md`
  - Diagramma architettura completo
  - Interface hierarchy spiegato
  - Custody flow dettagliato
  - Security considerations

- [ ] **T5.2** - Creare `docs/23_ProtocolManager/INTEGRATION_GUIDE.md`
  - Come aggiungere nuovo protocollo
  - Template plugin contract
  - Interface da implementare
  - Testing checklist
  - Deployment steps

- [ ] **T5.3** - Creare `docs/23_ProtocolManager/API_REFERENCE.md`
  - Documentazione completa API ProtocolManager
  - Esempi uso per ogni funzione
  - Error codes e troubleshooting

- [ ] **T5.4** - Aggiornare DEPLOYMENT_CHECKLIST.md
  - Pre-deployment checks
  - Deployment sequence (Beacon → ProtocolManager → Plugin → Authorization)
  - Post-deployment verification
  - Rollback plan

- [ ] **T5.5** - Creare deployment scripts
  - `scripts/deployProtocolManager.ts`
  - `scripts/registerProtocolManagerInBeacon.ts`
  - `scripts/authorizeProtocolManagerInProxyGeneral.ts`
  - `scripts/deployAndRegisterDolomitePlugin.ts` (updated)

- [ ] **T5.6** - Security audit preparation
  - Documentare assumptions
  - Threat model
  - Attack vectors analysis
  - Mitigation strategies

---

### Phase 6: Future Protocols Integration (templates)

- [ ] **T6.1** - Creare template: `PendlePlugin.sol`
  - Implementa IPendleYieldProtocol
  - Custody flow corretto (ProxyGeneral in/out)
  - Funzioni: tokenize, swapYTforPT, redeemPT, addLiquidity
  - Interface con Pendle protocol (router, market, PT/YT tokens)

- [ ] **T6.2** - Creare template: `AavePlugin.sol`
  - Implementa IAaveLendingProtocol
  - Custody flow corretto
  - Funzioni: supply, borrow, repay, withdraw, setCollateral
  - Interface con Aave V3 (Pool, PoolDataProvider)

- [ ] **T6.3** - Documentare pattern reusable
  - Token resolution (address vs tokenCode)
  - Balance tracking (internal accounting)
  - Error handling (try/catch best practices)
  - Event emission (cosa tracciare)

---

### Risk Mitigation Checklist

- [x] **RM.1** - Whitelisting function selectors dinamica (implementare e testare prima di deploy)
- [ ] **RM.2** - Rate limiting per protocollo (max operations per hour - opzionale)
- [ ] **RM.4** - Circuit breaker global (pause all protocols in emergency)
- [ ] **RM.5** - Token sweep functions (recover stuck tokens in intermediari)
- [ ] **RM.6** - Monitoring system (off-chain tracking balance discrepancies)
- [ ] **RM.7** - Upgrade testing (state migration dry-run)

---

## Success Criteria

**Phase 1-3 (Foundation + Implementation):**
- ✅ ProtocolManager compiles without errors
- ✅ All interfaces defined e documented
- ✅ DolomitePlugin refactored e conforms to interfaces
- ✅ Custody flow: ProxyGeneral → ProtocolManager → Plugin → External Protocol → ProxyGeneral

**Phase 4 (Testing):**
- ✅ 100% test coverage su ProtocolManager core functions
- ✅ Integration tests pass (full workflow deposit → borrow → repay → withdraw)
- ✅ Fork tests pass con Dolomite mainnet contracts
- ✅ Gas overhead < 20k gas per operation (acceptable threshold)

**Phase 5-6 (Docs + Templates):**
- ✅ Architecture documentation complete
- ✅ Integration guide usable (developer può aggiungere nuovo protocollo in 1 giorno)
- ✅ Deployment scripts tested su testnet
- ✅ Template plugins creati (Pendle, Aave)

**Production Readiness:**
- ✅ Security audit completato (external auditor recommended)
- ✅ No critical/high findings
- ✅ Testnet deployment successful (Arbitrum Sepolia)
- ✅ Mainnet deployment plan validated
- ✅ Emergency procedures documented e testati

---

## Notes

**Key Decisions Made:**
1. Unified ProtocolManager vs separate managers → **Unified wins** (scalability, maintainability)
2. Interface stratificata vs flat interface → **Stratificata wins** (type safety + flexibility)
3. Generic executeProtocolCall vs only typed functions → **Hybrid wins** (common typed, specific generic)
4. ProxyGeneral custody vs plugin custody → **ProxyGeneral wins** (security, consistency)
5. ~~Timelock~~ → **Rimosso** (incompatibile con trading istantaneo)
6. Whitelist selectors → **Dinamica, da implementare e testare** (configurabile runtime)

**Open Questions for Review:**
1. Should executeProtocolCall have whitelist per protocol? (security vs flexibility trade-off)
2. TokenCode as `string` vs `bytes32`? (gas optimization)
3. Should plugins emit events or only ProtocolManager? (observability vs gas)
4. Upgrade strategy: TransparentProxy vs UUPS vs no upgradability? (flexibility vs risk)

**Dependencies:**
- OpenZeppelin Contracts: v4.9.0+ (Ownable, IERC20, SafeERC20)
- Hardhat: testing framework
- Existing contracts: Beacon, ProxyGeneral, TokenManager (no modifications)
- External protocols: Dolomite (mainnet addresses), Aave V3 (future), Pendle (future)

**Timeline Estimate:**
- Phase 1-2: 3-4 giorni (interfaces + core)
- Phase 3: 2-3 giorni (DolomitePlugin refactor)
- Phase 4: 2-3 giorni (testing)
- Phase 5: 1-2 giorni (docs + deployment)
- Phase 6: ongoing (future protocols)
- **Total: 8-12 giorni development time**