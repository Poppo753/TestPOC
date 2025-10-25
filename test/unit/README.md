# 🧪 Unit Tests

## Scopo
Test unitari per ogni singola funzione di ogni modulo del sistema.

## Struttura
Ogni file di test corrisponde a un contratto:

- `Beacon.test.ts` - Test per registry e upgradability
- `TokenManager.test.ts` - Test gestione token e oracles
- `ValueCalculator.test.ts` - Test calcoli e cache
- `ParameterManager.test.ts` - Test governance e timelock
- `EmergencyHandler.test.ts` - Test pause e recovery
- `LiquidityManager.test.ts` - Test deposit, withdraw, fees
- `SwapManager.test.ts` - Test swap logic e routing
- `ProxyGeneral.test.ts` - Test LP token e rate limiting

## Pattern di Test
```typescript
describe("ContractName", function () {
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

## Obiettivi Coverage
- **Funzioni pubbliche/external**: 100%
- **Error conditions**: 100%
- **Edge cases**: 80%