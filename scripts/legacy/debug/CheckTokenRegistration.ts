/**
 * 🔍 Check Token Registration
 * Verifica quali token sono registrati e attivi nel TokenManager
 */

import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const BEACON_ADDRESS = process.env.BEACON_ADDRESS || "";

async function main() {
    console.log("\n" + "=".repeat(60));
    console.log("  CHECK TOKEN REGISTRATION");
    console.log("=".repeat(60) + "\n");

    const beacon = await ethers.getContractAt("Beacon", BEACON_ADDRESS);
    const tokenManagerAddress = await beacon.getImplementation("TokenManager");
    
    console.log(`TokenManager: ${tokenManagerAddress}\n`);

    const tokenManager = await ethers.getContractAt("TokenManager", tokenManagerAddress);

    // Check common tokens
    const tokensToCheck = ["WETH", "USDC", "USDT", "WBTC", "ARB", "DAI"];

    console.log("Checking token registration:\n");

    for (const tokenCode of tokensToCheck) {
        try {
            const address = await tokenManager.getTokenAddress(tokenCode);
            const isActive = await tokenManager.isTokenActive(tokenCode);
            
            console.log(`${tokenCode.padEnd(6)}: ${address}`);
            console.log(`         Active: ${isActive ? "✅ YES" : "❌ NO"}\n`);
            
        } catch (error: any) {
            console.log(`${tokenCode.padEnd(6)}: ❌ Not registered\n`);
        }
    }

    // Get all active tokens
    console.log("=".repeat(60));
    console.log("Getting all active tokens:");
    console.log("=".repeat(60) + "\n");

    try {
        const activeTokens = await tokenManager.getActiveTokens();
        
        if (activeTokens.length === 0) {
            console.log("❌ No active tokens found!\n");
            console.log("You need to add tokens with:");
            console.log("  npx hardhat run scripts/admin/tokens/AddToken.ts --network arbitrum\n");
        } else {
            console.log(`Found ${activeTokens.length} active token(s):\n`);
            
            for (const tokenCode of activeTokens) {
                try {
                    const address = await tokenManager.getTokenAddress(tokenCode);
                    console.log(`  ${tokenCode}: ${address}`);
                } catch (error) {
                    console.log(`  ${tokenCode}: Error getting address`);
                }
            }
            console.log("");
        }
    } catch (error: any) {
        console.log(`❌ Error getting active tokens: ${error.message}\n`);
    }

    // Arbitrum mainnet token addresses for reference
    console.log("=".repeat(60));
    console.log("Arbitrum Mainnet Token Addresses (for reference):");
    console.log("=".repeat(60) + "\n");

    const mainnetTokens = {
        "WETH": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        "USDC": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        "USDT": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        "WBTC": "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
        "ARB": "0x912CE59144191C1204E64559FE8253a0e49E6548",
        "DAI": "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1"
    };

    for (const [symbol, address] of Object.entries(mainnetTokens)) {
        console.log(`${symbol.padEnd(6)}: ${address}`);
    }
    console.log("");

    console.log("To add a token:");
    console.log(`  TOKEN_CODE=WETH TOKEN_ADDRESS=0x82aF...Bab1 npx hardhat run scripts/admin/tokens/AddToken.ts --network arbitrum\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n💥 Error:", error.message);
        process.exit(1);
    });
