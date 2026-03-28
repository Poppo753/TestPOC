import { ethers } from "hardhat";

const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
const OLD_LIQUIDITY_MANAGER = "0x545b79254F74Ba33958290BB73F2a338509c975d";

async function main() {
  console.log("\n🔄 REDEPLOY LIQUIDITY MANAGER");
  console.log("=".repeat(80) + "\n");

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}\n`);

  // Deploy new LiquidityManager
  console.log("📦 Deploying new LiquidityManager...");
  const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
  const liquidityManager = await LiquidityManager.deploy(BEACON);
  await liquidityManager.waitForDeployment();
  
  const newAddress = await liquidityManager.getAddress();
  console.log(`✅ New LiquidityManager: ${newAddress}\n`);

  // Update Beacon
  console.log("🔄 Updating Beacon...");
  const beacon = await ethers.getContractAt(
    ["function updateImplementation(string,address) external"],
    BEACON
  );

  const tx = await beacon.updateImplementation("LiquidityManager", newAddress);
  console.log(`📝 TX: ${tx.hash}`);
  await tx.wait();
  console.log(`✅ Beacon updated\n`);

  console.log("=".repeat(80));
  console.log(`📝 Old LiquidityManager: ${OLD_LIQUIDITY_MANAGER}`);
  console.log(`📝 New LiquidityManager: ${newAddress}`);
  console.log("=".repeat(80));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
