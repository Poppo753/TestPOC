import { ethers, upgrades } from "hardhat";

const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
const OLD_VALUE_CALCULATOR = "0x03309099AC8085C9f9303A53049883ad5e6abb70";

async function main() {
  console.log("\n🔄 REDEPLOY VALUE CALCULATOR");
  console.log("=".repeat(80) + "\n");

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}\n`);

  // Deploy new ValueCalculator
  console.log("📦 Deploying new ValueCalculator...");
  const ValueCalculator = await ethers.getContractFactory("ValueCalculator");
  const valueCalculator = await ValueCalculator.deploy(BEACON);
  await valueCalculator.waitForDeployment();
  
  const newAddress = await valueCalculator.getAddress();
  console.log(`✅ New ValueCalculator: ${newAddress}\n`);

  // Update Beacon
  console.log("🔄 Updating Beacon...");
  const beacon = await ethers.getContractAt(
    ["function setImplementation(string,address) external"],
    BEACON
  );

  const tx = await beacon.setImplementation("ValueCalculator", newAddress);
  console.log(`📝 TX: ${tx.hash}`);
  await tx.wait();
  console.log(`✅ Beacon updated\n`);

  // Set maxPriceAge to 24h
  console.log("⚙️  Setting maxPriceAge to 24h...");
  const newCalculator = await ethers.getContractAt("ValueCalculator", newAddress);
  const setTx = await newCalculator.setMaxPriceAge(86400);
  console.log(`📝 TX: ${setTx.hash}`);
  await setTx.wait();
  console.log(`✅ maxPriceAge set to 24h\n`);

  console.log("=".repeat(80));
  console.log(`📝 Old ValueCalculator: ${OLD_VALUE_CALCULATOR}`);
  console.log(`📝 New ValueCalculator: ${newAddress}`);
  console.log("=".repeat(80));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
