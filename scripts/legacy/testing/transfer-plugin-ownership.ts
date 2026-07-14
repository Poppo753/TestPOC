/**
 * Transfer ownership of new plugin to ProtocolManager
 */

import { ethers } from "hardhat";

const NEW_PLUGIN = "0x6450a7D9Df02D4bDb5dC7F21BF39F5a0f53dC374";
const PROTOCOL_MANAGER = "0x5b8314319CB56864b002caFEB92540B7A7559fBB";

async function main() {
    console.log(`\n🔐 Transferring plugin ownership...`);
    console.log(`   Plugin: ${NEW_PLUGIN}`);
    console.log(`   To: ${PROTOCOL_MANAGER}\n`);
    
    const plugin = await ethers.getContractAt(
        ["function transferOwnership(address) external", "function owner() view returns (address)"],
        NEW_PLUGIN
    );
    
    const currentOwner = await plugin.owner();
    console.log(`Current owner: ${currentOwner}`);
    
    if (currentOwner.toLowerCase() === PROTOCOL_MANAGER.toLowerCase()) {
        console.log(`✅ Already owned by ProtocolManager!`);
    } else {
        const tx = await plugin.transferOwnership(PROTOCOL_MANAGER);
        await tx.wait();
        console.log(`✅ Ownership transferred! Tx: ${tx.hash}`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
