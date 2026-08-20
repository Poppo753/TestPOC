import { ERC20_ABI, LIQUIDITY_ABI, PROXY_ABI, WETH_ABI } from "../../framework/abis";
import { readContract } from "../../framework/contracts";
import { contractAddress } from "../../framework/manifest";
import { buildCall, buildPlan } from "../../framework/plans";
import { assertContract, assertPositive, assertSigner } from "../../framework/preflight";
import { executePlan } from "../../framework/transactions";
import type { OperationResult, ScriptRuntime } from "../../framework/types";

export interface VaultDepositInput { amount: bigint; wrapNative?: boolean; caller?: string }

export async function depositToVault(runtime: ScriptRuntime, input: VaultDepositInput): Promise<OperationResult<{ lpBefore?: string; lpAfter?: string }>> {
  assertPositive(input.amount);
  const signer = runtime.options.encodeOnly ? (input.caller ?? runtime.signerAddress) : await assertSigner(runtime, input.wrapNative ? input.amount : 0n);
  if (!signer) throw new Error("signerAddress is required to build a vault deposit plan");
  const baseAsset = await assertContract(runtime, runtime.manifest.baseAsset.address, "Base asset");
  const liquidity = await assertContract(runtime, contractAddress(runtime.manifest, "liquidityManager"), "LiquidityManager");
  const proxy = contractAddress(runtime.manifest, "proxyGeneral");
  const lpBefore = runtime.options.encodeOnly ? undefined : (await readContract(runtime, proxy, PROXY_ABI, "balanceOf", [signer]))[0] as bigint;
  const calls = [];
  if (input.wrapNative) {
    calls.push(buildCall({ id: "wrap-native", description: `Wrap ${input.amount} native units into ${runtime.manifest.baseAsset.code}`,
      chainId: runtime.chainId, target: baseAsset, abi: WETH_ABI, method: "deposit", value: input.amount }));
  }
  calls.push(buildCall({ id: "approve-liquidity", description: "Approve exact deposit amount",
    chainId: runtime.chainId, target: baseAsset, abi: ERC20_ABI, method: "approve", args: [liquidity, input.amount],
    dependsOn: input.wrapNative ? ["wrap-native"] : [] }));
  calls.push(buildCall({ id: "deposit", description: "Deposit base asset and mint LP shares",
    chainId: runtime.chainId, target: liquidity, abi: LIQUIDITY_ABI, method: "deposit", args: [input.amount], dependsOn: ["approve-liquidity"] }));
  const execution = await executePlan(runtime, buildPlan("vault.deposit", runtime.chainId, calls));
  let lpAfter: bigint | undefined;
  if (execution.success && runtime.options.execute && !runtime.options.dryRun && !runtime.options.encodeOnly) {
    lpAfter = (await readContract(runtime, proxy, PROXY_ABI, "balanceOf", [signer]))[0] as bigint;
    if (lpBefore !== undefined && lpAfter <= lpBefore) throw new Error("Deposit post-check failed: LP balance did not increase");
  }
  return { ...execution, data: { lpBefore: lpBefore?.toString(), lpAfter: lpAfter?.toString() } };
}
