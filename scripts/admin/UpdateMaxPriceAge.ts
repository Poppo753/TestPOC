import { ethers } from "hardhat";

async function main() {
    console.log("🔧 UPDATING maxPriceAge TO 23h 50min\n");

    // Get ValueCalculator address
    const beaconAddress = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
    const beacon = await ethers.getContractAt("Beacon", beaconAddress);
    const valueCalculatorAddress = await beacon.getImplementation("ValueCalculator");
    
    console.log(`📋 ValueCalculator: ${valueCalculatorAddress}`);

    const valueCalculator = await ethers.getContractAt("ValueCalculator", valueCalculatorAddress);

    // Check current maxPriceAge
    const currentMaxPriceAge = await valueCalculator.maxPriceAge();
    console.log(`⏰ Current maxPriceAge: ${currentMaxPriceAge} seconds (${Number(currentMaxPriceAge) / 3600} hours)\n`);

    // Calculate new value: 23h 50min = 85800 seconds
    const newMaxPriceAge = 23 * 3600 + 50 * 60; // 85800 seconds
    console.log(`⏰ New maxPriceAge: ${newMaxPriceAge} seconds (23h 50min)\n`);

    // Update maxPriceAge
    console.log("📤 Sending transaction...");
    const tx = await valueCalculator.setMaxPriceAge(newMaxPriceAge);
    console.log(`   Transaction hash: ${tx.hash}`);
    
    console.log("⏳ Waiting for confirmation...");
    const receipt = await tx.wait();
    console.log(`   ✅ Confirmed in block: ${receipt?.blockNumber}`);
    console.log(`   Gas used: ${receipt?.gasUsed.toString()}\n`);

    // Verify update
    const updatedMaxPriceAge = await valueCalculator.maxPriceAge();
    console.log(`✅ Updated maxPriceAge: ${updatedMaxPriceAge} seconds (${Number(updatedMaxPriceAge) / 3600} hours)`);

    // Test if USDC price is now accepted
    console.log("\n🧪 TESTING TOKEN VALUE CALCULATION AFTER UPDATE:\n");
    
    const tokens = ["USDC", "WBTC", "USDT"];
    for (const tokenCode of tokens) {
        try {
            const value = await valueCalculator.calculateTokenValuePure(tokenCode);
            console.log(`   ✅ ${tokenCode}: ${ethers.formatEther(value)} ETH`);
        } catch (error: any) {
            console.log(`   ❌ ${tokenCode}: ${error.message}`);
        }
    }

    // Test getTotalPoolValue
    console.log("\n📊 TESTING getTotalPoolValue():");
    try {
        const poolInfo = await valueCalculator.getTotalPoolValue();
        console.log(`   ✅ Total Pool Value: ${ethers.formatEther(poolInfo.totalValue)} ETH`);
        console.log(`   Token breakdown:`);
        for (const tv of poolInfo.tokenValues) {
            if (tv.tokenCode && tv.tokenCode !== "") {
                const percentage = Number(tv.percentage) / 100;
                console.log(`      ${tv.tokenCode}: ${ethers.formatEther(tv.value)} ETH (${percentage.toFixed(2)}%)`);
            }
        }
    } catch (error: any) {
        console.log(`   ❌ FAILED: ${error.message}`);
    }

    console.log("\n🎉 UPDATE COMPLETED!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
