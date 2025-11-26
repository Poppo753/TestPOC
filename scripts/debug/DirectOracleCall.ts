import { ethers } from "hardhat";

const ORACLE_ADAPTER = "0x018f6392eb912624930d68c3c226b707B1D8B2A7";
const TOKEN_MANAGER = "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517";

async function main() {
  console.log("\n🔍 DIRECT ORACLE ADAPTER CALL");
  console.log("=".repeat(80) + "\n");

  const oracleAdapter = await ethers.getContractAt(
    ["function getPrice(string) external view returns (uint256, uint256, bool)"],
    ORACLE_ADAPTER
  );

  const tokenManager = await ethers.getContractAt(
    [
      "function getTokenPrice(string) external view returns (uint256, uint256, bool)",
      "function getTokenInfo(string) external view returns (tuple(address,uint256,string,bool,uint256,uint256,uint256,uint256))"
    ],
    TOKEN_MANAGER
  );

  console.log("📊 USDC:");
  
  // Direct oracle call
  const [oraclePrice, oracleTimestamp, oracleValid] = await oracleAdapter.getPrice("USDC");
  console.log(`   Oracle Adapter price: ${oraclePrice} wei (${ethers.formatEther(oraclePrice)} ETH)`);
  console.log(`   Oracle timestamp: ${oracleTimestamp}`);
  console.log(`   Oracle valid: ${oracleValid}\n`);

  // TokenManager call
  const [tmPrice, tmTimestamp, tmStale] = await tokenManager.getTokenPrice("USDC");
  console.log(`   TokenManager price: ${tmPrice} wei (${ethers.formatEther(tmPrice)} ETH)`);
  console.log(`   TokenManager timestamp: ${tmTimestamp}`);
  console.log(`   TokenManager stale: ${tmStale}\n`);

  // Get token info
  const info = await tokenManager.getTokenInfo("USDC");
  console.log(`   Token decimals: ${info[1]}`);

  console.log("\n" + "=".repeat(80));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
