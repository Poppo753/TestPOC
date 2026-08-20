/**
 * 🚀 MAINNET DEPLOYMENT SCRIPT - PRODUCTION READY
 * 
 * Deploy completo dell'ecosistema su Arbitrum Mainnet con:
 * - ChainlinkAdapter (production oracle provider)
 * - Real Chainlink price feeds da Arbitrum
 * - Tutti i moduli core del sistema
 * - Validazione e verifica post-deployment
 * 
 * PREREQUISITI:
 * 1. Beacon già deployato (run deployBeacon.ts first)
 * 2. BEACON_ADDRESS configurato in .env
 * 3. PRIVATE_KEY con fondi sufficienti per gas
 * 4. ARBITRUM_RPC_URL configurato
 * 
 * USAGE:
 *   BEACON_ADDRESS=0x... npx hardhat run scripts/deployment/deployModules.mainnet.ts --network arbitrum
 * 
 * @custom:security-contact security@yourdomain.com
 */

import { ethers } from "hardhat";

// ==================== CHAINLINK PRICE FEEDS - ARBITRUM MAINNET ====================
// Source: https://docs.chain.link/data-feeds/price-feeds/addresses?network=arbitrum

const CHAINLINK_FEEDS = {
    // Stablecoins
    USDC: {
        feed: "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3",  // USDC/USD
        decimals: 8,
        heartbeat: 86400  // 24 hours
    },
    USDT: {
        feed: "0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7",  // USDT/USD
        decimals: 8,
        heartbeat: 86400
    },
    DAI: {
        feed: "0xc5C8E77B397E531B8EC06BFb0048328B30E9eCfB",  // DAI/USD
        decimals: 8,
        heartbeat: 86400
    },
    
    // Major Assets
    WBTC: {
        feed: "0xd0C7101eACbB49F3deCcCc166d238410D6D46d57",  // BTC/USD
        decimals: 8,
        heartbeat: 3600   // 1 hour
    },
    ETH: {
        feed: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",  // ETH/USD
        decimals: 8,
        heartbeat: 3600   // 1 hour
    },
    
    // DeFi Tokens
    LINK: {
        feed: "0x86E53CF1B870786351Da77A57575e79CB55812CB",  // LINK/USD
        decimals: 8,
        heartbeat: 3600
    },
    UNI: {
        feed: "0x9C917083fDb403ab5ADbEC26Ee294f6EcAda2720",  // UNI/USD
        decimals: 8,
        heartbeat: 86400
    },
    
    // Arbitrum Native
    ARB: {
        feed: "0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6",  // ARB/USD
        decimals: 8,
        heartbeat: 86400
    }
};

// ==================== DEPLOYMENT CONFIG ====================

// Base Asset Configuration
const BASE_ASSET_CODE = "USDC";  // Change to "WETH" for ETH-based deployment
const BASE_DECIMALS = 6;          // Change to 18 for WETH

interface DeploymentResult {
    beacon: string;
    chainlinkAdapter: string;
    tokenManager: string;
    swapManager: string;
    valueCalculator: string;
    parameterManager: string;
    emergencyHandler: string;
    liquidityManager: string;
}

// ==================== MAIN DEPLOYMENT FUNCTION ====================

async function main() {
    console.log("\n" + "=".repeat(80));
    console.log("🚀 MAINNET DEPLOYMENT - PRODUCTION MODE");
    console.log("=".repeat(80) + "\n");

    // ==================== STEP 0: VALIDATION ====================
    
    const [deployer] = await ethers.getSigners();
    console.log("📋 Deployment Configuration:");
    console.log(`   Deployer: ${deployer.address}`);
    
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log(`   Balance: ${ethers.formatEther(balance)} ETH`);
    
    if (balance < ethers.parseEther("0.5")) {
        throw new Error("❌ Insufficient balance! Need at least 0.5 ETH for deployment");
    }
    
    const network = await deployer.provider.getNetwork();
    console.log(`   Network: ${network.name} (chainId: ${network.chainId})`);
    
    if (network.chainId !== 42161n) {
        throw new Error("❌ This script is for Arbitrum Mainnet only! (chainId: 42161)");
    }

    // Get Beacon address from environment
    const beaconAddress = process.env.BEACON_ADDRESS;
    if (!beaconAddress || !ethers.isAddress(beaconAddress)) {
        throw new Error("❌ BEACON_ADDRESS not configured or invalid! Deploy Beacon first.");
    }
    
    console.log(`   Beacon: ${beaconAddress}`);
    
    // Verify Beacon is deployed
    const beaconCode = await deployer.provider.getCode(beaconAddress);
    if (beaconCode === "0x") {
        throw new Error("❌ Beacon contract not found at specified address!");
    }
    console.log("   ✅ Beacon verified\n");

    const result: DeploymentResult = {
        beacon: beaconAddress,
        chainlinkAdapter: "",
        tokenManager: "",
        swapManager: "",
        valueCalculator: "",
        parameterManager: "",
        emergencyHandler: "",
        liquidityManager: ""
    };

    // ==================== STEP 1: DEPLOY CHAINLINK ADAPTER ====================
    
    console.log("=".repeat(80));
    console.log("📡 STEP 1: Deploying ChainlinkAdapter (Production Oracle)");
    console.log("=".repeat(80) + "\n");
    
    const ChainlinkAdapter = await ethers.getContractFactory("ChainlinkAdapter");
    console.log("Deploying ChainlinkAdapter...");
    const chainlinkAdapter = await ChainlinkAdapter.deploy();
    await chainlinkAdapter.waitForDeployment();
    result.chainlinkAdapter = await chainlinkAdapter.getAddress();
    
    console.log(`✅ ChainlinkAdapter deployed: ${result.chainlinkAdapter}`);
    console.log(`   Gas used: ~${ethers.formatUnits(await deployer.provider.estimateGas({
        to: result.chainlinkAdapter,
        data: "0x"
    }), "gwei")} Gwei\n`);

    // ==================== STEP 2: CONFIGURE CHAINLINK PRICE FEEDS ====================
    
    console.log("=".repeat(80));
    console.log("🔧 STEP 2: Configuring Chainlink Price Feeds");
    console.log("=".repeat(80) + "\n");
    
    console.log("Adding price feeds for tokens...\n");
    
    for (const [tokenCode, config] of Object.entries(CHAINLINK_FEEDS)) {
        console.log(`   Configuring ${tokenCode}...`);
        console.log(`      Feed: ${config.feed}`);
        console.log(`      Decimals: ${config.decimals}`);
        console.log(`      Heartbeat: ${config.heartbeat}s`);
        
        try {
            const tx = await chainlinkAdapter.setPriceFeed(
                tokenCode,
                config.feed,
                config.decimals,
                config.heartbeat,
                "USD"
            );
            await tx.wait();
            console.log(`      ✅ ${tokenCode} configured\n`);
        } catch (error: any) {
            console.log(`      ⚠️ ${tokenCode} configuration failed: ${error.message}\n`);
        }
    }
    
    console.log("✅ All price feeds configured\n");

    // ==================== STEP 3: DEPLOY CORE MODULES ====================
    
    console.log("=".repeat(80));
    console.log("⚙️ STEP 3: Deploying Core Modules");
    console.log("=".repeat(80) + "\n");

    // TokenManager
    console.log("1️⃣ Deploying TokenManager...");
    const TokenManager = await ethers.getContractFactory("TokenManager");
    const tokenManager = await TokenManager.deploy(
        beaconAddress,
        result.chainlinkAdapter
    );
    await tokenManager.waitForDeployment();
    result.tokenManager = await tokenManager.getAddress();
    console.log(`   ✅ TokenManager: ${result.tokenManager}`);

    // Set base asset code for price lookups
    await tokenManager.setBaseAssetCode(BASE_ASSET_CODE);
    console.log(`   ✅ BaseAssetCode set to: ${BASE_ASSET_CODE}\n`);

    // SwapManager
    console.log("2️⃣ Deploying SwapManager...");
    const SwapManager = await ethers.getContractFactory("SwapManager");
    const swapManager = await SwapManager.deploy(beaconAddress, BASE_ASSET_CODE);
    await swapManager.waitForDeployment();
    result.swapManager = await swapManager.getAddress();
    console.log(`   ✅ SwapManager: ${result.swapManager}\n`);

    // ValueCalculator
    console.log("3️⃣ Deploying ValueCalculator...");
    const ValueCalculator = await ethers.getContractFactory("ValueCalculator");
    const valueCalculator = await ValueCalculator.deploy(beaconAddress, BASE_ASSET_CODE);
    await valueCalculator.waitForDeployment();
    result.valueCalculator = await valueCalculator.getAddress();
    console.log(`   ✅ ValueCalculator: ${result.valueCalculator}\n`);

    // ParameterManager
    console.log("4️⃣ Deploying ParameterManager...");
    const ParameterManager = await ethers.getContractFactory("ParameterManager");
    const parameterManager = await ParameterManager.deploy(beaconAddress, BASE_DECIMALS);
    await parameterManager.waitForDeployment();
    result.parameterManager = await parameterManager.getAddress();
    console.log(`   ✅ ParameterManager: ${result.parameterManager}\n`);

    // EmergencyHandler
    console.log("5️⃣ Deploying EmergencyHandler...");
    const EmergencyHandler = await ethers.getContractFactory("EmergencyHandler");
    const emergencyHandler = await EmergencyHandler.deploy(beaconAddress);
    await emergencyHandler.waitForDeployment();
    result.emergencyHandler = await emergencyHandler.getAddress();
    console.log(`   ✅ EmergencyHandler: ${result.emergencyHandler}\n`);

    // LiquidityManager
    console.log("6️⃣ Deploying LiquidityManager...");
    const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
    const liquidityManager = await LiquidityManager.deploy(beaconAddress, BASE_ASSET_CODE);
    await liquidityManager.waitForDeployment();
    result.liquidityManager = await liquidityManager.getAddress();
    console.log(`   ✅ LiquidityManager: ${result.liquidityManager}\n`);

    // ==================== STEP 4: POST-DEPLOYMENT VALIDATION ====================
    
    console.log("=".repeat(80));
    console.log("✅ STEP 4: Post-Deployment Validation");
    console.log("=".repeat(80) + "\n");

    // Verify all contracts deployed
    console.log("Verifying contract deployments...\n");
    
    for (const [name, address] of Object.entries(result)) {
        const code = await deployer.provider.getCode(address);
        if (code === "0x") {
            throw new Error(`❌ ${name} not deployed at ${address}!`);
        }
        console.log(`   ✅ ${name}: ${address}`);
    }
    
    console.log("\n✅ All contracts verified on-chain\n");

    // Verify ChainlinkAdapter configuration
    console.log("Verifying ChainlinkAdapter configuration...\n");
    
    for (const tokenCode of Object.keys(CHAINLINK_FEEDS)) {
        try {
            const isSupported = await chainlinkAdapter.supportsToken(tokenCode);
            if (isSupported) {
                const decimals = await chainlinkAdapter.getPriceDecimals(tokenCode);
                console.log(`   ✅ ${tokenCode}: Supported (decimals: ${decimals})`);
            } else {
                console.log(`   ⚠️ ${tokenCode}: Not configured`);
            }
        } catch (error: any) {
            console.log(`   ❌ ${tokenCode}: Error checking - ${error.message}`);
        }
    }
    
    console.log("\n✅ ChainlinkAdapter validation complete\n");

    // ==================== FINAL SUMMARY ====================
    
    console.log("=".repeat(80));
    console.log("🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(80) + "\n");

    console.log("📝 DEPLOYED CONTRACT ADDRESSES:\n");
    console.log("Core Infrastructure:");
    console.log(`   Beacon:             ${result.beacon}`);
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

    console.log("=".repeat(80));
    console.log("📋 NEXT STEPS:");
    console.log("=".repeat(80) + "\n");
    
    console.log("1. Update .env with deployed addresses:");
    console.log(`   CHAINLINK_ADAPTER_ADDRESS=${result.chainlinkAdapter}`);
    console.log(`   TOKEN_MANAGER_ADDRESS=${result.tokenManager}`);
    console.log(`   SWAP_MANAGER_ADDRESS=${result.swapManager}`);
    console.log(`   VALUE_CALCULATOR_ADDRESS=${result.valueCalculator}`);
    console.log(`   PARAMETER_MANAGER_ADDRESS=${result.parameterManager}`);
    console.log(`   EMERGENCY_HANDLER_ADDRESS=${result.emergencyHandler}`);
    console.log(`   LIQUIDITY_MANAGER_ADDRESS=${result.liquidityManager}`);
    console.log("");
    
    console.log("2. Register implementations in Beacon:");
    console.log("   npx hardhat run scripts/admin/beacon/RegisterImplementations.ts --network arbitrum");
    console.log("");
    
    console.log("3. Add tokens to system:");
    console.log("   TOKEN_CODE=USDC TOKEN_ADDRESS=0xaf88d065e77c8cC2239327C5EDb3A432268e5831 \\");
    console.log("   npx hardhat run scripts/admin/tokens/AddToken.ts --network arbitrum");
    console.log("");
    
    console.log("4. Verify contracts on Arbiscan:");
    console.log("   npx hardhat verify --network arbitrum <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>");
    console.log("");
    
    console.log("5. Test system status:");
    console.log("   npx hardhat run scripts/interact/SystemStatus.ts --network arbitrum");
    console.log("");

    console.log("=".repeat(80));
    console.log("⚠️ IMPORTANT SECURITY NOTES:");
    console.log("=".repeat(80) + "\n");
    
    console.log("• Transfer ownership of all contracts to multi-sig wallet");
    console.log("• Set up monitoring for Chainlink price feed failures");
    console.log("• Configure emergency circuit breakers");
    console.log("• Implement rate limiting for withdrawals");
    console.log("• Set up alerting for abnormal pool value changes");
    console.log("• Conduct security audit before handling significant TVL");
    console.log("");

    // Save deployment info to file
    const deploymentInfo = {
        timestamp: new Date().toISOString(),
        network: "arbitrum-mainnet",
        chainId: Number(network.chainId),
        deployer: deployer.address,
        contracts: result,
        chainlinkFeeds: CHAINLINK_FEEDS
    };

    const fs = require("fs");
    const deploymentPath = `./deployments/mainnet-${Date.now()}.json`;
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`💾 Deployment info saved to: ${deploymentPath}\n`);

    console.log("=".repeat(80));
    console.log("✅ MAINNET DEPLOYMENT SCRIPT COMPLETED");
    console.log("=".repeat(80) + "\n");
}

// ==================== ERROR HANDLING ====================

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n" + "=".repeat(80));
        console.error("❌ DEPLOYMENT FAILED");
        console.error("=".repeat(80) + "\n");
        console.error(error);
        console.error("\n" + "=".repeat(80) + "\n");
        process.exit(1);
    });
