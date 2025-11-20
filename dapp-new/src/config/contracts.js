// ============================================
// CONTRACT CONFIGURATION - Arbitrum Mainnet
// ============================================

export const CONFIG = {
  // Network
  ARBITRUM_CHAIN_ID: "0xa4b1", // 42161
  ARBITRUM_CHAIN_ID_DEC: 42161,
  ARBITRUM_RPC: "https://arb1.arbitrum.io/rpc",
  BLOCK_EXPLORER: "https://arbiscan.io",
  
  // Contract Addresses
  CONTRACTS: {
    BEACON: "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870",
    LIQUIDITY_MANAGER: "0x545b79254F74Ba33958290BB73F2a338509c975d",
    PROXY_GENERAL: "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1",
    VALUE_CALCULATOR: "0xE06882B8a0Bb46dE28a4aa4694d41822C255457B",
  },
  
  // Protocol Settings
  PROTOCOL: {
    NAME: "Jethos Protocol",
    SYMBOL: "JHETH",
    DEPOSIT_FEE: 0.001, // 0.1%
    WITHDRAW_FEE: 0.001, // 0.1%
    MIN_DEPOSIT: "0.000001", // ETH
  },
};

// ============================================
// CONTRACT ABIs (Simplified)
// ============================================

export const ABIS = {
  LIQUIDITY_MANAGER: [
    "function deposit() external payable returns (uint256)",
    "function withdraw(uint256 shares) external returns (uint256)",
    "function depositsEnabled() external view returns (bool)",
    "function withdrawsEnabled() external view returns (bool)",
    "event Deposit(address indexed user, uint256 ethAmount, uint256 sharesReceived, uint256 totalPoolETH, uint256 totalSupply)",
    "event Withdrawn(address indexed user, uint256 shares, uint256 ethAmount, uint256 totalPoolValue, uint256 remainingPoolBalance)",
  ],
  
  PROXY_GENERAL: [
    "function balanceOf(address account) external view returns (uint256)",
    "function totalSupply() external view returns (uint256)",
    "function name() external view returns (string)",
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)",
  ],
  
  VALUE_CALCULATOR: [
    "function getTotalPoolValueView() external view returns (uint256)",
    "function calculateValue(address token, uint256 amount) external view returns (uint256)",
  ],
};

// ============================================
// GAS LIMITS
// ============================================

export const GAS_LIMITS = {
  DEPOSIT: 300000,
  WITHDRAW: 2000000,
  APPROVE: 50000,
};
