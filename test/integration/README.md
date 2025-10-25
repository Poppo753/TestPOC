# 🔗 Integration Tests

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