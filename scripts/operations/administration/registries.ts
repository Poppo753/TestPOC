import { contractAddress } from "../../framework/manifest";
import { buildCall, buildPlan } from "../../framework/plans";
import { assertContract, assertOwner } from "../../framework/preflight";
import { executePlan } from "../../framework/transactions";
import type { OperationResult, ScriptRuntime } from "../../framework/types";

const AAVE_REGISTRY_ABI = ["function owner() view returns(address)", "function configureToken(string,address,address,address)"] as const;
const EULER_REGISTRY_ABI = ["function owner() view returns(address)", "function setVault(string,address)"] as const;
const MORPHO_REGISTRY_ABI = [
  "function owner() view returns(address)",
  "function configureMarket(string,string,address,address,address,address,uint256)",
  "function configureVault(address,string)",
  "function setDefaultVault(string,address)",
] as const;
const OWNABLE_ABI = ["function owner() view returns(address)", "function transferOwnership(address)"] as const;

async function registryCall(runtime: ScriptRuntime, registryName: string, operation: string, abi: readonly string[], method: string, args: readonly unknown[]): Promise<OperationResult<undefined>> {
  const registry = await assertContract(runtime, contractAddress(runtime.manifest, registryName), registryName);
  if (!runtime.options.encodeOnly) await assertOwner(runtime, registry);
  const call = buildCall({ id: operation, description: operation, chainId: runtime.chainId, target: registry, abi, method, args });
  return executePlan(runtime, buildPlan(operation, runtime.chainId, [call]));
}

export async function configureAaveToken(runtime: ScriptRuntime, code: string, underlying: string, aToken: string, debtToken: string) {
  for (const [label, address] of [["underlying", underlying], ["aToken", aToken], ["debtToken", debtToken]] as const) await assertContract(runtime, address, label);
  return registryCall(runtime, "aaveV3Registry", "registry.aave-token", AAVE_REGISTRY_ABI, "configureToken", [code, underlying, aToken, debtToken]);
}

export async function configureEulerVault(runtime: ScriptRuntime, code: string, vault: string) {
  await assertContract(runtime, vault, "Euler vault");
  return registryCall(runtime, "eulerRegistry", "registry.euler-vault", EULER_REGISTRY_ABI, "setVault", [code, vault]);
}

export interface MorphoMarketInput { collateralCode: string; loanCode: string; collateralToken: string; loanToken: string; oracle: string; irm: string; lltv: bigint }

export async function configureMorphoMarket(runtime: ScriptRuntime, market: MorphoMarketInput) {
  for (const [label, address] of [["collateralToken", market.collateralToken], ["loanToken", market.loanToken], ["oracle", market.oracle], ["irm", market.irm]] as const) await assertContract(runtime, address, label);
  return registryCall(runtime, "morphoRegistry", "registry.morpho-market", MORPHO_REGISTRY_ABI, "configureMarket",
    [market.collateralCode, market.loanCode, market.collateralToken, market.loanToken, market.oracle, market.irm, market.lltv]);
}

export async function configureMorphoVault(runtime: ScriptRuntime, assetCode: string, vault: string, setDefault: boolean) {
  await assertContract(runtime, vault, "Morpho vault");
  const registry = contractAddress(runtime.manifest, "morphoRegistry");
  if (!runtime.options.encodeOnly) await assertOwner(runtime, registry);
  const configure = buildCall({ id: "configure-vault", description: `Approve Morpho vault for ${assetCode}`,
    chainId: runtime.chainId, target: registry, abi: MORPHO_REGISTRY_ABI, method: "configureVault", args: [vault, assetCode] });
  const calls = [configure];
  if (setDefault) calls.push(buildCall({ id: "set-default-vault", description: `Set default Morpho vault for ${assetCode}`,
    chainId: runtime.chainId, target: registry, abi: MORPHO_REGISTRY_ABI, method: "setDefaultVault", args: [assetCode, vault], dependsOn: ["configure-vault"] }));
  return executePlan(runtime, buildPlan("registry.morpho-vault", runtime.chainId, calls));
}

/**
 * Final, intentionally separate registry step. Keeping this outside deployment
 * prevents the common failure mode where ownership is transferred before token,
 * vault or market configuration is complete.
 */
export async function transferRegistryOwnership(runtime: ScriptRuntime, registryName: string, newOwner: string): Promise<OperationResult<undefined>> {
  const registry = await assertContract(runtime, contractAddress(runtime.manifest, registryName), registryName);
  await assertContract(runtime, newOwner, "new registry owner");
  if (!runtime.options.encodeOnly) await assertOwner(runtime, registry);
  const call = buildCall({ id: "transfer-registry-ownership", description: `Transfer ${registryName} ownership only after configuration`,
    chainId: runtime.chainId, target: registry, abi: OWNABLE_ABI, method: "transferOwnership", args: [newOwner],
    expectedState: `${newOwner} owns ${registryName}` });
  return executePlan(runtime, buildPlan("registry.transfer-ownership", runtime.chainId, [call],
    ["This is the final registry step; configuration through the deployer will no longer be possible."]));
}
