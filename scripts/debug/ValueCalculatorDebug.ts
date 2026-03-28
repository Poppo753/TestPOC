import { ethers } from "hardhat";

const VALUE_CALCULATOR = "0x03309099AC8085C9f9303A53049883ad5e6abb70";  // NEW!
const TOKEN_MANAGER = "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517";
const PROXY = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";

async function main() {
  console.log("\n🔍 VALUE CALCULATOR DEBUG");
  console.log("=".repeat(80) + "\n");

  const valueCalculator = await ethers.getContractAt(
    [
      "function getTotalPoolValueView() external view returns (uint256)",
      "function calculatePortfolioValue() external view returns (uint256)"
    ],
    VALUE_CALCULATOR
  );

  const tokenManager = await ethers.getContractAt(
    ["function getActiveTokens() external view returns (string[])"],
    TOKEN_MANAGER
  );

  // Active tokens
  const activeTokens = await tokenManager.getActiveTokens();
  console.log("📋 Active Tokens:", activeTokens);
  console.log();

  // Try both methods
  try {
    const totalPoolValue = await valueCalculator.getTotalPoolValueView();
    console.log(`💎 getTotalPoolValueView(): ${ethers.formatEther(totalPoolValue)} ETH`);
  } catch (e: any) {
    console.log(`❌ getTotalPoolValueView() failed: ${e.message}`);
  }

  try {
    const portfolioValue = await valueCalculator.calculatePortfolioValue();
    console.log(`💰 calculatePortfolioValue(): ${ethers.formatEther(portfolioValue)} ETH`);
  } catch (e: any) {
    console.log(`❌ calculatePortfolioValue() failed: ${e.message}`);
  }

  console.log("\n" + "=".repeat(80));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
