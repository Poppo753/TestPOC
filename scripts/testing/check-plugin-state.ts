import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../config/arbitrum.config";

const PLUGIN = "0x490139F3b29786D64056a236a0062CA23A7313f6";

async function main() {
    const wethVault = await ethers.getContractAt(
        ["function balanceOf(address) view returns (uint256)", "function maxWithdraw(address) view returns (uint256)"],
        ARBITRUM_ADDRESSES.WETH_VAULT
    );
    
    const usdcVault = await ethers.getContractAt(
        ["function debtOf(address) view returns (uint256)"],
        ARBITRUM_ADDRESSES.USDC_VAULT
    );
    
    const evc = await ethers.getContractAt(
        ["function isCollateralEnabled(address, address) view returns (bool)", "function isControllerEnabled(address, address) view returns (bool)"],
        ARBITRUM_ADDRESSES.EVC
    );
    
    const wethShares = await wethVault.balanceOf(PLUGIN);
    const maxWithdraw = await wethVault.maxWithdraw(PLUGIN);
    const debt = await usdcVault.debtOf(PLUGIN);
    
    const collateralEnabled = await evc.isCollateralEnabled(PLUGIN, ARBITRUM_ADDRESSES.WETH_VAULT);
    const controllerEnabled = await evc.isControllerEnabled(PLUGIN, ARBITRUM_ADDRESSES.USDC_VAULT);
    
    console.log(`\n📊 PLUGIN STATE:`);
    console.log(`   WETH Shares: ${ethers.formatEther(wethShares)}`);
    console.log(`   Max Withdraw: ${ethers.formatEther(maxWithdraw)} WETH`);
    console.log(`   Debt: ${ethers.formatUnits(debt, 6)} USDC (${debt} wei)`);
    console.log(`   Collateral Enabled: ${collateralEnabled ? "✅" : "❌"}`);
    console.log(`   Controller Enabled: ${controllerEnabled ? "✅" : "❌"}\n`);
}

main().catch(console.error);
