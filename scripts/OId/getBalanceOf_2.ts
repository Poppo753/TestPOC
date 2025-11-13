import * as dotenv from "dotenv";
import { ethers } from "hardhat";
import { Contract, BaseContract } from "ethers";

dotenv.config();

// Types and Interfaces
type TokenCode = "wstETH" | "weETH" | "ezETH" | "rsETH";

interface TokenInfo {
    address: string;
    decimals: number;
    balance: bigint;
    price?: bigint;
    name: string;
    symbol: string;
    lastUpdated?: number;
}

interface TokenPriceManager extends BaseContract {
    getTokenPrice(token: TokenCode): Promise<bigint>;
    [key: string]: any;
}

interface ERC20Contract extends BaseContract {
    totalSupply(): Promise<bigint>;
    decimals(): Promise<number>;
    balanceOf(account: string): Promise<bigint>;
    name(): Promise<string>;
    symbol(): Promise<string>;
    [key: string]: any;
}

// Constants
const TOKEN_ADDRESSES_MAP: Record<TokenCode, string> = {
    wstETH: "0x4186BFC76E2E237523CBC30FD220FE055156b41F",
    weETH: "0x0fBcbaEA96Ce0cF7Ee00A8c19c3ab6f5Dc8E1921",
    ezETH: "0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe",
    rsETH: "0x2416092f143378750bb29b79eD961ab195CcEea5",
};

const TOKEN_MANAGER_ADDRESS = "0xCcFB44a82335447260CD56540c02191109D3e9ED";
const ACCOUNT_ADDRESS = "0x0B11d8d864A02B40970e1a39aaD4A20BdE4C0F95";
const TOKEN_ABI = [
    "function totalSupply() external view returns (uint256)",
    "function decimals() external view returns (uint8)",
    "function balanceOf(address account) external view returns (uint256)",
    "function name() external view returns (string)",
    "function symbol() external view returns (string)",
];

const TOKEN_MANAGER_ABI = [
    "function getTokenPrice(string) view returns (uint256)",
];

// Enhanced ContractManager with caching
class ContractManager {
    private contractInstances = new Map<string, ERC20Contract>();
    private decimalsCache = new Map<string, bigint>();
    private tokenDataCache = new Map<string, TokenInfo>();
    private valueCalculationCache = new Map<string, bigint>();
    private readonly TEN = BigInt(10);
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    constructor(private provider: any) {}

    async getTokenContract(address: string): Promise<ERC20Contract> {
        if (!this.contractInstances.has(address)) {
            const contract = await ethers.getContractAt(TOKEN_ABI, address);
            this.contractInstances.set(
                address,
                contract as unknown as ERC20Contract
            );
        }
        return this.contractInstances.get(address)!;
    }

    getDecimalsBigInt(decimals: number): bigint {
        const key = decimals.toString();
        if (!this.decimalsCache.has(key)) {
            this.decimalsCache.set(key, this.TEN ** BigInt(decimals));
        }
        return this.decimalsCache.get(key)!;
    }

    async getCachedTokenInfo(code: TokenCode): Promise<TokenInfo | null> {
        const cached = this.tokenDataCache.get(code);
        if (cached && cached.lastUpdated && 
            (Date.now() - cached.lastUpdated < this.CACHE_DURATION)) {
            return cached;
        }
        return null;
    }

    setCachedTokenInfo(code: TokenCode, info: TokenInfo) {
        this.tokenDataCache.set(code, {
            ...info,
            lastUpdated: Date.now()
        });
    }

    calculateTokenValue(balance: bigint, price: bigint, decimals: number): bigint {
        const key = `${balance.toString()}-${price.toString()}-${decimals}`;
        if (!this.valueCalculationCache.has(key)) {
            const decimalsBigInt = this.getDecimalsBigInt(decimals);
            this.valueCalculationCache.set(key, (balance * price) / decimalsBigInt);
        }
        return this.valueCalculationCache.get(key)!;
    }

    clearCache() {
        this.tokenDataCache.clear();
        this.valueCalculationCache.clear();
    }
}

// Enhanced retry function with exponential backoff
async function withRetry<T>(
    operation: () => Promise<T>,
    retries = 3,
    initialDelay = 1000,
    exponentialBackoff = true
): Promise<T> {
    for (let i = 0; i < retries; i++) {
        try {
            return await operation();
        } catch (error) {
            if (i === retries - 1) throw error;
            const delay = exponentialBackoff ? initialDelay * Math.pow(2, i) : initialDelay;
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    throw new Error("Max retries reached");
}

// Concurrent processing utility
async function processBatchWithConcurrency<T>(
    items: T[],
    processor: (item: T) => Promise<any>,
    concurrency = 3
): Promise<any[]> {
    const results = [];
    for (let i = 0; i < items.length; i += concurrency) {
        const batch = items.slice(i, i + concurrency);
        const batchResults = await Promise.all(
            batch.map(item => processor(item))
        );
        results.push(...batchResults);
    }
    return results;
}

async function main() {
    try {
        const [signer] = await ethers.getSigners();
        const provider = signer.provider!;
        const contractManager = new ContractManager(provider);
        
        // Create TokenPriceManager contract instance
        const tokenManager = (await ethers.getContractAt(
            TOKEN_MANAGER_ABI,
            TOKEN_MANAGER_ADDRESS
        )) as TokenPriceManager;

        // Get LP Token total supply
        const lpTokenContract = await contractManager.getTokenContract(ACCOUNT_ADDRESS);
        const lpTotalSupply = await withRetry(() => lpTokenContract.totalSupply());
        const lpDecimals = await withRetry(() => lpTokenContract.decimals());
        const lpTotalSupplyBigInt = lpTotalSupply;
        
        console.log(`LP Token Total Supply: ${ethers.formatUnits(lpTotalSupplyBigInt, lpDecimals)} (${lpTotalSupplyBigInt})`);

        // Get ETH balance
        const ethBalance = await withRetry(() => provider.getBalance(ACCOUNT_ADDRESS));
        let totalValueInEth = BigInt(ethBalance.toString());
        console.log(
            `ETH Balance: ${ethers.formatEther(ethBalance)} ETH (${ethBalance})`
        );

        // Initialize token info map
        const tokenInfoMap = new Map<TokenCode, TokenInfo>();

        // Process tokens with concurrency control
        const tokenCodes = Object.keys(TOKEN_ADDRESSES_MAP) as TokenCode[];
        await processBatchWithConcurrency(tokenCodes, async (code) => {
            const address = TOKEN_ADDRESSES_MAP[code];
            const tokenContract = await contractManager.getTokenContract(address);

            try {
                // Check cache first
                const cached = await contractManager.getCachedTokenInfo(code);
                if (cached) {
                    tokenInfoMap.set(code, cached);
                    const valueInEth = contractManager.calculateTokenValue(
                        cached.balance,
                        cached.price!,
                        cached.decimals
                    );
                    totalValueInEth += valueInEth;
                    return;
                }

                // Fetch all token data in parallel
                const [balance, decimals, name, symbol, price] = await Promise.all([
                    withRetry(() => tokenContract.balanceOf(ACCOUNT_ADDRESS)),
                    withRetry(() => tokenContract.decimals()),
                    withRetry(() => tokenContract.name().catch(() => "Unknown Name")),
                    withRetry(() => tokenContract.symbol().catch(() => "Unknown Symbol")),
                    withRetry(() => tokenManager.getTokenPrice(code)),
                ]);

                const tokenInfo: TokenInfo = {
                    address,
                    decimals,
                    balance,
                    price,
                    name,
                    symbol,
                };

                // Cache the token info
                contractManager.setCachedTokenInfo(code, tokenInfo);
                tokenInfoMap.set(code, tokenInfo);

                const valueInEth = contractManager.calculateTokenValue(
                    balance,
                    price,
                    decimals
                );
                totalValueInEth += valueInEth;

                // Log token details
                console.log(`\n${code} (${name}):`);
                console.log(`Address: ${address}`);
                console.log(`Symbol: ${symbol}`);
                console.log(
                    `Balance: ${ethers.formatUnits(balance, decimals)} (${balance})`
                );
                console.log(
                    `Price: ${ethers.formatUnits(price, 18)} ETH (${price})`
                );
                console.log(
                    `Value in ETH: ${ethers.formatUnits(valueInEth, 18)} ETH (${valueInEth})`
                );

            } catch (error) {
                console.error(`Failed to process ${code}:`, error);
            }
        }, 3);

        // Calculate and display total values
        console.log("\nTotal Portfolio Value:");
        console.log(
            `Total Value in ETH: ${ethers.formatUnits(
                totalValueInEth,
                18
            )} ETH (${totalValueInEth})`
        );

        // Calculate LP Token price in ETH
        const lpTokenPrice = (totalValueInEth * BigInt(1e18)) / lpTotalSupplyBigInt;
        console.log(
            `\nLP Token Information:`
        );
        console.log(
            `Price per LP Token: ${ethers.formatUnits(lpTokenPrice, 18)} ETH (${lpTokenPrice})`
        );

        // Calculate portfolio percentages
        for (const [code, tokenInfo] of tokenInfoMap.entries()) {
            if (tokenInfo.price && tokenInfo.balance) {
                const tokenValue = contractManager.calculateTokenValue(
                    tokenInfo.balance,
                    tokenInfo.price,
                    tokenInfo.decimals
                );
                const percentage = Number(
                    (BigInt(10000) * tokenValue) / totalValueInEth
                ) / 100;
                console.log(
                    `${code} Percentage of Portfolio: ${percentage.toFixed(2)}%`
                );
            }
        }

        // Clear caches after execution
        contractManager.clearCache();

    } catch (error) {
        console.error("Script execution failed:", error);
        process.exit(1);
    }
}

// Execute main function
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
