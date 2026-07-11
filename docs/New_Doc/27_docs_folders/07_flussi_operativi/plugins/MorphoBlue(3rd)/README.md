# Morpho Blue Plugin — Documentazione Completa

> **Stato**: ✅ Deployed su Arbitrum One (Aprile 2026)  
> **Pattern**: 3 Musketeers (Registry + Plugin + LensAdapter) + FlashLoanService  
> **Protocollo esterno**: Morpho Blue — Isolated lending markets con singleton contract  
> **Estensione**: MorphoVaultPlugin — MetaMorpho ERC-4626 vault integration (supply-only, yield passivo)

---

## Indice

1. [Panoramica](#1-panoramica)
2. [Architettura e Flusso Token](#2-architettura-e-flusso-token)
3. [Concetti Chiave di Morpho Blue](#3-concetti-chiave-di-morpho-blue)
4. [Contratti Solidity](#4-contratti-solidity)
   - 4.1 [MorphoRegistry](#41-morphoregistry)
   - 4.2 [MorphoPlugin](#42-morphoplugin)
   - 4.3 [MorphoLensAdapter](#43-morpholensadapter)
   - 4.4 [MorphoVaultPlugin](#44-morphovaultplugin)
   - 4.5 [MorphoVaultLensAdapter](#45-morphovaultlensadapter)
5. [Interfacce](#5-interfacce)
6. [Script di Deploy e Operativi](#6-script-di-deploy-e-operativi)
7. [Test](#7-test)
8. [Indirizzi Mainnet](#8-indirizzi-mainnet)
9. [Operazioni di Leverage](#9-operazioni-di-leverage)
10. [Differenze Chiave vs Aave V3 e Euler V2](#10-differenze-chiave-vs-aave-v3-e-euler-v2)
11. [Note Operative](#11-note-operative)

---

## 1. Panoramica

L'integrazione Morpho Blue è la **terza** a seguire il pattern "3 Musketeers". Morpho Blue è un protocollo di lending a **mercati isolati** — ogni combinazione (collateral, loan, oracle, irm, lltv) definisce un mercato indipendente. Tutto il protocollo vive in un **singleton contract** (su Arbitrum: `0x6c247b1F6182318877311737BaC0844bAa518F5e`).

| Moschettiere | Contratto | Ruolo |
|---|---|---|
| **La Mappa** | MorphoRegistry | Mappa `(collateralCode, loanCode) → MarketParams` + `VaultConfig` per MetaMorpho vault |
| **Il Braccio** | MorphoPlugin | Esegue supplyCollateral / withdrawCollateral / borrow / repay + leverage atomico via FlashLoan |
| **Gli Occhi** | MorphoLensAdapter | Letture read-only per ValueCalculator, health monitoring, risk assessment |
| **Il Braccio (Vault)** | MorphoVaultPlugin | Deposita/preleva da MetaMorpho vault ERC-4626 (supply-only, yield passivo) |
| **Gli Occhi (Vault)** | MorphoVaultLensAdapter | Letture read-only per posizioni vault (shares, valore, APY) |

> **Componente aggiuntivo** (condiviso con Euler V2):

| Servizio | Contratto | Ruolo |
|---|---|---|
| **Flash Loan** | FlashLoanService | Flash loan per leverage opening/closing — condiviso tra plugins |

### Perché Morpho Blue è diverso da Aave V3 e Euler V2

| Aspetto | Morpho Blue | Aave V3 | Euler V2 |
|---|---|---|---|
| Architettura | Singleton contract unico | Pool unico condiviso | Vault separato per ogni token |
| Mercati | Isolati per (collateral, loan, oracle, irm, lltv) | Condiviso | 1 vault per token |
| Indirizzo contratto | Arbitrum: 0x6c247b...518F5e | Diverso per chain | Diverso per chain |
| Collateral | Specifico per market (non genera yield) | Genera yield (aToken) | Genera yield (shares ERC-4626) |
| Health Factor | Calcolato manualmente (oracle + LLTV) | Nativo da `getUserAccountData()` | Calcolato via AccountLens |
| Sub-account | No | No | Sì, fino a 256 via EVC |
| Oracle | Specifico per market (price scale 1e36) | Chainlink + Aave Oracle | Specifico per vault |
| Interest Rate | IRM specifico per market | Variable rate (mode=2) | Configurabile per vault |
| Flash Loan | Nativo (0% fee) | Nativo nel Pool | Via Balancer (0% fee) |
| Market ID | `keccak256(abi.encode(MarketParams))` | Token address | Vault address |
| Governance | Permissionless, immutabile | Governance DAO | Governance per vault |

---

## 2. Architettura e Flusso Token

### Diagramma di Architettura

```
                    ┌────────────────────────────────────────────────────┐
                    │                       BEACON                       │
                    │  "MorphoRegistry"       → 0x4Ff930...             │
                    │  "MorphoPlugin"          → 0x84824B...             │
                    │  "MorphoLensAdapter"     → 0x1Bc36a...             │
                    │  "FlashLoanService"      → 0x3486b5...             │
                    └───┬───────────────┬──────────────┬────────────┬───┘
                        │               │              │            │
                 ┌──────┘        ┌──────┘       ┌──────┘     ┌──────┘
                 ▼               ▼              ▼            ▼
           ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌───────────┐
           │ Registry  │  │    Plugin     │  │ LensAdapter│  │ FlashLoan │
           │           │  │              │  │            │  │ Service   │
           │ market    │  │ supply()     │  │ getTotalV()│  │           │
           │  params   │◄─│ withdraw()   │  │ getHF()   │  │ openLev() │
           │ marketId  │  │ borrow()     │──►│ getAtRisk()│  │ closeLev()│
           │           │  │ repay()      │  │            │  │           │
           └──────────┘  │ leverage()   │  └────────────┘  └─────┬─────┘
                          └──────┬───────┘                        │
                                 │                         ┌──────┘
                    ┌────────────┼─────────┐               │
                    ▼            ▼         ▼               ▼
             ┌──────────┐  ┌──────────────┐          ┌─────────────┐
             │ ProxyGen. │  │  Morpho Blue │          │  FlashLoan  │
             │ (Custody) │  │  Singleton   │          │  Provider   │
             │ 0x875...  │  │  0x6c24...5e │          │             │
             └──────────┘  └──────────────┘          └─────────────┘
```

### Flusso Token per Operazione Base

| Operazione | Flusso |
|---|---|
| **SUPPLY COLLATERAL** | ProxyGeneral → (withdrawToken) → Plugin → (morpho.supplyCollateral) → Morpho Blue |
| **WITHDRAW COLLATERAL** | Morpho Blue → (morpho.withdrawCollateral) → Plugin → (safeTransfer) → ProxyGeneral |
| **BORROW** | Morpho Blue → (morpho.borrow) → Plugin → (safeTransfer) → ProxyGeneral |
| **REPAY** | ProxyGeneral → (withdrawToken) → Plugin → (morpho.repay) → Morpho Blue |

### Flusso Leverage Atomico (Flash Loan)

```
=== OPEN LEVERAGE ===
1. Plugin chiama FlashLoanService.executeFlashLoan(USDC, flashAmount)
2. FlashLoanService trasferisce USDC al Plugin
3. Plugin callback onFlashLoanReceived():
   ├─ Swap USDC → WETH via FlashLoanService.swap()
   ├─ morpho.supplyCollateral(initialWETH + swappedWETH)
   └─ morpho.borrow(USDC per ripagare flash loan)
4. USDC torna al FlashLoanService → ripaga il prestito

=== CLOSE LEVERAGE ===
1. Plugin chiama FlashLoanService.executeFlashLoan(USDC, debtAmount)
2. FlashLoanService trasferisce USDC al Plugin
3. Plugin callback onFlashLoanReceived():
   ├─ morpho.repay(tutto il debito USDC)
   ├─ morpho.withdrawCollateral(tutto il WETH)
   └─ Swap parte WETH → USDC via FlashLoanService.swap()
4. USDC torna al FlashLoanService → ripaga il prestito
5. WETH rimanente (equity) → ProxyGeneral
```

> ⚠️ Il Plugin **NON TRATTIENE MAI** asset tra una transazione e l'altra.
> ProxyGeneral è l'unico custode dei fondi a riposo.

### Orchestrazione via ProtocolManager

Tutte le operazioni passano per ProtocolManager che:
1. Risolve il plugin dal Beacon: `_resolvePlugin("MorphoPlugin")`
2. Trasferisce token da ProxyGeneral al plugin (per supply/repay)
3. Chiama la funzione corrispondente sul plugin
4. Il plugin interagisce direttamente col singleton Morpho Blue

```
Utente → ProtocolManager.deposit("MorphoPlugin", "WETH", amount)
           │
           ├─ ProxyGeneral.withdrawToken("WETH", amount, pluginAddress)
           │
           └─ MorphoPlugin.deposit("WETH", amount)
                  │
                  ├─ Registry.getMarketParams("WETH", ...) → MarketParams
                  ├─ IERC20(weth).approve(MORPHO, amount)
                  └─ morpho.supplyCollateral(marketParams, amount, address(this), "")
```

---

## 3. Concetti Chiave di Morpho Blue

### Singleton Architecture

Morpho Blue è un **unico contratto immutabile** permissionless. Su Arbitrum l'indirizzo è:

```
Morpho Blue (Arbitrum): 0x6c247b1F6182318877311737BaC0844bAa518F5e
```

> **NOTA**: L'indirizzo canonico `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` (usato su Ethereum mainnet)
> NON è deployato su Arbitrum. Su Arb il deployment reale è all'indirizzo sopra.

Non ci sono proxy, non c'è governance, non si può aggiornare. Il contratto è completamente permissionless — chiunque può creare un mercato.

### MarketParams e Market ID

Ogni mercato è definito da una struct `MarketParams`:

```solidity
struct MarketParams {
    address loanToken;          // Token che si prende in prestito (es. USDC)
    address collateralToken;    // Token usato come garanzia (es. WETH)
    address oracle;             // Oracle per il prezzo collateral/loan
    address irm;                // Interest Rate Model
    uint256 lltv;               // Liquidation Loan-To-Value (es. 86% = 0.86e18)
}
```

Il **Market ID** è il keccak256 dell'encoding dei parametri:
```solidity
Id marketId = Id.wrap(keccak256(abi.encode(marketParams)));
```

> **Importante**: Due mercati con gli stessi token ma oracle o LLTV diversi sono mercati **completamente** diversi.

### Position (Shares-Based)

Le posizioni in Morpho Blue usano **shares** per tracciare supply e borrow:

```solidity
struct Position {
    uint256 supplyShares;    // Shares di supply (per lender)
    uint128 borrowShares;    // Shares di debito (per borrower)
    uint128 collateral;      // Collaterale depositato (in asset, NOT shares)
}
```

**Nota critica**: Il collaterale è in **asset** (non shares) — non genera yield. Il debito è in **shares** — il valore in asset cresce via interessi.

### Oracle e Price Scale

L'oracle Morpho ritorna il prezzo in scala `1e36`:

```
Price scale = 10^(36 + loanDecimals - collateralDecimals)

Per WETH/USDC:
  = 10^(36 + 6 - 18) = 10^24
  Prezzo ETH = $2500 → oraclePrice = 2500 * 10^24
```

### Health Factor (Calcolo Manuale)

Morpho Blue **non ha** un health factor nativo. Il Plugin lo calcola manualmente:

```
HF = (collateral * oraclePrice * lltv) / (debtAssets * ORACLE_PRICE_SCALE * WAD)

Dove:
  collateral     = Position.collateral (in WETH units)
  oraclePrice    = IMorphoOracle(oracle).price()  (scale 1e36)
  lltv           = MarketParams.lltv (es. 0.86e18)
  debtAssets     = borrowShares * totalBorrowAssets / totalBorrowShares
  ORACLE_PRICE_SCALE = 1e36
  WAD            = 1e18
```

> **Nota**: Il risultato è un **intero** (non WAD-scaled). HF = 172 significa 172x, HF = 1 è al limite della liquidazione. A leverage 2x con LLTV 86%, HF ≈ 1 (troncamento intero di ~1.72).

### LLTV vs LTV

| Parametro | Significato | Esempio |
|---|---|---|
| LLTV (Liquidation LTV) | Soglia alla quale si viene liquidati | 86% (0.86e18) |
| LTV effettivo | Rapporto debito/collaterale corrente | Dipende dalla posizione |

Se il LTV effettivo supera il LLTV, la posizione diventa liquidabile.

---

## 4. Contratti Solidity

### 4.1 MorphoRegistry

**File**: `contracts/plugins/MorphoRegistry.sol` (162 righe)  
**Interfaccia**: `contracts/interfaces/IMorphoRegistry.sol`

Registry semplice che mappa `(collateralCode, loanCode)` ai parametri del mercato Morpho Blue. Pre-calcola il `marketId` al momento della configurazione.

#### Struct MarketConfig

```solidity
struct MarketConfig {
    MarketParams params;    // Parametri del mercato Morpho
    Id marketId;            // keccak256(abi.encode(params)) pre-calcolato
    bool isActive;          // Flag di attivazione
}
```

#### Funzioni Principali

| Funzione | Accesso | Descrizione |
|---|---|---|
| `configureMarket(collateralCode, loanCode, collateralToken, loanToken, oracle, irm, lltv)` | onlyOwner | Registra un nuovo mercato e pre-calcola il marketId |
| `setMarketStatus(collateralCode, loanCode, bool)` | onlyOwner | Abilita/disabilita un mercato |
| `getMarketConfig(collateralCode, loanCode)` | view | Ritorna la struct completa MarketConfig |
| `getMarketParams(collateralCode, loanCode)` | view | Ritorna solo MarketParams |
| `getMarketId(collateralCode, loanCode)` | view | Ritorna il marketId pre-calcolato |
| `isMarketConfigured(collateralCode, loanCode)` | view | Check se il mercato esiste |
| `getRegisteredMarkets()` | view | Lista tutti i (collateralCode[], loanCode[]) registrati |
| `getRegisteredMarketCount()` | view | Conteggio mercati |

#### Eventi

- `MarketConfigured(string indexed collateralCode, string indexed loanCode, Id indexed marketId, address oracle, address irm, uint256 lltv)`
- `MarketRemoved(string indexed collateralCode, string indexed loanCode)`
- `MarketStatusChanged(string indexed collateralCode, string indexed loanCode, bool isActive)`

#### Errori Custom

- `MarketNotConfigured(string collateralCode, string loanCode)`
- `InvalidAddress()`
- `TokenCodeEmpty()`
- `MarketAlreadyConfigured(string collateralCode, string loanCode)`

#### Note

- **Ownership**: Trasferita al Plugin dopo configurazione iniziale dei mercati
- **Market ID auto-calcolato**: `configureMarket()` calcola automaticamente `Id.wrap(keccak256(abi.encode(params)))` e lo salva
- **Keying**: I mercati sono indicizzati da `keccak256(collateralCode, loanCode)`, non dal marketId Morpho

---

### 4.2 MorphoPlugin

**File**: `contracts/plugins/MorphoPlugin.sol` (1,090 righe)  
**Interfaccia**: `contracts/interfaces/IMorphoPlugin.sol`

Il contratto operativo principale. Implementa operazioni base su mercati Morpho Blue + leverage atomico via flash loan.

#### Costanti e Immutabili

```solidity
// Immutabili
address public immutable beacon;
IMorpho public immutable morpho;

// Costanti
address MORPHO_ADDRESS = 0x6c247b1F6182318877311737BaC0844bAa518F5e;  // Singleton Morpho Blue (Arbitrum)
uint256 ORACLE_PRICE_SCALE = 1e36;   // Scala prezzo oracle Morpho
uint256 WAD = 1e18;                  // Scala standard 18 decimali
uint256 MIN_HEALTH_FACTOR = 1.05e18; // Soglia sicurezza minima
```

#### Stato

```solidity
bool public circuitBreakerTripped;     // Emergency stop flag
FlashLoanCallbackContext _flashLoanContext;  // Contesto temporaneo flash loan
bool _inFlashLoanCallback;             // Reentrancy guard flash loan
```

#### Struct e Enum

```solidity
enum FlashLoanOperation { OPEN, CLOSE }

struct FlashLoanCallbackContext {
    FlashLoanOperation operation;
    address user;
    uint256 initialCollateral;
    uint256 maxSlippageBps;
    string collateralTokenCode;
    string borrowTokenCode;
}

struct OpenLeverageAtomicParams {
    string collateralToken;      // "WETH"
    string borrowToken;          // "USDC"
    uint256 collateralAmount;    // Importo iniziale (es. 1e18)
    uint256 targetLeverageX100;  // 200 = 2x, 300 = 3x (range: 110-500)
    uint256 minHealthFactor;     // Soglia sicurezza (es. 1.3e18)
    uint256 deadline;            // Block timestamp limite
}

struct CloseLeverageAtomicParams {
    string collateralToken;
    string borrowToken;
    uint256 maxSlippageBps;      // Basis points (es. 100 = 1%)
    uint256 deadline;
}
```

#### Interfaccia Locale — IFlashLoanServiceMorpho

```solidity
interface IFlashLoanServiceMorpho {
    function executeFlashLoan(IERC20[] calldata tokens, uint256[] calldata amounts, bytes calldata userData) external;
    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut) external returns (uint256);
    function getExpectedOutput(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256);
}
```

#### Funzioni — IProtocolAdapter (generiche)

| Funzione | Accesso | Descrizione |
|---|---|---|
| `deposit(tokenCode, amount)` | onlyProtocolManager | Routing generico → `supplyCollateral` (trova il primo mercato con quel token come collaterale) |
| `withdraw(tokenCode, amount)` | onlyProtocolManager | Routing generico → `withdrawCollateral` |
| `closePosition(uint256)` | onlyProtocolManager | Chiude tutte le posizioni, ritorna WETH totale |
| `closePositionsForWeth(targetWethAmount)` | onlyOwnerOrLM | Chiude posizioni fino a raggiungere il target WETH |
| `emergencyWithdrawAll(tokenCodes[])` | onlyOwner | Emergency withdrawal di tutti i collaterali |
| `getBalance(tokenCode)` | view | Somma del collaterale su tutti i mercati per quel token |

#### Funzioni — Morpho-Specific (core)

| Funzione | Accesso | Descrizione |
|---|---|---|
| `supplyCollateral(collateralCode, loanCode, amount)` | onlyProtocolManager | Deposita collaterale nel mercato Morpho |
| `withdrawCollateral(collateralCode, loanCode, amount)` | onlyProtocolManager | Preleva collaterale (amount=0 → tutto) |
| `borrow(collateralCode, loanCode, amount)` | onlyProtocolManager | Prende in prestito, invia a ProxyGeneral |
| `repay(collateralCode, loanCode, amount)` | onlyProtocolManager | Ripaga debito (amount=0 → tutto, via shares) |
| `closeMarketPosition(collateralCode, loanCode)` | onlyProtocolManager | Ripaga debito + preleva collaterale in un'unica tx |

#### Funzioni — Query (view)

| Funzione | Descrizione |
|---|---|
| `getDebt(collateralCode, loanCode)` | Debito in loan token units (converte shares → assets via totalBorrow) |
| `getCollateral(collateralCode, loanCode)` | Collaterale depositato (in asset units) |
| `getHealthFactor(collateralCode, loanCode)` | Health factor calcolato manualmente |

#### Funzioni — Leverage Atomico

| Funzione | Accesso | Descrizione |
|---|---|---|
| `openLeverageAtomic(OpenLeverageAtomicParams)` | onlyOwner | Apre posizione leva (110-500 x100). Flash loan → swap → supply → borrow → ripaga |
| `closeLeverageAtomic(CloseLeverageAtomicParams)` | onlyOwnerOrLM | Chiude posizione leva. Flash loan → repay → withdraw → swap → ripaga |
| `onFlashLoanReceived(tokens, amounts, fees, data)` | external | Callback dal FlashLoanService |

#### Funzioni — Emergency

| Funzione | Accesso | Descrizione |
|---|---|---|
| `activateCircuitBreaker()` | onlyOwner | Attiva emergency stop |
| `deactivateCircuitBreaker()` | onlyOwner | Disattiva emergency stop |

#### Modifiers

| Modifier | Descrizione |
|---|---|
| `onlyProtocolManager()` | Solo ProtocolManager o owner |
| `notCircuitBroken()` | Solo se circuit breaker è OFF |
| `onlyOwnerOrLiquidityManager()` | Owner, LiquidityManager, o self |
| `nonReentrant` | Protezione reentrancy su funzioni esterne |

#### Eventi

- `MorphoSupplyCollateral(string indexed collateralCode, string indexed loanCode, address indexed collateralToken, uint256 amount)`
- `MorphoWithdrawCollateral(string indexed collateralCode, string indexed loanCode, address indexed collateralToken, uint256 amount)`
- `MorphoBorrow(string indexed collateralCode, string indexed loanCode, address indexed loanToken, uint256 amount)`
- `MorphoRepay(string indexed collateralCode, string indexed loanCode, address indexed loanToken, uint256 amountRepaid)`
- `Borrowed(string tokenCode, uint256 amount, uint256 accountNumber)`
- `Repaid(string tokenCode, uint256 amount, uint256 accountNumber)`
- `LeverageOpenedAtomic(address indexed user, address collateralToken, address borrowToken, uint256 initialCollateral, uint256 totalCollateral, uint256 totalDebt, uint256 healthFactor, uint256 leverageX100)`
- `LeverageClosedAtomic(address indexed user, address collateralToken, address borrowToken, uint256 debtRepaid, uint256 collateralReturned)`
- `EmergencyWithdraw(string indexed tokenCode, uint256 amount)`
- `CircuitBreakerActivated(address indexed sender)`

#### Errori Custom

- `InvalidAddress()` — Indirizzo zero
- `CircuitBreakerActive()` — Operazioni bloccate
- `MarketNotConfigured(string, string)` — Mercato non presente nel registry
- `InsufficientBalance(uint256 available, uint256 requested)` — Fondi insufficienti
- `OnlyProtocolManager()` — Accesso negato
- `HealthFactorTooLow(uint256 current, uint256 minimum)` — HF sotto soglia
- `NoDebtToRepay()` — Nessun debito da ripagare
- `DeadlineExpired()` — Deadline scaduta per leverage
- `InvalidLeverage()` — Leverage fuori range [110, 500]
- `NoPositionToClose()` — Nessuna posizione da chiudere
- `SwapFailed()` — Swap fallito
- `SlippageExceeded(uint256 required, uint256 received)` — Slippage troppo alto
- `UnauthorizedFlashLoanCallback()` — Callback non autorizzato
- `FlashLoanServiceNotFound()` — FlashLoanService non trovato nel Beacon

#### Dettagli Implementativi

- **Collateral in asset, debt in shares**: `morpho.supplyCollateral()` prende asset units. `morpho.borrow()` restituisce (assets, shares). `morpho.repay()` accetta sia asset che shares.
- **Full repay via shares**: Quando `amount=0`, il plugin legge `Position.borrowShares` e ripaga passando `shares` anziché `assets`, evitando problemi di arrotondamento.
- **Full withdraw via collateral**: Quando `amount=0`, legge `Position.collateral` e preleva tutto.
- **Token resolution**: `_resolveToken(tokenCode)` usa `Beacon → TokenManager → getTokenAddress(tokenCode)`.
- **Market resolution**: `_getMarketParams(collateralCode, loanCode)` via `Beacon → MorphoRegistry`.
- **Flash loan calculation**: `_calculateFlashLoanAmount()` usa `FlashLoanService.getExpectedOutput()` per stimare lo swap necessario dato il target leverage.
- **Deposit/withdraw generici**: `deposit("WETH", amount)` usa `_findMarketForCollateral("WETH")` per trovare il primo mercato configurato con WETH come collaterale.

---

### 4.3 MorphoLensAdapter

**File**: `contracts/adapters/MorphoLensAdapter.sol` (610 righe)  
**Interfaccia**: `ILensAdapter` (standard condiviso)

Componente read-only che fornisce dati a ValueCalculator, LiquidityManager e alla DApp.

#### Costanti

```solidity
address MORPHO = 0x6c247b1F6182318877311737BaC0844bAa518F5e;  // Arbitrum
address WETH   = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
uint256 ORACLE_PRICE_SCALE = 1e36;
uint256 WAD = 1e18;
uint256 DEFAULT_SAFE_HEALTH_FACTOR = 1.5e18;
```

#### Funzioni — Identificazione

| Funzione | Descrizione |
|---|---|
| `protocolName()` | Ritorna `"Morpho"` |
| `protocolType()` | Ritorna `ProtocolType.LENDING` |
| `isCircuitBreakerActive()` | Legge `MorphoPlugin.circuitBreakerTripped` |
| `getPlugin()` | Risolve `"MorphoPlugin"` dal Beacon |

#### Funzioni — Valore e Breakdown

| Funzione | Descrizione |
|---|---|
| `getTotalValue()` | Valore netto (collateral − debt) in ETH across tutti i mercati |
| `getValueBreakdown()` | Breakdown: totalCollateralEth, totalDebtEth, netValueEth, availableToWithdrawEth |

#### Funzioni — Health Monitoring

| Funzione | Descrizione |
|---|---|
| `getHealthFactor()` | HF **minimo** tra tutte le posizioni (MAX_UINT se no debito) |
| `getPositionHealth(positionId)` | Health dettagliato di una posizione (per indice mercato) |
| `getAccountHealth()` | Health aggregato (usa HF minimo) |

#### Classificazione Rischio

Il `_buildHealthInfo()` classifica in base all'HF:

| Health Factor | Categoria | isHealthy |
|---|---|---|
| ≥ 2.0 | 🟢 SAFE | true |
| 1.5 – 2.0 | 🟡 WARNING | true |
| 1.0 – 1.5 | 🟠 DANGER | true |
| < 1.0 | 🔴 LIQUIDATABLE | false |

#### Funzioni — Risk Assessment

| Funzione | Descrizione |
|---|---|
| `getPositionsAtRisk(minHF)` | Posizioni con HF sotto soglia, con dettagli rischio |
| `getPositionsSortedByRisk()` | Tutte le posizioni ordinate per HF (ascendente = più rischiose prima) |
| `getLiquidationThreshold(positionId)` | LLTV del mercato (per indice) |
| `getProtocolLimits()` | Min HF = 1.05e18, Max leverage = 500 |

#### Funzioni — Yield e APY

| Funzione | Descrizione |
|---|---|
| `getYieldInfo(tokenCode)` | Ritorna tutti zeri (il collaterale Morpho non genera yield) |
| `getNetAPY()` | Sempre 0 |

#### Funzioni — Utility

| Funzione | Descrizione |
|---|---|
| `getActivePositionCount()` | Conta mercati con collaterale o debito |
| `getProtocolSummary()` | Overview completo per dashboard |
| `getVaultForToken(tokenCode)` | Ritorna indirizzo Morpho singleton se il token ha un mercato |
| `estimateWethFromCloseAll()` | Stima WETH ottenibili chiudendo tutte le posizioni |

#### Conversione Valuta

A differenza di Aave (USD base con 8 decimali), Morpho Blue esprime i prezzi in scala 1e36.
Il LensAdapter converte in ETH tramite `_toEth()`:

```
collateralEth = _toEth(collateralToken, collateralAmount)
debtEth = _toEth(loanToken, debtAmount)

_toEth(token, amount):
  price = TokenManager.getTokenPriceForModule(tokenCode)  // Chainlink oracle
  return amount * price / 10^tokenDecimals
```

#### Calcolo Health Factor

```solidity
function _computeMarketHF(plugin, marketParams, marketId) internal view returns (uint256) {
    Position memory pos = morpho.position(marketId, plugin);
    if (pos.borrowShares == 0) return type(uint256).max;
    
    Market memory mkt = morpho.market(marketId);
    uint256 debtAssets = (pos.borrowShares * mkt.totalBorrowAssets) / mkt.totalBorrowShares;
    
    uint256 oraclePrice = IMorphoOracle(marketParams.oracle).price();
    uint256 collateralValue = pos.collateral * oraclePrice / ORACLE_PRICE_SCALE;
    
    return (collateralValue * marketParams.lltv) / (debtAssets * WAD);
}
```

---

### 4.4 MorphoVaultPlugin

**File**: `contracts/plugins/MorphoVaultPlugin.sol`  
**Interfaccia**: Implementa `IProtocolAdapter`  
**Bytecode**: 10,397 bytes (42.3% del limite)

Plugin dedicato all'interazione con **MetaMorpho vault** (ERC-4626). Separato da MorphoPlugin per ragioni di bytecode (MorphoPlugin = 22,028 bytes → combinarli supererebbe il limite di 24,576).

> **Nessun rischio di liquidazione** — è supply-only, il vault gestisce l'allocazione sui mercati sottostanti.  
> **Nessun flash loan / leverage** — i vault non hanno meccanismo di borrow, quindi non è possibile chiudere il loop del flash loan.

#### Perché supply-only e senza leva?

Il flash loan richiede di restituire i fondi nella stessa transazione. Sui **market** Morpho Blue, il ciclo si chiude con `morpho.borrow()` → ripaghi il flash loan. Sui **vault**, depositi USDC → ricevi shares ERC-4626, ma le shares non sono USDC: non puoi usarle per ripagare. Dovresti fare withdraw, ma torneresti al punto di partenza.

#### Funzioni Principali

| Funzione | Accesso | Descrizione |
|---|---|---|
| `deposit(tokenCode, amount)` | onlyProtocolManager | Deposita nel vault di default per il tokenCode (via Registry) |
| `withdraw(tokenCode, amount)` | onlyProtocolManager | Preleva dal vault di default (ERC-4626 withdraw) |
| `vaultDeposit(vaultAddress, amount)` | onlyProtocolManager | Deposita in uno specifico vault MetaMorpho |
| `vaultWithdraw(vaultAddress, amount)` | onlyProtocolManager | Preleva da uno specifico vault (amount=0 → tutto) |
| `vaultRedeem(vaultAddress, shares)` | onlyProtocolManager | Redeem di shares specifiche (evita problemi di rounding ERC-4626) |
| `getBalance(tokenCode)` | view | Valore totale depositato in tutti i vault per il token |
| `emergencyWithdrawAll(tokenCodes[])` | onlyOwner | Preleva tutto da tutti i vault dei token specificati |

#### Flusso Token

| Operazione | Flusso |
|---|---|
| **DEPOSIT** | ProxyGeneral → (withdrawToken) → VaultPlugin → (vault.deposit) → MetaMorpho Vault → shares al Plugin |
| **WITHDRAW** | MetaMorpho Vault → (vault.withdraw) → VaultPlugin → (safeTransfer) → ProxyGeneral |

#### Particolarità ERC-4626

- **Rounding**: `vault.maxWithdraw()` può restituire 1 wei meno dell'importo depositato. Usare `withdraw(amount - 1)` o `redeem(shares)` per evitare revert `WithdrawExceedsMax`.
- **Shares dust**: Dopo un withdraw, possono rimanere frazioni minime di shares. È comportamento normale.
- **Conversione**: `vault.convertToAssets(shares)` per ottenere il valore in asset delle shares possedute.

#### Registry condiviso

MorphoVaultPlugin usa lo **stesso MorphoRegistry** di MorphoPlugin. Il Registry è stato esteso con:

| Funzione | Descrizione |
|---|---|
| `configureVault(name, vaultAddress, assetCode)` | Registra un vault MetaMorpho |
| `setDefaultVault(assetCode, vaultAddress)` | Imposta il vault di default per un asset |
| `getVaultConfig(vaultAddress)` | Ritorna `VaultConfig(address vault, string assetCode, bool isActive)` |
| `getDefaultVault(assetCode)` | Ritorna l'indirizzo del vault di default |
| `getRegisteredVaults()` | Lista tutti i vault registrati |
| `setVaultStatus(vaultAddress, bool)` | Abilita/disabilita un vault |

---

### 4.5 MorphoVaultLensAdapter

**File**: `contracts/adapters/MorphoVaultLensAdapter.sol`  
**Bytecode**: 5,297 bytes (21.6% del limite)

Componente read-only per posizioni su MetaMorpho vault. Implementa `ILensAdapter`.

#### Funzioni Principali

| Funzione | Descrizione |
|---|---|
| `protocolName()` | Ritorna `"MorphoVault"` |
| `protocolType()` | Ritorna `ProtocolType.YIELD` |
| `getTotalValue()` | Valore netto in ETH di tutti i vault deposit |
| `getValueBreakdown()` | Breakdown per vault: shares, asset value, conversion rate |
| `getHealthFactor()` | Sempre `MAX_UINT` (nessun rischio liquidazione) |
| `getYieldInfo(tokenCode)` | APY del vault per il token |
| `getPlugin()` | Risolve `"MorphoVaultPlugin"` dal Beacon |

#### Confronto con MorphoLensAdapter

| Aspetto | MorphoLensAdapter (Market) | MorphoVaultLensAdapter (Vault) |
|---|---|---|
| ProtocolType | LENDING | YIELD |
| Health Factor | Calcolato (oracle + LLTV) | Sempre MAX_UINT |
| Risk assessment | Posizioni at-risk, sorting | Non applicabile |
| Yield | Sempre 0 (collaterale non genera yield) | APY reale del vault |
| Valore | Collaterale - Debito in ETH | Shares × conversion rate in ETH |

---

## 5. Interfacce

### Interfacce del Plugin

| File | Descrizione | Funzioni |
|---|---|---|
| `contracts/interfaces/IMorphoPlugin.sol` | Interfaccia plugin (estende IProtocolAdapter) | 9 Morpho-specific + ereditate |
| `contracts/interfaces/IMorphoRegistry.sol` | Interfaccia registry | 8 |
| `contracts/interfaces/morpho/IMorpho.sol` | Interfaccia Morpho Blue + Oracle + MarketParamsLib | ~15 |

### IMorpho — Funzioni Morpho Blue Utilizzate

| Funzione Morpho | Usata da | Scopo |
|---|---|---|
| `supplyCollateral(params, assets, onBehalf, data)` | Plugin.supplyCollateral | Deposita collaterale |
| `withdrawCollateral(params, assets, onBehalf, receiver)` | Plugin.withdrawCollateral | Preleva collaterale |
| `borrow(params, assets, shares, onBehalf, receiver)` | Plugin.borrow | Prende in prestito |
| `repay(params, assets, shares, onBehalf, data)` | Plugin.repay | Ripaga debito |
| `position(id, user)` | Plugin + LensAdapter | Query posizione (shares, collateral) |
| `market(id)` | Plugin + LensAdapter | Stato mercato (totalSupply/Borrow assets/shares) |
| `idToMarketParams(id)` | LensAdapter | Lookup market da ID |
| `setAuthorization(authorized, bool)` | Plugin | Autorizzazione per gestione posizione |
| `flashLoan(token, assets, data)` | (Disponibile ma non usata direttamente — usiamo FlashLoanService) | Flash loan nativi (0% fee) |

### IMorphoOracle — Funzione Utilizzata

| Funzione | Usata da | Scopo |
|---|---|---|
| `price()` | Plugin + LensAdapter | Prezzo collateral/loan in scala 1e36 |

### MarketParamsLib — Funzione Utilizzata

| Funzione | Usata da | Scopo |
|---|---|---|
| `id(MarketParams)` | Registry, Plugin | Calcola Id = keccak256(abi.encode(params)) |

---

## 6. Script di Deploy e Operativi

Tutti gli script si trovano in `scripts/`:

| Script | Scopo |
|---|---|
| `deploy-morpho-plugin.ts` | Deploy completo MorphoPlugin (3 contratti + configurazione mercati + registrazione Beacon + autorizzazione ProxyGeneral) |
| `deploy-morpho-vault-plugin.ts` | Deploy MorphoVaultPlugin + VaultLensAdapter + aggiornamento Registry con vault config |
| `query-morpho-markets.ts` | Usa Morpho Blue GraphQL API per scoprire mercati disponibili |
| `e2e-morpho-vault-smoke.ts` | 55 check read-only su mainnet per verificare MorphoVaultPlugin |
| `check-balances.ts` | Query saldi ProxyGeneral e Plugin |

### deploy-morpho-plugin.ts — Ordine delle Operazioni

```
1. Verifica Morpho Blue on-chain (bytecode check)
2. Deploy MorphoRegistry
3. configureMarket("WETH", "USDC", ...)       ⚠️ PRIMA di trasferire ownership
4. Deploy MorphoPlugin(beacon)
5. registry.transferOwnership(pluginAddress)
6. Deploy MorphoLensAdapter(beacon)
7. beacon.updateImplementation("MorphoRegistry", registry)
8. beacon.updateImplementation("MorphoPlugin", plugin)
9. beacon.updateImplementation("MorphoLensAdapter", lensAdapter)
10. proxyGeneral.authorizeModule(pluginAddress, "MorphoPlugin")
11. Update deployments/mainnet-latest.json
```

> **NOTA CRITICA**: Il Beacon reale usa `updateImplementation()`, NON `setImplementation()`.
> Quest'ultimo è la funzione del MockBeacon usato nei test.

---

## 7. Test

### File Test

| File | Tipo | Casi | Stato |
|---|---|---|---|
| `test/integration/MorphoPlugin.fork.test.ts` | Fork test Arbitrum | 49 | ✅ 49/49 passing |
| `test/integration/e2e-deposit-withdraw.fork.test.ts` | Fork test Arbitrum | 30 | ✅ 30/30 passing (market + vault lifecycle) |

### E2E Smoke Test (Mainnet)

| File | Tipo | Casi | Stato |
|---|---|---|---|
| `scripts/e2e-morpho-vault-smoke.ts` | Read-only mainnet | 55 | ✅ 55/55 passing |

### Copertura (12 sezioni, 49 test)

| Sezione | # Test | Descrizione |
|---|---|---|
| MorphoRegistry | 7 | Configurazione mercati, lookup, status, access control |
| Plugin Basic Deployment | 5 | Deploy, owner, Morpho address, circuit breaker OFF, beacon |
| Supply Collateral | 4 | supplyCollateral WETH, getCollateral, HF=MAX (no debt), deposit generico |
| Borrow | 4 | Borrow USDC, custody model (→ProxyGeneral), HF>1, getDebt |
| Repay | 3 | Repay parziale, repay totale (amount=0), HF=MAX dopo full repay |
| Withdraw Collateral | 3 | Withdraw parziale, withdraw totale (amount=0), withdraw generico |
| Close Position | 1 | closeMarketPosition (repay all + withdraw all) |
| Circuit Breaker | 3 | Activate, block operations, deactivate |
| LensAdapter | 3 | getTotalValue>0, getHealthFactor>1, getProtocolLimits |
| Access Control | 3 | Reject non-owner supplyCollateral, borrow, activateCircuitBreaker |
| Open Leverage | 5 | 2x atomic, collateral>initial, debt>0, HF validation, deadline check |
| Close Leverage | 5 | Atomic close, no debt remaining, no collateral, equity returned, no position revert |

### Copertura E2E Deposit/Withdraw (5 sezioni, 30 test)

| Sezione | # Test | Descrizione |
|---|---|---|
| Morpho Market WETH supply | 6 | Supply via ProtocolManager, getBalance, getCollateral, getDebt=0 |
| Morpho Market WETH withdraw | 6 | Withdraw via ProtocolManager, fondi tornano a ProxyGeneral |
| MetaMorpho Vault USDC deposit | 6 | Deposit via ProtocolManager, shares, valore, conversione |
| MetaMorpho Vault USDC withdraw | 6 | Withdraw via ProtocolManager, rounding ERC-4626, dust shares |
| executeProtocolCall vault ops | 3 | Low-level vaultDeposit/vaultRedeem via ProxyGeneral |
| Combined lifecycle | 2 | Market + Vault simultanei, post-withdrawal verification |
| Post-test verification | 1 | Verifica posizioni = 0 dopo cleanup |

### Mock Utilizzati

| Mock | Scopo |
|---|---|
| `MockMorpho.sol` | Simula il singleton Morpho Blue. supplyCollateral/withdrawCollateral/borrow/repay con 1:1 share ratio. `hardhat_setCode` all'indirizzo reale. |
| `MockMorphoOracle.sol` | Oracle con prezzo settabile. Default: 2500 * 10^24 per WETH/USDC. |
| `MockFlashLoanService.sol` | Simula Balancer flash loan flow: executeFlashLoan → callback → verifica ripagamento. Include swap() con prezzo ETH configurabile. |
| `MockTokenManager.sol` | Aggiunto `getTokenPriceForModule()` per conversione token → ETH nel LensAdapter. |

### Testing Strategy

- **MockMorpho injected at real address**: I test fork usano MockMorpho iniettato all'indirizzo Morpho via `hardhat_setCode`. L'indirizzo reale su Arbitrum è `0x6c247b1F6182318877311737BaC0844bAa518F5e`.
- **WETH funding**: WETH9 su Arbitrum non ha storage slot standard. Si usa impersonazione di una whale + `WETH9.deposit()` per wrappare ETH.
- **USDC funding**: Slot storage = 9. Usato `hardhat_setStorageAt` per fondi diretti.

### Esecuzione Test

```bash
cd TestSmartContract
FORK_ENABLED=true npx hardhat test test/integration/MorphoPlugin.fork.test.ts
```

---

## 8. Indirizzi Mainnet

### Contratti Deployed (Arbitrum One)

#### Morpho Market (Lending — con Leva)

| Contratto | Indirizzo |
|---|---|
| MorphoPlugin | `0xf653f0E3FddA2937C2A76C385FA381599BDb65dB` |
| MorphoLensAdapter | `0x37CbA12B65fA59f1D242a02c955b0C87db4d5088` |

#### Morpho Vault (Yield — supply-only)

| Contratto | Indirizzo |
|---|---|
| MorphoVaultPlugin | `0x118fd15a78C0Dada24c49343A55142938Ca1868E` |
| MorphoVaultLensAdapter | `0xd5dE87464d1C77417f5a47C8B5F73f7B351F47Cc` |

#### Infrastruttura Condivisa

| Contratto | Indirizzo |
|---|---|
| MorphoRegistry (shared) | `0xe2e3a074aC000c087fCa87ae2fe0741139660f94` |
| FlashLoanService (shared) | `0x3486b561CA1E3Dc146F97D8Ed4B9e4f2cd10822d` |

> **Nota**: Il Registry precedente (`0x9370CC33...`) è stato sostituito con la versione che supporta anche la configurazione vault.

### Registrazioni

| Sistema | Stato |
|---|---|
| Beacon (`0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870`) | ✅ Tutti e 5 registrati via `updateImplementation()` |
| ProxyGeneral (`0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1`) | ✅ MorphoPlugin + MorphoVaultPlugin autorizzati via `authorizeModule()` |

### Mercati Configurati nel Registry

| Collateral | Loan | Oracle | IRM | LLTV |
|---|---|---|---|---|
| WETH (`0x82aF49447D8a07e3bd95BD0d56f35241523fBab1`) | USDC (`0xaf88d065e77c8cC2239327C5EDb3A432268e5831`) | `0x282FEB10549fde52bD61A6979424Ddf18A4971A2` | `0x66F30587FB8D4206918deb78ecA7d5eBbafD06DA` | 86% (0.86e18) |

### Indirizzi Morpho Blue (Arbitrum)

| Componente | Indirizzo |
|---|---|
| Morpho Blue Singleton | `0x6c247b1F6182318877311737BaC0844bAa518F5e` |
| Oracle WETH/USDC | `0x282FEB10549fde52bD61A6979424Ddf18A4971A2` |
| IRM (Adaptive Curve) | `0x66F30587FB8D4206918deb78ecA7d5eBbafD06DA` |

### Market ID

```
WETH/USDC (86% LLTV): keccak256(abi.encode(MarketParams))
```

### MetaMorpho Vault Configurati nel Registry

| Vault | Indirizzo | Asset | Default |
|---|---|---|---|
| HexaOne USDC | `0xaE73875437c86abb60cD7fA77286D63cb94F9a25` | USDC | ✅ |
| Clearstar USDC Reactor | `0xa53Cf822FE93002aEaE16d395CD823Ece161a6AC` | USDC | — |
| usdc staging | `0xd2d46099B70880e268B0c7557b9D22d3AA848654` | USDC | — |

### Ownership

| Contratto | Owner |
|---|---|
| MorphoRegistry | MorphoPlugin (`0xf653f0E3...`) |
| MorphoPlugin | Deployer (`0x8390e98...`) |
| MorphoLensAdapter | Deployer (`0x8390e98...`) |
| MorphoVaultPlugin | Deployer (`0x8390e98...`) |
| MorphoVaultLensAdapter | Deployer (`0x8390e98...`) |

---

## 9. Operazioni di Leverage

### Parametri Leverage

| Parametro | Descrizione | Range | Esempio |
|---|---|---|---|
| `targetLeverageX100` | Moltiplicatore × 100 | 110 – 500 | 200 = 2x, 300 = 3x |
| `collateralAmount` | Importo iniziale collaterale | > 0 | 1e18 (1 WETH) |
| `minHealthFactor` | Soglia di sicurezza | ≥ MIN_HF | 1.3e18 = 1.3 |
| `maxSlippageBps` | Slippage massimo in bps | > 0 | 100 = 1% |
| `deadline` | Block timestamp scadenza | > block.timestamp | block.timestamp + 300 |

### Esempio: Apertura 2x Leverage su WETH/USDC

```
Input:  1 WETH, target 2x, LLTV 86%
Calcolo: Flash loan ~$2500 USDC

1. FlashLoanService.executeFlashLoan(USDC, $2500)
2. USDC arrivano al Plugin → swap USDC → ~1 WETH
3. Plugin: morpho.supplyCollateral(MarketParams, 1+1 = ~2 WETH)
4. Plugin: morpho.borrow(MarketParams, ~$2500 USDC)
5. USDC → FlashLoanService → ripaga il prestito

Output: ~2 WETH collateral, ~$2500 USDC debt
HF ≈ (2 * $2500 * 0.86) / $2500 ≈ 1.72 → troncato a 1 (intero)

Profitto se WETH ↑ 10%: +10% su 2 WETH = 0.2 WETH (2x amplificato)
Perdita se WETH ↓ 10%:  -10% su 2 WETH = -0.2 WETH (2x amplificato)
```

### Esempio: Chiusura Leverage

```
Input:  Posizione con 2 WETH collateral, $2500 USDC debt

1. FlashLoanService.executeFlashLoan(USDC, $2500)
2. USDC arrivano al Plugin → morpho.repay(tutto il debito)
3. Plugin: morpho.withdrawCollateral(tutti i 2 WETH)
4. Plugin: swap parte WETH → USDC per ripagare flash loan
5. USDC → FlashLoanService → ripaga il prestito
6. WETH rimanente (~1 WETH + profitto/perdita) → ProxyGeneral

Output: Posizione chiusa, equity WETH restituita
```

### Soglie di Sicurezza

| Health Factor | Stato | Azione |
|---|---|---|
| > 2.0 | 🟢 Sicuro | Nessuna |
| 1.5 – 2.0 | 🟡 Warning | Monitorare |
| 1.05 – 1.5 | 🟠 Pericolo | Considerare chiusura |
| ≤ 1.05 | 🔴 Min threshold | Plugin rifiuta nuove operazioni (MIN_HEALTH_FACTOR) |
| ≤ 1.0 | ☠️ Liquidabile | Liquidatori esterni possono intervenire |

---

## 10. Differenze Chiave vs Aave V3 e Euler V2

### Architettura

| Aspetto | Morpho Blue | Aave V3 | Euler V2 |
|---|---|---|---|
| **Contratto** | Singleton (0x6c24...5e su Arb) | Pool unico (0x794a...aD) | Vault separati per token |
| **Governance** | Nessuna (immutabile, permissionless) | DAO governance | Governance per vault |
| **Mercati** | Isolati (ogni combinazione è indipendente) | Condiviso (pool unico) | Vault per token |
| **Bytecode** | Indirizzo varia per chain (Arb: 0x6c24...5e) | Diverso per chain | Diverso per chain |

### Operazioni

| Aspetto | Morpho Blue | Aave V3 | Euler V2 |
|---|---|---|---|
| **Collateral** | Non genera yield (asset puri) | Genera yield (aToken) | Genera yield (ERC-4626 shares) |
| **Posizioni** | Per-market (collateralCode + loanCode) | Per-token (tokenCode) | Per-vault + sub-account |
| **Health Factor** | Calcolato manualmente (oracle + LLTV) | Nativo `getUserAccountData()` | Via AccountLens esterno |
| **Interest Rate** | IRM specifico per market | Variable rate (mode=2) | Configurabile per vault |
| **Multi-step** | Nessun batch richiesto | Nessun batch richiesto | EVC batch obbligatorio |

### Registry

| Aspetto | MorphoRegistry | AaveV3Registry | EulerRegistry |
|---|---|---|---|
| **Chiave** | (collateralCode, loanCode) | tokenCode | tokenCode |
| **Valore** | MarketParams + marketId | (underlying, aToken, debtToken) | vault address |
| **Position manager** | No | No | Sì (sub-account EVC) |
| **Complessità** | 162 LOC | 246 LOC | 716 LOC |

### Plugin

| Aspetto | MorphoPlugin | MorphoVaultPlugin | AaveV3Plugin | EulerV2Plugin |
|---|---|---|---|---|
| **LOC** | ~1,090 | ~350 | ~627 | ~1,412 |
| **Bytecode** | 22,028 (89.6%) | 10,397 (42.3%) | — | 22,538 (91.7%) |
| **Tipo** | LENDING | YIELD | LENDING | LENDING |
| **Leverage** | Sì (flash loan) | No (supply-only) | Sì (flash loan) | Sì (flash loan + EVC batch) |
| **Flash Loan** | ✅ FlashLoanService | ❌ Non applicabile | ✅ FlashLoanService | ✅ FlashLoanService |
| **Operazioni** | supply/withdraw/borrow/repay/leverage | deposit/withdraw (ERC-4626) | supply/withdraw/borrow/repay/leverage | supply/withdraw/borrow/repay/leverage |
| **Funzioni firma** | (collateralCode, loanCode, amount) | (tokenCode, amount) / (vault, amount) | (tokenCode, amount) | (tokenCode, amount) / leverage struct |
| **Withdraw target** | Plugin → safeTransfer → ProxyGeneral | Plugin → safeTransfer → ProxyGeneral | Pool.withdraw(to=ProxyGeneral) | Plugin → safeTransfer → ProxyGeneral |

### LensAdapter

| Aspetto | MorphoLensAdapter | AaveV3LensAdapter | EulerLensAdapter |
|---|---|---|---|
| **LOC** | 610 | 455 | 1,247 |
| **Yield info** | Sempre 0 (collaterale non genera yield) | APY reali (supply/borrow) | APY reali (supply/borrow) |
| **HF** | Minimo tra tutti i mercati | Nativo Aave | Minimo tra sub-account |
| **Time-to-liquidation** | Non implementato | Non implementato | Implementato |

---

## 11. Note Operative

### Aggiunta di Nuovi Mercati

Per aggiungere un nuovo mercato (es. WBTC/USDC):

1. Scoprire i parametri del mercato Morpho Blue:
   - Oracle: indirizzo dell'oracle Morpho per la coppia
   - IRM: indirizzo dell'Interest Rate Model
   - LLTV: Liquidation Loan-To-Value ratio
   - Verificare tramite `scripts/query-morpho-markets.ts` o la GraphQL API di Morpho
2. **L'owner del Registry è il Plugin** — serve uno script ad hoc per chiamare `configureMarket()` tramite il Plugin
3. Aggiornare i test se necessario
4. Testare tutte le operazioni sul nuovo mercato via fork

### Circuit Breaker

- `activateCircuitBreaker()` — blocca tutte le operazioni tranne emergency
- `deactivateCircuitBreaker()` — ripristina le operazioni
- Solo l'owner del Plugin può attivare/disattivare
- `emergencyWithdrawAll()` funziona ANCHE con circuit breaker attivo

### Deploy Sequence — Ordine Critico

⚠️ L'ordine è **fondamentale**:
1. **Deploy Registry**
2. **Configurare i mercati** — PRIMA di trasferire ownership!
3. **Deploy Plugin**
4. **Transfer ownership** del Registry al Plugin
5. **Deploy LensAdapter**
6. **Registrare nel Beacon** — tutti e 3
7. **Autorizzare nel ProxyGeneral** — solo il Plugin

Se si inverte l'ordine 2-4, non sarà più possibile configurare mercati senza passare per il Plugin.

### Particolarità Morpho Blue

- **Collaterale non genera yield**: A differenza di Aave (aToken) e Euler (ERC-4626 shares), il collaterale depositato su Morpho Blue resta asset puro — non matura interessi.
- **Debito in shares**: Il debito è tracciato in shares che crescono via interessi. Per ottenere l'ammontare effettivo: `debtAssets = borrowShares * totalBorrowAssets / totalBorrowShares`.
- **Oracle price scale 1e36**: Tutti i calcoli di prezzo usano la convenzione Morpho di `10^(36 + loanDecimals - collateralDecimals)`.
- **HF intero**: A differenza di Aave (1e18 scale) ed Euler (1e18 scale), il nostro calcolo HF produce un intero. Con leverage 2x e LLTV 86%, HF ≈ 1.72 viene troncato a 1 (integer division).

---

## Riepilogo File

```
contracts/
├── plugins/
│   ├── MorphoRegistry.sol            ← Registry condiviso Market+Vault (esteso con VaultConfig)
│   ├── MorphoPlugin.sol              ← Plugin Market: lending + leverage (1,090 righe)
│   └── MorphoVaultPlugin.sol         ← Plugin Vault: ERC-4626 supply-only
├── adapters/
│   ├── MorphoLensAdapter.sol         ← LensAdapter Market (610 righe)
│   └── MorphoVaultLensAdapter.sol    ← LensAdapter Vault
├── interfaces/
│   ├── IMorphoPlugin.sol             ← Interfaccia plugin market
│   ├── IMorphoRegistry.sol           ← Interfaccia registry (market + vault)
│   └── morpho/
│       └── IMorpho.sol               ← Interfaccia Morpho Blue + Oracle + MarketParamsLib
└── mocks/
    ├── MockMorpho.sol                ← Mock singleton Morpho + MockMorphoOracle
    └── MockFlashLoanService.sol      ← Mock flash loan service per test leverage

scripts/
├── deploy-morpho-plugin.ts           ← Deploy Market (3 contratti + config + registrazioni)
├── deploy-morpho-vault-plugin.ts     ← Deploy Vault (2 contratti + Registry update + registrazioni)
├── e2e-morpho-vault-smoke.ts         ← 55 check mainnet read-only
├── check-balances.ts                 ← Query saldi protocollo
└── query-morpho-markets.ts           ← Discovery mercati via GraphQL API

test/
└── integration/
    ├── MorphoPlugin.fork.test.ts                ← 49 test (fork Arbitrum, 12 sezioni)
    └── e2e-deposit-withdraw.fork.test.ts        ← 30 test (market + vault lifecycle)

deployments/
└── mainnet-latest.json               ← Indirizzi aggiornati (include tutti i componenti Morpho)
```
