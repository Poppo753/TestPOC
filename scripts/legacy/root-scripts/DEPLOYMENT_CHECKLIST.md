# ✅ Deployment Checklist - Oracle Modularity

**Date**: _______________  
**Network**: [ ] Testnet   [ ] Mainnet  
**Deployer**: ___________________________

---

## 📋 Pre-Deployment Checklist

### Environment Setup
- [ ] `.env` file created with required variables
  - [ ] `PRIVATE_KEY` set (without 0x prefix)
  - [ ] `ARBITRUM_ETHERSCAN_API_KEY` set
  - [ ] `ARBITRUM_RPC_URL` set (optional)
- [ ] `.env` file is in `.gitignore`
- [ ] Contracts compiled successfully (`npx hardhat compile`)
- [ ] Deployer account has sufficient ETH (0.01+ ETH for mainnet)

### Testing
- [ ] All unit tests passing (171/171)
  ```bash
  npx hardhat test
  ```
- [ ] Fork deployment tested successfully
  ```bash
  FORK_ENABLED=true npx hardhat run scripts/deploy/01_deploy_chainlink_adapter.ts --network hardhat
  ```
- [ ] Fork verification passed
  ```bash
  FORK_ENABLED=true npx hardhat run scripts/verify/01_verify_adapter.ts --network hardhat
  ```

### Documentation Review
- [ ] Read `DEPLOYMENT_GUIDE.md` completely
- [ ] Understand rollback procedure
- [ ] Team notified of deployment timing
- [ ] Monitoring plan in place

---

## 🚀 Deployment Steps

### Step 1: Deploy ChainlinkAdapter

```bash
npx hardhat run scripts/deploy/01_deploy_chainlink_adapter.ts --network arbitrum
```

**Expected Duration**: 5-10 minutes

- [ ] Deployment started without errors
- [ ] ChainlinkAdapter deployed successfully
- [ ] **Adapter Address**: ______________________________________
- [ ] All 9 price feeds configured
- [ ] Contract verified on Arbiscan automatically
- [ ] Deployment info saved to `scripts/deployments/`

**Gas Used**: ____________ gas  
**ETH Spent**: ____________ ETH  
**Transaction Hash**: ______________________________________

### Step 2: Verify Deployment

```bash
export CHAINLINK_ADAPTER_ADDRESS=0x...
npx hardhat run scripts/verify/01_verify_adapter.ts --network arbitrum
```

**Expected Duration**: 2-3 minutes

- [ ] Deployment check passed ✅
- [ ] Ownership check passed ✅
- [ ] All 9 feeds configured correctly ✅
- [ ] All prices retrievable ✅
- [ ] No warnings or errors
- [ ] Verification report saved

**Pass Rate**: ____/____  (should be 100%)

### Step 3: Quick Test

```bash
CHAINLINK_ADAPTER_ADDRESS=0x... npx hardhat run scripts/test/quick-test-adapter.ts --network arbitrum
```

**Expected Duration**: 1 minute

- [ ] Adapter info retrieved ✅
- [ ] All tokens supported ✅
- [ ] All prices valid ✅
- [ ] Ownership correct ✅

### Step 4: Manual Verification on Arbiscan

Visit: `https://arbiscan.io/address/[ADAPTER_ADDRESS]`

- [ ] Contract code visible and verified
- [ ] Read functions work (try `getPrice("ETH")`)
- [ ] Write functions accessible (owner only)
- [ ] Events visible in logs

---

## 📊 Post-Deployment

### Documentation
- [ ] Save adapter address in project documentation
- [ ] Update deployment notes with gas costs
- [ ] Share deployment summary with team
- [ ] Archive deployment artifacts

### Integration (If Applicable)
- [ ] Update TokenManager to use new adapter
  ```bash
  # If needed:
  export TOKEN_MANAGER_ADDRESS=0x...
  npx hardhat run scripts/deploy/02_update_token_manager.ts --network arbitrum
  ```
- [ ] Verify TokenManager uses adapter correctly
- [ ] Test end-to-end flows

### Monitoring
- [ ] Set up price monitoring (daily for first week)
  ```bash
  CHAINLINK_ADAPTER_ADDRESS=0x... npx hardhat run scripts/verify/01_verify_adapter.ts --network arbitrum
  ```
- [ ] Create alert for stale prices
- [ ] Monitor adapter ownership hasn't changed
- [ ] Check gas costs are stable

---

## 🎯 Success Criteria

Deployment is successful if ALL of the following are true:

- [ ] ✅ ChainlinkAdapter deployed at address: _________________________
- [ ] ✅ 9/9 price feeds configured correctly
- [ ] ✅ Verification script: 100% pass rate
- [ ] ✅ Contract verified on Arbiscan
- [ ] ✅ All price queries return valid data
- [ ] ✅ Gas costs within budget (<$15 total)
- [ ] ✅ No errors or warnings
- [ ] ✅ Team notified of deployment

---

## ⚠️ Rollback Plan

If deployment fails or issues arise:

### Immediate Actions
1. **Stop**: Don't deploy TokenManager update yet
2. **Document**: Save all error messages and transaction hashes
3. **Analyze**: Review deployment logs in `scripts/deployments/`
4. **Report**: Notify team lead immediately

### Rollback Options
1. **Adapter failed**: Simply redeploy (no state to rollback)
2. **Feeds misconfigured**: Use `setPriceFeed()` to fix individual feeds
3. **TokenManager issue**: Don't update Beacon, keep old system running

### Emergency Contacts
- **Team Lead**: _________________________
- **Smart Contract Dev**: _________________________

---

## 📝 Notes & Issues

### Deployment Notes
```
[Space for notes during deployment]






```

### Issues Encountered
```
[Document any issues and resolutions]






```

### Gas Costs Analysis
| Item | Gas Used | ETH Cost | USD Cost |
|------|----------|----------|----------|
| Adapter Deploy | _______ | _______ | _______ |
| Feed Config | _______ | _______ | _______ |
| **TOTAL** | _______ | _______ | _______ |

---

## ✅ Sign-Off

**Deployment completed successfully**: [ ] YES  [ ] NO

**Deployed by**: ___________________________  
**Date**: _______________  
**Time**: _______________  

**Verified by**: ___________________________  
**Date**: _______________  

**Notes**:
```






```

---

**Next Steps**:
1. Archive this checklist with deployment artifacts
2. Update main project documentation
3. Monitor for 7 days
4. Plan next phase (TokenManager integration)

---

**🎉 Congratulations on your successful deployment!**
