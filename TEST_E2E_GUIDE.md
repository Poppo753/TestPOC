# GMX V2 Plugin - Testing Guide

## 🧪 Overview

This guide explains how to run the comprehensive End-to-End (E2E) test for the GMX V2 Plugin integration.

## 📋 Test Coverage

The E2E test verifies:

1. **Core Ecosystem Setup**
   - Beacon deployment and configuration
   - TokenManager with oracle integration
   - ChainlinkAdapter price feeds
   - ProxyGeneral custody system
   - SwapManager routing
   - ParameterManager configuration

2. **GMX V2 Plugin Integration**
   - Plugin deployment
   - Market configuration (GM:ETH/USD)
   - Authorization in ProxyGeneral
   - Registration in Beacon
   - Active plugin selection

3. **Token Registration**
   - Base tokens (USDC, WETH, WBTC)
   - GM tokens (GM:ETH/USD)
   - Chainlink price feed integration
   - Token validation and activation

4. **Buy Flow (USDC → GM:ETH/USD)**
   - Quote generation
   - USDC approval
   - Swap execution
   - Deposit creation in GMX
   - Transaction verification

5. **Auto-Detection Mechanism**
   - TokenManager active token list
   - Balance detection in ProxyGeneral
   - Oracle price retrieval
   - Token metadata validation

6. **Sell Flow (GM:ETH/USD → USDC)**
   - Reverse quote generation
   - Withdrawal structure
   - Transaction flow validation

## 🚀 Quick Start

### Prerequisites

1. **Node.js** (v18+)
2. **Arbitrum RPC URL** (Alchemy, Infura, or public RPC)
3. **Environment Setup**

Create `.env` file:
```env
# Required for fork testing
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc

# Optional: For better performance use paid RPC
# ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Fork configuration (optional)
FORK_ENABLED=true
# FORK_BLOCK_NUMBER=12345678  # Optional: Pin to specific block
```

### Run E2E Test

**Option 1: Using PowerShell script (Windows)**
```bash
npm run test:e2e
```

**Option 2: Direct Hardhat command**
```bash
# Set environment variable
$env:FORK_ENABLED="true"

# Run test
npx hardhat test test/integration/GMXv2Plugin.e2e.test.ts --network hardhat
```

**Option 3: Using npm script (cross-platform)**
```bash
npm run test:gmx
```

## 📊 Test Results

**Total: 21 tests across 6 suites**

1. Initial Setup Verification (6 tests)
2. Buy Flow (5 tests)
3. Balance Auto-Detection (3 tests)
4. Sell Flow (3 tests)
5. Final Verification (4 tests)
6. Integration Summary (1 test)

## ⚙️ Configuration

### Test Parameters

- **Test USDC Amount:** 1000 USDC
- **Execution Fee:** 0.003 ETH
- **Buy Amount:** 500 USDC
- **Timeout:** 5 minutes per test
- **Expected Duration:** 2-3 minutes total

### Arbitrum Addresses

- **USDC:** `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`
- **WETH:** `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1`
- **GM:ETH/USD:** `0x70d95587d40A2caf56bd97485aB3Eec10Bee6336`
- **GMX ExchangeRouter:** `0x7C68C7866A64FA2160F78EEaE12217FFbf871fa8`
- **GMX Reader:** `0xf60becbba223EEA9495Da3f606753867eC10d139`

## 🐛 Troubleshooting

### RPC Connection Failed
**Solution:** Use paid RPC (Alchemy/Infura), check `ARBITRUM_RPC_URL`

### Fork Timeout
**Solution:** Increase timeout in `hardhat.config.ts`, use faster RPC

### Insufficient Funds
**Solution:** Fork test auto-funds accounts, check whale address

## ✅ Success Criteria

- ✅ 21/21 tests passing
- ✅ No timeout errors
- ✅ All balances verified
- ✅ All authorizations confirmed
- ✅ Completes in < 5 minutes

## 🎯 Next Steps

1. **Deploy to Testnet:** `npm run deploy:testnet`
2. **Test with Real Keeper:** Execute actual buy/sell and wait
3. **Integration Test:** `npm run test:flow`
4. **Production:** Deploy to mainnet with real Chainlink feeds

## 📚 Resources

- **GMX V2 Docs:** https://docs.gmx.io/docs/api/contracts-v2
- **Hardhat Network:** https://hardhat.org/hardhat-network-helpers
- **Test Location:** `test/integration/GMXv2Plugin.e2e.test.ts`

---

**Ready to test? Run:** `npm run test:e2e` 🚀
