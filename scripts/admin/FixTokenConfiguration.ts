import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.mainnet" });

/**
 * Script: Corregge configurazione WBTC e USDC
 * - WBTC: Corregge decimals da 6 a 8
 * - USDC: Aumenta heartbeat da 3600 (1h) a 86400 (24h)
 */

const TOKEN_MANAGER_ADDRESS = "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517";
const WBTC_ADDRESS = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

async function main() {
  console.log("\n🔧 FIXING TOKEN CONFIGURATION");
  console.log("=====================================");

  const [deployer] = await ethers.getSigners();
  console.log(`\n📝 Using account: ${deployer.address}`);

  const tokenManager = await ethers.getContractAt("TokenManager", TOKEN_MANAGER_ADDRESS);

  // ============================================
  // 1. FIX WBTC DECIMALS (6 → 8)
  // ============================================
  console.log("\n🔹 FIXING WBTC DECIMALS");
  console.log("-------------------------------------");

  try {
    const wbtcDataBefore = await tokenManager.getTokenInfo("WBTC");
    console.log(`Current WBTC decimals: ${wbtcDataBefore.tokenDecimals}`);
    console.log(`Current WBTC heartbeat: ${wbtcDataBefore.heartbeat} seconds`);

    if (Number(wbtcDataBefore.tokenDecimals) === 8) {
      console.log("✅ WBTC decimals already correct (8)");
    } else {
      console.log(`⚠️ WBTC decimals incorrect: ${wbtcDataBefore.tokenDecimals} (expected: 8)`);
      console.log("\nCorrecting WBTC configuration...");

      const tx1 = await tokenManager.manageTokenData(
        "WBTC",
        WBTC_ADDRESS,
        8, // Correct decimals
        wbtcDataBefore.heartbeat // Keep existing heartbeat
      );

      console.log(`Transaction hash: ${tx1.hash}`);
      console.log("Waiting for confirmation...");
      
      const receipt1 = await tx1.wait();
      console.log(`✅ Transaction confirmed in block: ${receipt1?.blockNumber}`);

      const wbtcDataAfter = await tokenManager.getTokenInfo("WBTC");
      console.log(`\n✅ WBTC decimals fixed: ${wbtcDataAfter.tokenDecimals}`);
    }
  } catch (error: any) {
    console.error(`❌ Error fixing WBTC: ${error.message}`);
  }

  // ============================================
  // 2. FIX USDC HEARTBEAT (3600 → 86400)
  // ============================================
  console.log("\n🔹 FIXING USDC HEARTBEAT");
  console.log("-------------------------------------");

  try {
    const usdcDataBefore = await tokenManager.getTokenInfo("USDC");
    console.log(`Current USDC decimals: ${usdcDataBefore.tokenDecimals}`);
    console.log(`Current USDC heartbeat: ${usdcDataBefore.heartbeat} seconds (${Number(usdcDataBefore.heartbeat) / 3600} hours)`);

    const newHeartbeat = 86400; // 24 hours in seconds

    if (Number(usdcDataBefore.heartbeat) === newHeartbeat) {
      console.log("✅ USDC heartbeat already correct (24h)");
    } else {
      console.log(`⚠️ USDC heartbeat: ${Number(usdcDataBefore.heartbeat) / 3600}h (setting to 24h)`);
      console.log("\nUpdating USDC configuration...");

      const tx2 = await tokenManager.manageTokenData(
        "USDC",
        USDC_ADDRESS,
        Number(usdcDataBefore.tokenDecimals), // Keep existing decimals
        newHeartbeat // 24 hours
      );

      console.log(`Transaction hash: ${tx2.hash}`);
      console.log("Waiting for confirmation...");
      
      const receipt2 = await tx2.wait();
      console.log(`✅ Transaction confirmed in block: ${receipt2?.blockNumber}`);

      const usdcDataAfter = await tokenManager.getTokenInfo("USDC");
      console.log(`\n✅ USDC heartbeat updated: ${usdcDataAfter.heartbeat} seconds (${Number(usdcDataAfter.heartbeat) / 3600} hours)`);
    }
  } catch (error: any) {
    console.error(`❌ Error fixing USDC: ${error.message}`);
  }

  // ============================================
  // 3. VERIFY FINAL CONFIGURATION
  // ============================================
  console.log("\n📊 FINAL CONFIGURATION");
  console.log("=====================================");

  try {
    const wbtcFinal = await tokenManager.getTokenInfo("WBTC");
    console.log(`\n₿ WBTC:`);
    console.log(`  Decimals: ${wbtcFinal.tokenDecimals} ${Number(wbtcFinal.tokenDecimals) === 8 ? '✅' : '❌'}`);
    console.log(`  Heartbeat: ${wbtcFinal.heartbeat}s`);
    console.log(`  Active: ${wbtcFinal.isActive ? '✅' : '❌'}`);

    const usdcFinal = await tokenManager.getTokenInfo("USDC");
    console.log(`\n💵 USDC:`);
    console.log(`  Decimals: ${usdcFinal.tokenDecimals} ${Number(usdcFinal.tokenDecimals) === 6 ? '✅' : '❌'}`);
    console.log(`  Heartbeat: ${usdcFinal.heartbeat}s (${Number(usdcFinal.heartbeat) / 3600}h) ${Number(usdcFinal.heartbeat) === 86400 ? '✅' : '❌'}`);
    console.log(`  Active: ${usdcFinal.isActive ? '✅' : '❌'}`);
  } catch (error: any) {
    console.error(`❌ Error verifying configuration: ${error.message}`);
  }

  console.log("\n✅ Configuration fix completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
