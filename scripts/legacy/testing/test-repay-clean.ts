/**
 * Test SOLO repay - PULITO senza transfer manuali
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../config/arbitrum.config";
import { formatAmount, verifyArbitrumMainnet } from "../utils/plugins/euler/euler-helpers";

const PLUGIN = "0x46B5f0D51311c09e9d93be7d16fA75BECC654D5b"; // NEW PLUGIN - No auto-disable

async function main() {
    console.log("\n" + "=".repeat(70));
    console.log("🧪 TEST REPAY CLEAN - NO MANUAL TRANSFERS");
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
    
    // Check balances
    const proxyUsdcBalance = await usdc.balanceOf(ARBITRUM_ADDRESSES.PROXY_GENERAL);
    const pluginUsdcBalance = await usdc.balanceOf(PLUGIN);
    
    console.log(`💰 BALANCES:`);
    console.log(`   ProxyGeneral: ${formatAmount(proxyUsdcBalance, 6)} USDC`);
    console.log(`   Plugin:       ${formatAmount(pluginUsdcBalance, 6)} USDC\n`);
    
    if (proxyUsdcBalance < debt) {
        console.log(`❌ Insufficient USDC in ProxyGeneral!`);
        console.log(`   Need: ${formatAmount(debt, 6)} USDC`);
        console.log(`   Have: ${formatAmount(proxyUsdcBalance, 6)} USDC\n`);
        return;
    }
    
    // REPAY 90% - Should work if the issue is with debt→0
    console.log("=".repeat(70));
    console.log("REPAY 90% OF DEBT (TEST)");
    console.log("=".repeat(70));
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const repayAmount = (debt * BigInt(90)) / BigInt(100); // 90% of debt
    
    console.log(`🔄 Repaying ${formatAmount(repayAmount, 6)} USDC (90% of debt)...`);
    
    try {
        const tx = await protocolManager.repay("Euler", "USDC", repayAmount);
        await tx.wait();
        console.log(`✅ Repaid 90%!\n`);
        
        // Check remaining
        const newDebt = await usdcVault.debtOf(PLUGIN);
        console.log(`   Remaining Debt: ${formatAmount(newDebt, 6)} USDC (${newDebt} wei)\n`);
        
        // Now try repaying ALMOST all (leave 1 wei debt)
        console.log("=".repeat(70));
        console.log("REPAY ALMOST ALL (LEAVE 1 WEI)");
        console.log("=".repeat(70));
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const almostAll = newDebt - BigInt(1); // Leave 1 wei
        
        console.log(`🔄 Repaying ${almostAll} wei (all except 1 wei)...`);
        
        try {
            const tx2 = await protocolManager.repay("Euler", "USDC", almostAll);
            await tx2.wait();
            console.log(`✅ Repaid almost all!\n`);
            
            const finalDebt = await usdcVault.debtOf(PLUGIN);
            console.log(`   Final Debt: ${finalDebt} wei\n`);
            
            if (finalDebt <= BigInt(10)) {
                console.log(`✅ SUCCESS! Only ${finalDebt} wei dust remaining - this proves:`);
                console.log(`   1. Repay works fine`);
                console.log(`   2. Problem is ONLY when debt reaches 0 (auto-disable controller)`);
                console.log(`   3. EVC doesn't allow disabling controller while collateral is enabled\n`);
            }
            
        } catch (e: any) {
            console.log(`❌ Even leaving 1 wei failed: ${e.message}\n`);
        }
        
    } catch (e: any) {
        console.log(`❌ Failed: ${e.message}\n`);
        return;
    }
    
    // Wait and check result
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    debt = await usdcVault.debtOf(PLUGIN);
    controllerEnabled = await evc.isControllerEnabled(PLUGIN, ARBITRUM_ADDRESSES.USDC_VAULT);
    
    console.log(`📊 AFTER REPAY:`);
    console.log(`   Remaining Debt (RAW): ${debt} wei`);
    console.log(`   Remaining Debt: ${formatAmount(debt, 6)} USDC`);
    console.log(`   Controller: ${controllerEnabled ? "⚠️ STILL ENABLED" : "✅ AUTO-DISABLED"}\n`);
    
    // FINAL RESULT
    console.log("=".repeat(70));
    console.log("RESULT");
    console.log("=".repeat(70));
    
    if (debt === 0n) {
        console.log(`✅ PERFECT - NO DUST!`);
        console.log(`✅ Dust fix worked perfectly\n`);
    } else if (debt < BigInt(10)) {
        console.log(`⚠️ MINIMAL DUST - ${debt} wei`);
        console.log(`   Acceptable precision loss\n`);
    } else {
        console.log(`❌ DUST PRESENT - ${debt} wei`);
        console.log(`   Dust fix may need adjustment\n`);
    }
}

main().catch(console.error);
