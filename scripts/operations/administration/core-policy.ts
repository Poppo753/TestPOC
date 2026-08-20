import { LIQUIDITY_ABI, PROXY_ABI, SWAP_MANAGER_ABI } from "../../framework/abis";
import { contractAddress } from "../../framework/manifest";
import { buildCall, buildPlan } from "../../framework/plans";
import { assertOwner } from "../../framework/preflight";
import { executePlan } from "../../framework/transactions";
import type { OperationResult, ScriptRuntime } from "../../framework/types";

export interface CorePolicyInput {
  feeRecipient: string;
  depositFeeBps: number;
  withdrawFeeBps: number;
  depositsEnabled: boolean;
  withdrawsEnabled: boolean;
  swapsEnabled: boolean;
  hourlyWithdrawLimit: bigint;
  dailyWithdrawLimit: bigint;
  minWithdraw: bigint;
  maxWithdraw: bigint;
  swapTokenCode: string;
  minSwapAmount: bigint;
  maxSwapAmount: bigint;
  maxSlippageBps: number;
  depositRatePerUser: bigint;
  depositRateGlobal: bigint;
  withdrawRatePerUser: bigint;
  withdrawRateGlobal: bigint;
}

/** Builds one ordered policy transaction set; no permissive production defaults are hidden in code. */
export async function configureCorePolicy(runtime: ScriptRuntime, policy: CorePolicyInput): Promise<OperationResult<undefined>> {
  for (const [name, value] of [["depositFeeBps", policy.depositFeeBps], ["withdrawFeeBps", policy.withdrawFeeBps], ["maxSlippageBps", policy.maxSlippageBps]] as const) {
    if (!Number.isInteger(value) || value < 0 || value > 2_000) throw new Error(`${name} must be between 0 and 2000`);
  }
  if (policy.minWithdraw <= 0n || policy.maxWithdraw < policy.minWithdraw || policy.hourlyWithdrawLimit < policy.maxWithdraw || policy.dailyWithdrawLimit < policy.hourlyWithdrawLimit) {
    throw new Error("Withdrawal limits must satisfy 0 < min <= max <= hourly <= daily");
  }
  if (policy.minSwapAmount <= 0n || policy.maxSwapAmount < policy.minSwapAmount) throw new Error("Swap limits must satisfy 0 < min <= max");
  const liquidity = contractAddress(runtime.manifest, "liquidityManager");
  const swap = contractAddress(runtime.manifest, "swapManager");
  const proxy = contractAddress(runtime.manifest, "proxyGeneral");
  if (!runtime.options.encodeOnly) { await assertOwner(runtime, liquidity); await assertOwner(runtime, swap); await assertOwner(runtime, proxy); }
  const calls = [
    buildCall({ id: "fees-recipient", description: "Set fee recipient", chainId: runtime.chainId, target: liquidity, abi: LIQUIDITY_ABI, method: "setFeeRecipient", args: [policy.feeRecipient] }),
    buildCall({ id: "deposit-fee", description: "Set deposit fee", chainId: runtime.chainId, target: liquidity, abi: LIQUIDITY_ABI, method: "setDepositFee", args: [policy.depositFeeBps], dependsOn: ["fees-recipient"] }),
    buildCall({ id: "withdraw-fee", description: "Set withdraw fee", chainId: runtime.chainId, target: liquidity, abi: LIQUIDITY_ABI, method: "setWithdrawFee", args: [policy.withdrawFeeBps], dependsOn: ["deposit-fee"] }),
    buildCall({ id: "withdraw-limits", description: "Set withdraw limits", chainId: runtime.chainId, target: liquidity, abi: LIQUIDITY_ABI, method: "setWithdrawLimits", args: [policy.hourlyWithdrawLimit, policy.dailyWithdrawLimit, policy.minWithdraw, policy.maxWithdraw], dependsOn: ["withdraw-fee"] }),
    buildCall({ id: "deposits-enabled", description: "Set deposit operation status", chainId: runtime.chainId, target: liquidity, abi: LIQUIDITY_ABI, method: "setDepositsEnabled", args: [policy.depositsEnabled], dependsOn: ["withdraw-limits"] }),
    buildCall({ id: "withdraws-enabled", description: "Set withdraw operation status", chainId: runtime.chainId, target: liquidity, abi: LIQUIDITY_ABI, method: "setWithdrawsEnabled", args: [policy.withdrawsEnabled], dependsOn: ["deposits-enabled"] }),
    buildCall({ id: "swap-limits", description: `Set ${policy.swapTokenCode} swap amount limits`, chainId: runtime.chainId, target: swap, abi: SWAP_MANAGER_ABI, method: "setSwapLimits", args: [policy.swapTokenCode, policy.minSwapAmount, policy.maxSwapAmount], dependsOn: ["withdraws-enabled"] }),
    buildCall({ id: "swap-slippage", description: "Set maximum swap slippage", chainId: runtime.chainId, target: swap, abi: SWAP_MANAGER_ABI, method: "setMaxSlippage", args: [policy.maxSlippageBps], dependsOn: ["swap-limits"] }),
    buildCall({ id: "swaps-enabled", description: "Set swap operation status", chainId: runtime.chainId, target: swap, abi: SWAP_MANAGER_ABI, method: "setSwapsEnabled", args: [policy.swapsEnabled], dependsOn: ["swap-slippage"] }),
    buildCall({ id: "deposit-rate", description: "Set deposit rate limits", chainId: runtime.chainId, target: proxy, abi: PROXY_ABI, method: "setRateLimit", args: ["deposit", policy.depositRatePerUser, policy.depositRateGlobal], dependsOn: ["swaps-enabled"] }),
    buildCall({ id: "withdraw-rate", description: "Set withdraw rate limits", chainId: runtime.chainId, target: proxy, abi: PROXY_ABI, method: "setRateLimit", args: ["withdraw", policy.withdrawRatePerUser, policy.withdrawRateGlobal], dependsOn: ["deposit-rate"] }),
  ];
  return executePlan(runtime, buildPlan("core.configure-policy", runtime.chainId, calls, ["Review all limits in base-asset atomic units before execution."]));
}
