import { Interface, isAddress } from "ethers";
import { ConfigurationError } from "./errors";
import type { Address, ExecutionPlan, HexData, PlannedCall } from "./types";

export function buildCall(input: {
  id: string;
  description: string;
  chainId: number;
  target: string;
  abi: readonly string[];
  method: string;
  args?: readonly unknown[];
  value?: bigint;
  dependsOn?: string[];
  expectedState?: string;
}): PlannedCall {
  if (!isAddress(input.target)) throw new ConfigurationError("Plan target is not a valid address", { target: input.target });
  const iface = new Interface(input.abi);
  return {
    id: input.id,
    description: input.description,
    chainId: input.chainId,
    target: input.target as Address,
    value: (input.value ?? 0n).toString(),
    data: iface.encodeFunctionData(input.method, [...(input.args ?? [])]) as HexData,
    dependsOn: input.dependsOn ?? [],
    expectedState: input.expectedState,
  };
}

export function buildPlan(operation: string, chainId: number, calls: PlannedCall[], warnings: string[] = []): ExecutionPlan {
  const ids = new Set<string>();
  for (const call of calls) {
    if (call.chainId !== chainId) throw new ConfigurationError("Call chainId differs from plan chainId", { callId: call.id });
    if (ids.has(call.id)) throw new ConfigurationError("Duplicate call id", { callId: call.id });
    for (const dependency of call.dependsOn) {
      if (!ids.has(dependency)) throw new ConfigurationError("Call dependency must reference an earlier call", { callId: call.id, dependency });
    }
    ids.add(call.id);
  }
  return { version: 1, createdAt: new Date().toISOString(), operation, chainId, calls, warnings };
}

