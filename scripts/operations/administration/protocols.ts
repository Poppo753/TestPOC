import { ZeroAddress, id } from "ethers";
import { PROTOCOL_MANAGER_ABI } from "../../framework/abis";
import { BEACON_ABI } from "../../framework/abis";
import { readContract } from "../../framework/contracts";
import { contractAddress } from "../../framework/manifest";
import { buildCall, buildPlan } from "../../framework/plans";
import { assertContract, assertOwner } from "../../framework/preflight";
import { executePlan } from "../../framework/transactions";
import type { OperationResult, ScriptRuntime } from "../../framework/types";

export interface ProtocolRegistrationInput {
  name: string;
  plugin: string;
  lensAdapter: string;
  registry?: string;
}

export async function registerProtocol(runtime: ScriptRuntime, input: ProtocolRegistrationInput): Promise<OperationResult<undefined>> {
  const manager = await assertContract(runtime, contractAddress(runtime.manifest, "protocolManager"), "ProtocolManager");
  await assertContract(runtime, input.plugin, "Plugin");
  await assertContract(runtime, input.lensAdapter, "LensAdapter");
  if (input.registry && input.registry !== ZeroAddress) await assertContract(runtime, input.registry, "Registry");
  if (!runtime.options.encodeOnly) await assertOwner(runtime, manager);
  const beacon = contractAddress(runtime.manifest, "beacon");
  if (!runtime.options.encodeOnly) await assertOwner(runtime, beacon);
  const exists = (await readContract(runtime, beacon, BEACON_ABI, "checkModuleExists", [input.name]))[0] as boolean;
  const current = exists ? (await readContract(runtime, beacon, BEACON_ABI, "getImplementation", [input.name]))[0] as string : undefined;
  const calls = [];
  if (!current || current.toLowerCase() !== input.plugin.toLowerCase()) {
    calls.push(buildCall({ id: "register-protocol-beacon", description: `Register ${input.name} plugin in Beacon`, chainId: runtime.chainId,
      target: beacon, abi: BEACON_ABI, method: "updateImplementation", args: [input.name, input.plugin] }));
  }
  const call = buildCall({
    id: "register-protocol", description: `Register protocol ${input.name}`, chainId: runtime.chainId,
    target: manager, abi: PROTOCOL_MANAGER_ABI, method: "registerProtocol",
    args: [input.name, input.plugin, input.lensAdapter, input.registry ?? ZeroAddress],
    dependsOn: calls.length ? ["register-protocol-beacon"] : [], expectedState: `${input.name} is active in ProtocolManager`,
  });
  calls.push(call);
  return executePlan(runtime, buildPlan("protocol.register", runtime.chainId, calls));
}

export async function updateProtocol(runtime: ScriptRuntime, input: ProtocolRegistrationInput): Promise<OperationResult<undefined>> {
  const manager = contractAddress(runtime.manifest, "protocolManager");
  if (!runtime.options.encodeOnly) await assertOwner(runtime, manager);
  const beacon = contractAddress(runtime.manifest, "beacon");
  if (!runtime.options.encodeOnly) await assertOwner(runtime, beacon);
  for (const [label, address] of [["Plugin", input.plugin], ["LensAdapter", input.lensAdapter]] as const) await assertContract(runtime, address, label);
  const exists = (await readContract(runtime, beacon, BEACON_ABI, "checkModuleExists", [input.name]))[0] as boolean;
  const current = exists ? (await readContract(runtime, beacon, BEACON_ABI, "getImplementation", [input.name]))[0] as string : undefined;
  const calls = [];
  if (!current || current.toLowerCase() !== input.plugin.toLowerCase()) calls.push(buildCall({ id: "update-protocol-beacon", description: `Update ${input.name} plugin in Beacon`, chainId: runtime.chainId,
    target: beacon, abi: BEACON_ABI, method: "updateImplementation", args: [input.name, input.plugin] }));
  const call = buildCall({ id: "update-protocol", description: `Update protocol ${input.name}`, chainId: runtime.chainId,
    target: manager, abi: PROTOCOL_MANAGER_ABI, method: "updateProtocol",
    args: [input.name, input.plugin, input.lensAdapter, input.registry ?? ZeroAddress], dependsOn: calls.length ? ["update-protocol-beacon"] : [] });
  calls.push(call);
  return executePlan(runtime, buildPlan("protocol.update", runtime.chainId, calls));
}

export async function setProtocolActive(runtime: ScriptRuntime, name: string, active: boolean): Promise<OperationResult<undefined>> {
  const manager = contractAddress(runtime.manifest, "protocolManager");
  if (!runtime.options.encodeOnly) await assertOwner(runtime, manager);
  const call = buildCall({ id: "protocol-status", description: `${active ? "Activate" : "Deactivate"} ${name}`,
    chainId: runtime.chainId, target: manager, abi: PROTOCOL_MANAGER_ABI, method: "setProtocolActive", args: [name, active] });
  return executePlan(runtime, buildPlan("protocol.set-active", runtime.chainId, [call]));
}

export async function setSelectorWhitelist(
  runtime: ScriptRuntime,
  protocolName: string,
  signatures: string[],
  allowed: boolean
): Promise<OperationResult<undefined>> {
  const manager = contractAddress(runtime.manifest, "protocolManager");
  if (!runtime.options.encodeOnly) await assertOwner(runtime, manager);
  const selectors = signatures.map(signature => id(signature).slice(0, 10));
  const call = buildCall({ id: "selector-whitelist", description: `Set selector whitelist for ${protocolName}`,
    chainId: runtime.chainId, target: manager, abi: PROTOCOL_MANAGER_ABI, method: "setAllowedSelectors",
    args: [protocolName, selectors, allowed] });
  return executePlan(runtime, buildPlan("protocol.selector-whitelist", runtime.chainId, [call]));
}
