# 📦 Oracle Modularity Deployment Scripts

## Overview

This directory contains production-ready deployment scripts for the **Oracle Modularity System** on Arbitrum mainnet.

## 🎯 What's Included

### Configuration
- **`../config/chainlink-feeds-arbitrum.ts`**: Chainlink price feed addresses for Arbitrum mainnet/testnet

### Deployment Scripts
- **`01_deploy_chainlink_adapter.ts`**: Deploy and configure ChainlinkAdapter with all price feeds
- **`../verify/01_verify_adapter.ts`**: Comprehensive post-deployment verification
- **`../test/quick-test-adapter.ts`**: Quick smoke test

### Documentation
- **`../DEPLOYMENT_GUIDE.md`**: Complete step-by-step deployment guide with troubleshooting

## 🚀 Quick Start

### Prerequisites

```bash
# 1. Set up environment variables
cp .env.example .env
# Edit .env with your PRIVATE_KEY and ARBITRUM_ETHERSCAN_API_KEY

# 2. Ensure you have enough ETH
# Mainnet: 0.01 ETH minimum
# Testnet: 0.001 ETH (from faucet)

# 3. Compile contracts
npx hardhat compile
```

### Deploy to Mainnet

```bash
# Step 1: Deploy ChainlinkAdapter
npx hardhat run scripts/deploy/01_deploy_chainlink_adapter.ts --network arbitrum

# Step 2: Verify deployment
export CHAINLINK_ADAPTER_ADDRESS=0x...  # From step 1 output
npx hardhat run scripts/verify/01_verify_adapter.ts --network arbitrum

# Step 3: Quick test
npx hardhat run scripts/test/quick-test-adapter.ts --network arbitrum
```

### Test on Fork (Recommended First!)

```bash
# Enable fork mode
export FORK_ENABLED=true

# Run deployment on local fork
npx hardhat run scripts/deploy/01_deploy_chainlink_adapter.ts --network hardhat

# Verify
npx hardhat run scripts/verify/01_verify_adapter.ts --network hardhat
```

## 📊 What Gets Deployed

### ChainlinkAdapter
- **Purpose**: Modular oracle adapter for Chainlink price feeds
- **Configured Tokens**: 9 tokens (ETH, WETH, USDC, USDT, WBTC, DAI, LINK, ARB, UNI)
- **Gas Cost**: ~2.4M gas (~$5-10 depending on gas price)

### Supported Price Feeds

| Token | Feed | Decimals | Heartbeat |
|-------|------|----------|-----------|
| ETH | 0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612 | 8 | 24h |
| USDC | 0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3 | 8 | 24h |
| WBTC | 0xd0C7101eACbB49F3deCcCc166d238410D6D46d57 | 8 | 24h |
| DAI | 0xc5C8E77B397E531B8EC06BFb0048328B30E9eCfB | 8 | 24h |
| LINK | 0x86E53CF1B870786351Da77A57575e79CB55812CB | 8 | 24h |
| ARB | 0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6 | 8 | 24h |
| UNI | 0x9C917083fDb403ab5ADbEC26Ee294f6EcAda2720 | 8 | 24h |
| USDT | 0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7 | 8 | 24h |
| WETH | 0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612 | 8 | 24h |

*Source: [Chainlink Price Feeds - Arbitrum](https://docs.chain.link/data-feeds/price-feeds/addresses?network=arbitrum)*

## 📁 Deployment Artifacts

After deployment, artifacts are saved to:

```
scripts/
  deployments/
    chainlink-adapter-arbitrum-latest.json      # Latest deployment
    chainlink-adapter-arbitrum-1699999999.json  # Timestamped backup
  
  reports/
    adapter-verification-arbitrum-1699999999.json  # Verification report
```

## 🔍 Verification Checks

The verification script (`../verify/01_verify_adapter.ts`) performs:

1. **Deployment Check**: Contract code exists at address
2. **Ownership Check**: Deployer is owner
3. **Feed Configuration**: All 9 feeds configured correctly
4. **Price Retrieval**: All prices are valid and fresh
5. **Arbiscan Verification**: Contract is verified on Arbiscan

**Success Criteria**: All checks must pass ✅

## 🛠️ Script Details

### 01_deploy_chainlink_adapter.ts

**Features**:
- ✅ Automatic gas estimation
- ✅ Feed validation before configuration
- ✅ Comprehensive error handling
- ✅ Progress indicators
- ✅ Automatic Arbiscan verification
- ✅ Safety confirmation for mainnet
- ✅ Deployment artifacts saved
- ✅ Retry logic for verification

**Configuration**:
```typescript
const DEPLOYMENT_CONFIG = {
  maxFeePerGas: ethers.parseUnits("0.1", "gwei"),
  maxPriorityFeePerGas: ethers.parseUnits("0.01", "gwei"),
  verifyOnEtherscan: true,
  verificationRetries: 3,
  requireConfirmation: true, // 10s countdown for mainnet
};
```

**Output Example**:
```
🚀 DEPLOYING CHAINLINK ADAPTER - ARBITRUM
═══════════════════════════════════════════

📡 Network: arbitrum
🏦 Mainnet: YES ⚠️
👤 Deployer: 0x...
💰 Balance: 0.05 ETH

📦 STEP 1: Deploying ChainlinkAdapter...
✅ ChainlinkAdapter deployed!
   📍 Address: 0x1234...

⚙️  STEP 2: Configuring Price Feeds...
[1/9] Configuring ETH...
   ✅ ETH configured successfully
...

🔍 STEP 3: Verifying Configuration...
✓ ETH: $2000.00 ✅

🔍 STEP 4: Verifying on Arbiscan...
✅ Contract verified!

🎉 DEPLOYMENT COMPLETE!
```

## 🧪 Testing

### Unit Tests
Already passing (171/171):
```bash
npx hardhat test test/unit/ChainlinkAdapter.test.ts
npx hardhat test test/integration/OracleAdapter.integration.test.ts
npx hardhat test test/e2e/OracleAdapter.e2e.test.ts
```

### Live Testing
After deployment:
```bash
# Quick test
CHAINLINK_ADAPTER_ADDRESS=0x... npx hardhat run scripts/test/quick-test-adapter.ts --network arbitrum

# Full verification
CHAINLINK_ADAPTER_ADDRESS=0x... npx hardhat run scripts/verify/01_verify_adapter.ts --network arbitrum
```

## ⚠️ Important Notes

### Before Mainnet Deployment
1. ✅ Test on fork with `FORK_ENABLED=true`
2. ✅ Verify all price feeds are active on Chainlink
3. ✅ Ensure `.env` file is in `.gitignore`
4. ✅ Have at least 0.01 ETH in deployer account
5. ✅ Have Arbiscan API key ready
6. ✅ Review `DEPLOYMENT_GUIDE.md`

### Security
- 🔒 **Never commit private keys** to git
- 🔒 **Use hardware wallet** for mainnet deployments (Ledger/Trezor)
- 🔒 **Test on fork first** to catch issues
- 🔒 **Verify contract on Arbiscan** for transparency
- 🔒 **Save deployment artifacts** for audit trail

### Gas Optimization
- Arbitrum has low gas costs (~0.1 gwei)
- Deployment is cheap compared to Ethereum L1
- Total cost: ~$5-10 for full deployment

## 📞 Support

If you encounter issues:

1. **Check deployment guide**: `../DEPLOYMENT_GUIDE.md`
2. **Review troubleshooting section** in guide
3. **Check deployment artifacts** in `../deployments/`
4. **Test on fork first** to isolate issue
5. **Contact team lead** if stuck

## 🎓 Next Steps

After successful deployment:

1. **Save Addresses**: Document ChainlinkAdapter address
2. **Integrate with TokenManager**: Use adapter in your system
3. **Monitor Health**: Run verification script regularly
4. **Advanced Features** (Optional):
   - Deploy CompositeOracleAdapter for multi-oracle
   - Add Pyth Network adapter
   - Implement price deviation alerts

## 📚 Resources

- **Deployment Guide**: `../DEPLOYMENT_GUIDE.md`
- **Chainlink Docs**: https://docs.chain.link/
- **Arbitrum Docs**: https://docs.arbitrum.io/
- **Arbiscan**: https://arbiscan.io/

---

**Ready to deploy?** Follow the Quick Start above! 🚀
