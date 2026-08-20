# 🎯 Usage Examples - Core Scripts

## 📚 Overview

This guide provides practical, real-world examples of using the Core Scripts suite. Examples are organized by use case and include detailed explanations, expected outputs, and best practices.

## 🚀 Getting Started Examples

### Example 1: First-Time Setup
```bash
# Step 1: Check system is operational
npx hardhat run scripts/core/monitoring/SystemStatus.ts

# Expected output:
# 🔍 CHECKING SYSTEM STATUS
# 📡 BEACON STATUS:
#    📊 Registered Modules: 7
#    ✅ LiquidityManager: 0x...
#    ✅ ValueCalculator: 0x...
#    🏥 System Health: HEALTHY

# Step 2: Check your current portfolio
npx hardhat run scripts/core/monitoring/CheckBalance.ts

# Expected output:
# 💰 Portfolio Check Configuration
# 💳 ETH balance: 10.0 ETH
# 🎫 LP token balance: 0.0 LP
# 📊 Total portfolio value: 10.0 ETH

# Step 3: Make your first deposit
npx hardhat run scripts/core/deposit/DepositETH.ts -- --amount=1.0

# Expected output:
# 🚀 Deposit ETH configuration
# 💰 Deposit amount: 1.0 ETH
# ✅ Deposit ETH pre-checks passed
# 🎯 Executing ETH deposit: 1.0 ETH
# ✅ Transaction confirmed in block: 123
# 💎 New LP Balance: 1.0 LP
```

### Example 2: Portfolio Check After First Deposit
```bash
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=summary

# Expected output:
# 📋 PORTFOLIO SUMMARY:
# 💰 Total Value: 10.0 ETH
# 🎫 LP Tokens: 1.0 LP (1.0 ETH)
# 💎 ETH: 9.0 ETH
# 📊 Pool Share: 0.1000%
# 🏥 Health: good
# 📈 Return: 0.0 ETH (0.00%)
```

## 💰 Deposit Examples

### Example 3: Regular DCA (Dollar Cost Averaging)
```bash
# Daily DCA: Deposit 0.1 ETH every day
npx hardhat run scripts/core/deposit/DepositScheduled.ts -- --amount=0.1 --delay=86400000

# Weekly DCA: Larger amount once per week
npx hardhat run scripts/core/deposit/DepositScheduled.ts -- --amount=0.7 --delay=604800000

# Conditional DCA: Only deposit if pool value is below 100 ETH
npx hardhat run scripts/core/deposit/DepositScheduled.ts -- --amount=0.5 --max-pool-value=100.0
```

### Example 4: Batch Deposits for Testing
```bash
# Small batch for testing (5 deposits of 0.1 ETH each)
npx hardhat run scripts/core/deposit/DepositBatch.ts -- --amount=0.1 --count=5 --batch-size=2

# Expected output:
# 🚀 Batch deposit configuration
# 📊 Total deposits: 5
# 💰 Amount per deposit: 0.1 ETH
# 📦 Batch size: 2
# ⚡ Executing batch 1/3 (2 deposits)
# ✅ Batch 1 completed: 2/2 successful
# ⚡ Executing batch 2/3 (2 deposits)  
# ✅ Batch 2 completed: 2/2 successful
# ⚡ Executing batch 3/3 (1 deposits)
# ✅ Batch 3 completed: 1/1 successful
# 🎉 Batch processing completed!
# 📊 Total successful: 5/5 deposits
# 💰 Total deposited: 0.5 ETH
```

### Example 5: Large Stress Test Deposit
```bash
# Stress test: 20 small deposits with delays
npx hardhat run scripts/core/deposit/DepositBatch.ts -- --amount=0.01 --count=20 --batch-size=5 --delay=2000 --verbose

# Performance optimization: Larger batch size for faster execution
npx hardhat run scripts/core/deposit/DepositBatch.ts -- --amount=0.05 --count=10 --batch-size=10
```

## 💳 Withdrawal Examples

### Example 6: Simple Percentage Withdrawal
```bash
# Withdraw 25% of LP tokens
npx hardhat run scripts/core/withdraw/WithdrawETH.ts -- --percentage=25

# Expected output:
# 💳 Withdraw ETH configuration
# 🎯 Current LP Balance: 5.0 LP
# 📊 Withdrawal method: 25% of LP balance
# 💰 Withdraw Amount: 1.25 LP
# ✅ Expected ETH return: 1.25 ETH
# 💰 Withdrawal fee: 0.00625 ETH (50bp)
# 💎 Net ETH (after fees): 1.24375 ETH
# ✅ Withdraw ETH pre-checks passed
# 🎯 Executing ETH withdrawal: 1.25 LP
# ✅ Transaction confirmed in block: 456
# 💰 ETH Received: 1.24375 ETH
```

### Example 7: Strategic Partial Withdrawals

#### Profit Taking Strategy
```bash
# Take profits when LP tokens are 15% profitable
npx hardhat run scripts/core/withdraw/WithdrawPartial.ts -- --strategy=profit-taking --profit-threshold=15

# Expected output:
# 🎯 Partial withdrawal configuration: profit-taking
# 💎 Current LP Price: 1.15 ETH per LP
# 📈 Profit %: 15%
# ✅ Profit threshold met: 15% >= 15%
# 💰 Profit-based withdrawal: 7% of LP balance
# ✅ Partial withdrawal strategy 'profit-taking' completed!
```

#### Preserve Liquidity Strategy
```bash
# Withdraw excess but maintain minimum 50 ETH pool value
npx hardhat run scripts/core/withdraw/WithdrawPartial.ts -- --strategy=preserve-liquidity --target-value=50.0

# Expected output:
# 🎯 Partial withdrawal configuration: preserve-liquidity
# 🌊 Current Pool Value: 75.0 ETH
# 🎯 Target preservation: 50.0 ETH
# 💰 Excess pool value: 25.0 ETH
# 📊 Calculated withdrawal: 2.5 LP
# 🔒 Preserving: 20% of user liquidity
# ✅ Final withdrawal amount: 2.0 LP
```

#### DCA Out Strategy
```bash
# Dollar-cost average out: 5 withdrawals over 2.5 minutes
npx hardhat run scripts/core/withdraw/WithdrawPartial.ts -- --strategy=dca-out --dca-intervals=5 --dca-delay=30000

# Expected output:
# 🎯 Partial withdrawal configuration: dca-out
# 📅 DCA Configuration:
#   Intervals: 5
#   Amount per interval: 1.0 LP
#   Delay between intervals: 30000ms
#   Total execution time: ~120s
# 📅 DCA Interval 1/5
# ✅ Interval 1 completed: 1.0 LP → 0.995 ETH
# 📅 DCA Delay: Waiting 30000ms...
# 📅 DCA Interval 2/5
# ✅ Interval 2 completed: 1.0 LP → 0.997 ETH
# [... continues for all intervals ...]
# 📊 DCA Summary:
#   Successful intervals: 5/5
#   Total ETH received: 4.975 ETH
#   Total LP withdrawn: 5.0 LP
```

### Example 8: Emergency Scenarios

#### System Pause Emergency
```bash
# System is paused, need to withdraw funds
npx hardhat run scripts/core/withdraw/WithdrawEmergency.ts -- --type=system-pause

# Expected output:
# 🚨 Emergency withdrawal configuration: system-pause
# 🚨 System pause check: Verifying pause state
# ✅ System pause executed - emergency withdrawal justified
# 💳 Attempting regular withdrawal: Despite system pause
# ⚠️ Regular withdrawal failed: Trying emergency methods
# 🚨 Executing emergency withdrawal
# ✅ Emergency withdrawal 'system-pause' completed!
```

#### Complete Fund Evacuation
```bash
# Emergency: evacuate all funds including tokens
npx hardhat run scripts/core/withdraw/WithdrawEmergency.ts -- --type=forced-recovery --evacuate-all --include-tokens

# Expected output:
# 🚨 Emergency withdrawal configuration: forced-recovery
# ⚠️ Last resort: Forced recovery procedures activated
# 💰 LP recovery: Attempting to recover 10.0 LP
# ✅ LP recovery successful: 9.95 ETH recovered
# 🪙 Token recovery: Attempting to recover ERC20 tokens
# ✅ Token recovery completed
# 📊 Recovery summary: 2/2 operations successful
```

## 📊 Monitoring Examples

### Example 9: Daily Portfolio Tracking
```bash
# Quick daily check
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=summary

# Detailed analysis with export
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=json --export=portfolio_$(date +%Y%m%d).json

# Compare to pure ETH holding performance
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --compare-eth --projections
```

### Example 10: System Health Monitoring
```bash
# Quick system status
npx hardhat run scripts/core/monitoring/SystemStatus.ts --simple

# Comprehensive status with export
npx hardhat run scripts/core/monitoring/SystemStatus.ts -- --format=json --export=system_status_$(date +%Y%m%d_%H%M).json

# CSV format for spreadsheet analysis
npx hardhat run scripts/core/monitoring/SystemStatus.ts -- --format=csv --export=daily_metrics.csv
```

### Example 11: Automated Monitoring Setup
```bash
# Create monitoring directory
mkdir -p logs/monitoring

# Daily comprehensive report (add to crontab)
# 0 9 * * * cd /path/to/project && npx hardhat run scripts/core/monitoring/SystemStatus.ts --export=logs/monitoring/daily_$(date +\%Y\%m\%d).json

# Portfolio tracking every 6 hours (add to crontab)
# 0 */6 * * * cd /path/to/project && npx hardhat run scripts/core/monitoring/CheckBalance.ts --format=json --export=logs/monitoring/portfolio_$(date +\%Y\%m\%d_\%H).json

# Manual execution for testing
npx hardhat run scripts/core/monitoring/SystemStatus.ts --export=logs/monitoring/test_$(date +%Y%m%d_%H%M%S).json
```

## 🎯 Advanced Use Cases

### Example 12: Yield Farming Strategy
```bash
# Step 1: Monitor for optimal entry point
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --projections

# Step 2: Large initial deposit when conditions are good
npx hardhat run scripts/core/deposit/DepositETH.ts -- --amount=5.0

# Step 3: Set up regular DCA deposits
npx hardhat run scripts/core/deposit/DepositScheduled.ts -- --amount=0.2 --delay=86400000

# Step 4: Automated profit taking at 20% gains
npx hardhat run scripts/core/withdraw/WithdrawPartial.ts -- --strategy=profit-taking --profit-threshold=20

# Step 5: Regular monitoring and rebalancing
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=table
```

### Example 13: Risk Management Strategy
```bash
# Step 1: Check current risk exposure
npx hardhat run scripts/core/monitoring/CheckBalance.ts

# Step 2: If LP allocation > 80%, reduce exposure
npx hardhat run scripts/core/withdraw/WithdrawPartial.ts -- --strategy=percentage --percentage=30

# Step 3: Set up stop-loss at 10% drawdown
# (Would require custom script, but can simulate with monitoring)
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --export=risk_check.json

# Step 4: Emergency evacuation if needed
npx hardhat run scripts/core/withdraw/WithdrawEmergency.ts -- --type=forced-recovery --dry-run
```

### Example 14: Portfolio Rebalancing
```bash
# Monthly rebalancing routine

# Step 1: Analyze current allocation
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=table

# Step 2: If ETH allocation < 20%, withdraw some LP
npx hardhat run scripts/core/withdraw/WithdrawPartial.ts -- --strategy=percentage --percentage=25

# Step 3: If ETH allocation > 80%, deposit more
npx hardhat run scripts/core/deposit/DepositETH.ts -- --amount=2.0

# Step 4: Verify new allocation
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=summary
```

## 🧪 Testing and Development Examples

### Example 15: Script Testing Workflow
```bash
# Step 1: Test with dry run
npx hardhat run scripts/core/deposit/DepositETH.ts -- --amount=1.0 --dry-run --verbose

# Step 2: Test with minimal amounts
npx hardhat run scripts/core/deposit/DepositETH.ts -- --amount=0.001

# Step 3: Verify state changes
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=summary

# Step 4: Test withdrawal
npx hardhat run scripts/core/withdraw/WithdrawETH.ts -- --percentage=100 --dry-run

# Step 5: Full cycle test
npx hardhat run scripts/core/withdraw/WithdrawETH.ts -- --percentage=100
npx hardhat run scripts/core/monitoring/CheckBalance.ts
```

### Example 16: Performance Testing
```bash
# Single operation timing
time npx hardhat run scripts/core/deposit/DepositETH.ts -- --amount=1.0

# Batch operation performance
time npx hardhat run scripts/core/deposit/DepositBatch.ts -- --amount=0.1 --count=10 --batch-size=5

# System status performance
time npx hardhat run scripts/core/monitoring/SystemStatus.ts

# Memory usage monitoring
NODE_OPTIONS="--max-old-space-size=4096" npx hardhat run scripts/core/deposit/DepositBatch.ts -- --amount=0.01 --count=100
```

### Example 17: Integration Testing
```bash
# Full system integration test
#!/bin/bash
echo "🧪 Starting integration test..."

# Initial state
echo "📊 Initial state:"
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=summary

# Deposit phase
echo "💰 Deposit phase:"
npx hardhat run scripts/core/deposit/DepositETH.ts -- --amount=2.0
npx hardhat run scripts/core/deposit/DepositBatch.ts -- --amount=0.5 --count=4

# Monitoring phase
echo "📊 Monitoring phase:"
npx hardhat run scripts/core/monitoring/SystemStatus.ts
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=table

# Withdrawal phase
echo "💳 Withdrawal phase:"
npx hardhat run scripts/core/withdraw/WithdrawPartial.ts -- --strategy=percentage --percentage=50
npx hardhat run scripts/core/withdraw/WithdrawETH.ts -- --percentage=100

# Final state
echo "📊 Final state:"
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=summary

echo "✅ Integration test completed!"
```

## 📱 Real-World Scenarios

### Scenario 1: New User Onboarding
```bash
# Day 1: First interaction
npx hardhat run scripts/core/monitoring/SystemStatus.ts
npx hardhat run scripts/core/monitoring/CheckBalance.ts
npx hardhat run scripts/core/deposit/DepositETH.ts -- --amount=0.1  # Small test

# Day 2: Confidence building
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=summary
npx hardhat run scripts/core/deposit/DepositETH.ts -- --amount=1.0  # Larger deposit

# Week 1: Regular usage
npx hardhat run scripts/core/deposit/DepositScheduled.ts -- --amount=0.5 --delay=86400000  # Daily DCA

# Month 1: Advanced strategies
npx hardhat run scripts/core/withdraw/WithdrawPartial.ts -- --strategy=profit-taking --profit-threshold=10
```

### Scenario 2: Market Volatility Response
```bash
# Market crash detected - defensive actions
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=json --export=crash_portfolio.json
npx hardhat run scripts/core/withdraw/WithdrawPartial.ts -- --strategy=percentage --percentage=50

# Market recovery - re-entry strategy
npx hardhat run scripts/core/deposit/DepositScheduled.ts -- --amount=1.0 --min-pool-value=20.0

# Volatility management - DCA out strategy
npx hardhat run scripts/core/withdraw/WithdrawPartial.ts -- --strategy=dca-out --dca-intervals=10 --dca-delay=3600000
```

### Scenario 3: System Emergency Response
```bash
# Emergency detected
npx hardhat run scripts/core/monitoring/SystemStatus.ts --verbose

# Assessment phase
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --export=emergency_state.json

# Evacuation phase
npx hardhat run scripts/core/withdraw/WithdrawEmergency.ts -- --type=system-pause
npx hardhat run scripts/core/withdraw/WithdrawEmergency.ts -- --type=emergency-withdraw --evacuate-all

# Recovery verification
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=summary
```

## 🎨 Output Formatting Examples

### Example 18: Different Output Formats

#### Console Output (Default)
```bash
npx hardhat run scripts/core/monitoring/CheckBalance.ts

# Output:
# 💰 Portfolio Check Configuration
# 👤 User address: 0x742d35Cc6F9c28c9aF8b8f0d1e8a8e8e8e8e8e8e
# 💳 ETH balance: 5.0 ETH
# 🎫 LP balance: 3.0 LP
# 💎 LP value: 3.15 ETH
# 📊 Pool share: 0.3000%
# 💼 Portfolio Summary:
# 💰 Total value: 8.15 ETH
# 📈 ETH: 61.35%
# 📈 LP Tokens: 38.65%
# 💡 Portfolio insights:
#   Health: good
#   Risk level: medium
#   Diversification: well-diversified
```

#### JSON Output
```bash
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=json

# Output:
# {
#   "timestamp": 1699027200,
#   "user": {
#     "address": "0x742d35Cc6F9c28c9aF8b8f0d1e8a8e8e8e8e8e8e",
#     "ethBalance": {
#       "wei": "5000000000000000000",
#       "formatted": "5.0"
#     },
#     "lpTokens": {
#       "balance": {
#         "wei": "3000000000000000000",
#         "formatted": "3.0"
#       },
#       "value": {
#         "wei": "3150000000000000000",
#         "formatted": "3.15"
#       }
#     }
#   }
# }
```

#### Table Output
```bash
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=table

# Output:
# ┌─────────────────────┬─────────────────────┬─────────────────────┐
# │ Asset Type          │ Balance             │ Value (ETH)         │
# ├─────────────────────┼─────────────────────┼─────────────────────┤
# │ ETH                 │ 5.0 ETH             │ 5.0 ETH             │
# │ LP Tokens           │ 3.0 LP              │ 3.15 ETH            │
# ├─────────────────────┼─────────────────────┼─────────────────────┤
# │ TOTAL               │                     │ 8.15 ETH            │
# └─────────────────────┴─────────────────────┴─────────────────────┘
```

#### Summary Output
```bash
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=summary

# Output:
# 📋 PORTFOLIO SUMMARY:
# 💰 Total Value: 8.15 ETH
# 🎫 LP Tokens: 3.0 LP (3.15 ETH)
# 💎 ETH: 5.0 ETH
# 📊 Pool Share: 0.3000%
# 🏥 Health: good
# 📈 Return: 0.15 ETH (1.88%)
```

## 🔗 Chaining Operations

### Example 19: Operation Pipelines
```bash
# Deposit → Monitor → Profit Take pipeline
npx hardhat run scripts/core/deposit/DepositETH.ts -- --amount=2.0 && \
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=summary && \
npx hardhat run scripts/core/withdraw/WithdrawPartial.ts -- --strategy=profit-taking --profit-threshold=5

# System Check → Batch Deposit → Verification pipeline
npx hardhat run scripts/core/monitoring/SystemStatus.ts --simple && \
npx hardhat run scripts/core/deposit/DepositBatch.ts -- --amount=0.5 --count=4 && \
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=table

# Emergency Check → Evacuation → Verification pipeline
npx hardhat run scripts/core/monitoring/SystemStatus.ts | grep -q "HEALTHY" || \
npx hardhat run scripts/core/withdraw/WithdrawEmergency.ts -- --type=system-pause && \
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=summary
```

### Example 20: Conditional Execution
```bash
# Only deposit if system is healthy
npx hardhat run scripts/core/monitoring/SystemStatus.ts --simple | grep -q "HEALTHY" && \
npx hardhat run scripts/core/deposit/DepositETH.ts -- --amount=1.0 || \
echo "⚠️ System not healthy, skipping deposit"

# Only withdraw if profit > 10%
PROFIT=$(npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=json | jq -r '.performance.totalReturn.percentage // 0')
if (( $(echo "$PROFIT > 10" | bc -l) )); then
  npx hardhat run scripts/core/withdraw/WithdrawPartial.ts -- --strategy=profit-taking --profit-threshold=10
else
  echo "📊 Profit $PROFIT% below threshold, holding position"
fi
```

## 📊 Data Analysis Examples

### Example 21: Portfolio Analytics
```bash
# Export data for analysis
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=json --export=analytics/portfolio_$(date +%Y%m%d).json

# Extract key metrics
jq '.user.totalPortfolio.ethValue.formatted' analytics/portfolio_$(date +%Y%m%d).json
jq '.user.lpTokens.poolShare.percentage' analytics/portfolio_$(date +%Y%m%d).json
jq '.insights.portfolioHealth' analytics/portfolio_$(date +%Y%m%d).json

# Compare with previous day
YESTERDAY=$(date -d "yesterday" +%Y%m%d)
echo "Yesterday: $(jq -r '.user.totalPortfolio.ethValue.formatted' analytics/portfolio_$YESTERDAY.json) ETH"
echo "Today: $(jq -r '.user.totalPortfolio.ethValue.formatted' analytics/portfolio_$(date +%Y%m%d).json) ETH"
```

### Example 22: Performance Tracking
```bash
# Weekly performance analysis
for day in {1..7}; do
  DATE=$(date -d "$day days ago" +%Y%m%d)
  if [ -f "analytics/portfolio_$DATE.json" ]; then
    VALUE=$(jq -r '.user.totalPortfolio.ethValue.formatted' analytics/portfolio_$DATE.json)
    echo "$DATE: $VALUE ETH"
  fi
done

# Calculate weekly return
WEEK_AGO=$(date -d "7 days ago" +%Y%m%d)
if [ -f "analytics/portfolio_$WEEK_AGO.json" ]; then
  OLD_VALUE=$(jq -r '.user.totalPortfolio.ethValue.formatted' analytics/portfolio_$WEEK_AGO.json)
  NEW_VALUE=$(jq -r '.user.totalPortfolio.ethValue.formatted' analytics/portfolio_$(date +%Y%m%d).json)
  RETURN=$(echo "scale=2; ($NEW_VALUE - $OLD_VALUE) / $OLD_VALUE * 100" | bc)
  echo "📈 Weekly return: $RETURN%"
fi
```

## 🎯 Best Practices from Examples

### Safety First
1. **Always test with dry-run first**
2. **Start with small amounts**
3. **Monitor after each operation**
4. **Keep emergency procedures ready**

### Efficiency Tips
1. **Use batch operations for multiple transactions**
2. **Chain related operations with &&**
3. **Export data for analysis and tracking**
4. **Set up automated monitoring**

### Risk Management
1. **Never invest more than you can afford to lose**
2. **Diversify between ETH and LP tokens**
3. **Set up profit-taking strategies**
4. **Have emergency evacuation plans**

### Performance Optimization
1. **Use appropriate batch sizes**
2. **Monitor gas prices and adjust timing**
3. **Use conditional execution for optimal entry/exit**
4. **Track performance metrics regularly**

---

**Usage Examples - Core Scripts**
*Practical examples for effective use of the DeFi script suite*