/**
 * Test SOLO repay - verifica dust fix
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../config/arbitrum.config";
import { formatAmount, verifyArbitrumMainnet } from "../utils/plugins/euler/euler-helpers";

const PLUGIN = "0x490139F3b29786D64056a236a0062CA23A7313f6";

async function main() {
    console.log("\n" + "=".repeat(70));
    console.log("🧪 TEST REPAY ONLY - DUST FIX VALIDATION");
    console.log("=".repeat(70));
    
    await verifyArbitrumMainnet();
    
    const protocolManager = await ethers.getContractAt("ProtocolManager", "0x5b8314319CB56864b002caFEB92540B7A7559fBB");
    
    const usdc = await ethers.getContractAt("IERC20", ARBITRUM_ADDRESSES.USDC);
    
    const usdcVault = await ethers.getContractAt(
        ["function debtOf(address) view returns (uint256)"],
        ARBITRUM_ADDRESSES.USDC_VAULT
    );
    
    const evc = await ethers.getContractAt(
        ["function isControllerEnabled(address, address) view returns (bool)"],
        ARBITRUM_ADDRESSES.EVC
    );
    
    // Check initial state
    let debt = await usdcVault.debtOf(PLUGIN);
    let controllerEnabled = await evc.isControllerEnabled(PLUGIN, ARBITRUM_ADDRESSES.USDC_VAULT);
    
    console.log(`\n📊 INITIAL STATE:`);
    console.log(`   Debt: ${formatAmount(debt, 6)} USDC (${debt} wei)`);
    console.log(`   Controller: ${controllerEnabled ? "✅ ENABLED" : "❌ DISABLED"}\n`);
    
    if (debt === 0n) {
        console.log(`✅ No debt - nothing to repay!\n`);
        return;
    }
    
    // Check ProxyGeneral USDC balance
    const proxyGeneral = await ethers.getContractAt("ProxyGeneral", ARBITRUM_ADDRESSES.PROXY_GENERAL);
    const proxyUsdcBalance = await usdc.balanceOf(ARBITRUM_ADDRESSES.PROXY_GENERAL);
    
    console.log(`💰 ProxyGeneral USDC: ${formatAmount(proxyUsdcBalance, 6)} USDC\n`);
    
    if (proxyUsdcBalance < debt) {
        console.log(`❌ Insufficient USDC in ProxyGeneral!`);
        console.log(`   Need: ${formatAmount(debt, 6)} USDC`);
        console.log(`   Have: ${formatAmount(proxyUsdcBalance, 6)} USDC\n`);
        return;
    }
    
    // REPAY - Try partial repay first to isolate the issue
    console.log("=".repeat(70));
    console.log("STEP 1: REPAY PARTIAL (50% OF DEBT)");
    console.log("=".repeat(70));
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const partialRepay = debt / BigInt(2);
    
    console.log(`🔄 Repaying ${formatAmount(partialRepay, 6)} USDC (50% of debt)...`);
    
    try {
        let tx = await protocolManager.repay("Euler", "USDC", partialRepay);
        await tx.wait();
        console.log(`✅ Partial repay succeeded!\n`);
        
        // Check remaining debt
        debt = await usdcVault.debtOf(PLUGIN);
        console.log(`   Remaining Debt: ${formatAmount(debt, 6)} USDC (${debt} wei)\n`);
        
        // Now try to repay the rest
        console.log("=".repeat(70));
        console.log("STEP 2: REPAY REMAINING DEBT");
        console.log("=".repeat(70));
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Try with slightly less than full debt to avoid edge cases
        const almostAll = debt - BigInt(10); // Leave 10 wei
        
        console.log(`🔄 Repaying ${formatAmount(almostAll, 6)} USDC (debt - 10 wei)...`);
        
        tx = await protocolManager.repay("Euler", "USDC", almostAll);
        await tx.wait();
        console.log(`✅ Repaid almost all!\n`);
        
        // Check what's left
        debt = await usdcVault.debtOf(PLUGIN);
        console.log(`   Remaining Debt: ${formatAmount(debt, 6)} USDC (${debt} wei)\n`);
        
        if (debt > 0n && debt < BigInt(100)) {
            console.log("=".repeat(70));
            console.log("STEP 3: REPAY FINAL DUST");
            console.log("=".repeat(70));
            
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            console.log(`🔄 Repaying final ${debt} wei...`);
            
            tx = await protocolManager.repay("Euler", "USDC", debt);
            await tx.wait();
            console.log(`✅ Final dust repaid!\n`);
        }
        
    } catch (e: any) {
        console.log(`❌ Repay failed: ${e.message}\n`);
        console.log(`   Error suggests plugin code is reverting.\n`);
        return;
    }
    
    // Wait for dust to settle
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check debt after first repay
    debt = await usdcVault.debtOf(PLUGIN);
    controllerEnabled = await evc.isControllerEnabled(PLUGIN, ARBITRUM_ADDRESSES.USDC_VAULT);
    
    console.log(`📊 AFTER FIRST REPAY:`);
    console.log(`   Remaining Debt (RAW): ${debt} wei`);
    console.log(`   Remaining Debt: ${formatAmount(debt, 6)} USDC`);
    console.log(`   Controller: ${controllerEnabled ? "⚠️ STILL ENABLED" : "✅ AUTO-DISABLED"}\n`);
    
    // DUST FIX TEST - if dust remains, repay again
    if (debt > 0n && debt < BigInt(1000)) {
        console.log("=".repeat(70));
        console.log("STEP 2: DUST DETECTED - SECOND REPAY");
        console.log("=".repeat(70));
        
        console.log(`⚠️ Dust: ${debt} wei (< 1000 threshold)`);
        console.log(`🔄 Repaying dust...`);
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        tx = await protocolManager.repay("Euler", "USDC", debt);
        await tx.wait();
        console.log(`✅ Dust repaid\n`);
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Final check
        debt = await usdcVault.debtOf(PLUGIN);
        controllerEnabled = await evc.isControllerEnabled(PLUGIN, ARBITRUM_ADDRESSES.USDC_VAULT);
        
        console.log(`📊 AFTER DUST REPAY:`);
        console.log(`   Remaining Debt (RAW): ${debt} wei`);
        console.log(`   Remaining Debt: ${formatAmount(debt, 6)} USDC`);
        console.log(`   Controller: ${controllerEnabled ? "⚠️ STILL ENABLED" : "✅ AUTO-DISABLED"}\n`);
    }
    
    // FINAL RESULT
    console.log("=".repeat(70));
    console.log("FINAL RESULT");
    console.log("=".repeat(70));
    
    if (debt === 0n) {
        console.log(`✅ SUCCESS - NO DUST REMAINING!`);
        console.log(`✅ Debt: 0 wei`);
        console.log(`✅ Controller: ${controllerEnabled ? "❌ ERROR - Still enabled!" : "✅ Auto-disabled"}\n`);
    } else if (debt < BigInt(10)) {
        console.log(`⚠️ MINIMAL DUST - ${debt} wei (< 10 wei)`);
        console.log(`   This is acceptable precision loss\n`);
    } else {
        console.log(`❌ DUST PROBLEM - ${debt} wei remaining`);
        console.log(`   Expected: 0 wei`);
        console.log(`   Actual: ${debt} wei\n`);
    }
}

main().catch(console.error);
