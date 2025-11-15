/**
 * Register WETH address in Beacon
 * TokenManager needs this to exclude WETH from being added as a regular token
 */

import { ethers } from "hardhat";

async function main() {
    const WETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"; // Arbitrum Mainnet WETH
    const beaconAddress = process.env.BEACON_ADDRESS;
    
    if (!beaconAddress) {
        throw new Error("BEACON_ADDRESS not set in .env");
    }
    
    console.log("\n🔷 REGISTER WETH IN BEACON");
    console.log(`Beacon: ${beaconAddress}`);
    console.log(`WETH: ${WETH_ADDRESS}`);
    
    const beacon = await ethers.getContractAt("Beacon", beaconAddress);
    
    console.log("\n📝 Registering WETH...");
    const tx = await beacon.updateImplementation("WETH", WETH_ADDRESS);
    await tx.wait();
    
    console.log("✅ WETH registered successfully!");
    
    // Verify
    const registeredWETH = await beacon.getImplementation("WETH");
    console.log(`\n✅ Verification: ${registeredWETH}`);
    
    if (registeredWETH !== WETH_ADDRESS) {
        throw new Error("WETH registration failed!");
    }
    
    console.log("\n✅ WETH ready for TokenManager exclusion checks!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error);
        process.exit(1);
    });
