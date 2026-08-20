# 9.1 Struttura e Organizzazione

## Directory Layout

```
test/
├── unit/                          # Test unitari (singolo contratto)
│   ├── Beacon.test.ts
│   ├── ChainlinkAdapter.test.ts
│   ├── DolomitePlugin.test.ts
│   ├── EmergencyHandler.test.ts
│   ├── EmergencyHandler.simple.test.ts
│   ├── LiquidityManager.test.ts
│   ├── LiquidityManager.simple.test.ts
│   ├── ParameterManager.test.ts
│   ├── ProtocolManager.test.ts
│   ├── ProxyGeneral.simple.test.ts
│   ├── SwapManager.test.ts
│   ├── SwapManager.simple.test.ts
│   ├── SwapManager.Phase1A-1B.Integration.test.ts
│   ├── SwapManager.Phase1B.test.ts
│   ├── TokenManager.test.ts
│   ├── UniswapV3Plugin.test.ts
│   ├── ValueCalculator.test.ts
│   └── Withdraw.deadline.test.ts
│
├── integration/                   # Test di integrazione multi-contratto
│   ├── *.integration.test.ts      # Non-fork (mock environment)
│   ├── *.fork.test.ts             # Fork Arbitrum mainnet
│   ├── *.e2e.test.ts              # End-to-end con fork
│   ├── *.leverage.test.ts         # Test leverage specifici
│   └── MigrationScripts.test.ts
│
├── e2e/                           # End-to-end avanzati
│   ├── Withdraw.AutomaticSwap.*.ts
│   ├── OracleAdapter.e2e.test.ts
│   └── ...
│
├── helpers/
│   ├── fixtures/contracts.ts      # deploySystemFixture()
│   ├── mocks/oracles.ts           # Mock oracle utilities
│   └── utils/test-utils.ts        # TestEnvironment, assertions, time helpers
│
├── benchmarks/                    # Performance benchmarks
├── performance/                   # Gas/performance analysis
└── docs/                          # Test-specific documentation
```

## Naming Conventions

| Pattern | Significato | Richiede Fork? |
|---------|-------------|----------------|
| `*.test.ts` | Test unitario o base | No |
| `*.simple.test.ts` | Test semplificato (subset) | No |
| `*.integration.test.ts` | Integration test multi-contratto | No |
| `*.fork.test.ts` | Test con fork Arbitrum mainnet | **Sì** |
| `*.e2e.test.ts` | End-to-end completo | **Sì** |
| `*.leverage.test.ts` | Test leverage specifici | **Sì** |

## Tipologie di Test

### Unit Tests (`test/unit/`)
Ogni file testa un singolo contratto in isolamento usando mock contracts. Non richiedono fork di rete.

**Contratti testati:**
- `Beacon` — Registry/router delle implementazioni
- `ChainlinkAdapter` — Oracle adapter per Chainlink price feeds
- `LiquidityManager` — Gestione depositi/ritiri LP
- `SwapManager` — Routing swap multi-DEX
- `ProxyGeneral` — Proxy di custodia fondi utente
- `TokenManager` — Registrazione e gestione token
- `ValueCalculator` — Calcolo valori portfolio
- `ParameterManager` — Parametri governance
- `EmergencyHandler` — Sistema emergenza (pause, freeze)
- `ProtocolManager` — Plugin registry e routing

### Integration Tests (`test/integration/*.integration.test.ts`)
Testano interazione tra più contratti. Usano mock environment, **non** richiedono fork.

**Suite principali (23 file):**
- `BeaconModules` — Discovery e registrazione moduli
- `Emergency` — Workflow emergenza completo
- `Deposit` / `Withdraw` — Flussi operativi
- `LiquidityFlow` (LF-001..LF-005) — Deposit/Withdraw/Cycles/Concurrent/Stress
- `PG-001..PG-005` — Governance: parametri, voting, admin, cross-module, emergency
- `SF-001..SF-005` — Swap: operazioni, routing, slippage, multihop, emergency
- `OracleAdapter` — Integrazione oracle
- `SwapManager.Phase1B` — Multi-DEX routing
- `ProtocolManager` — Plugin management
- `MigrationScripts` — Script di migrazione
- `ProtocolManager.euler` — Euler-specific integration

### Fork Tests (`test/integration/*.fork.test.ts`, `*.e2e.test.ts`, `*.leverage.test.ts`)
Testano contratti su fork della rete Arbitrum mainnet. Interagiscono con contratti reali (Aave, Euler, Morpho).

**16 file fork:**
- `AaveV3Plugin.fork` / `AaveV3Plugin.leverage`
- `EulerV2Plugin.fork` / `.batch` / `.leverage` / `.leverage.e2e` / `.closePositionsForWeth` / `.phase3` / `.realfunds` / `.manualLeverage.e2e`
- `EulerLensAdapter.e2e`
- `MorphoPlugin.fork` / `MorphoVaultPlugin.fork`
- `FlashLoanService.e2e` / `FlashLoanPlugin.e2e`
- `e2e-deposit-withdraw.fork`
