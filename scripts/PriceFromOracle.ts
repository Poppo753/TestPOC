import { ethers } from "hardhat";

async function main() {
    const contractAddress = "0xCcFB44a82335447260CD56540c02191109D3e9ED";
    const tokenManager = await ethers.getContractAt("TokenPriceManager", contractAddress);

    // Array dei codici identificativi dei token
    const tokenCodes = ["wstETH", "weETH", "ezETH", "rsETH"];

    for (const tokenCode of tokenCodes) {
        try {
            const price = await tokenManager.getTokenPrice(tokenCode);
// Converti il prezzo in un formato leggibile (esempio: in formato ETH)
            const formattedPrice = ethers.formatUnits(price, 18);
            console.log(`The price of ${tokenCode} is: ${formattedPrice.toString()}`);
        } catch (error) {
            console.error(`Failed to fetch price for ${tokenCode}:`, error);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
