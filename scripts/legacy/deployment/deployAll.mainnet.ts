/**
 * 🚀 MASTER DEPLOYMENT SCRIPT - DEPLOY TUTTO IL SISTEMA
 * 
 * Questo script deploya l'INTERO sistema in sequenza automatica:
 * - Beacon (infrastructure)
 * - ProxyGeneral (LP token)
 * - ChainlinkAdapter + 8 price feeds
 * - 6 Core Modules
 * - UniswapV3Plugin
 * - Linking & Configuration
 * 
 * PREREQUISITI:
 * 1. .env configurato con PRIVATE_KEY, ARBITRUM_RPC_URL, ARBISCAN_API_KEY
 * 2. Wallet con almeno 0.000005 ETH
 * 3. Arbitrum Mainnet (chainId: 42161)s
 * 
 * USAGE:
 *   npx hardhat run scripts/deployment/deployAll.mainnet.ts --network arbitrum
 * 
 * ⚠️ ATTENZIONE: Questo script deploya TUTTO. Usa con cautela!
 */

import { ethers } from "hardhat";

// Chainlink Price Feeds - Arbitrum Mainnet
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

// Base Asset Configuration
const BASE_ASSET_CODE = "USDC";  // Change to "WETH" for ETH-based deployment
const BASE_DECIMALS = 6;          // Change to 18 for WETH

// Uniswap V3 Addresses - Arbitrum Mainnet
const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const UNISWAP_V3_QUOTER = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";

// Token Addresses - Arbitrum Mainnet
const TOKENS = {
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
    ETH:  "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"
};

interface DeploymentResult {
    beacon: string;
    proxyGeneral: string;
    chainlinkAdapter: string;
    tokenManager: string;
    swapManager: string;
    valueCalculator: string;
    parameterManager: string;
    emergencyHandler: string;
    liquidityManager: string;
    uniswapV3Plugin: string;
}

async function main() {
    console.log("\n" + "=".repeat(100));
    console.log("🚀 MASTER DEPLOYMENT - COMPLETE SYSTEM");
    console.log("=".repeat(100) + "\n");

    const [deployer] = await ethers.getSigners();
    const network = await deployer.provider.getNetwork();

    // Validation
    console.log("📋 Pre-Deployment Validation:");
    console.log(`   Deployer: ${deployer.address}`);
    
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log(`   Balance: ${ethers.formatEther(balance)} ETH`);
    
    if (balance < ethers.parseEther("0.000005")) {
        throw new Error("❌ Insufficient balance! Need at least 0.000005 ETH");
    }
    
    console.log(`   Network: ${network.name} (chainId: ${network.chainId})`);
    
    if (network.chainId !== 42161n) {
        throw new Error("❌ Wrong network! This script is for Arbitrum Mainnet only (chainId: 42161)");
    }
    
    console.log("   ✅ Validation passed\n");

    const result: DeploymentResult = {
        beacon: "",
        proxyGeneral: "",
        chainlinkAdapter: "",
        tokenManager: "",
        swapManager: "",
        valueCalculator: "",
        parameterManager: "",
        emergencyHandler: "",
        liquidityManager: "",
        uniswapV3Plugin: ""
    };

    // ==================== FASE 1: INFRASTRUCTURE ====================
    console.log("=".repeat(100));
    console.log("🏗️ FASE 1: INFRASTRUCTURE DEPLOYMENT");
    console.log("=".repeat(100) + "\n");

    // Deploy Beacon
    console.log("1️⃣ Deploying Beacon...");
    const Beacon = await ethers.getContractFactory("Beacon");
    const beacon = await Beacon.deploy();
    await beacon.waitForDeployment();
    result.beacon = await beacon.getAddress();
    console.log(`   ✅ Beacon: ${result.beacon}\n`);

    // Deploy ProxyGeneral
    console.log("2️⃣ Deploying ProxyGeneral (LP Token)...");
    const ProxyGeneral = await ethers.getContractFactory("ProxyGeneral");
    const proxyGeneral = await ProxyGeneral.deploy(result.beacon, BASE_ASSET_CODE);
    await proxyGeneral.waitForDeployment();
    result.proxyGeneral = await proxyGeneral.getAddress();
    console.log(`   ✅ ProxyGeneral: ${result.proxyGeneral}\n`);

    // ==================== FASE 2: ORACLE LAYER ====================
    console.log("=".repeat(100));
    console.log("📡 FASE 2: ORACLE LAYER DEPLOYMENT");
    console.log("=".repeat(100) + "\n");

    console.log("3️⃣ Deploying ChainlinkAdapter...");
    const ChainlinkAdapter = await ethers.getContractFactory("ChainlinkAdapter");
    const chainlinkAdapter = await ChainlinkAdapter.deploy();
    await chainlinkAdapter.waitForDeployment();
    result.chainlinkAdapter = await chainlinkAdapter.getAddress();
    console.log(`   ✅ ChainlinkAdapter: ${result.chainlinkAdapter}`);

    console.log("\n   Configuring price feeds...");
    for (const [token, config] of Object.entries(CHAINLINK_FEEDS)) {
        console.log(`      Adding ${token}...`);
        const tx = await chainlinkAdapter.setPriceFeed(token, config.feed, config.decimals, config.heartbeat, "USD");
        await tx.wait();
        console.log(`      ✅ ${token} configured`);
    }
    console.log("   ✅ All price feeds configured\n");

    // ==================== FASE 3: CORE MODULES ====================
    console.log("=".repeat(100));
    console.log("⚙️ FASE 3: CORE MODULES DEPLOYMENT");
    console.log("=".repeat(100) + "\n");

    // TokenManager
    console.log("4️⃣ Deploying TokenManager...");
    const TokenManager = await ethers.getContractFactory("TokenManager");
    const tokenManager = await TokenManager.deploy(result.beacon, result.chainlinkAdapter);
    await tokenManager.waitForDeployment();
    result.tokenManager = await tokenManager.getAddress();
    console.log(`   ✅ TokenManager: ${result.tokenManager}`);

    // Set base asset code for price lookups
    await tokenManager.setBaseAssetCode(BASE_ASSET_CODE);
    console.log(`   ✅ BaseAssetCode set to: ${BASE_ASSET_CODE}\n`);

    // SwapManager
    console.log("5️⃣ Deploying SwapManager...");
    const SwapManager = await ethers.getContractFactory("SwapManager");
    const swapManager = await SwapManager.deploy(result.beacon, BASE_ASSET_CODE);
    await swapManager.waitForDeployment();
    result.swapManager = await swapManager.getAddress();
    console.log(`   ✅ SwapManager: ${result.swapManager}\n`);

    // ValueCalculator
    console.log("6️⃣ Deploying ValueCalculator...");
    const ValueCalculator = await ethers.getContractFactory("ValueCalculator");
    const valueCalculator = await ValueCalculator.deploy(result.beacon, BASE_ASSET_CODE);
    await valueCalculator.waitForDeployment();
    result.valueCalculator = await valueCalculator.getAddress();
    console.log(`   ✅ ValueCalculator: ${result.valueCalculator}\n`);

    // ParameterManager
    console.log("7️⃣ Deploying ParameterManager...");
    const ParameterManager = await ethers.getContractFactory("ParameterManager");
    const parameterManager = await ParameterManager.deploy(result.beacon, BASE_DECIMALS);
    await parameterManager.waitForDeployment();
    result.parameterManager = await parameterManager.getAddress();
    console.log(`   ✅ ParameterManager: ${result.parameterManager}\n`);

    // EmergencyHandler
    console.log("8️⃣ Deploying EmergencyHandler...");
    const EmergencyHandler = await ethers.getContractFactory("EmergencyHandler");
    const emergencyHandler = await EmergencyHandler.deploy(result.beacon);
    await emergencyHandler.waitForDeployment();
    result.emergencyHandler = await emergencyHandler.getAddress();
    console.log(`   ✅ EmergencyHandler: ${result.emergencyHandler}\n`);

    // LiquidityManager
    console.log("9️⃣ Deploying LiquidityManager...");
    const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
    const liquidityManager = await LiquidityManager.deploy(result.beacon, BASE_ASSET_CODE);
    await liquidityManager.waitForDeployment();
    result.liquidityManager = await liquidityManager.getAddress();
    console.log(`   ✅ LiquidityManager: ${result.liquidityManager}\n`);

    // ==================== FASE 4: SWAP PLUGINS ====================
    console.log("=".repeat(100));
    console.log("🔌 FASE 4: SWAP PLUGINS DEPLOYMENT");
    console.log("=".repeat(100) + "\n");

    console.log("🔟 Deploying UniswapV3Plugin...");
    const UniswapV3Plugin = await ethers.getContractFactory("UniswapV3Plugin");
    const uniswapV3Plugin = await UniswapV3Plugin.deploy(UNISWAP_V3_ROUTER);  // Solo SimpleSwap address
    await uniswapV3Plugin.waitForDeployment();
    result.uniswapV3Plugin = await uniswapV3Plugin.getAddress();
    console.log(`   ✅ UniswapV3Plugin: ${result.uniswapV3Plugin}\n`);

    // ==================== FASE 5: AUTHORIZATION ====================
    console.log("=".repeat(100));
    console.log("🔗 FASE 5: MODULE AUTHORIZATION");
    console.log("=".repeat(100) + "\n");

    // Authorize LiquidityManager in ProxyGeneral
    console.log("Authorizing LiquidityManager in ProxyGeneral...");
    const authTx = await proxyGeneral.authorizeModule(result.liquidityManager, "LiquidityManager");
    await authTx.wait();
    console.log("   ✅ LiquidityManager authorized\n");

    // ==================== FINAL SUMMARY ====================
    console.log("=".repeat(100));
    console.log("🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(100) + "\n");

    console.log("📝 DEPLOYED CONTRACT ADDRESSES:\n");
    console.log("Infrastructure:");
    console.log(`   Beacon:             ${result.beacon}`);
    console.log(`   ProxyGeneral:       ${result.proxyGeneral}`);
    console.log("");
    console.log("Oracle Layer:");
    console.log(`   ChainlinkAdapter:   ${result.chainlinkAdapter}`);
    console.log("");
    console.log("Core Modules:");
    console.log(`   TokenManager:       ${result.tokenManager}`);
    console.log(`   SwapManager:        ${result.swapManager}`);
    console.log(`   ValueCalculator:    ${result.valueCalculator}`);
    console.log(`   ParameterManager:   ${result.parameterManager}`);
    console.log(`   EmergencyHandler:   ${result.emergencyHandler}`);
    console.log(`   LiquidityManager:   ${result.liquidityManager}`);
    console.log("");
    console.log("Swap Plugins:");
    console.log(`   UniswapV3Plugin:    ${result.uniswapV3Plugin}`);
    console.log("");

    // Save deployment info
    const deploymentInfo = {
        timestamp: new Date().toISOString(),
        network: "arbitrum-mainnet",
        chainId: Number(network.chainId),
        deployer: deployer.address,
        contracts: result,
        chainlinkFeeds: CHAINLINK_FEEDS,
        tokens: TOKENS
    };

    const fs = require("fs");
    const deploymentPath = `./deployments/complete-${Date.now()}.json`;
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`💾 Deployment info saved to: ${deploymentPath}\n`);

    console.log("=".repeat(100));
    console.log("📋 NEXT STEPS - CONFIGURATION:");
    console.log("=".repeat(100) + "\n");
    console.log("1. Update .env with all deployed addresses");
    console.log("");
    console.log("2. Register implementations in Beacon:");
    console.log("   npx hardhat run scripts/admin/beacon/RegisterImplementations.ts --network arbitrum");
    console.log("");
    console.log("3. Register tokens (use AddToken.ts for each token):");
    console.log("   TOKEN_CODE=USDC TOKEN_ADDRESS=0xaf88d065... npx hardhat run scripts/admin/tokens/AddToken.ts --network arbitrum");
    console.log("   TOKEN_CODE=WBTC TOKEN_ADDRESS=0x2f2a2543... npx hardhat run scripts/admin/tokens/AddToken.ts --network arbitrum");
    console.log("   TOKEN_CODE=ETH TOKEN_ADDRESS=0x82aF4944... npx hardhat run scripts/admin/tokens/AddToken.ts --network arbitrum");
    console.log("   TOKEN_CODE=USDT TOKEN_ADDRESS=0xFd086bC7... npx hardhat run scripts/admin/tokens/AddToken.ts --network arbitrum");
    console.log("");
    console.log("4. Verify contracts on Arbiscan");
    console.log("");
    console.log("5. Test deposit:");
    console.log("   npx hardhat run scripts/interact/DepositETH.ts --network arbitrum");
    console.log("");
    console.log("6. Transfer ownership to multi-sig wallet");
    console.log("");

    console.log("=".repeat(100));
    console.log("✅ SYSTEM READY FOR PRODUCTION!");
    console.log("=".repeat(100) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n" + "=".repeat(100));
        console.error("❌ DEPLOYMENT FAILED");
        console.error("=".repeat(100) + "\n");
        console.error(error);
        console.error("\n" + "=".repeat(100) + "\n");
        process.exit(1);
    });
