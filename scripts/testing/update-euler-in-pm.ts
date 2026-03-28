/**
 * Update Euler registration in ProtocolManager with new plugin
 */

import { ethers } from "hardhat";

const PROTOCOL_MANAGER = "0x5b8314319CB56864b002caFEB92540B7A7559fBB";
const NEW_PLUGIN = "0x6450a7D9Df02D4bDb5dC7F21BF39F5a0f53dC374";
const EULER_LENS = "0xfb76C4475149F1843bdF1d327569A12a027Be833";
const EULER_REGISTRY = "0x52c2D0645f5Bea7fE159d9Db9C27Ba6b50D1bAe3";

async function main() {
    console.log(`\n🔄 Updating Euler registration in ProtocolManager...\n`);
    
    const pm = await ethers.getContractAt("ProtocolManager", PROTOCOL_MANAGER);
    
    // Update registration
    console.log("Updating Euler with new plugin...");
    const tx = await pm.updateProtocol("Euler", NEW_PLUGIN, EULER_LENS, EULER_REGISTRY);
    await tx.wait();
    console.log(`✅ Updated!`);
    console.log(`   Tx: ${tx.hash}\n`);
    
    // Verify
    const info = await pm.getProtocolInfo("Euler");
    console.log("✅ Verification:");
    console.log(`   Plugin: ${info.plugin}`);
    console.log(`   Lens: ${info.lens}`);
    console.log(`   Registry: ${info.registry}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
