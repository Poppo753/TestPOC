/**
 * @file euler-helpers.ts
 * @description Helper functions per script Euler V2
 * 
 * Funzioni riutilizzabili per:
 * - Formattazione importi
 * - Health check posizioni
 * - Salvataggio deployment
 * - Verifica stato EVC
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Format amount con decimali corretti
 */
export function formatAmount(amount: bigint, decimals: number = 18): string {
    return Number(ethers.formatUnits(amount, decimals)).toFixed(4);
}

/**
 * Check health di una posizione Euler
 */
export async function checkHealth(
    pluginAddress: string,
    wethVault: any,
    usdcVault: any,
    accountLens: any
): Promise<{ healthFactor: bigint; collateral: bigint; debt: bigint }> {
    try {
        const shares = await wethVault.balanceOf(pluginAddress);
        const collateral = await wethVault.convertToAssets(shares);
        const debt = await usdcVault.debtOf(pluginAddress);
        
        let healthFactor = 0n;
        
        if (debt > 0n) {
            const info = await accountLens.getAccountLiquidityInfo(
                pluginAddress,
                await usdcVault.getAddress()
            );
            
            if (info.liabilityValueBorrowing > 0n) {
                healthFactor = (info.collateralValueBorrowing * ethers.parseEther("1")) / 
                              info.liabilityValueBorrowing;
            }
        }
        
        return { healthFactor, collateral, debt };
    } catch (error: any) {
        console.error(`❌ Error checking health: ${error.message}`);
        return { healthFactor: 0n, collateral: 0n, debt: 0n };
    }
}

/**
 * Calcola leverage da posizione
 */
export function calculateLeverage(collateral: bigint, debt: bigint, ethPrice: number = 3000): number {
    if (debt === 0n || collateral === 0n) return 1.0;
    
    // Convert USDC debt to WETH (debt has 6 decimals, need to match WETH 18 decimals)
    const debtInWeth = (debt * BigInt(10 ** 12)) / BigInt(ethPrice);
    
    // Equity = Collateral - Debt (in WETH)
    const equity = collateral > debtInWeth ? collateral - debtInWeth : 1n;
    
    // Leverage = Collateral / Equity
    return Number(collateral) / Number(equity);
}

/**
 * Salva deployment in mainnet-latest.json
 */
export async function saveDeployment(
    contractName: string,
    address: string,
    deployer: string,
    extraData?: any
): Promise<void> {
    const deploymentPath = path.join(__dirname, "../../../../deployments/mainnet-latest.json");
    
    let deployment: any = {};
    
    // Read existing deployment
    if (fs.existsSync(deploymentPath)) {
        const content = fs.readFileSync(deploymentPath, "utf8");
        deployment = JSON.parse(content);
    }
    
    // Add new contract
    deployment[contractName] = {
        address,
        deployer,
        timestamp: new Date().toISOString(),
        ...extraData
    };
    
    // Save
    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
    console.log(`✅ Saved ${contractName} to mainnet-latest.json`);
}

/**
 * Load deployment address from mainnet-latest.json
 */
export function loadDeployment(contractName: string): string | null {
    const deploymentPath = path.join(__dirname, "../../../../deployments/mainnet-latest.json");
    
    if (!fs.existsSync(deploymentPath)) {
        return null;
    }
    
    const content = fs.readFileSync(deploymentPath, "utf8");
    const deployment = JSON.parse(content);
    
    return deployment[contractName]?.address || null;
}

/**
 * Print health factor con emoji status
 */
export function printHealthFactor(healthFactor: bigint): void {
    if (healthFactor === 0n) {
        console.log("   Health Factor: ∞ (no debt)");
        return;
    }
    
    const healthNum = Number(ethers.formatEther(healthFactor));
    
    let emoji = "🟢"; // Healthy > 1.5
    if (healthNum < 1.05) {
        emoji = "🔴"; // Critical
    } else if (healthNum < 1.3) {
        emoji = "🟡"; // Warning
    }
    
    console.log(`   ${emoji} Health Factor: ${healthNum.toFixed(2)}x`);
}

/**
 * Verify network is Arbitrum mainnet
 */
export async function verifyArbitrumMainnet(): Promise<void> {
    const network = await ethers.provider.getNetwork();
    
    if (network.chainId !== 42161n) {
        throw new Error(`❌ Wrong network! Expected Arbitrum (42161), got ${network.chainId}`);
    }
    
    console.log("✅ Network: Arbitrum Mainnet (42161)");
}

/**
 * Get signer balance and verify sufficient funds
 */
export async function checkSignerBalance(minBalance: string = "0.001"): Promise<void> {
    const [signer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(await signer.getAddress());
    const minBalanceBigInt = ethers.parseEther(minBalance);
    
    console.log(`Signer: ${await signer.getAddress()}`);
    console.log(`Balance: ${ethers.formatEther(balance)} ETH`);
    
    if (balance < minBalanceBigInt) {
        throw new Error(`❌ Insufficient balance! Need at least ${minBalance} ETH`);
    }
    
    console.log("✅ Balance sufficient");
}
