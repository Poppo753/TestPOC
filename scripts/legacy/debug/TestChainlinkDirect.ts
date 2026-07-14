import { ethers } from "hardhat";

/**
 * Script: Test Chainlink feeds diretti su Arbitrum
 * Testa i feed più comuni per capire quale è configurato
 */

// Known Chainlink feeds on Arbitrum
const ARBITRUM_FEEDS = {
  // USDC feeds
  "USDC/USD": "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3",
  "USDC/ETH": "0x0000000000000000000000000000000000000000", // Does not exist directly
  
  // BTC feeds
  "BTC/USD": "0x6ce185860a4963106506C203335A2910413708e9",
  "BTC/ETH": "0xc5C8E77B397E531B8EC06BFb0048328B30E9eCfB",
  
  // ETH feeds
  "ETH/USD": "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
};

const ORACLE_ADAPTER = "0x16a5201814Ba08E8a7c8C1f59f83E0409206761c";

async function testFeed(name: string, address: string) {
  console.log(`\n📡 Testing ${name}:`);
  console.log(`   Address: ${address}`);
  
  try {
    if (address === ethers.ZeroAddress) {
      console.log(`   ⚠️ Feed does not exist`);
      return null;
    }

    const feed = await ethers.getContractAt(
      ["function description() external view returns (string)",
       "function decimals() external view returns (uint8)",
       "function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80)"],
      address
    );

    const description = await feed.description();
    const decimals = await feed.decimals();
    const roundData = await feed.latestRoundData();

    const price = roundData[1];
    const updatedAt = roundData[3];
    const age = Math.floor((Date.now() / 1000) - Number(updatedAt));

    console.log(`   Description: ${description}`);
    console.log(`   Decimals: ${decimals}`);
    console.log(`   Price: ${ethers.formatUnits(price, decimals)}`);
    console.log(`   Updated: ${new Date(Number(updatedAt) * 1000).toISOString()}`);
    console.log(`   Age: ${age} seconds (${(age / 3600).toFixed(2)} hours)`);

    return {
      description,
      decimals,
      price,
      updatedAt,
      age
    };
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log("\n🔍 CHAINLINK FEEDS ON ARBITRUM");
  console.log("=====================================");

  // Test all feeds
  const results: any = {};
  for (const [name, address] of Object.entries(ARBITRUM_FEEDS)) {
    results[name] = await testFeed(name, address);
  }

  // Calculate conversions
  console.log(`\n\n🧮 CALCULATED CONVERSIONS:`);
  console.log(`=====================================`);

  if (results["USDC/USD"] && results["ETH/USD"]) {
    console.log(`\n💵 USDC/ETH (calculated):`);
    const usdcUsd = Number(ethers.formatUnits(results["USDC/USD"].price, results["USDC/USD"].decimals));
    const ethUsd = Number(ethers.formatUnits(results["ETH/USD"].price, results["ETH/USD"].decimals));
    const usdcEth = usdcUsd / ethUsd;
    console.log(`   USDC/USD: $${usdcUsd}`);
    console.log(`   ETH/USD: $${ethUsd}`);
    console.log(`   USDC/ETH = ${usdcUsd} / ${ethUsd} = ${usdcEth.toFixed(18)} ETH per USDC`);
    console.log(`   Expected: ~0.0003 ETH per USDC (if ETH = $3000)`);
  }

  if (results["BTC/USD"] && results["ETH/USD"]) {
    console.log(`\n₿ BTC/ETH (via USD conversion):`);
    const btcUsd = Number(ethers.formatUnits(results["BTC/USD"].price, results["BTC/USD"].decimals));
    const ethUsd = Number(ethers.formatUnits(results["ETH/USD"].price, results["ETH/USD"].decimals));
    const btcEth = btcUsd / ethUsd;
    console.log(`   BTC/USD: $${btcUsd}`);
    console.log(`   ETH/USD: $${ethUsd}`);
    console.log(`   BTC/ETH = ${btcUsd} / ${ethUsd} = ${btcEth.toFixed(6)} ETH per BTC`);
    console.log(`   Expected: ~20-30 ETH per BTC`);
  }

  if (results["BTC/ETH"]) {
    console.log(`\n₿ BTC/ETH (direct feed):`);
    const btcEth = Number(ethers.formatUnits(results["BTC/ETH"].price, results["BTC/ETH"].decimals));
    console.log(`   BTC/ETH: ${btcEth} ETH per BTC`);
  }

  // Test Oracle Adapter
  console.log(`\n\n🔬 ORACLE ADAPTER TEST:`);
  console.log(`=====================================`);

  const oracleAdapter = await ethers.getContractAt(
    ["function getPrice(string) external view returns (uint256, uint256, bool)",
     "function supportsToken(string) external view returns (bool)"],
    ORACLE_ADAPTER
  );

  console.log(`\n💵 USDC via Oracle Adapter:`);
  try {
    const supportsUSDC = await oracleAdapter.supportsToken("USDC");
    console.log(`   Supports: ${supportsUSDC ? '✅' : '❌'}`);
    
    if (supportsUSDC) {
      const price = await oracleAdapter.getPrice("USDC");
      console.log(`   Price: ${ethers.formatEther(price[0])} ETH per USDC`);
      console.log(`   Timestamp: ${price[1]}`);
      console.log(`   Valid: ${price[2] ? '✅' : '❌'}`);
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  console.log(`\n₿ WBTC via Oracle Adapter:`);
  try {
    const supportsWBTC = await oracleAdapter.supportsToken("WBTC");
    console.log(`   Supports: ${supportsWBTC ? '✅' : '❌'}`);
    
    if (supportsWBTC) {
      const price = await oracleAdapter.getPrice("WBTC");
      console.log(`   Price: ${ethers.formatEther(price[0])} ETH per WBTC`);
      console.log(`   Timestamp: ${price[1]}`);
      console.log(`   Valid: ${price[2] ? '✅' : '❌'}`);
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  console.log(`\n\n📋 DIAGNOSIS:`);
  console.log(`=====================================`);
  console.log(`If Oracle Adapter prices are VERY different from calculated:`);
  console.log(`1. Wrong feed configured (e.g., USD feed without conversion)`);
  console.log(`2. Decimal conversion error`);
  console.log(`3. Stale data causing validation failures`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
