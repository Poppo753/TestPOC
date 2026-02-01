/**
 * @file register-registry-in-beacon.ts
 * @description Register existing EulerRegistry in Beacon
 * 
 * USAGE:
 *   npx hardhat run scripts/deployment/euler/register-registry-in-beacon.ts --network arbitrum
 */

import { ethers } from "hardhat";

const BEACON_ADDRESS = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
const EULER_REGISTRY_ADDRESS = "0x52c2D0645f5Bea7fE159d9Db9C27Ba6b50D1bAe3";

async function main() {
    console.log("\n📝 Registering EulerRegistry in Beacon...\n");

    const [deployer] = await ethers.getSigners();
    
    const beacon = await ethers.getContractAt(
        [
            "function updateImplementation(string memory moduleName, address newImplementation) external",
            "function getImplementation(string memory name) view returns (address)"
        ],
        BEACON_ADDRESS,
        deployer
    );

    console.log(`Registering: ${EULER_REGISTRY_ADDRESS}`);
    
    const tx = await beacon.updateImplementation("EulerRegistry", EULER_REGISTRY_ADDRESS);
    await tx.wait();
    
    console.log("✅ Registered!");
    
    // Verify
    const registered = await beacon.getImplementation("EulerRegistry");
    console.log(`Verified: ${registered}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
