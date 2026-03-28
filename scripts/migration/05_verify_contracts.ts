import { ethers, run } from "hardhat";

/**
 * PHASE 1C - VERIFICATION SCRIPT
 * 
 * Verifica contratti deployati su Arbiscan (Arbitrum block explorer)
 * 
 * PREREQUISITI:
 * - ARBITRUM_ETHERSCAN_API_KEY configurato in .env
 * - Contratti già deployed (UniswapV3Plugin, SwapManager)
 * - Addresses salvati in .env.migration
 * 
 * AZIONI:
 * 1. Verifica UniswapV3Plugin
 * 2. Verifica SwapManager (se deployed)
 * 3. Mostra link Arbiscan per review
 * 
 * NOTE:
 * - Verification può richiedere alcuni minuti
 * - Se fallisce, retry dopo qualche minuto
 * - Arbiscan richiede API key (gratis su arbiscan.io)
 */

interface ContractToVerify {
    name: string;
    address: string;
    constructorArgs: any[];
}

async function verifyContract(contract: ContractToVerify): Promise<boolean> {
    console.log(`\n🔍 Verifying ${contract.name}...`);
    console.log(`   Address: ${contract.address}`);
    console.log(`   Constructor args: ${JSON.stringify(contract.constructorArgs)}`);
    
    try {
        await run("verify:verify", {
            address: contract.address,
            constructorArguments: contract.constructorArgs,
        });
        
        console.log(`   ✅ ${contract.name} verified successfully!`);
        console.log(`   🔗 View on Arbiscan: https://arbiscan.io/address/${contract.address}#code\n`);
        return true;
        
    } catch (error: any) {
        if (error.message.includes("Already Verified")) {
            console.log(`   ✅ ${contract.name} already verified`);
            console.log(`   🔗 View on Arbiscan: https://arbiscan.io/address/${contract.address}#code\n`);
            return true;
        }
        
        console.error(`   ❌ Verification failed: ${error.message}`);
        
        if (error.message.includes("API key")) {
            console.error("   💡 SOLUTION: Set ARBITRUM_ETHERSCAN_API_KEY in .env");
            console.error("   Get free API key at: https://arbiscan.io/myapikey\n");
        } else if (error.message.includes("rate limit")) {
            console.error("   💡 SOLUTION: Wait 1-2 minutes and retry\n");
        } else {
            console.error("   💡 Try manual verification on Arbiscan\n");
        }
        
        return false;
    }
}

async function main() {
    console.log("\n==============================================");
    console.log("PHASE 1C.5 - VERIFY CONTRACTS ON ARBISCAN");
    console.log("==============================================\n");

    const [deployer] = await ethers.getSigners();
    console.log(`Verifying with account: ${deployer.address}\n`);

    // ========== CONFIGURATION ==========
    
    const network = await ethers.provider.getNetwork();
    const isMainnet = network.chainId === 42161n;
    const isTestnet = network.chainId === 421614n; // Arbitrum Sepolia
    
    if (!isMainnet && !isTestnet) {
        throw new Error(
            `❌ Wrong network! Expected Arbitrum (42161) or Arbitrum Sepolia (421614)\n` +
            `   Current: ${network.chainId}`
        );
    }
    
    const explorerName = isMainnet ? "Arbiscan" : "Arbiscan Sepolia";
    const explorerUrl = isMainnet ? "https://arbiscan.io" : "https://sepolia.arbiscan.io";
    
    console.log("📋 Configuration:");
    console.log(`   Network: ${isMainnet ? "Arbitrum Mainnet" : "Arbitrum Sepolia (Testnet)"}`);
    console.log(`   Chain ID: ${network.chainId}`);
    console.log(`   Explorer: ${explorerName} (${explorerUrl})`);
    console.log(`   Verifier: ${deployer.address}\n`);

    // Check API key
    const apiKey = process.env.ARBITRUM_ETHERSCAN_API_KEY;
    if (!apiKey) {
        console.log("⚠️  WARNING: ARBITRUM_ETHERSCAN_API_KEY not set!");
        console.log("   Verification will fail without API key");
        console.log("   Get free API key at: https://arbiscan.io/myapikey\n");
        
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const answer = await new Promise<string>((resolve) => {
            readline.question("Continue without API key? (y/N): ", resolve);
        });
        
        readline.close();
        
        if (answer.toLowerCase() !== 'y') {
            console.log("\n❌ Verification cancelled\n");
            return;
        }
    } else {
        console.log("✅ API key configured\n");
    }

    // ========== LOAD ADDRESSES ==========
    
    console.log("📦 Loading deployed contract addresses...\n");
    
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '../../.env.migration');
    
    let envContent = '';
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    const getEnvValue = (key: string): string => {
        const match = envContent.match(new RegExp(`${key}=(.+)`));
        return match ? match[1].trim() : process.env[key] || "";
    };
    
    const UNISWAPV3_PLUGIN_ADDRESS = getEnvValue("UNISWAPV3_PLUGIN_ADDRESS");
    const SIMPLE_SWAP_ADDRESS = getEnvValue("SIMPLE_SWAP_ADDRESS") || 
        (isMainnet ? "0xa0DB78167CBAccD47524a261b7741C6B41Bbd096" : "");
    const NEW_SWAP_MANAGER_ADDRESS = getEnvValue("NEW_SWAP_MANAGER_ADDRESS");
    const BEACON_ADDRESS = getEnvValue("BEACON_ADDRESS");
    
    // ========== BUILD VERIFICATION QUEUE ==========
    
    const contractsToVerify: ContractToVerify[] = [];
    
    // 1. UniswapV3Plugin (REQUIRED)
    if (UNISWAPV3_PLUGIN_ADDRESS && SIMPLE_SWAP_ADDRESS) {
        contractsToVerify.push({
            name: "UniswapV3Plugin",
            address: UNISWAPV3_PLUGIN_ADDRESS,
            constructorArgs: [SIMPLE_SWAP_ADDRESS]
        });
        console.log("✅ UniswapV3Plugin found:");
        console.log(`   Address: ${UNISWAPV3_PLUGIN_ADDRESS}`);
        console.log(`   Constructor: simpleSwap = ${SIMPLE_SWAP_ADDRESS}\n`);
    } else {
        console.log("⚠️  UniswapV3Plugin address not found in .env.migration");
        console.log("   Run: npx hardhat run scripts/migration/00_deploy_uniswapv3plugin.ts\n");
    }
    
    // 2. SwapManager (OPTIONAL - might not be deployed yet)
    if (NEW_SWAP_MANAGER_ADDRESS && BEACON_ADDRESS) {
        contractsToVerify.push({
            name: "SwapManager",
            address: NEW_SWAP_MANAGER_ADDRESS,
            constructorArgs: [BEACON_ADDRESS]
        });
        console.log("✅ SwapManager found:");
        console.log(`   Address: ${NEW_SWAP_MANAGER_ADDRESS}`);
        console.log(`   Constructor: beacon = ${BEACON_ADDRESS}\n`);
    } else {
        console.log("ℹ️  SwapManager not yet deployed (OK - will verify later)\n");
    }
    
    if (contractsToVerify.length === 0) {
        throw new Error(
            "❌ No contracts to verify!\n" +
            "   Deploy contracts first using migration scripts 00-02"
        );
    }

    // ========== VERIFY CONTRACTS ==========
    
    console.log("==============================================");
    console.log(`VERIFYING ${contractsToVerify.length} CONTRACT(S)`);
    console.log("==============================================\n");
    
    const results: { name: string; success: boolean; address: string }[] = [];
    
    for (const contract of contractsToVerify) {
        const success = await verifyContract(contract);
        results.push({
            name: contract.name,
            success,
            address: contract.address
        });
        
        // Wait between verifications to avoid rate limiting
        if (contractsToVerify.indexOf(contract) < contractsToVerify.length - 1) {
            console.log("⏳ Waiting 10 seconds before next verification...");
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }

    // ========== SUMMARY ==========
    
    console.log("\n==============================================");
    console.log("VERIFICATION SUMMARY");
    console.log("==============================================\n");
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    for (const result of results) {
        const status = result.success ? "✅ VERIFIED" : "❌ FAILED";
        console.log(`${status}: ${result.name}`);
        console.log(`   Address: ${result.address}`);
        console.log(`   View: ${explorerUrl}/address/${result.address}#code\n`);
    }
    
    console.log(`Success: ${successCount}/${results.length}`);
    console.log(`Failed: ${failCount}/${results.length}\n`);
    
    if (failCount > 0) {
        console.log("⚠️  FAILED VERIFICATIONS:");
        console.log("───────────────────────────────────────────────");
        console.log("1. Check API key is correct in .env");
        console.log("2. Wait 1-2 minutes and retry this script");
        console.log("3. Manual verification fallback:\n");
        
        for (const result of results.filter(r => !r.success)) {
            console.log(`   ${result.name}:`);
            console.log(`   ${explorerUrl}/verifyContract?a=${result.address}\n`);
        }
    }
    
    if (successCount === results.length) {
        console.log("==============================================");
        console.log("✅ ALL CONTRACTS VERIFIED SUCCESSFULLY");
        console.log("==============================================\n");
        
        console.log("📋 NEXT STEPS:");
        console.log("1. Review contracts on Arbiscan (links above)");
        console.log("2. Share verified addresses with team/users");
        console.log("3. Continue with migration if not completed:\n");
        console.log("   Phase 1C.1: npx hardhat run scripts/migration/01_register_simpleswap.ts");
        console.log("   Phase 1C.2: npx hardhat run scripts/migration/02_deploy_new_swapmanager.ts");
        console.log("   Phase 1C.3: npx hardhat run scripts/migration/03_update_beacon.ts");
        console.log("   Phase 1C.4: npx hardhat run scripts/migration/04_verify_system.ts\n");
    }

    // ========== MANUAL VERIFICATION INFO ==========
    
    console.log("📝 MANUAL VERIFICATION (if needed):");
    console.log("─────────────────────────────────────────────");
    
    for (const contract of contractsToVerify) {
        console.log(`\n${contract.name}:`);
        console.log(`Address: ${contract.address}`);
        console.log(`Constructor Arguments (ABI encoded):`);
        
        // Encode constructor arguments for manual verification
        const iface = new ethers.Interface(["constructor(address)"]);
        const encoded = iface.encodeDeploy(contract.constructorArgs);
        console.log(encoded.slice(2)); // Remove 0x prefix for Arbiscan
        
        console.log(`\nOr use Hardhat command:`);
        console.log(`npx hardhat verify --network ${isMainnet ? "arbitrum" : "arbitrumSepolia"} ${contract.address} ${contract.constructorArgs.join(" ")}`);
    }
    
    console.log("\n─────────────────────────────────────────────\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ VERIFICATION SCRIPT FAILED");
        console.error("─────────────────────────────────────────────");
        console.error("Error:", error.message);
        console.error("\n💡 TROUBLESHOOTING:");
        console.error("1. Ensure contracts are deployed first");
        console.error("2. Check ARBITRUM_ETHERSCAN_API_KEY in .env");
        console.error("3. Verify network in hardhat.config.ts");
        console.error("4. Try manual verification on Arbiscan");
        console.error("─────────────────────────────────────────────\n");
        process.exit(1);
    });
