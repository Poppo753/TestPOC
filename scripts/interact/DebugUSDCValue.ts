import { ethers } from "hardhat";

async function main() {
    console.log("🔍 INVESTIGATING USDC VALUE CALCULATION\n");

    const tokenManagerAddress = "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517";
    const tokenManager = await ethers.getContractAt("TokenManager", tokenManagerAddress);
    
    const valueCalculatorAddress = "0x4d763776C4474dc055CF7F1430b2DeeA9160283b";
    const valueCalculator = await ethers.getContractAt("ValueCalculator", valueCalculatorAddress);
    
    const proxyAddress = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";

    console.log("📊 USDC DETAILS:\n");

    // Get USDC info from TokenManager
    const usdcInfo = await tokenManager.getTokenInfo("USDC");
    console.log(`   Token Address: ${usdcInfo.tokenAddress}`);
    console.log(`   Token Decimals: ${usdcInfo.tokenDecimals}`);
    console.log(`   Price Feed: ${usdcInfo.priceFeed}`);
    console.log(`   Is Active: ${usdcInfo.isActive}\n`);

    // Get USDC balance in pool
    const usdc = await ethers.getContractAt("IERC20", usdcInfo.tokenAddress);
    const balance = await usdc.balanceOf(proxyAddress);
    console.log(`💰 USDC Balance in Pool: ${ethers.formatUnits(balance, usdcInfo.tokenDecimals)} USDC (raw: ${balance})\n`);

    // Get USDC price from Chainlink
    const [price, timestamp, isStale] = await tokenManager.getTokenPrice("USDC");
    const now = Math.floor(Date.now() / 1000);
    const age = now - Number(timestamp);
    
    console.log(`📈 Chainlink Price Feed:`);
    console.log(`   Price (raw): ${price}`);
    console.log(`   Price (formatted): ${ethers.formatEther(price)} ETH per USDC`);
    console.log(`   Timestamp: ${timestamp} (${age} seconds ago = ${(age / 3600).toFixed(2)} hours)`);
    console.log(`   Is Stale: ${isStale}\n`);

    // Manual calculation to understand the formula
    console.log(`🧮 MANUAL VALUE CALCULATION:`);
    console.log(`   Formula: (balance * price) / (10 ** decimals)`);
    console.log(`   Balance: ${balance}`);
    console.log(`   Price: ${price}`);
    console.log(`   Decimals: ${usdcInfo.tokenDecimals}`);
    
    const divisor = 10n ** BigInt(usdcInfo.tokenDecimals);
    console.log(`   Divisor (10^${usdcInfo.tokenDecimals}): ${divisor}`);
    
    const numerator = balance * price;
    console.log(`   Numerator (balance * price): ${numerator}`);
    
    const value = numerator / divisor;
    console.log(`   Result: ${value}`);
    console.log(`   Result (ETH): ${ethers.formatEther(value)} ETH\n`);

    // Get value from contract
    const contractValue = await valueCalculator.calculateTokenValuePure("USDC");
    console.log(`✅ Contract Calculated Value: ${contractValue}`);
    console.log(`✅ Contract Value (ETH): ${ethers.formatEther(contractValue)} ETH\n`);

    // Compare with expected value
    console.log(`📊 EXPECTED vs ACTUAL:`);
    
    // Assuming USDC = $1 and ETH = $2500
    const ethPriceUSD = 2500;
    const usdcAmount = Number(ethers.formatUnits(balance, usdcInfo.tokenDecimals));
    const expectedValueUSD = usdcAmount * 1; // USDC = $1
    const expectedValueETH = expectedValueUSD / ethPriceUSD;
    
    console.log(`   USDC Amount: ${usdcAmount} USDC`);
    console.log(`   Expected Value: ~$${expectedValueUSD.toFixed(2)} = ~${expectedValueETH.toFixed(6)} ETH (at $${ethPriceUSD}/ETH)`);
    console.log(`   Actual Value: ${ethers.formatEther(contractValue)} ETH`);
    
    const actualValueETH = Number(ethers.formatEther(contractValue));
    const ratio = expectedValueETH / actualValueETH;
    console.log(`   Ratio (Expected/Actual): ${ratio.toFixed(0)}x\n`);

    // Check Chainlink price feed directly
    console.log(`🔗 CHECKING CHAINLINK FEED DIRECTLY:\n`);
    const chainlinkAdapter = await ethers.getContractAt("ChainlinkAdapter", "0x16a5201814Ba08E8a7c8C1f59f83E0409206761c");
    
    try {
        const feedData = await chainlinkAdapter.getLatestPrice(usdcInfo.priceFeed);
        console.log(`   Raw Chainlink Answer: ${feedData.answer}`);
        console.log(`   Decimals: ${feedData.decimals}`);
        console.log(`   Timestamp: ${feedData.timestamp}`);
        
        // Price should be USDC/ETH, meaning how much ETH for 1 USDC
        const pricePerUSDC = Number(feedData.answer) / (10 ** Number(feedData.decimals));
        console.log(`   Price per USDC: ${pricePerUSDC} (${1/pricePerUSDC} USDC per ETH = $${(1/pricePerUSDC * ethPriceUSD).toFixed(2)} per USDC)`);
        
    } catch (error: any) {
        console.log(`   ❌ Error reading Chainlink: ${error.message}`);
    }

    console.log("\n🎯 DIAGNOSIS:");
    if (ratio > 1000) {
        console.log("   ⚠️  Value is 1000x+ too low!");
        console.log("   Possible causes:");
        console.log("   1. Wrong Chainlink price feed (should be USDC/ETH, not ETH/USD)");
        console.log("   2. Decimal mismatch in calculation");
        console.log("   3. Price feed returns inverted value");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
