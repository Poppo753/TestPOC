import { parseUnits } from 'ethers';

import { getReadContext } from '../infrastructure/contracts';
import { deployment } from '../infrastructure/deployment';

const parsePositive = (input: unknown, decimals: number, message: string): bigint => {
  const clean = String(input ?? '').trim();
  if (!/^\d+(\.\d+)?$/u.test(clean)) throw new Error(message);
  const amount = parseUnits(clean, decimals);
  if (amount <= 0n)
    throw new Error(
      message.includes('share')
        ? 'Share amount must be greater than zero.'
        : 'Amount must be greater than zero.',
    );
  return amount;
};

export const parseBaseAmount = async (input: unknown): Promise<bigint> =>
  parsePositive(input, deployment.baseAsset.decimals, 'Enter a positive decimal amount.');
export const parseShareAmount = async (input: unknown, decimals: number): Promise<bigint> =>
  parsePositive(input, decimals, 'Enter a positive share amount.');

export async function estimateDeposit(amount: bigint) {
  const ctx = await getReadContext();
  return {
    amount,
    shares: await ctx.liquidity.calculateDepositShares(amount),
    source: 'LiquidityManager.calculateDepositShares',
    guaranteed: false,
  } as const;
}

export async function estimateWithdrawal(shares: bigint, userAddress: string) {
  const ctx = await getReadContext();
  const [amount, allowed] = await Promise.all([
    ctx.liquidity.calculateWithdrawAmount(shares),
    ctx.liquidity.canWithdraw(userAddress, shares),
  ]);
  return {
    shares,
    amount,
    allowed: allowed[0],
    reason: allowed[1],
    source: 'LiquidityManager view helpers',
    guaranteed: false,
  } as const;
}
