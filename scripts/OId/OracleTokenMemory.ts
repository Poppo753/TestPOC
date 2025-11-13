import { ethers } from "hardhat";

async function main() {
    const contractAddress = "0xCcFB44a82335447260CD56540c02191109D3e9ED";
    const tokenManager = await ethers.getContractAt("TokenPriceManager", contractAddress);

    const allTokenData = await tokenManager.getAllTokenData();

    allTokenData.forEach((token: any, index: number) => {
        console.log(`Token ${index + 1}:`);
        console.log(`  Address: ${token.tokenAddress}`);
        console.log(`  Decimals: ${token.tokenDecimals}`);
        console.log(`  Code: ${token.tokenCode}`);
        console.log(`  Price Feed: ${token.priceFeed}`);
        console.log(`  Feed Decimals: ${token.priceFeedDecimals}`);
    });
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
