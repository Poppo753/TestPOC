# ⚡ QUICK FIX REFERENCE - Script Priority 1

**Ultimo update:** 15 Novembre 2025  
**4 script da fixare in 1-2 ore**

---

## 🎯 TL;DR - COSA CAMBIARE

### Pattern Universale:

```typescript
// ❌ VECCHIO (6 parametri)
await tokenManager.manageTokenData(
    tokenCode, 
    tokenAddress, 
    priceFeedAddress,    // ❌ REMOVE
    tokenDecimals, 
    priceFeedDecimals,   // ❌ REMOVE
    heartbeat
);

// ✅ NUOVO (4 parametri)
await tokenManager.manageTokenData(
    tokenCode,
    tokenAddress,
    tokenDecimals,
    heartbeat
);
```

### Constructor Pattern:

```typescript
// ❌ VECCHIO
const tokenManager = await TokenManager.deploy();

// ✅ NUOVO (2 parametri)
const oracleAdapter = await MockOracleAdapter.deploy();
const tokenManager = await TokenManager.deploy(
    beaconAddress,
    await oracleAdapter.getAddress()
);
```

---

## 📋 4 SCRIPT - EXACT CHANGES

### 1️⃣ deployModules.ts (linea 9-15)

**File:** `scripts/OId/deployModules.ts`

**SEARCH FOR:**
```typescript
    console.log("Deploying modules...");

    // Deploy TokenManager.sol
    console.log("Deploying TokenManager...");
    const TokenManager = await ethers.getContractFactory("TokenManager");
    const tokenManager = await TokenManager.deploy();
    await tokenManager.waitForDeployment();
```

**REPLACE WITH:**
```typescript
    console.log("Deploying modules...");

    // Deploy MockOracleAdapter FIRST
    console.log("Deploying MockOracleAdapter...");
    const MockOracleAdapter = await ethers.getContractFactory("MockOracleAdapter");
    const oracleAdapter = await MockOracleAdapter.deploy();
    await oracleAdapter.waitForDeployment();
    console.log(`MockOracleAdapter deployed at: ${oracleAdapter.target}`);
    
    // Setup default tokens in OracleAdapter
    console.log("Configuring default tokens...");
    await oracleAdapter.setupToken("USDC", ethers.parseUnits("1", 8), 8, true);
    await oracleAdapter.setupToken("WBTC", ethers.parseUnits("42000", 8), 8, true);
    await oracleAdapter.setupToken("ETH", ethers.parseUnits("3000", 8), 8, true);
    console.log("✅ OracleAdapter configured");

    // Deploy TokenManager.sol
    console.log("Deploying TokenManager...");
    const TokenManager = await ethers.getContractFactory("TokenManager");
    const tokenManager = await TokenManager.deploy(
        beaconAddress,
        await oracleAdapter.getAddress()
    );
    await tokenManager.waitForDeployment();
```

**ALSO UPDATE OUTPUT (linea 55):**
```typescript
    console.log("\nDeployed module addresses:");
    console.log(`Beacon: ${beaconAddress}`);
    console.log(`OracleAdapter: ${oracleAdapter.target}`); // ✅ ADD THIS
    console.log(`TokenManager: ${tokenManager.target}`);
```

---

### 2️⃣ AddToken.ts (5 cambiamenti)

**File:** `scripts/admin/tokens/AddToken.ts`

#### CHANGE 1: Interface (linea 18)
```typescript
// ❌ REMOVE these lines:
  priceFeedAddress: string;
  priceFeedDecimals?: number;
```

#### CHANGE 2: Pre-checks (linea 87-98)
```typescript
// ❌ REMOVE:
    if (!ethers.isAddress(this.addOptions.priceFeedAddress)) {
      throw new Error("Invalid price feed address");
    }

// ❌ REMOVE logging:
    Logger.info(`Price Feed: ${this.addOptions.priceFeedAddress}`);
    Logger.info(`Price Feed Decimals: ${this.addOptions.priceFeedDecimals}`);

// ❌ REMOVE price feed validation section (linee 92-108)

// ✅ ADD invece:
    // Get OracleAdapter and verify token support
    const oracleAdapterAddress = await this.contracts.tokenManager.oracleAdapter();
    const oracleAdapter = await ethers.getContractAt("IOracleAdapter", oracleAdapterAddress);
    
    const isSupported = await oracleAdapter.supportsToken(this.addOptions.tokenCode);
    if (!isSupported) {
        throw new Error(`Token ${this.addOptions.tokenCode} not configured in OracleAdapter. Configure it first using oracleAdapter.setupToken()`);
    }
    
    Logger.info("🔗 Testing OracleAdapter price retrieval...");
    const [price, timestamp, isValid] = await oracleAdapter.getPrice(this.addOptions.tokenCode);
    const decimals = await oracleAdapter.getPriceDecimals(this.addOptions.tokenCode);
    Logger.info(`Latest Price: ${ethers.formatUnits(price, decimals)}`);
    if (!isValid) {
        Logger.warn("⚠️ Price marked as stale by OracleAdapter");
    }
```

#### CHANGE 3: executeMain() (linea 118)
```typescript
// ❌ REPLACE:
      this.contracts.tokenManager.manageTokenData(
        this.addOptions.tokenCode,
        this.addOptions.tokenAddress,
        this.addOptions.priceFeedAddress,
        this.addOptions.tokenDecimals!,
        this.addOptions.priceFeedDecimals!,
        this.addOptions.heartbeat!
      ),

// ✅ WITH:
      this.contracts.tokenManager.manageTokenData(
        this.addOptions.tokenCode,
        this.addOptions.tokenAddress,
        this.addOptions.tokenDecimals!,
        this.addOptions.heartbeat!
      ),
```

#### CHANGE 4: Post-verification (linea 153-160)
```typescript
// ❌ REMOVE these lines:
    Logger.info(`   Price Feed: ${tokenInfo.priceFeed}`);
    Logger.info(`   Price Feed Decimals: ${tokenInfo.priceFeedDecimals}`);

// ✅ ADD instead:
    // Get price from OracleAdapter
    const oracleAdapterAddress = await this.contracts.tokenManager.oracleAdapter();
    const oracleAdapter = await ethers.getContractAt("IOracleAdapter", oracleAdapterAddress);
    const [price, , isValid] = await oracleAdapter.getPrice(this.addOptions.tokenCode);
    const decimals = await oracleAdapter.getPriceDecimals(this.addOptions.tokenCode);
    Logger.info(`   Current Price: ${ethers.formatUnits(price, decimals)} USD`);
```

#### CHANGE 5: CLI main() (linea 210-225)
```typescript
// ❌ REMOVE:
  const priceFeedAddress = process.env.PRICE_FEED_ADDRESS || "";
  const priceFeedDecimals = process.env.PRICE_FEED_DECIMALS ? parseInt(process.env.PRICE_FEED_DECIMALS) : 8;

// ❌ REMOVE from error message:
    console.error("  TOKEN_CODE=USDC TOKEN_ADDRESS=0x... PRICE_FEED_ADDRESS=0x... npx hardhat run scripts/admin/tokens/AddToken.ts");
    console.error("  PRICE_FEED_DECIMALS=8 (default: 8)");

// ✅ REPLACE WITH:
    console.error("  TOKEN_CODE=USDC TOKEN_ADDRESS=0x... npx hardhat run scripts/admin/tokens/AddToken.ts");
    console.error("\nPREREQUISITE:");
    console.error("  Token MUST be configured in OracleAdapter before running this script.");
    console.error("  Use: oracleAdapter.setupToken(tokenCode, price, decimals, true)");

// ❌ REMOVE from condition:
  if (!tokenAddress || !priceFeedAddress) {

// ✅ REPLACE WITH:
  if (!tokenAddress) {
```

---

### 3️⃣ UpdateOracles.ts (4 cambiamenti)

**File:** `scripts/admin/tokens/UpdateOracles.ts`

#### CHANGE 1: Interface (linea 18)
```typescript
// ❌ REMOVE:
  newPriceFeed?: string;
  updateFullConfig?: boolean;

// ✅ ADD:
  newOraclePrice?: string;  // New price in USD (e.g., "42000")
```

#### CHANGE 2: executeMain() - REMOVE full update (linea 128-143)
```typescript
// ❌ DELETE ENTIRE BLOCK:
    // If full config update with new price feed, use manageTokenData
    if (this.updateOptions.updateFullConfig && this.updateOptions.newPriceFeed) {
      // ... tutto il blocco fino a line 143
    } else {

// ✅ REPLACE WITH:
    const results: ScriptResult[] = [];
    
    // Update price in OracleAdapter (if provided)
    if (this.updateOptions.newOraclePrice) {
        Logger.info("Updating price in OracleAdapter...");
        
        const oracleAdapterAddress = await this.contracts.tokenManager.oracleAdapter();
        const oracleAdapter = await ethers.getContractAt("MockOracleAdapter", oracleAdapterAddress);
        
        const decimals = await oracleAdapter.getPriceDecimals(this.updateOptions.tokenCode);
        const priceInDecimals = ethers.parseUnits(this.updateOptions.newOraclePrice, decimals);
        
        const result = await this.executeTransaction(
            oracleAdapter.setPrice(this.updateOptions.tokenCode, priceInDecimals),
            `Update Oracle Price`
        );
        
        results.push(result);
    }
    
    // Update heartbeat (existing logic - keep as is)
    if (this.updateOptions.newHeartbeat) {
```

#### CHANGE 3: Pre-checks (linea 86-105)
```typescript
// ❌ REMOVE tutto il blocco "Validate new price feed" (linee 86-105)

// ✅ ADD invece:
    if (this.updateOptions.newOraclePrice) {
        const price = parseFloat(this.updateOptions.newOraclePrice);
        if (price <= 0) {
            throw new Error("Price must be positive");
        }
        updates.push(`Oracle Price: ${this.updateOptions.newOraclePrice} USD`);
    }
```

#### CHANGE 4: CLI usage (linea 238-255)
```typescript
// ❌ REMOVE:
  const newPriceFeed = process.env.NEW_PRICE_FEED;
  const updateFullConfig = process.env.FULL_UPDATE === "true";

// ✅ ADD:
  const newOraclePrice = process.env.NEW_ORACLE_PRICE;

// UPDATE error messages:
    console.error("  NEW_ORACLE_PRICE   - Optional: New price in USD (e.g., '42000')");
    // ❌ REMOVE: console.error("  NEW_PRICE_FEED     - Optional: New Chainlink price feed address");
    // ❌ REMOVE: console.error("  FULL_UPDATE        - Optional: true to use full config update");

// UPDATE examples:
    console.error("\n  # Update oracle price:");
    console.error("  TOKEN_CODE=WBTC NEW_ORACLE_PRICE=42000 npx hardhat run scripts/admin/tokens/UpdateOracles.ts");

// UPDATE condition:
  if (!newOraclePrice && !newHeartbeat && !resetErrors) {
    console.error("Provide: NEW_ORACLE_PRICE, NEW_HEARTBEAT, or RESET_ERRORS=true");
```

---

### 4️⃣ PopulateTestData.ts (3 cambiamenti)

**File:** `scripts/dev/testing/PopulateTestData.ts`

#### CHANGE 1: Deploy OracleAdapter (linea 104-111)
```typescript
// ❌ REPLACE:
      Logger.section("🔗 Deploying Mock Oracle");
      const MockChainlinkOracle = await ethers.getContractFactory("MockChainlinkOracle");
      const mockOracle = await MockChainlinkOracle.deploy(
        ethers.parseUnits("2000", 8),
        8,
        "ETH/USD"
      );

// ✅ WITH:
      Logger.section("🔗 Deploying Mock Oracle Adapter");
      const MockOracleAdapter = await ethers.getContractFactory("MockOracleAdapter");
      const mockOracleAdapter = await MockOracleAdapter.deploy();
      await mockOracleAdapter.waitForDeployment();
      result.mockOracle = await mockOracleAdapter.getAddress();
      Logger.success(`MockOracleAdapter deployed: ${result.mockOracle}`);
      
      // Setup tokens in OracleAdapter
      Logger.section("🔧 Configuring Tokens in OracleAdapter");
      await mockOracleAdapter.setupToken("USDC", ethers.parseUnits("1", 8), 8, true);
      await mockOracleAdapter.setupToken("WBTC", ethers.parseUnits("42000", 8), 8, true);
      Logger.success("✅ OracleAdapter configured");
```

#### CHANGE 2: TokenManager deployment (se presente)
```typescript
// ✅ Se lo script deploya TokenManager, aggiungere secondo parametro:
const tokenManager = await TokenManager.deploy(
    beaconAddress,
    await mockOracleAdapter.getAddress()  // ✅ ADD THIS
);
```

#### CHANGE 3: manageTokenData calls (linea 137, 149)
```typescript
// ❌ REPLACE BOTH:
        const tx2 = await this.contracts.tokenManager.manageTokenData(
          "USDC",
          result.mockTokens.USDC,
          result.mockOracle,  // ❌ REMOVE
          6,
          8,                   // ❌ REMOVE
          3600
        );

// ✅ WITH:
        Logger.info("Registering USDC in TokenManager...");
        const tx2 = await this.contracts.tokenManager.manageTokenData(
          "USDC",
          result.mockTokens.USDC,
          6,      // token decimals
          3600    // heartbeat
        );
        await tx2.wait();
        Logger.success("✅ USDC registered");

// Same for WBTC (linea 149)
        Logger.info("Registering WBTC in TokenManager...");
        const tx3 = await this.contracts.tokenManager.manageTokenData(
          "WBTC",
          result.mockTokens.WBTC,
          8,      // token decimals
          3600    // heartbeat
        );
        await tx3.wait();
        Logger.success("✅ WBTC registered");
```

---

## ✅ TESTING COMMANDS

```bash
# Compile first
npx hardhat compile

# Test each script
npx hardhat run scripts/OId/deployModules.ts --network hardhat
npx hardhat run scripts/dev/testing/PopulateTestData.ts --network hardhat

# Test integrated workflow
npx hardhat test test/unit/TokenManager.test.ts
npx hardhat test test/unit/SwapManager.Phase1B.test.ts
```

---

## 🚨 COMMON ERRORS & FIXES

### Error: "incorrect number of arguments"
**Fix:** Constructor TokenManager richiede 2 parametri (beacon, oracleAdapter)

### Error: "Token not supported by oracle"
**Fix:** Configurare token in OracleAdapter PRIMA di chiamare manageTokenData()
```typescript
await oracleAdapter.setupToken(tokenCode, price, decimals, true);
```

### Error: "Cannot find module 'MockChainlinkOracle'"
**Fix:** Usare `MockOracleAdapter` invece

---

## 📝 CRITICAL NOTES

1. **Order**: OracleAdapter → TokenManager (sempre in questo ordine)
2. **Token Setup**: setupToken() PRIMA di manageTokenData()
3. **Price Updates**: Vanno in OracleAdapter, NON in TokenManager
4. **Heartbeat Updates**: Restano in TokenManager (updateHeartbeat())

---

**Ready to fix! Segui l'ordine: deployModules → AddToken → UpdateOracles → PopulateTestData** 🚀
