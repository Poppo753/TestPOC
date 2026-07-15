import fs from "fs";
import path from "path";
import { getAddress, Interface, ZeroAddress } from "ethers";
import type { ScriptRuntime } from "../framework/types";
import type { AutomationConfig } from "./types";
import { createSafeApiKit } from "./safe";

export type PreflightCheckStatus = "PASS" | "WARNING" | "FAIL";
export interface AutomationPreflightCheck { id: string; status: PreflightCheckStatus; message: string; context?: Record<string, unknown>; }
export interface AutomationPreflightReport {
  vaultId: string;
  chainId: number;
  checkedAt: string;
  ready: boolean;
  checks: AutomationPreflightCheck[];
}

const OWNER_ABI = new Interface(["function owner() view returns (address)"]);
const PROTOCOL_ABI = new Interface(["function getProtocolInfo(string) view returns (tuple(address plugin,address lensAdapter,address registry,bool isActive,uint256 registeredAt))"]);
const INTER_VAULT_REGISTRY_ABI = new Interface([
  "function getPositionHolder() view returns (address)",
  "function getChildCount() view returns (uint256)",
]);
const INTER_VAULT_LENS_ABI = new Interface(["function getTotalValue() view returns (uint256)"]);
const SUPPORTED_KINDS = new Set(["aave", "euler", "morpho-vault"]);

/**
 * Full bootstrap check for one control file. Every failure is accumulated so
 * an operator receives one actionable report instead of fixing one item per
 * invocation. Context is deliberately limited to public addresses and labels.
 */
export async function runAutomationPreflight(runtime: ScriptRuntime, config: AutomationConfig, env: NodeJS.ProcessEnv = process.env): Promise<AutomationPreflightReport> {
  const checks: AutomationPreflightCheck[] = [];
  const pass = (id: string, message: string, context?: Record<string, unknown>) => checks.push({ id, status: "PASS" as const, message, context });
  const fail = (id: string, message: string, context?: Record<string, unknown>) => checks.push({ id, status: "FAIL" as const, message, context });
  const warning = (id: string, message: string, context?: Record<string, unknown>) => checks.push({ id, status: "WARNING" as const, message, context });

  try {
    const blockNumber = await runtime.provider.getBlockNumber();
    pass("PROVIDER_REACHABLE", "Provider returned a block number", { blockNumber });
  } catch (error) { fail("PROVIDER_UNREACHABLE", "Provider did not return a block number", { error: error instanceof Error ? error.message : String(error) }); }

  if (runtime.chainId === config.chainId && runtime.manifest.chainId === config.chainId) pass("CHAIN_MATCH", "Config, manifest and provider chain IDs match", { chainId: config.chainId });
  else fail("CHAIN_MISMATCH", "Config, manifest and provider chain IDs differ", { config: config.chainId, manifest: runtime.manifest.chainId, provider: runtime.chainId });

  if (runtime.manifest.baseAsset.code === config.baseAssetCode && runtime.manifest.baseAsset.decimals === config.baseAssetDecimals) {
    pass("BASE_ASSET_MATCH", "Config and manifest base asset metadata match", { code: config.baseAssetCode, decimals: config.baseAssetDecimals });
  } else fail("BASE_ASSET_MISMATCH", "Config and manifest base asset metadata differ");

  const codeCheck = async (id: string, label: string, address: string | undefined): Promise<void> => {
    if (!address) { fail(id, `${label} is missing from manifest`); return; }
    try {
      const code = await runtime.provider.getCode(address);
      if (code === "0x") fail(id, `${label} has no bytecode`, { address });
      else pass(id, `${label} bytecode is present`, { address });
    } catch (error) { fail(id, `${label} bytecode check failed`, { address, error: error instanceof Error ? error.message : String(error) }); }
  };

  await codeCheck("BASE_ASSET_CODE", `Base asset ${config.baseAssetCode}`, runtime.manifest.baseAsset.address);
  for (const name of ["proxyGeneral", "liquidityManager", "protocolManager", "valueCalculator"] as const) {
    await codeCheck(`CORE_${name.toUpperCase()}`, `Core contract ${name}`, runtime.manifest.contracts[name]);
  }
  for (const policy of config.protocols) {
    const protocol = runtime.manifest.protocols[policy.name];
    if (!protocol) { fail(`PROTOCOL_${policy.name}`, `Configured protocol ${policy.name} is missing from manifest`); continue; }
    if (!protocol.active) fail(`PROTOCOL_${policy.name}_ACTIVE`, `Configured protocol ${policy.name} is inactive in manifest`);
    else pass(`PROTOCOL_${policy.name}_ACTIVE`, `Protocol ${policy.name} is active in manifest`);
    if (!SUPPORTED_KINDS.has(protocol.kind) && policy.enabled) fail(`PROTOCOL_${policy.name}_KIND`, `Protocol kind ${protocol.kind} is unsupported by supply-only automation`);
    else if (!SUPPORTED_KINDS.has(protocol.kind)) pass(`PROTOCOL_${policy.name}_KIND`, `Protocol ${policy.name} is monitor-only and cannot receive allocations`, { kind: protocol.kind });
    else pass(`PROTOCOL_${policy.name}_KIND`, `Protocol ${policy.name} kind is supported`, { kind: protocol.kind });
    await codeCheck(`PROTOCOL_${policy.name}_PLUGIN`, `${policy.name} plugin`, protocol.plugin);
    await codeCheck(`PROTOCOL_${policy.name}_LENS`, `${policy.name} lens`, protocol.lensAdapter);
    if (protocol.registry) await codeCheck(`PROTOCOL_${policy.name}_REGISTRY`, `${policy.name} registry`, protocol.registry);
    else warning(`PROTOCOL_${policy.name}_REGISTRY`, `${policy.name} has no registry address in manifest`);
    if (protocol.kind === "inter-vault" && protocol.registry) {
      try {
        const holderRaw = await runtime.provider.call({ to: protocol.registry, data: INTER_VAULT_REGISTRY_ABI.encodeFunctionData("getPositionHolder") });
        const holder = getAddress(String(INTER_VAULT_REGISTRY_ABI.decodeFunctionResult("getPositionHolder", holderRaw)[0]));
        if (holder !== getAddress(protocol.plugin)) fail(`PROTOCOL_${policy.name}_HOLDER`, "InterVault Registry position holder differs from Plugin", { holder, plugin: protocol.plugin });
        else pass(`PROTOCOL_${policy.name}_HOLDER`, "InterVault Registry position holder matches Plugin");
        const countRaw = await runtime.provider.call({ to: protocol.registry, data: INTER_VAULT_REGISTRY_ABI.encodeFunctionData("getChildCount") });
        const count = BigInt(INTER_VAULT_REGISTRY_ABI.decodeFunctionResult("getChildCount", countRaw)[0]);
        if (count === 0n) warning(`PROTOCOL_${policy.name}_CHILDREN`, "InterVault has no canonical child registered");
        else pass(`PROTOCOL_${policy.name}_CHILDREN`, "InterVault canonical children are registered", { count: count.toString() });
        const valueRaw = await runtime.provider.call({ to: protocol.lensAdapter, data: INTER_VAULT_LENS_ABI.encodeFunctionData("getTotalValue") });
        const value = BigInt(INTER_VAULT_LENS_ABI.decodeFunctionResult("getTotalValue", valueRaw)[0]);
        pass(`PROTOCOL_${policy.name}_VALUATION`, "InterVault Lens valuation completed without fallback", { value: value.toString() });
      } catch (error) {
        fail(`PROTOCOL_${policy.name}_INTEGRITY`, "InterVault Registry/Lens integrity check failed", { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  const manager = runtime.manifest.contracts.protocolManager;
  let managerOwner: string | undefined;
  if (manager) {
    try {
      const raw = await runtime.provider.call({ to: manager, data: OWNER_ABI.encodeFunctionData("owner") });
      managerOwner = getAddress(String(OWNER_ABI.decodeFunctionResult("owner", raw)[0]));
      pass("PROTOCOL_MANAGER_OWNER_READ", "ProtocolManager owner was read", { owner: managerOwner });
    } catch (error) { fail("PROTOCOL_MANAGER_OWNER_READ", "Could not read ProtocolManager owner", { error: error instanceof Error ? error.message : String(error) }); }
    for (const policy of config.protocols) {
      const expected = runtime.manifest.protocols[policy.name];
      if (!expected) continue;
      try {
        const raw = await runtime.provider.call({ to: manager, data: PROTOCOL_ABI.encodeFunctionData("getProtocolInfo", [policy.name]) });
        const info = PROTOCOL_ABI.decodeFunctionResult("getProtocolInfo", raw)[0] as { plugin: string; lensAdapter: string; registry: string; isActive: boolean };
        const sameAddresses = getAddress(info.plugin) === getAddress(expected.plugin)
          && getAddress(info.lensAdapter) === getAddress(expected.lensAdapter)
          && getAddress(info.registry) === getAddress(expected.registry ?? ZeroAddress);
        if (!sameAddresses || !info.isActive) fail(`PROTOCOL_${policy.name}_ONCHAIN`, `ProtocolManager registration for ${policy.name} differs from manifest or is inactive`);
        else pass(`PROTOCOL_${policy.name}_ONCHAIN`, `ProtocolManager registration for ${policy.name} matches manifest`);
      } catch (error) { fail(`PROTOCOL_${policy.name}_ONCHAIN`, `Could not verify ProtocolManager registration for ${policy.name}`, { error: error instanceof Error ? error.message : String(error) }); }
    }
  }

  if (config.execution.kind === "direct") {
    const expected = config.execution.expectedSignerAddress as string;
    if (!runtime.signerAddress) fail("DIRECT_SIGNER_PRESENT", "Direct execution requires a runtime signer");
    else if (runtime.signerAddress.toLowerCase() !== expected.toLowerCase()) fail("DIRECT_SIGNER_MATCH", "Runtime signer differs from expected signer", { expected, actual: runtime.signerAddress });
    else pass("DIRECT_SIGNER_MATCH", "Runtime signer matches expected signer", { signer: runtime.signerAddress });
    if (managerOwner && managerOwner.toLowerCase() !== expected.toLowerCase()) fail("DIRECT_OWNER_MATCH", "Expected direct signer is not ProtocolManager owner", { expected, owner: managerOwner });
    else if (managerOwner) pass("DIRECT_OWNER_MATCH", "Direct signer is ProtocolManager owner");
    if (runtime.signerAddress) {
      const balance = await runtime.provider.getBalance(runtime.signerAddress);
      if (balance === 0n) fail("DIRECT_GAS_BALANCE", "Direct signer has zero native balance", { signer: runtime.signerAddress });
      else pass("DIRECT_GAS_BALANCE", "Direct signer has native gas balance", { balance: balance.toString() });
    }
  } else if (config.execution.kind === "safe" && config.safe) {
    await codeCheck("SAFE_BYTECODE", "Configured Safe", config.safe.address);
    if (managerOwner && managerOwner.toLowerCase() !== config.safe.address.toLowerCase()) fail("SAFE_OWNER_MATCH", "Configured Safe is not ProtocolManager owner", { safe: config.safe.address, owner: managerOwner });
    else if (managerOwner) pass("SAFE_OWNER_MATCH", "Configured Safe is ProtocolManager owner");
    if (config.safe.apiKeyEnv && !env[config.safe.apiKeyEnv]) fail("SAFE_API_KEY", `Environment variable ${config.safe.apiKeyEnv} is missing`);
    else if (config.safe.apiKeyEnv) pass("SAFE_API_KEY", "Safe API key environment variable is present");
    else warning("SAFE_API_KEY", "No Safe API key is configured; a custom Transaction Service must accept unauthenticated requests");
    if (!config.safe.apiKeyEnv || env[config.safe.apiKeyEnv]) {
      try {
        const service = await createSafeApiKit(config, env).getServiceInfo();
        pass("SAFE_SERVICE_REACHABLE", "Safe Transaction Service is reachable", { name: service.name, version: service.version });
      } catch (error) { fail("SAFE_SERVICE_REACHABLE", "Safe Transaction Service is unreachable", { error: error instanceof Error ? error.message : String(error) }); }
    }
  } else pass("EXECUTION_DISABLED", "Persistent execution is disabled by the control file");

  const writable = (id: string, target: string): void => {
    try {
      const directory = path.extname(target) ? path.dirname(target) : target;
      fs.mkdirSync(directory, { recursive: true });
      const probe = path.join(directory, `.automation-write-probe-${process.pid}-${Date.now()}`);
      fs.writeFileSync(probe, "probe", { flag: "wx" }); fs.unlinkSync(probe);
      pass(id, "Directory is writable", { directory });
    } catch (error) { fail(id, "Directory is not writable", { error: error instanceof Error ? error.message : String(error) }); }
  };
  writable("STATE_DIRECTORY_WRITABLE", config.runtime.stateDirectory);
  writable("HEARTBEAT_DIRECTORY_WRITABLE", config.runtime.heartbeatPath);

  return { vaultId: config.vaultId, chainId: config.chainId, checkedAt: new Date().toISOString(), ready: !checks.some(item => item.status === "FAIL"), checks };
}
