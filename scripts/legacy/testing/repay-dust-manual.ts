/**
 * Repay dust on OLD plugin manually
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../config/arbitrum.config";
import { formatAmount } from "../utils/plugins/euler/euler-helpers";

const OLD_PLUGIN = "0x846471faAA2F877EdF235838120C34995a3E279E";

async function main() {
    console.log(`\n💸 Repaying dust on OLD plugin...\n`);
    
    const [deployer] = await ethers.getSigners();
    
    const plugin = await ethers.getContractAt("EulerV2Plugin", OLD_PLUGIN);
    const usdc = await ethers.getContractAt("IERC20", ARBITRUM_ADDRESSES.USDC);
    const usdcVault = await ethers.getContractAt(
        ["function debtOf(address) view returns (uint256)"],
        ARBITRUM_ADDRESSES.USDC_VAULT
    );
    
    // Check debt
    const debt = await usdcVault.debtOf(OLD_PLUGIN);
    console.log(`Current debt: ${debt} wei (${formatAmount(debt, 6)} USDC)\n`);
    
    if (debt === 0n) {
        console.log(`✅ No dust!`);
        return;
    }
    
    // Transfer USDC to plugin
    const proxyGeneral = await ethers.getContractAt("ProxyGeneral", ARBITRUM_ADDRESSES.PROXY_GENERAL);
    const dustAmount = debt + BigInt(100); // Extra
    
    console.log(`Transferring ${formatAmount(dustAmount, 6)} USDC to plugin...`);
    let tx = await proxyGeneral.transferToModule(ARBITRUM_ADDRESSES.USDC, OLD_PLUGIN, dustAmount);
    await tx.wait();
    console.log(`✅ Transferred\n`);
    
    // Repay as owner (deployer owns PM, PM owns plugin)
    console.log(`Repaying dust as owner...`);
    tx = await plugin.repay("USDC", 0); // 0 = all
    await tx.wait();
    console.log(`✅ Repaid! Tx: ${tx.hash}\n`);
    
    // Check remaining
    const remaining = await usdcVault.debtOf(OLD_PLUGIN);
    console.log(`Remaining debt: ${remaining} wei`);
    
    if (remaining === 0n) {
        console.log(`✅ ALL DUST CLEARED!`);
    } else {
        console.log(`⚠️  Still ${remaining} wei remaining`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
