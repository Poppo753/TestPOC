import { contractAddress } from "../../framework/manifest";
import { readContract } from "../../framework/contracts";
import { PROTOCOL_MANAGER_ABI } from "../../framework/abis";
import type { ScriptRuntime } from "../../framework/types";

export interface ProtocolHealthReport {
  protocolNames: string[];
  globalHealthFactor: string;
  summaries: unknown[];
}

export async function getProtocolHealth(runtime: ScriptRuntime): Promise<ProtocolHealthReport> {
  const manager = contractAddress(runtime.manifest, "protocolManager");
  const protocolNames = (await readContract(runtime, manager, PROTOCOL_MANAGER_ABI, "getAllProtocolNames"))[0] as string[];
  const globalHealthFactor = (await readContract(runtime, manager, PROTOCOL_MANAGER_ABI, "getGlobalHealthFactor"))[0] as bigint;
  const summaries = (await readContract(runtime, manager, PROTOCOL_MANAGER_ABI, "getAllProtocolSummaries"))[0] as unknown[];
  return { protocolNames, globalHealthFactor: globalHealthFactor.toString(), summaries };
}

export async function getPositionsByRisk(runtime: ScriptRuntime): Promise<unknown[]> {
  const manager = contractAddress(runtime.manifest, "protocolManager");
  return (await readContract(runtime, manager, PROTOCOL_MANAGER_ABI, "getAllPositionsSortedByRisk"))[0] as unknown[];
}

