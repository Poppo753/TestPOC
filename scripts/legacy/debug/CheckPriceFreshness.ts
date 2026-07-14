import { ethers } from "hardhat";

const TOKEN_MANAGER = "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517";
const VALUE_CALCULATOR = "0xE06882B8a0Bb46dE28a4aa4694d41822C255457B";

async function main() {
  console.log("\n🕐 PRICE FRESHNESS CHECK");
  console.log("=".repeat(80) + "\n");

  const tokenManager = await ethers.getContractAt(
    ["function getTokenPrice(string) external view returns (uint256, uint256, bool)"],
    TOKEN_MANAGER
  );

  const valueCalculator = await ethers.getContractAt(
    ["function maxPriceAge() external view returns (uint256)"],
    VALUE_CALCULATOR
  );

  const maxPriceAge = await valueCalculator.maxPriceAge();
  const now = Math.floor(Date.now() / 1000);

  console.log(`⏰ Current time: ${now}`);
  console.log(`⏱️  Max Price Age: ${maxPriceAge} seconds (${Number(maxPriceAge) / 3600} hours)\n`);

  const tokens = ["USDC", "WBTC", "USDT"];

  for (const token of tokens) {
    console.log(`💰 ${token}:`);
    try {
      const [price, timestamp, isStale] = await tokenManager.getTokenPrice(token);
      const age = now - Number(timestamp);
      const isAcceptable = age <= Number(maxPriceAge);

      console.log(`   Price: ${ethers.formatEther(price)} ETH`);
      console.log(`   Timestamp: ${timestamp} (${new Date(Number(timestamp) * 1000).toISOString()})`);
      console.log(`   Age: ${age} seconds (${(age / 3600).toFixed(2)} hours)`);
      console.log(`   Is Stale: ${isStale ? 'YES ❌' : 'NO ✅'}`);
      console.log(`   Acceptable: ${isAcceptable ? 'YES ✅' : 'NO ❌ (too old)'}\n`);
    } catch (e: any) {
      console.log(`   ❌ Error: ${e.message}\n`);
    }
  }

  console.log("=".repeat(80));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
