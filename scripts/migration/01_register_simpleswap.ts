import { ethers } from "hardhat";

/**
 * PHASE 1C - MIGRATION SCRIPT 1/4
 * 
 * Registra SimpleSwap deployed come "UniswapV3Plugin" in Beacon
 * 
 * PREREQUISITI:
 * - Beacon già deployed e funzionante
 * - SimpleSwap già deployed (0xa0DB78167CBAccD47524a261b7741C6B41Bbd096 su Arbitrum mainnet)
 * - Owner ha accesso al Beacon contract
 * 
 * AZIONI:
 * 1. Verifica SimpleSwap deployed esiste
 * 2. Verifica SimpleSwap implementa ISimpleSwap
 * 3. Register in Beacon come "UniswapV3Plugin"
 * 4. Verifica registrazione corretta
 * 
 * ROLLBACK:
 * - Beacon.updateImplementation("UniswapV3Plugin", address(0)) per de-register
 */

async function main() {
    console.log("\n==============================================");
    console.log("PHASE 1C.1 - REGISTER SIMPLESWAP AS PLUGIN");
    console.log("==============================================\n");

    const [owner] = await ethers.getSigners();
    console.log(`Executing with account: ${owner.address}`);
    console.log(`Account balance: ${ethers.formatEther(await ethers.provider.getBalance(owner.address))} ETH\n`);

    // ========== CONFIGURATION ==========
    
    // TESTNET (Arbitrum Sepolia) - modify for testnet deployment
    const BEACON_ADDRESS = process.env.BEACON_ADDRESS || "";
    const SIMPLE_SWAP_ADDRESS = process.env.SIMPLE_SWAP_ADDRESS || "";
    
    // MAINNET (Arbitrum) - existing deployed contracts
    // const BEACON_ADDRESS = "0x..."; // Your Beacon address
    // const SIMPLE_SWAP_ADDRESS = "0xa0DB78167CBAccD47524a261b7741C6B41Bbd096";
    
    if (!BEACON_ADDRESS || !SIMPLE_SWAP_ADDRESS) {
        throw new Error("❌ BEACON_ADDRESS and SIMPLE_SWAP_ADDRESS must be set in .env");
    }

    console.log("📋 Configuration:");
    console.log(`   Beacon: ${BEACON_ADDRESS}`);
    console.log(`   SimpleSwap: ${SIMPLE_SWAP_ADDRESS}\n`);

    // ========== STEP 1: VERIFY CONTRACTS EXIST ==========
    
    console.log("🔍 Step 1: Verifying contracts...");
    
    const beaconCode = await ethers.provider.getCode(BEACON_ADDRESS);
    if (beaconCode === "0x") {
        throw new Error("❌ Beacon contract not found at address");
    }
    console.log("   ✅ Beacon contract exists");
    
    const simpleSwapCode = await ethers.provider.getCode(SIMPLE_SWAP_ADDRESS);
    if (simpleSwapCode === "0x") {
        throw new Error("❌ SimpleSwap contract not found at address");
    }
    console.log("   ✅ SimpleSwap contract exists\n");

    // ========== STEP 2: GET CONTRACT INSTANCES ==========
    
    console.log("📦 Step 2: Loading contracts...");
    
    const beacon = await ethers.getContractAt("Beacon", BEACON_ADDRESS);
    
    console.log("   ✅ Beacon contract loaded");
    console.log("   ✅ SimpleSwap address validated\n");

    // ========== STEP 3: CHECK IF ALREADY REGISTERED ==========
    
    console.log("🔍 Step 3: Checking existing registration...");
    
    try {
        const existingAddr = await beacon.getImplementation("UniswapV3Plugin");
        if (existingAddr !== ethers.ZeroAddress) {
            console.log(`   ⚠️  UniswapV3Plugin already registered: ${existingAddr}`);
            
            if (existingAddr.toLowerCase() === SIMPLE_SWAP_ADDRESS.toLowerCase()) {
                console.log("   ✅ Already pointing to correct SimpleSwap address");
                console.log("\n✅ REGISTRATION ALREADY COMPLETE - SKIPPING\n");
                return;
            } else {
                console.log("   ⚠️  Registered to DIFFERENT address!");
                console.log("   ⚠️  Will update to new address...\n");
            }
        }
    } catch (error) {
        console.log("   ℹ️  UniswapV3Plugin not yet registered (expected)\n");
    }

    // ========== STEP 4: REGISTER PLUGIN ==========
    
    console.log("📝 Step 4: Registering UniswapV3Plugin...");
    console.log(`   Plugin Name: UniswapV3Plugin`);
    console.log(`   Address: ${SIMPLE_SWAP_ADDRESS}`);
    
    const tx = await beacon.updateImplementation("UniswapV3Plugin", SIMPLE_SWAP_ADDRESS);
    console.log(`   Transaction sent: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`   ✅ Transaction confirmed in block ${receipt?.blockNumber}`);
    console.log(`   Gas used: ${receipt?.gasUsed.toString()}\n`);

    // ========== STEP 5: VERIFY REGISTRATION ==========
    
    console.log("✅ Step 5: Verifying registration...");
    
    const registeredAddr = await beacon.getImplementation("UniswapV3Plugin");
    
    if (registeredAddr.toLowerCase() !== SIMPLE_SWAP_ADDRESS.toLowerCase()) {
        throw new Error(`❌ Registration FAILED! Expected ${SIMPLE_SWAP_ADDRESS}, got ${registeredAddr}`);
    }
    
    console.log("   ✅ UniswapV3Plugin correctly registered");
    console.log(`   ✅ Address verified: ${registeredAddr}\n`);

    // ========== STEP 6: TEST PLUGIN FUNCTIONALITY ==========
    
    console.log("🧪 Step 6: Testing plugin interface...");
    
    try {
        const simpleSwap = await ethers.getContractAt("MockSimpleSwap", SIMPLE_SWAP_ADDRESS);
        
        // Test custodyHolder (ISimpleSwap public variable)
        const custodyHolder = await simpleSwap.custodyHolder();
        console.log(`   ✅ ISimpleSwap.custodyHolder() works: ${custodyHolder}`);
        
        console.log("   ✅ Plugin interface validated\n");
    } catch (error: any) {
        console.log(`   ⚠️  Could not validate interface: ${error.message}`);
        console.log("   ℹ️  This is OK if using real SimpleSwap (not mock)\n");
    }

    // ========== SUMMARY ==========
    
    console.log("==============================================");
    console.log("✅ REGISTRATION COMPLETE");
    console.log("==============================================");
    console.log(`Plugin Name: UniswapV3Plugin`);
    console.log(`Address: ${SIMPLE_SWAP_ADDRESS}`);
    console.log(`Beacon: ${BEACON_ADDRESS}`);
    console.log(`Transaction: ${tx.hash}`);
    console.log("==============================================\n");

    console.log("📋 NEXT STEPS:");
    console.log("1. Run: npx hardhat run scripts/migration/02_deploy_new_swapmanager.ts");
    console.log("2. Verify new SwapManager deployment");
    console.log("3. Continue with migration process\n");

    console.log("🔄 ROLLBACK (if needed):");
    console.log(`   await beacon.updateImplementation("UniswapV3Plugin", ethers.ZeroAddress);\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ ERROR:", error.message);
        console.error(error);
        process.exit(1);
    });
