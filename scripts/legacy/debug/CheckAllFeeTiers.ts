import hre from "hardhat";

//to check if tier is present in Uniswap V3

async function main() {
    const QUOTER_V2 = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
    const AMOUNT = hre.ethers.parseUnits("0.566444", 6); // USDC
    
    const quoter = await hre.ethers.getContractAt("IUniswapV3QuoterV2", QUOTER_V2);
    
    const fees = [100, 500, 3000, 10000];
    
    console.log("\n🔍 Testing USDC → WBTC quotes for all fee tiers...");
    console.log(`Amount: ${hre.ethers.formatUnits(AMOUNT, 6)} USDC\n`);
    
    for (const fee of fees) {
        try {
            const result = await quoter.quoteExactInputSingle.staticCall({
                tokenIn: USDC,
                tokenOut: WBTC,
                amountIn: AMOUNT,
                fee: fee,
                sqrtPriceLimitX96: 0
            });
            
            console.log(`Fee ${fee.toString().padStart(5)}: ${hre.ethers.formatUnits(result.amountOut, 8)} WBTC ✅`);
        } catch (error: any) {
            console.log(`Fee ${fee.toString().padStart(5)}: FAILED ❌`);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
