import { DEPLOYMENT } from './deployment-config.js';
import { getReadContext } from './contracts.js';

/** Parse user input exactly using token decimals. Never multiply a JS Number. */
export async function parseBaseAmount(input) {
  const { ethers } = await getReadContext();
  const clean = String(input ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(clean)) throw new Error('Enter a positive decimal amount.');
  const amount = ethers.parseUnits(clean, DEPLOYMENT.baseAsset.decimals);
  if (amount <= 0n) throw new Error('Amount must be greater than zero.');
  return amount;
}

export async function parseShareAmount(input, decimals) {
  const { ethers } = await getReadContext();
  const clean = String(input ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(clean)) throw new Error('Enter a positive share amount.');
  const amount = ethers.parseUnits(clean, decimals);
  if (amount <= 0n) throw new Error('Share amount must be greater than zero.');
  return amount;
}

/** These call the current contract helper views. They are useful estimates but
 * are not ERC-4626 previews and cannot guarantee execution in a later block. */
export async function estimateDeposit(amount) {
  const ctx = await getReadContext();
  return { amount, shares: await ctx.liquidity.calculateDepositShares(amount), source: 'LiquidityManager.calculateDepositShares', guaranteed: false };
}
export async function estimateWithdrawal(shares, userAddress) {
  const ctx = await getReadContext();
  const [amount, allowed] = await Promise.all([ctx.liquidity.calculateWithdrawAmount(shares), ctx.liquidity.canWithdraw(userAddress, shares)]);
  return { shares, amount, allowed: allowed[0], reason: allowed[1], source: 'LiquidityManager view helpers', guaranteed: false };
}

