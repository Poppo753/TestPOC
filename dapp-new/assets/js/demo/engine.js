import { vaultById } from './data.js';

const EPSILON = 0.000001;
const roundMoney = (value) => Math.round((value + Number.EPSILON) * 1e6) / 1e6;

/**
 * Derive value instead of storing it. This makes the simulation deterministic:
 * the same principal and number of simulated days always produce the same
 * result, with no market feed or hidden random component.
 */
export function positionValue(position, vault) {
  if (!position || !vault) return 0;
  return roundMoney(position.principal * ((1 + vault.apy) ** (position.daysAccrued / 365)));
}

export function summarize(state) {
  const vaultValue = Object.entries(state.positions).reduce((sum, [id, position]) =>
    sum + positionValue(position, vaultById(id)), 0);
  const principal = Object.values(state.positions).reduce((sum, position) => sum + position.principal, 0);
  return {
    wallet: roundMoney(state.walletBalance),
    vaultValue: roundMoney(vaultValue),
    principal: roundMoney(principal),
    earnings: roundMoney(vaultValue - principal),
    total: roundMoney(state.walletBalance + vaultValue),
    positionCount: Object.values(state.positions).filter((position) => position.principal > EPSILON).length,
  };
}

function numericAmount(amount) {
  const value = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw new Error('Enter an amount greater than zero.');
  return roundMoney(value);
}

function activity(type, vault, amount, now = new Date()) {
  return {
    id: `DEMO-${now.getTime()}-${Math.floor(amount * 100)}`,
    timestamp: now.toISOString(),
    type,
    vaultId: vault?.id || null,
    vaultName: vault?.name || 'Demo account',
    amount: roundMoney(amount),
    status: 'Simulated',
  };
}

export function deposit(state, vaultId, rawAmount, now) {
  const vault = vaultById(vaultId);
  if (!vault) throw new Error('The selected illustrative vault does not exist.');
  const amount = numericAmount(rawAmount);
  if (amount - state.walletBalance > EPSILON) throw new Error('The demo wallet does not contain enough USDC.');

  const current = state.positions[vaultId];
  // Existing illustrative earnings remain visible. New capital starts accruing
  // from the current simulated day, so weighted days preserve the prior value.
  const currentValue = positionValue(current, vault);
  state.positions[vaultId] = {
    principal: roundMoney(currentValue + amount),
    daysAccrued: 0,
  };
  state.walletBalance = roundMoney(state.walletBalance - amount);
  state.activity.unshift(activity('Deposit', vault, amount, now));
  return state;
}

export function advanceDays(state, days = 30, now) {
  if (summarize(state).positionCount === 0) throw new Error('Deposit into an illustrative vault before advancing time.');
  if (!Number.isInteger(days) || days <= 0) throw new Error('Simulated days must be a positive integer.');
  Object.values(state.positions).forEach((position) => { position.daysAccrued += days; });
  state.simulatedDays += days;
  state.activity.unshift(activity(`Advanced ${days} days`, null, 0, now));
  return state;
}

export function withdraw(state, vaultId, rawAmount, now) {
  const vault = vaultById(vaultId);
  const position = state.positions[vaultId];
  if (!vault || !position) throw new Error('No position exists for this illustrative vault.');
  const amount = numericAmount(rawAmount);
  const available = positionValue(position, vault);
  if (amount - available > EPSILON) throw new Error('The requested amount is greater than the simulated position value.');

  const isFullWithdrawal = available - amount <= 0.01;
  const paid = isFullWithdrawal ? available : amount;
  if (isFullWithdrawal) {
    delete state.positions[vaultId];
  } else {
    const remainingValue = available - paid;
    state.positions[vaultId] = { principal: roundMoney(remainingValue), daysAccrued: 0 };
  }
  state.walletBalance = roundMoney(state.walletBalance + paid);
  state.activity.unshift(activity('Withdrawal', vault, paid, now));
  return state;
}

