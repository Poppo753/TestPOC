/**
 * @file redeploy-aave3-flashloan.ts
 * @description Redeploy AaveV3Plugin + FlashLoanService
 * 
 * Changes:
 * - AaveV3Plugin: Added leverage functions (openLeverageAtomic, closeLeverageAtomic)
 * - FlashLoanService: Dynamic _isRegisteredPlugin via beacon.getRegisteredModules()
 * 
 * What gets redeployed:
 * 1. AaveV3Plugin (new address, same beacon constructor)
 * 2. FlashLoanService (new address, same beacon constructor)
 * 
 * What stays the same:
 * - AaveV3Registry (unchanged, still owned by old plugin — only view functions used)
 * - AaveV3LensAdapter (unchanged)
 * - Beacon, ProxyGeneral (unchanged)
 * 
 * Post-deploy actions:
 * - Beacon: updateImplementation for both
 * - ProxyGeneral: deauthorize old plugin, authorize new plugin
 * - Update mainnet-latest.json
 * 
 * USAGE:
 *   npx hardhat run scripts/redeploy-aave3-flashloan.ts --network arbitrum
 *   
 * DRY-RUN (fork locale):
 *   $env:FORK_ENABLED="true"; npx hardhat run scripts/redeploy-aave3-flashloan.ts --network hardhat
 */

import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ==================== CONFIGURAZIONE ====================

const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
const PROXY_GENERAL = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
const REAL_DEPLOYER = "0x8390e98483a9b39265428c8610371134B5d11C3F";

// Current deployed addresses (from mainnet-latest.json)
const OLD_AAVE_V3_PLUGIN = "0x4cFDCb4215F562DC3Bc36D28fCf093E993AdC026";
const OLD_FLASH_LOAN_SERVICE = "0x638C0175a1883063F22fc2439C85364e4aC27b03";

// ==================== MAIN ====================

async function main() {
    console.log("\n" + "=".repeat(70));
    console.log("🔄 REDEPLOY: AaveV3Plugin + FlashLoanService");
    console.log("=".repeat(70));

    let deployer;
    const isFork = network.name === "hardhat" || network.name === "localhost";

    if (isFork) {
        // Impersonate real deployer on fork
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [REAL_DEPLOYER],
        });
        // Fund impersonated account
        const [funder] = await ethers.getSigners();
        await funder.sendTransaction({
            to: REAL_DEPLOYER,
            value: ethers.parseEther("1"),
        });
        deployer = await ethers.getSigner(REAL_DEPLOYER);
        console.log(`\n⚠️  FORK MODE — Impersonating ${REAL_DEPLOYER}`);
    } else {
        [deployer] = await ethers.getSigners();
    }

    const deployerAddress = deployer.address;
    const balance = await ethers.provider.getBalance(deployerAddress);

    console.log(`\n📍 Deployer: ${deployerAddress}`);
    console.log(`   Balance:  ${ethers.formatEther(balance)} ETH`);
    console.log(`   Network:  ${network.name} (chainId: ${(await ethers.provider.getNetwork()).chainId})`);
    console.log(`\n   Old AaveV3Plugin:      ${OLD_AAVE_V3_PLUGIN}`);
    console.log(`   Old FlashLoanService:  ${OLD_FLASH_LOAN_SERVICE}`);
    console.log(`   Beacon:                ${BEACON}`);
    console.log(`   ProxyGeneral:          ${PROXY_GENERAL}`);

    // ==================== GET BEACON & PROXY CONTRACTS ====================

    const beacon = await ethers.getContractAt(
        [
            "function updateImplementation(string memory moduleName, address newImplementation) external",
            "function getImplementation(string memory name) view returns (address)",
            "function owner() view returns (address)",
        ],
        BEACON,
        deployer
    );

    const proxy = await ethers.getContractAt(
        [
            "function authorizeModule(address module, string memory name) external",
            "function deauthorizeModule(address module) external",
            "function authorizedModules(address module) view returns (bool)",
            "function owner() view returns (address)",
        ],
        PROXY_GENERAL,
        deployer
    );

    const beaconOwner = await beacon.owner();
    const proxyOwner = await proxy.owner();
    console.log(`\n   Beacon owner:       ${beaconOwner}`);
    console.log(`   ProxyGeneral owner: ${proxyOwner}`);

    const isOwner = beaconOwner.toLowerCase() === deployerAddress.toLowerCase()
                 && proxyOwner.toLowerCase() === deployerAddress.toLowerCase();
    
    if (!isOwner) {
        console.error("\n❌ You must be owner of both Beacon and ProxyGeneral!");
        process.exit(1);
    }

    // ==================== STEP 1: Deploy new FlashLoanService ====================

    console.log("\n\n📦 STEP 1/5: Deploying new FlashLoanService...");
    const FlashLoanServiceFactory = await ethers.getContractFactory("FlashLoanService", deployer);
    const flashLoanService = await FlashLoanServiceFactory.deploy(BEACON);
    await flashLoanService.waitForDeployment();
    const newFlashLoanAddress = await flashLoanService.getAddress();
    console.log(`   ✅ FlashLoanService deployed: ${newFlashLoanAddress}`);

    // Verify config
    const balancerVault = await flashLoanService.getBalancerVault();
    const simpleSwap = await flashLoanService.getSimpleSwap();
    console.log(`   Balancer Vault: ${balancerVault}`);
    console.log(`   SimpleSwap:     ${simpleSwap}`);

    // ==================== STEP 2: Deploy new AaveV3Plugin ====================

    console.log("\n📦 STEP 2/5: Deploying new AaveV3Plugin...");
    const AaveV3PluginFactory = await ethers.getContractFactory("AaveV3Plugin", deployer);
    const aaveV3Plugin = await AaveV3PluginFactory.deploy(BEACON);
    await aaveV3Plugin.waitForDeployment();
    const newPluginAddress = await aaveV3Plugin.getAddress();
    console.log(`   ✅ AaveV3Plugin deployed: ${newPluginAddress}`);

    // Verify
    const pluginOwner = await aaveV3Plugin.owner();
    const pluginBeacon = await aaveV3Plugin.beacon();
    console.log(`   Owner:  ${pluginOwner}`);
    console.log(`   Beacon: ${pluginBeacon}`);

    // Check leverage functions exist
    try {
        // Just checking the function selector exists (will revert but not with "function not found")
        const iface = AaveV3PluginFactory.interface;
        const openSig = iface.getFunction("openLeverageAtomic");
        const closeSig = iface.getFunction("closeLeverageAtomic");
        console.log(`   ✅ openLeverageAtomic:  ${openSig?.selector}`);
        console.log(`   ✅ closeLeverageAtomic: ${closeSig?.selector}`);
    } catch (e) {
        console.error("   ❌ Leverage functions not found in ABI!");
        process.exit(1);
    }

    // ==================== STEP 3: Update Beacon registrations ====================

    console.log("\n📝 STEP 3/5: Updating Beacon registrations...");

    // FlashLoanService
    await (await beacon.updateImplementation("FlashLoanService", newFlashLoanAddress)).wait();
    const regFlash = await beacon.getImplementation("FlashLoanService");
    console.log(`   ✅ "FlashLoanService" → ${regFlash}`);
    if (regFlash.toLowerCase() !== newFlashLoanAddress.toLowerCase()) {
        console.error("   ❌ FlashLoanService registration failed!");
        process.exit(1);
    }

    // AaveV3Plugin
    await (await beacon.updateImplementation("AaveV3Plugin", newPluginAddress)).wait();
    const regPlugin = await beacon.getImplementation("AaveV3Plugin");
    console.log(`   ✅ "AaveV3Plugin"     → ${regPlugin}`);
    if (regPlugin.toLowerCase() !== newPluginAddress.toLowerCase()) {
        console.error("   ❌ AaveV3Plugin registration failed!");
        process.exit(1);
    }

    // ==================== STEP 4: ProxyGeneral authorization ====================

    console.log("\n🔓 STEP 4/5: Updating ProxyGeneral authorization...");

    // Deauthorize old plugin
    const oldAuth = await proxy.authorizedModules(OLD_AAVE_V3_PLUGIN);
    if (oldAuth) {
        await (await proxy.deauthorizeModule(OLD_AAVE_V3_PLUGIN)).wait();
        console.log(`   ✅ Old AaveV3Plugin deauthorized: ${OLD_AAVE_V3_PLUGIN}`);
    } else {
        console.log(`   ⚠️  Old AaveV3Plugin was already not authorized`);
    }

    // Authorize new plugin
    await (await proxy.authorizeModule(newPluginAddress, "AaveV3Plugin")).wait();
    const newAuth = await proxy.authorizedModules(newPluginAddress);
    console.log(`   ✅ New AaveV3Plugin authorized: ${newPluginAddress} (verified: ${newAuth})`);

    // ==================== STEP 5: Update deployment JSON ====================

    console.log("\n📁 STEP 5/5: Updating deployment file...");
    const deploymentPath = path.join(__dirname, "..", "deployments", "mainnet-latest.json");

    if (fs.existsSync(deploymentPath)) {
        const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

        // Update FlashLoanService
        deployment.FlashLoanService = {
            address: newFlashLoanAddress,
            deployer: deployerAddress,
            timestamp: new Date().toISOString(),
            beacon: BEACON,
            balancerVault: balancerVault,
            simpleSwap: simpleSwap,
            previousVersion: OLD_FLASH_LOAN_SERVICE,
            upgradeReason: "Dynamic _isRegisteredPlugin via beacon.getRegisteredModules()",
        };

        // Update AaveV3Plugin
        deployment.AaveV3Plugin = {
            ...deployment.AaveV3Plugin,
            address: newPluginAddress,
            deployer: deployerAddress,
            timestamp: new Date().toISOString(),
            previousVersion: OLD_AAVE_V3_PLUGIN,
            upgradeReason: "Added leverage: openLeverageAtomic, closeLeverageAtomic",
            authorizedInProxyGeneral: true,
        };

        // Update contracts map
        if (deployment.contracts) {
            deployment.contracts.aaveV3Plugin = newPluginAddress;
            deployment.contracts.flashLoanService = newFlashLoanAddress;
        }

        deployment.timestamp = new Date().toISOString();

        fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
        console.log(`   ✅ Updated ${deploymentPath}`);
    } else {
        console.log(`   ⚠️  Deployment file not found, skipping.`);
    }

    // ==================== RIEPILOGO ====================

    console.log("\n" + "=".repeat(70));
    console.log("✅ REDEPLOY COMPLETATO!");
    console.log("=".repeat(70));
    console.log(`\n   FlashLoanService:`);
    console.log(`      NEW: ${newFlashLoanAddress}`);
    console.log(`      OLD: ${OLD_FLASH_LOAN_SERVICE}`);
    console.log(`      Change: Dynamic _isRegisteredPlugin`);
    console.log(`\n   AaveV3Plugin:`);
    console.log(`      NEW: ${newPluginAddress}`);
    console.log(`      OLD: ${OLD_AAVE_V3_PLUGIN}`);
    console.log(`      Change: Added leverage (openLeverageAtomic, closeLeverageAtomic)`);
    console.log(`\n   Beacon: Both updated ✅`);
    console.log(`   ProxyGeneral: Old deauthorized, new authorized ✅`);
    console.log("\n" + "=".repeat(70));
    console.log("\n📋 Post-deploy checklist:");
    console.log("   [1] Verify beacon.getImplementation('FlashLoanService') returns new address");
    console.log("   [2] Verify beacon.getImplementation('AaveV3Plugin') returns new address");
    console.log("   [3] Verify proxy.isModuleAuthorized(newPlugin) = true");
    console.log("   [4] Test small deposit (0.001 WETH) via AaveV3Plugin");
    console.log("   [5] Test small leverage (0.01 WETH, 1.5x) via openLeverageAtomic");
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Redeploy failed:");
        console.error(error);
        process.exit(1);
    });
