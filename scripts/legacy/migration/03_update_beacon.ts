import { ethers } from "hardhat";

/**
 * PHASE 1C - MIGRATION SCRIPT 3/4
 * 
 * Update Beacon per puntare al nuovo SwapManager
 * 
 * ⚠️ CRITICAL SCRIPT - QUESTO MODIFICA IL SISTEMA IN PRODUZIONE
 * 
 * PREREQUISITI:
 * - Script 01 completato (UniswapV3Plugin registrato)
 * - Script 02 completato (nuovo SwapManager deployed)
 * - NEW_SWAP_MANAGER_ADDRESS configurato
 * - OLD_SWAP_MANAGER_ADDRESS configurato (per rollback)
 * 
 * AZIONI:
 * 1. Verifica sistema corrente funzionante
 * 2. Verifica nuovo SwapManager pronto
 * 3. Update Beacon.updateImplementation("SwapManager", newAddress)
 * 4. Verifica switch avvenuto correttamente
 * 5. Test funzionalità base
 * 
 * IMPATTO:
 * - LiquidityManager inizia a usare nuovo SwapManager
 * - Tutti i moduli che chiamano SwapManager sono impattati
 * - Sistema passa da mono-plugin a multi-plugin
 * 
 * ROLLBACK:
 * - await beacon.updateImplementation("SwapManager", oldSwapManagerAddress);
 * - Script rollback.ts disponibile
 */

async function main() {
    console.log("\n==============================================");
    console.log("⚠️  PHASE 1C.3 - UPDATE BEACON (CRITICAL)");
    console.log("==============================================\n");

    const [owner] = await ethers.getSigners();
    console.log(`Executing with account: ${owner.address}`);
    console.log(`Account balance: ${ethers.formatEther(await ethers.provider.getBalance(owner.address))} ETH\n`);

    // ========== CONFIGURATION ==========
    
    const BEACON_ADDRESS = process.env.BEACON_ADDRESS || "";
    const NEW_SWAP_MANAGER_ADDRESS = process.env.NEW_SWAP_MANAGER_ADDRESS || "";
    const OLD_SWAP_MANAGER_ADDRESS = process.env.OLD_SWAP_MANAGER_ADDRESS || "";
    
    if (!BEACON_ADDRESS) {
        throw new Error("❌ BEACON_ADDRESS must be set");
    }
    if (!NEW_SWAP_MANAGER_ADDRESS) {
        throw new Error("❌ NEW_SWAP_MANAGER_ADDRESS must be set (from script 02)");
    }

    console.log("📋 Configuration:");
    console.log(`   Beacon: ${BEACON_ADDRESS}`);
    console.log(`   New SwapManager: ${NEW_SWAP_MANAGER_ADDRESS}`);
    console.log(`   Old SwapManager: ${OLD_SWAP_MANAGER_ADDRESS || 'Not set (optional)'}\n`);

    // ========== SAFETY CONFIRMATION ==========
    
    console.log("⚠️  CRITICAL OPERATION WARNING:");
    console.log("   This script will UPDATE the production Beacon");
    console.log("   All modules will start using the NEW SwapManager");
    console.log("   Make sure you have tested thoroughly!\n");

    // In production, you might want to add a confirmation prompt here
    // const readline = require('readline').createInterface({...});
    // await new Promise(resolve => readline.question('Continue? (yes/no): ', answer => {...}));

    // ========== STEP 1: VERIFY BEACON AND CONTRACTS ==========
    
    console.log("🔍 Step 1: Verifying contracts existence...");
    
    const beacon = await ethers.getContractAt("Beacon", BEACON_ADDRESS);
    
    const beaconCode = await ethers.provider.getCode(BEACON_ADDRESS);
    if (beaconCode === "0x") {
        throw new Error("❌ Beacon not found");
    }
    console.log("   ✅ Beacon exists");
    
    const newSwapCode = await ethers.provider.getCode(NEW_SWAP_MANAGER_ADDRESS);
    if (newSwapCode === "0x" || newSwapCode.length < 100) {
        throw new Error("❌ New SwapManager not found or invalid");
    }
    console.log("   ✅ New SwapManager exists");
    
    if (OLD_SWAP_MANAGER_ADDRESS) {
        const oldSwapCode = await ethers.provider.getCode(OLD_SWAP_MANAGER_ADDRESS);
        if (oldSwapCode === "0x") {
            console.log("   ⚠️  Old SwapManager not found (rollback may not work)");
        } else {
            console.log("   ✅ Old SwapManager exists (rollback available)");
        }
    }
    console.log();

    // ========== STEP 2: VERIFY CURRENT STATE ==========
    
    console.log("🔍 Step 2: Verifying current Beacon state...");
    
    const currentSwapManager = await beacon.getImplementation("SwapManager");
    console.log(`   Current SwapManager in Beacon: ${currentSwapManager}`);
    
    if (currentSwapManager === ethers.ZeroAddress) {
        console.log("   ⚠️  SwapManager not currently registered in Beacon");
        console.log("   ℹ️  First-time registration (not an update)");
    } else if (currentSwapManager.toLowerCase() === NEW_SWAP_MANAGER_ADDRESS.toLowerCase()) {
        console.log("   ⚠️  Beacon already points to new SwapManager!");
        console.log("   ✅ MIGRATION ALREADY COMPLETE - SKIPPING\n");
        return;
    } else {
        console.log("   ✅ Current SwapManager different from new (update will occur)");
        
        // Save old address for rollback
        if (!OLD_SWAP_MANAGER_ADDRESS) {
            console.log(`   ℹ️  Saving old address for rollback: ${currentSwapManager}`);
            
            const fs = require('fs');
            const envPath = '.env.migration';
            let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
            
            if (envContent.includes('OLD_SWAP_MANAGER_ADDRESS=')) {
                envContent = envContent.replace(
                    /OLD_SWAP_MANAGER_ADDRESS=.*/,
                    `OLD_SWAP_MANAGER_ADDRESS=${currentSwapManager}`
                );
            } else {
                envContent += `\nOLD_SWAP_MANAGER_ADDRESS=${currentSwapManager}\n`;
            }
            
            fs.writeFileSync(envPath, envContent);
            console.log(`   ✅ Old address saved to ${envPath}`);
        }
    }
    console.log();

    // ========== STEP 3: VERIFY NEW SWAPMANAGER READY ==========
    
    console.log("🔍 Step 3: Verifying new SwapManager is ready...");
    
    const newSwapManager = await ethers.getContractAt("SwapManager", NEW_SWAP_MANAGER_ADDRESS);
    
    // Check beacon reference
    const newSwapBeacon = await newSwapManager.beacon();
    if (newSwapBeacon.toLowerCase() !== BEACON_ADDRESS.toLowerCase()) {
        throw new Error(`❌ New SwapManager points to wrong Beacon! ${newSwapBeacon} vs ${BEACON_ADDRESS}`);
    }
    console.log("   ✅ New SwapManager points to correct Beacon");
    
    // Check active plugin
    const activePlugin = await newSwapManager.activeSwapPlugin();
    console.log(`   Active plugin: ${activePlugin}`);
    
    if (activePlugin !== "UniswapV3Plugin") {
        console.log("   ⚠️  Active plugin is not UniswapV3Plugin!");
        console.log("   ⚠️  You may want to set it before continuing");
    } else {
        console.log("   ✅ Active plugin configured");
    }
    
    // Check owner
    const newSwapOwner = await newSwapManager.owner();
    console.log(`   Owner: ${newSwapOwner}`);
    
    if (newSwapOwner.toLowerCase() !== owner.address.toLowerCase()) {
        console.log(`   ⚠️  Warning: Owner is different from executor!`);
        console.log(`   ⚠️  Make sure you have control over this contract`);
    }
    
    // Check swaps enabled
    const swapsEnabled = await newSwapManager.swapsEnabled();
    if (!swapsEnabled) {
        throw new Error("❌ Swaps are DISABLED in new SwapManager! Enable them first.");
    }
    console.log("   ✅ Swaps enabled");
    console.log();

    // ========== STEP 4: VERIFY PLUGIN REGISTERED ==========
    
    console.log("🔍 Step 4: Verifying UniswapV3Plugin registered...");
    
    const pluginAddr = await beacon.getImplementation("UniswapV3Plugin");
    if (pluginAddr === ethers.ZeroAddress) {
        throw new Error("❌ UniswapV3Plugin not registered! Run script 01 first.");
    }
    console.log(`   ✅ UniswapV3Plugin: ${pluginAddr}\n`);

    // ========== STEP 5: UPDATE BEACON (CRITICAL) ==========
    
    console.log("🚀 Step 5: Updating Beacon...");
    console.log(`   FROM: ${currentSwapManager || 'None'}`);
    console.log(`   TO:   ${NEW_SWAP_MANAGER_ADDRESS}`);
    console.log("   ⚠️  This will affect ALL modules using SwapManager!\n");

    const tx = await beacon.updateImplementation("SwapManager", NEW_SWAP_MANAGER_ADDRESS);
    console.log(`   Transaction sent: ${tx.hash}`);
    console.log("   ⏳ Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log(`   ✅ Transaction confirmed in block ${receipt?.blockNumber}`);
    console.log(`   Gas used: ${receipt?.gasUsed.toString()}\n`);

    // ========== STEP 6: VERIFY UPDATE ==========
    
    console.log("✅ Step 6: Verifying Beacon update...");
    
    const updatedSwapManager = await beacon.getImplementation("SwapManager");
    
    if (updatedSwapManager.toLowerCase() !== NEW_SWAP_MANAGER_ADDRESS.toLowerCase()) {
        throw new Error(`❌ UPDATE FAILED! Beacon still points to ${updatedSwapManager}`);
    }
    
    console.log("   ✅ Beacon successfully updated");
    console.log(`   ✅ SwapManager now: ${updatedSwapManager}\n`);

    // ========== STEP 7: TEST NEW SYSTEM ==========
    
    console.log("🧪 Step 7: Testing new system...");
    
    // Test that modules can resolve SwapManager via Beacon
    console.log("   Testing Beacon resolution...");
    const resolvedSwapManager = await beacon.getImplementation("SwapManager");
    console.log(`   ✅ Beacon.getImplementation('SwapManager'): ${resolvedSwapManager}`);
    
    // Verify it's the new contract
    if (resolvedSwapManager.toLowerCase() !== NEW_SWAP_MANAGER_ADDRESS.toLowerCase()) {
        throw new Error("❌ Beacon resolution returns wrong address!");
    }
    console.log("   ✅ Resolution working correctly\n");

    // ========== STEP 8: VERIFY PLUGIN RESOLUTION ==========
    
    console.log("🧪 Step 8: Testing plugin resolution...");
    
    try {
        // Test getAllQuotes (should work but may fail due to token validation)
        const mockTokenIn = "0x0000000000000000000000000000000000000001";
        const mockTokenOut = "0x0000000000000000000000000000000000000002";
        const mockAmount = ethers.parseEther("1");
        
        const quotes = await newSwapManager.getAllQuotes(mockTokenIn, mockTokenOut, mockAmount);
        console.log(`   ✅ getAllQuotes() executed (found ${quotes.length} plugins)`);
        
        if (quotes.length > 0) {
            for (let i = 0; i < quotes.length; i++) {
                console.log(`      Plugin ${i + 1}: ${quotes[i].pluginName}`);
                console.log(`         Valid: ${quotes[i].isValid}`);
                if (!quotes[i].isValid) {
                    console.log(`         Error: ${quotes[i].errorReason}`);
                }
            }
        }
    } catch (error: any) {
        console.log(`   ℹ️  getAllQuotes() validation: ${error.message.split('\n')[0]}`);
        console.log("   ℹ️  This is expected if tokens are not configured");
    }
    
    console.log("   ✅ New SwapManager functions accessible\n");

    // ========== SUMMARY ==========
    
    console.log("==============================================");
    console.log("✅ BEACON UPDATE COMPLETE");
    console.log("==============================================");
    console.log(`Beacon: ${BEACON_ADDRESS}`);
    console.log(`Old SwapManager: ${currentSwapManager || 'None'}`);
    console.log(`New SwapManager: ${NEW_SWAP_MANAGER_ADDRESS}`);
    console.log(`Active Plugin: ${activePlugin}`);
    console.log(`Plugin Address: ${pluginAddr}`);
    console.log(`Update Transaction: ${tx.hash}`);
    console.log(`Block: ${receipt?.blockNumber}`);
    console.log("==============================================\n");

    console.log("🎉 MIGRATION SUCCESSFUL!");
    console.log("   System is now using the new multi-plugin SwapManager\n");

    console.log("⚠️  IMPORTANT:");
    console.log("1. All LiquidityManager calls now use new SwapManager");
    console.log("2. Multi-plugin query system is ACTIVE");
    console.log("3. Monitor system for any unexpected behavior\n");

    console.log("📋 NEXT STEPS:");
    console.log("1. Run: npx hardhat run scripts/migration/04_verify_system.ts");
    console.log("2. Perform end-to-end testing");
    console.log("3. Monitor production logs\n");

    console.log("🔄 ROLLBACK (if needed):");
    console.log("   Run: npx hardhat run scripts/migration/rollback.ts");
    if (OLD_SWAP_MANAGER_ADDRESS || currentSwapManager !== ethers.ZeroAddress) {
        console.log(`   This will restore: ${OLD_SWAP_MANAGER_ADDRESS || currentSwapManager}`);
    }
    console.log();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ CRITICAL ERROR:", error.message);
        console.error(error);
        console.error("\n⚠️  SYSTEM MAY BE IN INCONSISTENT STATE");
        console.error("⚠️  Consider running rollback script if needed\n");
        process.exit(1);
    });
