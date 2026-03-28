/**
 * Manually disable controller/collateral for debugging
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../config/arbitrum.config";
import { verifyArbitrumMainnet, loadDeployment } from "../utils/plugins/euler/euler-helpers";

async function main() {
    await verifyArbitrumMainnet();
    
    const [deployer] = await ethers.getSigners();
    const pluginAddress = loadDeployment("EulerV2Plugin");
    
    if (!pluginAddress) throw new Error("Plugin not found");
    
    console.log(`\n📍 Plugin: ${pluginAddress}\n`);
    
    // Get plugin contract
    const plugin = await ethers.getContractAt(
        [
            "function disableController(address) external",
            "function disableCollateral(address) external"
        ],
        pluginAddress,
        deployer
    );
    
    const evc = await ethers.getContractAt(
        [
            "function isCollateralEnabled(address, address) view returns (bool)",
            "function isControllerEnabled(address, address) view returns (bool)"
        ],
        ARBITRUM_ADDRESSES.EVC
    );
    
    // Check current state
    console.log("BEFORE:");
    const collateralBefore = await evc.isCollateralEnabled(pluginAddress, ARBITRUM_ADDRESSES.WETH_VAULT);
    const controllerBefore = await evc.isControllerEnabled(pluginAddress, ARBITRUM_ADDRESSES.USDC_VAULT);
    console.log(`  Collateral: ${collateralBefore ? "✅" : "❌"}`);
    console.log(`  Controller: ${controllerBefore ? "✅" : "❌"}\n`);
    
    // Disable controller
    if (controllerBefore) {
        console.log("🔧 Disabling controller...");
        const tx1 = await plugin.disableController(ARBITRUM_ADDRESSES.USDC_VAULT);
        await tx1.wait();
        console.log(`  ✅ Tx: ${tx1.hash}\n`);
    }
    
    // Disable collateral
    if (collateralBefore) {
        console.log("🔧 Disabling collateral...");
        const tx2 = await plugin.disableCollateral(ARBITRUM_ADDRESSES.WETH_VAULT);
        await tx2.wait();
        console.log(`  ✅ Tx: ${tx2.hash}\n`);
    }
    
    // Check after
    console.log("AFTER:");
    const collateralAfter = await evc.isCollateralEnabled(pluginAddress, ARBITRUM_ADDRESSES.WETH_VAULT);
    const controllerAfter = await evc.isControllerEnabled(pluginAddress, ARBITRUM_ADDRESSES.USDC_VAULT);
    console.log(`  Collateral: ${collateralAfter ? "✅" : "❌"}`);
    console.log(`  Controller: ${controllerAfter ? "✅" : "❌"}\n`);
    
    // Check maxWithdraw now
    const wethVault = await ethers.getContractAt(
        ["function maxWithdraw(address) view returns (uint256)"],
        ARBITRUM_ADDRESSES.WETH_VAULT
    );
    
    const maxWithdraw = await wethVault.maxWithdraw(pluginAddress);
    console.log(`Max Withdraw: ${ethers.formatEther(maxWithdraw)} WETH`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
