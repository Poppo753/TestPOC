/**
 * @file test-leverage-open.ts
 * @description Test open leverage position atomically (via FlashLoanService)
 * 
 * Apre posizione leverage 2x atomicamente usando flash loan Balancer V2 (0% fee!)
 * 
 * FLUSSO ATOMICO:
 * 1. Flash loan USDC da Balancer
 * 2. Swap USDC → WETH
 * 3. Deposit WETH in Euler (auto-enable collateral)
 * 4. Borrow USDC da Euler (auto-enable controller)
 * 5. Repay flash loan
 * → Tutto in 1 tx!
 * 
 * PREREQUISITI:
 * - FlashLoanService deployato e registrato in Beacon
 * - WETH in ProxyGeneral per collateral iniziale
 * 
 * USAGE:
 *   # Default: 0.3 WETH, 2x leverage
 *   npx hardhat run scripts/testing/test-leverage-open.ts --network arbitrum
 *   
 *   # Custom: 0.1 WETH, 3x leverage
 *   COLLATERAL=0.1 LEVERAGE=300 npx hardhat run scripts/testing/test-leverage-open.ts --network arbitrum
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../config/arbitrum.config";
import { formatAmount, calculateLeverage, verifyArbitrumMainnet, loadDeployment } from "../utils/euler-helpers";

async function main() {
    console.log("\n" + "=".repeat(70));
    console.log("⚡ EULER V2 - OPEN LEVERAGE (ATOMIC)");
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
    const collateralStr = process.env.COLLATERAL || "0.0001"; // Default 0.0001 WETH (minimal test)
    const leverageX100 = parseInt(process.env.LEVERAGE || "200"); // Default 2x (200)
    const minHealthStr = process.env.MIN_HEALTH || "1.05"; // Default 1.05x
    
    const collateralAmount = ethers.parseEther(collateralStr);
    const minHealthFactor = ethers.parseEther(minHealthStr);
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour
    
    console.log(`\n📍 Plugin: ${pluginAddress}`);
    console.log(`   Collateral: ${collateralStr} WETH`);
    console.log(`   Target Leverage: ${leverageX100/100}x`);
    console.log(`   Min Health Factor: ${minHealthStr}x`);

    // ==================== GET CONTRACTS ====================
    const eulerPlugin = await ethers.getContractAt(
        [
            "function openLeverageAtomic((string collateralToken, string borrowToken, uint256 collateralAmount, uint256 targetLeverageX100, uint256 minHealthFactor, uint256 deadline)) external"
        ],
        pluginAddress,
        deployer
    );
    
    const proxyGeneral = await ethers.getContractAt(
        ["function transferToModule(address token, address module, uint256 amount) external"],
        ARBITRUM_ADDRESSES.PROXY_GENERAL,
        deployer
    );
    
    const weth = await ethers.getContractAt(
        "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
        ARBITRUM_ADDRESSES.WETH
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
    
    const accountLens = await ethers.getContractAt(
        [
            "function getAccountLiquidityInfo(address account, address vault) external view returns ((bool, bytes, address, address, address, int256, uint256, uint256, uint256, uint256, uint256, address[], uint256[], uint256[], uint256[]))"
        ],
        ARBITRUM_ADDRESSES.ACCOUNT_LENS
    );

    // ==================== 1. CHECK PROXY WETH ====================
    console.log(`\n📊 Checking ProxyGeneral WETH...`);
    
    const proxyWeth = await weth.balanceOf(ARBITRUM_ADDRESSES.PROXY_GENERAL);
    console.log(`   ProxyGeneral WETH: ${formatAmount(proxyWeth)}`);
    
    if (proxyWeth < collateralAmount) {
        throw new Error(`❌ Insufficient WETH! Need ${collateralStr}, have ${formatAmount(proxyWeth)}`);
    }

    // ==================== 2. TRANSFER WETH TO PLUGIN ====================
    console.log(`\n💸 Transferring ${collateralStr} WETH to plugin...`);
    
    const tx1 = await proxyGeneral.transferToModule(ARBITRUM_ADDRESSES.WETH, pluginAddress, collateralAmount);
    await tx1.wait();
    
    const pluginWeth = await weth.balanceOf(pluginAddress);
    console.log(`   ✅ Plugin WETH: ${formatAmount(pluginWeth)}`);

    // ==================== 3. OPEN LEVERAGE ATOMICALLY ====================
    console.log(`\n⚡ Opening ${leverageX100/100}x leverage via FlashLoanService...`);
    console.log(`   This will:
      1. Flash loan USDC from Balancer (0% fee)
      2. Swap USDC → WETH
      3. Deposit WETH to Euler (auto-enable collateral)
      4. Borrow USDC from Euler (auto-enable controller)
      5. Repay flash loan
   → All in 1 atomic transaction!`);
    
    const tx2 = await eulerPlugin.openLeverageAtomic({
        collateralToken: "WETH",
        borrowToken: "USDC",
        collateralAmount: collateralAmount,
        targetLeverageX100: leverageX100,
        minHealthFactor: minHealthFactor,
        deadline: deadline
    });
    
    const receipt = await tx2.wait();
    
    console.log(`\n   ✅ Leverage opened ATOMICALLY!`);
    console.log(`   Tx: ${receipt?.hash}`);
    console.log(`   Gas Used: ${receipt?.gasUsed.toString()}`);
    console.log(`   Block: ${receipt?.blockNumber}`);

    // ==================== 4. CHECK POSITION ====================
    console.log(`\n📊 Checking position state...`);
    
    const shares = await wethVault.balanceOf(pluginAddress);
    const collateral = await wethVault.convertToAssets(shares);
    const debt = await usdcVault.debtOf(pluginAddress);
    
    console.log(`   WETH Collateral: ${formatAmount(collateral)}`);
    console.log(`   USDC Debt: ${formatAmount(debt, 6)}`);

    // ==================== 5. CALCULATE LEVERAGE ====================
    const actualLeverage = calculateLeverage(collateral, debt);
    console.log(`\n   Actual Leverage: ${actualLeverage.toFixed(2)}x`);
    
    const targetLeverage = leverageX100 / 100;
    const leverageDiff = Math.abs(actualLeverage - targetLeverage);
    
    if (leverageDiff > 0.5) {
        console.log(`   ⚠️  Leverage deviation: ${leverageDiff.toFixed(2)}x from target`);
    } else {
        console.log(`   ✅ Leverage close to target (±${leverageDiff.toFixed(2)}x)`);
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
            console.log(`   Collateral Value: $${formatAmount(info.collateralValueBorrowing, 18)}`);
            console.log(`   Liability Value:  $${formatAmount(info.liabilityValueBorrowing, 18)}`);
            
            if (healthNum < parseFloat(minHealthStr)) {
                console.log(`   ⚠️  WARNING: Health below minimum ${minHealthStr}x!`);
            }
        }
    } catch (error: any) {
        console.log(`   ❌ Error checking health: ${error.message}`);
    }

    // ==================== SUMMARY ====================
    console.log("\n" + "=".repeat(70));
    console.log("✅ LEVERAGE OPENED!");
    console.log("=".repeat(70));
    console.log(`\nInitial Collateral: ${collateralStr} WETH`);
    console.log(`Target Leverage: ${targetLeverage}x`);
    console.log(`Actual Leverage: ${actualLeverage.toFixed(2)}x`);
    console.log(`Total Collateral: ${formatAmount(collateral)} WETH`);
    console.log(`Total Debt: ${formatAmount(debt, 6)} USDC`);
    console.log(`Gas Used: ${receipt?.gasUsed.toString()}`);
    console.log("\n💡 Features Used:");
    console.log("   • Balancer V2 flash loans (0% fee)");
    console.log("   • SimpleSwap (Uniswap V3)");
    console.log("   • Auto-enable collateral & controller");
    console.log("   • Atomic execution (all or nothing)");
    console.log("\n💡 Next Steps:");
    console.log("   npx hardhat run scripts/testing/check-position.ts --network arbitrum");
    console.log("   npx hardhat run scripts/testing/test-leverage-close.ts --network arbitrum");
    console.log("=".repeat(70) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Test failed:");
        console.error(error);
        process.exit(1);
    });
