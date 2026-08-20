/**
 * Check if WETH is registered in Beacon
 */

import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const BEACON_ADDRESS = process.env.BEACON_ADDRESS || "";
const WETH_MAINNET = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

async function main() {
    console.log("\n" + "=".repeat(60));
    console.log("  CHECK WETH REGISTRATION");
    console.log("=".repeat(60) + "\n");

    const beacon = await ethers.getContractAt("Beacon", BEACON_ADDRESS);

    try {
        const wethAddress = await beacon.getImplementation("WETH");
        
        console.log(`✅ WETH is registered!`);
        console.log(`   Address: ${wethAddress}\n`);
        
        if (wethAddress.toLowerCase() === WETH_MAINNET.toLowerCase()) {
            console.log(`✅ CORRECT! This is Arbitrum WETH\n`);
        } else {
            console.log(`⚠️  Different address from Arbitrum mainnet WETH:`);
            console.log(`   Expected: ${WETH_MAINNET}`);
            console.log(`   Got: ${wethAddress}\n`);
        }
        
    } catch (error: any) {
        console.log(`❌ WETH not registered in Beacon!`);
        console.log(`   Error: ${error.message}\n`);
        console.log(`Run: npx hardhat run scripts/admin/beacon/RegisterWETH.ts --network arbitrum\n`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n💥 Error:", error.message);
        process.exit(1);
    });
