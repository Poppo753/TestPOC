/**
 * Idempotent explorer verification for the Arbitrum USDC POC.
 *
 * Safety properties:
 * - it never loads or prints the deployer private key;
 * - it validates chain, addresses, runtime code and deployment receipts first;
 * - it uses an explicit 22-contract matrix, including constructor arguments;
 * - it treats an already verified contract as success;
 * - it continues after a single verification failure and writes a complete report.
 *
 * Usage:
 *   npm run verify:poc
 *   $env:VERIFY_PREFLIGHT_ONLY="true"; npm run verify:poc
 *   $env:POC_MANIFEST="scripts/manifests/another.json"; npm run verify:poc
 */

import fs from "node:fs";
import path from "node:path";
import hre from "hardhat";
import { ContractFactory, getAddress } from "ethers";

const EXPECTED_CHAIN_ID = 42161n;
const DEFAULT_MANIFEST = "scripts/manifests/arbitrum-usdc-poc-1.json";
const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
const EULER_EVC = "0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066";
const EULER_ACCOUNT_LENS = "0x90a52DDcb232e7bb003DD9258fA1235c553eC956";
const EULER_VAULT_LENS = "0xc99FCEE6174Bc92eBe9C78690fFD5067018a8380";
const EULER_UTILS_LENS = "0xDAf44060DCe217Fd603908A49fcaa1FA900304BE";
const MORPHO = "0x6c247b1F6182318877311737BaC0844bAa518F5e";

type Manifest = {
  network: string;
  chainId: number;
  contracts: Record<string, string>;
  transactions: Record<string, string>;
};

type ContractSpec = {
  key: string;
  label: string;
  contract: string;
  constructorArguments: unknown[];
};

type VerificationResult = {
  key: string;
  label: string;
  address: string;
  deploymentTransaction: string;
  explorerUrl: string;
  contract: string;
  constructorArguments: unknown[];
  deploymentInputMatches: boolean;
  runtimeBytes: number;
  preflight: "PASS" | "FAIL";
  explorer: "VERIFIED" | "ALREADY_VERIFIED" | "SKIPPED" | "FAILED";
  error?: string;
};

function readManifest(manifestPath: string): Manifest {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Manifest;
}

function verificationMatrix(manifest: Manifest): ContractSpec[] {
  const c = manifest.contracts;
  const beacon = c.beacon;
  const base = "USDC";

  return [
    { key: "beacon", label: "Beacon", contract: "contracts/Beacon.sol:Beacon", constructorArguments: [] },
    { key: "proxyGeneral", label: "ProxyGeneral", contract: "contracts/ProxyGeneral.sol:ProxyGeneral", constructorArguments: [beacon, base] },
    { key: "chainlinkAdapter", label: "ChainlinkAdapter", contract: "contracts/adapters/ChainlinkAdapter.sol:ChainlinkAdapter", constructorArguments: [] },
    { key: "tokenManager", label: "TokenManager", contract: "contracts/TokenManager.sol:TokenManager", constructorArguments: [beacon, c.chainlinkAdapter] },
    { key: "valueCalculator", label: "ValueCalculator", contract: "contracts/ValueCalculator.sol:ValueCalculator", constructorArguments: [beacon, base] },
    { key: "swapManager", label: "SwapManager", contract: "contracts/SwapManager.sol:SwapManager", constructorArguments: [beacon, base] },
    { key: "parameterManager", label: "ParameterManager", contract: "contracts/ParameterManager.sol:ParameterManager", constructorArguments: [beacon, 6] },
    { key: "emergencyHandler", label: "EmergencyHandler", contract: "contracts/EmergencyHandler.sol:EmergencyHandler", constructorArguments: [beacon] },
    { key: "liquidityManager", label: "LiquidityManager", contract: "contracts/Liquiditymanager.sol:LiquidityManager", constructorArguments: [beacon, base] },
    { key: "protocolManager", label: "ProtocolManager", contract: "contracts/ProtocolManager.sol:ProtocolManager", constructorArguments: [beacon] },
    { key: "flashLoanService", label: "FlashLoanService", contract: "contracts/services/FlashLoanService.sol:FlashLoanService", constructorArguments: [beacon] },
    { key: "aaveV3Registry", label: "AaveV3Registry", contract: "contracts/plugins/AaveV3Registry.sol:AaveV3Registry", constructorArguments: [] },
    { key: "aaveV3Plugin", label: "AaveV3Plugin", contract: "contracts/plugins/AaveV3Plugin.sol:AaveV3Plugin", constructorArguments: [beacon, base, AAVE_POOL] },
    { key: "aaveV3LensAdapter", label: "AaveV3LensAdapter", contract: "contracts/adapters/AaveV3LensAdapter.sol:AaveV3LensAdapter", constructorArguments: [beacon, base, AAVE_POOL] },
    { key: "eulerRegistry", label: "EulerRegistry", contract: "contracts/plugins/EulerRegistry.sol:EulerRegistry", constructorArguments: [] },
    { key: "eulerV2Plugin", label: "EulerV2Plugin", contract: "contracts/plugins/EulerV2Plugin.sol:EulerV2Plugin", constructorArguments: [beacon, base, EULER_EVC, EULER_ACCOUNT_LENS] },
    { key: "eulerLensAdapter", label: "EulerLensAdapter", contract: "contracts/adapters/EulerLensAdapter.sol:EulerLensAdapter", constructorArguments: [beacon, base, EULER_ACCOUNT_LENS, EULER_VAULT_LENS, EULER_UTILS_LENS, EULER_EVC] },
    { key: "morphoRegistry", label: "MorphoRegistry", contract: "contracts/plugins/MorphoRegistry.sol:MorphoRegistry", constructorArguments: [] },
    { key: "morphoPlugin", label: "MorphoPlugin", contract: "contracts/plugins/MorphoPlugin.sol:MorphoPlugin", constructorArguments: [beacon, base, MORPHO] },
    { key: "morphoLensAdapter", label: "MorphoLensAdapter", contract: "contracts/adapters/MorphoLensAdapter.sol:MorphoLensAdapter", constructorArguments: [beacon, base, MORPHO] },
    { key: "morphoVaultPlugin", label: "MorphoVaultPlugin", contract: "contracts/plugins/MorphoVaultPlugin.sol:MorphoVaultPlugin", constructorArguments: [beacon] },
    { key: "morphoVaultLensAdapter", label: "MorphoVaultLensAdapter", contract: "contracts/adapters/MorphoVaultLensAdapter.sol:MorphoVaultLensAdapter", constructorArguments: [beacon, base] },
  ];
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/(?:0x)?[0-9a-fA-F]{64}/g, "[REDACTED_64_HEX]")
    .replace(/([?&](?:api_?key|apikey|token)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/(\/v2\/)[A-Za-z0-9_-]{12,}/g, "$1[REDACTED]");
}

function isAlreadyVerified(error: unknown): boolean {
  const message = safeError(error).toLowerCase();
  return message.includes("already verified") || message.includes("already been verified");
}

async function main(): Promise<void> {
  const manifestPath = path.resolve(process.env.POC_MANIFEST ?? DEFAULT_MANIFEST);
  const preflightOnly = process.env.VERIFY_PREFLIGHT_ONLY === "true";
  if (!process.env.ARBITRUM_RPC_URL) {
    throw new Error("ARBITRUM_RPC_URL is required: public RPC fallback is not accepted for certification");
  }
  if (!preflightOnly && !process.env.ARBITRUM_ETHERSCAN_API_KEY) {
    throw new Error("ARBITRUM_ETHERSCAN_API_KEY is required for explorer verification");
  }
  const manifest = readManifest(manifestPath);
  const network = await hre.ethers.provider.getNetwork();

  if (network.chainId !== EXPECTED_CHAIN_ID || BigInt(manifest.chainId) !== EXPECTED_CHAIN_ID) {
    throw new Error(`Wrong chain: provider=${network.chainId}, manifest=${manifest.chainId}, expected=${EXPECTED_CHAIN_ID}`);
  }

  const matrix = verificationMatrix(manifest);
  if (matrix.length !== 22) throw new Error(`Verification matrix must contain 22 contracts, found ${matrix.length}`);

  const normalizedAddresses = matrix.map((spec) => getAddress(manifest.contracts[spec.key]));
  if (new Set(normalizedAddresses.map((address) => address.toLowerCase())).size !== matrix.length) {
    throw new Error("The manifest contains duplicate contract addresses");
  }

  const results: VerificationResult[] = [];

  for (const spec of matrix) {
    const address = getAddress(manifest.contracts[spec.key]);
    const deploymentTransaction = manifest.transactions[`deploy:${spec.key}`];
    const result: VerificationResult = {
      key: spec.key,
      label: spec.label,
      address,
      deploymentTransaction,
      explorerUrl: `https://arbiscan.io/address/${address}#code`,
      contract: spec.contract,
      constructorArguments: spec.constructorArguments,
      deploymentInputMatches: false,
      runtimeBytes: 0,
      preflight: "FAIL",
      explorer: "SKIPPED",
    };

    try {
      if (!deploymentTransaction) throw new Error(`Missing deployment transaction deploy:${spec.key}`);
      const [code, receipt, deployment, artifact] = await Promise.all([
        hre.ethers.provider.getCode(address),
        hre.ethers.provider.getTransactionReceipt(deploymentTransaction),
        hre.ethers.provider.getTransaction(deploymentTransaction),
        hre.artifacts.readArtifact(spec.contract),
      ]);
      if (code === "0x") throw new Error("No runtime bytecode at manifest address");
      if (!receipt) throw new Error("Deployment receipt not found");
      if (!deployment) throw new Error("Deployment transaction not found");
      if (receipt.status !== 1) throw new Error(`Deployment receipt status is ${receipt.status}`);
      if (receipt.contractAddress && getAddress(receipt.contractAddress) !== address) {
        throw new Error(`Deployment receipt created ${receipt.contractAddress}, not ${address}`);
      }

      // Compare the complete creation transaction input, not only the runtime
      // address. This binds source artifact, compiler settings and constructor
      // arguments to the actual transaction that created the contract.
      const factory = new ContractFactory(artifact.abi, artifact.bytecode);
      const expectedDeployment = await factory.getDeployTransaction(...spec.constructorArguments);
      if (typeof expectedDeployment.data !== "string") throw new Error("Unable to build expected deployment input");
      if (deployment.data.toLowerCase() !== expectedDeployment.data.toLowerCase()) {
        throw new Error("Creation bytecode or constructor arguments do not match the deployment transaction");
      }

      result.runtimeBytes = (code.length - 2) / 2;
      result.deploymentInputMatches = true;
      result.preflight = "PASS";
    } catch (error) {
      result.error = safeError(error);
      results.push(result);
      console.error(`[FAIL preflight] ${spec.label} ${address}: ${result.error}`);
      continue;
    }

    if (preflightOnly) {
      console.log(`[PASS preflight] ${spec.label} ${address} (${result.runtimeBytes} bytes)`);
      results.push(result);
      continue;
    }

    try {
      await hre.run("verify:verify", {
        address,
        constructorArguments: spec.constructorArguments,
        contract: spec.contract,
      });
      result.explorer = "VERIFIED";
      console.log(`[VERIFIED] ${spec.label} ${address}`);
    } catch (error) {
      if (isAlreadyVerified(error)) {
        result.explorer = "ALREADY_VERIFIED";
        console.log(`[ALREADY VERIFIED] ${spec.label} ${address}`);
      } else {
        result.explorer = "FAILED";
        result.error = safeError(error);
        console.error(`[FAIL explorer] ${spec.label} ${address}: ${result.error}`);
      }
    }

    results.push(result);
  }

  const failed = results.filter((result) => result.preflight === "FAIL" || result.explorer === "FAILED");
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    manifest: path.relative(process.cwd(), manifestPath).replace(/\\/g, "/"),
    network: manifest.network,
    chainId: manifest.chainId,
    mode: preflightOnly ? "preflight-only" : "explorer-verification",
    summary: {
      total: results.length,
      preflightPassed: results.filter((result) => result.preflight === "PASS").length,
      verified: results.filter((result) => result.explorer === "VERIFIED").length,
      alreadyVerified: results.filter((result) => result.explorer === "ALREADY_VERIFIED").length,
      skipped: results.filter((result) => result.explorer === "SKIPPED").length,
      failed: failed.length,
    },
    results,
  };

  const reportDir = path.resolve("reports/verification");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, "arbitrum-usdc-poc-1.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Report: ${path.relative(process.cwd(), reportPath)}`);

  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(safeError(error));
  process.exitCode = 1;
});
