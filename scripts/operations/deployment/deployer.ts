import type { BaseContract, ContractTransactionReceipt, ContractTransactionResponse, Signer } from "ethers";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { ScriptSuiteError } from "../../framework/errors";
import { saveManifest, setContract } from "../../framework/manifest";
import type { Address, DeploymentManifest, HexData } from "../../framework/types";

/**
 * Shared, deliberately small deployment engine.
 *
 * Deployment is different from an ordinary operation: the address of call N is
 * only known after call N has been mined.  For that reason deployments are not
 * represented as a pre-built ExecutionPlan.  They are guarded by EXECUTE=true,
 * persist a checkpoint after every confirmed transaction and can be resumed by
 * passing the partially populated manifest back to the same operation.
 */
export class CheckpointDeployer {
  public constructor(
    private readonly hre: HardhatRuntimeEnvironment,
    public readonly manifest: DeploymentManifest,
    private readonly manifestPath: string,
    private readonly confirmations: number,
    private readonly deploymentSigner: Signer,
  ) {}

  public async deploy(name: string, artifact: string, constructorArgs: readonly unknown[] = []): Promise<Address> {
    const existing = this.manifest.contracts[name];
    if (existing) {
      const code = await this.hre.ethers.provider.getCode(existing);
      if (code === "0x") throw new ScriptSuiteError("DEPLOYMENT_CHECKPOINT_INVALID", `${name} exists in the manifest but has no bytecode`, { address: existing });
      return existing;
    }

    const factory = await this.hre.ethers.getContractFactory(artifact);
    const deploy = factory.deploy.bind(factory) as unknown as (...args: readonly unknown[]) => Promise<BaseContract>;
    const contract = await deploy(...constructorArgs);
    const deploymentTransaction = contract.deploymentTransaction();
    if (!deploymentTransaction) throw new ScriptSuiteError("DEPLOYMENT_TX_MISSING", `No deployment transaction for ${name}`);
    const receipt = await deploymentTransaction.wait(this.confirmations);
    if (!receipt || receipt.status !== 1) throw new ScriptSuiteError("DEPLOYMENT_REVERTED", `Deployment reverted for ${name}`);
    const address = await contract.getAddress() as Address;
    setContract(this.manifest, name, address);
    this.recordTransaction(`deploy:${name}`, deploymentTransaction.hash, receipt);
    this.checkpoint();
    return address;
  }

  public async send(id: string, contract: BaseContract, functionName: string, args: readonly unknown[] = []): Promise<ContractTransactionReceipt> {
    const fn = contract.getFunction(functionName);
    const response = await fn(...args) as ContractTransactionResponse;
    const receipt = await response.wait(this.confirmations);
    if (!receipt || receipt.status !== 1) throw new ScriptSuiteError("CONFIGURATION_REVERTED", `${id} reverted`);
    this.recordTransaction(id, response.hash, receipt);
    this.checkpoint();
    return receipt;
  }

  public contract(address: Address, abi: readonly string[]): BaseContract {
    return new this.hre.ethers.Contract(address, abi, this.deploymentSigner);
  }

  public async assertOwner(contract: BaseContract, label: string): Promise<void> {
    const actual = String(await contract.getFunction("owner").staticCall()).toLowerCase();
    const expected = (await this.deploymentSigner.getAddress()).toLowerCase();
    if (actual !== expected) throw new ScriptSuiteError("OWNER_MISMATCH", `Signer is not owner of ${label}`, { expected, actual });
  }

  public checkpoint(): void {
    saveManifest(this.manifestPath, this.manifest);
  }

  private recordTransaction(id: string, hash: string, receipt: ContractTransactionReceipt): void {
    this.manifest.transactions[id] = hash as HexData;
    this.manifest.metadata.lastCompletedStep = id;
    this.manifest.metadata.lastCompletedBlock = receipt.blockNumber;
  }
}
