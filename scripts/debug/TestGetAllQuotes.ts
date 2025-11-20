import hre from "hardhat";

async function main() {
    const SWAP_MANAGER = "0xA1b7B8C442c3c1F342BB9C44b7d0733D0c9Ff357";
    const AMOUNT_IN = hre.ethers.parseUnits("0.566444", 6); // USDC has 6 decimals
    
    const swapManager = await hre.ethers.getContractAt("SwapManager", SWAP_MANAGER);
    
    console.log("\n🔍 Testing getAllQuotes()...");
    console.log(`Amount In: ${hre.ethers.formatUnits(AMOUNT_IN, 6)} USDC`);
    
    try {
        const quotes = await swapManager.getAllQuotes("USDC", "WBTC", AMOUNT_IN);
        
        console.log(`\n📊 Received ${quotes.length} quotes:\n`);
        
        for (let i = 0; i < quotes.length; i++) {
            const q = quotes[i];
            console.log(`${i + 1}. Plugin: ${q.pluginName}`);
            console.log(`   Valid: ${q.isValid}`);
            console.log(`   Quote: ${q.quote.toString()}`);
            console.log(`   Quote (formatted): ${hre.ethers.formatUnits(q.quote, 8)} WBTC`);
            console.log(`   Error: ${q.errorReason}`);
            console.log("");
        }
        
    } catch (error: any) {
        console.error("\n❌ getAllQuotes() FAILED:");
        console.error(error.message);
        
        if (error.data) {
            console.log("\n🔍 Error data:", error.data);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
