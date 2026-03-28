/**
 * @title Pre-Deployment Check Script
 * @notice Verifies environment and setup before mainnet deployment
 */

import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    console.log("╔════════════════════════════════════════════════════════════════╗");
    console.log("║            Pre-Deployment Environment Check                    ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

    let checks = {
        passed: 0,
        failed: 0,
        warnings: 0
    };

    // Check 1: Environment variables
    console.log("📋 Check 1: Environment Variables");
    const requiredEnvVars = [
        { name: "ARBITRUM_RPC_URL", required: true },
        { name: "PRIVATE_KEY", required: true },
        { name: "ARBITRUM_ETHERSCAN_API_KEY", required: true }
    ];

    for (const envVar of requiredEnvVars) {
        if (process.env[envVar.name]) {
            console.log(`   ✅ ${envVar.name} is set`);
            checks.passed++;
        } else if (envVar.required) {
            console.log(`   ❌ ${envVar.name} is missing (required)`);
            checks.failed++;
        } else {
            console.log(`   ⚠️  ${envVar.name} is missing (optional)`);
            checks.warnings++;
        }
    }
    console.log();

    // Check 2: Deployer wallet
    console.log("👤 Check 2: Deployer Wallet");
    try {
        const [deployer] = await ethers.getSigners();
        console.log(`   ✅ Wallet address: ${deployer.address}`);
        
        const balance = await ethers.provider.getBalance(deployer.address);
        const balanceETH = ethers.formatEther(balance);
        console.log(`   💰 Balance: ${balanceETH} ETH`);
        
        if (balance >= ethers.parseEther("0.01")) {
            console.log(`   ✅ Sufficient balance for deployment`);
            checks.passed++;
        } else {
            console.log(`   ❌ Insufficient balance (need at least 0.01 ETH)`);
            checks.failed++;
        }
        checks.passed++;
    } catch (error: any) {
        console.log(`   ❌ Error accessing wallet:`, error.message);
        checks.failed++;
    }
    console.log();

    // Check 3: Network connection
    console.log("🌐 Check 3: Network Connection");
    try {
        const network = await ethers.provider.getNetwork();
        console.log(`   ✅ Connected to network: ${network.name} (chainId: ${network.chainId})`);
        
        if (Number(network.chainId) === 42161) {
            console.log(`   ✅ Correct network (Arbitrum One)`);
            checks.passed++;
        } else {
            console.log(`   ⚠️  Warning: Not Arbitrum One mainnet (chainId should be 42161)`);
            checks.warnings++;
        }
        
        const blockNumber = await ethers.provider.getBlockNumber();
        console.log(`   ✅ Current block: ${blockNumber}`);
        checks.passed++;
    } catch (error: any) {
        console.log(`   ❌ Network connection error:`, error.message);
        checks.failed++;
    }
    console.log();

    // Check 4: Contract compilation
    console.log("🔧 Check 4: Contract Compilation");
    try {
        const DolomitePluginFactory = await ethers.getContractFactory("DolomitePlugin");
        console.log(`   ✅ DolomitePlugin contract found`);
        
        // Check bytecode size
        const bytecode = DolomitePluginFactory.bytecode;
        const bytecodeSize = bytecode.length / 2 - 1; // Remove 0x and convert to bytes
        console.log(`   📦 Bytecode size: ${bytecodeSize} bytes`);
        
        if (bytecodeSize < 24576) {
            console.log(`   ✅ Within size limit (24576 bytes)`);
            checks.passed++;
        } else {
            console.log(`   ❌ Exceeds contract size limit!`);
            checks.failed++;
        }
        checks.passed++;
    } catch (error: any) {
        console.log(`   ❌ Compilation error:`, error.message);
        checks.failed++;
    }
    console.log();

    // Check 5: Dolomite contract addresses
    console.log("🔗 Check 5: Dolomite Contract Validation");
    const dolomiteAddresses = {
        DolomiteMargin: "0x6Bd780E7fDf01D77e4d475c821f1e7AE05409072",
        BorrowPositionRouter: "0xF579b345cdA0860668b857De10ABD62442133D0F",
        DepositWithdrawalRouter: "0xf8b2c637a68cf6a17b1df9f8992eebeff63d2dff"
    };

    for (const [name, address] of Object.entries(dolomiteAddresses)) {
        try {
            const code = await ethers.provider.getCode(address);
            if (code !== "0x") {
                console.log(`   ✅ ${name}: ${address}`);
                checks.passed++;
            } else {
                console.log(`   ❌ ${name}: No contract at ${address}`);
                checks.failed++;
            }
        } catch (error: any) {
            console.log(`   ❌ ${name}: Error checking ${address}`);
            checks.failed++;
        }
    }
    console.log();

    // Check 6: Token addresses
    console.log("🪙 Check 6: Token Contract Validation");
    const tokens = {
        WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        ARB: "0x912CE59144191C1204E64559FE8253a0e49E6548",
        WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f"
    };

    for (const [name, address] of Object.entries(tokens)) {
        try {
            const code = await ethers.provider.getCode(address);
            if (code !== "0x") {
                console.log(`   ✅ ${name}: ${address}`);
                checks.passed++;
            } else {
                console.log(`   ⚠️  ${name}: No contract at ${address}`);
                checks.warnings++;
            }
        } catch (error: any) {
            console.log(`   ⚠️  ${name}: Error checking ${address}`);
            checks.warnings++;
        }
    }
    console.log();

    // Check 7: Gas price
    console.log("⛽ Check 7: Current Gas Price");
    try {
        const feeData = await ethers.provider.getFeeData();
        const gasPrice = feeData.gasPrice || 0n;
        const gasPriceGwei = ethers.formatUnits(gasPrice, "gwei");
        
        console.log(`   💨 Current gas price: ${gasPriceGwei} gwei`);
        
        if (gasPrice < ethers.parseUnits("0.5", "gwei")) {
            console.log(`   ✅ Gas price is reasonable`);
            checks.passed++;
        } else if (gasPrice < ethers.parseUnits("1", "gwei")) {
            console.log(`   ⚠️  Gas price is moderate`);
            checks.warnings++;
        } else {
            console.log(`   ⚠️  Gas price is high - consider waiting`);
            checks.warnings++;
        }
        
        // Estimate deployment cost
        const estimatedGas = 3000000n; // ~3M gas for deployment
        const estimatedCost = gasPrice * estimatedGas;
        const estimatedCostETH = ethers.formatEther(estimatedCost);
        
        console.log(`   💰 Estimated deployment cost: ${estimatedCostETH} ETH`);
        checks.passed++;
    } catch (error: any) {
        console.log(`   ⚠️  Could not fetch gas price:`, error.message);
        checks.warnings++;
    }
    console.log();

    // Summary
    console.log("╔════════════════════════════════════════════════════════════════╗");
    console.log("║                        SUMMARY                                 ║");
    console.log("╚════════════════════════════════════════════════════════════════╝");
    console.log();
    console.log(`✅ Passed: ${checks.passed}`);
    console.log(`❌ Failed: ${checks.failed}`);
    console.log(`⚠️  Warnings: ${checks.warnings}`);
    console.log();

    if (checks.failed === 0) {
        console.log("🎉 All critical checks passed! Ready for deployment.");
        console.log();
        console.log("📝 Next steps:");
        console.log("   1. Review deployment script: scripts/deployDolomitePluginMainnet.ts");
        console.log("   2. Review checklist: docs/DEPLOYMENT_CHECKLIST.md");
        console.log("   3. Run deployment:");
        console.log("      npx hardhat run scripts/deployDolomitePluginMainnet.ts --network arbitrum");
        console.log();
    } else {
        console.log("❌ Some checks failed. Please fix the issues above before deploying.");
        console.log();
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Pre-deployment check failed:");
        console.error(error);
        process.exit(1);
    });
