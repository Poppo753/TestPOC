# DolomitePlugin - Mainnet Deployment Checklist

## Pre-Deployment Checklist

### Environment Setup
- [ ] `.env` file configured with all required variables
- [ ] `ARBITRUM_RPC_URL` set (e.g., Alchemy/Infura Arbitrum endpoint)
- [ ] `PRIVATE_KEY` set (deployer wallet private key)
- [ ] `ARBITRUM_ETHERSCAN_API_KEY` set for verification
- [ ] Deployer wallet has sufficient ETH (minimum 0.01 ETH recommended)

### Security Review
- [ ] All tests passing (37/37)
- [ ] Contract compiled successfully
- [ ] No high/critical audit issues
- [ ] Circuit breaker logic reviewed
- [ ] Owner address confirmed correct

### Contract Configuration
- [ ] Dolomite contract addresses verified:
  - DolomiteMargin: `0x6Bd780E7fDf01D77e4d475c821f1e7AE05409072`
  - BorrowPositionRouter: `0xF579b345cdA0860668b857De10ABD62442133D0F`
  - DepositWithdrawalRouter: `0xf8b2c637a68cf6a17b1df9f8992eebeff63d2dff`

---

## Deployment Steps

### Step 1: Final Verification
```bash
# Run all tests one final time
$env:FORK_ENABLED="true"
npx hardhat test

# Verify compilation
npx hardhat compile

# Check deployer balance
npx hardhat run scripts/checkBalance.ts --network arbitrum
```

### Step 2: Deploy Contract
```bash
# Deploy to Arbitrum mainnet
npx hardhat run scripts/deployDolomitePluginMainnet.ts --network arbitrum
```

Expected output:
- ✅ Contract deployed at address
- ✅ Arbiscan verification started
- ✅ Tokens registered (WETH, USDC, USDT, ARB, WBTC)
- ✅ Health checks passing

### Step 3: Manual Verification (if auto-verify fails)
```bash
# If auto-verification fails, run manually
npx hardhat verify --network arbitrum <CONTRACT_ADDRESS> \
  "0x6Bd780E7fDf01D77e4d475c821f1e7AE05409072" \
  "0xF579b345cdA0860668b857De10ABD62442133D0F" \
  "0xf8b2c637a68cf6a17b1df9f8992eebeff63d2dff"
```

### Step 4: Post-Deployment Verification
- [ ] Contract appears on Arbiscan
- [ ] Source code verified on Arbiscan
- [ ] Read functions accessible on Arbiscan
- [ ] Write functions accessible on Arbiscan
- [ ] Owner address correct

---

## Post-Deployment Testing

### Test 1: Small Deposit (WETH)
```javascript
// Using Arbiscan or frontend
// 1. Approve DolomitePlugin to spend 0.01 WETH
WETH.approve(pluginAddress, ethers.parseEther("0.01"))

// 2. Get synthetic WETH address
syntheticWETH = plugin.realToSynthetic(WETH)

// 3. Deposit via inputSwap
plugin.inputSwap(WETH, syntheticWETH, ethers.parseEther("0.01"))

// 4. Check balance
balance = plugin.getDolomiteBalance(WETH)
// Expected: ~0.01 ETH (may have tiny interest)
```

### Test 2: Small Withdrawal
```javascript
// 5. Withdraw 0.005 WETH
plugin.inputSwap(syntheticWETH, WETH, ethers.parseEther("0.005"))

// 6. Verify WETH received
WETH.balanceOf(yourAddress)
```

### Test 3: Borrow Position (if comfortable)
```javascript
// 7. Open borrow position with 0.01 WETH
plugin.openBorrowPosition(WETH, ethers.parseEther("0.01"))
// Returns accountNumber (e.g., 1)

// 8. Borrow 10 USDC
plugin.borrowFromPosition(1, USDC, ethers.parseUnits("10", 6))

// 9. Repay with buffer
USDC.approve(pluginAddress, ethers.parseUnits("11", 6))
plugin.repayBorrowPosition(1, USDC, ethers.parseUnits("11", 6))

// 10. Close position (may fail if dust debt, that's OK)
plugin.closeBorrowPosition(1, [WETH])
```

---

## Integration Tasks

### Frontend Integration
- [ ] Update frontend with deployed contract address
- [ ] Update ABI files
- [ ] Test deposit flow from UI
- [ ] Test withdraw flow from UI
- [ ] Test borrow position flow from UI
- [ ] Add warning for closeBorrowPosition edge case

### Beacon Registration (if using SwapManager)
- [ ] Get Beacon contract address
- [ ] Register DolomitePlugin in Beacon
- [ ] Set plugin name: "Dolomite Lending"
- [ ] Verify plugin appears in SwapManager.getAllQuotes()

### Documentation Updates
- [ ] Add deployment address to README
- [ ] Update frontend integration guide
- [ ] Document known issues (close position edge case)
- [ ] Add mainnet deployment date

---

## Monitoring Setup

### Events to Monitor
```solidity
// Critical events
event DolomiteDeposit(address indexed user, address indexed token, uint256 amount, address syntheticToken);
event DolomiteWithdrawal(address indexed user, address indexed token, uint256 amount, address syntheticToken);
event BorrowPositionOpened(address indexed user, uint256 indexed accountNumber, address indexed collateralToken, uint256 collateralAmount);
event BorrowPositionBorrowed(address indexed user, uint256 indexed accountNumber, address indexed borrowToken, uint256 borrowAmount);
event FlashLoanExecuted(address indexed user, address indexed token, uint256 amount, address callbackContract);
event HealthStatusChanged(bool healthy, string reason, uint256 timestamp);
```

### Alert Setup
- [ ] Set up alerts for HealthStatusChanged(false)
- [ ] Monitor large deposits/withdrawals
- [ ] Monitor flash loan executions
- [ ] Monitor circuit breaker activation

### Analytics
- [ ] Track total value locked (TVL)
- [ ] Track number of borrow positions
- [ ] Track flash loan volume
- [ ] Track gas costs for optimization

---

## Troubleshooting

### Common Issues

#### Issue: "Insufficient balance for deployment"
**Solution**: Send at least 0.01 ETH to deployer wallet

#### Issue: "Verification failed"
**Solution**: Run manual verification command (see Step 3)

#### Issue: "Token registration failed"
**Solution**: 
- Check if token has Dolomite market
- Verify token address is correct
- Try registering one token at a time manually

#### Issue: "closeBorrowPosition() fails with 'Undercollateralized'"
**Solution**: This is expected if there's dust debt from interest
- Frontend should check debt before calling close
- User needs to repay exact amount including interest
- See docs/DolomitePlugin_Implementation_Notes.md

#### Issue: "Health check fails"
**Solution**: 
- Check Dolomite contract addresses are correct
- Verify RPC endpoint is working
- Check if Dolomite protocol is operational

---

## Emergency Procedures

### Circuit Breaker Activation
```javascript
// If critical issue discovered
plugin.setCircuitBreaker(true) // Owner only

// This pauses all operations:
// - No deposits
// - No withdrawals  
// - No borrow operations
// - No flash loans
```

### Emergency Withdrawal
```javascript
// If tokens get stuck in plugin contract
plugin.emergencyWithdraw(tokenAddress, amount, recipientAddress) // Owner only
```

### Ownership Transfer
```javascript
// If need to transfer ownership
plugin.transferOwnership(newOwnerAddress) // Owner only
```

---

## Success Criteria

Deployment is successful when:
- ✅ Contract deployed and verified on Arbiscan
- ✅ All tokens registered successfully
- ✅ Health check passes
- ✅ Small test deposit/withdraw works
- ✅ Integration with frontend works
- ✅ Monitoring is set up
- ✅ Documentation is updated

---

## Rollback Plan

If critical issues discovered post-deployment:
1. Activate circuit breaker immediately
2. Notify users via all channels
3. Verify no funds are at risk (check Dolomite balances)
4. Identify and fix issue
5. Deploy new version with fix
6. Migrate users to new contract

---

## Support Contacts

- Dolomite Documentation: https://docs.dolomite.io/
- Dolomite Discord: [link]
- Arbitrum Discord: https://discord.gg/arbitrum
- Etherscan Support: support@etherscan.io

---

## Notes

### About closeBorrowPosition Edge Case
This is a known limitation, not a bug:
- Interest accrues continuously on Dolomite
- Between repay and close, new interest accumulates
- This is by design in lending protocols
- Solution: Frontend checks debt before allowing close
- Alternative: Add dust tolerance (TODO for next update)

### About Flash Loans
- Architecture is correct and tested
- Requires callback contract for real use
- No fees (unlike Aave's 0.09%)
- Examples available in docs/DolomitePlugin_Implementation_Notes.md

---

## Timeline

**Estimated deployment time:** 15-30 minutes
- Contract deployment: 2-5 minutes
- Verification: 2-5 minutes
- Token registration: 5-10 minutes
- Testing: 5-10 minutes

**Post-deployment tasks:** 2-4 hours
- Frontend integration: 1-2 hours
- Testing: 30-60 minutes
- Documentation: 30 minutes
- Monitoring setup: 30 minutes
