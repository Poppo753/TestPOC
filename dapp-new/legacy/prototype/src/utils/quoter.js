// ============================================
// Uniswap V3 Quoter Integration
// Real-time price quotes from Uniswap pools
// ============================================

import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.13.2/dist/ethers.min.js";

const QUOTER_V2_ADDRESS = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

const QUOTER_V2_ABI = [
  {
    "inputs": [
      {
        "components": [
          { "internalType": "address", "name": "tokenIn", "type": "address" },
          { "internalType": "address", "name": "tokenOut", "type": "address" },
          { "internalType": "uint256", "name": "amountIn", "type": "uint256" },
          { "internalType": "uint24", "name": "fee", "type": "uint24" },
          { "internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160" }
        ],
        "internalType": "struct IQuoterV2.QuoteExactInputSingleParams",
        "name": "params",
        "type": "tuple"
      }
    ],
    "name": "quoteExactInputSingle",
    "outputs": [
      { "internalType": "uint256", "name": "amountOut", "type": "uint256" },
      { "internalType": "uint160", "name": "sqrtPriceX96After", "type": "uint160" },
      { "internalType": "uint32", "name": "initializedTicksCrossed", "type": "uint32" },
      { "internalType": "uint256", "name": "gasEstimate", "type": "uint256" }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

/**
 * Get price quote from Uniswap V3
 * @param {object} provider Ethers provider
 * @param {string} tokenIn Input token address
 * @param {string} tokenOut Output token address
 * @param {string} amountIn Amount in (as BigInt string)
 * @param {number} fee Pool fee tier (500, 3000, 10000)
 * @returns {Promise<bigint>} Output amount
 */
export async function getQuote(provider, tokenIn, tokenOut, amountIn, fee = 3000) {
  try {
    const quoter = new ethers.Contract(QUOTER_V2_ADDRESS, QUOTER_V2_ABI, provider);
    
    const result = await quoter.quoteExactInputSingle.staticCall({
      tokenIn,
      tokenOut,
      amountIn,
      fee,
      sqrtPriceLimitX96: 0
    });
    
    return result.amountOut;
  } catch (error) {
    console.warn(`⚠️ Quote failed for ${tokenIn} → ${tokenOut}:`, error.message);
    return 0n;
  }
}

/**
 * Get best quote across all fee tiers
 * @param {object} provider Ethers provider
 * @param {string} tokenIn Input token address
 * @param {string} tokenOut Output token address  
 * @param {string} amountIn Amount in (as BigInt string)
 * @returns {Promise<bigint>} Best output amount
 */
export async function getBestQuote(provider, tokenIn, tokenOut, amountIn) {
  const fees = [500, 3000, 10000];
  
  const quotes = await Promise.all(
    fees.map(fee => getQuote(provider, tokenIn, tokenOut, amountIn, fee))
  );
  
  // Return maximum quote
  return quotes.reduce((max, quote) => quote > max ? quote : max, 0n);
}

/**
 * Get USD price for a token using USDC as base
 * @param {object} provider Ethers provider
 * @param {string} tokenAddress Token address to price
 * @param {number} tokenDecimals Token decimals
 * @returns {Promise<number>} Price in USD
 */
export async function getTokenPriceUSD(provider, tokenAddress, tokenDecimals) {
  try {
    // If it's a stablecoin, return 1.0
    const STABLECOINS = [
      '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC
      '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', // USDC.e
      '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // USDT
      '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', // DAI
    ];
    
    if (STABLECOINS.includes(tokenAddress.toLowerCase())) {
      return 1.0;
    }
    
    // Get quote: 1 token → USDC
    const oneToken = ethers.parseUnits("1", tokenDecimals);
    const quoteUSDC = await getBestQuote(provider, tokenAddress, USDC_ADDRESS, oneToken);
    
    if (quoteUSDC === 0n) {
      console.warn(`⚠️ No liquidity for ${tokenAddress} → USDC`);
      return 0;
    }
    
    // USDC has 6 decimals
    const priceUSD = parseFloat(ethers.formatUnits(quoteUSDC, 6));
    
    console.log(`💰 Price for token ${tokenAddress}: $${priceUSD.toFixed(4)}`);
    
    return priceUSD;
    
  } catch (error) {
    console.error(`❌ Error getting price for ${tokenAddress}:`, error);
    return 0;
  }
}

/**
 * Get ETH price in USD
 * @param {object} provider Ethers provider
 * @returns {Promise<number>} ETH price in USD
 */
export async function getETHPriceUSD(provider) {
  const WETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  return getTokenPriceUSD(provider, WETH_ADDRESS, 18);
}

/**
 * Get WBTC price in USD
 * @param {object} provider Ethers provider
 * @returns {Promise<number>} WBTC price in USD
 */
export async function getWBTCPriceUSD(provider) {
  const WBTC_ADDRESS = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
  return getTokenPriceUSD(provider, WBTC_ADDRESS, 8);
}

/**
 * Calculate total pool value in USD
 * @param {object} provider Ethers provider
 * @param {string} proxyGeneralAddress ProxyGeneral contract address
 * @param {Array} knownTokens Array of token objects with {address, symbol, decimals}
 * @returns {Promise<number>} Total pool value in USD
 */
export async function getTotalPoolValueUSD(provider, proxyGeneralAddress, knownTokens) {
  let totalValueUSD = 0;
  
  try {
    // Get native ETH balance
    const ethBalance = await provider.getBalance(proxyGeneralAddress);
    if (ethBalance > 0n) {
      const ethPriceUSD = await getETHPriceUSD(provider);
      const ethValue = parseFloat(ethers.formatEther(ethBalance)) * ethPriceUSD;
      totalValueUSD += ethValue;
      console.log(`💰 ETH: ${ethers.formatEther(ethBalance)} @ $${ethPriceUSD.toFixed(2)} = $${ethValue.toFixed(2)}`);
    }
    
    // Get ERC20 token balances
    for (const token of knownTokens) {
      try {
        const tokenContract = new ethers.Contract(
          token.address,
          ['function balanceOf(address) view returns (uint256)'],
          provider
        );
        
        const balance = await tokenContract.balanceOf(proxyGeneralAddress);
        
        if (balance > 0n) {
          const tokenPriceUSD = await getTokenPriceUSD(provider, token.address, token.decimals);
          const formattedBalance = parseFloat(ethers.formatUnits(balance, token.decimals));
          const tokenValue = formattedBalance * tokenPriceUSD;
          totalValueUSD += tokenValue;
          
          console.log(`💰 ${token.symbol}: ${formattedBalance.toFixed(6)} @ $${tokenPriceUSD.toFixed(4)} = $${tokenValue.toFixed(2)}`);
        }
      } catch (error) {
        console.warn(`⚠️ Could not fetch ${token.symbol} balance:`, error.message);
      }
    }
    
    console.log(`✅ Total Pool Value: $${totalValueUSD.toFixed(2)}`);
    return totalValueUSD;
    
  } catch (error) {
    console.error('❌ Error calculating total pool value:', error);
    return 0;
  }
}
