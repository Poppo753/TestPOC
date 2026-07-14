import { MaxUint256 } from "ethers";
import { AUTONOMOUS_ACKNOWLEDGEMENT } from "./config";
import type { AutomationConfig, RiskFinding, RiskReport, StrategyDecision, VaultObservation } from "./types";

export function evaluateRisk(config: AutomationConfig, observation: VaultObservation, decision: StrategyDecision): RiskReport {
  const findings: RiskFinding[] = [];
  const blocking = (code: string, message: string, context?: Record<string, unknown>) => findings.push({ code, severity: "blocking", message, context });
  const warning = (code: string, message: string, context?: Record<string, unknown>) => findings.push({ code, severity: "warning", message, context });
  if (observation.chainId !== config.chainId || observation.vaultId !== config.vaultId || observation.baseAssetCode !== config.baseAssetCode) blocking("CONTEXT_MISMATCH", "Observation does not belong to this automation config");
  if (observation.paused) blocking("VAULT_PAUSED", "Vault is paused");
  if (decision.actions.some(item => item.kind === "deposit") && !observation.depositsEnabled) blocking("DEPOSITS_DISABLED", "System deposit policy is disabled");
  if (decision.actions.some(item => item.kind === "withdraw") && !observation.withdrawsEnabled) blocking("WITHDRAWS_DISABLED", "Protocol withdrawals cannot be trusted while vault withdrawals are disabled");
  if (config.policy.requireOracleFreshness && !observation.oracleDataAvailable) blocking("ORACLE_DATA_UNAVAILABLE", "Policy requires normalized oracle freshness data, which the POC observer cannot provide");
  if (config.mode === "autonomous" && (!config.autonomous.enabled || config.autonomous.acknowledgement !== AUTONOMOUS_ACKNOWLEDGEMENT)) blocking("AUTONOMY_NOT_ACKNOWLEDGED", "Autonomous execution is not explicitly acknowledged");
  if (!observation.oracleDataAvailable) warning("ORACLE_TELEMETRY_MISSING", "Allocation is restricted to one base asset because normalized oracle telemetry is unavailable");
  let projectedReserve = BigInt(observation.custodyBalance);
  const projected: Record<string, bigint> = Object.fromEntries(observation.protocols.map(item => [item.name, BigInt(item.balance)]));
  const maxMovement = BigInt(observation.managedAssets) * BigInt(config.policy.maxMovementBpsPerCycle) / 10_000n;
  let withdrawals = 0n;
  let deposits = 0n;
  for (const protocol of observation.protocols) {
    const policy = config.protocols.find(item => item.name === protocol.name);
    if (!policy) blocking("PROTOCOL_NOT_ALLOWED", `Protocol ${protocol.name} is absent from policy`);
    if (!protocol.active) blocking("PROTOCOL_INACTIVE", `Protocol ${protocol.name} is inactive`);
    if (protocol.circuitBreakerActive === undefined) blocking("CIRCUIT_STATUS_UNKNOWN", `Protocol ${protocol.name} circuit breaker status is unavailable`);
    if (protocol.circuitBreakerActive) blocking("CIRCUIT_BREAKER", `Protocol ${protocol.name} circuit breaker is active`);
    if (BigInt(protocol.debt) !== 0n) blocking("DEBT_FORBIDDEN", `Protocol ${protocol.name} has debt in supply-only mode`, { debt: protocol.debt });
    const health = BigInt(protocol.healthFactor);
    if (health !== MaxUint256 && health !== 0n && health < BigInt(config.policy.minHealthFactor)) blocking("HEALTH_BELOW_MINIMUM", `Protocol ${protocol.name} health factor is below policy`, { healthFactor: protocol.healthFactor });
  }
  for (const action of decision.actions) {
    const amount = BigInt(action.amount);
    if (amount <= 0n) blocking("INVALID_AMOUNT", `Action ${action.id} has a non-positive amount`);
    if (!(action.protocolName in projected)) { blocking("UNKNOWN_PROTOCOL", `Action references unknown protocol ${action.protocolName}`); continue; }
    const actionPolicy = config.protocols.find(item => item.name === action.protocolName);
    if (action.kind === "deposit" && !actionPolicy?.enabled) blocking("DEPOSIT_NOT_ALLOWED", `Deposits to ${action.protocolName} are disabled by policy`);
    if (action.kind === "withdraw") {
      withdrawals += amount;
      if (amount > projected[action.protocolName]) blocking("INSUFFICIENT_PROTOCOL_BALANCE", `Withdraw exceeds ${action.protocolName} balance`);
      else { projected[action.protocolName] -= amount; projectedReserve += amount; }
    } else {
      deposits += amount;
      if (amount > projectedReserve) blocking("INSUFFICIENT_CUSTODY", `Deposit to ${action.protocolName} exceeds projected custody`);
      else { projectedReserve -= amount; projected[action.protocolName] += amount; }
    }
  }
  if (withdrawals > maxMovement || deposits > maxMovement) blocking("MOVEMENT_LIMIT", "Proposed movement exceeds per-cycle policy", { maxMovement: maxMovement.toString() });
  const managed = BigInt(observation.managedAssets);
  const projectedReserveBps = managed === 0n ? 10_000 : Number(projectedReserve * 10_000n / managed);
  if (projectedReserveBps < config.policy.reserveMinimumBps) blocking("RESERVE_BELOW_MINIMUM", "Projected liquid reserve is below policy", { projectedReserveBps });
  for (const policy of config.protocols) {
    const bps = managed === 0n ? 0 : Number((projected[policy.name] ?? 0n) * 10_000n / managed);
    if (bps > policy.maxBps) blocking("PROTOCOL_CAP_EXCEEDED", `${policy.name} projected allocation exceeds cap`, { projectedBps: bps, maxBps: policy.maxBps });
  }
  return { approved: !findings.some(item => item.severity === "blocking"), findings, projectedReserve: projectedReserve.toString(), projectedReserveBps, projectedProtocolBalances: Object.fromEntries(Object.entries(projected).map(([name, amount]) => [name, amount.toString()])) };
}
