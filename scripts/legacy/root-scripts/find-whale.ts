import { ethers } from "hardhat";
async function main() {
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const usdc = await ethers.getContractAt(["function balanceOf(address) view returns (uint256)"], USDC);
    const whales = [
        "0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7",
        "0xB38e8c17e38363aF6EbdCb3dAE12e0243582891D",
        "0x489ee077994B6658eAfA855C308275EAd8097C4A",
        "0xd3443ee1e91aF28e5FB858Fbd0D72A63bA8046E0",
        "0xF977814e90dA44bFA03b6295A0616a897441aceC",
        "0x1AB4973a48dc892Cd9971ECE8e01DcC7688f8F23",
        "0x47c031236e19d024b42f8AE6DA7A0d88bCD4C4f7", // GMX treasury
    ];
    for (const w of whales) {
        const bal = await usdc.balanceOf(w);
        const code = await ethers.provider.getCode(w);
        const isContract = code !== "0x";
        console.log(`${w}: ${ethers.formatUnits(bal, 6)} USDC ${isContract ? "(CONTRACT)" : "(EOA)"}`);
    }
}
main().catch(console.error);
