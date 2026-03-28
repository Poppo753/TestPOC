import { ethers } from "hardhat";

/**
 * Script: Verifica price feed Chainlink per USDC e WBTC
 * - Mostra address dei feed
 * - Mostra denomination (USD vs ETH)
 * - Verifica la conversione
 * - Spiega perché i prezzi sono "not reliable"
 */

const ORACLE_ADAPTER_ADDRESS = "0x16a5201814Ba08E8a7c8C1f59f83E0409206761c";

async function main() {
  console.log("\n🔍 CHAINLINK PRICE FEED VERIFICATION");
  console.log("=====================================");

  const chainlinkAdapter = await ethers.getContractAt(
    ["function priceFeeds(string) external view returns (address feedAddress, uint8 decimals, uint256 heartbeat, string denomination, bool isActive, uint256 errorCount)",
     "function referenceFeeds(string) external view returns (address feedAddress, uint8 decimals, uint256 heartbeat, string denomination, bool isActive, uint256 errorCount)",
     "function targetDenomination() external view returns (string)",
     "function getPrice(string) external view returns (uint256, uint256, bool)"],
    ORACLE_ADAPTER_ADDRESS
  );

  // Get target denomination
  const targetDenom = await chainlinkAdapter.targetDenomination();
  console.log(`\n🎯 Target Denomination: ${targetDenom}`);

  // ============================================
  // CHECK USDC CONFIGURATION
  // ============================================
  console.log(`\n💵 USDC CONFIGURATION:`);
  console.log(`-------------------------------------`);

  try {
    const usdcFeed = await chainlinkAdapter.priceFeeds("USDC");
    console.log(`Feed Address: ${usdcFeed.feedAddress}`);
    console.log(`Decimals: ${usdcFeed.decimals}`);
    console.log(`Heartbeat: ${usdcFeed.heartbeat} seconds (${Number(usdcFeed.heartbeat) / 3600} hours)`);
    console.log(`Denomination: ${usdcFeed.denomination}`);
    console.log(`Is Active: ${usdcFeed.isActive ? '✅' : '❌'}`);
    console.log(`Error Count: ${usdcFeed.errorCount}`);

    // Check if it's a direct feed or needs conversion
    if (usdcFeed.denomination !== targetDenom) {
      console.log(`\n⚠️ REQUIRES CONVERSION: ${usdcFeed.denomination} → ${targetDenom}`);
      
      // Check reference feed
      console.log(`\n📡 Reference Feed (${usdcFeed.denomination}):`);
      const refFeed = await chainlinkAdapter.referenceFeeds(usdcFeed.denomination);
      console.log(`  Address: ${refFeed.feedAddress}`);
      console.log(`  Decimals: ${refFeed.decimals}`);
      console.log(`  Heartbeat: ${refFeed.heartbeat} seconds`);
      console.log(`  Denomination: ${refFeed.denomination}`);
      console.log(`  Is Active: ${refFeed.isActive ? '✅' : '❌'}`);

      if (refFeed.feedAddress !== ethers.ZeroAddress) {
        // Get data from reference feed
        const refChainlink = await ethers.getContractAt(
          ["function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80)",
           "function description() external view returns (string)"],
          refFeed.feedAddress
        );
        const refDesc = await refChainlink.description();
        const refRoundData = await refChainlink.latestRoundData();
        console.log(`  Description: ${refDesc}`);
        console.log(`  Latest Price: ${refRoundData[1]}`);
        console.log(`  Updated At: ${refRoundData[3]} (${new Date(Number(refRoundData[3]) * 1000).toISOString()})`);
      }
    }

    // Get data from main feed
    if (usdcFeed.feedAddress !== ethers.ZeroAddress) {
      console.log(`\n📊 Chainlink Feed Data:`);
      const usdcChainlink = await ethers.getContractAt(
        ["function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80)",
         "function description() external view returns (string)"],
        usdcFeed.feedAddress
      );
      const desc = await usdcChainlink.description();
      const roundData = await usdcChainlink.latestRoundData();
      console.log(`  Description: ${desc}`);
      console.log(`  Latest Price: ${roundData[1]}`);
      console.log(`  Formatted: ${ethers.formatUnits(roundData[1], usdcFeed.decimals)}`);
      console.log(`  Updated At: ${roundData[3]} (${new Date(Number(roundData[3]) * 1000).toISOString()})`);
      console.log(`  Age: ${Math.floor((Date.now() / 1000) - Number(roundData[3]))} seconds`);
      
      // Check staleness
      const age = Math.floor((Date.now() / 1000) - Number(roundData[3]));
      const isFresh = age <= Number(usdcFeed.heartbeat);
      console.log(`  Is Fresh (age <= heartbeat): ${isFresh ? '✅' : '❌ STALE!'}`);
    }
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
  }

  // ============================================
  // CHECK WBTC CONFIGURATION
  // ============================================
  console.log(`\n₿ WBTC CONFIGURATION:`);
  console.log(`-------------------------------------`);

  try {
    const wbtcFeed = await chainlinkAdapter.priceFeeds("WBTC");
    console.log(`Feed Address: ${wbtcFeed.feedAddress}`);
    console.log(`Decimals: ${wbtcFeed.decimals}`);
    console.log(`Heartbeat: ${wbtcFeed.heartbeat} seconds (${Number(wbtcFeed.heartbeat) / 3600} hours)`);
    console.log(`Denomination: ${wbtcFeed.denomination}`);
    console.log(`Is Active: ${wbtcFeed.isActive ? '✅' : '❌'}`);
    console.log(`Error Count: ${wbtcFeed.errorCount}`);

    // Check if it's a direct feed or needs conversion
    if (wbtcFeed.denomination !== targetDenom) {
      console.log(`\n⚠️ REQUIRES CONVERSION: ${wbtcFeed.denomination} → ${targetDenom}`);
      
      // Check reference feed
      console.log(`\n📡 Reference Feed (${wbtcFeed.denomination}):`);
      const refFeed = await chainlinkAdapter.referenceFeeds(wbtcFeed.denomination);
      console.log(`  Address: ${refFeed.feedAddress}`);
      console.log(`  Decimals: ${refFeed.decimals}`);
      console.log(`  Heartbeat: ${refFeed.heartbeat} seconds`);
      console.log(`  Denomination: ${refFeed.denomination}`);
      console.log(`  Is Active: ${refFeed.isActive ? '✅' : '❌'}`);

      if (refFeed.feedAddress !== ethers.ZeroAddress) {
        // Get data from reference feed
        const refChainlink = await ethers.getContractAt(
          ["function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80)",
           "function description() external view returns (string)"],
          refFeed.feedAddress
        );
        const refDesc = await refChainlink.description();
        const refRoundData = await refChainlink.latestRoundData();
        console.log(`  Description: ${refDesc}`);
        console.log(`  Latest Price: ${refRoundData[1]}`);
        console.log(`  Updated At: ${refRoundData[3]} (${new Date(Number(refRoundData[3]) * 1000).toISOString()})`);
      }
    }

    // Get data from main feed
    if (wbtcFeed.feedAddress !== ethers.ZeroAddress) {
      console.log(`\n📊 Chainlink Feed Data:`);
      const wbtcChainlink = await ethers.getContractAt(
        ["function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80)",
         "function description() external view returns (string)"],
        wbtcFeed.feedAddress
      );
      const desc = await wbtcChainlink.description();
      const roundData = await wbtcChainlink.latestRoundData();
      console.log(`  Description: ${desc}`);
      console.log(`  Latest Price: ${roundData[1]}`);
      console.log(`  Formatted: ${ethers.formatUnits(roundData[1], wbtcFeed.decimals)}`);
      console.log(`  Updated At: ${roundData[3]} (${new Date(Number(roundData[3]) * 1000).toISOString()})`);
      console.log(`  Age: ${Math.floor((Date.now() / 1000) - Number(roundData[3]))} seconds`);
      
      // Check staleness
      const age = Math.floor((Date.now() / 1000) - Number(roundData[3]));
      const isFresh = age <= Number(wbtcFeed.heartbeat);
      console.log(`  Is Fresh (age <= heartbeat): ${isFresh ? '✅' : '❌ STALE!'}`);
    }
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log(`\n📋 SUMMARY & DIAGNOSIS:`);
  console.log(`=====================================`);
  
  console.log(`\n🔍 Why prices are "not reliable":`);
  console.log(`1. Check if feed data is STALE (age > heartbeat)`);
  console.log(`2. Check if reference feed (e.g., ETH/USD) is also stale`);
  console.log(`3. Both feeds must be fresh for conversion to work`);
  console.log(`4. TokenManager uses STRICTER heartbeat check than ChainlinkAdapter`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
