/**
 * Check precise debt (full decimals)
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../config/arbitrum.config";
import { verifyArbitrumMainnet, loadDeployment } from "../utils/plugins/euler/euler-helpers";

async function main() {
    await verifyArbitrumMainnet();
    
    const pluginAddress = loadDeployment("EulerV2Plugin");
    if (!pluginAddress) throw new Error("Plugin not found");
    
    const usdcVault = await ethers.getContractAt(
        ["function debtOf(address) view returns (uint256)"],
        ARBITRUM_ADDRESSES.USDC_VAULT
    );
    
    const debt = await usdcVault.debtOf(pluginAddress);
    
    console.log(`\n📍 Plugin: ${pluginAddress}`);
    console.log(`\nDebt (raw): ${debt.toString()}`);
    console.log(`Debt (formatted): ${ethers.formatUnits(debt, 6)} USDC`);
    console.log(`Debt == 0: ${debt === 0n}\n`);
    
    if (debt > 0n) {
        console.log(`⚠️  DUST DETECTED: ${debt} wei (${ethers.formatUnits(debt, 6)} USDC)`);
        console.log(`This is why controller cannot be disabled!\n`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
