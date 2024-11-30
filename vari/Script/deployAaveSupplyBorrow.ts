import { ethers } from "hardhat";

async function main() {
  // Contratto da deployare
  const AaveSupplyBorrowWithdrawal = await ethers.getContractFactory("AaveSupplyBorrowWithdrawal");
  const contract = await AaveSupplyBorrowWithdrawal.deploy();

  await contract.waitForDeployment();
  console.log("Contract deployed to:", contract.address);
}

main().catch((error) => {
  console.error("Error during deployment:", error);
  process.exitCode = 1;
});
