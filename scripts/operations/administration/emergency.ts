import { EMERGENCY_ABI } from "../../framework/abis";
import { contractAddress } from "../../framework/manifest";
import { buildCall, buildPlan } from "../../framework/plans";
import { assertOwner } from "../../framework/preflight";
import { executePlan } from "../../framework/transactions";
import type { OperationResult, ScriptRuntime } from "../../framework/types";

export async function setEmergencyState(runtime: ScriptRuntime, active: boolean, reason = "Operator requested emergency pause"): Promise<OperationResult<undefined>> {
  const handler = contractAddress(runtime.manifest, "emergencyHandler");
  if (!runtime.options.encodeOnly) await assertOwner(runtime, handler);
  const method = active ? "emergencyPause" : "emergencyUnpause";
  const call = buildCall({ id: active ? "emergency-pause" : "emergency-unpause",
    description: active ? `Pause system: ${reason}` : "Unpause system", chainId: runtime.chainId,
    target: handler, abi: EMERGENCY_ABI, method, args: active ? [reason] : [] });
  return executePlan(runtime, buildPlan(active ? "emergency.pause" : "emergency.unpause", runtime.chainId, [call],
    active ? [] : ["Unpause is owner-only and may be timelocked by the contract."]));
}

export async function setPluginCircuitBreaker(runtime: ScriptRuntime, pluginName: string, active: boolean): Promise<OperationResult<undefined>> {
  const plugin = contractAddress(runtime.manifest, pluginName);
  if (!runtime.options.encodeOnly) await assertOwner(runtime, plugin);
  const kind = Object.values(runtime.manifest.protocols).find(protocol => protocol.plugin.toLowerCase() === plugin.toLowerCase())?.kind;
  const isEuler = kind === "euler" || pluginName.toLowerCase().includes("euler");
  const abi = ["function owner() view returns(address)", "function setCircuitBreaker(bool)", "function activateCircuitBreaker()", "function deactivateCircuitBreaker()"] as const;
  const call = buildCall({ id: "plugin-circuit-breaker", description: `${active ? "Activate" : "Deactivate"} ${pluginName} circuit breaker`,
    chainId: runtime.chainId, target: plugin, abi, method: isEuler ? "setCircuitBreaker" : (active ? "activateCircuitBreaker" : "deactivateCircuitBreaker"),
    args: isEuler ? [active] : [] });
  return executePlan(runtime, buildPlan("emergency.plugin-circuit-breaker", runtime.chainId, [call]));
}
