import { ethers } from "hardhat";
import { getAllContracts } from "../../config/config";

async function main() {
    console.log("\n🔧 ENABLE WITHDRAWALS CONFIGURATION\n");
    
    const contracts = await getAllContracts();
    const liquidityManager = contracts.liquidityManager;
    
    console.log("📋 Step 1: Enable withdraws in LiquidityManager");
    const tx1 = await liquidityManager.setWithdrawsEnabled(true);
    await tx1.wait();
    console.log("   ✅ Withdraws enabled");
    
    console.log("\n📋 Step 2: Set withdraw limits");
    const tx2 = await liquidityManager.setWithdrawLimits(
        ethers.parseEther("100"),      // 100 ETH hourly
        ethers.parseEther("1000"),     // 1000 ETH daily
        ethers.parseEther("0.000001"), // min withdraw
        ethers.parseEther("50")        // 50 ETH max per tx
    );
    await tx2.wait();
    console.log("   ✅ Withdraw limits set:");
    console.log("      - Hourly limit: 100 ETH");
    console.log("      - Daily limit: 1000 ETH");
    console.log("      - Min withdraw: 0.000001 ETH");
    console.log("      - Max per tx: 50 ETH");
    
    // Verifica
    console.log("\n🔍 Verification:");
    const withdrawsEnabled = await liquidityManager.withdrawsEnabled();
    console.log(`   Withdraws Enabled: ${withdrawsEnabled}`);
    
    if (withdrawsEnabled) {
        console.log("\n✅ WITHDRAWALS NOW ENABLED! You can now withdraw your LP tokens.");
    } else {
        console.log("\n❌ Something went wrong - withdraws still disabled");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
