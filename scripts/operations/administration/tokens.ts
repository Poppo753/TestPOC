import { TOKEN_MANAGER_ABI } from "../../framework/abis";
import { contractAddress } from "../../framework/manifest";
import { buildCall, buildPlan } from "../../framework/plans";
import { assertContract, assertOwner, assertPositive } from "../../framework/preflight";
import { executePlan } from "../../framework/transactions";
import type { OperationResult, ScriptRuntime } from "../../framework/types";

export interface TokenConfiguration {
  code: string;
  address: string;
  decimals: number;
  heartbeat: bigint;
}

export async function configureToken(runtime: ScriptRuntime, token: TokenConfiguration): Promise<OperationResult<undefined>> {
  if (!token.code || token.code.length > 16) throw new Error("Token code must contain 1-16 characters");
  if (!Number.isInteger(token.decimals) || token.decimals < 0 || token.decimals > 36) throw new Error("Invalid token decimals");
  assertPositive(token.heartbeat, "heartbeat");
  await assertContract(runtime, token.address, `${token.code} token`);
  const manager = contractAddress(runtime.manifest, "tokenManager");
  if (!runtime.options.encodeOnly) await assertOwner(runtime, manager);
  const call = buildCall({ id: "configure-token", description: `Configure token ${token.code}`,
    chainId: runtime.chainId, target: manager, abi: TOKEN_MANAGER_ABI,
    method: "manageTokenData(string,address,uint8,uint256)", args: [token.code, token.address, token.decimals, token.heartbeat] });
  return executePlan(runtime, buildPlan("token.configure", runtime.chainId, [call]));
}

export async function removeToken(runtime: ScriptRuntime, tokenCode: string): Promise<OperationResult<undefined>> {
  const manager = contractAddress(runtime.manifest, "tokenManager");
  if (!runtime.options.encodeOnly) await assertOwner(runtime, manager);
  const call = buildCall({ id: "remove-token", description: `Remove token ${tokenCode}`,
    chainId: runtime.chainId, target: manager, abi: TOKEN_MANAGER_ABI, method: "removeToken", args: [tokenCode] });
  return executePlan(runtime, buildPlan("token.remove", runtime.chainId, [call], ["Removal is state-changing; verify custody balance first."]));
}

