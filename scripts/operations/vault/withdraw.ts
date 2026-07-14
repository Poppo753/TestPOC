import { LIQUIDITY_ABI, PROXY_ABI } from "../../framework/abis";
import { readContract } from "../../framework/contracts";
import { contractAddress } from "../../framework/manifest";
import { buildCall, buildPlan } from "../../framework/plans";
import { assertPositive, assertSigner } from "../../framework/preflight";
import { executePlan } from "../../framework/transactions";
import type { OperationResult, ScriptRuntime } from "../../framework/types";

export interface VaultWithdrawInput { shares?: bigint; percentageBps?: number; deadlineSeconds?: number; caller?: string }

export async function withdrawFromVault(runtime: ScriptRuntime, input: VaultWithdrawInput): Promise<OperationResult<{ shares: string; lpBefore: string; lpAfter?: string }>> {
  const signer = runtime.options.encodeOnly ? (input.caller ?? runtime.signerAddress) : await assertSigner(runtime);
  if (!signer) throw new Error("caller is required for encode-only withdrawal");
  const proxy = contractAddress(runtime.manifest, "proxyGeneral");
  const liquidity = contractAddress(runtime.manifest, "liquidityManager");
  const lpBefore = runtime.options.encodeOnly ? 0n : (await readContract(runtime, proxy, PROXY_ABI, "balanceOf", [signer]))[0] as bigint;
  let shares = input.shares;
  if (shares === undefined) {
    if (runtime.options.encodeOnly) throw new Error("encode-only withdrawal requires explicit shares");
    const bps = input.percentageBps ?? 10_000;
    if (!Number.isInteger(bps) || bps <= 0 || bps > 10_000) throw new Error("percentageBps must be between 1 and 10000");
    shares = lpBefore * BigInt(bps) / 10_000n;
  }
  assertPositive(shares, "shares");
  if (!runtime.options.encodeOnly) {
    if (shares > lpBefore) throw new Error("Requested shares exceed signer LP balance");
    const canWithdraw = await readContract(runtime, liquidity, LIQUIDITY_ABI, "canWithdraw", [signer, shares]);
    if (!(canWithdraw[0] as boolean)) throw new Error(`Withdrawal preflight rejected: ${String(canWithdraw[1])}`);
  }
  const block = await runtime.provider.getBlock("latest");
  if (!block) throw new Error("Latest block is unavailable");
  const deadline = block.timestamp + (input.deadlineSeconds ?? 1_200);
  const call = buildCall({ id: "withdraw", description: `Burn ${shares} LP shares`, chainId: runtime.chainId,
    target: liquidity, abi: LIQUIDITY_ABI, method: "withdrawWithDeadline", args: [shares, deadline] });
  const execution = await executePlan(runtime, buildPlan("vault.withdraw", runtime.chainId, [call]));
  let lpAfter: bigint | undefined;
  if (execution.success && runtime.options.execute && !runtime.options.dryRun) {
    lpAfter = (await readContract(runtime, proxy, PROXY_ABI, "balanceOf", [signer]))[0] as bigint;
    if (lpAfter !== lpBefore - shares) throw new Error("Withdraw post-check failed: LP balance delta is incorrect");
  }
  return { ...execution, data: { shares: shares.toString(), lpBefore: lpBefore.toString(), lpAfter: lpAfter?.toString() } };
}
