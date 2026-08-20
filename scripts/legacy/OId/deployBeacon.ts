import { ethers } from "hardhat";

async function main() {
    // Ottieni il contratto "Beacon" compilato
    const Beacon = await ethers.getContractFactory("Beacon");

    // Deploy del contratto Beacon
    const beacon = await Beacon.deploy();

    // Aspetta il completamento del deploy
    await beacon.waitForDeployment();

    console.log("Beacon deployed to:", beacon.target);
}

// Esegui lo script
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
