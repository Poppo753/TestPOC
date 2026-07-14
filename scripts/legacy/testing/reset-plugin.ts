/**
 * Reset plugin - close all positions and withdraw all
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../config/arbitrum.config";

const PLUGIN = "0x490139F3b29786D64056a236a0062CA23A7313f6";

async function main() {
    console.log("\n🔄 RESETTING PLUGIN...\n");
    
    const protocolManager = await ethers.getContractAt("ProtocolManager", "0x5b8314319CB56864b002caFEB92540B7A7559fBB");
    
    const usdcVault = await ethers.getContractAt(
        ["function debtOf(address) view returns (uint256)"],
        ARBITRUM_ADDRESSES.USDC_VAULT
    );
    
    const wethVault = await ethers.getContractAt(
        ["function maxWithdraw(address) view returns (uint256)"],
        ARBITRUM_ADDRESSES.WETH_VAULT
    );
    
    //Check debt
    const debt = await usdcVault.debtOf(PLUGIN);
    console.log(`Debt: ${ethers.formatUnits(debt, 6)} USDC`);
    
    if (debt > 0n) {
        console.log(`\n❌ Cannot reset - debt exists. Repay first!\n`);
        return;
    }
    
    // Check collateral
    const maxWithdraw = await wethVault.maxWithdraw(PLUGIN);
    console.log(`Max Withdraw: ${ethers.formatEther(maxWithdraw)} WETH\n`);
    
    if (maxWithdraw > 0n) {
        console.log(`🔄 Withdrawing ${ethers.formatEther(maxWithdraw)} WETH...`);
        
        const tx = await protocolManager.withdraw("Euler", "WETH", maxWithdraw);
        await tx.wait();
        
        console.log(`✅ Withdrawn!\n`);
    } else {
        console.log(`✅ Already clean!\n`);
    }
}

main().catch(console.error);
