/**
 * @file swap-data-helper.ts
 * @description Helper per generare swapData nei test E2E di EulerV2Plugin
 * 
 * Questo modulo fornisce funzioni per:
 * 1. Generare swapData via 1inch API per leverage reale
 * 2. Generare swapData Uniswap V3 diretto (fallback)
 * 3. Cache dei risultati per evitare troppe chiamate API
 * 
 * FORMATO SWAPDATA:
 * Lo swapData passato a EulerV2Plugin.openLeveragePosition deve essere:
 * abi.encodeCall(ISwapper.swap, SwapParams(...))
 * 
 * Per HANDLER_GENERIC, SwapParams.data deve essere:
 * abi.encode(aggregatorAddress, aggregatorCalldata)
 */

import { ethers } from "hardhat";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";

// ==================== CONFIGURATION ====================

const ONEINCH_API_KEY = "j69cJtNJglZIf06DVK8qT6XvCAr5G5Ux";
const ONEINCH_API_URL = "https://api.1inch.dev/swap/v6.0/42161";

// Rate limiting: 1inch free tier = 1 request/second
const API_RATE_LIMIT_MS = 1100; // 1.1 secondi tra chiamate
let lastApiCall = 0;

// Cache file
const CACHE_FILE = path.join(__dirname, "swap-data-cache.json");

// Euler V2 Arbitrum
export const EULER = {
    SWAPPER: "0x6eE488A00A2ef1E2764cD7245F8a77C40060A7C7",
    SWAP_VERIFIER: "0x7b16DAaFa76CfeC8C08D7a68aF31949B37ebfdF5",
    EVC: "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066",
    VAULTS: {
        WETH: "0x78E3E051D32157AACD550fBB78458762d8f7edFF",
        USDC: "0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899",
    },
};

export const TOKENS = {
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
};

// Handler identifiers (bytes32 encoded strings)
export const HANDLER = {
    GENERIC: ethers.encodeBytes32String("Generic"),
    UNISWAP_V2: ethers.encodeBytes32String("UniswapV2"),
    UNISWAP_V3: ethers.encodeBytes32String("UniswapV3"),
};

// Swap modes
export const SWAP_MODE = {
    EXACT_IN: 0,
    EXACT_OUT: 1,
    TARGET_DEBT: 2,
};

// ==================== RATE LIMITING ====================

async function waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - lastApiCall;
    if (elapsed < API_RATE_LIMIT_MS) {
        await new Promise(resolve => setTimeout(resolve, API_RATE_LIMIT_MS - elapsed));
    }
    lastApiCall = Date.now();
}

// ==================== CACHE ====================

interface CacheEntry {
    timestamp: number;
    swapData: string;
    expectedOut: string;
    params: {
        tokenIn: string;
        tokenOut: string;
        amountIn: string;
    };
}

interface CacheData {
    entries: Record<string, CacheEntry>;
}

function getCacheKey(tokenIn: string, tokenOut: string, amountIn: bigint): string {
    return `${tokenIn}-${tokenOut}-${amountIn.toString()}`;
}

function loadCache(): CacheData {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const raw = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
            
            // Se è il formato vecchio generato da generate-swap-data.ts
            if (raw.swapData && !raw.entries) {
                // Converti in formato entries
                const tokenIn = raw.addresses?.tokenIn || TOKENS.USDC;
                const tokenOut = raw.addresses?.tokenOut || TOKENS.WETH;
                const amountIn = raw.borrowAmount || "100000000";
                const key = `${tokenIn}-${tokenOut}-${amountIn}`;
                
                return {
                    entries: {
                        [key]: {
                            timestamp: Date.parse(raw.timestamp) || Date.now(),
                            swapData: raw.swapData,
                            expectedOut: raw.expectedWethOut || "0",
                            params: { tokenIn, tokenOut, amountIn },
                        }
                    }
                };
            }
            
            // Formato nuovo con entries
            return raw;
        }
    } catch (e) {
        console.log("⚠️ Cache non trovata, creazione nuova...");
    }
    return { entries: {} };
}

function saveCache(cache: CacheData): void {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function getCachedSwapData(
    tokenIn: string, 
    tokenOut: string, 
    amountIn: bigint,
    maxAgeMs: number = 5 * 60 * 1000 // 5 minuti default
): { swapData: string; expectedOut: bigint } | null {
    const cache = loadCache();
    const key = getCacheKey(tokenIn, tokenOut, amountIn);
    const entry = cache.entries[key];
    
    if (entry && (Date.now() - entry.timestamp) < maxAgeMs) {
        console.log("   📦 Using cached swap data");
        return {
            swapData: entry.swapData,
            expectedOut: BigInt(entry.expectedOut),
        };
    }
    
    return null;
}

function cacheSwapData(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    swapData: string,
    expectedOut: bigint
): void {
    const cache = loadCache();
    const key = getCacheKey(tokenIn, tokenOut, amountIn);
    
    cache.entries[key] = {
        timestamp: Date.now(),
        swapData,
        expectedOut: expectedOut.toString(),
        params: {
            tokenIn,
            tokenOut,
            amountIn: amountIn.toString(),
        },
    };
    
    saveCache(cache);
}

// ==================== 1INCH API ====================

export async function get1inchQuote(params: {
    src: string;
    dst: string;
    amount: string;
}): Promise<{ dstAmount: string; srcAmount: string }> {
    await waitForRateLimit();
    
    const response = await axios.get(`${ONEINCH_API_URL}/quote`, {
        headers: {
            "Authorization": `Bearer ${ONEINCH_API_KEY}`,
            "Accept": "application/json",
        },
        params,
    });
    
    return response.data;
}

export async function get1inchSwap(params: {
    src: string;
    dst: string;
    amount: string;
    from: string;
    receiver: string;
    slippage: number;
}): Promise<{ tx: { to: string; data: string } }> {
    await waitForRateLimit();
    
    const response = await axios.get(`${ONEINCH_API_URL}/swap`, {
        headers: {
            "Authorization": `Bearer ${ONEINCH_API_KEY}`,
            "Accept": "application/json",
        },
        params: {
            ...params,
            disableEstimate: true,
        },
    });
    
    return response.data;
}

// ==================== SWAPPER INTERFACE ENCODING ====================

/**
 * Costruisce SwapParams struct per Euler Swapper
 */
function encodeSwapParams(params: {
    handler: string;  // bytes32
    mode: number;
    account: string;
    tokenIn: string;
    tokenOut: string;
    amountOut: bigint;
    vaultIn: string;
    accountIn: string;
    receiver: string;
    data: string;
}): string {
    // ISwapper.SwapParams struct encoding
    const swapperAbi = new ethers.Interface([
        "function swap((bytes32 handler, uint256 mode, address account, address tokenIn, address tokenOut, uint256 amountOut, address vaultIn, address accountIn, address receiver, bytes data) params)"
    ]);
    
    return swapperAbi.encodeFunctionData("swap", [{
        handler: params.handler,
        mode: params.mode,
        account: params.account,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountOut: params.amountOut,
        vaultIn: params.vaultIn,
        accountIn: params.accountIn,
        receiver: params.receiver,
        data: params.data,
    }]);
}

// ==================== SWAP DATA BUILDERS ====================

/**
 * Costruisce swapData per Euler Swapper usando 1inch (HANDLER_GENERIC)
 * 
 * Il formato finale è: abi.encodeCall(Swapper.swap, SwapParams)
 * dove SwapParams.data = abi.encode(aggregatorAddress, aggregatorCalldata)
 */
export async function build1inchSwapData(params: {
    tokenIn: string;
    tokenOut: string;
    amountIn: bigint;
    receiver: string;  // Chi riceve i token dopo lo swap (es. vault per deposit)
    slippageBps?: number;
    useCache?: boolean;
}): Promise<{ swapData: string; expectedOut: bigint; minOut: bigint }> {
    const slippageBps = params.slippageBps ?? 100; // 1% default
    const useCache = params.useCache ?? true;
    
    // Check cache
    if (useCache) {
        const cached = getCachedSwapData(params.tokenIn, params.tokenOut, params.amountIn);
        if (cached) {
            const minOut = cached.expectedOut * BigInt(10000 - slippageBps) / 10000n;
            return { ...cached, minOut };
        }
    }
    
    console.log("   🔄 Fetching from 1inch API...");
    
    // Get quote
    const quote = await get1inchQuote({
        src: params.tokenIn,
        dst: params.tokenOut,
        amount: params.amountIn.toString(),
    });
    
    const expectedOut = BigInt(quote.dstAmount);
    const minOut = expectedOut * BigInt(10000 - slippageBps) / 10000n;
    
    // Get swap calldata from 1inch
    // Il "from" deve essere lo Swapper perché lui avrà i token dopo il borrow
    const swapResponse = await get1inchSwap({
        src: params.tokenIn,
        dst: params.tokenOut,
        amount: params.amountIn.toString(),
        from: EULER.SWAPPER,
        receiver: params.receiver,
        slippage: slippageBps / 100,
    });
    
    const aggregatorAddress = swapResponse.tx.to;
    const aggregatorCalldata = swapResponse.tx.data;
    
    console.log(`   1inch Router: ${aggregatorAddress}`);
    
    // Encode handler data per HANDLER_GENERIC: abi.encode(target, calldata)
    const handlerData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "bytes"],
        [aggregatorAddress, aggregatorCalldata]
    );
    
    // Costruisci SwapParams e encode come call a Swapper.swap
    const swapData = encodeSwapParams({
        handler: HANDLER.GENERIC,
        mode: SWAP_MODE.EXACT_IN,
        account: ethers.ZeroAddress, // Ignorato per EXACT_IN
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountOut: 0n, // Ignorato per EXACT_IN
        vaultIn: ethers.ZeroAddress, // Ignorato per EXACT_IN
        accountIn: ethers.ZeroAddress, // Ignorato per EXACT_IN
        receiver: ethers.ZeroAddress, // Ignorato - receiver è nel calldata 1inch
        data: handlerData,
    });
    
    // Cache result
    if (useCache) {
        cacheSwapData(params.tokenIn, params.tokenOut, params.amountIn, swapData, expectedOut);
    }
    
    return { swapData, expectedOut, minOut };
}

/**
 * Costruisce swapData per Euler Swapper usando Uniswap V3 diretto
 * Non richiede API esterna, ma disponibile solo per EXACT_OUT mode
 * 
 * NOTA: UniswapV3Handler non supporta EXACT_IN!
 */
export function buildUniswapV3SwapData(params: {
    tokenIn: string;
    tokenOut: string;
    amountOut: bigint;
    account: string;  // Account per il repay
    vaultIn: string;  // Vault da cui prelevare input inutilizzato
    accountIn: string;
    receiver: string; // Vault dove depositare output
    poolFee?: number;
}): string {
    const poolFee = params.poolFee ?? 500; // 0.05% default (comune per WETH/stables)
    
    // UniswapV3 path format: tokenOut + fee + tokenIn (reversed for exactOutput)
    // Es: WETH → (fee 500) → USDC diventa bytes: USDC_addr + 0x0001F4 + WETH_addr
    const path = ethers.solidityPacked(
        ["address", "uint24", "address"],
        [params.tokenOut, poolFee, params.tokenIn]
    );
    
    return encodeSwapParams({
        handler: HANDLER.UNISWAP_V3,
        mode: SWAP_MODE.EXACT_OUT,
        account: params.account,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountOut: params.amountOut,
        vaultIn: params.vaultIn,
        accountIn: params.accountIn,
        receiver: params.receiver,
        data: path,
    });
}

// ==================== LEVERAGE HELPERS ====================

/**
 * Genera swapData per aprire posizione leverage
 * Scenario: WETH collateral, borrow USDC, swap USDC→WETH per aumentare leverage
 * 
 * Il receiver dello swap deve essere lo Swapper stesso (che poi fa deposit)
 * oppure direttamente il collateral vault (per skim)
 */
export async function getOpenLeverageSwapData(
    borrowAmountUSDC: bigint,
    collateralVault: string = EULER.VAULTS.WETH,
    slippageBps: number = 100,
    useApi: boolean = true
): Promise<{ swapData: string; expectedWethOut: bigint; minWethOut: bigint }> {
    console.log(`\n📊 Generating Open Leverage SwapData`);
    console.log(`   Borrow: ${ethers.formatUnits(borrowAmountUSDC, 6)} USDC`);
    console.log(`   Slippage: ${slippageBps / 100}%`);
    console.log(`   Using: ${useApi ? "1inch API" : "Uniswap V3 direct"}`);
    
    if (useApi) {
        try {
            const result = await build1inchSwapData({
                tokenIn: TOKENS.USDC,
                tokenOut: TOKENS.WETH,
                amountIn: borrowAmountUSDC,
                receiver: collateralVault, // Output va al vault per lo skim
                slippageBps,
            });
            
            console.log(`   ✅ Expected WETH: ${ethers.formatEther(result.expectedOut)}`);
            console.log(`   ✅ Min WETH: ${ethers.formatEther(result.minOut)}`);
            
            return {
                swapData: result.swapData,
                expectedWethOut: result.expectedOut,
                minWethOut: result.minOut,
            };
        } catch (error: any) {
            console.log(`   ⚠️ 1inch failed: ${error.message}`);
            if (!useApi) throw error;
            console.log(`   → Falling back to estimation`);
        }
    }
    
    // Fallback: stima senza API
    // Stima: ~3500 USDC per ETH (prezzo approssimativo)
    const ethPriceUSD = 3500n;
    const expectedWethOut = borrowAmountUSDC * BigInt(1e12) / ethPriceUSD;
    const minWethOut = expectedWethOut * BigInt(10000 - slippageBps) / 10000n;
    
    // Per fallback usiamo EXACT_OUT con Uniswap V3
    // Ma questo richiede che conosciamo l'amountOut, non amountIn
    // Quindi dobbiamo usare HANDLER_GENERIC con un calldata fittizio
    // In produzione, questo non funzionerà senza un vero calldata
    
    console.log(`   ⚠️ Using estimation only - real swap will fail without valid calldata`);
    console.log(`   ✅ Estimated WETH: ${ethers.formatEther(expectedWethOut)}`);
    
    // Return empty swapData for testing purposes
    // In production, this would need real 1inch API
    const swapData = encodeSwapParams({
        handler: HANDLER.GENERIC,
        mode: SWAP_MODE.EXACT_IN,
        account: ethers.ZeroAddress,
        tokenIn: TOKENS.USDC,
        tokenOut: TOKENS.WETH,
        amountOut: 0n,
        vaultIn: ethers.ZeroAddress,
        accountIn: ethers.ZeroAddress,
        receiver: ethers.ZeroAddress,
        data: "0x", // Empty - will fail on-chain
    });
    
    return { swapData, expectedWethOut, minWethOut };
}

/**
 * Genera swapData per chiudere posizione leverage
 * Scenario: swap WETH→USDC per ripagare debito
 */
export async function getCloseLeverageSwapData(
    wethAmount: bigint,
    borrowVault: string = EULER.VAULTS.USDC,
    slippageBps: number = 100,
    useApi: boolean = true
): Promise<{ swapData: string; expectedUsdcOut: bigint; minUsdcOut: bigint }> {
    console.log(`\n📊 Generating Close Leverage SwapData`);
    console.log(`   Swap: ${ethers.formatEther(wethAmount)} WETH`);
    console.log(`   Slippage: ${slippageBps / 100}%`);
    
    if (useApi) {
        try {
            const result = await build1inchSwapData({
                tokenIn: TOKENS.WETH,
                tokenOut: TOKENS.USDC,
                amountIn: wethAmount,
                receiver: borrowVault, // Output va al vault per repay
                slippageBps,
            });
            
            console.log(`   ✅ Expected USDC: ${ethers.formatUnits(result.expectedOut, 6)}`);
            
            return {
                swapData: result.swapData,
                expectedUsdcOut: result.expectedOut,
                minUsdcOut: result.minOut,
            };
        } catch (error: any) {
            console.log(`   ⚠️ 1inch failed, using estimation`);
        }
    }
    
    // Fallback
    const ethPriceUSD = 3500n;
    const expectedUsdcOut = wethAmount * ethPriceUSD / BigInt(1e12);
    const minUsdcOut = expectedUsdcOut * BigInt(10000 - slippageBps) / 10000n;
    
    const swapData = encodeSwapParams({
        handler: HANDLER.GENERIC,
        mode: SWAP_MODE.EXACT_IN,
        account: ethers.ZeroAddress,
        tokenIn: TOKENS.WETH,
        tokenOut: TOKENS.USDC,
        amountOut: 0n,
        vaultIn: ethers.ZeroAddress,
        accountIn: ethers.ZeroAddress,
        receiver: ethers.ZeroAddress,
        data: "0x",
    });
    
    return { swapData, expectedUsdcOut, minUsdcOut };
}

// ==================== ORACLE HELPER ====================

/**
 * Ottiene prezzo corrente WETH/USDC da 1inch
 * Utile per calcolare minCollateralReceived
 */
export async function getWethPriceInUSDC(): Promise<bigint> {
    try {
        const quote = await get1inchQuote({
            src: TOKENS.WETH,
            dst: TOKENS.USDC,
            amount: ethers.parseEther("1").toString(),
        });
        
        return BigInt(quote.dstAmount);
    } catch {
        // Fallback: prezzo hardcoded
        return ethers.parseUnits("3500", 6);
    }
}

/**
 * Calcola minCollateralReceived per apertura leverage
 */
export async function calculateMinCollateralReceived(
    borrowAmountUSDC: bigint,
    slippageBps: number = 200 // 2% slippage per calcolo conservativo
): Promise<bigint> {
    try {
        const quote = await get1inchQuote({
            src: TOKENS.USDC,
            dst: TOKENS.WETH,
            amount: borrowAmountUSDC.toString(),
        });
        
        const expectedOut = BigInt(quote.dstAmount);
        return expectedOut * BigInt(10000 - slippageBps) / 10000n;
    } catch {
        // Fallback
        const ethPriceUSD = 3500n;
        const expected = borrowAmountUSDC * BigInt(1e12) / ethPriceUSD;
        return expected * BigInt(10000 - slippageBps) / 10000n;
    }
}

// ==================== EXPORTS ====================

export default {
    EULER,
    TOKENS,
    HANDLER,
    SWAP_MODE,
    build1inchSwapData,
    buildUniswapV3SwapData,
    getOpenLeverageSwapData,
    getCloseLeverageSwapData,
    getWethPriceInUSDC,
    calculateMinCollateralReceived,
    get1inchQuote,
    get1inchSwap,
};
