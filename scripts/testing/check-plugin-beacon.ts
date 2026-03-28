/**
 * Check plugin beacon config
 */

import { ethers } from "hardhat";

const NEW_PLUGIN = "0x6450a7D9Df02D4bDb5dC7F21BF39F5a0f53dC374";
const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";

async function main() {
    const plugin = await ethers.getContractAt(
        ["function beacon() view returns (address)"],
        NEW_PLUGIN
    );
    
    const pluginBeacon = await plugin.beacon();
    
    console.log(`\n📍 Plugin: ${NEW_PLUGIN}`);
    console.log(`   Beacon (expected): ${BEACON}`);
    console.log(`   Beacon (actual):   ${pluginBeacon}`);
    console.log(`   Match: ${pluginBeacon.toLowerCase() === BEACON.toLowerCase()}\n`);
    
    if (pluginBeacon.toLowerCase() !== BEACON.toLowerCase()) {
        console.log(`❌ BEACON MISMATCH!`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
