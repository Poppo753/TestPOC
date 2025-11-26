import { ethers } from "hardhat";

const UNISWAP_V3_PLUGIN = "0x7ec91aEc1bD85E63D671b23E5deC8157D1f8aE01";
const TOKEN_MANAGER = "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517";
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

async function main() {
  console.log("\n" + "=".repeat(100));
  console.log("📊 POOL VALUE & WITHDRAWAL TEST");
  console.log("=".repeat(100) + "\n");

  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}\n`);

  // ==================== STEP 1: GET POOL VALUE ====================
  console.log("STEP 1: Analyze Pool Value");
  console.log("-".repeat(100));

  const uniPlugin = await ethers.getContractAt(
    [
      "function positionCount() external view returns (uint256)",
      "function positions(uint256) external view returns (tuple(uint256,address,address,address,int24,int24,uint128,uint256,uint256,uint128,uint128))",
      "function withdraw(uint256,uint128,uint256,uint256,string,bytes) external"
    ],
    UNISWAP_V3_PLUGIN
  );

  const posCount = await uniPlugin.positionCount();
  console.log(`📍 Total Positions: ${posCount}\n`);

  if (posCount === 0n) {
    console.log("❌ No positions found!");
    return;
  }

  let totalValueETH = 0;
  let totalLiquidity = 0n;

  for (let i = 0; i < posCount; i++) {
    const pos = await uniPlugin.positions(i);
    const tokenId = pos[0];
    const pool = pos[1];
    const token0Addr = pos[2];
    const token1Addr = pos[3];
    const liquidity = pos[6];

    console.log(`Position ${i}:`);
    console.log(`   Token ID: ${tokenId}`);
    console.log(`   Pool: ${pool}`);
    console.log(`   Liquidity: ${liquidity}\n`);

    totalLiquidity += liquidity;

    // Get token info
    const token0 = await ethers.getContractAt(
      ["function symbol() external view returns (string)", "function decimals() external view returns (uint8)", "function balanceOf(address) external view returns (uint256)"],
      token0Addr
    );
    const token1 = await ethers.getContractAt(
      ["function symbol() external view returns (string)", "function decimals() external view returns (uint8)", "function balanceOf(address) external view returns (uint256)"],
      token1Addr
    );

    const symbol0 = await token0.symbol();
    const symbol1 = await token1.symbol();
    const decimals0 = await token0.decimals();
    const decimals1 = await token1.decimals();
    const balance0 = await token0.balanceOf(UNISWAP_V3_PLUGIN);
    const balance1 = await token1.balanceOf(UNISWAP_V3_PLUGIN);

    console.log(`   ${symbol0}: ${ethers.formatUnits(balance0, decimals0)} (${decimals0} decimals)`);
    console.log(`   ${symbol1}: ${ethers.formatUnits(balance1, decimals1)} (${decimals1} decimals)\n`);

    // Get prices
    const tokenManager = await ethers.getContractAt(
      ["function getTokenPrice(string) external view returns (uint256, uint256, bool)"],
      TOKEN_MANAGER
    );

    try {
      const price0 = await tokenManager.getTokenPrice(symbol0);
      const value0 = (balance0 * price0[0]) / (10n ** BigInt(decimals0));
      console.log(`   ${symbol0} Price: ${ethers.formatEther(price0[0])} ETH`);
      console.log(`   ${symbol0} Value: ${ethers.formatEther(value0)} ETH`);
      console.log(`   ${symbol0} Stale: ${price0[2] ? 'YES ❌' : 'NO ✅'}\n`);
      totalValueETH += Number(ethers.formatEther(value0));
    } catch (e: any) {
      console.log(`   ❌ ${symbol0} price error: ${e.message}\n`);
    }

    try {
      const price1 = await tokenManager.getTokenPrice(symbol1);
      const value1 = (balance1 * price1[0]) / (10n ** BigInt(decimals1));
      console.log(`   ${symbol1} Price: ${ethers.formatEther(price1[0])} ETH`);
      console.log(`   ${symbol1} Value: ${ethers.formatEther(value1)} ETH`);
      console.log(`   ${symbol1} Stale: ${price1[2] ? 'YES ❌' : 'NO ✅'}\n`);
      totalValueETH += Number(ethers.formatEther(value1));
    } catch (e: any) {
      console.log(`   ❌ ${symbol1} price error: ${e.message}\n`);
    }

    console.log("-".repeat(100) + "\n");
  }

  console.log(`💰 TOTAL POOL VALUE: ${totalValueETH.toFixed(6)} ETH`);
  console.log(`📊 TOTAL LIQUIDITY: ${totalLiquidity}`);

  if (totalLiquidity > 0n) {
    const lpPrice = totalValueETH / Number(ethers.formatEther(totalLiquidity));
    console.log(`💎 LP PRICE: ${lpPrice.toFixed(6)} ETH per LP\n`);
  }

  // ==================== STEP 2: WITHDRAWAL ====================
  console.log("\n" + "=".repeat(100));
  console.log("STEP 2: Perform Withdrawal with Swap to WETH");
  console.log("=".repeat(100) + "\n");

  // Get WETH balance before
  const wethContract = await ethers.getContractAt(
    ["function balanceOf(address) external view returns (uint256)"],
    WETH
  );

  const wethBefore = await wethContract.balanceOf(signer.address);
  console.log(`💰 WETH Before: ${ethers.formatEther(wethBefore)} WETH\n`);

  // Withdraw first position (100% liquidity)
  const firstPos = await uniPlugin.positions(0);
  const tokenId = firstPos[0];
  const liquidity = firstPos[6];

  console.log(`Withdrawing Position 0:`);
  console.log(`   Token ID: ${tokenId}`);
  console.log(`   Liquidity: ${liquidity} (100%)\n`);

  // Encode swap params: target token = WETH, fee = 0.3%
  const swapParams = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "uint24"],
    [WETH, 3000]
  );

  console.log(`🔄 Executing withdrawal with swap to WETH...\n`);

  try {
    const tx = await uniPlugin.withdraw(
      tokenId,
      liquidity,      // 100% liquidity
      0,              // min amount0
      0,              // min amount1
      "UniswapV3",    // swap plugin
      swapParams
    );

    console.log(`📝 TX Hash: ${tx.hash}`);
    console.log(`⏳ Waiting for confirmation...`);

    const receipt = await tx.wait();
    console.log(`✅ Confirmed in block ${receipt?.blockNumber}\n`);

    // Get WETH balance after
    const wethAfter = await wethContract.balanceOf(signer.address);
    const wethReceived = wethAfter - wethBefore;

    console.log(`💰 WETH After: ${ethers.formatEther(wethAfter)} WETH`);
    console.log(`💵 WETH Received: ${ethers.formatEther(wethReceived)} WETH\n`);

    // Verify position removed
    const posCountAfter = await uniPlugin.positionCount();
    console.log(`📍 Positions After: ${posCountAfter}`);

    if (posCountAfter < posCount) {
      console.log(`✅ Position removed successfully!\n`);
    }

    console.log("=".repeat(100));
    console.log("✅ WITHDRAWAL COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(100));

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
