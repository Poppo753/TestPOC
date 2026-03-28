/**
 * Test full cycle con nuovo plugin
 * 1. Deposit
 * 2. Borrow
 * 3. Repay (with dust fix)
 * 4. Withdraw (should work now!)
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../config/arbitrum.config";
import { formatAmount, verifyArbitrumMainnet } from "../utils/plugins/euler/euler-helpers";

const NEW_PLUGIN = "0x490139F3b29786D64056a236a0062CA23A7313f6";

async function main() {
    console.log("\n" + "=".repeat(70));
    console.log("🔄 FULL CYCLE TEST - NEW PLUGIN (DUST FIX)");
    console.log("=".repeat(70));
    
    await verifyArbitrumMainnet();
    const [deployer] = await ethers.getSigners();
    
    // Contracts
    const proxyGeneral = await ethers.getContractAt("ProxyGeneral", ARBITRUM_ADDRESSES.PROXY_GENERAL);
    const protocolManager = await ethers.getContractAt("ProtocolManager", "0x5b8314319CB56864b002caFEB92540B7A7559fBB");
    
    const weth = await ethers.getContractAt("IERC20", ARBITRUM_ADDRESSES.WETH);
    const usdc = await ethers.getContractAt("IERC20", ARBITRUM_ADDRESSES.USDC);
    
    const wethVault = await ethers.getContractAt(
        ["function balanceOf(address) view returns (uint256)", "function maxWithdraw(address) view returns (uint256)", "function convertToAssets(uint256) view returns (uint256)"],
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
    
    console.log(`\n📍 New Plugin: ${NEW_PLUGIN}\n`);
    
    // First: Transfer WETH to ProxyGeneral (it may be depleted from previous tests)
    const depositAmount = ethers.parseEther("0.00001");
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    let tx = await weth.transfer(ARBITRUM_ADDRESSES.PROXY_GENERAL, depositAmount);
    await tx.wait();
    console.log(`✅ Sent ${formatAmount(depositAmount)} WETH to ProxyGeneral`);
    
    // Check ProxyGeneral balance
    const proxyWethBalance = await weth.balanceOf(ARBITRUM_ADDRESSES.PROXY_GENERAL);
    console.log(`   ProxyGeneral WETH Balance: ${formatAmount(proxyWethBalance)} WETH\n`);
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // STEP 1: DEPOSIT
    console.log("=".repeat(70));
    console.log("STEP 1: DEPOSIT 0.00001 WETH");
    console.log("=".repeat(70));
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // NO need for transferToModule - deposit() handles it internally
    tx = await protocolManager.deposit("Euler", "WETH", depositAmount);
    await tx.wait();
    console.log(`✅ Deposited: ${formatAmount(depositAmount)} WETH\n`);
    
    // Check collateral
    let collateralEnabled = await evc.isCollateralEnabled(NEW_PLUGIN, ARBITRUM_ADDRESSES.WETH_VAULT);
    console.log(`   Collateral Enabled: ${collateralEnabled ? "✅" : "❌"}\n`);
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // STEP 2: BORROW
    console.log("=".repeat(70));
    console.log("STEP 2: BORROW 0.01 USDC");
    console.log("=".repeat(70));
    
    const borrowAmount = ethers.parseUnits("0.01", 6);
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    tx = await protocolManager.borrow("Euler", "USDC", borrowAmount);
    await tx.wait();
    console.log(`✅ Borrowed: ${formatAmount(borrowAmount, 6)} USDC\n`);
    
    // Check debt
    let debt = await usdcVault.debtOf(NEW_PLUGIN);
    let controllerEnabled = await evc.isControllerEnabled(NEW_PLUGIN, ARBITRUM_ADDRESSES.USDC_VAULT);
    console.log(`   Debt: ${formatAmount(debt, 6)} USDC`);
    console.log(`   Controller Enabled: ${controllerEnabled ? "✅" : "❌"}\n`);
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // STEP 3: REPAY (CRITICAL - DUST FIX TEST)
    console.log("=".repeat(70));
    console.log("STEP 3: REPAY ALL (DUST FIX TEST)");
    console.log("=".repeat(70));
    
    console.log(`   Current Debt: ${formatAmount(debt, 6)} USDC`);
    
    // Repay using ProtocolManager (will handle ProxyGeneral → Plugin flow)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    tx = await protocolManager.repay("Euler", "USDC", debt);
    await tx.wait();
    console.log(`✅ Repaid ${formatAmount(debt, 6)} USDC\n`);
    
    // Wait for dust to settle
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if dust remains and repay again if needed
    let newDebt = await usdcVault.debtOf(NEW_PLUGIN);
    
    if (newDebt > 0n && newDebt < BigInt(1000)) {
        console.log(`   ⚠️ Dust detected: ${newDebt} wei, repaying...`);
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        tx = await protocolManager.repay("Euler", "USDC", newDebt);
        await tx.wait();
        console.log(`   ✅ Dust repaid\n`);
        
        newDebt = await usdcVault.debtOf(NEW_PLUGIN);
    }
    
    debt = newDebt;
    
    // Check debt after - SHOULD BE 0!
    debt = await usdcVault.debtOf(NEW_PLUGIN);
    controllerEnabled = await evc.isControllerEnabled(NEW_PLUGIN, ARBITRUM_ADDRESSES.USDC_VAULT);
    console.log(`   Remaining Debt (RAW): ${debt.toString()} wei`);
    console.log(`   Remaining Debt: ${formatAmount(debt, 6)} USDC`);
    console.log(`   Controller Enabled: ${controllerEnabled ? "⚠️ STILL ENABLED" : "✅ AUTO-DISABLED"}\n`);
    
    if (debt > 0n) {
        console.log(`   ❌ DUST STILL PRESENT: ${debt} wei\n`);
    } else {
        console.log(`   ✅ NO DUST - PERFECT!\n`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // STEP 4: WITHDRAW (FINAL TEST)
    console.log("=".repeat(70));
    console.log("STEP 4: WITHDRAW ALL WETH");
    console.log("=".repeat(70));
    
    const maxWithdraw = await wethVault.maxWithdraw(NEW_PLUGIN);
    console.log(`   Max Withdraw: ${formatAmount(maxWithdraw)} WETH`);
    
    if (maxWithdraw === 0n) {
        console.log(`   ❌ MAXWITHDRAW = 0 - STILL BROKEN!\n`);
        collateralEnabled = await evc.isCollateralEnabled(NEW_PLUGIN, ARBITRUM_ADDRESSES.WETH_VAULT);
        console.log(`   Collateral Still Enabled: ${collateralEnabled ? "✅ (problem)" : "❌"}\n`);
    } else {
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        tx = await protocolManager.withdraw("Euler", "WETH", 0); // 0 = withdraw all
        await tx.wait();
        console.log(`✅ Withdrawn: ${formatAmount(maxWithdraw)} WETH\n`);
        
        // Check final state
        collateralEnabled = await evc.isCollateralEnabled(NEW_PLUGIN, ARBITRUM_ADDRESSES.WETH_VAULT);
        const finalShares = await wethVault.balanceOf(NEW_PLUGIN);
        
        console.log(`   Final Shares: ${formatAmount(finalShares)}`);
        console.log(`   Collateral Enabled: ${collateralEnabled ? "⚠️ STILL ENABLED" : "✅ AUTO-DISABLED"}\n`);
    }
    
    console.log("=".repeat(70));
    console.log("TEST COMPLETE");
    console.log("=".repeat(70));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
