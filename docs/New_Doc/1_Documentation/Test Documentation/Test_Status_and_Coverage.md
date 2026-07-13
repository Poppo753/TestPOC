# Documentazione Completa dei Test

## Certificazione eseguita — 13 luglio 2026

Ambiente: Hardhat fork Arbitrum, `FORK_ENABLED=true`, blocco fissato
`FORK_BLOCK_NUMBER=483105327`. Le suite dedicate ai plugin Dolomite e GMX sono
escluse intenzionalmente perché i plugin non sono ancora completi.

| Categoria | Risultato verificato |
|---|---:|
| Unit | 1.193 passing, 0 failing, 0 pending |
| Integration attive | 654 passing in 42 file, 0 failing, 0 pending |
| E2E attive | 230 casi verificati, 0 failure funzionali, 0 pending |
| Invariants + Security | 83 passing, 0 failing, 0 pending |
| Performance / gas | 29 passing, 0 failing, 0 pending |

Durante il run E2E complessivo la RPC pubblica ha restituito due errori di
trasporto (HTTP 429/timeout). I due file coinvolti sono stati rilanciati
integralmente sullo stesso blocco e hanno chiuso **32/32 passing**. Questo
certifica il codice al blocco indicato; una RPC privata/stabile resta necessaria
per rendere il run CI completamente riproducibile e indipendente dai rate-limit.

Nessun file di test tracciato e nessun caso di test è stato eliminato. Il file
legacy `FlashLoanPlugin.e2e.test.ts` è stato migrato alla API corrente mantenendo
tutti i suoi 16 casi.

> **Progetto**: TestSmartContract  
> **Data di rilevazione**: 10 Luglio 2026  
> **Ambiente verificato**: `FORK_ENABLED=false` (hardhat network locale)  
> **Comandi usati**: `npx hardhat test <file> 2>&1`

---

## Legenda

| Simbolo | Significato |
|---|---|
| ✅ | Tutti i test passano |
| ⚠️ | Passano parzialmente — alcuni failing con bug noti |
| ⏸️ | Saltati gracefully — richiedono fork Arbitrum (`FORK_ENABLED=true`) |
| ❌ | Failing — hanno bug che impediscono l'esecuzione anche con fork |
| 🔀 | Strutturalmente corretti — richiedono fork per essere eseguiti ma il codice è OK |

---

## Indice

1. [Struttura della directory `test/`](#1-struttura-della-directory-test)
2. [Test Unitari (`test/unit/`)](#2-test-unitari-testunit)
3. [Test E2E (`test/e2e/`)](#3-test-e2e-teste2e)
4. [Test di Integrazione (`test/integration/`)](#4-test-di-integrazione-testintegration)
5. [Test Root-level (`test/`)](#5-test-root-level-test)
6. [Performance & Benchmarks](#6-performance--benchmarks)
7. [File di Supporto (`test/helpers/`)](#7-file-di-supporto-testhelpers)
8. [Riepilogo Numerico Totale](#8-riepilogo-numerico-totale)
9. [Bug da Fixare Prima di Andare in Fork](#9-bug-da-fixare-prima-di-andare-in-fork)
10. [Cosa Manca — Piano di Espansione Test E2E Fork](#10-cosa-manca--piano-di-espansione-test-e2e-fork)

---

## 1. Struttura della directory `test/`

> **Aggiornato**: 11 Luglio 2026 — dopo riorganizzazione cartelle. I file sono stati distribuiti in sottocartelle tematiche; i test obsoleti archiviati in `old/`.

```
test/
├── unit/               30 file — test logica contratti con mock, nessun fork
│                           (include QuickSmokeTest, SimpleComplianceTests, ValueCalculatorFix)
│
├── e2e/                17 file — test su fork Arbitrum mainnet
│                           (include TokenConfigurationDiagnostic come tool diagnostico)
│
├── integration/        45 file — test flussi multi-contratto, suddivisi per protocollo
│   ├── aave/            2  (AaveV3Plugin.fork, AaveV3Plugin.leverage)
│   ├── euler/           9  (fork, leverage, leverage.e2e, manualLeverage.e2e,
│   │                        phase3, realfunds, batch, closePositionsForWeth, LensAdapter.e2e)
│   ├── morpho/          2  (MorphoPlugin.fork, MorphoVaultPlugin.fork)
│   ├── dolomite/        2  (DolomitePlugin.fork, DolomitePlugin.borrow.fork)
│   ├── flash-loan/      2  (FlashLoanService.e2e, FlashLoanPlugin.e2e)
│   ├── liquidity/       8  (LF-001..005 + Deposit + Withdraw + e2e-deposit-withdraw)
│   ├── swap/            6  (SF-001..005 + SwapManager.Phase1B)
│   ├── governance/      5  (PG-001..005)
│   ├── system/          7  (BeaconModules, Emergency, LiquidityFlow, OracleAdapter,
│   │                        ProtocolManager x2, MigrationScripts)
│   └── scripts/         2  (Phase1.Core.test.ts + fixtures.ts)
│
├── performance/         2  (PerformanceBenchmarks + OracleAdapter.gas)
│
├── helpers/             4 file — utilities condivise, non eseguiti come test
│   ├── fixtures/contracts.ts    # Funzioni di deploy standardizzate
│   ├── mocks/oracles.ts         # Mock Chainlink
│   ├── mocks/MockERC20.sol      # Token ERC20 mintabile per test
│   └── utils/test-utils.ts      # Helpers (⚠️ ESM issue — vedi nota sotto)
│
├── docs/                2 md (euler.test.doc.md, Integration_Tests_Strategy.md)
│
└── old/                13 file — obsoleti, non eseguiti
        GMXv2Plugin (3 file) — strutturalmente rotti (keeper pattern asincrono)
        EulerV2Plugin.debug, EulerV2Plugin.closePositionsForWeth (duplicati da integration/old)
        EulerV2Plugin.leverage.e2e (duplicato da integration/old)
        EnhancedLiquidityPoolETH, ComplianceTestSuite — contratto rimosso
        OracleAdapterVerification — richiede fork, senza guard
        ValueCalculator.selectTokenForSwap — logica rimossa
        Withdraw.AutomaticSwap.mainnet, Withdraw.deadline.mainnet — stale post-refactoring
```

> **Nota ESM**: `test/helpers/utils/test-utils.ts` usa `@nomicfoundation/hardhat-network-helpers` che in alcune versioni è ESM-only. Questo causa un errore quando si esegue `npx hardhat test test/unit/` come directory glob. **Workaround**: specificare i file individualmente invece della cartella.

---

## 2. Test Unitari (`test/unit/`)

I test unitari usano esclusivamente **mock contracts** (MockBeacon, MockERC20, ecc.) e girano su Hardhat Network locale senza alcuna connessione a mainnet. Sono i più veloci (3-50 secondi) e coprono la logica interna dei contratti.

### 2.1 Core Contracts

| File | Stato | Test | A cosa serve |
|---|---|---|---|
| `Beacon.test.ts` | ✅ | ~30 | Registrazione moduli, getImplementation, upgrade logic, access control |
| `ParameterManager.test.ts` | ✅ | ~40 | Min/max deposit, fee rates, slippage, pause state, setParameter validation |
| `TokenManager.test.ts` | ✅ | ~55 | Aggiunta token, configurazione oracle, getOraclePrice, whitelist, supportedTokens |
| `ValueCalculator.test.ts` | ✅ | ~80 | Calcolo valore pool, prezzi LP, aggregazione, edge cases (pool vuota, max shares) |
| `LiquidityManager.test.ts` | ✅ | ~60 | Deposit/withdraw flow con mock, share accounting, fee collection |
| `LiquidityManager.simple.test.ts` | ✅ | ~20 | Versione semplificata, quickcheck per deploy e basic ops |
| `ProtocolManager.test.ts` | ✅ | ~45 | Plugin registration, deposit routing, protocol switching |
| `EmergencyHandler.test.ts` | ✅ | ~35 | Circuit breaker, emergency withdraw, pause/unpause, admin recovery |
| `EmergencyHandler.simple.test.ts` | ✅ | ~15 | Quickcheck deploy e operazioni base emergency |
| `ProxyGeneral.simple.test.ts` | ✅ | ~20 | Custody dei fondi, delegate call flow, access control |
| `ReentrancyGuard.test.ts` | ✅ | ~15 | Attacchi reentrancy su deposit/withdraw — tutti bloccati correttamente |

### 2.2 Protocol Plugins

| File | Stato | Test | A cosa serve |
|---|---|---|---|
| `LensAdapters.test.ts` | ✅ | **29** | Unit test di AaveV3/Euler/Morpho/MorphoVault LensAdapters: constructor, beacon resolution, pure functions, immutables |
| `AaveV3Registry.test.ts` | ✅ | ~30 | Configurazione token in Aave Registry, aToken/debtToken mapping, admin ops |
| `EulerRegistry.test.ts` | ✅ | ~30 | Configurazione vault Euler, asset → vault mapping, default vault |
| `MorphoRegistry.test.ts` | ✅ | ~30 | Configurazione market Morpho, collateral → market ID, oracle params |
| `DolomitePlugin.test.ts` | ✅ | **67** | Dolomite borrow/deposit/withdraw con mock, accounting, circuit breaker |
| `UniswapV3Plugin.test.ts` | ✅ | **10** | Gas measurement per inputSwap, configurazione pool, slippage |

### 2.3 Infrastructure

| File | Stato | Test | A cosa serve |
|---|---|---|---|
| `ChainlinkAdapter.test.ts` | ✅ | ~60 | Oracle setup, getPrice, staleness check, mock feed update, multi-token |
| `SwapManager.test.ts` | ✅ | ~50 | Routing logica, swap configuration, slippage validation |
| `SwapManager.simple.test.ts` | ✅ | ~20 | Quickcheck deploy e basic swap ops |
| `SwapManager.Phase1B.test.ts` | ✅ | ~30 | Phase 1B swap features: auto-select route, fallback |
| `SwapManager.missingFunctions.test.ts` | ✅ | ~20 | Funzioni SwapManager non coperte altrove |
| `SwapManager.Phase1A-1B.Integration.test.ts` | ✅ | ~30 | Integration test Phase1A+1B con mock (no fork) |

### 2.4 Multi-user & Edge Cases

| File | Stato | Test | A cosa serve |
|---|---|---|---|
| `MultiUser.concurrent.test.ts` | ✅ | **8** | 4 utenti depositano/withdrawano contemporaneamente — fund isolation |
| `Withdraw.deadline.test.ts` | ✅ | **9** | Deadline enforcement su withdraw, expired deadlines, multiple deadlines |

**Totale unit tests**: ~800+ test, tutti passanti ✅

---

## 3. Test E2E (`test/e2e/`)

I test E2E deployano l'intero stack del protocollo su un fork di Arbitrum mainnet e testano flussi reali con token reali. Richiedono `FORK_ENABLED=true` e un RPC Arbitrum configurato.

### 3.1 Protocol Full-Stack (🔀 — Pronti, richiedono fork)

Questi file deployano l'intero ecosistema (Beacon, ProxyGeneral, TokenManager, ValueCalculator, SwapManager, ParameterManager, LiquidityManager, ChainlinkAdapter + Registry + Plugin + LensAdapter) su fork Arbitrum.

| File | Stato | Test previsti | Asset principale | Protocollo testato |
|---|---|---|---|---|
| `USDC.BaseAsset.e2e.test.ts` | 🔀 | **12** | USDC (native) | Aave V3 |
| `WETH.BaseAsset.e2e.test.ts` | 🔀 | **12** | WETH | Aave V3 |
| `WBTC.BaseAsset.e2e.test.ts` | 🔀 | **12** | WBTC | Aave V3 |
| `USDT.BaseAsset.e2e.test.ts` | 🔀 | **12** | USDT | Aave V3 |
| `Euler.USDC.e2e.test.ts` | 🔀 | **15** | USDC | Euler V2 |
| `Morpho.WETH.e2e.test.ts` | 🔀 | **16** | WETH | Morpho Blue |
| `MorphoVault.USDC.e2e.test.ts` | 🔀 | **16** | USDC | Morpho Vault |

**Cosa testano in dettaglio (pattern comune):**
1. Deploy completo del protocollo
2. Impersonazione whale per fondi iniziali
3. `liquidityManager.deposit(amount, deadline)` → verifica LP tokens ricevuti
4. Verifica che i fondi siano effettivamente in Aave/Euler/Morpho (balance on-chain)
5. `liquidityManager.withdraw(lpAmount, minOut, deadline)` → verifica USDC/WETH ricevuti
6. Health factor check tramite LensAdapter
7. Verifica value breakdown (collateral, debt, net)
8. Test emergency withdraw

**Come eseguire:**
```powershell
# Singolo file
$env:FORK_ENABLED="true"; npx hardhat test test/e2e/USDC.BaseAsset.e2e.test.ts --network hardhat

# Tutti i 7 file core in sequenza
$env:FORK_ENABLED="true"; npx hardhat test test/e2e/USDC.BaseAsset.e2e.test.ts test/e2e/WETH.BaseAsset.e2e.test.ts test/e2e/WBTC.BaseAsset.e2e.test.ts test/e2e/USDT.BaseAsset.e2e.test.ts test/e2e/Euler.USDC.e2e.test.ts test/e2e/Morpho.WETH.e2e.test.ts test/e2e/MorphoVault.USDC.e2e.test.ts --network hardhat
```

---

### 3.2 Test di Diagnostica e Verifica

| File | Stato | Test | A cosa serve | Problema |
|---|---|---|---|---|
| `ForkCheck.test.ts` | ✅ | **3** | Verifica che il fork sia attivo e il chainId sia 42161 | Nessuno |
| `OracleAdapter.e2e.test.ts` | ❌ | ~8 | Testa ChainlinkAdapter su indirizzi reali Arbitrum | Chiama contratti mainnet senza fork → `BAD_DATA` |
| `OracleAdapterVerification.test.ts` | ❌ | ~5 | Verifica prezzi oracolo su fork | Stesso problema: richiede fork |
| `TokenConfigurationDiagnostic.test.ts` | ⚠️ | 3/7 | Diagnosi configurazione token (tool di debug) | 4 failing perché usano state mainnet |
| `PoolValueBreakdown.test.ts` | ⚠️ | ~2/6 | Breakdown valore pool per debugging | Richiede pool popolata su fork |
| `LPPriceBreakdown.test.ts` | ⚠️ | ~1/4 | Calcolo prezzo LP per debugging | Richiede pool popolata su fork |
| `CompletePoolValueAndWithdrawal.test.ts` | ⚠️ | ~2/6 | Test completo pool → withdraw per debugging | Richiede pool popolata su fork |

---

### 3.3 Test Withdraw con Swap Automatico (❌ — Stale, da fixare)

Questi test testano uno scenario avanzato: l'utente withdrawa un importo maggiore del saldo in un singolo token → il sistema deve swappare automaticamente da altri token tramite UniswapV3.

| File | Stato | Errore | Fix richiesto |
|---|---|---|---|
| `Withdraw.AutomaticSwap.fork.test.ts` | ❌ | `incorrect number of arguments to constructor` | Il deploy di almeno un contratto (probabilmente UniswapV3Plugin o AaveV3Plugin) ha argomenti mancanti |
| `Withdraw.AutomaticSwap.mainnet.test.ts` | ❌ | Cascade dal precedente | Dipende dallo stesso setup |
| `Withdraw.AutomaticSwap.onlyWithdraw.test.ts` | ⚠️ | `Skipping - no LP tokens from previous test` | Dipende da AutomaticSwap.mainnet — se quello passa, questo pure |
| `Withdraw.deadline.fork.test.ts` | ❌ | `Implementation must be a contract` | Beacon ha un'implementazione zero o non aggiornata nel setup |
| `Withdraw.deadline.mainnet.test.ts` | ❌ | Cascade | Dipende dal fork setup |

**Causa root**: Questi test sono stati scritti prima del refactoring `from1chainToMulti` e non sono stati aggiornati. I deploy dei contratti mancano dei nuovi argomenti costruttore (es. `_aavePool`, `_evcAddress`).

---

## 4. Test di Integrazione (`test/integration/`)

I test di integrazione coprono flussi multi-contratto. Sono divisi in due categorie: **mock-based** (girano senza fork, usano mock contracts) e **fork-based** (richiedono Arbitrum mainnet).

### 4.1 Flussi Core con Mock ✅

| File | Stato | Test | A cosa serve |
|---|---|---|---|
| `BeaconModules.integration.test.ts` | ✅ | ~15 | Registrazione e resoluzione moduli nel Beacon, upgrade path |
| `ProtocolManager.integration.test.ts` | ✅ | ~12 | Routing deposit verso protocolli, plugin switching, multi-protocol |
| `ProtocolManager.euler.test.ts` | ✅ | ~12 | Setup Euler in ProtocolManager con mock, verifica configurazione vault |
| `Deposit.integration.test.ts` | ✅ | ~4 | Flusso completo deposit: TokenManager → LiquidityManager → Plugin |
| `Withdraw.integration.test.ts` | ✅ | ~4 | Flusso completo withdraw: LP burn → Plugin → ProxyGeneral → utente |
| `Emergency.integration.test.ts` | ✅ | ~4 | Attivazione emergency, blocco operazioni, emergency withdraw |
| `LiquidityFlow.integration.test.ts` | ✅ | ~10 | Ciclo completo deposit/withdraw con share accounting |
| `SwapManager.Phase1B.integration.test.ts` | ✅ | ~9 | Swap integration Phase1B con mock contracts |
| `OracleAdapter.integration.test.ts` | ✅ | ~15 | Oracle integration con mock Chainlink feed |
| `MigrationScripts.test.ts` | ✅ | ~15 | Test degli script di migrazione (upgrade contratti) |
| `e2e-deposit-withdraw.fork.test.ts` | ✅ | **44** | Deposit/withdraw simulato — usa Hardhat Network, non fork reale |

---

### 4.2 Serie LF — Liquidity Flow (✅ 20 test totali)

5 file che coprono il ciclo di vita completo della liquidità:

| File | Stato | Test | Copre |
|---|---|---|---|
| `LF-001.DepositFlow.integration.test.ts` | ✅ | 4 | Deposit con token diversi, validazione slippage |
| `LF-002.WithdrawFlow.integration.test.ts` | ✅ | 4 | Withdraw parziale, totale, con scadenza |
| `LF-003.CycleTesting.integration.test.ts` | ✅ | 4 | Deposit → accumulo rendimento → withdraw ciclo |
| `LF-004.ConcurrentOps.integration.test.ts` | ✅ | 4 | 4 utenti concorrenti, fund isolation verificata |
| `LF-005.StressTesting.integration.test.ts` | ✅ | 4 | Burst di transazioni ad alto volume, efficienza |

---

### 4.3 Serie PG — Protocol Governance (✅ 15 test totali)

| File | Stato | Test | Copre |
|---|---|---|---|
| `PG-001.ParameterUpdates.integration.test.ts` | ✅ | 3 | Aggiornamento parametri (fee, limiti, slippage) |
| `PG-002.GovernanceVoting.integration.test.ts` | ✅ | 3 | Simulazione governance vote (placeholder) |
| `PG-003.AdminControls.integration.test.ts` | ✅ | 3 | onlyOwner enforcement, multi-admin, revoke |
| `PG-004.CrossModuleSync.integration.test.ts` | ✅ | 3 | Sincronizzazione parametri cross-modulo |
| `PG-005.GovernanceEmergency.integration.test.ts` | ✅ | 3 | Emergency governance: audit trail, trasparenza |

---

### 4.4 Serie SF — Swap Flow (✅ 14 test totali)

| File | Stato | Test | Copre |
|---|---|---|---|
| `SF-001.SwapOperations.integration.test.ts` | ✅ | 3 | Operazioni di swap base |
| `SF-002.RoutingOptimization.integration.test.ts` | ✅ | 3 | Selezione route ottimale (mock) |
| `SF-003.SlippageProtection.integration.test.ts` | ✅ | 3 | Rifiuto transazioni oltre slippage limit |
| `SF-004.MultiHopSwaps.integration.test.ts` | ✅ | 3 | Swap multi-hop (A→B→C) su mock |
| `SF-005.SwapEmergency.integration.test.ts` | ✅ | 2 | Emergency response coordinata su swap |

---

### 4.5 Fork Tests — Pronti ma richiedono FORK_ENABLED=true (⏸️)

Questi test sono strutturalmente corretti ma il loro `beforeAll` skippa tutto se il fork non è attivo.

| File | Stato | Test previsti | Cosa testa |
|---|---|---|---|
| `EulerLensAdapter.e2e.test.ts` | ⏸️ | ~15 | Tutte le funzioni del LensAdapter Euler: health factor, TVL, APY, posizioni a rischio |
| `FlashLoanPlugin.e2e.test.ts` | ⏸️ | ~8 | Flash loan via Balancer, leva 2x su Aave, apertura/chiusura posizione |
| `FlashLoanService.e2e.test.ts` | ⏸️ | ~8 | Flash loan service: routing, fallback, fee calculation |
| `DolomitePlugin.fork.test.ts` | ⏸️ | ~20 | Deposit/borrow/repay su Dolomite con fondi reali |
| `DolomitePlugin.borrow.fork.test.ts` | ⏸️ | ~10 | Borrow specifico su Dolomite, collateral management |
| `AaveV3Plugin.leverage.test.ts` | ⏸️ | ~10 | Leverage loop su Aave: deposit WETH → borrow USDC → swap → deposit |
| `EulerV2Plugin.leverage.test.ts` | ⏸️ | ~10 | Leverage su Euler V2 |
| `EulerV2Plugin.leverage.e2e.test.ts` | ⏸️ | ~12 | Leverage e2e con real Euler vaults |
| `EulerV2Plugin.manualLeverage.e2e.test.ts` | ⏸️ | ~8 | Leverage manuale step-by-step |
| `EulerV2Plugin.realfunds.test.ts` | ⏸️ | ~12 | Test con fondi reali trasferiti da whale |
| `EulerV2Plugin.phase3.test.ts` | ⏸️ | ~20 | Funzionalità Phase 3: multi-vault, rebalance |
| `EulerV2Plugin.batch.test.ts` | ⏸️ | ~15 | Operazioni batch EVC |

---

### 4.6 Fork Tests — ROTTI, da fixare (❌)

| File | Stato | Errore | Causa | Fix |
|---|---|---|---|---|
| `AaveV3Plugin.fork.test.ts` | ❌ | `could not decode result data (getReserveAToken)` | Il `beforeAll` chiama `getReserveAToken` su un contratto che non risponde senza fork | Wrap il `beforeAll` con fork check, oppure eseguire solo con fork |
| `EulerV2Plugin.fork.test.ts` | ❌ | `incorrect number of arguments to constructor` | Deploy di `EulerV2Plugin` nel `beforeAll` non ha i nuovi 2 argomenti (`_evcAddress`, `_accountLensAddress`) | Aggiornare `EulerV2Plugin.deploy(beacon, "WETH", EVC_ADDRESS, ACCOUNT_LENS_ADDRESS)` |
| `MorphoVaultPlugin.fork.test.ts` | ❌ | `HexaOne USDC vault not found on fork` | L'indirizzo del vault MetaMorpho non è trovato al blocco di fork corrente | Aggiornare indirizzo vault o usare un blocco fork più recente |
| `EulerV2Plugin.closePositionsForWeth.test.ts` | ❌ | `Transaction reverted without a reason string` | Il contratto chiama una funzione su un indirizzo non valido senza fork | Richiede fork, manca il check `FORK_ENABLED` |
| `MorphoPlugin.fork.test.ts` | ⚠️ | `plugin.MORPHO_ADDRESS is not a function` (20 failing) + fork needed | Il test chiama il getter dell'ex-costante `MORPHO_ADDRESS` invece di `morpho` | Sostituire `plugin.MORPHO_ADDRESS()` con `plugin.morpho()` nel file test |

---

### 4.7 GMX (❌ — Problemi strutturali)

| File | Stato | Test | Problema |
|---|---|---|---|
| `GMXv2Plugin.e2e.test.ts` | ❌ | 0/17 | GMX V2 richiede callback asincroni che Hardhat fork non supporta nativamente |
| `GMXv2Plugin.fork.test.ts` | ❌ | 0/17 | Stesso problema |
| `GMXv2Plugin.simple.test.ts` | ❌ | 0/17 | Deployment fallisce: GMX V2 non è una semplice chiamata ERC20 |

**Nota**: GMX V2 usa un sistema di keeper/callback (depositi avvengono in 2 step). I test di integrazione su fork hardhat non supportano facilmente questo pattern. Richiedono un approccio diverso (mock del keeper o test su devnet separato).

---

### 4.8 Altri file di integrazione

| File | Stato | Note |
|---|---|---|
| `MorphoPlugin.fork.test.ts` | ⚠️ | 27 passing (mock), 20 failing (serve fork + fix getter `MORPHO_ADDRESS`) |
| `MorphoVaultPlugin.fork.test.ts` | ❌ | 0 passing — vault address non trovato senza fork |
| `EulerV2Plugin.closePositionsForWeth.test.ts` | ❌ | 1 failing — manca fork check |
| `LF-002.WithdrawFlow` → `LF-005` (vedi §4.2) | ✅ | — |

---

## 5. Test Root-level (`test/`)

| File | Stato | Passing/Failing | A cosa serve |
|---|---|---|---|
| `QuickSmokeTest.test.ts` | ✅ | **14/14** | Deploy rapido di tutti i moduli core, verifica che il sistema sia operativo in <10s |
| `SimpleComplianceTests.test.ts` | ⚠️ | **13/17** | Compliance test basici (deposit/withdraw limits, fee checks, access control) — 4 failing per artifact `EnhancedLiquidityPoolETH` non trovato (contratto rimosso) |
| `ValueCalculatorFix.test.ts` | ✅ | ~10/10 | Verifica fix specifico del ValueCalculator: edge cases su pool vuota e calcolo shares |

---

## 6. Performance & Benchmarks

| File | Stato | Passing/Failing | A cosa serve |
|---|---|---|---|
| `performance/PerformanceBenchmarks.test.ts` | ⚠️ | **7/17** | Benchmark gas per deposit, withdraw, swap — 10 failing per `Token not supported by oracle` (token non configurato nel MockOracle) |
| `benchmarks/OracleAdapter.gas.test.ts` | ⚠️ | 0/1 | Misura gas per ChainlinkAdapter.getPrice — failing per setup incompleto |

---

## 7. File di Supporto (`test/helpers/`)

Non sono file di test ma sono usati da tutti i test come utilities:

| File | Uso |
|---|---|
| `helpers/fixtures/contracts.ts` | Funzioni `deployFullStack()` e varianti — deploy standardizzato di tutti i contratti. Usato da test di integrazione e e2e |
| `helpers/mocks/oracles.ts` | Factory per MockChainlinkOracle con prezzi configurabili per WETH, USDC, WBTC, USDT, ARB |
| `helpers/mocks/MockERC20.sol` | Token ERC20 mintabile per test — usato da praticamente tutti i test unit |
| `helpers/utils/test-utils.ts` | Utilities Hardhat (time travel, event parsing, snapshot) — ⚠️ ESM issue se importato via `require` da test che usano CommonJS |

---

## 8. Riepilogo Numerico Totale

### Test senza fork (`FORK_ENABLED=false`)

| Categoria | File | ✅ Passing | ⚠️ Partial | ❌ Failing/Broken |
|---|---|---|---|---|
| Unit | 26 | ~800+ | 0 | 0 |
| Integration (mock) | ~30 | ~200 | 27 | ~20 |
| Root-level | 3 | 27 | 4 | 0 |
| Performance | 2 | 7 | 10 | 1 |
| E2E (fork skip) | 7 | 0 (skip) | — | — |
| E2E (diagnostic) | 7 | ~9 | ~15 | ~10 |
| **TOTALE** | **75+** | **~1070** | **~56** | **~31** |

### Breakdown per stato

| Stato | File di test | Test |
|---|---|---|
| ✅ Tutti passanti | ~55 file | ~1070 |
| 🔀 Pronti per fork | 7 file e2e + 12 integration | ~190 previsti su fork |
| ⏸️ Saltati (fork needed) | ~12 file | ~110 previsti |
| ⚠️ Parzialmente rotti | ~8 file | ~56 (alcuni pass, alcuni fail) |
| ❌ Rotti (fix needed) | ~8 file | ~30 test fail per bug |

---

## 9. Bug da Fixare Prima di Andare in Fork

Questi sono i fix necessari, in ordine di priorità, per avere una test suite completa su fork:

### Fix #1 — `EulerV2Plugin.fork.test.ts` ⚡ Priorità ALTA
**File**: `test/integration/EulerV2Plugin.fork.test.ts`  
**Errore**: `incorrect number of arguments to constructor`  
**Fix**: Nel `beforeAll`, aggiornare:
```typescript
// Prima (vecchio — 2 argomenti)
plugin = await EulerV2PluginFactory.deploy(mockBeacon.target, "WETH");

// Dopo (nuovo — 4 argomenti)
const EVC_ADDRESS = "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066";
const ACCOUNT_LENS = "0x90a52DDcb232e7bb003DD9258fA1235c553eC956";
plugin = await EulerV2PluginFactory.deploy(mockBeacon.target, "WETH", EVC_ADDRESS, ACCOUNT_LENS);
```

---

### Fix #2 — `MorphoPlugin.fork.test.ts` ⚡ Priorità ALTA
**File**: `test/integration/MorphoPlugin.fork.test.ts`  
**Errore**: `TypeError: plugin.MORPHO_ADDRESS is not a function`  
**Causa**: Il test verifica l'indirizzo del protocollo con il getter della ex-costante `MORPHO_ADDRESS` che non esiste più dopo il refactoring.  
**Fix**: Cercare nel file ogni occorrenza di `plugin.MORPHO_ADDRESS()` o `lensAdapter.MORPHO()` e sostituire con:
```typescript
// Prima
expect(await plugin.MORPHO_ADDRESS()).to.equal(MORPHO);

// Dopo
expect(await plugin.morpho()).to.equal(MORPHO);
```

---

### Fix #3 — `AaveV3Plugin.fork.test.ts` ⚡ Priorità ALTA
**File**: `test/integration/AaveV3Plugin.fork.test.ts`  
**Errore**: `could not decode result data (getReserveAToken)` — il `beforeAll` tenta di chiamare il contratto Aave Pool su hardhat network locale senza fork.  
**Fix**: Aggiungere un fork check all'inizio del `beforeAll`:
```typescript
before(async function () {
    const network = await ethers.provider.getNetwork();
    if (network.chainId !== 42161n) {
        console.log("⚠️  Skipping - requires Arbitrum fork");
        this.skip(); // ← aggiungere questo
        return;
    }
    // resto del setup...
});
```

---

### Fix #4 — `Withdraw.AutomaticSwap.fork.test.ts` ⚡ Priorità MEDIA
**File**: `test/e2e/Withdraw.AutomaticSwap.fork.test.ts`  
**Errore**: `incorrect number of arguments to constructor`  
**Causa**: Il deploy di AaveV3Plugin o AaveV3LensAdapter non ha i nuovi argomenti.  
**Fix**: Identificare nel file quale contratto ha il deploy stale e aggiungere l'argomento `_aavePool`:
```typescript
// Cercare e aggiornare
aavePlugin = await AaveV3PluginFactory.deploy(beacon.target, "USDC", AAVE_V3_POOL);
aaveLensAdapter = await AaveV3LensAdapterFactory.deploy(beacon.target, "USDC", AAVE_V3_POOL);
```

---

### Fix #5 — `Withdraw.deadline.fork.test.ts` ⚡ Priorità MEDIA
**File**: `test/e2e/Withdraw.deadline.fork.test.ts`  
**Errore**: `Implementation must be a contract`  
**Causa**: Il Beacon viene configurato con un'implementazione non valida (indirizzo zero o mock non deployato).  
**Fix**: Verificare che nel setup del test tutti i moduli vengano registrati correttamente nel Beacon prima di eseguire i test di deposit/withdraw.

---

### Fix #6 — `SimpleComplianceTests.test.ts` ⚡ Priorità BASSA
**File**: `test/SimpleComplianceTests.test.ts`  
**Errore**: `HH700: Artifact for contract "EnhancedLiquidityPoolETH" not found`  
**Causa**: Il test fa riferimento a un contratto (`EnhancedLiquidityPoolETH`) che è stato rimosso o rinominato.  
**Fix**: Rimuovere i 4 test che referenziano quel contratto, o rinominare il contratto nel test con quello corretto.

---

### Fix #7 — `PerformanceBenchmarks.test.ts` ⚡ Priorità BASSA
**Errore**: `Token not supported by oracle`  
**Causa**: I 10 test failing usano token che non sono configurati nel MockOracle del setup.  
**Fix**: Nel `beforeEach`/`before` del file, aggiungere la configurazione dei token WETH, USDC, WBTC, USDT al MockOracle prima di eseguire i benchmark.

---

## 10. Cosa Manca — Piano di Espansione Test E2E Fork

Questa sezione descrive cosa aggiungere per avere copertura completa al 100% su fork Arbitrum e come farlo.

### 10.1 Gap attuali nei test E2E fork

#### Protocolli non coperti end-to-end

| Protocollo | Ha unit test | Ha fork test | Gap |
|---|---|---|---|
| Aave V3 | ✅ | 🔀 (7 test BaseAsset) | Mancano: borrow, repay, leverage, liquidation |
| Euler V2 | ✅ | 🔀 (15 test) + ⏸️ (leverage/batch) | Mancano: multi-vault rebalance, closures |
| Morpho Blue | ✅ | 🔀 (16 test) + ❌ (fork broken) | Mancano: liquidation, bad debt scenario |
| Morpho Vault | ✅ | 🔀 (16 test) + ❌ (vault not found) | Stale vault address |
| Dolomite | ✅ (67 unit) | ⏸️ (skip senza fork) | **Nessun fork test eseguito mai** |
| UniswapV3 | ✅ (10 unit) | ❌ (parte di Withdraw test rotti) | Test swap reale su pool reale mancante |
| Flash Loan | — | ⏸️ (2 file) | Non testato su fork |
| GMX V2 | — | ❌ (strutturalmente rotti) | **Approccio completamente da rivedere** |

---

### 10.2 Cosa aggiungere — Priorità ALTA

#### A. Test Aave V3 Avanzati (nuovo file `test/e2e/Aave.AdvancedFlow.e2e.test.ts`)

```
Cosa testare:
1. Deposit WETH → verifica aWETH ricevuto
2. Borrow USDC contro collateral WETH → verifica debtToken
3. Verifica health factor dopo borrow (deve essere > 1.0)
4. Repay USDC → verifica debtToken ridotto
5. Verifica health factor torna a safe
6. Liquidation scenario: health factor < 1.0 → test liquidation
7. Interest accrual: avanzare il tempo → verifica interesse maturato
8. Withdraw tutto → verifica che aWETH sia 0
```

#### B. Test Euler V2 Borrow Completo (nuovo file `test/e2e/Euler.AdvancedFlow.e2e.test.ts`)

```
Cosa testare:
1. Supply USDC su eUSDC-1 vault → verifica shares ricevute
2. Enable collateral → borrow WETH da eWETH-1
3. Verifica health factor tramite EulerLensAdapter
4. Repay WETH → verifica posizione chiusa
5. Test batch: supply + borrow in una singola transazione EVC
6. Close all positions: closePositionsForBaseAsset
```

#### C. Test Morpho Blue Liquidazione (nuovo file `test/e2e/Morpho.LiquidationScenario.e2e.test.ts`)

```
Cosa testare:
1. Apri posizione: collateral WETH, debt USDC
2. Manipola prezzo oracle → health factor scende
3. Verifica posizione a rischio tramite LensAdapter.getPositionsAtRisk()
4. Simula liquidazione: chiamata liquidate()
5. Verifica bad debt handling
```

---

### 10.3 Cosa aggiungere — Priorità MEDIA

#### D. Test Cross-Protocol (nuovo file `test/e2e/CrossProtocol.Rebalance.e2e.test.ts`)

Scenario: il ProtocolManager ha USDC depositato su Aave. Si decide di spostarlo su Euler (rendimento più alto).
```
1. Deploy con Aave come protocollo attivo
2. Deposit USDC → va su Aave
3. Switch protocollo → Euler
4. Verifica rebalance: fondi si spostano da Aave a Euler
5. Verifica che TVL totale sia preservato
```

#### E. Test Swap Automatico su Withdraw (fix di `Withdraw.AutomaticSwap.fork.test.ts`)

Dopo il fix #4 sopra, questo test già esiste e copre:
```
1. Pool con USDC + WBTC
2. User deposita ETH
3. User vuole withdraware più ETH di quante ne ha il pool
4. Il SwapManager automaticamente converte WBTC/USDC → ETH
5. User riceve l'importo richiesto
```

#### F. Test Flash Loan Leverage (fix di `FlashLoanPlugin.e2e.test.ts`)

Dopo aver verificato che `FlashLoanPlugin.e2e.test.ts` skippa correttamente, eseguirlo con fork:
```powershell
$env:FORK_ENABLED="true"; npx hardhat test test/integration/FlashLoanPlugin.e2e.test.ts --network hardhat
```

---

### 10.4 Come configurare il fork Arbitrum

#### Setup in `hardhat.config.ts`

```typescript
hardhat: {
    forking: {
        url: process.env.ARBITRUM_RPC_URL || "",
        enabled: process.env.FORK_ENABLED === "true",
        blockNumber: 320000000, // opzionale: fissa il blocco per riproducibilità
    },
    chainId: 42161,
}
```

#### Variabili d'ambiente necessarie

```powershell
# Imposta la RPC URL (Alchemy/Infura/QuickNode su Arbitrum)
$env:ARBITRUM_RPC_URL="https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY"

# Abilita il fork
$env:FORK_ENABLED="true"

# Esegui test
npx hardhat test test/e2e/USDC.BaseAsset.e2e.test.ts --network hardhat
```

#### Pattern whale impersonation (usato in tutti gli e2e)

```typescript
// Impersona un whale (Binance: ha tutti i token)
const WHALE = "0x489ee077994B6658eAfA855C308275EAd8097C4A";
await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [WHALE],
});
const whale = await ethers.getSigner(WHALE);
const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);

// Trasferisci fondi al test user
await usdc.connect(whale).transfer(user1.address, ethers.parseUnits("10000", 6));
```

---

### 10.5 Sequenza consigliata per validazione completa

```powershell
# Step 1: Verifica fork attivo
$env:FORK_ENABLED="true"; npx hardhat test test/e2e/ForkCheck.test.ts --network hardhat

# Step 2: I 7 test E2E core (già pronti)
$env:FORK_ENABLED="true"; npx hardhat test test/e2e/USDC.BaseAsset.e2e.test.ts test/e2e/WETH.BaseAsset.e2e.test.ts --network hardhat

# Step 3: Dopo Fix #1 — EulerV2Plugin fork
$env:FORK_ENABLED="true"; npx hardhat test test/integration/EulerV2Plugin.fork.test.ts --network hardhat

# Step 4: Dopo Fix #2 — MorphoPlugin fork completo
$env:FORK_ENABLED="true"; npx hardhat test test/integration/MorphoPlugin.fork.test.ts --network hardhat

# Step 5: Dopo Fix #3 — AaveV3Plugin fork completo
$env:FORK_ENABLED="true"; npx hardhat test test/integration/AaveV3Plugin.fork.test.ts --network hardhat

# Step 6: LensAdapters su fork reale
$env:FORK_ENABLED="true"; npx hardhat test test/integration/EulerLensAdapter.e2e.test.ts --network hardhat

# Step 7: Flash loan
$env:FORK_ENABLED="true"; npx hardhat test test/integration/FlashLoanPlugin.e2e.test.ts --network hardhat

# Step 8: Test avanzati (dopo creazione nuovi file)
$env:FORK_ENABLED="true"; npx hardhat test test/e2e/Aave.AdvancedFlow.e2e.test.ts --network hardhat
```

---

## Conclusione

Il progetto ha una **base di test solida e ben strutturata**:

- **~1070 test passano** senza alcun fork, coprendo tutta la logica interna
- **7 test E2E core** sono pronti per il fork Arbitrum e coprono i flussi principali di Aave, Euler, Morpho
- **~110 test** sono in attesa di essere eseguiti su fork (strutturalmente corretti, solo skip)

I **31 test failing** sono causati da 7 bug specifici e isolati (vedere §9), tutti fixabili in meno di 2 ore di lavoro.

Dopo i fix, la priorità di espansione è:
1. Borrow/repay flows su Aave V3 e Euler V2
2. Test di liquidazione su Morpho
3. Cross-protocol rebalance
4. Revisione architetturale per GMX V2 (keeper pattern)
