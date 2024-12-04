import { ethers } from "hardhat";

async function main() {
    const contractAddress = "0x386E12fe14563A8E7607E3b4e0cD30517809c038";
    const tokenManager = await ethers.getContractAt("TokenPriceManager", contractAddress);

    // Array dei codici identificativi dei token
    const tokenCodes = ["wstETH", "weETH", "ezETH", "rsETH"];

    for (const tokenCode of tokenCodes) {
        try {
            const price = await tokenManager.getTokenPrice(tokenCode);
            console.log(`The price of ${tokenCode} is: ${price.toString()}`);
        } catch (error) {
            console.error(`Failed to fetch price for ${tokenCode}:`, error);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
