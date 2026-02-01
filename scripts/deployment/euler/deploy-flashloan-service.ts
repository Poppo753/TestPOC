/**
 * @file deploy-flashloan-service.ts
 * @description Deploy FlashLoanService contract
 * 
 * FlashLoanService è il servizio centralizzato per flash loans Balancer V2 (0% fee!)
 * Gestisce flash loans + swap per operazioni leverage atomiche.
 * 
 * ORDINE DEPLOYMENT:
 * 1. EulerRegistry
 * 2. EulerLensAdapter
 * 3. ✅ FlashLoanService (QUESTO SCRIPT)
 * 4. EulerV2Plugin
 * 5. Configure system
 * 
 * USAGE:
 *   npx hardhat run scripts/deployment/euler/deploy-flashloan-service.ts --network arbitrum
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../../config/arbitrum.config";
import { saveDeployment, verifyArbitrumMainnet, checkSignerBalance } from "../../utils/euler-helpers";

async function main() {
    console.log("\n" + "=".repeat(70));
    console.log("🚀 DEPLOY FLASH LOAN SERVICE");
    console.log("=".repeat(70) + "\n");

    // ==================== VALIDATION ====================
    console.log("📋 Pre-Deployment Validation:");
    
    await verifyArbitrumMainnet();
    await checkSignerBalance("0.000001");
    
    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();
    
    console.log(`\n📍 Deployer: ${deployerAddress}`);
    console.log(`   Beacon: ${ARBITRUM_ADDRESSES.BEACON}`);
    console.log(`   Balancer Vault: ${ARBITRUM_ADDRESSES.BALANCER_VAULT} (0% fee!)`);
    console.log(`   SimpleSwap: ${ARBITRUM_ADDRESSES.SIMPLE_SWAP}`);

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

    // ==================== DEPLOY FLASH LOAN SERVICE ====================
    console.log("\n🚀 Deploying FlashLoanService...");
    
    const FlashLoanService = await ethers.getContractFactory("FlashLoanService", deployer);
    const flashLoanService = await FlashLoanService.deploy(ARBITRUM_ADDRESSES.BEACON);
    await flashLoanService.waitForDeployment();
    
    const serviceAddress = await flashLoanService.getAddress();
    console.log(`   ✅ FlashLoanService deployed: ${serviceAddress}`);
    
    // ==================== VERIFY CONFIGURATION ====================
    console.log("\n🔍 Verifying configuration...");
    
    const balancerVault = await flashLoanService.getBalancerVault();
    const simpleSwap = await flashLoanService.getSimpleSwap();
    
    console.log(`   Balancer Vault: ${balancerVault}`);
    console.log(`   SimpleSwap: ${simpleSwap}`);
    
    // Verify addresses match expected (hardcoded in contract)
    if (balancerVault !== ARBITRUM_ADDRESSES.BALANCER_VAULT) {
        throw new Error(`❌ Balancer Vault mismatch! Expected ${ARBITRUM_ADDRESSES.BALANCER_VAULT}, got ${balancerVault}`);
    }
    console.log("   ✅ Balancer Vault correct");
    
    if (simpleSwap !== ARBITRUM_ADDRESSES.SIMPLE_SWAP) {
        throw new Error(`❌ SimpleSwap mismatch! Expected ${ARBITRUM_ADDRESSES.SIMPLE_SWAP}, got ${simpleSwap}`);
    }
    console.log("   ✅ SimpleSwap correct");

    // ==================== REGISTER IN BEACON ====================
    console.log("\n📝 Registering in Beacon...");
    
    if (beaconOwner.toLowerCase() === deployerAddress.toLowerCase()) {
        const tx = await beacon.updateImplementation("FlashLoanService", serviceAddress);
        await tx.wait();
        console.log("   ✅ Registered in Beacon as 'FlashLoanService'");
        
        // Verify
        const registered = await beacon.getImplementation("FlashLoanService");
        if (registered !== serviceAddress) {
            throw new Error(`❌ Registration failed! Expected ${serviceAddress}, got ${registered}`);
        }
    } else {
        console.log("   ⚠️  MANUAL ACTION REQUIRED:");
        console.log(`   Call beacon.updateImplementation("FlashLoanService", "${serviceAddress}")`);
        console.log(`   From Beacon owner: ${beaconOwner}`);
    }

    // ==================== SAVE DEPLOYMENT ====================
    await saveDeployment(
        "FlashLoanService",
        serviceAddress,
        deployerAddress,
        {
            beacon: ARBITRUM_ADDRESSES.BEACON,
            balancerVault: balancerVault,
            simpleSwap: simpleSwap,
            features: {
                flashLoans: "Balancer V2 (0% fee)",
                swap: "SimpleSwap (Uniswap V3 wrapper)"
            }
        }
    );

    // ==================== SUMMARY ====================
    console.log("\n" + "=".repeat(70));
    console.log("✅ DEPLOYMENT COMPLETE!");
    console.log("=".repeat(70));
    console.log(`\nFlashLoanService: ${serviceAddress}`);
    console.log(`Deployer: ${deployerAddress}`);
    console.log(`Beacon: ${ARBITRUM_ADDRESSES.BEACON}`);
    console.log("\n📋 Configuration:");
    console.log(`   Balancer Vault: ${balancerVault} (0% flash loan fee!)`);
    console.log(`   SimpleSwap: ${simpleSwap}`);
    console.log("\n💡 Features:");
    console.log("   • Centralized flash loan service (1 deployment)");
    console.log("   • Reusable by multiple plugins (Beacon authorization)");
    console.log("   • Balancer V2 integration (0% fee)");
    console.log("   • Bidirectional swap support");
    console.log("\n🎯 Next Steps:");
    console.log("   1. Deploy EulerV2Plugin");
    console.log("   2. Run configure-euler-system.ts");
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
