import { ethers } from "hardhat";

async function main() {
    console.log("============================================================");
    console.log("  CHECK SIMPLESWAP AT DOCUMENTED ADDRESS");
    console.log("============================================================\n");

    // Indirizzo documentato nei commenti di UniswapV3Plugin.sol
    const DOCUMENTED_SIMPLESWAP = "0xa0DB78167CBAccD47524a261b7741C6B41Bbd096";
    
    // Indirizzo attualmente nel plugin deployato
    const CURRENT_IN_PLUGIN = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
    
    console.log("Documented SimpleSwap address (from code comments):");
    console.log(`  ${DOCUMENTED_SIMPLESWAP}`);
    console.log("\nCurrent address in deployed plugin:");
    console.log(`  ${CURRENT_IN_PLUGIN}\n`);
    
    // Check documented address
    console.log("Checking documented address...");
    const code1 = await ethers.provider.getCode(DOCUMENTED_SIMPLESWAP);
    if (code1 === "0x") {
        console.log(`❌ NO CONTRACT at documented address`);
    } else {
        console.log(`✅ Contract exists! Code size: ${code1.length} bytes`);
        
        // Try ISimpleSwap interface
        try {
            const simpleSwap = await ethers.getContractAt("ISimpleSwap", DOCUMENTED_SIMPLESWAP);
            const result = await simpleSwap.getExpectedOutput(
                "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH
                "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC
                ethers.parseEther("0.0001")
            );
            console.log(`✅ ISimpleSwap interface WORKS!`);
            console.log(`   Expected output: ${result.toString()}`);
        } catch (error: any) {
            console.log(`❌ ISimpleSwap interface FAILED: ${error.message}`);
        }
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("CONCLUSION:");
    console.log("=".repeat(60));
    
    if (code1 === "0x") {
        console.log(`
❌ SimpleSwap NON ESISTE all'indirizzo documentato
   
   OPZIONI:
   1. Deploy SimpleSwap wrapper a quell'indirizzo (impossibile)
   2. Deploy nuovo SimpleSwap e re-deploy UniswapV3Plugin
   3. Modifica UniswapV3Plugin per chiamare direttamente Uniswap Router
        `);
    } else {
        console.log(`
✅ SimpleSwap ESISTE all'indirizzo documentato!
   
   SOLUZIONE:
   - Re-deploy UniswapV3Plugin con indirizzo corretto: ${DOCUMENTED_SIMPLESWAP}
   - Poi registralo nel Beacon
        `);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
