/**
 * 🔄 SWAP POOL TOKENS SCRIPT
 * Script per swappare token dal pool usando UniswapV3Plugin
 * 
 * REQUISITI:
 * - Essere owner del contratto
 * - Avere token nel pool
 * - SwapManager configurato con UniswapV3Plugin
 * 
 * ESEMPI D'USO:
 * 1. Swap 50% ETH in USDC:
 *    npx hardhat run scripts/interact/SwapPoolTokens.ts --network arbitrum
 * 
 * 2. Swap custom amount:
 *    SWAP_TOKEN_FROM=WETH SWAP_TOKEN_TO=USDC SWAP_PERCENTAGE=30 npx hardhat run scripts/interact/SwapPoolTokens.ts --network arbitrum
 */

import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

// ==================== CONFIGURATION ====================

interface SwapConfig {
    tokenFrom: string;      // Token da vendere (es. "WETH")
    tokenTo: string;        // Token da comprare (es. "USDC")
    percentage: number;     // Percentuale del balance da swappare (0-100)
    slippage: number;       // Slippage tollerance in basis points (100 = 1%)
    deadlineMinutes: number; // Minuti per deadline
}

// Default configuration
const DEFAULT_CONFIG: SwapConfig = {
    tokenFrom: process.env.SWAP_TOKEN_FROM || "WETH",
    tokenTo: process.env.SWAP_TOKEN_TO || "USDC",
    percentage: parseInt(process.env.SWAP_PERCENTAGE || "60"),
    slippage: parseInt(process.env.SWAP_SLIPPAGE || "300"), // 3%
    deadlineMinutes: parseInt(process.env.SWAP_DEADLINE_MINUTES || "20")
};

// Mainnet contract addresses (from .env)
const BEACON_ADDRESS = process.env.BEACON_ADDRESS || "";
const LIQUIDITY_MANAGER_ADDRESS = process.env.LIQUIDITY_MANAGER_ADDRESS || "";

// ==================== HELPER FUNCTIONS ====================

function Logger(message: string) {
    console.log(`[${new Date().toISOString()}] ${message}`);
}

function LogSection(title: string) {
    console.log("\n" + "=".repeat(60));
    console.log(`  ${title}`);
    console.log("=".repeat(60) + "\n");
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
    LogSection("SWAP POOL TOKENS - UNISWAPV3");

    // ===== VALIDATION =====
    
    if (!BEACON_ADDRESS || !LIQUIDITY_MANAGER_ADDRESS) {
        LogError("Missing contract addresses in .env");
        LogInfo("Required: BEACON_ADDRESS, LIQUIDITY_MANAGER_ADDRESS");
        process.exit(1);
    }

    const config = DEFAULT_CONFIG;
    
    // Validate configuration
    if (config.percentage <= 0 || config.percentage > 100) {
        LogError(`Invalid percentage: ${config.percentage}. Must be between 1 and 100`);
        process.exit(1);
    }

    if (config.tokenFrom === config.tokenTo) {
        LogError("Cannot swap same token");
        process.exit(1);
    }

    // ===== SETUP =====

    const [signer] = await ethers.getSigners();
    LogInfo(`Using account: ${signer.address}`);
    
    const balance = await ethers.provider.getBalance(signer.address);
    LogInfo(`Account balance: ${ethers.formatEther(balance)} ETH`);

    if (balance < ethers.parseEther("0.001")) {
        LogWarning("Low balance! Recommended at least 0.001 ETH for gas");
    }

    LogInfo("\nSwap Configuration:");
    LogInfo(`  Token From: ${config.tokenFrom}`);
    LogInfo(`  Token To: ${config.tokenTo}`);
    LogInfo(`  Percentage: ${config.percentage}%`);
    LogInfo(`  Slippage: ${config.slippage / 100}%`);
    LogInfo(`  Deadline: ${config.deadlineMinutes} minutes`);

    // ===== CONNECT TO CONTRACTS =====

    LogSection("CONNECTING TO CONTRACTS");

    const beacon = await ethers.getContractAt("Beacon", BEACON_ADDRESS);
    LogSuccess(`Connected to Beacon: ${BEACON_ADDRESS}`);

    // Get contract addresses from Beacon
    const tokenManagerAddress = await beacon.getImplementation("TokenManager");
    const swapManagerAddress = await beacon.getImplementation("SwapManager");
    const valueCalculatorAddress = await beacon.getImplementation("ValueCalculator");
    const proxyGeneralAddress = await beacon.getImplementation("ProxyGeneral");

    LogInfo(`TokenManager: ${tokenManagerAddress}`);
    LogInfo(`SwapManager: ${swapManagerAddress}`);
    LogInfo(`ValueCalculator: ${valueCalculatorAddress}`);
    LogInfo(`ProxyGeneral: ${proxyGeneralAddress}`);

    // Connect to contracts
    const tokenManager = await ethers.getContractAt("TokenManager", tokenManagerAddress);
    const swapManager = await ethers.getContractAt("SwapManager", swapManagerAddress);
    const valueCalculator = await ethers.getContractAt("ValueCalculator", valueCalculatorAddress);
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
        LogInfo("Enable swaps first with: swapManager.setSwapsEnabled(true)");
        process.exit(1);
    }

    LogSuccess("Swaps enabled");

    const activePlugin = await swapManager.activeSwapPlugin();
    LogInfo(`Active Plugin: ${activePlugin}`);

    if (activePlugin !== "UniswapV3Plugin") {
        LogWarning(`Active plugin is not UniswapV3Plugin!`);
        LogInfo("This script expects UniswapV3Plugin to be active");
    }

    // Get plugin address from Beacon
    let pluginAddress: string;
    try {
        pluginAddress = await beacon.getImplementation(activePlugin);
        LogInfo(`Plugin Address: ${pluginAddress}`);
        
        if (pluginAddress === ethers.ZeroAddress) {
            throw new Error("Plugin not registered in Beacon");
        }
    } catch (error) {
        LogError(`Failed to get plugin address: ${error}`);
        process.exit(1);
    }

    // ===== GET TOKEN ADDRESSES =====

    LogSection("RESOLVING TOKEN ADDRESSES");

    let tokenFromAddress: string;
    let tokenToAddress: string;

    try {
        // WETH is special - it's registered in Beacon, not TokenManager
        if (config.tokenFrom === "WETH") {
            tokenFromAddress = await beacon.getImplementation("WETH");
            LogSuccess(`${config.tokenFrom}: ${tokenFromAddress} (from Beacon)`);
        } else {
            tokenFromAddress = await tokenManager.getTokenAddress(config.tokenFrom);
            LogSuccess(`${config.tokenFrom}: ${tokenFromAddress}`);
        }

        if (config.tokenTo === "WETH") {
            tokenToAddress = await beacon.getImplementation("WETH");
            LogSuccess(`${config.tokenTo}: ${tokenToAddress} (from Beacon)`);
        } else {
            tokenToAddress = await tokenManager.getTokenAddress(config.tokenTo);
            LogSuccess(`${config.tokenTo}: ${tokenToAddress}`);
        }

        if (tokenFromAddress === ethers.ZeroAddress || tokenToAddress === ethers.ZeroAddress) {
            throw new Error("Invalid token address");
        }
    } catch (error) {
        LogError(`Failed to resolve token addresses: ${error}`);
        LogInfo("Make sure tokens are registered (WETH in Beacon, others in TokenManager)");
        process.exit(1);
    }

    // ===== GET POOL BALANCES =====

    LogSection("CHECKING POOL BALANCES");

    // Get token balances from ProxyGeneral
    const erc20Abi = [
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)"
    ];
    
    const tokenFromContract = await ethers.getContractAt(erc20Abi, tokenFromAddress);
    const tokenToContract = await ethers.getContractAt(erc20Abi, tokenToAddress);

    const poolBalanceFrom = await tokenFromContract.balanceOf(proxyGeneralAddress);
    const poolBalanceTo = await tokenToContract.balanceOf(proxyGeneralAddress);

    // Get decimals
    const decimalsFrom = await tokenFromContract.decimals();
    const decimalsTo = await tokenToContract.decimals();

    LogInfo(`${config.tokenFrom} in pool: ${ethers.formatUnits(poolBalanceFrom, decimalsFrom)}`);
    LogInfo(`${config.tokenTo} in pool: ${ethers.formatUnits(poolBalanceTo, decimalsTo)}`);

    if (poolBalanceFrom === 0n) {
        LogError(`No ${config.tokenFrom} in pool to swap!`);
        process.exit(1);
    }

    // Calculate swap amount
    const swapAmount = (poolBalanceFrom * BigInt(config.percentage)) / 100n;

    if (swapAmount === 0n) {
        LogError("Swap amount is 0! Increase percentage or pool balance");
        process.exit(1);
    }

    LogInfo(`Amount to swap: ${ethers.formatUnits(swapAmount, decimalsFrom)} ${config.tokenFrom} (${config.percentage}%)`);

    // ===== ESTIMATE OUTPUT =====

    LogSection("ESTIMATING SWAP OUTPUT");

    let minAmountOut: bigint;

    try {
        // Calculate minimum output with slippage
        const estimatedOut = await swapManager.calculateMinAmountOut(
            config.tokenFrom,
            config.tokenTo,
            swapAmount,
            config.slippage
        );

        minAmountOut = estimatedOut;

        LogInfo(`Estimated output: ${ethers.formatUnits(estimatedOut, decimalsTo)} ${config.tokenTo}`);
        LogInfo(`Min acceptable (with ${config.slippage / 100}% slippage): ${ethers.formatUnits(minAmountOut, decimalsTo)} ${config.tokenTo}`);

    } catch (error) {
        LogWarning(`Could not estimate output: ${error}`);
        LogInfo("Setting minAmountOut to 0 (not recommended!)");
        minAmountOut = 0n;
    }

    // ===== CHECK LIQUIDITY =====

    LogSection("CHECKING SWAP FEASIBILITY");

    try {
        const [canSwapResult, reason] = await swapManager.canSwap(
            config.tokenFrom,
            config.tokenTo,
            swapAmount
        );

        if (!canSwapResult) {
            LogError(`Cannot perform swap: ${reason}`);
            process.exit(1);
        }

        LogSuccess(`Swap is feasible: ${reason || "OK"}`);

    } catch (error) {
        LogWarning(`Could not check feasibility: ${error}`);
        LogInfo("Proceeding anyway...");
    }

    // ===== CALCULATE DEADLINE =====

    const deadline = Math.floor(Date.now() / 1000) + (config.deadlineMinutes * 60);
    LogInfo(`Deadline: ${new Date(deadline * 1000).toISOString()} (${config.deadlineMinutes} minutes)`);

    // ===== CONFIRMATION =====

    LogSection("SWAP SUMMARY");

    console.log(`
╔════════════════════════════════════════════════════════════╗
║                      SWAP CONFIRMATION                      ║
╠════════════════════════════════════════════════════════════╣
║  Sell: ${ethers.formatUnits(swapAmount, decimalsFrom).padEnd(20)} ${config.tokenFrom.padEnd(20)} ║
║  Buy:  ${ethers.formatUnits(minAmountOut, decimalsTo).padEnd(20)} ${config.tokenTo.padEnd(20)} ║
║  Slippage: ${(config.slippage / 100).toFixed(2)}%${" ".repeat(45)}║
║  Plugin: ${activePlugin.padEnd(49)}║
╚════════════════════════════════════════════════════════════╝
    `);

    LogWarning("This transaction will be executed in 5 seconds...");
    LogInfo("Press Ctrl+C to cancel");

    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));

    // ===== EXECUTE SWAP =====

    LogSection("EXECUTING SWAP");

    try {
        LogInfo("Sending transaction...");

        // Use performSwap (with explicit deadline) - only LiquidityManager can call SwapManager
        // So we need to call it through LiquidityManager if it has a swap function
        // Otherwise, we need to check if SwapManager has an owner-only function

        // Check if we can call swapManager directly
        let tx;
        
        try {
            // Try to call performSwap directly (if signer is authorized caller)
            tx = await swapManager.performSwap(
                config.tokenFrom,
                config.tokenTo,
                swapAmount,
                deadline,
                {
                    gasLimit: 2000000 // Set reasonable gas limit
                }
            );
        } catch (error: any) {
            if (error.message.includes("Caller not authorized") || error.message.includes("Ownable")) {
                // If not authorized, we need to use LiquidityManager's function
                LogInfo("Direct call not authorized, checking for LiquidityManager interface...");
                
                // Check if LiquidityManager has a rebalance or swap function
                LogWarning("This swap must be executed through LiquidityManager");
                LogError("LiquidityManager doesn't have a direct swap function for owner");
                LogInfo("You may need to implement a owner-only swap function in SwapManager or LiquidityManager");
                process.exit(1);
            }
            throw error;
        }

        LogInfo(`Transaction hash: ${tx.hash}`);
        LogInfo("Waiting for confirmation...");

        const receipt = await tx.wait(1);

        if (!receipt) {
            throw new Error("No transaction receipt");
        }

        LogSuccess(`Transaction confirmed in block: ${receipt.blockNumber}`);
        LogInfo(`Gas used: ${receipt.gasUsed.toString()}`);

        // ===== PARSE EVENTS =====

        LogSection("CHECKING SWAP RESULTS");

        // Look for SwapExecuted event
        const swapExecutedEvent = receipt.logs.find((log: any) => {
            try {
                const parsed = swapManager.interface.parseLog(log);
                return parsed?.name === "SwapExecuted";
            } catch {
                return false;
            }
        });

        if (swapExecutedEvent) {
            const parsed = swapManager.interface.parseLog(swapExecutedEvent);
            if (parsed) {
                LogSuccess("Swap Executed Event:");
                LogInfo(`  User: ${parsed.args.user}`);
                LogInfo(`  Token In: ${parsed.args.tokenIn}`);
                LogInfo(`  Token Out: ${parsed.args.tokenOut}`);
                LogInfo(`  Amount In: ${ethers.formatUnits(parsed.args.amountIn, decimalsFrom)} ${config.tokenFrom}`);
                LogInfo(`  Amount Out: ${ethers.formatUnits(parsed.args.amountOut, decimalsTo)} ${config.tokenTo}`);
            }
        } else {
            LogWarning("SwapExecuted event not found in receipt");
        }

        // ===== POST-SWAP BALANCES =====

        LogSection("POST-SWAP BALANCES");

        const newPoolBalanceFrom = await tokenFromContract.balanceOf(proxyGeneralAddress);
        const newPoolBalanceTo = await tokenToContract.balanceOf(proxyGeneralAddress);

        LogInfo(`${config.tokenFrom} in pool: ${ethers.formatUnits(newPoolBalanceFrom, decimalsFrom)} (was ${ethers.formatUnits(poolBalanceFrom, decimalsFrom)})`);
        LogInfo(`${config.tokenTo} in pool: ${ethers.formatUnits(newPoolBalanceTo, decimalsTo)} (was ${ethers.formatUnits(poolBalanceTo, decimalsTo)})`);

        const actualSpent = poolBalanceFrom - newPoolBalanceFrom;
        const actualReceived = newPoolBalanceTo - poolBalanceTo;

        LogSuccess(`Actually spent: ${ethers.formatUnits(actualSpent, decimalsFrom)} ${config.tokenFrom}`);
        LogSuccess(`Actually received: ${ethers.formatUnits(actualReceived, decimalsTo)} ${config.tokenTo}`);

        // Calculate actual price
        if (actualSpent > 0n && actualReceived > 0n) {
            const price = (BigInt(actualReceived) * ethers.parseUnits("1", Number(decimalsFrom))) / BigInt(actualSpent);
            LogInfo(`Effective price: ${ethers.formatUnits(price, Number(decimalsTo))} ${config.tokenTo} per ${config.tokenFrom}`);
        }

        // ===== SUCCESS =====

        LogSection("SWAP COMPLETED SUCCESSFULLY");
        LogSuccess("All done! ✨");

    } catch (error: any) {
        LogSection("SWAP FAILED");
        LogError(`Transaction failed: ${error.message}`);

        if (error.message.includes("deadline")) {
            LogInfo("💡 Solution: Increase deadline or retry immediately");
        } else if (error.message.includes("slippage")) {
            LogInfo("💡 Solution: Increase slippage tolerance");
        } else if (error.message.includes("insufficient")) {
            LogInfo("💡 Solution: Check pool liquidity and balances");
        } else if (error.message.includes("Caller not authorized")) {
            LogInfo("💡 Solution: Make sure you are calling from an authorized address");
        }

        process.exit(1);
    }
}

// ==================== EXECUTION ====================

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n💥 Script crashed:", error);
        process.exit(1);
    });
