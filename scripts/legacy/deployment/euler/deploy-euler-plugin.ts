/**
 * @file deploy-euler-plugin.ts
 * @description Deploy EulerV2Plugin contract
 * 
 * EulerV2Plugin è il main plugin per interazioni con Euler V2 protocol:
 * - Deposit/Withdraw (auto-enable collateral)
 * - Borrow/Repay (auto-enable controller)
 * - Leverage atomic (via FlashLoanService)
 * 
 * ORDINE DEPLOYMENT:
 * 1. EulerRegistry
 * 2. EulerLensAdapter
 * 3. FlashLoanService
 * 4. ✅ EulerV2Plugin (QUESTO SCRIPT)
 * 5. Configure system
 * 
 * PREREQUISITI:
 * - EulerRegistry DEVE essere deployato e registrato in Beacon
 * 
 * USAGE:
 *   npx hardhat run scripts/deployment/euler/deploy-euler-plugin.ts --network arbitrum
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../../config/arbitrum.config";
import { saveDeployment, verifyArbitrumMainnet, checkSignerBalance, loadDeployment } from "../../utils/plugins/euler/euler-helpers";

// Base Asset Configuration
const BASE_ASSET_CODE = "USDC";

async function main() {
    console.log("\n" + "=".repeat(70));
    console.log("🚀 DEPLOY EULER V2 PLUGIN");
    console.log("=".repeat(70) + "\n");

    // ==================== VALIDATION ====================
    console.log("📋 Pre-Deployment Validation:");
    
    await verifyArbitrumMainnet();
    await checkSignerBalance("0.000001");
    
    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();
    
    console.log(`\n📍 Deployer: ${deployerAddress}`);
    console.log(`   Beacon: ${ARBITRUM_ADDRESSES.BEACON}`);

    // ==================== GET BEACON ====================
    console.log("\n📦 Getting Beacon contract...");
    
    const beacon = await ethers.getContractAt(
        [
            "function updateImplementation(string memory moduleName, address newImplementation) external",
            "function getImplementation(string memory name) view returns (address)",
            "function owner() view returns (address)"
        ],
        ARBITRUM_ADDRESSES.BEACON,
        deployer
    );
    
    const beaconOwner = await beacon.owner();
    console.log(`   Beacon owner: ${beaconOwner}`);
    
    if (beaconOwner.toLowerCase() !== deployerAddress.toLowerCase()) {
        console.log(`   ⚠️  WARNING: You are not the Beacon owner!`);
        console.log(`   Registration will require owner signature or multi-sig`);
    }

    // ==================== VERIFY PREREQUISITES ====================
    console.log("\n🔍 Verifying prerequisites...");
    
    let eulerRegistryAddress: string;
    try {
        eulerRegistryAddress = await beacon.getImplementation("EulerRegistry");
        console.log(`   ✅ EulerRegistry found: ${eulerRegistryAddress}`);
    } catch {
        throw new Error("❌ EulerRegistry not found in Beacon! Deploy it first.");
    }
    
    // Optional: check if FlashLoanService exists
    try {
        const flashLoanServiceAddress = await beacon.getImplementation("FlashLoanService");
        console.log(`   ✅ FlashLoanService found: ${flashLoanServiceAddress}`);
    } catch {
        console.log("   ⚠️  FlashLoanService not found (leverage will not work without it)");
    }

    // ==================== DEPLOY PLUGIN ====================
    console.log("\n🚀 Deploying EulerV2Plugin...");
    
    const EulerV2Plugin = await ethers.getContractFactory("EulerV2Plugin", deployer);
    const eulerPlugin = await EulerV2Plugin.deploy(ARBITRUM_ADDRESSES.BEACON, BASE_ASSET_CODE, ARBITRUM_ADDRESSES.EVC, ARBITRUM_ADDRESSES.ACCOUNT_LENS);
    await eulerPlugin.waitForDeployment();
    
    const pluginAddress = await eulerPlugin.getAddress();
    console.log(`   ✅ EulerV2Plugin deployed: ${pluginAddress}`);
    
    // Get deployed bytecode size
    const code = await ethers.provider.getCode(pluginAddress);
    const size = (code.length - 2) / 2; // Remove 0x and divide by 2
    console.log(`   Contract size: ${size} bytes (limit: 24576)`);
    
    if (size > 24576) {
        console.log(`   ⚠️  WARNING: Contract exceeds size limit!`);
    }
    
    // ==================== VERIFY CONFIGURATION ====================
    console.log("\n🔍 Verifying configuration...");
    
    const evcAddress = await eulerPlugin.EVC_ADDRESS();
    console.log(`   EVC: ${evcAddress}`);
    
    if (evcAddress !== ARBITRUM_ADDRESSES.EVC) {
        throw new Error(`❌ EVC address mismatch! Expected ${ARBITRUM_ADDRESSES.EVC}, got ${evcAddress}`);
    }
    console.log("   ✅ EVC address correct");
    
    // Verify beacon reference
    const pluginBeacon = await eulerPlugin.beacon();
    if (pluginBeacon !== ARBITRUM_ADDRESSES.BEACON) {
        throw new Error(`❌ Beacon mismatch! Expected ${ARBITRUM_ADDRESSES.BEACON}, got ${pluginBeacon}`);
    }
    console.log(`   ✅ Beacon reference correct: ${pluginBeacon}`);
    
    // Verify can lookup EulerRegistry
    const registryFromPlugin = await beacon.getImplementation("EulerRegistry");
    console.log(`   ✅ Can access EulerRegistry: ${registryFromPlugin}`);

    // ==================== REGISTER IN BEACON ====================
    console.log("\n📝 Registering in Beacon...");
    
    if (beaconOwner.toLowerCase() === deployerAddress.toLowerCase()) {
        const tx = await beacon.updateImplementation("EulerV2Plugin", pluginAddress);
        await tx.wait();
        console.log("   ✅ Registered in Beacon as 'EulerV2Plugin'");
        
        // Verify
        const registered = await beacon.getImplementation("EulerV2Plugin");
        if (registered !== pluginAddress) {
            throw new Error(`❌ Registration failed! Expected ${pluginAddress}, got ${registered}`);
        }
    } else {
        console.log("   ⚠️  MANUAL ACTION REQUIRED:");
        console.log(`   Call beacon.updateImplementation("EulerV2Plugin", "${pluginAddress}")`);
        console.log(`   From Beacon owner: ${beaconOwner}`);
    }

    // ==================== SAVE DEPLOYMENT ====================
    await saveDeployment(
        "EulerV2Plugin",
        pluginAddress,
        deployerAddress,
        {
            beacon: ARBITRUM_ADDRESSES.BEACON,
            evc: evcAddress,
            size: size,
            dependencies: {
                eulerRegistry: eulerRegistryAddress
            }
        }
    );

    // ==================== SUMMARY ====================
    console.log("\n" + "=".repeat(70));
    console.log("✅ DEPLOYMENT COMPLETE!");
    console.log("=".repeat(70));
    console.log(`\nEulerV2Plugin: ${pluginAddress}`);
    console.log(`Deployer: ${deployerAddress}`);
    console.log(`Beacon: ${ARBITRUM_ADDRESSES.BEACON}`);
    console.log(`Contract Size: ${size} bytes`);
    console.log("\n📋 Configuration:");
    console.log(`   EVC: ${evcAddress}`);
    console.log(`   EulerRegistry: ${eulerRegistryAddress}`);
    console.log("\n💡 Features:");
    console.log("   • Deposit/Withdraw (auto-enable collateral)");
    console.log("   • Borrow/Repay (auto-enable controller)");
    console.log("   • Atomic leverage (via FlashLoanService)");
    console.log("   • Position queries (via EulerLensAdapter)");
    console.log("\n🎯 Next Steps:");
    console.log("   1. Run configure-euler-system.ts (transfer ownership, verify)");
    console.log("   2. Test basic operations (deposit/withdraw/borrow/repay)");
    console.log("   3. Test leverage operations");
    console.log("=".repeat(70) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed:");
        console.error(error);
        process.exit(1);
    });
