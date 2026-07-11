# Euler V2 Plugin — Documentazione Completa

> **Stato**: ✅ Deployed su Arbitrum One — Versione attuale: EVC Batch Refactor (fifthPhase)  
> **Pattern**: 3 Musketeers (Registry + Plugin + LensAdapter) + FlashLoanService  
> **Protocollo esterno**: Euler V2 — Vault-based lending con EVC (Ethereum Vault Connector)

---

## Indice

1. [Panoramica](#1-panoramica)
2. [Architettura e Flusso Token](#2-architettura-e-flusso-token)
3. [Concetti Chiave di Euler V2](#3-concetti-chiave-di-euler-v2)
4. [Contratti Solidity](#4-contratti-solidity)
   - 4.1 [EulerRegistry](#41-eulerregistry)
   - 4.2 [EulerV2Plugin](#42-eulerv2plugin)
   - 4.3 [EulerLensAdapter](#43-eulerlensadapter)
   - 4.4 [FlashLoanService (FlashLoanPlugin)](#44-flashloanservice)
5. [Interfacce](#5-interfacce)
6. [Script di Deploy e Operativi](#6-script-di-deploy-e-operativi)
7. [Test](#7-test)
8. [Indirizzi Mainnet](#8-indirizzi-mainnet)
9. [EVC Batch Refactor (fifthPhase)](#9-evc-batch-refactor-fifthphase)
10. [Operazioni di Leverage](#10-operazioni-di-leverage)
11. [Note Operative](#11-note-operative)

---

## 1. Panoramica

L'integrazione Euler V2 è stata la **prima** a seguire il pattern "3 Musketeers" ed è la più complessa del sistema, grazie al supporto per operazioni di leverage atomiche via flash loan.

| Moschettiere | Contratto | Ruolo |
|---|---|---|
| **La Mappa** | EulerRegistry | Mappa `tokenCode → vault`, gestisce posizioni leverage e sub-account EVC |
| **Il Braccio** | EulerV2Plugin | Esegue deposit/withdraw/borrow/repay + leverage atomico via EVC batch |
| **Gli Occhi** | EulerLensAdapter | Letture read-only per ValueCalculator, health monitoring, risk assessment |

> **Componente aggiuntivo** (non fa parte del pattern base):

| Servizio | Contratto | Ruolo |
|---|---|---|
| **Flash Loan** | FlashLoanService | Flash loan Balancer V2 (0% fee) per leverage opening/closing — specifico Euler |

### Perché Euler V2 è più complesso di Aave V3

| Aspetto | Euler V2 | Aave V3 |
|---|---|---|
| Architettura | Vault separato per ogni token (EVault ERC-4626) | Pool unico condiviso |
| Sub-account | Sì, fino a 256 via EVC | No, 1 account per indirizzo |
| Collateral enable | Manuale via `evc.enableCollateral()` | Automatico al primo supply |
| Controller enable | Manuale via `evc.enableController()` | Non necessario |
| Operazioni atomiche | EVC batch obbligatorio per multi-step | Non necessario |
| Health factor | Calcolato via AccountLens esterno | Nativo da `getUserAccountData()` |
| Leverage | Flash loan Balancer + EVC batch | Non integrato (esterno) |
| Flash loan | Via Balancer V2 (0% fee) | Nativo nel Pool |

---

## 2. Architettura e Flusso Token

### Diagramma di Architettura

```
                    ┌────────────────────────────────────────────────────┐
                    │                       BEACON                       │
                    │  "EulerRegistry"         → 0xe55c785...           │
                    │  "EulerV2Plugin"          → 0x383cc64...           │
                    │  "EulerLensAdapter"       → 0xfb76C44...           │
                    │  "FlashLoanService"       → 0x638C017...           │
                    └───┬───────────────┬──────────────┬────────────┬───┘
                        │               │              │            │
                 ┌──────┘        ┌──────┘       ┌──────┘     ┌──────┘
                 ▼               ▼              ▼            ▼
           ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌───────────┐
           │ Registry  │  │    Plugin     │  │ LensAdapter│  │ FlashLoan │
           │           │  │              │  │            │  │ Service   │
           │ vault map │  │ deposit()    │  │ getTotalV()│  │           │
           │ positions │◄─│ withdraw()   │  │ getHF()   │  │ openLev() │
           │ sub-accts │  │ borrow()     │──►│ getAtRisk()│  │ closeLev()│
           │           │  │ repay()      │  │ getAPY()  │  │           │
           └──────────┘  │ leverage()   │  └────────────┘  └─────┬─────┘
                          └──────┬───────┘                        │
                                 │                         ┌──────┘
                    ┌────────────┼─────────┐               │
                    ▼            ▼         ▼               ▼
             ┌──────────┐  ┌────────┐  ┌────────┐  ┌─────────────┐
             │ ProxyGen. │  │  EVC   │  │ EVault │  │  Balancer   │
             │ (Custody) │  │        │  │ (WETH) │  │  Vault      │
             │ 0x875...  │  │0x6302..│  │ (USDC) │  │  (0% fee)   │
             └──────────┘  └────────┘  └────────┘  └─────────────┘
```

### Flusso Token per Operazione Base

| Operazione | Flusso |
|---|---|
| **DEPOSIT** | ProxyGeneral → (withdrawToken) → Plugin → (EVault.deposit) → Euler Vault |
| **WITHDRAW** | Euler Vault → (EVault.redeem) → Plugin → (safeTransfer) → ProxyGeneral |
| **BORROW** | Euler Vault → (EVault.borrow) → Plugin → (safeTransfer) → ProxyGeneral |
| **REPAY** | ProxyGeneral → (withdrawToken) → Plugin → (EVault.repay) → Euler Vault |

### Flusso Leverage Atomico (Flash Loan)

```
1. FlashLoanService richiede flash loan Balancer (USDC, 0% fee)
2. USDC arrivano al FlashLoanService
3. FlashLoanService → callback sul Plugin
4. Plugin esegue EVC batch atomico:
   ├─ enableCollateral(WETH vault)
   ├─ EVault(WETH).deposit(collateral + swapped USDC→WETH)
   ├─ enableController(USDC vault)
   └─ EVault(USDC).borrow(amount per ripagare flash loan)
5. Borrow torna al FlashLoanService → ripaga Balancer
```

> ⚠️ Il Plugin **NON TRATTIENE MAI** asset tra una transazione e l'altra.

---

## 3. Concetti Chiave di Euler V2

### EVC (Ethereum Vault Connector)

L'EVC è l'hub centrale di Euler V2 che coordina tutti i vault. Ogni operazione multi-step passa per l'EVC.

| Concetto | Descrizione |
|---|---|
| **Collateral** | Un vault abilitato come collaterale (garantisce i prestiti) |
| **Controller** | Un vault abilitato come controller (ha il diritto di controllare il conto per i prestiti) |
| **Sub-account** | Ogni indirizzo può avere fino a 256 sub-account (derivati dall'address + uint8) |
| **Batch** | Esecuzione atomica di più operazioni — status check differiti fino a fine batch |
| **BatchItem** | Struct: `{targetContract, onBehalfOfAccount, value, data}` |

### EVault (ERC-4626)

Ogni token ha un vault separato compatibile ERC-4626:

```
WETH Vault: 0x78E3E051D32157AACD550fBB78458762d8f7edFF
USDC Vault: 0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899
```

Le operazioni ERC-4626 usano **shares** internamente:
- `deposit(assets, receiver)` → converte asset in shares
- `redeem(shares, receiver, owner)` → converte shares in asset
- `borrow(assets, receiver)` → genera debito
- `repay(assets, receiver)` → ripaga debito

### Sub-account e Posizioni Leverage

Ogni posizione leverage usa un sub-account EVC dedicato per isolare il rischio:

```
Sub-account 0: Operazioni base (deposit/withdraw semplici)
Sub-account 1: Posizione leverage #1 (WETH collateral → USDC borrow)
Sub-account 2: Posizione leverage #2 (se diversa)
...
```

Il Registry gestisce l'allocazione lazy on-demand dei sub-account (Opzione C):
- Quando si apre una posizione, il Registry assegna il prossimo sub-account disponibile
- Se una posizione viene chiusa, il sub-account può essere riutilizzato per la stessa coppia vault

---

## 4. Contratti Solidity

### 4.1 EulerRegistry

**File**: `contracts/plugins/EulerRegistry.sol` (~716 righe)  
**Interfaccia**: `contracts/interfaces/IEulerRegistry.sol`

A differenza dell'AaveV3Registry (che mappa solo token → indirizzi), l'EulerRegistry ha un doppio ruolo:
1. **Vault Registry**: Mappa `tokenCode → vault address`
2. **Position Manager**: Gestisce posizioni leverage con sub-account EVC

#### Struct LeveragePositionStorage

```solidity
struct LeveragePositionStorage {
    uint8 subAccountId;       // Sub-account EVC (0-255)
    address collateralVault;  // EVault usato come collaterale
    address borrowVault;      // EVault da cui si prende in prestito
    uint256 initialCollateral;
    uint256 borrowedAmount;
    bool isActive;
    uint256 createdAt;
}
```

#### Funzioni — Vault Registry

| Funzione | Accesso | Descrizione |
|---|---|---|
| `setVault(tokenCode, vault)` | onlyOwner | Registra vault per un token |
| `setVaultsBatch(tokenCodes[], vaults[])` | onlyOwner | Registra vault in batch |
| `removeVault(tokenCode)` | onlyOwner | Rimuove vault |
| `getVault(tokenCode)` | view | Indirizzo vault (reverts se non trovato) |
| `getVaultSafe(tokenCode)` | view | Indirizzo vault (address(0) se non trovato) |
| `getTokenCode(vault)` | view | Reverse lookup: vault → tokenCode |
| `isRegistered(tokenCode)` | view | Check se il token è registrato |
| `getAllRegisteredTokens()` | view | Lista tutti i tokenCode |
| `getRegisteredCount()` | view | Conteggio token registrati |
| `getAllVaults()` | view | Tutti i tokenCode + vault address |

#### Funzioni — Position Manager

| Funzione | Accesso | Descrizione |
|---|---|---|
| `createPosition(subAccId, collVault, borrowVault, collateral, borrow)` | onlyOwner | Crea posizione leverage |
| `createPositionOnDemand(collVault, borrowVault, collateral, borrow)` | onlyOwner | Crea con allocazione lazy sub-account |
| `updatePosition(positionId, newBorrowAmount)` | onlyOwner | Aggiorna importo prestito |
| `closePositionRecord(positionId)` | onlyOwner | Chiude posizione (rimuove da active) |
| `getPosition(positionId)` | view | Dettagli posizione (reverts) |
| `getPositionSafe(positionId)` | view | Dettagli posizione (zero struct) |
| `getAllPositions()` | view | Tutte le posizioni (attive e non) |
| `getActivePositions()` | view | Solo posizioni attive + IDs |
| `getActivePositionCount()` | view | Conteggio posizioni attive |
| `getActivePositionIds()` | view | Array di ID posizioni attive |
| `isPositionActive(positionId)` | view | Check se posizione è attiva |
| `getSubAccountForPair(collVault, borrowVault)` | view | Sub-account per coppia vault |
| `hasActivePositionForPair(collVault, borrowVault)` | view | Check posizione attiva per coppia |

#### Eventi

- `VaultSet(tokenCode, vault, isNew)`
- `VaultRemoved(tokenCode, vault)`
- `PositionCreated(positionId, subAccountId, collateralVault, borrowVault)`
- `PositionUpdated(positionId, borrowedAmount)`
- `PositionClosed(positionId)`

#### Note

- **Ownership**: Trasferita al Plugin dopo configurazione iniziale vault
- **Allocazione Lazy (Opzione C)**: `createPositionOnDemand()` alloca il prossimo sub-account disponibile. Se la stessa coppia vault ha una posizione chiusa, il sub-account viene riutilizzato
- **Position ID**: Counter incrementale (`nextPositionId`)
- **Active Array**: Usa swap-and-pop per O(1) removal dal array delle posizioni attive

---

### 4.2 EulerV2Plugin

**File**: `contracts/plugins/EulerV2Plugin.sol` (1,412 righe)  
**Interfaccia**: `contracts/interfaces/IEulerV2Plugin.sol` + `IEulerV2PluginSpecific.sol`

Il contratto più grande del sistema. Implementa operazioni base + leverage atomico via EVC batch.

#### Costanti Immutabili

```solidity
EVC_ADDRESS    = 0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066  // Euler Vault Connector
ACCOUNT_LENS   = 0x90a52DDcb232e7bb003DD9258fA1235c553eC956  // Per health factor queries
MIN_HEALTH_FACTOR = 1.05e18                                    // Soglia sicurezza minima
```

#### Funzioni — Operazioni Base

| Funzione | Accesso | Descrizione |
|---|---|---|
| `deposit(tokenCode, amount)` | onlyProtocolManager | Deposita in EVault via EVC batch (enableCollateral + deposit) |
| `withdraw(tokenCode, amount)` | onlyProtocolManager | Preleva da EVault, trasferisce a ProxyGeneral |
| `borrow(tokenCode, amount)` | onlyProtocolManager | Prende in prestito via EVC batch (enableController + borrow) |
| `repay(tokenCode, amount)` | onlyProtocolManager | Ripaga debito in EVault |
| `closePosition(debtToken, collateralToken)` | onlyProtocolManager | Chiude posizione atomicamente via EVC batch |
| `closePosition(positionId)` | — | Chiude posizione per ID |
| `closePositionsForWeth(targetAmount)` | onlyOwnerOrLM | Chiude posizioni per ottenere WETH target |

#### Funzioni — Leverage Atomico

| Funzione | Accesso | Descrizione |
|---|---|---|
| `openLeverageAtomic(params)` | onlyOwner | Apre posizione leva via flash loan + EVC batch |
| `closeLeverageAtomic(params)` | onlyOwnerOrLM | Chiude posizione leva via flash loan + EVC batch |
| `addCollateralToPosition(posId, amount)` | onlyOwner | Aggiunge collaterale a posizione esistente |
| `removeCollateralFromPosition(posId, amount)` | onlyOwner | Rimuove collaterale da posizione |
| `onFlashLoanReceived(tokens, amounts, fees, data)` | external | Callback dal FlashLoanService |

#### Funzioni — Query

| Funzione | Descrizione |
|---|---|
| `getBalance(tokenCode)` | Balance in vault (convertito in asset, non shares) |
| `getDebt(tokenCode)` | Debito corrente inclusi interessi |
| `getHealthFactor()` | Health factor (1e18 scale), MAX se no debito |

#### Funzioni — Emergency

| Funzione | Accesso | Descrizione |
|---|---|---|
| `emergencyWithdrawAll(tokenCodes[])` | onlyOwner | Preleva tutto in emergenza |
| `setCircuitBreaker(bool)` | onlyOwner | Set circuit breaker |
| `activateCircuitBreaker()` | onlyOwner | Attiva emergency stop |

#### Modifiers

| Modifier | Descrizione |
|---|---|
| `onlyProtocolManager()` | Solo ProtocolManager o owner |
| `notCircuitBroken()` | Solo se circuit breaker è OFF |
| `onlyOwnerOrLiquidityManager()` | Owner, LiquidityManager, o self (per closePositionsForWeth) |

#### Helper Interno: `_batchItem()`

```solidity
function _batchItem(
    address targetContract,
    address onBehalfOfAccount,
    bytes memory data
) internal pure returns (IEVC.BatchItem memory)
```

Costruttore compatto per `IEVC.BatchItem`. Riduce la ripetizione nelle 6 funzioni che usano batch.

#### Eventi

- `EulerDeposit(tokenCode, vault, amount, sharesReceived)`
- `EulerWithdrawal(tokenCode, vault, amount, sharesBurned)`
- `EulerBorrow(tokenCode, vault, amount)`
- `EulerRepay(tokenCode, vault, amount)`
- `LeverageOpenedAtomic(user, collateralVault, borrowVault, initialCol, totalCol, totalDebt, hf, leverageX100)`
- `LeverageClosedAtomic(user, collateralVault, borrowVault, debtRepaid, colWithdrawn, colReturned)`
- `EmergencyWithdraw(tokenCode, amount)`

#### Struct FlashLoanCallbackContext

```solidity
struct FlashLoanCallbackContext {
    OperationType operation;    // OPEN o CLOSE
    address user;
    address collateralVault;
    address borrowVault;
    uint256 initialCollateral;
    uint256 maxSlippageBps;
}
```

---

### 4.3 EulerLensAdapter

**File**: `contracts/adapters/EulerLensAdapter.sol` (1,247 righe)  
**Interfaccia**: `contracts/interfaces/IEulerLensAdapter.sol`

Il LensAdapter più complesso del sistema — gestisce multi-account, leverage positions e time-to-liquidation.

#### Costanti Esterne Euler

```solidity
ACCOUNT_LENS = 0x90a52DDcb232e7bb003DD9258fA1235c553eC956
VAULT_LENS   = 0xc99FCEE6174Bc92eBe9C78690fFD5067018a8380
UTILS_LENS   = 0xDAf44060DCe217Fd603908A49fcaa1FA900304BE
EVC_ADDRESS  = 0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066
DEFAULT_SAFE_HEALTH_FACTOR = 1.5e18
```

#### Funzioni — Valore e Breakdown

| Funzione | Descrizione |
|---|---|
| `getTotalValue()` | Valore netto totale (collateral − debt) in ETH |
| `getValueBreakdown()` | Breakdown: totalCollateral, totalDebt, netValue, available |
| `getTotalEulerValue()` | Net value specifico Euler |
| `getEulerPositionValues()` | (totalCollateral, totalDebt, netValue) dettagliato |
| `getWithdrawableAmount(tokenCode)` | Max prelevabile mantenendo health factor sicuro |
| `estimateWethFromCloseAll()` | Stima WETH ottenibili chiudendo tutto |

#### Funzioni — Health Monitoring

| Funzione | Descrizione |
|---|---|
| `getHealthFactor()` | HF minimo tra tutte le posizioni |
| `getHealthFactor(account)` | HF per account specifico |
| `getSubAccountHealth(subAccount, controllerVault)` | HF per uno specifico sub-account |
| `getTimeToLiquidation(account, vault)` | Tempo stimato alla liquidazione + status string |
| `getPositionHealthFactor(positionId)` | HF di una singola posizione |

#### Funzioni — Status Time-to-Liquidation

| Status | Significato |
|---|---|
| `"LIQUIDATABLE"` | Già liquidabile |
| `"SAFE_NO_DEBT"` | Nessun debito |
| `"SAFE_OVER_1_YEAR"` | Più di 1 anno alla liquidazione |
| `"AT_RISK"` | Sotto soglia, monitorare |
| `"UNKNOWN"` / `"ERROR"` | Errore di calcolo |

#### Funzioni — Risk Assessment

| Funzione | Descrizione |
|---|---|
| `getEulerPositionsAtRisk(minHF)` | ID posizioni sotto soglia |
| `getPositionsAtRisk(minHF)` | Posizioni con dettagli rischio (ILensAdapter standard) |
| `getPositionsSortedByRisk()` | Tutte le posizioni ordinate per rischio |
| `shouldAutoClosePosition(posId, threshold)` | Raccomandazione auto-close per LiquidityManager |
| `getLiquidationThreshold(posId)` | Soglia in ETH per liquidazione |

#### Funzioni — Yield e APY

| Funzione | Descrizione |
|---|---|
| `getVaultAPYs(vault)` | Supply e borrow APY per vault |
| `getYieldInfo(tokenCode)` | Info yield per token (ILensAdapter standard) |
| `getNetAPY()` | APY netto aggregato (supply − borrow cost) |

#### Funzioni — Protocollo

| Funzione | Descrizione |
|---|---|
| `protocolName()` | Ritorna `"Euler"` |
| `protocolType()` | Ritorna `ProtocolType.LENDING` |
| `isCircuitBreakerActive()` | Stato circuit breaker |
| `getPlugin()` | Indirizzo plugin associato |
| `getActivePositionCount()` | Conteggio posizioni attive |
| `getProtocolSummary()` | Overview per dashboard |
| `getProtocolLimits()` | Min HF e max leverage |

#### Conversione Valuta

A differenza di Aave (che usa USD base con 8 decimali), Euler non ha un formato unificato.
Il LensAdapter converte i valori in ETH usando `TokenManager.getTokenPriceForModule()` per ogni token.

---

### 4.4 FlashLoanService

**File**: `contracts/services/FlashLoanService.sol` + `contracts/plugins/FlashLoanPlugin.sol` (~879 righe totali)

Il servizio di flash loan usa **Balancer V2** (0% fee) per le operazioni di leverage.

#### Costanti

```solidity
BALANCER_VAULT = 0xBA12222222228d8Ba445958a75a0704d566BF2C8  // Balancer V2 Vault
SIMPLE_SWAP    = 0xa0DB78167CBAccD47524a261b7741C6B41Bbd096  // Uniswap V3 Router
WETH_VAULT     = 0x78E3E051D32157AACD550fBB78458762d8f7edFF
USDC_VAULT     = 0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899
```

#### Funzioni Principali

| Funzione | Descrizione |
|---|---|
| `openLeverageWithFlashLoan(params)` | Apre posizione leverage con flash loan |
| `closeLeverageWithFlashLoan(params)` | Chiude posizione leverage con flash loan |
| `receiveFlashLoan(tokens, amounts, fees, data)` | Callback Balancer V2 |
| `getCurrentLeverage(collVault, borrowVault)` | Leverage corrente + HF + time to liquidation |
| `simulateOpenLeverage(params)` | Simula apertura senza eseguire |
| `emergencyWithdraw(tokenCode)` | Emergency withdraw |

#### Struct OpenLeverageParams

```solidity
struct OpenLeverageParams {
    string collateralToken;     // "WETH"
    string borrowToken;         // "USDC"
    uint256 collateralAmount;   // Importo iniziale
    uint256 targetLeverageX100; // 200 = 2x, 300 = 3x
    uint256 minHealthFactor;    // Soglia sicurezza (es. 1.3e18)
    uint256 deadline;           // Block timestamp limite
}
```

#### Struct CloseLeverageParams

```solidity
struct CloseLeverageParams {
    string collateralToken;
    string borrowToken;
    uint256 maxSlippageBps;     // Basis points (es. 100 = 1%)
    uint256 deadline;
}
```

#### Flusso Open Leverage

```
1. User chiama openLeverageWithFlashLoan({WETH, USDC, 1 ETH, 200, 1.3e18})
2. Calcolo: per 2x leverage su 1 WETH, serve ~$1800 USDC flash loan
3. FlashLoanService → Balancer.flashLoan(USDC, $1800)
4. Balancer invia $1800 USDC → FlashLoanService
5. FlashLoanService swappa USDC → WETH via UniswapV3
6. FlashLoanService → Plugin.onFlashLoanReceived()
7. Plugin esegue EVC batch atomico:
   ├─ evc.enableCollateral(WETH vault)
   ├─ WETH vault.deposit(initialWETH + swappedWETH)   → ~2 WETH collateral
   ├─ evc.enableController(USDC vault)
   └─ USDC vault.borrow($1800)                         → genera debito
8. USDC borrows → FlashLoanService → ripaga Balancer
9. Risultato: 2x leverage, ~2 WETH collateral, ~$1800 USDC debito
```

#### Flusso Close Leverage

```
1. User chiama closeLeverageWithFlashLoan({WETH, USDC, 100bps})
2. FlashLoanService calcola debito esatto → flashLoan(USDC, debitAmount)
3. Balancer invia USDC → FlashLoanService
4. Plugin esegue EVC batch atomico:
   ├─ USDC vault.repay(debt)          → ripaga tutto il debito
   ├─ WETH vault.redeem(allShares)    → preleva tutto il collaterale
   ├─ USDC vault.disableController()  → pulisce stato EVC
   └─ evc.disableCollateral(WETH)     → pulisce stato EVC
5. Plugin swappa parte del WETH → USDC per ripagare flash loan
6. WETH rimanente → ProxyGeneral (profitto + capitale iniziale)
```

---

## 5. Interfacce

### Interfacce del Plugin

| File | Descrizione |
|---|---|
| `interfaces/IEulerV2Plugin.sol` | Interfaccia principale plugin |
| `interfaces/IEulerV2PluginSpecific.sol` | Funzioni specifiche Euler (leverage, etc.) |
| `interfaces/IEulerRegistry.sol` | Interfaccia registry (vault + positions) |
| `interfaces/IEulerLensAdapter.sol` | Interfaccia lens adapter |

### Interfacce Euler V2 Esterne

| File | Descrizione |
|---|---|
| `interfaces/euler/IEVC.sol` | Ethereum Vault Connector — batch, collateral/controller enable |
| `interfaces/euler/IEVault.sol` | EVault ERC-4626 — deposit, redeem, borrow, repay, disableController |
| `interfaces/euler/IEulerVaultRegistry.sol` | Vault registry Euler |
| `interfaces/euler/IAccountLens.sol` | Lens per health factor e account data |
| `interfaces/euler/ISwapper.sol` | Swapper interface per operazioni swap |

### Funzioni IEVC Utilizzate

| Funzione EVC | Usata da | Scopo |
|---|---|---|
| `batch(BatchItem[])` | Plugin (deposit, borrow, closePosition, leverage callbacks) | Operazioni atomiche |
| `enableCollateral(account, vault)` | Plugin (via batch) | Abilita vault come collaterale |
| `disableCollateral(account, vault)` | Plugin (via batch) | Disabilita collaterale |
| `enableController(account, vault)` | Plugin (via batch) | Abilita vault come controller |
| `disableController(account)` | Plugin (via batch) | Disabilita controller |
| `isCollateralEnabled(account, vault)` | Plugin | Check prima di enableCollateral |
| `isControllerEnabled(account, vault)` | Plugin | Check prima di enableController |
| `getSubAccount(owner, id)` | Plugin/Registry | Derivare indirizzo sub-account |

### Funzioni IEVault Utilizzate

| Funzione Vault | Usata da | Scopo |
|---|---|---|
| `deposit(assets, receiver)` | Plugin | Depositare asset nel vault |
| `redeem(shares, receiver, owner)` | Plugin | Ritirare asset dal vault |
| `borrow(assets, receiver)` | Plugin | Prendere in prestito |
| `repay(assets, receiver)` | Plugin | Ripagare debito |
| `disableController()` | Plugin (via batch) | Disabilita controller dal vault |
| `debtOf(account)` | Plugin/LensAdapter | Query debito corrente |
| `balanceOf(account)` | Plugin/LensAdapter | Query shares possedute |
| `convertToAssets(shares)` | Plugin/LensAdapter | Conversione shares → asset |
| `totalAssets()` | LensAdapter | Totale asset nel vault |
| `totalBorrows()` | LensAdapter | Totale debito nel vault |

---

## 6. Script di Deploy e Operativi

### Script di Deployment (`scripts/deployment/euler/`)

| Script | Scopo |
|---|---|
| `deploy-euler-registry.ts` | Deploy EulerRegistry |
| `deploy-euler-plugin.ts` | Deploy EulerV2Plugin |
| `deploy-euler-lens.ts` | Deploy EulerLensAdapter |
| `deploy-flashloan-service.ts` | Deploy FlashLoanService |
| `upgrade-euler-plugin.ts` | Upgrade plugin per EVC Batch Refactor (fifthPhase) |
| `authorize-plugin.ts` | Autorizza plugin in ProxyGeneral |
| `register-contracts.ts` | Registra contratti nel Beacon |
| `register-registry-in-beacon.ts` | Registra registry nel Beacon |
| `register-euler-in-pm.ts` | Registra Euler in ProtocolManager |
| `configure-euler-system.ts` | Configurazione completa sistema |
| `simulate-full-deploy.ts` | Simulazione deploy completa |

### Script Utility (`scripts/utils/plugins/euler/`)

| Script | Scopo |
|---|---|
| `euler-helpers.ts` | Funzioni helper condivise |
| `check-evc-status.ts` | Verifica stato EVC (collateral/controller) |
| `check-vault-state.ts` | Verifica stato vault |
| `check-controllers.ts` | Verifica controller abilitati |
| `disable-controller.ts` | Disabilita controller manualmente |
| `disable-collateral.ts` | Disabilita collaterale manualmente |
| `debug-position.ts` | Debug dettagliato posizione |
| `force-redeem.ts` | Force redeem token da vault |
| `fund-proxy-usdc.ts` | Fondi ProxyGeneral con USDC |
| `repay-exact-debt.ts` | Ripaga debito esatto |
| `withdraw-from-old-plugin.ts` | Migra fondi da plugin precedente |

### Script di Test (`scripts/testing/plugins/euler/`)

| Script | Scopo |
|---|---|
| `test-deposit.ts` | Test deposit su mainnet |
| `test-withdraw.ts` | Test withdraw su mainnet |
| `test-borrow.ts` | Test borrow su mainnet |
| `test-repay.ts` | Test repay su mainnet |
| `test-leverage-open.ts` | Test apertura leverage su mainnet |
| `test-leverage-close.ts` | Test chiusura leverage su mainnet |
| `check-position.ts` | Verifica posizione su mainnet |

### Script Discovery (`scripts/euler/`)

| Script | Scopo |
|---|---|
| `discover-vaults.ts` | Scopri vault disponibili su Euler V2 |
| `swap-data-helper.ts` | Helper per dati swap |
| `generate-swap-data.ts` | Genera dati swap |
| `swap-data-cache.json` | Cache dati swap pre-calcolati |

---

## 7. Test

### File di Test

| File | Tipo | Casi | Descrizione |
|---|---|---|---|
| `EulerV2Plugin.batch.test.ts` | Fork test | **47** | Test completo EVC batch pattern (fifthPhase) |
| `EulerV2Plugin.fork.test.ts` | Fork test | — | Test con contratti Euler reali |
| `EulerV2Plugin.leverage.test.ts` | Fork test | — | Operazioni leverage |
| `EulerV2Plugin.leverage.e2e.test.ts` | E2E | — | Leverage end-to-end |
| `EulerV2Plugin.manualLeverage.e2e.test.ts` | E2E | — | Leverage manuale |
| `EulerV2Plugin.phase3.test.ts` | Fork test | — | Test phase 3 |
| `EulerV2Plugin.closePositionsForWeth.test.ts` | Fork test | — | Test chiusura posizioni WETH |
| `EulerV2Plugin.realfunds.test.ts` | Fork test | — | Test con fondi reali |
| `EulerLensAdapter.e2e.test.ts` | E2E | — | LensAdapter end-to-end |
| `ProtocolManager.euler.test.ts` | Integration | — | Integrazione via ProtocolManager |
| `FlashLoanService.e2e.test.ts` | E2E | — | Flash loan service |
| `FlashLoanPlugin.e2e.test.ts` | E2E | — | Flash loan plugin |

### Test Suite EVC Batch (47/47 ✅)

| Sezione | # Test |
|---|---|
| Deposit Operations | 5 |
| Withdraw Operations | 4 |
| Borrow Operations | 4 |
| Repay Operations | 4 |
| ClosePosition (string,string) | 3 |
| OpenLeverageAtomic | 3 |
| CloseLeverageAtomic | 3 |
| Circuit Breaker | 4 |
| Emergency Withdraw | 2 |
| View Functions | 5 |
| Full Cycle — EVC State | 3 |
| Multi-Token Operations | 3 |
| Gas Report | 4 |

### Gas Report (da fork test)

| Operazione | Gas |
|---|---|
| Deposit (primo, con enableCollateral) | ~268,000 |
| Deposit (successivo, collaterale già) | ~195,000 |
| Borrow (primo) | ~370,000 |
| Borrow (successivo) | ~314,000 |
| ClosePosition | ~370,000 |
| OpenLeverageAtomic (2x WETH) | ~1,380,000 |
| CloseLeverageAtomic | ~818,000 |

---

## 8. Indirizzi Mainnet

### Contratti Deployed (Arbitrum One)

| Contratto | Indirizzo | Note |
|---|---|---|
| EulerRegistry | `0xe55c78577c84E2cB6E71F8Eb134a66e7B1d9fd56` | |
| EulerV2Plugin | `0x383cc6487772bc1AABd2e74884ad23F313005ACB` | fifthPhase (22,538 bytes) |
| EulerLensAdapter | `0xfb76C4475149F1843bdF1d327569A12a027Be833` | |
| FlashLoanService | `0x638C0175a1883063F22fc2439C85364e4aC27b03` | |

### Versioni Precedenti Plugin

| Versione | Indirizzo | Note |
|---|---|---|
| Pre-fifthPhase | `0x46B5f0D51311c09e9d93be7d16fA75BECC654D5b` | Sostituito da EVC batch refactor |
| Corrente | `0x383cc6487772bc1AABd2e74884ad23F313005ACB` | upgradeType: "EVC Batch Refactor (fifthPhase)" |

### Registrazioni

| Sistema | Stato |
|---|---|
| Beacon | ✅ Tutti e 4 registrati (Registry, Plugin, LensAdapter, FlashLoanService) |
| ProxyGeneral | ✅ Plugin autorizzato |
| ProtocolManager | ✅ Registrato come "Euler" |

### Vault Configurati

| Token | Euler Vault | Tipo |
|---|---|---|
| WETH | `0x78E3E051D32157AACD550fBB78458762d8f7edFF` | ERC-4626 |
| USDC | `0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899` | ERC-4626 |

### Indirizzi Euler V2 Esterni (Arbitrum)

| Componente | Indirizzo |
|---|---|
| EVC (Ethereum Vault Connector) | `0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066` |
| Account Lens | `0x90a52DDcb232e7bb003DD9258fA1235c553eC956` |
| Vault Lens | `0xc99FCEE6174Bc92eBe9C78690fFD5067018a8380` |
| Utils Lens | `0xDAf44060DCe217Fd603908A49fcaa1FA900304BE` |
| Balancer V2 Vault | `0xBA12222222228d8Ba445958a75a0704d566BF2C8` |
| Uniswap V3 Router (SimpleSwap) | `0xa0DB78167CBAccD47524a261b7741C6B41Bbd096` |

### Ownership

| Contratto | Owner |
|---|---|
| EulerRegistry | EulerV2Plugin (`0x383cc64...`) |
| EulerV2Plugin | Deployer (`0x8390e98...`) |
| EulerLensAdapter | Deployer (`0x8390e98...`) |
| FlashLoanService | Deployer (`0x8390e98...`) |

---

## 9. EVC Batch Refactor (fifthPhase)

Il refactoring più importante della vita del plugin—ha convertito tutte le operazioni multi-step da chiamate individuali a **EVC batch atomici**.

### Bug Critico Risolto: `disableController`

| | Vecchia Interfaccia (IEVC.sol) | EVC Reale On-Chain |
|---|---|---|
| Firma | `disableController(address account, address vault)` | `disableController(address account)` |
| Parametri | 2 | 1 |
| Risultato | ❌ REVERT su mainnet | ✅ Funzionante |

La fix: chiamare `IEVault(vault).disableController()` (0 parametri) dal vault stesso, che internamente chiama `evc.disableController(account)` dove il vault è il controller effettivo.

### Operazioni Convertite a Batch

| Operazione | Prima | Dopo |
|---|---|---|
| **deposit** | 2 chiamate separate | 1 batch: [enableCollateral, deposit] |
| **borrow** | 2 chiamate separate | 1 batch: [enableController, borrow] |
| **closePosition** | 4 chiamate + self-call + BUG | 1 batch: [repay, disableController, redeem, disableCollateral] |
| **openLeverage callback** | 4 chiamate individuali | 1 batch: [enableCollateral, deposit, enableController, borrow] |
| **closeLeverage callback** | 2 chiamate, nessun cleanup | 1 batch: [repay, redeem, disableController, disableCollateral] |

### Schema EVC Batch

```
┌─────────────────────────────────────────────────────────┐
│                  evc.batch(BatchItem[])                   │
│                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ enable   │→ │ deposit  │→ │ enable   │→ │ borrow  │ │
│  │ Collat.  │  │ (vault)  │  │ Control. │  │ (vault) │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│                                                           │
│  Status checks DEFERRED fino a completamento batch        │
│  All-or-nothing: revert annulla TUTTO                     │
└─────────────────────────────────────────────────────────┘
```

### Ottimizzazione Bytecode

| Metrica | Pre-Refactor | Post-Refactor | Post-Ottimizzazione |
|---|---|---|---|
| Bytecode | 24,530 bytes | 26,143 bytes ❌ | **22,538 bytes** ✅ |
| Margine vs limite (24,576) | 46 bytes (0.2%) | -1,567 bytes | **+2,038 bytes (8.3%)** |

Ottimizzazioni applicate:
- Rimosso codice morto (4 eventi, 5 errori, 1 costante inutilizzati)
- Rimossa `_closeLeverageAtomicForWeth()` (~65 righe) — duplicava logica
- Rimossa `_closeNormalDepositsForWeth()` (~70 righe) — duplicava logica
- Aggiunto `address(this)` al modifier `onlyOwnerOrLiquidityManager` per self-call

---

## 10. Operazioni di Leverage

### Parametri Leverage

| Parametro | Descrizione | Esempio |
|---|---|---|
| `targetLeverageX100` | Moltiplicatore × 100 | 200 = 2x, 300 = 3x |
| `minHealthFactor` | Soglia di sicurezza | 1.3e18 = 1.3 |
| `maxSlippageBps` | Slippage massimo in bps | 100 = 1% |
| `deadline` | Block timestamp scadenza | block.timestamp + 300 |

### Esempio: Apertura 2x Leverage su WETH

```
Input:  1 WETH, target 2x WETH/USDC
Azione: Flash loan ~$1800 USDC → swap a ~1 WETH → deposit 2 WETH → borrow $1800 USDC → ripaga flash
Output: ~2 WETH collateral, ~$1800 USDC debt, HF ~1.5

Profitto se WETH ↑ 10%: +10% su 2 WETH = 0.2 WETH (invece di 0.1 WETH senza leverage)
Perdita se WETH ↓ 10%:  -10% su 2 WETH = -0.2 WETH (amplificato)
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

## 11. Note Operative

### Deploy Sequence Completa

```
1. Deploy EulerRegistry
2. setVault("WETH", 0x78E3...) + setVault("USDC", 0x0a1e...)
3. Deploy EulerV2Plugin(beacon)
4. registry.transferOwnership(pluginAddress)
5. Deploy EulerLensAdapter(beacon)
6. Deploy FlashLoanService(beacon)
7. Beacon.updateImplementation("EulerRegistry", registry)
8. Beacon.updateImplementation("EulerV2Plugin", plugin)
9. Beacon.updateImplementation("EulerLensAdapter", lensAdapter)
10. Beacon.updateImplementation("FlashLoanService", flashLoanService)
11. ProxyGeneral.authorizeModule(pluginAddress, "EulerV2Plugin")
12. ProtocolManager.registerProtocol("Euler", plugin, lensAdapter, registry)
```

### Aggiunta Nuovi Token

Per aggiungere un nuovo token (es. WBTC):
1. Verificare che esista un EVault su Euler V2 per quel token
2. L'owner del Registry è il Plugin — serve uno script per chiamare `setVault()` tramite il plugin o un upgrade
3. Aggiornare il LensAdapter se necessario
4. Testare deposit/withdraw/borrow/repay per il nuovo token

### Differenza tra FlashLoanService e FlashLoanPlugin

| | FlashLoanService | FlashLoanPlugin |
|---|---|---|
| File | `contracts/services/FlashLoanService.sol` | `contracts/plugins/FlashLoanPlugin.sol` |
| Scopo | Servizio flash loan completo | Plugin wrapper per integrare con il sistema |
| Deploy | Deployato separatamente | — |
| Beacon name | "FlashLoanService" | — |

### Upgrade History

| Data | Versione | Cambiamenti |
|---|---|---|
| — | Versione iniziale | Chiamate dirette ai vault |
| Gennaio 2026 | fifthPhase (EVC Batch) | EVC batch pattern + fix disableController + ottimizzazione bytecode |

---

## Riepilogo File

```
contracts/
├── plugins/
│   ├── EulerV2Plugin.sol             ← Plugin principale (1,412 righe)
│   ├── EulerRegistry.sol             ← Registry vault + positions (~716 righe)
│   ├── EulerWethHelper.sol           ← Helper WETH
│   └── FlashLoanPlugin.sol           ← Plugin wrapper flash loan (~879 righe)
├── services/
│   └── FlashLoanService.sol          ← Servizio flash loan Balancer
├── adapters/
│   └── EulerLensAdapter.sol          ← LensAdapter (1,247 righe)
└── interfaces/
    ├── IEulerV2Plugin.sol            ← Interfaccia plugin
    ├── IEulerV2PluginSpecific.sol    ← Funzioni specifiche
    ├── IEulerRegistry.sol            ← Interfaccia registry
    ├── IEulerLensAdapter.sol         ← Interfaccia lens adapter
    ├── ILensAdapter.sol              ← Interfaccia standard lens
    ├── IProtocolAdapter.sol          ← Interfaccia standard plugin
    ├── ILendingProtocol.sol          ← Interfaccia lending
    └── euler/
        ├── IEVC.sol                  ← Ethereum Vault Connector
        ├── IEVault.sol               ← EVault ERC-4626
        ├── IEulerVaultRegistry.sol   ← Vault registry
        ├── IAccountLens.sol          ← Account lens
        └── ISwapper.sol              ← Swapper

scripts/
├── deployment/euler/
│   ├── deploy-euler-registry.ts      ← Deploy registry
│   ├── deploy-euler-plugin.ts        ← Deploy plugin
│   ├── deploy-euler-lens.ts          ← Deploy lens adapter
│   ├── deploy-flashloan-service.ts   ← Deploy flash loan
│   ├── upgrade-euler-plugin.ts       ← Upgrade fifthPhase
│   ├── authorize-plugin.ts           ← Autorizza in ProxyGeneral
│   ├── register-contracts.ts         ← Registra in Beacon
│   ├── register-registry-in-beacon.ts
│   ├── register-euler-in-pm.ts       ← Registra in ProtocolManager
│   ├── configure-euler-system.ts     ← Config completa
│   └── simulate-full-deploy.ts       ← Simulazione
├── utils/plugins/euler/
│   ├── euler-helpers.ts              ← Helpers condivisi
│   ├── check-evc-status.ts           ← Verifica EVC
│   ├── check-vault-state.ts          ← Verifica vault
│   ├── check-controllers.ts          ← Verifica controller
│   ├── disable-controller.ts         ← Disabilita controller
│   ├── disable-collateral.ts         ← Disabilita collaterale
│   ├── debug-position.ts             ← Debug posizione
│   ├── force-redeem.ts               ← Force redeem
│   ├── fund-proxy-usdc.ts            ← Fondi USDC
│   ├── repay-exact-debt.ts           ← Ripaga debito esatto
│   └── withdraw-from-old-plugin.ts   ← Migrazione da plugin vecchio
├── testing/plugins/euler/
│   ├── test-deposit.ts               ← Test deposit mainnet
│   ├── test-withdraw.ts              ← Test withdraw mainnet
│   ├── test-borrow.ts                ← Test borrow mainnet
│   ├── test-repay.ts                 ← Test repay mainnet
│   ├── test-leverage-open.ts         ← Test leverage open mainnet
│   ├── test-leverage-close.ts        ← Test leverage close mainnet
│   └── check-position.ts             ← Verifica posizione mainnet
└── euler/
    ├── discover-vaults.ts            ← Scopri vault Euler
    ├── swap-data-helper.ts           ← Helper swap
    ├── generate-swap-data.ts         ← Genera dati swap
    └── swap-data-cache.json          ← Cache swap

test/integration/
├── EulerV2Plugin.batch.test.ts       ← 47 test EVC batch (✅ principale)
├── EulerV2Plugin.fork.test.ts        ← Fork test
├── EulerV2Plugin.leverage.test.ts    ← Leverage test
├── EulerV2Plugin.leverage.e2e.test.ts
├── EulerV2Plugin.manualLeverage.e2e.test.ts
├── EulerV2Plugin.phase3.test.ts
├── EulerV2Plugin.closePositionsForWeth.test.ts
├── EulerV2Plugin.realfunds.test.ts
├── EulerLensAdapter.e2e.test.ts
├── ProtocolManager.euler.test.ts
├── FlashLoanService.e2e.test.ts
└── FlashLoanPlugin.e2e.test.ts

docs/
└── 28_RefactoringAnalisys/Contracts/Plugin/Euler/fifthPhase/
    ├── Report.md                     ← Report completo EVC batch refactor
    └── Proposal.md                   ← Proposal iniziale refactoring

deployments/
└── mainnet-latest.json               ← Indirizzi aggiornati
```
