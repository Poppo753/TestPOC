import type { ContractTransactionReceipt, ContractTransactionResponse } from 'ethers';

import {
  getReadContext,
  getWriteContext,
  type ReadContext,
  type WriteContext,
} from '../infrastructure/contracts';
import { deployment } from '../infrastructure/deployment';
import type { WalletSession } from '../infrastructure/wallet';

export interface TransactionState {
  state: 'awaiting-wallet' | 'pending' | 'confirmed';
  label: string;
  hash?: string;
  receipt?: ContractTransactionReceipt;
}
type StateListener = (state: TransactionState) => void;

export interface TransactionDependencies {
  read(): Promise<ReadContext>;
  write(wallet: WalletSession): WriteContext;
  now(): number;
}

const defaultDependencies: TransactionDependencies = {
  read: getReadContext,
  write: getWriteContext,
  now: Date.now,
};

let transactionPending = false;
const requireIdle = () => {
  if (transactionPending) throw new Error('Another transaction workflow is already active.');
  transactionPending = true;
};

export function explainTransactionError(error: unknown): string {
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    if (record.code === 4001 || record.code === 'ACTION_REJECTED')
      return 'The wallet request was rejected.';
    for (const key of ['shortMessage', 'reason', 'message'] as const) {
      const value = record[key];
      if (typeof value === 'string' && value)
        return value.replace(/^execution reverted:\s*/iu, '') || 'Transaction failed.';
    }
  }
  return String(error) || 'Transaction failed.';
}

async function sendAndWait(
  send: () => Promise<ContractTransactionResponse>,
  onState: StateListener | undefined,
  label: string,
) {
  onState?.({ state: 'awaiting-wallet', label });
  const transaction = await send();
  onState?.({ state: 'pending', label, hash: transaction.hash });
  const receipt = await transaction.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`${label} was mined but failed.`);
  onState?.({ state: 'confirmed', label, hash: transaction.hash, receipt });
  return receipt;
}

async function exclusive<T>(operation: () => Promise<T>): Promise<T> {
  requireIdle();
  try {
    return await operation();
  } finally {
    transactionPending = false;
  }
}

export const approveExact = (
  wallet: WalletSession,
  amount: bigint,
  onState?: StateListener,
  dependencies = defaultDependencies,
) =>
  exclusive(async () => {
    const context = dependencies.write(wallet);
    return sendAndWait(
      () => context.baseAsset.approve(deployment.contracts.liquidityManager, amount),
      onState,
      'USDC approval',
    );
  });

export const revokeApproval = (
  wallet: WalletSession,
  onState?: StateListener,
  dependencies = defaultDependencies,
) =>
  exclusive(async () => {
    const context = dependencies.write(wallet);
    return sendAndWait(
      () => context.baseAsset.approve(deployment.contracts.liquidityManager, 0n),
      onState,
      'Approval revocation',
    );
  });

export const deposit = (
  wallet: WalletSession,
  amount: bigint,
  onState?: StateListener,
  dependencies = defaultDependencies,
) =>
  exclusive(async () => {
    const [read, write] = await Promise.all([
      dependencies.read(),
      Promise.resolve(dependencies.write(wallet)),
    ]);
    if (!(await read.liquidity.depositsEnabled())) throw new Error('Deposits are disabled.');
    if ((await read.baseAsset.balanceOf(wallet.address!)) < amount)
      throw new Error('Insufficient USDC balance.');
    if (
      (await read.baseAsset.allowance(wallet.address!, deployment.contracts.liquidityManager)) <
      amount
    )
      throw new Error('Approve the exact USDC amount before depositing.');
    await write.liquidity.deposit.estimateGas(amount);
    return sendAndWait(() => write.liquidity.deposit(amount), onState, 'Vault deposit');
  });

export const withdraw = (
  wallet: WalletSession,
  shares: bigint,
  onState?: StateListener,
  deadlineMinutes = 20,
  dependencies = defaultDependencies,
) =>
  exclusive(async () => {
    const [read, write] = await Promise.all([
      dependencies.read(),
      Promise.resolve(dependencies.write(wallet)),
    ]);
    if (!(await read.liquidity.withdrawsEnabled())) throw new Error('Withdrawals are disabled.');
    if ((await read.shares.balanceOf(wallet.address!)) < shares)
      throw new Error('Insufficient share balance.');
    const allowed = await read.liquidity.canWithdraw(wallet.address!, shares);
    if (!allowed[0]) throw new Error(allowed[1] || 'Withdrawal is not currently allowed.');
    const deadline = BigInt(Math.floor(dependencies.now() / 1000) + deadlineMinutes * 60);
    await write.liquidity.withdrawWithDeadline.estimateGas(shares, deadline);
    return sendAndWait(
      () => write.liquidity.withdrawWithDeadline(shares, deadline),
      onState,
      'Vault withdrawal',
    );
  });
