/**
 * Check SwapManager configuration
 */

import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const BEACON_ADDRESS = process.env.BEACON_ADDRESS || "";

async function main() {
    console.log("\n" + "=".repeat(60));
    console.log("  CHECK SWAPMANAGER CONFIGURATION");
    console.log("=".repeat(60) + "\n");

    const beacon = await ethers.getContractAt("Beacon", BEACON_ADDRESS);
    const swapManagerAddress = await beacon.getImplementation("SwapManager");
    
    console.log(`SwapManager: ${swapManagerAddress}\n`);

    const swapManager = await ethers.getContractAt("SwapManager", swapManagerAddress);

    // Check configuration
    console.log("Configuration:\n");

    const simpleSwapRouter = await swapManager.simpleSwapRouter();
    console.log(`SimpleSwap Router: ${simpleSwapRouter}`);
    
    if (simpleSwapRouter === ethers.ZeroAddress) {
        console.log(`❌ SimpleSwap router NOT configured!\n`);
        console.log(`This is why the swap is failing!\n`);
        console.log(`SOLUTION:`);
        console.log(`Set the router with:`);
        console.log(`npx hardhat run scripts/admin/swap/SetSimpleSwapRouter.ts --network arbitrum\n`);
    } else {
        console.log(`✅ SimpleSwap router configured\n`);
    }

    const activePlugin = await swapManager.activeSwapPlugin();
    console.log(`Active Plugin: "${activePlugin}"`);

    const swapsEnabled = await swapManager.swapsEnabled();
    console.log(`Swaps Enabled: ${swapsEnabled ? "✅ YES" : "❌ NO"}`);

    const maxSlippage = await swapManager.maxSlippage();
    console.log(`Max Slippage: ${maxSlippage} bps (${Number(maxSlippage) / 100}%)`);

    const defaultDeadline = await swapManager.defaultDeadlineWindow();
    console.log(`Default Deadline: ${defaultDeadline} seconds (${Number(defaultDeadline) / 60} minutes)\n`);

    // Check if plugin is registered
    try {
        const pluginAddress = await beacon.getImplementation(activePlugin);
        console.log(`Plugin Address: ${pluginAddress}`);
        
        if (pluginAddress !== ethers.ZeroAddress) {
            console.log(`✅ Plugin registered in Beacon\n`);
            
            // Get plugin's SimpleSwap
            const plugin = await ethers.getContractAt("UniswapV3Plugin", pluginAddress);
            const pluginSimpleSwap = await plugin.simpleSwap();
            console.log(`Plugin's SimpleSwap: ${pluginSimpleSwap}`);
            
            if (pluginSimpleSwap !== ethers.ZeroAddress) {
                console.log(`✅ Plugin has SimpleSwap configured\n`);
            } else {
                console.log(`❌ Plugin's SimpleSwap is zero address!\n`);
            }
        } else {
            console.log(`❌ Plugin NOT registered in Beacon!\n`);
        }
    } catch (error: any) {
        console.log(`❌ Failed to resolve plugin: ${error.message}\n`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n💥 Error:", error.message);
        process.exit(1);
    });
