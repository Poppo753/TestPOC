/**
 * @file deploy-euler-plugin.ts
 * @description Deploy EulerV2Plugin su Arbitrum
 */

import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const BEACON = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";

// Base Asset Configuration
const BASE_ASSET_CODE = "USDC";

// Euler V2 addresses on Arbitrum
const EVC_ADDRESS          = "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066";
const ACCOUNT_LENS_ADDRESS = "0x90a52DDcb232e7bb003DD9258fA1235c553eC956";

async function main() {
    console.log("\n🚀 Deploying EulerV2Plugin to Arbitrum...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

    // Deploy EulerV2Plugin
    console.log("\n📦 Deploying EulerV2Plugin...");
    const EulerV2Plugin = await ethers.getContractFactory("EulerV2Plugin");
    const eulerPlugin = await EulerV2Plugin.deploy(BEACON, BASE_ASSET_CODE, EVC_ADDRESS, ACCOUNT_LENS_ADDRESS);
    await eulerPlugin.waitForDeployment();
    const pluginAddress = await eulerPlugin.getAddress();
    console.log("✅ EulerV2Plugin deployed to:", pluginAddress);

    // Verify deployment
    console.log("\n🔍 Verifying deployment...");
    const owner = await eulerPlugin.owner();
    const beaconAddr = await eulerPlugin.beacon();
    console.log("   Owner:", owner);
    console.log("   Beacon:", beaconAddr);

    // Register in Beacon (se siamo owner)
    console.log("\n📝 Registering in Beacon...");
    const beacon = await ethers.getContractAt(
        ["function setImplementation(string memory name, address impl) external",
         "function getImplementation(string memory name) view returns (address)",
         "function owner() view returns (address)"],
        BEACON
    );
    
    const beaconOwner = await beacon.owner();
    console.log("   Beacon owner:", beaconOwner);
    
    if (beaconOwner.toLowerCase() === deployer.address.toLowerCase()) {
        const tx = await beacon.setImplementation("EulerV2Plugin", pluginAddress);
        await tx.wait();
        console.log("   ✅ Registered as 'EulerV2Plugin' in Beacon");
    } else {
        console.log("   ⚠️  Not beacon owner, skip registration");
    }

    // Register in EulerVaultRegistry (if exists)
    try {
        const registryAddr = await beacon.getImplementation("EulerVaultRegistry");
        if (registryAddr !== ethers.ZeroAddress) {
            console.log("\n📝 Configuring EulerVaultRegistry...");
            const registry = await ethers.getContractAt(
                ["function setVault(string memory tokenCode, address vault) external",
                 "function owner() view returns (address)"],
                registryAddr
            );
            
            const registryOwner = await registry.owner();
            if (registryOwner.toLowerCase() === deployer.address.toLowerCase()) {
                // Add WETH and USDC vaults
                const WETH_VAULT = "0x78E3E051D32157AACD550fBB78458762d8f7edFF";
                const USDC_VAULT = "0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899";
                
                await (await registry.setVault("WETH", WETH_VAULT)).wait();
                console.log("   ✅ WETH vault registered");
                
                await (await registry.setVault("USDC", USDC_VAULT)).wait();
                console.log("   ✅ USDC vault registered");
            }
        }
    } catch (e) {
        console.log("   EulerVaultRegistry not found, skipping");
    }

    // Update deployment file
    const deploymentPath = path.join(__dirname, "..", "deployments", "mainnet-latest.json");
    if (fs.existsSync(deploymentPath)) {
        const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
        deployment.contracts.eulerV2Plugin = pluginAddress;
        deployment.timestamp = new Date().toISOString();
        fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
        console.log("\n📁 Updated deployment file");
    }

    console.log("\n✅ Deployment complete!");
    console.log("   EulerV2Plugin:", pluginAddress);
    console.log("\n📋 Next steps:");
    console.log("   1. Authorize plugin in ProxyGeneral");
    console.log("   2. Configure EulerVaultRegistry with vault addresses");
    console.log("   3. Test deposit/withdraw functionality");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
