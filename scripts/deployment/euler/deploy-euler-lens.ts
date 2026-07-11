/**
 * @file deploy-euler-lens.ts
 * @description Deploy EulerLensAdapter contract
 * 
 * EulerLensAdapter fornisce view functions per query stato posizioni Euler
 * senza gas cost (getLeverage, getHealth, etc.)
 * 
 * ORDINE DEPLOYMENT:
 * 1. EulerRegistry
 * 2. ✅ EulerLensAdapter (QUESTO SCRIPT)
 * 3. FlashLoanService
 * 4. EulerV2Plugin
 * 5. Configure system
 * 
 * USAGE:
 *   npx hardhat run scripts/deployment/euler/deploy-euler-lens.ts --network arbitrum
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../../config/arbitrum.config";
import { saveDeployment, verifyArbitrumMainnet, checkSignerBalance } from "../../utils/plugins/euler/euler-helpers";

// Base Asset Configuration
const BASE_ASSET_CODE = "USDC";

async function main() {
    console.log("\n" + "=".repeat(70));
    console.log("🚀 DEPLOY EULER LENS ADAPTER");
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

    // ==================== DEPLOY LENS ADAPTER ====================
    console.log("\n🚀 Deploying EulerLensAdapter...");
    
    const EulerLensAdapter = await ethers.getContractFactory("EulerLensAdapter", deployer);
    const lens = await EulerLensAdapter.deploy(
        ARBITRUM_ADDRESSES.BEACON,
        BASE_ASSET_CODE,
        ARBITRUM_ADDRESSES.ACCOUNT_LENS,
        ARBITRUM_ADDRESSES.VAULT_LENS,
        ARBITRUM_ADDRESSES.UTILS_LENS,
        ARBITRUM_ADDRESSES.EVC
    );
    await lens.waitForDeployment();
    
    const lensAddress = await lens.getAddress();
    console.log(`   ✅ EulerLensAdapter deployed: ${lensAddress}`);
    
    // ==================== VERIFY CONFIGURATION ====================
    console.log("\n🔍 Verifying configuration...");
    
    const evcAddress = await lens.EVC_ADDRESS();
    const accountLensAddress = await lens.ACCOUNT_LENS();
    
    console.log(`   EVC: ${evcAddress}`);
    console.log(`   AccountLens: ${accountLensAddress}`);
    
    // Verify addresses match expected
    if (evcAddress !== ARBITRUM_ADDRESSES.EVC) {
        console.log(`   ⚠️  WARNING: EVC address mismatch!`);
        console.log(`   Expected: ${ARBITRUM_ADDRESSES.EVC}`);
        console.log(`   Got: ${evcAddress}`);
    } else {
        console.log("   ✅ EVC address correct");
    }
    
    if (accountLensAddress !== ARBITRUM_ADDRESSES.ACCOUNT_LENS) {
        console.log(`   ⚠️  WARNING: AccountLens address mismatch!`);
        console.log(`   Expected: ${ARBITRUM_ADDRESSES.ACCOUNT_LENS}`);
        console.log(`   Got: ${accountLensAddress}`);
    } else {
        console.log("   ✅ AccountLens address correct");
    }

    // ==================== REGISTER IN BEACON ====================
    console.log("\n📝 Registering in Beacon...");
    
    if (beaconOwner.toLowerCase() === deployerAddress.toLowerCase()) {
        const tx = await beacon.updateImplementation("EulerLensAdapter", lensAddress);
        await tx.wait();
        console.log("   ✅ Registered in Beacon as 'EulerLensAdapter'");
        
        // Verify
        const registered = await beacon.getImplementation("EulerLensAdapter");
        if (registered !== lensAddress) {
            throw new Error(`❌ Registration failed! Expected ${lensAddress}, got ${registered}`);
        }
    } else {
        console.log("   ⚠️  MANUAL ACTION REQUIRED:");
        console.log(`   Call beacon.updateImplementation("EulerLensAdapter", "${lensAddress}")`);
        console.log(`   From Beacon owner: ${beaconOwner}`);
    }

    // ==================== SAVE DEPLOYMENT ====================
    await saveDeployment(
        "EulerLensAdapter",
        lensAddress,
        deployerAddress,
        {
            beacon: ARBITRUM_ADDRESSES.BEACON,
            evc: evcAddress,
            accountLens: accountLensAddress
        }
    );

    // ==================== SUMMARY ====================
    console.log("\n" + "=".repeat(70));
    console.log("✅ DEPLOYMENT COMPLETE!");
    console.log("=".repeat(70));
    console.log(`\nEulerLensAdapter: ${lensAddress}`);
    console.log(`Deployer: ${deployerAddress}`);
    console.log(`Beacon: ${ARBITRUM_ADDRESSES.BEACON}`);
    console.log("\n📋 Configuration:");
    console.log(`   EVC: ${evcAddress}`);
    console.log(`   AccountLens: ${accountLensAddress}`);
    console.log("\n🎯 Next Steps:");
    console.log("   1. Deploy FlashLoanService");
    console.log("   2. Deploy EulerV2Plugin");
    console.log("   3. Run configure-euler-system.ts");
    console.log("=".repeat(70) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed:");
        console.error(error);
        process.exit(1);
    });
