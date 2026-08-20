/**
 * @title Chainlink Price Feeds Configuration - Arbitrum Mainnet
 * @notice Real Chainlink oracle addresses on Arbitrum mainnet
 * @dev These are the official Chainlink price feed contracts deployed on Arbitrum
 * 
 * Sources:
 * - https://docs.chain.link/data-feeds/price-feeds/addresses?network=arbitrum
 * - Verified on Arbiscan: https://arbiscan.io/
 * 
 * Last Updated: November 15, 2025
 */

export interface ChainlinkFeedConfig {
  token: string;           // Token code (e.g., "USDC", "WBTC")
  feedAddress: string;     // Chainlink aggregator address
  decimals: number;        // Price feed decimals (usually 8 for USD pairs)
  heartbeat: number;       // Max seconds between updates (staleness threshold)
  description: string;     // Human-readable description
}

/**
 * @notice Official Chainlink Price Feeds on Arbitrum Mainnet
 * @dev All feeds are USD-denominated with 8 decimals
 */
export const ARBITRUM_MAINNET_FEEDS: ChainlinkFeedConfig[] = [
  {
    token: "ETH",
    feedAddress: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612", // ETH/USD
    decimals: 8,
    heartbeat: 86400, // 24 hours
    description: "ETH / USD Price Feed"
  },
  {
    token: "WETH",
    feedAddress: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612", // Same as ETH/USD
    decimals: 8,
    heartbeat: 86400,
    description: "WETH / USD Price Feed"
  },
  {
    token: "USDC",
    feedAddress: "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3", // USDC/USD
    decimals: 8,
    heartbeat: 86400, // 24 hours
    description: "USDC / USD Price Feed"
  },
  {
    token: "USDT",
    feedAddress: "0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7", // USDT/USD
    decimals: 8,
    heartbeat: 86400,
    description: "USDT / USD Price Feed"
  },
  {
    token: "WBTC",
    feedAddress: "0xd0C7101eACbB49F3deCcCc166d238410D6D46d57", // WBTC/USD
    decimals: 8,
    heartbeat: 86400,
    description: "WBTC / USD Price Feed"
  },
  {
    token: "DAI",
    feedAddress: "0xc5C8E77B397E531B8EC06BFb0048328B30E9eCfB", // DAI/USD
    decimals: 8,
    heartbeat: 86400,
    description: "DAI / USD Price Feed"
  },
  {
    token: "LINK",
    feedAddress: "0x86E53CF1B870786351Da77A57575e79CB55812CB", // LINK/USD
    decimals: 8,
    heartbeat: 86400,
    description: "LINK / USD Price Feed"
  },
  {
    token: "ARB",
    feedAddress: "0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6", // ARB/USD
    decimals: 8,
    heartbeat: 86400,
    description: "ARB / USD Price Feed"
  },
  {
    token: "UNI",
    feedAddress: "0x9C917083fDb403ab5ADbEC26Ee294f6EcAda2720", // UNI/USD
    decimals: 8,
    heartbeat: 86400,
    description: "UNI / USD Price Feed"
  }
];

/**
 * @notice Testnet (Sepolia) Price Feeds for testing
 * @dev These may be mock feeds or testnet-specific deployments
 */
export const ARBITRUM_SEPOLIA_FEEDS: ChainlinkFeedConfig[] = [
  {
    token: "ETH",
    feedAddress: "0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165", // ETH/USD Sepolia
    decimals: 8,
    heartbeat: 3600,
    description: "ETH / USD Price Feed (Sepolia)"
  },
  {
    token: "USDC",
    feedAddress: "0x0153002d20B96532C639313c2d54c3dA09109309", // Mock or testnet feed
    decimals: 8,
    heartbeat: 3600,
    description: "USDC / USD Price Feed (Sepolia)"
  },
  {
    token: "WBTC",
    feedAddress: "0x56a43EB56Da12C0dc1D972ACb089c06a5dEF8e69", // Mock or testnet feed
    decimals: 8,
    heartbeat: 3600,
    description: "WBTC / USD Price Feed (Sepolia)"
  }
];

/**
 * @notice Token addresses on Arbitrum Mainnet
 * @dev These are the actual ERC20 token contract addresses
 */
export const ARBITRUM_TOKEN_ADDRESSES: Record<string, string> = {
  WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC native (new)
  USDC_E: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", // USDC.e (bridged)
  USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
  DAI: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
  LINK: "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4",
  ARB: "0x912CE59144191C1204E64559FE8253a0e49E6548",
  UNI: "0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0"
};

/**
 * @notice Get feed configuration for a specific token
 * @param tokenCode Token identifier
 * @param network "mainnet" | "sepolia"
 * @return Feed configuration or undefined
 */
export function getFeedConfig(tokenCode: string, network: "mainnet" | "sepolia"): ChainlinkFeedConfig | undefined {
  const feeds = network === "mainnet" ? ARBITRUM_MAINNET_FEEDS : ARBITRUM_SEPOLIA_FEEDS;
  return feeds.find(feed => feed.token === tokenCode);
}

/**
 * @notice Get all feed configurations for a network
 * @param network "mainnet" | "sepolia"
 * @return Array of feed configurations
 */
export function getAllFeeds(network: "mainnet" | "sepolia"): ChainlinkFeedConfig[] {
  return network === "mainnet" ? ARBITRUM_MAINNET_FEEDS : ARBITRUM_SEPOLIA_FEEDS;
}

/**
 * @notice Validate feed configuration before deployment
 * @param config Feed configuration to validate
 * @return True if valid, throws error otherwise
 */
export function validateFeedConfig(config: ChainlinkFeedConfig): boolean {
  if (!config.token || config.token.length === 0) {
    throw new Error("Token code cannot be empty");
  }
  
  if (!config.feedAddress || config.feedAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error(`Invalid feed address for ${config.token}`);
  }
  
  if (config.decimals < 1 || config.decimals > 18) {
    throw new Error(`Invalid decimals for ${config.token}: ${config.decimals}`);
  }
  
  if (config.heartbeat < 60 || config.heartbeat > 86400 * 7) {
    throw new Error(`Invalid heartbeat for ${config.token}: ${config.heartbeat}`);
  }
  
  return true;
}

/**
 * @notice Get token ERC20 address on Arbitrum
 * @param tokenCode Token identifier
 * @return Token contract address or undefined
 */
export function getTokenAddress(tokenCode: string): string | undefined {
  return ARBITRUM_TOKEN_ADDRESSES[tokenCode];
}
