import { vaultById } from './data.js';

const EPSILON = .000001;
const roundMoney = (value) => Math.round((value + Number.EPSILON) * 1e6) / 1e6;

export function positionValue(position, vault) {
  if (!position || !vault) return 0;
  return roundMoney(position.principal * ((1 + vault.apy) ** (position.daysAccrued / 365)));
}

export function walletTotal(state) {
  return roundMoney(Object.values(state.walletAssets).reduce((sum, value) => sum + value, 0));
}

export function summarize(state) {
  const vaultValue = Object.entries(state.positions).reduce((sum, [id, position]) =>
    sum + positionValue(position, vaultById(id)), 0);
  const principal = Object.values(state.positions).reduce((sum, position) => sum + position.principal, 0);
  const wallet = walletTotal(state);
  return {
    wallet,
    vaultValue: roundMoney(vaultValue),
    principal: roundMoney(principal),
    earnings: roundMoney(vaultValue - principal),
    total: roundMoney(wallet + vaultValue),
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
    asset: vault?.asset?.symbol || null,
    chain: vault?.chain?.name || null,
    amount: roundMoney(amount),
    status: 'Simulated',
  };
}

export function deposit(state, id, rawAmount, now) {
  const vault = vaultById(id);
  if (!vault) throw new Error('The selected illustrative vault does not exist.');
  const amount = numericAmount(rawAmount);
  const available = state.walletAssets[vault.asset.id] || 0;
  if (amount - available > EPSILON) throw new Error(`The demo wallet does not contain enough ${vault.asset.symbol}.`);

  const current = state.positions[id];
  const currentValue = positionValue(current, vault);
  state.positions[id] = { principal: roundMoney(currentValue + amount), daysAccrued: 0 };
  state.walletAssets[vault.asset.id] = roundMoney(available - amount);
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

export function withdraw(state, id, rawAmount, now) {
  const vault = vaultById(id);
  const position = state.positions[id];
  if (!vault || !position) throw new Error('No position exists for this illustrative vault.');
  const amount = numericAmount(rawAmount);
  const available = positionValue(position, vault);
  if (amount - available > EPSILON) throw new Error('The requested amount is greater than the simulated position value.');

  const full = available - amount <= .01;
  const paid = full ? available : amount;
  if (full) delete state.positions[id];
  else state.positions[id] = { principal: roundMoney(available - paid), daysAccrued: 0 };
  state.walletAssets[vault.asset.id] = roundMoney((state.walletAssets[vault.asset.id] || 0) + paid);
  state.activity.unshift(activity('Withdrawal', vault, paid, now));
  return state;
}
