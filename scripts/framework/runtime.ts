import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { getAddress } from "ethers";
import { ConfigurationError } from "./errors";
import { loadManifest } from "./manifest";
import type { Address, DeploymentManifest, ExecutionOptions, ScriptRuntime } from "./types";

export interface RuntimeInput {
  manifest?: DeploymentManifest;
  manifestPath?: string;
  options?: Partial<ExecutionOptions>;
  requireSigner?: boolean;
  signerAddress?: string;
}

export async function createRuntime(hre: HardhatRuntimeEnvironment, input: RuntimeInput = {}): Promise<ScriptRuntime> {
  const network = await hre.ethers.provider.getNetwork();
  const manifest = input.manifest ?? (input.manifestPath ? loadManifest(input.manifestPath) : undefined);
  if (!manifest) throw new ConfigurationError("A deployment manifest or manifestPath is required");
  const chainId = Number(network.chainId);
  if (manifest.chainId !== chainId) throw new ConfigurationError("Manifest chainId does not match provider", { manifest: manifest.chainId, provider: chainId });
  const options: ExecutionOptions = {
    execute: false,
    dryRun: true,
    encodeOnly: false,
    confirmations: 1,
    allowedChainIds: [31337, 42161, 421614],
    rpcRetries: 3,
    rpcRetryDelayMs: 250,
    ...input.options,
  };
  let signer;
  let signerAddress: Address | undefined = input.signerAddress ? getAddress(input.signerAddress) as Address : undefined;
  if (input.requireSigner !== false && !options.encodeOnly) {
    [signer] = await hre.ethers.getSigners();
    if (!signer) throw new ConfigurationError("No signer is configured");
    const configuredSigner = getAddress(await signer.getAddress()) as Address;
    if (signerAddress && signerAddress !== configuredSigner) throw new ConfigurationError("Configured signerAddress does not match signer");
    signerAddress = configuredSigner;
  }
  return { provider: hre.ethers.provider, signer, signerAddress, chainId, networkName: hre.network.name, manifest, options };
}
