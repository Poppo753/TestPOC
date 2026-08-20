import { BEACON_ABI } from "../../framework/abis";
import { readContract } from "../../framework/contracts";
import { contractAddress } from "../../framework/manifest";
import { buildCall, buildPlan } from "../../framework/plans";
import { assertAllowedChain, assertContract, assertOwner } from "../../framework/preflight";
import { executePlan } from "../../framework/transactions";
import type { OperationResult, ScriptRuntime } from "../../framework/types";
import { PreflightError } from "../../framework/errors";

export async function updateBeaconModule(
  runtime: ScriptRuntime,
  moduleName: string,
  newImplementation: string
): Promise<OperationResult<{ previousImplementation: string; newImplementation: string }>> {
  assertAllowedChain(runtime);
  const beacon = await assertContract(runtime, contractAddress(runtime.manifest, "beacon"), "Beacon");
  await assertContract(runtime, newImplementation, "New implementation");
  if (!runtime.options.encodeOnly) await assertOwner(runtime, beacon);
  const previous = (await readContract(runtime, beacon, BEACON_ABI, "getImplementation", [moduleName]))[0] as string;
  if (previous.toLowerCase() === newImplementation.toLowerCase()) throw new PreflightError("New implementation equals current implementation", { moduleName, previous });
  const call = buildCall({
    id: "beacon-update",
    description: `Update Beacon module ${moduleName}`,
    chainId: runtime.chainId,
    target: beacon,
    abi: BEACON_ABI,
    method: "updateImplementation",
    args: [moduleName, newImplementation],
    expectedState: `${moduleName} resolves to ${newImplementation}`,
  });
  const execution = await executePlan(runtime, buildPlan("beacon.update-module", runtime.chainId, [call]));
  if (!execution.success) return { ...execution, data: { previousImplementation: previous, newImplementation } };
  if (runtime.options.execute && !runtime.options.dryRun && !runtime.options.encodeOnly) {
    const actual = (await readContract(runtime, beacon, BEACON_ABI, "getImplementation", [moduleName]))[0] as string;
    if (actual.toLowerCase() !== newImplementation.toLowerCase()) throw new PreflightError("Beacon post-verification failed", { actual, expected: newImplementation });
    const history = (await readContract(runtime, beacon, BEACON_ABI, "getImplementationHistory", [moduleName]))[0] as string[];
    if (!history.some(item => item.toLowerCase() === previous.toLowerCase())) throw new PreflightError("Previous implementation missing from history");
  }
  return { ...execution, data: { previousImplementation: previous, newImplementation } };
}
