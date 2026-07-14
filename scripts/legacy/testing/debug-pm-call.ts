/**
 * Debug ProtocolManager call to plugin
 */

import { ethers } from "hardhat";

const PROTOCOL_MANAGER = "0x5b8314319CB56864b002caFEB92540B7A7559fBB";
const NEW_PLUGIN = "0x6450a7D9Df02D4bDb5dC7F21BF39F5a0f53dC374";
const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";

async function main() {
    const [deployer] = await ethers.getSigners();
    
    console.log(`\n🔍 Debug ProtocolManager → Plugin call\n`);
    
    // Check what Beacon returns for "ProtocolManager"
    const beacon = await ethers.getContractAt("Beacon", BEACON);
    const pmFromBeacon = await beacon.getImplementation("ProtocolManager");
    
    console.log(`Beacon says ProtocolManager is: ${pmFromBeacon}`);
    console.log(`Actual ProtocolManager:         ${PROTOCOL_MANAGER}`);
    console.log(`Match: ${pmFromBeacon.toLowerCase() === PROTOCOL_MANAGER.toLowerCase()}\n`);
    
    // Check if PM is registered in PM's registry
    const pm = await ethers.getContractAt("ProtocolManager", PROTOCOL_MANAGER);
    
    try {
        const eulerInfo = await pm.getProtocolInfo("Euler");
        console.log(`Euler registration in PM:`);
        console.log(`  Plugin: ${eulerInfo.plugin}`);
        console.log(`  Lens: ${eulerInfo.lens}`);
        console.log(`  Registry: ${eulerInfo.registry}\n`);
        
        if (eulerInfo.plugin.toLowerCase() !== NEW_PLUGIN.toLowerCase()) {
            console.log(`⚠️  PM points to OLD plugin: ${eulerInfo.plugin}`);
            console.log(`   Expected NEW plugin: ${NEW_PLUGIN}\n`);
        }
    } catch (e: any) {
        console.log(`❌ Error getting protocol info: ${e.message}\n`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
