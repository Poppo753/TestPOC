/**
 * @file test-borrow.ts
 * @description Test borrow USDC against WETH collateral
 * 
 * Borrow USDC usando WETH come collaterale e verifica:
 * - Auto-enable controller
 * - Debt creato
 * - Health factor
 * 
 * PREREQUISITI:
 * - WETH depositato come collateral (run test-deposit.ts first)
 * 
 * USAGE:
 *   # Default 0.1 USDC
 *   npx hardhat run scripts/testing/test-borrow.ts --network arbitrum
 *   
 *   # Custom amount
 *   AMOUNT=1.0 npx hardhat run scripts/testing/test-borrow.ts --network arbitrum
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../config/arbitrum.config";
import { formatAmount, verifyArbitrumMainnet, loadDeployment } from "../utils/plugins/euler/euler-helpers";

async function main() {
    console.log("\n" + "=".repeat(70));
    console.log("💳 EULER V2 - BORROW TEST");
    console.log("=".repeat(70));

    // ==================== SETUP ====================
    await verifyArbitrumMainnet();
    
    const [deployer] = await ethers.getSigners();
    
    // Get plugin address
    let pluginAddress = process.env.PLUGIN_ADDRESS || loadDeployment("EulerV2Plugin");
    if (!pluginAddress) {
        throw new Error("❌ PLUGIN_ADDRESS not found!");
    }
    
    // Get amount (default 0.1 USDC)
    const amountStr = process.env.AMOUNT || "0.1";
    const amount = ethers.parseUnits(amountStr, 6); // USDC has 6 decimals
    
    console.log(`\n📍 Plugin: ${pluginAddress}`);
    console.log(`   Amount: ${amountStr} USDC`);

    // ==================== GET CONTRACTS ====================
    const eulerPlugin = await ethers.getContractAt(
        ["function borrow(string memory tokenSymbol, uint256 amount) external"],
        pluginAddress,
        deployer
    );
    
    const wethVault = await ethers.getContractAt(
        [
            "function balanceOf(address) view returns (uint256)",
            "function convertToAssets(uint256) view returns (uint256)"
        ],
        ARBITRUM_ADDRESSES.WETH_VAULT
    );
    
    const usdcVault = await ethers.getContractAt(
        ["function debtOf(address) view returns (uint256)"],
        ARBITRUM_ADDRESSES.USDC_VAULT
    );
    
    const usdc = await ethers.getContractAt(
        "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
        ARBITRUM_ADDRESSES.USDC
    );
    
    const evc = await ethers.getContractAt(
        ["function isControllerEnabled(address, address) view returns (bool)"],
        ARBITRUM_ADDRESSES.EVC
    );
    
    const accountLens = await ethers.getContractAt(
        [
            "function getAccountLiquidityInfo(address account, address vault) external view returns ((bool, bytes, address, address, address, int256, uint256, uint256, uint256, uint256, uint256, address[], uint256[], uint256[], uint256[]))"
        ],
        ARBITRUM_ADDRESSES.ACCOUNT_LENS
    );

    // ==================== 1. CHECK COLLATERAL ====================
    console.log(`\n📊 Checking collateral...`);
    
    const shares = await wethVault.balanceOf(pluginAddress);
    const collateral = await wethVault.convertToAssets(shares);
    
    console.log(`   WETH Shares: ${formatAmount(shares)}`);
    console.log(`   Collateral: ${formatAmount(collateral)} WETH`);
    
    if (collateral === 0n) {
        throw new Error("❌ No collateral! Run test-deposit.ts first.");
    }
    
    console.log("   ✅ Collateral exists");

    // ==================== 2. CHECK MAX BORROW CAPACITY ====================
    console.log(`\n📊 Checking max borrow capacity...`);
    
    try {
        const info = await accountLens.getAccountLiquidityInfo(
            pluginAddress,
            ARBITRUM_ADDRESSES.USDC_VAULT
        );
        
        const maxBorrowValue = info.collateralValueBorrowing > info.liabilityValueBorrowing 
            ? info.collateralValueBorrowing - info.liabilityValueBorrowing 
            : 0n;
        
        console.log(`   Max Borrow Capacity: $${formatAmount(maxBorrowValue, 18)}`);
        
        // Rough check: amount in USD should be less than max capacity
        const amountUSD = amount; // 1 USDC ≈ $1 (6 decimals, need to match 18 decimals)
        const amountUSD18 = amountUSD * BigInt(10 ** 12);
        
        if (amountUSD18 > maxBorrowValue) {
            throw new Error(`❌ Borrow amount exceeds capacity! Max: $${formatAmount(maxBorrowValue, 18)}, Requested: $${amountStr}`);
        }
    } catch (error: any) {
        console.log(`   ⚠️  Could not check capacity: ${error.message}`);
    }

    // ==================== 3. BORROW ====================
    console.log(`\n💳 Borrowing ${amountStr} USDC...`);
    
    const tx = await eulerPlugin.borrow("USDC", amount);
    const receipt = await tx.wait();
    
    // Wait for nonce sync
    await new Promise(r => setTimeout(r, 2000));
    
    console.log(`   Tx: ${receipt?.hash}`);
    console.log(`   Gas Used: ${receipt?.gasUsed.toString()}`);

    // ==================== 4. VERIFY RESULTS ====================
    console.log(`\n✅ Verifying borrow...`);
    
    const proxyUsdc = await usdc.balanceOf(ARBITRUM_ADDRESSES.PROXY_GENERAL);
    const debt = await usdcVault.debtOf(pluginAddress);
    
    console.log(`   ProxyGeneral USDC: ${formatAmount(proxyUsdc, 6)}`);
    console.log(`   Plugin Debt: ${formatAmount(debt, 6)} USDC`);
    
    if (debt === 0n) {
        throw new Error("❌ Borrow failed! No debt created.");
    }

    // ==================== 5. VERIFY AUTO-ENABLED CONTROLLER ====================
    console.log(`\n🔒 Verifying auto-enabled controller...`);
    
    const isController = await evc.isControllerEnabled(pluginAddress, ARBITRUM_ADDRESSES.USDC_VAULT);
    console.log(`   Controller Enabled: ${isController ? "✅ YES" : "❌ NO"}`);
    
    if (!isController) {
        throw new Error("❌ Controller not auto-enabled!");
    }

    // ==================== 6. CHECK HEALTH ====================
    console.log(`\n🏥 Checking health factor...`);
    
    try {
        const info = await accountLens.getAccountLiquidityInfo(
            pluginAddress,
            ARBITRUM_ADDRESSES.USDC_VAULT
        );
        
        if (info.liabilityValueBorrowing > 0n) {
            const healthFactor = (info.collateralValueBorrowing * ethers.parseEther("1")) / 
                                info.liabilityValueBorrowing;
            const healthNum = Number(ethers.formatEther(healthFactor));
            
            let emoji = "🟢";
            if (healthNum < 1.05) emoji = "🔴";
            else if (healthNum < 1.3) emoji = "🟡";
            
            console.log(`   ${emoji} Health: ${healthNum.toFixed(2)}x`);
            
            if (healthNum < 1.05) {
                console.log(`   ⚠️  CRITICAL: Position at risk!`);
            }
        }
    } catch (error: any) {
        console.log(`   ⚠️  Could not check health: ${error.message}`);
    }

    // ==================== SUMMARY ====================
    console.log("\n" + "=".repeat(70));
    console.log("✅ BORROW SUCCESSFUL!");
    console.log("=".repeat(70));
    console.log(`\nBorrowed: ${amountStr} USDC`);
    console.log(`Current Debt: ${formatAmount(debt, 6)} USDC`);
    console.log(`Controller Enabled: ✅`);
    console.log(`USDC sent to: ProxyGeneral (${ARBITRUM_ADDRESSES.PROXY_GENERAL})`);
    console.log("\n💡 Next Steps:");
    console.log("   npx hardhat run scripts/testing/check-position.ts --network arbitrum");
    console.log("   npx hardhat run scripts/testing/test-repay.ts --network arbitrum");
    console.log("=".repeat(70) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Test failed:");
        console.error(error);
        process.exit(1);
    });
