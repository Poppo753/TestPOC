import { ethers } from "hardhat";

async function main() {
    console.log("Simulating swap call...\n");

    const SWAP_MANAGER = "0x01269d496E957A54e02cdcd5888957baf317A947";
    const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

    const swapManager = await ethers.getContractAt("SwapManager", SWAP_MANAGER);

    try {
        const result = await swapManager.performSwap.staticCall(
            "WETH",
            "USDC",
            ethers.parseEther("0.0001"),
            Math.floor(Date.now() / 1000) + 1200
        );
        
        console.log(`✅ Simulation SUCCESS!`);
        console.log(`Would receive: ${result.toString()} USDC`);
    } catch (error: any) {
        console.log(`❌ Simulation FAILED`);
        console.log(`Error: ${error.message}`);
        
        if (error.data) {
            console.log(`\nError data: ${error.data}`);
        }
    }
}

main().then(() => process.exit(0)).catch(console.error);
