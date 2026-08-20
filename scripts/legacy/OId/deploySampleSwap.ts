import { ethers } from "hardhat";

async function main() {
  const swapRouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

  // Create contract instance directly using the interface and address
  const swapRouter = await ethers.getContractAt("ISwapRouter", swapRouterAddress);

  const SimpleSwap = await ethers.getContractFactory("SimpleSwap");
  const simpleSwap = await SimpleSwap.deploy(swapRouter.getAddress());

  await simpleSwap.waitForDeployment();

  console.log("SimpleSwap deployed to:", simpleSwap.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
