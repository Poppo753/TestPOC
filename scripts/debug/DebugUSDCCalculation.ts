import { ethers } from "hardhat";

const VALUE_CALCULATOR = "0xE06882B8a0Bb46dE28a4aa4694d41822C255457B";

async function main() {
  console.log("\n🔍 DEBUG USDC VALUE CALCULATION");
  console.log("=".repeat(80) + "\n");

  const valueCalculator = await ethers.getContractAt(
    [
      "function calculateTokenValueView(string) external view returns (uint256)",
      "function getCachedTokenValue(string) external view returns (uint256, bool)"
    ],
    VALUE_CALCULATOR
  );

  // Check cache first
  console.log("📦 Checking USDC cache...");
  try {
    const [cachedValue, isValid] = await valueCalculator.getCachedTokenValue("USDC");
    console.log(`   Cached Value: ${ethers.formatEther(cachedValue)} ETH`);
    console.log(`   Is Valid: ${isValid ? 'YES ✅' : 'NO ❌'}\n`);
  } catch (e: any) {
    console.log(`   ❌ Cache check failed: ${e.message}\n`);
  }

  // Try to calculate value
  console.log("🧮 Calculating USDC value...");
  try {
    const value = await valueCalculator.calculateTokenValueView("USDC");
    console.log(`   ✅ USDC Value: ${ethers.formatEther(value)} ETH`);
  } catch (e: any) {
    console.log(`   ❌ Calculation failed: ${e.message}`);
    if (e.data) {
      console.log(`   Error data: ${e.data}`);
      
      // Try to decode revert reason
      try {
        const reason = ethers.AbiCoder.defaultAbiCoder().decode(
          ['string'],
          '0x' + e.data.slice(10)
        );
        console.log(`   Decoded reason: ${reason}`);
      } catch {}
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
