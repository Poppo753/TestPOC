import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../config/arbitrum.config";

async function main() {
    const [deployer] = await ethers.getSigners();
    
    const usdc = await ethers.getContractAt("IERC20", ARBITRUM_ADDRESSES.USDC);
    
    const deployerBal = await usdc.balanceOf(deployer.address);
    const pluginBal = await usdc.balanceOf("0x490139F3b29786D64056a236a0062CA23A7313f6");
    const proxyBal = await usdc.balanceOf(ARBITRUM_ADDRESSES.PROXY_GENERAL);
    
    console.log(`\n📊 USDC Balances:`);
    console.log(`   Deployer: ${ethers.formatUnits(deployerBal, 6)} USDC`);
    console.log(`   Plugin:   ${ethers.formatUnits(pluginBal, 6)} USDC`);
    console.log(`   Proxy:    ${ethers.formatUnits(proxyBal, 6)} USDC\n`);
}

main().catch(console.error);
