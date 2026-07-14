import { ethers } from "hardhat";

async function main() {
    // Ottieni il contratto
    const Pool = await ethers.getContractFactory("EnhancedLiquidityPoolETH");

    console.log("Deploying EnhancedLiquidityPoolETH...");

    // Distribuisci il contratto
    const pool = await Pool.deploy(); // Non è necessario chiamare deployed()
    await pool.waitForDeployment();
    console.log("Contract deployed to:", pool.target); // Stampa l'indirizzo del contratto
}


// Esegui lo script e gestisci gli errori
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
