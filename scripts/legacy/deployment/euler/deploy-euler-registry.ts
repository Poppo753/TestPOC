/**
 * @file deploy-euler-registry.ts
 * @description Deploy EulerRegistry contract + configure vaults
 * 
 * EulerRegistry è il registry centralizzato che mappa token symbols
 * agli indirizzi dei vault Euler V2 corrispondenti.
 * 
 * ORDINE DEPLOYMENT:
 * 1. ✅ EulerRegistry (QUESTO SCRIPT - first!)
 * 2. EulerLensAdapter
 * 3. FlashLoanService
 * 4. EulerV2Plugin
 * 5. Configure system
 * 
 * USAGE:
 *   npx hardhat run scripts/deployment/euler/deploy-euler-registry.ts --network arbitrum
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES, EULER_VAULTS } from "../../config/arbitrum.config";
import { saveDeployment, verifyArbitrumMainnet, checkSignerBalance } from "../../utils/plugins/euler/euler-helpers";

async function main() {
    console.log("\n" + "=".repeat(70));
    console.log("🚀 DEPLOY EULER REGISTRY");
    console.log("=".repeat(70) + "\n");

    // ==================== VALIDATION ====================
    console.log("📋 Pre-Deployment Validation:");
    
    await verifyArbitrumMainnet();
    await checkSignerBalance("0.000001");
    
    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();
    
    console.log(`\n📍 Deployer: ${deployerAddress}`);
    console.log(`   Beacon: ${ARBITRUM_ADDRESSES.BEACON}`);
    console.log(`   WETH Vault: ${EULER_VAULTS.WETH}`);
    console.log(`   USDC Vault: ${EULER_VAULTS.USDC}`);

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

    // ==================== DEPLOY REGISTRY ====================
    console.log("\n🚀 Deploying EulerRegistry...");
    
    const EulerRegistry = await ethers.getContractFactory("EulerRegistry", deployer);
    const eulerRegistry = await EulerRegistry.deploy();
    await eulerRegistry.waitForDeployment();
    
    const registryAddress = await eulerRegistry.getAddress();
    console.log(`   ✅ EulerRegistry deployed: ${registryAddress}`);
    
    // ==================== CONFIGURE VAULTS ====================
    console.log("\n⚙️  Configuring vaults in registry...");
    
    // Set WETH vault
    const tx1 = await eulerRegistry.setVault("WETH", EULER_VAULTS.WETH);
    await tx1.wait();
    console.log(`   ✅ WETH vault: ${EULER_VAULTS.WETH}`);
    
    // Set USDC vault
    const tx2 = await eulerRegistry.setVault("USDC", EULER_VAULTS.USDC);
    await tx2.wait();
    console.log(`   ✅ USDC vault: ${EULER_VAULTS.USDC}`);
    
    // ==================== VERIFY CONFIGURATION ====================
    console.log("\n🔍 Verifying configuration...");
    
    const wethVault = await eulerRegistry.getVault("WETH");
    const usdcVault = await eulerRegistry.getVault("USDC");
    
    if (wethVault !== EULER_VAULTS.WETH) {
        throw new Error(`❌ WETH vault mismatch! Expected ${EULER_VAULTS.WETH}, got ${wethVault}`);
    }
    if (usdcVault !== EULER_VAULTS.USDC) {
        throw new Error(`❌ USDC vault mismatch! Expected ${EULER_VAULTS.USDC}, got ${usdcVault}`);
    }
    
    console.log("   ✅ All vaults configured correctly");

    // ==================== REGISTER IN BEACON ====================
    console.log("\n📝 Registering in Beacon...");
    
    if (beaconOwner.toLowerCase() === deployerAddress.toLowerCase()) {
        const tx3 = await beacon.updateImplementation("EulerRegistry", registryAddress);
        await tx3.wait();
        console.log("   ✅ Registered in Beacon as 'EulerRegistry'");
        
        // Verify
        const registered = await beacon.getImplementation("EulerRegistry");
        if (registered !== registryAddress) {
            throw new Error(`❌ Registration failed! Expected ${registryAddress}, got ${registered}`);
        }
    } else {
        console.log("   ⚠️  MANUAL ACTION REQUIRED:");
        console.log(`   Call beacon.updateImplementation("EulerRegistry", "${registryAddress}")`);
        console.log(`   From Beacon owner: ${beaconOwner}`);
    }

    // ==================== TRANSFER OWNERSHIP TO PLUGIN ====================
    console.log("\n🔑 Transferring ownership to EulerV2Plugin...");
    
    try {
        const pluginAddress = await beacon.getImplementation("EulerV2Plugin");
        console.log(`   Plugin: ${pluginAddress}`);
        
        const transferTx = await eulerRegistry.transferOwnership(pluginAddress);
        await transferTx.wait();
        
        const newOwner = await eulerRegistry.owner();
        if (newOwner.toLowerCase() === pluginAddress.toLowerCase()) {
            console.log(`   ✅ Ownership transferred to plugin`);
        } else {
            console.log(`   ⚠️  Ownership is ${newOwner}, expected ${pluginAddress}`);
        }
    } catch (e: any) {
        console.log(`   ⚠️  Could not transfer ownership: ${e.message?.substring(0, 100)}`);
        console.log(`   Transfer ownership manually after EulerV2Plugin is deployed`);
    }

    // ==================== SAVE DEPLOYMENT ====================
    await saveDeployment(
        "EulerRegistry",
        registryAddress,
        deployerAddress,
        {
            vaults: {
                WETH: EULER_VAULTS.WETH,
                USDC: EULER_VAULTS.USDC
            },
            beacon: ARBITRUM_ADDRESSES.BEACON
        }
    );

    // ==================== SUMMARY ====================
    console.log("\n" + "=".repeat(70));
    console.log("✅ DEPLOYMENT COMPLETE!");
    console.log("=".repeat(70));
    console.log(`\nEulerRegistry: ${registryAddress}`);
    console.log(`Deployer: ${deployerAddress}`);
    console.log(`Beacon: ${ARBITRUM_ADDRESSES.BEACON}`);
    console.log("\n📋 Configured Vaults:");
    console.log(`   WETH: ${EULER_VAULTS.WETH}`);
    console.log(`   USDC: ${EULER_VAULTS.USDC}`);
    console.log("\n🎯 Next Steps:");
    console.log("   1. Deploy EulerLensAdapter");
    console.log("   2. Deploy FlashLoanService");
    console.log("   3. Deploy EulerV2Plugin");
    console.log("   4. Run configure-euler-system.ts");
    console.log("=".repeat(70) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed:");
        console.error(error);
        process.exit(1);
    });
