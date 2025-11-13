# Piano Strategico: Test Coverage Completo per Tutti i Moduli

## Analisi

### Contesto:
Il progetto è un sistema DeFi modulare bassu su pattern Beacon con i seguenti componenti:
- **Beacon**: Registry centrale per gli indirizzi dei moduli
- **ProxyGeneral**: Contratto principale per liquidità ETH
- **Moduli specializzati**: LiquidityManager, SwapManager, EmergencyHandler, ParameterManager, TokenManager, ValueCalculator

**Stato attuale testing**:
- 2 test attivi: QuickSmokeTest (deployment) e SimpleComplianceTests (compliance base)
- 4 test archiviati in `/old/` (troppo complessi/specifici)
- 45+ script di deployment/interazione ma senza copertura sistematica
- Test fallimenti nei QuickSmokeTest indicano problemi di configurazione

### Vincoli / requisiti:
- **Copertura funzionale**: Ogni funzione pubblica/external deve avere test dedicato
- **Isolamento**: Test unitari indipendenti per ogni modulo
- **Integrazione**: Test di interazione tra moduli via Beacon
- **Manutenibilità**: Test semplici, modulari, facilmente debuggabili
- **Performance**: Test devono essere veloci (<30s per suite completa)
- **Environment**: Hardhat con ethers.js, supporto per mock/stub

### Rischi / incertezze:
- **Dipendenze esterne**: Chainlink oracles potrebbero richiedere mock complessi
- **State management**: Moduli condividono stato via Beacon, possibili race condition nei test
- **Gas limits**: Test complessi potrebbero eccedere limiti gas
- **Versioning**: Contratti potrebbero cambiare interfacce durante sviluppo
- **Setup complexity**: Sistema modulare richiede setup elaborato per ogni test

## Strategia

### Approccio scelto:
**Test Pyramid con Focus Modulare**

1. **Unit Tests** (70%): Ogni funzione testata in isolamento
2. **Integration Tests** (20%): Interazione tra 2-3 moduli
3. **E2E Tests** (10%): Flussi completi utente

**Struttura organizzativa**:
```
test/
├── unit/           # Test per singole funzioni
│   ├── Beacon.test.ts
│   ├── ProxyGeneral.test.ts
│   ├── LiquidityManager.test.ts
│   ├── SwapManager.test.ts
│   ├── EmergencyHandler.test.ts
│   ├── ParameterManager.test.ts
│   ├── TokenManager.test.ts
│   └── ValueCalculator.test.ts
├── integration/    # Test di interazione moduli
│   ├── BeaconModules.test.ts
│   ├── LiquidityFlow.test.ts
│   └── EmergencyScenarios.test.ts
├── e2e/           # Test end-to-end
│   └── UserJourney.test.ts
└── helpers/       # Utilities e mock
    ├── mocks/
    ├── fixtures/
    └── utils/
```

### Alternative e trade-off:

**Alternative 1: Monolithic Test Suite**
- ❌ Pro: Setup unico, test realistici
- ❌ Contro: Difficile debug, accoppiamento alto, lenti

**Alternative 2: Contract-focused Testing**
- ✅ Pro: Allineato con architettura Solidity
- ❌ Contro: Non copre interazioni, setup ridondante

**Alternative 3: Feature-based Testing** (SCELTA)
- ✅ Pro: Copertura completa, manutenibilità, isolamento
- ✅ Pro: Facilita refactoring e debugging
- ❌ Contro: Setup iniziale più complesso

### Motivazioni:
- **Modularità**: Rispecchia architettura del sistema
- **Manutenibilità**: Test piccoli e focalizzati
- **Debugging**: Errori facilmente localizzabili
- **Coverage**: Garantisce test di ogni funzione
- **CI/CD Ready**: Test veloci e affidabili

## Documentazione

### Schema logico / architetturale:

```
Test Architecture:

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Unit Tests    │    │ Integration     │    │   E2E Tests     │
│                 │    │   Tests         │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │   Beacon    │ │    │ │ Beacon+     │ │    │ │ Full User   │ │
│ │ Functions   │ │    │ │ Modules     │ │    │ │ Journey     │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │                 │
│ │ Liquidity   │ │    │ │ Emergency   │ │    │                 │
│ │ Manager     │ │    │ │ Scenarios   │ │    │                 │
│ └─────────────┘ │    │ └─────────────┘ │    │                 │
│      ...        │    │      ...        │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  Test Helpers   │
                    │                 │
                    │ ┌─────────────┐ │
                    │ │   Mocks     │ │
                    │ └─────────────┘ │
                    │ ┌─────────────┐ │
                    │ │  Fixtures   │ │
                    │ └─────────────┘ │
                    │ ┌─────────────┐ │
                    │ │   Utils     │ │
                    │ └─────────────┘ │
                    └─────────────────┘
```

### API / interfacce:

**Test Helpers API**:
```typescript
// helpers/fixtures/contracts.ts
export async function deploySystemFixture(): Promise<SystemContracts>
export async function deployModuleFixture(moduleName: string): Promise<Contract>

// helpers/mocks/oracles.ts
export class MockChainlinkOracle implements AggregatorV3Interface
export function createMockPriceFeed(price: BigNumber): MockChainlinkOracle

// helpers/utils/test-utils.ts
export async function setupTestEnvironment(): Promise<TestEnvironment>
export function expectRevertWithMessage(promise: Promise<any>, message: string)
export function advanceTime(seconds: number): Promise<void>
```

**Test Structure Pattern**:
```typescript
describe("ModuleName", function () {
  describe("functionName", function () {
    describe("when valid conditions", function () {
      it("should perform expected behavior", async function () {
        // Arrange, Act, Assert
      });
    });
    
    describe("when invalid conditions", function () {
      it("should revert with correct message", async function () {
        // Error case testing
      });
    });
    
    describe("edge cases", function () {
      it("should handle boundary values", async function () {
        // Edge case testing
      });
    });
  });
});
```

### Impatti / note tecniche:

**Coverage Targets**:
- **Funzioni pubbliche/external**: 100%
- **Funzioni interne critiche**: 90%
- **Error conditions**: 100%
- **Edge cases**: 80%

**Performance Considerations**:
- Parallel test execution dove possibile
- Snapshot/restore per reset stato
- Mock services per ridurre latenza
- Test categorization per esecuzione selettiva

**Maintenance Strategy**:
- Test naming convention: `ModuleName.FunctionName.Condition.ExpectedResult`
- Automated test generation per nuove funzioni
- Coverage reporting integrato in CI/CD
- Documentation linking tra test e specifiche

## TODO

### Fase 1: Infrastructure Setup
- [ ] **1.1** Creare struttura cartelle test (unit/, integration/, e2e/, helpers/)
- [ ] **1.2** Implementare sistema di fixture per deployment consistente
- [ ] **1.3** Creare mock per Chainlink oracles e servizi esterni
- [ ] **1.4** Implementare utilities comuni (time manipulation, assertions, etc.)
- [ ] **1.5** Configurare test runner con parallel execution e timeout

### Fase 2: Unit Tests Development
- [ ] **2.1** Beacon.test.ts - Test tutte le funzioni di registry e upgradability
- [ ] **2.2** TokenManager.test.ts - Test gestione token, oracles, validazioni
- [ ] **2.3** ValueCalculator.test.ts - Test calcoli, cache, token selection
- [ ] **2.4** ParameterManager.test.ts - Test governance, timelock, parameter storage
- [ ] **2.5** EmergencyHandler.test.ts - Test pause, emergency contacts, recovery
- [ ] **2.6** LiquidityManager.test.ts - Test deposit, withdraw, fees, limits
- [ ] **2.7** SwapManager.test.ts - Test swap logic, routing, slippage protection
- [ ] **2.8** ProxyGeneral.test.ts - Test LP token, rate limiting, authorization

### Fase 3: Integration Tests Development
- [ ] **3.1** BeaconModules.test.ts - Test comunicazione tra Beacon e tutti i moduli
- [ ] **3.2** LiquidityFlow.test.ts - Test flussi deposit → calculate → withdraw
- [ ] **3.3** SwapFlow.test.ts - Test flussi swap completi con multiple DEX
- [ ] **3.4** EmergencyScenarios.test.ts - Test scenari emergency cross-module
- [ ] **3.5** ParameterGovernance.test.ts - Test governance parameter changes

### Fase 4: E2E Tests Development
- [ ] **4.1** UserJourney.test.ts - Test scenari utente completi
- [ ] **4.2** AdminOperations.test.ts - Test operazioni amministrative
- [ ] **4.3** SystemUpgrade.test.ts - Test procedure di upgrade
- [ ] **4.4** StressTest.test.ts - Test con volumi alti e edge cases

### Fase 5: Coverage & Quality Assurance
- [ ] **5.1** Implementare coverage reporting (Istanbul/nyc)
- [ ] **5.2** Code review dei test con focus su edge cases
- [ ] **5.3** Performance profiling e ottimizzazione test lenti
- [ ] **5.4** Documentation test patterns e best practices
- [ ] **5.5** Integration con CI/CD per automated testing

### Fase 6: Maintenance & Evolution
- [ ] **6.1** Creare template per nuovi test modules
- [ ] **6.2** Implementare test auto-generation per nuove funzioni
- [ ] **6.3** Setup monitoring per test flaky o lenti
- [ ] **6.4** Training team su test patterns e debugging
- [ ] **6.5** Periodic review e refactoring test suite

**Stima Timeline**: 4-6 settimane (1 persona full-time)
**Milestone critiche**: Fine Fase 2 (unit tests), Fine Fase 3 (integration), Fine Fase 5 (production ready)