// ============================================
// UI CONSTANTS
// ============================================

export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  '2XL': 1536,
};

export const REFRESH_INTERVAL = 30000; // 30 seconds

export const WITHDRAW_PRESETS = [25, 50, 75, 100];

// ============================================
// MESSAGES
// ============================================

export const MESSAGES = {
  ERRORS: {
    NO_METAMASK: "MetaMask not found! Please install MetaMask extension.",
    CONNECTION_FAILED: "Connection failed. Please try again.",
    WRONG_NETWORK: "Please switch to Arbitrum One network.",
    INVALID_AMOUNT: "Please enter a valid amount.",
    INSUFFICIENT_BALANCE: "Insufficient balance.",
    TRANSACTION_FAILED: "Transaction failed. Please try again.",
  },
  
  SUCCESS: {
    DEPOSIT: "Deposit successful!",
    WITHDRAW: "Withdrawal successful!",
    CONNECTED: "Wallet connected successfully!",
  },
  
  INFO: {
    CONNECTING: "Connecting to wallet...",
    CONFIRMING: "Please confirm transaction in MetaMask...",
    PROCESSING: "Transaction processing...",
  },
};

// ============================================
// FORMATTING
// ============================================

export const FORMAT = {
  DECIMALS: {
    ETH: 6,
    USD: 2,
    PERCENT: 2,
  },
};
