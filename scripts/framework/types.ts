import type { Provider, Signer, TransactionReceipt } from "ethers";

export type Address = `0x${string}`;
export type HexData = `0x${string}`;

export interface BaseAssetManifest {
  code: string;
  address: Address;
  decimals: number;
}

export interface ProtocolManifest {
  plugin: Address;
  lensAdapter: Address;
  registry?: Address;
  active: boolean;
  kind: "aave" | "euler" | "morpho" | "morpho-vault" | "uniswap-v3";
}

export interface DeploymentManifest {
  schemaVersion: 1;
  network: string;
  chainId: number;
  createdAt: string;
  updatedAt: string;
  deployer?: Address;
  baseAsset: BaseAssetManifest;
  contracts: Record<string, Address>;
  protocols: Record<string, ProtocolManifest>;
  transactions: Record<string, HexData>;
  metadata: Record<string, unknown>;
}

/**
 * Neutral transaction description. It deliberately contains no Hardhat object,
 * signer or bigint, so it can be serialized and handed to a browser wallet,
 * Safe multisig or autonomous execution service.
 */
export interface PlannedCall {
  id: string;
  description: string;
  chainId: number;
  target: Address;
  value: string;
  data: HexData;
  dependsOn: string[];
  expectedState?: string;
}

export interface ExecutionPlan {
  version: 1;
  createdAt: string;
  operation: string;
  chainId: number;
  calls: PlannedCall[];
  warnings: string[];
}

export interface TransactionResult {
  callId: string;
  simulated: boolean;
  transactionHash?: HexData;
  blockNumber?: number;
  gasUsed?: string;
  status: "planned" | "simulated" | "confirmed";
}

export interface OperationResult<T> {
  success: boolean;
  operation: string;
  plan?: ExecutionPlan;
  transactions: TransactionResult[];
  data?: T;
  error?: {
    code: string;
    message: string;
    context?: Record<string, unknown>;
  };
}

export interface ExecutionOptions {
  execute: boolean;
  dryRun: boolean;
  encodeOnly: boolean;
  confirmations: number;
  allowedChainIds: number[];
  rpcRetries?: number;
  rpcRetryDelayMs?: number;
}

export interface ScriptRuntime {
  provider: Provider;
  signer?: Signer;
  signerAddress?: Address;
  chainId: number;
  networkName: string;
  manifest: DeploymentManifest;
  options: ExecutionOptions;
}

export interface ConfirmedCall {
  result: TransactionResult;
  receipt?: TransactionReceipt;
}

export type ProtocolOperation = "deposit" | "withdraw" | "borrow" | "repay" | "close";
