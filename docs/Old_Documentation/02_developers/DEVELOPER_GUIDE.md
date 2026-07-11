# 👨‍💻 Developer Guide - Core Scripts

## 🎯 Overview

This guide provides technical details for developers working with or extending the Core Scripts suite. It covers architecture patterns, coding standards, and extension guidelines.

## 🏗️ Architecture Deep Dive

### BaseScript Framework

The `BaseScript` class implements the **Template Method Pattern** to provide consistent behavior across all scripts:

```typescript
export abstract class BaseScript {
  // Template method - defines the execution flow
  async execute(): Promise<ScriptResult> {
    await this.setup();
    await this.customPreExecutionChecks();
    const result = await this.executeMain();
    await this.customPostExecutionVerification();
    await this.finalize(result);
    return result;
  }
  
  // Abstract methods - implemented by concrete scripts
  protected abstract getScriptName(): string;
  protected abstract executeMain(): Promise<ScriptResult>;
  
  // Hooks - optionally overridden by concrete scripts
  protected async customPreExecutionChecks(): Promise<void> {}
  protected async customPostExecutionVerification(): Promise<void> {}
  protected async finalize(result: ScriptResult): Promise<void> {}
}
```

### Key Design Principles

1. **Separation of Concerns**: Business logic separated from infrastructure
2. **Dependency Injection**: Contracts and configuration injected during setup
3. **Error Boundaries**: Comprehensive error handling at multiple levels
4. **Observability**: Structured logging and metrics collection
5. **Testability**: All components mockable and testable

### Interface Design

```typescript
// Standard interfaces used across all scripts
export interface ScriptConfig {
  verbose?: boolean;
  dryRun?: boolean;
  confirmations?: number;
  gasLimit?: number;
  skipValidation?: boolean;
}

export interface ScriptResult {
  success: boolean;
  transactionHash?: string;
  blockNumber?: number;
  gasUsed?: bigint;
  result?: any;
  error?: string;
  executionTime?: number;
  data?: { [key: string]: any };
}

export interface ScriptOptions extends ScriptConfig {
  [key: string]: any; // Script-specific parameters
}
```

## 🔧 Development Setup

### Prerequisites
```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests to ensure everything works
npm test
```

### Environment Configuration
```env
# Development settings
NODE_ENV=development
VERBOSE_LOGGING=true
LOG_LEVEL=debug

# Network configuration
NETWORK=localhost
RPC_URL=http://127.0.0.1:8545

# Contract addresses (local development)
BEACON_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
# ... other addresses
```

### Project Structure
```
scripts/
├── utils/
│   └── BaseScript.ts           # Abstract base class
├── config/
│   ├── config.ts              # Main configuration
│   ├── networks.ts            # Network-specific settings
│   └── constants.ts           # Business constants
└── core/
    ├── deposit/               # Deposit operations
    ├── withdraw/              # Withdrawal operations
    └── monitoring/            # System monitoring
```

## 📝 Creating New Scripts

### Step 1: Create Script Class

```typescript
import { BaseScript, ScriptResult, ScriptOptions } from "../../utils/BaseScript";

export interface MyScriptOptions extends ScriptOptions {
  customParam?: string;
  numericParam?: number;
}

export class MyScript extends BaseScript {
  private customParam: string;
  private numericParam: number;

  constructor(options: MyScriptOptions = {}) {
    super(options);
    
    this.customParam = options.customParam || "default";
    this.numericParam = options.numericParam || 1;
    
    // Validation
    this.validateParameters();
  }

  private validateParameters(): void {
    if (this.numericParam < 1) {
      throw new Error("numericParam must be >= 1");
    }
  }

  protected getScriptName(): string {
    return "My Custom Script";
  }

  protected async customPreExecutionChecks(): Promise<void> {
    this.logScriptInfo("Custom parameter", this.customParam);
    this.logScriptInfo("Numeric parameter", this.numericParam.toString());
    
    // Add validation logic here
    this.logScriptSuccess("Pre-execution checks passed");
  }

  protected async executeMain(): Promise<ScriptResult> {
    this.logScriptInfo("Executing main logic", "🚀");

    try {
      // Your main logic here
      const result = await this.performMainOperation();
      
      return {
        success: true,
        data: { result }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async performMainOperation(): Promise<any> {
    // Implement your business logic
    return "operation completed";
  }

  protected async customPostExecutionVerification(): Promise<void> {
    // Add post-execution verification
    this.logScriptSuccess("Post-execution verification completed");
  }

  protected async finalize(result: ScriptResult): Promise<void> {
    if (result.success) {
      this.logScriptSuccess("Script completed successfully!");
    } else {
      this.logScriptError(`Script failed: ${result.error}`);
    }
  }
}
```

### Step 2: Add Standalone Execution

```typescript
// Standalone execution when run directly
async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const customParam = args.find(arg => arg.startsWith('--custom='))?.split('=')[1];
  const numericParam = args.find(arg => arg.startsWith('--numeric='))?.split('=')[1];
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');

  const options: MyScriptOptions = {
    customParam,
    numericParam: numericParam ? parseInt(numericParam) : undefined,
    dryRun,
    verbose: verbose || process.env.VERBOSE_LOGGING === "true"
  };

  const script = new MyScript(options);
  const result = await script.execute();
  
  process.exit(result.success ? 0 : 1);
}

// Execute if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("💥 Script failed:", error);
    process.exit(1);
  });
}
```

### Step 3: Add Tests

```typescript
import { expect } from "chai";
import { MyScript } from "../../../scripts/core/custom/MyScript";

describe("MyScript", function () {
  it("should execute successfully with default parameters", async function () {
    const script = new MyScript({ dryRun: true });
    const result = await script.execute();
    
    expect(result.success).to.be.true;
  });

  it("should validate parameters correctly", async function () {
    expect(() => {
      new MyScript({ numericParam: 0 });
    }).to.throw("numericParam must be >= 1");
  });

  it("should handle custom parameters", async function () {
    const script = new MyScript({
      customParam: "test",
      numericParam: 5,
      dryRun: true
    });
    
    const result = await script.execute();
    expect(result.success).to.be.true;
  });
});
```

## 🔄 Common Patterns

### Pattern 1: Transaction Execution

```typescript
protected async executeMain(): Promise<ScriptResult> {
  const transaction = this.contracts.liquidityManager.deposit({
    value: this.depositAmount,
    gasLimit: this.options.gasLimit
  });

  return await this.executeTransaction(
    transaction,
    `Deposit ${this.formatETH(this.depositAmount)} ETH`
  );
}
```

### Pattern 2: Batch Processing

```typescript
private async processBatch(items: any[]): Promise<ScriptResult[]> {
  const results: ScriptResult[] = [];
  
  const promises = items.map(async (item, index) => {
    try {
      return await this.processItem(item, index);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  const batchResults = await Promise.allSettled(promises);
  
  for (const result of batchResults) {
    if (result.status === 'fulfilled') {
      results.push(result.value);
    } else {
      results.push({ success: false, error: result.reason });
    }
  }
  
  return results;
}
```

### Pattern 3: Retry Logic

```typescript
private async executeWithRetries<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      this.logScriptInfo(`Attempt ${attempt}/${maxRetries}`, "🎯");
      return await operation();
    } catch (error: any) {
      lastError = error;
      this.logScriptError(`Attempt ${attempt} failed: ${error.message}`);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw lastError || new Error("All retry attempts failed");
}
```

### Pattern 4: Conditional Execution

```typescript
private async checkExecutionConditions(): Promise<{ canExecute: boolean; reason?: string }> {
  // Check system status
  try {
    const systemHealthy = await this.isSystemHealthy();
    if (!systemHealthy) {
      return { canExecute: false, reason: "System is not healthy" };
    }
  } catch (error) {
    return { canExecute: false, reason: "Cannot verify system health" };
  }
  
  // Check user conditions
  const userBalance = await this.contracts.proxyGeneral.balanceOf(this.signer.address);
  if (userBalance < this.minBalance) {
    return { canExecute: false, reason: "Insufficient balance" };
  }
  
  return { canExecute: true };
}
```

### Pattern 5: Data Collection and Analysis

```typescript
private async collectSystemData(): Promise<SystemData> {
  const data: SystemData = {
    timestamp: Math.floor(Date.now() / 1000),
    metrics: {}
  };
  
  // Parallel data collection
  const [poolValue, userBalance, systemHealth] = await Promise.allSettled([
    this.contracts.valueCalculator.getTotalPoolValueView(),
    this.contracts.proxyGeneral.balanceOf(this.signer.address),
    this.checkSystemHealth()
  ]);
  
  // Process results with error handling
  data.metrics.poolValue = poolValue.status === 'fulfilled' 
    ? poolValue.value.toString() 
    : "unavailable";
    
  data.metrics.userBalance = userBalance.status === 'fulfilled'
    ? userBalance.value.toString()
    : "unavailable";
    
  data.metrics.systemHealthy = systemHealth.status === 'fulfilled'
    ? systemHealth.value
    : false;
  
  return data;
}
```

## 🧪 Testing Guidelines

### Unit Testing

```typescript
import { expect } from "chai";
import { ethers } from "hardhat";
import sinon from "sinon";

describe("MyScript Unit Tests", function () {
  let script: MyScript;
  let mockContracts: any;

  beforeEach(function () {
    mockContracts = {
      liquidityManager: {
        deposit: sinon.stub(),
        withdraw: sinon.stub()
      },
      valueCalculator: {
        getTotalPoolValueView: sinon.stub()
      }
    };

    script = new MyScript({ dryRun: true });
    // Inject mocks
    (script as any).contracts = mockContracts;
  });

  it("should handle successful operations", async function () {
    mockContracts.liquidityManager.deposit.resolves({ hash: "0x123" });
    
    const result = await script.execute();
    expect(result.success).to.be.true;
  });

  it("should handle transaction failures", async function () {
    mockContracts.liquidityManager.deposit.rejects(new Error("Transaction failed"));
    
    const result = await script.execute();
    expect(result.success).to.be.false;
    expect(result.error).to.include("Transaction failed");
  });
});
```

### Integration Testing

```typescript
describe("MyScript Integration Tests", function () {
  let script: MyScript;
  
  before(async function () {
    // Deploy contracts or connect to testnet
    await setupTestEnvironment();
  });

  it("should execute end-to-end successfully", async function () {
    script = new MyScript({
      customParam: "integration-test",
      numericParam: 1
    });

    const result = await script.execute();
    expect(result.success).to.be.true;
    expect(result.transactionHash).to.exist;
  });

  it("should handle network errors gracefully", async function () {
    // Test with invalid network configuration
    script = new MyScript({ 
      customParam: "network-error-test",
      // Configure invalid network settings
    });

    const result = await script.execute();
    // Should fail gracefully with meaningful error
    expect(result.success).to.be.false;
    expect(result.error).to.include("network");
  });
});
```

## 🔍 Debugging Techniques

### Logging Best Practices

```typescript
// Use structured logging with context
this.logScriptInfo("Processing batch", `${index + 1}/${total}`);
this.logScriptInfo("  Amount", `${this.formatETH(amount)} ETH`);
this.logScriptInfo("  Gas limit", gasLimit.toString());

// Use appropriate log levels
this.logScriptError("Critical error occurred", error.message);
this.logScriptInfo("Info level message", additionalContext);
this.logScriptSuccess("Operation completed successfully");

// Use emojis for visual clarity
this.logScriptInfo("Starting batch processing", "🚀");
this.logScriptInfo("Validation checks", "✅");
this.logScriptError("Transaction failed", "❌");
```

### Debug Mode

```typescript
protected async executeMain(): Promise<ScriptResult> {
  if (this.options.verbose) {
    this.logScriptInfo("Debug: Current state", JSON.stringify({
      gasLimit: this.options.gasLimit,
      dryRun: this.options.dryRun,
      customParams: this.getDebugInfo()
    }, null, 2));
  }

  // ... rest of execution
}
```

### Error Handling

```typescript
try {
  const result = await this.riskyOperation();
  return { success: true, data: result };
} catch (error: any) {
  // Log error with context
  this.logScriptError(`Operation failed: ${error.message}`);
  
  if (this.options.verbose) {
    this.logScriptInfo("Error details", JSON.stringify({
      stack: error.stack,
      code: error.code,
      context: this.getErrorContext()
    }, null, 2));
  }
  
  // Return structured error
  return {
    success: false,
    error: error.message,
    data: { errorCode: error.code }
  };
}
```

## 📊 Performance Optimization

### Gas Optimization

```typescript
// Estimate gas before execution
private async estimateGas(transaction: any): Promise<bigint> {
  try {
    const gasEstimate = await transaction.estimateGas();
    const gasWithBuffer = (gasEstimate * 120n) / 100n; // 20% buffer
    return gasWithBuffer;
  } catch (error) {
    this.logScriptInfo("Gas estimation failed, using default", "⚠️");
    return BigInt(this.options.gasLimit || 500000);
  }
}

// Use appropriate gas limits per operation type
private getOptimalGasLimit(operationType: string): number {
  const gasLimits = {
    deposit: 300000,
    withdraw: 400000,
    emergency: 800000,
    batch: 150000 // per item
  };
  
  return gasLimits[operationType] || 500000;
}
```

### Batch Optimization

```typescript
private calculateOptimalBatchSize(itemCount: number, complexity: string): number {
  const baseBatchSize = {
    simple: 10,
    medium: 5,
    complex: 2
  };
  
  const baseSize = baseBatchSize[complexity] || 5;
  
  // Adjust for item count
  if (itemCount < baseSize) {
    return itemCount;
  }
  
  // Consider network congestion
  const networkLoad = this.getNetworkLoad();
  const adjustment = networkLoad > 0.8 ? 0.5 : 1.0;
  
  return Math.max(1, Math.floor(baseSize * adjustment));
}
```

### Memory Management

```typescript
// Process large datasets in chunks
private async processLargeDataset(data: any[]): Promise<ScriptResult[]> {
  const chunkSize = 100;
  const results: ScriptResult[] = [];
  
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    const chunkResults = await this.processChunk(chunk);
    results.push(...chunkResults);
    
    // Cleanup and memory management
    if (i % (chunkSize * 10) === 0) {
      await this.performMemoryCleanup();
    }
  }
  
  return results;
}
```

## 🚀 Deployment & CI/CD

### Testing Pipeline

```yaml
# .github/workflows/test-scripts.yml
name: Test Core Scripts

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Compile contracts
        run: npx hardhat compile
      
      - name: Run unit tests
        run: npm run test:scripts
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          NETWORK: localhost
          VERBOSE_LOGGING: true
```

### Deployment Scripts

```bash
#!/bin/bash
# deploy-scripts.sh

set -e

echo "🚀 Deploying Core Scripts..."

# Validate environment
if [ -z "$NETWORK" ]; then
  echo "❌ NETWORK environment variable not set"
  exit 1
fi

# Compile contracts
echo "📦 Compiling contracts..."
npx hardhat compile

# Run tests
echo "🧪 Running tests..."
npm run test:scripts

# Deploy configuration
echo "⚙️ Updating configuration..."
npm run scripts:configure

# Verify deployment
echo "✅ Verifying deployment..."
npx hardhat run scripts/core/monitoring/SystemStatus.ts --network $NETWORK

echo "🎉 Deployment completed successfully!"
```

## 📚 Advanced Topics

### Custom Validation

```typescript
export abstract class ValidatedScript extends BaseScript {
  protected abstract getValidationRules(): ValidationRule[];
  
  protected async customPreExecutionChecks(): Promise<void> {
    await super.customPreExecutionChecks();
    
    for (const rule of this.getValidationRules()) {
      await this.validateRule(rule);
    }
  }
  
  private async validateRule(rule: ValidationRule): Promise<void> {
    const isValid = await rule.validate(this.contracts, this.signer);
    if (!isValid) {
      throw new Error(`Validation failed: ${rule.message}`);
    }
  }
}
```

### Plugin System

```typescript
export interface ScriptPlugin {
  name: string;
  beforeExecution?(script: BaseScript): Promise<void>;
  afterExecution?(script: BaseScript, result: ScriptResult): Promise<void>;
  onError?(script: BaseScript, error: Error): Promise<void>;
}

export class PluginManager {
  private plugins: ScriptPlugin[] = [];
  
  registerPlugin(plugin: ScriptPlugin): void {
    this.plugins.push(plugin);
  }
  
  async executeHook(hook: keyof ScriptPlugin, ...args: any[]): Promise<void> {
    for (const plugin of this.plugins) {
      const hookFn = plugin[hook] as Function;
      if (hookFn) {
        await hookFn.apply(plugin, args);
      }
    }
  }
}
```

### Metrics Collection

```typescript
export class MetricsCollector {
  private metrics: Map<string, any> = new Map();
  
  record(key: string, value: any): void {
    this.metrics.set(key, value);
  }
  
  increment(key: string): void {
    const current = this.metrics.get(key) || 0;
    this.metrics.set(key, current + 1);
  }
  
  time<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const start = Date.now();
    return operation().finally(() => {
      const duration = Date.now() - start;
      this.record(`${key}_duration_ms`, duration);
    });
  }
  
  export(): Record<string, any> {
    return Object.fromEntries(this.metrics);
  }
}
```

## 🎯 Best Practices Checklist

### Code Quality
- [ ] **Inherit from BaseScript** for consistency
- [ ] **Implement all required abstract methods**
- [ ] **Add comprehensive error handling**
- [ ] **Include parameter validation**
- [ ] **Use structured logging with context**
- [ ] **Add TypeScript interfaces for options**
- [ ] **Include JSDoc comments for public methods**

### Testing
- [ ] **Write unit tests for business logic**
- [ ] **Add integration tests for end-to-end flows**
- [ ] **Test error conditions and edge cases**
- [ ] **Mock external dependencies**
- [ ] **Test with different network conditions**

### Performance
- [ ] **Optimize gas usage**
- [ ] **Implement batch processing where appropriate**
- [ ] **Add retry logic for network operations**
- [ ] **Use appropriate batch sizes**
- [ ] **Handle large datasets efficiently**

### Security
- [ ] **Validate all inputs**
- [ ] **Check system state before operations**
- [ ] **Use dry-run mode for testing**
- [ ] **Implement proper error boundaries**
- [ ] **Log security-relevant events**

### Documentation
- [ ] **Add clear usage examples**
- [ ] **Document all command-line options**
- [ ] **Include troubleshooting information**
- [ ] **Update main README.md**
- [ ] **Add inline code comments**

---

**Developer Guide - Core Scripts**
*Technical documentation for extending and maintaining the script suite*