/**
 * 🔍 Check Plugin Registration in Beacon
 * Verifica se UniswapV3Plugin è registrato nel Beacon
 */

import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const BEACON_ADDRESS = process.env.BEACON_ADDRESS || "";
const UNISWAP_V3_PLUGIN_ADDRESS = process.env.UNISWAP_V3_PLUGIN_ADDRESS || "";

async function main() {
    console.log("\n" + "=".repeat(60));
    console.log("  CHECK PLUGIN REGISTRATION");
    console.log("=".repeat(60) + "\n");

    if (!BEACON_ADDRESS) {
        console.log("❌ BEACON_ADDRESS not set in .env");
        process.exit(1);
    }

    console.log(`Beacon: ${BEACON_ADDRESS}`);
    console.log(`Expected Plugin: ${UNISWAP_V3_PLUGIN_ADDRESS}\n`);

    const beacon = await ethers.getContractAt("Beacon", BEACON_ADDRESS);

    // Try different possible names
    const namesToCheck = [
        "UniswapV3Plugin",
        "UniswapV3",
        "Uniswap",
        "SwapPlugin",
        "SimpleSwap"
    ];

    console.log("Checking possible plugin names in Beacon:\n");

    for (const name of namesToCheck) {
        try {
            const address = await beacon.getImplementation(name);
            if (address !== ethers.ZeroAddress) {
                console.log(`✅ Found: "${name}" -> ${address}`);
                
                if (address.toLowerCase() === UNISWAP_V3_PLUGIN_ADDRESS.toLowerCase()) {
                    console.log(`   ✅ MATCH! This is your UniswapV3Plugin!\n`);
                } else {
                    console.log(`   ℹ️  Different address\n`);
                }
            }
        } catch (error: any) {
            console.log(`❌ "${name}" -> Not registered`);
        }
    }

    // Check what's actually registered
    console.log("\n" + "=".repeat(60));
    console.log("Checking all core implementations:");
    console.log("=".repeat(60) + "\n");

    const coreNames = [
        "TokenManager",
        "SwapManager",
        "ValueCalculator",
        "ParameterManager",
        "EmergencyHandler",
        "ProxyGeneral"
    ];

    for (const name of coreNames) {
        try {
            const address = await beacon.getImplementation(name);
            console.log(`${name.padEnd(20)}: ${address}`);
        } catch (error: any) {
            console.log(`${name.padEnd(20)}: ❌ Not registered`);
        }
    }

    // Check SimpleSwap
    console.log("\n" + "=".repeat(60));
    console.log("Checking SimpleSwap/Plugin registrations:");
    console.log("=".repeat(60) + "\n");

    const swapManager = await ethers.getContractAt(
        "SwapManager",
        await beacon.getImplementation("SwapManager")
    );

    const simpleSwapRouter = await swapManager.simpleSwapRouter();
    const activePlugin = await swapManager.activeSwapPlugin();

    console.log(`SimpleSwap Router: ${simpleSwapRouter}`);
    console.log(`Active Plugin Name: "${activePlugin}"`);

    // Try to resolve active plugin
    console.log(`\nTrying to resolve "${activePlugin}" in Beacon...`);
    try {
        const pluginAddress = await beacon.getImplementation(activePlugin);
        console.log(`✅ Plugin Address: ${pluginAddress}`);
    } catch (error: any) {
        console.log(`❌ Failed to resolve: ${error.message}`);
        console.log(`\n⚠️  PROBLEM FOUND!`);
        console.log(`   SwapManager expects plugin name: "${activePlugin}"`);
        console.log(`   But Beacon doesn't have this registered!\n`);
        console.log(`SOLUTION:`);
        console.log(`   Register the plugin in Beacon with:`);
        console.log(`   npx hardhat run scripts/admin/beacon/RegisterImplementation.ts --network arbitrum\n`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n💥 Error:", error.message);
        process.exit(1);
    });
