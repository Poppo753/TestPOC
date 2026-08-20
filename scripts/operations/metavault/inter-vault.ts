/**
 * Importable InterVault operations.
 *
 * Mutations are expressed as neutral execution plans so the same code can be
 * used by this CLI, a website, a Safe proposal builder or an autonomous worker.
 * The framework simulates by default; persistence still requires the global
 * combination --execute=true --dry-run=false.
 */
import { getAddress } from "ethers";
import { readContract } from "../../framework/contracts";
import { contractAddress } from "../../framework/manifest";
import { buildCall, buildPlan } from "../../framework/plans";
import { assertContract, assertOwner } from "../../framework/preflight";
import { executePlan } from "../../framework/transactions";
import type { Address, OperationResult, ScriptRuntime } from "../../framework/types";

export interface InterVaultChildInput {
  childId: string;
  tokenCode: string;
  assetId: string;
  childBeacon: Address;
  liquidityManager: Address;
  shareToken: Address;
  valueCalculator: Address;
  baseAsset: Address;
  manifestHash: string;
  assetDecimals: number;
  maxExposureBps: number;
  maxShareDeviationBps: number;
  exitPriority: number;
  maxDepositAssets: bigint;
}
const REGISTRY_ABI = [
  "function owner() view returns(address)",
  "function registerChild((bytes32 childId,string tokenCode,bytes32 assetId,address childBeacon,address liquidityManager,address shareToken,address valueCalculator,address baseAsset,bytes32 manifestHash,uint256 chainId,uint8 assetDecimals,uint16 maxExposureBps,uint16 maxShareDeviationBps,uint16 exitPriority,uint128 maxDepositAssets,bool active,bool depositsEnabled,bool withdrawalsEnabled,bool emergencyOnly),uint8)",
  "function updatePolicy(bytes32,uint16,uint128,uint16,uint16)",
  "function updateStatus(bytes32,bool,bool,bool,bool)",
  "function getChildIds() view returns(bytes32[])",
  "function getChild(bytes32) view returns(tuple(bytes32 childId,string tokenCode,bytes32 assetId,address childBeacon,address liquidityManager,address shareToken,address valueCalculator,address baseAsset,bytes32 manifestHash,uint256 chainId,uint8 assetDecimals,uint16 maxExposureBps,uint16 maxShareDeviationBps,uint16 exitPriority,uint128 maxDepositAssets,bool active,bool depositsEnabled,bool withdrawalsEnabled,bool emergencyOnly))",
] as const;
const LENS_ABI = [
  "function getTotalValue() view returns(uint256)",
  "function getAllChildPositions() view returns(tuple(bytes32 childId,string tokenCode,address shareToken,uint256 shares,uint256 underlyingAssets,uint256 valueInParentBase,uint256 availableInParentBase,uint256 exposureBps,bool active,bool depositsEnabled,bool withdrawalsEnabled)[])"
] as const;

function registryAddress(runtime: ScriptRuntime): Address { return contractAddress(runtime.manifest, "interVaultRegistry"); }

export async function registerInterVaultChild(runtime: ScriptRuntime, input: InterVaultChildInput): Promise<OperationResult<undefined>> {
  const registry = await assertContract(runtime, registryAddress(runtime), "InterVaultRegistry");
  if (!runtime.options.encodeOnly) await assertOwner(runtime, registry);
  for (const [label, address] of [
    ["childBeacon", input.childBeacon], ["liquidityManager", input.liquidityManager],
    ["shareToken", input.shareToken], ["valueCalculator", input.valueCalculator], ["baseAsset", input.baseAsset],
  ] as const) await assertContract(runtime, address, label);
  const child = {
    ...input, chainId: runtime.chainId, active: true, depositsEnabled: true,
    withdrawalsEnabled: true, emergencyOnly: false,
  };
  const call = buildCall({ id: "inter-vault-register-child", description: `Register canonical ${input.tokenCode} leaf`,
    chainId: runtime.chainId, target: registry, abi: REGISTRY_ABI, method: "registerChild", args: [child, 0],
    expectedState: `${input.tokenCode} resolves to ${input.childId}` });
  return executePlan(runtime, buildPlan("metavault.register-child", runtime.chainId, [call]));
}

export async function updateInterVaultPolicy(runtime: ScriptRuntime, input: {
  childId: string; maxExposureBps: number; maxDepositAssets: bigint; maxShareDeviationBps: number; exitPriority: number;
}): Promise<OperationResult<undefined>> {
  const registry = registryAddress(runtime);
  if (!runtime.options.encodeOnly) await assertOwner(runtime, registry);
  const call = buildCall({ id: "inter-vault-policy", description: `Update policy for ${input.childId}`,
    chainId: runtime.chainId, target: registry, abi: REGISTRY_ABI, method: "updatePolicy",
    args: [input.childId, input.maxExposureBps, input.maxDepositAssets, input.maxShareDeviationBps, input.exitPriority] });
  return executePlan(runtime, buildPlan("metavault.update-policy", runtime.chainId, [call]));
}

export async function updateInterVaultStatus(runtime: ScriptRuntime, input: {
  childId: string; active: boolean; depositsEnabled: boolean; withdrawalsEnabled: boolean; emergencyOnly: boolean;
}): Promise<OperationResult<undefined>> {
  const registry = registryAddress(runtime);
  if (!runtime.options.encodeOnly) await assertOwner(runtime, registry);
  const call = buildCall({ id: "inter-vault-status", description: `Update lifecycle for ${input.childId}`,
    chainId: runtime.chainId, target: registry, abi: REGISTRY_ABI, method: "updateStatus",
    args: [input.childId, input.active, input.depositsEnabled, input.withdrawalsEnabled, input.emergencyOnly] });
  return executePlan(runtime, buildPlan("metavault.update-status", runtime.chainId, [call]));
}

export async function getInterVaultPositions(runtime: ScriptRuntime): Promise<{ totalValue: string; positions: unknown[] }> {
  const lens = contractAddress(runtime.manifest, "interVaultLensAdapter");
  const totalValue = (await readContract(runtime, lens, LENS_ABI, "getTotalValue"))[0] as bigint;
  const positions = (await readContract(runtime, lens, LENS_ABI, "getAllChildPositions"))[0] as unknown[];
  return { totalValue: totalValue.toString(), positions };
}

export async function preflightInterVault(runtime: ScriptRuntime): Promise<{ valid: boolean; findings: string[] }> {
  const findings: string[] = [];
  const registry = await assertContract(runtime, registryAddress(runtime), "InterVaultRegistry");
  const plugin = await assertContract(runtime, contractAddress(runtime.manifest, "interVaultPlugin"), "InterVaultPlugin");
  await assertContract(runtime, contractAddress(runtime.manifest, "interVaultLensAdapter"), "InterVaultLensAdapter");
  const ids = (await readContract(runtime, registry, REGISTRY_ABI, "getChildIds"))[0] as string[];
  if (ids.length === 0) findings.push("No canonical child is registered");
  for (const id of ids) {
    const child = (await readContract(runtime, registry, REGISTRY_ABI, "getChild", [id]))[0] as Record<string, unknown>;
    for (const key of ["childBeacon", "liquidityManager", "shareToken", "valueCalculator", "baseAsset"] as const) {
      const address = getAddress(String(child[key])) as Address;
      if (await runtime.provider.getCode(address) === "0x") findings.push(`${id}: ${key} has no bytecode`);
    }
  }
  const protocol = runtime.manifest.protocols.InterVault;
  if (!protocol || protocol.plugin.toLowerCase() !== plugin.toLowerCase()) findings.push("Manifest InterVault protocol/plugin mismatch");
  return { valid: findings.length === 0, findings };
}
