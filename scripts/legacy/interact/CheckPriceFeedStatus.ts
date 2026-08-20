import { ethers } from "hardhat";

async function main() {
    console.log("🔍 CHECKING CHAINLINK PRICE FEEDS\n");

    const tokenManagerAddress = "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517";
    const tokenManager = await ethers.getContractAt("TokenManager", tokenManagerAddress);
    
    const valueCalculatorAddress = "0x4d763776C4474dc055CF7F1430b2DeeA9160283b";
    const valueCalculator = await ethers.getContractAt("ValueCalculator", valueCalculatorAddress);

    // Get maxPriceAge
    const maxPriceAge = await valueCalculator.maxPriceAge();
    console.log(`⏰ Max Price Age: ${maxPriceAge} seconds (${Number(maxPriceAge) / 3600} hours)\n`);

    const tokens = ["USDC", "WBTC", "USDT"];
    
    for (const tokenCode of tokens) {
        console.log(`📊 ${tokenCode}:`);
        
        try {
            // Get price from TokenManager
            const [price, timestamp, isStale] = await tokenManager.getTokenPrice(tokenCode);
            const now = Math.floor(Date.now() / 1000);
            const age = now - Number(timestamp);
            
            console.log(`   Price: $${ethers.formatEther(price)} ETH`);
            console.log(`   Timestamp: ${timestamp} (${age} seconds ago = ${(age / 3600).toFixed(2)} hours)`);
            console.log(`   Is Stale: ${isStale}`);
            console.log(`   Exceeds maxPriceAge: ${age > Number(maxPriceAge) ? "❌ YES" : "✅ NO"}`);
            
            // Get token balance
            const tokenAddress = await tokenManager.getTokenAddress(tokenCode);
            const token = await ethers.getContractAt("IERC20", tokenAddress);
            const proxyAddress = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
            const balance = await token.balanceOf(proxyAddress);
            const erc20 = await ethers.getContractAt("contracts/interfaces/IERC20Metadata.sol:IERC20Metadata", tokenAddress);
            const decimals = await erc20.decimals();
            
            console.log(`   Balance in pool: ${ethers.formatUnits(balance, decimals)} ${tokenCode}`);
            
            // Calculate what the value SHOULD be
            const valueInEth = (balance * price) / (10n ** decimals);
            console.log(`   Value if price accepted: ${ethers.formatEther(valueInEth)} ETH`);
            console.log("");
            
        } catch (error: any) {
            console.log(`   ❌ ERROR: ${error.message}\n`);
        }
    }
    
    console.log("📋 SUMMARY:");
    console.log("   The issue is that USDC and USDT Chainlink price feeds");
    console.log("   are not being updated frequently enough on Arbitrum.");
    console.log("   Their timestamps exceed maxPriceAge, so they get rejected.");
    console.log("   This causes getTotalPoolValue() to ignore them (value = 0).");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
