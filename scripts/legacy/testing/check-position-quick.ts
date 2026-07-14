/**
 * Quick position check
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../config/arbitrum.config";
import { formatAmount, verifyArbitrumMainnet, loadDeployment } from "../utils/plugins/euler/euler-helpers";

async function main() {
    await verifyArbitrumMainnet();
    
    const [deployer] = await ethers.getSigners();
    const pluginAddress = loadDeployment("EulerV2Plugin");
    
    if (!pluginAddress) throw new Error("Plugin not found");
    
    console.log(`\n📍 Plugin: ${pluginAddress}\n`);
    
    // Get contracts
    const wethVault = await ethers.getContractAt(
        [
            "function balanceOf(address) view returns (uint256)",
            "function maxWithdraw(address) view returns (uint256)",
            "function convertToAssets(uint256) view returns (uint256)"
        ],
        ARBITRUM_ADDRESSES.WETH_VAULT
    );
    
    const usdcVault = await ethers.getContractAt(
        [
            "function debtOf(address) view returns (uint256)"
        ],
        ARBITRUM_ADDRESSES.USDC_VAULT
    );
    
    const evc = await ethers.getContractAt(
        [
            "function isCollateralEnabled(address, address) view returns (bool)",
            "function isControllerEnabled(address, address) view returns (bool)"
        ],
        ARBITRUM_ADDRESSES.EVC
    );
    
    // Check position
    const shares = await wethVault.balanceOf(pluginAddress);
    const assets = await wethVault.convertToAssets(shares);
    const maxWithdraw = await wethVault.maxWithdraw(pluginAddress);
    const debt = await usdcVault.debtOf(pluginAddress);
    
    const collateralEnabled = await evc.isCollateralEnabled(pluginAddress, ARBITRUM_ADDRESSES.WETH_VAULT);
    const controllerEnabled = await evc.isControllerEnabled(pluginAddress, ARBITRUM_ADDRESSES.USDC_VAULT);
    
    console.log("WETH VAULT:");
    console.log(`  Shares: ${formatAmount(shares)}`);
    console.log(`  Assets: ${formatAmount(assets)} WETH`);
    console.log(`  Max Withdraw: ${formatAmount(maxWithdraw)} WETH`);
    console.log(`  Collateral Enabled: ${collateralEnabled ? "✅" : "❌"}\n`);
    
    console.log("USDC VAULT:");
    console.log(`  Debt: ${formatAmount(debt, 6)} USDC`);
    console.log(`  Controller Enabled: ${controllerEnabled ? "✅" : "❌"}\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
