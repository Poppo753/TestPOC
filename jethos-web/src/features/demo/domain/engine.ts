import { vaultById } from './catalog';
import type { DemoActivity, DemoState, DemoSummary, DemoVault, VaultId } from './types';

const epsilon = 0.000001;
export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 1e6) / 1e6;

export function positionValue(
  position: { principal: number; daysAccrued: number } | undefined,
  vault: DemoVault | undefined,
): number {
  if (!position || !vault) return 0;
  return roundMoney(position.principal * (1 + vault.apy) ** (position.daysAccrued / 365));
}

export const walletTotal = (state: DemoState): number =>
  roundMoney(Object.values(state.walletAssets).reduce((sum, value) => sum + value, 0));

export function summarize(state: DemoState): DemoSummary {
  const entries = Object.entries(state.positions) as Array<
    [VaultId, NonNullable<DemoState['positions'][VaultId]>]
  >;
  const vaultValue = entries.reduce(
    (sum, [id, position]) => sum + positionValue(position, vaultById(id)),
    0,
  );
  const principal = entries.reduce((sum, [, position]) => sum + position.principal, 0);
  const wallet = walletTotal(state);
  return {
    wallet,
    vaultValue: roundMoney(vaultValue),
    principal: roundMoney(principal),
    earnings: roundMoney(vaultValue - principal),
    total: roundMoney(wallet + vaultValue),
    positionCount: entries.filter(([, position]) => position.principal > epsilon).length,
  };
}

function numericAmount(amount: number | string): number {
  const value = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw new Error('Enter an amount greater than zero.');
  return roundMoney(value);
}

function activity(
  type: string,
  vault: DemoVault | undefined,
  amount: number,
  now = new Date(),
): DemoActivity {
  return {
    id: `DEMO-${now.getTime()}-${Math.floor(amount * 100)}`,
    timestamp: now.toISOString(),
    type,
    vaultId: vault?.id ?? null,
    vaultName: vault?.name ?? 'Demo account',
    asset: vault?.asset.symbol ?? null,
    chain: vault?.chain.name ?? null,
    amount: roundMoney(amount),
    status: 'Simulated',
  };
}

export function deposit(
  state: DemoState,
  id: string,
  rawAmount: number | string,
  now?: Date,
): DemoState {
  const vault = vaultById(id);
  if (!vault) throw new Error('The selected illustrative vault does not exist.');
  const amount = numericAmount(rawAmount);
  const available = state.walletAssets[vault.asset.id] || 0;
  if (amount - available > epsilon)
    throw new Error(`The demo wallet does not contain enough ${vault.asset.symbol}.`);
  const currentValue = positionValue(state.positions[vault.id], vault);
  state.positions[vault.id] = { principal: roundMoney(currentValue + amount), daysAccrued: 0 };
  state.walletAssets[vault.asset.id] = roundMoney(available - amount);
  state.activity.unshift(activity('Deposit', vault, amount, now));
  return state;
}

export function advanceDays(state: DemoState, days = 30, now?: Date): DemoState {
  if (summarize(state).positionCount === 0)
    throw new Error('Deposit into an illustrative vault before advancing time.');
  if (!Number.isInteger(days) || days <= 0)
    throw new Error('Simulated days must be a positive integer.');
  Object.values(state.positions).forEach((position) => {
    if (position) position.daysAccrued += days;
  });
  state.simulatedDays += days;
  state.activity.unshift(activity(`Advanced ${days} days`, undefined, 0, now));
  return state;
}

export function withdraw(
  state: DemoState,
  id: string,
  rawAmount: number | string,
  now?: Date,
): DemoState {
  const vault = vaultById(id);
  const position = vault ? state.positions[vault.id] : undefined;
  if (!vault || !position) throw new Error('No position exists for this illustrative vault.');
  const amount = numericAmount(rawAmount);
  const available = positionValue(position, vault);
  if (amount - available > epsilon)
    throw new Error('The requested amount is greater than the simulated position value.');
  const full = available - amount <= 0.01;
  const paid = full ? available : amount;
  if (full) delete state.positions[vault.id];
  else state.positions[vault.id] = { principal: roundMoney(available - paid), daysAccrued: 0 };
  state.walletAssets[vault.asset.id] = roundMoney((state.walletAssets[vault.asset.id] || 0) + paid);
  state.activity.unshift(activity('Withdrawal', vault, paid, now));
  return state;
}
