/**
 * @file test-repay.ts
 * @description Test repay USDC debt
 * 
 * Ripaga debt USDC (totale o parziale)
 * 
 * PREREQUISITI:
 * - USDC debt esistente (run test-borrow.ts first)
 * - USDC in ProxyGeneral (dal borrow o transfer manuale)
 * 
 * USAGE:
 *   # Repay all debt
 *   npx hardhat run scripts/testing/test-repay.ts --network arbitrum
 *   
 *   # Repay specific amount
 *   AMOUNT=0.1 npx hardhat run scripts/testing/test-repay.ts --network arbitrum
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../config/arbitrum.config";
import { formatAmount, verifyArbitrumMainnet, loadDeployment } from "../utils/euler-helpers";

async function main() {
    console.log("\n" + "=".repeat(70));
    console.log("💰 EULER V2 - REPAY TEST");
    console.log("=".repeat(70));

    // ==================== SETUP ====================
    await verifyArbitrumMainnet();
    
    const [deployer] = await ethers.getSigners();
    
    // Get plugin address
    let pluginAddress = process.env.PLUGIN_ADDRESS || loadDeployment("EulerV2Plugin");
    if (!pluginAddress) {
        throw new Error("❌ PLUGIN_ADDRESS not found!");
    }
    
    console.log(`\n📍 Plugin: ${pluginAddress}`);

    // ==================== GET CONTRACTS ====================
    const eulerPlugin = await ethers.getContractAt(
        ["function repay(string memory tokenSymbol, uint256 amount) external"],
        pluginAddress,
        deployer
    );
    
    const proxyGeneral = await ethers.getContractAt(
        ["function transferToModule(address token, address module, uint256 amount) external"],
        ARBITRUM_ADDRESSES.PROXY_GENERAL,
        deployer
    );
    
    const usdcVault = await ethers.getContractAt(
        ["function debtOf(address) view returns (uint256)"],
        ARBITRUM_ADDRESSES.USDC_VAULT
    );
    
    const usdc = await ethers.getContractAt(
        "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
        ARBITRUM_ADDRESSES.USDC
    );

    // ==================== 1. CHECK CURRENT DEBT ====================
    console.log(`\n📊 Checking current debt...`);
    
    const currentDebt = await usdcVault.debtOf(pluginAddress);
    console.log(`   Current Debt: ${formatAmount(currentDebt, 6)} USDC`);
    
    if (currentDebt === 0n) {
        console.log("   ✅ No debt to repay!");
        console.log("\n💡 Hint: Run test-borrow.ts first if you want to test repay");
        process.exit(0);
    }

    // ==================== 2. DETERMINE REPAY AMOUNT ====================
    let repayAmount = currentDebt;
    
    if (process.env.AMOUNT) {
        const requestedAmount = ethers.parseUnits(process.env.AMOUNT, 6);
        if (requestedAmount > currentDebt) {
            console.log(`   ⚠️  Requested ${process.env.AMOUNT} USDC exceeds debt, repaying full amount`);
        } else {
            repayAmount = requestedAmount;
            console.log(`   Repaying: ${process.env.AMOUNT} USDC (partial)`);
        }
    } else {
        console.log(`   Repaying: ${formatAmount(currentDebt, 6)} USDC (full)`);
    }

    // ==================== 3. CHECK PROXY USDC ====================
    console.log(`\n📊 Checking ProxyGeneral USDC...`);
    
    const proxyUsdc = await usdc.balanceOf(ARBITRUM_ADDRESSES.PROXY_GENERAL);
    console.log(`   ProxyGeneral USDC: ${formatAmount(proxyUsdc, 6)}`);
    
    if (proxyUsdc < repayAmount) {
        console.log(`   ⚠️  Insufficient USDC, repaying what we have: ${formatAmount(proxyUsdc, 6)}`);
        repayAmount = proxyUsdc;
    }
    
    if (repayAmount === 0n) {
        throw new Error("❌ No USDC to repay with! Transfer USDC to ProxyGeneral first.");
    }

    // ==================== 4. TRANSFER USDC TO PLUGIN ====================
    console.log(`\n💸 Transferring ${formatAmount(repayAmount, 6)} USDC to plugin...`);
    
    const tx1 = await proxyGeneral.transferToModule(ARBITRUM_ADDRESSES.USDC, pluginAddress, repayAmount);
    const receipt1 = await tx1.wait();
    console.log(`   Tx: ${receipt1?.hash}`);
    
    // Wait for nonce sync
    await new Promise(r => setTimeout(r, 2000));

    // ==================== 5. REPAY ====================
    console.log(`\n💳 Repaying ${formatAmount(repayAmount, 6)} USDC...`);
    
    const tx2 = await eulerPlugin.repay("USDC", repayAmount);
    const receipt2 = await tx2.wait();
    
    // Wait for nonce sync
    await new Promise(r => setTimeout(r, 2000));
    
    console.log(`   Tx: ${receipt2?.hash}`);
    console.log(`   Gas Used: ${receipt2?.gasUsed.toString()}`);

    // ==================== 6. VERIFY RESULTS ====================
    console.log(`\n✅ Verifying repay...`);
    
    const remainingDebt = await usdcVault.debtOf(pluginAddress);
    const debtReduced = currentDebt - remainingDebt;
    
    console.log(`   Debt Reduced: ${formatAmount(debtReduced, 6)} USDC`);
    console.log(`   Remaining Debt: ${formatAmount(remainingDebt, 6)} USDC`);
    
    if (remainingDebt > 0n && remainingDebt < ethers.parseUnits("0.01", 6)) {
        console.log(`   ℹ️  Note: Small dust remaining due to interest accrual`);
    }

    // ==================== SUMMARY ====================
    console.log("\n" + "=".repeat(70));
    console.log("✅ REPAY SUCCESSFUL!");
    console.log("=".repeat(70));
    console.log(`\nRepaid: ${formatAmount(debtReduced, 6)} USDC`);
    console.log(`Remaining Debt: ${formatAmount(remainingDebt, 6)} USDC`);
    
    if (remainingDebt === 0n) {
        console.log(`Status: 🟢 Debt fully cleared!`);
    } else {
        console.log(`Status: 🟡 Partial repay`);
    }
    
    console.log("\n💡 Next Steps:");
    console.log("   npx hardhat run scripts/testing/check-position.ts --network arbitrum");
    if (remainingDebt === 0n) {
        console.log("   npx hardhat run scripts/testing/test-withdraw.ts --network arbitrum");
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
