import { ethers } from "hardhat";

/**
 * Test: Verifica configurazione Oracle Adapter
 * - Controlla quali token sono supportati
 * - Verifica i price feed Chainlink per USDC e WBTC
 * - Verifica che i prezzi siano in ETH
 */

describe("E2E: Oracle Adapter Verification", function () {
  this.timeout(600000);

  const ORACLE_ADAPTER_ADDRESS = "0x16a5201814Ba08E8a7c8C1f59f83E0409206761c";
  const TOKEN_MANAGER_ADDRESS = "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517";

  it("Should verify Oracle Adapter configuration", async function () {
    console.log(`\n🔍 ORACLE ADAPTER ANALYSIS:`);
    console.log(`=====================================`);
    console.log(`Address: ${ORACLE_ADAPTER_ADDRESS}`);

    const oracleAdapter = await ethers.getContractAt(
      ["function supportsToken(string) external view returns (bool)",
       "function getPriceDecimals(string) external view returns (uint256)",
       "function getPrice(string) external view returns (uint256, uint256, bool)"],
      ORACLE_ADAPTER_ADDRESS
    );

    // Check USDC
    console.log(`\n💵 USDC:`);
    try {
      const supportsUSDC = await oracleAdapter.supportsToken("USDC");
      console.log(`  Supports USDC: ${supportsUSDC ? '✅' : '❌'}`);
      
      if (supportsUSDC) {
        const decimals = await oracleAdapter.getPriceDecimals("USDC");
        console.log(`  Price Decimals: ${decimals}`);
        
        try {
          const priceData = await oracleAdapter.getPrice("USDC");
          console.log(`  Price: ${priceData[0]}`);
          console.log(`  Formatted: ${ethers.formatUnits(priceData[0], Number(decimals))} ETH per USDC`);
          console.log(`  Timestamp: ${priceData[1]}`);
          console.log(`  Is Valid: ${priceData[2] ? '✅' : '❌'}`);
        } catch (error: any) {
          console.log(`  ❌ Error getting price: ${error.message}`);
        }
      }
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
    }

    // Check WBTC
    console.log(`\n₿ WBTC:`);
    try {
      const supportsWBTC = await oracleAdapter.supportsToken("WBTC");
      console.log(`  Supports WBTC: ${supportsWBTC ? '✅' : '❌'}`);
      
      if (supportsWBTC) {
        const decimals = await oracleAdapter.getPriceDecimals("WBTC");
        console.log(`  Price Decimals: ${decimals}`);
        
        try {
          const priceData = await oracleAdapter.getPrice("WBTC");
          console.log(`  Price: ${priceData[0]}`);
          console.log(`  Formatted: ${ethers.formatUnits(priceData[0], Number(decimals))} ETH per WBTC`);
          console.log(`  Timestamp: ${priceData[1]}`);
          console.log(`  Is Valid: ${priceData[2] ? '✅' : '❌'}`);
          
          // Verify it makes sense (1 BTC should be worth more than 1 ETH)
          const priceInEth = Number(ethers.formatUnits(priceData[0], Number(decimals)));
          console.log(`\n  📊 Price Check:`);
          console.log(`  1 WBTC = ${priceInEth} ETH`);
          console.log(`  Makes sense: ${priceInEth > 1 ? '✅ (BTC > ETH)' : '❌ (suspicious!)'}`);
        } catch (error: any) {
          console.log(`  ❌ Error getting price: ${error.message}`);
        }
      }
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  });

  it("Should check if Oracle Adapter is ChainlinkAdapter", async function () {
    console.log(`\n🔗 CHAINLINK ADAPTER CHECK:`);
    console.log(`=====================================`);

    try {
      // Try to call ChainlinkAdapter-specific functions
      const chainlinkAdapter = await ethers.getContractAt(
        ["function getPriceFeed(string) external view returns (address)",
         "function owner() external view returns (address)"],
        ORACLE_ADAPTER_ADDRESS
      );

      console.log(`\n💵 USDC Price Feed:`);
      try {
        const usdcFeed = await chainlinkAdapter.getPriceFeed("USDC");
        console.log(`  Feed Address: ${usdcFeed}`);
        
        if (usdcFeed !== ethers.ZeroAddress) {
          // Get feed info
          const feed = await ethers.getContractAt(
            ["function description() external view returns (string)",
             "function decimals() external view returns (uint8)",
             "function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80)"],
            usdcFeed
          );
          
          const description = await feed.description();
          const decimals = await feed.decimals();
          const roundData = await feed.latestRoundData();
          
          console.log(`  Description: ${description}`);
          console.log(`  Decimals: ${decimals}`);
          console.log(`  Latest Price: ${roundData[1]}`);
          console.log(`  Updated At: ${roundData[3]} (${new Date(Number(roundData[3]) * 1000).toISOString()})`);
          
          if (description.includes("USD") && !description.includes("ETH")) {
            console.log(`\n  ⚠️ WARNING: This is a ${description} feed!`);
            console.log(`  USDC/ETH requires conversion: USDC/USD ÷ ETH/USD`);
          }
        }
      } catch (error: any) {
        console.log(`  ❌ Error: ${error.message}`);
      }

      console.log(`\n₿ WBTC Price Feed:`);
      try {
        const wbtcFeed = await chainlinkAdapter.getPriceFeed("WBTC");
        console.log(`  Feed Address: ${wbtcFeed}`);
        
        if (wbtcFeed !== ethers.ZeroAddress) {
          // Get feed info
          const feed = await ethers.getContractAt(
            ["function description() external view returns (string)",
             "function decimals() external view returns (uint8)",
             "function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80)"],
            wbtcFeed
          );
          
          const description = await feed.description();
          const decimals = await feed.decimals();
          const roundData = await feed.latestRoundData();
          
          console.log(`  Description: ${description}`);
          console.log(`  Decimals: ${decimals}`);
          console.log(`  Latest Price: ${roundData[1]}`);
          console.log(`  Updated At: ${roundData[3]} (${new Date(Number(roundData[3]) * 1000).toISOString()})`);
          
          if (description.includes("USD") && !description.includes("ETH")) {
            console.log(`\n  ⚠️ WARNING: This is a ${description} feed!`);
            console.log(`  BTC/ETH requires conversion: BTC/USD ÷ ETH/USD`);
          } else if (description.includes("ETH")) {
            console.log(`\n  ✅ This is a direct ${description} feed!`);
          }
        }
      } catch (error: any) {
        console.log(`  ❌ Error: ${error.message}`);
      }

      // Check owner
      console.log(`\n👤 Oracle Adapter Owner:`);
      try {
        const owner = await chainlinkAdapter.owner();
        console.log(`  Owner: ${owner}`);
      } catch (error: any) {
        console.log(`  ❌ Error: ${error.message}`);
      }

    } catch (error: any) {
      console.log(`\n❌ Error accessing ChainlinkAdapter functions: ${error.message}`);
    }
  });

  it("Should compare TokenManager vs Oracle Adapter prices", async function () {
    console.log(`\n⚖️ PRICE COMPARISON:`);
    console.log(`=====================================`);

    const tokenManager = await ethers.getContractAt("TokenManager", TOKEN_MANAGER_ADDRESS);
    const oracleAdapter = await ethers.getContractAt(
      ["function getPrice(string) external view returns (uint256, uint256, bool)",
       "function getPriceDecimals(string) external view returns (uint256)"],
      ORACLE_ADAPTER_ADDRESS
    );

    // Compare USDC
    console.log(`\n💵 USDC:`);
    try {
      const tmPrice = await tokenManager.getTokenPrice("USDC");
      console.log(`  TokenManager Price: ${ethers.formatUnits(tmPrice[0], 18)} ETH`);
      console.log(`  TokenManager Reliable: ${tmPrice[2] ? '✅' : '❌'}`);
      
      const oaPrice = await oracleAdapter.getPrice("USDC");
      const oaDecimals = await oracleAdapter.getPriceDecimals("USDC");
      console.log(`  OracleAdapter Price: ${ethers.formatUnits(oaPrice[0], Number(oaDecimals))} ETH`);
      console.log(`  OracleAdapter Valid: ${oaPrice[2] ? '✅' : '❌'}`);
      
      console.log(`  Prices Match: ${tmPrice[0] === oaPrice[0] ? '✅' : '❌'}`);
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
    }

    // Compare WBTC
    console.log(`\n₿ WBTC:`);
    try {
      const tmPrice = await tokenManager.getTokenPrice("WBTC");
      console.log(`  TokenManager Price: ${ethers.formatUnits(tmPrice[0], 18)} ETH`);
      console.log(`  TokenManager Reliable: ${tmPrice[2] ? '✅' : '❌'}`);
      
      const oaPrice = await oracleAdapter.getPrice("WBTC");
      const oaDecimals = await oracleAdapter.getPriceDecimals("WBTC");
      console.log(`  OracleAdapter Price: ${ethers.formatUnits(oaPrice[0], Number(oaDecimals))} ETH`);
      console.log(`  OracleAdapter Valid: ${oaPrice[2] ? '✅' : '❌'}`);
      
      console.log(`  Prices Match: ${tmPrice[0] === oaPrice[0] ? '✅' : '❌'}`);
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  });
});
