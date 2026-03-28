import { ethers } from "hardhat";

/**
 * UPDATE UNISWAPV3PLUGIN IN BEACON
 * 
 * Sostituisce il vecchio UniswapV3Plugin (0x7ec9...) 
 * con il nuovo UniswapV3PluginDirect
 */

const BEACON_ADDRESS = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
const OLD_PLUGIN = "0x7ec91aEc1bD85E63D671b23E5deC8157D1f8aE01";

async function main() {
    console.log("============================================================");
    console.log("  UPDATE UniswapV3Plugin IN BEACON");
    console.log("============================================================\n");

    const [owner] = await ethers.getSigners();
    console.log(`Owner: ${owner.address}\n`);

    // Get new plugin address from user input or env
    const NEW_PLUGIN = process.env.NEW_PLUGIN_ADDRESS;
    
    if (!NEW_PLUGIN) {
        console.error("❌ Error: Set NEW_PLUGIN_ADDRESS environment variable");
        console.log("\nExample:");
        console.log("$env:NEW_PLUGIN_ADDRESS='0x...'");
        console.log("npx hardhat run scripts/admin/beacon/UpdateUniswapV3Plugin.ts --network arbitrum");
        process.exit(1);
    }

    console.log("Configuration:");
    console.log(`  Beacon: ${BEACON_ADDRESS}`);
    console.log(`  Old Plugin: ${OLD_PLUGIN}`);
    console.log(`  New Plugin: ${NEW_PLUGIN}\n`);

    // ============ CHECK CURRENT STATE ============
    console.log("Checking current state...");
    
    const beacon = await ethers.getContractAt("Beacon", BEACON_ADDRESS);
    
    const currentPlugin = await beacon.getImplementation("UniswapV3Plugin");
    console.log(`Current plugin in Beacon: ${currentPlugin}`);
    
    if (currentPlugin === NEW_PLUGIN) {
        console.log("✅ Plugin already up to date!");
        return;
    }

    // ============ VERIFY NEW PLUGIN ============
    console.log("\nVerifying new plugin...");
    
    const code = await ethers.provider.getCode(NEW_PLUGIN);
    if (code === "0x") {
        console.error(`❌ No contract found at ${NEW_PLUGIN}`);
        process.exit(1);
    }
    console.log(`✅ Contract exists (${code.length} bytes)`);

    // ============ UPDATE BEACON ============
    console.log("\nUpdating Beacon...");
    console.log("⏳ Sending transaction...");

    const tx = await beacon.updateImplementation(
        "UniswapV3Plugin",
        NEW_PLUGIN
    );

    console.log(`Transaction hash: ${tx.hash}`);
    console.log("⏳ Waiting for confirmation...");

    const receipt = await tx.wait();
    
    console.log(`✅ Transaction confirmed!`);
    console.log(`   Block: ${receipt?.blockNumber}`);
    console.log(`   Gas used: ${receipt?.gasUsed.toString()}`);

    // ============ VERIFY UPDATE ============
    console.log("\nVerifying update...");
    
    const updatedPlugin = await beacon.getImplementation("UniswapV3Plugin");
    console.log(`Updated plugin: ${updatedPlugin}`);
    
    if (updatedPlugin === NEW_PLUGIN) {
        console.log("✅ Update successful!");
    } else {
        console.log("❌ Update failed - plugin address mismatch!");
    }

    // ============ SUMMARY ============
    console.log("\n============================================================");
    console.log("  SUMMARY");
    console.log("============================================================");
    console.log(`Old plugin: ${OLD_PLUGIN}`);
    console.log(`New plugin: ${NEW_PLUGIN}`);
    console.log(`Transaction: ${tx.hash}`);
    console.log("\n✅ Beacon updated successfully!");
    console.log("\nNext: Test swap with new plugin");
    console.log("npx hardhat run scripts/interact/SwapPoolTokens.ts --network arbitrum");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
