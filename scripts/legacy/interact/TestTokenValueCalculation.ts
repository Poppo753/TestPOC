import { ethers } from "hardhat";

async function main() {
    console.log("🔍 TESTING TOKEN VALUE CALCULATION\n");

    const valueCalculatorAddress = "0x4d763776C4474dc055CF7F1430b2DeeA9160283b";
    const valueCalculator = await ethers.getContractAt("ValueCalculator", valueCalculatorAddress);

    console.log("Testing calculateTokenValuePure for each token:\n");

    // Test USDC
    console.log("1️⃣ Testing USDC...");
    try {
        const usdcValue = await valueCalculator.calculateTokenValuePure("USDC");
        console.log(`   ✅ USDC Value: ${ethers.formatEther(usdcValue)} ETH\n`);
    } catch (error: any) {
        console.log(`   ❌ USDC FAILED: ${error.message}`);
        console.log(`   Error reason:`, error.reason || error.data || "Unknown");
        console.log("");
    }

    // Test WBTC
    console.log("2️⃣ Testing WBTC...");
    try {
        const wbtcValue = await valueCalculator.calculateTokenValuePure("WBTC");
        console.log(`   ✅ WBTC Value: ${ethers.formatEther(wbtcValue)} ETH\n`);
    } catch (error: any) {
        console.log(`   ❌ WBTC FAILED: ${error.message}`);
        console.log(`   Error reason:`, error.reason || error.data || "Unknown");
        console.log("");
    }

    // Test USDT
    console.log("3️⃣ Testing USDT...");
    try {
        const usdtValue = await valueCalculator.calculateTokenValuePure("USDT");
        console.log(`   ✅ USDT Value: ${ethers.formatEther(usdtValue)} ETH\n`);
    } catch (error: any) {
        console.log(`   ❌ USDT FAILED: ${error.message}`);
        console.log(`   Error reason:`, error.reason || error.data || "Unknown");
        console.log("");
    }

    // Now test getTotalPoolValue
    console.log("4️⃣ Testing getTotalPoolValue...");
    try {
        const poolInfo = await valueCalculator.getTotalPoolValue();
        console.log(`   ✅ Total Value: ${ethers.formatEther(poolInfo.totalValue)} ETH`);
        console.log(`   Token breakdown:`);
        for (const tv of poolInfo.tokenValues) {
            if (tv.tokenCode && tv.tokenCode !== "") {
                console.log(`      - ${tv.tokenCode}: ${ethers.formatEther(tv.value)} ETH`);
            }
        }
    } catch (error: any) {
        console.log(`   ❌ getTotalPoolValue FAILED: ${error.message}`);
        console.log(`   Error reason:`, error.reason || error.data || "Unknown");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
