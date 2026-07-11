# 🏗️ Project4 Smart Contract Architecture Overview

> **Versione:** 1.0.0  
> **Ultima modifica:** Gennaio 2026  
> **Network:** Arbitrum One

---

## 📋 Indice

1. [Executive Summary](#-executive-summary)
2. [Architettura High-Level](#-architettura-high-level)
3. [Smart Contract Core](#-smart-contract-core)
4. [Moduli di Integrazione Protocolli](#-moduli-di-integrazione-protocolli)
5. [Pattern di Sicurezza](#-pattern-di-sicurezza)
6. [Flusso delle Operazioni](#-flusso-delle-operazioni)
7. [Diagrammi](#-diagrammi)

---

## 🎯 Executive Summary

Project4 è un **pool di liquidità DeFi modulare** su Arbitrum che:

- **Custodia centralizzata** degli asset tramite `ProxyGeneral`
- **Integrazione multi-protocollo** (Euler V2, Uniswap V3, GMX V2)
- **Architettura plugin-based** per estensibilità futura
- **Beacon pattern** per upgrade sicuri dei moduli

### Principi Architetturali

| Principio | Implementazione |
|-----------|-----------------|
| **Separation of Concerns** | Ogni contratto ha responsabilità singola |
| **Modularity** | Plugin sostituibili senza modificare il core |
| **Security First** | Multi-layer auth, timelock, circuit breakers |
| **Gas Efficiency** | Cache system, batch operations |

---

## 🏛️ Architettura High-Level

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           UTENTI (Depositor/LP Holders)                  │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         LAYER 1: ENTRY POINTS                           │
│  ┌─────────────────┐    ┌──────────────┐    ┌─────────────────────────┐ │
│  │ LiquidityManager│    │ SwapManager  │    │    ProtocolManager      │ │
│  │  (Deposit/With) │    │   (Swaps)    │    │ (Lending/Yield/Trading) │ │
│  └─────────────────┘    └──────────────┘    └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         LAYER 2: CORE INFRASTRUCTURE                    │
│  ┌────────────┐  ┌──────────────┐  ┌───────────┐  ┌────────────────────┐│
│  │  Beacon    │  │ ProxyGeneral │  │ TokenMgr  │  │  ParameterManager  ││
│  │ (Registry) │  │  (Custody)   │  │ (Registry)│  │   (Governance)     ││
│  └────────────┘  └──────────────┘  └───────────┘  └────────────────────┘│
│                                                                         │
│  ┌──────────────────┐  ┌─────────────────────┐  ┌──────────────────────┐│
│  │ ValueCalculator  │  │  EmergencyHandler   │  │   ChainlinkAdapter   ││
│  │  (Pricing)       │  │  (Safety)           │  │   (Oracle)           ││
│  └──────────────────┘  └─────────────────────┘  └──────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         LAYER 3: PROTOCOL PLUGINS                       │
│  ┌─────────────────────┐  ┌──────────────────┐  ┌──────────────────────┐│
│  │   EulerV2Plugin     │  │ UniswapV3Plugin  │  │    GMXv2Plugin       ││
│  │   (Lending)         │  │   (Swap)         │  │    (Trading)         ││
│  └─────────────────────┘  └──────────────────┘  └──────────────────────┘│
│                                                                         │
│  ┌─────────────────────┐  ┌──────────────────┐  ┌──────────────────────┐│
│  │  FlashLoanPlugin    │  │EulerVaultRegistry│  │  FlashLoanService    ││
│  │   (Leverage)        │  │   (Config)       │  │   (Balancer FL)      ││
│  └─────────────────────┘  └──────────────────┘  └──────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       PROTOCOLLI ESTERNI (Arbitrum)                     │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌─────────┐  ┌──────────┐│
│  │ Euler V2  │  │Uniswap V3 │  │  GMX V2   │  │Balancer │  │Chainlink ││
│  │  Lending  │  │   DEX     │  │  Trading  │  │  Flash  │  │  Oracle  ││
│  └───────────┘  └───────────┘  └───────────┘  └─────────┘  └──────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Smart Contract Core

### 1. Beacon (Registry Centrale)

**File:** `contracts/Beacon.sol`

Il Beacon è il **registro centrale** che mappa i nomi dei moduli ai loro indirizzi di implementazione.

```solidity
// Architettura Beacon
mapping(string => address) private implementations;
// Es: "ProxyGeneral" → 0x123...
//     "TokenManager" → 0x456...
//     "EulerV2Plugin" → 0x789...
```

**Funzionalità Chiave:**

| Funzione | Descrizione |
|----------|-------------|
| `updateImplementation(module, address)` | Aggiorna l'indirizzo di un modulo |
| `getImplementation(module)` | Ottiene l'indirizzo corrente di un modulo |
| `moduleFrozen[module]` | Freeze singolo modulo in emergenza |
| `globalFreeze` | Freeze globale di tutto il sistema |

**Sicurezza:**
- 2-step ownership transfer
- Implementation history per audit trail
- Freeze capability per singolo modulo o globale

---

### 2. ProxyGeneral (Custode Asset)

**File:** `contracts/ProxyGeneral.sol`

Il ProxyGeneral è il **custode centrale** di tutti gli asset del pool e l'emittente dei LP Token.

```solidity
// ProxyGeneral = ERC20 LP Token + Asset Custody
contract ProxyGeneral is ERC20, Ownable, ReentrancyGuard {
    mapping(address => bool) public authorizedModules;  // Moduli autorizzati
    bool public paused;                                  // Emergency pause
}
```

**Responsabilità:**

| Area | Funzione |
|------|----------|
| **LP Token** | `mint()`, `burn()` - Emissione/bruciatura LP token |
| **Asset Transfer** | `transferFunds()` - Trasferimento asset |
| **Approvals** | `approveSpender()` - Approvazione spender per swap |
| **Rate Limiting** | `checkRateLimit()`, `trackOperation()` - Limiti operazioni |
| **Emergency** | `paused` flag per fermare tutto il sistema |

**Flusso Custody:**
```
Utente → LiquidityManager → ETH→WETH → ProxyGeneral (custody)
                                              │
              ┌───────────────────────────────┘
              ▼
    ┌─────────────────┐
    │   Asset Pool    │
    │  WETH + Tokens  │
    │  (nel Proxy)    │
    └─────────────────┘
```

---

### 3. TokenManager (Registry Token)

**File:** `contracts/TokenManager.sol`

Gestisce il **registro dei token** supportati e i loro metadati.

```solidity
struct TokenInfo {
    address tokenAddress;
    uint8 tokenDecimals;
    string tokenCode;
    bool isActive;
    uint256 lastPrice;
    uint256 heartbeat;
}
```

**Integrazione Oracle:**
- Utilizza `IOracleAdapter` per prezzi modulari
- Supporta Chainlink (implementato), Pyth (futuro)
- Heartbeat-based staleness detection

---

### 4. ValueCalculator (Calcolo Valore)

**File:** `contracts/ValueCalculator.sol`

Calcola il **valore totale del pool** per determinare il prezzo LP token.

**Funzionalità:**

| Funzione | Descrizione |
|----------|-------------|
| `calculateTokenValuePure()` | Calcola valore token (view) |
| `getTotalPoolValueView()` | Valore totale pool (WETH + Tokens) |
| `getTokenValueInfo()` | Breakdown valore per token |

**Cache System:**
```solidity
struct TokenValueCache {
    uint256 value;
    uint256 pricePerToken;
    uint256 timestamp;
    bool isValid;
}
// TTL: 5 minuti di default (configurabile)
```

---

### 5. ParameterManager (Governance)

**File:** `contracts/ParameterManager.sol`

Gestisce **parametri di sistema con timelock** per governance sicura.

**Parametri Gestiti:**

| Parametro | Default | Range | Timelock |
|-----------|---------|-------|----------|
| `maxDeposit` | 100 ETH | 1-1000 ETH | ✅ 24h |
| `maxWithdrawPerTx` | 50 ETH | 0.1-500 ETH | ✅ 24h |
| `maxSlippage` | 200 bps | 10-1000 bps | ✅ 24h |
| `cacheDuration` | 5 min | 1 min-1 hour | ❌ |
| `maxPriceAge` | 1 hour | 5 min-24 hours | ❌ |

**Governance Flow:**
```
proposeParameterChange() → [24h timelock] → executeProposedChange()
```

---

### 6. EmergencyHandler (Sicurezza)

**File:** `contracts/EmergencyHandler.sol`

Gestisce **procedure di emergenza** per l'intero sistema.

**Capabilities:**
- Emergency pause/unpause del sistema
- Emergency withdraw di tutti gli asset
- Timelock per unpause (min 1h, max 7 days)
- Emergency contacts con ruoli
- Asset snapshot per recovery

---

### 7. LiquidityManager (Entry Point Utenti)

**File:** `contracts/LiquidityManager.sol`

**Entry point principale** per depositi e prelievi.

```solidity
function deposit() external payable returns (uint256 lpTokens);
function withdraw(uint256 shares) external returns (uint256 ethAmount);
```

**Flusso Deposit:**
```
1. Utente invia ETH
2. Validazioni (min/max, rate limit)
3. Wrap ETH → WETH
4. Transfer WETH a ProxyGeneral
5. Calcolo shares proporzionali
6. Mint LP tokens a utente
```

**Flusso Withdraw:**
```
1. Utente specifica shares da bruciare
2. Validazioni (limiti, rate limit)
3. Calcolo ETH proporzionale
4. Se necessario: swap automatico token→WETH
5. Burn LP tokens
6. Transfer ETH a utente
```

---

### 8. SwapManager (Orchestratore Swap)

**File:** `contracts/SwapManager.sol`

**Orchestratore** per swap tra token tramite plugin.

**Plugin System:**
```solidity
string public activeSwapPlugin = "UniswapV3Plugin"; // Default

function setActiveSwapPlugin(string memory pluginName) external onlyOwner;
```

**Funzionalità:**
- Swap via plugin attivo (UniswapV3PluginDirect)
- Quote multi-plugin per best price
- Slippage protection
- Error tracking per pair

---

### 9. ProtocolManager (Orchestratore Protocolli)

**File:** `contracts/ProtocolManager.sol`

**Orchestratore centrale** per protocolli non-swap (lending, yield, trading).

```solidity
// 3 Musketeers Pattern
struct ProtocolInfo {
    address plugin;         // IProtocolAdapter implementation
    address lensAdapter;    // ILensAdapter implementation  
    address registry;       // Protocol-specific config
    bool isActive;
}
```

**Operazioni Standard:**

| Operazione | Descrizione |
|------------|-------------|
| `deposit()` | Deposita token in protocollo |
| `withdraw()` | Preleva token da protocollo |
| `borrow()` | Prende in prestito (lending) |
| `repay()` | Ripaga debito (lending) |
| `executeProtocolCall()` | Chiamata protocol-specific |

**Whitelist System:**
```solidity
// Whitelist dinamica per function selectors
mapping(address => mapping(bytes4 => bool)) public allowedSelectors;

// Configurazione runtime
setAllowedSelectors("EulerV2Plugin", selectors, true);
```

---

## 🔌 Moduli di Integrazione Protocolli

### Pattern "3 Musketeers"

Per ogni integrazione di protocollo, servono **3 componenti**:

```
┌────────────────┐   ┌────────────────┐   ┌────────────────┐
│     Plugin     │   │  LensAdapter   │   │    Registry    │
│  (IProtocol    │   │  (ILensAdapter)│   │  (Protocol     │
│   Adapter)     │   │                │   │   Config)      │
│                │   │  • getHealth() │   │  • Vault maps  │
│  • deposit()   │   │  • getValue()  │   │  • Token→Addr  │
│  • withdraw()  │   │  • getRisk()   │   │  • Settings    │
│  • borrow()    │   │                │   │                │
│  • repay()     │   │                │   │                │
└────────────────┘   └────────────────┘   └────────────────┘
```

---

### 1. EulerV2Plugin (Lending)

**File:** `contracts/plugins/EulerV2Plugin.sol`

**Integrazione Euler V2** per lending e leverage.

**Indirizzi Arbitrum:**
| Component | Address |
|-----------|---------|
| EVC | `0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066` |
| AccountLens | `0x90a52DDcb232e7bb003DD9258fA1235c553eC956` |
| WETH Vault | `0x78E3E051D32157AACD550fBB78458762d8f7edFF` |
| USDC Vault | `0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899` |

**Operazioni Supportate:**

```solidity
// Base Operations (ILendingProtocol)
function deposit(string memory tokenCode, uint256 amount) external;
function withdraw(string memory tokenCode, uint256 amount) external;
function borrow(string memory tokenCode, uint256 amount) external;
function repay(string memory tokenCode, uint256 amount) external;

// Leverage Operations (IEulerV2Plugin)
function openLeveragePosition(params) external returns (uint256 positionId);
function closeLeveragePosition(positionId, params) external;
```

**Sub-Account Model:**
```
Sub-Account 0: Depositi semplici (yield farming)
Sub-Account 1-255: Posizioni leverage isolate
```

---

### 2. EulerVaultRegistry

**File:** `contracts/plugins/EulerVaultRegistry.sol`

**Registry dinamico** per mappare token code a Euler Vault.

```solidity
// Mapping tokenCode → Euler Vault
setVault("WETH", 0x78E3E051D32157AACD550fBB78458762d8f7edFF);
setVault("USDC", 0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899);

// Usage
address vault = registry.getVault("WETH");
```

---

### 3. UniswapV3PluginDirect (Swap)

**File:** `contracts/plugins/UniswapV3PluginDirect.sol`

**Integrazione diretta Uniswap V3** per swap.

```solidity
// Implements ISwapPlugin (extends ISimpleSwap)
function inputSwap(
    address spendToken,
    address receiveToken,
    uint256 amountIn
) external returns (uint256 amountOut);

function getExpectedOutput(
    address spendToken,
    address receiveToken,
    uint256 amountIn
) external view returns (uint256 expectedOutput);
```

**Indirizzi Arbitrum:**
| Component | Address |
|-----------|---------|
| SwapRouter | `0xE592427A0AEce92De3Edee1F18E0157C05861564` |
| QuoterV2 | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` |

---

### 4. GMXv2Plugin (Trading)

**File:** `contracts/plugins/GMXv2Plugin.sol`

**Integrazione GMX V2** per GM token minting/burning.

> ⚠️ **Nota:** Non implementa `ISwapPlugin` standard perché GMX richiede `payable` per execution fees.

```solidity
// Async operations (GMX specific)
function createDeposit(
    address gmToken,
    address inputToken,
    uint256 inputAmount
) external payable returns (bytes32 depositKey);

function createWithdrawal(
    address gmToken,
    uint256 gmAmount,
    address outputToken
) external payable returns (bytes32 withdrawalKey);
```

**Indirizzi Arbitrum:**
| Component | Address |
|-----------|---------|
| ExchangeRouter | `0x7C68C7866A64FA2160F78EEaE12217FFbf871fa8` |
| Reader | `0xf60becbba223EEA9495Da3f606753867eC10d139` |
| DataStore | `0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8` |

---

### 5. FlashLoanService (Centralizzato)

**File:** `contracts/services/FlashLoanService.sol`

**Servizio centralizzato** per flash loan Balancer V2 (0% fee!).

```solidity
// Flow
function executeFlashLoan(
    address[] calldata tokens,
    uint256[] calldata amounts,
    bytes calldata callbackData
) external nonReentrant;
```

**Sicurezza Double-Layer:**
```
Layer 1 (Beacon Check): Solo plugin registrati possono chiamare
Layer 2 (Trust The Revert): Se plugin non ripaga, Balancer reverta tutto
```

---

### 6. FlashLoanPlugin (Leverage)

**File:** `contracts/plugins/FlashLoanPlugin.sol`

**Plugin per leverage atomico** su Euler V2 usando flash loans.

**Flusso Open Leverage:**
```
1. Flash loan WETH da Balancer
2. Deposit WETH in Euler come collaterale
3. Borrow USDC da Euler
4. Swap USDC → WETH via SimpleSwap
5. Ripaga flash loan con WETH swappato
```

**Flusso Close Leverage:**
```
1. Flash loan USDC da Balancer
2. Ripaga debito USDC su Euler
3. Withdraw WETH collaterale
4. Swap WETH → USDC
5. Ripaga flash loan
```

---

### 7. ChainlinkAdapter (Oracle)

**File:** `contracts/adapters/ChainlinkAdapter.sol`

**Adapter Chainlink** per prezzi on-chain.

```solidity
// Implements IOracleAdapter
function getPrice(string memory tokenCode) 
    external view returns (uint256 price, uint256 timestamp, bool isStale);

function supportsToken(string memory tokenCode) 
    external view returns (bool);
```

**Features:**
- Validazione completa Chainlink (roundId, updatedAt, answeredInRound)
- Circuit breaker per repeated failures
- Heartbeat-based staleness
- Conversione automatica denominazioni (USD→ETH)

---

## 🛡️ Pattern di Sicurezza

### Separazione Netta: Utente vs Admin

**Principio fondamentale**: L'utente può SOLO depositare e ritirare. L'admin gestisce la liquidità ma è VINCOLATO a operare esclusivamente entro strategie e token pre-autorizzati.

#### 👤 Utente (Depositante)
- **Può**: Depositare token → ricevere LP Token
- **Può**: Ritirare LP Token → ricevere quota proporzionale del pool
- **Non può**: Influenzare in alcun modo la gestione dei fondi
- **Non può**: Scegliere su quali protocolli allocare

L'utente interagisce con una "black box": deposita, riceve LP Token, ritira quando vuole.

#### 🔧 Admin/Operator (Gestore) - Vincolato al "Recinto"
L'admin può gestire la liquidità, **MA** ogni azione è vincolata:

| Vincolo | Descrizione |
|---------|-------------|
| Token Whitelist | Solo token registrati in TokenManager |
| Protocolli Registrati | Solo plugin presenti nel Beacon |
| Vault Censiti | Solo vault/pool mappati nei Registry |
| Funzioni Autorizzate | Solo selectors esplicitamente whitelistati |
| Timelock | Modifiche critiche richiedono 24h |

**Cosa l'admin NON può fare:**
- ❌ Trasferire fondi a indirizzi arbitrari
- ❌ Approvare token verso contratti non censiti
- ❌ Chiamare funzioni non whitelistate sui protocolli
- ❌ Aggiungere protocolli senza passare per governance

**Cosa l'admin PUÒ fare:**
- ✅ Muovere fondi tra il pool e protocolli già autorizzati
- ✅ Eseguire swap tra token whitelistati
- ✅ Ribilanciare posizioni esistenti
- ✅ Harvest yield da protocolli censiti

### Il "Recinto" di Sicurezza

```
┌───────────────────────────────────────────────────────────────┐
│                    PERIMETRO AUTORIZZATO                      │
│                                                               │
│  TokenManager: [WETH, USDC, ARB, WBTC, ...]                  │
│  Beacon: [EulerV2Plugin, UniswapPlugin, GMXv2Plugin, ...]    │
│  VaultRegistry: [eUSDC, eWETH, eARB, ...]                    │
│  Selectors: [deposit(), withdraw(), swap(), borrow(), ...]   │
│                                                               │
│        ✅ Admin può operare liberamente QUI DENTRO           │
└───────────────────────────────────────────────────────────────┘
                  ❌ Impossibile uscire dal recinto
```

### Gerarchia dei Ruoli

| Ruolo | Può fare | NON può fare |
|-------|----------|--------------|
| **Owner** | Registrare moduli, modificare parametri (con timelock 24h) | Bypassare timelock, prelevare fondi |
| **Operator** | Ribilanciare tra protocolli/token censiti, harvest | Aggiungere protocolli, modificare whitelist |
| **Guardian** | Attivare pausa emergenza | Operare sui fondi |
| **User** | Deposit/withdraw via LiquidityManager | Influenzare gestione liquidità |

### 1. Access Control

```solidity
// ProxyGeneral: Solo moduli autorizzati
modifier onlyAuthorizedModule() {
    require(authorizedModules[msg.sender] || msg.sender == owner());
    _;
}

// ProtocolManager: Whitelist selectors
require(allowedSelectors[plugin][selector], "Selector not allowed");

// TokenManager: Solo token censiti
require(tokenWhitelist[tokenCode], "Token not whitelisted");
```

### 2. Emergency System

```solidity
// Global pause
ProxyGeneral.paused = true;  // Ferma tutte le operazioni

// Module freeze
Beacon.moduleFrozen["EulerV2Plugin"] = true;  // Ferma singolo modulo

// Circuit breaker in plugin
EulerV2Plugin.circuitBreakerTripped = true;  // Ferma plugin
```

### 3. Rate Limiting

```solidity
// Per-user limits
struct RateLimit {
    uint256 hourlyLimit;
    uint256 dailyLimit;
    uint256 hourlyUsed;
    uint256 dailyUsed;
}
```

### 4. Timelock Governance

```solidity
// Parameter changes require 24h timelock
proposeParameterChange("maxDeposit", 200 ether);
// Wait 24 hours...
executeProposedChange("maxDeposit");
```

---

## 🔄 Flusso delle Operazioni

### 👤 Azioni Utente (Permissionless)

Le uniche due azioni che un utente può eseguire:

**Deposit Flow**

```
┌──────┐     ┌───────────────┐     ┌───────────────┐     ┌─────────────┐
│ User │────▶│LiquidityManager│────▶│  ProxyGeneral │────▶│ LP Token    │
│      │ ETH │               │WETH │   (custody)   │mint │   minted    │
└──────┘     └───────────────┘     └───────────────┘     └─────────────┘
```

**Withdraw Flow**

```
┌──────┐     ┌───────────────┐     ┌───────────────┐     ┌─────────────┐
│ User │◀────│LiquidityManager│◀────│  SwapManager  │◀────│ ProxyGeneral│
│      │ ETH │               │     │ Token→WETH    │     │   (custody) │
└──────┘     └───────────────┘     └───────────────┘     └─────────────┘
```

*L'utente NON può fare altro. Non può scegliere strategie, protocolli, token.*

---

### 🔧 Azioni Admin/Operator (Vincolate al Recinto)

Ogni operazione passa attraverso verifiche di whitelist/registry:

**Swap Flow** (solo token whitelistati)

```
┌──────────┐     ┌───────────┐     ┌─────────────────┐     ┌──────────┐
│ Operator │────▶│SwapManager│────▶│ [✓ verifica    │────▶│ Uniswap  │
│          │     │           │     │  token censiti]│     │   V3     │
└──────────┘     └───────────┘     └─────────────────┘     └──────────┘
```

**Lending Flow** (solo protocolli e vault censiti)

```
┌──────────────┐     ┌────────────────┐     ┌──────────────────┐     ┌────────────┐
│ProtocolManager│───▶│[✓ protocollo  │────▶│ [✓ vault in     │────▶│ Interest   │
│   deposit()  │     │   registrato] │     │    Registry]    │     │ Accrues    │
└──────────────┘     └────────────────┘     └──────────────────┘     └────────────┘
```

**Leverage Flow** (ogni step è vincolato)

```
┌──────────┐     ┌─────────────────┐     ┌──────────────────────────────────────┐
│ Operator │────▶│ FlashLoanService│────▶│ EulerV2Plugin                        │
│          │     │  (Balancer FL)  │     │   ✓ deposit collateral (vault OK)   │
│          │     │                 │     │   ✓ borrow (selector autorizzato)   │
│          │     │                 │     │   ✓ swap (token whitelistati)       │
│          │     │                 │     │   ✓ deposit extra (vault OK)        │
└──────────┘     └─────────────────┘     └──────────────────────────────────────┘
```

*L'admin può muoversi liberamente, ma SOLO dentro il "recinto" definito da whitelist e registry.*

---

## 📊 Diagrammi

### Dependency Graph

```
                    ┌──────────┐
                    │  Beacon  │
                    └────┬─────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
   ┌───────────┐  ┌────────────┐  ┌────────────────┐
   │ProxyGeneral│  │TokenManager│  │ParameterManager│
   └─────┬─────┘  └──────┬─────┘  └────────────────┘
         │               │
         │   ┌───────────┘
         │   │
         ▼   ▼
  ┌────────────────┐
  │ValueCalculator │
  └────────────────┘
         │
         │   ┌──────────────────┐
         │   │                  │
         ▼   ▼                  ▼
  ┌───────────────┐     ┌──────────────┐
  │LiquidityManager│     │ SwapManager │
  └───────────────┘     └──────────────┘
         │                     │
         └─────────┬───────────┘
                   │
                   ▼
          ┌──────────────────┐
          │ ProtocolManager  │
          └────────┬─────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
    ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│EulerV2   │  │Uniswap   │  │GMXv2     │
│Plugin    │  │V3Plugin  │  │Plugin    │
└──────────┘  └──────────┘  └──────────┘
```

### Interface Hierarchy

```
                 IProtocolManager (base)
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
ILendingProtocol  IYieldProtocol  ITradingProtocol
        │
        ▼
IEulerV2Plugin (Euler-specific extensions)

                 ISimpleSwap (base)
                       │
                       ▼
                 ISwapPlugin (metadata, health)
                       │
         ┌─────────────┼─────────────┐
         │             │             │
         ▼             ▼             ▼
  UniswapV3Plugin  CamelotPlugin  OdosPlugin
```

---

## 📝 Note Finali

### Stato Attuale

| Component | Status | Note |
|-----------|--------|------|
| Core Contracts | ✅ Completi | ProxyGeneral, Beacon, TokenManager, etc. |
| EulerV2Plugin | ✅ Completo | Lending + Leverage |
| UniswapV3Plugin | ✅ Completo | Direct integration |
| GMXv2Plugin | ⚠️ Parziale | Solo GM mint/burn, no perps |
| FlashLoanService | ✅ Completo | Balancer V2 |
| ChainlinkAdapter | ✅ Completo | Oracle prices |

### Prossimi Sviluppi

1. **DolomitePlugin** - Integrazione Dolomite lending
2. **Multi-chain** - Deployment su altre chain
3. **Governance Token** - Decentralizzazione governance
4. **Gnosis Safe** - Multi-sig per owner operations

---

> 📧 **Contatto Sicurezza:** security@project4.com  
> 📖 **Documentazione Dettagliata:** Vedi cartella `docs/`
