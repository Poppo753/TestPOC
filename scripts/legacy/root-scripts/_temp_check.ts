import { ethers } from "hardhat";
async function main() {
    const code = await ethers.provider.getCode("0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb");
    console.log("Morpho code length:", code.length);
    console.log("First 20 chars:", code.substring(0, 20));
    const wethCode = await ethers.provider.getCode("0x82aF49447D8a07e3bd95BD0d56f35241523fBab1");
    console.log("WETH code length:", wethCode.length);
    const block = await ethers.provider.getBlockNumber();
    console.log("Block number:", block);
}
main().catch(console.error);
