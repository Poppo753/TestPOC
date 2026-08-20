# Aave V3 Plugin — Documentazione Completa

> **Stato**: ✅ Deployed e verificato su Arbitrum One (Aprile 2026)  
> **Pattern**: 3 Musketeers (Registry + Plugin + LensAdapter)  
> **Protocollo esterno**: Aave V3 — Pool unico condiviso su Arbitrum

---

## Indice

1. [Panoramica](#1-panoramica)
2. [Architettura e Flusso Token](#2-architettura-e-flusso-token)
3. [Contratti Solidity](#3-contratti-solidity)
   - 3.1 [AaveV3Registry](#31-aavev3registry)
   - 3.2 [AaveV3Plugin](#32-aavev3plugin)
   - 3.3 [AaveV3LensAdapter](#33-aavev3lensadapter)
4. [Interfacce](#4-interfacce)
5. [Script di Deploy e Operativi](#5-script-di-deploy-e-operativi)
6. [Test](#6-test)
7. [Indirizzi Mainnet](#7-indirizzi-mainnet)
8. [Differenze Chiave vs Euler V2](#8-differenze-chiave-vs-euler-v2)
9. [Note Operative](#9-note-operative)

---

## 1. Panoramica

L'integrazione Aave V3 segue il pattern **3 Musketeers** collaudato con Euler V2.
Tre contratti cooperano per gestire l'interazione con il pool lending di Aave V3 su Arbitrum:

| Moschettiere | Contratto | Ruolo |
|---|---|---|
| **La Mappa** | AaveV3Registry | Mappa `tokenCode → (underlying, aToken, variableDebtToken)` |
| **Il Braccio** | AaveV3Plugin | Esegue deposit / withdraw / borrow / repay sul Pool Aave |
| **Gli Occhi** | AaveV3LensAdapter | Letture read-only per ValueCalculator e DApp dashboard |

### Differenza fondamentale con Euler V2

Aave V3 usa un **Pool unico condiviso** (non vault separati per token) e un **singolo account per indirizzo** (non sub-account via EVC). Questo semplifica notevolmente la logica: niente batch atomici, niente collateral enable manuale, health factor nativo dal Pool.

---

## 2. Architettura e Flusso Token

### Diagramma di Architettura

```
                         ┌──────────────────────────────────────────────┐
                         │                    BEACON                     │
                         │  "AaveV3Registry"       → 0xEeb0EA1...      │
                         │  "AaveV3Plugin"          → 0x4cFDCb4...      │
                         │  "AaveV3LensAdapter"     → 0xF9d5Cb5...      │
                         └──────┬──────────────┬──────────────┬─────────┘
                                │              │              │
                         ┌──────┘       ┌──────┘       ┌──────┘
                         ▼              ▼              ▼
                   ┌──────────┐  ┌──────────────┐  ┌──────────────┐
                   │ Registry  │  │    Plugin     │  │ LensAdapter  │
                   │           │  │              │  │              │
                   │ tokenCode │  │ deposit()    │  │ getTotalValue│
                   │  → aToken │◄─│ withdraw()   │  │ getHealthF() │
                   │  → debt   │  │ borrow()     │──►│ getPositions │
                   │           │  │ repay()      │  │ getYieldInfo │
                   └──────────┘  └──────┬───────┘  └──────────────┘
                                        │
                              ┌─────────┼─────────┐
                              ▼                    ▼
                     ┌──────────────┐     ┌──────────────┐
                     │ ProxyGeneral  │     │  Aave V3     │
                     │  (Custody)    │     │  Pool        │
                     │  0x875...     │     │  0x794a6...  │
                     └──────────────┘     └──────────────┘
```

### Flusso Token per Operazione

| Operazione | Flusso |
|---|---|
| **DEPOSIT** | ProxyGeneral → (withdrawToken) → Plugin → (Pool.supply) → Aave Pool |
| **WITHDRAW** | Aave Pool → (Pool.withdraw to=ProxyGeneral) → ProxyGeneral |
| **BORROW** | Aave Pool → (Pool.borrow) → Plugin → (safeTransfer) → ProxyGeneral |
| **REPAY** | ProxyGeneral → (withdrawToken) → Plugin → (Pool.repay) → Aave Pool |

> ⚠️ Il Plugin **NON TRATTIENE MAI** asset tra una transazione e l'altra.
> ProxyGeneral è l'unico custode dei fondi a riposo.

### Orchestrazione via ProtocolManager

Tutte le operazioni passano per ProtocolManager che:
1. Risolve il plugin dal Beacon: `_resolvePlugin("AaveV3Plugin")`
2. Trasferisce token da ProxyGeneral al plugin (per deposit/repay)
3. Chiama la funzione corrispondente sul plugin
4. Il plugin interagisce direttamente col Pool Aave

```
Utente → ProtocolManager.deposit("AaveV3Plugin", "WETH", amount)
           │
           ├─ ProxyGeneral.withdrawToken("WETH", amount, pluginAddress)
           │
           └─ AaveV3Plugin.deposit("WETH", amount)
                  │
                  ├─ Registry.getAToken("WETH") → indirizzo aWETH
                  ├─ IERC20(weth).approve(pool, amount)
                  └─ Pool.supply(weth, amount, address(this), 0)
```

---

## 3. Contratti Solidity

### 3.1 AaveV3Registry

**File**: `contracts/plugins/AaveV3Registry.sol` (246 righe)  
**Interfaccia**: `contracts/interfaces/IAaveV3Registry.sol`

Mappa ogni `tokenCode` (stringa) alla configurazione Aave corrispondente.

#### Struct TokenConfig

```solidity
struct TokenConfig {
    address underlying;         // Token ERC20 sottostante (es. WETH)
    address aToken;             // aToken Aave (receipt del deposito)
    address variableDebtToken;  // Token di debito variabile
    bool isActive;              // Flag attivazione
}
```

#### Funzioni Principali

| Funzione | Accesso | Descrizione |
|---|---|---|
| `configureToken(tokenCode, underlying, aToken, debtToken)` | onlyOwner | Configura un token nel registry |
| `configureTokensBatch(...)` | onlyOwner | Configura più token in una tx |
| `removeToken(tokenCode)` | onlyOwner | Rimuove token (swap-and-pop O(1)) |
| `setTokenActive(tokenCode, bool)` | onlyOwner | Abilita/disabilita un token |
| `getTokenConfig(tokenCode)` | view | Ritorna la struct completa |
| `getUnderlying(tokenCode)` | view | Indirizzo underlying |
| `getAToken(tokenCode)` | view | Indirizzo aToken |
| `getVariableDebtToken(tokenCode)` | view | Indirizzo debt token |
| `getRegisteredTokens()` | view | Lista tutti i tokenCode registrati |
| `getRegisteredTokenCount()` | view | Conteggio token |
| `isTokenConfigured(tokenCode)` | view | Check se il token esiste |
| `getUnderlyingSafe(tokenCode)` | view | Ritorna address(0) se non esiste |
| `getATokenSafe(tokenCode)` | view | Stessa logica safe |
| `getVariableDebtTokenSafe(tokenCode)` | view | Stessa logica safe |

#### Eventi

- `TokenConfigured(string indexed tokenCode, address underlying, address aToken, address variableDebtToken)`
- `TokenRemoved(string indexed tokenCode)`
- `TokenStatusChanged(string indexed tokenCode, bool isActive)`

#### Note

- **Ownership**: Trasferita al Plugin dopo la configurazione iniziale
- **Auto-discovery**: Lo script di deploy scopre automaticamente aToken e debtToken interrogando il Pool Aave (`getReserveAToken`, `getReserveVariableDebtToken`)
- I getter "safe" (suffisso `Safe`) non revertano ma ritornano `address(0)` — utili per il LensAdapter

---

### 3.2 AaveV3Plugin

**File**: `contracts/plugins/AaveV3Plugin.sol` (627 righe)  
**Interfaccia**: `contracts/interfaces/IAaveV3Plugin.sol`

Esegue tutte le operazioni operative sul Pool Aave V3.

#### Funzioni Principali

| Funzione | Accesso | Descrizione |
|---|---|---|
| `deposit(tokenCode, amount)` | onlyProtocolManager | Deposita nel Pool Aave (supply) |
| `withdraw(tokenCode, amount)` | onlyProtocolManager | Preleva dal Pool (to: ProxyGeneral) |
| `borrow(tokenCode, amount)` | onlyProtocolManager | Prende in prestito (variable rate) |
| `repay(tokenCode, amount)` | onlyProtocolManager | Ripaga debito (con gestione dust) |
| `closePosition(debtToken, collateralToken)` | onlyProtocolManager | Chiude posizione: repay + withdraw |
| `closePosition(positionId)` | onlyProtocolManager | Chiude posizione per indice |
| `closePositionsForWeth(targetAmount)` | onlyOwnerOrLM | Chiude posizioni per ottenere WETH target |
| `emergencyWithdrawAll(tokenCodes[])` | onlyOwner | Preleva tutto in emergenza |
| `getBalance(tokenCode)` | view | Balance aToken (collaterale depositato) |
| `getDebt(tokenCode)` | view | Balance debtToken (debito corrente) |
| `getHealthFactor()` | view | Health factor nativo Aave (1e18 scale) |
| `getBorrowCapacity(tokenCode)` | view | Capacità di prestito residua |
| `activateCircuitBreaker()` | onlyOwner | Attiva emergency stop |
| `deactivateCircuitBreaker()` | onlyOwner | Disattiva emergency stop |

#### Modifiers

| Modifier | Descrizione |
|---|---|
| `onlyProtocolManager()` | Solo ProtocolManager o owner |
| `notCircuitBroken()` | Solo se circuit breaker è OFF |
| `onlyOwnerOrLiquidityManager()` | Owner, LiquidityManager o self |

#### Eventi

- `AaveDeposit(tokenCode, asset, amount, aTokenReceived)`
- `AaveWithdrawal(tokenCode, asset, amount)`
- `AaveBorrow(tokenCode, asset, amount)`
- `AaveRepay(tokenCode, asset, amountRepaid)`
- `EmergencyWithdraw(tokenCode, amount)`
- `CircuitBreakerActivated(sender)` / eventi ereditati da IProtocolAdapter

#### Dettagli Implementativi

- **Interest Rate Mode**: Sempre `2` (variable rate) — Aave V3 ha deprecato stable rate
- **Withdraw diretto**: `Pool.withdraw(token, amount, proxyGeneral)` — il terzo parametro specifica il destinatario, evitando un `safeTransfer` extra
- **Borrow + transfer**: `Pool.borrow()` invia al plugin, poi il plugin fa `safeTransfer(proxyGeneral, amount)`
- **Repay con dust**: Se l'approval supera il debito reale, Aave ripaga solo il necessario. Il plugin gestisce il dust residuo
- **closePosition(string, string)**: Ripaga il debito e preleva il collaterale in un'unica transazione logica
- **Referral code**: Sempre `0` (parametro Aave legacy non utilizzato)

---

### 3.3 AaveV3LensAdapter

**File**: `contracts/adapters/AaveV3LensAdapter.sol` (455 righe)

Componente read-only che fornisce dati a ValueCalculator, LiquidityManager e alla DApp.

#### Funzioni Principali

| Funzione | Descrizione |
|---|---|
| `getTotalValue()` | Valore netto (collateral − debt) in ETH |
| `getValueBreakdown()` | Breakdown: totalCollateral, totalDebt, netValue, available |
| `getHealthFactor()` | Health factor nativo Aave |
| `getActivePositionCount()` | 0 o 1 (Aave ha singolo account) |
| `getProtocolSummary()` | Overview completo per dashboard |
| `getPositionsAtRisk(minHF)` | Posizioni sotto soglia di health factor |
| `getPositionsSortedByRisk()` | Posizioni ordinate per rischio |
| `getPositionHealth(posId)` | Health dettagliato di una posizione |
| `getAccountHealth()` | Health dell'intero account Aave |
| `getYieldInfo(tokenCode)` | APY di supply e borrow per token |
| `getNetAPY()` | APY netto aggregato (supply − borrow) |
| `estimateWethFromCloseAll()` | Stima WETH ottenibili chiudendo tutto |
| `getLiquidationThreshold(posId)` | Soglia di liquidazione in ETH |
| `getProtocolLimits()` | Min health factor e max leverage |
| `getVaultForToken(tokenCode)` | Indirizzo aToken per un token |

#### Conversione Valuta

Aave V3 esprime tutti i valori in **USD base currency con 8 decimali**.
Il LensAdapter converte in ETH tramite il helper interno `_baseToEth()`:

```
ETH_value = USD_base_value * 1e18 / ETH_price_usd
```

Dove `ETH_price_usd` viene da `TokenManager.getTokenPriceForModule("WETH")` (oracle Chainlink).

#### Classificazione Rischio

| Health Factor | Categoria |
|---|---|
| ≥ 2.0 | 🟢 SAFE |
| 1.5 – 2.0 | 🟡 WARNING |
| 1.0 – 1.5 | 🟠 DANGER |
| < 1.0 | 🔴 LIQUIDATABLE |

---

## 4. Interfacce

| File | Descrizione | Funzioni |
|---|---|---|
| `contracts/interfaces/IAaveV3Plugin.sol` | Interfaccia plugin (estende IProtocolAdapter + ILendingProtocol) | 7 + ereditate |
| `contracts/interfaces/IAaveV3Registry.sol` | Interfaccia registry | 10 |
| `contracts/interfaces/aave/IAaveV3Pool.sol` | Interfaccia Pool Aave V3 (subset) | 11 |

### IAaveV3Pool — Funzioni Aave Utilizzate

| Funzione Aave | Usata da | Scopo |
|---|---|---|
| `supply(asset, amount, onBehalfOf, refCode)` | Plugin.deposit | Deposita nel pool |
| `withdraw(asset, amount, to)` | Plugin.withdraw | Preleva (destinatario diretto) |
| `borrow(asset, amount, rateMode, refCode, onBehalfOf)` | Plugin.borrow | Prende in prestito |
| `repay(asset, amount, rateMode, onBehalfOf)` | Plugin.repay | Ripaga debito |
| `getUserAccountData(user)` | Plugin + LensAdapter | Health factor, collateral, debt |
| `getReservesList()` | Deploy script | Lista asset supportati |
| `getReserveAToken(asset)` | Deploy script | Auto-discover aToken |
| `getReserveVariableDebtToken(asset)` | Deploy script | Auto-discover debtToken |
| `getReserveNormalizedIncome(asset)` | LensAdapter | Calcolo supply APY |
| `getReserveNormalizedVariableDebt(asset)` | LensAdapter | Calcolo borrow APY |

---

## 5. Script di Deploy e Operativi

Tutti gli script si trovano in `scripts/`:

| Script | Scopo |
|---|---|
| `deploy-aave-v3-plugin.ts` | Deploy completo dei 3 contratti + registrazione Beacon + autorizzazione ProxyGeneral |
| `complete-aave-v3-registration.ts` | Script una tantum per registrare i contratti nel Beacon e autorizzare in ProxyGeneral |
| `preflight-check.ts` | Controllo pre-deploy: deployer, bilancio ETH, ownership Beacon, gas |
| `verify-aave-v3-deployment.ts` | Verifica post-deploy: controlla tutti gli indirizzi on-chain, Beacon, ProxyGeneral, Registry |
| `smoke-test-aave-v3-mainnet.ts` | Test su mainnet: ciclo completo deposit → borrow → repay → withdraw con importi minimi |
| `smoke-test-aave-v3-continue.ts` | Continuazione smoke test (usato per completare repay + withdraw dopo lo script principale) |

### deploy-aave-v3-plugin.ts — Ordine delle Operazioni

```
1. Deploy AaveV3Registry
2. configureToken() × N (WETH, USDC, USDT, WBTC)
   └─ Auto-discovery aToken/debtToken dal Pool Aave
3. Deploy AaveV3Plugin(beacon)
4. registry.transferOwnership(pluginAddress)    ⚠️ DOPO aver configurato i token
5. Deploy AaveV3LensAdapter(beacon)
6. beacon.updateImplementation("AaveV3Registry", registry)
7. beacon.updateImplementation("AaveV3Plugin", plugin)
8. beacon.updateImplementation("AaveV3LensAdapter", lensAdapter)
9. proxyGeneral.authorizeModule(pluginAddress, "AaveV3Plugin")
```

> **NOTA CRITICA**: Il Beacon reale usa `updateImplementation()`, NON `setImplementation()`.
> Quest'ultimo è la funzione del MockBeacon usato nei test.

---

## 6. Test

### File Test

| File | Tipo | Casi | Stato |
|---|---|---|---|
| `test/integration/AaveV3Plugin.fork.test.ts` | Fork test Arbitrum | 85 | ✅ 85/85 passing |

### Copertura (17 sezioni, 85 test)

| Sezione | # Test | Descrizione |
|---|---|---|
| AaveV3Registry Setup | 3 | Deployment, configurazione token, ownership |
| AaveV3Plugin Setup | 3 | Deployment, parametri immutabili, init state |
| Registry Token Management | 6 | CRUD token, batch, remove (swap-and-pop) |
| Plugin Deposit | 5 | Deposit WETH/USDC, balance check, aToken |
| Plugin Withdraw | 5 | Withdraw verso ProxyGeneral, partial/full |
| Plugin Borrow | 5 | Borrow USDC, debt check, HF impact |
| Plugin Repay | 6 | Repay partial/full, dust handling |
| Plugin closePosition(string,string) | 4 | Chiusura per coppia token |
| Plugin closePosition(uint256) | 3 | Chiusura per indice posizione |
| Emergency Operations | 4 | Circuit breaker, emergencyWithdrawAll |
| Access Control | 6 | onlyProtocolManager, onlyOwner, attacker rejection |
| Circuit Breaker | 5 | Activate/deactivate, blocked operations |
| LensAdapter - No Positions | 3 | Stato pulito: value=0, HF=MAX, count=0 |
| LensAdapter - With Positions | 8 | getTotalValue, getValueBreakdown, health, summary |
| LensAdapter - Risk Functions | 5 | positionsAtRisk, sortedByRisk, liquidationThreshold |
| Custody Model Verification | 4 | Fondi mai nel plugin, sempre in ProxyGeneral |
| Aave V3 Pool Integration | 5 | getUserAccountData, reserve list, aToken mapping |

### Esecuzione Test

```bash
# Fork test (richiede FORK_ENABLED=true in env)
cd TestSmartContract
FORK_ENABLED=true npx hardhat test test/integration/AaveV3Plugin.fork.test.ts

# Oppure con il flag hardhat
npx hardhat test test/integration/AaveV3Plugin.fork.test.ts --network hardhat
```

### Mock Modificati

- **MockTokenManager.sol**: Aggiunto `getTokenPriceForModule(string)` e `setTokenPrice(string, uint256)` per supportare la conversione USD→ETH nel LensAdapter

---

## 7. Indirizzi Mainnet

### Contratti Deployed (Arbitrum One)

| Contratto | Indirizzo | Bytecode |
|---|---|---|
| AaveV3Registry | `0xEeb0EA1C430E956266C8027E39cA7A5C855B1a73` | 11,580 bytes |
| AaveV3Plugin | `0x4cFDCb4215F562DC3Bc36D28fCf093E993AdC026` | 21,286 bytes |
| AaveV3LensAdapter | `0xF9d5Cb5a86f0aD469f37F08B27AEf7FdF46ac3E3` | 14,340 bytes |

### Registrazioni

| Sistema | Stato |
|---|---|
| Beacon (`0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870`) | ✅ Tutti e 3 registrati via `updateImplementation()` |
| ProxyGeneral (`0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1`) | ✅ Plugin autorizzato via `authorizeModule()` |
| ProtocolManager (`0x5b8314319CB56864b002caFEB92540B7A7559fBB`) | ✅ Registrato come "AaveV3Plugin" |

### Token Configurati nel Registry

| Token Code | Underlying | aToken | Variable Debt Token |
|---|---|---|---|
| WETH | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` | `0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8` | `0x0c84331e39d6658Cd6e6b9ba04736cC4c4734351` |
| USDC | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | `0x724dc807b04555b71ed48a6896b6F41593b8C637` | `0xf611aEb5013fD2c0511c9CD55c7dc5C1140741A6` |
| USDT | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` | `0x6ab707Aca953eDAeFBc4fD23bA73294241490620` | `0xfb00AC187a8Eb5AFAE4eACE434F493Eb62672df7` |
| WBTC | `0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f` | `0x078f358208685046a11C85e8ad32895DED33A249` | `0x92b42c66840C7AD907b4BF74879FF3eF7c529473` |

### Indirizzi Aave V3 (Arbitrum)

| Componente | Indirizzo |
|---|---|
| Aave V3 Pool | `0x794a61358D6845594F94dc1DB02A252b5b4814aD` |
| Reserve attive | 20 |

### Ownership

| Contratto | Owner |
|---|---|
| AaveV3Registry | AaveV3Plugin (`0x4cFDCb4...`) |
| AaveV3Plugin | Deployer (`0x8390e98...`) |
| AaveV3LensAdapter | Deployer (`0x8390e98...`) |

---

## 8. Differenze Chiave vs Euler V2

| Aspetto | Euler V2 | Aave V3 |
|---|---|---|
| **Architettura** | Vault separato per ogni token (EVault) | Pool unico condiviso |
| **Sub-account** | Sì, fino a 256 via EVC | No, 1 account per address |
| **Collateral enable** | Manuale via EVC batch | Automatico al primo supply |
| **Operazioni atomiche** | EVC batch necessario | Non necessario |
| **Health Factor** | Calcolato manualmente dal LensAdapter | Nativo da `getUserAccountData()` |
| **Interest Rate** | Configurabile per vault | Variable-only (rate mode = 2) |
| **Flash Loan** | Via Balancer (FlashLoanService esterno) | Nativo nel Pool Aave |
| **Registry** | Mappa tokenCode → vault address | Mappa tokenCode → (underlying, aToken, debtToken) |
| **Withdraw** | Withdraw → plugin → safeTransfer → ProxyGeneral | Withdraw con `to` diretto a ProxyGeneral |
| **Complessità contratto** | ~850 righe plugin | ~627 righe plugin |

---

## 9. Note Operative

### Smoke Test Mainnet (Aprile 2026)

Tutti e 4 i flussi verificati con transazioni reali su Arbitrum One:

| Step | Operazione | Importo | Gas | Tx |
|---|---|---|---|---|
| 1 | registerProtocol in PM | — | — | `0x262d99...` |
| 2 | Deposit WETH | 0.001 WETH | 309,495 | `0x79228f...` |
| 3 | Borrow USDC | 0.50 USDC | 398,250 | `0xb499d7...` |
| 4 | Repay USDC | 0.50 USDC | 297,421 | `0x559e8b...` |
| 5 | Withdraw WETH | ~0.00099 WETH | 341,550 | `0x64a020...` |

**Nota sul dust**: Tra borrow e repay Aave matura interessi. Con 0.50 USDC borrowed, il debito è diventato 0.500001 USDC. Ripagando i 0.50 USDC disponibili, resta un dust debt di ~0.000002 USDC, coperto da un dust collateral di ~0.00001 WETH con HF ~9000.

### Aggiunta di Nuovi Token

Per aggiungere un nuovo token al registry (es. ARB, LINK):

1. Il token deve essere nel Pool Aave V3 (verificare `getReservesList()`)
2. L'owner del Registry è il Plugin — serve uno script ad hoc o la funzione `configureToken()` va chiamata tramite il Plugin
3. aToken e debtToken si possono scoprire automaticamente:
   ```solidity
   address aToken = Pool.getReserveAToken(underlying);
   address debtToken = Pool.getReserveVariableDebtToken(underlying);
   ```

### Circuit Breaker

- `activateCircuitBreaker()` — blocca tutte le operazioni tranne emergency
- `deactivateCircuitBreaker()` — ripristina le operazioni
- Solo l'owner del Plugin può attivare/disattivare
- `emergencyWithdrawAll()` funziona ANCHE con circuit breaker attivo

### Gas Approssimativo per Operazione

| Operazione | Gas |
|---|---|
| Deposit | ~310,000 |
| Borrow | ~400,000 |
| Repay | ~300,000 |
| Withdraw | ~340,000 |

---

## Riepilogo File

```
contracts/
├── plugins/
│   ├── AaveV3Registry.sol          ← Registry (246 righe)
│   └── AaveV3Plugin.sol            ← Plugin (627 righe)
├── adapters/
│   └── AaveV3LensAdapter.sol       ← LensAdapter (455 righe)
└── interfaces/
    ├── IAaveV3Plugin.sol            ← Interfaccia plugin
    ├── IAaveV3Registry.sol          ← Interfaccia registry
    └── aave/
        └── IAaveV3Pool.sol          ← Interfaccia Pool Aave V3

scripts/
├── deploy-aave-v3-plugin.ts        ← Deploy completo
├── complete-aave-v3-registration.ts ← Registrazione Beacon (una tantum)
├── preflight-check.ts              ← Controllo pre-deploy
├── verify-aave-v3-deployment.ts    ← Verifica post-deploy
├── smoke-test-aave-v3-mainnet.ts   ← Smoke test mainnet (ciclo completo)
└── smoke-test-aave-v3-continue.ts  ← Continuazione smoke test

test/
└── integration/
    └── AaveV3Plugin.fork.test.ts    ← 85 test cases (fork Arbitrum)

deployments/
└── mainnet-latest.json              ← Indirizzi aggiornati
```
