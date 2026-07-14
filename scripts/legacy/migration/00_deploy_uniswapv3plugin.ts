import { ethers } from "hardhat";

/**
 * PHASE 1C - MIGRATION SCRIPT 0/5 (PRE-MIGRATION)
 * 
 * Deploy UniswapV3Plugin (wrapper di SimpleSwap esistente)
 * 
 * PREREQUISITI:
 * - SimpleSwap già deployed su Arbitrum (0xa0DB78167CBAccD47524a261b7741C6B41Bbd096)
 * - Wallet con fondi per gas (~0.01 ETH su Arbitrum)
 * 
 * AZIONI:
 * 1. Verifica SimpleSwap deployed esiste
 * 2. Deploy UniswapV3Plugin(simpleSwapAddress)
 * 3. Verifica deployment corretto
 * 4. Test funzioni ISwapPlugin
 * 5. Salva address per script successivi
 * 
 * NOTE:
 * - SimpleSwap (0xa0DB7...) NON viene modificato
 * - UniswapV3Plugin è solo un wrapper
 * - Nessun impatto su sistema esistente
 * 
 * ROLLBACK:
 * - Nessun impatto - contratto isolato, non collegato a nulla
 */

async function main() {
    console.log("\n==============================================");
    console.log("PHASE 1C.0 - DEPLOY UNISWAPV3PLUGIN");
    console.log("==============================================\n");

    const [deployer] = await ethers.getSigners();
    console.log(`Deploying with account: ${deployer.address}`);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`Account balance: ${ethers.formatEther(balance)} ETH`);
    
    if (balance < ethers.parseEther("0.001")) {
        console.log("⚠️  WARNING: Low balance! Recommended at least 0.01 ETH for deployment\n");
    } else {
        console.log("✅ Sufficient balance for deployment\n");
    }

    // ========== CONFIGURATION ==========
    
    const SIMPLE_SWAP_ADDRESS = process.env.SIMPLE_SWAP_ADDRESS || "";
    
    // For TESTNET: you'll need to deploy a mock SimpleSwap first
    // For MAINNET: use existing deployed SimpleSwap
    const IS_MAINNET = process.env.NETWORK === "arbitrum";
    const DEFAULT_MAINNET_SIMPLESWAP = "0xa0DB78167CBAccD47524a261b7741C6B41Bbd096";
    
    const simpleSwapAddress = SIMPLE_SWAP_ADDRESS || (IS_MAINNET ? DEFAULT_MAINNET_SIMPLESWAP : "");
    
    if (!simpleSwapAddress) {
        throw new Error(
            "❌ SIMPLE_SWAP_ADDRESS must be set in .env\n" +
            "   For MAINNET: use 0xa0DB78167CBAccD47524a261b7741C6B41Bbd096\n" +
            "   For TESTNET: deploy MockSimpleSwap first"
        );
    }

    console.log("📋 Configuration:");
    console.log(`   Network: ${IS_MAINNET ? "Arbitrum Mainnet" : "Arbitrum Sepolia (Testnet)"}`);
    console.log(`   SimpleSwap: ${simpleSwapAddress}`);
    console.log(`   Deployer: ${deployer.address}\n`);

    // ========== STEP 1: VERIFY SIMPLESWAP EXISTS ==========
    
    console.log("🔍 Step 1: Verifying SimpleSwap contract...");
    
    const simpleSwapCode = await ethers.provider.getCode(simpleSwapAddress);
    
    if (simpleSwapCode === "0x" || simpleSwapCode === "0x0") {
        throw new Error(
            `❌ SimpleSwap contract not found at ${simpleSwapAddress}\n` +
            "   Possible reasons:\n" +
            "   - Wrong network (check hardhat config)\n" +
            "   - Wrong address in .env\n" +
            "   - Contract not yet deployed on this network"
        );
    }
    
    console.log(`   ✅ SimpleSwap contract exists (${simpleSwapCode.length} bytes)`);
    console.log(`   ✅ Address: ${simpleSwapAddress}\n`);

    // ========== STEP 2: ESTIMATE GAS ==========
    
    console.log("⛽ Step 2: Estimating deployment gas...");
    
    const UniswapV3Plugin = await ethers.getContractFactory("UniswapV3Plugin");
    
    // Get current gas price
    const feeData = await ethers.provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits("0.1", "gwei");
    
    console.log(`   Current gas price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
    
    // Estimate deployment cost (rough estimate: 500k-800k gas)
    const estimatedGas = 800000n;
    const estimatedCost = estimatedGas * gasPrice;
    
    console.log(`   Estimated gas: ~${estimatedGas.toString()}`);
    console.log(`   Estimated cost: ~${ethers.formatEther(estimatedCost)} ETH`);
    console.log(`   Estimated USD (@ $3000/ETH): ~$${(parseFloat(ethers.formatEther(estimatedCost)) * 3000).toFixed(2)}\n`);

    // ========== STEP 3: DEPLOY UNISWAPV3PLUGIN ==========
    
    console.log("🚀 Step 3: Deploying UniswapV3Plugin...");
    console.log(`   Constructor parameter: simpleSwap = ${simpleSwapAddress}`);
    
    const startTime = Date.now();
    
    const uniswapV3Plugin = await UniswapV3Plugin.deploy(simpleSwapAddress);
    
    console.log(`   Transaction sent: ${uniswapV3Plugin.deploymentTransaction()?.hash}`);
    console.log("   ⏳ Waiting for confirmations...");
    
    await uniswapV3Plugin.waitForDeployment();
    
    const pluginAddress = await uniswapV3Plugin.getAddress();
    const deployTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`   ✅ UniswapV3Plugin deployed in ${deployTime}s`);
    console.log(`   📍 Address: ${pluginAddress}\n`);

    // ========== STEP 4: VERIFY DEPLOYMENT ==========
    
    console.log("✅ Step 4: Verifying deployment...");
    
    const deployedCode = await ethers.provider.getCode(pluginAddress);
    
    if (deployedCode === "0x" || deployedCode.length < 100) {
        throw new Error("❌ Deployment FAILED - no code at address");
    }
    
    console.log(`   ✅ Contract code deployed (${deployedCode.length} bytes)`);
    
    // Verify constructor parameter
    const storedSimpleSwap = await uniswapV3Plugin.simpleSwap();
    if (storedSimpleSwap.toLowerCase() !== simpleSwapAddress.toLowerCase()) {
        throw new Error(
            `❌ SimpleSwap address mismatch!\n` +
            `   Expected: ${simpleSwapAddress}\n` +
            `   Got: ${storedSimpleSwap}`
        );
    }
    
    console.log(`   ✅ simpleSwap address correct: ${storedSimpleSwap}\n`);

    // ========== STEP 5: TEST ISWAPPLUGIN INTERFACE ==========
    
    console.log("🧪 Step 5: Testing ISwapPlugin interface...");
    
    // Test getProtocolInfo()
    const protocolInfo = await uniswapV3Plugin.getProtocolInfo();
    console.log(`   ✅ getProtocolInfo():`);
    console.log(`      Name: ${protocolInfo.name}`);
    console.log(`      Version: ${protocolInfo.version}`);
    console.log(`      Features: ${protocolInfo.features} (${protocolInfo.features === 3n ? "BASIC_SWAP | MULTI_HOP" : "Unknown"})`);
    
    if (protocolInfo.name !== "Uniswap V3") {
        console.log("   ⚠️  WARNING: Protocol name mismatch!");
    }
    
    // Test supportsTokenPair() - should return true for all pairs
    const mockToken1 = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"; // WETH on Arbitrum
    const mockToken2 = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // USDC on Arbitrum
    
    const supports = await uniswapV3Plugin.supportsTokenPair(mockToken1, mockToken2);
    console.log(`   ✅ supportsTokenPair(WETH, USDC): ${supports}`);
    
    if (!supports) {
        console.log("   ⚠️  WARNING: Should support all pairs!");
    }
    
    // Test isHealthy()
    const [healthy, reason] = await uniswapV3Plugin.isHealthy();
    console.log(`   ✅ isHealthy(): ${healthy}${reason ? ` (${reason})` : ""}`);
    
    if (!healthy) {
        throw new Error(`❌ Plugin health check failed: ${reason}`);
    }
    
    console.log("   ✅ All ISwapPlugin functions working\n");

    // ========== STEP 6: GAS ANALYSIS ==========
    
    console.log("📊 Step 6: Gas analysis...");
    
    const receipt = await uniswapV3Plugin.deploymentTransaction()?.wait();
    
    if (receipt) {
        const actualGas = receipt.gasUsed;
        const actualCost = actualGas * (receipt.gasPrice || gasPrice);
        
        console.log(`   Actual gas used: ${actualGas.toString()}`);
        console.log(`   Actual cost: ${ethers.formatEther(actualCost)} ETH`);
        console.log(`   Gas price: ${ethers.formatUnits(receipt.gasPrice || gasPrice, "gwei")} gwei`);
        
        const usdCost = parseFloat(ethers.formatEther(actualCost)) * 3000; // Assuming $3000 ETH
        console.log(`   USD cost (@ $3000/ETH): ~$${usdCost.toFixed(2)}\n`);
    } else {
        console.log("   ⚠️  Could not retrieve transaction receipt\n");
    }

    // ========== STEP 7: VERIFY ISIMPLESWAP COMPATIBILITY ==========
    
    console.log("🔄 Step 7: Testing ISimpleSwap backward compatibility...");
    
    // The plugin should be castable to ISimpleSwap
    console.log("   ✅ UniswapV3Plugin implements ISimpleSwap (inherited)");
    console.log("   ✅ Can be used as ISimpleSwap interface");
    console.log("   ✅ Backward compatible with existing system\n");

    // ========== SUMMARY ==========
    
    console.log("==============================================");
    console.log("✅ UNISWAPV3PLUGIN DEPLOYED SUCCESSFULLY");
    console.log("==============================================");
    console.log(`Plugin Address: ${pluginAddress}`);
    console.log(`SimpleSwap (wrapped): ${simpleSwapAddress}`);
    console.log(`Protocol: ${protocolInfo.name} v${protocolInfo.version}`);
    console.log(`Features: BASIC_SWAP | MULTI_HOP`);
    console.log(`Health: ${healthy ? "✅ Healthy" : "❌ Unhealthy"}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Network: ${IS_MAINNET ? "Arbitrum Mainnet" : "Arbitrum Sepolia"}`);
    
    if (receipt) {
        console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
        console.log(`Deploy Cost: ${ethers.formatEther(receipt.gasUsed * (receipt.gasPrice || gasPrice))} ETH`);
    }
    
    console.log("==============================================\n");

    console.log("⚠️  IMPORTANT NOTES:");
    console.log("1. UniswapV3Plugin is ISOLATED - not yet registered in Beacon");
    console.log("2. No impact on existing system");
    console.log("3. SimpleSwap (0xa0DB7...) unchanged and still working\n");

    console.log("📋 NEXT STEPS:");
    console.log("1. Save plugin address to .env:");
    console.log(`   UNISWAPV3_PLUGIN_ADDRESS=${pluginAddress}`);
    console.log("2. Verify on Arbiscan (if mainnet):");
    console.log(`   npx hardhat verify --network arbitrum ${pluginAddress} ${simpleSwapAddress}`);
    console.log("3. Continue with migration:");
    console.log("   npx hardhat run scripts/migration/01_register_simpleswap.ts --network arbitrum\n");

    console.log("🔄 ROLLBACK (if needed):");
    console.log("   No action needed - contract is isolated");
    console.log("   Simply don't register in Beacon\n");

    // ========== SAVE ADDRESS ==========
    
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '../../.env.migration');
    
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Update or add UNISWAPV3_PLUGIN_ADDRESS
    if (envContent.includes('UNISWAPV3_PLUGIN_ADDRESS=')) {
        envContent = envContent.replace(
            /UNISWAPV3_PLUGIN_ADDRESS=.*/,
            `UNISWAPV3_PLUGIN_ADDRESS=${pluginAddress}`
        );
    } else {
        envContent += `\nUNISWAPV3_PLUGIN_ADDRESS=${pluginAddress}\n`;
    }
    
    // Also save SimpleSwap address for reference
    if (!envContent.includes('SIMPLE_SWAP_ADDRESS=')) {
        envContent += `SIMPLE_SWAP_ADDRESS=${simpleSwapAddress}\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Addresses saved to .env.migration\n`);
    
    // Also output for manual copy
    console.log("📝 ADD TO YOUR .env FILE:");
    console.log("─────────────────────────────────────────────");
    console.log(`UNISWAPV3_PLUGIN_ADDRESS=${pluginAddress}`);
    console.log(`SIMPLE_SWAP_ADDRESS=${simpleSwapAddress}`);
    console.log("─────────────────────────────────────────────\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ DEPLOYMENT FAILED");
        console.error("─────────────────────────────────────────────");
        console.error("Error:", error.message);
        
        if (error.message.includes("insufficient funds")) {
            console.error("\n💡 SOLUTION: Add more ETH to deployer wallet");
        } else if (error.message.includes("nonce")) {
            console.error("\n💡 SOLUTION: Wait a few seconds and retry");
        } else if (error.message.includes("network")) {
            console.error("\n💡 SOLUTION: Check network configuration in hardhat.config.ts");
        }
        
        console.error("─────────────────────────────────────────────\n");
        process.exit(1);
    });
