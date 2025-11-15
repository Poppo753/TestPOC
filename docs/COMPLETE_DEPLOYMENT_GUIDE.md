# 🎯 GUIDA COMPLETA AL DEPLOYMENT - TUTTI I CONTRATTI

Questa guida copre il deployment **COMPLETO** di tutti i contratti del sistema su Arbitrum Mainnet.

---

## 📊 ARCHITETTURA COMPLETA DEL SISTEMA

### 🏗️ **LIVELLO 1: INFRASTRUCTURE (2 contratti)**

| # | Contratto | Descrizione | Constructor Args |
|---|-----------|-------------|------------------|
| 1 | **Beacon** | Registry centrale di tutti i moduli | Nessuno |
| 2 | **ProxyGeneral** | LP Token (ERC20) + Proxy per modularity | `(beacon, "LiquidityPool Token", "LPT")` |

### 🔧 **LIVELLO 2: ORACLE LAYER (1 contratto)**

| # | Contratto | Descrizione | Constructor Args |
|---|-----------|-------------|------------------|
| 3 | **ChainlinkAdapter** | Oracle adapter per Chainlink price feeds | Nessuno |

### ⚙️ **LIVELLO 3: CORE MODULES (6 contratti)**

| # | Contratto | Descrizione | Constructor Args |
|---|-----------|-------------|------------------|
| 4 | **TokenManager** | Token registry + oracle integration | `(beacon, chainlinkAdapter)` |
| 5 | **SwapManager** | DEX routing + swap execution | `(beacon)` |
| 6 | **ValueCalculator** | Pool valuation + pricing | `(beacon)` |
| 7 | **ParameterManager** | System parameters | `(beacon)` |
| 8 | **EmergencyHandler** | Emergency pause/recovery | `(beacon)` |
| 9 | **LiquidityManager** | Deposit/withdraw logic | `(beacon)` |

### 🔌 **LIVELLO 4: SWAP PLUGINS (1+ contratti)**

| # | Contratto | Descrizione | Constructor Args |
|---|-----------|-------------|------------------|
| 10 | **UniswapV3Plugin** | Uniswap V3 integration | `(swapRouter, quoter)` |
| 11 | *Altri plugins* | Camelot, Odos, etc. (opzionali) | Varia |

### 📝 **TOTALE: 10-12 contratti deployati**

---

## 🚀 DEPLOYMENT WORKFLOW COMPLETO

### ⚙️ **SETUP INIZIALE**

#### 1. Configura `.env`
```bash
# Network
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
PRIVATE_KEY=your_private_key_without_0x

# API Keys
ARBISCAN_API_KEY=your_arbiscan_api_key

# Uniswap V3 Addresses (Arbitrum Mainnet)
UNISWAP_V3_ROUTER=0xE592427A0AEce92De3Edee1F18E0157C05861564
UNISWAP_V3_QUOTER=0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6
```

#### 2. Verifica Balance
```bash
npx hardhat run scripts/utils/CheckBalance.ts --network arbitrum
# Output: ✅ Balance sufficient for deployment (0.8 ETH)
```

---

## 📋 FASE 1: INFRASTRUCTURE DEPLOYMENT

### **STEP 1.1: Deploy Beacon** ⭐

Il Beacon è il **registry centrale** - deployalo PRIMA di tutto.

```bash
npx hardhat run scripts/OId/deployBeacon.ts --network arbitrum
```

**Output:**
```
Beacon deployed to: 0x1234567890abcdef...
```

**✅ Action:**
```bash
# Aggiungi a .env
BEACON_ADDRESS=0x1234567890abcdef...
```

---

### **STEP 1.2: Deploy ProxyGeneral** (LP Token)

ProxyGeneral è l'**ERC20 LP Token** che gli utenti ricevono quando depositano.

**Crea script:** `scripts/core/deployProxyGeneral.ts`

```typescript
import { ethers } from "hardhat";

async function main() {
    const beaconAddress = process.env.BEACON_ADDRESS;
    if (!beaconAddress) throw new Error("BEACON_ADDRESS not set!");

    console.log("Deploying ProxyGeneral (LP Token)...");
    
    const ProxyGeneral = await ethers.getContractFactory("ProxyGeneral");
    const proxyGeneral = await ProxyGeneral.deploy(
        beaconAddress,
        "Liquidity Pool Token",  // Token name
        "LPT"                     // Token symbol
    );
    
    await proxyGeneral.waitForDeployment();
    console.log(`ProxyGeneral deployed: ${proxyGeneral.target}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
```

**Run:**
```bash
npx hardhat run scripts/core/deployProxyGeneral.ts --network arbitrum
```

**Output:**
```
ProxyGeneral deployed: 0xabcdef1234567890...
```

**✅ Action:**
```bash
# Aggiungi a .env
PROXY_GENERAL_ADDRESS=0xabcdef1234567890...
```

---

## 📡 FASE 2: ORACLE LAYER DEPLOYMENT

### **STEP 2.1: Deploy ChainlinkAdapter**

Questo è **incluso** nello script `deployModules.mainnet.ts` che hai già, MA puoi anche deployarlo separatamente:

**Crea script:** `scripts/oracle/deployChainlinkAdapter.ts`

```typescript
import { ethers } from "hardhat";

const CHAINLINK_FEEDS = {
    USDC: { feed: "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3", decimals: 8, heartbeat: 86400 },
    USDT: { feed: "0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7", decimals: 8, heartbeat: 86400 },
    DAI:  { feed: "0xc5C8E77B397E531B8EC06BFb0048328B30E9eCfB", decimals: 8, heartbeat: 86400 },
    WBTC: { feed: "0xd0C7101eACbB49F3deCcCc166d238410D6D46d57", decimals: 8, heartbeat: 3600 },
    ETH:  { feed: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612", decimals: 8, heartbeat: 3600 },
    LINK: { feed: "0x86E53CF1B870786351Da77A57575e79CB55812CB", decimals: 8, heartbeat: 3600 },
    UNI:  { feed: "0x9C917083fDb403ab5ADbEC26Ee294f6EcAda2720", decimals: 8, heartbeat: 86400 },
    ARB:  { feed: "0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6", decimals: 8, heartbeat: 86400 }
};

async function main() {
    console.log("Deploying ChainlinkAdapter...");
    
    const ChainlinkAdapter = await ethers.getContractFactory("ChainlinkAdapter");
    const adapter = await ChainlinkAdapter.deploy();
    await adapter.waitForDeployment();
    
    console.log(`ChainlinkAdapter deployed: ${adapter.target}`);
    console.log("\nConfiguring price feeds...");
    
    for (const [token, config] of Object.entries(CHAINLINK_FEEDS)) {
        console.log(`  Configuring ${token}...`);
        const tx = await adapter.addPriceFeed(token, config.feed, config.decimals, config.heartbeat);
        await tx.wait();
        console.log(`    ✅ ${token} configured`);
    }
    
    console.log("\n✅ ChainlinkAdapter ready!");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
```

**Run:**
```bash
npx hardhat run scripts/oracle/deployChainlinkAdapter.ts --network arbitrum
```

**✅ Action:**
```bash
# Aggiungi a .env
CHAINLINK_ADAPTER_ADDRESS=0x...
```

---

## ⚙️ FASE 3: CORE MODULES DEPLOYMENT

### **STEP 3: Deploy ALL Core Modules**

Usa lo script che abbiamo creato (include ChainlinkAdapter deployment):

```bash
npx hardhat run scripts/deployment/deployModules.mainnet.ts --network arbitrum
```

Questo deploya in un colpo solo:
- ✅ ChainlinkAdapter (se non l'hai già fatto)
- ✅ TokenManager
- ✅ SwapManager
- ✅ ValueCalculator
- ✅ ParameterManager
- ✅ EmergencyHandler
- ✅ LiquidityManager

**Output:**
```
🚀 MAINNET DEPLOYMENT - PRODUCTION MODE
================================================================================

📡 STEP 1: Deploying ChainlinkAdapter
✅ ChainlinkAdapter deployed: 0x...

🔧 STEP 2: Configuring Chainlink Price Feeds
✅ All 8 price feeds configured

⚙️ STEP 3: Deploying Core Modules
1️⃣ ✅ TokenManager: 0x...
2️⃣ ✅ SwapManager: 0x...
3️⃣ ✅ ValueCalculator: 0x...
4️⃣ ✅ ParameterManager: 0x...
5️⃣ ✅ EmergencyHandler: 0x...
6️⃣ ✅ LiquidityManager: 0x...

🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!
```

**✅ Action:**
```bash
# Aggiungi TUTTI questi addresses a .env
CHAINLINK_ADAPTER_ADDRESS=0x...
TOKEN_MANAGER_ADDRESS=0x...
SWAP_MANAGER_ADDRESS=0x...
VALUE_CALCULATOR_ADDRESS=0x...
PARAMETER_MANAGER_ADDRESS=0x...
EMERGENCY_HANDLER_ADDRESS=0x...
LIQUIDITY_MANAGER_ADDRESS=0x...
```

---

## 🔌 FASE 4: SWAP PLUGINS DEPLOYMENT

### **STEP 4.1: Deploy UniswapV3Plugin**

**Crea script:** `scripts/plugins/deployUniswapV3Plugin.ts`

```typescript
import { ethers } from "hardhat";

async function main() {
    console.log("Deploying UniswapV3Plugin...");
    
    const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";  // Arbitrum mainnet
    const UNISWAP_V3_QUOTER = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";  // Arbitrum mainnet
    
    const UniswapV3Plugin = await ethers.getContractFactory("UniswapV3Plugin");
    const plugin = await UniswapV3Plugin.deploy(
        UNISWAP_V3_ROUTER,
        UNISWAP_V3_QUOTER
    );
    
    await plugin.waitForDeployment();
    console.log(`✅ UniswapV3Plugin deployed: ${plugin.target}`);
    
    // Verify it works
    const router = await plugin.swapRouter();
    const quoter = await plugin.quoter();
    console.log(`   Router: ${router}`);
    console.log(`   Quoter: ${quoter}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
```

**Run:**
```bash
npx hardhat run scripts/plugins/deployUniswapV3Plugin.ts --network arbitrum
```

**✅ Action:**
```bash
# Aggiungi a .env
UNISWAP_V3_PLUGIN_ADDRESS=0x...
```

---

## 🔗 FASE 5: LINKING & CONFIGURATION

### **STEP 5.1: Register Implementations in Beacon**

Collega tutti i moduli core al Beacon:

```bash
npx hardhat run scripts/admin/beacon/RegisterImplementations.ts --network arbitrum
```

**Output:**
```
📝 Registering TokenManager...
   ✅ Registered successfully
📝 Registering SwapManager...
   ✅ Registered successfully
[... altri 4 moduli ...]

REGISTRATION SUMMARY
✅ Successfully registered: 6/6
```

---

### **STEP 5.2: Register Swap Plugin in SwapManager**

**Crea script:** `scripts/admin/swaps/RegisterPlugin.ts`

```typescript
import { ethers } from "hardhat";

async function main() {
    const swapManagerAddress = process.env.SWAP_MANAGER_ADDRESS;
    const pluginAddress = process.env.UNISWAP_V3_PLUGIN_ADDRESS;
    
    if (!swapManagerAddress || !pluginAddress) {
        throw new Error("SWAP_MANAGER_ADDRESS or UNISWAP_V3_PLUGIN_ADDRESS not set!");
    }
    
    console.log("Registering UniswapV3Plugin in SwapManager...");
    
    const swapManager = await ethers.getContractAt("SwapManager", swapManagerAddress);
    
    // Register plugin
    const tx = await swapManager.registerSwapPlugin("UniswapV3", pluginAddress);
    await tx.wait();
    
    console.log("✅ Plugin registered!");
    
    // Set as active
    const tx2 = await swapManager.setActiveSwapPlugin("UniswapV3");
    await tx2.wait();
    
    console.log("✅ Plugin set as active!");
    
    // Verify
    const activePlugin = await swapManager.getActiveSwapPlugin();
    console.log(`Current active plugin: ${activePlugin}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
```

**Run:**
```bash
npx hardhat run scripts/admin/swaps/RegisterPlugin.ts --network arbitrum
```

---

### **STEP 5.3: Link ProxyGeneral to LiquidityManager**

ProxyGeneral deve sapere chi è il LiquidityManager:

**Crea script:** `scripts/admin/proxy/LinkLiquidityManager.ts`

```typescript
import { ethers } from "hardhat";

async function main() {
    const proxyAddress = process.env.PROXY_GENERAL_ADDRESS;
    const lmAddress = process.env.LIQUIDITY_MANAGER_ADDRESS;
    
    if (!proxyAddress || !lmAddress) {
        throw new Error("Addresses not configured!");
    }
    
    console.log("Linking ProxyGeneral to LiquidityManager...");
    
    const proxy = await ethers.getContractAt("ProxyGeneral", proxyAddress);
    
    // Set LiquidityManager as authorized minter/burner
    const tx = await proxy.setLiquidityManager(lmAddress);
    await tx.wait();
    
    console.log("✅ LiquidityManager linked!");
    
    // Verify
    const lm = await proxy.liquidityManager();
    console.log(`LiquidityManager set to: ${lm}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
```

**Run:**
```bash
npx hardhat run scripts/admin/proxy/LinkLiquidityManager.ts --network arbitrum
```

---

## 🪙 FASE 6: TOKEN REGISTRATION

### **STEP 6: Add Tokens to System**

Registra i token principali (USDC, WBTC, ETH, USDT):

```bash
# USDC
TOKEN_CODE=USDC \
TOKEN_ADDRESS=0xaf88d065e77c8cC2239327C5EDb3A432268e5831 \
npx hardhat run scripts/admin/tokens/AddToken.ts --network arbitrum

# WBTC
TOKEN_CODE=WBTC \
TOKEN_ADDRESS=0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f \
npx hardhat run scripts/admin/tokens/AddToken.ts --network arbitrum

# ETH (WETH)
TOKEN_CODE=ETH \
TOKEN_ADDRESS=0x82aF49447D8a07e3bd95BD0d56f35241523fBab1 \
npx hardhat run scripts/admin/tokens/AddToken.ts --network arbitrum

# USDT
TOKEN_CODE=USDT \
TOKEN_ADDRESS=0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9 \
npx hardhat run scripts/admin/tokens/AddToken.ts --network arbitrum
```

---

## ✅ FASE 7: VERIFICATION & TESTING

### **STEP 7.1: System Health Check**

```bash
npx hardhat run scripts/utils/DeploymentSummary.ts --network arbitrum
```

**Output atteso:**
```
📊 DEPLOYMENT SUMMARY
================================================================================
✅ Beacon: 0x...
✅ ProxyGeneral: 0x...
✅ ChainlinkAdapter: 0x...
✅ TokenManager: 0x...
✅ SwapManager: 0x...
✅ ValueCalculator: 0x...
✅ ParameterManager: 0x...
✅ EmergencyHandler: 0x...
✅ LiquidityManager: 0x...
✅ UniswapV3Plugin: 0x...

Deployment Status: 10/10 contracts deployed
Beacon Status: 6/6 implementations registered
Oracle Status: 8/8 price feeds configured
Token Status: 4/4 tokens active

🎉 SYSTEM READY FOR PRODUCTION!
```

---

### **STEP 7.2: Test Deposit**

```bash
npx hardhat run scripts/interact/DepositETH.ts --network arbitrum
```

**Output atteso:**
```
💰 ETH Deposit Script
Pre-Deposit State
   Pool Value: 0.0 ETH
   User LP Balance: 0.0 LP

Executing Deposit
   Depositing: 0.1 ETH
   ✅ Transaction confirmed

Post-Deposit State
   New Pool Value: 0.099 ETH
   New LP Balance: 100.0 LP
   ✅ LP Tokens Received: 100.0 LP
```

---

### **STEP 7.3: Test Withdrawal**

```bash
npx hardhat run scripts/interact/WithdrawETH.ts --network arbitrum
```

---

## 🔐 FASE 8: SECURITY & FINALIZATION

### **STEP 8.1: Verify All Contracts on Arbiscan**

```bash
# Beacon
npx hardhat verify --network arbitrum <BEACON_ADDRESS>

# ProxyGeneral
npx hardhat verify --network arbitrum <PROXY_ADDRESS> \
    <BEACON_ADDRESS> "Liquidity Pool Token" "LPT"

# ChainlinkAdapter
npx hardhat verify --network arbitrum <CHAINLINK_ADAPTER_ADDRESS>

# TokenManager
npx hardhat verify --network arbitrum <TOKEN_MANAGER_ADDRESS> \
    <BEACON_ADDRESS> <CHAINLINK_ADAPTER_ADDRESS>

# Altri moduli (tutti con solo beacon)
npx hardhat verify --network arbitrum <SWAP_MANAGER_ADDRESS> <BEACON_ADDRESS>
npx hardhat verify --network arbitrum <VALUE_CALCULATOR_ADDRESS> <BEACON_ADDRESS>
npx hardhat verify --network arbitrum <PARAMETER_MANAGER_ADDRESS> <BEACON_ADDRESS>
npx hardhat verify --network arbitrum <EMERGENCY_HANDLER_ADDRESS> <BEACON_ADDRESS>
npx hardhat verify --network arbitrum <LIQUIDITY_MANAGER_ADDRESS> <BEACON_ADDRESS>

# UniswapV3Plugin
npx hardhat verify --network arbitrum <UNISWAP_V3_PLUGIN_ADDRESS> \
    "0xE592427A0AEce92De3Edee1F18E0157C05861564" \
    "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6"
```

---

### **STEP 8.2: Transfer Ownership to Multi-Sig**

⚠️ **CRITICO:** Fai questo step SOLO quando sei sicuro che tutto funzioni!

```bash
# Prepara multi-sig address (es. Gnosis Safe)
MULTISIG_ADDRESS=0x_your_safe_wallet

# Transfer ownership di OGNI contratto
npx hardhat run scripts/admin/ownership/TransferOwnership.ts --network arbitrum
```

---

## 📊 RECAP COMPLETO DEPLOYMENT

### **Ordine di Deployment:**

```
FASE 1: INFRASTRUCTURE
  1. Beacon                    ← Deploy PRIMO
  2. ProxyGeneral              ← LP Token

FASE 2: ORACLE
  3. ChainlinkAdapter          ← Configure 8 price feeds

FASE 3: CORE MODULES (tutti richiedono Beacon)
  4. TokenManager              ← Richiede ChainlinkAdapter
  5. SwapManager
  6. ValueCalculator
  7. ParameterManager
  8. EmergencyHandler
  9. LiquidityManager

FASE 4: PLUGINS
  10. UniswapV3Plugin          ← Register in SwapManager

FASE 5: LINKING
  - Register 6 implementations in Beacon
  - Register plugin in SwapManager
  - Link ProxyGeneral ↔ LiquidityManager

FASE 6: TOKENS
  - Add USDC, WBTC, ETH, USDT

FASE 7: TESTING
  - Health check
  - Test deposit
  - Test withdrawal

FASE 8: SECURITY
  - Verify all contracts on Arbiscan
  - Transfer ownership to multi-sig
```

---

## 💰 COSTI TOTALI STIMATI

| Fase | Componenti | Costo Stimato |
|------|-----------|---------------|
| Fase 1 | Beacon + ProxyGeneral | ~0.002 ETH |
| Fase 2 | ChainlinkAdapter + config | ~0.012 ETH |
| Fase 3 | 6 Core Modules | ~0.024 ETH |
| Fase 4 | UniswapV3Plugin | ~0.002 ETH |
| Fase 5 | Linking (3 ops) | ~0.003 ETH |
| Fase 6 | Add 4 tokens | ~0.004 ETH |
| **TOTALE** | **10 contratti + config** | **~0.047 ETH** |
| **Buffer 20%** | | **~0.056 ETH** |

**Consigliato:** Avere **0.5 ETH** per sicurezza.

---

## ✅ SUCCESS CHECKLIST

```
PRE-DEPLOYMENT
[ ] Balance wallet ≥ 0.5 ETH
[ ] .env configurato (RPC, PRIVATE_KEY, ARBISCAN_API)
[ ] Testato su Arbitrum Sepolia testnet

DEPLOYMENT
[ ] Beacon deployato
[ ] ProxyGeneral deployato
[ ] ChainlinkAdapter deployato + 8 feeds configurati
[ ] 6 Core Modules deployati
[ ] UniswapV3Plugin deployato
[ ] 6 implementations registrati in Beacon
[ ] Plugin registrato in SwapManager
[ ] ProxyGeneral ↔ LiquidityManager linkati
[ ] 4 tokens registrati (USDC, WBTC, ETH, USDT)

TESTING
[ ] DeploymentSummary: 10/10 contracts deployed
[ ] Test deposit success
[ ] Test withdrawal success
[ ] System Status check passed

SECURITY
[ ] All 10 contracts verified su Arbiscan
[ ] Ownership transferred to multi-sig
[ ] Monitoring configured
[ ] Circuit breakers tested
```

---

## 🆘 QUICK TROUBLESHOOTING

**"Constructor argument count mismatch"**
→ Verifica che stai passando i parametri corretti al constructor

**"Token not supported by OracleAdapter"**
→ Il token non è configurato in ChainlinkAdapter, aggiungilo con `addPriceFeed()`

**"Implementation not registered in Beacon"**
→ Run: `npx hardhat run scripts/admin/beacon/RegisterImplementations.ts`

**"ProxyGeneral: Unauthorized"**
→ ProxyGeneral non è linkato a LiquidityManager, esegui LinkLiquidityManager.ts

---

**🎉 Sistema completo deployato e funzionante!**

Hai deployato **10 contratti** su Arbitrum Mainnet con tutte le integrazioni necessarie per:
- ✅ Deposits/Withdrawals ETH
- ✅ Token swaps via Uniswap V3
- ✅ Oracle pricing via Chainlink
- ✅ Emergency pause system
- ✅ Modularity via Beacon pattern

**Ready for production!** 🚀
