/**
 * 🔬 DETAILED WITHDRAWAL ANALYSIS SCRIPT
 * 
 * Questo script esegue un'analisi completa prima e durante il withdrawal:
 * 1. Query pool balances per tutti i token (WETH, USDC, WBTC)
 * 2. Query prezzi Chainlink per ogni token
 * 3. Simula il withdrawal per predire swap necessari
 * 4. Esegue il withdrawal reale con monitoring dettagliato
 * 5. Analizza se gli swap sono riusciti o falliti
 */

import { ethers } from "hardhat";
import { Logger } from "../config/config";

// Indirizzi dei contratti (da mainnet-latest.json)
const CONTRACTS = {
  beacon: "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870",
  proxyGeneral: "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1",
  tokenManager: "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517",
  valueCalculator: "0xE06882B8a0Bb46dE28a4aa4694d41822C255457B",
  liquidityManager: "0x545b79254F74Ba33958290BB73F2a338509c975d",
  swapManager: "0x01269d496E957A54e02cdcd5888957baf317A947",
  chainlinkAdapter: "0x16a5201814Ba08E8a7c8C1f59f83E0409206761c"
};

// Token addresses su Arbitrum Mainnet
const TOKEN_ADDRESSES = {
  WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f"
};

interface TokenBalance {
  tokenCode: string;
  address: string;
  balance: bigint;
  balanceFormatted: string;
  decimals: number;
}

interface TokenPrice {
  tokenCode: string;
  price: bigint;
  priceFormatted: string;
  priceDecimals: number;
  timestamp: bigint;
  isStale: boolean;
}

interface PoolAnalysis {
  totalValue: bigint;
  totalValueETH: string;
  wethBalance: bigint;
  wethBalanceETH: string;
  otherTokensValue: bigint;
  otherTokensValueETH: string;
  tokenBreakdown: Array<{
    tokenCode: string;
    value: bigint;
    valueETH: string;
    balance: bigint;
    balanceFormatted: string;
    percentage: number;
  }>;
}

interface WithdrawPrediction {
  userLPTokens: bigint;
  userLPFormatted: string;
  totalSupply: bigint;
  userSharePercentage: number;
  ethToReceive: bigint;
  ethToReceiveFormatted: string;
  wethAvailable: bigint;
  wethNeeded: bigint;
  requiresSwap: boolean;
  swapPlan?: {
    tokenToSwap: string;
    amountToSwap: bigint;
    amountToSwapFormatted: string;
    expectedWETH: bigint;
    expectedWETHFormatted: string;
  };
}

async function main() {
  Logger.section("🔬 DETAILED WITHDRAWAL ANALYSIS");
  
  // Ottieni signer
  const [deployer] = await ethers.getSigners();
  Logger.info(`Using account: ${deployer.address}`);
  
  const ethBalance = await deployer.provider.getBalance(deployer.address);
  Logger.info(`ETH Balance: ${ethers.formatEther(ethBalance)} ETH\n`);

  // ==================== STEP 1: QUERY POOL BALANCES ====================
  Logger.section("📊 STEP 1: Query Pool Balances");
  
  const proxyGeneral = await ethers.getContractAt("ProxyGeneral", CONTRACTS.proxyGeneral);
  const tokenManager = await ethers.getContractAt("TokenManager", CONTRACTS.tokenManager);
  
  const balances: TokenBalance[] = [];
  
  // Query WETH balance
  const wethContract = await ethers.getContractAt("IWETH", TOKEN_ADDRESSES.WETH);
  const wethBalance = await wethContract.balanceOf(CONTRACTS.proxyGeneral);
  balances.push({
    tokenCode: "WETH",
    address: TOKEN_ADDRESSES.WETH,
    balance: wethBalance,
    balanceFormatted: ethers.formatEther(wethBalance),
    decimals: 18
  });
  Logger.info(`✅ WETH: ${ethers.formatEther(wethBalance)} WETH`);
  Logger.info(`   Address: ${TOKEN_ADDRESSES.WETH}`);
  
  // Query active tokens from TokenManager
  let activeTokens: string[] = [];
  try {
    activeTokens = await tokenManager.getActiveTokens();
    Logger.info(`\n🔍 Active tokens in TokenManager: ${activeTokens.length}`);
  } catch (error: any) {
    Logger.warn(`Could not query active tokens: ${error.message}`);
  }
  
  // Query each active token balance
  for (const tokenCode of activeTokens) {
    try {
      const tokenInfo = await tokenManager.getTokenInfo(tokenCode);
      const tokenContract = await ethers.getContractAt("IERC20", tokenInfo.tokenAddress);
      const tokenBalance = await tokenContract.balanceOf(CONTRACTS.proxyGeneral);
      
      const decimals = Number(tokenInfo.tokenDecimals);
      const balanceFormatted = ethers.formatUnits(tokenBalance, decimals);
      
      balances.push({
        tokenCode,
        address: tokenInfo.tokenAddress,
        balance: tokenBalance,
        balanceFormatted,
        decimals
      });
      
      Logger.info(`✅ ${tokenCode}: ${balanceFormatted} ${tokenCode}`);
      Logger.info(`   Address: ${tokenInfo.tokenAddress}`);
      
    } catch (error: any) {
      Logger.warn(`Could not query ${tokenCode} balance: ${error.message}`);
    }
  }

  // ==================== STEP 2: QUERY CHAINLINK PRICES ====================
  Logger.section("💰 STEP 2: Query Chainlink Prices");
  
  const prices: TokenPrice[] = [];
  
  // WETH price is always 1 ETH = 1 ETH
  prices.push({
    tokenCode: "WETH",
    price: ethers.parseEther("1"),
    priceFormatted: "1.0",
    priceDecimals: 18,
    timestamp: BigInt(Math.floor(Date.now() / 1000)),
    isStale: false
  });
  Logger.info(`✅ WETH: 1.0 ETH (native)`);
  
  // Query prices for active tokens
  for (const tokenCode of activeTokens) {
    try {
      const [price, timestamp, isStale] = await tokenManager.getTokenPrice(tokenCode);
      const priceDecimals = await tokenManager.getPriceDecimals(tokenCode);
      
      const priceFormatted = ethers.formatUnits(price, Number(priceDecimals));
      
      prices.push({
        tokenCode,
        price,
        priceFormatted,
        priceDecimals: Number(priceDecimals),
        timestamp,
        isStale
      });
      
      Logger.info(`✅ ${tokenCode}: ${priceFormatted} ETH`);
      Logger.info(`   Timestamp: ${new Date(Number(timestamp) * 1000).toLocaleString()}`);
      Logger.info(`   Stale: ${isStale ? "⚠️ YES" : "✅ NO"}`);
      
    } catch (error: any) {
      Logger.warn(`Could not query ${tokenCode} price: ${error.message}`);
    }
  }

  // ==================== STEP 3: ANALYZE POOL COMPOSITION ====================
  Logger.section("🧮 STEP 3: Analyze Pool Composition");
  
  const valueCalculator = await ethers.getContractAt("ValueCalculator", CONTRACTS.valueCalculator);
  
  let poolAnalysis: PoolAnalysis | null = null;
  
  try {
    const poolInfo = await valueCalculator.getTotalPoolValue();
    
    poolAnalysis = {
      totalValue: poolInfo.totalValue,
      totalValueETH: ethers.formatEther(poolInfo.totalValue),
      wethBalance: wethBalance,
      wethBalanceETH: ethers.formatEther(wethBalance),
      otherTokensValue: poolInfo.totalValue - wethBalance,
      otherTokensValueETH: ethers.formatEther(poolInfo.totalValue - wethBalance),
      tokenBreakdown: []
    };
    
    Logger.info(`💎 Total Pool Value: ${poolAnalysis.totalValueETH} ETH`);
    Logger.info(`💧 WETH Balance: ${poolAnalysis.wethBalanceETH} ETH (${poolInfo.totalValue > 0n ? Number(wethBalance * 10000n / poolInfo.totalValue) / 100 : 0}%)`);
    Logger.info(`🪙 Other Tokens Value: ${poolAnalysis.otherTokensValueETH} ETH (${poolInfo.totalValue > 0n ? Number((poolInfo.totalValue - wethBalance) * 10000n / poolInfo.totalValue) / 100 : 0}%)`);
    
    Logger.info(`\n📊 Token Breakdown:`);
    for (const tokenValue of poolInfo.tokenValues) {
      const balance = balances.find(b => b.tokenCode === tokenValue.tokenCode);
      
      poolAnalysis.tokenBreakdown.push({
        tokenCode: tokenValue.tokenCode,
        value: tokenValue.value,
        valueETH: ethers.formatEther(tokenValue.value),
        balance: tokenValue.balance,
        balanceFormatted: balance ? balance.balanceFormatted : "0",
        percentage: Number(tokenValue.percentage) / 100
      });
      
      Logger.info(`   🪙 ${tokenValue.tokenCode}:`);
      Logger.info(`      Balance: ${balance ? balance.balanceFormatted : "0"} ${tokenValue.tokenCode}`);
      Logger.info(`      Value: ${ethers.formatEther(tokenValue.value)} ETH`);
      Logger.info(`      Percentage: ${Number(tokenValue.percentage) / 100}%`);
    }
    
  } catch (error: any) {
    Logger.error(`Could not analyze pool composition: ${error.message}`);
  }

  // ==================== STEP 4: PREDICT WITHDRAWAL SCENARIO ====================
  Logger.section("🔮 STEP 4: Predict Withdrawal Scenario");
  
  const userLPBalance = await proxyGeneral.balanceOf(deployer.address);
  const totalSupply = await proxyGeneral.totalSupply();
  
  if (userLPBalance === 0n) {
    Logger.error("❌ No LP tokens to withdraw!");
    return;
  }
  
  const prediction: WithdrawPrediction = {
    userLPTokens: userLPBalance,
    userLPFormatted: ethers.formatEther(userLPBalance),
    totalSupply,
    userSharePercentage: totalSupply > 0n ? Number(userLPBalance * 10000n / totalSupply) / 100 : 0,
    ethToReceive: poolAnalysis ? (userLPBalance * poolAnalysis.totalValue) / totalSupply : 0n,
    ethToReceiveFormatted: poolAnalysis ? ethers.formatEther((userLPBalance * poolAnalysis.totalValue) / totalSupply) : "0",
    wethAvailable: wethBalance,
    wethNeeded: 0n,
    requiresSwap: false
  };
  
  // Apply withdraw fee (0.1% = 10 basis points)
  const withdrawFee = 10n; // 0.1%
  const feeAmount = (prediction.ethToReceive * withdrawFee) / 10000n;
  const netWithdraw = prediction.ethToReceive - feeAmount;
  
  Logger.info(`👤 Your LP Tokens: ${prediction.userLPFormatted} LP`);
  Logger.info(`📊 Total LP Supply: ${ethers.formatEther(totalSupply)} LP`);
  Logger.info(`📈 Your Pool Share: ${prediction.userSharePercentage}%`);
  Logger.info(`💰 ETH to Receive (gross): ${prediction.ethToReceiveFormatted} ETH`);
  Logger.info(`💸 Withdraw Fee (0.1%): ${ethers.formatEther(feeAmount)} ETH`);
  Logger.info(`💵 ETH to Receive (net): ${ethers.formatEther(netWithdraw)} ETH`);
  
  // Check if swap is required
  prediction.wethNeeded = netWithdraw > wethBalance ? netWithdraw - wethBalance : 0n;
  prediction.requiresSwap = prediction.wethNeeded > 0n;
  
  Logger.info(`\n🔄 Swap Analysis:`);
  Logger.info(`   WETH Available: ${ethers.formatEther(wethBalance)} ETH`);
  Logger.info(`   WETH Needed: ${ethers.formatEther(netWithdraw)} ETH`);
  
  if (prediction.requiresSwap) {
    Logger.warn(`   ⚠️ SWAP REQUIRED: Need ${ethers.formatEther(prediction.wethNeeded)} more WETH`);
    
    // Try to predict which token will be swapped
    try {
      const [tokenToSwap, amountToSwap] = await valueCalculator.selectTokenForSwap(prediction.wethNeeded);
      
      // Find token info for formatting
      const tokenInfo = balances.find(b => b.tokenCode === tokenToSwap);
      const tokenPrice = prices.find(p => p.tokenCode === tokenToSwap);
      
      const amountFormatted = tokenInfo 
        ? ethers.formatUnits(amountToSwap, tokenInfo.decimals)
        : ethers.formatEther(amountToSwap);
      
      const expectedWETH = tokenPrice && tokenInfo
        ? (amountToSwap * tokenPrice.price) / BigInt(10 ** tokenInfo.decimals)
        : 0n;
      
      prediction.swapPlan = {
        tokenToSwap,
        amountToSwap,
        amountToSwapFormatted: amountFormatted,
        expectedWETH,
        expectedWETHFormatted: ethers.formatEther(expectedWETH)
      };
      
      Logger.info(`\n   📋 Swap Plan:`);
      Logger.info(`      Token to Swap: ${tokenToSwap}`);
      Logger.info(`      Amount: ${amountFormatted} ${tokenToSwap}`);
      Logger.info(`      Expected WETH (Chainlink): ${ethers.formatEther(expectedWETH)} ETH`);
      Logger.info(`      Buffer included: +10%`);
      
      // Calculate potential slippage risk
      const bufferPercentage = 10;
      const slippageTolerance = ((Number(amountToSwap) * bufferPercentage) / 100);
      Logger.warn(`      ⚠️ Slippage Risk: If DEX price differs from Chainlink by >${bufferPercentage}%, swap may fail`);
      
    } catch (error: any) {
      Logger.error(`   ❌ Could not determine swap plan: ${error.message}`);
    }
    
  } else {
    Logger.success(`   ✅ NO SWAP REQUIRED: Pool has sufficient WETH`);
  }

  // ==================== STEP 5: ASK FOR CONFIRMATION ====================
  Logger.section("⚠️ STEP 5: Withdrawal Confirmation");
  
  Logger.info(`\n📋 Summary:`);
  Logger.info(`   Withdrawing: ${prediction.userLPFormatted} LP (${prediction.userSharePercentage}%)`);
  Logger.info(`   Receiving: ${ethers.formatEther(netWithdraw)} ETH (net)`);
  Logger.info(`   Swap Required: ${prediction.requiresSwap ? "⚠️ YES" : "✅ NO"}`);
  
  if (prediction.requiresSwap && prediction.swapPlan) {
    Logger.info(`   Swap: ${prediction.swapPlan.amountToSwapFormatted} ${prediction.swapPlan.tokenToSwap} → ${prediction.swapPlan.expectedWETHFormatted} ETH`);
  }
  
  Logger.info(`\n⏳ Proceeding with withdrawal in 5 seconds...`);
  Logger.info(`   (Press Ctrl+C to cancel)\n`);
  
  await new Promise(resolve => setTimeout(resolve, 5000));

  // ==================== STEP 6: EXECUTE WITHDRAWAL ====================
  Logger.section("🚀 STEP 6: Execute Withdrawal");
  
  const liquidityManager = await ethers.getContractAt("LiquidityManager", CONTRACTS.liquidityManager);
  
  const ethBalanceBefore = await deployer.provider.getBalance(deployer.address);
  Logger.info(`ETH Balance Before: ${ethers.formatEther(ethBalanceBefore)} ETH`);
  
  try {
    // Use withdrawWithDeadline for better MEV protection
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes
    
    Logger.info(`\n📤 Submitting withdrawal transaction...`);
    Logger.info(`   LP Tokens: ${prediction.userLPFormatted} LP`);
    Logger.info(`   Deadline: ${new Date(Number(deadline) * 1000).toLocaleString()}`);
    
    const tx = await liquidityManager.withdrawWithDeadline(userLPBalance, deadline, {
      gasLimit: 3000000 // High gas limit for potential swaps
    });
    
    Logger.info(`\n✅ Transaction submitted: ${tx.hash}`);
    Logger.info(`   Waiting for confirmation...`);
    
    const receipt = await tx.wait();
    
    if (!receipt) {
      Logger.error("❌ Transaction receipt not available");
      return;
    }
    
    Logger.success(`\n✅ Transaction confirmed in block: ${receipt.blockNumber}`);
    Logger.info(`   Gas Used: ${receipt.gasUsed.toString()}`);
    Logger.info(`   Gas Price: ${ethers.formatUnits(receipt.gasPrice || 0n, "gwei")} gwei`);
    Logger.info(`   Total Gas Cost: ${ethers.formatEther((receipt.gasUsed * (receipt.gasPrice || 0n)))} ETH`);
    
    // ==================== STEP 7: ANALYZE TRANSACTION EVENTS ====================
    Logger.section("📜 STEP 7: Analyze Transaction Events");
    
    let swapDetected = false;
    let swapSuccess = false;
    let swapDetails: any = null;
    
    for (const log of receipt.logs) {
      try {
        // Try to parse as LiquidityManager event
        const parsedLog = liquidityManager.interface.parseLog({
          topics: log.topics as string[],
          data: log.data
        });
        
        if (parsedLog) {
          if (parsedLog.name === "TokenSwappedForWithdraw") {
            swapDetected = true;
            swapSuccess = true;
            swapDetails = parsedLog.args;
            
            Logger.success(`\n   🔄 SWAP DETECTED: ${parsedLog.name}`);
            Logger.info(`      Token Swapped: ${swapDetails.tokenCode}`);
            Logger.info(`      Amount: ${ethers.formatEther(swapDetails.amount)} ${swapDetails.tokenCode}`);
            Logger.info(`      WETH Received: ${ethers.formatEther(swapDetails.wethReceived)} ETH`);
            
            // Compare with prediction
            if (prediction.swapPlan) {
              const actualVsPredicted = Number(swapDetails.wethReceived) / Number(prediction.swapPlan.expectedWETH);
              const slippage = ((1 - actualVsPredicted) * 100).toFixed(2);
              
              Logger.info(`      Predicted: ${prediction.swapPlan.expectedWETHFormatted} ETH`);
              Logger.info(`      Actual: ${ethers.formatEther(swapDetails.wethReceived)} ETH`);
              
              if (actualVsPredicted < 1) {
                Logger.warn(`      Slippage: ${slippage}% (received less than Chainlink price)`);
              } else {
                Logger.success(`      Better than expected: +${(actualVsPredicted - 1) * 100}%`);
              }
            }
          } else if (parsedLog.name === "Withdrawn") {
            Logger.success(`\n   ✅ WITHDRAWAL EVENT: ${parsedLog.name}`);
            Logger.info(`      User: ${parsedLog.args.user}`);
            Logger.info(`      Shares: ${ethers.formatEther(parsedLog.args.shares)} LP`);
            Logger.info(`      ETH Amount: ${ethers.formatEther(parsedLog.args.ethAmount)} ETH`);
          }
        }
      } catch (e) {
        // Not a LiquidityManager event, skip
      }
    }
    
    if (prediction.requiresSwap && !swapDetected) {
      Logger.warn(`\n   ⚠️ SWAP WAS EXPECTED BUT NOT DETECTED IN EVENTS`);
      Logger.info(`      This might indicate the swap failed internally`);
    }
    
  } catch (error: any) {
    Logger.error(`\n❌ Withdrawal failed: ${error.message}`);
    
    // Try to parse revert reason
    if (error.message.includes("Swap didn't provide enough WETH")) {
      Logger.error(`\n   💥 SWAP FAILURE DETECTED:`);
      Logger.error(`      The swap was executed but didn't provide enough WETH`);
      Logger.error(`      Likely causes:`);
      Logger.error(`        - DEX price differs significantly from Chainlink`);
      Logger.error(`        - Insufficient liquidity in DEX pool`);
      Logger.error(`        - Slippage exceeded 10% buffer`);
      
      if (prediction.swapPlan) {
        Logger.info(`\n   📊 Expected swap:`);
        Logger.info(`      ${prediction.swapPlan.amountToSwapFormatted} ${prediction.swapPlan.tokenToSwap} → ${prediction.swapPlan.expectedWETHFormatted} ETH`);
      }
    }
    
    return;
  }

  // ==================== STEP 8: POST-WITHDRAWAL ANALYSIS ====================
  Logger.section("📊 STEP 8: Post-Withdrawal Analysis");
  
  const ethBalanceAfter = await deployer.provider.getBalance(deployer.address);
  const ethChange = ethBalanceAfter - ethBalanceBefore;
  
  Logger.info(`ETH Balance After: ${ethers.formatEther(ethBalanceAfter)} ETH`);
  Logger.info(`Net ETH Change: ${ethers.formatEther(ethChange)} ETH`);
  
  const newLPBalance = await proxyGeneral.balanceOf(deployer.address);
  Logger.info(`LP Balance After: ${ethers.formatEther(newLPBalance)} LP`);
  Logger.info(`LP Tokens Burned: ${ethers.formatEther(userLPBalance - newLPBalance)} LP`);
  
  // Query new pool state
  try {
    const newPoolInfo = await valueCalculator.getTotalPoolValue();
    Logger.info(`\nNew Pool Value: ${ethers.formatEther(newPoolInfo.totalValue)} ETH`);
    
    const newWethBalance = await wethContract.balanceOf(CONTRACTS.proxyGeneral);
    Logger.info(`New WETH Balance: ${ethers.formatEther(newWethBalance)} ETH`);
    
  } catch (error: any) {
    Logger.info(`Pool is now empty (expected if 100% withdrawal)`);
  }

  Logger.section("✅ WITHDRAWAL ANALYSIS COMPLETED");
  
  Logger.info(`\n📝 Summary:`);
  Logger.info(`   ✅ Withdrawal executed successfully`);
  Logger.info(`   💰 Net ETH received: ${ethers.formatEther(ethChange)} ETH`);
  
  if (swapDetected) {
    Logger.info(`   🔄 Automatic swap executed: ${swapSuccess ? "✅ SUCCESS" : "❌ FAILED"}`);
    
    if (swapDetails) {
      Logger.info(`      ${ethers.formatEther(swapDetails.amount)} ${swapDetails.tokenCode} → ${ethers.formatEther(swapDetails.wethReceived)} ETH`);
    }
  } else if (prediction.requiresSwap) {
    Logger.warn(`   ⚠️ Swap was predicted but not detected`);
  } else {
    Logger.info(`   ℹ️ No swap required (sufficient WETH)`);
  }
}

// Esegui lo script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Script failed:", error);
    process.exit(1);
  });
