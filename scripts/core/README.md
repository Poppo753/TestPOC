# 📚 Core Scripts Documentation - Phase 1

## 🎯 Overview

Welcome to the **Core Scripts Suite** - a comprehensive collection of production-ready interaction scripts for the DeFi platform. This documentation covers all Phase 1 core functionality including deposits, withdrawals, and monitoring capabilities.

## 🏗️ Architecture

### BaseScript Framework
All scripts inherit from the `BaseScript` class, providing:
- **Standardized interfaces** (ScriptConfig, ScriptResult, ScriptOptions)
- **Consistent logging** with different verbosity levels
- **Error handling** with retry mechanisms
- **Configuration management** across multiple networks
- **Transaction execution** with gas optimization
- **Pre/post execution checks** for safety

### Configuration System
- **Multi-network support**: localhost, testnet, mainnet
- **Centralized contract addresses** via environment variables
- **Flexible parameter management** via config files
- **Network-specific optimizations** (gas limits, confirmations)

## 📂 Directory Structure

```
scripts/core/
├── deposit/           # Deposit operations
│   ├── DepositETH.ts         # Single ETH deposits
│   ├── DepositBatch.ts       # Batch deposit processing
│   └── DepositScheduled.ts   # Scheduled/conditional deposits
├── withdraw/          # Withdrawal operations
│   ├── WithdrawETH.ts        # Single ETH withdrawals
│   ├── WithdrawPartial.ts    # Strategic partial withdrawals
│   └── WithdrawEmergency.ts  # Emergency fund evacuation
└── monitoring/        # System monitoring
    ├── SystemStatus.ts       # Complete system health check
    └── CheckBalance.ts       # Portfolio analysis & insights
```

## 🚀 Quick Start

### Prerequisites
```bash
npm install
npx hardhat compile
```

### Environment Setup
Create `.env` file with contract addresses:
```env
BEACON_ADDRESS=0x...
LIQUIDITY_MANAGER_ADDRESS=0x...
VALUE_CALCULATOR_ADDRESS=0x...
# ... other contract addresses
```

### Basic Usage
```bash
# Check system status
npx hardhat run scripts/core/monitoring/SystemStatus.ts

# Check your portfolio
npx hardhat run scripts/core/monitoring/CheckBalance.ts

# Deposit ETH
npx hardhat run scripts/core/deposit/DepositETH.ts

# Withdraw 50% of LP tokens
npx hardhat run scripts/core/withdraw/WithdrawETH.ts -- --percentage=50
```

## 📋 Script Reference

### 💰 Deposit Scripts

#### DepositETH.ts
**Purpose**: Single ETH deposit operations with validation and monitoring.

**Key Features**:
- Amount validation and limits checking
- Pre-deposit system health verification
- Post-deposit LP token calculation
- Gas optimization for single transactions

**Usage Examples**:
```bash
# Deposit 1 ETH (default)
npx hardhat run scripts/core/deposit/DepositETH.ts

# Deposit custom amount
npx hardhat run scripts/core/deposit/DepositETH.ts -- --amount=2.5

# Dry run (simulation)
npx hardhat run scripts/core/deposit/DepositETH.ts -- --amount=1.0 --dry-run

# Verbose logging
npx hardhat run scripts/core/deposit/DepositETH.ts -- --amount=1.0 --verbose
```

**Options**:
- `--amount=X.X`: Deposit amount in ETH
- `--dry-run`: Simulate without executing
- `--verbose`: Enable detailed logging
- `--gas-limit=XXXXX`: Custom gas limit

---

#### DepositBatch.ts
**Purpose**: Process multiple deposits efficiently with concurrent execution.

**Key Features**:
- **Batch processing** with configurable batch sizes
- **Concurrent execution** using Promise.allSettled()
- **Progress tracking** with real-time updates
- **Error resilience** with per-batch retry logic
- **Performance metrics** and execution timing

**Usage Examples**:
```bash
# Batch deposit with 5 transactions of 1 ETH each
npx hardhat run scripts/core/deposit/DepositBatch.ts -- --amount=1.0 --count=5

# Custom batch size for better performance
npx hardhat run scripts/core/deposit/DepositBatch.ts -- --amount=0.5 --count=10 --batch-size=3

# Stress testing with delays
npx hardhat run scripts/core/deposit/DepositBatch.ts -- --amount=0.1 --count=20 --delay=1000
```

**Options**:
- `--amount=X.X`: Amount per deposit in ETH
- `--count=N`: Number of deposits to process
- `--batch-size=N`: Deposits per concurrent batch (default: 5)
- `--delay=MS`: Delay between batches in milliseconds
- `--max-retries=N`: Maximum retries per failed deposit

---

#### DepositScheduled.ts
**Purpose**: Time-based and conditional deposit execution with advanced scheduling.

**Key Features**:
- **Timing constraints** with target timestamps
- **Conditional execution** based on pool metrics
- **Retry mechanisms** with intelligent backoff
- **Multiple trigger conditions** (time, pool value, user balance)

**Usage Examples**:
```bash
# Deposit after 30 seconds delay
npx hardhat run scripts/core/deposit/DepositScheduled.ts -- --amount=1.0 --delay=30000

# Deposit at specific timestamp
npx hardhat run scripts/core/deposit/DepositScheduled.ts -- --amount=1.0 --target=1699027200

# Conditional deposit (only if pool value >= 10 ETH)
npx hardhat run scripts/core/deposit/DepositScheduled.ts -- --amount=1.0 --min-pool-value=10.0

# Complex conditions with retries
npx hardhat run scripts/core/deposit/DepositScheduled.ts -- --amount=1.0 --min-pool-value=5.0 --max-retries=5
```

**Options**:
- `--delay=MS`: Delay before execution in milliseconds
- `--target=TIMESTAMP`: Execute at specific Unix timestamp
- `--min-pool-value=X.X`: Execute only if pool value >= X ETH
- `--max-pool-value=X.X`: Execute only if pool value <= X ETH
- `--min-user-balance=X.X`: Execute only if user balance >= X ETH
- `--max-retries=N`: Maximum retry attempts

### 💳 Withdrawal Scripts

#### WithdrawETH.ts
**Purpose**: Standard ETH withdrawal operations with flexible amount options.

**Key Features**:
- **Dual modes**: Fixed amount or percentage-based
- **Fee calculation** and slippage protection
- **Rate limiting compliance** checking
- **Post-withdrawal verification** and portfolio updates

**Usage Examples**:
```bash
# Withdraw 50% of LP tokens
npx hardhat run scripts/core/withdraw/WithdrawETH.ts -- --percentage=50

# Withdraw specific LP amount
npx hardhat run scripts/core/withdraw/WithdrawETH.ts -- --amount=2.5

# Withdraw with fee analysis
npx hardhat run scripts/core/withdraw/WithdrawETH.ts -- --percentage=25 --include-fees

# Skip fee calculations
npx hardhat run scripts/core/withdraw/WithdrawETH.ts -- --amount=1.0 --no-fees
```

**Options**:
- `--amount=X.X`: Withdraw specific LP token amount
- `--percentage=N`: Withdraw N% of total LP balance (1-100)
- `--include-fees` / `--no-fees`: Include/exclude fee calculations
- `--max-slippage=N`: Maximum acceptable slippage in basis points

---

#### WithdrawPartial.ts
**Purpose**: Advanced withdrawal strategies for sophisticated portfolio management.

**Key Features**:
- **5 Strategic modes**:
  - `percentage`: Simple percentage withdrawal
  - `target-amount`: Specific amount targeting
  - `preserve-liquidity`: Maintain minimum pool levels
  - `profit-taking`: Withdraw based on profit thresholds
  - `dca-out`: Dollar-cost averaging exit strategy
- **Concurrent processing** for DCA strategy
- **Performance tracking** across all strategies

**Usage Examples**:
```bash
# Percentage strategy (25% withdrawal)
npx hardhat run scripts/core/withdraw/WithdrawPartial.ts -- --strategy=percentage --percentage=25

# Target amount strategy
npx hardhat run scripts/core/withdraw/WithdrawPartial.ts -- --strategy=target-amount --amount=3.0

# Preserve liquidity (maintain 20 ETH pool value)
npx hardhat run scripts/core/withdraw/WithdrawPartial.ts -- --strategy=preserve-liquidity --target-value=20.0

# Profit taking (only if >10% profit)
npx hardhat run scripts/core/withdraw/WithdrawPartial.ts -- --strategy=profit-taking --profit-threshold=10

# DCA out strategy (5 intervals over 2.5 minutes)
npx hardhat run scripts/core/withdraw/WithdrawPartial.ts -- --strategy=dca-out --dca-intervals=5 --dca-delay=30000
```

**Strategy Options**:
- `--strategy=TYPE`: Strategy type (percentage, target-amount, preserve-liquidity, profit-taking, dca-out)
- `--percentage=N`: For percentage strategy (1-99)
- `--amount=X.X`: For target-amount strategy (LP tokens)
- `--target-value=X.X`: For preserve-liquidity strategy (ETH)
- `--profit-threshold=N`: For profit-taking strategy (percentage)
- `--dca-intervals=N`: For DCA strategy (number of intervals)
- `--dca-delay=MS`: For DCA strategy (delay between intervals)

---

#### WithdrawEmergency.ts
**Purpose**: Emergency fund evacuation and crisis response procedures.

**Key Features**:
- **4 Emergency types**:
  - `system-pause`: Withdrawals during system pause
  - `emergency-withdraw`: Official emergency procedure
  - `forced-recovery`: Last resort fund evacuation
  - `admin-triggered`: Admin-initiated emergency
- **Multi-retry strategies** with exponential backoff
- **Fund evacuation** capabilities
- **Token recovery** options

**Usage Examples**:
```bash
# System pause emergency withdrawal
npx hardhat run scripts/core/withdraw/WithdrawEmergency.ts -- --type=system-pause

# Official emergency withdrawal
npx hardhat run scripts/core/withdraw/WithdrawEmergency.ts -- --type=emergency-withdraw

# Forced recovery with full evacuation
npx hardhat run scripts/core/withdraw/WithdrawEmergency.ts -- --type=forced-recovery --evacuate-all

# Admin emergency with token recovery
npx hardhat run scripts/core/withdraw/WithdrawEmergency.ts -- --type=admin-triggered --include-tokens

# Force execution despite conditions
npx hardhat run scripts/core/withdraw/WithdrawEmergency.ts -- --type=emergency-withdraw --force
```

**Emergency Options**:
- `--type=TYPE`: Emergency type (system-pause, emergency-withdraw, forced-recovery, admin-triggered)
- `--force`: Force execution even if conditions not met
- `--evacuate-all`: Attempt to evacuate all available funds
- `--include-tokens`: Also attempt ERC20 token recovery
- `--skip-pause-check`: Skip system pause verification
- `--skip-admin-check`: Skip admin permission verification
- `--max-retries=N`: Maximum retry attempts

### 📊 Monitoring Scripts

#### SystemStatus.ts
**Purpose**: Comprehensive system health monitoring and status reporting.

**Key Features**:
- **Complete system analysis**:
  - Beacon module registration and health
  - Liquidity pool composition and metrics
  - User portfolio overview and calculations
  - System parameters and fee structures
  - Emergency status and operational state
- **4 Output formats**: console, JSON, CSV, file export
- **Flexible configuration** with selective data inclusion

**Usage Examples**:
```bash
# Full system status check
npx hardhat run scripts/core/monitoring/SystemStatus.ts

# Simple status without detailed info
npx hardhat run scripts/core/monitoring/SystemStatus.ts -- --simple

# JSON output for integration
npx hardhat run scripts/core/monitoring/SystemStatus.ts -- --format=json

# CSV export for analysis
npx hardhat run scripts/core/monitoring/SystemStatus.ts -- --format=csv --export=status.csv

# Skip specific checks
npx hardhat run scripts/core/monitoring/SystemStatus.ts -- --no-health --no-params --no-user
```

**Configuration Options**:
- `--simple`: Simple mode (less detailed output)
- `--format=TYPE`: Output format (console, json, csv)
- `--export=FILE`: Export results to file
- `--no-health`: Skip health checks
- `--no-params`: Skip parameter checks
- `--no-user`: Skip user-specific information

---

#### CheckBalance.ts
**Purpose**: Advanced portfolio analysis with performance insights and recommendations.

**Key Features**:
- **Complete portfolio management**:
  - ETH + LP token balances with real-time values
  - Pool share calculations and LP token pricing
  - Portfolio distribution analysis
- **Performance analytics**:
  - Total return calculations (absolute & percentage)
  - Daily return tracking and APY estimations
  - Historical performance projections
- **AI-powered insights**:
  - Portfolio health assessment
  - Risk level evaluation
  - Diversification analysis
  - Smart recommendations

**Usage Examples**:
```bash
# Check your portfolio
npx hardhat run scripts/core/monitoring/CheckBalance.ts

# Check specific address
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --address=0x742d35Cc...

# Table format output
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=table

# Summary with performance metrics
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=summary

# Export detailed analysis
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=json --export=portfolio.json

# Compare to ETH holding
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --compare-eth

# Skip performance analysis
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --no-performance --no-breakdown
```

**Analysis Options**:
- `--address=ADDRESS`: Check specific wallet address
- `--format=TYPE`: Output format (console, json, table, summary)
- `--export=FILE`: Export portfolio data to file
- `--compare-eth`: Compare to pure ETH holding performance
- `--no-breakdown`: Skip detailed token breakdown
- `--no-performance`: Skip performance calculations
- `--projections`: Include yield projections (experimental)

## 🔧 Configuration Management

### Environment Variables
```env
# Contract Addresses
BEACON_ADDRESS=0x...
LIQUIDITY_MANAGER_ADDRESS=0x...
VALUE_CALCULATOR_ADDRESS=0x...
TOKEN_MANAGER_ADDRESS=0x...
PARAMETER_MANAGER_ADDRESS=0x...
PROXY_GENERAL_ADDRESS=0x...
SWAP_MANAGER_ADDRESS=0x...
EMERGENCY_HANDLER_ADDRESS=0x...

# Operational Settings
DEFAULT_DEPOSIT_AMOUNT=1.0
DEFAULT_WITHDRAW_PERCENTAGE=50
VERBOSE_LOGGING=false
LOG_LEVEL=info

# Network Configuration
NETWORK=localhost
```

### Configuration Files

#### `scripts/config/config.ts`
Main configuration file with:
- Contract address management
- Network-specific settings
- Operational parameters
- Amount constants

#### `scripts/config/networks.ts`
Network-specific configurations:
- RPC URLs and endpoints
- Gas limits and pricing
- Confirmation requirements
- Chain-specific optimizations

#### `scripts/config/constants.ts`
Business logic constants:
- Time-based constants
- Retry configurations
- Script-specific amounts
- Utility functions

## 🛠️ Advanced Usage Patterns

### Chaining Operations
```bash
# Check status, then deposit, then check portfolio
npx hardhat run scripts/core/monitoring/SystemStatus.ts && \
npx hardhat run scripts/core/deposit/DepositETH.ts -- --amount=1.0 && \
npx hardhat run scripts/core/monitoring/CheckBalance.ts
```

### Batch Operations with Monitoring
```bash
# Large batch deposit with progress monitoring
npx hardhat run scripts/core/deposit/DepositBatch.ts -- --amount=0.5 --count=10 --batch-size=2 --verbose
```

### Emergency Procedures
```bash
# Emergency evacuation sequence
npx hardhat run scripts/core/monitoring/SystemStatus.ts && \
npx hardhat run scripts/core/withdraw/WithdrawEmergency.ts -- --type=emergency-withdraw --evacuate-all
```

### Performance Analysis
```bash
# Complete portfolio analysis with export
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=json --export=portfolio_$(date +%Y%m%d).json --projections
```

## 🎯 Common Use Cases

### 1. **Daily Portfolio Check**
```bash
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=summary
```

### 2. **System Health Monitoring**
```bash
npx hardhat run scripts/core/monitoring/SystemStatus.ts -- --export=daily_status.json
```

### 3. **Regular DCA Deposits**
```bash
npx hardhat run scripts/core/deposit/DepositScheduled.ts -- --amount=0.1 --delay=86400000  # Daily
```

### 4. **Profit Taking Strategy**
```bash
npx hardhat run scripts/core/withdraw/WithdrawPartial.ts -- --strategy=profit-taking --profit-threshold=15
```

### 5. **Emergency Fund Recovery**
```bash
npx hardhat run scripts/core/withdraw/WithdrawEmergency.ts -- --type=forced-recovery --evacuate-all --include-tokens
```

### 6. **Batch Testing Environment**
```bash
npx hardhat run scripts/core/deposit/DepositBatch.ts -- --amount=0.01 --count=50 --batch-size=5 --dry-run
```

## 🔍 Troubleshooting

### Common Issues

#### 1. **Contract Address Errors**
```
Error: Contract not found at address 0x...
```
**Solution**: Check `.env` file for correct contract addresses. Verify contracts are deployed on the current network.

#### 2. **Insufficient Balance**
```
Error: Insufficient balance for transaction
```
**Solution**: Check ETH balance with `CheckBalance.ts`. Ensure sufficient ETH for gas fees and deposit amounts.

#### 3. **Transaction Reverted**
```
Error: Transaction reverted with reason "..."
```
**Solution**: Check system status with `SystemStatus.ts`. Verify deposits/withdrawals are enabled and system is not paused.

#### 4. **Rate Limiting**
```
Error: Withdrawal not allowed (rate limits)
```
**Solution**: Wait for rate limit reset period or use smaller withdrawal amounts.

#### 5. **Network Connection Issues**
```
Error: Network request failed
```
**Solution**: Check RPC URL in `networks.ts`. Verify internet connection and network availability.

### Debug Commands

#### Enable Verbose Logging
```bash
npx hardhat run scripts/core/monitoring/SystemStatus.ts -- --verbose
```

#### Dry Run Mode
```bash
npx hardhat run scripts/core/deposit/DepositETH.ts -- --amount=1.0 --dry-run
```

#### Force Execution
```bash
npx hardhat run scripts/core/withdraw/WithdrawEmergency.ts -- --type=emergency-withdraw --force
```

### Log Analysis

Scripts generate structured logs with different levels:
- `ℹ️` **Info**: General information and progress
- `✅` **Success**: Successful operations and confirmations
- `❌` **Error**: Errors and failures
- `⚠️` **Warning**: Warnings and non-critical issues
- `🔍` **Debug**: Detailed debugging information (verbose mode)

## 📈 Performance Optimization

### Gas Optimization
- Scripts automatically estimate gas limits
- Use `--gas-limit=XXXXX` for custom limits
- Batch operations reduce per-transaction overhead

### Network Optimization
- Configure appropriate confirmation counts per network
- Use local network for testing and development
- Testnet for staging, mainnet for production

### Batch Size Tuning
For `DepositBatch.ts` and similar scripts:
- **Small batches (2-3)**: Better error isolation
- **Medium batches (5-7)**: Balanced performance
- **Large batches (10+)**: Maximum throughput (higher risk)

### Timing Optimization
For `DepositScheduled.ts` and `WithdrawPartial.ts` DCA:
- **Short delays (1-5s)**: Fast execution
- **Medium delays (30-60s)**: Balanced approach
- **Long delays (5+ min)**: Conservative timing

## 🔐 Security Considerations

### Best Practices
1. **Always test on localhost/testnet first**
2. **Use dry-run mode for validation**
3. **Check system status before operations**
4. **Monitor portfolio after transactions**
5. **Keep private keys secure**
6. **Verify contract addresses**

### Emergency Procedures
1. **System pause detection**: Monitor with `SystemStatus.ts`
2. **Emergency evacuation**: Use `WithdrawEmergency.ts`
3. **Fund recovery**: Emergency scripts with `--evacuate-all`
4. **Portfolio backup**: Regular exports with `CheckBalance.ts`

## 📊 Monitoring & Analytics

### Regular Monitoring
Set up automated monitoring with:
```bash
# Daily system health check
0 9 * * * cd /path/to/project && npx hardhat run scripts/core/monitoring/SystemStatus.ts --export=logs/daily_$(date +\%Y\%m\%d).json

# Portfolio tracking
0 12,18 * * * cd /path/to/project && npx hardhat run scripts/core/monitoring/CheckBalance.ts --export=logs/portfolio_$(date +\%Y\%m\%d_\%H).json
```

### Performance Tracking
Export data for analysis:
```bash
# Weekly performance analysis
npx hardhat run scripts/core/monitoring/CheckBalance.ts -- --format=json --export=analytics/weekly_$(date +%Y%U).json --projections
```

## 🚀 Next Steps

### Phase 2 Development
After completing Phase 1, consider:
1. **Admin Scripts**: Parameter management, governance operations
2. **Advanced Strategies**: Yield farming, liquidity mining
3. **Integration Tools**: API endpoints, webhook support
4. **Monitoring Dashboard**: Real-time web interface
5. **Automated Strategies**: Bot-like functionality

### Contributing
To extend the script suite:
1. **Inherit from BaseScript** for consistency
2. **Follow naming conventions** (PascalCase for files)
3. **Include comprehensive documentation**
4. **Add usage examples and test cases**
5. **Update this documentation**

## 📞 Support

For issues, questions, or contributions:
1. Check this documentation first
2. Review troubleshooting section
3. Test with dry-run mode
4. Check logs for detailed error information
5. Verify contract addresses and network configuration

---

**Phase 1 Core Scripts Documentation - Complete**
*Generated on November 3, 2025*