/**
 * 🔧 Final Configuration Script
 * Completa la configurazione del sistema prima dei deposits
 */

import { ethers } from "hardhat";

async function main() {
    console.log("\n🔧 FINAL SYSTEM CONFIGURATION\n");
    
    const beaconAddress = process.env.BEACON_ADDRESS;
    const proxyAddress = process.env.PROXY_GENERAL_ADDRESS;
    const liquidityManagerAddress = process.env.LIQUIDITY_MANAGER_ADDRESS;
    
    if (!beaconAddress || !proxyAddress || !liquidityManagerAddress) {
        throw new Error("Missing addresses in .env!");
    }
    
    const beacon = await ethers.getContractAt("Beacon", beaconAddress);
    const liquidityManager = await ethers.getContractAt("LiquidityManager", liquidityManagerAddress);
    
    console.log("📋 Step 1: Register ProxyGeneral in Beacon");
    const tx1 = await beacon.updateImplementation("ProxyGeneral", proxyAddress);
    await tx1.wait();
    console.log("   ✅ ProxyGeneral registered");
    
    console.log("\n📋 Step 2: Enable deposits in LiquidityManager");
    const tx2 = await liquidityManager.setDepositsEnabled(true);
    await tx2.wait();
    console.log("   ✅ Deposits enabled");
    
    console.log("\n📋 Step 3: Enable withdraws in LiquidityManager");
    const tx2b = await liquidityManager.setWithdrawsEnabled(true);
    await tx2b.wait();
    console.log("   ✅ Withdraws enabled");
    
    console.log("\n📋 Step 4: Set withdraw limits");
    const tx2c = await liquidityManager.setWithdrawLimits(
        ethers.parseEther("100"),      // 100 ETH hourly
        ethers.parseEther("1000"),     // 1000 ETH daily
        ethers.parseEther("0.000001"), // min withdraw
        ethers.parseEther("50")        // 50 ETH max per tx
    );
    await tx2c.wait();
    console.log("   ✅ Withdraw limits set");
    
    console.log("\n📋 Step 5: Set deposit fee (0.1% = 10 basis points)");
    const tx3 = await liquidityManager.setDepositFee(10);
    await tx3.wait();
    console.log("   ✅ Deposit fee set to 0.1%");
    
    console.log("\n📋 Step 6: Set withdraw fee (0.1% = 10 basis points)");
    const tx4 = await liquidityManager.setWithdrawFee(10);
    await tx4.wait();
    console.log("   ✅ Withdraw fee set to 0.1%");
    
    // Verifica
    console.log("\n🔍 Verification:");
    const proxyInBeacon = await beacon.getImplementation("ProxyGeneral");
    const depositsEnabled = await liquidityManager.depositsEnabled();
    const withdrawsEnabled = await liquidityManager.withdrawsEnabled();
    const depositFee = await liquidityManager.depositFee();
    const withdrawFee = await liquidityManager.withdrawFee();
    
    console.log(`   ProxyGeneral in Beacon: ${proxyInBeacon}`);
    console.log(`   Deposits Enabled: ${depositsEnabled}`);
    console.log(`   Withdraws Enabled: ${withdrawsEnabled}`);
    console.log(`   Deposit Fee: ${depositFee} basis points`);
    console.log(`   Withdraw Fee: ${withdrawFee} basis points`);
    
    console.log("\n✅ SYSTEM READY FOR DEPOSITS AND WITHDRAWALS!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error);
        process.exit(1);
    });
