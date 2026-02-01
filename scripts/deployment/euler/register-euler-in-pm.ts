/**
 * Register Euler protocol in ProtocolManager
 */

import { ethers } from "hardhat";

const PROTOCOL_MANAGER = "0x88Bd0A1eF96764B328aC6EBa99A7715a9ba28DF9";
const EULER_PLUGIN = "0x2356D97B9F81be327F2497B9CDd869736E654dd6";
const EULER_LENS = "0xfb76C4475149F1843bdF1d327569A12a027Be833";
const EULER_REGISTRY = "0x52c2D0645f5Bea7fE159d9Db9C27Ba6b50D1bAe3";

async function main() {
    console.log("\n📝 Registering Euler in ProtocolManager...\n");

    const [deployer] = await ethers.getSigners();
    
    const pm = await ethers.getContractAt(
        [
            "function registerProtocol(string memory protocolName, address plugin, address lensAdapter, address registry) external",
            "function getProtocolInfo(string memory protocolName) external view returns (tuple(address plugin, address lensAdapter, address registry, bool isActive, uint256 registeredAt))"
        ],
        PROTOCOL_MANAGER,
        deployer
    );

    console.log("Registering Euler protocol...");
    console.log(`  Plugin: ${EULER_PLUGIN}`);
    console.log(`  Lens: ${EULER_LENS}`);
    console.log(`  Registry: ${EULER_REGISTRY}`);
    
    const tx = await pm.registerProtocol("Euler", EULER_PLUGIN, EULER_LENS, EULER_REGISTRY);
    await tx.wait();
    
    console.log("\n✅ Euler registered!");
    
    // Verify
    const info = await pm.getProtocolInfo("Euler");
    console.log("\nVerification:");
    console.log(`  Plugin: ${info.plugin}`);
    console.log(`  Lens: ${info.lensAdapter}`);
    console.log(`  Registry: ${info.registry}`);
    console.log(`  Active: ${info.isActive}`);
    console.log(`\n🎉 All set! Ready for testing!\n`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
