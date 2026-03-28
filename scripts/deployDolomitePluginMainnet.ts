/**
 * @title Deploy DolomitePlugin to Arbitrum Mainnet
 * @notice Deployment script for production DolomitePlugin with verification
 */

import { ethers, run } from "hardhat";

// Dolomite Protocol Addresses (Arbitrum One Mainnet)
const DOLOMITE_MARGIN = "0x6Bd780E7fDf01D77e4d475c821f1e7AE05409072";
const BORROW_POSITION_ROUTER = "0xF579b345cdA0860668b857De10ABD62442133D0F";
const DEPOSIT_WITHDRAWAL_ROUTER = "0xf8b2c637a68cf6a17b1df9f8992eebeff63d2dff";

// Common tokens to register (Arbitrum One)
const TOKENS = {
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Native USDC
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    ARB: "0x912CE59144191C1204E64559FE8253a0e49E6548",
    WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f"
};

async function main() {
    console.log("╔════════════════════════════════════════════════════════════════╗");
    console.log("║         DolomitePlugin - Arbitrum Mainnet Deployment          ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

    const [deployer] = await ethers.getSigners();
    console.log("🔑 Deploying with account:", deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(balance), "ETH\n");

    if (balance < ethers.parseEther("0.01")) {
        throw new Error("❌ Insufficient ETH for deployment. Need at least 0.01 ETH");
    }

    // ==================== STEP 1: DEPLOY CONTRACT ====================
    console.log("📦 Step 1: Deploying DolomitePlugin...\n");
    
    const DolomitePluginFactory = await ethers.getContractFactory("DolomitePlugin");
    
    console.log("Constructor args:");
    console.log("  - DolomiteMargin:", DOLOMITE_MARGIN);
    console.log("  - BorrowPositionRouter:", BORROW_POSITION_ROUTER);
    console.log("  - DepositWithdrawalRouter:", DEPOSIT_WITHDRAWAL_ROUTER);
    console.log();

    const plugin = await DolomitePluginFactory.deploy(
        DOLOMITE_MARGIN,
        BORROW_POSITION_ROUTER,
        DEPOSIT_WITHDRAWAL_ROUTER
    );

    await plugin.waitForDeployment();
    const pluginAddress = await plugin.getAddress();

    console.log("✅ DolomitePlugin deployed at:", pluginAddress);
    console.log("🔗 Arbiscan:", `https://arbiscan.io/address/${pluginAddress}\n`);

    // Wait for a few block confirmations before verification
    console.log("⏳ Waiting for 5 block confirmations...");
    await plugin.deploymentTransaction()?.wait(5);
    console.log("✅ Confirmations received\n");

    // ==================== STEP 2: VERIFY ON ARBISCAN ====================
    console.log("📝 Step 2: Verifying contract on Arbiscan...\n");

    try {
        await run("verify:verify", {
            address: pluginAddress,
            constructorArguments: [
                DOLOMITE_MARGIN,
                BORROW_POSITION_ROUTER,
                DEPOSIT_WITHDRAWAL_ROUTER
            ],
        });
        console.log("✅ Contract verified on Arbiscan\n");
    } catch (error: any) {
        if (error.message.includes("Already Verified")) {
            console.log("ℹ️  Contract already verified\n");
        } else {
            console.log("⚠️  Verification failed:", error.message);
            console.log("   You can verify manually later with:");
            console.log(`   npx hardhat verify --network arbitrum ${pluginAddress} "${DOLOMITE_MARGIN}" "${BORROW_POSITION_ROUTER}" "${DEPOSIT_WITHDRAWAL_ROUTER}"\n`);
        }
    }

    // ==================== STEP 3: REGISTER TOKENS ====================
    console.log("🪙 Step 3: Registering tokens...\n");

    const tokensToRegister = [
        { name: "WETH", address: TOKENS.WETH },
        { name: "USDC", address: TOKENS.USDC },
        { name: "USDT", address: TOKENS.USDT },
        { name: "ARB", address: TOKENS.ARB },
        { name: "WBTC", address: TOKENS.WBTC }
    ];

    for (const token of tokensToRegister) {
        try {
            console.log(`   Registering ${token.name} (${token.address})...`);
            const tx = await plugin.registerToken(token.address);
            await tx.wait();
            
            const synthetic = await plugin.realToSynthetic(token.address);
            console.log(`   ✅ ${token.name} registered → d${token.name}: ${synthetic}`);
        } catch (error: any) {
            console.log(`   ⚠️  ${token.name} registration failed:`, error.message);
        }
    }

    // ==================== STEP 4: VERIFICATION TESTS ====================
    console.log("\n🧪 Step 4: Running verification tests...\n");

    // Test 1: Protocol info
    const protocolInfo = await plugin.getProtocolInfo();
    console.log("   ✅ Protocol info:", protocolInfo.name, protocolInfo.version);

    // Test 2: Health check
    const [healthy, reason] = await plugin.isHealthy();
    console.log(`   ${healthy ? '✅' : '❌'} Health check:`, healthy ? 'Healthy' : reason);

    // Test 3: Check WETH registration
    const syntheticWETH = await plugin.realToSynthetic(TOKENS.WETH);
    const supportsWETH = await plugin.supportsTokenPair(TOKENS.WETH, syntheticWETH);
    console.log(`   ${supportsWETH ? '✅' : '❌'} WETH → dWETH pair:`, supportsWETH);

    // Test 4: Check balance (should be 0)
    try {
        const balance = await plugin.getDolomiteBalance(TOKENS.WETH);
        console.log(`   ✅ WETH balance check: ${balance} (expected: 0)`);
    } catch (error) {
        console.log("   ⚠️  Balance check failed (may need to wait for Dolomite sync)");
    }

    // ==================== DEPLOYMENT SUMMARY ====================
    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║                     DEPLOYMENT SUMMARY                         ║");
    console.log("╚════════════════════════════════════════════════════════════════╝");
    console.log();
    console.log("📍 Network: Arbitrum One");
    console.log("📦 Contract: DolomitePlugin");
    console.log("🏠 Address:", pluginAddress);
    console.log("🔗 Arbiscan:", `https://arbiscan.io/address/${pluginAddress}`);
    console.log("👤 Owner:", deployer.address);
    console.log();
    console.log("🪙 Registered Tokens:");
    for (const token of tokensToRegister) {
        const synthetic = await plugin.realToSynthetic(token.address);
        if (synthetic !== ethers.ZeroAddress) {
            console.log(`   ✅ ${token.name}: ${token.address}`);
            console.log(`      → d${token.name}: ${synthetic}`);
        }
    }
    console.log();
    console.log("📋 Next Steps:");
    console.log("   1. Save contract address for frontend integration");
    console.log("   2. Test small deposit/withdraw with test funds");
    console.log("   3. Test borrow position with small amounts");
    console.log("   4. Register plugin in Beacon (if using SwapManager)");
    console.log("   5. Update documentation with deployment details");
    console.log("   6. Set up monitoring for circuit breaker events");
    console.log();
    console.log("⚠️  Important Notes:");
    console.log("   - closeBorrowPosition() may require dust tolerance implementation");
    console.log("   - See docs/DolomitePlugin_Implementation_Notes.md for details");
    console.log("   - Flash loans require callback contract implementation");
    console.log("   - Always test with small amounts first");
    console.log();
    console.log("✅ Deployment completed successfully!");
    console.log();

    // Save deployment info to file
    const deploymentInfo = {
        network: "arbitrum-one",
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        contract: {
            name: "DolomitePlugin",
            address: pluginAddress,
            dolomiteMargin: DOLOMITE_MARGIN,
            borrowPositionRouter: BORROW_POSITION_ROUTER,
            depositWithdrawalRouter: DEPOSIT_WITHDRAWAL_ROUTER
        },
        tokens: tokensToRegister.map(t => ({
            name: t.name,
            address: t.address,
            synthetic: ""
        })),
        arbiscan: `https://arbiscan.io/address/${pluginAddress}`
    };

    // Populate synthetic addresses
    for (let i = 0; i < deploymentInfo.tokens.length; i++) {
        const synthetic = await plugin.realToSynthetic(deploymentInfo.tokens[i].address);
        deploymentInfo.tokens[i].synthetic = synthetic;
    }

    const fs = require('fs');
    const path = require('path');
    const deploymentsDir = path.join(__dirname, '../deployments');
    
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const filename = `arbitrum-mainnet-${Date.now()}.json`;
    fs.writeFileSync(
        path.join(deploymentsDir, filename),
        JSON.stringify(deploymentInfo, null, 2)
    );

    console.log("💾 Deployment info saved to:", `deployments/${filename}`);
    console.log();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed:");
        console.error(error);
        process.exit(1);
    });
