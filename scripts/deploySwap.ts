import { ethers } from "hardhat";

async function main() {
    const SwapExamples = await ethers.getContractFactory("SwapExamples");
    const swapRouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564"; // Uniswap V3 router address on Arbitrum
    const swapExamples = await SwapExamples.deploy(swapRouterAddress);

    await swapExamples.waitForDeployment();
    console.log(`SwapExamples deployed to: ${swapExamples.target}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
