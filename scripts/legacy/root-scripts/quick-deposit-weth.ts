/**
 * Deposit ETH → WETH → ProxyGeneral
 */

import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "./config/arbitrum.config";

async function main() {
    const [deployer] = await ethers.getSigners();
    
    const weth = await ethers.getContractAt("IWETH", ARBITRUM_ADDRESSES.WETH);
    const proxy = await ethers.getContractAt("ProxyGeneral", ARBITRUM_ADDRESSES.PROXY_GENERAL);
    
    const amount = ethers.parseEther("0.001"); // 0.001 ETH
    
    console.log(`\n💰 Depositing ${ethers.formatEther(amount)} ETH → WETH...\n`);
    
    // Wrap ETH → WETH
    let tx = await weth.deposit({ value: amount });
    await tx.wait();
    console.log(`✅ Wrapped\n`);
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Transfer to ProxyGeneral
    tx = await weth.transfer(ARBITRUM_ADDRESSES.PROXY_GENERAL, amount);
    await tx.wait();
    console.log(`✅ Transferred to ProxyGeneral\n`);
    
    // Check balance
    const balance = await weth.balanceOf(ARBITRUM_ADDRESSES.PROXY_GENERAL);
    console.log(`ProxyGeneral WETH: ${ethers.formatEther(balance)}\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
