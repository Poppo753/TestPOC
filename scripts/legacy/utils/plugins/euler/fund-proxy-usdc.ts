import { ethers } from "hardhat";
import { ARBITRUM_ADDRESSES } from "../config/arbitrum.config";

async function main() {
    const [deployer] = await ethers.getSigners();
    
    const usdc = await ethers.getContractAt(
        ["function transfer(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"],
        ARBITRUM_ADDRESSES.USDC
    );
    
    const balance = await usdc.balanceOf(await deployer.getAddress());
    console.log(`Deployer USDC: ${ethers.formatUnits(balance, 6)}`);
    
    if (balance === 0n) {
        console.log("❌ No USDC in deployer wallet!");
        return;
    }
    
    const amount = ethers.parseUnits("1", 6); // 1 USDC
    console.log(`\nTransferring 1 USDC to ProxyGeneral...`);
    
    const tx = await usdc.transfer(ARBITRUM_ADDRESSES.PROXY_GENERAL, amount);
    await tx.wait();
    
    console.log("✅ Done!");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
