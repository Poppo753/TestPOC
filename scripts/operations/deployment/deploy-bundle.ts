import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { getAddress, isAddress } from "ethers";
import { ConfigurationError } from "../../framework/errors";
import type { Address, DeploymentManifest, ProtocolManifest } from "../../framework/types";
import { CheckpointDeployer } from "./deployer";

export type SupportedBundle = "uniswap-v3" | "aave" | "euler" | "morpho" | "morpho-vault";

export interface BundleDeploymentInput {
  kind: SupportedBundle | "dolomite" | "gmx";
  manifest: DeploymentManifest;
  manifestPath: string;
  execute: boolean;
  confirmations?: number;
  addresses: Record<string, Address>;
}

const BEACON_ABI = ["function owner() view returns(address)", "function checkModuleExists(string) view returns(bool)", "function getImplementation(string) view returns(address)", "function updateImplementation(string,address)"] as const;
const PROXY_ABI = ["function owner() view returns(address)", "function isAuthorizedModule(address) view returns(bool)", "function authorizeModule(address,string)"] as const;
const PM_ABI = ["function owner() view returns(address)", "function getProtocolInfo(string) view returns(address plugin,address lensAdapter,address registry,bool isActive,uint256 registeredAt)", "function registerProtocol(string,address,address,address)"] as const;

async function registerBeacon(d: CheckpointDeployer, moduleName: string, address: Address): Promise<void> {
  const beacon = d.contract(d.manifest.contracts.beacon, BEACON_ABI);
  const exists = Boolean(await beacon.getFunction("checkModuleExists").staticCall(moduleName));
  const current = exists ? String(await beacon.getFunction("getImplementation").staticCall(moduleName)).toLowerCase() : "";
  if (current !== address.toLowerCase()) await d.send(`beacon:${moduleName}`, beacon, "updateImplementation", [moduleName, address]);
}

async function authorizeProxy(d: CheckpointDeployer, label: string, address: Address): Promise<void> {
  const proxy = d.contract(d.manifest.contracts.proxyGeneral, PROXY_ABI);
  if (!Boolean(await proxy.getFunction("isAuthorizedModule").staticCall(address))) {
    await d.send(`proxy:authorize:${label}`, proxy, "authorizeModule", [address, label]);
  }
}

async function registerProtocol(d: CheckpointDeployer, name: string, protocol: ProtocolManifest): Promise<void> {
  const manager = d.contract(d.manifest.contracts.protocolManager, PM_ABI);
  let registered = false;
  try {
    const info = await manager.getFunction("getProtocolInfo").staticCall(name);
    registered = String(info[0]).toLowerCase() === protocol.plugin.toLowerCase();
  } catch { /* an unknown protocol is expected to revert */ }
  if (!registered) await d.send(`protocolManager:register:${name}`, manager, "registerProtocol", [name, protocol.plugin, protocol.lensAdapter, protocol.registry ?? "0x0000000000000000000000000000000000000000"]);
  d.manifest.protocols[name] = protocol;
  d.checkpoint();
}

/** Deploys only supported, current protocol bundles. Registry data is configured separately before ownership transfer. */
export async function deployBundle(hre: HardhatRuntimeEnvironment, input: BundleDeploymentInput): Promise<DeploymentManifest> {
  if (input.kind === "dolomite" || input.kind === "gmx") throw new ConfigurationError(`${input.kind} is intentionally unsupported: the plugin is unfinished`);
  if (!["uniswap-v3", "aave", "euler", "morpho", "morpho-vault"].includes(input.kind)) throw new ConfigurationError(`Unknown bundle kind: ${String(input.kind)}`);
  if (!input.execute) throw new ConfigurationError("Bundle deployment requires EXECUTE=true");
  const network = await hre.ethers.provider.getNetwork();
  if (input.manifest.chainId !== Number(network.chainId)) throw new ConfigurationError("Manifest and provider chain IDs differ");
  for (const key of ["beacon", "proxyGeneral", "protocolManager"] as const) {
    const address = input.manifest.contracts[key];
    if (!address || await hre.ethers.provider.getCode(address) === "0x") throw new ConfigurationError(`Core contract ${key} is missing or has no bytecode`);
  }
  const external = async (key: string): Promise<Address> => {
    const value = input.addresses[key];
    if (!value || !isAddress(value)) throw new ConfigurationError(`Missing or invalid external address: ${key}`);
    const normalized = getAddress(value) as Address;
    if (await hre.ethers.provider.getCode(normalized) === "0x") throw new ConfigurationError(`External dependency ${key} has no bytecode`);
    return normalized;
  };
  const [signer] = await hre.ethers.getSigners();
  if (!signer) throw new ConfigurationError("No deployment signer is configured");
  const d = new CheckpointDeployer(hre, input.manifest, input.manifestPath, input.confirmations ?? 1, signer);
  const beacon = input.manifest.contracts.beacon;
  const baseCode = input.manifest.baseAsset.code;

  if (input.kind === "uniswap-v3") {
    const plugin = await d.deploy("uniswapV3PluginDirect", "UniswapV3PluginDirect", [await external("router"), await external("quoterV2"), input.manifest.contracts.proxyGeneral]);
    await registerBeacon(d, "UniswapV3PluginDirect", plugin);
    await authorizeProxy(d, "UniswapV3PluginDirect", plugin);
    return d.manifest;
  }

  let name: string;
  let protocol: ProtocolManifest;
  if (input.kind === "aave") {
    const registry = await d.deploy("aaveV3Registry", "AaveV3Registry");
    const pool = await external("pool");
    const plugin = await d.deploy("aaveV3Plugin", "AaveV3Plugin", [beacon, baseCode, pool]);
    const lens = await d.deploy("aaveV3LensAdapter", "AaveV3LensAdapter", [beacon, baseCode, pool]);
    await registerBeacon(d, "AaveV3Registry", registry); await registerBeacon(d, "AaveV3Plugin", plugin); await registerBeacon(d, "AaveV3LensAdapter", lens);
    await authorizeProxy(d, "AaveV3Plugin", plugin);
    name = "AaveV3"; protocol = { plugin, lensAdapter: lens, registry, active: true, kind: "aave" };
  } else if (input.kind === "euler") {
    const registry = await d.deploy("eulerRegistry", "EulerRegistry");
    const evc = await external("evc"); const accountLens = await external("accountLens"); const vaultLens = await external("vaultLens"); const utilsLens = await external("utilsLens");
    const plugin = await d.deploy("eulerV2Plugin", "EulerV2Plugin", [beacon, baseCode, evc, accountLens]);
    const lens = await d.deploy("eulerLensAdapter", "EulerLensAdapter", [beacon, baseCode, accountLens, vaultLens, utilsLens, evc]);
    await registerBeacon(d, "EulerRegistry", registry); await registerBeacon(d, "EulerV2Plugin", plugin); await registerBeacon(d, "EulerLensAdapter", lens);
    await authorizeProxy(d, "EulerV2Plugin", plugin);
    name = "EulerV2"; protocol = { plugin, lensAdapter: lens, registry, active: true, kind: "euler" };
  } else if (input.kind === "morpho") {
    const registry = await d.deploy("morphoRegistry", "MorphoRegistry");
    const morpho = await external("morpho");
    const plugin = await d.deploy("morphoPlugin", "MorphoPlugin", [beacon, baseCode, morpho]);
    const lens = await d.deploy("morphoLensAdapter", "MorphoLensAdapter", [beacon, baseCode, morpho]);
    await registerBeacon(d, "MorphoRegistry", registry); await registerBeacon(d, "MorphoPlugin", plugin); await registerBeacon(d, "MorphoLensAdapter", lens);
    await authorizeProxy(d, "MorphoPlugin", plugin);
    name = "Morpho"; protocol = { plugin, lensAdapter: lens, registry, active: true, kind: "morpho" };
  } else {
    const registry = input.manifest.contracts.morphoRegistry ?? await d.deploy("morphoRegistry", "MorphoRegistry");
    const plugin = await d.deploy("morphoVaultPlugin", "MorphoVaultPlugin", [beacon]);
    const lens = await d.deploy("morphoVaultLensAdapter", "MorphoVaultLensAdapter", [beacon, baseCode]);
    await registerBeacon(d, "MorphoRegistry", registry); await registerBeacon(d, "MorphoVaultPlugin", plugin); await registerBeacon(d, "MorphoVaultLensAdapter", lens);
    await authorizeProxy(d, "MorphoVaultPlugin", plugin);
    name = "MorphoVault"; protocol = { plugin, lensAdapter: lens, registry, active: true, kind: "morpho-vault" };
  }
  await registerProtocol(d, name, protocol);
  return d.manifest;
}
