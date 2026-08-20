/**
 * Test COMPLETO con nuovo plugin (no auto-disable)
 * 1. Deposit WETH
 * 2. Borrow USDC
 * 3. Repay 102% (dovrebbe funzionare ora!)
 * 4. Withdraw WETH
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../config/arbitrum.config";
import { formatAmount, verifyArbitrumMainnet } from "../utils/plugins/euler/euler-helpers";

const PLUGIN = "0x46B5f0D51311c09e9d93be7d16fA75BECC654D5b"; // NEW - No auto-disable

async function main() {
    console.log("\n" + "=".repeat(70));
    console.log("🧪 FULL CYCLE - NEW PLUGIN (NO AUTO-DISABLE)");
    console.log("=".repeat(70));
    
    await verifyArbitrumMainnet();
    
    const protocolManager = await ethers.getContractAt("ProtocolManager", "0x5b8314319CB56864b002caFEB92540B7A7559fBB");
    const proxyGeneral = await ethers.getContractAt("ProxyGeneral", ARBITRUM_ADDRESSES.PROXY_GENERAL);
    
    const weth = await ethers.getContractAt("IERC20", ARBITRUM_ADDRESSES.WETH);
    const usdc = await ethers.getContractAt("IERC20", ARBITRUM_ADDRESSES.USDC);
    
    const wethVault = await ethers.getContractAt(
        ["function maxWithdraw(address) view returns (uint256)"],
        ARBITRUM_ADDRESSES.WETH_VAULT
    );
    
    const usdcVault = await ethers.getContractAt(
        ["function debtOf(address) view returns (uint256)"],
        ARBITRUM_ADDRESSES.USDC_VAULT
    );
    
    const evc = await ethers.getContractAt(
        ["function isCollateralEnabled(address, address) view returns (bool)", "function isControllerEnabled(address, address) view returns (bool)"],
        ARBITRUM_ADDRESSES.EVC
    );
    
    console.log(`\n📍 Plugin: ${PLUGIN}\n`);
    
    // STEP 1: DEPOSIT
    console.log("=".repeat(70));
    console.log("STEP 1: DEPOSIT 0.00001 WETH");
    console.log("=".repeat(70));
    
    const depositAmount = ethers.parseEther("0.00001");
    
    // Send WETH to ProxyGeneral
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    let tx = await weth.transfer(ARBITRUM_ADDRESSES.PROXY_GENERAL, depositAmount);
    await tx.wait();
    console.log(`✅ Sent WETH to ProxyGeneral\n`);
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    tx = await protocolManager.deposit("Euler", "WETH", depositAmount);
    await tx.wait();
    console.log(`✅ Deposited ${formatAmount(depositAmount)} WETH\n`);
    
    let collateralEnabled = await evc.isCollateralEnabled(PLUGIN, ARBITRUM_ADDRESSES.WETH_VAULT);
    console.log(`   Collateral: ${collateralEnabled ? "✅ ENABLED" : "❌ DISABLED"}\n`);
    
    // STEP 2: BORROW
    console.log("=".repeat(70));
    console.log("STEP 2: BORROW 0.01 USDC");
    console.log("=".repeat(70));
    
    const borrowAmount = ethers.parseUnits("0.01", 6);
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    tx = await protocolManager.borrow("Euler", "USDC", borrowAmount);
    await tx.wait();
    console.log(`✅ Borrowed ${formatAmount(borrowAmount, 6)} USDC\n`);
    
    let debt = await usdcVault.debtOf(PLUGIN);
    let controllerEnabled = await evc.isControllerEnabled(PLUGIN, ARBITRUM_ADDRESSES.USDC_VAULT);
    console.log(`   Debt: ${formatAmount(debt, 6)} USDC`);
    console.log(`   Controller: ${controllerEnabled ? "✅ ENABLED" : "❌ DISABLED"}\n`);
    
    // STEP 3: REPAY 102% (THE CRITICAL TEST!)
    console.log("=".repeat(70));
    console.log("STEP 3: REPAY 102% (NO AUTO-DISABLE TEST)");
    console.log("=".repeat(70));
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const repayAmount = (debt * BigInt(102)) / BigInt(100);
    
    console.log(`🔄 Repaying ${formatAmount(repayAmount, 6)} USDC (102% of debt)...`);
    console.log(`   Debt: ${formatAmount(debt, 6)} USDC`);
    console.log(`   Repay: ${formatAmount(repayAmount, 6)} USDC\n`);
    
    try {
        tx = await protocolManager.repay("Euler", "USDC", repayAmount);
        await tx.wait();
        console.log(`✅ REPAY SUCCESS!\n`);
    } catch (e: any) {
        console.log(`❌ Repay failed: ${e.message}\n`);
        return;
    }
    
    // Check result
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    debt = await usdcVault.debtOf(PLUGIN);
    controllerEnabled = await evc.isControllerEnabled(PLUGIN, ARBITRUM_ADDRESSES.USDC_VAULT);
    
    console.log(`📊 AFTER REPAY:`);
    console.log(`   Remaining Debt: ${formatAmount(debt, 6)} USDC (${debt} wei)`);
    console.log(`   Controller: ${controllerEnabled ? "⚠️ STILL ENABLED (expected)" : "✅ DISABLED"}\n`);
    
    if (debt === 0n) {
        console.log(`✅ SUCCESS - NO DUST!`);
        console.log(`✅ Controller still enabled (no auto-disable)\n`);
    } else if (debt < BigInt(10)) {
        console.log(`⚠️ MINIMAL DUST - ${debt} wei (acceptable)\n`);
    } else {
        console.log(`❌ DUST PROBLEM - ${debt} wei\n`);
    }
    
    // STEP 4: WITHDRAW
    console.log("=".repeat(70));
    console.log("STEP 4: WITHDRAW ALL WETH");
    console.log("=".repeat(70));
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const maxWithdraw = await wethVault.maxWithdraw(PLUGIN);
    console.log(`   Max Withdraw: ${formatAmount(maxWithdraw)} WETH\n`);
    
    if (maxWithdraw > 0n) {
        tx = await protocolManager.withdraw("Euler", "WETH", maxWithdraw);
        await tx.wait();
        console.log(`✅ Withdrawn ${formatAmount(maxWithdraw)} WETH\n`);
        
        collateralEnabled = await evc.isCollateralEnabled(PLUGIN, ARBITRUM_ADDRESSES.WETH_VAULT);
        console.log(`   Collateral: ${collateralEnabled ? "⚠️ STILL ENABLED" : "✅ DISABLED"}\n`);
    } else {
        console.log(`❌ Cannot withdraw - maxWithdraw = 0\n`);
    }
    
    // FINAL RESULT
    console.log("=".repeat(70));
    console.log("FINAL RESULT");
    console.log("=".repeat(70));
    
    console.log(`✅ FULL CYCLE COMPLETED!`);
    console.log(`   - Deposit: ✅`);
    console.log(`   - Borrow: ✅`);
    console.log(`   - Repay 102%: ${debt === 0n ? '✅ NO DUST' : `⚠️ ${debt} wei dust`}`);
    console.log(`   - Withdraw: ${maxWithdraw > 0n ? '✅' : '❌'}\n`);
}

main().catch(console.error);
