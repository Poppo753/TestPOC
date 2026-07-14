/**
 * 📝 REGISTER UNISWAPV3PLUGIN IN BEACON
 * 
 * Registra il plugin UniswapV3Plugin nel Beacon
 * Così SwapManager può risolverlo quando serve
 */

import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const BEACON_ADDRESS = process.env.BEACON_ADDRESS || "";
const UNISWAP_V3_PLUGIN_ADDRESS = process.env.UNISWAP_V3_PLUGIN_ADDRESS || "";

async function main() {
    console.log("\n" + "=".repeat(60));
    console.log("  REGISTER UNISWAPV3PLUGIN IN BEACON");
    console.log("=".repeat(60) + "\n");

    // Validation
    if (!BEACON_ADDRESS) {
        console.log("❌ BEACON_ADDRESS not set in .env");
        process.exit(1);
    }

    if (!UNISWAP_V3_PLUGIN_ADDRESS) {
        console.log("❌ UNISWAP_V3_PLUGIN_ADDRESS not set in .env");
        console.log("\nSet it in .env with the deployed plugin address:");
        console.log("UNISWAP_V3_PLUGIN_ADDRESS=0x...\n");
        process.exit(1);
    }

    const [signer] = await ethers.getSigners();
    console.log(`Using account: ${signer.address}`);
    
    const balance = await ethers.provider.getBalance(signer.address);
    console.log(`Account balance: ${ethers.formatEther(balance)} ETH\n`);

    if (balance < ethers.parseEther("0.0001")) {
        console.log("⚠️  WARNING: Low balance!\n");
    }

    console.log(`Beacon: ${BEACON_ADDRESS}`);
    console.log(`Plugin: ${UNISWAP_V3_PLUGIN_ADDRESS}\n`);

    // Connect to Beacon
    const beacon = await ethers.getContractAt("Beacon", BEACON_ADDRESS);

    // Verify we're the owner
    const owner = await beacon.owner();
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
        console.log(`❌ You are not the Beacon owner!`);
        console.log(`   Owner: ${owner}`);
        console.log(`   You: ${signer.address}\n`);
        process.exit(1);
    }

    console.log(`✅ Ownership verified\n`);

    // Verify plugin contract exists
    const pluginCode = await ethers.provider.getCode(UNISWAP_V3_PLUGIN_ADDRESS);
    if (pluginCode === "0x" || pluginCode === "0x0") {
        console.log(`❌ No contract found at ${UNISWAP_V3_PLUGIN_ADDRESS}`);
        console.log(`   Deploy the plugin first!\n`);
        process.exit(1);
    }

    console.log(`✅ Plugin contract exists (${pluginCode.length} bytes)\n`);

    // Check if already registered
    try {
        const currentAddress = await beacon.getImplementation("UniswapV3Plugin");
        
        if (currentAddress.toLowerCase() === UNISWAP_V3_PLUGIN_ADDRESS.toLowerCase()) {
            console.log(`✅ UniswapV3Plugin is already registered with correct address!`);
            console.log(`   Address: ${currentAddress}\n`);
            console.log(`Nothing to do. Plugin is ready to use! 🎉\n`);
            return;
        } else if (currentAddress !== ethers.ZeroAddress) {
            console.log(`⚠️  UniswapV3Plugin is registered with different address:`);
            console.log(`   Current: ${currentAddress}`);
            console.log(`   New: ${UNISWAP_V3_PLUGIN_ADDRESS}`);
            console.log(`\n   Will update to new address...\n`);
        }
    } catch (error) {
        console.log(`ℹ️  UniswapV3Plugin not yet registered\n`);
    }

    // Register the plugin
    console.log("=".repeat(60));
    console.log("REGISTERING PLUGIN");
    console.log("=".repeat(60) + "\n");

    console.log(`Name: "UniswapV3Plugin"`);
    console.log(`Address: ${UNISWAP_V3_PLUGIN_ADDRESS}\n`);

    console.log("⚠️  This will execute in 3 seconds...");
    console.log("Press Ctrl+C to cancel\n");

    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
        console.log("📤 Sending transaction...");

        const tx = await beacon.updateImplementation(
            "UniswapV3Plugin",
            UNISWAP_V3_PLUGIN_ADDRESS,
            {
                gasLimit: 200000
            }
        );

        console.log(`   Transaction hash: ${tx.hash}`);
        console.log("   ⏳ Waiting for confirmation...\n");

        const receipt = await tx.wait(1);

        if (!receipt) {
            throw new Error("No receipt received");
        }

        console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);
        console.log(`   Gas used: ${receipt.gasUsed.toString()}\n`);

        // Verify registration
        console.log("=".repeat(60));
        console.log("VERIFYING REGISTRATION");
        console.log("=".repeat(60) + "\n");

        const registeredAddress = await beacon.getImplementation("UniswapV3Plugin");

        if (registeredAddress.toLowerCase() === UNISWAP_V3_PLUGIN_ADDRESS.toLowerCase()) {
            console.log(`✅ SUCCESS! UniswapV3Plugin registered correctly!`);
            console.log(`   Name: "UniswapV3Plugin"`);
            console.log(`   Address: ${registeredAddress}\n`);
        } else {
            console.log(`❌ Verification failed!`);
            console.log(`   Expected: ${UNISWAP_V3_PLUGIN_ADDRESS}`);
            console.log(`   Got: ${registeredAddress}\n`);
            process.exit(1);
        }

        console.log("=".repeat(60));
        console.log("✅ PLUGIN REGISTRATION COMPLETE");
        console.log("=".repeat(60));
        console.log("\n🎉 You can now use SwapPoolTokens.ts script!\n");

        console.log("NEXT STEPS:");
        console.log("  1. Run the swap script:");
        console.log("     npx hardhat run scripts/interact/SwapPoolTokens.ts --network arbitrum\n");
        console.log("  2. Or use the PowerShell helper:");
        console.log("     .\\scripts\\interact\\swap-pool.ps1 -Preset 1\n");

    } catch (error: any) {
        console.log("\n❌ Registration failed!");
        console.error("Error:", error.message);

        if (error.message.includes("Ownable")) {
            console.log("\n💡 Solution: Make sure you are the Beacon owner");
        } else if (error.message.includes("gas")) {
            console.log("\n💡 Solution: Increase gas limit or check gas price");
        }

        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n💥 Script crashed:", error);
        process.exit(1);
    });
