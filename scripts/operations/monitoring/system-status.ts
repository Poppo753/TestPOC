import { contractAddress } from "../../framework/manifest";
import { readContract } from "../../framework/contracts";
import { assertAllowedChain, assertContract } from "../../framework/preflight";
import { BEACON_ABI, LIQUIDITY_ABI, PROTOCOL_MANAGER_ABI, PROXY_ABI } from "../../framework/abis";
import type { Address, ScriptRuntime } from "../../framework/types";

export interface SystemStatus {
  chainId: number;
  network: string;
  blockNumber: number;
  modules: Record<string, { address: Address; hasCode: boolean }>;
  pool: { totalSupply: string; totalValue?: string; lpPrice?: string };
  operations: { paused: boolean; depositsEnabled: boolean; withdrawsEnabled: boolean };
  protocols: { names: string[]; activeCount: string; totalValue: string; globalHealthFactor: string };
}

export async function getSystemStatus(runtime: ScriptRuntime): Promise<SystemStatus> {
  assertAllowedChain(runtime);
  const beacon = await assertContract(runtime, contractAddress(runtime.manifest, "beacon"), "Beacon");
  const proxy = await assertContract(runtime, contractAddress(runtime.manifest, "proxyGeneral"), "ProxyGeneral");
  const liquidity = await assertContract(runtime, contractAddress(runtime.manifest, "liquidityManager"), "LiquidityManager");
  const protocolManager = await assertContract(runtime, contractAddress(runtime.manifest, "protocolManager"), "ProtocolManager");
  const moduleNames = (await readContract(runtime, beacon, BEACON_ABI, "getRegisteredModules"))[0] as string[];
  const modules: SystemStatus["modules"] = {};
  for (const name of moduleNames) {
    const address = (await readContract(runtime, beacon, BEACON_ABI, "getImplementation", [name]))[0] as Address;
    modules[name] = { address, hasCode: (await runtime.provider.getCode(address)) !== "0x" };
  }
  const totalSupply = (await readContract(runtime, proxy, PROXY_ABI, "totalSupply"))[0] as bigint;
  const paused = (await readContract(runtime, proxy, PROXY_ABI, "isPaused"))[0] as boolean;
  const depositsEnabled = (await readContract(runtime, liquidity, LIQUIDITY_ABI, "depositsEnabled"))[0] as boolean;
  const withdrawsEnabled = (await readContract(runtime, liquidity, LIQUIDITY_ABI, "withdrawsEnabled"))[0] as boolean;
  const names = (await readContract(runtime, protocolManager, PROTOCOL_MANAGER_ABI, "getAllProtocolNames"))[0] as string[];
  const activeCount = (await readContract(runtime, protocolManager, PROTOCOL_MANAGER_ABI, "getActiveProtocolCount"))[0] as bigint;
  const totalValue = (await readContract(runtime, protocolManager, PROTOCOL_MANAGER_ABI, "getAllProtocolsValue"))[0] as bigint;
  const globalHealthFactor = (await readContract(runtime, protocolManager, PROTOCOL_MANAGER_ABI, "getGlobalHealthFactor"))[0] as bigint;
  let poolValue: bigint | undefined;
  const valueCalculator = runtime.manifest.contracts.valueCalculator;
  if (valueCalculator) {
    poolValue = (await readContract(runtime, valueCalculator, ["function getTotalPoolValueView() view returns (uint256)"], "getTotalPoolValueView"))[0] as bigint;
  }
  return {
    chainId: runtime.chainId,
    network: runtime.networkName,
    blockNumber: await runtime.provider.getBlockNumber(),
    modules,
    pool: {
      totalSupply: totalSupply.toString(),
      totalValue: poolValue?.toString(),
      lpPrice: poolValue !== undefined && totalSupply > 0n ? ((poolValue * 10n ** 18n) / totalSupply).toString() : undefined,
    },
    operations: { paused, depositsEnabled, withdrawsEnabled },
    protocols: { names, activeCount: activeCount.toString(), totalValue: totalValue.toString(), globalHealthFactor: globalHealthFactor.toString() },
  };
}

