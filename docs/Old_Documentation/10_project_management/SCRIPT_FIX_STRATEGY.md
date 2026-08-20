# 🛠️ STRATEGIA FIX SCRIPT PRIORITY 1

**Data:** 15 Novembre 2025  
**Target:** 4 script critici per deployment da zero  
**Effort Stimato:** 1-2 ore  
**Difficoltà:** ⚡ Facile (meccanico)

---

## 📋 CONTESTO

### Cambiamenti Breaking nel Sistema:

1. **TokenManager Constructor**: 
   - ❌ VECCHIO: `TokenManager.deploy()` (0 parametri)
   - ✅ NUOVO: `TokenManager.deploy(beaconAddress, oracleAdapterAddress)` (2 parametri)

2. **TokenManager.manageTokenData()**:
   - ❌ VECCHIO: 6 parametri `(tokenCode, tokenAddress, priceFeed, tokenDecimals, pfDecimals, heartbeat)`
   - ✅ NUOVO: 4 parametri `(tokenCode, tokenAddress, tokenDecimals, heartbeat)`
   - **Motivo**: Price feed configuration spostata in `IOracleAdapter`

3. **Oracle Architecture**:
   - ❌ VECCHIO: MockChainlinkOracle (monolitico)
   - ✅ NUOVO: MockOracleAdapter (implementa IOracleAdapter)
   - **Feature**: Plug & play oracle providers (Chainlink, Pyth, TWAP, etc.)

### Test Reference Pattern:
```typescript
// Pattern corretto da: test/unit/SwapManager.Phase1B.test.ts linee 28-35
const MockOracleAdapter = await ethers.getContractFactory("MockOracleAdapter");
const oracleAdapter = await MockOracleAdapter.deploy();

// Setup token nell'adapter PRIMA di registrarlo in TokenManager
await oracleAdapter.setupToken("USDC", priceInDecimals, decimals, true);

const TokenManager = await ethers.getContractFactory("TokenManager");
const tokenManager = await TokenManager.deploy(beaconAddress, oracleAdapterAddress);

// Registrazione semplificata (4 parametri)
await tokenManager.manageTokenData("USDC", usdcAddress, 6, 3600);
```

---

## 🎯 SCRIPT DA FIXARE (Priority 1)

### 1️⃣ **deployModules.ts** 🔥 CRITICA
**Path:** `scripts/OId/deployModules.ts`  
**Uso:** Deploy completo ecosistema da zero (FIRST DEPLOYMENT)  
**Status:** ❌ ROTTO - Constructor TokenManager

#### Problemi Identificati:
```typescript
// ❌ LINEA 12: Constructor senza parametri
const tokenManager = await TokenManager.deploy();
```

#### Soluzione Dettagliata:

**STEP 1: Deploy MockOracleAdapter PRIMA di TokenManager**
```typescript
// Deploy OracleAdapter (PRIMA dei moduli)
console.log("Deploying MockOracleAdapter...");
const MockOracleAdapter = await ethers.getContractFactory("MockOracleAdapter");
const oracleAdapter = await MockOracleAdapter.deploy();
await oracleAdapter.waitForDeployment();
console.log(`MockOracleAdapter deployed at: ${oracleAdapter.target}`);
```

**STEP 2: Configurare tokens comuni nell'adapter**
```typescript
// Setup token price feeds nell'adapter
// Arbitrum Mainnet Chainlink Feeds:
// USDC/USD: 0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3
// WBTC/USD: 0xd0C7101eACbB49F3deCcCc166d238410D6D46d57
// ETH/USD: 0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612

console.log("Setting up default tokens in OracleAdapter...");

// USDC: $1.00 (8 decimals = Chainlink standard)
await oracleAdapter.setupToken("USDC", ethers.parseUnits("1", 8), 8, true);

// WBTC: $42000.00 (8 decimals)
await oracleAdapter.setupToken("WBTC", ethers.parseUnits("42000", 8), 8, true);

// ETH: $3000.00 (8 decimals)
await oracleAdapter.setupToken("ETH", ethers.parseUnits("3000", 8), 8, true);

console.log("✅ OracleAdapter configured with default tokens");
```

**STEP 3: Deploy TokenManager con 2 parametri**
```typescript
// Deploy TokenManager.sol (DOPO OracleAdapter)
console.log("Deploying TokenManager...");
const TokenManager = await ethers.getContractFactory("TokenManager");
const tokenManager = await TokenManager.deploy(
    beaconAddress,
    await oracleAdapter.getAddress()
);
await tokenManager.waitForDeployment();
console.log(`TokenManager deployed at: ${tokenManager.target}`);
```

**STEP 4: Output finale con OracleAdapter address**
```typescript
console.log("\nDeployed module addresses:");
console.log(`Beacon: ${beaconAddress}`);
console.log(`OracleAdapter: ${oracleAdapter.target}`); // ✅ NUOVO
console.log(`TokenManager: ${tokenManager.target}`);
// ... altri moduli
```

#### File da modificare:
- `scripts/OId/deployModules.ts` (linee 9-15)

#### Test dopo fix:
```bash
npx hardhat run scripts/OId/deployModules.ts --network hardhat
```

#### Verifica successo:
- ✅ OracleAdapter deployed
- ✅ TokenManager deployed con 2 parametri
- ✅ Nessun errore "incorrect number of arguments"

---

### 2️⃣ **AddToken.ts** 🔥 CRITICA
**Path:** `scripts/admin/tokens/AddToken.ts`  
**Uso:** Aggiungere token a sistema GIÀ deployato  
**Status:** ❌ ROTTO - manageTokenData API obsoleta

#### Problemi Identificati:
```typescript
// ❌ LINEA 118: 6 parametri (include priceFeed)
this.contracts.tokenManager.manageTokenData(
    this.addOptions.tokenCode,
    this.addOptions.tokenAddress,
    this.addOptions.priceFeedAddress,  // ❌ NON PIÙ ACCETTATO
    this.addOptions.tokenDecimals!,
    this.addOptions.priceFeedDecimals!, // ❌ NON PIÙ ACCETTATO
    this.addOptions.heartbeat!
);
```

#### Soluzione Dettagliata:

**STEP 1: Aggiornare interface AddTokenOptions**
```typescript
interface AddTokenOptions extends ScriptOptions {
  tokenCode: string;
  tokenAddress: string;
  // ❌ REMOVE: priceFeedAddress: string;
  tokenDecimals?: number;
  // ❌ REMOVE: priceFeedDecimals?: number;
  heartbeat?: number;
  // ✅ NUOVO: Parametri per configurare OracleAdapter
  oraclePrice?: string;      // Es: "1.00" per USDC
  oracleDecimals?: number;   // Es: 8 per Chainlink
}
```

**STEP 2: Aggiornare customPreExecutionChecks()**
```typescript
// ❌ REMOVE: Validazione diretta price feed
// if (!ethers.isAddress(this.addOptions.priceFeedAddress)) {
//   throw new Error("Invalid price feed address");
// }

// ✅ NUOVO: Get OracleAdapter from TokenManager
const oracleAdapterAddress = await this.contracts.tokenManager.oracleAdapter();
const oracleAdapter = await ethers.getContractAt("IOracleAdapter", oracleAdapterAddress);

// Verify OracleAdapter già supporta il token OPPURE configuralo
const isSupported = await oracleAdapter.supportsToken(this.addOptions.tokenCode);
if (!isSupported) {
    Logger.warn(`⚠️ Token ${this.addOptions.tokenCode} non configurato in OracleAdapter`);
    Logger.warn("Configuralo PRIMA usando: oracleAdapter.setupToken()");
    throw new Error("Token not supported by OracleAdapter - configure it first");
}

// ✅ NUOVO: Test price retrieval from adapter
Logger.info("🔗 Testing OracleAdapter price retrieval...");
const [price, timestamp, isValid] = await oracleAdapter.getPrice(this.addOptions.tokenCode);
Logger.info(`Latest Price: ${ethers.formatUnits(price, await oracleAdapter.getPriceDecimals(this.addOptions.tokenCode))}`);
if (!isValid) {
    Logger.warn("⚠️ Price marked as stale by OracleAdapter");
}
```

**STEP 3: Aggiornare executeMain() - chiamata manageTokenData**
```typescript
// ✅ NUOVO: 4 parametri (senza priceFeed)
const result = await this.executeTransaction(
    this.contracts.tokenManager.manageTokenData(
        this.addOptions.tokenCode,
        this.addOptions.tokenAddress,
        this.addOptions.tokenDecimals!,
        this.addOptions.heartbeat!
    ),
    `Add Token ${this.addOptions.tokenCode}`
);
```

**STEP 4: Aggiornare customPostExecutionVerification()**
```typescript
// ✅ MODIFICARE: Validazione post-execution
const tokenInfo = await this.contracts.tokenManager.getTokenInfo(this.addOptions.tokenCode);
Logger.info("\n📊 Token Info:");
Logger.info(`   Token Address: ${tokenInfo.tokenAddress}`);
Logger.info(`   Token Decimals: ${tokenInfo.tokenDecimals}`);
// ❌ REMOVE: Logger.info(`   Price Feed: ${tokenInfo.priceFeed}`);
// ❌ REMOVE: Logger.info(`   Price Feed Decimals: ${tokenInfo.priceFeedDecimals}`);
Logger.info(`   Heartbeat: ${tokenInfo.heartbeat}s`);
Logger.info(`   Is Active: ${tokenInfo.isActive}`);

// ✅ NUOVO: Test price via OracleAdapter
const oracleAdapterAddress = await this.contracts.tokenManager.oracleAdapter();
const oracleAdapter = await ethers.getContractAt("IOracleAdapter", oracleAdapterAddress);
const [price, , isValid] = await oracleAdapter.getPrice(this.addOptions.tokenCode);
Logger.info(`   Current Price from Oracle: ${ethers.formatUnits(price, await oracleAdapter.getPriceDecimals(this.addOptions.tokenCode))} USD`);
```

**STEP 5: Aggiornare CLI main()**
```typescript
// ❌ REMOVE:
// const priceFeedAddress = process.env.PRICE_FEED_ADDRESS || "";
// const priceFeedDecimals = process.env.PRICE_FEED_DECIMALS ? parseInt(process.env.PRICE_FEED_DECIMALS) : 8;

// ✅ NUOVO: Istruzioni aggiornate
console.error("\nUsage:");
console.error("  TOKEN_CODE=USDC TOKEN_ADDRESS=0x... npx hardhat run scripts/admin/tokens/AddToken.ts");
console.error("\nOptional parameters:");
console.error("  TOKEN_DECIMALS=6 (default: 18)");
console.error("  HEARTBEAT=3600 (default: 3600 seconds)");
console.error("\nPREREQUISITE:");
console.error("  Token MUST be configured in OracleAdapter BEFORE running this script");
console.error("  Use: oracleAdapter.setupToken(tokenCode, price, decimals, true)");
```

#### File da modificare:
- `scripts/admin/tokens/AddToken.ts` (linee 18-25, 87-98, 118-126, 153-160, 210-225)

#### Test dopo fix:
```bash
# 1. Setup token in OracleAdapter (prerequisito)
# 2. Poi run AddToken
TOKEN_CODE=USDC TOKEN_ADDRESS=0xaf88d065e77c8cC2239327C5EDb3A432268e5831 npx hardhat run scripts/admin/tokens/AddToken.ts --network arbitrum
```

---

### 3️⃣ **UpdateOracles.ts** 🔥 CRITICA
**Path:** `scripts/admin/tokens/UpdateOracles.ts`  
**Uso:** Update oracle configuration per token esistente  
**Status:** ❌ ROTTO - manageTokenData per full update obsoleto

#### Problemi Identificati:
```typescript
// ❌ LINEA 135: Full update con 6 parametri
this.contracts.tokenManager.manageTokenData(
    this.updateOptions.tokenCode,
    tokenInfo.tokenAddress,
    this.updateOptions.newPriceFeed,  // ❌ NON PIÙ ACCETTATO
    tokenInfo.tokenDecimals,
    tokenInfo.priceFeedDecimals,      // ❌ NON PIÙ ACCETTATO
    this.updateOptions.newHeartbeat || tokenInfo.heartbeat
);
```

#### Soluzione Dettagliata:

**STEP 1: Aggiornare interface UpdateOraclesOptions**
```typescript
interface UpdateOraclesOptions extends ScriptOptions {
  tokenCode: string;
  // ❌ REMOVE: newPriceFeed?: string;
  newHeartbeat?: number;
  resetErrors?: boolean;
  // ❌ REMOVE: updateFullConfig?: boolean;
  // ✅ NUOVO: Per update price nell'adapter
  newOraclePrice?: string;  // Es: "42000" per WBTC
}
```

**STEP 2: Rimuovere logica "full config update"**
```typescript
// ❌ REMOVE tutto il blocco "if (updateFullConfig && newPriceFeed)"
// da linea 128-143

// ✅ NUOVO: Price updates vanno in OracleAdapter, non TokenManager
```

**STEP 3: Aggiornare executeMain() - logica corretta**
```typescript
protected async executeMain(): Promise<ScriptResult> {
    Logger.section(`Updating Configuration for: ${this.updateOptions.tokenCode}`);
    
    const results: ScriptResult[] = [];
    
    // ✅ NUOVO: Update price in OracleAdapter (if provided)
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
    
    // ✅ EXISTING: Update heartbeat in TokenManager (still correct)
    if (this.updateOptions.newHeartbeat) {
        Logger.info(`Updating heartbeat to ${this.updateOptions.newHeartbeat}s...`);
        
        const result = await this.executeTransaction(
            this.contracts.tokenManager.updateHeartbeat(
                this.updateOptions.tokenCode,
                this.updateOptions.newHeartbeat
            ),
            `Update Heartbeat`
        );
        
        results.push(result);
    }
    
    // ✅ EXISTING: Reset errors (still correct)
    if (this.updateOptions.resetErrors) {
        Logger.info("Resetting token error count...");
        
        const result = await this.executeTransaction(
            this.contracts.tokenManager.resetTokenErrors(this.updateOptions.tokenCode),
            `Reset Token Errors`
        );
        
        results.push(result);
    }
    
    // ... resto invariato
}
```

**STEP 4: Aggiornare customPreExecutionChecks()**
```typescript
// ❌ REMOVE: Validazione price feed address diretta
// if (this.updateOptions.newPriceFeed) { ... test priceFeed connectivity ... }

// ✅ NUOVO: Validazione nuovo price (se fornito)
if (this.updateOptions.newOraclePrice) {
    const price = parseFloat(this.updateOptions.newOraclePrice);
    if (price <= 0) {
        throw new Error("Price must be positive");
    }
    updates.push(`Oracle Price: ${this.updateOptions.newOraclePrice} USD`);
}
```

**STEP 5: Aggiornare CLI usage**
```typescript
console.error("\nParameters:");
console.error("  TOKEN_CODE         - Required: Token to update");
// ❌ REMOVE: console.error("  NEW_PRICE_FEED     - Optional: New Chainlink price feed address");
console.error("  NEW_ORACLE_PRICE   - Optional: New price in USD (es: '42000' for WBTC)");
console.error("  NEW_HEARTBEAT      - Optional: New heartbeat in seconds");
console.error("  RESET_ERRORS       - Optional: true to reset error count");
// ❌ REMOVE: console.error("  FULL_UPDATE        - Optional: true to use full config update");

console.error("\nExamples:");
console.error("  # Update heartbeat:");
console.error("  TOKEN_CODE=USDC NEW_HEARTBEAT=7200 npx hardhat run scripts/admin/tokens/UpdateOracles.ts");
console.error("\n  # Update oracle price:");
console.error("  TOKEN_CODE=WBTC NEW_ORACLE_PRICE=42000 npx hardhat run scripts/admin/tokens/UpdateOracles.ts");
```

#### File da modificare:
- `scripts/admin/tokens/UpdateOracles.ts` (linee 18-26, 86-105, 128-180, 238-255)

#### Test dopo fix:
```bash
TOKEN_CODE=USDC NEW_HEARTBEAT=7200 npx hardhat run scripts/admin/tokens/UpdateOracles.ts --network hardhat
```

---

### 4️⃣ **PopulateTestData.ts** 🔥 CRITICA
**Path:** `scripts/dev/testing/PopulateTestData.ts`  
**Uso:** Setup ambiente test completo su hardhat  
**Status:** ❌ ROTTO - MockChainlinkOracle + manageTokenData API

#### Problemi Identificati:
```typescript
// ❌ LINEA 104-111: Deploy MockChainlinkOracle invece di MockOracleAdapter
const MockChainlinkOracle = await ethers.getContractFactory("MockChainlinkOracle");
const mockOracle = await MockChainlinkOracle.deploy(...);

// ❌ LINEA 137: manageTokenData con 6 parametri
const tx2 = await this.contracts.tokenManager.manageTokenData(
    "USDC",
    result.mockTokens.USDC,
    result.mockOracle,  // ❌ NON PIÙ ACCETTATO
    6,
    8,                   // ❌ NON PIÙ ACCETTATO
    3600
);
```

#### Soluzione Dettagliata:

**STEP 1: Cambiare MockChainlinkOracle → MockOracleAdapter**
```typescript
// ✅ NUOVO: Deploy MockOracleAdapter (linea 104)
Logger.section("🔗 Deploying Mock Oracle Adapter");
const MockOracleAdapter = await ethers.getContractFactory("MockOracleAdapter");
const mockOracleAdapter = await MockOracleAdapter.deploy();
await mockOracleAdapter.waitForDeployment();
result.mockOracle = await mockOracleAdapter.getAddress();
Logger.success(`MockOracleAdapter deployed: ${result.mockOracle}`);
```

**STEP 2: Configurare tokens nell'adapter PRIMA di registrarli**
```typescript
// ✅ NUOVO: Setup tokens in OracleAdapter (PRIMA di manageTokenData)
Logger.section("🔧 Configuring Tokens in OracleAdapter");

// USDC: $1.00 (8 decimals)
Logger.info("Setting up USDC in OracleAdapter...");
await mockOracleAdapter.setupToken(
    "USDC",
    ethers.parseUnits("1", 8),  // $1.00
    8,                           // price decimals
    true                         // isValid
);

// WBTC: $42000.00 (8 decimals)
Logger.info("Setting up WBTC in OracleAdapter...");
await mockOracleAdapter.setupToken(
    "WBTC",
    ethers.parseUnits("42000", 8),  // $42000.00
    8,                               // price decimals
    true                             // isValid
);

Logger.success("✅ OracleAdapter configured with token prices");
```

**STEP 3: Aggiornare TokenManager deployment (se fatto nello script)**
```typescript
// Se lo script deploya anche TokenManager, aggiungere:
// ✅ PASS MockOracleAdapter to TokenManager constructor
const TokenManager = await ethers.getContractFactory("TokenManager");
const tokenManager = await TokenManager.deploy(
    beaconAddress,
    await mockOracleAdapter.getAddress()  // ✅ NUOVO parametro
);
```

**STEP 4: Aggiornare chiamate manageTokenData - 4 parametri**
```typescript
// ✅ NUOVO: Registra USDC (4 parametri, senza priceFeed)
Logger.info("Registering USDC in TokenManager...");
const tx2 = await this.contracts.tokenManager.manageTokenData(
    "USDC",
    result.mockTokens.USDC,
    6,      // token decimals
    3600    // heartbeat
);
await tx2.wait();
Logger.success("✅ USDC registered");

// ✅ NUOVO: Registra WBTC (4 parametri, senza priceFeed)
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

**STEP 5: Aggiornare interface TestDataResult**
```typescript
interface TestDataResult {
  mockTokens: {
    USDC: string;
    WBTC: string;
    WETH: string;
  };
  mockOracle: string;  // ✅ Ora è MockOracleAdapter address
  testUsers: string[];
  balancesMinted: {
    [address: string]: string;
  };
}
```

#### File da modificare:
- `scripts/dev/testing/PopulateTestData.ts` (linee 28-33, 104-120, 135-155)

#### Test dopo fix:
```bash
npx hardhat run scripts/dev/testing/PopulateTestData.ts --network hardhat
# Verificare: OracleAdapter deployed, tokens configured, manageTokenData calls success
```

---

## 🔄 PATTERN DI FIX UNIVERSALE

### Template per OGNI script che usa TokenManager:

```typescript
// ========================================
// PATTERN 1: DEPLOY DA ZERO (deployModules.ts)
// ========================================

// 1. Deploy MockOracleAdapter PRIMA
const MockOracleAdapter = await ethers.getContractFactory("MockOracleAdapter");
const oracleAdapter = await MockOracleAdapter.deploy();

// 2. Setup tokens comuni
await oracleAdapter.setupToken("USDC", ethers.parseUnits("1", 8), 8, true);
await oracleAdapter.setupToken("WBTC", ethers.parseUnits("42000", 8), 8, true);

// 3. Deploy TokenManager con oracleAdapter
const TokenManager = await ethers.getContractFactory("TokenManager");
const tokenManager = await TokenManager.deploy(
    beaconAddress,
    await oracleAdapter.getAddress()
);

// ========================================
// PATTERN 2: SISTEMA GIÀ DEPLOYATO (AddToken.ts, UpdateOracles.ts)
// ========================================

// 1. Get OracleAdapter from TokenManager
const oracleAdapterAddress = await tokenManager.oracleAdapter();
const oracleAdapter = await ethers.getContractAt("IOracleAdapter", oracleAdapterAddress);

// 2. Verificare supporto token
const isSupported = await oracleAdapter.supportsToken("NEWTOKEN");
if (!isSupported) {
    throw new Error("Configure token in OracleAdapter first!");
}

// 3. Registrare in TokenManager (4 parametri)
await tokenManager.manageTokenData(
    "NEWTOKEN",
    tokenAddress,
    decimals,
    heartbeat
);

// ========================================
// PATTERN 3: UPDATE PRICE (UpdateOracles.ts)
// ========================================

// Price updates vanno in OracleAdapter, NON in TokenManager
const oracleAdapterAddress = await tokenManager.oracleAdapter();
const oracleAdapter = await ethers.getContractAt("MockOracleAdapter", oracleAdapterAddress);

// Update price
await oracleAdapter.setPrice("WBTC", ethers.parseUnits("45000", 8));

// Heartbeat updates restano in TokenManager
await tokenManager.updateHeartbeat("WBTC", 7200);
```

---

## ✅ CHECKLIST PER OGNI SCRIPT

### Pre-fix:
- [ ] Identificare tutte le chiamate `manageTokenData()` nello script
- [ ] Identificare deployment di `TokenManager` (se presente)
- [ ] Identificare uso di `MockChainlinkOracle` (sostituire con `MockOracleAdapter`)
- [ ] Verificare test file di riferimento per pattern corretto

### Durante fix:
- [ ] Aggiornare imports se necessario
- [ ] Aggiornare interfaces/options
- [ ] Fixare constructor calls
- [ ] Fixare manageTokenData calls (6 → 4 parametri)
- [ ] Aggiornare validazioni pre/post execution
- [ ] Aggiornare CLI usage instructions

### Post-fix:
- [ ] Compilare: `npx hardhat compile`
- [ ] Test su hardhat network
- [ ] Verificare output logging corretto
- [ ] Verificare nessun errore "incorrect number of arguments"
- [ ] Verificare nessun errore "Token not supported by oracle"

---

## 🧪 TESTING STRATEGY

### 1. Test Individuale per Script:

```bash
# Test deployModules.ts
npx hardhat run scripts/OId/deployModules.ts --network hardhat

# Test PopulateTestData.ts (dipende da deployModules)
npx hardhat run scripts/dev/testing/PopulateTestData.ts --network hardhat

# Test AddToken.ts (richiede sistema deployato)
TOKEN_CODE=TEST TOKEN_ADDRESS=0x... npx hardhat run scripts/admin/tokens/AddToken.ts --network hardhat

# Test UpdateOracles.ts (richiede token esistente)
TOKEN_CODE=USDC NEW_HEARTBEAT=7200 npx hardhat run scripts/admin/tokens/UpdateOracles.ts --network hardhat
```

### 2. Test Integrato (Full Workflow):

```bash
# 1. Deploy completo
npx hardhat run scripts/OId/deployBeacon.ts --network hardhat
npx hardhat run scripts/OId/deployModules.ts --network hardhat

# 2. Populate test data
npx hardhat run scripts/dev/testing/PopulateTestData.ts --network hardhat

# 3. Test interact scripts
npx hardhat run scripts/interact/SystemStatus.ts --network hardhat
npx hardhat run scripts/interact/DepositETH.ts --network hardhat

# 4. Verificare tutto funziona
npx hardhat test test/unit/TokenManager.test.ts
```

### 3. Validation Checklist:

```bash
# Dopo ogni fix, verificare:
✅ Compile success
✅ No TypeScript errors
✅ Script execution success
✅ Correct addresses logged
✅ Transactions confirmed
✅ Post-execution verifications passed
```

---

## 📊 EFFORT BREAKDOWN

| Script | Complexity | Lines to Change | Time Estimate |
|--------|------------|-----------------|---------------|
| deployModules.ts | ⚡ Easy | ~20 lines | 15 min |
| AddToken.ts | ⚡ Easy | ~40 lines | 20 min |
| UpdateOracles.ts | ⚡⚡ Medium | ~50 lines | 25 min |
| PopulateTestData.ts | ⚡ Easy | ~30 lines | 15 min |
| **Testing** | - | - | 20 min |
| **TOTALE** | - | **~140 lines** | **1h 35min** |

---

## 🚀 DEPLOYMENT WORKFLOW COMPLETO (DOPO FIX)

### Scenario: Deploy da zero su Arbitrum Testnet

```bash
# FASE 1: Setup Beacon
npx hardhat run scripts/OId/deployBeacon.ts --network arbitrumSepolia
# Output: BEACON_ADDRESS=0x...

# FASE 2: Deploy Modules (OracleAdapter + tutti i moduli)
# Edit .env: BEACON_ADDRESS=0x...
npx hardhat run scripts/OId/deployModules.ts --network arbitrumSepolia
# Output: ORACLE_ADAPTER=0x..., TOKEN_MANAGER=0x..., etc.

# FASE 3: Register Beacon Implementations
# ... existing beacon registration scripts ...

# FASE 4: Setup Tokens (se necessario aggiungere tokens custom)
TOKEN_CODE=CUSTOM TOKEN_ADDRESS=0x... npx hardhat run scripts/admin/tokens/AddToken.ts --network arbitrumSepolia

# FASE 5: Verify System
npx hardhat run scripts/interact/SystemStatus.ts --network arbitrumSepolia

# FASE 6: Test Basic Operations
npx hardhat run scripts/interact/DepositETH.ts --network arbitrumSepolia
```

---

## 📝 NOTES IMPORTANTI

1. **Order Matters**: OracleAdapter DEVE essere deployato e configurato PRIMA di TokenManager
2. **Token Setup**: Tokens DEVONO essere configurati in OracleAdapter PRIMA di chiamare manageTokenData()
3. **Backward Compatibility**: TokenManager ha overload legacy di manageTokenData() per compatibilità, ma ignora i parametri price feed
4. **Testing**: Tutti i test esistenti già usano il pattern corretto (MockOracleAdapter + 4 parametri)
5. **Production**: Su mainnet, usare ChainlinkAdapter invece di MockOracleAdapter

---

## 🎯 SUCCESS CRITERIA

### Script fixati sono considerati SUCCESS se:

✅ **Compilazione**: Zero errori TypeScript  
✅ **Execution**: Script completa senza errori  
✅ **Validation**: Pre/post checks passano  
✅ **Integration**: Funziona con altri script del sistema  
✅ **Testing**: Test suite passa (se applicabile)  

### System-wide SUCCESS:

✅ Deploy completo da zero funziona (beacon → modules → tokens)  
✅ Scripts interact/ funzionano con nuovo setup  
✅ Test suite completa passa (38/38 tests)  
✅ Documentazione aggiornata  

---

**📌 NEXT STEPS:**

1. [ ] Fix deployModules.ts
2. [ ] Fix AddToken.ts  
3. [ ] Fix UpdateOracles.ts
4. [ ] Fix PopulateTestData.ts
5. [ ] Test workflow completo su hardhat
6. [ ] Update documentation
7. [ ] Commit changes con messaggio descrittivo

**Ready to fix! 🚀**
