/**
 * 🔍 CHECK POOL TOKENS AFTER WITHDRAWAL
 */

import { ethers } from "hardhat";

const CONTRACTS = {
  proxyGeneral: "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1"
};

const TOKENS = {
  WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
  USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"
};

async function main() {
  console.log("🔍 CHECKING POOL TOKENS AFTER WITHDRAWAL\n");
  
  const [deployer] = await ethers.getSigners();
  
  console.log("💰 Token Balances in ProxyGeneral:\n");
  
  // WETH
  const weth = await ethers.getContractAt("IERC20", TOKENS.WETH);
  const wethBalance = await weth.balanceOf(CONTRACTS.proxyGeneral);
  console.log(`   WETH: ${ethers.formatEther(wethBalance)} WETH`);
  
  // USDC
  const usdc = await ethers.getContractAt("IERC20", TOKENS.USDC);
  const usdcBalance = await usdc.balanceOf(CONTRACTS.proxyGeneral);
  console.log(`   USDC: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
  
  // WBTC
  const wbtc = await ethers.getContractAt("IERC20", TOKENS.WBTC);
  const wbtcBalance = await wbtc.balanceOf(CONTRACTS.proxyGeneral);
  console.log(`   WBTC: ${ethers.formatUnits(wbtcBalance, 8)} WBTC`);
  
  // USDT
  const usdt = await ethers.getContractAt("IERC20", TOKENS.USDT);
  const usdtBalance = await usdt.balanceOf(CONTRACTS.proxyGeneral);
  console.log(`   USDT: ${ethers.formatUnits(usdtBalance, 6)} USDT`);
  
  console.log("\n🚨 ANALYSIS:");
  
  if (usdcBalance > 0n || wbtcBalance > 0n || usdtBalance > 0n) {
    console.log("   ❌ TOKENS LEFT IN POOL (NOT SWAPPED!)");
    
    if (usdcBalance > 0n) {
      console.log(`      - USDC: ${ethers.formatUnits(usdcBalance, 6)} (~$${ethers.formatUnits(usdcBalance, 6)} USD)`);
    }
    if (wbtcBalance > 0n) {
      const btcPrice = 86000; // Approx
      const usdValue = Number(ethers.formatUnits(wbtcBalance, 8)) * btcPrice;
      console.log(`      - WBTC: ${ethers.formatUnits(wbtcBalance, 8)} (~$${usdValue.toFixed(2)} USD)`);
    }
    if (usdtBalance > 0n) {
      console.log(`      - USDT: ${ethers.formatUnits(usdtBalance, 6)} (~$${ethers.formatUnits(usdtBalance, 6)} USD)`);
    }
    
    console.log("\n   ⚠️ REASON: ValueCalculator.getTotalPoolValue() failed");
    console.log("   ⚠️ Without total value, withdrawal calculation was incorrect");
    console.log("   ⚠️ No automatic swap was triggered");
  } else {
    console.log("   ✅ All tokens successfully withdrawn/swapped");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Script failed:", error);
    process.exit(1);
  });
