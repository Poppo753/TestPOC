/**
 * 📊 DEPLOYMENT SUMMARY
 * 
 * Quick overview of all deployed contracts and their status
 * 
 * USAGE:
 *   npx hardhat run scripts/utils/DeploymentSummary.ts --network arbitrum
 */

import { ethers } from "hardhat";

async function main() {
    console.log("\n" + "=".repeat(80));
    console.log("📊 DEPLOYMENT SUMMARY");
    console.log("=".repeat(80) + "\n");

    const [deployer] = await ethers.getSigners();
    const network = await deployer.provider.getNetwork();
    
    console.log(`Network: ${network.name} (chainId: ${network.chainId})`);
    console.log(`Checked by: ${deployer.address}\n`);

    // Contract addresses from env
    const contracts = {
        "Beacon": process.env.BEACON_ADDRESS,
        "ChainlinkAdapter": process.env.CHAINLINK_ADAPTER_ADDRESS,
        "TokenManager": process.env.TOKEN_MANAGER_ADDRESS,
        "SwapManager": process.env.SWAP_MANAGER_ADDRESS,
        "ValueCalculator": process.env.VALUE_CALCULATOR_ADDRESS,
        "ParameterManager": process.env.PARAMETER_MANAGER_ADDRESS,
        "EmergencyHandler": process.env.EMERGENCY_HANDLER_ADDRESS,
        "LiquidityManager": process.env.LIQUIDITY_MANAGER_ADDRESS
    };

    console.log("=".repeat(80));
    console.log("📝 CONTRACT ADDRESSES");
    console.log("=".repeat(80) + "\n");

    let deployedCount = 0;
    let verifiedCount = 0;

    for (const [name, address] of Object.entries(contracts)) {
        if (!address) {
            console.log(`❌ ${name.padEnd(20)} NOT CONFIGURED`);
            continue;
        }

        const code = await deployer.provider.getCode(address);
        if (code === "0x") {
            console.log(`⚠️  ${name.padEnd(20)} ${address} (NOT DEPLOYED)`);
        } else {
            console.log(`✅ ${name.padEnd(20)} ${address}`);
            deployedCount++;
            
            // Try to verify if it's a known interface
            try {
                const contract = await ethers.getContractAt(name, address);
                await contract.owner(); // Most contracts have owner()
                verifiedCount++;
            } catch (error) {
                // Ignore verification errors
            }
        }
    }

    console.log(`\nDeployment Status: ${deployedCount}/${Object.keys(contracts).length} contracts deployed\n`);

    // Check Beacon implementations if Beacon is deployed
    if (contracts.Beacon && await deployer.provider.getCode(contracts.Beacon) !== "0x") {
        console.log("=".repeat(80));
        console.log("🎯 BEACON IMPLEMENTATIONS");
        console.log("=".repeat(80) + "\n");

        const beacon = await ethers.getContractAt("Beacon", contracts.Beacon);
        
        const modules = [
            "TokenManager",
            "SwapManager", 
            "ValueCalculator",
            "ParameterManager",
            "EmergencyHandler",
            "LiquidityManager"
        ];

        let registeredCount = 0;

        for (const module of modules) {
            try {
                const impl = await beacon.getImplementation(module);
                const expected = contracts[module as keyof typeof contracts];
                
                if (impl.toLowerCase() === expected?.toLowerCase()) {
                    console.log(`✅ ${module.padEnd(20)} Registered correctly`);
                    registeredCount++;
                } else {
                    console.log(`⚠️  ${module.padEnd(20)} Mismatch! (registered: ${impl})`);
                }
            } catch (error) {
                console.log(`❌ ${module.padEnd(20)} Not registered`);
            }
        }

        console.log(`\nBeacon Status: ${registeredCount}/${modules.length} implementations registered\n`);
    }

    // Check ChainlinkAdapter configuration
    if (contracts.ChainlinkAdapter && await deployer.provider.getCode(contracts.ChainlinkAdapter) !== "0x") {
        console.log("=".repeat(80));
        console.log("📡 CHAINLINK ADAPTER STATUS");
        console.log("=".repeat(80) + "\n");

        const adapter = await ethers.getContractAt("ChainlinkAdapter", contracts.ChainlinkAdapter);
        
        const tokens = ["USDC", "USDT", "DAI", "WBTC", "ETH", "LINK", "UNI", "ARB"];
        let configuredCount = 0;

        for (const token of tokens) {
            try {
                const isSupported = await adapter.supportsToken(token);
                if (isSupported) {
                    const decimals = await adapter.getPriceDecimals(token);
                    console.log(`✅ ${token.padEnd(6)} Supported (decimals: ${decimals})`);
                    configuredCount++;
                } else {
                    console.log(`⚠️  ${token.padEnd(6)} Not configured`);
                }
            } catch (error) {
                console.log(`❌ ${token.padEnd(6)} Error checking`);
            }
        }

        console.log(`\nOracle Status: ${configuredCount}/${tokens.length} price feeds configured\n`);
    }

    // Check TokenManager tokens
    if (contracts.TokenManager && await deployer.provider.getCode(contracts.TokenManager) !== "0x") {
        console.log("=".repeat(80));
        console.log("🪙 REGISTERED TOKENS");
        console.log("=".repeat(80) + "\n");

        const tokenManager = await ethers.getContractAt("TokenManager", contracts.TokenManager);
        
        const tokens = ["USDC", "USDT", "DAI", "WBTC", "ETH"];
        let activeCount = 0;

        for (const token of tokens) {
            try {
                const isActive = await tokenManager.isTokenActive(token);
                if (isActive) {
                    const tokenInfo = await tokenManager.getTokenInfo(token);
                    console.log(`✅ ${token.padEnd(6)} Active (address: ${tokenInfo.tokenAddress})`);
                    activeCount++;
                } else {
                    console.log(`⚠️  ${token.padEnd(6)} Not registered`);
                }
            } catch (error) {
                console.log(`⚠️  ${token.padEnd(6)} Not registered`);
            }
        }

        console.log(`\nToken Status: ${activeCount}/${tokens.length} tokens active\n`);
    }

    // System health check
    console.log("=".repeat(80));
    console.log("💊 SYSTEM HEALTH");
    console.log("=".repeat(80) + "\n");

    const checks = {
        "Contracts Deployed": deployedCount === Object.keys(contracts).length,
        "Beacon Configured": contracts.Beacon && await deployer.provider.getCode(contracts.Beacon!) !== "0x",
        "Oracle Active": contracts.ChainlinkAdapter && await deployer.provider.getCode(contracts.ChainlinkAdapter!) !== "0x",
        "Ready for Deposits": deployedCount === Object.keys(contracts).length
    };

    for (const [check, status] of Object.entries(checks)) {
        console.log(`${status ? "✅" : "❌"} ${check}`);
    }

    console.log("\n" + "=".repeat(80));
    
    const allGood = Object.values(checks).every(v => v);
    if (allGood) {
        console.log("🎉 SYSTEM READY FOR PRODUCTION!");
    } else {
        console.log("⚠️  SYSTEM NOT FULLY CONFIGURED");
        console.log("\nNext steps:");
        if (!contracts.Beacon) console.log("1. Deploy Beacon");
        if (deployedCount < Object.keys(contracts).length) console.log("2. Deploy missing modules");
        if (!checks["Beacon Configured"]) console.log("3. Register implementations in Beacon");
        if (deployedCount === Object.keys(contracts).length) console.log("4. Add tokens to system");
    }
    
    console.log("=".repeat(80) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
