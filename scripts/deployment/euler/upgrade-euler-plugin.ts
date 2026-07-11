/**
 * @file upgrade-euler-plugin.ts
 * @description Upgrade EulerV2Plugin su Arbitrum - EVC Batch Refactor (Fifth Phase)
 * 
 * Questo script gestisce l'UPGRADE del contratto EulerV2Plugin esistente:
 * - Deploya la nuova versione (con EVC batch refactoring)
 * - Aggiorna il Beacon per puntare alla nuova implementation
 * - Trasferisce l'ownership di EulerRegistry dal vecchio al nuovo plugin
 * - Verifica la configurazione finale
 * 
 * CAMBIAMENTI NELLA NUOVA VERSIONE:
 * - EVC batch pattern per operazioni atomiche (deposit, borrow, closePosition, leverage)
 * - Fix critico disableController (2 params → 1 param su IEVC, 0 params su IEVault)
 * - Bytecode ridotto: 22,538 bytes (da 24,530 bytes)
 * - Rimossi: 4 eventi dead, 6 errori dead, 2 funzioni WETH duplicate
 * 
 * PREREQUISITI:
 * - EulerRegistry, EulerLensAdapter, FlashLoanService già deployati e registrati in Beacon
 * - Il deployer deve essere owner del Beacon
 * - Il deployer deve essere owner di EulerRegistry (o il vecchio plugin deve poter trasferire)
 * - Nessuna posizione attiva aperta (consigliato chiudere tutto prima dell'upgrade)
 * 
 * USAGE:
 *   npx hardhat run scripts/deployment/euler/upgrade-euler-plugin.ts --network arbitrum
 * 
 * ⚠️  NON RUNNARE senza aver prima verificato che tutte le posizioni siano chiuse!
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../../config/arbitrum.config";
import { saveDeployment, verifyArbitrumMainnet, checkSignerBalance } from "../../utils/plugins/euler/euler-helpers";

// Base Asset Configuration
const BASE_ASSET_CODE = "USDC";

// Indirizzo del vecchio plugin (da mainnet-latest.json)
const OLD_PLUGIN_ADDRESS = "0x490139F3b29786D64056a236a0062CA23A7313f6";

async function main() {
    console.log("\n" + "=".repeat(70));
    console.log("🔄 UPGRADE EULER V2 PLUGIN — EVC Batch Refactor");
    console.log("=".repeat(70) + "\n");

    // ==================== VALIDATION ====================
    console.log("📋 Pre-Upgrade Validation:\n");

    await verifyArbitrumMainnet();
    await checkSignerBalance("0.001");

    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();

    console.log(`\n📍 Deployer: ${deployerAddress}`);
    console.log(`   Beacon:   ${ARBITRUM_ADDRESSES.BEACON}`);
    console.log(`   Old Plugin: ${OLD_PLUGIN_ADDRESS}`);

    // ==================== GET BEACON ====================
    console.log("\n📦 Getting Beacon contract...");

    const beacon = await ethers.getContractAt(
        [
            "function updateImplementation(string memory moduleName, address newImplementation) external",
            "function getImplementation(string memory name) view returns (address)",
            "function owner() view returns (address)",
            "function implementationHistory(string memory, uint256) view returns (address)"
        ],
        ARBITRUM_ADDRESSES.BEACON,
        deployer
    );

    const beaconOwner = await beacon.owner();
    console.log(`   Beacon owner: ${beaconOwner}`);

    if (beaconOwner.toLowerCase() !== deployerAddress.toLowerCase()) {
        throw new Error(
            `❌ Deployer is NOT Beacon owner!\n` +
            `   Deployer: ${deployerAddress}\n` +
            `   Beacon owner: ${beaconOwner}\n` +
            `   Upgrade requires Beacon owner privileges.`
        );
    }
    console.log("   ✅ Deployer is Beacon owner");

    // ==================== VERIFY CURRENT STATE ====================
    console.log("\n🔍 Verifying current deployment state...");

    // Check old plugin in Beacon
    let currentPluginInBeacon: string;
    try {
        currentPluginInBeacon = await beacon.getImplementation("EulerV2Plugin");
        console.log(`   Current EulerV2Plugin in Beacon: ${currentPluginInBeacon}`);
    } catch {
        throw new Error("❌ EulerV2Plugin not found in Beacon. Use deploy-euler-plugin.ts for first deployment.");
    }

    if (currentPluginInBeacon.toLowerCase() !== OLD_PLUGIN_ADDRESS.toLowerCase()) {
        console.log(`   ⚠️  Beacon points to ${currentPluginInBeacon}, not expected ${OLD_PLUGIN_ADDRESS}`);
        console.log(`   Proceeding anyway — this address will be replaced.`);
    }

    // Check EulerRegistry exists
    let eulerRegistryAddress: string;
    try {
        eulerRegistryAddress = await beacon.getImplementation("EulerRegistry");
        console.log(`   ✅ EulerRegistry: ${eulerRegistryAddress}`);
    } catch {
        throw new Error("❌ EulerRegistry not found in Beacon!");
    }

    // Check FlashLoanService exists
    try {
        const flashLoanServiceAddress = await beacon.getImplementation("FlashLoanService");
        console.log(`   ✅ FlashLoanService: ${flashLoanServiceAddress}`);
    } catch {
        console.log("   ⚠️  FlashLoanService not found (leverage operations will not work)");
    }

    // Check EulerLensAdapter exists
    try {
        const eulerLensAddress = await beacon.getImplementation("EulerLensAdapter");
        console.log(`   ✅ EulerLensAdapter: ${eulerLensAddress}`);
    } catch {
        console.log("   ⚠️  EulerLensAdapter not found (view functions may not work)");
    }

    // ==================== CHECK EULER REGISTRY OWNERSHIP ====================
    console.log("\n🔑 Checking EulerRegistry ownership...");

    const eulerRegistry = await ethers.getContractAt(
        [
            "function owner() view returns (address)",
            "function transferOwnership(address newOwner) external"
        ],
        eulerRegistryAddress,
        deployer
    );

    const registryOwner = await eulerRegistry.owner();
    console.log(`   EulerRegistry owner: ${registryOwner}`);

    const registryOwnedByOldPlugin = registryOwner.toLowerCase() === currentPluginInBeacon.toLowerCase();
    const registryOwnedByDeployer = registryOwner.toLowerCase() === deployerAddress.toLowerCase();

    if (registryOwnedByOldPlugin) {
        console.log("   ℹ️  Registry owned by current plugin — will need ownership transfer via old plugin");
    } else if (registryOwnedByDeployer) {
        console.log("   ✅ Registry owned by deployer — direct transfer possible");
    } else {
        console.log(`   ⚠️  Registry owned by unknown address: ${registryOwner}`);
        console.log("   Manual ownership transfer will be required after upgrade");
    }

    // ==================== DEPLOY NEW PLUGIN ====================
    console.log("\n🚀 Deploying NEW EulerV2Plugin (EVC Batch version)...");

    const EulerV2Plugin = await ethers.getContractFactory("EulerV2Plugin", deployer);
    const newPlugin = await EulerV2Plugin.deploy(ARBITRUM_ADDRESSES.BEACON, BASE_ASSET_CODE, ARBITRUM_ADDRESSES.EVC, ARBITRUM_ADDRESSES.ACCOUNT_LENS);
    await newPlugin.waitForDeployment();

    const newPluginAddress = await newPlugin.getAddress();
    console.log(`   ✅ New EulerV2Plugin deployed: ${newPluginAddress}`);

    // Verify bytecode size
    const code = await ethers.provider.getCode(newPluginAddress);
    const sizeBytes = (code.length - 2) / 2;
    console.log(`   Contract size: ${sizeBytes} bytes (limit: 24,576)`);

    if (sizeBytes > 24576) {
        throw new Error(`❌ Contract exceeds 24,576 byte limit! Size: ${sizeBytes}`);
    }
    console.log(`   ✅ Size OK — ${24576 - sizeBytes} bytes under limit`);

    // ==================== VERIFY NEW PLUGIN CONFIGURATION ====================
    console.log("\n🔍 Verifying new plugin configuration...");

    const evcAddress = await newPlugin.EVC_ADDRESS();
    if (evcAddress !== ARBITRUM_ADDRESSES.EVC) {
        throw new Error(`❌ EVC address mismatch! Expected ${ARBITRUM_ADDRESSES.EVC}, got ${evcAddress}`);
    }
    console.log(`   ✅ EVC: ${evcAddress}`);

    const pluginBeacon = await newPlugin.beacon();
    if (pluginBeacon !== ARBITRUM_ADDRESSES.BEACON) {
        throw new Error(`❌ Beacon mismatch! Expected ${ARBITRUM_ADDRESSES.BEACON}, got ${pluginBeacon}`);
    }
    console.log(`   ✅ Beacon: ${pluginBeacon}`);

    const pluginOwner = await newPlugin.owner();
    console.log(`   Owner: ${pluginOwner}`);

    // ==================== UPDATE BEACON ====================
    console.log("\n📝 Updating Beacon implementation...");
    console.log(`   Old: ${currentPluginInBeacon}`);
    console.log(`   New: ${newPluginAddress}`);

    const updateTx = await beacon.updateImplementation("EulerV2Plugin", newPluginAddress);
    await updateTx.wait();

    // Verify update
    const updatedAddr = await beacon.getImplementation("EulerV2Plugin");
    if (updatedAddr.toLowerCase() !== newPluginAddress.toLowerCase()) {
        throw new Error(`❌ Beacon update failed! Expected ${newPluginAddress}, got ${updatedAddr}`);
    }
    console.log("   ✅ Beacon updated successfully");

    // ==================== TRANSFER EULER REGISTRY OWNERSHIP ====================
    console.log("\n🔑 Transferring EulerRegistry ownership to new plugin...");

    if (registryOwnedByDeployer) {
        // Direct transfer from deployer
        const transferTx = await eulerRegistry.transferOwnership(newPluginAddress);
        await transferTx.wait();

        const newRegistryOwner = await eulerRegistry.owner();
        if (newRegistryOwner.toLowerCase() !== newPluginAddress.toLowerCase()) {
            throw new Error(`❌ Ownership transfer failed! Owner is ${newRegistryOwner}`);
        }
        console.log(`   ✅ Registry ownership transferred to new plugin: ${newRegistryOwner}`);

    } else if (registryOwnedByOldPlugin) {
        // Need to call transferOwnership via the old plugin
        // The old plugin must have a function to transfer registry ownership,
        // or we need to do it through ProxyGeneral delegatecall
        console.log("   ⚠️  MANUAL ACTION REQUIRED:");
        console.log(`   EulerRegistry is owned by old plugin (${currentPluginInBeacon})`);
        console.log(`   Options:`);
        console.log(`   a) Call old plugin's transferRegistryOwnership if available`);
        console.log(`   b) Use ProxyGeneral to delegatecall registry.transferOwnership(${newPluginAddress})`);
        console.log(`   c) If old plugin forwards EulerRegistry methods, call through it`);
    } else {
        console.log(`   ⚠️  MANUAL ACTION REQUIRED:`);
        console.log(`   Call eulerRegistry.transferOwnership("${newPluginAddress}")`);
        console.log(`   From current owner: ${registryOwner}`);
    }

    // ==================== SAVE DEPLOYMENT ====================
    await saveDeployment(
        "EulerV2Plugin",
        newPluginAddress,
        deployerAddress,
        {
            beacon: ARBITRUM_ADDRESSES.BEACON,
            evc: evcAddress,
            size: sizeBytes,
            previousVersion: currentPluginInBeacon,
            upgradeType: "EVC Batch Refactor (fifthPhase)",
            dependencies: {
                eulerRegistry: eulerRegistryAddress
            }
        }
    );

    // ==================== SUMMARY ====================
    console.log("\n" + "=".repeat(70));
    console.log("✅ UPGRADE COMPLETE!");
    console.log("=".repeat(70));

    console.log("\n📊 Upgrade Summary:");
    console.log(`   Old EulerV2Plugin: ${currentPluginInBeacon}`);
    console.log(`   New EulerV2Plugin: ${newPluginAddress}`);
    console.log(`   Beacon:            ${ARBITRUM_ADDRESSES.BEACON}`);
    console.log(`   Contract Size:     ${sizeBytes} bytes (${24576 - sizeBytes} under limit)`);
    console.log(`   EVC:               ${evcAddress}`);
    console.log(`   EulerRegistry:     ${eulerRegistryAddress}`);

    console.log("\n🆕 What Changed (EVC Batch Refactor):");
    console.log("   • deposit() → evc.batch([enableCollateral, deposit])");
    console.log("   • borrow() → evc.batch([enableController, borrow])");
    console.log("   • closePosition() → evc.batch([repay, disableCtrl, redeem, disableCol])");
    console.log("   • Flash loan open → evc.batch([enableCol, deposit, enableCtrl, borrow])");
    console.log("   • Flash loan close → evc.batch([repay, redeem, disableCtrl, disableCol])");
    console.log("   • Fixed critical disableController interface bug");
    console.log("   • Bytecode reduced from 24,530 to ~22,538 bytes");

    console.log("\n🎯 Post-Upgrade Checklist:");
    console.log("   [ ] Verify EulerRegistry ownership transferred to new plugin");
    console.log("   [ ] Verify FlashLoanService authorization (via Beacon)");
    console.log("   [ ] Test deposit with small amount (0.001 WETH)");
    console.log("   [ ] Test withdraw");
    console.log("   [ ] Test borrow + repay cycle");
    console.log("   [ ] Test closePosition");
    console.log("   [ ] Test openLeverageAtomic + closeLeverageAtomic");
    console.log("   [ ] Monitor for 24h before deploying larger amounts");

    console.log("\n💡 Post-Upgrade Commands:");
    console.log("   npx hardhat run scripts/deployment/euler/configure-euler-system.ts --network arbitrum");
    console.log("   npx hardhat run scripts/testing/check-position.ts --network arbitrum");
    console.log("=".repeat(70) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Upgrade failed:");
        console.error(error);
        process.exit(1);
    });
