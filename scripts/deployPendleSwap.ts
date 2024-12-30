import { ethers } from "hardhat";

async function main() {
  const PendleSwap = await ethers.getContractFactory("PendleSwap");
  const pendleRouterAddress = "0x888888888889758F76e7103c6CbF23ABbF58F946"; // Indirizzo del router
  const pendleSwap = await PendleSwap.deploy(pendleRouterAddress);
  await pendleSwap.waitForDeployment();
  console.log("PendleSwap deployed at:", pendleSwap.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
