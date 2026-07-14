import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { ConfigurationError } from "../../framework/errors";
import { emptyManifest } from "../../framework/manifest";
import type { Address, DeploymentManifest } from "../../framework/types";
import { CheckpointDeployer } from "./deployer";

const BEACON_ABI = [
  "function owner() view returns (address)",
  "function checkModuleExists(string) view returns (bool)",
  "function getImplementation(string) view returns (address)",
  "function updateImplementation(string,address)",
] as const;
const PROXY_ABI = [
  "function owner() view returns (address)",
  "function isAuthorizedModule(address) view returns (bool)",
  "function authorizeModule(address,string)",
] as const;
const TOKEN_MANAGER_ABI = [
  "function owner() view returns (address)",
  "function setBaseAssetCode(string)",
] as const;
const CHAINLINK_ABI = [
  "function owner() view returns (address)",
  "function supportsToken(string) view returns (bool)",
  "function setPriceFeed(string,address,uint8,uint256,string)",
] as const;

export interface CoreDeploymentInput {
  manifestPath: string;
  manifest?: DeploymentManifest;
  baseAssetCode: string;
  baseAssetAddress: Address;
  baseAssetDecimals: number;
  basePriceFeed: Address;
  basePriceFeedDecimals: number;
  basePriceHeartbeat: number;
  quoteCurrency?: string;
  execute: boolean;
  confirmations?: number;
}

const CORE_MODULES = [
  ["proxyGeneral", "ProxyGeneral"],
  ["chainlinkAdapter", "ChainlinkAdapter"],
  ["tokenManager", "TokenManager"],
  ["valueCalculator", "ValueCalculator"],
  ["swapManager", "SwapManager"],
  ["parameterManager", "ParameterManager"],
  ["emergencyHandler", "EmergencyHandler"],
  ["liquidityManager", "LiquidityManager"],
  ["protocolManager", "ProtocolManager"],
  ["flashLoanService", "FlashLoanService"],
] as const;

/** Deploys and wires the current core contracts. It never uses hard-coded addresses. */
export async function deployCore(hre: HardhatRuntimeEnvironment, input: CoreDeploymentInput): Promise<DeploymentManifest> {
  if (!input.execute) throw new ConfigurationError("Core deployment requires EXECUTE=true");
  const network = await hre.ethers.provider.getNetwork();
  const [signer] = await hre.ethers.getSigners();
  if (!signer) throw new ConfigurationError("No deployment signer is configured");
  const signerAddress = await signer.getAddress() as Address;
  const manifest = input.manifest ?? emptyManifest({
    network: hre.network.name,
    chainId: Number(network.chainId),
    baseAssetCode: input.baseAssetCode,
    baseAssetAddress: input.baseAssetAddress,
    baseAssetDecimals: input.baseAssetDecimals,
    deployer: signerAddress,
  });
  if (manifest.chainId !== Number(network.chainId)) throw new ConfigurationError("Manifest and provider chain IDs differ");

  const d = new CheckpointDeployer(hre, manifest, input.manifestPath, input.confirmations ?? 1, signer);
  const beacon = await d.deploy("beacon", "Beacon");
  // LiquidityManager reads BASE_ASSET and its decimals in the constructor, so
  // base-asset registration is a hard dependency and must precede every module.
  const earlyBeacon = d.contract(beacon, BEACON_ABI);
  for (const moduleName of new Set(["BASE_ASSET", input.baseAssetCode])) {
    const exists = Boolean(await earlyBeacon.getFunction("checkModuleExists").staticCall(moduleName));
    const current = exists ? String(await earlyBeacon.getFunction("getImplementation").staticCall(moduleName)).toLowerCase() : "";
    if (current !== input.baseAssetAddress.toLowerCase()) await d.send(`beacon:${moduleName}`, earlyBeacon, "updateImplementation", [moduleName, input.baseAssetAddress]);
  }
  const proxy = await d.deploy("proxyGeneral", "ProxyGeneral", [beacon, input.baseAssetCode]);
  const oracle = await d.deploy("chainlinkAdapter", "ChainlinkAdapter");
  await d.deploy("tokenManager", "TokenManager", [beacon, oracle]);
  await d.deploy("valueCalculator", "ValueCalculator", [beacon, input.baseAssetCode]);
  await d.deploy("swapManager", "SwapManager", [beacon, input.baseAssetCode]);
  await d.deploy("parameterManager", "ParameterManager", [beacon, input.baseAssetDecimals]);
  await d.deploy("emergencyHandler", "EmergencyHandler", [beacon]);
  const liquidityManager = await d.deploy("liquidityManager", "LiquidityManager", [beacon, input.baseAssetCode]);
  await d.deploy("protocolManager", "ProtocolManager", [beacon]);
  await d.deploy("flashLoanService", "FlashLoanService", [beacon]);

  const beaconContract = d.contract(beacon, BEACON_ABI);
  await d.assertOwner(beaconContract, "Beacon");
  for (const [manifestKey, moduleName] of CORE_MODULES) {
    const address = manifest.contracts[manifestKey];
    const exists = Boolean(await beaconContract.getFunction("checkModuleExists").staticCall(moduleName));
    const current = exists ? String(await beaconContract.getFunction("getImplementation").staticCall(moduleName)).toLowerCase() : "";
    if (current !== address.toLowerCase()) await d.send(`beacon:${moduleName}`, beaconContract, "updateImplementation", [moduleName, address]);
  }

  const proxyContract = d.contract(proxy, PROXY_ABI);
  await d.assertOwner(proxyContract, "ProxyGeneral");
  for (const moduleName of ["liquidityManager", "swapManager", "protocolManager", "emergencyHandler"] as const) {
    const address = manifest.contracts[moduleName];
    const authorized = Boolean(await proxyContract.getFunction("isAuthorizedModule").staticCall(address));
    if (!authorized) await d.send(`proxy:authorize:${moduleName}`, proxyContract, "authorizeModule", [address, moduleName]);
  }

  const tokenManager = d.contract(manifest.contracts.tokenManager, TOKEN_MANAGER_ABI);
  await d.assertOwner(tokenManager, "TokenManager");
  const oracleContract = d.contract(oracle, CHAINLINK_ABI);
  await d.assertOwner(oracleContract, "ChainlinkAdapter");
  const baseSupported = Boolean(await oracleContract.getFunction("supportsToken").staticCall(input.baseAssetCode));
  if (!baseSupported) {
    await d.send("chainlink:baseAsset", oracleContract, "setPriceFeed", [input.baseAssetCode, input.basePriceFeed, input.basePriceFeedDecimals, input.basePriceHeartbeat, input.quoteCurrency ?? "USD"]);
  }
  if (manifest.metadata.baseAssetCodeConfigured !== input.baseAssetCode) {
    await d.send("tokenManager:setBaseAssetCode", tokenManager, "setBaseAssetCode", [input.baseAssetCode]);
    manifest.metadata.baseAssetCodeConfigured = input.baseAssetCode;
    d.checkpoint();
  }
  manifest.metadata.coreDeploymentComplete = true;
  manifest.metadata.liquidityManager = liquidityManager;
  d.checkpoint();
  return manifest;
}
