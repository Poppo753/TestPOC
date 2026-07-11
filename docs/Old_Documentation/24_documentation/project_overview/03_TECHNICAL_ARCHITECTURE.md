# 🔧 DeFi Protocol - Architettura Tecnica Dettagliata

> Documento tecnico completo che descrive l'architettura, i contratti, le interfacce e i pattern implementativi del protocollo.

---

## 📑 Indice

1. [Panoramica Architetturale](#1-panoramica-architetturale)
2. [Beacon Proxy Pattern](#2-beacon-proxy-pattern)
3. [Contratti Core](#3-contratti-core)
4. [Sistema Plugin](#4-sistema-plugin)
5. [Flussi di Dati](#5-flussi-di-dati)
6. [Sicurezza e Controlli](#6-sicurezza-e-controlli)
7. [Gas Optimization](#7-gas-optimization)
8. [Interfacce e ABI](#8-interfacce-e-abi)

---

## 1. Panoramica Architetturale

### 1.1 Design Principles

L'architettura segue questi principi fondamentali:

| Principio | Implementazione |
|-----------|-----------------|
| **Separation of Concerns** | Ogni contratto ha una responsabilità specifica |
| **Upgradeability** | Beacon Proxy Pattern per upgrade senza migrazione |
| **Modularity** | Plugin system per integrare nuovi protocolli |
| **Security First** | Rate limiting, pausability, emergency controls |
| **Gas Efficiency** | Caching, batch operations, optimized storage |

### 1.2 Diagramma Architetturale Completo

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    USER / DAPP LAYER                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │  Web3 App   │  │  Mobile App │  │   API/SDK   │  │  Bot/Script │  │   Indexer   │       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │
│         └────────────────┴────────────────┴────────────────┴────────────────┘              │
└───────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                                │ JSON-RPC
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    SMART CONTRACT LAYER                                     │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                      BEACON                                          │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐    │   │
│  │  │  Module Registry                                                             │    │   │
│  │  │  ├── MODULE_PROXY_GENERAL    → 0x...                                        │    │   │
│  │  │  ├── MODULE_LIQUIDITY_MGR    → 0x...                                        │    │   │
│  │  │  ├── MODULE_SWAP_MGR         → 0x...                                        │    │   │
│  │  │  ├── MODULE_TOKEN_MGR        → 0x...                                        │    │   │
│  │  │  ├── MODULE_VALUE_CALC       → 0x...                                        │    │   │
│  │  │  ├── MODULE_PARAM_MGR        → 0x...                                        │    │   │
│  │  │  ├── MODULE_EMERGENCY        → 0x...                                        │    │   │
│  │  │  └── MODULE_PROTOCOL_MGR     → 0x...                                        │    │   │
│  │  └─────────────────────────────────────────────────────────────────────────────┘    │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐    │   │
│  │  │  Freeze Controls: moduleFreeze[moduleId] → bool                              │    │   │
│  │  └─────────────────────────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                              │                                              │
│                                   getModuleAddress()                                        │
│                                              │                                              │
│       ┌──────────────────────────────────────┼───────────────────────────────────────┐     │
│       │                  │                   │                   │                   │     │
│       ▼                  ▼                   ▼                   ▼                   ▼     │
│  ┌──────────┐      ┌──────────┐        ┌──────────┐        ┌──────────┐        ┌────────┐ │
│  │  PROXY   │      │LIQUIDITY │        │   SWAP   │        │  TOKEN   │        │ VALUE  │ │
│  │ GENERAL  │      │ MANAGER  │        │ MANAGER  │        │ MANAGER  │        │  CALC  │ │
│  │          │      │          │        │          │        │          │        │        │ │
│  │ Storage: │      │ Storage: │        │ Storage: │        │ Storage: │        │Storage:│ │
│  │•LP token │      │•WETH bal │        │•Plugins  │        │•Tokens[] │        │•Cache  │ │
│  │•Supply   │      │•Deposits │        │•Routes   │        │•Oracles  │        │•Prices │ │
│  │•Limits   │      │•Fees     │        │•Slippage │        │•Feeds    │        │•Totals │ │
│  └──────────┘      └──────────┘        └──────────┘        └──────────┘        └────────┘ │
│       │                  │                   │                   │                   │     │
│       │                  │                   │                   │                   │     │
│  ┌────┴──────────────────┴───────────────────┴───────────────────┴───────────────────┴┐   │
│  │                                                                                     │   │
│  │   ┌──────────┐            ┌──────────┐            ┌──────────────┐                 │   │
│  │   │ PARAM    │            │EMERGENCY │            │  PROTOCOL    │                 │   │
│  │   │ MANAGER  │            │ HANDLER  │            │   MANAGER    │                 │   │
│  │   │          │            │          │            │              │                 │   │
│  │   │ Storage: │            │ Storage: │            │ Storage:     │                 │   │
│  │   │•Proposals│            │•Paused   │            │•Protocols[]  │                 │   │
│  │   │•Timelock │            │•Contacts │            │•PluginMap    │                 │   │
│  │   │•Params   │            │•Snapshots│            │•LensMap      │                 │   │
│  │   └──────────┘            └──────────┘            └──────┬───────┘                 │   │
│  │                                                          │                          │   │
│  └──────────────────────────────────────────────────────────┼──────────────────────────┘   │
│                                                              │                              │
│                                   ┌──────────────────────────┴───────────────────────────┐ │
│                                   │             PROTOCOL REGISTRY                         │ │
│                                   │                                                       │ │
│                                   │  ┌─────────────────────────────────────────────────┐ │ │
│                                   │  │ "Euler" → {                                     │ │ │
│                                   │  │   plugin: EulerV2Plugin (0x...)                 │ │ │
│                                   │  │   lensAdapter: EulerLensAdapter (0x...)         │ │ │
│                                   │  │   registry: EulerVaultRegistry (0x...)          │ │ │
│                                   │  │   enabled: true                                 │ │ │
│                                   │  │ }                                               │ │ │
│                                   │  ├─────────────────────────────────────────────────┤ │ │
│                                   │  │ "GMX" → {                                       │ │ │
│                                   │  │   plugin: GMXv2Plugin (0x...)                   │ │ │
│                                   │  │   lensAdapter: GMXLensAdapter (0x...)           │ │ │
│                                   │  │   registry: GMXRegistry (0x...)                 │ │ │
│                                   │  │   enabled: true                                 │ │ │
│                                   │  │ }                                               │ │ │
│                                   │  └─────────────────────────────────────────────────┘ │ │
│                                   └───────────────────────────────────────────────────────┘ │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
                               ┌────────────────┼────────────────┐
                               ▼                ▼                ▼
                        ┌────────────┐   ┌────────────┐   ┌────────────┐
                        │   EULER    │   │    GMX     │   │   AAVE     │
                        │   V2       │   │    V2      │   │   V3       │
                        │ (on-chain) │   │ (on-chain) │   │ (on-chain) │
                        └────────────┘   └────────────┘   └────────────┘
```

---

## 2. Beacon Proxy Pattern

### 2.1 Come Funziona

Il **Beacon Proxy Pattern** permette di aggiornare l'implementazione di tutti i moduli senza migrare lo storage:

```
┌─────────────────────────────────────────────────────────────────┐
│                        BEFORE UPGRADE                            │
│                                                                  │
│   Beacon ──→ Implementation V1                                  │
│      ↑                                                          │
│   Proxy ──→ reads implementation from Beacon                    │
│      │                                                          │
│   Storage (unchanged)                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                         UPGRADE
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        AFTER UPGRADE                             │
│                                                                  │
│   Beacon ──→ Implementation V2 (NEW!)                           │
│      ↑                                                          │
│   Proxy ──→ now reads V2, same address!                         │
│      │                                                          │
│   Storage (PRESERVED!)                                          │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Beacon.sol - Funzioni Chiave

```solidity
// Module Registration
function registerModule(bytes32 moduleId, address implementation) external onlyOwner;

// Module Resolution
function getModuleAddress(bytes32 moduleId) external view returns (address);

// Module Freeze (emergency)
function freezeModule(bytes32 moduleId) external onlyOwner;
function unfreezeModule(bytes32 moduleId) external onlyOwner;

// System Health
function isSystemHealthy() external view returns (bool);
```

### 2.3 Module IDs

```solidity
bytes32 constant MODULE_PROXY_GENERAL    = keccak256("PROXY_GENERAL");
bytes32 constant MODULE_LIQUIDITY_MGR    = keccak256("LIQUIDITY_MANAGER");
bytes32 constant MODULE_SWAP_MGR         = keccak256("SWAP_MANAGER");
bytes32 constant MODULE_TOKEN_MGR        = keccak256("TOKEN_MANAGER");
bytes32 constant MODULE_VALUE_CALC       = keccak256("VALUE_CALCULATOR");
bytes32 constant MODULE_PARAM_MGR        = keccak256("PARAMETER_MANAGER");
bytes32 constant MODULE_EMERGENCY        = keccak256("EMERGENCY_HANDLER");
bytes32 constant MODULE_PROTOCOL_MGR     = keccak256("PROTOCOL_MANAGER");
```

---

## 3. Contratti Core

### 3.1 ProxyGeneral.sol

**Responsabilità**: Gestione LP token e accounting centrale.

```solidity
// LP Token (ERC20)
string public name = "Enhanced Liquidity Pool Token";
string public symbol = "ELPT";
uint8 public decimals = 18;

// Core State
mapping(address => uint256) public balanceOf;
uint256 public totalSupply;

// Rate Limiting
mapping(address => uint256[24]) public hourlyWithdrawals;  // 24-hour sliding window
uint256 public dailyWithdrawLimit;
uint256 public hourlyWithdrawLimit;

// Key Functions
function mint(address to, uint256 amount) external onlyModule;
function burn(address from, uint256 amount) external onlyModule;
function getRemainingDailyLimit(address user) external view returns (uint256);
```

**Storage Layout**:
| Slot | Variable | Type |
|------|----------|------|
| 0 | owner | address |
| 1 | beacon | address |
| 2 | totalSupply | uint256 |
| 3 | balanceOf | mapping |
| 4-27 | hourlyWithdrawals | mapping |
| 28 | dailyWithdrawLimit | uint256 |
| 29 | hourlyWithdrawLimit | uint256 |

---

### 3.2 LiquidityManager.sol

**Responsabilità**: Entry point per depositi e prelievi utente.

```solidity
// State
uint256 public wethBalance;           // Idle WETH in contract
uint256 public depositFee;            // 0-500 (0-5%)
uint256 public withdrawFee;           // 0-500 (0-5%)
uint256 public minDeposit;
uint256 public maxDeposit;

// Main Functions
function deposit() external payable returns (uint256 lpAmount);
function depositWeth(uint256 amount) external returns (uint256 lpAmount);
function withdraw(uint256 lpAmount) external returns (uint256 ethAmount);
function withdrawToToken(uint256 lpAmount, string calldata tokenCode) external;

// Admin Functions
function allocateToProtocol(string calldata protocol, uint256 amount, bytes calldata data) external onlyOwner;
function setFees(uint256 _depositFee, uint256 _withdrawFee) external onlyOwner;
```

**Flusso Deposito**:
```
1. User calls deposit() with ETH
2. ETH → WETH (wrap)
3. Calculate fee: actualDeposit = amount - fee
4. Calculate LP tokens: lpAmount = actualDeposit * totalSupply / totalValue
5. Mint LP tokens to user
6. Emit Deposited(user, amount, lpAmount)
```

**Flusso Prelievo con Auto-Close**:
```
1. User calls withdraw(lpAmount)
2. Calculate ETH value: ethAmount = lpAmount * totalValue / totalSupply
3. Check wethBalance >= ethAmount
4. IF NOT: call ProtocolManager.closePositionsForWeth(shortage)
5. Burn LP tokens
6. Transfer ETH to user
7. Emit Withdrawn(user, lpAmount, ethAmount)
```

---

### 3.3 SwapManager.sol

**Responsabilità**: Esecuzione swap con protezione slippage.

```solidity
// State
address public defaultRouter;
mapping(address => bool) public approvedRouters;
uint256 public maxSlippage = 500;  // 5%

// Swap Functions
function executeSwap(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    address router,
    bytes calldata routerData
) external onlyModule returns (uint256 amountOut);

function executeSwapSimple(
    address tokenIn,
    address tokenOut,
    uint256 amountIn
) external onlyModule returns (uint256 amountOut);

// Quote
function getSwapQuote(
    address tokenIn,
    address tokenOut,
    uint256 amountIn
) external view returns (uint256 expectedOut);
```

**Swap Plugins Supportati**:
| Plugin | Protocollo | Status |
|--------|------------|--------|
| `UniswapV3PluginDirect` | Uniswap V3 | ✅ |
| `FlashLoanPlugin` | Balancer Flash Loans | ✅ |
| `SimpleSwap` | Mock per testing | ✅ |

---

### 3.4 TokenManager.sol

**Responsabilità**: Whitelist token e integrazione oracle.

```solidity
// State
mapping(string => TokenInfo) public tokens;
string[] public tokenCodes;

struct TokenInfo {
    address tokenAddress;
    address priceFeed;      // Chainlink
    uint8 decimals;
    bool isActive;
    uint256 stalePriceThreshold;
}

// Functions
function addToken(
    string calldata code,
    address tokenAddress,
    address priceFeed,
    uint8 decimals,
    uint256 stalePriceThreshold
) external onlyOwner;

function getTokenPrice(string calldata code) external view returns (uint256 price, uint8 decimals);
function isTokenActive(string calldata code) external view returns (bool);
function getActiveTokens() external view returns (string[] memory);
```

**Validazione Prezzo**:
```solidity
function _validatePrice(address priceFeed, uint256 staleThreshold) internal view returns (uint256) {
    (, int256 price, , uint256 updatedAt, ) = AggregatorV3Interface(priceFeed).latestRoundData();
    require(price > 0, "Invalid price");
    require(block.timestamp - updatedAt <= staleThreshold, "Stale price");
    return uint256(price);
}
```

---

### 3.5 ValueCalculator.sol

**Responsabilità**: Calcolo valore portafoglio e selezione token per swap.

```solidity
// State
uint256 public lastCacheUpdate;
uint256 public cachedTotalValue;
uint256 public cacheValidityPeriod = 60;  // seconds

// Core Functions
function getTotalPoolValue() external view returns (uint256);
function getTokenValue(string calldata code) external view returns (uint256);
function getUserValue(address user) external view returns (uint256);

// Intelligent Token Selection
function selectTokenForSwap(uint256 targetValue) external view returns (
    string memory tokenCode,
    uint256 amount
);
```

**Algoritmo selectTokenForSwap**:
```
1. Calcola valore totale portafoglio
2. Per ogni token, calcola percentuale sul totale
3. Ordina per percentuale (crescente)
4. Seleziona token con percentuale minore
5. Aggiungi 10% buffer per slippage
6. Verifica balance sufficiente
7. Ritorna (tokenCode, amount)

Complessità: O(n log n) per n token
```

---

### 3.6 ParameterManager.sol

**Responsabilità**: Governance con timelock per parametri di sistema.

```solidity
// State
uint256 public timelockPeriod = 24 hours;
mapping(bytes32 => Proposal) public proposals;

struct Proposal {
    bytes32 paramId;
    uint256 newValue;
    uint256 proposedAt;
    bool executed;
    bool cancelled;
}

// Governance Flow
function proposeParameterChange(bytes32 paramId, uint256 newValue) external onlyOwner;
function executeProposal(bytes32 proposalId) external onlyOwner;
function cancelProposal(bytes32 proposalId) external onlyOwner;

// Emergency Override (only when paused)
function emergencySetParameter(bytes32 paramId, uint256 newValue) external onlyOwner;
```

**Parametri Configurabili**:
| Param ID | Default | Range | Descrizione |
|----------|---------|-------|-------------|
| `DEPOSIT_FEE` | 0 | 0-500 | Fee deposito (basis points) |
| `WITHDRAW_FEE` | 0 | 0-500 | Fee prelievo (basis points) |
| `MIN_DEPOSIT` | 0.01 ETH | 0-∞ | Deposito minimo |
| `MAX_DEPOSIT` | 1000 ETH | 0-∞ | Deposito massimo |
| `DAILY_LIMIT` | 100 ETH | 0-∞ | Limite prelievo giornaliero |
| `SLIPPAGE_MAX` | 500 | 0-1000 | Slippage massimo (10%) |

---

### 3.7 EmergencyHandler.sol

**Responsabilità**: Controlli di emergenza e recovery.

```solidity
// State
bool public paused;
mapping(uint256 => AssetSnapshot) public snapshots;
uint256 public snapshotCount;
mapping(address => EmergencyContact) public emergencyContacts;

struct AssetSnapshot {
    uint256 timestamp;
    uint256 totalValue;
    TokenBalance[] balances;
}

// Emergency Functions
function pause() external onlyOwnerOrContact;
function unpause() external onlyOwner;
function emergencyWithdrawAll() external onlyOwner whenPaused;

// Snapshots
function createAssetSnapshot() external returns (uint256 snapshotId);
function getAssetSnapshot(uint256 id) external view returns (AssetSnapshot memory);

// Contacts
function addEmergencyContact(address contact, string calldata role) external onlyOwner;
function removeEmergencyContact(address contact) external onlyOwner;
```

---

### 3.8 ProtocolManager.sol

**Responsabilità**: Orchestrazione multi-protocollo.

```solidity
// State
string[] public protocolNames;
mapping(string => ProtocolInfo) public protocols;

struct ProtocolInfo {
    address plugin;
    address lensAdapter;
    address registry;
    bool enabled;
}

// Registration
function registerProtocol(
    string calldata name,
    address plugin,
    address lensAdapter,
    address registry
) external onlyOwner;

// Aggregation
function getTotalProtocolsValue() external view returns (uint256);
function getAllPositionsSortedByRisk() external view returns (Position[] memory);

// Auto-Close for Withdrawals
function closePositionsForWeth(uint256 wethNeeded) external onlyModule returns (uint256 wethObtained);
```

---

## 4. Sistema Plugin

### 4.1 I "Tre Moschettieri"

Per ogni protocollo DeFi integrato, servono 3 componenti:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PLUGIN ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                           1️⃣ PLUGIN                                   │   │
│  │                      (Write Operations)                               │   │
│  │                                                                       │   │
│  │  interface IPlugin {                                                  │   │
│  │      function deposit(address token, uint256 amount) external;        │   │
│  │      function withdraw(address token, uint256 amount) external;       │   │
│  │      function openLeveragePosition(bytes calldata params) external;   │   │
│  │      function closeLeveragePosition(uint256 positionId) external;     │   │
│  │      function addCollateral(uint256 positionId, uint256 amt) external;│   │
│  │  }                                                                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        2️⃣ LENS ADAPTER                               │   │
│  │                      (Read Operations)                                │   │
│  │                                                                       │   │
│  │  interface ILensAdapter {                                             │   │
│  │      function getTotalValue() external view returns (uint256);        │   │
│  │      function getHealthFactor(uint256 posId) external view → uint256; │   │
│  │      function getPositions() external view returns (Position[] mem);  │   │
│  │      function getPositionsSortedByRisk() external view → Position[];  │   │
│  │      function shouldAutoClose(uint256 posId) external view → bool;    │   │
│  │      function estimateWethFromCloseAll() external view → uint256;     │   │
│  │  }                                                                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         3️⃣ REGISTRY                                   │   │
│  │                      (Configuration)                                  │   │
│  │                                                                       │   │
│  │  interface IRegistry {                                                │   │
│  │      function getVaultAddress(string calldata token) → address;       │   │
│  │      function getSupportedTokens() external view → string[] memory;   │   │
│  │      function isTokenSupported(address token) → bool;                 │   │
│  │      function getProtocolConfig() external view → bytes memory;       │   │
│  │  }                                                                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 EulerV2Plugin.sol

```solidity
contract EulerV2Plugin is IPlugin {
    IEVC public immutable evc;
    
    struct LeveragePosition {
        uint256 id;
        address subAccount;
        address collateralVault;
        address debtVault;
        uint256 collateralAmount;
        uint256 debtAmount;
        uint256 leverage;
    }
    
    mapping(uint256 => LeveragePosition) public positions;
    uint256 public nextPositionId;
    
    function openLeveragePosition(
        address collateralToken,
        uint256 collateralAmount,
        uint256 leverage,
        address debtToken
    ) external returns (uint256 positionId) {
        // 1. Create sub-account on EVC
        // 2. Deposit collateral to vault
        // 3. Borrow debt token
        // 4. Swap debt → collateral via 1inch
        // 5. Deposit swapped collateral
        // 6. Record position
    }
    
    function closeLeverageAtomic(uint256 positionId) external returns (uint256 wethReturned) {
        // 1. Flash loan to repay debt
        // 2. Withdraw collateral
        // 3. Swap collateral → debt token
        // 4. Repay flash loan
        // 5. Return remaining WETH
    }
}
```

### 4.3 Aggiungere un Nuovo Protocollo

Per integrare un nuovo protocollo (es. Aave V3):

```solidity
// 1. Implementa Plugin
contract AaveV3Plugin is IPlugin {
    function deposit(...) external { ... }
    function withdraw(...) external { ... }
}

// 2. Implementa LensAdapter
contract AaveLensAdapter is ILensAdapter {
    function getTotalValue() external view returns (uint256) { ... }
    function getPositions() external view returns (Position[] memory) { ... }
}

// 3. Implementa Registry
contract AaveRegistry is IRegistry {
    function getVaultAddress(string calldata token) external view returns (address) { ... }
}

// 4. Registra nel ProtocolManager
protocolManager.registerProtocol(
    "Aave",
    aavePlugin,
    aaveLensAdapter,
    aaveRegistry
);
```

---

## 5. Flussi di Dati

### 5.1 Calcolo Valore Totale

```
┌─────────────────────────────────────────────────────────────────┐
│                    VALUE CALCULATION FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ValueCalculator.getTotalPoolValue()                            │
│         │                                                        │
│         ├──→ wethBalance (LiquidityManager)                     │
│         │                                                        │
│         ├──→ ProtocolManager.getTotalProtocolsValue()           │
│         │         │                                              │
│         │         ├──→ EulerLensAdapter.getTotalValue()         │
│         │         │         └──→ Euler EVaults (on-chain)       │
│         │         │                                              │
│         │         ├──→ GMXLensAdapter.getTotalValue()           │
│         │         │         └──→ GMX Reader (on-chain)          │
│         │         │                                              │
│         │         └──→ AaveLensAdapter.getTotalValue()          │
│         │                   └──→ Aave Pool (on-chain)           │
│         │                                                        │
│         └──→ SUM = Total Pool Value in ETH                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Auto-Close per Prelievi

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTO-CLOSE FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User: withdraw(15 ETH)                                         │
│         │                                                        │
│         ▼                                                        │
│  LiquidityManager:                                              │
│    • wethBalance = 2 ETH                                        │
│    • shortage = 13 ETH                                          │
│         │                                                        │
│         ▼                                                        │
│  ProtocolManager.closePositionsForWeth(13 ETH)                  │
│         │                                                        │
│         ├──→ getAllPositionsSortedByRisk()                      │
│         │    [                                                   │
│         │      {id: 0, protocol: "Euler", hf: 1.2, value: 5 ETH}│
│         │      {id: 1, protocol: "GMX", hf: 1.5, value: 4 ETH}  │
│         │      {id: 2, protocol: "Aave", hf: 2.0, value: 6 ETH} │
│         │    ]                                                   │
│         │                                                        │
│         ├──→ Close position 0 (Euler, riskiest) → 5 ETH        │
│         ├──→ Close position 1 (GMX) → 4 ETH                     │
│         ├──→ Close position 2 (Aave) → 4 ETH (partial)          │
│         │                                                        │
│         └──→ Total recovered: 13 ETH ✓                          │
│                                                                  │
│  LiquidityManager:                                              │
│    • wethBalance = 2 + 13 = 15 ETH                              │
│    • Transfer 15 ETH to user ✓                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Sicurezza e Controlli

### 6.1 Access Control

| Funzione | Chi può chiamarla |
|----------|-------------------|
| `deposit()` | Chiunque |
| `withdraw()` | Holder LP token |
| `addToken()` | Owner |
| `registerProtocol()` | Owner |
| `pause()` | Owner o Emergency Contact |
| `emergencyWithdrawAll()` | Owner (solo quando paused) |
| Module-to-module calls | Solo moduli registrati |

### 6.2 Rate Limiting

```solidity
// 24-hour sliding window per user
mapping(address => uint256[24]) public hourlyWithdrawals;

function _checkRateLimit(address user, uint256 amount) internal {
    uint256 currentHour = block.timestamp / 1 hours;
    uint256 hourIndex = currentHour % 24;
    
    // Reset if new hour
    if (lastWithdrawHour[user] != currentHour) {
        hourlyWithdrawals[user][hourIndex] = 0;
    }
    
    // Check hourly limit
    require(hourlyWithdrawals[user][hourIndex] + amount <= hourlyLimit, "Hourly limit");
    
    // Check daily limit (sum of 24 hours)
    uint256 dailyTotal = 0;
    for (uint256 i = 0; i < 24; i++) {
        dailyTotal += hourlyWithdrawals[user][i];
    }
    require(dailyTotal + amount <= dailyLimit, "Daily limit");
    
    // Update tracking
    hourlyWithdrawals[user][hourIndex] += amount;
}
```

### 6.3 Reentrancy Protection

```solidity
// Pattern: Checks-Effects-Interactions
function withdraw(uint256 amount) external nonReentrant {
    // 1. CHECKS
    require(amount > 0, "Zero amount");
    require(balanceOf[msg.sender] >= amount, "Insufficient balance");
    
    // 2. EFFECTS (state changes BEFORE external calls)
    balanceOf[msg.sender] -= amount;
    totalSupply -= amount;
    
    // 3. INTERACTIONS (external calls LAST)
    (bool success, ) = msg.sender.call{value: ethAmount}("");
    require(success, "Transfer failed");
}
```

### 6.4 Emergency Controls

```
┌─────────────────────────────────────────────────────────────────┐
│                    EMERGENCY FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  NORMAL STATE                                                    │
│    │                                                             │
│    ▼                                                             │
│  emergencyHandler.pause()  ←── Owner or Emergency Contact       │
│    │                                                             │
│    ▼                                                             │
│  PAUSED STATE                                                    │
│    • Deposits: BLOCKED                                          │
│    • Withdrawals: BLOCKED                                       │
│    • Swaps: BLOCKED                                             │
│    • Parameter changes: emergencySetParameter() ALLOWED          │
│    │                                                             │
│    ├──→ emergencyWithdrawAll() ←── Owner only                   │
│    │    • Chiude TUTTE le posizioni                             │
│    │    • Recupera TUTTI gli asset                              │
│    │    • Prepara per recovery                                  │
│    │                                                             │
│    └──→ emergencyHandler.unpause() ←── Owner only               │
│         │                                                        │
│         ▼                                                        │
│  NORMAL STATE (restored)                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Gas Optimization

### 7.1 Tecniche Utilizzate

| Tecnica | Risparmio | Dove |
|---------|-----------|------|
| Packed storage | ~15% | Tutti i contratti |
| Caching | ~40% | ValueCalculator |
| Batch operations | ~30% | ProtocolManager |
| Short-circuit | ~10% | Validation checks |
| immutable/constant | ~20% | Addresses, config |

### 7.2 Benchmark Gas Costs

| Operazione | Gas Cost | Note |
|------------|----------|------|
| Deposit (ETH) | ~85,000 | Include wrap + mint |
| Withdraw (simple) | ~65,000 | Solo da idle |
| Withdraw (auto-close) | ~250,000+ | Dipende da posizioni |
| Swap (simple) | ~168,000 | Via UniswapV3 |
| Add token | ~45,000 | Storage write |
| Create snapshot | ~100,000+ | Dipende da token count |

---

## 8. Interfacce e ABI

### 8.1 Interfacce Principali

```
contracts/interfaces/
├── IBeacon.sol
├── IProxyGeneral.sol
├── ILiquidityManager.sol
├── ISwapManager.sol
├── ITokenManager.sol
├── IValueCalculator.sol
├── IParameterManager.sol
├── IEmergencyHandler.sol
├── IProtocolManager.sol
│
├── IPlugin.sol                    # Generic plugin interface
├── ILensAdapter.sol               # Generic lens interface
├── IRegistry.sol                  # Generic registry interface
│
├── IEulerV2Plugin.sol             # Euler-specific
├── IEulerLensAdapter.sol          # Euler-specific
├── IEulerVaultRegistry.sol        # Euler-specific
│
└── euler/                         # External Euler interfaces
    ├── IEVault.sol
    ├── IEVC.sol
    ├── IAccountLens.sol
    └── ISwapper.sol
```

### 8.2 Eventi Principali

```solidity
// LiquidityManager
event Deposited(address indexed user, uint256 amount, uint256 lpTokens);
event Withdrawn(address indexed user, uint256 lpTokens, uint256 amount);
event FeesCollected(uint256 depositFees, uint256 withdrawFees);

// SwapManager
event SwapExecuted(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
event SwapFailed(address tokenIn, address tokenOut, uint256 amountIn, string reason);

// ProtocolManager
event ProtocolRegistered(string name, address plugin, address lens, address registry);
event PositionOpened(string protocol, uint256 positionId, uint256 value);
event PositionClosed(string protocol, uint256 positionId, uint256 returned);

// EmergencyHandler
event Paused(address by, uint256 timestamp);
event Unpaused(address by, uint256 timestamp);
event EmergencyWithdrawExecuted(uint256 totalRecovered);
event SnapshotCreated(uint256 snapshotId, uint256 totalValue);
```

---

## 📚 Documenti Correlati

- **Overview**: `02_OVERVIEW.md`
- **Roadmap Fasi**: `04_PHASE_ROADMAP.md`
- **API Reference**: `../../dapp-new/api_reference_beacon.json`
- **Test Documentation**: `../02_testing/TEST_DOCUMENTATION_COMPLETE.md`

---

*Documento: 03_TECHNICAL_ARCHITECTURE.md | Ultimo aggiornamento: Gennaio 2026*
