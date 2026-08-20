/**
 * @file complete-aave-v3-registration.ts
 * @description Completa la registrazione dei contratti Aave V3 già deployati:
 *   1. Beacon.updateImplementation() per Registry, Plugin, LensAdapter
 *   2. ProxyGeneral.authorizeModule() per Plugin
 * 
 * USAGE:
 *   npx hardhat run scripts/complete-aave-v3-registration.ts --network arbitrum
 */

import { ethers } from "hardhat";

// Already deployed addresses
const AAVE_V3_REGISTRY = "0xEeb0EA1C430E956266C8027E39cA7A5C855B1a73";
const AAVE_V3_PLUGIN = "0x4cFDCb4215F562DC3Bc36D28fCf093E993AdC026";
const AAVE_V3_LENS_ADAPTER = "0xF9d5Cb5a86f0aD469f37F08B27AEf7FdF46ac3E3";

const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
const PROXY_GENERAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("\n🔧 Completing Aave V3 Registration...");
    console.log("Deployer:", deployer.address);

    // ==================== BEACON REGISTRATION ====================

    console.log("\n📝 Registering in Beacon (updateImplementation)...");
    const beacon = await ethers.getContractAt(
        [
            "function updateImplementation(string memory module, address newImplementation) external",
            "function getImplementation(string memory module) view returns (address)",
            "function checkModuleExists(string memory module) view returns (bool)",
            "function owner() view returns (address)",
        ],
        BEACON
    );

    const beaconOwner = await beacon.owner();
    console.log("Beacon owner:", beaconOwner);

    if (beaconOwner.toLowerCase() !== deployer.address.toLowerCase()) {
        console.error("❌ You are not the Beacon owner!");
        process.exit(1);
    }

    // Register AaveV3Registry
    console.log("\n   Registering AaveV3Registry...");
    let tx = await beacon.updateImplementation("AaveV3Registry", AAVE_V3_REGISTRY);
    await tx.wait();
    const regCheck = await beacon.getImplementation("AaveV3Registry");
    console.log(`   ✅ AaveV3Registry → ${regCheck}`);

    // Register AaveV3Plugin
    console.log("   Registering AaveV3Plugin...");
    tx = await beacon.updateImplementation("AaveV3Plugin", AAVE_V3_PLUGIN);
    await tx.wait();
    const plugCheck = await beacon.getImplementation("AaveV3Plugin");
    console.log(`   ✅ AaveV3Plugin → ${plugCheck}`);

    // Register AaveV3LensAdapter
    console.log("   Registering AaveV3LensAdapter...");
    tx = await beacon.updateImplementation("AaveV3LensAdapter", AAVE_V3_LENS_ADAPTER);
    await tx.wait();
    const lensCheck = await beacon.getImplementation("AaveV3LensAdapter");
    console.log(`   ✅ AaveV3LensAdapter → ${lensCheck}`);

    // ==================== PROXYGENERAL AUTHORIZATION ====================

    console.log("\n🔓 Authorizing Plugin in ProxyGeneral...");
    const proxy = await ethers.getContractAt(
        [
            "function authorizeModule(address module, string memory moduleType) external",
            "function authorizedModules(address) view returns (bool)",
            "function owner() view returns (address)",
        ],
        PROXY_GENERAL
    );

    const proxyOwner = await proxy.owner();
    console.log("ProxyGeneral owner:", proxyOwner);

    if (proxyOwner.toLowerCase() !== deployer.address.toLowerCase()) {
        console.log("⚠️  You are not ProxyGeneral owner. Manual authorization needed:");
        console.log(`   proxyGeneral.authorizeModule("${AAVE_V3_PLUGIN}", "AaveV3Plugin")`);
    } else {
        tx = await proxy.authorizeModule(AAVE_V3_PLUGIN, "AaveV3Plugin");
        await tx.wait();
        const isAuthorized = await proxy.authorizedModules(AAVE_V3_PLUGIN);
        console.log(`   ✅ AaveV3Plugin authorized: ${isAuthorized}`);
    }

    // ==================== VERIFICATION ====================

    console.log("\n✅ REGISTRATION COMPLETE!");
    console.log("=".repeat(50));
    console.log(`   AaveV3Registry:     ${AAVE_V3_REGISTRY}`);
    console.log(`   AaveV3Plugin:       ${AAVE_V3_PLUGIN}`);
    console.log(`   AaveV3LensAdapter:  ${AAVE_V3_LENS_ADAPTER}`);
    console.log("=".repeat(50));
}

main().catch((e) => { console.error(e); process.exit(1); });
