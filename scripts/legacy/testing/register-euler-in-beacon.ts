/**
 * Register new plugin in Beacon as "Euler"
 */

import { ethers } from "hardhat";

const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
const NEW_PLUGIN = "0x6450a7D9Df02D4bDb5dC7F21BF39F5a0f53dC374";

async function main() {
    console.log(`\n📝 Registering "Euler" in Beacon...`);
    console.log(`   Plugin: ${NEW_PLUGIN}\n`);
    
    const beacon = await ethers.getContractAt("Beacon", BEACON);
    
    // Check if "Euler" exists
    const exists = await beacon.checkModuleExists("Euler");
    
    if (exists) {
        console.log(`Updating existing "Euler" module...`);
    } else {
        console.log(`Creating new "Euler" module...`);
    }
    
    const tx = await beacon.updateImplementation("Euler", NEW_PLUGIN);
    await tx.wait();
    console.log(`✅ Done! Tx: ${tx.hash}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
