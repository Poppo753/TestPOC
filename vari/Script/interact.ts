import { ethers } from "hardhat";

async function main() {
    const contractAddress = "0xE5d60a1fa107De973ff66b3E48DC871D43DC93Ed";
    const MyStrategy = await ethers.getContractAt("MyStrategy", contractAddress);

    // Leggi il nome della strategia
    const name = await MyStrategy.strategyName();
    console.log("Strategy name:", name);
}

main().catch((error) => {
    console.error("Error interacting with the contract:", error);
    process.exitCode = 1;
});
