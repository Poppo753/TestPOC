# 2 — Infrastruttura completa e catalogo dei test

## 1. Obiettivo dell'infrastruttura

La test suite verifica il protocollo su tre livelli complementari:

1. logica locale deterministica, con mock e deployment freschi;
2. integrazione fra moduli del sistema;
3. interazione con contratti realmente presenti su Arbitrum mediante fork.

Un test locale risponde a “la funzione implementa la regola corretta?”. Un test
di integrazione risponde a “i moduli condividono correttamente registry, custody,
autorizzazioni e stato?”. Un E2E fork risponde a “il flusso funziona contro Aave,
Euler, Morpho, Chainlink e Uniswap reali al blocco scelto?”.

## 2. Stack tecnico

| Componente | Uso |
|---|---|
| Hardhat 2 | compilazione, rete locale, fork e JSON-RPC di test |
| Solidity 0.8.27 | compilatore dei contratti |
| optimizer + `viaIR` | ottimizzazione e supporto ai contratti con stack complesso |
| Ethers v6 | deploy, chiamate, eventi, signer e impersonation |
| Mocha | organizzazione `describe`/`it`, hook e timeout |
| Chai + hardhat-chai-matchers | asserzioni, revert e custom error |
| TypeChain | binding TypeScript generati in `typechain-types/` |
| hardhat-network-helpers | fixture cache, snapshot e manipolazione rete |
| solidity-coverage | coverage dei contratti non esclusi |
| hardhat-gas-reporter | report opzionale con `REPORT_GAS=true` |

La rete Hardhat usa `chainId: 42161`, `allowUnlimitedContractSize: true` per i
plugin di test più grandi e timeout di rete pari a 600 secondi.

## 3. Modalità locale e fork

### Locale

Senza `FORK_ENABLED=true`, Hardhat crea una blockchain vuota. I test deployano
contratti e mock, controllano input/output e non dipendono dalla rete.

### Fork Arbitrum

Con `FORK_ENABLED=true`, Hardhat legge lo stato Arbitrum dalla RPC e applica
localmente le transazioni di test. Il blocco certificato è:

```text
FORK_BLOCK_NUMBER=483105327
```

Il fork consente di usare codice e storage reali senza spendere fondi reali. Le
modifiche restano soltanto nella rete Hardhat del processo.

## 4. Configurazione e variabili d'ambiente

| Variabile | Significato |
|---|---|
| `FORK_ENABLED` | abilita il fork quando vale `true` |
| `FORK_BLOCK_NUMBER` | blocco deterministico usato come origine |
| `ARBITRUM_RPC_URL` | endpoint Arbitrum; per CI deve essere privato/stabile |
| `REPORT_GAS` | abilita hardhat-gas-reporter |
| `COINMARKETCAP_API_KEY` | conversione facoltativa del gas in USD |
| `ARBITRUM_ETHERSCAN_API_KEY` | verifica contratti, non necessaria ai test |
| `PRIVATE_KEY` | necessaria solo agli script su rete esterna, non ai fork test standard |

## 5. Ciclo di vita di un test

### 5.1 Compilazione

Hardhat compila i sorgenti, crea gli artifact e genera i tipi. Ogni modifica a
firma o costruttore viene quindi intercettata prima dell'esecuzione.

### 5.2 Setup

Il setup ottiene signer deterministici, deploya Beacon e moduli, registra le
implementazioni, configura token/oracle/registry e autorizza i moduli in
`ProxyGeneral`.

### 5.3 Funding

I test locali usano funzioni `mint` dei mock. Sul fork vengono usati:

- wrapping ETH tramite `WETH.deposit()`;
- impersonation di holder reali per ERC-20 non mintabili;
- `hardhat_setBalance` per fornire gas all'account impersonato.

### 5.4 Azione e osservazione

Il test esegue la transazione e verifica stato, saldo, share, debito, health
factor, eventi, revert, authorization e consumo gas.

### 5.5 Teardown

Snapshot/revert isolano test e suite. L'impersonation viene sempre terminata.
Questo evita che saldi, timestamp, circuit breaker o posizioni contaminino i
test successivi.

## 6. Fixture condivise

### `deployFullProtocolFixture()`

Deploya uno stack deterministico composto da:

- `Beacon`;
- `ProxyGeneral` come custody e token LP;
- `TokenManager`;
- `ValueCalculator`;
- `SwapManager`;
- `ParameterManager`;
- `EmergencyHandler`;
- `LiquidityManager`;
- `MockWETH`, mock USDC a 6 decimali e mock WBTC a 8 decimali;
- `MockOracleAdapter` con prezzi noti.

Registra `BASE_ASSET`, `WETH` e tutti i moduli nel Beacon, abilita deposit e
withdraw, imposta fee recipient, autorizzazioni e rate limit.

### Fixture protocol-specifiche

- `deployWithAaveFixture()` aggiunge Aave Pool e `AaveV3Plugin`.
- `deployWithEulerFixture()` aggiunge EVC, Account Lens ed `EulerV2Plugin`.
- `deploySystemFixture()` costruisce uno stack modulare più generico.
- `deployMinimalSystemFixture()` crea soltanto Beacon e ProxyGeneral.
- `deployModuleFixture()` isola un singolo modulo.

`loadFixture()` può memorizzare lo snapshot successivo al deployment e ripristinarlo
per ogni test, riducendo tempo e divergenza fra setup duplicati.

## 7. Beacon, registry, custody e authorization

Il Beacon risolve i moduli per nome. Un setup completo deve registrare almeno i
moduli richiesti dal percorso chiamato. Un indirizzo registrato deve essere un
contratto, non una EOA.

I registry contengono metadati esterni che non appartengono al Beacon:

- Aave: underlying, aToken e variable debt token;
- Euler: vault, coppie leverage e record posizione;
- Morpho: parametri market e vault predefiniti.

`ProxyGeneral` custodisce gli asset e conia/brucia le share LP. I moduli che
muovono fondi devono essere autorizzati esplicitamente.

## 8. Oracle e determinismo economico

I test locali usano prezzi controllati. I test fork interrogano feed e protocol
state reali. Heartbeat, decimali e denominazione vengono configurati
esplicitamente. Il target `USD` evita conversioni implicite non configurate.

Le asserzioni economiche principali riguardano:

- valore token normalizzato;
- valore totale della pool;
- LP price;
- conservazione del valore;
- collateral, debt e net value;
- health factor e soglie di liquidazione.

## 9. Gas snapshot e benchmark

`test/helpers/gasSnapshot.ts` memorizza baseline in
`test/gas-snapshots.json`. Alla prima esecuzione crea la voce; successivamente
fallisce se il consumo supera la baseline di oltre il 5%. I benchmark hanno
anche limiti assoluti per distinguere una regressione relativa da un'operazione
intrinsecamente troppo costosa.

`.solcover.js` esclude mock, interfacce, codice old e plugin old dal report di
coverage.

## 10. Catalogo dei test unitari

I test unitari comprendono 34 file e 1.193 dichiarazioni di caso. Il totale
include 67 casi locali di `DolomitePlugin.test.ts`; non certifica il plugin
Dolomite contro il protocollo reale.

| File | Casi | Cosa verifica |
|---|---:|---|
| `AaveV3Registry.test.ts` | 51 | configurazione reserve, lookup, liste, admin e input invalidi |
| `Beacon.test.ts` | 49 | ownership a due fasi, update, lookup, history, freeze e sicurezza |
| `ChainlinkAdapter.test.ts` | 49 | feed, heartbeat, decimali, stale price, supporto token e breaker |
| `DolomitePlugin.test.ts` | 67 | sola logica locale/mock; non protocollo Dolomite reale |
| `EdgeCases.beaconUpgrade.test.ts` | 13 | upgrade, history, freeze, EOA, stesso indirizzo, ownership |
| `EdgeCases.parameterTimelock.test.ts` | 9 | proposte parametro, delay, execute, cancel e permessi |
| `EdgeCases.rateLimit.test.ts` | 10 | limiti orari/giornalieri, utenti e operazioni indipendenti |
| `EdgeCases.timelock.test.ts` | 6 | esecuzione prematura, scadenza e interazione con pause |
| `EdgeCases.tokenDecimals.test.ts` | 10 | asset a 2/6/8/18 decimali, valore e scaling |
| `EdgeCases.zeroValues.test.ts` | 11 | zero, dust, pool vuota, ultimo withdraw e nuovo bootstrap |
| `EmergencyHandler.simple.test.ts` | 29 | core emergency, contatti, pause, timelock e report |
| `EmergencyHandler.test.ts` | 59 | matrice completa di emergenza, authorization ed eventi |
| `EulerRegistry.test.ts` | 72 | vault, position records, ID, active state e amministrazione |
| `LensAdapters.test.ts` | 29 | interfaccia comune delle lens e aggregazione valori/rischio |
| `LiquidityManager.simple.test.ts` | 35 | deposit/withdraw core, fee e controlli principali |
| `LiquidityManager.test.ts` | 94 | accounting completo, swap automatico, limiti, eventi e security |
| `MorphoRegistry.test.ts` | 64 | market, vault, default vault, lookup e access control |
| `MultiUser.concurrent.test.ts` | 8 | utenti multipli, share e indipendenza dei saldi |
| `ParameterManager.test.ts` | 65 | parametri, range, timelock, ruoli e aggiornamenti |
| `ProtocolManager.test.ts` | 32 | plugin resolution, selector whitelist e call forwarding |
| `ProxyGeneral.simple.test.ts` | 61 | custody, share ERC-20, authorization e rate limit |
| `QuickSmokeTest.test.ts` | 14 | sanity check rapido dei contratti principali |
| `ReentrancyGuard.test.ts` | 6 | protezioni su SwapManager, LiquidityManager e ProxyGeneral |
| `SimpleComplianceTests.test.ts` | 17 | deployment, fee, limiti, emergency, parametri e swap |
| `SwapManager.missingFunctions.test.ts` | 21 | funzioni e rami precedentemente non coperti |
| `SwapManager.Phase1A-1B.Integration.test.ts` | 8 | modalità di swap integrate a livello locale |
| `SwapManager.Phase1B.test.ts` | 20 | query multi-plugin e selezione del percorso |
| `SwapManager.simple.test.ts` | 30 | core swap, accessi e configurazione |
| `SwapManager.test.ts` | 78 | routing, slippage, deadline, eventi, failure e security |
| `TokenManager.test.ts` | 87 | registry token, oracle routing, decimali, cache e lifecycle |
| `UniswapV3Plugin.test.ts` | 10 | configurazione pool, quoting e vincoli plugin |
| `ValueCalculator.test.ts` | 61 | prezzi, pool value, cache, token selection e validazione |
| `ValueCalculatorFix.test.ts` | 9 | regressioni deterministiche su valore e selezione asset |
| `Withdraw.deadline.test.ts` | 9 | deadline, warning critici, eventi e scadenza withdraw |

## 11. Catalogo integrazione

La matrice certificata contiene 42 file attivi e 654 test passati. I due file
`integration/dolomite` sono esclusi.

### Aave ed Euler

| File | Focus |
|---|---|
| `aave/AaveV3Plugin.fork.test.ts` | reserve reali, deposit/withdraw/borrow/repay, lens, accessi e breaker |
| `aave/AaveV3Plugin.leverage.test.ts` | leverage atomico tramite FlashLoanService, deadline e close |
| `euler/EulerLensAdapter.e2e.test.ts` | APY, health, value, risk detection e auto-close |
| `euler/EulerV2Plugin.batch.test.ts` | EVC batch, collateral/controller, full-cycle, emergency e gas |
| `euler/EulerV2Plugin.closePositionsForWeth.test.ts` | chiusura ordinata per ottenere base asset |
| `euler/EulerV2Plugin.fork.test.ts` | registry, EVC, deposit, borrow, repay, withdraw e breaker |
| `euler/EulerV2Plugin.leverage.e2e.test.ts` | open/add collateral/close e posizioni multiple |
| `euler/EulerV2Plugin.leverage.test.ts` | validazioni, leverage reale, account e access control |
| `euler/EulerV2Plugin.manualLeverage.e2e.test.ts` | loop borrow/swap/deposit via Uniswap V3 |
| `euler/EulerV2Plugin.phase3.test.ts` | fase atomica e regressioni del leverage |
| `euler/EulerV2Plugin.realfunds.test.ts` | fondi reali nel fork e ciclo operativo completo |

### Flash loan

| File | Focus |
|---|---|
| `flash-loan/FlashLoanPlugin.e2e.test.ts` | compatibilità della vecchia suite con l'architettura corrente, 16 casi |
| `flash-loan/FlashLoanService.e2e.test.ts` | deploy, callback, open/close Euler atomico e sicurezza |

### Liquidity e concorrenza

| File | Focus |
|---|---|
| `liquidity/Deposit.integration.test.ts` | deposit completo e share |
| `liquidity/Withdraw.integration.test.ts` | burn, fee, conversione e ricezione asset |
| `liquidity/e2e-deposit-withdraw.fork.test.ts` | Morpho/Aave/Euler e deposit-withdraw su fork |
| `LF-001.DepositFlow.integration.test.ts` | ETH → WETH → LP e casi avanzati |
| `LF-002.WithdrawFlow.integration.test.ts` | LP → WETH → ETH, fee e stato finale |
| `LF-003.CycleTesting.integration.test.ts` | cicli ripetuti e assenza di drift |
| `LF-004.ConcurrentOps.integration.test.ts` | share 1:1, ordine utenti e race accounting |
| `LF-005.StressTesting.integration.test.ts` | volumi elevati, burst e consistenza |

### Swap, governance, system e script

| Gruppo | File e copertura |
|---|---|
| Swap | `SF-001` operazioni; `SF-002` routing; `SF-003` slippage; `SF-004` multi-hop; `SF-005` emergency; `SwapManager.Phase1B` integrazione plugin |
| Governance | `PG-001` parameter update; `PG-002` voting; `PG-003` admin; `PG-004` sync; `PG-005` emergency governance |
| System | Beacon/modules, emergency, liquidity flow, migration, oracle adapter, ProtocolManager generico ed Euler |
| Script | `Phase1.Core.test.ts` verifica DepositETH, WithdrawETH, status, balance, error handling e performance |

### Morpho

- `MorphoPlugin.fork.test.ts`: market config, collateral, borrow/repay, health,
  circuit breaker e accessi.
- `MorphoVaultPlugin.fork.test.ts`: vault config, deposit/redeem, default vault,
  lens, accounting e failure path.

### Esclusioni integrazione

- `dolomite/DolomitePlugin.fork.test.ts`;
- `dolomite/DolomitePlugin.borrow.fork.test.ts`.

## 12. Catalogo E2E

I 28 file attivi rappresentano 230 casi verificati. Il file
`Dolomite.FullCycle.e2e.test.ts` è escluso.

| Area | File | Flusso verificato |
|---|---|---|
| Aave | `Aave.BorrowRepay.e2e.test.ts` | supply, collateral, borrow USDC, interest, repay e withdraw |
| Euler | `Euler.BorrowRepay.e2e.test.ts` | share vault, debt, interest, repay e close-all |
| Euler base asset | `Euler.USDC.e2e.test.ts` | pool USDC, posizione Euler, lens e uscita utenti |
| Morpho | `Morpho.FullCycle.e2e.test.ts` | market WETH/USDC, collateral e struttura borrow/repay |
| Morpho WETH | `Morpho.WETH.e2e.test.ts` | protocollo completo con WETH base |
| MorphoVault | `MorphoVault.FullCycle.e2e.test.ts` | registry vault, default vault, deposit/redeem e failure |
| MorphoVault USDC | `MorphoVault.USDC.e2e.test.ts` | pool completo e vault USDC reale |
| Flash leverage | `FlashLoan.LeverageAave.e2e.test.ts` | apertura/chiusura leva Aave atomica |
| Cross protocol | `CrossProtocol.Rebalance.e2e.test.ts` | spostamento di capitale Aave/Euler/Morpho |
| Emergency | `EmergencyOnLivePosition.e2e.test.ts` | breaker su posizione Aave live |
| Multi-user | `FullSystem.MultiUser.fork.e2e.test.ts` | più utenti, timeline, supply e consistenza |
| Deposit helper | `DepositHelper.integration.e2e.test.ts` | helper e instradamento deposito |
| Uniswap | `UniswapV3.SwapExecution.e2e.test.ts` | configurazione e swap reale |
| Withdraw | `Withdraw.AutomaticSwap.fork.test.ts` | swap multi-asset automatico durante withdraw |
| Withdraw isolato | `Withdraw.AutomaticSwap.onlyWithdraw.test.ts` | LP creati dal test e uscita completa |
| Deadline | `Withdraw.deadline.fork.test.ts` | scadenza, warning, eventi, MEV protection e timing |
| Base assets | `WETH`, `WBTC`, `USDC`, `USDT.BaseAsset.e2e.test.ts` | deposito, valore, protocollo, lens e withdraw per decimali diversi |
| Oracle | `OracleAdapter.e2e.test.ts` | multi-user, switch, emergency, lifecycle token e precisione |
| Diagnostics | `TokenConfigurationDiagnostic`, `PoolValueBreakdown`, `LPPriceBreakdown` | configurazione e contabilità deterministiche |
| Pool lifecycle | `CompletePoolValueAndWithdrawal.test.ts` | ciclo deterministico completo |
| Load | `HighLoad.concurrent.fork.test.ts` | utenti concorrenti, freeze e stress read |
| Gas | `GasOptimization.benchmark.e2e.test.ts` | deployment e operazioni entro budget/snapshot |
| Fork sanity | `ForkCheck.test.ts` | chain ID, blocco e presenza del codice reale |

## 13. Invarianti

| File | Proprietà difesa |
|---|---|
| `ValueConservation.invariant.test.ts` | il valore non nasce o scompare nei cicli |
| `LPPrice.invariant.test.ts` | LP price coerente e non manipolata dall'ordine |
| `ShareAccounting.invariant.test.ts` | supply uguale alla somma delle share |
| `HealthFactor.accuracy.test.ts` | lens e protocollo concordano sul rischio |
| `NoFundLeakage.invariant.test.ts` | nessun residuo o trasferimento non autorizzato |

## 14. Sicurezza

| File | Vettore testato |
|---|---|
| `Reentrancy.attack.test.ts` | callback e rientro su deposit/withdraw/swap |
| `OracleManipulation.attack.test.ts` | prezzi stale, zero, outlier e sostituzione oracle |
| `AccessControl.comprehensive.test.ts` | owner, moduli, attacker e funzioni privilegiate |
| `FlashLoan.selfAttack.test.ts` | callback falsa, self-attack e plugin non registrato |
| `GriefingResistance.test.ts` | dust, spam, blocco risorse e operazioni ostili |

## 15. Performance

- `PerformanceBenchmarks.test.ts` — 18 casi: deployment, operazioni core,
  letture, batch e limiti di regressione.
- `OracleAdapter.gas.test.ts` — 11 casi: feed diretto, adapter, TokenManager,
  caching/overhead e precisione.

Totale certificato: 29 passing.

## 16. Interpretazione del risultato finale

Il risultato verde significa che, al blocco fissato e con le esclusioni
dichiarate:

- non ci sono failure funzionali;
- non ci sono test pending nelle suite attive;
- i flow reali completano il ciclo previsto;
- invarianti e security assertions restano valide;
- i benchmark non superano le soglie.

Non significa che una RPC pubblica sia affidabile: due hook E2E sono stati
interrotti da HTTP 429/timeout e sono poi passati nel rerun completo dei file
coinvolti (32/32). Per CI serve una RPC privata con archive access e rate limit
adeguato.

