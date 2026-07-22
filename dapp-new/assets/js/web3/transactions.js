import { DEPLOYMENT } from './deployment-config.js';
import { getReadContext, getWriteContext } from './contracts.js';

let transactionPending = false;
const requireIdle = () => { if (transactionPending) throw new Error('Another transaction workflow is already active.'); transactionPending = true; };
const release = () => { transactionPending = false; };

export function explainTransactionError(error) {
  if (error?.code === 4001 || error?.code === 'ACTION_REJECTED') return 'The wallet request was rejected.';
  const message = error?.shortMessage || error?.reason || error?.info?.error?.message || error?.message || String(error);
  return message.replace(/^execution reverted:\s*/i, '') || 'Transaction failed.';
}

async function sendAndWait(send, onState, label) {
  onState?.({ state: 'awaiting-wallet', label });
  const tx = await send();
  onState?.({ state: 'pending', label, hash: tx.hash });
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`${label} was mined but failed.`);
  onState?.({ state: 'confirmed', label, hash: tx.hash, receipt });
  return receipt;
}

/** Exact approval is safer than an unlimited allowance and matches the user's
 * current intent. A second signature is expected when approval is required. */
export async function approveExact(wallet, amount, onState) {
  requireIdle();
  try {
    const ctx = await getWriteContext(wallet);
    return await sendAndWait(() => ctx.baseAsset.approve(DEPLOYMENT.contracts.liquidityManager, amount), onState, 'USDC approval');
  } finally { release(); }
}

export async function revokeApproval(wallet, onState) {
  requireIdle();
  try {
    const ctx = await getWriteContext(wallet);
    return await sendAndWait(() => ctx.baseAsset.approve(DEPLOYMENT.contracts.liquidityManager, 0n), onState, 'Approval revocation');
  } finally { release(); }
}

export async function deposit(wallet, amount, onState) {
  requireIdle();
  try {
    const [read,write] = await Promise.all([getReadContext(), getWriteContext(wallet)]);
    if (!(await read.liquidity.depositsEnabled())) throw new Error('Deposits are disabled.');
    const balance = await read.baseAsset.balanceOf(wallet.address);
    if (balance < amount) throw new Error('Insufficient USDC balance.');
    const allowance = await read.baseAsset.allowance(wallet.address, DEPLOYMENT.contracts.liquidityManager);
    if (allowance < amount) throw new Error('Approve the exact USDC amount before depositing.');
    await write.liquidity.deposit.estimateGas(amount);
    return await sendAndWait(() => write.liquidity.deposit(amount), onState, 'Vault deposit');
  } finally { release(); }
}

export async function withdraw(wallet, shares, onState, deadlineMinutes = 20) {
  requireIdle();
  try {
    const [read,write] = await Promise.all([getReadContext(), getWriteContext(wallet)]);
    if (!(await read.liquidity.withdrawsEnabled())) throw new Error('Withdrawals are disabled.');
    const balance = await read.shares.balanceOf(wallet.address);
    if (balance < shares) throw new Error('Insufficient share balance.');
    const allowed = await read.liquidity.canWithdraw(wallet.address, shares);
    if (!allowed[0]) throw new Error(allowed[1] || 'Withdrawal is not currently allowed.');
    const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineMinutes * 60);
    await write.liquidity.withdrawWithDeadline.estimateGas(shares, deadline);
    return await sendAndWait(() => write.liquidity.withdrawWithDeadline(shares, deadline), onState, 'Vault withdrawal');
  } finally { release(); }
}

