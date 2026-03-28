/**
 * Deep debug authorization issue
 */

import { ethers } from "hardhat";

const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
const PROTOCOL_MANAGER = "0x5b8314319CB56864b002caFEB92540B7A7559fBB";
const NEW_PLUGIN = "0x490139F3b29786D64056a236a0062CA23A7313f6";

async function main() {
    console.log("\n🔍 DEEP DEBUG AUTHORIZATION\n");
    
    const [deployer] = await ethers.getSigners();
    
    // 1. What does Beacon say?
    const beacon = await ethers.getContractAt("Beacon", BEACON);
    const pmFromBeacon = await beacon.getImplementation("ProtocolManager");
    
    console.log("1️⃣ BEACON RESOLUTION:");
    console.log(`   Beacon.getImplementation("ProtocolManager") = ${pmFromBeacon}`);
    console.log(`   Actual PM we're using = ${PROTOCOL_MANAGER}`);
    console.log(`   Match: ${pmFromBeacon.toLowerCase() === PROTOCOL_MANAGER.toLowerCase()}\n`);
    
    // 2. What does Plugin think?
    const plugin = await ethers.getContractAt(
        ["function beacon() view returns (address)", "function owner() view returns (address)"],
        NEW_PLUGIN
    );
    
    const pluginBeacon = await plugin.beacon();
    const pluginOwner = await plugin.owner();
    
    console.log("2️⃣ PLUGIN STATE:");
    console.log(`   plugin.beacon() = ${pluginBeacon}`);
    console.log(`   Correct beacon: ${pluginBeacon.toLowerCase() === BEACON.toLowerCase()}`);
    console.log(`   plugin.owner() = ${pluginOwner}`);
    console.log(`   Owner is PM: ${pluginOwner.toLowerCase() === PROTOCOL_MANAGER.toLowerCase()}\n`);
    
    // 3. Simulate modifier check
    console.log("3️⃣ MODIFIER SIMULATION:");
    console.log(`   msg.sender would be: ${PROTOCOL_MANAGER}`);
    console.log(`   Beacon resolves PM to: ${pmFromBeacon}`);
    console.log(`   Owner is: ${pluginOwner}`);
    console.log();
    console.log(`   Check 1: msg.sender == protocolManager`);
    console.log(`            ${PROTOCOL_MANAGER} == ${pmFromBeacon}`);
    console.log(`            Result: ${PROTOCOL_MANAGER.toLowerCase() === pmFromBeacon.toLowerCase()}`);
    console.log();
    console.log(`   Check 2: msg.sender == owner()`);
    console.log(`            ${PROTOCOL_MANAGER} == ${pluginOwner}`);
    console.log(`            Result: ${PROTOCOL_MANAGER.toLowerCase() === pluginOwner.toLowerCase()}`);
    console.log();
    
    const shouldPass = (PROTOCOL_MANAGER.toLowerCase() === pmFromBeacon.toLowerCase()) ||
                       (PROTOCOL_MANAGER.toLowerCase() === pluginOwner.toLowerCase());
    
    console.log(`   🎯 MODIFIER SHOULD PASS: ${shouldPass ? '✅ YES' : '❌ NO'}\n`);
    
    // 4. Try direct call with deployer (who owns PM)
    console.log("4️⃣ OWNERSHIP CHAIN:");
    const pm = await ethers.getContractAt(
        ["function owner() view returns (address)"],
        PROTOCOL_MANAGER
    );
    const pmOwner = await pm.owner();
    
    console.log(`   Deployer: ${deployer.address}`);
    console.log(`   PM.owner(): ${pmOwner}`);
    console.log(`   Deployer owns PM: ${pmOwner.toLowerCase() === deployer.address.toLowerCase()}`);
    console.log(`   PM owns Plugin: ${pluginOwner.toLowerCase() === PROTOCOL_MANAGER.toLowerCase()}\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
