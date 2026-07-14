/**
 * @file test-leverage-close.ts
 * @description Test close leverage position atomically (via FlashLoanService)
 * 
 * Chiude posizione leverage atomicamente usando flash loan Balancer V2 (0% fee!)
 * 
 * FLUSSO ATOMICO:
 * 1. Flash loan USDC da Balancer (per ripagare debt)
 * 2. Repay USDC debt in Euler
 * 3. Withdraw all WETH da Euler
 * 4. Swap WETH → USDC
 * 5. Repay flash loan
 * 6. Return remaining USDC equity to ProxyGeneral
 * → Tutto in 1 tx!
 * 
 * PREREQUISITI:
 * - Leverage position esistente (run test-leverage-open.ts first)
 * - FlashLoanService deployato
 * 
 * USAGE:
 *   # Default: 2% slippage
 *   npx hardhat run scripts/testing/test-leverage-close.ts --network arbitrum
 *   
 *   # Custom slippage
 *   SLIPPAGE=300 npx hardhat run scripts/testing/test-leverage-close.ts --network arbitrum
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../config/arbitrum.config";
import { formatAmount, verifyArbitrumMainnet, loadDeployment } from "../utils/euler-helpers";

async function main() {
    console.log("\n" + "=".repeat(70));
    console.log("⚡ EULER V2 - CLOSE LEVERAGE (ATOMIC)");
    console.log("=".repeat(70));

    // ==================== SETUP ====================
    await verifyArbitrumMainnet();
    
    const [deployer] = await ethers.getSigners();
    
    // Get plugin address
    let pluginAddress = process.env.PLUGIN_ADDRESS || loadDeployment("EulerV2Plugin");
    if (!pluginAddress) {
        throw new Error("❌ PLUGIN_ADDRESS not found!");
    }
    
    // Get parameters
    const maxSlippageBps = parseInt(process.env.SLIPPAGE || "200"); // Default 2% (200 bps)
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour
    
    console.log(`\n📍 Plugin: ${pluginAddress}`);
    console.log(`   Max Slippage: ${maxSlippageBps/100}%`);

    // ==================== GET CONTRACTS ====================
    const eulerPlugin = await ethers.getContractAt(
        [
            "function closeLeverageAtomic((string collateralToken, string borrowToken, uint256 maxSlippageBps, uint256 deadline)) external"
        ],
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

    // ==================== 1. CHECK CURRENT POSITION ====================
    console.log(`\n📊 Checking current position...`);
    
    const sharesBefore = await wethVault.balanceOf(pluginAddress);
    const collateralBefore = await wethVault.convertToAssets(sharesBefore);
    const debtBefore = await usdcVault.debtOf(pluginAddress);
    
    console.log(`   WETH Collateral: ${formatAmount(collateralBefore)}`);
    console.log(`   USDC Debt: ${formatAmount(debtBefore, 6)}`);
    
    if (debtBefore === 0n) {
        console.log("\n   ❌ No leverage position to close!");
        console.log("   💡 Hint: Run test-leverage-open.ts first");
        process.exit(1);
    }
    
    const usdcBalanceBefore = await usdc.balanceOf(ARBITRUM_ADDRESSES.PROXY_GENERAL);
    console.log(`   ProxyGeneral USDC: ${formatAmount(usdcBalanceBefore, 6)}`);

    // ==================== 2. CLOSE LEVERAGE ATOMICALLY ====================
    console.log(`\n⚡ Closing leverage via FlashLoanService...`);
    console.log(`   This will:
      1. Flash loan USDC from Balancer (to repay debt)
      2. Repay USDC debt in Euler
      3. Withdraw all WETH from Euler
      4. Swap WETH → USDC
      5. Repay flash loan
      6. Return equity to ProxyGeneral
   → All in 1 atomic transaction!`);
    
    const tx = await eulerPlugin.closeLeverageAtomic({
        collateralToken: "WETH",
        borrowToken: "USDC",
        maxSlippageBps: maxSlippageBps,
        deadline: deadline
    });
    
    const receipt = await tx.wait();
    
    console.log(`\n   ✅ Leverage closed ATOMICALLY!`);
    console.log(`   Tx: ${receipt?.hash}`);
    console.log(`   Gas Used: ${receipt?.gasUsed.toString()}`);

    // ==================== 3. CHECK FINAL POSITION ====================
    console.log(`\n📊 Checking final position...`);
    
    const sharesAfter = await wethVault.balanceOf(pluginAddress);
    const collateralAfter = await wethVault.convertToAssets(sharesAfter);
    const debtAfter = await usdcVault.debtOf(pluginAddress);
    
    console.log(`   WETH Collateral: ${formatAmount(collateralAfter)}`);
    console.log(`   USDC Debt: ${formatAmount(debtAfter, 6)}`);

    // ==================== 4. CHECK RETURNED EQUITY ====================
    console.log(`\n💰 Checking returned equity...`);
    
    const usdcBalanceAfter = await usdc.balanceOf(ARBITRUM_ADDRESSES.PROXY_GENERAL);
    const usdcReturned = usdcBalanceAfter - usdcBalanceBefore;
    
    console.log(`   USDC Returned: ${formatAmount(usdcReturned, 6)}`);
    console.log(`   ProxyGeneral USDC: ${formatAmount(usdcBalanceAfter, 6)}`);

    // ==================== 5. VERIFY CLEAN STATE ====================
    console.log(`\n✅ Verifying clean state...`);
    
    const debtCleared = debtAfter === 0n;
    const collateralMinimal = collateralAfter < ethers.parseEther("0.01"); // Less than 0.01 WETH dust
    
    console.log(`   Debt Cleared: ${debtCleared ? "✅" : "⚠️ " + formatAmount(debtAfter, 6) + " USDC remaining"}`);
    console.log(`   Collateral Minimal: ${collateralMinimal ? "✅" : "⚠️ " + formatAmount(collateralAfter) + " WETH remaining"}`);
    
    if (!debtCleared) {
        console.log(`   ℹ️  Note: Small dust may remain due to interest accrual or rounding`);
    }

    // ==================== SUMMARY ====================
    console.log("\n" + "=".repeat(70));
    console.log("✅ LEVERAGE CLOSED!");
    console.log("=".repeat(70));
    console.log(`\nPosition Before:`);
    console.log(`   Collateral: ${formatAmount(collateralBefore)} WETH`);
    console.log(`   Debt: ${formatAmount(debtBefore, 6)} USDC`);
    console.log(`\nPosition After:`);
    console.log(`   Collateral: ${formatAmount(collateralAfter)} WETH`);
    console.log(`   Debt: ${formatAmount(debtAfter, 6)} USDC`);
    console.log(`\nEquity Returned:`);
    console.log(`   USDC: ${formatAmount(usdcReturned, 6)} (to ProxyGeneral)`);
    console.log(`\nGas Used: ${receipt?.gasUsed.toString()}`);
    console.log("\n💡 Features Used:");
    console.log("   • Balancer V2 flash loans (0% fee)");
    console.log("   • SimpleSwap (Uniswap V3)");
    console.log("   • Atomic execution (all or nothing)");
    console.log("   • Full position closure in 1 tx");
    console.log("\n💡 Next Steps:");
    console.log("   npx hardhat run scripts/testing/check-position.ts --network arbitrum");
    
    if (usdcReturned > 0n) {
        console.log(`\n💰 You received ${formatAmount(usdcReturned, 6)} USDC equity!`);
    }
    
    console.log("=".repeat(70) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Test failed:");
        console.error(error);
        process.exit(1);
    });
