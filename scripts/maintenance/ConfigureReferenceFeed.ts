import { ethers } from "hardhat";

/**
 * Script: Configure Reference Feed for USD→ETH conversion
 * 
 * PROBLEM: ChainlinkAdapter is configured with USD-denominated feeds (USDC/USD, BTC/USD)
 * but lacks the reference feed (ETH/USD) to convert to ETH denomination.
 * 
 * SOLUTION: Call setReferenceFeed("USD", ETH_USD_FEED, 8, 3600)
 */

// Contract addresses
const ORACLE_ADAPTER = "0x16a5201814Ba08E8a7c8C1f59f83E0409206761c";

// Chainlink feed addresses on Arbitrum
const ETH_USD_FEED = "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612"; // ETH/USD with 8 decimals
const HEARTBEAT_24H = 86400; // 24 hours

async function main() {
  console.log("\n🔧 CONFIGURE USD REFERENCE FEED");
  console.log("=====================================\n");

  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);

  const chainlinkAdapter = await ethers.getContractAt(
    [
      "function setReferenceFeed(string,address,uint8,uint256) external",
      "function setTargetDenomination(string) external",
      "function setPriceFeed(string,address,uint8,uint256,string) external",
      "function owner() external view returns (address)"
    ],
    ORACLE_ADAPTER
  );

  // Check owner
  const owner = await chainlinkAdapter.owner();
  console.log(`Oracle Adapter Owner: ${owner}`);
  console.log(`Is signer owner: ${owner.toLowerCase() === signer.address.toLowerCase() ? '✅' : '❌'}\n`);

  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.log("❌ ERROR: Signer is not the owner of ChainlinkAdapter!");
    console.log("   Cannot configure reference feed.");
    return;
  }

  // Step 1: Set target denomination to ETH
  console.log("Step 1: Set target denomination to ETH");
  try {
    const tx1 = await chainlinkAdapter.setTargetDenomination("ETH");
    console.log(`   TX: ${tx1.hash}`);
    await tx1.wait();
    console.log(`   ✅ Target denomination set to ETH\n`);
  } catch (error: any) {
    console.log(`   ⚠️ Warning: ${error.message}`);
    console.log(`   (May already be set)\n`);
  }

  // Step 2: Set USD reference feed (ETH/USD)
  console.log("Step 2: Set USD reference feed (ETH/USD)");
  console.log(`   Feed: ${ETH_USD_FEED}`);
  console.log(`   Decimals: 8`);
  console.log(`   Heartbeat: ${HEARTBEAT_24H}s (24h)`);

  try {
    // Try to estimate gas first to get better error message
    try {
      await chainlinkAdapter.setReferenceFeed.estimateGas(
        "USD",
        ETH_USD_FEED,
        8,
        HEARTBEAT_24H
      );
      console.log(`   ✅ Gas estimation successful`);
    } catch (gasError: any) {
      console.log(`   ❌ Gas estimation failed: ${gasError.message}`);
      if (gasError.data) {
        console.log(`   Error data: ${gasError.data}`);
      }
      throw gasError;
    }

    const tx2 = await chainlinkAdapter.setReferenceFeed(
      "USD",              // denomination
      ETH_USD_FEED,       // ETH/USD feed address
      8,                  // decimals
      HEARTBEAT_24H       // heartbeat
    );
    console.log(`   TX: ${tx2.hash}`);
    await tx2.wait();
    console.log(`   ✅ USD reference feed configured\n`);
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
    console.log(`   Full error:`, error);
    return;
  }

  // Step 3: Reconfigure price feeds with denomination
  console.log("Step 3: Reconfigure price feeds with USD denomination");

  const feeds = [
    { token: "USDC", feed: "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3", decimals: 8, heartbeat: 86400 },
    { token: "USDT", feed: "0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7", decimals: 8, heartbeat: 86400 },
    { token: "DAI", feed: "0xc5C8E77B397E531B8EC06BFb0048328B30E9eCfB", decimals: 8, heartbeat: 3600 },
    { token: "WBTC", feed: "0xd0C7101eACbB49F3deCcCc166d238410D6D46d57", decimals: 8, heartbeat: 86400 },
    { token: "WETH", feed: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612", decimals: 8, heartbeat: 3600 },
    { token: "ARB", feed: "0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6", decimals: 8, heartbeat: 86400 },
    { token: "LINK", feed: "0x86E53CF1B870786351Da77A57575e79CB55812CB", decimals: 8, heartbeat: 3600 },
    { token: "UNI", feed: "0x9C917083fDb403ab5ADbEC26Ee294f6EcAda2720", decimals: 8, heartbeat: 86400 },
  ];

  for (const { token, feed, decimals, heartbeat } of feeds) {
    console.log(`   Reconfiguring ${token}...`);
    try {
      const tx = await chainlinkAdapter.setPriceFeed(
        token,
        feed,
        decimals,
        heartbeat,
        "USD"  // denomination
      );
      console.log(`      TX: ${tx.hash}`);
      await tx.wait();
      console.log(`      ✅ ${token} configured with USD denomination`);
    } catch (error: any) {
      console.log(`      ❌ Error: ${error.message}`);
    }
  }

  // Step 4: Verify
  console.log("\n\n✅ VERIFICATION");
  console.log("=====================================\n");

  const testAdapter = await ethers.getContractAt(
    ["function getPrice(string) external view returns (uint256, uint256, bool)"],
    ORACLE_ADAPTER
  );

  console.log("💵 USDC:");
  const usdcPrice = await testAdapter.getPrice("USDC");
  console.log(`   Price: ${ethers.formatEther(usdcPrice[0])} ETH per USDC`);
  console.log(`   Valid: ${usdcPrice[2] ? '✅' : '❌'}`);
  console.log(`   Expected: ~0.00034 ETH per USDC`);

  console.log("\n₿ WBTC:");
  const btcPrice = await testAdapter.getPrice("WBTC");
  console.log(`   Price: ${ethers.formatEther(btcPrice[0])} ETH per WBTC`);
  console.log(`   Valid: ${btcPrice[2] ? '✅' : '❌'}`);
  console.log(`   Expected: ~29 ETH per WBTC`);

  console.log("\n\n📋 SUMMARY:");
  console.log("=====================================");
  console.log("If prices are now correct (~0.00034 and ~29), the conversion is working!");
  console.log("If still wrong, check:");
  console.log("1. setPriceFeed signature - may need 4 params (without denomination)");
  console.log("2. ChainlinkAdapter version - may not support denomination parameter");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
