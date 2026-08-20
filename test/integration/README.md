# 🔗 Integration Tests

## to test:

npx hardhat test test/integration/PG-001.ParameterUpdates.integration.test.ts test/integration/PG-002.GovernanceVoting.integration.test.ts test/integration/PG-003.AdminControls.integration.test.ts test/integration/PG-004.CrossModuleSync.integration.test.ts test/integration/PG-005.GovernanceEmergency.integration.test.ts test/integration/LF-001.DepositFlow.integration.test.ts test/integration/LF-002.WithdrawFlow.integration.test.ts test/integration/LF-003.CycleTesting.integration.test.ts test/integration/LF-004.ConcurrentOps.integration.test.ts test/integration/LF-005.StressTesting.integration.test.ts test/integration/SF-001.SwapOperations.integration.test.ts test/integration/SF-002.RoutingOptimization.integration.test.ts test/integration/SF-003.SlippageProtection.integration.test.ts test/integration/SF-004.MultiHopSwaps.integration.test.ts test/integration/SF-005.SwapEmergency.integration.test.ts test/integration/BeaconModules.integration.test.ts test/integration/LiquidityFlow.integration.test.ts test/integration/Deposit.integration.test.ts test/integration/Withdraw.integration.test.ts test/integration/Emergency.integration.test.ts

## Scopo
Test di interazione tra 2-3 moduli del sistema per verificare il funzionamento coordinato.

## Test Files
- `BeaconModules.test.ts` - Test comunicazione Beacon ↔ Moduli
- `LiquidityFlow.test.ts` - Test flussi deposit → calculate → withdraw
- `SwapFlow.test.ts` - Test flussi swap completi
- `EmergencyScenarios.test.ts` - Test scenari emergency cross-module
- `ParameterGovernance.test.ts` - Test governance parameter changes

## Focus
- Comunicazione tra contratti via Beacon
- Flussi di dati complessi
- State consistency tra moduli
- Error propagation
- Transaction ordering

## Pattern
```typescript
describe("Integration: ModuleA + ModuleB", function () {
  describe("when ModuleA calls ModuleB", function () {
    it("should maintain state consistency", async function () {
      // Setup multiple modules
      // Execute cross-module operation
      // Verify state in all affected modules
    });
  });
});
```