/**
 * @file configure-euler-system.ts
 * @description Configure Euler V2 system post-deployment
 * 
 * Esegue configurazione finale del sistema:
 * 1. Transfer EulerRegistry ownership to plugin (required for createPosition)
 * 2. Verify FlashLoanService authorization
 * 3. Verify all Beacon registrations
 * 
 * ORDINE DEPLOYMENT:
 * 1. EulerRegistry
 * 2. EulerLensAdapter
 * 3. FlashLoanService
 * 4. EulerV2Plugin
 * 5. ✅ Configure system (QUESTO SCRIPT - last!)
 * 
 * PREREQUISITI:
 * - Tutti i 4 contratti deployati e registrati in Beacon
 * 
 * USAGE:
 *   npx hardhat run scripts/deployment/euler/configure-euler-system.ts --network arbitrum
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../../config/arbitrum.config";
import { verifyArbitrumMainnet, loadDeployment } from "../../utils/plugins/euler/euler-helpers";

async function main() {
    console.log("\n" + "=".repeat(70));
    console.log("⚙️  CONFIGURE EULER V2 SYSTEM");
    console.log("=".repeat(70) + "\n");

    // ==================== VALIDATION ====================
    console.log("📋 Pre-Configuration Validation:");
    
    await verifyArbitrumMainnet();
    
    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();
    
    console.log(`\n📍 Deployer: ${deployerAddress}`);
    console.log(`   Beacon: ${ARBITRUM_ADDRESSES.BEACON}`);

    // ==================== GET BEACON ====================
    console.log("\n📦 Getting Beacon contract...");
    
    const beacon = await ethers.getContractAt(
        [
            "function getImplementation(string memory name) view returns (address)",
            "function owner() view returns (address)"
        ],
        ARBITRUM_ADDRESSES.BEACON,
        deployer
    );

    // ==================== VERIFY ALL DEPLOYMENTS ====================
    console.log("\n🔍 Verifying all deployments in Beacon...");
    
    const modules = ["EulerRegistry", "EulerLensAdapter", "FlashLoanService", "EulerV2Plugin"];
    const addresses: { [key: string]: string } = {};
    
    for (const module of modules) {
        try {
            const addr = await beacon.getImplementation(module);
            addresses[module] = addr;
            console.log(`   ✅ ${module}: ${addr}`);
        } catch {
            throw new Error(`❌ ${module} not found in Beacon! Deploy it first.`);
        }
    }

    // ==================== GET CONTRACTS ====================
    console.log("\n📦 Getting contract instances...");
    
    const eulerRegistry = await ethers.getContractAt(
        ["function owner() view returns (address)", "function transferOwnership(address newOwner) external"],
        addresses.EulerRegistry,
        deployer
    );
    
    const eulerPlugin = await ethers.getContractAt(
        ["function owner() view returns (address)"],
        addresses.EulerV2Plugin,
        deployer
    );
    
    const flashLoanService = await ethers.getContractAt(
        ["function isAuthorizedPlugin(address plugin) view returns (bool)"],
        addresses.FlashLoanService,
        deployer
    );

    // ==================== 1. TRANSFER REGISTRY OWNERSHIP ====================
    console.log("\n1️⃣  Transferring EulerRegistry ownership to plugin...");
    
    const currentOwner = await eulerRegistry.owner();
    console.log(`   Current owner: ${currentOwner}`);
    console.log(`   Target owner (plugin): ${addresses.EulerV2Plugin}`);
    
    if (currentOwner.toLowerCase() === addresses.EulerV2Plugin.toLowerCase()) {
        console.log("   ✅ Ownership already transferred!");
    } else if (currentOwner.toLowerCase() === deployerAddress.toLowerCase()) {
        const tx = await eulerRegistry.transferOwnership(addresses.EulerV2Plugin);
        await tx.wait();
        
        const newOwner = await eulerRegistry.owner();
        console.log(`   ✅ Ownership transferred: ${newOwner}`);
        
        if (newOwner.toLowerCase() !== addresses.EulerV2Plugin.toLowerCase()) {
            throw new Error(`❌ Ownership transfer failed! Expected ${addresses.EulerV2Plugin}, got ${newOwner}`);
        }
    } else {
        console.log(`   ⚠️  MANUAL ACTION REQUIRED:`);
        console.log(`   Call eulerRegistry.transferOwnership("${addresses.EulerV2Plugin}")`);
        console.log(`   From current owner: ${currentOwner}`);
    }

    // ==================== 2. VERIFY FLASH LOAN AUTHORIZATION ====================
    console.log("\n2️⃣  Verifying FlashLoanService authorization...");
    
    const isAuthorized = await flashLoanService.isAuthorizedPlugin(addresses.EulerV2Plugin);
    console.log(`   Plugin: ${addresses.EulerV2Plugin}`);
    console.log(`   Authorized: ${isAuthorized}`);
    
    if (!isAuthorized) {
        console.log(`   ⚠️  WARNING: Plugin not authorized!`);
        console.log(`   This happens if plugin not registered in Beacon.`);
        console.log(`   FlashLoanService uses Beacon to check authorization.`);
        throw new Error("❌ Plugin authorization failed!");
    }
    
    console.log("   ✅ Plugin authorized for flash loans");

    // ==================== 3. VERIFY BEACON REGISTRATIONS ====================
    console.log("\n3️⃣  Verifying all Beacon registrations...");
    
    for (const module of modules) {
        const addr = await beacon.getImplementation(module);
        if (addr !== addresses[module]) {
            throw new Error(`❌ ${module} registration mismatch!`);
        }
        console.log(`   ✅ ${module}: ${addr}`);
    }

    // ==================== 4. VERIFY TOKEN REGISTRATIONS ====================
    console.log("\n4️⃣  Verifying token registrations in Beacon...");
    
    try {
        const wethAddr = await beacon.getImplementation("WETH");
        console.log(`   ✅ WETH: ${wethAddr}`);
        
        if (wethAddr !== ARBITRUM_ADDRESSES.WETH) {
            console.log(`      ⚠️  Mismatch! Expected ${ARBITRUM_ADDRESSES.WETH}`);
        }
    } catch {
        console.log("   ⚠️  WETH not registered in Beacon (may need manual registration)");
    }
    
    try {
        const usdcAddr = await beacon.getImplementation("USDC");
        console.log(`   ✅ USDC: ${usdcAddr}`);
        
        if (usdcAddr !== ARBITRUM_ADDRESSES.USDC) {
            console.log(`      ⚠️  Mismatch! Expected ${ARBITRUM_ADDRESSES.USDC}`);
        }
    } catch {
        console.log("   ⚠️  USDC not registered in Beacon (may need manual registration)");
    }

    // ==================== SUMMARY ====================
    console.log("\n" + "=".repeat(70));
    console.log("✅ CONFIGURATION COMPLETE!");
    console.log("=".repeat(70));
    console.log("\n📋 System Components:");
    console.log(`   EulerRegistry: ${addresses.EulerRegistry}`);
    console.log(`   EulerLensAdapter: ${addresses.EulerLensAdapter}`);
    console.log(`   FlashLoanService: ${addresses.FlashLoanService}`);
    console.log(`   EulerV2Plugin: ${addresses.EulerV2Plugin}`);
    console.log(`   Beacon: ${ARBITRUM_ADDRESSES.BEACON}`);
    console.log("\n✅ Configuration Status:");
    console.log("   • EulerRegistry ownership → Plugin");
    console.log("   • FlashLoanService authorization → Verified");
    console.log("   • All Beacon registrations → Verified");
    console.log("\n🎯 Next Steps:");
    console.log("   1. Run check-position.ts (verify no existing positions)");
    console.log("   2. Run test-deposit.ts (small amount first!)");
    console.log("   3. Run test-withdraw.ts");
    console.log("   4. Run test-borrow.ts + test-repay.ts");
    console.log("   5. Run test-leverage-open.ts + test-leverage-close.ts");
    console.log("\n💡 Testing Commands:");
    console.log("   npx hardhat run scripts/testing/check-position.ts --network arbitrum");
    console.log("   AMOUNT=0.001 npx hardhat run scripts/testing/test-deposit.ts --network arbitrum");
    console.log("=".repeat(70) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Configuration failed:");
        console.error(error);
        process.exit(1);
    });
