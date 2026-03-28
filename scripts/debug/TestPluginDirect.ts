import { ethers } from "hardhat";

async function main() {
    console.log("🔍 Testing plugin.getExpectedOutput() DIRECTLY...\n");

    const PLUGIN = "0x78C1124Ef74DAD20285a790FdA03cBeeB17Dcfcf";
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
    const AMOUNT_IN = ethers.parseUnits("0.566444", 6); // USDC 6 decimals
    
    const plugin = await ethers.getContractAt("UniswapV3PluginDirect", PLUGIN);
    
    console.log(`Plugin: ${PLUGIN}`);
    console.log(`USDC: ${USDC}`);
    console.log(`WBTC: ${WBTC}`);
    console.log(`Amount In: ${ethers.formatUnits(AMOUNT_IN, 6)} USDC`);
    console.log(`Decimals In: 6 (USDC)`);
    console.log(`Decimals Out: 8 (WBTC)\n`);
    
    try {
        const quote = await plugin.getExpectedOutput(USDC, WBTC, AMOUNT_IN, 6, 8);
        
        console.log(`✅ Quote received: ${quote.toString()}`);
        console.log(`   Formatted: ${ethers.formatUnits(quote, 8)} WBTC`);
        
        if (quote === 0n) {
            console.log("\n❌ PROBLEMA: Quote è ZERO!");
            console.log("\n🔍 Testing anche WETH→USDC per confronto...");
            
            const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
            const wethAmount = ethers.parseEther("0.0001");
            const wethQuote = await plugin.getExpectedOutput(WETH, USDC, wethAmount, 18, 6);
            console.log(`WETH→USDC quote: ${ethers.formatUnits(wethQuote, 6)} USDC`);
        }
        
    } catch (error: any) {
        console.error("\n❌ getExpectedOutput() FAILED:");
        console.error(error.message);
        
        if (error.data) {
            console.log("\n🔍 Error data:", error.data);
        }
    }
}

main().then(() => process.exit(0)).catch(console.error);
