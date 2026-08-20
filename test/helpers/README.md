# 🛠️ Test Helpers

## Struttura
- `mocks/` - Mock contracts e servizi esterni
- `fixtures/` - Setup standardizzati per deployment
- `utils/` - Utilities comuni per tutti i test

## Scopo
Fornire componenti riusabili per semplificare la scrittura e manutenzione dei test.

## Componenti Principali

### Mocks
- Chainlink Price Feeds
- External DEX Routers
- Time manipulation
- Network conditions

### Fixtures
- System deployment completo
- Single module deployment
- Test accounts setup
- Initial state configuration

### Utils
- Custom assertions
- Error message helpers
- Gas measurement tools
- State verification helpers

## Usage Pattern
```typescript
import { deploySystemFixture } from '../helpers/fixtures/contracts';
import { mockChainlinkOracle } from '../helpers/mocks/oracles';
import { expectRevertWithMessage } from '../helpers/utils/test-utils';

describe("MyTest", function () {
  beforeEach(async function () {
    const system = await loadFixture(deploySystemFixture);
    // Use system contracts
  });
});
```