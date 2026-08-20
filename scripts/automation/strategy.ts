import type { AutomationConfig, RebalanceAction, StrategyDecision, VaultObservation } from "./types";

export interface StrategyContext {
  lastCompletedAt?: string;
  now?: Date;
}

function capActions(actions: RebalanceAction[], budget: bigint, minimum: bigint): RebalanceAction[] {
  let remaining = budget;
  const result: RebalanceAction[] = [];
  for (const action of actions) {
    if (remaining === 0n) break;
    const amount = BigInt(action.amount);
    const accepted = amount > remaining ? remaining : amount;
    if (accepted < minimum) break;
    result.push({ ...action, amount: accepted.toString() });
    remaining -= accepted;
  }
  return result;
}

/**
 * Deterministic target-weight strategy. It does not inspect APY: target policy
 * is governance input until yield and oracle telemetry have a trusted contract.
 */
export function evaluateStrategy(config: AutomationConfig, observation: VaultObservation, context: StrategyContext = {}): StrategyDecision {
  const managed = BigInt(observation.managedAssets);
  const targets: Record<string, string> = { custody: (managed * BigInt(config.policy.reserveTargetBps) / 10_000n).toString() };
  if (managed === 0n) return { kind: "NO_ACTION", reason: "Vault has no managed base assets", actions: [], maximumDriftBps: 0, proposedMovement: "0", targetAmounts: targets };
  const now = context.now ?? new Date();
  if (context.lastCompletedAt && now.getTime() - new Date(context.lastCompletedAt).getTime() < config.policy.cooldownSeconds * 1000) {
    return { kind: "NO_ACTION", reason: "Rebalance cooldown is still active", actions: [], maximumDriftBps: 0, proposedMovement: "0", targetAmounts: targets };
  }
  let maximumDriftBps = Math.abs(observation.reserveBps - config.policy.reserveTargetBps);
  const withdrawals: RebalanceAction[] = [];
  const deposits: RebalanceAction[] = [];
  const minimum = BigInt(config.policy.minimumActionAmount);
  for (const policy of config.protocols) {
    const current = observation.protocols.find(item => item.name === policy.name);
    if (!current) throw new Error(`Missing observation for ${policy.name}`);
    const target = managed * BigInt(policy.targetBps) / 10_000n;
    targets[policy.name] = target.toString();
    maximumDriftBps = Math.max(maximumDriftBps, Math.abs(current.allocationBps - policy.targetBps));
    const balance = BigInt(current.balance);
    if (balance > target && balance - target >= minimum) withdrawals.push({
      id: `withdraw-${policy.name}`, kind: "withdraw", protocolName: policy.name, tokenCode: config.baseAssetCode,
      amount: (balance - target).toString(), reason: `Allocation exceeds target ${policy.targetBps} bps`,
    });
    if (target > balance && target - balance >= minimum) deposits.push({
      id: `deposit-${policy.name}`, kind: "deposit", protocolName: policy.name, tokenCode: config.baseAssetCode,
      amount: (target - balance).toString(), reason: `Allocation is below target ${policy.targetBps} bps`,
    });
  }
  if (maximumDriftBps < config.policy.rebalanceThresholdBps) {
    return { kind: "NO_ACTION", reason: `Maximum drift ${maximumDriftBps} bps is below threshold`, actions: [], maximumDriftBps, proposedMovement: "0", targetAmounts: targets };
  }
  const movementBudget = managed * BigInt(config.policy.maxMovementBpsPerCycle) / 10_000n;
  const cappedWithdrawals = capActions(withdrawals, movementBudget, minimum);
  const availableForDeposits = BigInt(observation.custodyBalance) + cappedWithdrawals.reduce((sum, action) => sum + BigInt(action.amount), 0n);
  const depositBudget = availableForDeposits < movementBudget ? availableForDeposits : movementBudget;
  const cappedDeposits = capActions(deposits, depositBudget, minimum);
  const actions = [...cappedWithdrawals, ...cappedDeposits];
  if (actions.length === 0) return { kind: "NO_ACTION", reason: "All deltas are below minimum action amount or movement budget", actions, maximumDriftBps, proposedMovement: "0", targetAmounts: targets };
  const movement = actions.reduce((sum, action) => sum + BigInt(action.amount), 0n);
  return { kind: "REBALANCE", reason: `Target allocation drift reached ${maximumDriftBps} bps`, actions, maximumDriftBps, proposedMovement: movement.toString(), targetAmounts: targets };
}
