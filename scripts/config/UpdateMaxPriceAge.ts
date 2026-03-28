import { ethers } from "hardhat";

const VALUE_CALCULATOR = "0xEa86c60Ae788FCF8821FC215c2536DA1e543c46e";  // NEW!

async function main() {
  console.log("\n⚙️ UPDATE VALUE CALCULATOR MAX PRICE AGE");
  console.log("=".repeat(80) + "\n");

  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}\n`);

  const valueCalculator = await ethers.getContractAt(
    [
      "function maxPriceAge() external view returns (uint256)",
      "function setMaxPriceAge(uint256) external"
    ],
    VALUE_CALCULATOR
  );

  // Current value
  const currentMaxPriceAge = await valueCalculator.maxPriceAge();
  console.log(`📊 Current maxPriceAge: ${currentMaxPriceAge} seconds (${Number(currentMaxPriceAge) / 3600} hours)`);

  // New value: 24 hours = 86400 seconds
  const newMaxPriceAge = 86400; // 24 hours
  console.log(`🔄 Setting new maxPriceAge: ${newMaxPriceAge} seconds (${newMaxPriceAge / 3600} hours)`);
  console.log(`   Reason: Support stablecoins with 24h heartbeat\n`);

  const tx = await valueCalculator.setMaxPriceAge(newMaxPriceAge);
  console.log(`📝 TX: ${tx.hash}`);
  console.log(`⏳ Waiting...`);

  const receipt = await tx.wait();
  console.log(`✅ Confirmed in block ${receipt?.blockNumber}\n`);

  // Verify
  const updatedMaxPriceAge = await valueCalculator.maxPriceAge();
  console.log(`✅ Updated maxPriceAge: ${updatedMaxPriceAge} seconds (${Number(updatedMaxPriceAge) / 3600} hours)`);

  console.log("\n" + "=".repeat(80));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
