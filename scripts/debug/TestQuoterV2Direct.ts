import hre from "hardhat";

async function main() {
    const QUOTER_V2 = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
    const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const AMOUNT_USDC = hre.ethers.parseUnits("0.566444", 6);
    const AMOUNT_WETH = hre.ethers.parseEther("0.0001");
    
    const quoter = await hre.ethers.getContractAt(
        [
            "function quoteExactInputSingle((address,address,uint256,uint24,uint160)) external returns (uint256,uint160,uint32,uint256)"
        ],
        QUOTER_V2
    );
    
    console.log("\n🔍 Testing Uniswap V3 Quoter V2 DIRETTAMENTE...\n");
    
    // Test 1: USDC → WBTC
    console.log("1️⃣ USDC → WBTC");
    console.log(`   Amount: ${hre.ethers.formatUnits(AMOUNT_USDC, 6)} USDC`);
    
    for (const fee of [100, 500, 3000, 10000]) {
        try {
            const result = await quoter.quoteExactInputSingle.staticCall([
                USDC,
                WBTC,
                AMOUNT_USDC,
                fee,
                0
            ]);
            console.log(`   Fee ${fee}: ${hre.ethers.formatUnits(result[0], 8)} WBTC ✅`);
        } catch (error: any) {
            console.log(`   Fee ${fee}: FAILED (${error.message.substring(0, 50)})`);
        }
    }
    
    // Test 2: WETH → USDC
    console.log("\n2️⃣ WETH → USDC");
    console.log(`   Amount: ${hre.ethers.formatEther(AMOUNT_WETH)} WETH`);
    
    for (const fee of [100, 500, 3000, 10000]) {
        try {
            const result = await quoter.quoteExactInputSingle.staticCall([
                WETH,
                USDC,
                AMOUNT_WETH,
                fee,
                0
            ]);
            console.log(`   Fee ${fee}: ${hre.ethers.formatUnits(result[0], 6)} USDC ✅`);
        } catch (error: any) {
            console.log(`   Fee ${fee}: FAILED (${error.message.substring(0, 50)})`);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
