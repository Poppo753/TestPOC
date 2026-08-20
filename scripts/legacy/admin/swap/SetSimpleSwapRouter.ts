/**
 * 🔧 SET SIMPLESWAP ROUTER IN SWAPMANAGER
 * 
 * Configura il SimpleSwap router nel SwapManager
 * Anche se usi il plugin system, il router deve essere settato per backward compatibility
 */

import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const BEACON_ADDRESS = process.env.BEACON_ADDRESS || "";

// Uniswap V3 SwapRouter on Arbitrum (questo è quello che usa UniswapV3Plugin)
const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

async function main() {
    console.log("\n" + "=".repeat(60));
    console.log("  SET SIMPLESWAP ROUTER");
    console.log("=".repeat(60) + "\n");

    if (!BEACON_ADDRESS) {
        console.log("❌ BEACON_ADDRESS not set in .env");
        process.exit(1);
    }

    const [signer] = await ethers.getSigners();
    console.log(`Using account: ${signer.address}`);
    
    const balance = await ethers.provider.getBalance(signer.address);
    console.log(`Account balance: ${ethers.formatEther(balance)} ETH\n`);

    const beacon = await ethers.getContractAt("Beacon", BEACON_ADDRESS);
    const swapManagerAddress = await beacon.getImplementation("SwapManager");
    
    console.log(`SwapManager: ${swapManagerAddress}`);
    console.log(`Router to set: ${UNISWAP_V3_ROUTER}\n`);

    const swapManager = await ethers.getContractAt("SwapManager", swapManagerAddress);

    // Verify ownership
    const owner = await swapManager.owner();
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
        console.log(`❌ You are not the SwapManager owner!`);
        console.log(`   Owner: ${owner}`);
        console.log(`   You: ${signer.address}\n`);
        process.exit(1);
    }

    console.log(`✅ Ownership verified\n`);

    // Check current router
    const currentRouter = await swapManager.simpleSwapRouter();
    console.log(`Current router: ${currentRouter}`);

    if (currentRouter.toLowerCase() === UNISWAP_V3_ROUTER.toLowerCase()) {
        console.log(`✅ Router already set correctly!\n`);
        return;
    }

    // Verify router contract exists
    const routerCode = await ethers.provider.getCode(UNISWAP_V3_ROUTER);
    if (routerCode === "0x" || routerCode === "0x0") {
        console.log(`❌ No contract at router address!`);
        process.exit(1);
    }

    console.log(`✅ Router contract verified (${routerCode.length} bytes)\n`);

    console.log("=".repeat(60));
    console.log("SETTING ROUTER");
    console.log("=".repeat(60) + "\n");

    console.log("⚠️  This will execute in 3 seconds...");
    console.log("Press Ctrl+C to cancel\n");

    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
        console.log("📤 Sending transaction...");

        const tx = await swapManager.setSimpleSwapRouter(UNISWAP_V3_ROUTER, {
            gasLimit: 200000
        });

        console.log(`   Transaction hash: ${tx.hash}`);
        console.log("   ⏳ Waiting for confirmation...\n");

        const receipt = await tx.wait(1);

        if (!receipt) {
            throw new Error("No receipt received");
        }

        console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);
        console.log(`   Gas used: ${receipt.gasUsed.toString()}\n`);

        // Verify
        console.log("=".repeat(60));
        console.log("VERIFYING CONFIGURATION");
        console.log("=".repeat(60) + "\n");

        const newRouter = await swapManager.simpleSwapRouter();

        if (newRouter.toLowerCase() === UNISWAP_V3_ROUTER.toLowerCase()) {
            console.log(`✅ SUCCESS! Router configured correctly!`);
            console.log(`   Router: ${newRouter}\n`);
        } else {
            console.log(`❌ Verification failed!`);
            console.log(`   Expected: ${UNISWAP_V3_ROUTER}`);
            console.log(`   Got: ${newRouter}\n`);
            process.exit(1);
        }

        console.log("=".repeat(60));
        console.log("✅ ROUTER CONFIGURATION COMPLETE");
        console.log("=".repeat(60));
        console.log("\n🎉 You can now execute swaps!\n");

        console.log("NEXT STEPS:");
        console.log("  1. Try the swap again:");
        console.log("     SWAP_TOKEN_FROM=WETH SWAP_TOKEN_TO=USDC SWAP_PERCENTAGE=50 npx hardhat run scripts/interact/SwapPoolTokens.ts --network arbitrum\n");

    } catch (error: any) {
        console.log("\n❌ Configuration failed!");
        console.error("Error:", error.message);

        if (error.message.includes("Ownable")) {
            console.log("\n💡 Solution: Make sure you are the SwapManager owner");
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
