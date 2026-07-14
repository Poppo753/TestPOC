import { ethers } from "hardhat";

const TOKEN_MANAGER = "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517";

async function main() {
  console.log("\n🔍 TEST GETTOKEN PRICE RETURN VALUES");
  console.log("=====================================\n");

  const tokenManager = await ethers.getContractAt(
    ["function getTokenPrice(string) external view returns (uint256, uint256, bool)"],
    TOKEN_MANAGER
  );

  console.log("💵 USDC:");
  try {
    const result = await tokenManager.getTokenPrice("USDC");
    console.log(`   price (result[0]): ${ethers.formatEther(result[0])}`);
    console.log(`   timestamp (result[1]): ${result[1]}`);
    console.log(`   isStale (result[2]): ${result[2]}`);
    console.log(`   ✅ Call succeeded (no revert)`);
  } catch (e: any) {
    console.log(`   ❌ Call failed: ${e.message}`);
  }

  console.log("\n₿ WBTC:");
  try {
    const result = await tokenManager.getTokenPrice("WBTC");
    console.log(`   price (result[0]): ${ethers.formatEther(result[0])}`);
    console.log(`   timestamp (result[1]): ${result[1]}`);
    console.log(`   isStale (result[2]): ${result[2]}`);
    console.log(`   ✅ Call succeeded (no revert)`);
  } catch (e: any) {
    console.log(`   ❌ Call failed: ${e.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
