import { expect } from "chai";
import { ethers } from "hardhat";

describe("E2E: Complete Pool Value & Withdrawal", function () {
  this.timeout(60000);

  const PROXY_ADDRESS = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
  const VALUE_CALCULATOR = "0xE06882B8a0Bb46dE28a4aa4694d41822C255457B";
  const UNISWAP_V3_PLUGIN = "0x7ec91aEc1bD85E63D671b23E5deC8157D1f8aE01";
  const TOKEN_MANAGER = "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517";

  it("Should show complete pool value breakdown with correct prices", async function () {
    console.log("\n" + "=".repeat(100));
    console.log("📊 COMPLETE POOL VALUE ANALYSIS");
    console.log("=".repeat(100) + "\n");

    const valueCalc = await ethers.getContractAt(
      ["function getPluginTotalValue(address) external view returns (uint256)"],
      VALUE_CALCULATOR
    );

    const totalValue = await valueCalc.getPluginTotalValue(UNISWAP_V3_PLUGIN);
    console.log(`💰 Total Pool Value: ${ethers.formatEther(totalValue)} ETH`);
    console.log(`   Raw value: ${totalValue.toString()}\n`);

    // Get LP token supply
    const uniPlugin = await ethers.getContractAt(
      [
        "function positionCount() external view returns (uint256)",
        "function positions(uint256) external view returns (tuple(uint256,address,address,address,int24,int24,uint128,uint256,uint256,uint128,uint128))"
      ],
      UNISWAP_V3_PLUGIN
    );

    const posCount = await uniPlugin.positionCount();
    console.log(`📍 Number of positions: ${posCount}\n`);

    let totalLiquidity = 0n;

    for (let i = 0; i < posCount; i++) {
      const pos = await uniPlugin.positions(i);
      const tokenId = pos[0];
      const pool = pos[1];
      const token0 = pos[2];
      const token1 = pos[3];
      const liquidity = pos[6];

      console.log(`Position ${i}:`);
      console.log(`   Token ID: ${tokenId}`);
      console.log(`   Pool: ${pool}`);
      console.log(`   Liquidity: ${liquidity}\n`);

      totalLiquidity += liquidity;

      // Get token symbols
      const token0Contract = await ethers.getContractAt(
        ["function symbol() external view returns (string)", "function decimals() external view returns (uint8)", "function balanceOf(address) external view returns (uint256)"],
        token0
      );
      const token1Contract = await ethers.getContractAt(
        ["function symbol() external view returns (string)", "function decimals() external view returns (uint8)", "function balanceOf(address) external view returns (uint256)"],
        token1
      );

      const symbol0 = await token0Contract.symbol();
      const symbol1 = await token1Contract.symbol();
      const decimals0 = await token0Contract.decimals();
      const decimals1 = await token1Contract.decimals();

      // Get balances in the plugin
      const balance0 = await token0Contract.balanceOf(UNISWAP_V3_PLUGIN);
      const balance1 = await token1Contract.balanceOf(UNISWAP_V3_PLUGIN);

      console.log(`   Token0: ${symbol0} (${decimals0} decimals)`);
      console.log(`   Balance: ${ethers.formatUnits(balance0, decimals0)} ${symbol0}`);
      
      console.log(`   Token1: ${symbol1} (${decimals1} decimals)`);
      console.log(`   Balance: ${ethers.formatUnits(balance1, decimals1)} ${symbol1}\n`);

      // Get prices from TokenManager
      const tokenManager = await ethers.getContractAt(
        ["function getTokenPrice(string) external view returns (uint256, uint256, bool)"],
        TOKEN_MANAGER
      );

      try {
        const price0 = await tokenManager.getTokenPrice(symbol0);
        console.log(`   ${symbol0} Price: ${ethers.formatEther(price0[0])} ETH`);
        console.log(`   ${symbol0} Valid: ${price0[2] ? '❌ STALE' : '✅ FRESH'}`);
        const value0 = (balance0 * price0[0]) / (10n ** BigInt(decimals0));
        console.log(`   ${symbol0} Value: ${ethers.formatEther(value0)} ETH\n`);
      } catch (e: any) {
        console.log(`   ❌ ${symbol0} price not available: ${e.message}\n`);
      }

      try {
        const price1 = await tokenManager.getTokenPrice(symbol1);
        console.log(`   ${symbol1} Price: ${ethers.formatEther(price1[0])} ETH`);
        console.log(`   ${symbol1} Valid: ${price1[2] ? '❌ STALE' : '✅ FRESH'}`);
        const value1 = (balance1 * price1[0]) / (10n ** BigInt(decimals1));
        console.log(`   ${symbol1} Value: ${ethers.formatEther(value1)} ETH\n`);
      } catch (e: any) {
        console.log(`   ❌ ${symbol1} price not available: ${e.message}\n`);
      }

      console.log("-".repeat(100) + "\n");
    }

    console.log(`📊 Total Liquidity: ${totalLiquidity}`);
    
    // Calculate LP price
    if (totalLiquidity > 0n) {
      const lpPrice = (totalValue * ethers.parseEther("1")) / totalLiquidity;
      console.log(`\n💎 LP Token Price: ${ethers.formatEther(lpPrice)} ETH per LP\n`);
    }

    console.log("=".repeat(100));
    expect(totalValue).to.be.gt(0);
  });

  it("Should perform complete withdrawal with automatic swaps", async function () {
    console.log("\n" + "=".repeat(100));
    console.log("🔄 WITHDRAWAL WITH AUTOMATIC SWAPS");
    console.log("=".repeat(100) + "\n");

    const [signer] = await ethers.getSigners();
    console.log(`Withdrawer: ${signer.address}\n`);

    // Get user's LP balance (liquidity in the position)
    const uniPlugin = await ethers.getContractAt(
      [
        "function positionCount() external view returns (uint256)",
        "function positions(uint256) external view returns (tuple(uint256,address,address,address,int24,int24,uint128,uint256,uint256,uint128,uint128))",
        "function withdraw(uint256,uint128,uint256,uint256,string,bytes) external"
      ],
      UNISWAP_V3_PLUGIN
    );

    const posCount = await uniPlugin.positionCount();
    
    if (posCount === 0n) {
      console.log("❌ No positions to withdraw from!");
      return;
    }

    // Get first position
    const pos = await uniPlugin.positions(0);
    const tokenId = pos[0];
    const pool = pos[1];
    const liquidity = pos[6];

    console.log(`Position to withdraw:`);
    console.log(`   Token ID: ${tokenId}`);
    console.log(`   Pool: ${pool}`);
    console.log(`   Liquidity: ${liquidity}\n`);

    // Get pool tokens
    const poolContract = await ethers.getContractAt(
      ["function token0() external view returns (address)", "function token1() external view returns (address)"],
      pool
    );

    const token0 = await poolContract.token0();
    const token1 = await poolContract.token1();

    const token0Contract = await ethers.getContractAt(
      ["function symbol() external view returns (string)", "function balanceOf(address) external view returns (uint256)"],
      token0
    );
    const token1Contract = await ethers.getContractAt(
      ["function symbol() external view returns (string)", "function balanceOf(address) external view returns (uint256)"],
      token1
    );

    const symbol0 = await token0Contract.symbol();
    const symbol1 = await token1Contract.symbol();

    console.log(`   Token0: ${symbol0} (${token0})`);
    console.log(`   Token1: ${symbol1} (${token1})\n`);

    // Get WETH balance before
    const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const wethContract = await ethers.getContractAt(
      ["function balanceOf(address) external view returns (uint256)"],
      WETH
    );

    const wethBefore = await wethContract.balanceOf(signer.address);
    console.log(`💰 WETH Balance Before: ${ethers.formatEther(wethBefore)} WETH\n`);

    // Withdraw 100% of liquidity with swap to WETH
    console.log(`🔄 Withdrawing 100% liquidity (${liquidity}) with swap to WETH...\n`);

    const swapParams = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint24"],
      [WETH, 3000] // Target token = WETH, fee = 0.3%
    );

    try {
      const tx = await uniPlugin.withdraw(
        tokenId,
        liquidity,      // 100% of liquidity
        0,              // min amount0
        0,              // min amount1
        "UniswapV3",    // swap plugin
        swapParams      // swap to WETH
      );

      console.log(`📝 Transaction hash: ${tx.hash}`);
      console.log(`⏳ Waiting for confirmation...\n`);

      const receipt = await tx.wait();
      console.log(`✅ Transaction confirmed in block ${receipt?.blockNumber}\n`);

      // Get WETH balance after
      const wethAfter = await wethContract.balanceOf(signer.address);
      const wethReceived = wethAfter - wethBefore;

      console.log(`💰 WETH Balance After: ${ethers.formatEther(wethAfter)} WETH`);
      console.log(`💵 WETH Received: ${ethers.formatEther(wethReceived)} WETH\n`);

      // Check if position was removed
      const posCountAfter = await uniPlugin.positionCount();
      console.log(`📍 Positions after withdrawal: ${posCountAfter}`);

      if (posCountAfter < posCount) {
        console.log(`✅ Position removed successfully!\n`);
      }

      console.log("=".repeat(100));

      expect(wethReceived).to.be.gt(0, "Should receive WETH from withdrawal");

    } catch (error: any) {
      console.log(`\n❌ Withdrawal failed: ${error.message}`);
      
      if (error.data) {
        console.log(`Error data: ${error.data}`);
      }

      // Try to get revert reason
      try {
        const reason = error.reason || error.message;
        console.log(`Revert reason: ${reason}`);
      } catch (e) {
        console.log(`Could not decode revert reason`);
      }

      throw error;
    }
  });
});
