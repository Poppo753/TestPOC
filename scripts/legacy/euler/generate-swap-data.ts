/**
 * @file generate-swap-data.ts
 * @description Genera swapData per operazioni leverage EulerV2Plugin usando 1inch API
 * 
 * USAGE:
 * npx hardhat run scripts/euler/generate-swap-data.ts --network arbitrum
 * 
 * FORMATO SWAPDATA:
 * Lo swapData per Euler Swapper deve essere: abi.encodeCall(ISwapper.swap, SwapParams)
 * 
 * SwapParams (interfaccia reale Euler):
 * struct SwapParams {
 *     bytes32 handler;    // "Generic", "UniswapV2", "UniswapV3"
 *     uint256 mode;       // 0=EXACT_IN, 1=EXACT_OUT, 2=TARGET_DEBT
 *     address account;    // account che controlla
 *     address tokenIn;
 *     address tokenOut;
 *     uint256 amountOut;  // per EXACT_IN: minAmountOut
 *     address vaultIn;    // vault da cui prendere input
 *     address accountIn;  // account owner in vaultIn
 *     address receiver;   // chi riceve output
 *     bytes data;         // handler-specific data
 * }
 */

import { ethers } from "hardhat";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";

// ==================== CONFIGURATION ====================

const ONEINCH_API_KEY = process.env.ONEINCH_API_KEY ?? "";
const ONEINCH_API_URL = "https://api.1inch.dev/swap/v6.0/42161";
const ONEINCH_ROUTER = "0x111111125421ca6dc452d289314280a0f8842a65";

// Euler V2 Arbitrum addresses
const EULER = {
    SWAPPER: "0x6eE488A00A2ef1E2764cD7245F8a77C40060A7C7",
    SWAP_VERIFIER: "0x7b16DAaFa76CfeC8C08D7a68aF31949B37ebfdF5",
    EVC: "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066",
    VAULTS: {
        WETH: "0x78E3E051D32157AACD550fBB78458762d8f7edFF",
        USDC: "0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899",
    },
};

// Token addresses on Arbitrum
const TOKENS = {
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
};

// Euler Swapper Handler Types
const HANDLER_GENERIC = ethers.encodeBytes32String("Generic");
const HANDLER_UNISWAP_V3 = ethers.encodeBytes32String("UniswapV3");

// Swap modes
const MODE_EXACT_IN = 0n;
const MODE_EXACT_OUT = 1n;
const MODE_TARGET_DEBT = 2n;

// ==================== 1INCH API ====================

async function get1inchSwapData(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    slippageBps: number
): Promise<{ toAmount: string; tx: { data: string } }> {
    console.log("\n📡 Calling 1inch API...");
    console.log(`   From: ${tokenIn}`);
    console.log(`   To: ${tokenOut}`);
    console.log(`   Amount: ${amountIn.toString()}`);
    
    const url = `${ONEINCH_API_URL}/swap`;
    
    const response = await axios.get(url, {
        headers: {
            "Authorization": `Bearer ${ONEINCH_API_KEY}`,
            "Accept": "application/json",
        },
        params: {
            src: tokenIn,
            dst: tokenOut,
            amount: amountIn.toString(),
            from: EULER.SWAPPER, // Swapper eseguirà lo swap
            slippage: slippageBps / 100, // Convert bps to percentage
            receiver: EULER.SWAPPER, // Swapper riceve
            disableEstimate: true, // Skip gas estimation
        },
    });
    
    console.log(`   ✅ Expected output: ${response.data.dstAmount}`);
    
    return {
        toAmount: response.data.dstAmount,
        tx: { data: response.data.tx.data },
    };
}

// ==================== SWAPDATA BUILDER ====================

/**
 * Costruisce lo swapData nel formato corretto per Euler Swapper
 * 
 * Il Swapper si aspetta: abi.encodeCall(ISwapper.swap, SwapParams)
 * Per HANDLER_GENERIC, il campo `data` deve essere: abi.encode(target, calldata)
 */
function buildSwapData(params: {
    handler: string;
    mode: bigint;
    account: string;
    tokenIn: string;
    tokenOut: string;
    amountOut: bigint;
    vaultIn: string;
    accountIn: string;
    receiver: string;
    aggregatorTarget: string;
    aggregatorCalldata: string;
}): string {
    // Per GenericHandler: data = abi.encode(targetAddress, targetCalldata)
    const handlerData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "bytes"],
        [params.aggregatorTarget, params.aggregatorCalldata]
    );
    
    // SwapParams struct
    const swapParamsTypes = [
        "bytes32",  // handler
        "uint256",  // mode
        "address",  // account
        "address",  // tokenIn
        "address",  // tokenOut
        "uint256",  // amountOut
        "address",  // vaultIn
        "address",  // accountIn
        "address",  // receiver
        "bytes",    // data
    ];
    
    const swapParamsValues = [
        params.handler,
        params.mode,
        params.account,
        params.tokenIn,
        params.tokenOut,
        params.amountOut,
        params.vaultIn,
        params.accountIn,
        params.receiver,
        handlerData,
    ];
    
    // Encode la chiamata ISwapper.swap(SwapParams)
    // Il selector per swap((bytes32,uint256,address,address,address,uint256,address,address,address,bytes))
    const SWAP_SELECTOR = ethers.id("swap((bytes32,uint256,address,address,address,uint256,address,address,address,bytes))").slice(0, 10);
    
    // Encode params come tuple
    const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(
        [`tuple(${swapParamsTypes.join(",")})`],
        [swapParamsValues]
    );
    
    return SWAP_SELECTOR + encodedParams.slice(2);
}

// ==================== LEVERAGE SWAPDATA GENERATORS ====================

/**
 * Genera swapData per aprire una posizione leverage WETH/USDC
 * 
 * Flusso leverage:
 * 1. Deposita WETH come collaterale
 * 2. Prende in prestito USDC dal vault USDC
 * 3. Swappa USDC → WETH via Swapper
 * 4. Deposita WETH nel vault (aumenta collaterale)
 * 
 * Il batch EVC gestisce tutto atomicamente
 */
export async function generateOpenLeverageSwapData(
    borrowAmountUSDC: bigint,
    slippageBps: number = 100
): Promise<{ swapData: string; expectedWethOut: bigint }> {
    console.log("\n🔧 Generating Open Leverage SwapData...");
    console.log(`   Borrow amount: ${ethers.formatUnits(borrowAmountUSDC, 6)} USDC`);
    console.log(`   Slippage: ${slippageBps / 100}%`);
    
    // 1. Ottieni swap data da 1inch (USDC → WETH)
    const { toAmount, tx } = await get1inchSwapData(
        TOKENS.USDC,
        TOKENS.WETH,
        borrowAmountUSDC,
        slippageBps
    );
    
    const expectedWethOut = BigInt(toAmount);
    const minWethOut = expectedWethOut * BigInt(10000 - slippageBps) / 10000n;
    
    console.log(`   Expected WETH out: ${ethers.formatEther(expectedWethOut)} WETH`);
    console.log(`   Min WETH out: ${ethers.formatEther(minWethOut)} WETH`);
    
    // 2. Costruisci swapData per Euler Swapper
    const swapData = buildSwapData({
        handler: HANDLER_GENERIC,
        mode: MODE_EXACT_IN,
        account: ethers.ZeroAddress, // Sarà settato dal batch
        tokenIn: TOKENS.USDC,
        tokenOut: TOKENS.WETH,
        amountOut: minWethOut, // minAmountOut per slippage protection
        vaultIn: ethers.ZeroAddress, // Non usato per EXACT_IN
        accountIn: ethers.ZeroAddress, // Non usato
        receiver: EULER.VAULTS.WETH, // WETH va direttamente al vault
        aggregatorTarget: ONEINCH_ROUTER,
        aggregatorCalldata: tx.data,
    });
    
    return { swapData, expectedWethOut };
}

/**
 * Genera swapData per chiudere una posizione leverage
 * 
 * Flusso:
 * 1. Preleva tutto WETH dal vault
 * 2. Swappa una parte WETH → USDC (per ripagare debito)
 * 3. Ripaga il debito USDC
 * 4. WETH rimanente viene restituito all'utente
 */
export async function generateCloseLeverageSwapData(
    wethToSwap: bigint,
    slippageBps: number = 100
): Promise<{ swapData: string; expectedUsdcOut: bigint }> {
    console.log("\n🔧 Generating Close Leverage SwapData...");
    console.log(`   WETH to swap: ${ethers.formatEther(wethToSwap)} WETH`);
    
    // 1. Ottieni swap data da 1inch (WETH → USDC)
    const { toAmount, tx } = await get1inchSwapData(
        TOKENS.WETH,
        TOKENS.USDC,
        wethToSwap,
        slippageBps
    );
    
    const expectedUsdcOut = BigInt(toAmount);
    const minUsdcOut = expectedUsdcOut * BigInt(10000 - slippageBps) / 10000n;
    
    // 2. Costruisci swapData
    const swapData = buildSwapData({
        handler: HANDLER_GENERIC,
        mode: MODE_EXACT_IN,
        account: ethers.ZeroAddress,
        tokenIn: TOKENS.WETH,
        tokenOut: TOKENS.USDC,
        amountOut: minUsdcOut,
        vaultIn: ethers.ZeroAddress,
        accountIn: ethers.ZeroAddress,
        receiver: EULER.VAULTS.USDC,
        aggregatorTarget: ONEINCH_ROUTER,
        aggregatorCalldata: tx.data,
    });
    
    return { swapData, expectedUsdcOut };
}

// ==================== FALLBACK: UNISWAP V3 DIRECT ====================

/**
 * Fallback per quando 1inch non è disponibile
 * Usa direttamente UniswapV3 handler di Euler
 */
function buildUniswapV3SwapData(params: {
    tokenIn: string;
    tokenOut: string;
    amountIn: bigint;
    minAmountOut: bigint;
    poolFee: number;
}): string {
    // Per UniswapV3 handler, data = abi.encode(path)
    // Path format: tokenIn (20 bytes) + fee (3 bytes) + tokenOut (20 bytes)
    const path = ethers.solidityPacked(
        ["address", "uint24", "address"],
        [params.tokenIn, params.poolFee, params.tokenOut]
    );
    
    const handlerData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes"],
        [path]
    );
    
    const swapParamsTypes = [
        "bytes32", "uint256", "address", "address", "address",
        "uint256", "address", "address", "address", "bytes"
    ];
    
    const swapParamsValues = [
        HANDLER_UNISWAP_V3,
        MODE_EXACT_IN,
        ethers.ZeroAddress,
        params.tokenIn,
        params.tokenOut,
        params.minAmountOut,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        EULER.VAULTS.WETH, // receiver
        handlerData,
    ];
    
    const SWAP_SELECTOR = ethers.id("swap((bytes32,uint256,address,address,address,uint256,address,address,address,bytes))").slice(0, 10);
    
    const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(
        [`tuple(${swapParamsTypes.join(",")})`],
        [swapParamsValues]
    );
    
    return SWAP_SELECTOR + encodedParams.slice(2);
}

// ==================== MAIN ====================

async function main() {
    console.log("=".repeat(60));
    console.log("🚀 Euler V2 Leverage SwapData Generator");
    console.log("=".repeat(60));
    
    const borrowAmount = ethers.parseUnits("100", 6); // 100 USDC
    
    try {
        const { swapData, expectedWethOut } = await generateOpenLeverageSwapData(
            borrowAmount,
            100 // 1% slippage
        );
        
        console.log("\n" + "=".repeat(60));
        console.log("📋 RISULTATO:");
        console.log("=".repeat(60));
        console.log(`\nSwapData length: ${swapData.length} chars`);
        console.log(`Expected WETH output: ${ethers.formatEther(expectedWethOut)} WETH`);
        
        // Salva in file
        const outputPath = path.join(__dirname, "swap-data-cache.json");
        
        const cacheData = {
            timestamp: new Date().toISOString(),
            network: "arbitrum",
            operation: "openLeverage",
            borrowAmount: borrowAmount.toString(),
            borrowAmountFormatted: `${ethers.formatUnits(borrowAmount, 6)} USDC`,
            expectedWethOut: expectedWethOut.toString(),
            expectedWethOutFormatted: `${ethers.formatEther(expectedWethOut)} WETH`,
            swapData,
            addresses: {
                swapper: EULER.SWAPPER,
                router: ONEINCH_ROUTER,
                tokenIn: TOKENS.USDC,
                tokenOut: TOKENS.WETH,
                vaultWeth: EULER.VAULTS.WETH,
                vaultUsdc: EULER.VAULTS.USDC,
            },
        };
        
        fs.writeFileSync(outputPath, JSON.stringify(cacheData, null, 2));
        
        console.log(`\n✅ SwapData salvato in: ${outputPath}`);
        console.log("\n📝 SwapData (first 200 chars):");
        console.log(swapData.slice(0, 200) + "...");
        
    } catch (error: any) {
        console.error("\n❌ Errore:", error.message);
        
        if (error.response) {
            console.error("   Response status:", error.response.status);
            console.error("   Response data:", JSON.stringify(error.response.data, null, 2));
        }
        
        // Fallback: genera swapData usando Uniswap V3 diretto
        console.log("\n📌 Fallback: usando Uniswap V3 diretto");
        
        const estimatedWethOut = borrowAmount * BigInt(1e12) / 3500n; // ~3500 USDC/ETH
        const minWethOut = estimatedWethOut * 99n / 100n;
        
        const uniV3SwapData = buildUniswapV3SwapData({
            tokenIn: TOKENS.USDC,
            tokenOut: TOKENS.WETH,
            amountIn: borrowAmount,
            minAmountOut: minWethOut,
            poolFee: 500, // 0.05% pool
        });
        
        console.log("\nUniswap V3 SwapData generato!");
        console.log(`SwapData length: ${uniV3SwapData.length}`);
        
        // Salva fallback
        const outputPath = path.join(__dirname, "swap-data-cache.json");
        fs.writeFileSync(outputPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            network: "arbitrum",
            operation: "openLeverage",
            source: "uniswapV3-fallback",
            borrowAmount: borrowAmount.toString(),
            expectedWethOut: estimatedWethOut.toString(),
            swapData: uniV3SwapData,
        }, null, 2));
    }
}

// Exports
export {
    buildSwapData,
    buildUniswapV3SwapData,
    get1inchSwapData,
    EULER,
    TOKENS,
    HANDLER_GENERIC,
    HANDLER_UNISWAP_V3,
    MODE_EXACT_IN,
    MODE_EXACT_OUT,
};

// Run
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
