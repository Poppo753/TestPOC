import { ethers } from "hardhat";

async function main() {
    console.log("🔍 DEBUG: VALUE CALCULATION ANALYSIS\n");

    // Get contracts
    // Get contracts
    const beaconAddress = "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870";
    const beacon = await ethers.getContractAt("Beacon", beaconAddress);
    const valueCalculatorAddress = await beacon.getImplementation("ValueCalculator");
    
    const valueCalculator = await ethers.getContractAt("ValueCalculator", valueCalculatorAddress);
    const tokenManagerAddress = "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517";
    const tokenManager = await ethers.getContractAt("TokenManager", tokenManagerAddress);
    const proxyGeneralAddress = "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1";
    
    console.log("📋 Contracts:");
    console.log(`   ValueCalculator: ${valueCalculatorAddress}`);
    console.log(`   TokenManager: ${tokenManagerAddress}`);
    console.log(`   ProxyGeneral: ${proxyGeneralAddress}\n`);

    // Get active tokens
    const activeTokens = await tokenManager.getActiveTokens();
    console.log("🪙 Active Tokens:", activeTokens, "\n");

    // Check WETH balance
    const wethAddress = await tokenManager.getTokenAddress("WETH");
    const weth = await ethers.getContractAt("IERC20", wethAddress);
    const wethBalance = await weth.balanceOf(proxyGeneralAddress);
    console.log(`💰 WETH Balance: ${ethers.formatEther(wethBalance)} WETH\n`);

    // Try to calculate each token value individually
    console.log("🔍 Testing Individual Token Calculations:\n");
    
    for (const tokenCode of activeTokens) {
        try {
            console.log(`   Testing ${tokenCode}...`);
            
            // Get token info
            const tokenAddress = await tokenManager.getTokenAddress(tokenCode);
            const token = await ethers.getContractAt("IERC20", tokenAddress);
            const balance = await token.balanceOf(proxyGeneralAddress);
            const erc20 = await ethers.getContractAt("contracts/interfaces/IERC20Metadata.sol:IERC20Metadata", tokenAddress);
            const decimals = await erc20.decimals();
            
            console.log(`      Address: ${tokenAddress}`);
            console.log(`      Balance: ${ethers.formatUnits(balance, decimals)} ${tokenCode}`);
            
            // Try calculateTokenValuePure
            try {
                const value = await valueCalculator.calculateTokenValuePure(tokenCode);
                console.log(`      ✅ Value: ${ethers.formatEther(value)} ETH`);
            } catch (error: any) {
                console.log(`      ❌ calculateTokenValuePure FAILED:`, error.message);
            }
            
            console.log("");
        } catch (error: any) {
            console.log(`      ❌ ERROR:`, error.message, "\n");
        }
    }

    // Now test getTotalPoolValue
    console.log("📊 Testing getTotalPoolValue():\n");
    try {
        const poolInfo = await valueCalculator.getTotalPoolValue();
        console.log(`   ✅ Total Value: ${ethers.formatEther(poolInfo.totalValue)} ETH`);
        console.log(`   Token Values:`);
        for (const tokenValue of poolInfo.tokenValues) {
            if (tokenValue.tokenCode && tokenValue.tokenCode !== "") {
                console.log(`      ${tokenValue.tokenCode}: ${ethers.formatEther(tokenValue.value)} ETH (${Number(tokenValue.percentage) / 100}%)`);
            }
        }
    } catch (error: any) {
        console.log(`   ❌ getTotalPoolValue FAILED:`, error.message);
        console.log(`   Error data:`, error.data);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
