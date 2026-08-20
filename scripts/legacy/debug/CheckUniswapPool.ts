import { ethers } from "hardhat";

/**
 * DEBUG UNISWAP V3 POOL EXISTENCE
 * 
 * Check if WETH/USDC pool exists on Uniswap V3 with 0.3% fee
 */

const UNISWAP_V3_FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const FEE_3000 = 3000; // 0.3%
const FEE_500 = 500; // 0.05%
const FEE_10000 = 10000; // 1%

async function main() {
    console.log("============================================================");
    console.log("  CHECK UNISWAP V3 POOL");
    console.log("============================================================\n");

    const factory = await ethers.getContractAt(
        ["function getPool(address,address,uint24) view returns (address)"],
        UNISWAP_V3_FACTORY
    );

    console.log("Checking WETH/USDC pools on Uniswap V3 Factory...\n");

    // Try 0.3% fee
    const pool3000 = await factory.getPool(WETH, USDC, FEE_3000);
    console.log(`Fee 0.3% (3000): ${pool3000}`);
    
    if (pool3000 !== ethers.ZeroAddress) {
        console.log("✅ Pool exists!");
        
        // Get pool info
        const poolContract = await ethers.getContractAt(
            [
                "function liquidity() view returns (uint128)",
                "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)"
            ],
            pool3000
        );
        
        const liquidity = await poolContract.liquidity();
        const [sqrtPriceX96] = await poolContract.slot0();
        
        console.log(`   Liquidity: ${liquidity.toString()}`);
        console.log(`   SqrtPriceX96: ${sqrtPriceX96.toString()}`);
    } else {
        console.log("❌ Pool does NOT exist");
    }

    // Try 0.05% fee
    console.log();
    const pool500 = await factory.getPool(WETH, USDC, FEE_500);
    console.log(`Fee 0.05% (500): ${pool500}`);
    
    if (pool500 !== ethers.ZeroAddress) {
        console.log("✅ Pool exists!");
        
        const poolContract = await ethers.getContractAt(
            ["function liquidity() view returns (uint128)"],
            pool500
        );
        
        const liquidity = await poolContract.liquidity();
        console.log(`   Liquidity: ${liquidity.toString()}`);
    } else {
        console.log("❌ Pool does NOT exist");
    }

    // Try 1% fee
    console.log();
    const pool10000 = await factory.getPool(WETH, USDC, FEE_10000);
    console.log(`Fee 1% (10000): ${pool10000}`);
    
    if (pool10000 !== ethers.ZeroAddress) {
        console.log("✅ Pool exists!");
        
        const poolContract = await ethers.getContractAt(
            ["function liquidity() view returns (uint128)"],
            pool10000
        );
        
        const liquidity = await poolContract.liquidity();
        console.log(`   Liquidity: ${liquidity.toString()}`);
    } else {
        console.log("❌ Pool does NOT exist");
    }

    console.log("\n============================================================");
    console.log("RECOMMENDATION:");
    console.log("Use the fee tier with the most liquidity");
    console.log("============================================================");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
