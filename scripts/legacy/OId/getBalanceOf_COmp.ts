import * as dotenv from "dotenv";
import { ethers } from "ethers";

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
  totalSupply?: bigint;  // Added totalSupply
}

interface TokenPriceManager {
  getTokenPrice(token: TokenCode): Promise<bigint>;
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

// Utility Classes and Functions
class ContractManager {
  private contractInstances = new Map<string, ethers.Contract>();
  private decimalsCache = new Map<string, bigint>();
  private readonly TEN = BigInt(10);

  constructor(private provider: ethers.JsonRpcProvider) {}

  getTokenContract(address: string): ethers.Contract {
    if (!this.contractInstances.has(address)) {
      this.contractInstances.set(
        address,
        new ethers.Contract(address, TOKEN_ABI, this.provider)
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
}

async function withRetry<T>(
  operation: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Max retries reached");
}

async function main() {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
    const contractManager = new ContractManager(provider);
    
    // Create TokenPriceManager contract instance
    const tokenManager = new ethers.Contract(
      TOKEN_MANAGER_ADDRESS,
      TOKEN_MANAGER_ABI,
      provider
    ) as unknown as TokenPriceManager;

    // Get LP Token total supply
    const lpTokenContract = contractManager.getTokenContract(ACCOUNT_ADDRESS);
    const lpTotalSupply = await withRetry(() => lpTokenContract.totalSupply());
    const lpDecimals = await withRetry(() => lpTokenContract.decimals());
    const lpTotalSupplyBigInt = BigInt(lpTotalSupply.toString());
    
    console.log(`LP Token Total Supply: ${ethers.formatUnits(lpTotalSupplyBigInt, lpDecimals)} (${lpTotalSupplyBigInt})`);

    // Get ETH balance
    const ethBalance = await withRetry(() => provider.getBalance(ACCOUNT_ADDRESS));
    let totalValueInEth = BigInt(ethBalance.toString());
    console.log(
      `ETH Balance: ${ethers.formatEther(ethBalance)} ETH (${ethBalance})`
    );

    // Initialize token info map
    const tokenInfoMap = new Map<TokenCode, TokenInfo>();

    // Batch fetch token data
    const tokenPromises = Object.entries(TOKEN_ADDRESSES_MAP).map(
      async ([code, address]) => {
        const tokenContract = contractManager.getTokenContract(address);
        try {
          // Fetch all token data in parallel
          const [balance, decimals, name, symbol, price] = await Promise.all([
            withRetry(() => tokenContract.balanceOf(ACCOUNT_ADDRESS)),
            withRetry(() => tokenContract.decimals()),
            withRetry(() => tokenContract.name().catch(() => "Unknown Name")),
            withRetry(() => tokenContract.symbol().catch(() => "Unknown Symbol")),
            withRetry(() => tokenManager.getTokenPrice(code as TokenCode)),
          ]);

          const balanceBigInt = BigInt(balance.toString());
          const priceBigInt = BigInt(price.toString());
          const decimalsBigInt = contractManager.getDecimalsBigInt(decimals);

          const valueInEth = (balanceBigInt * priceBigInt) / decimalsBigInt;
          totalValueInEth += valueInEth;

          const tokenInfo: TokenInfo = {
            address,
            decimals,
            balance: balanceBigInt,
            price: priceBigInt,
            name,
            symbol,
          };

          tokenInfoMap.set(code as TokenCode, tokenInfo);

          // Log token details
          console.log(`\n${code} (${name}):`);
          console.log(`Address: ${address}`);
          console.log(`Symbol: ${symbol}`);
          console.log(
            `Balance: ${ethers.formatUnits(balanceBigInt, decimals)} (${balanceBigInt})`
          );
          console.log(
            `Price: ${ethers.formatUnits(priceBigInt, 18)} ETH (${priceBigInt})`
          );
          console.log(
            `Value in ETH: ${ethers.formatUnits(valueInEth, 18)} ETH (${valueInEth})`
          );

          return valueInEth;
        } catch (error) {
          console.error(`Failed to process ${code}:`, error);
          return BigInt(0);
        }
      }
    );

    // Wait for all token processing to complete
    await Promise.all(tokenPromises);

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
        const tokenValue =
          (tokenInfo.balance * tokenInfo.price) /
          contractManager.getDecimalsBigInt(tokenInfo.decimals);
        const percentage = Number(
          (BigInt(10000) * tokenValue) / totalValueInEth
        ) / 100;
        console.log(
          `${code} Percentage of Portfolio: ${percentage.toFixed(2)}%`
        );
      }
    }
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
