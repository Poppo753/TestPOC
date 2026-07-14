/**
 * Check Beacon registrations
 */

import { ethers } from "hardhat";

const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";

async function main() {
    console.log(`\n📋 Checking Beacon registrations...\n`);
    
    const beacon = await ethers.getContractAt("Beacon", BEACON);
    
    const modules = ["ProtocolManager", "Euler", "EulerV2Plugin", "ProxyGeneral"];
    
    for (const module of modules) {
        try {
            const impl = await beacon.getImplementation(module);
            console.log(`✅ ${module}: ${impl}`);
        } catch (e) {
            console.log(`❌ ${module}: NOT FOUND`);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
