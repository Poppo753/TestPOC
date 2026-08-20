/**
 * Complete Euler ecosystem redeploy
 * 1. EulerRegistry
 * 2. EulerLensAdapter
 * 3. EulerV2Plugin (with dust fix)
 * 4. Register everything
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../config/arbitrum.config";

const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
const PROTOCOL_MANAGER = "0x5b8314319CB56864b002caFEB92540B7A7559fBB";
const PROXY_GENERAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";

// Base Asset Configuration
const BASE_ASSET_CODE = "USDC";

async function main() {
    console.log("\n" + "=".repeat(70));
    console.log("🚀 COMPLETE EULER ECOSYSTEM REDEPLOY");
    console.log("=".repeat(70));

    const [deployer] = await ethers.getSigners();
    console.log(`\n👤 Deployer: ${deployer.address}`);
    console.log(`💰 Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

    // ====================
    // 1. DEPLOY EULERREGISTRY
    // ====================
    console.log("=".repeat(70));
    console.log("STEP 1: Deploy EulerRegistry");
    console.log("=".repeat(70));

    const EulerRegistry = await ethers.getContractFactory("EulerRegistry");
    const registry = await EulerRegistry.deploy();
    await registry.waitForDeployment();
    const registryAddress = await registry.getAddress();
    console.log(`✅ EulerRegistry: ${registryAddress}\n`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // ====================
    // 2. DEPLOY EULERLENSADAPTER
    // ====================
    console.log("=".repeat(70));
    console.log("STEP 2: Deploy EulerLensAdapter");
    console.log("=".repeat(70));

    const EulerLensAdapter = await ethers.getContractFactory("EulerLensAdapter");
    const lens = await EulerLensAdapter.deploy(
        BEACON,
        BASE_ASSET_CODE,
        ARBITRUM_ADDRESSES.ACCOUNT_LENS,
        ARBITRUM_ADDRESSES.VAULT_LENS,
        ARBITRUM_ADDRESSES.UTILS_LENS,
        ARBITRUM_ADDRESSES.EVC
    );
    await lens.waitForDeployment();
    const lensAddress = await lens.getAddress();
    console.log(`✅ EulerLensAdapter: ${lensAddress}\n`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // ====================
    // 3. DEPLOY EULERV2PLUGIN (WITH DUST FIX)
    // ====================
    console.log("=".repeat(70));
    console.log("STEP 3: Deploy EulerV2Plugin (with dust fix)");
    console.log("=".repeat(70));

    const EulerV2Plugin = await ethers.getContractFactory("EulerV2Plugin");
    const plugin = await EulerV2Plugin.deploy(BEACON, BASE_ASSET_CODE, ARBITRUM_ADDRESSES.EVC, ARBITRUM_ADDRESSES.ACCOUNT_LENS);
    await plugin.waitForDeployment();
    const pluginAddress = await plugin.getAddress();
    
    // Check size
    const code = await ethers.provider.getCode(pluginAddress);
    const size = (code.length - 2) / 2;
    console.log(`✅ EulerV2Plugin: ${pluginAddress}`);
    console.log(`   Size: ${size} bytes ${size > 24576 ? '❌ TOO LARGE' : '✅ OK'}\n`);

    if (size > 24576) {
        throw new Error("Contract size exceeds 24KB limit!");
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // ====================
    // 4. TRANSFER PLUGIN OWNERSHIP TO PM
    // ====================
    console.log("=".repeat(70));
    console.log("STEP 4: Transfer Plugin Ownership to ProtocolManager");
    console.log("=".repeat(70));

    let tx = await plugin.transferOwnership(PROTOCOL_MANAGER);
    await tx.wait();
    console.log(`✅ Ownership transferred to ProtocolManager\n`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // ====================
    // 5. REGISTER IN BEACON
    // ====================
    console.log("=".repeat(70));
    console.log("STEP 5: Register in Beacon");
    console.log("=".repeat(70));

    const beacon = await ethers.getContractAt("Beacon", BEACON);

    // Register as "Euler" (what PM uses)
    tx = await beacon.updateImplementation("Euler", pluginAddress);
    await tx.wait();
    console.log(`✅ Registered "Euler" → ${pluginAddress}`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Register as "EulerV2Plugin"
    tx = await beacon.updateImplementation("EulerV2Plugin", pluginAddress);
    await tx.wait();
    console.log(`✅ Registered "EulerV2Plugin" → ${pluginAddress}\n`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // ====================
    // 6. REGISTER IN PROTOCOLMANAGER
    // ====================
    console.log("=".repeat(70));
    console.log("STEP 6: Register in ProtocolManager");
    console.log("=".repeat(70));

    const pm = await ethers.getContractAt("ProtocolManager", PROTOCOL_MANAGER);

    try {
        // Try update first
        tx = await pm.updateProtocol("Euler", pluginAddress, lensAddress, registryAddress);
        await tx.wait();
        console.log(`✅ Updated Euler protocol`);
    } catch (e: any) {
        if (e.message.includes("not registered")) {
            // Register new
            tx = await pm.registerProtocol("Euler", pluginAddress, lensAddress, registryAddress);
            await tx.wait();
            console.log(`✅ Registered Euler protocol`);
        } else {
            throw e;
        }
    }

    const info = await pm.getProtocolInfo("Euler");
    console.log(`   Plugin: ${info.plugin}`);
    console.log(`   Lens: ${info.lens}`);
    console.log(`   Registry: ${info.registry}\n`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // ====================
    // 7. AUTHORIZE IN PROXYGENERAL
    // ====================
    console.log("=".repeat(70));
    console.log("STEP 7: Authorize in ProxyGeneral");
    console.log("=".repeat(70));

    const proxy = await ethers.getContractAt("ProxyGeneral", PROXY_GENERAL);
    
    const isAuthorized = await proxy.authorizedModules(pluginAddress);
    if (!isAuthorized) {
        tx = await proxy.authorizeModule(pluginAddress, "EulerV2Plugin");
        await tx.wait();
        console.log(`✅ Authorized in ProxyGeneral\n`);
    } else {
        console.log(`ℹ️  Already authorized\n`);
    }

    // ====================
    // SUMMARY
    // ====================
    console.log("=".repeat(70));
    console.log("✅ DEPLOYMENT COMPLETE");
    console.log("=".repeat(70));
    console.log(`
📦 Deployed Contracts:
   EulerRegistry:     ${registryAddress}
   EulerLensAdapter:  ${lensAddress}
   EulerV2Plugin:     ${pluginAddress} (${size} bytes)

🔗 Registrations:
   ✅ Beacon: "Euler" → ${pluginAddress}
   ✅ Beacon: "EulerV2Plugin" → ${pluginAddress}
   ✅ ProtocolManager: Euler protocol registered
   ✅ ProxyGeneral: Plugin authorized

💡 Ready to test:
   npx hardhat run scripts/testing/test-full-cycle-final.ts --network arbitrum
`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
