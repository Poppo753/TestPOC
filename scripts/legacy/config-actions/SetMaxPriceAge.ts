import { ethers } from "hardhat";

const VALUE_CALCULATOR = "0x2E042874BcFc6bE51e0D6b23F8Da22bDd8B215B0";

async function main() {
  console.log("\n⚙️  SET MAX PRICE AGE");
  console.log("=".repeat(80) + "\n");

  const valueCalculator = await ethers.getContractAt("ValueCalculator", VALUE_CALCULATOR);

  console.log("Setting maxPriceAge to 24 hours...");
  const tx = await valueCalculator.setMaxPriceAge(86400);
  console.log(`📝 TX: ${tx.hash}`);
  await tx.wait();
  console.log(`✅ maxPriceAge set to 24h\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
