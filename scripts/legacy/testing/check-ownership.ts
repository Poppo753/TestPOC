/**
 * Check ownership chain
 */

import { ethers } from "hardhat";

const PROTOCOL_MANAGER = "0x5b8314319CB56864b002caFEB92540B7A7559fBB";
const NEW_PLUGIN = "0x6450a7D9Df02D4bDb5dC7F21BF39F5a0f53dC374";

async function main() {
    const [deployer] = await ethers.getSigners();
    
    console.log(`\n👤 Deployer: ${deployer.address}\n`);
    
    const pm = await ethers.getContractAt(
        ["function owner() view returns (address)"],
        PROTOCOL_MANAGER
    );
    
    const plugin = await ethers.getContractAt(
        ["function owner() view returns (address)"],
        NEW_PLUGIN
    );
    
    const pmOwner = await pm.owner();
    const pluginOwner = await plugin.owner();
    
    console.log(`ProtocolManager owner: ${pmOwner}`);
    console.log(`Plugin owner: ${pluginOwner}`);
    console.log();
    console.log(`Deployer owns PM: ${pmOwner.toLowerCase() === deployer.address.toLowerCase()}`);
    console.log(`PM owns Plugin: ${pluginOwner.toLowerCase() === PROTOCOL_MANAGER.toLowerCase()}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
