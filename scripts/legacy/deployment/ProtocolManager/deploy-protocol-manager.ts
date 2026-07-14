/**
 * @file deploy-protocol-manager.ts
 * @description Deploy ProtocolManager contract + register in Beacon
 * 
 * ProtocolManager è il manager unificato per protocolli non-swap (lending, yield).
 * Coordina operazioni comuni (deposit, withdraw, borrow, repay) e protocol-specific calls.
 * 
 * ARCHITETTURA:
 * - ProtocolManager usa registry interno per mappare protocol names → (plugin, lensAdapter, registry)
 * - Integrato con refactoring Phases 9-11: usa ILensAdapter per view functions
 * - Supporta whitelist dinamica per executeProtocolCall()
 * 
 * DEPLOYMENT FLOW:
 * 1. Deploy ProtocolManager(beacon)
 * 2. Register "ProtocolManager" in Beacon
 * 3. Transfer ownership (optional - per multi-sig)
 * 
 * USAGE:
 *   npx hardhat run scripts/deployment/ProtocolManager/deploy-protocol-manager.ts --network arbitrum
 * 
 * @version 1.0.0 (Post-Refactoring Phases 9-11)
 */

import { ethers } from "hardhat";

// Arbitrum Mainnet addresses (from deployments/mainnet-latest.json)
const ARBITRUM_ADDRESSES = {
    BEACON: "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870",
    PROXY_GENERAL: "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1"
};

interface DeploymentInfo {
    timestamp: string;
    network: string;
    chainId: number;
    deployer: string;
    protocolManager: string;
    beacon: string;
    bytecodeSize: number;
    gasUsed: string;
    registeredInBeacon: boolean;
}

async function main() {
    console.log("\n" + "=".repeat(80));
    console.log("🚀 DEPLOY PROTOCOL MANAGER");
    console.log("=".repeat(80) + "\n");

    // ==================== VALIDATION ====================
    console.log("📋 Pre-Deployment Validation:");
    
    const [deployer] = await ethers.getSigners();
    const network = await deployer.provider.getNetwork();
    const deployerAddress = await deployer.getAddress();
    
    console.log(`   Deployer: ${deployerAddress}`);
    
    const balance = await deployer.provider.getBalance(deployerAddress);
    console.log(`   Balance: ${ethers.formatEther(balance)} ETH`);
    
    if (balance < ethers.parseEther("0.000001")) {
        throw new Error("❌ Insufficient balance! Need at least 0.000001 ETH for deployment");
    }
    
    console.log(`   Network: ${network.name} (chainId: ${network.chainId})`);
    
    if (network.chainId !== 42161n) {
        throw new Error("❌ Wrong network! Expected Arbitrum Mainnet (chainId: 42161)");
    }
    
    console.log("   ✅ Validation passed");

    // ==================== GET BEACON ====================
    console.log("\n📦 Connecting to Beacon...");
    console.log(`   Beacon address: ${ARBITRUM_ADDRESSES.BEACON}`);
    
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
    
    // Check if ProtocolManager already exists
    try {
        const existingPM = await beacon.getImplementation("ProtocolManager");
        if (existingPM !== ethers.ZeroAddress) {
            console.log(`   ⚠️  ProtocolManager already registered: ${existingPM}`);
            console.log(`   This deployment will UPDATE the implementation in Beacon`);
        } else {
            console.log(`   ✅ No existing ProtocolManager found (clean deployment)`);
        }
    } catch (error) {
        // ProtocolManager not registered yet - this is expected for first deployment
        console.log(`   ✅ No existing ProtocolManager found (clean deployment)`);
    }

    // ==================== DEPLOY PROTOCOL MANAGER ====================
    console.log("\n🚀 Deploying ProtocolManager...");
    
    const ProtocolManager = await ethers.getContractFactory("ProtocolManager", deployer);
    const protocolManager = await ProtocolManager.deploy(ARBITRUM_ADDRESSES.BEACON);
    await protocolManager.waitForDeployment();
    
    const pmAddress = await protocolManager.getAddress();
    console.log(`   ✅ ProtocolManager deployed: ${pmAddress}`);
    
    // Get deployment receipt for gas info
    const deployTx = protocolManager.deploymentTransaction();
    if (!deployTx) {
        throw new Error("❌ Deployment transaction not found");
    }
    const receipt = await deployTx.wait();
    if (!receipt) {
        throw new Error("❌ Deployment receipt not found");
    }
    
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`   Block: ${receipt.blockNumber}`);

    // ==================== VERIFY BYTECODE SIZE ====================
    console.log("\n📏 Checking bytecode size...");
    
    const code = await deployer.provider.getCode(pmAddress);
    const bytecodeSize = (code.length - 2) / 2; // Remove '0x' and divide by 2
    
    console.log(`   Bytecode size: ${bytecodeSize} bytes`);
    
    if (bytecodeSize > 24576) {
        console.log(`   ⚠️  WARNING: Contract exceeds 24KB limit! (${bytecodeSize} > 24576)`);
    } else {
        const percentage = ((bytecodeSize / 24576) * 100).toFixed(2);
        console.log(`   ✅ Within 24KB limit (${percentage}% used)`);
    }

    // ==================== VERIFY DEPLOYMENT ====================
    console.log("\n🔍 Verifying deployment...");
    
    // Check beacon address
    const storedBeacon = await protocolManager.beacon();
    console.log(`   Beacon address: ${storedBeacon}`);
    
    if (storedBeacon !== ARBITRUM_ADDRESSES.BEACON) {
        throw new Error(`❌ Beacon mismatch! Expected ${ARBITRUM_ADDRESSES.BEACON}, got ${storedBeacon}`);
    }
    
    // Check owner
    const owner = await protocolManager.owner();
    console.log(`   Owner: ${owner}`);
    
    if (owner !== deployerAddress) {
        throw new Error(`❌ Owner mismatch! Expected ${deployerAddress}, got ${owner}`);
    }
    
    console.log("   ✅ Deployment verified");

    // ==================== REGISTER IN BEACON ====================
    console.log("\n📝 Registering ProtocolManager in Beacon...");
    
    if (beaconOwner.toLowerCase() === deployerAddress.toLowerCase()) {
        const registerTx = await beacon.updateImplementation("ProtocolManager", pmAddress);
        await registerTx.wait();
        console.log("   ✅ Registered in Beacon as 'ProtocolManager'");
        
        // Verify registration
        const registered = await beacon.getImplementation("ProtocolManager");
        if (registered !== pmAddress) {
            throw new Error(`❌ Registration failed! Expected ${pmAddress}, got ${registered}`);
        }
        console.log("   ✅ Registration verified");
    } else {
        console.log("   ⚠️  SKIPPED: You are not the Beacon owner");
        console.log("   Manual registration required:");
        console.log(`   beacon.updateImplementation("ProtocolManager", "${pmAddress}")`);
    }

    // ==================== SAVE DEPLOYMENT ====================
    console.log("\n💾 Saving deployment info...");
    
    const deploymentInfo: DeploymentInfo = {
        timestamp: new Date().toISOString(),
        network: "arbitrum-mainnet",
        chainId: Number(network.chainId),
        deployer: deployerAddress,
        protocolManager: pmAddress,
        beacon: ARBITRUM_ADDRESSES.BEACON,
        bytecodeSize: bytecodeSize,
        gasUsed: receipt.gasUsed.toString(),
        registeredInBeacon: beaconOwner.toLowerCase() === deployerAddress.toLowerCase()
    };
    
    const fs = require("fs");
    const path = require("path");
    
    const deploymentsDir = path.join(__dirname, "../../../deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    const filename = path.join(deploymentsDir, "protocol-manager-deployment.json");
    fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
    
    console.log(`   ✅ Saved to: ${filename}`);

    // ==================== SUMMARY ====================
    console.log("\n" + "=".repeat(80));
    console.log("✅ DEPLOYMENT COMPLETE");
    console.log("=".repeat(80));
    console.log(`\n📋 Summary:`);
    console.log(`   ProtocolManager: ${pmAddress}`);
    console.log(`   Beacon: ${ARBITRUM_ADDRESSES.BEACON}`);
    console.log(`   Bytecode: ${bytecodeSize} bytes (${((bytecodeSize / 24576) * 100).toFixed(2)}%)`);
    console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`   Registered: ${beaconOwner.toLowerCase() === deployerAddress.toLowerCase() ? '✅ YES' : '⚠️  MANUAL REQUIRED'}`);
    
    console.log(`\n📝 Next Steps:`);
    console.log(`   1. Register protocols via registerProtocol(name, plugin, lensAdapter, registry)`);
    console.log(`   2. Example for Euler V2:`);
    console.log(`      protocolManager.registerProtocol(`);
    console.log(`        "Euler",`);
    console.log(`        eulerPluginAddress,`);
    console.log(`        eulerLensAddress,`);
    console.log(`        eulerRegistryAddress`);
    console.log(`      )`);
    console.log(`   3. Test with getAllProtocolSummaries(), getProtocolInfo("Euler")`);
    
    console.log(`\n🔗 Verify on Arbiscan:`);
    console.log(`   https://arbiscan.io/address/${pmAddress}#code`);
    console.log("\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed:");
        console.error(error);
        process.exit(1);
    });
