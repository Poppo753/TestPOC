import { ethers } from "hardhat";

const NEW_VALUE_CALCULATOR = "0x03309099AC8085C9f9303A53049883ad5e6abb70";

async function main() {
  console.log("\n🔍 CHECK NEW VALUE CALCULATOR");
  console.log("=".repeat(80) + "\n");

  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}\n`);

  const valueCalculator = await ethers.getContractAt(
    [
      "function owner() external view returns (address)",
      "function beacon() external view returns (address)",
      "function maxPriceAge() external view returns (uint256)",
      "function calculateTokenValueView(string) external view returns (uint256)"
    ],
    NEW_VALUE_CALCULATOR
  );

  const owner = await valueCalculator.owner();
  const beacon = await valueCalculator.beacon();
  const maxPriceAge = await valueCalculator.maxPriceAge();

  console.log(`Owner: ${owner}`);
  console.log(`Beacon: ${beacon}`);
  console.log(`maxPriceAge: ${maxPriceAge} seconds (${Number(maxPriceAge) / 3600} hours)\n`);

  // Try to calculate USDC value
  console.log("🧮 Calculating USDC value...");
  try {
    const value = await valueCalculator.calculateTokenValueView("USDC");
    console.log(`✅ USDC Value: ${value} wei (${ethers.formatEther(value)} ETH)`);
  } catch (e: any) {
    console.log(`❌ Error: ${e.message}`);
    if (e.data) {
      console.log(`Data: ${e.data}`);
    }
  }

  console.log("\n" + "=".repeat(80));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
