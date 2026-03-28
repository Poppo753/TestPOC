import { ethers } from "hardhat";

const NEW_VALUE_CALCULATOR = "0xEa86c60Ae788FCF8821FC215c2536DA1e543c46e";

async function main() {
  console.log("\n🔍 TEST selectTokenForSwap");
  console.log("=".repeat(80) + "\n");

  const valueCalculator = await ethers.getContractAt(
    ["function selectTokenForSwap(uint256) external view returns (string, uint256)"],
    NEW_VALUE_CALCULATOR
  );

  // Target: 0.001208 ETH (quello che serve)
  const targetValue = ethers.parseEther("0.001208");

  console.log(`Target Value: ${ethers.formatEther(targetValue)} ETH\n`);

  try {
    const [tokenCode, amount] = await valueCalculator.selectTokenForSwap(targetValue);
    console.log(`✅ Selected Token: ${tokenCode}`);
    console.log(`✅ Amount: ${amount}`);
    
    // Get token decimals to format
    const TOKEN_MANAGER = "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517";
    const tokenManager = await ethers.getContractAt(
      ["function getTokenInfo(string) external view returns (tuple(address,uint256,string,bool,uint256,uint256,uint256,uint256))"],
      TOKEN_MANAGER
    );
    
    const info = await tokenManager.getTokenInfo(tokenCode);
    const decimals = info[1];
    
    console.log(`✅ Amount formatted: ${ethers.formatUnits(amount, decimals)} ${tokenCode}`);
    
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
