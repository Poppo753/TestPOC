import { ethers } from "hardhat";

const TOKEN_MANAGER = "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517";
const NEW_ORACLE_ADAPTER = "0x018f6392eb912624930d68c3c226b707B1D8B2A7";

async function main() {
  console.log("\n🔍 DIAGNOSE TOKEN MANAGER VALIDITY");
  console.log("=====================================\n");

  // Get token configs from TokenManager
  const tokenManager = await ethers.getContractAt(
    [
      "function getTokenInfo(string) external view returns (tuple(address,uint256,string,bool,uint256,uint256,uint256,uint256))",
      "function getTokenPrice(string) external view returns (uint256, uint256, bool)"
    ],
    TOKEN_MANAGER
  );

  console.log("💵 USDC Token Config in TokenManager:");
  const usdcConfig = await tokenManager.getTokenInfo("USDC");
  console.log(`   Address: ${usdcConfig[0]}`);
  console.log(`   Decimals: ${usdcConfig[1]}`);
  console.log(`   Code: ${usdcConfig[2]}`);
  console.log(`   Active: ${usdcConfig[3]}`);
  console.log(`   Last Price Timestamp: ${usdcConfig[4]}`);
  console.log(`   Last Price: ${ethers.formatEther(usdcConfig[5])}`);
  console.log(`   Heartbeat: ${usdcConfig[6]} seconds (${Number(usdcConfig[6]) / 3600} hours)`);
  console.log(`   Error Count: ${usdcConfig[7]}`);

  const usdcPrice = await tokenManager.getTokenPrice("USDC");
  console.log(`\n   Current Price: ${ethers.formatEther(usdcPrice[0])}`);
  console.log(`   Timestamp: ${usdcPrice[1]}`);
  console.log(`   Valid: ${usdcPrice[2] ? '✅' : '❌'}`);

  const now = Math.floor(Date.now() / 1000);
  const age = now - Number(usdcPrice[1]);
  console.log(`   Age: ${age}s (${(age / 3600).toFixed(2)} hours)`);
  console.log(`   Within heartbeat: ${age <= Number(usdcConfig[6]) ? '✅' : '❌'}`);

  console.log("\n\n₿ WBTC Token Config in TokenManager:");
  const btcConfig = await tokenManager.getTokenInfo("WBTC");
  console.log(`   Address: ${btcConfig[0]}`);
  console.log(`   Decimals: ${btcConfig[1]}`);
  console.log(`   Code: ${btcConfig[2]}`);
  console.log(`   Active: ${btcConfig[3]}`);
  console.log(`   Last Price Timestamp: ${btcConfig[4]}`);
  console.log(`   Last Price: ${ethers.formatEther(btcConfig[5])}`);
  console.log(`   Heartbeat: ${btcConfig[6]} seconds (${Number(btcConfig[6]) / 3600} hours)`);
  console.log(`   Error Count: ${btcConfig[7]}`);

  const btcPrice = await tokenManager.getTokenPrice("WBTC");
  console.log(`\n   Current Price: ${ethers.formatEther(btcPrice[0])}`);
  console.log(`   Timestamp: ${btcPrice[1]}`);
  console.log(`   Valid: ${btcPrice[2] ? '✅' : '❌'}`);

  const btcAge = now - Number(btcPrice[1]);
  console.log(`   Age: ${btcAge}s (${(btcAge / 3600).toFixed(2)} hours)`);
  console.log(`   Within heartbeat: ${btcAge <= Number(btcConfig[6]) ? '✅' : '❌'}`);

  // Check Oracle Adapter directly
  console.log("\n\n🔬 Oracle Adapter Direct Check:");
  const oracleAdapter = await ethers.getContractAt(
    ["function getPrice(string) external view returns (uint256, uint256, bool)"],
    NEW_ORACLE_ADAPTER
  );

  const oracleUSDC = await oracleAdapter.getPrice("USDC");
  console.log(`\n💵 USDC from Oracle Adapter:`);
  console.log(`   Price: ${ethers.formatEther(oracleUSDC[0])}`);
  console.log(`   Timestamp: ${oracleUSDC[1]}`);
  console.log(`   Valid: ${oracleUSDC[2] ? '✅' : '❌'}`);
  const oracleUsdcAge = now - Number(oracleUSDC[1]);
  console.log(`   Age: ${oracleUsdcAge}s (${(oracleUsdcAge / 3600).toFixed(2)} hours)`);

  const oracleBTC = await oracleAdapter.getPrice("WBTC");
  console.log(`\n₿ WBTC from Oracle Adapter:`);
  console.log(`   Price: ${ethers.formatEther(oracleBTC[0])}`);
  console.log(`   Timestamp: ${oracleBTC[1]}`);
  console.log(`   Valid: ${oracleBTC[2] ? '✅' : '❌'}`);
  const oracleBtcAge = now - Number(oracleBTC[1]);
  console.log(`   Age: ${oracleBtcAge}s (${(oracleBtcAge / 3600).toFixed(2)} hours)`);

  console.log("\n\n📋 DIAGNOSIS:");
  console.log("=====================================");
  console.log(`TokenManager checks if price timestamp is within its own heartbeat setting.`);
  console.log(`If Oracle Adapter returns valid=true but TokenManager returns valid=false:`);
  console.log(`   → Price timestamp is older than TokenManager's heartbeat`);
  console.log(`   → Need to update TokenManager heartbeat or Oracle Adapter returns older timestamp`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
