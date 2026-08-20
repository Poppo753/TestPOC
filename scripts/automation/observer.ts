import { readContract } from "../framework/contracts";
import { contractAddress } from "../framework/manifest";
import { ERC20_ABI, PROTOCOL_MANAGER_ABI } from "../framework/abis";
import type { ScriptRuntime } from "../framework/types";
import { getSystemStatus } from "../operations/monitoring/system-status";
import { readProtocolPosition } from "../operations/protocols/positions";
import { hashValue } from "./config";
import type { AutomationConfig, ProtocolObservation, VaultObservation } from "./types";

/** Fingerprint excludes wall-clock time and block numbers; it represents economic state. */
export function observationFingerprint(observation: Omit<VaultObservation, "fingerprint">): string {
  return hashValue({
    vaultId: observation.vaultId,
    chainId: observation.chainId,
    baseAssetCode: observation.baseAssetCode,
    custodyBalance: observation.custodyBalance,
    managedAssets: observation.managedAssets,
    paused: observation.paused,
    depositsEnabled: observation.depositsEnabled,
    withdrawsEnabled: observation.withdrawsEnabled,
    protocols: observation.protocols.map(item => ({ name: item.name, active: item.active, balance: item.balance, debt: item.debt, circuitBreakerActive: item.circuitBreakerActive })),
  });
}

export async function observeVault(runtime: ScriptRuntime, config: AutomationConfig): Promise<VaultObservation> {
  if (runtime.chainId !== config.chainId) throw new Error(`Automation chain ${config.chainId} does not match runtime ${runtime.chainId}`);
  if (runtime.manifest.baseAsset.code !== config.baseAssetCode || runtime.manifest.baseAsset.decimals !== config.baseAssetDecimals) {
    throw new Error("Automation base asset does not match deployment manifest");
  }
  const blockNumberStart = await runtime.provider.getBlockNumber();
  const status = await getSystemStatus(runtime);
  const custody = contractAddress(runtime.manifest, "proxyGeneral");
  const custodyBalance = (await readContract(runtime, runtime.manifest.baseAsset.address, ERC20_ABI, "balanceOf", [custody]))[0] as bigint;
  const protocols: ProtocolObservation[] = [];
  const configuredNames = new Set(config.protocols.map(protocol => protocol.name));
  const manager = contractAddress(runtime.manifest, "protocolManager");
  // Ignoring an active protocol would understate managed assets and corrupt
  // every allocation. A POC config must cover the complete active universe.
  for (const registeredName of status.protocols.names) {
    if (configuredNames.has(registeredName)) continue;
    const info = (await readContract(runtime, manager, PROTOCOL_MANAGER_ABI, "getProtocolInfo", [registeredName]))[0] as { isActive?: boolean } & Record<number, unknown>;
    if (Boolean(info.isActive ?? info[3])) throw new Error(`Active protocol ${registeredName} is missing from automation config`);
  }
  for (const policy of config.protocols) {
    const manifestProtocol = runtime.manifest.protocols[policy.name];
    if (!manifestProtocol) throw new Error(`Protocol ${policy.name} is absent from deployment manifest`);
    // Every active protocol must remain visible in the observation, including
    // protocols which this supply-only controller must never fund. A disabled
    // policy with targetBps=0 is therefore a monitoring/exit-only entry: it is
    // included in managed assets and can be withdrawn if a balance appears,
    // while the strategy can never create a deposit for it. This is required
    // for the collateral-oriented Morpho market in the USDC POC.
    if (policy.enabled && !(["aave", "euler", "morpho-vault"] as string[]).includes(manifestProtocol.kind)) {
      throw new Error(`Protocol ${policy.name} kind ${manifestProtocol.kind} is unsupported by the supply-only automation POC`);
    }
    let position;
    if (manifestProtocol.kind === "morpho") {
      if (policy.enabled || !policy.collateralTokenCode || !policy.loanTokenCode) {
        throw new Error(`Morpho ${policy.name} must be disabled and configure collateralTokenCode/loanTokenCode for monitor-only operation`);
      }
      const collateral = (await readContract(runtime, manifestProtocol.plugin,
        ["function getBalance(string) view returns (uint256)"], "getBalance", [policy.collateralTokenCode]))[0] as bigint;
      const debt = (await readContract(runtime, manifestProtocol.plugin,
        ["function getDebt(string,string) view returns (uint256)"], "getDebt", [policy.collateralTokenCode, policy.loanTokenCode]))[0] as bigint;
      if (collateral !== 0n || debt !== 0n) {
        throw new Error(`Monitor-only protocol ${policy.name} has a non-zero ${policy.collateralTokenCode}/${policy.loanTokenCode} position; manual review is required`);
      }
      // A zero-only sentinel is deliberately not added to managedAssets: raw
      // collateral units cannot be combined with base-asset units without a
      // trusted normalized oracle. A non-zero position is rejected above.
      position = { protocolName: policy.name, tokenCode: policy.collateralTokenCode, balance: "0", debt: "0",
        healthFactor: ((1n << 256n) - 1n).toString() };
    } else if (manifestProtocol.kind === "inter-vault") {
      // InterVault can hold several child tokens. Reading getBalance() with
      // only the parent base code would omit every non-base child and corrupt
      // managedAssets. The Lens is the single normalized valuation boundary.
      // InterVault remains monitor-only until the skip-on-Lens-error gate is
      // closed, but all of its value must still be visible to the observer.
      const balance = (await readContract(runtime, manifestProtocol.lensAdapter,
        ["function getTotalValue() view returns (uint256)"], "getTotalValue"))[0] as bigint;
      position = {
        protocolName: policy.name,
        tokenCode: config.baseAssetCode,
        balance: balance.toString(),
        debt: "0",
        healthFactor: ((1n << 256n) - 1n).toString(),
      };
    } else {
      position = await readProtocolPosition(runtime, policy.name, config.baseAssetCode);
    }
    const protocolInfo = (await readContract(runtime, manager, PROTOCOL_MANAGER_ABI, "getProtocolInfo", [policy.name]))[0] as { isActive?: boolean } & Record<number, unknown>;
    let circuitBreakerActive: boolean | undefined;
    let netApy: string | undefined;
    try { circuitBreakerActive = (await readContract(runtime, manifestProtocol.plugin, ["function circuitBreakerTripped() view returns (bool)"], "circuitBreakerTripped"))[0] as boolean; } catch { /* Missing telemetry is represented explicitly and handled by risk policy. */ }
    try { netApy = String((await readContract(runtime, manifestProtocol.lensAdapter, ["function getNetAPY() view returns (int256)"], "getNetAPY"))[0]); } catch { /* APY is optional telemetry in the deterministic POC. */ }
    protocols.push({
      name: policy.name,
      active: Boolean(protocolInfo.isActive ?? protocolInfo[3] ?? manifestProtocol.active),
      balance: position.balance,
      debt: position.debt,
      healthFactor: position.healthFactor,
      circuitBreakerActive,
      netApy,
      allocationBps: 0,
    });
  }
  const managedAssets = custodyBalance + protocols.reduce((total, protocol) => total + BigInt(protocol.balance), 0n);
  for (const protocol of protocols) protocol.allocationBps = managedAssets === 0n ? 0 : Number(BigInt(protocol.balance) * 10_000n / managedAssets);
  const blockNumberEnd = await runtime.provider.getBlockNumber();
  if (blockNumberEnd - blockNumberStart > config.policy.maxObservationBlockSpan) {
    throw new Error(`Observation crossed ${blockNumberEnd - blockNumberStart} blocks; maximum is ${config.policy.maxObservationBlockSpan}`);
  }
  const withoutFingerprint: Omit<VaultObservation, "fingerprint"> = {
    vaultId: config.vaultId,
    chainId: runtime.chainId,
    blockNumberStart,
    blockNumberEnd,
    observedAt: new Date().toISOString(),
    baseAssetCode: config.baseAssetCode,
    custodyBalance: custodyBalance.toString(),
    managedAssets: managedAssets.toString(),
    reserveBps: managedAssets === 0n ? 10_000 : Number(custodyBalance * 10_000n / managedAssets),
    paused: status.operations.paused,
    depositsEnabled: status.operations.depositsEnabled,
    withdrawsEnabled: status.operations.withdrawsEnabled,
    globalHealthFactor: status.protocols.globalHealthFactor,
    oracleDataAvailable: false,
    protocols,
  };
  return { ...withoutFingerprint, fingerprint: observationFingerprint(withoutFingerprint) };
}
