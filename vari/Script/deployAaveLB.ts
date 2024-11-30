import { ethers } from "hardhat";

async function main() {
  // Deploy del contratto
  const AaveLenderBorrower = await ethers.getContractFactory("AaveLenderBorrower");
  const contract = await AaveLenderBorrower.deploy();

  // Wait for contract deployment to complete
  await contract.waitForDeployment();
  
  console.log("Contract deployed to:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

