/**
 * @file test-deposit.ts
 * @description Test deposit WETH to Euler vault
 * 
 * Deposita WETH nel vault Euler e verifica:
 * - Auto-enable collateral
 * - Vault shares ricevute
 * - Max withdraw
 * 
 * USAGE:
 *   # Default 0.01 WETH
 *   npx hardhat run scripts/testing/test-deposit.ts --network arbitrum
 *   
 *   # Custom amount
 *   AMOUNT=0.001 npx hardhat run scripts/testing/test-deposit.ts --network arbitrum
 *   
 *   # Custom plugin
 *   PLUGIN_ADDRESS=0x... AMOUNT=0.01 npx hardhat run scripts/testing/test-deposit.ts --network arbitrum
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../config/arbitrum.config";
import { formatAmount, verifyArbitrumMainnet, loadDeployment } from "../utils/euler-helpers";

async function main() {
    console.log("\n" + "=".repeat(70));
    console.log("🏦 EULER V2 - DEPOSIT TEST");
    console.log("=".repeat(70));

    // ==================== SETUP ====================
    await verifyArbitrumMainnet();
    
    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();
    
    // Get plugin address
    let pluginAddress = process.env.PLUGIN_ADDRESS || loadDeployment("EulerV2Plugin");
    if (!pluginAddress) {
        throw new Error("❌ PLUGIN_ADDRESS not found!");
    }
    
    // Get amount (default 0.0001 WETH)
    const amountStr = process.env.AMOUNT || "0.0001";
    const amount = ethers.parseEther(amountStr);
    
    console.log(`\n📍 Plugin: ${pluginAddress}`);
    console.log(`   Amount: ${amountStr} WETH`);
    console.log(`   Deployer: ${deployerAddress}`);

    // ==================== GET CONTRACTS ====================
    const eulerPlugin = await ethers.getContractAt(
        ["function deposit(string memory tokenSymbol, uint256 amount) external"],
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
        ARBITRUM_ADDRESSES.WETH,
        deployer
    );
    
    const wethVault = await ethers.getContractAt(
        [
            "function balanceOf(address) view returns (uint256)",
            "function maxWithdraw(address) view returns (uint256)",
            "function convertToAssets(uint256) view returns (uint256)"
        ],
        ARBITRUM_ADDRESSES.WETH_VAULT
    );
    
    const evc = await ethers.getContractAt(
        ["function isCollateralEnabled(address, address) view returns (bool)"],
        ARBITRUM_ADDRESSES.EVC
    );

    // ==================== 1. CHECK PROXY BALANCE ====================
    console.log(`\n📊 Checking ProxyGeneral WETH balance...`);
    
    const proxyWeth = await weth.balanceOf(ARBITRUM_ADDRESSES.PROXY_GENERAL);
    console.log(`   ProxyGeneral WETH: ${formatAmount(proxyWeth)}`);
    
    if (proxyWeth < amount) {
        throw new Error(`❌ Insufficient WETH! Need ${amountStr}, have ${formatAmount(proxyWeth)}`);
    }
    
    console.log("   ✅ Sufficient balance");

    // ==================== 2. TRANSFER TO PLUGIN ====================
    console.log(`\n💸 Transferring ${amountStr} WETH to plugin...`);
    
    const tx1 = await proxyGeneral.transferToModule(ARBITRUM_ADDRESSES.WETH, pluginAddress, amount);
    const receipt1 = await tx1.wait();
    console.log(`   Tx: ${receipt1?.hash}`);
    
    // Wait for nonce sync (Arbitrum fast blocks)
    await new Promise(r => setTimeout(r, 2000));
    
    const pluginWeth = await weth.balanceOf(pluginAddress);
    console.log(`   ✅ Plugin WETH: ${formatAmount(pluginWeth)}`);

    // ==================== 3. DEPOSIT TO EULER ====================
    console.log(`\n🏦 Depositing ${amountStr} WETH to Euler...`);
    
    const tx2 = await eulerPlugin.deposit("WETH", pluginWeth);
    const receipt2 = await tx2.wait();
    
    console.log(`   Tx: ${receipt2?.hash}`);
    console.log(`   Gas Used: ${receipt2?.gasUsed.toString()}`);

    // ==================== 4. VERIFY RESULTS ====================
    console.log(`\n✅ Verifying deposit...`);
    
    const shares = await wethVault.balanceOf(pluginAddress);
    const collateral = await wethVault.convertToAssets(shares);
    const maxWithdraw = await wethVault.maxWithdraw(pluginAddress);
    const remainingWeth = await weth.balanceOf(pluginAddress);
    
    console.log(`   eWETH Shares: ${formatAmount(shares)}`);
    console.log(`   Collateral Value: ${formatAmount(collateral)} WETH`);
    console.log(`   Max Withdraw: ${formatAmount(maxWithdraw)} WETH`);
    console.log(`   Remaining WETH: ${formatAmount(remainingWeth)}`);
    
    if (shares === 0n) {
        throw new Error("❌ Deposit failed! No shares received.");
    }

    // ==================== 5. VERIFY AUTO-ENABLED COLLATERAL ====================
    console.log(`\n🔒 Verifying auto-enabled collateral...`);
    
    const isCollateral = await evc.isCollateralEnabled(pluginAddress, ARBITRUM_ADDRESSES.WETH_VAULT);
    console.log(`   Collateral Enabled: ${isCollateral ? "✅ YES" : "❌ NO"}`);
    
    if (!isCollateral) {
        throw new Error("❌ Collateral not auto-enabled!");
    }

    // ==================== SUMMARY ====================
    console.log("\n" + "=".repeat(70));
    console.log("✅ DEPOSIT SUCCESSFUL!");
    console.log("=".repeat(70));
    console.log(`\nDeposited: ${amountStr} WETH`);
    console.log(`Shares Received: ${formatAmount(shares)} eWETH`);
    console.log(`Collateral Enabled: ✅`);
    console.log("\n💡 Next Steps:");
    console.log("   npx hardhat run scripts/testing/check-position.ts --network arbitrum");
    console.log("   npx hardhat run scripts/testing/test-withdraw.ts --network arbitrum");
    console.log("=".repeat(70) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Test failed:");
        console.error(error);
        process.exit(1);
    });
