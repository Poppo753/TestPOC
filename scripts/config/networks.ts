/**
 * 🌐 NETWORK CONFIGURATIONS
 * Configurazioni per diverse reti blockchain (localhost, testnet, mainnet)
 */

export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  gasLimit: number;
  gasPrice?: string; // In Gwei
  confirmations: number;
  blockExplorer?: string;
  nativeToken: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

// 🏠 Localhost Development Network
export const LOCALHOST_CONFIG: NetworkConfig = {
  name: "localhost",
  chainId: 31337,
  rpcUrl: "http://127.0.0.1:8545",
  gasLimit: 500000,
  confirmations: 1,
  nativeToken: {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18
  }
};

// 🧪 Arbitrum Sepolia Testnet
export const ARBITRUM_SEPOLIA_CONFIG: NetworkConfig = {
  name: "arbitrum-sepolia",
  chainId: 421614,
  rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
  gasLimit: 800000,
  gasPrice: "0.1", // 0.1 Gwei
  confirmations: 1,
  blockExplorer: "https://sepolia.arbiscan.io",
  nativeToken: {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18
  }
};

// 🌟 Arbitrum One Mainnet
export const ARBITRUM_MAINNET_CONFIG: NetworkConfig = {
  name: "arbitrum-one",
  chainId: 42161,
  rpcUrl: process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_MAINNET_RPC_URL || "https://arb1.arbitrum.io/rpc",
  gasLimit: 1000000,
  gasPrice: "0.1", // 0.1 Gwei
  confirmations: 2,
  blockExplorer: "https://arbiscan.io",
  nativeToken: {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18
  }
};

// 📦 Tutte le configurazioni disponibili
export const NETWORK_CONFIGS = {
  localhost: LOCALHOST_CONFIG,
  "arbitrum-sepolia": ARBITRUM_SEPOLIA_CONFIG,
  "arbitrum-one": ARBITRUM_MAINNET_CONFIG,
  "arbitrum": ARBITRUM_MAINNET_CONFIG, // Alias per arbitrum-one
} as const;

// 🎯 Tipo per i nomi delle reti
export type NetworkName = keyof typeof NETWORK_CONFIGS;

/**
 * 🔧 Ottieni configurazione per la rete corrente
 */
export function getCurrentNetworkConfig(): NetworkConfig {
  const networkName = (process.env.HARDHAT_NETWORK || "localhost") as NetworkName;
  
  if (!(networkName in NETWORK_CONFIGS)) {
    console.warn(`⚠️ Unknown network: ${networkName}, falling back to localhost`);
    return LOCALHOST_CONFIG;
  }
  
  return NETWORK_CONFIGS[networkName];
}

/**
 * 🔍 Verifica se siamo su una rete di test
 */
export function isTestNetwork(networkName?: string): boolean {
  const network = networkName || process.env.HARDHAT_NETWORK || "localhost";
  return network === "localhost" || network.includes("sepolia") || network.includes("testnet");
}

/**
 * 🔍 Verifica se siamo su mainnet
 */
export function isMainnet(networkName?: string): boolean {
  const network = networkName || process.env.HARDHAT_NETWORK || "localhost";
  return network === "arbitrum-one" || network === "mainnet";
}

/**
 * 💰 Ottieni configurazione gas ottimale per la rete
 */
export function getOptimalGasConfig(networkName?: string) {
  const config = networkName ? NETWORK_CONFIGS[networkName as NetworkName] : getCurrentNetworkConfig();
  
  return {
    gasLimit: config.gasLimit,
    gasPrice: config.gasPrice ? `${config.gasPrice} gwei` : undefined,
    maxFeePerGas: isMainnet(networkName) ? "2 gwei" : "1 gwei",
    maxPriorityFeePerGas: isMainnet(networkName) ? "1 gwei" : "0.5 gwei"
  };
}

/**
 * 🔗 Ottieni URL block explorer per transazione
 */
export function getTransactionUrl(txHash: string, networkName?: string): string | null {
  const config = networkName ? NETWORK_CONFIGS[networkName as NetworkName] : getCurrentNetworkConfig();
  
  if (!config.blockExplorer) {
    return null;
  }
  
  return `${config.blockExplorer}/tx/${txHash}`;
}

/**
 * 🔗 Ottieni URL block explorer per indirizzo
 */
export function getAddressUrl(address: string, networkName?: string): string | null {
  const config = networkName ? NETWORK_CONFIGS[networkName as NetworkName] : getCurrentNetworkConfig();
  
  if (!config.blockExplorer) {
    return null;
  }
  
  return `${config.blockExplorer}/address/${address}`;
}