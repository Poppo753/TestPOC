/**
 * 🔄 BATCH SWAP POOL TOKENS SCRIPT
 * Script per swappare un token in MULTIPLE token contemporaneamente
 * 
 * ESEMPIO: Converti WETH in 50% USDC + 40% WBTC + 10% USDT
 * 
 * REQUISITI:
 * - Essere owner del contratto
 * - Avere token nel pool
 * - SwapManager configurato con UniswapV3Plugin
 * 
 * ESEMPI D'USO:
 * 1. Converti 60% del WETH in 3 token diversi:
 *    npx hardhat run scripts/interact/BatchSwapPoolTokens.ts --network arbitrum
 * 
 * 2. Custom configuration:
 *    BATCH_TOKEN_FROM=WETH BATCH_PERCENTAGE=80 npx hardhat run scripts/interact/BatchSwapPoolTokens.ts --network arbitrum
 */

import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

// ==================== CONFIGURATION ====================

interface SwapAllocation {
    tokenTo: string;        // Token da comprare (es. "USDC")
    percentage: number;     // Percentuale dell'importo totale (es. 50 = 50%)
}

interface BatchSwapConfig {
    tokenFrom: string;              // Token da vendere (es. "WETH")
    totalPercentage: number;        // % del balance totale da swappare (0-100)
    allocations: SwapAllocation[];  // Distribuzione tra token target
    slippage: number;               // Slippage tolerance in basis points (100 = 1%)
    deadlineMinutes: number;        // Minuti per deadline
}

// Default configuration: 60% of WETH → 50% USDC + 40% WBTC + 10% USDT
const DEFAULT_CONFIG: BatchSwapConfig = {
    tokenFrom: process.env.BATCH_TOKEN_FROM || "WETH",
    totalPercentage: parseInt(process.env.BATCH_PERCENTAGE || "70"),
    allocations: [
        { tokenTo: "USDC", percentage: 50 },  // 50% del 60% va in USDC
        { tokenTo: "WBTC", percentage: 50 },  // 40% del 60% va in WBTC
        { tokenTo: "USDT", percentage: 0 },  // 10% del 60% va in USDT
    ],
    slippage: parseInt(process.env.BATCH_SLIPPAGE || "300"), // 3%
    deadlineMinutes: parseInt(process.env.BATCH_DEADLINE_MINUTES || "20")
};

// Mainnet contract addresses
const BEACON_ADDRESS = process.env.BEACON_ADDRESS || "";
const LIQUIDITY_MANAGER_ADDRESS = process.env.LIQUIDITY_MANAGER_ADDRESS || "";

// ==================== HELPER FUNCTIONS ====================

function Logger(message: string) {
    console.log(`[${new Date().toISOString()}] ${message}`);
}

function LogSection(title: string) {
    console.log("\n" + "=".repeat(80));
    console.log(`  ${title}`);
    console.log("=".repeat(80) + "\n");
}

function LogError(message: string) {
    console.error(`❌ ERROR: ${message}`);
}

function LogSuccess(message: string) {
    console.log(`✅ ${message}`);
}

function LogInfo(message: string) {
    console.log(`ℹ️  ${message}`);
}

function LogWarning(message: string) {
    console.log(`⚠️  WARNING: ${message}`);
}

// ==================== MAIN SCRIPT ====================

async function main() {
    LogSection("BATCH SWAP POOL TOKENS - UNISWAPV3");

    // ===== VALIDATION =====
    
    if (!BEACON_ADDRESS || !LIQUIDITY_MANAGER_ADDRESS) {
        LogError("Missing contract addresses in .env");
        LogInfo("Required: BEACON_ADDRESS, LIQUIDITY_MANAGER_ADDRESS");
        process.exit(1);
    }

    const config = DEFAULT_CONFIG;
    
    // Validate configuration
    if (config.totalPercentage <= 0 || config.totalPercentage > 100) {
        LogError(`Invalid total percentage: ${config.totalPercentage}. Must be between 1 and 100`);
        process.exit(1);
    }

    // Check allocations sum to 100%
    const totalAllocation = config.allocations.reduce((sum, alloc) => sum + alloc.percentage, 0);
    if (Math.abs(totalAllocation - 100) > 0.01) {
        LogError(`Allocations must sum to 100%, got ${totalAllocation}%`);
        process.exit(1);
    }

    // Check no duplicate tokens
    const uniqueTokens = new Set(config.allocations.map(a => a.tokenTo));
    if (uniqueTokens.size !== config.allocations.length) {
        LogError("Duplicate tokens in allocations");
        process.exit(1);
    }

    // Check tokenFrom is not in allocations
    if (config.allocations.some(a => a.tokenTo === config.tokenFrom)) {
        LogError("Cannot swap token into itself");
        process.exit(1);
    }

    // ===== SETUP =====

    const [signer] = await ethers.getSigners();
    LogInfo(`Using account: ${signer.address}`);
    
    const balance = await ethers.provider.getBalance(signer.address);
    LogInfo(`Account balance: ${ethers.formatEther(balance)} ETH`);

    if (balance < ethers.parseEther("0.005")) {
        LogWarning("Low balance! Recommended at least 0.005 ETH for gas (batch swap)");
    }

    LogInfo("\nBatch Swap Configuration:");
    LogInfo(`  Token From: ${config.tokenFrom}`);
    LogInfo(`  Total Percentage: ${config.totalPercentage}%`);
    LogInfo(`  Slippage: ${config.slippage / 100}%`);
    LogInfo(`  Deadline: ${config.deadlineMinutes} minutes`);
    LogInfo("\n  Allocations:");
    config.allocations.forEach(alloc => {
        LogInfo(`    → ${alloc.percentage}% to ${alloc.tokenTo}`);
    });

    // ===== CONNECT TO CONTRACTS =====

    LogSection("CONNECTING TO CONTRACTS");

    const beacon = await ethers.getContractAt("Beacon", BEACON_ADDRESS);
    LogSuccess(`Connected to Beacon: ${BEACON_ADDRESS}`);

    // Get contract addresses from Beacon
    const tokenManagerAddress = await beacon.getImplementation("TokenManager");
    const swapManagerAddress = await beacon.getImplementation("SwapManager");
    const proxyGeneralAddress = await beacon.getImplementation("ProxyGeneral");

    LogInfo(`TokenManager: ${tokenManagerAddress}`);
    LogInfo(`SwapManager: ${swapManagerAddress}`);
    LogInfo(`ProxyGeneral: ${proxyGeneralAddress}`);

    // Connect to contracts
    const tokenManager = await ethers.getContractAt("TokenManager", tokenManagerAddress);
    const swapManager = await ethers.getContractAt("SwapManager", swapManagerAddress);
    const liquidityManager = await ethers.getContractAt("LiquidityManager", LIQUIDITY_MANAGER_ADDRESS);

    // ===== VERIFY OWNERSHIP =====

    LogSection("VERIFYING OWNERSHIP");

    const owner = await liquidityManager.owner();
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
        LogError(`You are not the owner!`);
        LogInfo(`Owner: ${owner}`);
        LogInfo(`Your address: ${signer.address}`);
        process.exit(1);
    }

    LogSuccess(`Ownership verified: ${signer.address}`);

    // ===== CHECK SWAP STATUS =====

    LogSection("CHECKING SWAP SYSTEM");

    const swapsEnabled = await swapManager.swapsEnabled();
    if (!swapsEnabled) {
        LogError("Swaps are currently disabled!");
        process.exit(1);
    }

    LogSuccess("Swaps enabled");

    const activePlugin = await swapManager.activeSwapPlugin();
    LogInfo(`Active Plugin: ${activePlugin}`);

    // ===== RESOLVE TOKEN ADDRESSES =====

    LogSection("RESOLVING TOKEN ADDRESSES");

    const erc20Abi = [
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)"
    ];

    // Get tokenFrom address
    let tokenFromAddress: string;
    let tokenFromDecimals: number;

    if (config.tokenFrom === "WETH") {
        tokenFromAddress = await beacon.getImplementation("WETH");
        LogSuccess(`${config.tokenFrom}: ${tokenFromAddress} (from Beacon)`);
    } else {
        tokenFromAddress = await tokenManager.getTokenAddress(config.tokenFrom);
        LogSuccess(`${config.tokenFrom}: ${tokenFromAddress}`);
    }

    const tokenFromContract = await ethers.getContractAt(erc20Abi, tokenFromAddress);
    tokenFromDecimals = await tokenFromContract.decimals();

    // Get all tokenTo addresses
    const tokenToData = [];
    for (const alloc of config.allocations) {
        let address: string;
        
        if (alloc.tokenTo === "WETH") {
            address = await beacon.getImplementation("WETH");
            LogSuccess(`${alloc.tokenTo}: ${address} (from Beacon)`);
        } else {
            address = await tokenManager.getTokenAddress(alloc.tokenTo);
            LogSuccess(`${alloc.tokenTo}: ${address}`);
        }

        const contract = await ethers.getContractAt(erc20Abi, address);
        const decimals = await contract.decimals();

        tokenToData.push({
            code: alloc.tokenTo,
            address,
            decimals,
            contract,
            percentage: alloc.percentage
        });
    }

    // ===== GET POOL BALANCES =====

    LogSection("CHECKING POOL BALANCES");

    const poolBalanceFrom = await tokenFromContract.balanceOf(proxyGeneralAddress);
    LogInfo(`${config.tokenFrom} in pool: ${ethers.formatUnits(poolBalanceFrom, tokenFromDecimals)}`);

    if (poolBalanceFrom === 0n) {
        LogError(`No ${config.tokenFrom} in pool to swap!`);
        process.exit(1);
    }

    // Calculate total amount to swap
    const totalSwapAmount = (poolBalanceFrom * BigInt(config.totalPercentage)) / 100n;

    if (totalSwapAmount === 0n) {
        LogError("Total swap amount is 0! Increase percentage or pool balance");
        process.exit(1);
    }

    LogInfo(`Total amount to swap: ${ethers.formatUnits(totalSwapAmount, tokenFromDecimals)} ${config.tokenFrom} (${config.totalPercentage}%)`);

    // Calculate individual swap amounts
    const swaps = tokenToData.map(token => {
        const amount = (totalSwapAmount * BigInt(token.percentage)) / 100n;
        return {
            ...token,
            amountIn: amount
        };
    });

    LogInfo("\nIndividual swaps:");
    swaps.forEach(swap => {
        LogInfo(`  ${ethers.formatUnits(swap.amountIn, tokenFromDecimals)} ${config.tokenFrom} → ${swap.code} (${swap.percentage}%)`);
    });

    // ===== CALCULATE DEADLINE =====

    const deadline = Math.floor(Date.now() / 1000) + (config.deadlineMinutes * 60);
    LogInfo(`\nDeadline: ${new Date(deadline * 1000).toISOString()}`);

    // ===== CONFIRMATION =====

    LogSection("BATCH SWAP SUMMARY");

    console.log(`
╔════════════════════════════════════════════════════════════════════════╗
║                      BATCH SWAP CONFIRMATION                            ║
╠════════════════════════════════════════════════════════════════════════╣
║  Sell: ${ethers.formatUnits(totalSwapAmount, tokenFromDecimals).padEnd(20)} ${config.tokenFrom.padEnd(38)} ║
╠════════════════════════════════════════════════════════════════════════╣`);

    swaps.forEach(swap => {
        console.log(`║  → ${swap.percentage}%: ${ethers.formatUnits(swap.amountIn, tokenFromDecimals).padEnd(15)} ${config.tokenFrom} → ${swap.code.padEnd(30)} ║`);
    });

    console.log(`╠════════════════════════════════════════════════════════════════════════╣
║  Slippage: ${(config.slippage / 100).toFixed(2)}%${" ".repeat(60)}║
║  Plugin: ${activePlugin.padEnd(63)}║
╚════════════════════════════════════════════════════════════════════════╝
    `);

    LogWarning("This transaction will be executed in 5 seconds...");
    LogInfo("Press Ctrl+C to cancel");

    await new Promise(resolve => setTimeout(resolve, 5000));

    // ===== EXECUTE BATCH SWAP =====

    LogSection("EXECUTING BATCH SWAPS");

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < swaps.length; i++) {
        const swap = swaps[i];
        
        LogInfo(`\n[${i + 1}/${swaps.length}] Swapping ${ethers.formatUnits(swap.amountIn, tokenFromDecimals)} ${config.tokenFrom} → ${swap.code}...`);

        try {
            // Get balance before
            const balanceBefore = await swap.contract.balanceOf(proxyGeneralAddress);

            // Execute swap
            const tx = await swapManager.performSwap(
                config.tokenFrom,
                swap.code,
                swap.amountIn,
                deadline,
                {
                    gasLimit: 2000000
                }
            );

            LogInfo(`  TX: ${tx.hash}`);
            LogInfo(`  Waiting for confirmation...`);

            const receipt = await tx.wait(1);

            if (!receipt) {
                throw new Error("No receipt");
            }

            LogSuccess(`  Confirmed in block: ${receipt.blockNumber}`);
            LogInfo(`  Gas used: ${receipt.gasUsed.toString()}`);

            // Get balance after
            const balanceAfter = await swap.contract.balanceOf(proxyGeneralAddress);
            const received = balanceAfter - balanceBefore;

            LogSuccess(`  Received: ${ethers.formatUnits(received, swap.decimals)} ${swap.code}`);

            // Calculate effective price
            if (swap.amountIn > 0n && received > 0n) {
                const price = (received * ethers.parseUnits("1", tokenFromDecimals)) / swap.amountIn;
                LogInfo(`  Price: ${ethers.formatUnits(price, swap.decimals)} ${swap.code} per ${config.tokenFrom}`);
            }

            results.push({
                success: true,
                token: swap.code,
                amountIn: swap.amountIn,
                amountOut: received,
                txHash: tx.hash,
                gasUsed: receipt.gasUsed
            });

            successCount++;

        } catch (error: any) {
            LogError(`  Swap failed: ${error.message}`);
            
            results.push({
                success: false,
                token: swap.code,
                amountIn: swap.amountIn,
                error: error.message
            });

            failCount++;

            // Ask if continue
            if (i < swaps.length - 1) {
                LogWarning(`  Continue with remaining swaps? (${swaps.length - i - 1} left)`);
                LogInfo("  Press Ctrl+C to stop, or wait 3 seconds to continue...");
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        // Small delay between swaps to avoid rate limiting
        if (i < swaps.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // ===== FINAL REPORT =====

    LogSection("BATCH SWAP RESULTS");

    console.log(`
╔════════════════════════════════════════════════════════════════════════╗
║                         BATCH SWAP REPORT                               ║
╠════════════════════════════════════════════════════════════════════════╣
║  Total Swaps: ${swaps.length.toString().padEnd(61)}║
║  Successful: ${successCount.toString().padEnd(62)}║
║  Failed: ${failCount.toString().padEnd(66)}║
╠════════════════════════════════════════════════════════════════════════╣`);

    results.forEach((result, i) => {
        if (result.success) {
            console.log(`║  ✅ ${result.token}: ${ethers.formatUnits(result.amountOut, swaps[i].decimals).padEnd(20)} (${result.txHash?.slice(0, 10)}...)${" ".repeat(18)}║`);
        } else {
            console.log(`║  ❌ ${result.token}: FAILED${" ".repeat(52)}║`);
        }
    });

    console.log(`╚════════════════════════════════════════════════════════════════════════╝`);

    // ===== POST-SWAP BALANCES =====

    LogSection("POST-SWAP POOL BALANCES");

    const newPoolBalanceFrom = await tokenFromContract.balanceOf(proxyGeneralAddress);
    const actualSpent = poolBalanceFrom - newPoolBalanceFrom;

    LogInfo(`${config.tokenFrom}: ${ethers.formatUnits(newPoolBalanceFrom, tokenFromDecimals)} (was ${ethers.formatUnits(poolBalanceFrom, tokenFromDecimals)})`);
    LogSuccess(`Total spent: ${ethers.formatUnits(actualSpent, tokenFromDecimals)} ${config.tokenFrom}`);

    LogInfo("\nToken balances:");
    for (const swap of swaps) {
        const balance = await swap.contract.balanceOf(proxyGeneralAddress);
        LogInfo(`  ${swap.code}: ${ethers.formatUnits(balance, swap.decimals)}`);
    }

    // ===== SUCCESS =====

    if (failCount === 0) {
        LogSection("ALL SWAPS COMPLETED SUCCESSFULLY");
        LogSuccess("All done! ✨");
    } else {
        LogSection("BATCH SWAP COMPLETED WITH ERRORS");
        LogWarning(`${successCount} successful, ${failCount} failed`);
        LogInfo("Check logs above for details");
    }
}

// ==================== EXECUTION ====================

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n💥 Script crashed:", error);
        process.exit(1);
    });
