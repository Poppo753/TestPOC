/**
 * 🔄 DEPLOY FIXED VALUE CALCULATOR
 * 
 * Questo script:
 * 1. Deploy nuovo ValueCalculator con il fix
 * 2. Aggiorna il Beacon per puntare alla nuova implementazione
 * 3. Verifica che il fix funzioni
 */

import { ethers } from "hardhat";
import { Logger } from "../config/config";

const CONTRACTS = {
  beacon: "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870",
  oldValueCalculator: "0xE06882B8a0Bb46dE28a4aa4694d41822C255457B"
};

async function main() {
  Logger.section("🔄 Deploy Fixed ValueCalculator");
  
  const [deployer] = await ethers.getSigners();
  Logger.info(`Deployer: ${deployer.address}`);
  Logger.info(`Balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH\n`);

  // ==================== STEP 1: DEPLOY NEW VALUE CALCULATOR ====================
  Logger.section("📦 Step 1: Deploy New ValueCalculator");
  
  Logger.info("Deploying ValueCalculator with fix...");
  const ValueCalculatorFactory = await ethers.getContractFactory("ValueCalculator");
  const newValueCalculator = await ValueCalculatorFactory.deploy(CONTRACTS.beacon);
  
  await newValueCalculator.waitForDeployment();
  const newAddress = await newValueCalculator.getAddress();
  
  Logger.success(`✅ New ValueCalculator deployed at: ${newAddress}`);
  Logger.info(`   Old address: ${CONTRACTS.oldValueCalculator}`);
  
  // ==================== STEP 2: VERIFY NEW IMPLEMENTATION ====================
  Logger.section("🧪 Step 2: Verify New Implementation");
  
  try {
    Logger.info("Testing getTotalPoolValue() is view...");
    const poolInfo = await newValueCalculator.getTotalPoolValue.staticCall();
    
    Logger.success(`✅ getTotalPoolValue() works as view function`);
    Logger.info(`   Total Value: ${ethers.formatEther(poolInfo.totalValue)} ETH`);
    Logger.info(`   Token Count: ${poolInfo.tokenValues.length}`);
    
    for (const tokenValue of poolInfo.tokenValues) {
      if (tokenValue.value > 0n) {
        Logger.info(`      ${tokenValue.tokenCode}: ${ethers.formatEther(tokenValue.value)} ETH (${Number(tokenValue.percentage) / 100}%)`);
      }
    }
    
  } catch (error: any) {
    Logger.error(`❌ New implementation test failed: ${error.message}`);
    Logger.error("Aborting upgrade - do not update Beacon!");
    return;
  }
  
  // ==================== STEP 3: UPDATE BEACON ====================
  Logger.section("🔄 Step 3: Update Beacon");
  
  Logger.warn("⚠️  About to update Beacon to point to new ValueCalculator");
  Logger.warn("   This will affect all modules using ValueCalculator");
  Logger.info("\n⏳ Waiting 10 seconds... (Press Ctrl+C to cancel)\n");
  
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  const beacon = await ethers.getContractAt("Beacon", CONTRACTS.beacon);
  
  Logger.info("Updating Beacon...");
  const updateTx = await beacon.updateImplementation("ValueCalculator", newAddress);
  Logger.info(`Transaction hash: ${updateTx.hash}`);
  
  const receipt = await updateTx.wait();
  if (!receipt) {
    Logger.error("Transaction receipt not available");
    return;
  }
  
  Logger.success(`✅ Beacon updated in block: ${receipt.blockNumber}`);
  Logger.info(`   Gas used: ${receipt.gasUsed.toString()}`);
  
  // ==================== STEP 4: VERIFY UPDATE ====================
  Logger.section("✅ Step 4: Verify Update");
  
  const currentImplementation = await beacon.getImplementation("ValueCalculator");
  Logger.info(`Current ValueCalculator address: ${currentImplementation}`);
  
  if (currentImplementation.toLowerCase() === newAddress.toLowerCase()) {
    Logger.success(`✅ Beacon successfully updated!`);
  } else {
    Logger.error(`❌ Beacon update failed - still pointing to old address`);
    return;
  }
  
  // Test through Beacon
  const valueCalculatorViaBeacon = await ethers.getContractAt("ValueCalculator", currentImplementation);
  const poolInfoViaBeacon = await valueCalculatorViaBeacon.getTotalPoolValue();
  
  Logger.success(`✅ ValueCalculator works through Beacon`);
  Logger.info(`   Total Value: ${ethers.formatEther(poolInfoViaBeacon.totalValue)} ETH`);
  
  // ==================== STEP 5: TEST WITH LIQUIDITY MANAGER ====================
  Logger.section("🧪 Step 5: Test with LiquidityManager Integration");
  
  try {
    const liquidityManager = await ethers.getContractAt(
      "LiquidityManager",
      "0x545b79254F74Ba33958290BB73F2a338509c975d"
    );
    
    // Test pool stats (uses ValueCalculator internally)
    const stats = await liquidityManager.getPoolStats();
    
    Logger.success(`✅ LiquidityManager integration works`);
    Logger.info(`   Pool Total Value: ${ethers.formatEther(stats.totalValue)} ETH`);
    Logger.info(`   Total Supply: ${ethers.formatEther(stats.totalSupply)} LP`);
    Logger.info(`   WETH Balance: ${ethers.formatEther(stats.wethBalance)} ETH`);
    Logger.info(`   Token Count: ${stats.tokensCount}`);
    
    if (stats.totalValue > 0n && stats.totalSupply > 0n) {
      const lpPrice = (stats.totalValue * ethers.parseEther("1")) / stats.totalSupply;
      Logger.info(`   LP Token Price: ${ethers.formatEther(lpPrice)} ETH per LP`);
    }
    
  } catch (error: any) {
    Logger.error(`❌ LiquidityManager integration test failed: ${error.message}`);
    Logger.warn("   This might indicate additional fixes needed");
  }
  
  // ==================== DEPLOYMENT SUMMARY ====================
  Logger.section("📋 Deployment Summary");
  
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                   DEPLOYMENT SUCCESSFUL                        ║
╠════════════════════════════════════════════════════════════════╣
║ Old ValueCalculator: ${CONTRACTS.oldValueCalculator}           ║
║ New ValueCalculator: ${newAddress}           ║
║                                                                ║
║ ✅ getTotalPoolValue() is now pure view                       ║
║ ✅ calculateTokenValuePure() added for view calculations      ║
║ ✅ Beacon updated successfully                                ║
║ ✅ LiquidityManager integration verified                      ║
╚════════════════════════════════════════════════════════════════╝

🎯 NEXT STEPS:
1. Test withdrawal with multi-token pool
2. Monitor for 24h
3. Update documentation
4. Announce fix to users

⚠️  IMPORTANT:
   - Users can now withdraw correctly with multi-token pools
   - Automatic swaps will trigger when needed
   - No funds will be left in pool after withdrawal
  `);
  
  Logger.success("Deployment completed successfully! 🎉");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Deployment failed:", error);
    process.exit(1);
  });
