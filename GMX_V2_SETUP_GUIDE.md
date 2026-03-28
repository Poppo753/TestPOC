# GMX V2 Plugin - Setup & Testing Guide

## 📋 Overview

This guide explains how to setup and test the GMX V2 Plugin for buying/selling GM tokens (GMX V2 liquidity provider tokens) within the modular DeFi ecosystem.

## 🏗️ Architecture

```
User
  ↓
ProxyGeneral (custody)
  ↓
SwapManager (routing)
  ↓
GMXv2Plugin (execution)
  ↓
GMX V2 ExchangeRouter (Arbitrum)
  ↓
Keeper (1-2 min execution)
  ↓
GM Tokens minted/burned
```

## 📦 Files Created

### Contracts
- `contracts/interfaces/IGMXv2ExchangeRouter.sol` - GMX V2 ExchangeRouter interface
- `contracts/interfaces/IGMXv2Reader.sol` - GMX V2 Reader interface for quotes
- `contracts/interfaces/IAsyncSwapPlugin.sol` - Extended interface for payable operations
- `contracts/plugins/GMXv2Plugin.sol` - Full GMX V2 integration (555 lines)

### Scripts
- `scripts/deploy/setupGMXv2Plugin.ts` - Complete setup script
- `scripts/test/testGMXv2Flow.ts` - End-to-end flow test

### Documentation
- `GMX_V2_INTEGRATION_STRATEGY.md` - Architecture and strategy
- `GMX_V2_ECOSYSTEM_INTEGRATION.md` - Integration with TokenManager/ProxyGeneral
- `GMX_V2_SETUP_GUIDE.md` - This file

## ⚙️ Prerequisites

### 1. Environment Setup

Create/update `.env` file with existing contract addresses:

```env
# Existing contracts
BEACON_ADDRESS=0x...
TOKEN_MANAGER_ADDRESS=0x...
CHAINLINK_ADAPTER_ADDRESS=0x...
PROXY_GENERAL_ADDRESS=0x...
SWAP_MANAGER_ADDRESS=0x...

# Will be added after setup
GMX_V2_PLUGIN_ADDRESS=0x...

# Arbitrum RPC
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
PRIVATE_KEY=0x...
```

### 2. Required Tokens

You'll need on Arbitrum:
- **USDC** for initial deposits
- **ETH** for execution fees (~0.002 ETH per operation)

Get testnet tokens:
- Arbitrum Sepolia faucet: https://faucet.quicknode.com/arbitrum/sepolia

### 3. Dependencies

```bash
cd TestSmartContract
npm install
```

## 🚀 Setup Process

### Step 1: Compile Contracts

```bash
npx hardhat compile
```

Expected output:
```
✅ Compiled 50 Solidity files successfully
✅ Generated 48 typings
⚠️  6 warnings (unused parameters in placeholders - acceptable)
```

### Step 2: Deploy & Configure Plugin

```bash
npx hardhat run scripts/deploy/setupGMXv2Plugin.ts --network arbitrum
```

This script performs 7 operations:

1. **Deploy GMXv2Plugin**
   - Connects to GMX V2 contracts on Arbitrum
   - Configures ProxyGeneral custody
   - Sets up WETH wrapper

2. **Register GM Tokens in TokenManager**
   - Adds Chainlink price feeds to ChainlinkAdapter
   - Registers 5 GM tokens (ETH, BTC, ARB, SOL, LINK)
   - Validates oracle support

3. **Configure Markets in Plugin**
   - Adds market configurations for each GM token
   - Sets up index/long/short token relationships

4. **Authorize Plugin in ProxyGeneral**
   - Grants plugin permission to transfer tokens
   - Sets rate limits if configured

5. **Register Plugin in Beacon**
   - Maps "GMX-V2" identifier to plugin address
   - Enables SwapManager routing

6. **Verify Setup**
   - Checks all authorizations
   - Validates market configurations
   - Confirms token registrations

7. **Display Summary**
   - Shows all addresses
   - Lists registered tokens
   - Provides next steps

### Step 3: Update .env

After setup, add the plugin address to `.env`:

```env
GMX_V2_PLUGIN_ADDRESS=0x... # Copy from setup output
```

### Step 4: Run Flow Test

```bash
npx hardhat run scripts/test/testGMXv2Flow.ts --network arbitrum
```

This test executes a complete buy/sell cycle:

1. **Load Contracts** - Connect to deployed contracts
2. **Check Initial Balances** - Display USDC/GM balances
3. **Approve USDC** - Authorize ProxyGeneral to transfer
4. **Buy GM:ETH/USD** - Execute mint operation
   - Transfers USDC to GMX
   - Pays execution fee
   - Waits for keeper (1-2 min)
5. **Verify GM Balance** - Confirm auto-detection works
6. **Sell GM:ETH/USD** - Execute burn operation
   - Burns GM tokens
   - Receives USDC back
   - Waits for keeper
7. **Final Balances** - Compare before/after
8. **Summary** - Display test results

## 📊 Supported GM Markets

| Market | Token Code | GM Token Address | Chainlink Feed |
|--------|------------|------------------|----------------|
| ETH/USD | `GM-ETH-USD` | `0x70d95587d40A2caf56bd97485aB3Eec10Bee6336` | TBD |
| BTC/USD | `GM-BTC-USD` | `0x47c031236e19d024b42f8AE6780E44A573170703` | TBD |
| ARB/USD | `GM-ARB-USD` | `0xC25cEf6061Cf5dE5eb761b50E4743c1F5D7E5407` | TBD |
| SOL/USD | `GM-SOL-USD` | `0x09400D9DB990D5ed3f35D7be61DfAEB900Af03C9` | TBD |
| LINK/USD | `GM-LINK-USD` | `0x7f1fa204bb700853D36994DA19F830b6Ad18455C` | TBD |

**Note:** Chainlink feeds for GM tokens need to be configured. Currently using fallback oracle prices.

## 🔧 Manual Operations

### Add a New GM Market

```typescript
const gmxPlugin = await ethers.getContractAt("GMXv2Plugin", GMX_PLUGIN_ADDRESS);

await gmxPlugin.addMarket(
    "0x...", // gmToken
    "0x...", // indexToken
    "0x...", // longToken
    "0x..."  // shortToken
);
```

### Check Operation Status

```typescript
const status = await gmxPlugin.checkOperationStatus(depositKey);
console.log("Pending:", status.pending);
console.log("Executed:", status.executed);
console.log("Cancelled:", status.cancelled);
```

### Get Quote Before Swap

```typescript
// For buying (minting GM)
const quote = await gmxPlugin.getInputQuote(
    "USDC",
    "GM-ETH-USD",
    ethers.parseUnits("100", 6) // 100 USDC
);
console.log("Expected GM tokens:", ethers.formatEther(quote));

// For selling (burning GM)
const quote = await gmxPlugin.getInputQuote(
    "GM-ETH-USD",
    "USDC",
    ethers.parseEther("1") // 1 GM token
);
console.log("Expected USDC:", ethers.formatUnits(quote, 6));
```

## ⚠️ Important Notes

### Execution Fees
- **Required:** ~0.001-0.003 ETH per operation
- **Purpose:** Pay GMX keepers for async execution
- **Refund:** Unused portion returned to user

### Keeper Delays
- **Expected:** 1-2 minutes per operation
- **Maximum:** ~5 minutes during high congestion
- **Monitoring:** Check GMX UI for pending operations

### Price Impact
- **Large orders:** May have significant price impact
- **Slippage:** Use `minAmountOut` to protect against slippage
- **Quotes:** Get quote from Reader before executing

### Token Registration
- **Mandatory:** GM tokens MUST be registered in TokenManager first
- **Oracle:** Chainlink price feeds required for auto-detection
- **Validation:** System checks `isTokenActive()` before swaps

## 🐛 Troubleshooting

### "Token not registered"
```bash
# Check if token is in TokenManager
const isActive = await tokenManager.isTokenActive("GM-ETH-USD");

# If false, register manually
await tokenManager.manageTokenData(
    "GM-ETH-USD",
    "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336",
    18,
    3600
);
```

### "Plugin not authorized"
```bash
# Check authorization
const isAuth = await proxyGeneral.authorizedModules(gmxPluginAddress);

# If false, authorize
await proxyGeneral.authorizeModule(gmxPluginAddress, "GMX-V2-SwapPlugin");
```

### "Execution fee too low"
```bash
# Check required fee
const fee = await gmxPlugin.getExecutionFee();
console.log("Required fee:", ethers.formatEther(fee));

# Use higher fee in transaction
await swapManager.executeSwap(
    "USDC",
    "GM-ETH-USD",
    amount,
    0,
    { value: fee }
);
```

### "Operation pending too long"
```bash
# Check status on GMX UI
https://app.gmx.io/#/earn

# Or check contract directly
const pendingDeposits = await gmxPlugin.pendingDeposits(userAddress);
console.log("Pending deposits:", pendingDeposits.length);
```

## 🔗 Resources

### GMX Documentation
- **V2 Docs:** https://docs.gmx.io/docs/api/contracts-v2
- **Synthetics Trading:** https://docs.gmx.io/docs/trading/v2
- **Contract Addresses:** https://docs.gmx.io/docs/api/contracts-v2#deployed-contracts

### Arbitrum Resources
- **Explorer:** https://arbiscan.io
- **Bridge:** https://bridge.arbitrum.io
- **Faucet (Testnet):** https://faucet.quicknode.com/arbitrum/sepolia

### Code Examples
- **GMX V2 SDK:** https://github.com/gmx-io/gmx-interface
- **Synthetics Reader:** https://github.com/gmx-io/gmx-synthetics

## 📈 Next Steps

After successful setup:

1. **Production Deployment**
   - Deploy to mainnet with proper multisig
   - Set conservative rate limits
   - Configure real Chainlink feeds

2. **Enhanced Features**
   - Implement callback handler for execution tracking
   - Add event listeners for real-time updates
   - Integrate oracle prices into quote functions
   - Support multi-asset deposits (long + short)

3. **Monitoring**
   - Track execution times
   - Monitor slippage vs quotes
   - Alert on failed operations
   - Dashboard for pending operations

4. **Integration**
   - Frontend UI for GM token management
   - Portfolio rebalancing automation
   - Yield optimization strategies
   - Cross-protocol liquidity routing

## ✅ Success Checklist

- [ ] Contracts compiled without errors
- [ ] GMXv2Plugin deployed successfully
- [ ] 5 GM tokens registered in TokenManager
- [ ] Markets configured in plugin
- [ ] Plugin authorized in ProxyGeneral
- [ ] Plugin registered in Beacon
- [ ] Test flow completed (buy + sell)
- [ ] GM balance auto-detected
- [ ] Execution fees working
- [ ] Keeper executed operations

## 🎉 Congratulations!

Your GMX V2 Plugin is now fully operational. You can:
- Buy GM tokens with any supported token (via TokenManager)
- Sell GM tokens back to any token
- Auto-detect GM balances in ProxyGeneral
- Automate withdrawals via LiquidityManager
- Track operations via SwapManager

For questions or issues, refer to:
- `GMX_V2_INTEGRATION_STRATEGY.md` - Technical architecture
- `GMX_V2_ECOSYSTEM_INTEGRATION.md` - System integration
- GMX Discord: https://discord.gg/gmx

Happy building! 🚀
