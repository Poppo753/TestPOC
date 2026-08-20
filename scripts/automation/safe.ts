import SafeApiKit from "@safe-global/api-kit";
import Safe from "@safe-global/protocol-kit";
import { OperationType, type MetaTransactionData, type SafeTransactionData } from "@safe-global/types-kit";
import type { ExecutionPlan, ScriptRuntime } from "../framework/types";
import type { AutomationConfig, AutomationRun, SafeExecutionStatus, SafeProposalBinding } from "./types";

interface Eip1193Request { method: string; params?: readonly unknown[] | object; }
interface RpcSendProvider { send(method: string, params: unknown[]): Promise<unknown>; }

/** Convert the ethers/Hardhat provider without exposing an RPC URL or secret. */
function eip1193(runtime: ScriptRuntime) {
  return {
    request: ({ method, params }: Eip1193Request) => (runtime.provider as unknown as RpcSendProvider).send(method, Array.isArray(params) ? [...params] : []),
  };
}

export function planToSafeTransactions(plan: ExecutionPlan): MetaTransactionData[] {
  return plan.calls.map(call => ({ to: call.target, value: call.value, data: call.data, operation: OperationType.Call }));
}

function normalizeTransactionData(data: SafeTransactionData): SafeProposalBinding["transactionData"] {
  return {
    to: data.to,
    value: data.value,
    data: data.data,
    operation: data.operation,
    safeTxGas: data.safeTxGas,
    baseGas: data.baseGas,
    gasPrice: data.gasPrice,
    gasToken: data.gasToken,
    refundReceiver: data.refundReceiver,
    nonce: data.nonce,
  };
}

export interface SafeAdapter {
  prepareAndPropose(runtime: ScriptRuntime, config: AutomationConfig, run: AutomationRun, env?: NodeJS.ProcessEnv): Promise<{ binding: SafeProposalBinding; simulationPassed: boolean }>;
  getExecutionStatus(config: AutomationConfig, binding: SafeProposalBinding, env?: NodeJS.ProcessEnv): Promise<SafeExecutionStatus>;
}

export function createSafeApiKit(config: AutomationConfig, env: NodeJS.ProcessEnv = process.env): SafeApiKit {
  if (!config.safe) throw new Error("Safe configuration is missing");
  const apiKey = config.safe.apiKeyEnv ? env[config.safe.apiKeyEnv] : undefined;
  if (config.safe.apiKeyEnv && !apiKey) throw new Error(`Missing Safe API key environment variable ${config.safe.apiKeyEnv}`);
  return new SafeApiKit({ chainId: BigInt(config.chainId), txServiceUrl: config.safe.txServiceUrl, apiKey });
}

type SafeProtocolClient = Pick<Safe, "isOwner" | "createTransaction" | "getTransactionHash" | "signHash">;
type SafeServiceClient = Pick<SafeApiKit, "estimateSafeTransaction" | "proposeTransaction" | "getTransaction">;
export interface SafeAdapterDependencies {
  createProtocolClient(runtime: ScriptRuntime, config: AutomationConfig): Promise<SafeProtocolClient>;
  createServiceClient(config: AutomationConfig, env: NodeJS.ProcessEnv): SafeServiceClient;
}

const DEFAULT_DEPENDENCIES: SafeAdapterDependencies = {
  createProtocolClient: async (runtime, config) => {
    if (!config.safe || !runtime.signerAddress) throw new Error("Safe and signer are required");
    return Safe.init({ provider: eip1193(runtime), signer: runtime.signerAddress, safeAddress: config.safe.address,
      onchainAnalytics: { project: "vault-automation-controller", platform: "server" } });
  },
  createServiceClient: (config, env) => createSafeApiKit(config, env),
};

/**
 * Thin integration with the official Safe kits. It never accepts a private key
 * from the control file: the configured Hardhat/provider account signs as one
 * Safe owner, while the Safe threshold remains the authorization boundary.
 */
export class OfficialSafeAdapter implements SafeAdapter {
  constructor(private readonly dependencies: SafeAdapterDependencies = DEFAULT_DEPENDENCIES) {}

  private api(config: AutomationConfig, env: NodeJS.ProcessEnv): SafeServiceClient {
    return this.dependencies.createServiceClient(config, env);
  }

  async prepareAndPropose(runtime: ScriptRuntime, config: AutomationConfig, run: AutomationRun, env: NodeJS.ProcessEnv = process.env): Promise<{ binding: SafeProposalBinding; simulationPassed: boolean }> {
    if (config.execution.kind !== "safe" || !config.safe) throw new Error("Safe execution is not configured");
    if (run.state !== "AWAITING_SAFE_PROPOSAL" || !run.plan) throw new Error(`Run ${run.id} is not ready for Safe proposal`);
    if (!runtime.signerAddress) throw new Error("Safe proposal requires a configured owner signer");
    const protocolKit = await this.dependencies.createProtocolClient(runtime, config);
    if (!(await protocolKit.isOwner(runtime.signerAddress))) throw new Error("Configured proposer is not an owner of the Safe");
    const transactions = planToSafeTransactions(run.plan);
    const draft = await protocolKit.createTransaction({ transactions, onlyCalls: true });
    // The Transaction Service estimates the Safe call without requiring the
    // final multisig quorum. ProtocolKit.isValidTransaction is intentionally
    // not used here because it validates available owner approvals too.
    const api = this.api(config, env);
    const estimate = await api.estimateSafeTransaction(config.safe.address, {
      to: draft.data.to, value: draft.data.value, data: draft.data.data, operation: draft.data.operation,
    });
    const safeTransaction = await protocolKit.createTransaction({ transactions, onlyCalls: true, options: { safeTxGas: estimate.safeTxGas } });
    const simulationPassed = true;
    const safeTxHash = await protocolKit.getTransactionHash(safeTransaction);
    const signature = await protocolKit.signHash(safeTxHash);
    await api.proposeTransaction({
      safeAddress: config.safe.address,
      safeTransactionData: safeTransaction.data,
      safeTxHash,
      senderAddress: runtime.signerAddress,
      senderSignature: signature.data,
      origin: JSON.stringify({ name: "Vault Automation Controller", runId: run.id }),
    });
    return {
      simulationPassed,
      binding: {
        safeAddress: config.safe.address,
        safeTxHash,
        nonce: safeTransaction.data.nonce,
        proposer: runtime.signerAddress,
        proposedAt: new Date().toISOString(),
        transactionData: normalizeTransactionData(safeTransaction.data),
      },
    };
  }

  async getExecutionStatus(config: AutomationConfig, binding: SafeProposalBinding, env: NodeJS.ProcessEnv = process.env): Promise<SafeExecutionStatus> {
    const response = await this.api(config, env).getTransaction(binding.safeTxHash);
    const nonce = Number(response.nonce);
    if (!Number.isSafeInteger(nonce)) throw new Error("Safe service returned an invalid nonce");
    return {
      safeAddress: response.safe,
      safeTxHash: response.safeTxHash,
      transactionData: {
        to: response.to,
        value: response.value,
        data: response.data ?? "0x",
        operation: response.operation,
        safeTxGas: response.safeTxGas,
        baseGas: response.baseGas,
        gasPrice: response.gasPrice,
        gasToken: response.gasToken,
        refundReceiver: response.refundReceiver ?? "0x0000000000000000000000000000000000000000",
        nonce,
      },
      executed: response.isExecuted,
      trusted: response.trusted,
      successful: response.isSuccessful ?? undefined,
      transactionHash: response.transactionHash ?? undefined,
    };
  }
}
