# Token Management Scripts

Administrative scripts for managing ERC20 tokens in the DeFi system.

## 📋 Available Scripts

### 1. AddToken.ts
Register new ERC20 tokens with Chainlink price feed integration.

**Features:**
- Token parameter validation
- Chainlink oracle connectivity testing
- WETH exclusion check
- Price feed staleness validation
- Heartbeat configuration

**Usage:**
```bash
TOKEN_CODE=USDC \
TOKEN_ADDRESS=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
PRICE_FEED_ADDRESS=0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6 \
TOKEN_DECIMALS=6 \
PRICE_FEED_DECIMALS=8 \
HEARTBEAT=3600 \
npx hardhat run scripts/admin/tokens/AddToken.ts
```

### 2. RemoveToken.ts
Deactivate tokens from the system with safety checks.

**Features:**
- Token existence verification
- Pool balance checking
- Force removal option
- Active tokens list update
- Safety warnings

**Usage:**
```bash
# Safe removal (fails if balance > 0)
TOKEN_CODE=USDC npx hardhat run scripts/admin/tokens/RemoveToken.ts

# Force removal
TOKEN_CODE=USDC FORCE_REMOVE=true \
npx hardhat run scripts/admin/tokens/RemoveToken.ts
```

### 3. UpdateOracles.ts
Update Chainlink price feed configuration for existing tokens.

**Features:**
- Update price feed address
- Update heartbeat
- Reset error count
- Full config or individual updates
- New oracle validation

**Usage:**
```bash
# Update heartbeat
TOKEN_CODE=USDC NEW_HEARTBEAT=7200 \
npx hardhat run scripts/admin/tokens/UpdateOracles.ts

# Update price feed
TOKEN_CODE=USDC \
NEW_PRICE_FEED=0x... \
FULL_UPDATE=true \
npx hardhat run scripts/admin/tokens/UpdateOracles.ts

# Reset errors
TOKEN_CODE=USDC RESET_ERRORS=true \
npx hardhat run scripts/admin/tokens/UpdateOracles.ts
```

## 🔒 Security Considerations

- Only owner can execute these scripts
- WETH cannot be added as a regular token (system restriction)
- Price feed must be responsive before token registration
- Removing tokens with balance requires explicit force flag
- All operations are logged for audit trail

## 📊 Common Workflows

### Adding a New Token
1. Verify token contract address on Etherscan
2. Find corresponding Chainlink price feed
3. Verify price feed decimals match
4. Test with dry run first: `DRY_RUN=true`
5. Execute actual addition
6. Verify token is active with `ViewParameters.ts` or similar

### Updating Oracle After Migration
1. Verify new price feed is operational
2. Compare price data with old feed
3. Use `FULL_UPDATE=true` for price feed changes
4. Monitor for any price discrepancies
5. Reset error count if needed

### Emergency Token Removal
1. Check pool balance first
2. Attempt swap to convert token to other assets if possible
3. Use `FORCE_REMOVE=true` only if necessary
4. Document reason for forced removal
5. Consider emergency recovery procedures

## ⚠️ Common Errors

**"Cannot add WETH as token"**
- WETH is handled specially by the system
- Use the native ETH handling instead

**"Price feed data is stale"**
- Oracle hasn't updated recently
- Check heartbeat configuration
- Verify oracle is operational on-chain

**"Token has non-zero balance"**
- Pool holds tokens that would become inaccessible
- Swap tokens first or use `FORCE_REMOVE=true`

**"Invalid price feed address"**
- Address is not a valid Chainlink aggregator
- Test oracle connectivity before adding

## 🔗 Related Documentation

- [Phase 2 Complete Documentation](../../../docs/PHASE2_COMPLETE_DOCUMENTATION.md)
- [TokenManager Contract](../../../contracts/TokenManager.sol)
- [Implementation Checklist](../../../docs/10_project_management/IMPLEMENTATION_CHECKLIST.md)
