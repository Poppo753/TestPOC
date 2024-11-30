import { ethers } from "hardhat";

async function main() {
  const OdosSwapper = await ethers.getContractFactory("OdosSwapper"); // Nome corretto del contratto
  const odosSwapper = await OdosSwapper.deploy("0xa669e7A0d4b3e4Fa48af2dE86BD4CD7126Be4e13"); // Indirizzo del router Odos
  await odosSwapper.waitForDeployment();

  console.log(`OdosSwapper deployed at: ${odosSwapper.target}`); // .target per Ethers.js v6
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
