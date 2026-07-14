/**
 * 🔄 QUICK SWAP SCRIPT
 * 
 * Script semplificato per swap comuni dal pool
 * Usa configurazioni predefinite per velocità
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Colori per output
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    red: "\x1b[31m"
};

function log(message: string, color: string = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function header(title: string) {
    console.log("\n" + "=".repeat(60));
    log(`  ${title}`, colors.bright);
    console.log("=".repeat(60) + "\n");
}

// Preset di swap comuni
const SWAP_PRESETS = {
    "1": {
        name: "50% WETH → USDC",
        from: "WETH",
        to: "USDC",
        percentage: 50,
        slippage: 300
    },
    "2": {
        name: "50% USDC → WETH",
        from: "USDC",
        to: "WETH",
        percentage: 50,
        slippage: 300
    },
    "3": {
        name: "25% WETH → USDC (conservative)",
        from: "WETH",
        to: "USDC",
        percentage: 25,
        slippage: 200
    },
    "4": {
        name: "75% USDC → WETH (aggressive)",
        from: "USDC",
        to: "WETH",
        percentage: 75,
        slippage: 500
    },
    "5": {
        name: "50% WETH → WBTC",
        from: "WETH",
        to: "WBTC",
        percentage: 50,
        slippage: 300
    },
    "6": {
        name: "50% WBTC → WETH",
        from: "WBTC",
        to: "WETH",
        percentage: 50,
        slippage: 300
    },
    "7": {
        name: "30% USDC → WBTC",
        from: "USDC",
        to: "WBTC",
        percentage: 30,
        slippage: 500
    },
    "8": {
        name: "30% WBTC → USDC",
        from: "WBTC",
        to: "USDC",
        percentage: 30,
        slippage: 500
    }
};

async function main() {
    header("🔄 QUICK SWAP - Preset Manager");

    log("Available swap presets:", colors.blue);
    console.log("");

    // Mostra tutti i preset
    Object.entries(SWAP_PRESETS).forEach(([key, preset]) => {
        console.log(`  ${colors.bright}[${key}]${colors.reset} ${preset.name}`);
        console.log(`      ${preset.from} → ${preset.to} | ${preset.percentage}% | Slippage: ${preset.slippage / 100}%\n`);
    });

    // Custom option
    log(`  ${colors.bright}[9]${colors.reset} Custom swap (use environment variables)`, colors.yellow);
    log(`  ${colors.bright}[0]${colors.reset} Exit`, colors.red);
    console.log("");

    // Ottieni scelta utente
    const choice = process.argv[2];

    if (!choice) {
        log("❌ Usage: npx ts-node scripts/interact/QuickSwap.ts [preset_number]", colors.red);
        log("\nExample: npx ts-node scripts/interact/QuickSwap.ts 1", colors.yellow);
        process.exit(1);
    }

    if (choice === "0") {
        log("👋 Exiting...", colors.yellow);
        process.exit(0);
    }

    const preset = SWAP_PRESETS[choice as keyof typeof SWAP_PRESETS];

    if (!preset && choice !== "9") {
        log(`❌ Invalid choice: ${choice}`, colors.red);
        log("Please select a number between 0 and 9", colors.yellow);
        process.exit(1);
    }

    if (choice === "9") {
        header("CUSTOM SWAP");
        log("Using environment variables:", colors.blue);
        log(`  SWAP_TOKEN_FROM=${process.env.SWAP_TOKEN_FROM || "not set"}`);
        log(`  SWAP_TOKEN_TO=${process.env.SWAP_TOKEN_TO || "not set"}`);
        log(`  SWAP_PERCENTAGE=${process.env.SWAP_PERCENTAGE || "not set"}`);
        log(`  SWAP_SLIPPAGE=${process.env.SWAP_SLIPPAGE || "not set"}`);
        console.log("");

        if (!process.env.SWAP_TOKEN_FROM || !process.env.SWAP_TOKEN_TO) {
            log("❌ SWAP_TOKEN_FROM and SWAP_TOKEN_TO must be set!", colors.red);
            log("\nExample:", colors.yellow);
            log("SWAP_TOKEN_FROM=WETH SWAP_TOKEN_TO=USDC SWAP_PERCENTAGE=30 npx ts-node scripts/interact/QuickSwap.ts 9");
            process.exit(1);
        }

        // Execute with custom env vars
        await executeSwap();

    } else {
        // Execute preset
        header(`EXECUTING: ${preset.name}`);
        
        log("Configuration:", colors.blue);
        log(`  From: ${preset.from}`);
        log(`  To: ${preset.to}`);
        log(`  Amount: ${preset.percentage}% of pool balance`);
        log(`  Slippage: ${preset.slippage / 100}%`);
        log(`  Deadline: 20 minutes`);
        console.log("");

        await executeSwap(preset);
    }
}

async function executeSwap(preset?: any) {
    try {
        log("🚀 Launching swap script...\n", colors.green);

        const env: Record<string, string> = {
            ...process.env
        };

        if (preset) {
            env.SWAP_TOKEN_FROM = preset.from;
            env.SWAP_TOKEN_TO = preset.to;
            env.SWAP_PERCENTAGE = preset.percentage.toString();
            env.SWAP_SLIPPAGE = preset.slippage.toString();
        }

        const command = "npx hardhat run scripts/interact/SwapPoolTokens.ts --network arbitrum";
        
        log(`Executing: ${command}`, colors.blue);
        console.log("");

        const { stdout, stderr } = await execAsync(command, {
            env,
            maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        });

        if (stdout) {
            console.log(stdout);
        }

        if (stderr) {
            log("Warnings:", colors.yellow);
            console.log(stderr);
        }

        log("\n✅ Swap completed successfully!", colors.green);

    } catch (error: any) {
        log("\n❌ Swap failed!", colors.red);
        console.error(error.message);
        
        if (error.stdout) {
            console.log("\nOutput:");
            console.log(error.stdout);
        }
        
        if (error.stderr) {
            console.log("\nErrors:");
            console.log(error.stderr);
        }

        process.exit(1);
    }
}

// Execute
main().catch((error) => {
    console.error("💥 Script crashed:", error);
    process.exit(1);
});
