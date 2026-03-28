# 🚀 Deployment Guide: Oracle Modularity on Arbitrum Mainnet

## 📋 **Prerequisites**

### 1. Environment Setup

Create a `.env` file in the project root:

```bash
# Arbitrum RPC (optional, will use public RPC if not set)
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc

# Deployer private key (NEVER commit this!)
PRIVATE_KEY=your_private_key_here

# Arbiscan API key for contract verification
ARBITRUM_ETHERSCAN_API_KEY=your_arbiscan_api_key_here

# Optional: For fork testing
FORK_ENABLED=false
FORK_BLOCK_NUMBER=123456789
```

### 2. Minimum ETH Balance

- **Mainnet**: 0.01 ETH (~$30 at current prices)
- **Testnet**: 0.001 ETH (get from faucet)

Estimated gas costs:
- ChainlinkAdapter deployment: ~1.5M gas (~$3)
- Feed configuration (9 tokens): ~900k gas (~$1.8)
- **Total**: ~$5-10 depending on gas prices

### 3. Dependencies

```bash
npm install
npx hardhat compile
```

---

## 🧪 **Step 0: Test on Fork (Recommended)**

Before deploying to mainnet, test on a local fork:

```bash
# Enable fork mode
export FORK_ENABLED=true

# Run deployment on fork
npx hardhat run scripts/deploy/01_deploy_chainlink_adapter.ts --network hardhat

# Verify it works
npx hardhat run scripts/verify/01_verify_adapter.ts --network hardhat
```

**Expected output**:
- ✅ All feeds configured
- ✅ All prices retrievable
- ✅ No errors

---

## 🚀 **Step 1: Deploy ChainlinkAdapter**

### Deploy to Mainnet

```bash
npx hardhat run scripts/deploy/01_deploy_chainlink_adapter.ts --network arbitrum
```

**What happens**:
1. Deploys `ChainlinkAdapter` contract
2. Configures 9 Chainlink price feeds (ETH, USDC, WBTC, DAI, LINK, ARB, UNI, USDT, WETH)
3. Verifies each feed works
4. Attempts to verify contract on Arbiscan
5. Saves deployment info to `scripts/deployments/`

**Expected output**:
```
🚀 DEPLOYING CHAINLINK ADAPTER - ARBITRUM
...
✅ ChainlinkAdapter deployed!
   📍 Address: 0x...
   🔗 Transaction: 0x...
   ⛽ Gas Used: ~1500000

⚙️  STEP 2: Configuring Price Feeds...
[1/9] Configuring ETH...
   ✅ ETH configured successfully
...
✅ Feed Configuration Complete: 9/9 successful

🔍 STEP 3: Verifying Configuration...
✓ ETH:
   Price: $2000.00
   Valid: ✅
...

🔍 STEP 4: Verifying on Arbiscan...
✅ Contract verified on Arbiscan!

🎉 DEPLOYMENT COMPLETE!
```

**Save the adapter address**:
```bash
export CHAINLINK_ADAPTER_ADDRESS=0x... # Copy from output
```

### Verify Deployment (Optional but Recommended)

```bash
CHAINLINK_ADAPTER_ADDRESS=0x... npx hardhat run scripts/verify/01_verify_adapter.ts --network arbitrum
```

Expected: All checks ✅

---

## 📝 **Step 2: Verify on Arbiscan**

If automatic verification failed, verify manually:

```bash
npx hardhat verify --network arbitrum 0xYourAdapterAddress
```

---

## 🔍 **Step 3: Test Adapter**

### Quick Test

```typescript
// scripts/test-adapter.ts
import { ethers } from "hardhat";

async function main() {
  const adapter = await ethers.getContractAt(
    "ChainlinkAdapter",
    process.env.CHAINLINK_ADAPTER_ADDRESS!
  );
  
  const [price, timestamp, isValid] = await adapter.getPrice("ETH");
  console.log(`ETH Price: $${ethers.formatUnits(price, 8)}`);
  console.log(`Valid: ${isValid}`);
}

main();
```

```bash
CHAINLINK_ADAPTER_ADDRESS=0x... npx hardhat run scripts/test-adapter.ts --network arbitrum
```

---

## ✅ **Step 4: Deploy TokenManager (If New System)**

If deploying a completely new system:

```bash
# Set required addresses
export CHAINLINK_ADAPTER_ADDRESS=0x...  # From Step 1
export BEACON_ADDRESS=0x...             # Your existing Beacon

# Deploy TokenManager with oracle adapter
npx hardhat run scripts/deploy/02_deploy_token_manager.ts --network arbitrum
```

---

## 🔄 **Step 5: Update Existing System (If Upgrading)**

If you already have a deployed system and want to add oracle modularity:

```bash
# Set addresses
export CHAINLINK_ADAPTER_ADDRESS=0x...    # From Step 1
export TOKEN_MANAGER_ADDRESS=0x...        # Your existing TokenManager
export BEACON_ADDRESS=0x...               # Your Beacon

# Update TokenManager to use adapter
npx hardhat run scripts/deploy/03_update_system.ts --network arbitrum
```

⚠️ **WARNING**: This will modify your live system!

---

## 🧪 **Step 6: Post-Deployment Testing**

### Test 1: Price Queries

```typescript
const tokenManager = await ethers.getContractAt("TokenManager", TM_ADDRESS);
const [price] = await tokenManager.getTokenPrice("USDC");
console.log(`USDC Price: $${ethers.formatUnits(price, 8)}`);
```

### Test 2: Oracle Switch (Advanced)

```typescript
// Deploy a second adapter (e.g., MockOracleAdapter for testing)
const mockAdapter = await MockOracleAdapter.deploy();

// Switch oracle (owner only)
await tokenManager.setOracleAdapter(await mockAdapter.getAddress());

// Verify prices now come from mock adapter
const [price] = await tokenManager.getTokenPrice("USDC");
```

### Test 3: Integration Tests

```bash
npx hardhat test test/integration/OracleAdapter.integration.test.ts --network arbitrum
```

---

## 📊 **Monitoring**

### Check Adapter Health

```bash
# Automated health check
npx hardhat run scripts/monitoring/check_adapter_health.ts --network arbitrum
```

### Monitor Prices

```bash
# Get all current prices
npx hardhat run scripts/monitoring/get_all_prices.ts --network arbitrum
```

---

## 🆘 **Troubleshooting**

### Issue: "Insufficient funds"

**Solution**: Add more ETH to deployer account

### Issue: "Feed validation failed"

**Causes**:
1. Chainlink feed is down (rare)
2. Wrong feed address in config
3. Network issues

**Solution**: 
1. Check feed on Arbiscan: `https://arbiscan.io/address/[FEED_ADDRESS]`
2. Verify feed address in `chainlink-feeds-arbitrum.ts`
3. Try again after a few minutes

### Issue: "Price is stale"

**Cause**: Chainlink hasn't updated in >24h (very rare)

**Solution**: Check Chainlink status: https://data.chain.link/arbitrum/mainnet

### Issue: "Contract already deployed at address"

**Solution**: This is normal if re-running. Use existing address or deploy fresh with a different deployer.

### Issue: "Verification failed"

**Solutions**:
1. Wait 30 seconds and try manual verification:
   ```bash
   npx hardhat verify --network arbitrum 0xYourAddress
   ```
2. Check Arbiscan API key in `.env`
3. Sometimes Arbiscan is slow - try again later

---

## 🔐 **Security Checklist**

Before mainnet deployment:

- [ ] `.env` file in `.gitignore`
- [ ] Private key never committed to git
- [ ] Tested on fork with `FORK_ENABLED=true`
- [ ] Minimum 2 people reviewed deployment scripts
- [ ] Arbiscan verification enabled
- [ ] Backup plan if deployment fails
- [ ] Sufficient ETH balance for deployment
- [ ] Know how to pause/revert if issues arise

---

## 📁 **Deployment Artifacts**

After successful deployment, you'll have:

```
scripts/
  deployments/
    chainlink-adapter-arbitrum-latest.json      # Latest deployment info
    chainlink-adapter-arbitrum-1699999999.json  # Timestamped backup
  
  reports/
    adapter-verification-arbitrum-1699999999.json  # Verification report
```

---

## 🎯 **Success Criteria**

Deployment is successful if:

1. ✅ ChainlinkAdapter deployed and verified on Arbiscan
2. ✅ All 9 price feeds configured and returning valid prices
3. ✅ Adapter ownership set to correct address
4. ✅ TokenManager (if deployed) uses adapter correctly
5. ✅ All verification checks pass
6. ✅ Gas costs within expected range (<$15)

---

## 📞 **Support**

If you encounter issues:

1. Check logs in `scripts/deployments/` and `scripts/reports/`
2. Review this guide's troubleshooting section
3. Test on fork first to isolate issues
4. Contact team lead if stuck

---

## 🎓 **Next Steps**

After successful deployment:

1. **Update Documentation**: Document deployed addresses
2. **Monitor Prices**: Run monitoring script daily for 1 week
3. **Team Training**: Ensure team knows how to:
   - Check adapter health
   - Switch oracle providers (if needed)
   - Handle oracle failures
4. **Advanced Features** (Optional):
   - Deploy CompositeOracleAdapter for multi-oracle fallback
   - Add Pyth Network adapter
   - Implement price deviation monitoring

---

## 📚 **Additional Resources**

- **Chainlink Feeds**: https://docs.chain.link/data-feeds/price-feeds/addresses?network=arbitrum
- **Arbitrum Docs**: https://docs.arbitrum.io/
- **Arbiscan**: https://arbiscan.io/
- **Hardhat Docs**: https://hardhat.org/

---

**Good luck with your deployment!** 🚀
