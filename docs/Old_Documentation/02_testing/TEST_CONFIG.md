# 🧪 Test Configuration & Runner Setup

## Test Categories

### Quick Tests (< 10s)
```bash
# Run only unit tests
npx hardhat test test/unit/**/*.test.ts

# Run specific module
npx hardhat test test/unit/Beacon.test.ts
```

### Integration Tests (10-30s)
```bash
# Run integration tests
npx hardhat test test/integration/**/*.test.ts
```

### Full Suite (30-60s)
```bash
# Run all tests
npx hardhat test

# Run with coverage
npx hardhat coverage
```

### E2E Tests (60-120s)
```bash
# Run end-to-end tests
npx hardhat test test/e2e/**/*.test.ts
```

## Parallel Execution

### Hardhat Configuration
Add to `hardhat.config.ts`:

```typescript
export default {
  mocha: {
    timeout: 60000, // 60 seconds timeout
    parallel: true,  // Enable parallel test execution
    reporter: 'spec', // Detailed output
    bail: false,     // Continue on failures
  },
  networks: {
    hardhat: {
      mining: {
        auto: true,
        interval: 0, // Mine blocks instantly for tests
      },
      gas: 12000000,
      blockGasLimit: 12000000,
      allowUnlimitedContractSize: true,
    },
  },
};
```

## Test Scripts

### Package.json Scripts
```json
{
  "scripts": {
    "test": "hardhat test",
    "test:unit": "hardhat test test/unit/**/*.test.ts",
    "test:integration": "hardhat test test/integration/**/*.test.ts",
    "test:e2e": "hardhat test test/e2e/**/*.test.ts",
    "test:coverage": "hardhat coverage",
    "test:gas": "REPORT_GAS=true hardhat test",
    "test:parallel": "hardhat test --parallel",
    "test:watch": "hardhat test --watch",
    "test:quick": "hardhat test test/unit/Beacon.test.ts test/unit/TokenManager.test.ts"
  }
}
```

## Test Environment Variables

### .env.test
```env
# Test Configuration
NODE_ENV=test
HARDHAT_NETWORK=hardhat
TEST_TIMEOUT=60000
TEST_PARALLEL=true
REPORT_GAS=false

# Mock Configuration
MOCK_CHAINLINK=true
MOCK_DEX_ROUTERS=true
MOCK_EXTERNAL_SERVICES=true

# Debug Configuration
DEBUG_TESTS=false
DEBUG_CONTRACTS=false
PAUSE_ON_ERRORS=false
```

## Performance Optimization

### Test Categorization
- **Fast Tests**: Unit tests with mocks (~1-5s each)
- **Medium Tests**: Integration tests (~5-15s each)  
- **Slow Tests**: E2E tests (~15-30s each)

### Parallel Execution Strategy
- Unit tests: Full parallelization
- Integration tests: Limited parallelization (shared state)
- E2E tests: Sequential execution (complex setup)

### Memory Management
- Use snapshots for state reset
- Clean up contracts after tests
- Limit concurrent test instances

## Coverage Configuration

### .solcover.js
```javascript
module.exports = {
  skipFiles: ['test/', 'node_modules/', 'helpers/mocks/'],
  configureYulOptimizer: true,
  solcOptimizerDetails: {
    peephole: false,
    inliner: false,
    jumpdestRemover: false,
    orderLiterals: true,
    deduplicate: false,
    cse: false,
    constantOptimizer: false,
    yul: false,
  },
  mocha: {
    timeout: 120000,
    grep: '@skip-on-coverage',
    invert: true,
  },
};
```

### Coverage Targets
- **Line Coverage**: > 90%
- **Function Coverage**: > 95%
- **Branch Coverage**: > 85%
- **Statement Coverage**: > 90%

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        test-type: [unit, integration, e2e]
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - run: npm ci
      - run: npx hardhat compile
      - run: npm run test:${{ matrix.test-type }}
      
      - name: Upload coverage
        if: matrix.test-type == 'unit'
        uses: codecov/codecov-action@v3
```

## Debugging Configuration

### VSCode Launch Configuration (.vscode/launch.json)
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "program": "${workspaceFolder}/node_modules/.bin/hardhat",
      "args": ["test", "${file}"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "env": {
        "DEBUG_TESTS": "true"
      }
    }
  ]
}
```

## Test Maintenance

### Regular Tasks
- **Weekly**: Review test performance metrics
- **Monthly**: Update test data and scenarios
- **Quarterly**: Refactor slow tests
- **Release**: Full test suite validation

### Monitoring
- Track test execution times
- Monitor flaky test patterns
- Measure coverage trends
- Review gas usage patterns

## Troubleshooting

### Common Issues
1. **Timeout Errors**: Increase timeout or optimize test setup
2. **Memory Leaks**: Use proper cleanup in afterEach hooks
3. **Parallel Conflicts**: Identify shared state dependencies
4. **Gas Estimation**: Update gas limits for complex operations

### Debug Commands
```bash
# Run with debug output
DEBUG=* npx hardhat test

# Run single test with gas reporting
REPORT_GAS=true npx hardhat test test/unit/Beacon.test.ts

# Run with specific network
npx hardhat test --network localhost
```