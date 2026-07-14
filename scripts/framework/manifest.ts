import fs from "fs";
import path from "path";
import { getAddress, isAddress } from "ethers";
import { ConfigurationError } from "./errors";
import type { Address, DeploymentManifest, ProtocolManifest } from "./types";

interface LegacyDeployment {
  network?: string;
  chainId?: number;
  timestamp?: string;
  deployer?: string;
  contracts?: Record<string, string>;
  [key: string]: unknown;
}

const LEGACY_PROTOCOLS: Record<string, { plugin: string; lens: string; registry?: string; kind: ProtocolManifest["kind"] }> = {
  AaveV3: { plugin: "AaveV3Plugin", lens: "AaveV3LensAdapter", registry: "AaveV3Registry", kind: "aave" },
  EulerV2: { plugin: "EulerV2Plugin", lens: "EulerLensAdapter", registry: "EulerRegistry", kind: "euler" },
  Morpho: { plugin: "MorphoPlugin", lens: "MorphoLensAdapter", registry: "MorphoRegistry", kind: "morpho" },
  MorphoVault: { plugin: "MorphoVaultPlugin", lens: "MorphoVaultLensAdapter", registry: "MorphoRegistry", kind: "morpho-vault" },
};

function addressOrUndefined(value: unknown): Address | undefined {
  if (typeof value !== "string" || !isAddress(value)) return undefined;
  return getAddress(value) as Address;
}

function legacyTopLevelAddress(source: LegacyDeployment, key: string): Address | undefined {
  const section = source[key];
  if (typeof section !== "object" || section === null) return undefined;
  return addressOrUndefined((section as Record<string, unknown>).address);
}

export function emptyManifest(input: {
  network: string;
  chainId: number;
  baseAssetCode: string;
  baseAssetAddress: string;
  baseAssetDecimals: number;
  deployer?: string;
}): DeploymentManifest {
  const now = new Date().toISOString();
  if (!isAddress(input.baseAssetAddress)) throw new ConfigurationError("Invalid base asset address");
  return {
    schemaVersion: 1,
    network: input.network,
    chainId: input.chainId,
    createdAt: now,
    updatedAt: now,
    deployer: input.deployer && isAddress(input.deployer) ? getAddress(input.deployer) as Address : undefined,
    baseAsset: {
      code: input.baseAssetCode,
      address: getAddress(input.baseAssetAddress) as Address,
      decimals: input.baseAssetDecimals,
    },
    contracts: {},
    protocols: {},
    transactions: {},
    metadata: {},
  };
}

export function normalizeLegacyManifest(source: LegacyDeployment): DeploymentManifest {
  const contracts: Record<string, Address> = {};
  for (const [key, value] of Object.entries(source.contracts ?? {})) {
    const address = addressOrUndefined(value);
    if (address) contracts[key] = address;
  }
  const knownSections = [
    "AaveV3Registry", "AaveV3Plugin", "AaveV3LensAdapter", "EulerRegistry",
    "EulerV2Plugin", "EulerLensAdapter", "FlashLoanService", "MorphoRegistry",
    "MorphoPlugin", "MorphoLensAdapter", "MorphoVaultPlugin", "MorphoVaultLensAdapter",
  ];
  for (const key of knownSections) {
    const address = legacyTopLevelAddress(source, key);
    if (address) contracts[key.charAt(0).toLowerCase() + key.slice(1)] = address;
  }
  const protocols: Record<string, ProtocolManifest> = {};
  for (const [name, map] of Object.entries(LEGACY_PROTOCOLS)) {
    const plugin = contracts[map.plugin.charAt(0).toLowerCase() + map.plugin.slice(1)];
    const lensAdapter = contracts[map.lens.charAt(0).toLowerCase() + map.lens.slice(1)];
    const registry = map.registry ? contracts[map.registry.charAt(0).toLowerCase() + map.registry.slice(1)] : undefined;
    if (plugin && lensAdapter) protocols[name] = { plugin, lensAdapter, registry, active: true, kind: map.kind };
  }
  const baseAddress = contracts.baseAsset ?? contracts.weth ?? "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  const now = new Date().toISOString();
  return validateManifest({
    schemaVersion: 1,
    network: source.network ?? "legacy-unknown",
    chainId: Number(source.chainId ?? 42161),
    createdAt: source.timestamp ?? now,
    updatedAt: now,
    deployer: addressOrUndefined(source.deployer),
    baseAsset: { code: "WETH", address: getAddress(baseAddress) as Address, decimals: 18 },
    contracts,
    protocols,
    transactions: {},
    metadata: { normalizedFromLegacy: true },
  });
}

export function validateManifest(value: DeploymentManifest): DeploymentManifest {
  if (value.schemaVersion !== 1) throw new ConfigurationError("Unsupported manifest schema", { schemaVersion: value.schemaVersion });
  if (!Number.isSafeInteger(value.chainId) || value.chainId <= 0) throw new ConfigurationError("Invalid manifest chainId");
  if (!value.network) throw new ConfigurationError("Manifest network is required");
  if (!isAddress(value.baseAsset.address)) throw new ConfigurationError("Invalid manifest base asset address");
  if (!Number.isInteger(value.baseAsset.decimals) || value.baseAsset.decimals < 0 || value.baseAsset.decimals > 36) {
    throw new ConfigurationError("Invalid base asset decimals");
  }
  const seen = new Map<string, string>();
  for (const [name, address] of Object.entries(value.contracts)) {
    if (!isAddress(address)) throw new ConfigurationError(`Invalid contract address for ${name}`);
    const normalized = address.toLowerCase();
    const previous = seen.get(normalized);
    if (previous && previous !== name) throw new ConfigurationError("Duplicate contract address in manifest", { address, names: [previous, name] });
    seen.set(normalized, name);
  }
  const validKinds = new Set<ProtocolManifest["kind"]>(["aave", "euler", "morpho", "morpho-vault", "uniswap-v3"]);
  for (const [name, protocol] of Object.entries(value.protocols)) {
    if (!name) throw new ConfigurationError("Protocol name cannot be empty");
    if (!isAddress(protocol.plugin) || !isAddress(protocol.lensAdapter) || (protocol.registry !== undefined && !isAddress(protocol.registry))) {
      throw new ConfigurationError(`Invalid protocol address for ${name}`);
    }
    if (!validKinds.has(protocol.kind)) throw new ConfigurationError(`Invalid protocol kind for ${name}`);
  }
  for (const [name, hash] of Object.entries(value.transactions)) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new ConfigurationError(`Invalid transaction hash for ${name}`);
  }
  return value;
}

export function loadManifest(filePath: string): DeploymentManifest {
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as DeploymentManifest | LegacyDeployment;
  return "schemaVersion" in parsed ? validateManifest(parsed as DeploymentManifest) : normalizeLegacyManifest(parsed as LegacyDeployment);
}

export function saveManifest(filePath: string, manifest: DeploymentManifest): void {
  const valid = validateManifest({ ...manifest, updatedAt: new Date().toISOString() });
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, JSON.stringify(valid, null, 2) + "\n", "utf8");
  fs.renameSync(temporary, filePath);
}

export function contractAddress(manifest: DeploymentManifest, name: string): Address {
  const exact = manifest.contracts[name];
  const entry = exact ? [name, exact] : Object.entries(manifest.contracts).find(([key]) => key.toLowerCase() === name.toLowerCase());
  if (!entry) throw new ConfigurationError(`Contract ${name} is missing from manifest`);
  return entry[1] as Address;
}

export function setContract(manifest: DeploymentManifest, name: string, address: string): void {
  if (!isAddress(address)) throw new ConfigurationError(`Invalid address for ${name}`, { address });
  manifest.contracts[name] = getAddress(address) as Address;
  manifest.updatedAt = new Date().toISOString();
}
