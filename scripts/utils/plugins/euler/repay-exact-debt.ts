/**
 * Repay exact debt in wei to clear dust
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../config/arbitrum.config";
import { loadDeployment } from "../utils/euler-helpers";

const PROTOCOL_MANAGER = "0x88Bd0A1eF96764B328aC6EBa99A7715a9ba28DF9";

async function main() {
    const pluginAddress = loadDeployment("EulerV2Plugin");
    
    // Check exact debt
    const usdcVault = await ethers.getContractAt(
        ["function debtOf(address) view returns (uint256)"],
        ARBITRUM_ADDRESSES.USDC_VAULT
    );
    
    const debt = await usdcVault.debtOf(pluginAddress);
    console.log(`\nCurrent debt: ${debt.toString()} wei (${ethers.formatUnits(debt, 6)} USDC)`);
    
    if (debt === 0n) {
        console.log(`✅ No debt to repay!`);
        return;
    }
    
    const [signer] = await ethers.getSigners();
    const pm = await ethers.getContractAt("ProtocolManager", PROTOCOL_MANAGER, signer);
    
    // Repay exact amount via ProtocolManager
    console.log(`\n💸 Repaying exact ${debt.toString()} wei...`);
    const tx = await pm.repay("Euler", "USDC", debt);
    const receipt = await tx.wait();
    
    console.log(`✅ Repaid!`);
    console.log(`   Tx: ${receipt?.hash}`);
    console.log(`   Gas: ${receipt?.gasUsed.toString()}`);
    
    // Verify
    const newDebt = await usdcVault.debtOf(pluginAddress);
    console.log(`\n✅ New debt: ${newDebt.toString()} wei`);
}

main().catch(e => { console.error(e); process.exit(1); });
