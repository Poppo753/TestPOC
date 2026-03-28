import hre from "hardhat";

async function main() {
    const QUOTER_V2 = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
    const AMOUNT_IN = hre.ethers.parseUnits("0.566444", 6);
    const FEE = 3000;
    
    // Encode come fa il plugin
    const iface = new hre.ethers.Interface([
        "function quoteExactInputSingle((address,address,uint256,uint24,uint160)) external returns (uint256,uint160,uint32,uint256)"
    ]);
    
    const data = iface.encodeFunctionData("quoteExactInputSingle", [
        [USDC, WBTC, AMOUNT_IN, FEE, 0]
    ]);
    
    console.log("\n🔍 Encoded calldata:");
    console.log(data);
    console.log("");
    
    // Fai staticcall come fa il plugin
    const [signer] = await hre.ethers.getSigners();
    
    try {
        const result = await signer.provider.call({
            to: QUOTER_V2,
            data: data
        });
        
        console.log("✅ Staticcall succeeded!");
        console.log(`Raw result: ${result}`);
        
        if (result === "0x" || result.length <= 2) {
            console.log("\n❌ Result is EMPTY!");
        } else {
            const decoded = hre.ethers.AbiCoder.defaultAbiCoder().decode(
                ["uint256", "uint160", "uint32", "uint256"],
                result
            );
            console.log(`\nDecoded:`);
            console.log(`  amountOut: ${decoded[0].toString()} (${hre.ethers.formatUnits(decoded[0], 8)} WBTC)`);
            console.log(`  sqrtPriceX96After: ${decoded[1].toString()}`);
            console.log(`  initializedTicksCrossed: ${decoded[2].toString()}`);
            console.log(`  gasEstimate: ${decoded[3].toString()}`);
        }
        
    } catch (error: any) {
        console.error("\n❌ Staticcall FAILED:");
        console.error(error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
