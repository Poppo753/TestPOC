import hre from "hardhat";

async function main() {
    const PLUGIN = "0x6E775865308E1C1C1aa0a08c31F2aF799D50801a"; // MANUAL CALCULATION
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
    const AMOUNT = hre.ethers.parseUnits("0.566444", 6); // USDC
    
    console.log("\n🔍 Testing UniswapV3PluginDirect...");
    console.log(`Plugin: ${PLUGIN}`);
    console.log(`USDC: ${USDC}`);
    console.log(`WBTC: ${WBTC}`);
    console.log(`Amount: ${hre.ethers.formatUnits(AMOUNT, 6)} USDC\n`);
    
    const plugin = await hre.ethers.getContractAt("UniswapV3PluginDirect", PLUGIN);
    
    try {
        console.log("📞 Calling getExpectedOutput(USDC, WBTC, amount, 6, 8) with staticCall...");
        const quote = await plugin.getExpectedOutput.staticCall(USDC, WBTC, AMOUNT, 6, 8);
        console.log(`✅ Quote: ${hre.ethers.formatUnits(quote, 8)} WBTC`);
        
        if (quote === 0n) {
            console.log("\n⚠️  Quote is ZERO - plugin staticcall to Quoter V2 failed!");
            console.log("Possible reasons:");
            console.log("  1. Quoter V2 quoteExactInputSingle() is not view-compatible");
            console.log("  2. Fee tier 3000 has no liquidity");
            console.log("  3. Encoding error in plugin");
        }
    } catch (error: any) {
        console.log(`❌ ERROR: ${error.message}`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
