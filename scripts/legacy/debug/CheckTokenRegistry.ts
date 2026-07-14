import { ethers } from "hardhat";

const TOKEN_MANAGER = "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517";
const PROXY = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

async function main() {
  console.log("\n🔍 TOKEN REGISTRY CHECK");
  console.log("=".repeat(80) + "\n");

  const tokenManager = await ethers.getContractAt(
    [
      "function getTokenInfo(string) external view returns (tuple(address,uint256,string,bool,uint256,uint256,uint256,uint256))",
      "function getActiveTokens() external view returns (string[])",
      "function getTokenPrice(string) external view returns (uint256, uint256, bool)"
    ],
    TOKEN_MANAGER
  );

  // Get all active tokens
  console.log("📋 Active Tokens:");
  const activeTokens = await tokenManager.getActiveTokens();
  console.log(activeTokens);
  console.log();

  // Check each token
  const tokens = ["USDC", "WBTC", "WETH"];
  
  for (const token of tokens) {
    console.log(`\n💰 ${token}:`);
    
    try {
      const info = await tokenManager.getTokenInfo(token);
      console.log(`   Address: ${info[0]}`);
      console.log(`   Decimals: ${info[1]}`);
      console.log(`   Active: ${info[3] ? '✅' : '❌'}`);
      
      // Get balance in Proxy
      const tokenContract = await ethers.getContractAt(
        ["function balanceOf(address) external view returns (uint256)", "function decimals() external view returns (uint8)"],
        info[0]
      );
      const balance = await tokenContract.balanceOf(PROXY);
      const decimals = await tokenContract.decimals();
      console.log(`   Balance in Proxy: ${ethers.formatUnits(balance, decimals)}`);
      
      // Get price
      try {
        const price = await tokenManager.getTokenPrice(token);
        console.log(`   Price: ${ethers.formatEther(price[0])} ETH`);
        console.log(`   Stale: ${price[2] ? 'YES ❌' : 'NO ✅'}`);
        
        const value = (balance * price[0]) / (10n ** BigInt(decimals));
        console.log(`   Value: ${ethers.formatEther(value)} ETH`);
      } catch (e: any) {
        console.log(`   ❌ Price error: ${e.message}`);
      }
      
    } catch (e: any) {
      console.log(`   ❌ Token not registered: ${e.message}`);
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
