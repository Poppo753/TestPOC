/**
 * 🔧 SYSTEM CONFIGURATION
 * Configurazione centralizzata per tutti gli script di interazione
 */

import { ethers } from "hardhat";
import dotenv from "dotenv";
import { getCurrentNetworkConfig, NetworkConfig as NetConfig } from "./networks";
import { SCRIPT_AMOUNTS, CONSTANTS_UTILS } from "./constants";

// Carica le variabili d'ambiente
dotenv.config();

export interface ContractAddresses {
  beacon: string;
  liquidityManager: string;
  valueCalculator: string;
  tokenManager: string;
  parameterManager: string;
  proxyGeneral: string;
  swapManager: string;
  emergencyHandler: string;
}

export interface NetworkConfig {
  name: string;
  rpcUrl: string;
  gasLimit: number;
  confirmations: number;
}

export interface OperationalConfig {
  defaultDepositAmount: string;
  defaultWithdrawPercentage: number;
  logLevel: string;
  verboseLogging: boolean;
}

/**
 * Indirizzi dei contratti deployati
 * Vengono letti dal file .env
 */
export const CONTRACT_ADDRESSES: ContractAddresses = {
  beacon: process.env.BEACON_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  liquidityManager: process.env.LIQUIDITY_MANAGER_ADDRESS || "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
  valueCalculator: process.env.VALUE_CALCULATOR_ADDRESS || "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  tokenManager: process.env.TOKEN_MANAGER_ADDRESS || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  parameterManager: process.env.PARAMETER_MANAGER_ADDRESS || "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  proxyGeneral: process.env.PROXY_GENERAL_ADDRESS || "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
  swapManager: process.env.SWAP_MANAGER_ADDRESS || "0x0165878A594ca255338adfa4d48449f69242Eb8F",
  emergencyHandler: process.env.EMERGENCY_HANDLER_ADDRESS || "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853"
};

/**
 * Configurazione network (aggiornata per utilizzare il nuovo sistema multi-network)
 */
export const NETWORK_CONFIG = getCurrentNetworkConfig();

/**
 * Parametri operazionali
 */
export const OPERATIONAL_CONFIG: OperationalConfig = {
  defaultDepositAmount: process.env.DEFAULT_DEPOSIT_AMOUNT || "1.0",
  defaultWithdrawPercentage: parseInt(process.env.DEFAULT_WITHDRAW_PERCENTAGE || "50"),
  logLevel: process.env.LOG_LEVEL || "info",
  verboseLogging: process.env.VERBOSE_LOGGING === "true"
};

/**
 * Importi pre-formattati per facilità d'uso
 */
export const AMOUNTS = {
  DEFAULT_DEPOSIT: ethers.parseEther(OPERATIONAL_CONFIG.defaultDepositAmount),
  SMALL_DEPOSIT: ethers.parseEther("0.1"),
  LARGE_DEPOSIT: ethers.parseEther("10.0"),
  TEST_AMOUNT: ethers.parseEther("0.01"),
  MIN_WITHDRAW: ethers.parseEther("0.01") // Minimum withdrawal amount
};

/**
 * Utility per logging centralizzato
 */
export class Logger {
  static info(message: string) {
    if (OPERATIONAL_CONFIG.logLevel === "info" || OPERATIONAL_CONFIG.verboseLogging) {
      console.log(`ℹ️  ${message}`);
    }
  }

  static success(message: string) {
    console.log(`✅ ${message}`);
  }

  static error(message: string) {
    console.error(`❌ ${message}`);
  }

  static warn(message: string) {
    console.warn(`⚠️  ${message}`);
  }

  static debug(message: string) {
    if (OPERATIONAL_CONFIG.logLevel === "debug" || OPERATIONAL_CONFIG.verboseLogging) {
      console.log(`🔍 ${message}`);
    }
  }

  static section(title: string) {
    console.log(`\n🔷 ${title.toUpperCase()}:`);
  }
}

/**
 * Utility per validare la configurazione
 */
export function validateConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Verifica che tutti gli indirizzi siano validi
  Object.entries(CONTRACT_ADDRESSES).forEach(([name, address]) => {
    if (!ethers.isAddress(address)) {
      errors.push(`Invalid address for ${name}: ${address}`);
    }
  });

  // Verifica parametri network
  if (NETWORK_CONFIG.gasLimit < 21000) {
    errors.push(`Gas limit too low: ${NETWORK_CONFIG.gasLimit}`);
  }

  if (NETWORK_CONFIG.confirmations < 1) {
    errors.push(`Confirmations must be at least 1: ${NETWORK_CONFIG.confirmations}`);
  }

  // Verifica parametri operazionali
  if (OPERATIONAL_CONFIG.defaultWithdrawPercentage < 1 || OPERATIONAL_CONFIG.defaultWithdrawPercentage > 100) {
    errors.push(`Invalid withdraw percentage: ${OPERATIONAL_CONFIG.defaultWithdrawPercentage}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Mostra la configurazione corrente
 */
export function showConfig() {
  Logger.section("System Configuration");
  
  console.log("📋 Contract Addresses:");
  Object.entries(CONTRACT_ADDRESSES).forEach(([name, address]) => {
    console.log(`   ${name}: ${address}`);
  });

  console.log("\n🌐 Network Configuration:");
  console.log(`   Network: ${NETWORK_CONFIG.name}`);
  console.log(`   RPC URL: ${NETWORK_CONFIG.rpcUrl}`);
  console.log(`   Gas Limit: ${NETWORK_CONFIG.gasLimit.toLocaleString()}`);
  console.log(`   Confirmations: ${NETWORK_CONFIG.confirmations}`);

  console.log("\n⚙️ Operational Parameters:");
  console.log(`   Default Deposit: ${OPERATIONAL_CONFIG.defaultDepositAmount} ETH`);
  console.log(`   Default Withdraw: ${OPERATIONAL_CONFIG.defaultWithdrawPercentage}%`);
  console.log(`   Log Level: ${OPERATIONAL_CONFIG.logLevel}`);
  console.log(`   Verbose: ${OPERATIONAL_CONFIG.verboseLogging}`);

  // Validazione
  const validation = validateConfig();
  if (validation.isValid) {
    Logger.success("Configuration is valid");
  } else {
    Logger.error("Configuration has errors:");
    validation.errors.forEach(error => console.log(`   - ${error}`));
  }
}

/**
 * Utility per ottenere una istanza di contratto con la configurazione corrente
 */
export async function getContract(contractName: keyof ContractAddresses, contractType: string) {
  const { ethers } = await import("hardhat");
  const address = CONTRACT_ADDRESSES[contractName];
  
  Logger.debug(`Connecting to ${contractType} at ${address}`);
  return await ethers.getContractAt(contractType, address);
}

/**
 * Utility per ottenere tutti i contratti principali
 */
export async function getAllContracts() {
  const { ethers } = await import("hardhat");
  
  Logger.info("Connecting to all contracts...");
  
  const contracts = {
    beacon: await ethers.getContractAt("Beacon", CONTRACT_ADDRESSES.beacon),
    liquidityManager: await ethers.getContractAt("LiquidityManager", CONTRACT_ADDRESSES.liquidityManager),
    valueCalculator: await ethers.getContractAt("ValueCalculator", CONTRACT_ADDRESSES.valueCalculator),
    tokenManager: await ethers.getContractAt("TokenManager", CONTRACT_ADDRESSES.tokenManager),
    parameterManager: await ethers.getContractAt("ParameterManager", CONTRACT_ADDRESSES.parameterManager),
    proxyGeneral: await ethers.getContractAt("ProxyGeneral", CONTRACT_ADDRESSES.proxyGeneral),
    swapManager: await ethers.getContractAt("SwapManager", CONTRACT_ADDRESSES.swapManager),
    emergencyHandler: await ethers.getContractAt("EmergencyHandler", CONTRACT_ADDRESSES.emergencyHandler)
  };

  Logger.success("All contracts connected successfully");
  return contracts;
}
