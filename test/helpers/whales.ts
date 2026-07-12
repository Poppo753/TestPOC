import { ethers } from "hardhat";

// ==================== WHALE ADDRESSES (Arbitrum Mainnet) ====================
export const WHALES = {
    WETH: "0x489ee077994B6658eAfA855C308275EAd8097C4A",
    USDC: "0x489ee077994B6658eAfA855C308275EAd8097C4A",
    WBTC: "0x489ee077994B6658eAfA855C308275EAd8097C4A",
    USDT: "0x489ee077994B6658eAfA855C308275EAd8097C4A",
    ARB:  "0x489ee077994B6658eAfA855C308275EAd8097C4A",
} as const;

// ==================== TOKEN ADDRESSES (Arbitrum Mainnet) ====================
export const TOKEN_ADDRESSES = {
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    ARB:  "0x912CE59144191C1204E64559FE8253a0e49E6548",
} as const;

// ==================== GAS FUNDS PER WHALE IMPERSONATION ====================
const GAS_ETH = ethers.parseEther("1");

/**
 * Fonda l'indirizzo `to` con `amount` del token `tokenAddress`,
 * usando whale impersonation. Gestisce automaticamente il gas.
 *
 * @param tokenCode  Chiave del token (es. "WETH", "USDC")
 * @param to         Indirizzo da finanziare
 * @param amount     Quantità di token da inviare
 */
export async function fundUser(
    tokenCode: keyof typeof WHALES,
    to: string,
    amount: bigint
): Promise<void> {
    const whaleAddress   = WHALES[tokenCode];
    const tokenAddress   = TOKEN_ADDRESSES[tokenCode];

    await ethers.provider.send("hardhat_impersonateAccount", [whaleAddress]);
    await ethers.provider.send("hardhat_setBalance", [whaleAddress, ethers.toQuantity(GAS_ETH)]);

    const whale = await ethers.getSigner(whaleAddress);
    const token = await ethers.getContractAt("IERC20", tokenAddress);
    await token.connect(whale).transfer(to, amount);

    await ethers.provider.send("hardhat_stopImpersonatingAccount", [whaleAddress]);
}

/**
 * Versione semplificata: fonda direttamente un indirizzo con ETH.
 */
export async function fundETH(to: string, amount: bigint): Promise<void> {
    await ethers.provider.send("hardhat_setBalance", [to, ethers.toQuantity(amount)]);
}
