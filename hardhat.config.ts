import { HardhatUserConfig } from "hardhat/config"; // Importa il tipo corretto
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";
import "@typechain/hardhat";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-gas-reporter";



const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27", // Specifica la versione del compilatore
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true, // Enable IR optimizer to avoid "stack too deep" errors
    },
  },
  networks: {
    arbitrumSepolia: {
      url: process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    arbitrum: {
      url: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    hardhat: {
      forking: {
        url: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
        enabled: process.env.FORK_ENABLED === "true",
        blockNumber: process.env.FORK_BLOCK_NUMBER ? parseInt(process.env.FORK_BLOCK_NUMBER) : undefined,
      },
      chainId: 42161, // Arbitrum mainnet chain ID
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY || "",
    outputFile: "gas-report.txt",
    noColors: true,
  },
  etherscan: {
    apiKey: process.env.ARBITRUM_ETHERSCAN_API_KEY || "",
  },
  typechain: {
    outDir: "typechain-types", // Directory dove vengono generati i tipi
    target: "ethers-v6", // Target compatibile con Ethers.js
  },
  sourcify: {
    enabled: true
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  
};

export default config;
