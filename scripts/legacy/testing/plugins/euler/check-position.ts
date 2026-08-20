/**
 * @file check-position.ts
 * @description View Euler V2 position state (READ-ONLY, no gas cost)
 * 
 * Mostra stato completo della posizione:
 * - Vault shares & collateral
 * - Debt
 * - Health factor
 * - Leverage
 * - EVC status (collateral/controller enabled)
 * 
 * USAGE:
 *   npx hardhat run scripts/testing/check-position.ts --network arbitrum
 *   
 *   # Con plugin custom:
 *   PLUGIN_ADDRESS=0x... npx hardhat run scripts/testing/check-position.ts --network arbitrum
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../config/arbitrum.config";
import { formatAmount, calculateLeverage, printHealthFactor, verifyArbitrumMainnet, loadDeployment } from "../utils/euler-helpers";

async function main() {
    console.log("\n" + "=".repeat(70));
    console.log("📊 EULER V2 - POSITION STATUS");
    console.log("=".repeat(70));

    // ==================== SETUP ====================
    await verifyArbitrumMainnet();
    
    const [signer] = await ethers.getSigners();
    
    // Get plugin address (from env or deployment file)
    let pluginAddress = process.env.PLUGIN_ADDRESS;
    if (!pluginAddress) {
        pluginAddress = loadDeployment("EulerV2Plugin");
        if (!pluginAddress) {
            throw new Error("❌ PLUGIN_ADDRESS not found! Set env var or deploy first.");
        }
    }
    
    console.log(`\n📍 Plugin: ${pluginAddress}`);

    // ==================== GET CONTRACTS ====================
    const wethVault = await ethers.getContractAt(
        [
            "function balanceOf(address) view returns (uint256)",
            "function convertToAssets(uint256 shares) view returns (uint256)",
            "function maxWithdraw(address) view returns (uint256)"
        ],
        ARBITRUM_ADDRESSES.WETH_VAULT,
        signer
    );
    
    const usdcVault = await ethers.getContractAt(
        [
            "function debtOf(address) view returns (uint256)"
        ],
        ARBITRUM_ADDRESSES.USDC_VAULT,
        signer
    );
    
    const evc = await ethers.getContractAt(
        [
            "function isCollateralEnabled(address, address) view returns (bool)",
            "function isControllerEnabled(address, address) view returns (bool)"
        ],
        ARBITRUM_ADDRESSES.EVC,
        signer
    );
    
    const accountLens = await ethers.getContractAt(
        [
            "function getAccountLiquidityInfo(address account, address vault) external view returns ((bool, bytes, address, address, address, int256, uint256, uint256, uint256, uint256, uint256, address[], uint256[], uint256[], uint256[]))"
        ],
        ARBITRUM_ADDRESSES.ACCOUNT_LENS,
        signer
    );

    // ==================== 1. VAULT SHARES & COLLATERAL ====================
    console.log(`\n💰 WETH Collateral:`);
    
    const shares = await wethVault.balanceOf(pluginAddress);
    const collateral = await wethVault.convertToAssets(shares);
    const maxWithdraw = await wethVault.maxWithdraw(pluginAddress);
    
    console.log(`   Vault Shares: ${formatAmount(shares)} eWETH`);
    console.log(`   Asset Value:  ${formatAmount(collateral)} WETH`);
    console.log(`   Max Withdraw: ${formatAmount(maxWithdraw)} WETH`);

    // ==================== 2. DEBT ====================
    console.log(`\n💳 USDC Debt:`);
    
    const debt = await usdcVault.debtOf(pluginAddress);
    console.log(`   Current Debt: ${formatAmount(debt, 6)} USDC`);

    // ==================== 3. HEALTH FACTOR ====================
    if (debt > 0n) {
        console.log(`\n🏥 Health Factor:`);
        
        try {
            const info = await accountLens.getAccountLiquidityInfo(
                pluginAddress,
                ARBITRUM_ADDRESSES.USDC_VAULT
            );
            
            const collateralValue = info.collateralValueBorrowing;
            const liabilityValue = info.liabilityValueBorrowing;
            
            if (liabilityValue > 0n) {
                const healthFactor = (collateralValue * ethers.parseEther("1")) / liabilityValue;
                const healthNum = Number(ethers.formatEther(healthFactor));
                
                let emoji = "🟢"; // Healthy > 1.5
                if (healthNum < 1.05) {
                    emoji = "🔴"; // Critical
                } else if (healthNum < 1.3) {
                    emoji = "🟡"; // Warning
                }
                
                console.log(`   ${emoji} Health: ${healthNum.toFixed(2)}x`);
                console.log(`   Collateral Value: $${formatAmount(collateralValue, 18)}`);
                console.log(`   Liability Value:  $${formatAmount(liabilityValue, 18)}`);
                
                if (healthNum < 1.05) {
                    console.log(`   ⚠️  CRITICAL: Position at risk of liquidation!`);
                } else if (healthNum < 1.3) {
                    console.log(`   ⚠️  WARNING: Low health factor`);
                }
            }
        } catch (error: any) {
            console.log(`   ❌ Error getting health: ${error.message}`);
        }
    } else {
        console.log(`\n🏥 Health Factor: ∞ (no debt)`);
    }

    // ==================== 4. LEVERAGE ====================
    if (debt > 0n && collateral > 0n) {
        console.log(`\n📊 Leverage:`);
        
        const leverage = calculateLeverage(collateral, debt);
        console.log(`   Current: ${leverage.toFixed(2)}x`);
        
        if (leverage > 3.0) {
            console.log(`   ⚠️  HIGH: Leverage above 3x`);
        }
    }

    // ==================== 5. EVC STATUS ====================
    console.log(`\n🔒 EVC Status:`);
    
    const isCollateral = await evc.isCollateralEnabled(pluginAddress, ARBITRUM_ADDRESSES.WETH_VAULT);
    const isController = await evc.isControllerEnabled(pluginAddress, ARBITRUM_ADDRESSES.USDC_VAULT);
    
    console.log(`   WETH Collateral Enabled: ${isCollateral ? "✅" : "❌"}`);
    console.log(`   USDC Controller Enabled: ${isController ? "✅" : "❌"}`);

    // ==================== SUMMARY ====================
    console.log("\n" + "=".repeat(70));
    
    if (shares === 0n && debt === 0n) {
        console.log("✅ Position: EMPTY (no collateral, no debt)");
    } else if (debt === 0n) {
        console.log("✅ Position: COLLATERAL ONLY (no debt)");
    } else {
        console.log("✅ Position: ACTIVE (collateral + debt)");
    }
    
    console.log("=".repeat(70) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Check failed:");
        console.error(error);
        process.exit(1);
    });
