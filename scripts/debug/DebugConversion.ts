import { ethers } from "hardhat";

/**
 * Debug the exact conversion calculation in ChainlinkAdapter
 */

async function main() {
  console.log("\n🧮 MANUAL CONVERSION CALCULATION");
  console.log("=====================================\n");

  // Real values from Chainlink
  const usdcUsdPrice = BigInt("99975249"); // USDC/USD: $0.99975249 (8 decimals)
  const usdcDecimals = 8;
  const ethUsdPrice = BigInt("293779680"); // ETH/USD: $2937.7968 (8 decimals)
  const ethDecimals = 8;

  console.log("📊 Input Values:");
  console.log(`   USDC/USD raw: ${usdcUsdPrice.toString()} (${usdcDecimals} decimals)`);
  console.log(`   USDC/USD: $${ethers.formatUnits(usdcUsdPrice, usdcDecimals)}`);
  console.log(`   ETH/USD raw: ${ethUsdPrice.toString()} (${ethDecimals} decimals)`);
  console.log(`   ETH/USD: $${ethers.formatUnits(ethUsdPrice, ethDecimals)}`);

  // Step 1: Normalize to 18 decimals
  console.log("\n📐 Step 1: Normalize to 18 decimals");
  const normalizedUSDC = usdcUsdPrice * (10n ** BigInt(18 - usdcDecimals));
  const normalizedETH = ethUsdPrice * (10n ** BigInt(18 - ethDecimals));
  console.log(`   normalizedTokenPrice = ${usdcUsdPrice} * 10^(18-${usdcDecimals})`);
  console.log(`   normalizedTokenPrice = ${usdcUsdPrice} * 10^${18 - usdcDecimals}`);
  console.log(`   normalizedTokenPrice = ${normalizedUSDC.toString()}`);
  console.log(`   normalizedTokenPrice = ${ethers.formatEther(normalizedUSDC)} (as ETH units)`);
  console.log();
  console.log(`   normalizedRefPrice = ${ethUsdPrice} * 10^(18-${ethDecimals})`);
  console.log(`   normalizedRefPrice = ${ethUsdPrice} * 10^${18 - ethDecimals}`);
  console.log(`   normalizedRefPrice = ${normalizedETH.toString()}`);
  console.log(`   normalizedRefPrice = ${ethers.formatEther(normalizedETH)} (as ETH units)`);

  // Step 2: Convert
  console.log("\n🔄 Step 2: Convert (token/USD) / (ETH/USD)");
  const convertedPrice = (normalizedUSDC * (10n ** 18n)) / normalizedETH;
  console.log(`   convertedPrice = (normalizedTokenPrice * 1e18) / normalizedRefPrice`);
  console.log(`   convertedPrice = (${normalizedUSDC.toString()} * 1000000000000000000) / ${normalizedETH.toString()}`);
  console.log(`   convertedPrice = ${convertedPrice.toString()}`);
  console.log(`   convertedPrice = ${ethers.formatEther(convertedPrice)} ETH per USDC`);

  // Expected calculation
  console.log("\n✅ Expected Calculation:");
  const expected = Number(ethers.formatUnits(usdcUsdPrice, usdcDecimals)) / 
                   Number(ethers.formatUnits(ethUsdPrice, ethDecimals));
  console.log(`   $${ethers.formatUnits(usdcUsdPrice, usdcDecimals)} / $${ethers.formatUnits(ethUsdPrice, ethDecimals)} = ${expected.toFixed(18)} ETH per USDC`);

  // Now test with BTC
  console.log("\n\n₿ BTC CALCULATION");
  console.log("=====================================\n");

  const btcUsdPrice = BigInt("8728542000000"); // BTC/USD: $87,285.42 (8 decimals)
  const btcDecimals = 8;

  console.log("📊 Input Values:");
  console.log(`   BTC/USD raw: ${btcUsdPrice.toString()} (${btcDecimals} decimals)`);
  console.log(`   BTC/USD: $${ethers.formatUnits(btcUsdPrice, btcDecimals)}`);
  console.log(`   ETH/USD raw: ${ethUsdPrice.toString()} (${ethDecimals} decimals)`);
  console.log(`   ETH/USD: $${ethers.formatUnits(ethUsdPrice, ethDecimals)}`);

  // Normalize
  const normalizedBTC = btcUsdPrice * (10n ** BigInt(18 - btcDecimals));
  console.log(`\n📐 Normalized BTC: ${ethers.formatEther(normalizedBTC)}`);

  // Convert
  const btcConverted = (normalizedBTC * (10n ** 18n)) / normalizedETH;
  console.log(`🔄 Converted: ${ethers.formatEther(btcConverted)} ETH per BTC`);

  const btcExpected = Number(ethers.formatUnits(btcUsdPrice, btcDecimals)) / 
                      Number(ethers.formatUnits(ethUsdPrice, ethDecimals));
  console.log(`✅ Expected: ${btcExpected.toFixed(6)} ETH per BTC`);

  // Now get actual Oracle Adapter result
  console.log("\n\n🔬 ORACLE ADAPTER ACTUAL RESULT");
  console.log("=====================================\n");

  const ORACLE_ADAPTER = "0x16a5201814Ba08E8a7c8C1f59f83E0409206761c";
  const oracleAdapter = await ethers.getContractAt(
    ["function getPrice(string) external view returns (uint256, uint256, bool)",
     "function getFeedConfig(string) external view returns (tuple(address,uint8,uint256,string,bool,uint256))"],
    ORACLE_ADAPTER
  );

  const usdcPrice = await oracleAdapter.getPrice("USDC");
  console.log("💵 USDC from Oracle:");
  console.log(`   Price: ${usdcPrice[0].toString()}`);
  console.log(`   Price (ETH): ${ethers.formatEther(usdcPrice[0])}`);
  console.log(`   Expected: ${ethers.formatEther(convertedPrice)}`);
  console.log(`   Match: ${usdcPrice[0] === convertedPrice ? '✅' : '❌'}`);

  const btcPrice = await oracleAdapter.getPrice("WBTC");
  console.log("\n₿ WBTC from Oracle:");
  console.log(`   Price: ${btcPrice[0].toString()}`);
  console.log(`   Price (ETH): ${ethers.formatEther(btcPrice[0])}`);
  console.log(`   Expected: ${ethers.formatEther(btcConverted)}`);
  console.log(`   Match: ${btcPrice[0] === btcConverted ? '✅' : '❌'}`);

  // Get feed configs
  console.log("\n\n⚙️ FEED CONFIGURATIONS");
  console.log("=====================================\n");

  try {
    const usdcConfig = await oracleAdapter.getFeedConfig("USDC");
    console.log("💵 USDC Config:");
    console.log(`   Feed Address: ${usdcConfig[0]}`);
    console.log(`   Decimals: ${usdcConfig[1]}`);
    console.log(`   Heartbeat: ${usdcConfig[2]} seconds`);
    console.log(`   Denomination: ${usdcConfig[3]}`);
    console.log(`   Is Active: ${usdcConfig[4]}`);
    console.log(`   Error Count: ${usdcConfig[5]}`);
  } catch (e: any) {
    console.log(`   ❌ Error: ${e.message}`);
  }

  try {
    const btcConfig = await oracleAdapter.getFeedConfig("WBTC");
    console.log("\n₿ WBTC Config:");
    console.log(`   Feed Address: ${btcConfig[0]}`);
    console.log(`   Decimals: ${btcConfig[1]}`);
    console.log(`   Heartbeat: ${btcConfig[2]} seconds`);
    console.log(`   Denomination: ${btcConfig[3]}`);
    console.log(`   Is Active: ${btcConfig[4]}`);
    console.log(`   Error Count: ${btcConfig[5]}`);
  } catch (e: any) {
    console.log(`   ❌ Error: ${e.message}`);
  }

  try {
    const ethConfig = await oracleAdapter.getReferenceFeedConfig("USD");
    console.log("\n🔗 USD Reference Feed (ETH/USD):");
    console.log(`   Feed Address: ${ethConfig[0]}`);
    console.log(`   Decimals: ${ethConfig[1]}`);
    console.log(`   Heartbeat: ${ethConfig[2]} seconds`);
    console.log(`   Denomination: ${ethConfig[3]}`);
    console.log(`   Is Active: ${ethConfig[4]}`);
    console.log(`   Error Count: ${ethConfig[5]}`);
  } catch (e: any) {
    console.log(`   ❌ Error: ${e.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
