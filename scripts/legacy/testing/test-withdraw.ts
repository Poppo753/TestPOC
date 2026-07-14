/**
 * @file test-withdraw.ts
 * @description Test withdraw WETH from Euler vault
 * 
 * Ritira WETH dal vault Euler (torna a ProxyGeneral)
 * 
 * USAGE:
 *   # Withdraw all (max)
 *   npx hardhat run scripts/testing/test-withdraw.ts --network arbitrum
 *   
 *   # Withdraw specific amount
 *   AMOUNT=0.001 npx hardhat run scripts/testing/test-withdraw.ts --network arbitrum
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../config/arbitrum.config";
import { formatAmount, verifyArbitrumMainnet, loadDeployment } from "../utils/plugins/euler/euler-helpers";

async function main() {
    console.log("\n" + "=".repeat(70));
    console.log("💰 EULER V2 - WITHDRAW TEST");
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
        ["function withdraw(string memory tokenSymbol, uint256 amount) external"],
        pluginAddress,
        deployer
    );
    
    const weth = await ethers.getContractAt(
        "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
        ARBITRUM_ADDRESSES.WETH
    );
    
    const wethVault = await ethers.getContractAt(
        [
            "function balanceOf(address) view returns (uint256)",
            "function maxWithdraw(address) view returns (uint256)"
        ],
        ARBITRUM_ADDRESSES.WETH_VAULT
    );

    // ==================== 1. CHECK POSITION ====================
    console.log(`\n📊 Checking current position...`);
    
    const maxWithdraw = await wethVault.maxWithdraw(pluginAddress);
    console.log(`   Max Withdrawable: ${formatAmount(maxWithdraw)} WETH`);
    
    if (maxWithdraw === 0n) {
        console.log("   ❌ No WETH to withdraw!");
        console.log("\n💡 Hint: Run test-deposit.ts first");
        process.exit(1);
    }

    // ==================== 2. DETERMINE AMOUNT ====================
    let withdrawAmount = maxWithdraw;
    
    if (process.env.AMOUNT) {
        const amountStr = process.env.AMOUNT;
        const requestedAmount = ethers.parseEther(amountStr);
        if (requestedAmount > maxWithdraw) {
            throw new Error(`❌ Amount ${amountStr} exceeds max ${formatAmount(maxWithdraw)}`);
        }
        withdrawAmount = requestedAmount;
        console.log(`   Withdrawing: ${amountStr} WETH (partial)`);
    } else {
        console.log(`   Withdrawing: ${formatAmount(maxWithdraw)} WETH (max)`);
    }

    // ==================== 3. WITHDRAW ====================
    console.log(`\n💰 Withdrawing ${formatAmount(withdrawAmount)} WETH...`);
    
    const tx = await eulerPlugin.withdraw("WETH", withdrawAmount);
    const receipt = await tx.wait();
    
    // Wait for nonce sync
    await new Promise(r => setTimeout(r, 2000));
    
    console.log(`   Tx: ${receipt?.hash}`);
    console.log(`   Gas Used: ${receipt?.gasUsed.toString()}`);

    // ==================== 4. VERIFY RESULTS ====================
    console.log(`\n✅ Verifying withdrawal...`);
    
    const proxyWeth = await weth.balanceOf(ARBITRUM_ADDRESSES.PROXY_GENERAL);
    const remainingShares = await wethVault.balanceOf(pluginAddress);
    const newMaxWithdraw = await wethVault.maxWithdraw(pluginAddress);
    
    console.log(`   ProxyGeneral WETH: ${formatAmount(proxyWeth)}`);
    console.log(`   Remaining Shares: ${formatAmount(remainingShares)} eWETH`);
    console.log(`   Remaining Withdrawable: ${formatAmount(newMaxWithdraw)} WETH`);

    // ==================== SUMMARY ====================
    console.log("\n" + "=".repeat(70));
    console.log("✅ WITHDRAWAL SUCCESSFUL!");
    console.log("=".repeat(70));
    console.log(`\nWithdrawn: ${formatAmount(withdrawAmount)} WETH`);
    console.log(`Returned to: ProxyGeneral (${ARBITRUM_ADDRESSES.PROXY_GENERAL})`);
    console.log(`Remaining in Vault: ${formatAmount(newMaxWithdraw)} WETH`);
    console.log("\n💡 Next Steps:");
    console.log("   npx hardhat run scripts/testing/check-position.ts --network arbitrum");
    console.log("=".repeat(70) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Test failed:");
        console.error(error);
        process.exit(1);
    });
