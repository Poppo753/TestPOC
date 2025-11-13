/**
 * 🎯 BUSINESS CONSTANTS
 * Costanti di business per il sistema DeFi
 */

import { ethers } from "ethers";

// 💰 Costanti per i amounts
export const SCRIPT_AMOUNTS = {
  // Deposit amounts
  MIN_DEPOSIT: ethers.parseEther("0.01"), // 0.01 ETH
  DEFAULT_DEPOSIT: ethers.parseEther("1.0"), // 1 ETH
  MAX_DEPOSIT: ethers.parseEther("100.0"), // 100 ETH
  
  // Withdraw amounts
  MIN_WITHDRAW_PERCENTAGE: 1, // 1%
  DEFAULT_WITHDRAW_PERCENTAGE: 50, // 50%
  MAX_WITHDRAW_PERCENTAGE: 100, // 100%
  
  // Fee amounts
  DEFAULT_DEPOSIT_FEE: 50, // 0.5% (50 basis points)
  DEFAULT_WITHDRAW_FEE: 100, // 1% (100 basis points)
  MAX_FEE: 1000, // 10% (1000 basis points)
  
  // Liquidity thresholds
  MIN_LIQUIDITY_THRESHOLD: ethers.parseEther("10.0"), // 10 ETH
  CRITICAL_LIQUIDITY_THRESHOLD: ethers.parseEther("1.0"), // 1 ETH
} as const;

// ⏰ Costanti temporali
export const TIME_CONSTANTS = {
  // Block times (in seconds)
  AVERAGE_BLOCK_TIME: 12, // Ethereum average
  ARBITRUM_BLOCK_TIME: 0.25, // Arbitrum fast blocks
  
  // Timeouts
  TRANSACTION_TIMEOUT: 300, // 5 minutes
  SCRIPT_TIMEOUT: 1800, // 30 minutes
  
  // Delays
  RETRY_DELAY: 5000, // 5 seconds
  BATCH_DELAY: 1000, // 1 second between batch operations
  
  // Periods
  HEARTBEAT_PERIOD: 86400, // 24 hours for oracle heartbeat
  REBALANCE_PERIOD: 3600, // 1 hour for rebalancing
} as const;

// 🎯 Costanti per parametri del protocollo
export const PROTOCOL_PARAMS = {
  // Basis points (1 bp = 0.01%)
  BASIS_POINTS_SCALE: 10000,
  
  // Slippage protection
  DEFAULT_SLIPPAGE: 300, // 3% (300 basis points)
  MAX_SLIPPAGE: 1000, // 10% (1000 basis points)
  
  // Price deviation limits
  MAX_PRICE_DEVIATION: 500, // 5% (500 basis points)
  CRITICAL_PRICE_DEVIATION: 1000, // 10% (1000 basis points)
  
  // Governance
  MIN_VOTING_PERIOD: 86400, // 24 hours
  MIN_EXECUTION_DELAY: 172800, // 48 hours
  
  // Emergency
  EMERGENCY_PAUSE_DURATION: 86400, // 24 hours
  MAX_EMERGENCY_PAUSE: 604800, // 7 days
} as const;

// 🔧 Costanti tecniche
export const TECHNICAL_CONSTANTS = {
  // Precision
  PRECISION_DECIMALS: 18,
  PERCENTAGE_PRECISION: 10000, // 100.00%
  
  // Limits
  MAX_TOKENS_PER_OPERATION: 10,
  MAX_BATCH_SIZE: 50,
  
  // Addresses speciali
  ZERO_ADDRESS: "0x0000000000000000000000000000000000000000",
  DEAD_ADDRESS: "0x000000000000000000000000000000000000dEaD",
  
  // Gas limits per operazioni specifiche
  GAS_LIMITS: {
    DEPOSIT: 200000,
    WITHDRAW: 250000,
    SWAP: 300000,
    GOVERNANCE: 150000,
    EMERGENCY: 100000,
  },
} as const;

// 📊 Costanti per monitoring e analytics
export const MONITORING_CONSTANTS = {
  // Alert thresholds
  LOW_LIQUIDITY_THRESHOLD: ethers.parseEther("5.0"), // 5 ETH
  HIGH_VOLUME_THRESHOLD: ethers.parseEther("50.0"), // 50 ETH per hour
  
  // Performance metrics
  TARGET_APY: 500, // 5% (500 basis points)
  MIN_ACCEPTABLE_APY: 200, // 2% (200 basis points)
  
  // System health
  MAX_FAILED_TRANSACTIONS_PER_HOUR: 5,
  MAX_RESPONSE_TIME_MS: 30000, // 30 seconds
  
  // Reporting periods
  DAILY_REPORT_INTERVAL: 86400, // 24 hours
  WEEKLY_REPORT_INTERVAL: 604800, // 7 days
  MONTHLY_REPORT_INTERVAL: 2592000, // 30 days
} as const;

// 🚨 Costanti per emergency responses
export const EMERGENCY_CONSTANTS = {
  // Response levels
  RESPONSE_LEVELS: {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4,
  },
  
  // Auto-response thresholds
  AUTO_PAUSE_LOSS_THRESHOLD: ethers.parseEther("10.0"), // 10 ETH loss
  AUTO_PAUSE_DEVIATION_THRESHOLD: 2000, // 20% price deviation
  
  // Recovery parameters
  RECOVERY_BATCH_SIZE: 10,
  RECOVERY_DELAY_BETWEEN_BATCHES: 5000, // 5 seconds
  
  // Communication
  ALERT_COOLDOWN: 300000, // 5 minutes between same alerts
} as const;

// 🎨 Costanti per formatting e display
export const DISPLAY_CONSTANTS = {
  // Decimal places
  ETH_DISPLAY_DECIMALS: 4,
  PERCENTAGE_DISPLAY_DECIMALS: 2,
  PRICE_DISPLAY_DECIMALS: 6,
  
  // Colors for console output (if using colored output)
  COLORS: {
    SUCCESS: '\x1b[32m', // Green
    ERROR: '\x1b[31m',   // Red
    WARNING: '\x1b[33m', // Yellow
    INFO: '\x1b[36m',    // Cyan
    RESET: '\x1b[0m',    // Reset
  },
  
  // Symbols
  SYMBOLS: {
    SUCCESS: '✅',
    ERROR: '❌',
    WARNING: '⚠️',
    INFO: 'ℹ️',
    LOADING: '⏳',
    ROCKET: '🚀',
  },
} as const;

// 🔧 Utility functions per lavorare con le costanti
export const CONSTANTS_UTILS = {
  /**
   * Converte basis points in percentuale
   */
  basisPointsToPercentage: (bp: number): number => {
    return bp / PROTOCOL_PARAMS.BASIS_POINTS_SCALE * 100;
  },
  
  /**
   * Converte percentuale in basis points
   */
  percentageToBasisPoints: (percentage: number): number => {
    return Math.round(percentage * PROTOCOL_PARAMS.BASIS_POINTS_SCALE / 100);
  },
  
  /**
   * Verifica se un amount è valido per deposit
   */
  isValidDepositAmount: (amount: bigint): boolean => {
    return amount >= SCRIPT_AMOUNTS.MIN_DEPOSIT && amount <= SCRIPT_AMOUNTS.MAX_DEPOSIT;
  },
  
  /**
   * Verifica se una percentuale di withdraw è valida
   */
  isValidWithdrawPercentage: (percentage: number): boolean => {
    return percentage >= SCRIPT_AMOUNTS.MIN_WITHDRAW_PERCENTAGE && 
           percentage <= SCRIPT_AMOUNTS.MAX_WITHDRAW_PERCENTAGE;
  },
  
  /**
   * Calcola il gas limit ottimale per un'operazione
   */
  getOptimalGasLimit: (operationType: keyof typeof TECHNICAL_CONSTANTS.GAS_LIMITS): number => {
    const baseLimit = TECHNICAL_CONSTANTS.GAS_LIMITS[operationType];
    return Math.round(baseLimit * 1.2); // 20% buffer
  },
  
  /**
   * Formatta un amount ETH per display
   */
  formatETH: (amount: bigint): string => {
    const formatted = ethers.formatEther(amount);
    const num = parseFloat(formatted);
    return num.toFixed(DISPLAY_CONSTANTS.ETH_DISPLAY_DECIMALS);
  },
  
  /**
   * Formatta una percentuale per display
   */
  formatPercentage: (basisPoints: number): string => {
    const percentage = CONSTANTS_UTILS.basisPointsToPercentage(basisPoints);
    return percentage.toFixed(DISPLAY_CONSTANTS.PERCENTAGE_DISPLAY_DECIMALS) + '%';
  }
};