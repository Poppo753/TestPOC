import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

/**
 * EMERGENCY ROLLBACK SCRIPT
 * 
 * Ripristina il sistema al vecchio SwapManager
 * 
 * PREREQUISITI:
 * - OLD_SWAP_MANAGER_ADDRESS configurato
 * - Vecchio contratto ancora deployed e funzionante
 * - Accesso owner al Beacon
 * 
 * AZIONI:
 * 1. Verifica vecchio SwapManager esistente
 * 2. Conferma rollback con l'utente (CRITICO)
 * 3. Aggiorna Beacon per puntare al vecchio SwapManager
 * 4. Verifica rollback riuscito
 * 5. Testa vecchio sistema funzionante
 * 
 * ATTENZIONE:
 * - Operazione CRITICA che impatta TUTTO il sistema
 * - Richiede conferma manuale
 * - Tutti i moduli torneranno al vecchio SwapManager
 * - Il nuovo SwapManager rimarrà deployed ma disconnesso
 */

async function askConfirmation(question: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'yes');
        });
    });
}

async function main() {
    console.log("\n==============================================");
    console.log("🚨 EMERGENCY ROLLBACK SCRIPT");
    console.log("==============================================\n");

    console.log("⚠️  WARNING: CRITICAL OPERATION");
    console.log("   This will revert the system to OLD SwapManager");
    console.log("   ALL modules will stop using the NEW SwapManager");
    console.log("   This action is IMMEDIATE and system-wide\n");

    // ========== CONFIGURATION ==========
    
    const BEACON_ADDRESS = process.env.BEACON_ADDRESS || "";
    const OLD_SWAP_MANAGER_ADDRESS = process.env.OLD_SWAP_MANAGER_ADDRESS || "";
    const NEW_SWAP_MANAGER_ADDRESS = process.env.NEW_SWAP_MANAGER_ADDRESS || "";

    if (!BEACON_ADDRESS) {
        throw new Error("❌ BEACON_ADDRESS is required in .env");
    }

    if (!OLD_SWAP_MANAGER_ADDRESS) {
        throw new Error(
            "❌ OLD_SWAP_MANAGER_ADDRESS not found!\n" +
            "   Cannot rollback without knowing the old address.\n" +
            "   Check .env.migration file."
        );
    }

    console.log("📋 Rollback Configuration:");
    console.log(`   Beacon: ${BEACON_ADDRESS}`);
    console.log(`   OLD SwapManager (target): ${OLD_SWAP_MANAGER_ADDRESS}`);
    console.log(`   NEW SwapManager (current): ${NEW_SWAP_MANAGER_ADDRESS || 'N/A'}\n`);

    const [owner] = await ethers.getSigners();
    console.log(`Executing rollback with account: ${owner.address}\n`);

    // ========== STEP 1: VERIFY CONTRACTS EXIST ==========
    
    console.log("Step 1: Verifying contracts...");

    const beaconCode = await ethers.provider.getCode(BEACON_ADDRESS);
    if (beaconCode === "0x") {
        throw new Error(`❌ Beacon not found at ${BEACON_ADDRESS}`);
    }
    console.log("   ✅ Beacon exists");

    const oldSwapCode = await ethers.provider.getCode(OLD_SWAP_MANAGER_ADDRESS);
    if (oldSwapCode === "0x") {
        throw new Error(`❌ Old SwapManager not found at ${OLD_SWAP_MANAGER_ADDRESS}`);
    }
    console.log("   ✅ Old SwapManager exists\n");

    const beacon = await ethers.getContractAt("Beacon", BEACON_ADDRESS);
    const oldSwapManager = await ethers.getContractAt("SwapManager", OLD_SWAP_MANAGER_ADDRESS);

    // ========== STEP 2: CHECK CURRENT STATE ==========
    
    console.log("Step 2: Checking current system state...");

    const currentSwapManager = await beacon.getImplementation("SwapManager");
    console.log(`   Current SwapManager in Beacon: ${currentSwapManager}`);

    if (currentSwapManager.toLowerCase() === OLD_SWAP_MANAGER_ADDRESS.toLowerCase()) {
        console.log("\n⚠️  NOTICE: Beacon already points to OLD SwapManager");
        console.log("   System is already rolled back.");
        console.log("   No action needed.\n");
        
        const shouldVerify = await askConfirmation("Run verification tests anyway? (yes/no): ");
        if (!shouldVerify) {
            console.log("\nRollback skipped - system already in desired state.");
            return;
        }
        console.log();
    }

    // ========== STEP 3: VERIFY OLD SWAPMANAGER ==========
    
    console.log("Step 3: Verifying old SwapManager functionality...");

    try {
        // Check basic functions
        const oldOwner = await oldSwapManager.owner();
        console.log(`   Old SwapManager owner: ${oldOwner}`);

        const swapsEnabled = await oldSwapManager.swapsEnabled();
        console.log(`   Swaps enabled: ${swapsEnabled}`);

        const simpleSwapRouter = await oldSwapManager.simpleSwapRouter();
        console.log(`   SimpleSwap router: ${simpleSwapRouter}`);

        if (simpleSwapRouter === ethers.ZeroAddress) {
            console.log("   ⚠️  WARNING: Old SwapManager has no SimpleSwap configured!");
        }

        console.log("   ✅ Old SwapManager appears functional\n");
    } catch (error: any) {
        throw new Error(
            `❌ Old SwapManager verification FAILED: ${error.message}\n` +
            `   Cannot rollback to non-functional contract!`
        );
    }

    // ========== STEP 4: FINAL CONFIRMATION ==========
    
    if (currentSwapManager.toLowerCase() !== OLD_SWAP_MANAGER_ADDRESS.toLowerCase()) {
        console.log("==============================================");
        console.log("🚨 FINAL CONFIRMATION REQUIRED");
        console.log("==============================================\n");
        console.log("You are about to ROLLBACK the system:");
        console.log(`   FROM: ${currentSwapManager}`);
        console.log(`   TO:   ${OLD_SWAP_MANAGER_ADDRESS}\n`);
        console.log("This will:");
        console.log("   - Revert ALL modules to OLD SwapManager");
        console.log("   - Disable multi-plugin architecture");
        console.log("   - Re-enable single SimpleSwap usage");
        console.log("   - Take effect IMMEDIATELY\n");

        const confirmed = await askConfirmation("Type 'yes' to proceed with rollback: ");
        
        if (!confirmed) {
            console.log("\n❌ Rollback CANCELLED by user");
            console.log("   System unchanged.\n");
            return;
        }
        console.log();

        // ========== STEP 5: EXECUTE ROLLBACK ==========
        
        console.log("Step 4: Executing rollback...");
        console.log("   ⏳ Updating Beacon...\n");

        try {
            const tx = await beacon.updateImplementation(
                "SwapManager",
                OLD_SWAP_MANAGER_ADDRESS
            );

            console.log(`   Transaction submitted: ${tx.hash}`);
            console.log("   ⏳ Waiting for confirmation...\n");

            const receipt = await tx.wait();

            if (receipt === null) {
                throw new Error("Transaction receipt is null");
            }

            console.log(`   ✅ Transaction confirmed in block ${receipt.blockNumber}`);
            console.log(`   Gas used: ${receipt.gasUsed.toString()}\n`);

        } catch (error: any) {
            throw new Error(
                `❌ ROLLBACK FAILED: ${error.message}\n` +
                `   System state may be inconsistent!\n` +
                `   Manual intervention required.`
            );
        }
    }

    // ========== STEP 6: VERIFY ROLLBACK ==========
    
    console.log("Step 5: Verifying rollback...");

    const verifySwapManager = await beacon.getImplementation("SwapManager");
    console.log(`   SwapManager in Beacon: ${verifySwapManager}`);

    if (verifySwapManager.toLowerCase() !== OLD_SWAP_MANAGER_ADDRESS.toLowerCase()) {
        throw new Error(
            `❌ ROLLBACK VERIFICATION FAILED!\n` +
            `   Expected: ${OLD_SWAP_MANAGER_ADDRESS}\n` +
            `   Got: ${verifySwapManager}\n` +
            `   CRITICAL: System in inconsistent state!`
        );
    }

    console.log("   ✅ Beacon now points to OLD SwapManager\n");

    // ========== STEP 7: TEST OLD SYSTEM ==========
    
    console.log("Step 6: Testing old system functionality...");

    try {
        // Test that old SwapManager is accessible via Beacon
        const resolvedSwap = await beacon.getImplementation("SwapManager");
        console.log(`   Beacon resolves SwapManager to: ${resolvedSwap}`);

        // Test old SwapManager functions
        const owner = await oldSwapManager.owner();
        console.log(`   Old SwapManager owner: ${owner}`);

        const swapsEnabled = await oldSwapManager.swapsEnabled();
        console.log(`   Swaps enabled: ${swapsEnabled}`);

        const simpleSwapRouter = await oldSwapManager.simpleSwapRouter();
        console.log(`   SimpleSwap router: ${simpleSwapRouter}`);

        console.log("   ✅ Old system responding correctly\n");

    } catch (error: any) {
        console.log(`   ⚠️  WARNING: Old system test failed: ${error.message}`);
        console.log("   Rollback completed but system may need attention\n");
    }

    // ========== STEP 8: UPDATE MIGRATION STATE ==========
    
    console.log("Step 7: Updating migration state...");

    try {
        const migrationPath = path.join(process.cwd(), '.env.migration');
        
        if (fs.existsSync(migrationPath)) {
            let content = fs.readFileSync(migrationPath, 'utf8');
            
            // Add rollback marker
            const rollbackEntry = `\n# ROLLBACK EXECUTED: ${new Date().toISOString()}\n` +
                                 `ROLLBACK_FROM=${NEW_SWAP_MANAGER_ADDRESS || 'unknown'}\n` +
                                 `ROLLBACK_TO=${OLD_SWAP_MANAGER_ADDRESS}\n`;
            
            content += rollbackEntry;
            fs.writeFileSync(migrationPath, content);
            
            console.log("   ✅ Migration state updated\n");
        }
    } catch (error: any) {
        console.log(`   ⚠️  Could not update migration state: ${error.message}\n`);
    }

    // ========== FINAL REPORT ==========
    
    console.log("==============================================");
    console.log("✅ ROLLBACK COMPLETED SUCCESSFULLY");
    console.log("==============================================\n");

    console.log("📊 System Status:");
    console.log(`   Beacon: ${BEACON_ADDRESS}`);
    console.log(`   Active SwapManager: ${OLD_SWAP_MANAGER_ADDRESS}`);
    console.log(`   Previous SwapManager: ${NEW_SWAP_MANAGER_ADDRESS || 'N/A'}\n`);

    console.log("✅ System State:");
    console.log("   - Beacon points to OLD SwapManager");
    console.log("   - Single SimpleSwap architecture restored");
    console.log("   - Multi-plugin features disabled");
    console.log("   - Old functionality restored\n");

    console.log("📋 Post-Rollback Actions:");
    console.log("   1. Verify all modules working correctly");
    console.log("   2. Test swap functionality end-to-end");
    console.log("   3. Monitor system for 24-48 hours");
    console.log("   4. Investigate root cause of issues");
    console.log("   5. Plan corrective actions before re-migration\n");

    console.log("📖 New SwapManager Status:");
    console.log(`   Address: ${NEW_SWAP_MANAGER_ADDRESS || 'N/A'}`);
    console.log("   Status: DISCONNECTED (still deployed)");
    console.log("   Impact: No longer used by system");
    console.log("   Action: Can be ignored or removed\n");

    console.log("🔄 Re-Migration:");
    console.log("   To migrate again after fixes:");
    console.log("   1. Fix issues in NEW SwapManager");
    console.log("   2. Update NEW_SWAP_MANAGER_ADDRESS in .env.migration");
    console.log("   3. Run: npx hardhat run scripts/migration/03_update_beacon.ts\n");

    console.log("✅ Rollback completed - system restored to previous state");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ ROLLBACK ERROR:", error.message);
        console.error(error);
        console.error("\n🚨 CRITICAL: System may be in inconsistent state!");
        console.error("   Manual intervention required");
        console.error("   Contact system administrator immediately\n");
        process.exit(1);
    });
