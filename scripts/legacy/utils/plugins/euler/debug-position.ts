import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../config/arbitrum.config";
import { loadDeployment } from "../utils/euler-helpers";

async function main() {
    const [deployer] = await ethers.getSigners();
    const pluginAddress = "0xaDcbAad4b427FacCc19d9Da91360327577B8fa8B"; // NEWEST PLUGIN
    
    const usdcVault = await ethers.getContractAt(
        ["function debtOf(address) view returns (uint256)"],
        ARBITRUM_ADDRESSES.USDC_VAULT
    );
    
    const wethVault = await ethers.getContractAt(
        ["function maxWithdraw(address) view returns (uint256)", "function balanceOf(address) view returns (uint256)"],
        ARBITRUM_ADDRESSES.WETH_VAULT
    );
    
    const debt = await usdcVault.debtOf(pluginAddress);
    const shares = await wethVault.balanceOf(pluginAddress);
    const maxW = await wethVault.maxWithdraw(pluginAddress);
    
    console.log(`\nPlugin: ${pluginAddress}`);
    console.log(`Debt: ${ethers.formatUnits(debt, 6)} USDC`);
    console.log(`Shares: ${ethers.formatEther(shares)} eWETH`);
    console.log(`Max Withdraw: ${ethers.formatEther(maxW)} WETH`);
    console.log(`\nDebt in wei: ${debt.toString()}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
