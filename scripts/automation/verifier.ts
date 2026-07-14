import type { AutomationConfig, RiskFinding, StrategyDecision, VaultObservation, VerificationReport } from "./types";

export function verifyRebalance(config: AutomationConfig, before: VaultObservation, after: VaultObservation, decision: StrategyDecision): VerificationReport {
  const findings: RiskFinding[] = [];
  const fail = (code: string, message: string, context?: Record<string, unknown>) => findings.push({ code, severity: "blocking", message, context });
  const managed = BigInt(after.managedAssets);
  const managedBefore = BigInt(before.managedAssets);
  const tolerance = managedBefore * BigInt(config.policy.verificationToleranceBps) / 10_000n;
  if (managed + tolerance < managedBefore) fail("POST_MANAGED_ASSET_LOSS", "Managed base assets decreased beyond verification tolerance", { before: managedBefore.toString(), after: managed.toString(), tolerance: tolerance.toString() });
  if (after.paused) fail("POST_VAULT_PAUSED", "Vault is paused after execution");
  if (after.protocols.some(item => BigInt(item.debt) !== 0n)) fail("POST_DEBT", "Execution introduced debt in supply-only mode");
  if (after.reserveBps < config.policy.reserveMinimumBps) fail("POST_RESERVE", "Reserve is below minimum after execution", { reserveBps: after.reserveBps });
  for (const policy of config.protocols) {
    const current = after.protocols.find(item => item.name === policy.name);
    if (!current) { fail("POST_PROTOCOL_MISSING", `Missing post-observation for ${policy.name}`); continue; }
    if (!current.active) fail("POST_PROTOCOL_INACTIVE", `${policy.name} became inactive during execution`);
    if (current.circuitBreakerActive !== false) fail("POST_CIRCUIT_STATUS", `${policy.name} circuit breaker is active or unavailable after execution`);
    const bps = managed === 0n ? 0 : Number(BigInt(current.balance) * 10_000n / managed);
    if (bps > policy.maxBps) fail("POST_CAP", `${policy.name} exceeds cap after execution`, { allocationBps: bps });
  }
  for (const action of decision.actions) {
    const oldPosition = before.protocols.find(item => item.name === action.protocolName);
    const newPosition = after.protocols.find(item => item.name === action.protocolName);
    if (!oldPosition || !newPosition) continue;
    const oldBalance = BigInt(oldPosition.balance); const newBalance = BigInt(newPosition.balance);
    if (action.kind === "withdraw" && newBalance >= oldBalance) fail("WITHDRAW_DIRECTION", `${action.protocolName} balance did not decrease`);
    if (action.kind === "deposit" && newBalance <= oldBalance) fail("DEPOSIT_DIRECTION", `${action.protocolName} balance did not increase`);
    const expected = action.kind === "withdraw" ? oldBalance - BigInt(action.amount) : oldBalance + BigInt(action.amount);
    const difference = newBalance > expected ? newBalance - expected : expected - newBalance;
    if (difference > tolerance) fail("POST_AMOUNT_MISMATCH", `${action.protocolName} post-balance differs from the planned amount beyond tolerance`, { expected: expected.toString(), actual: newBalance.toString(), tolerance: tolerance.toString() });
  }
  let expectedCustody = BigInt(before.custodyBalance);
  for (const action of decision.actions) expectedCustody += action.kind === "withdraw" ? BigInt(action.amount) : -BigInt(action.amount);
  const actualCustody = BigInt(after.custodyBalance);
  if (absoluteDifference(expectedCustody, actualCustody) > tolerance) fail("POST_CUSTODY_MISMATCH", "Custody balance differs from the executed plan beyond tolerance", { expected: expectedCustody.toString(), actual: actualCustody.toString(), tolerance: tolerance.toString() });
  return { passed: findings.length === 0, findings, observation: after };
}

function absoluteDifference(a: bigint, b: bigint): bigint { return a > b ? a - b : b - a; }
