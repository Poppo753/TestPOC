/**
 * Initialize EulerRegistry with vault mappings
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../config/arbitrum.config";

const EULER_REGISTRY = "0xa2bE49a4b89F7e7131f8e72015E8a6CD20201BC6";

async function main() {
    console.log("\n🔧 Initializing EulerRegistry...\n");
    
    const registry = await ethers.getContractAt("EulerRegistry", EULER_REGISTRY);
    
    // Register WETH vault
    console.log("1. Registering WETH vault...");
    let tx = await registry.setVault("WETH", ARBITRUM_ADDRESSES.WETH_VAULT);
    await tx.wait();
    console.log(`   ✅ WETH: ${ARBITRUM_ADDRESSES.WETH_VAULT}\n`);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Register USDC vault
    console.log("2. Registering USDC vault...");
    tx = await registry.setVault("USDC", ARBITRUM_ADDRESSES.USDC_VAULT);
    await tx.wait();
    console.log(`   ✅ USDC: ${ARBITRUM_ADDRESSES.USDC_VAULT}\n`);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify
    console.log("✅ Verification:");
    const wethVault = await registry.getVault("WETH");
    const usdcVault = await registry.getVault("USDC");
    
    console.log(`   WETH vault: ${wethVault}`);
    console.log(`   USDC vault: ${usdcVault}\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
