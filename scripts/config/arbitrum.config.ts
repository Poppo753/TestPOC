/**
 * @file arbitrum.config.ts
 * @description Arbitrum Mainnet Addresses Configuration
 * 
 * Contiene tutti gli indirizzi di contratti esterni su Arbitrum mainnet
 * utilizzati dal sistema per integrazione con Euler V2, Balancer, etc.
 */

export const ARBITRUM_ADDRESSES = {
    // ==================== CORE SYSTEM ====================
    // From mainnet-latest.json - deployed infrastructure
    BEACON: "0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870",
    PROXY_GENERAL: "0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1",
    TOKEN_MANAGER: "0xc4c8581a7Cbb4e046adB6A6e9008375F38441517",
    
    // ==================== TOKENS ====================
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    DAI: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
    
    // ==================== EULER V2 ====================
    // Core Euler V2 contracts
    EVC: "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066",
    ACCOUNT_LENS: "0x90a52DDcb232e7bb003DD9258fA1235c553eC956",
    
    // Euler V2 Vaults
    WETH_VAULT: "0x78E3E051D32157AACD550fBB78458762d8f7edFF",
    USDC_VAULT: "0x0a1eCC5Fe8C9be3C809844fcBe615B46A869b899",
    
    // ==================== BALANCER V2 ====================
    // Balancer V2 Vault - 0% fee flash loans!
    BALANCER_VAULT: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
    
    // ==================== SWAP ====================
    // SimpleSwap (Uniswap V3 wrapper)
    SIMPLE_SWAP: "0xa0DB78167CBAccD47524a261b7741C6B41Bbd096",
    
    // Uniswap V3
    UNISWAP_V3_ROUTER: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    UNISWAP_V3_QUOTER: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
} as const;

/**
 * Vault configuration for EulerRegistry
 */
export const EULER_VAULTS = {
    WETH: ARBITRUM_ADDRESSES.WETH_VAULT,
    USDC: ARBITRUM_ADDRESSES.USDC_VAULT,
} as const;

/**
 * Helper to get token address by symbol
 */
export function getTokenAddress(symbol: "WETH" | "USDC" | "USDT" | "DAI" | "WBTC"): string {
    return ARBITRUM_ADDRESSES[symbol];
}

/**
 * Helper to get vault address by token symbol
 */
export function getVaultAddress(symbol: "WETH" | "USDC"): string {
    return EULER_VAULTS[symbol];
}
