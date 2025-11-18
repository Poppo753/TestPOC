import { ethers } from "hardhat";

/**
 * Deploy DolomitePlugin to Arbitrum One
 * 
 * PREREQUISITES:
 * 1. Verify contract addresses on https://docs.dolomite.io/smart-contract-addresses
 * 2. Ensure .env has ARBITRUM_RPC_URL and PRIVATE_KEY
 * 3. Ensure deployer wallet has ETH for gas
 * 
 * DEPLOYMENT FLOW:
 * 1. Deploy DolomitePlugin with Dolomite protocol addresses
 * 2. Verify contract on Arbiscan
 * 3. Register in Beacon (separate script)
 */

async function main() {
    console.log("========================================");
    console.log("  DolomitePlugin Deployment (Phase 1)  ");
    console.log("========================================\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying from address:", deployer.address);

    // Check balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Deployer balance:", ethers.formatEther(balance), "ETH\n");

    if (balance < ethers.parseEther("0.0001")) {
        console.error("❌ Insufficient balance! Need at least 0.0001 ETH for deployment");
        process.exit(1);
    }

    // ==================== ARBITRUM ONE ADDRESSES ====================
    
    /**
     * DOLOMITE PROTOCOL ADDRESSES (Arbitrum One)
     * Source: https://docs.dolomite.io/smart-contract-addresses
     * 
     * ⚠️ VERIFY THESE BEFORE DEPLOYMENT! ⚠️
     * Check official docs for latest addresses
     */
    
    const DOLOMITE_MARGIN = "0x6Bd780E7fDf01D77e4d475c821f1e7AE05409072";
    
    // Source: https://docs.dolomite.io/smart-contract-addresses/core-routers
    // Verified: November 18, 2025
    const BORROW_POSITION_ROUTER = "0xF579b345cdA0860668b857De10ABD62442133D0F";
    const DEPOSIT_WITHDRAWAL_ROUTER = "0xf8b2c637a68cf6a17b1df9f8992eebeff63d2dff"; // DepositWithdrawalRouter
    
    console.log("📋 Dolomite Protocol Addresses:");
    console.log("   DolomiteMargin:", DOLOMITE_MARGIN);
    console.log("   BorrowPositionRouter:", BORROW_POSITION_ROUTER);
    console.log("   DepositWithdrawalRouter:", DEPOSIT_WITHDRAWAL_ROUTER);
    console.log("");

    // ==================== DEPLOYMENT ====================

    console.log("🚀 Deploying DolomitePlugin...\n");

    const DolomitePlugin = await ethers.getContractFactory("DolomitePlugin");
    
    const plugin = await DolomitePlugin.deploy(
        DOLOMITE_MARGIN,
        BORROW_POSITION_ROUTER,
        DEPOSIT_WITHDRAWAL_ROUTER
    );

    await plugin.waitForDeployment();
    const pluginAddress = await plugin.getAddress();

    console.log("✅ DolomitePlugin deployed successfully!");
    console.log("   Address:", pluginAddress);
    console.log("");

    // ==================== VERIFICATION ====================

    console.log("📝 Contract Verification Command:");
    console.log("");
    console.log(`npx hardhat verify --network arbitrum ${pluginAddress} \\`);
    console.log(`    ${DOLOMITE_MARGIN} \\`);
    console.log(`    ${BORROW_POSITION_ROUTER} \\`);
    console.log(`    ${DEPOSIT_WITHDRAWAL_ROUTER}`);
    console.log("");

    // ==================== POST-DEPLOYMENT CHECKS ====================

    console.log("🔍 Running post-deployment checks...\n");

    try {
        // Check protocol info
        const protocolInfo = await plugin.getProtocolInfo();
        console.log("✅ Protocol Info:");
        console.log("   Name:", protocolInfo.name);
        console.log("   Version:", protocolInfo.version);
        console.log("   Features:", protocolInfo.features.toString());

        // Check health
        const [healthy, reason] = await plugin.isHealthy();
        if (healthy) {
            console.log("✅ Health Check: PASSED");
        } else {
            console.log("⚠️  Health Check: FAILED -", reason);
        }

        // Check supported tokens (examples)
        const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
        const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
        
        const usdcSupported = await plugin.supportsToken(USDC);
        const wethSupported = await plugin.supportsToken(WETH);
        
        console.log("✅ Token Support Checks:");
        console.log("   USDC:", usdcSupported ? "✅ Supported" : "❌ Not supported");
        console.log("   WETH:", wethSupported ? "✅ Supported" : "❌ Not supported");

    } catch (error) {
        console.error("⚠️  Post-deployment checks failed:", error);
    }

    console.log("");

    // ==================== NEXT STEPS ====================

    console.log("========================================");
    console.log("  📋 NEXT STEPS");
    console.log("========================================\n");
    console.log("1. ✅ Verify contract on Arbiscan (see command above)");
    console.log("2. 🔐 Register in Beacon:");
    console.log(`   beacon.upgradeImplementation("DolomitePlugin", "${pluginAddress}")`);
    console.log("");
    console.log("3. 🧪 Test deposit/withdraw:");
    console.log("   npx hardhat run scripts/testDolomitePlugin.ts --network arbitrum");
    console.log("");
    console.log("4. 📊 Monitor initial deposits with small amounts");
    console.log("");
    console.log("5. 🚀 Implement Phase 2 (borrow positions) when ready");
    console.log("");
    console.log("========================================\n");

    // Save deployment info
    const deploymentInfo = {
        network: "arbitrum",
        pluginAddress: pluginAddress,
        dolomiteMargin: DOLOMITE_MARGIN,
        borrowRouter: BORROW_POSITION_ROUTER,
        depositRouter: DEPOSIT_WITHDRAWAL_ROUTER,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        phase: 1 // Phase 1: Deposit/Withdraw
    };

    console.log("💾 Deployment Info:");
    console.log(JSON.stringify(deploymentInfo, null, 2));
    console.log("");

    // Optionally save to file
    const fs = require('fs');
    const path = require('path');
    const deploymentsDir = path.join(__dirname, '../deployments');
    
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    const filename = `dolomite-plugin-${Date.now()}.json`;
    const filepath = path.join(deploymentsDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`✅ Deployment info saved to: ${filepath}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed:", error);
        process.exit(1);
    });
