# 🔧 Troubleshooting Guide - Core Scripts

## 🎯 Overview

This guide provides comprehensive troubleshooting information for common issues encountered when using the Core Scripts suite. It includes diagnostic procedures, common error patterns, and step-by-step resolution guides.

## 🚨 Quick Diagnostics

### Initial Health Check
Run these commands to quickly identify system-wide issues:

```bash
# 1. Check system status
npx hardhat run scripts/core/monitoring/SystemStatus.ts

# 2. Check your portfolio
npx hardhat run scripts/core/monitoring/CheckBalance.ts

# 3. Test with dry-run mode
npx hardhat run scripts/core/deposit/DepositETH.ts -- --amount=0.01 --dry-run --verbose
```

### Environment Verification
```bash
# Verify Node.js version (should be 16+)
node --version

# Verify Hardhat installation
npx hardhat --version

# Check contract compilation
npx hardhat compile

# Verify network connectivity
npx hardhat run scripts/core/monitoring/SystemStatus.ts --verbose
```

## 🔍 Common Error Categories

### 1. Contract Address Errors

#### Error Pattern:
```
Error: Contract not found at address 0x...
TypeError: Cannot read properties of undefined (reading 'getAddress')
ContractRunner does not have a provider or signer
```

#### Root Causes:
- Incorrect contract addresses in `.env`
- Contracts not deployed on current network
- Network mismatch between contracts and script

#### Diagnostic Steps:
```bash
# 1. Verify .env file exists and has correct addresses
cat .env | grep ADDRESS

# 2. Check which network you're using
echo $NETWORK
npx hardhat run scripts/core/monitoring/SystemStatus.ts --verbose

# 3. Verify contract deployment
npx hardhat verify --network localhost 0xYourContractAddress
```

#### Resolution:
```bash
# Option 1: Update .env with correct addresses
cp .env.example .env
# Edit .env with correct contract addresses

# Option 2: Deploy contracts if missing
npx hardhat run scripts/deploy.ts --network localhost

# Option 3: Switch to correct network
export NETWORK=localhost  # or testnet/mainnet
```

---

### 2. Insufficient Balance Errors

#### Error Pattern:
```
Error: Insufficient balance for transaction
Error: sender doesn't have enough funds to send tx
Error: insufficient funds for gas * price + value
```

#### Root Causes:
- Insufficient ETH for gas fees
- Insufficient ETH for deposit amount
- Account not funded on current network

#### Diagnostic Steps:
```bash
# 1. Check your ETH balance
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=summary

# 2. Check required amounts
echo "Deposit amount: 1.0 ETH + ~0.01 ETH gas = 1.01 ETH minimum"

# 3. Verify network and account
npx hardhat run scripts/core/monitoring/SystemStatus.ts -- --no-params --no-health
```

#### Resolution:
```bash
# Option 1: Fund your account (localhost)
npx hardhat run scripts/utils/fundAccount.ts -- --amount=10.0

# Option 2: Use smaller amounts
npx hardhat run scripts/core/deposit/DepositETH.ts -- --amount=0.1

# Option 3: Check gas prices and adjust
npx hardhat run scripts/core/deposit/DepositETH.ts -- --amount=1.0 --gas-limit=300000
```

---

### 3. Transaction Reverted Errors

#### Error Pattern:
```
Error: Transaction reverted with reason "Deposits disabled"
Error: Transaction reverted with reason "Insufficient liquidity"
Error: Transaction reverted without a reason string
VM Exception while processing transaction: reverted
```

#### Root Causes:
- System is paused or disabled
- Contractual restrictions (limits, fees)
- Invalid parameters or state

#### Diagnostic Steps:
```bash
# 1. Check system operational status
npx hardhat run scripts/core/monitoring/SystemStatus.ts

# 2. Check specific error with verbose logging
npx hardhat run scripts/core/deposit/DepositETH.ts -- --amount=1.0 --verbose

# 3. Try with dry-run to see what would happen
npx hardhat run scripts/core/deposit/DepositETH.ts -- --amount=1.0 --dry-run
```

#### Resolution:
```bash
# Option 1: Wait if system is temporarily paused
npx hardhat run scripts/core/monitoring/SystemStatus.ts | grep -i pause

# Option 2: Adjust parameters
npx hardhat run scripts/core/deposit/DepositETH.ts -- --amount=0.5  # Try smaller amount

# Option 3: Emergency withdrawal if needed
npx hardhat run scripts/core/withdraw/WithdrawEmergency.ts -- --type=system-pause
```

---

### 4. Network Connection Issues

#### Error Pattern:
```
Error: Network request failed
Error: timeout of 20000ms exceeded
Error: CONNECTION ERROR: Couldn't connect to node
ECONNRESET, ETIMEDOUT, ENOTFOUND
```

#### Root Causes:
- RPC endpoint down or slow
- Network connectivity issues
- Firewall blocking connections
- Rate limiting

#### Diagnostic Steps:
```bash
# 1. Test basic connectivity
curl -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' http://127.0.0.1:8545

# 2. Check configured RPC URLs
grep -r "RPC\|rpc" scripts/config/

# 3. Test with different network
npx hardhat run scripts/core/monitoring/SystemStatus.ts --network localhost
```

#### Resolution:
```bash
# Option 1: Start local Hardhat node
npx hardhat node

# Option 2: Use alternative RPC endpoint
export RPC_URL=https://eth-mainnet.alchemyapi.io/v2/your-api-key

# Option 3: Increase timeout in hardhat.config.ts
# timeout: 60000  // 60 seconds
```

---

### 5. Gas Estimation and Execution Errors

#### Error Pattern:
```
Error: cannot estimate gas; transaction may fail
Error: gas required exceeds allowance
Error: replacement transaction underpriced
Error: transaction with the same hash was already imported
```

#### Root Causes:
- Complex transaction requiring more gas
- Network congestion affecting gas prices
- Nonce issues or transaction replacement
- Contract state changes between estimation and execution

#### Diagnostic Steps:
```bash
# 1. Check current gas prices
npx hardhat run scripts/utils/checkGasPrices.ts

# 2. Test with higher gas limit
npx hardhat run scripts/core/deposit/DepositETH.ts -- --amount=1.0 --gas-limit=500000

# 3. Check for pending transactions
npx hardhat run scripts/utils/checkPendingTxs.ts
```

#### Resolution:
```bash
# Option 1: Increase gas limit
npx hardhat run scripts/core/deposit/DepositETH.ts -- --amount=1.0 --gas-limit=800000

# Option 2: Wait for network congestion to clear
sleep 60 && npx hardhat run scripts/core/deposit/DepositETH.ts -- --amount=1.0

# Option 3: Cancel/replace stuck transaction
npx hardhat run scripts/utils/cancelTransaction.ts -- --nonce=123
```

---

### 6. Rate Limiting and Withdrawal Restrictions

#### Error Pattern:
```
Error: Withdrawal not allowed (rate limits)
Error: Hourly withdrawal limit exceeded
Error: Withdrawal amount too large
Error: Insufficient LP token balance
```

#### Root Causes:
- Built-in rate limiting protection
- Large withdrawal amounts exceeding limits
- Time-based restrictions
- Insufficient LP token balance

#### Diagnostic Steps:
```bash
# 1. Check current limits and balances
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=table

# 2. Check withdrawal history and limits
npx hardhat run scripts/core/monitoring/SystemStatus.ts -- --include-params

# 3. Try smaller withdrawal amount
npx hardhat run scripts/core/withdraw/WithdrawETH.ts -- --percentage=10 --dry-run
```

#### Resolution:
```bash
# Option 1: Wait for rate limit reset
echo "Rate limits typically reset hourly"
npx hardhat run scripts/core/monitoring/SystemStatus.ts | grep -i limit

# Option 2: Withdraw smaller amounts
npx hardhat run scripts/core/withdraw/WithdrawETH.ts -- --percentage=25

# Option 3: Use partial withdrawal strategies
npx hardhat run scripts/core/withdraw/WithdrawPartial.ts -- --strategy=dca-out --dca-intervals=5
```

---

### 7. TypeScript and Compilation Errors

#### Error Pattern:
```
Error: Cannot find module 'typechain-types'
Property 'xyz' does not exist on type 'Contract'
Type error: Property does not exist
Compilation failed
```

#### Root Causes:
- Missing TypeScript compilation
- Outdated typechain types
- Contract ABI changes
- Import path issues

#### Diagnostic Steps:
```bash
# 1. Check if contracts are compiled
ls -la artifacts/contracts/

# 2. Check typechain types
ls -la typechain-types/

# 3. Verify imports
grep -r "from.*typechain" scripts/
```

#### Resolution:
```bash
# Option 1: Recompile everything
npx hardhat clean
npx hardhat compile

# Option 2: Regenerate TypeChain types
npx hardhat typechain

# Option 3: Update imports
# Update import paths in your scripts to match generated types
```

## 🎯 Step-by-Step Diagnostic Procedures

### Procedure 1: Complete System Diagnosis

```bash
#!/bin/bash
echo "🔍 Starting complete system diagnosis..."

# Step 1: Environment check
echo "📋 Step 1: Environment verification"
node --version
npm --version
npx hardhat --version

# Step 2: Compilation check
echo "📋 Step 2: Contract compilation"
npx hardhat clean
npx hardhat compile

# Step 3: Configuration check
echo "📋 Step 3: Configuration verification"
test -f .env && echo "✅ .env exists" || echo "❌ .env missing"
grep -q "BEACON_ADDRESS" .env && echo "✅ Contract addresses configured" || echo "❌ Contract addresses missing"

# Step 4: Network connectivity
echo "📋 Step 4: Network connectivity"
npx hardhat run scripts/core/monitoring/SystemStatus.ts --verbose

# Step 5: Account verification
echo "📋 Step 5: Account verification"
npx hardhat run scripts/core/monitoring/CheckBalance.ts

echo "🎉 Diagnosis completed!"
```

### Procedure 2: Transaction Failure Diagnosis

```bash
#!/bin/bash
echo "🔍 Diagnosing transaction failure..."

# Get transaction details
SCRIPT_NAME=$1
ARGS=${@:2}

echo "📋 Testing script: $SCRIPT_NAME"
echo "📋 Arguments: $ARGS"

# Step 1: Dry run test
echo "📋 Step 1: Dry run simulation"
npx hardhat run $SCRIPT_NAME $ARGS --dry-run --verbose

# Step 2: System status check
echo "📋 Step 2: System status verification"
npx hardhat run scripts/core/monitoring/SystemStatus.ts

# Step 3: Balance verification
echo "📋 Step 3: Balance verification"
npx hardhat run scripts/core/monitoring/CheckBalance.ts

# Step 4: Minimal test
echo "📋 Step 4: Minimal amount test"
npx hardhat run scripts/core/deposit/DepositETH.ts -- --amount=0.001 --dry-run

echo "🎉 Transaction diagnosis completed!"
```

### Procedure 3: Performance Investigation

```bash
#!/bin/bash
echo "🔍 Investigating performance issues..."

# Step 1: Network latency test
echo "📋 Step 1: Network latency test"
time npx hardhat run scripts/core/monitoring/SystemStatus.ts --simple

# Step 2: Gas price analysis
echo "📋 Step 2: Gas price analysis"
npx hardhat run scripts/utils/analyzeGasPrices.ts

# Step 3: Batch performance test
echo "📋 Step 3: Batch performance test"
time npx hardhat run scripts/core/deposit/DepositBatch.ts -- --amount=0.01 --count=5 --dry-run

# Step 4: Memory usage monitoring
echo "📋 Step 4: Memory usage check"
NODE_OPTIONS="--max-old-space-size=8192" npx hardhat run scripts/core/monitoring/SystemStatus.ts

echo "🎉 Performance investigation completed!"
```

## 🛠️ Advanced Troubleshooting

### Debug Mode Configuration

Create `hardhat.config.debug.ts`:
```typescript
import { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  // ... existing config
  
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      timeout: 60000,
      gas: "auto",
      gasPrice: "auto",
      accounts: "remote"
    }
  },
  
  mocha: {
    timeout: 300000 // 5 minutes for debugging
  }
};

export default config;
```

### Custom Logging Configuration

Create `scripts/utils/debugLogger.ts`:
```typescript
export class DebugLogger {
  private static enabled = process.env.DEBUG_MODE === "true";
  
  static debug(message: string, data?: any): void {
    if (this.enabled) {
      console.log(`🔍 [DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : "");
    }
  }
  
  static trace(message: string): void {
    if (this.enabled) {
      console.trace(`📍 [TRACE] ${message}`);
    }
  }
  
  static timing<T>(label: string, operation: () => Promise<T>): Promise<T> {
    if (this.enabled) {
      console.time(`⏱️ [TIMING] ${label}`);
    }
    
    return operation().finally(() => {
      if (this.enabled) {
        console.timeEnd(`⏱️ [TIMING] ${label}`);
      }
    });
  }
}
```

### Network-Specific Debugging

```bash
# Local network debugging
DEBUG_MODE=true VERBOSE_LOGGING=true npx hardhat run scripts/core/monitoring/SystemStatus.ts --network localhost

# Testnet debugging with increased timeouts
NETWORK=testnet TIMEOUT=60000 npx hardhat run scripts/core/deposit/DepositETH.ts -- --amount=0.01

# Mainnet debugging with extra safety
NETWORK=mainnet DRY_RUN=true npx hardhat run scripts/core/withdraw/WithdrawETH.ts -- --percentage=50
```

## 📊 Error Code Reference

### System Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `SYS001` | Contract not found | Update contract addresses in `.env` |
| `SYS002` | Network mismatch | Switch to correct network |
| `SYS003` | System paused | Wait for unpause or use emergency scripts |
| `SYS004` | Insufficient permissions | Check account roles and permissions |

### Transaction Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `TXN001` | Insufficient balance | Fund account or reduce amount |
| `TXN002` | Gas estimation failed | Increase gas limit or check contract state |
| `TXN003` | Transaction reverted | Check system status and parameters |
| `TXN004` | Nonce too low | Wait for pending transactions or reset nonce |

### Script Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `SCR001` | Invalid parameters | Check command-line arguments |
| `SCR002` | Validation failed | Verify input values and constraints |
| `SCR003` | Operation timeout | Increase timeout or check network |
| `SCR004` | Rate limit exceeded | Wait for reset or use smaller amounts |

## 🔧 Recovery Procedures

### Emergency Fund Recovery

```bash
# 1. Assess situation
npx hardhat run scripts/core/monitoring/SystemStatus.ts

# 2. Try standard withdrawal first
npx hardhat run scripts/core/withdraw/WithdrawETH.ts -- --percentage=100 --dry-run

# 3. If failed, try emergency withdrawal
npx hardhat run scripts/core/withdraw/WithdrawEmergency.ts -- --type=system-pause

# 4. Last resort: forced recovery
npx hardhat run scripts/core/withdraw/WithdrawEmergency.ts -- --type=forced-recovery --evacuate-all --force
```

### System State Reset

```bash
# 1. Stop any running operations
pkill -f "hardhat run"

# 2. Clear pending transactions (if using local network)
npx hardhat node --reset

# 3. Recompile contracts
npx hardhat clean
npx hardhat compile

# 4. Verify system status
npx hardhat run scripts/core/monitoring/SystemStatus.ts
```

### Configuration Recovery

```bash
# 1. Backup current configuration
cp .env .env.backup
cp hardhat.config.ts hardhat.config.ts.backup

# 2. Reset to defaults
cp .env.example .env
git checkout hardhat.config.ts

# 3. Gradually restore custom settings
# Edit .env with correct values
# Test each change incrementally
```

## 📱 Monitoring and Alerts

### Automated Health Checks

Create `scripts/monitoring/healthCheck.sh`:
```bash
#!/bin/bash

# Run health check and capture output
OUTPUT=$(npx hardhat run scripts/core/monitoring/SystemStatus.ts 2>&1)
EXIT_CODE=$?

# Check for critical issues
if [ $EXIT_CODE -ne 0 ]; then
  echo "🚨 CRITICAL: System health check failed"
  echo "$OUTPUT"
  # Send alert (email, webhook, etc.)
  exit 1
fi

# Check for warnings
if echo "$OUTPUT" | grep -q "⚠️"; then
  echo "⚠️ WARNING: System issues detected"
  echo "$OUTPUT" | grep "⚠️"
  # Send warning notification
fi

echo "✅ System health check passed"
```

### Continuous Monitoring

```bash
# Set up cron job for regular monitoring
# Add to crontab: 
# */15 * * * * /path/to/healthCheck.sh >> /var/log/defi-health.log 2>&1

# Monitor portfolio changes
# 0 */6 * * * npx hardhat run scripts/core/monitoring/CheckBalance.ts --export=/var/log/portfolio-$(date +\%Y\%m\%d-\%H).json
```

## 🆘 Getting Help

### Information to Collect

When reporting issues, include:

1. **Environment Information**:
   ```bash
   node --version
   npm --version
   npx hardhat --version
   echo "Network: $NETWORK"
   ```

2. **Error Output**:
   ```bash
   # Run with verbose logging
   npx hardhat run [script] --verbose 2>&1 | tee error.log
   ```

3. **System Status**:
   ```bash
   npx hardhat run scripts/core/monitoring/SystemStatus.ts --format=json > status.json
   ```

4. **Configuration**:
   ```bash
   # Share .env template (without private keys)
   grep -v "PRIVATE_KEY" .env > config-template.txt
   ```

### Self-Help Checklist

Before asking for help:

- [ ] **Read error message carefully** - often contains solution hints
- [ ] **Try with verbose logging** - `--verbose` flag
- [ ] **Test with dry-run mode** - `--dry-run` flag  
- [ ] **Check system status** - `SystemStatus.ts` script
- [ ] **Verify environment** - contract addresses, network, balances
- [ ] **Test with minimal amounts** - use small test amounts first
- [ ] **Check recent changes** - what changed since it last worked?
- [ ] **Try different parameters** - different amounts, strategies, etc.
- [ ] **Review logs** - look for patterns in error messages

### Emergency Contacts

For critical issues:
1. **System down**: Use emergency withdrawal scripts
2. **Funds stuck**: Try forced recovery procedures  
3. **Contract issues**: Check system status and pause state
4. **Network issues**: Switch to alternative RPC endpoints

---

**Troubleshooting Guide - Core Scripts**
*Comprehensive problem resolution for the DeFi script suite*