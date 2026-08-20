/**
 * Test UniswapV3Plugin with a real call
 */

import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const BEACON_ADDRESS = process.env.BEACON_ADDRESS || "";
const WETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

async function main() {
    console.log("\n" + "=".repeat(60));
    console.log("  TEST UNISWAPV3PLUGIN");
    console.log("=".repeat(60) + "\n");

    const beacon = await ethers.getContractAt("Beacon", BEACON_ADDRESS);
    const pluginAddress = await beacon.getImplementation("UniswapV3Plugin");
    
    console.log(`Plugin: ${pluginAddress}\n`);

    const plugin = await ethers.getContractAt("UniswapV3Plugin", pluginAddress);

    // Test 1: getProtocolInfo
    console.log("Test 1: getProtocolInfo()");
    try {
        const info = await plugin.getProtocolInfo();
        console.log(`  Name: ${info.name}`);
        console.log(`  Version: ${info.version}`);
        console.log(`  Features: ${info.features}\n`);
    } catch (error: any) {
        console.log(`  ❌ Error: ${error.message}\n`);
    }

    // Test 2: supportsTokenPair
    console.log("Test 2: supportsTokenPair(WETH, USDC)");
    try {
        const supports = await plugin.supportsTokenPair(WETH_ADDRESS, USDC_ADDRESS);
        console.log(`  ${supports ? "✅" : "❌"} Supports: ${supports}\n`);
    } catch (error: any) {
        console.log(`  ❌ Error: ${error.message}\n`);
    }

    // Test 3: isHealthy
    console.log("Test 3: isHealthy()");
    try {
        const [healthy, reason] = await plugin.isHealthy();
        console.log(`  ${healthy ? "✅" : "❌"} Healthy: ${healthy}`);
        if (reason) console.log(`  Reason: ${reason}`);
        console.log("");
    } catch (error: any) {
        console.log(`  ❌ Error: ${error.message}\n`);
    }

    // Test 4: getExpectedOutput
    console.log("Test 4: getExpectedOutput(WETH → USDC, 0.00005 WETH)");
    try {
        const amountIn = ethers.parseEther("0.00005"); // 0.00005 WETH
        const expectedOut = await plugin.getExpectedOutput(WETH_ADDRESS, USDC_ADDRESS, amountIn);
        console.log(`  Expected: ${ethers.formatUnits(expectedOut, 6)} USDC`);
        console.log(`  Raw: ${expectedOut.toString()}\n`);
    } catch (error: any) {
        console.log(`  ❌ Error: ${error.message}\n`);
    }

    // Test 5: Check SimpleSwap address
    console.log("Test 5: Check SimpleSwap in Plugin");
    try {
        const simpleSwap = await plugin.simpleSwap();
        console.log(`  SimpleSwap: ${simpleSwap}`);
        
        if (simpleSwap === ethers.ZeroAddress) {
            console.log(`  ❌ SimpleSwap is zero address!\n`);
        } else {
            console.log(`  ✅ SimpleSwap configured\n`);
            
            // Check if SimpleSwap has code
            const code = await ethers.provider.getCode(simpleSwap);
            if (code === "0x" || code === "0x0") {
                console.log(`  ❌ SimpleSwap contract not found at address!\n`);
            } else {
                console.log(`  ✅ SimpleSwap contract exists (${code.length} bytes)\n`);
            }
        }
    } catch (error: any) {
        console.log(`  ❌ Error: ${error.message}\n`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n💥 Error:", error.message);
        process.exit(1);
    });
