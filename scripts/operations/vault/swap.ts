import { ERC20_ABI, SWAP_MANAGER_ABI, TOKEN_MANAGER_ABI } from "../../framework/abis";
import { readContract } from "../../framework/contracts";
import { contractAddress } from "../../framework/manifest";
import { buildCall, buildPlan } from "../../framework/plans";
import { assertOwner, assertPositive } from "../../framework/preflight";
import { executePlan } from "../../framework/transactions";
import type { OperationResult, ScriptRuntime } from "../../framework/types";

export interface VaultSwapInput { tokenIn: string; tokenOut: string; amountIn: bigint; maxSlippageBps: number; deadlineSeconds?: number }

export async function swapVaultAssets(runtime: ScriptRuntime, input: VaultSwapInput): Promise<OperationResult<{ quote: string; minAmountOut: string; tokenInBefore?: string; tokenInAfter?: string; tokenOutBefore?: string; tokenOutAfter?: string }>> {
  assertPositive(input.amountIn);
  if (input.tokenIn === input.tokenOut) throw new Error("Swap tokens must differ");
  if (!Number.isInteger(input.maxSlippageBps) || input.maxSlippageBps < 0 || input.maxSlippageBps > 2_000) throw new Error("maxSlippageBps must be between 0 and 2000");
  const swapManager = contractAddress(runtime.manifest, "swapManager");
  const proxy = contractAddress(runtime.manifest, "proxyGeneral");
  const tokenManager = contractAddress(runtime.manifest, "tokenManager");
  if (!runtime.options.encodeOnly) await assertOwner(runtime, swapManager);
  const enabled = (await readContract(runtime, swapManager, SWAP_MANAGER_ABI, "areSwapsEnabled"))[0] as boolean;
  if (!enabled) throw new Error("Swaps are disabled");
  const quoteRows = (await readContract(runtime, swapManager, SWAP_MANAGER_ABI, "getAllQuotes", [input.tokenIn, input.tokenOut, input.amountIn]))[0] as ArrayLike<ArrayLike<unknown>>;
  let quote = 0n;
  for (let index = 0; index < quoteRows.length; index++) {
    const row = quoteRows[index];
    if (Boolean(row[2]) && (row[1] as bigint) > quote) quote = row[1] as bigint;
  }
  if (quote === 0n) throw new Error("No valid swap plugin quote is available");
  const minAmountOut = quote * BigInt(10_000 - input.maxSlippageBps) / 10_000n;
  assertPositive(minAmountOut, "minAmountOut");
  let tokenInBefore: bigint | undefined; let tokenOutBefore: bigint | undefined;
  let tokenInAddress: string | undefined; let tokenOutAddress: string | undefined;
  if (!runtime.options.encodeOnly) {
    tokenInAddress = (await readContract(runtime, tokenManager, TOKEN_MANAGER_ABI, "getTokenAddress", [input.tokenIn]))[0] as string;
    tokenOutAddress = (await readContract(runtime, tokenManager, TOKEN_MANAGER_ABI, "getTokenAddress", [input.tokenOut]))[0] as string;
    tokenInBefore = (await readContract(runtime, tokenInAddress, ERC20_ABI, "balanceOf", [proxy]))[0] as bigint;
    tokenOutBefore = (await readContract(runtime, tokenOutAddress, ERC20_ABI, "balanceOf", [proxy]))[0] as bigint;
    if (tokenInBefore < input.amountIn) throw new Error("Vault custody has insufficient input-token balance");
  }
  const block = await runtime.provider.getBlock("latest");
  if (!block) throw new Error("Latest block is unavailable");
  const deadline = block.timestamp + (input.deadlineSeconds ?? 1_200);
  const call = buildCall({ id: "vault-swap", description: `Swap ${input.tokenIn} to ${input.tokenOut} inside custody`,
    chainId: runtime.chainId, target: swapManager, abi: SWAP_MANAGER_ABI, method: "swapWithBestPlugin",
    args: [input.tokenIn, input.tokenOut, input.amountIn, minAmountOut, deadline] });
  const execution = await executePlan(runtime, buildPlan("vault.swap", runtime.chainId, [call],
    ["SwapManager permits owner, LiquidityManager or an authorized ProxyGeneral module only."]));
  let tokenInAfter: bigint | undefined; let tokenOutAfter: bigint | undefined;
  if (execution.success && runtime.options.execute && !runtime.options.dryRun && !runtime.options.encodeOnly && tokenInAddress && tokenOutAddress && tokenInBefore !== undefined && tokenOutBefore !== undefined) {
    tokenInAfter = (await readContract(runtime, tokenInAddress, ERC20_ABI, "balanceOf", [proxy]))[0] as bigint;
    tokenOutAfter = (await readContract(runtime, tokenOutAddress, ERC20_ABI, "balanceOf", [proxy]))[0] as bigint;
    if (tokenInBefore - tokenInAfter !== input.amountIn) throw new Error("Swap post-check failed: input-token delta is incorrect");
    if (tokenOutAfter - tokenOutBefore < minAmountOut) throw new Error("Swap post-check failed: output-token delta is below minAmountOut");
  }
  return { ...execution, data: { quote: quote.toString(), minAmountOut: minAmountOut.toString(), tokenInBefore: tokenInBefore?.toString(), tokenInAfter: tokenInAfter?.toString(), tokenOutBefore: tokenOutBefore?.toString(), tokenOutAfter: tokenOutAfter?.toString() } };
}
