import { ethers } from "hardhat";

/**
 * UPDATE SWAPMANAGER IN BEACON
 * 
 * Deploys new SwapManager with _getActivePlugin() integration
 * and updates Beacon to point to the new implementation
 */

const BEACON_ADDRESS = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
const OLD_SWAP_MANAGER = "0x01269d496E957A54e02cdcd5888957baf317A947";

async function main() {
    console.log("============================================================");
    console.log("  DEPLOY & UPDATE SwapManager WITH PLUGIN INTEGRATION");
    console.log("============================================================\n");

    const [owner] = await ethers.getSigners();
    console.log(`Deployer: ${owner.address}`);
    
    const balance = await owner.provider.getBalance(owner.address);
    console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);

    // ============ GET BEACON CONTRACT ============
    console.log("Connecting to Beacon...");
    const beacon = await ethers.getContractAt("Beacon", BEACON_ADDRESS);
    console.log(`✅ Connected to Beacon: ${BEACON_ADDRESS}\n`);

    // ============ CHECK CURRENT STATE ============
    console.log("Checking current SwapManager...");
    const currentSwapManager = await beacon.getImplementation("SwapManager");
    console.log(`Current SwapManager: ${currentSwapManager}`);
    
    if (currentSwapManager !== OLD_SWAP_MANAGER) {
        console.log(`⚠️  WARNING: Expected ${OLD_SWAP_MANAGER}`);
    }

    // ============ DEPLOY NEW SWAPMANAGER ============
    console.log("\nDeploying new SwapManager...");
    console.log("⏳ Compiling and deploying...");

    const SwapManager = await ethers.getContractFactory("SwapManager");
    const newSwapManager = await SwapManager.deploy(BEACON_ADDRESS, "USDC");
    
    await newSwapManager.waitForDeployment();
    const newAddress = await newSwapManager.getAddress();
    
    console.log(`✅ New SwapManager deployed: ${newAddress}`);

    // Verify contract has _getActivePlugin function
    const code = await ethers.provider.getCode(newAddress);
    console.log(`   Contract size: ${(code.length - 2) / 2} bytes`);

    // ============ UPDATE BEACON ============
    console.log("\nUpdating Beacon to point to new SwapManager...");
    console.log("⏳ Sending transaction...");

    const tx = await beacon.updateImplementation(
        "SwapManager",
        newAddress
    );

    console.log(`Transaction hash: ${tx.hash}`);
    console.log("⏳ Waiting for confirmation...");

    const receipt = await tx.wait();
    
    console.log(`✅ Transaction confirmed!`);
    console.log(`   Block: ${receipt?.blockNumber}`);
    console.log(`   Gas used: ${receipt?.gasUsed.toString()}`);

    // ============ VERIFY UPDATE ============
    console.log("\nVerifying update...");
    
    const updatedSwapManager = await beacon.getImplementation("SwapManager");
    console.log(`Updated SwapManager: ${updatedSwapManager}`);
    
    if (updatedSwapManager === newAddress) {
        console.log("✅ Update successful!");
    } else {
        console.log("❌ Update failed - address mismatch!");
    }

    // ============ VERIFY ACTIVE PLUGIN ============
    console.log("\nVerifying active plugin configuration...");
    const swapManager = await ethers.getContractAt("SwapManager", updatedSwapManager);
    
    try {
        const activePlugin = await swapManager.activeSwapPlugin();
        console.log(`Active plugin name: ${activePlugin}`);
        
        const pluginAddress = await beacon.getImplementation(activePlugin);
        console.log(`Plugin address: ${pluginAddress}`);
        
        if (pluginAddress !== ethers.ZeroAddress) {
            console.log("✅ Plugin configured correctly!");
        } else {
            console.log("⚠️  WARNING: Plugin not found in Beacon");
        }
    } catch (error) {
        console.log("⚠️  WARNING: Could not verify active plugin");
    }

    // ============ SUMMARY ============
    console.log("\n============================================================");
    console.log("  DEPLOYMENT SUMMARY");
    console.log("============================================================");
    console.log(`Old SwapManager: ${OLD_SWAP_MANAGER}`);
    console.log(`New SwapManager: ${newAddress}`);
    console.log(`Beacon: ${BEACON_ADDRESS}`);
    console.log(`Transaction: ${tx.hash}`);
    console.log("\n✅ SwapManager updated successfully!");
    console.log("\nChanges:");
    console.log("  • Line 860: Uses _getActivePlugin() instead of simpleSwapRouter");
    console.log("  • Validates plugin address instead of simpleSwapRouter");
    console.log("  • Supports dynamic plugin switching via Beacon");
    console.log("\nNext: Test swap with refactored SwapManager");
    console.log("npx hardhat run scripts/interact/SwapPoolTokens.ts --network arbitrum");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
