# 🚀 Production Deployment Guide - Swap Modularity Phase 1C

## 📋 Pre-Deployment Checklist

### 1. Environment Setup
```bash
# Copy .env.example to .env
cp .env.example .env

# Edit .env and fill required values:
# - PRIVATE_KEY (wallet with ~0.02 ETH for gas)
# - BEACON_ADDRESS (your existing Beacon contract)
# - ARBITRUM_RPC_URL (mainnet) or ARBITRUM_SEPOLIA_RPC_URL (testnet)
# - ARBITRUM_ETHERSCAN_API_KEY (get free at arbiscan.io/myapikey)
```

### 2. Verify Configuration
```bash
# Test compilation
npx hardhat compile

# Test RPC connection
npx hardhat console --network arbitrum
# (or --network arbitrumSepolia for testnet)
```

### 3. Verify Wallet Balance
```bash
# Check deployer wallet has sufficient ETH
# Mainnet: ~0.02 ETH (~$60-80 USD)
# Testnet: Get free ETH from https://faucet.quicknode.com/arbitrum/sepolia
```

---

## 🎯 Deployment Sequence

### **TESTNET FIRST (Highly Recommended)**

Test on Arbitrum Sepolia before mainnet deployment:

```bash
# Replace all --network arbitrum with --network arbitrumSepolia
```

### **Phase 0: Deploy UniswapV3Plugin**
```bash
npx hardhat run scripts/migration/00_deploy_uniswapv3plugin.ts --network arbitrum
```
**What it does:**
- Deploys UniswapV3Plugin wrapper around existing SimpleSwap
- Verifies SimpleSwap contract exists (0xa0DB7...)
- Tests ISwapPlugin interface
- Saves address to `.env.migration`

**Expected output:**
```
✅ UNISWAPV3PLUGIN DEPLOYED SUCCESSFULLY
Plugin Address: 0x...
```

**Add to .env:**
```bash
UNISWAPV3_PLUGIN_ADDRESS=0x... (copy from output)
```

---

### **Phase 1: Register UniswapV3Plugin in Beacon**
```bash
npx hardhat run scripts/migration/01_register_simpleswap.ts --network arbitrum
```
**What it does:**
- Registers UniswapV3Plugin in Beacon with name "UniswapV3Plugin"
- Verifies Beacon exists and is accessible
- Tests plugin resolution

**Expected output:**
```
✅ UNISWAPV3PLUGIN REGISTERED IN BEACON
Registration: UniswapV3Plugin → 0x...
```

⚠️ **No impact on existing system yet** - old SwapManager still working

---

### **Phase 2: Deploy New SwapManager**
```bash
npx hardhat run scripts/migration/02_deploy_new_swapmanager.ts --network arbitrum
```
**What it does:**
- Deploys new SwapManager with multi-plugin support
- Sets activeSwapPlugin = "UniswapV3Plugin"
- Tests new functions (getAllQuotes, swapWithBestPlugin)
- Contract is isolated - NOT yet connected to system

**Expected output:**
```
✅ NEW SWAPMANAGER DEPLOYED
SwapManager Address: 0x...
Active Plugin: UniswapV3Plugin
```

**Add to .env:**
```bash
NEW_SWAP_MANAGER_ADDRESS=0x... (copy from output)
```

⚠️ **Still no impact** - Beacon not updated yet

---

### **Phase 3: Update Beacon (SWITCH PRODUCTION)** ⚠️ CRITICAL

```bash
npx hardhat run scripts/migration/03_update_beacon.ts --network arbitrum
```

**What it does:**
- Updates Beacon to point to NEW SwapManager
- **THIS IS THE PRODUCTION SWITCH**
- Old SwapManager address saved for rollback
- All LiquidityManager calls now route to new SwapManager

**Expected output:**
```
✅ BEACON UPDATED TO NEW SWAPMANAGER
Old: 0x... → New: 0x...
```

🚨 **SYSTEM IS NOW USING NEW SWAPMANAGER** 🚨

**Rollback available:** Run `scripts/migration/rollback.ts` if issues

---

### **Phase 4: Verify System Health**
```bash
npx hardhat run scripts/migration/04_verify_system.ts --network arbitrum
```

**What it does:**
- Tests Beacon resolution
- Verifies plugin registration
- Tests getAllQuotes()
- Tests swapWithBestPlugin()
- Confirms backward compatibility

**Expected output:**
```
✅ SYSTEM HEALTH CHECK PASSED
All functions working correctly
```

---

### **Phase 5: Verify Contracts on Arbiscan**
```bash
npx hardhat run scripts/migration/05_verify_contracts.ts --network arbitrum
```

**What it does:**
- Verifies UniswapV3Plugin source code on Arbiscan
- Verifies SwapManager source code
- Makes contracts readable for users/auditors

**Expected output:**
```
✅ ALL CONTRACTS VERIFIED SUCCESSFULLY
View on Arbiscan: https://arbiscan.io/address/0x...
```

---

## 🔄 Rollback Procedure (Emergency)

If issues after Phase 3 (Beacon update):

```bash
npx hardhat run scripts/migration/rollback.ts --network arbitrum
```

**What it does:**
- Reverts Beacon to OLD SwapManager
- System returns to previous state
- New contracts remain deployed but unused

---

## 📊 Cost Estimates

| Phase | Gas Estimate | ETH Cost @ 0.1 gwei | USD @ $3000/ETH |
|-------|--------------|---------------------|-----------------|
| 0. Deploy UniswapV3Plugin | ~600k | ~0.00006 ETH | ~$0.18 |
| 1. Register in Beacon | ~100k | ~0.00001 ETH | ~$0.03 |
| 2. Deploy SwapManager | ~3M | ~0.0003 ETH | ~$0.90 |
| 3. Update Beacon | ~50k | ~0.000005 ETH | ~$0.015 |
| 4. Verify System | Free (view) | - | - |
| 5. Etherscan Verify | Free (API) | - | - |
| **TOTAL** | **~3.75M** | **~0.000375 ETH** | **~$1.13** |

⚠️ Actual costs depend on Arbitrum gas prices (usually 0.01-0.5 gwei)

---

## 🧪 Testing Before Production

### Local Fork Testing
```bash
# In hardhat.config.ts, enable fork:
FORK_ENABLED=true npx hardhat test

# Run Phase 1B tests
npx hardhat test test/unit/SwapManager.Phase1B.test.ts

# Run Integration tests
npx hardhat test test/unit/SwapManager.Phase1A-1B.Integration.test.ts
```

### Testnet Deployment
```bash
# Deploy to Arbitrum Sepolia first
# Replace --network arbitrum with --network arbitrumSepolia in all commands

# Get testnet ETH: https://faucet.quicknode.com/arbitrum/sepolia
```

---

## 🔐 Security Considerations

### Before Deployment
- [ ] All tests passing (28/28 tests green)
- [ ] Code reviewed by team
- [ ] Environment variables secured
- [ ] Separate deployment wallet used (not main wallet)
- [ ] Testnet deployment successful

### After Deployment
- [ ] Contracts verified on Arbiscan
- [ ] Addresses backed up securely
- [ ] Rollback script tested
- [ ] Monitoring enabled
- [ ] Team notified of new addresses

---

## 📝 Post-Deployment

### Save All Addresses
```bash
# Critical addresses to save:
# - UNISWAPV3_PLUGIN_ADDRESS
# - NEW_SWAP_MANAGER_ADDRESS
# - OLD_SWAP_MANAGER_ADDRESS (for rollback)
# - BEACON_ADDRESS

# All saved in .env.migration automatically
```

### Share with Team
```
Deployment Summary:
- Network: Arbitrum Mainnet
- UniswapV3Plugin: 0x...
- SwapManager: 0x...
- Arbiscan: https://arbiscan.io/address/0x...
- Deployment Date: YYYY-MM-DD
- Deployer: 0x...
```

---

## 🆘 Troubleshooting

### "Insufficient funds for gas"
```bash
# Add more ETH to deployer wallet
# Minimum: 0.02 ETH recommended
```

### "Beacon contract not found"
```bash
# Verify BEACON_ADDRESS in .env
# Deploy Beacon first if not exists
```

### "SimpleSwap contract not found"
```bash
# For mainnet: Use 0xa0DB78167CBAccD47524a261b7741C6B41Bbd096
# For testnet: Deploy MockSimpleSwap first
```

### "Nonce too low"
```bash
# Wait a few seconds and retry
# Or restart Hardhat node if local testing
```

### "Verification failed"
```bash
# Check ARBITRUM_ETHERSCAN_API_KEY in .env
# Wait 1-2 minutes and retry verification script
# Manual verification: https://arbiscan.io/verifyContract
```

---

## 📞 Support

For issues or questions:
1. Check this README
2. Review script output carefully
3. Check `.env` configuration
4. Review test results
5. Check Arbiscan for transaction status

---

## ✅ Success Criteria

Deployment is successful when:
- ✅ All 5 scripts completed without errors
- ✅ Contracts verified on Arbiscan
- ✅ System health check passed (script 04)
- ✅ Addresses saved and backed up
- ✅ Rollback procedure tested

**Congratulations! 🎉 Your multi-plugin swap system is live!**
