import { ethers } from "hardhat";

const PROXY = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
const TOKEN_MANAGER = "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517";
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

async function main() {
  console.log("\n" + "=".repeat(100));
  console.log("📊 TOTAL PORTFOLIO VALUE & WITHDRAWAL");
  console.log("=".repeat(100) + "\n");

  const [signer] = await ethers.getSigners();
  console.log(`User: ${signer.address}\n`);

  // ==================== STEP 1: CALCULATE TOTAL VALUE ====================
  console.log("STEP 1: Calculate Total Portfolio Value");
  console.log("-".repeat(100) + "\n");

  const tokens = [
    { name: "WETH", address: WETH, decimals: 18 },
    { name: "USDC", address: USDC, decimals: 6 },
    { name: "WBTC", address: WBTC, decimals: 8 }
  ];

  const tokenManager = await ethers.getContractAt(
    ["function getTokenPrice(string) external view returns (uint256, uint256, bool)"],
    TOKEN_MANAGER
  );

  let totalValueETH = 0;
  const balances: {[key: string]: { balance: bigint, value: number, price: bigint }} = {};

  for (const token of tokens) {
    const tokenContract = await ethers.getContractAt(
      ["function balanceOf(address) external view returns (uint256)"],
      token.address
    );

    const balance = await tokenContract.balanceOf(PROXY);
    
    console.log(`💰 ${token.name}:`);
    console.log(`   Balance: ${ethers.formatUnits(balance, token.decimals)}`);

    try {
      const priceData = await tokenManager.getTokenPrice(token.name);
      const price = priceData[0];
      const isStale = priceData[2];

      console.log(`   Price: ${ethers.formatEther(price)} ETH`);
      console.log(`   Stale: ${isStale ? 'YES ❌' : 'NO ✅'}`);

      const value = (balance * price) / (10n ** BigInt(token.decimals));
      const valueETH = Number(ethers.formatEther(value));

      console.log(`   Value: ${ethers.formatEther(value)} ETH\n`);

      totalValueETH += valueETH;
      balances[token.name] = { balance, value: valueETH, price };

    } catch (e: any) {
      console.log(`   ❌ Price not available: ${e.message}\n`);
    }
  }

  console.log("=".repeat(100));
  console.log(`💎 TOTAL PORTFOLIO VALUE: ${totalValueETH.toFixed(6)} ETH`);
  console.log("=".repeat(100) + "\n");

  // ==================== STEP 2: WITHDRAWAL WITH SWAPS ====================
  console.log("STEP 2: Withdraw All Assets and Swap to WETH");
  console.log("-".repeat(100) + "\n");

  const wethContract = await ethers.getContractAt(
    ["function balanceOf(address) external view returns (uint256)"],
    WETH
  );

  const wethBefore = await wethContract.balanceOf(signer.address);
  console.log(`💰 User WETH Before: ${ethers.formatEther(wethBefore)} WETH\n`);

  const proxy = await ethers.getContractAt(
    [
      "function withdrawToken(string,uint256,address) external"
    ],
    PROXY
  );

  console.log(`🔄 Testing automatic swap during withdrawal...\n`);

  // Withdraw USDC - should automatically swap to WETH
  const usdcBalance = balances["USDC"].balance;
  console.log(`📤 Withdrawing USDC: ${ethers.formatUnits(usdcBalance, 6)}`);

  try {
    const tx = await proxy.withdrawToken(
      "USDC",
      usdcBalance,
      signer.address
    );

    console.log(`📝 TX Hash: ${tx.hash}`);
    console.log(`⏳ Waiting for confirmation...`);

    const receipt = await tx.wait();
    console.log(`✅ Confirmed in block ${receipt?.blockNumber}\n`);

    // Check final WETH balance
    const wethAfter = await wethContract.balanceOf(signer.address);
    const wethReceived = wethAfter - wethBefore;

    console.log(`💰 User WETH After: ${ethers.formatEther(wethAfter)} WETH`);
    console.log(`💵 WETH Received: ${ethers.formatEther(wethReceived)} WETH\n`);

    // Calculate efficiency
    const expectedValue = BigInt(Math.floor(totalValueETH * 1e18));
    const efficiency = (Number(wethReceived) / Number(expectedValue)) * 100;

    console.log("=".repeat(100));
    console.log("📊 WITHDRAWAL SUMMARY:");
    console.log("=".repeat(100));
    console.log(`Expected Value: ${ethers.formatEther(expectedValue)} ETH`);
    console.log(`Received WETH:  ${ethers.formatEther(wethReceived)} WETH`);
    console.log(`Efficiency:     ${efficiency.toFixed(2)}%`);
    console.log(`Slippage:       ${(100 - efficiency).toFixed(2)}%`);
    console.log("=".repeat(100));

    if (efficiency >= 98) {
      console.log("\n✅ EXCELLENT! Low slippage withdrawal successful!");
    } else if (efficiency >= 95) {
      console.log("\n✅ GOOD! Acceptable slippage.");
    } else {
      console.log("\n⚠️ WARNING: High slippage detected!");
    }

  } catch (error: any) {
    console.log(`\n❌ Withdrawal failed!`);
    console.log(`Error: ${error.message}\n`);

    if (error.data) {
      console.log(`Error data: ${error.data}`);
    }

    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
