import { PROTOCOL_MANAGER_ABI } from "../framework/abis";
import { contractAddress } from "../framework/manifest";
import { buildCall, buildPlan } from "../framework/plans";
import type { ExecutionPlan, ScriptRuntime } from "../framework/types";
import type { StrategyDecision } from "./types";

/** Convert a validated high-level decision into the framework's portable plan. */
export function buildRebalancePlan(runtime: ScriptRuntime, decision: StrategyDecision): ExecutionPlan {
  if (decision.kind !== "REBALANCE" || decision.actions.length === 0) throw new Error("Cannot build a rebalance plan without actions");
  const manager = contractAddress(runtime.manifest, "protocolManager");
  const calls = [];
  const withdrawalIds: string[] = [];
  for (const [index, action] of decision.actions.entries()) {
    const id = `${index + 1}-${action.id}`;
    const dependencies = action.kind === "deposit" ? [...withdrawalIds] : [];
    calls.push(buildCall({
      id,
      description: `${action.kind} ${action.amount} ${action.tokenCode} ${action.kind === "withdraw" ? "from" : "to"} ${action.protocolName}`,
      chainId: runtime.chainId,
      target: manager,
      abi: PROTOCOL_MANAGER_ABI,
      method: `${action.kind}(string,string,uint256)`,
      args: [action.protocolName, action.tokenCode, BigInt(action.amount)],
      dependsOn: dependencies,
      expectedState: `${action.protocolName} balance moves ${action.kind === "withdraw" ? "down" : "up"} by ${action.amount}`,
    }));
    if (action.kind === "withdraw") withdrawalIds.push(id);
  }
  return buildPlan("automation.rebalance", runtime.chainId, calls, ["Supply-only POC: plan contains no borrow, swap or bridge action"]);
}
