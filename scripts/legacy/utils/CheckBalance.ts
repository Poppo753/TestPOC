/**
 * 💰 CHECK BALANCE UTILITY
 * 
 * Quick script to check deployer wallet balance before deployment
 */

import { ethers } from "hardhat";

async function main() {
    console.log("\n" + "=".repeat(60));
    console.log("💰 WALLET BALANCE CHECK");
    console.log("=".repeat(60) + "\n");

    const [deployer] = await ethers.getSigners();
    
    console.log(`Wallet Address: ${deployer.address}\n`);

    // Get balance
    const balance = await deployer.provider.getBalance(deployer.address);
    const balanceEth = ethers.formatEther(balance);
    
    console.log(`Balance: ${balanceEth} ETH`);
    
    // Get network info
    const network = await deployer.provider.getNetwork();
    console.log(`Network: ${network.name} (chainId: ${network.chainId})\n`);

    // Check if sufficient for deployment
    const MIN_BALANCE_REQUIRED = ethers.parseEther("0.5");
    
    if (balance >= MIN_BALANCE_REQUIRED) {
        console.log("✅ Balance sufficient for deployment");
        console.log(`   (Required: 0.5 ETH, Available: ${balanceEth} ETH)\n`);
    } else {
        console.log("❌ Insufficient balance for deployment!");
        console.log(`   Required: 0.5 ETH`);
        console.log(`   Available: ${balanceEth} ETH`);
        console.log(`   Needed: ${ethers.formatEther(MIN_BALANCE_REQUIRED - balance)} ETH more\n`);
        
        // Provide bridge/faucet links
        if (network.chainId === 421614n) {
            console.log("💧 Get testnet ETH from:");
            console.log("   https://faucet.quicknode.com/arbitrum/sepolia");
        } else if (network.chainId === 42161n) {
            console.log("🌉 Bridge ETH to Arbitrum:");
            console.log("   https://bridge.arbitrum.io/");
        }
        console.log();
    }

    // Estimate deployment costs
    console.log("=".repeat(60));
    console.log("💸 ESTIMATED DEPLOYMENT COSTS (Arbitrum)");
    console.log("=".repeat(60) + "\n");
    
    const gasPrice = await deployer.provider.getFeeData();
    console.log(`Current Gas Price: ${ethers.formatUnits(gasPrice.gasPrice || 0n, "gwei")} Gwei`);
    
    // Rough estimates for Arbitrum
    const estimatedCosts = {
        "Beacon": 0.001,
        "ChainlinkAdapter": 0.003,
        "TokenManager": 0.005,
        "SwapManager": 0.004,
        "ValueCalculator": 0.003,
        "ParameterManager": 0.002,
        "EmergencyHandler": 0.002,
        "LiquidityManager": 0.004,
        "Price Feed Config (9 tokens)": 0.009,
        "Register Implementations": 0.006,
        "Add Tokens (4)": 0.004,
        "Buffer (safety)": 0.007
    };
    
    let total = 0;
    console.log("\nEstimated costs per step:");
    for (const [step, cost] of Object.entries(estimatedCosts)) {
        console.log(`   ${step.padEnd(35)} ~${cost.toFixed(3)} ETH`);
        total += cost;
    }
    
    console.log(`   ${"".padEnd(35, "-")}`);
    console.log(`   ${"TOTAL ESTIMATED".padEnd(35)} ~${total.toFixed(3)} ETH`);
    console.log(`   ${"+ ~10% for gas fluctuations".padEnd(35)} ~${(total * 1.1).toFixed(3)} ETH\n`);
    
    if (balance >= ethers.parseEther(total.toString())) {
        console.log(`✅ Balance covers estimated costs with ${(parseFloat(balanceEth) - total).toFixed(3)} ETH remaining\n`);
    } else {
        console.log(`⚠️ Balance may not cover full deployment. Recommended: ${(total * 1.2).toFixed(3)} ETH\n`);
    }

    console.log("=".repeat(60) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
