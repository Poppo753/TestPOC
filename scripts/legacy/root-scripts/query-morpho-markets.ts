import { ethers } from "hardhat";

async function main() {
    const block = await ethers.provider.getBlockNumber();
    console.log("Fork block:", block);
    
    const checks = [
        ["Morpho Blue", "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb"],
        ["WETH", "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"],
        ["Aave Pool", "0x794a61358D6845594F94dc1DB02A252b5b4814aD"],
        ["USDC", "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"],
        ["IRM", "0x66F30587FB8D4206918deb78ecA7d5eBbafD06DA"],
        ["Oracle", "0x282FEB10549fde52bD61A6979424Ddf18A4971A2"],
    ];
    
    for (const [name, addr] of checks) {
        const code = await ethers.provider.getCode(addr);
        console.log(`${name} (${addr}): code length = ${code.length}`);
    }
}

main().catch(console.error);
