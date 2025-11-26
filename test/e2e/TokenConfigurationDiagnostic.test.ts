import { ethers } from "hardhat";

/**
 * Test: Diagnostica configurazione USDC e WBTC
 * - Verifica address token, decimals, prezzi
 */

describe("E2E: Token Configuration Diagnostic", function () {
  this.timeout(600000);

  const TOKEN_MANAGER_ADDRESS = "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517";
  const PROXY_GENERAL_ADDRESS = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
  const VALUE_CALCULATOR_ADDRESS = "0xE06882B8a0Bb46dE28a4aa4694d41822C255457B";
  const ARBITRUM_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const ARBITRUM_WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

  it("Should diagnose USDC configuration", async function () {
    const tokenManager = await ethers.getContractAt("TokenManager", TOKEN_MANAGER_ADDRESS);
    const tokenCode = "USDC";

    console.log(`\n🔍 DIAGNOSTICA ${tokenCode}:`);
    console.log(`=====================================`);

    try {
      const tokenData = await tokenManager.getTokenInfo(tokenCode);
      
      console.log(`\n📋 Token Data:`);
      console.log(`  Token Address: ${tokenData.tokenAddress}`);
      console.log(`  Expected: ${ARBITRUM_USDC}`);
      console.log(`  Match: ${tokenData.tokenAddress.toLowerCase() === ARBITRUM_USDC.toLowerCase() ? '✅' : '❌'}`);
      console.log(`  Token Decimals: ${tokenData.tokenDecimals}`);
      console.log(`  Is Active: ${tokenData.isActive ? '✅' : '❌'}`);
      console.log(`  Last Price: ${tokenData.lastPrice}`);
      console.log(`  Last Price Timestamp: ${tokenData.lastPriceTimestamp}`);
      console.log(`  Heartbeat: ${tokenData.heartbeat} seconds`);
      console.log(`  Error Count: ${tokenData.errorCount}`);
      
      const oracleAdapterAddress = await tokenManager.oracleAdapter();
      console.log(`\n📡 Oracle Adapter: ${oracleAdapterAddress}`);
      
      const usdcContract = await ethers.getContractAt("IERC20", ARBITRUM_USDC);
      const balance = await usdcContract.balanceOf(PROXY_GENERAL_ADDRESS);
      console.log(`\n💰 Balance nel Pool:`);
      console.log(`  Raw: ${balance}`);
      console.log(`  Formatted: ${ethers.formatUnits(balance, 6)} USDC`);

      console.log(`\n💲 Prezzo da TokenManager.getTokenPrice():`);
      try {
        const priceData = await tokenManager.getTokenPrice(tokenCode);
        const price = priceData[0];
        const timestamp = priceData[1];
        const isReliable = priceData[2];
        
        console.log(`  Raw Price: ${price}`);
        console.log(`  Formatted: ${ethers.formatUnits(price, 18)} ETH per USDC`);
        console.log(`  Timestamp: ${timestamp}`);
        console.log(`  Is Reliable: ${isReliable ? '✅' : '❌'}`);
        
        if (price > 0n && balance > 0n && isReliable) {
          const value = (balance * price) / (10n ** BigInt(tokenData.tokenDecimals));
          console.log(`\n🧮 Valore Calcolato:`);
          console.log(`  Value in ETH: ${ethers.formatEther(value)} ETH`);
        } else if (!isReliable) {
          console.log(`\n⚠️ Price NOT reliable! Reasons:`);
          console.log(`  - Price feed stale (> heartbeat)`);
          console.log(`  - Oracle not configured`);
        }
      } catch (error: any) {
        console.log(`  ❌ Error: ${error.message}`);
      }

    } catch (error: any) {
      console.log(`\n❌ Error: ${error.message}`);
    }
  });

  it("Should diagnose WBTC configuration", async function () {
    const tokenManager = await ethers.getContractAt("TokenManager", TOKEN_MANAGER_ADDRESS);
    const tokenCode = "WBTC";

    console.log(`\n🔍 DIAGNOSTICA ${tokenCode}:`);
    console.log(`=====================================`);

    try {
      const tokenData = await tokenManager.getTokenInfo(tokenCode);
      
      console.log(`\n📋 Token Data:`);
      console.log(`  Token Address: ${tokenData.tokenAddress}`);
      console.log(`  Expected: ${ARBITRUM_WBTC}`);
      console.log(`  Match: ${tokenData.tokenAddress.toLowerCase() === ARBITRUM_WBTC.toLowerCase() ? '✅' : '❌'}`);
      console.log(`  Token Decimals: ${tokenData.tokenDecimals}`);
      console.log(`  Expected: 8`);
      console.log(`  Match: ${Number(tokenData.tokenDecimals) === 8 ? '✅' : '❌'}`);
      console.log(`  Is Active: ${tokenData.isActive ? '✅' : '❌'}`);
      console.log(`  Last Price: ${tokenData.lastPrice}`);
      console.log(`  Last Price Timestamp: ${tokenData.lastPriceTimestamp}`);
      console.log(`  Heartbeat: ${tokenData.heartbeat} seconds`);
      console.log(`  Error Count: ${tokenData.errorCount}`);
      
      const oracleAdapterAddress = await tokenManager.oracleAdapter();
      console.log(`\n📡 Oracle Adapter: ${oracleAdapterAddress}`);

      const wbtcContract = await ethers.getContractAt("IERC20", ARBITRUM_WBTC);
      const balance = await wbtcContract.balanceOf(PROXY_GENERAL_ADDRESS);
      console.log(`\n💰 Balance nel Pool:`);
      console.log(`  Raw: ${balance} satoshi`);
      console.log(`  Formatted: ${ethers.formatUnits(balance, 8)} WBTC`);

      console.log(`\n💲 Prezzo da TokenManager.getTokenPrice():`);
      try {
        const priceData = await tokenManager.getTokenPrice(tokenCode);
        const price = priceData[0];
        const timestamp = priceData[1];
        const isReliable = priceData[2];
        
        console.log(`  Raw Price: ${price}`);
        console.log(`  Formatted: ${ethers.formatUnits(price, 18)} ETH per WBTC`);
        console.log(`  Timestamp: ${timestamp}`);
        console.log(`  Is Reliable: ${isReliable ? '✅' : '❌'}`);
        
        if (price > 0n && balance > 0n && isReliable) {
          const value = (balance * price) / (10n ** BigInt(tokenData.tokenDecimals));
          console.log(`\n🧮 Valore Calcolato:`);
          console.log(`  Formula: (${balance} * ${price}) / 10^${tokenData.tokenDecimals}`);
          console.log(`  Value in ETH: ${ethers.formatEther(value)} ETH`);
          
          console.log(`\n📐 Verifica:`);
          console.log(`  ${ethers.formatUnits(balance, 8)} WBTC * ${ethers.formatEther(price)} ETH/WBTC`);
          console.log(`  = ${Number(ethers.formatUnits(balance, 8)) * Number(ethers.formatEther(price))} ETH`);
        }
      } catch (error: any) {
        console.log(`  ❌ Error: ${error.message}`);
      }

    } catch (error: any) {
      console.log(`\n❌ Error: ${error.message}`);
    }
  });

  it("Should show ValueCalculator results", async function () {
    const valueCalculator = await ethers.getContractAt("ValueCalculator", VALUE_CALCULATOR_ADDRESS);
    
    console.log(`\n🔬 VALUECALCULATOR RESULTS:`);
    console.log(`=====================================`);

    console.log(`\n💵 USDC:`);
    try {
      const usdcValue = await valueCalculator.calculateTokenValueView("USDC");
      console.log(`  Value: ${ethers.formatEther(usdcValue)} ETH`);
      console.log(`  Raw: ${usdcValue}`);
      if (usdcValue === 0n) console.log(`  ⚠️ Value is 0 - price feed issue!`);
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
    }

    console.log(`\n₿ WBTC:`);
    try {
      const wbtcValue = await valueCalculator.calculateTokenValueView("WBTC");
      console.log(`  Value: ${ethers.formatEther(wbtcValue)} ETH`);
      console.log(`  Raw: ${wbtcValue}`);
      if (wbtcValue === 0n) console.log(`  ⚠️ Value is 0 - price feed issue!`);
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  });
});
