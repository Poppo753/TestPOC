/**
 * Check if SimpleSwap contract exists
 */

import { ethers } from "hardhat";

const SIMPLE_SWAP_MAINNET = "0xa0DB78167CBAccD47524a261b7741C6B41Bbd096";

async function main() {
    console.log("\n" + "=".repeat(60));
    console.log("  CHECK SIMPLESWAP CONTRACT");
    console.log("=".repeat(60) + "\n");

    console.log(`Checking: ${SIMPLE_SWAP_MAINNET}\n`);

    const code = await ethers.provider.getCode(SIMPLE_SWAP_MAINNET);
    
    if (code === "0x" || code === "0x0") {
        console.log(`❌ NO CONTRACT FOUND!`);
        console.log(`   SimpleSwap is NOT deployed at this address\n`);
        console.log(`   You need to deploy SimpleSwap first!\n`);
    } else {
        console.log(`✅ Contract exists!`);
        console.log(`   Code size: ${code.length} bytes\n`);
        
        // Try to call a function to verify it's SimpleSwap
        try {
            const simpleSwap = await ethers.getContractAt("ISimpleSwap", SIMPLE_SWAP_MAINNET);
            
            const weth = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
            const usdc = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
            const amount = ethers.parseEther("0.001");
            
            const output = await simpleSwap.getExpectedOutput(weth, usdc, amount);
            console.log(`✅ SimpleSwap interface works!`);
            console.log(`   Expected output for 0.001 WETH: ${ethers.formatUnits(output, 6)} USDC\n`);
        } catch (error: any) {
            console.log(`❌ Contract doesn't implement ISimpleSwap interface!`);
            console.log(`   Error: ${error.message}\n`);
            console.log(`   This is probably NOT SimpleSwap!\n`);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n💥 Error:", error.message);
        process.exit(1);
    });
