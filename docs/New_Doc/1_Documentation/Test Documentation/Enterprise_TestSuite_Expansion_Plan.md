# Enterprise Test Suite Expansion Plan

> **Progetto**: TestSmartContract  
> **Documento**: Piano di espansione verso qualità enterprise  
> **Data**: 11 Luglio 2026 — **Revisione tecnica**: 11 Luglio 2026  
> **Obiettivo**: Portare la test suite da "funzionale" a "enterprise-grade" — copertura completa, bug rimossi, scenari reali su fork Arbitrum, invarianti di sistema, attacchi simulati

> **⚠️ NOTA REVISIONE**: Questo documento è stato aggiornato dopo analisi approfondita di tutti i contratti. Alcune proposte originali contenevano errori tecnici (costruttori sbagliati, flussi non corrispondenti all'architettura reale). Le sezioni corrette sono marcate con `[CORRETTO]`, le nuove con `[NUOVO]`.

---

## Indice

1. [Stato di partenza — Analisi dei gap](#1-stato-di-partenza--analisi-dei-gap)
2. [Fix immediati — Bug bloccanti](#2-fix-immediati--bug-bloccanti)
3. [Categoria A — Test di Protocollo Avanzati (fork Arbitrum)](#3-categoria-a--test-di-protocollo-avanzati-fork-arbitrum)
4. [Categoria B — Invarianti di Sistema](#4-categoria-b--invarianti-di-sistema)
5. [Categoria C — Scenari di Attacco e Sicurezza](#5-categoria-c--scenari-di-attacco-e-sicurezza)
6. [Categoria D — Test Multi-Protocollo e Cross-Module](#6-categoria-d--test-multi-protocollo-e-cross-module)
7. [Categoria E — Stress Test e Performance su Fork](#7-categoria-e--stress-test-e-performance-su-fork)
8. [Categoria F — Edge Cases e Boundary Conditions](#8-categoria-f--edge-cases-e-boundary-conditions)
9. [Infrastruttura di Test Enterprise](#9-infrastruttura-di-test-enterprise)
10. [Piano di Esecuzione — Priorità e Timeline](#10-piano-di-esecuzione--priorità-e-timeline)
11. [Metriche di Qualità Target](#11-metriche-di-qualità-target)

---

## 1. Stato di partenza — Analisi dei gap

### 1.1 Cosa i test attuali coprono bene

I ~1070 test passanti coprono:
- Logica interna dei contratti (unit test con mock)
- Deploy e configurazione del sistema
- Flussi base: deposit → supply → withdraw in condizioni normali
- Access control (onlyOwner, onlyModule)
- Circuit breaker / pause
- Share accounting e fee calculation

### 1.2 Gap critici identificati

#### Gap 1 — Cicli di vita completi del lending

I test E2E attuali coprono solo `deposit → supply → withdraw`. **Non testano mai** il ciclo completo di un'operazione di lending:

```
supply collateral → borrow → accumulo interesse → repay → withdraw
```

Questo è il flusso economico principale del protocollo. Senza testarlo su fork reale, non si può avere certezza che `borrow()`, `repay()`, `getHealthFactor()` e `closePosition()` funzionino correttamente con i contratti Aave/Euler/Morpho reali.

#### Gap 2 — Zero test su interessi maturati

Nessun test verifica che:
- L'interesse su un prestito Aave cresca nel tempo
- I `variableDebtToken` aumentino il loro balance dopo `evm_increaseTime`
- Il `healthFactor` scenda quando il debito cresce
- Il LensAdapter riporti valori aggiornati dopo l'accumulo

Questo è fondamentale: un bug qui significherebbe che il protocollo non gestisce correttamente le posizioni leverage nel tempo.

#### Gap 3 — Zero test di liquidazione

Nessun test simula mai uno scenario dove l'health factor scende sotto 1.0. Non sappiamo se:
- `getPositionsAtRisk()` li detecta correttamente
- Il sistema può essere messo in uno stato non liquidabile
- I calcolatori di valore si comportano correttamente con posizioni under-water

#### Gap 4 — Flash loan non testati su fork

`FlashLoanPlugin` e `FlashLoanService` sono completamente non validati su fork. Sono contratti critici per la sicurezza: un bug nei flash loan può svuotare l'intero protocollo.

#### Gap 5 — Swap reali UniswapV3 non testati

Il `SwapManager` con `UniswapV3Plugin` non è mai eseguito su pool reali. Non sappiamo se:
- Lo slippage calcolato sia accurato
- Il routing a più hop funzioni
- I deadline vengano rispettati su pool ad alta volatilità

#### Gap 6 — Invarianti matematiche non verificate

Non esiste nessun test che verifichi la **conservazione del valore**:
- `totalDeposited ≈ totalWithdrawable + fees`
- Il prezzo LP non decresce mai in assenza di perdite
- La somma delle shares di tutti gli utenti == totalSupply del ProxyGeneral

#### Gap 7 — Attack vectors non testati

Nessun test simula attacchi realistici:
- Reentrancy su deposit/withdraw con token malevoli
- Manipolazione oracle (price oracle attack)
- Flash loan attack sul protocollo stesso
- Grief attack: depositi minimi ripetuti per saturare limiti

#### Gap 8 — ProxyGeneral rate limiting non validato su carico reale

Il sistema di rate limiting (orario + giornaliero) è testato con mock ma non mai con:
- 50+ utenti concorrenti su fork
- Token con decimali non standard (es. 2, 8, 18)
- Wrap/unwrap WETH in sequenza

**NOTA TECNICA IMPORTANTE**: Il rate limiting in ProxyGeneral è **per-user per-operationType** (`userRateLimits[user][operationType]`), non globale. I test di stress devono riflettere questo: 50 utenti diversi hanno ognuno limiti indipendenti. Un test corretto verifica che lo stesso utente sia bloccato dopo il limite orario, ma che altri utenti possano ancora operare.

#### Gap 9 — MorphoVaultPlugin (MetaMorpho ERC-4626) completamente non testato [NUOVO]

Il `MorphoVaultPlugin` implementa l'interazione con i vault MetaMorpho (ERC-4626). Il ciclo di vita di questo plugin (deposit vault → accumulo yield → redeem) è **completamente assente** dalla suite. Diversamente da `MorphoPlugin` (che opera su market diretti con borrow/repay), `MorphoVaultPlugin` opera solo in supply (no borrow, no rischio liquidazione) — questo è un flusso diverso da testare separatamente.

#### Gap 10 — DepositHelper (ETH → WETH wrap automatico) privo di test E2E [NUOVO]

`DepositHelper` ha zero test di integrazione E2E su fork. La sua unica funzione pubblica è `depositETH()` — accetta ETH nativo, lo wrappa in WETH e lo deposita nel pool. **Non c'è** `depositWithPermit` (il contratto non implementa EIP-2612). I test devono verificare il flusso ETH-wrap-deposit su fork reale con contratti WETH Arbitrum.

---

## 1.3 Firme canoniche dei contratti (Reference tecnica per i test) [NUOVO]

Questa sezione documenta le firme esatte verificate dopo analisi del codice sorgente. **Usare queste firme in tutti i test.**

### LiquidityManager
```solidity
// ⚠️ NOTA: deposit() NON ha un parametro deadline
function deposit(uint256 amount) external returns (uint256 lpTokens)
function withdraw(uint256 _shares) external returns (uint256 amount)  // deadline auto 20min
function withdrawWithDeadline(uint256 _shares, uint256 deadline) external returns (uint256 amount)
```

### ProxyGeneral
```solidity
function mint(address to, uint256 amount) external // onlyAuthorizedModule
function burn(address from, uint256 amount) external // onlyAuthorizedModule
function transferFunds(address to, address asset, uint256 amount) external // address(0) per ETH
function getAssetBalance(address asset) external view returns (uint256)
function withdrawToken(string tokenCode, uint256 amount, address to) external
function checkRateLimit(address user, string operationType, uint256 amount) external view returns (bool ok, uint256 hourlyRemaining, uint256 dailyRemaining)
function trackOperation(address user, string operationType, uint256 amount) external
function pause() external // onlyOwner o EmergencyHandler
function unpause() external // onlyOwner o EmergencyHandler
```

### AaveV3Plugin
```solidity
constructor(address _beacon, string memory _baseAssetCode, address _aavePool)
function deposit(string memory tokenCode, uint256 amount) external returns (bool)  // supply collateral
function withdraw(string memory tokenCode, uint256 amount) external returns (bool)
function borrow(string memory tokenCode, uint256 amount) external returns (bool)
function repay(string memory tokenCode, uint256 amount) external returns (bool)
function openLeverageAtomic(OpenLeverageAtomicParams calldata params) external
function closeLeverageAtomic(CloseLeverageAtomicParams calldata params) external
// VARIABLE_RATE_MODE = 2
// MIN_HEALTH_FACTOR = 1.05e18
```

### EulerV2Plugin
```solidity
constructor(address _beacon, string memory _baseAssetCode, address _evcAddress, address _accountLensAddress)
function deposit(string memory tokenCode, uint256 amount) external returns (bool)
function withdraw(string memory tokenCode, uint256 amount) external returns (bool)
function borrow(string memory tokenCode, uint256 amount) external returns (bool)
function repay(string memory tokenCode, uint256 amount) external returns (bool)
function openLeverageAtomic(/* OpenLeverageAtomicParams */) external
function closeLeverageAtomic(/* CloseLeverageAtomicParams */) external
// Sub-account allocation: gestita da EulerRegistry.createPositionOnDemand() (Opzione C)
// evc = IEVC public immutable (0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066)
```

### MorphoPlugin
```solidity
constructor(address _beacon, string memory _baseAssetCode, address _morphoAddress)
function deposit(string memory tokenCode, uint256 amount) external returns (bool)  // = supplyCollateral
function withdraw(string memory tokenCode, uint256 amount) external returns (bool) // = withdrawCollateral
function borrow(string memory tokenCode, uint256 amount) external returns (bool)
function repay(string memory tokenCode, uint256 amount) external returns (bool)
// morpho = IMorpho public immutable (0x6c247b1F6182318877311737BaC0844bAa518F5e)
// ORACLE_PRICE_SCALE = 1e36, WAD = 1e18, MIN_HEALTH_FACTOR = 1.05e18
// Health factor NON è nativo → calcolato manualmente dalla LensAdapter
```

### MorphoVaultPlugin
```solidity
constructor(address _beacon)  // ⚠️ solo beacon, nessun altro arg
function deposit(string memory tokenCode, uint256 amount) external returns (bool)  // routes to default vault
function withdraw(string memory tokenCode, uint256 amount) external returns (bool) // routes to default vault
function vaultDeposit(address vault, uint256 assets) external returns (uint256 shares)
function vaultWithdraw(address vault, uint256 assets) external returns (uint256 sharesBurned)
function vaultRedeem(address vault, uint256 shares) external returns (uint256 assets)
// Vault ERC-4626 address ottenuta da MorphoRegistry.getDefaultVault(tokenCode)
```

### AaveV3LensAdapter
```solidity
constructor(address _beacon, string memory _baseAssetCode, address _aavePool)
function getTotalValue() external view returns (uint256 netValue)
function getHealthFactor() external view returns (uint256)  // nativo da getUserAccountData()
function getPositionsAtRisk(uint256 threshold) external view returns (...)
function getValueBreakdown() external view returns (...)
function protocolName() external pure returns (string memory)  // "AaveV3"
```

### EulerLensAdapter
```solidity
constructor(address _beacon, string memory _baseAssetCode, address _accountLens, address _vaultLens, address _utilsLens, address _evcAddress)
// ⚠️ 6 argomenti al costruttore — NON 2 o 3
```

### MorphoLensAdapter
```solidity
constructor(address _beacon, string memory _baseAssetCode, address _morphoAddress)
// Health factor: calcolato manualmente (HF = collateral * oraclePrice * lltv / debt / ORACLE_PRICE_SCALE)
// NON è nativo come in Aave
```

### FlashLoanService
```solidity
constructor(address _beacon)  // solo beacon
function executeFlashLoan(address[] calldata tokens, uint256[] calldata amounts, bytes calldata callbackData) external
function swap(address tokenIn, address tokenOut, uint256 amountIn) external returns (uint256)
function getExpectedOutput(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256)
// BALANCER_VAULT = 0xBA12222222228d8Ba445958a75a0704d566BF2C8 (0% fee)
// SIMPLE_SWAP = 0xa0DB78167CBAccD47524a261b7741C6B41Bbd096
```

### Beacon
```solidity
// ⚠️ NESSUN timelock sugli upgrade — effetto immediato
function updateImplementation(string memory module, address newImplementation) external onlyOwner
function getImplementation(string memory module) external view returns (address)
function freezeModule(string memory module) external onlyOwner    // emergenza
function unfreezeModule(string memory module) external onlyOwner
function setGlobalFreeze(bool freeze) external onlyOwner
// 2-step ownership: initiateOwnershipTransfer → acceptOwnership
```

### ParameterManager
```solidity
constructor(address _beacon, uint8 _baseDecimals)
function proposeParameterChange(string memory name, uint256 newValue) external onlyAuthorizedUpdater
function executeParameterChange(string memory name) external // dopo timelock
function getCurrentParameterValue(string memory name) external view returns (uint256)
// Parametri con timelock: maxDeposit, maxWithdrawPerTx, maxSlippage, poolReserveRatio, withdrawLimitPerHour
// Parametri senza timelock: minDeposit, minWithdraw, cacheDuration, maxPriceAge, maxTokensPerOperation, maxErrors
// parameterTimelock default: 24 ore (MIN_TIMELOCK=1h, MAX_TIMELOCK=7d)
```

### EmergencyHandler
```solidity
constructor(address _beacon)
function emergencyPause(string memory reason) external onlyEmergencyAuthorized
function emergencyUnpause() external onlyOwner  // con timelock
function emergencyWithdrawAll() external onlyEmergencyAuthorized
function generateReport() external returns (EmergencyReport memory)
function addEmergencyContact(address contact, string memory role) external onlyOwner
// EMERGENCY_COOLDOWN = 1 day, unpauseTimelock default = 6 ore (MIN=1h, MAX=7d)
```

### DepositHelper
```solidity
constructor(address _beacon)  // legge BASE_ASSET da beacon
// ⚠️ UNICA funzione pubblica rilevante:
function depositETH() external payable returns (uint256 lpTokens)
// NON implementa depositWithPermit — il contratto è solo ETH wrap + deposit
```

---

#### Gap 9 — Nessun test di upgrade (Beacon pattern)

Non esiste nessun test che verifichi che un upgrade del Beacon:
- Non rompa le posizioni esistenti
- Migrare correttamente lo stato
- Non permetta upgrade non autorizzati

#### Gap 10 — Coverage numerica del DepositHelper

`DepositHelper.sol` è quasi completamente privo di test dedicati.

---

## 2. Fix immediati — Bug bloccanti

Questi fix devono essere fatti **prima** di qualsiasi espansione. Sbloccano test che già esistono.

### Fix #1 — `EulerV2Plugin.fork.test.ts` [CORRETTO]

**File**: `test/integration/EulerV2Plugin.fork.test.ts`  
**Errore**: `incorrect number of arguments to constructor`  
**Causa tecnica confermata**: Il costruttore `EulerV2Plugin` è ora `(address _beacon, string memory _baseAssetCode, address _evcAddress, address _accountLensAddress)` — 4 argomenti, non 2.  
**Azione**: Aggiornare ogni `EulerV2Plugin.deploy()` nel file.

```typescript
// Costruttore REALE (da contracts/plugins/EulerV2Plugin.sol):
// constructor(address _beacon, string memory _baseAssetCode, address _evcAddress, address _accountLensAddress)
plugin = await EulerV2PluginFactory.deploy(
    await mockBeacon.getAddress(),
    "WETH",
    "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066",  // EVC (IEVC)
    "0x90a52DDcb232e7bb003DD9258fA1235c553eC956"   // AccountLens
);
```

**Sblocca**: ~30 test Euler su fork reale.

---

### Fix #2 — `MorphoPlugin.fork.test.ts`

**File**: `test/integration/MorphoPlugin.fork.test.ts`  
**Errore**: `TypeError: plugin.MORPHO_ADDRESS is not a function`  
**Azione**: Ricerca globale di `MORPHO_ADDRESS()` nel file → sostituire con `morpho()`.

```typescript
// Prima
expect(await plugin.MORPHO_ADDRESS()).to.equal(MORPHO);
// Dopo
expect(await plugin.morpho()).to.equal(MORPHO);
```

**Sblocca**: 20 test Morpho su fork reale.

---

### Fix #3 — `AaveV3Plugin.fork.test.ts`

**File**: `test/integration/AaveV3Plugin.fork.test.ts`  
**Errore**: `could not decode result data (getReserveAToken)` senza fork  
**Azione**: Il `before()` non ha un guard corretto. Correggere il check:

```typescript
before(async function () {
    if (process.env.FORK_ENABLED !== "true") {
        this.skip();
        return;
    }
    // ... resto del setup
});
```

**Sblocca**: ~40 test Aave su fork reale.

---

### Fix #4 — `Withdraw.AutomaticSwap.fork.test.ts`

**File**: `test/e2e/Withdraw.AutomaticSwap.fork.test.ts`  
**Errore**: `incorrect number of arguments to constructor`  
**Azione**: Individuare ogni deploy di `AaveV3Plugin` / `AaveV3LensAdapter` nel file e aggiungere `AAVE_V3_POOL` come terzo argomento. Aggiungere la costante:

```typescript
const AAVE_V3_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
```

**Sblocca**: 10 test di automatic swap su withdraw.

---

### Fix #5 — `EulerV2Plugin.closePositionsForWeth.test.ts`

**File**: `test/integration/EulerV2Plugin.closePositionsForWeth.test.ts`  
**Errore**: `Transaction reverted without a reason string` perché esegue senza fork  
**Azione**: Aggiungere fork check all'inizio del `before()` (stesso pattern fix #3).

---

### Fix #6 — `SimpleComplianceTests.test.ts`

**File**: `test/SimpleComplianceTests.test.ts`  
**Errore**: `HH700: Artifact for contract "EnhancedLiquidityPoolETH" not found`  
**Azione**: Rimuovere i 4 test che referenziano `EnhancedLiquidityPoolETH` o rimpiazzarli con riferimento al contratto corretto (`LiquidityManager`).

---

### Fix #7 — `PerformanceBenchmarks.test.ts`

**File**: `test/performance/PerformanceBenchmarks.test.ts`  
**Errore**: `Token not supported by oracle`  
**Azione**: Nel `before()`, aggiungere la configurazione dei prezzi mock per WETH, USDC, WBTC, USDT prima di eseguire i benchmark:

```typescript
await mockOracle.setPrice("WETH", ethers.parseUnits("3000", 8));
await mockOracle.setPrice("USDC", ethers.parseUnits("1", 8));
await mockOracle.setPrice("WBTC", ethers.parseUnits("60000", 8));
await mockOracle.setPrice("USDT", ethers.parseUnits("1", 8));
```

---

## 3. Categoria A — Test di Protocollo Avanzati (fork Arbitrum)

Questi sono i nuovi file da creare. Coprono i flussi che i test attuali non testano mai.

---

### A.1 — `test/e2e/Aave.BorrowRepay.e2e.test.ts`

**Obiettivo**: Testare il ciclo completo di borrow/repay su Aave V3 con token reali.

```
SETUP:
  - Deploy full protocol stack (WETH base asset)
  - Whale impersonation per WETH e USDC

SCENARIO 1 — Basic Borrow/Repay
  1. User deposita 1 WETH nel sistema
  2. AaveV3Plugin.deposit("WETH", 1 ether) → supply collateral su Aave
  3. Verifica: aWETH balance nel ProxyGeneral > 0
  4. AaveV3Plugin.borrow("USDC", 500e6) → borrow 500 USDC
  5. Verifica: variableDebtUSDC > 0
  6. Verifica: healthFactor via AaveV3LensAdapter > 1.5e18
  7. AaveV3Plugin.repay("USDC", 500e6) → repay full
  8. Verifica: variableDebtUSDC ≈ 0 (può avere dust da interesse)
  9. AaveV3Plugin.withdraw("WETH", type(uint256).max) → withdraw tutto
  10. Verifica: user riceve WETH indietro (meno piccolo interesse)

SCENARIO 2 — Interest Accrual
  1. Apri posizione: supply WETH, borrow USDC
  2. evm_increaseTime(30 days)
  3. Verifica: variableDebtUSDC è cresciuto rispetto al borrow iniziale
  4. Verifica: healthFactor è sceso (perché il debito è cresciuto)
  5. AaveV3LensAdapter.getHealthFactor() == Aave.getUserAccountData().healthFactor
  6. Repay il debito aumentato (deve includere interesse)
  7. Verifica: posizione completamente chiusa

SCENARIO 3 — Near-Liquidation
  1. Supply 1 WETH collateral (~$3000)
  2. Borrow fino al 75% del LTV (≈$2000 USDC)
  3. Verifica healthFactor ≈ 1.1 (safe ma vicino al limite)
  4. AaveV3LensAdapter.getPositionsAtRisk(1.2e18) → deve trovare questa posizione
  5. evm_increaseTime(180 days) → interesse accumula
  6. Verifica che healthFactor scende ulteriormente

SCENARIO 4 — Partial Repay
  1. Borrow 1000 USDC
  2. Repay 500 USDC
  3. Verifica: debt rimanente ≈ 500 USDC + interesse
  4. Verifica healthFactor migliorato dopo repay parziale
```

---

### A.2 — `test/e2e/Euler.BorrowRepay.e2e.test.ts`

**Obiettivo**: Testare il ciclo borrow/repay su Euler V2 con EVC e sub-accounts.

```
SCENARIO 1 — Supply e Borrow Base
  1. Deploy stack con ProtocolManager + EulerPlugin + EulerLensAdapter
  2. Supply 1 WETH su eWETH-1 vault → verifica shares ricevute
  3. Enable collateral per il vault WETH
  4. Borrow 1000 USDC da eUSDC-1 vault
  5. Verifica: EulerLensAdapter.getHealthFactor() > 1.0
  6. Repay 1000 USDC
  7. Disable collateral
  8. Redeem shares WETH → verifica WETH ricevuto

SCENARIO 2 — EVC Batch Operation
  1. In una singola transazione EVC:
     - Supply WETH come collateral
     - Borrow USDC
  2. Verifica che la transazione sia atomica
  3. Verifica stato posizione dopo il batch

SCENARIO 3 — Close All Positions
  1. Apri posizione: supply WETH, borrow USDC
  2. Chiama EulerV2Plugin.closePositionsForBaseAsset("WETH")
  3. Verifica: debito USDC ripagato
  4. Verifica: collateral WETH sbloccato e restituito

SCENARIO 4 — Multi-Vault
  1. Supply WETH su eWETH-1
  2. Supply USDC su eUSDC-1
  3. Borrow WBTC da eWBTC-1 (usando entrambi come collateral)
  4. Verifica health factor aggregato via EulerLensAdapter
  5. Repay tutto e chiudi posizione
```

---

### A.3 — `test/e2e/Morpho.FullCycle.e2e.test.ts`

**Obiettivo**: Testare borrow/repay/liquidation completi su Morpho Blue.

```
SCENARIO 1 — Supply Collateral + Borrow
  1. Supply WETH come collateral nel mercato WETH/USDC
  2. Borrow USDC (max 86% LTV)
  3. Verifica: MorphoLensAdapter.getHealthFactor() >= 1.0
  4. Verifica: posizione visibile tramite getValueBreakdown()
  5. Repay USDC
  6. Withdraw WETH collateral
  7. Verifica: posizione chiusa

SCENARIO 2 — Liquidation Simulation
  1. Apri posizione al 80% del LLTV (vicino al limite di liquidazione)
  2. Verifica: posizione non è a rischio inizialmente
  3. Manipola oracle price: abbassa il prezzo di WETH del 20%
     → usa hardhat_setStorageAt per modificare il valore nel MockOracle
  4. Verifica: healthFactor < 1.0
  5. Verifica: MorphoLensAdapter.getPositionsAtRisk() trova la posizione
  6. Simula liquidatore che chiama liquidate() su Morpho Blue direttamente
  7. Verifica: la posizione viene liquidata correttamente
  8. Verifica: bad debt handling (se applicabile)

SCENARIO 3 — Multi-Collateral
  1. Crea 3 posizioni diverse con collateral diversi (WETH, WBTC, ARB)
  2. Verifica che MorphoLensAdapter.getValueBreakdown() aggrega tutto
  3. Chiudi una posizione alla volta
  4. Verifica che le altre rimangono intatte
```

---

### A.4 — `test/e2e/UniswapV3.SwapExecution.e2e.test.ts`

**Obiettivo**: Testare swap reali su Uniswap V3 Arbitrum con pool liquide reali.

```
SCENARIO 1 — Basic Swap USDC → WETH
  1. Deploy SwapManager + UniswapV3Plugin
  2. Configura pool USDC/WETH 0.05% fee tier
  3. ProxyGeneral ha 1000 USDC
  4. SwapManager.executeSwap("USDC", "WETH", 1000e6, minOut, deadline)
  5. Verifica: WETH ricevuto ≈ atteso da quoter (≤ 1% slippage)
  6. Verifica: nessun USDC residuo nel ProxyGeneral

SCENARIO 2 — Multi-Hop Swap WBTC → USDC → WETH
  1. ProxyGeneral ha 0.01 WBTC
  2. SwapManager esegue multi-hop via USDC bridge
  3. Verifica: WETH ricevuto corretto
  4. Verifica: no token intermedio residuo

SCENARIO 3 — Slippage Protection
  1. Configura max slippage 0.5%
  2. Simula high impact swap (grande volume su pool poco liquida)
  3. Verifica: SwapManager reverta con SlippageExceeded
  4. Riduce l'importo dello swap
  5. Verifica: ora passa con slippage entro i limiti

SCENARIO 4 — Deadline Enforcement
  1. Imposta deadline = now - 1 (già scaduto)
  2. Verifica: swap reverta con DeadlineExpired
  3. Imposta deadline = now + 20 minutes
  4. Verifica: swap passa

SCENARIO 5 — Withdraw con Automatic Swap (integration)
  1. Pool ha 5000 USDC, 2 WETH, 0.1 WBTC
  2. User ha LP tokens per 3000 USDC equivalente
  3. User vuole withdraware 3000 USDC ma il balance diretto è solo 1000
  4. SwapManager converte automaticamente WETH/WBTC → USDC
  5. User riceve i suoi 3000 USDC
  6. Verifica: pool balance ridotto proporzionalmente
```

---

### A.5 — `test/e2e/FlashLoan.LeverageAave.e2e.test.ts`

**Obiettivo**: Testare flash loan per apertura posizione leverage su Aave tramite Balancer.

```
SCENARIO 1 — 2x Leverage su WETH
  1. User ha 1 WETH
  2. Flash loan di 1 WETH da Balancer
  3. Supply 2 WETH su Aave (collateral)
  4. Borrow ~1.5 WETH equivalente in USDC
  5. Swap USDC → 1 WETH
  6. Ripaga flash loan da questo WETH
  7. Posizione finale: 2 WETH collateral, 1 WETH debito → 2x leverage
  8. Verifica: healthFactor > 1.3 (safe)
  9. Verifica: leverage effettivo ≈ 2x

SCENARIO 2 — Chiusura Flash Loan Position
  1. Posizione leveraged aperta (da scenario 1)
  2. Flash loan dell'intero debito USDC
  3. Repay Aave con i USDC
  4. Withdraw tutto il collateral WETH
  5. Ripaga flash loan
  6. Verifica: posizione completamente chiusa
  7. Verifica: user riceve il suo WETH netto meno interessi

SCENARIO 3 — Flash Loan Fee Calculation
  1. Verifica che Balancer premium (0.01%) venga correttamente incluso
  2. Verifica che il flash loan non fallisca per fee non coperta
  3. Verifica che l'importo minimo di collateral sia sufficiente
```

---

### A.6 — `test/e2e/Dolomite.FullCycle.e2e.test.ts`

**Obiettivo**: Primo test su fork reale di Dolomite — ad oggi mai eseguito.

```
SCENARIO 1 — Deposit e Borrow Base
  1. Impersona whale con WETH
  2. DolomitePlugin.deposit("WETH", 1 ether) su Dolomite
  3. Verifica: balance in Dolomite cresciuto
  4. DolomitePlugin.borrow("USDC", 500e6) apri posizione borrow
  5. Verifica: debito registrato
  6. DolomitePlugin.repay("USDC", 500e6) 
  7. DolomitePlugin.withdraw("WETH", balance)
  8. Verifica: ciclo completo chiuso

SCENARIO 2 — openBorrowPosition via ProtocolManager
  1. ProtocolManager.deposit("DolomitePlugin", "WETH", amount)
  2. Configura whitelist selectors per Dolomite-specific calls
  3. ProtocolManager.executeProtocolCall("DolomitePlugin", data)
  4. Verifica: funzione Dolomite-specifica eseguita con successo
```

---

### A.7 — `test/e2e/MorphoVault.FullCycle.e2e.test.ts` [NUOVO]

**Obiettivo**: Testare `MorphoVaultPlugin` (MetaMorpho ERC-4626) — completamente assente dalla suite attuale.

**Architettura**: `MorphoVaultPlugin` non fa borrow/repay. Opera solo in supply (no rischio liquidazione). Il costruttore è `constructor(address _beacon)` — nessun altro argomento.

```typescript
// Setup:
// MorphoVaultPlugin.deploy(beaconAddress)  — solo 1 arg
// Vault address configurata in MorphoRegistry.getDefaultVault(tokenCode)
const morphoVaultPlugin = await MorphoVaultPluginFactory.deploy(await beacon.getAddress());
```

```
SCENARIO 1 — Deposit e Accumulo Yield
  1. Configura vault MetaMorpho USDC in MorphoRegistry (es. Gauntlet vault su Arbitrum)
  2. morphoVaultPlugin.deposit("USDC", 10_000e6) → deposita nel vault
  3. Verifica: shares ricevute > 0
  4. Verifica: vault.balanceOf(plugin) > 0 (shares)
  5. evm_increaseTime(30 days)
  6. Verifica: vault.convertToAssets(shares) > 10_000e6 (yield accumulato)
  7. morphoVaultPlugin.withdraw("USDC", 5_000e6) → withdraw parziale
  8. Verifica: assets ricevuti == 5_000e6 ± tolerance
  9. Verifica: shares rimanenti per le restanti 5_000 USDC + yield

SCENARIO 2 — Full Redeem via vaultRedeem()
  1. Supply 1 WETH nel vault
  2. Leggi shares: shares = vault.balanceOf(plugin)
  3. morphoVaultPlugin.vaultRedeem(vaultAddress, shares)
  4. Verifica: WETH ricevuto == shares * pricePerShare ± tolerance
  5. Verifica: shares del plugin == 0 dopo redeem
  6. Verifica: assets trasferiti a ProxyGeneral

SCENARIO 3 — Via ProtocolManager IProtocolAdapter
  1. ProtocolManager ha MorphoVaultPlugin registrato come "MorphoVault"
  2. ProtocolManager.deposit("MorphoVault", "USDC", 1000e6)
     → routes a MorphoVaultPlugin.deposit("USDC", 1000e6)
     → che internamente chiama MorphoRegistry.getDefaultVault("USDC")
     → che deposita nel vault ERC-4626
  3. Verifica: vault.balanceOf(plugin) > 0
  4. ProtocolManager.withdraw("MorphoVault", "USDC", 500e6)
  5. Verifica: USDC arriva in ProxyGeneral

SCENARIO 4 — Vault non approvato (VaultNotApproved error)
  1. Tenta deposit in vault non nella lista approvata di MorphoRegistry
  2. Verifica: reverta con VaultNotApproved(vaultAddress)

SCENARIO 5 — Deposit supera maxDeposit ERC-4626
  1. Deposita importo che supera vault.maxDeposit(receiver)
  2. Verifica: reverta con DepositExceedsMax

SCENARIO 6 — MorphoVaultLensAdapter integration
  1. Supply 10,000 USDC nel vault
  2. MorphoVaultLensAdapter.getTotalValue() → deve includere il valore degli shares
  3. Verifica: il valore in base asset è corretto
  4. evm_increaseTime(30 days)
  5. Verifica: getTotalValue() aumenta dopo accumulo yield
  6. Verifica: ValueCalculator include MorphoVault nella sua computazione aggregata
```

---

## 4. Categoria B — Invarianti di Sistema

Gli invarianti sono proprietà matematiche che devono essere sempre vere indipendentemente dall'ordine delle operazioni. Se un invariante si rompe, c'è un bug fondamentale nel sistema.

---

### B.1 — `test/invariants/ValueConservation.invariant.test.ts`

**Regola**: La somma di tutto ciò che gli utenti possono withdraware ≈ tutto ciò che è stato depositato (meno fee) + rendimenti maturati.

```typescript
// Dopo N operazioni casuali di deposit/withdraw da utenti diversi:
const totalShares = await proxyGeneral.totalSupply();
const lpPrice = await valueCalculator.getLPPrice();
const totalWithdrawable = totalShares * lpPrice / 1e18;

const totalDeposited = sum(depositAmounts);
const totalFees = sum(feeAmounts);
const totalWithdrawn = sum(withdrawAmounts);

// INVARIANTE: totalWithdrawable >= totalDeposited - totalWithdrawn - totalFees
// Se totalWithdrawable < atteso → fuga di fondi (BUG CRITICO)
assert(totalWithdrawable >= totalDeposited - totalWithdrawn - totalFees - DUST_TOLERANCE);
```

**Cosa verifica**: Che non ci siano fugg di fondi nel sistema, che le fee siano calcolate correttamente, che lo share accounting sia preciso.

---

### B.2 — `test/invariants/LPPrice.invariant.test.ts`

**Regola**: Il prezzo per LP token non diminuisce mai in assenza di perdite del protocollo.

```typescript
// Sequenza di deposit/withdraw/fee di vario tipo:
const priceAtStart = await valueCalculator.getLPPrice();

// ... N operazioni ...

const priceAtEnd = await valueCalculator.getLPPrice();

// INVARIANTE: priceAtEnd >= priceAtStart (accounting per rendimenti)
// Se scende → errore nel fee calculation o share dilution
assert(priceAtEnd >= priceAtStart - PRICE_TOLERANCE);
```

**Scenari da testare**:
- Deposit da nuovo utente → prezzo deve rimanere uguale
- Withdrawal parziale → prezzo deve rimanere uguale
- Accumulo fee → prezzo deve crescere (le fee restano nel pool)
- Rendimento Aave → prezzo deve crescere

---

### B.3 — `test/invariants/ShareAccounting.invariant.test.ts`

**Regola**: La somma delle shares di tutti gli utenti == totalSupply del ProxyGeneral.

```typescript
const users = [user1, user2, user3, user4, user5];
const userShares = await Promise.all(users.map(u => proxyGeneral.balanceOf(u.address)));
const sumShares = userShares.reduce((a, b) => a + b, 0n);
const totalSupply = await proxyGeneral.totalSupply();

// INVARIANTE: sumShares === totalSupply
// Se diverso → minting/burning inconsistente (BUG CRITICO)
assert(sumShares === totalSupply);
```

---

### B.4 — `test/invariants/HealthFactor.accuracy.test.ts`

**Regola**: L'health factor restituito dal LensAdapter deve essere consistente con quello nativo del protocollo.

```typescript
// Su fork Arbitrum, con posizione Aave reale:
const lensHF = await aaveLensAdapter.getHealthFactor();

// Leggi direttamente da Aave Pool
const aaveData = await aavePool.getUserAccountData(proxyGeneral.address);
const nativeHF = aaveData.healthFactor;

// INVARIANTE: differenza < 0.001e18 (tolleranza per rounding)
const diff = abs(lensHF - nativeHF);
assert(diff < ethers.parseEther("0.001"));
```

**Perché importante**: Se il LensAdapter riporta un health factor più alto di quello reale, il sistema potrebbe sottostimare il rischio di liquidazione.

---

### B.5 — `test/invariants/NoFundLeakage.invariant.test.ts`

**Regola**: I fondi nel ProxyGeneral + i fondi nei protocolli esterni == totale dei depositi degli utenti (meno fee).

```typescript
// Verifica che nessun fondo sia "bloccato" o "perso"
const proxyBalance = await usdc.balanceOf(proxyGeneral.address);
const aaveBalance = await aaveLensAdapter.getTotalValue(); // in base asset
const eulerBalance = await eulerLensAdapter.getTotalValue();
const morphoBalance = await morphoLensAdapter.getTotalValue();

const totalAccountedFor = proxyBalance + aaveBalance + eulerBalance + morphoBalance;
const totalUserDeposits = sum(allDeposits) - sum(allFees) - sum(allWithdrawals);

// INVARIANTE
assert(abs(totalAccountedFor - totalUserDeposits) < DUST);
```

---

## 5. Categoria C — Scenari di Attacco e Sicurezza

Test che simulano esplicitamente vettori di attacco per verificare che il sistema sia robusto.

---

### C.1 — `test/security/Reentrancy.attack.test.ts`

**Obiettivo**: Verificare che tutti i punti di ingresso critici siano protetti da reentrancy.

```
ATTACCO 1 — ReentrantDeposit
  1. Deploy di un contratto malevolo "ReentrantDepositor"
  2. ReentrantDepositor.attack(): chiama deposit, nella callback tenta di chiamare
     deposit di nuovo prima che il primo si concluda
  3. VERIFICA: il secondo deposit reverta con ReentrancyGuard error
  4. VERIFICA: balance stato non è corrotto

ATTACCO 2 — ReentrantWithdraw
  1. Deploy "ReentrantWithdrawer" che tenta di withdraware due volte
  2. Prima call: withdraw standard
  3. Nella receive() del token: tenta di chiamare withdraw di nuovo
  4. VERIFICA: seconda chiamata reverta
  5. VERIFICA: user non riceve fondi doppi

ATTACCO 3 — Cross-Function Reentrancy
  1. Deploy attaccante che chiama deposit dalla callback di un withdraw
  2. Verifica: stato finale è coerente (shares corrette)
  3. Verifica: nessun arricchimento illegittimo dell'attaccante
```

---

### C.2 — `test/security/OracleManipulation.attack.test.ts`

**Obiettivo**: Verificare che il sistema resista a manipolazioni dell'oracolo.

```
ATTACCO 1 — Stale Price Attack
  1. Avanzare il tempo oltre il heartbeat del Chainlink feed (es. 2 ore)
  2. Tentare un deposit/withdraw
  3. VERIFICA: ChainlinkAdapter.getPrice() reverta con StalePriceError
  4. VERIFICA: nessuna transazione possa passare con prezzo stale

ATTACCO 2 — Price Spike Attack
  1. Imposta un prezzo artificialmente alto (+1000%) tramite MockOracle
  2. Utente malevolo deposita token
  3. Utente ottiene LP token inflati
  4. Reimposta il prezzo al valore reale
  5. VERIFICA: l'utente non può withdraware più di quanto depositato in valore
  6. VERIFICA: il sistema ha protezioni contro variazioni di prezzo anomale

ATTACCO 3 — Oracle Freshness con Fork Reale
  1. Su fork Arbitrum, verificare che il feed Chainlink sia abbastanza fresco
  2. Se il feed è stale al blocco di fork → heartbeat deve essere configurato ampiamente
  3. VERIFICA: il sistema usa il heartbeat configurato, non quello del feed originale
```

---

### C.3 — `test/security/AccessControl.comprehensive.test.ts`

**Obiettivo**: Testare sistematicamente tutte le funzioni protette con account non autorizzati.

```typescript
// Per ogni funzione con onlyOwner:
const protectedFunctions = [
    { contract: liquidityManager, fn: "setFeeRecipient", args: [attacker.address] },
    { contract: liquidityManager, fn: "setDepositFee", args: [1000] },
    { contract: parameterManager, fn: "proposeParameterChange", args: ["minDeposit", 0] },
    { contract: proxyGeneral, fn: "authorizeModule", args: [attacker.address, "Attack"] },
    { contract: beacon, fn: "updateImplementation", args: ["LiquidityManager", attacker.address] },
    { contract: emergencyHandler, fn: "emergencyPause", args: ["attack"] },
    // ... tutti i contratti
];

for (const { contract, fn, args } of protectedFunctions) {
    await expect(
        contract.connect(attacker)[fn](...args)
    ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
}
```

**Perché importante**: Un singolo `onlyOwner` dimenticato può esporre funzioni critiche.

---

### C.4 — `test/security/FlashLoan.selfAttack.test.ts`

**Obiettivo**: Verificare che non sia possibile usare un flash loan per attaccare il protocollo stesso.

**⚠️ Architettura reale FlashLoanService**: Solo plugin registrati nel Beacon (`_isRegisteredPlugin(msg.sender)`) possono chiamare `executeFlashLoan()`. Il flusso è:
1. Plugin → `FlashLoanService.executeFlashLoan(tokens, amounts, callbackData)`
2. FlashLoanService → Balancer → `receiveFlashLoan()`  
3. FlashLoanService → `plugin.onFlashLoanReceived(callbackData)`
4. Plugin ritorna token al FlashLoanService
5. FlashLoanService ripaga Balancer

Un attaccante esterno non può invocare `executeFlashLoan` direttamente.

```
ATTACCO 1 — Non-Plugin Flash Loan (deve fallire)
  1. Deploy di un contratto "FakePlugin" non registrato nel Beacon
  2. FakePlugin.attack(): chiama FlashLoanService.executeFlashLoan(...)
  3. VERIFICA: reverta con NotRegisteredPlugin(FakePlugin.address)

ATTACCO 2 — Flash Loan Price Manipulation
  1. Registra "AttackPlugin" nel Beacon
  2. AttackPlugin prende flash loan di 1M USDC da Balancer via FlashLoanService
  3. Deposita tutto nel protocollo → ottieni LP token a prezzo inflato
  4. Swap massiccio su UniswapV3: skew il prezzo USDC/WETH
  5. Tenta withdraw con il prezzo skewato
  6. Ripaga flash loan
  7. VERIFICA: protocollo usa TWAP o limita variazione prezzo intra-block

ATTACCO 3 — Reentrancy su Flash Loan Callback
  1. AttackPlugin tenta reentrancy durante onFlashLoanReceived()
  2. Durante la callback, tenta di chiamare executeFlashLoan() di nuovo
  3. VERIFICA: reverta con ReentrantCall() (FlashLoanService._inFlashLoan flag)

ATTACCO 4 — Unauthorized Callback
  1. Deploy contratto che chiama direttamente receiveFlashLoan() di FlashLoanService
     senza passare per executeFlashLoan
  2. VERIFICA: reverta con NotBalancerVault (solo Balancer Vault può chiamare receiveFlashLoan)

ATTACCO 5 — Swap via FlashLoanService.swap() da non-plugin
  1. Chiama direttamente FlashLoanService.swap(tokenIn, tokenOut, amount)
     da un account non registrato come plugin
  2. VERIFICA: solo plugin registrati possono fare swap standalone
  3. Se swap è pubblico, verifica che non ci siano profitti arbitrage diretti
```

---

### C.5 — `test/security/GriefingResistance.test.ts`

**Obiettivo**: Verificare che gli attacchi di grief (non monetizzabili ma distruttivi per il sistema) siano impossibili.

```
GRIEF 1 — Deposit Spam
  1. Esegui 100 deposit minimi consecutivi dallo stesso indirizzo
  2. VERIFICA: rate limiting blocca dopo X transazioni per ora
  3. VERIFICA: gas non è eccessivo per gli utenti legittimi durante l'attacco

GRIEF 2 — Share Dilution Attack
  1. Attaccante deposita prima di tutti (ottiene un'enorme percentuale del pool)
  2. Utenti legittimi depositano
  3. Attaccante withdrawa tutto
  4. VERIFICA: utenti legittimi non hanno perso fondi
  5. VERIFICA: LP price è rimasto stabile

GRIEF 3 — Dead Share Attack (nessun deposito per bloccare pool)
  1. Pool con 0 TVL
  2. Attaccante deposita 1 wei → ottiene shares
  3. Attaccante trasferisce 1 wei di base asset direttamente al ProxyGeneral (non via deposit)
  4. VERIFICA: il prezzo LP non diventa infinito o NaN
  5. VERIFICA: utenti successivi possono depositare normalmente

GRIEF 4 — Withdrawal Limit Saturation
  1. Configura limite orario a 10,000 USDC
  2. Esegui withdrawals al limite per saturarlo
  3. Verifica che utenti legittimi ricevano il corretto messaggio di errore
  4. Verifica che dopo il reset dell'ora il limite si ripristini
```

---

## 6. Categoria D — Test Multi-Protocollo e Cross-Module

---

### D.1 — `test/e2e/CrossProtocol.Rebalance.e2e.test.ts`

**Obiettivo**: Testare che il ProtocolManager possa spostare liquidità da un protocollo a un altro senza perdite.

```
SCENARIO — Rebalance Aave → Euler
  1. Deploy stack completo con ProtocolManager
  2. Registra entrambi: AaveV3Plugin e EulerV2Plugin nel ProtocolManager
  3. Deposita 10,000 USDC → va su Aave (protocollo attivo)
  4. Verifica: TVL su Aave = 10,000 USDC, TVL su Euler = 0

  5. ProtocolManager.switchActiveProtocol("AaveV3", "EulerV2")
  6. ProtocolManager.rebalance() (se esiste, altrimenti: withdraw Aave → deposit Euler)
  7. Verifica: TVL su Aave ≈ 0, TVL su Euler ≈ 10,000 USDC
  8. Verifica: LP token price non è cambiato (value preservata)
  9. Verifica: utente può ancora withdraware i suoi fondi

SCENARIO — Multi-Protocol Allocation
  1. Alloca 50% su Aave, 30% su Euler, 20% su Morpho
  2. Avanza il tempo di 30 giorni
  3. Verifica: ogni protocollo ha maturato interessi diversi
  4. ValueCalculator.getPoolValue() include tutti e tre i protocolli
  5. Verifica: il prezzo LP riflette i rendimenti aggregati
```

---

### D.2 — `test/e2e/FullSystem.MultiUser.fork.e2e.test.ts`

**Obiettivo**: Simulare 10 utenti in un pool live su fork per 30 giorni di tempo simulato.

```
SETUP:
  - Pool USDC base asset, Aave V3 protocollo
  - 10 utenti diversi con USDC importi diversi ($100 - $50,000)

SEQUENZA:
  T=0:    5 utenti depositano quantità diverse
  T=7d:   2 utenti withdrawano il 50%
  T=14d:  3 nuovi utenti depositano
  T=20d:  1 utente withdrawa tutto
  T=30d:  Tutti i rimanenti withdrawano tutto

VERIFICHE AD OGNI STEP:
  - sum(userShares) == totalSupply
  - totalWithdrawable >= totalDeposited - fees + rendimenti
  - LP price non scende mai
  - Nessun utente riceve più di quanto depositato + rendimento proporzionale
  - Fee accumulate nel feeRecipient sono corrette

VERIFICA FINALE:
  - ProxyGeneral balance ≈ 0 (tutto withdrawato)
  - totalSupply == 0
  - Nessun fondo bloccato
```

---

### D.3 — `test/e2e/EmergencyOnLivePosition.e2e.test.ts`

**Obiettivo**: Testare l'emergency withdraw quando ci sono posizioni attive su protocolli reali.

```
SCENARIO — Emergency con Posizione Aave
  1. Deploy stack, 3 utenti depositano USDC
  2. I fondi vengono deployati su Aave V3
  3. Verifica: TVL corretto

  4. EmergencyHandler.emergencyPause("Critical bug discovered")
  5. Verifica: tutti i deposit/withdraw normali revertano

  6. EmergencyHandler.emergencyWithdrawAll()
  7. Verifica: AaveV3Plugin.withdraw() chiama Aave e recupera tutti i fondi
  8. Verifica: fondi arrivano nel ProxyGeneral
  9. Verifica: ogni utente può ora fare emergency withdraw proporzionale

SCENARIO — Emergency con Posizioni Parzialmente Liquidate
  1. Apri posizione leverage: supply WETH, borrow USDC
  2. Fai scendere health factor vicino a 1.0
  3. Attiva emergency
  4. Verifica: emergency withdraw gestisce anche il debito outstanding
  5. Verifica: il sistema non blocca anche in caso di posizione problematica
```

---

### D.4 — `test/e2e/DepositHelper.integration.e2e.test.ts`

**Obiettivo**: Testare DepositHelper che ad oggi ha zero test E2E. 

**⚠️ Architettura reale**: `DepositHelper` ha **una sola funzione pubblica**: `depositETH()`. Il contratto accetta ETH nativo, lo wrappa in WETH via `IWETH.deposit{value}()`, approva `LiquidityManager` e chiama `LiquidityManager.deposit(amount)`. Non implementa `depositWithPermit` né referral — queste feature non esistono nel contratto.

```typescript
// Setup: DepositHelper ha solo beacon nel costruttore
// Legge BASE_ASSET da beacon nel costruttore (non aggiornabile dopo deploy)
const helper = await DepositHelperFactory.deploy(await beacon.getAddress());
```

```
SCENARIO 1 — Deposit ETH nativo con wrap automatico
  1. User ha ETH nativo (non WETH)
  2. Verifica pre-condizione: beacon["BASE_ASSET"] == WETH.address
  3. helper.depositETH{ value: 1 ether }()
  4. Verifica: WETH.balanceOf(proxyGeneral) aumenta di 1 ether
  5. Verifica: user riceve LP token == liquidityManager.deposit(1 ether) avrebbe dato
  6. Verifica: nessun WETH residuo nel DepositHelper dopo la transazione

SCENARIO 2 — ZeroDeposit revert
  1. helper.depositETH{ value: 0 }()
  2. Verifica: reverta con ZeroDeposit()

SCENARIO 3 — ETH grande importo
  1. User deposita 100 ETH (whale)
  2. Verifica: WETH.balanceOf(proxyGeneral) cresce di 100 ether
  3. Verifica: LP token ricevuti proporzionali al pool TVL
  4. Verifica: rate limit non viene violato (100 ETH può essere nel limite)

SCENARIO 4 — Sequenza deposit-withdraw
  1. User deposita 2 ETH via DepositHelper
  2. Ottiene LP token
  3. User chiama LiquidityManager.withdraw(shares) direttamente (non via helper)
  4. Verifica: riceve WETH
  5. User può convertire WETH in ETH manualmente se necessario

SCENARIO 5 — Fork test: BASE_ASSET è WETH reale Arbitrum
  1. Beacon["BASE_ASSET"] = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1 (WETH Arbitrum)
  2. User deposita 0.5 ETH
  3. Verifica: WETH.balanceOf() del pool aumenta
  4. Verifica: LP token mintati = atteso dal calcolo
```

**Nota**: Essendo l'unico percorso per depositare ETH nativo nel sistema, questo scenario è critical-path per utenti che vogliono depositare ETH senza wrap manuale preliminare.

---

## 7. Categoria E — Stress Test e Performance su Fork

---

### E.1 — `test/e2e/GasOptimization.benchmark.e2e.test.ts`

**Obiettivo**: Misurare e verificare che il gas per operazioni comuni rimanga sotto soglie accettabili su fork reale.

```typescript
// Soglie accettabili (gas limit)
const GAS_LIMITS = {
    deposit:          500_000,  // Un deposit completo con tutto il sistema
    withdraw:         600_000,  // Un withdraw con swap automatico
    borrow:           300_000,  // Un borrow su Aave
    repay:            250_000,  // Un repay su Aave
    emergencyPause:   100_000,  // Pausa di emergenza
    beaconLookup:      50_000,  // Singola lookup nel beacon
    lensAdapterQuery: 200_000,  // Query health factor su LensAdapter
};

// Test: ogni operazione deve essere sotto la soglia
for (const [op, limit] of Object.entries(GAS_LIMITS)) {
    const tx = await executeOperation(op);
    const receipt = await tx.wait();
    expect(receipt.gasUsed).to.be.lessThan(limit, `${op} usa troppo gas`);
}
```

**Perché importante**: Su Arbitrum il gas è economico ma non illimitato. Operazioni troppo costose in gas possono fallire durante congestione o upgrades del protocollo.

---

### E.2 — `test/e2e/HighLoad.concurrent.fork.test.ts`

**Obiettivo**: 50 transazioni concorrenti su fork per verificare assenza di race conditions.

```
SETUP:
  - Fork pinned a un blocco specifico (per riproducibilità)
  - 50 signer diversi, ognuno con 10,000 USDC

ESECUZIONE:
  - 50 deposit simultanei in un singolo "snapshot" di Hardhat
  - Hardhat processa le transazioni in sequenza (come un nodo reale)

VERIFICHE:
  - totalSupply == sum(userShares)
  - LPPrice == atteso
  - Nessuna transaction reverted inaspettatamente
  - Gas usage non cresce linearmente (no O(n) bugs)
  - Hourly/daily rate limits funzionano su utenti diversi (limiti per-user, non globali)
```

---

## 8. Categoria F — Edge Cases e Boundary Conditions

---

### F.1 — `test/unit/EdgeCases.tokenDecimals.test.ts`

**Obiettivo**: Testare token con decimali non standard.

```
Token testati:
  - 2 decimali (es. Gemini USD, GUSD)
  - 6 decimali (USDC, USDT)
  - 8 decimali (WBTC)
  - 18 decimali (WETH, DAI)
  - 27 decimali (raro ma possibile)

Verifiche per ogni combinazione:
  - Calcolo del valore non overflow
  - Conversione prezzo oracle corretta
  - LP price calcolata correttamente
  - Deposit/withdraw amounts scalati correttamente
```

---

### F.2 — `test/unit/EdgeCases.zeroValues.test.ts`

**Obiettivo**: Testare comportamento con valori zero e minimi.

```
Scenari:
  - Deposit di 1 wei → deve revertare (sotto minDeposit)
  - Withdraw di 0 shares → deve revertare
  - Pool con 0 TVL → getLPPrice() non deve dividere per zero
  - getHealthFactor() quando non c'è posizione → deve ritornare MaxUint256 o 0 (definire comportamento)
  - borrow(0) → deve revertare con errore chiaro
  - Pool con 1 utente che withdrawa tutto → totalSupply == 0, prezzo LP non definito
  - Secondo deposit in pool vuota → primo utente definisce il prezzo, test che non sia manipolabile
```

---

### F.3 — `test/unit/EdgeCases.timelock.test.ts`

**Obiettivo**: Testare il sistema timelock del ParameterManager in modo esaustivo.

```
Scenari:
  - Proposta cambiamento parametro → eseguita prima del timelock (deve fallire)
  - Proposta → timelock esatto → eseguita (deve passare)
  - Proposta → timelock + 1 sec → eseguita (deve passare)
  - Due proposte per stesso parametro → seconda sovrascrive prima?
  - Proposta annullata → esecuzione fallisce
  - Parametro fuori range → proposta reverta subito
  - Timelock durante pause del sistema → l'esecuzione deve aspettare che sia unpaused?
```

---

### F.4 — `test/unit/EdgeCases.rateLimit.test.ts`

**Obiettivo**: Testare il sistema di rate limiting del ProxyGeneral in modo sistematico.

**⚠️ Architettura reale**: `userRateLimits[user][operationType]` — limiti separati per ogni coppia (user, tipo-operazione). I limiti sono strutture `RateLimit { hourlyLimit, dailyLimit, hourlyUsed, dailyUsed, lastHourReset, lastDayReset }`.

```
Scenari:
  - Hourly limit: N operazioni "deposit" fino al limite, N+1 deve fallire con RateLimitExceeded
  - Daily limit: limite giornaliero separato dall'orario — azzerato dopo 24 ore
  - Reset automatico dopo 1 ora → l'operazione N+1 ora passa (lastHourReset aggiornato)
  - Rate limit per-user INDIPENDENTE: 
      userA satura il suo limite "deposit"
      Verifica: userB può ancora depositare (il suo limite è separato)
  - Rate limit per-tipo INDIPENDENTE:
      userA satura il limite "deposit"
      Verifica: "withdraw" di userA ha ancora budget pieno (tipi separati)
  - Global rate limits (globalRateLimits[operationType]):
      Saturare il limite globale
      Verifica: anche un utente con budget per-user pieno è bloccato
  - Admin bypass: owner può fare operazioni oltre i limiti? (se implementato)
  - checkRateLimit() view: verifica che ritorna correttamente (ok, hourlyRemaining, dailyRemaining)
```

---

### F.5 — `test/unit/EdgeCases.beaconUpgrade.test.ts` [NUOVO]

**Obiettivo**: Testare il comportamento del Beacon durante upgrades di moduli — critico perché gli upgrade sono **immediati** (nessun timelock nel Beacon).

```
⚠️ NOTA: Beacon.updateImplementation() è effetto immediato — nessun timelock.
   Questo è un rischio di sicurezza: un owner compromesso può upgradare immediatamente.
   I test devono documentare e verificare questo comportamento.

SCENARIO 1 — Upgrade base
  1. Deploy Beacon e registra LiquidityManager V1
  2. Verifica: beacon.getImplementation("LiquidityManager") == v1.address
  3. beacon.updateImplementation("LiquidityManager", v2.address)
  4. Verifica: beacon.getImplementation("LiquidityManager") == v2.address (IMMEDIATO)
  5. Verifica: history contiene v1 address (beacon.getImplementationHistory())

SCENARIO 2 — Freeze modulo
  1. Freeze del modulo "AaveV3Plugin" via beacon.freezeModule()
  2. Verifica: beacon.getImplementation("AaveV3Plugin") reverta (frozen)
  3. Verifica: plugin frozen non può essere upgradato (notFrozen modifier)
  4. Unfreeze: beacon.unfreezeModule("AaveV3Plugin")
  5. Verifica: ora accessibile e upgradabile

SCENARIO 3 — Global Freeze (emergenza totale)
  1. beacon.setGlobalFreeze(true)
  2. Verifica: TUTTE le getImplementation() revertano
  3. Verifica: il sistema è completamente inaccessibile
  4. beacon.setGlobalFreeze(false)
  5. Verifica: tutto torna accessibile

SCENARIO 4 — Upgrade a non-contract address
  1. Tenta beacon.updateImplementation("LiquidityManager", EOA_address)
  2. Verifica: reverta con "Implementation must be a contract"

SCENARIO 5 — Same address upgrade
  1. Tenta updateImplementation con lo stesso indirizzo già registrato
  2. Verifica: reverta con "Same implementation address"

SCENARIO 6 — 2-step ownership transfer
  1. owner chiama beacon.initiateOwnershipTransfer(newOwner)
  2. Verifica: pendingOwner == newOwner
  3. newOwner chiama beacon.acceptOwnership()
  4. Verifica: owner == newOwner, pendingOwner == address(0)
  5. Verifica: vecchio owner non può più fare updateImplementation
```

---

### F.6 — `test/unit/EdgeCases.parameterTimelock.test.ts` [NUOVO]

**Obiettivo**: Testare il sistema timelock del ParameterManager in modo esaustivo.

```
SCENARIO 1 — Proposta senza timelock (parametri non-critical)
  1. proposeParameterChange("minDeposit", nuovoValore)
  2. Verifica: requiresTimelock == false → esecuzione immediata OPPURE
     eseguire executeParameterChange() immediatamente e deve passare
  3. Verifica: getCurrentParameterValue("minDeposit") == nuovoValore

SCENARIO 2 — Proposta con timelock (parametri critical)
  1. proposeParameterChange("maxDeposit", nuovoValore)
  2. Tentare executeParameterChange("maxDeposit") immediatamente
  3. Verifica: reverta (timelock non ancora scaduto)
  4. evm_increaseTime(24 hours)  // default parameterTimelock
  5. executeParameterChange("maxDeposit")
  6. Verifica: passa ora

SCENARIO 3 — Parametro fuori range
  1. proposeParameterChange("maxSlippage", 9999)  // max è 1000 (10%)
  2. Verifica: reverta con errore (valore fuori range)

SCENARIO 4 — Annullamento proposta
  1. proposeParameterChange("maxDeposit", nuovoValore)
  2. Owner annulla la proposta (se cancelProposal() esiste)
  3. evm_increaseTime(24 hours)
  4. Verifica: executeParameterChange reverta (proposta cancellata)

SCENARIO 5 — Due proposte per stesso parametro
  1. proposeParameterChange("maxDeposit", 50e18)
  2. proposeParameterChange("maxDeposit", 75e18)  // sovrascrive?
  3. evm_increaseTime(24 hours)
  4. executeParameterChange("maxDeposit")
  5. Verifica: quale valore viene applicato (50 o 75)?

SCENARIO 6 — onlyAuthorizedUpdater check
  1. Tenta proposeParameterChange da account non autorizzato
  2. Verifica: reverta (solo owner o EmergencyHandler)

SCENARIO 7 — Emergency change (nessun timelock)
  1. EmergencyHandler chiama emergencyParameterChange (se esiste)
  2. Verifica: cambio immediato senza timelock
  3. Verifica: emesso evento ParameterEmergencyChanged
```

---

## 9. Infrastruttura di Test Enterprise

Oltre ai test stessi, l'infrastruttura deve evolversi per supportare test di qualità enterprise.

---

### 9.1 Fork Pinning per Riproducibilità

```typescript
// hardhat.config.ts — pinning al blocco specifico
hardhat: {
    forking: {
        url: process.env.ARBITRUM_RPC_URL!,
        blockNumber: 340_000_000, // Blocco fisso → test sempre riproducibili
        enabled: process.env.FORK_ENABLED === "true",
    },
    chainId: 42161,
    // Snapshots per test veloci
    mining: { auto: true, interval: 0 }
}
```

**Perché**: Un test che passa oggi con blocco "latest" potrebbe fallire domani se lo stato on-chain cambia (es. un vault Euler che viene migrato). I blocchi pinned garantiscono riproducibilità nel CI.

---

### 9.2 Shared Fixture System (`test/helpers/fixtures/fullStack.ts`)

Invece di deployare il sistema completo in ogni `before()` (che costa 30-60 secondi), usare **Hardhat snapshot fixtures**:

```typescript
// test/helpers/fixtures/fullStack.ts
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

export async function deployFullProtocolFixture() {
    // Deploy completo (beacon, proxyGeneral, tokenManager, ...)
    // Snapshot salvato da Hardhat
    const snapshot = await network.provider.send("evm_snapshot");
    return { beacon, liquidityManager, ..., snapshot };
}

// In ogni test file:
describe("Aave E2E", function () {
    let system: Awaited<ReturnType<typeof deployFullProtocolFixture>>;
    
    beforeEach(async function () {
        system = await loadFixture(deployFullProtocolFixture);
        // loadFixture ripristina automaticamente lo snapshot → ZERO tempo di deploy
    });
});
```

**Beneficio**: Riduce il tempo di setup da 60s a < 1s per test file. Permette di avere molti più scenari senza che la suite diventi troppo lenta.

---

### 9.3 Whale Registry Centralizzato (`test/helpers/whales.ts`)

```typescript
// test/helpers/whales.ts
export const WHALES = {
    USDC: "0x489ee077994B6658eAfA855C308275EAd8097C4A",  // Binance
    WETH: "0x489ee077994B6658eAfA855C308275EAd8097C4A",
    WBTC: "0x489ee077994B6658eAfA855C308275EAd8097C4A",
    USDT: "0x489ee077994B6658eAfA855C308275EAd8097C4A",
    ARB:  "0xB38e8c17e38363aF6EbdCb3dAE12e0243582891D",  // Arbitrum Foundation
};

export async function fundUser(
    token: string,
    user: string,
    amount: bigint
): Promise<void> {
    const whale = WHALES[token];
    await network.provider.request({ method: "hardhat_impersonateAccount", params: [whale] });
    // Funda il signer con ETH per gas
    await network.provider.send("hardhat_setBalance", [whale, "0x56BC75E2D63100000"]);
    const whaleSigner = await ethers.getSigner(whale);
    const tokenContract = await ethers.getContractAt("IERC20", TOKEN_ADDRESSES[token]);
    await tokenContract.connect(whaleSigner).transfer(user, amount);
    await network.provider.request({ method: "hardhat_stopImpersonatingAccount", params: [whale] });
}
```

---

### 9.4 Coverage Reporting

```json
// package.json — aggiungere script di coverage
{
    "scripts": {
        "test:coverage": "npx hardhat coverage --solcoverjs .solcover.js",
        "test:unit": "FORK_ENABLED=false npx hardhat test test/unit/**/*.ts",
        "test:fork": "FORK_ENABLED=true npx hardhat test test/e2e/*.ts test/integration/*.ts --network hardhat",
        "test:all": "npm run test:unit && npm run test:fork"
    }
}
```

```javascript
// .solcover.js
module.exports = {
    skipFiles: ['mocks/', 'interfaces/', 'old/'],
    istanbulReporter: ['html', 'text', 'lcov'],
    mocha: {
        timeout: 600000,
        reporter: 'spec'
    }
};
```

**Target di coverage**:
- Core contracts (`Beacon`, `LiquidityManager`, `ProxyGeneral`): > 95%
- Protocol plugins (`AaveV3Plugin`, `EulerV2Plugin`, `MorphoPlugin`): > 85%
- Services (`FlashLoanService`): > 80%

---

### 9.5 CI Pipeline (GitHub Actions)

```yaml
# .github/workflows/tests.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    name: Unit Tests (no fork)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: FORK_ENABLED=false npx hardhat test test/unit/**/*.ts
      - run: npx hardhat coverage --only test/unit

  fork-tests:
    name: Fork Tests (Arbitrum)
    runs-on: ubuntu-latest
    env:
      ARBITRUM_RPC_URL: ${{ secrets.ARBITRUM_RPC_URL }}
      FORK_ENABLED: "true"
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx hardhat test test/e2e/USDC.BaseAsset.e2e.test.ts test/e2e/WETH.BaseAsset.e2e.test.ts --network hardhat
        timeout-minutes: 20

  security-tests:
    name: Security Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx hardhat test test/security/**/*.ts
```

---

### 9.6 Gas Snapshot Testing

```typescript
// test/helpers/gasSnapshot.ts
import * as fs from "fs";

const SNAPSHOT_FILE = "test/gas-snapshots.json";

export async function assertGasSnapshot(name: string, actualGas: bigint): Promise<void> {
    const snapshots = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, "utf8") || "{}");
    
    if (snapshots[name]) {
        const baseline = BigInt(snapshots[name]);
        const tolerance = baseline * 5n / 100n; // 5% tolerance
        
        if (actualGas > baseline + tolerance) {
            throw new Error(`Gas regression: ${name} used ${actualGas} gas (baseline: ${baseline}, +${actualGas - baseline})`);
        }
    } else {
        // Prima esecuzione: salva come baseline
        snapshots[name] = actualGas.toString();
        fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshots, null, 2));
        console.log(`📸 Gas snapshot saved for ${name}: ${actualGas}`);
    }
}
```

**Utilizzo nei test**:
```typescript
it("deposit should use expected gas", async function () {
    // LiquidityManager.deposit() firma REALE: deposit(uint256 amount) — NO deadline
    // Per withdraw con deadline: withdrawWithDeadline(uint256 _shares, uint256 deadline)
    const tx = await liquidityManager.deposit(amount);
    const receipt = await tx.wait();
    await assertGasSnapshot("LiquidityManager.deposit", receipt.gasUsed);
});
```

---

## 10. Piano di Esecuzione — Priorità e Timeline

### Fase 0 — Fix Bug (stimato: 2-4 ore)

| Task | File | Effort | Sblocca |
|---|---|---|---|
| Fix EulerV2Plugin.fork costruttore | `test/integration/EulerV2Plugin.fork.test.ts` | 30 min | ~30 test |
| Fix MorphoPlugin MORPHO_ADDRESS getter | `test/integration/MorphoPlugin.fork.test.ts` | 30 min | 20 test |
| Fix AaveV3Plugin.fork fork check | `test/integration/AaveV3Plugin.fork.test.ts` | 15 min | ~40 test |
| Fix Withdraw.AutomaticSwap args | `test/e2e/Withdraw.*.fork.test.ts` | 1 ora | 10 test |
| Fix SimpleComplianceTests artefatto | `test/SimpleComplianceTests.test.ts` | 30 min | 4 test |
| Fix PerformanceBenchmarks oracle | `test/performance/PerformanceBenchmarks.test.ts` | 30 min | 10 test |

**Risultato Fase 0**: ~114 test in più che passano. Suite bug-free.

---

### Fase 1 — Invarianti (stimato: 1-2 giorni)

| File da creare | Categoria | Priorità |
|---|---|---|
| `test/invariants/ValueConservation.invariant.test.ts` | B.1 | 🔴 ALTA |
| `test/invariants/ShareAccounting.invariant.test.ts` | B.3 | 🔴 ALTA |
| `test/invariants/LPPrice.invariant.test.ts` | B.2 | 🟡 MEDIA |
| `test/invariants/HealthFactor.accuracy.test.ts` | B.4 | 🟡 MEDIA |

**Perché prima degli E2E avanzati**: Le invarianti sono test di sicurezza fondamentali che coprono proprietà matematiche. Se ci sono bug nel sistema, le invarianti li trovano prima dei test funzionali.

---

### Fase 2 — Protocollo Avanzato Fork (stimato: 3-5 giorni)

| File da creare | Categoria | Priorità |
|---|---|---|
| `test/e2e/Aave.BorrowRepay.e2e.test.ts` | A.1 | 🔴 ALTA |
| `test/e2e/Euler.BorrowRepay.e2e.test.ts` | A.2 | 🔴 ALTA |
| `test/e2e/Morpho.FullCycle.e2e.test.ts` | A.3 | 🔴 ALTA |
| `test/e2e/MorphoVault.FullCycle.e2e.test.ts` | A.7 [NUOVO] | 🟡 MEDIA |
| `test/e2e/UniswapV3.SwapExecution.e2e.test.ts` | A.4 | 🟡 MEDIA |
| `test/e2e/Dolomite.FullCycle.e2e.test.ts` | A.6 | 🟡 MEDIA |
| `test/e2e/FlashLoan.LeverageAave.e2e.test.ts` | A.5 | 🟡 MEDIA |

---

### Fase 3 — Sicurezza e Attacchi (stimato: 2-3 giorni)

| File da creare | Categoria | Priorità |
|---|---|---|
| `test/security/Reentrancy.attack.test.ts` | C.1 | 🔴 ALTA |
| `test/security/AccessControl.comprehensive.test.ts` | C.3 | 🔴 ALTA |
| `test/security/OracleManipulation.attack.test.ts` | C.2 | 🟡 MEDIA |
| `test/security/GriefingResistance.test.ts` | C.5 | 🟡 MEDIA |
| `test/security/FlashLoan.selfAttack.test.ts` | C.4 | 🟢 BASSA |

---

### Fase 4 — Cross-Module e Infrastruttura (stimato: 2-3 giorni)

| Task | Priorità |
|---|---|
| `test/e2e/CrossProtocol.Rebalance.e2e.test.ts` | 🟡 MEDIA |
| `test/e2e/FullSystem.MultiUser.fork.e2e.test.ts` | 🟡 MEDIA |
| `test/e2e/EmergencyOnLivePosition.e2e.test.ts` | 🟡 MEDIA |
| `test/e2e/DepositHelper.integration.e2e.test.ts` | 🟡 MEDIA [NUOVO] |
| `test/unit/EdgeCases.beaconUpgrade.test.ts` | 🟡 MEDIA [NUOVO] |
| `test/unit/EdgeCases.parameterTimelock.test.ts` | 🟡 MEDIA [NUOVO] |
| Shared fixture system (`loadFixture`) | 🟡 MEDIA |
| Whale registry centralizzato | 🟢 BASSA |
| Gas snapshot testing | 🟢 BASSA |
| Coverage reporting setup | 🟢 BASSA |

---

### Fase 5 — Edge Cases e Completamento (stimato: 1-2 giorni)

| File da creare | Priorità |
|---|---|
| `test/unit/EdgeCases.tokenDecimals.test.ts` | 🟡 MEDIA |
| `test/unit/EdgeCases.zeroValues.test.ts` | 🟡 MEDIA |
| `test/unit/EdgeCases.timelock.test.ts` | 🟢 BASSA |
| `test/unit/EdgeCases.rateLimit.test.ts` [CORRETTO] | 🟢 BASSA |
| `test/security/GriefingResistance.test.ts` | 🟢 BASSA |

---

## 11. Metriche di Qualità Target

Al completamento di tutte le fasi, la suite di test enterprise deve raggiungere:

| Metrica | Attuale | Target Enterprise |
|---|---|---|
| Test totali passanti (no fork) | ~1070 | > 1350 |
| Test totali su fork Arbitrum | ~0 eseguiti | > 300 |
| File di test totali | 75 | > 110 |
| Coverage contratti core | ~70% (stimata) | > 95% |
| Coverage plugin/adapter | ~50% (stimata) | > 85% |
| Bug bloccanti nella suite | 7 | **0** |
| Test invarianti | 0 | 5 |
| Test di sicurezza/attacco | 0 | > 25 |
| Test con interest accrual reale | 0 | > 8 |
| Test di liquidazione | 0 | > 4 |
| Test MorphoVaultPlugin | 0 | > 6 [NUOVO] |
| Test DepositHelper E2E | 0 | > 5 [NUOVO] |
| Test Beacon upgrade mechanics | 0 | > 6 [NUOVO] |
| Test ParameterManager timelock | < 5 | > 7 [NUOVO] |
| Gas snapshot baseline | 0 | per tutte le op principali |
| CI pipeline | no | sì (unit + fork) |

---

### Priorità assoluta per certezza al 100% su mainnet

Prima di deployare qualsiasi versione su Arbitrum mainnet con fondi reali, i seguenti test **devono** essere verdi:

1. ✅ Tutti i fix della Fase 0 completati
2. ✅ `ValueConservation.invariant.test.ts` — nessuna fuga di fondi
3. ✅ `ShareAccounting.invariant.test.ts` — accounting preciso
4. ✅ `Aave.BorrowRepay.e2e.test.ts` con interest accrual
5. ✅ `Reentrancy.attack.test.ts` — tutti gli attacchi bloccati
6. ✅ `AccessControl.comprehensive.test.ts` — 0 funzioni esposte per errore
7. ✅ I 7 test E2E core (USDC/WETH/WBTC/USDT/Euler/Morpho/MorphoVault) tutti green su fork
8. ✅ `GasOptimization.benchmark.e2e.test.ts` — nessuna operazione sopra soglia
9. ✅ `EdgeCases.beaconUpgrade.test.ts` — upgrade mechanics ben compreso e testato [NUOVO]
10. ✅ `FlashLoan.selfAttack.test.ts` — nessuna via per flash loan attack [NUOVO]

---

*Documento aggiornato in revisione tecnica del 11 Luglio 2026 sulla base di analisi approfondita di:*  
*`LiquidityManager`, `ProxyGeneral`, `ProtocolManager`, `EmergencyHandler`, `Beacon`, `ParameterManager`,*  
*`AaveV3Plugin`, `EulerV2Plugin`, `MorphoPlugin`, `MorphoVaultPlugin`, `DolomitePlugin` (struttura),*  
*`AaveV3LensAdapter`, `EulerLensAdapter`, `MorphoLensAdapter`, `FlashLoanService`, `DepositHelper`, `EulerRegistry`.*
