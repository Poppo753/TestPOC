/**
 * Disable controller manualmente per permettere withdraw
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../config/arbitrum.config";

const PLUGIN = "0x46B5f0D51311c09e9d93be7d16fA75BECC654D5b";

async function main() {
    console.log("\n🔄 Disabling controller manually...\n");
    
    // We need to call from ProtocolManager as it owns the plugin
    // Or better: call the plugin's function that calls EVC
    
    const plugin = await ethers.getContractAt(
        ["function disableController(address vault) external"],
        PLUGIN
    );
    
    try {
        const tx = await plugin.disableController(ARBITRUM_ADDRESSES.USDC_VAULT);
        await tx.wait();
        console.log("✅ Controller disabled!\n");
    } catch (e: any) {
        console.log(`❌ Failed: ${e.message}`);
        console.log(`   This is expected - plugin doesn't have this function yet\n`);
    }
}

main().catch(console.error);
