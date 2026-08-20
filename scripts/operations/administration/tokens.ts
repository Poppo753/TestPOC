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

export interface OracleFeedConfiguration {
  code: string;
  feed: string;
  feedDecimals: number;
  heartbeat: bigint;
  quoteCurrency?: string;
}

const CHAINLINK_ADAPTER_ABI = [
  "function owner() view returns (address)",
  "function setPriceFeed(string,address,uint8,uint256,string)",
] as const;

/**
 * Configures the price source independently from TokenManager metadata.
 *
 * These are deliberately two separate operations: TokenManager describes the
 * ERC-20 while ChainlinkAdapter describes how that asset is valued. A POC that
 * registers WETH only in TokenManager would deploy successfully but later fail
 * health/value calculations as soon as a Morpho WETH/USDC position is read.
 */
export async function configureOracleFeed(runtime: ScriptRuntime, feed: OracleFeedConfiguration): Promise<OperationResult<undefined>> {
  if (!feed.code || feed.code.length > 16) throw new Error("Token code must contain 1-16 characters");
  if (!Number.isInteger(feed.feedDecimals) || feed.feedDecimals < 1 || feed.feedDecimals > 18) throw new Error("Invalid feed decimals");
  assertPositive(feed.heartbeat, "heartbeat");
  await assertContract(runtime, feed.feed, `${feed.code} price feed`);
  const adapter = contractAddress(runtime.manifest, "chainlinkAdapter");
  if (!runtime.options.encodeOnly) await assertOwner(runtime, adapter);
  const call = buildCall({ id: "configure-oracle-feed", description: `Configure ${feed.code} price feed`,
    chainId: runtime.chainId, target: adapter, abi: CHAINLINK_ADAPTER_ABI,
    method: "setPriceFeed", args: [feed.code, feed.feed, feed.feedDecimals, feed.heartbeat, feed.quoteCurrency ?? "USD"] });
  return executePlan(runtime, buildPlan("oracle.configure-feed", runtime.chainId, [call]));
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
