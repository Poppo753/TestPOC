import { ethers } from "hardhat";
import { getAllContracts } from "../config/config";

async function main() {
    console.log("\n🔍 CHECKING WHY WITHDRAW FAILS\n");
    
    const [deployer] = await ethers.getSigners();
    const contracts = await getAllContracts();
    const { liquidityManager, proxyGeneral } = contracts;
    
    const lpBalance = await proxyGeneral.balanceOf(deployer.address);
    console.log(`Your LP Balance: ${ethers.formatEther(lpBalance)} LP`);
    
    // Check if withdraws are enabled
    try {
        const withdrawsEnabled = await liquidityManager.withdrawsEnabled();
        console.log(`✅ withdrawsEnabled: ${withdrawsEnabled}`);
    } catch (error: any) {
        console.log(`❌ Error checking withdrawsEnabled: ${error.message}`);
    }
    
    // Check if deposits are enabled (for comparison)
    try {
        const depositsEnabled = await liquidityManager.depositsEnabled();
        console.log(`✅ depositsEnabled: ${depositsEnabled}`);
    } catch (error: any) {
        console.log(`❌ Error checking depositsEnabled: ${error.message}`);
    }
    
    // Check withdraw limits
    try {
        const limits = await liquidityManager.withdrawLimits();
        console.log(`\n📋 Withdraw Limits:`);
        console.log(`   Hourly: ${ethers.formatEther(limits.hourlyLimit)} ETH`);
        console.log(`   Daily: ${ethers.formatEther(limits.dailyLimit)} ETH`);
        console.log(`   Min: ${ethers.formatEther(limits.minWithdraw)} ETH`);
        console.log(`   Max per tx: ${ethers.formatEther(limits.maxWithdraw)} ETH`);
    } catch (error: any) {
        console.log(`❌ Error checking withdraw limits: ${error.message}`);
    }
    
    // Check if user can withdraw
    const withdrawAmount = await liquidityManager.calculateWithdrawAmount(lpBalance);
    console.log(`\nWithdraw amount: ${ethers.formatEther(withdrawAmount)} ETH`);
    
    try {
        const [canWithdraw, reason] = await liquidityManager.canWithdraw(deployer.address, withdrawAmount);
        console.log(`\n${canWithdraw ? '✅' : '❌'} canWithdraw: ${canWithdraw}`);
        if (!canWithdraw) {
            console.log(`   Reason: ${reason}`);
        }
    } catch (error: any) {
        console.log(`❌ Error checking canWithdraw: ${error.message}`);
    }
    
    // Check rate limits
    try {
        const rateLimit = await liquidityManager.checkWithdrawRateLimit(deployer.address, withdrawAmount);
        console.log(`\n✅ Rate limit check: ${rateLimit.allowed}`);
        console.log(`   Remaining hourly: ${ethers.formatEther(rateLimit.remainingHourly)} ETH`);
        console.log(`   Remaining daily: ${ethers.formatEther(rateLimit.remainingDaily)} ETH`);
    } catch (error: any) {
        console.log(`❌ Error checking rate limit: ${error.message}`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
