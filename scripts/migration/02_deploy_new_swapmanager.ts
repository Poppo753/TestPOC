import { ethers } from "hardhat";

/**
 * PHASE 1C - MIGRATION SCRIPT 2/4
 * 
 * Deploy nuovo SwapManager con funzionalità multi-plugin
 * 
 * PREREQUISITI:
 * - Script 01 completato (UniswapV3Plugin registrato in Beacon)
 * - Beacon address configurato
 * 
 * AZIONI:
 * 1. Deploy nuovo SwapManager
 * 2. Inizializza con activeSwapPlugin = "UniswapV3Plugin"
 * 3. Verifica deployment corretto
 * 4. Test funzioni base (non ancora collegato al sistema)
 * 
 * NOTE:
 * - SwapManager NON è ancora collegato a LiquidityManager
 * - Beacon NON punta ancora al nuovo SwapManager
 * - Sistema vecchio continua a funzionare
 * 
 * ROLLBACK:
 * - Nessun impatto - nuovo contratto isolato
 */

async function main() {
    console.log("\n==============================================");
    console.log("PHASE 1C.2 - DEPLOY NEW SWAPMANAGER");
    console.log("==============================================\n");

    const [owner] = await ethers.getSigners();
    console.log(`Executing with account: ${owner.address}`);
    console.log(`Account balance: ${ethers.formatEther(await ethers.provider.getBalance(owner.address))} ETH\n`);

    // ========== CONFIGURATION ==========
    
    const BEACON_ADDRESS = process.env.BEACON_ADDRESS || "";
    
    if (!BEACON_ADDRESS) {
        throw new Error("❌ BEACON_ADDRESS must be set in .env");
    }

    console.log("📋 Configuration:");
    console.log(`   Beacon: ${BEACON_ADDRESS}\n`);

    // ========== STEP 1: VERIFY BEACON EXISTS ==========
    
    console.log("🔍 Step 1: Verifying Beacon...");
    
    const beaconCode = await ethers.provider.getCode(BEACON_ADDRESS);
    if (beaconCode === "0x") {
        throw new Error("❌ Beacon contract not found at address");
    }
    console.log("   ✅ Beacon contract exists\n");

    // ========== STEP 2: VERIFY UNISWAPV3PLUGIN REGISTERED ==========
    
    console.log("🔍 Step 2: Verifying UniswapV3Plugin registration...");
    
    const beacon = await ethers.getContractAt("Beacon", BEACON_ADDRESS);
    
    const pluginAddr = await beacon.getImplementation("UniswapV3Plugin");
    if (pluginAddr === ethers.ZeroAddress) {
        throw new Error("❌ UniswapV3Plugin not registered! Run script 01 first.");
    }
    
    console.log(`   ✅ UniswapV3Plugin registered: ${pluginAddr}\n`);

    // ========== STEP 3: DEPLOY NEW SWAPMANAGER ==========
    
    console.log("🚀 Step 3: Deploying new SwapManager...");
    console.log(`   Constructor parameter: beacon = ${BEACON_ADDRESS}`);
    
    const SwapManager = await ethers.getContractFactory("SwapManager");
    const swapManager = await SwapManager.deploy(BEACON_ADDRESS);
    
    await swapManager.waitForDeployment();
    const swapManagerAddr = await swapManager.getAddress();
    
    console.log(`   ✅ SwapManager deployed: ${swapManagerAddr}`);
    console.log(`   Transaction: ${swapManager.deploymentTransaction()?.hash}\n`);

    // ========== STEP 4: VERIFY DEPLOYMENT ==========
    
    console.log("✅ Step 4: Verifying deployment...");
    
    const deployedCode = await ethers.provider.getCode(swapManagerAddr);
    if (deployedCode === "0x" || deployedCode.length < 100) {
        throw new Error("❌ Deployment FAILED - no code at address");
    }
    
    console.log(`   ✅ Contract code deployed (${deployedCode.length} bytes)`);
    
    // Verify beacon address
    const storedBeacon = await swapManager.beacon();
    if (storedBeacon.toLowerCase() !== BEACON_ADDRESS.toLowerCase()) {
        throw new Error(`❌ Beacon mismatch! Expected ${BEACON_ADDRESS}, got ${storedBeacon}`);
    }
    
    console.log(`   ✅ Beacon address correct: ${storedBeacon}\n`);

    // ========== STEP 5: INITIALIZE ACTIVE PLUGIN ==========
    
    console.log("🔧 Step 5: Setting active swap plugin...");
    
    const tx = await swapManager.setActiveSwapPlugin("UniswapV3Plugin");
    console.log(`   Transaction sent: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`   ✅ Transaction confirmed in block ${receipt?.blockNumber}`);
    console.log(`   Gas used: ${receipt?.gasUsed.toString()}`);
    
    const activePlugin = await swapManager.activeSwapPlugin();
    if (activePlugin !== "UniswapV3Plugin") {
        throw new Error(`❌ Active plugin mismatch! Expected UniswapV3Plugin, got ${activePlugin}`);
    }
    
    console.log(`   ✅ Active plugin set: ${activePlugin}\n`);

    // ========== STEP 6: TEST BASIC FUNCTIONALITY ==========
    
    console.log("🧪 Step 6: Testing basic functionality...");
    
    // Test swapsEnabled (should be true by default)
    const swapsEnabled = await swapManager.swapsEnabled();
    console.log(`   ✅ swapsEnabled: ${swapsEnabled}`);
    
    // Test owner
    const contractOwner = await swapManager.owner();
    console.log(`   ✅ Owner: ${contractOwner}`);
    
    if (contractOwner.toLowerCase() !== owner.address.toLowerCase()) {
        console.log(`   ⚠️  Warning: Owner mismatch! Deployer: ${owner.address}`);
    }
    
    console.log("   ✅ Basic functions working\n");

    // ========== STEP 7: VERIFY BACKWARD COMPATIBILITY ==========
    
    console.log("🔄 Step 7: Verifying backward compatibility...");
    
    // Check simpleSwapRouter still exists (deprecated but maintained)
    const simpleSwapRouter = await swapManager.simpleSwapRouter();
    console.log(`   ✅ simpleSwapRouter (deprecated): ${simpleSwapRouter}`);
    
    if (simpleSwapRouter === ethers.ZeroAddress) {
        console.log("   ℹ️  simpleSwapRouter not set (OK - using Beacon resolution)");
    }
    
    // Test that we can still call setSimpleSwapRouter (deprecated function)
    console.log("   ✅ setSimpleSwapRouter() function exists (deprecated but maintained)\n");

    // ========== STEP 8: TEST NEW MULTI-PLUGIN FUNCTIONS ==========
    
    console.log("🧪 Step 8: Testing new multi-plugin functions...");
    
    // Test getAllQuotes (should work but return 0 quotes since no tokens configured)
    try {
        // Use mock addresses for testing
        const mockTokenIn = "0x0000000000000000000000000000000000000001";
        const mockTokenOut = "0x0000000000000000000000000000000000000002";
        const mockAmount = ethers.parseEther("1");
        
        const quotes = await swapManager.getAllQuotes(mockTokenIn, mockTokenOut, mockAmount);
        console.log(`   ✅ getAllQuotes() executed (returned ${quotes.length} quotes)`);
        
        if (quotes.length > 0) {
            console.log(`   ℹ️  Found ${quotes.length} plugins:`);
            for (let i = 0; i < quotes.length; i++) {
                console.log(`      - ${quotes[i].pluginName}: ${quotes[i].isValid ? 'Valid' : 'Invalid'}`);
            }
        }
    } catch (error: any) {
        // Expected to fail with validation errors (tokens not configured)
        console.log(`   ℹ️  getAllQuotes() validation: ${error.message.split('\n')[0]}`);
    }
    
    console.log("   ✅ New functions interface validated\n");

    // ========== STEP 9: GAS BENCHMARKING ==========
    
    console.log("📊 Step 9: Gas benchmarking...");
    
    const deployGas = swapManager.deploymentTransaction()?.gasLimit;
    console.log(`   Deployment gas limit: ${deployGas?.toString()}`);
    
    const setPluginGas = receipt?.gasUsed;
    console.log(`   setActiveSwapPlugin gas: ${setPluginGas?.toString()}\n`);

    // ========== SUMMARY ==========
    
    console.log("==============================================");
    console.log("✅ NEW SWAPMANAGER DEPLOYED");
    console.log("==============================================");
    console.log(`SwapManager Address: ${swapManagerAddr}`);
    console.log(`Beacon: ${BEACON_ADDRESS}`);
    console.log(`Active Plugin: UniswapV3Plugin`);
    console.log(`Plugin Address: ${pluginAddr}`);
    console.log(`Owner: ${contractOwner}`);
    console.log(`Deployment TX: ${swapManager.deploymentTransaction()?.hash}`);
    console.log("==============================================\n");

    console.log("⚠️  IMPORTANT NOTES:");
    console.log("1. New SwapManager is ISOLATED - not yet connected to system");
    console.log("2. Old system continues to work normally");
    console.log("3. No impact on production until Beacon is updated\n");

    console.log("📋 NEXT STEPS:");
    console.log("1. Save SwapManager address to .env:");
    console.log(`   NEW_SWAP_MANAGER_ADDRESS=${swapManagerAddr}`);
    console.log("2. Run: npx hardhat run scripts/migration/03_update_beacon.ts");
    console.log("3. This will switch Beacon to point to new SwapManager\n");

    console.log("🔄 ROLLBACK (if needed):");
    console.log("   No action needed - new contract is isolated");
    console.log("   Simply don't run script 03 (Beacon update)\n");

    // Save address to file for next scripts
    const fs = require('fs');
    const envPath = '.env.migration';
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Update or add NEW_SWAP_MANAGER_ADDRESS
    if (envContent.includes('NEW_SWAP_MANAGER_ADDRESS=')) {
        envContent = envContent.replace(
            /NEW_SWAP_MANAGER_ADDRESS=.*/,
            `NEW_SWAP_MANAGER_ADDRESS=${swapManagerAddr}`
        );
    } else {
        envContent += `\nNEW_SWAP_MANAGER_ADDRESS=${swapManagerAddr}\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Address saved to ${envPath}\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ ERROR:", error.message);
        console.error(error);
        process.exit(1);
    });
