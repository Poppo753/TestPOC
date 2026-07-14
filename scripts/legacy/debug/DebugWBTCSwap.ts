/**
 * Debug WBTC Swap Failure
 * Verifica quale fee tier ha liquidità per WETH/WBTC
 */

import { ethers } from "hardhat";

const WETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const WBTC_ADDRESS = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
const UNISWAP_V3_FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

const FEE_TIERS = [
    { name: "0.01%", value: 100 },
    { name: "0.05%", value: 500 },
    { name: "0.3%", value: 3000 },
    { name: "1%", value: 10000 }
];

async function main() {
    console.log("🔍 Debugging WETH → WBTC Swap Failure\n");

    const [signer] = await ethers.getSigners();
    console.log(`Using account: ${signer.address}\n`);

    // Connect to Uniswap V3 Factory
    const factoryAbi = [
        "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
    ];

    const factory = await ethers.getContractAt(factoryAbi, UNISWAP_V3_FACTORY);

    console.log("Checking available pools for WETH/WBTC:\n");

    // Check all fee tiers
    for (const tier of FEE_TIERS) {
        try {
            const pool = await factory.getPool(WETH_ADDRESS, WBTC_ADDRESS, tier.value);
            
            if (pool === ethers.ZeroAddress) {
                console.log(`❌ ${tier.name} (${tier.value}): No pool exists`);
            } else {
                console.log(`✅ ${tier.name} (${tier.value}): Pool exists at ${pool}`);
                
                // Check pool liquidity
                const poolAbi = [
                    "function liquidity() external view returns (uint128)",
                    "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
                ];
                
                const poolContract = await ethers.getContractAt(poolAbi, pool);
                const liquidity = await poolContract.liquidity();
                const slot0 = await poolContract.slot0();
                
                console.log(`   Liquidity: ${liquidity.toString()}`);
                console.log(`   SqrtPriceX96: ${slot0.sqrtPriceX96.toString()}`);
                console.log(`   Tick: ${slot0.tick}`);
                console.log(`   Unlocked: ${slot0.unlocked}`);
            }
        } catch (error: any) {
            console.log(`⚠️  ${tier.name} (${tier.value}): Error checking - ${error.message}`);
        }
        console.log("");
    }

    // Try to get quote using Quoter V2
    console.log("\n🔍 Testing Quoter V2 for swap quotes:\n");

    const QUOTER_V2 = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
    const quoterAbi = [
        "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)"
    ];

    const quoter = await ethers.getContractAt(quoterAbi, QUOTER_V2);
    const testAmount = ethers.parseEther("0.00001"); // 0.00001 WETH

    for (const tier of FEE_TIERS) {
        try {
            console.log(`Testing ${tier.name} (${tier.value})...`);
            
            const quote = await quoter.quoteExactInputSingle.staticCall({
                tokenIn: WETH_ADDRESS,
                tokenOut: WBTC_ADDRESS,
                amountIn: testAmount,
                fee: tier.value,
                sqrtPriceLimitX96: 0
            });

            console.log(`✅ Quote successful!`);
            console.log(`   Input: ${ethers.formatEther(testAmount)} WETH`);
            console.log(`   Output: ${ethers.formatUnits(quote[0], 8)} WBTC`);
            console.log(`   Gas estimate: ${quote[3].toString()}`);
            
        } catch (error: any) {
            console.log(`❌ Quote failed: ${error.message.substring(0, 100)}`);
        }
        console.log("");
    }

    // Recommendation
    console.log("\n💡 RECOMMENDATION:");
    console.log("Based on the results above, update UniswapV3PluginDirect to use the fee tier with best liquidity");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n💥 Error:", error);
        process.exit(1);
    });
