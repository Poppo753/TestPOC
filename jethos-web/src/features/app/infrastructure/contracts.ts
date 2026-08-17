import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  type ContractTransactionResponse,
  type JsonRpcSigner,
} from 'ethers';

import {
  erc20Abi,
  liquidityManagerAbi,
  protocolManagerAbi,
  shareAbi,
  valueCalculatorAbi,
} from './abis';
import { deployment, validateDeployment } from './deployment';
import type { WalletSession } from './wallet';

export interface ReadContext {
  provider: Pick<JsonRpcProvider, 'getBalance' | 'getBlockNumber'>;
  baseAsset: {
    balanceOf(address: string): Promise<bigint>;
    allowance(owner: string, spender: string): Promise<bigint>;
  };
  shares: {
    balanceOf(address: string): Promise<bigint>;
    totalSupply(): Promise<bigint>;
    decimals(): Promise<bigint>;
    symbol(): Promise<string>;
    paused(): Promise<boolean>;
  };
  liquidity: {
    depositsEnabled(): Promise<boolean>;
    withdrawsEnabled(): Promise<boolean>;
    depositFee(): Promise<bigint>;
    withdrawFee(): Promise<bigint>;
    paused(): Promise<boolean>;
    calculateWithdrawAmount(shares: bigint): Promise<bigint>;
    calculateDepositShares(amount: bigint): Promise<bigint>;
    canWithdraw(address: string, shares: bigint): Promise<readonly [boolean, string]>;
    filters: { Deposit(address: string): unknown; Withdrawn(address: string): unknown };
    queryFilter(filter: unknown, from: number, to: number): Promise<readonly unknown[]>;
  };
  valueCalculator: { getTotalPoolValueView(): Promise<bigint> };
  protocolManager: {
    getAllProtocolNames(): Promise<readonly string[]>;
    getActiveProtocolCount(): Promise<bigint>;
    getAllProtocolsValue(): Promise<bigint>;
    getProtocolInfo(name: string): Promise<unknown>;
    getProtocolPositionBreakdown(name: string): Promise<unknown>;
    getGlobalHealthFactor(): Promise<unknown>;
  };
}

export interface WriteContext {
  baseAsset: { approve(spender: string, amount: bigint): Promise<ContractTransactionResponse> };
  liquidity: { deposit: WriteMethod; withdrawWithDeadline: WriteMethod };
}

interface WriteMethod {
  (...args: readonly unknown[]): Promise<ContractTransactionResponse>;
  estimateGas(...args: readonly unknown[]): Promise<bigint>;
}

let readContextPromise: Promise<ReadContext> | undefined;

export function getReadContext(): Promise<ReadContext> {
  readContextPromise ??= buildReadContext().catch((error: unknown) => {
    readContextPromise = undefined;
    throw error;
  });
  return readContextPromise;
}

async function buildReadContext(): Promise<ReadContext> {
  validateDeployment();
  const provider = new JsonRpcProvider(deployment.chain.rpcUrl, deployment.chain.id, {
    staticNetwork: true,
  });
  return {
    provider,
    baseAsset: new Contract(deployment.baseAsset.address, erc20Abi, provider),
    shares: new Contract(deployment.contracts.proxyGeneral, shareAbi, provider),
    liquidity: new Contract(deployment.contracts.liquidityManager, liquidityManagerAbi, provider),
    valueCalculator: new Contract(
      deployment.contracts.valueCalculator,
      valueCalculatorAbi,
      provider,
    ),
    protocolManager: new Contract(
      deployment.contracts.protocolManager,
      protocolManagerAbi,
      provider,
    ),
  } as unknown as ReadContext;
}

export function getWriteContext(wallet: WalletSession): WriteContext {
  const snapshot = wallet.snapshot();
  const signer = wallet.signer;
  if (!signer || !snapshot.address)
    throw new Error('Connect a wallet before creating a write context.');
  if (!snapshot.correctChain) throw new Error(`Switch the wallet to ${deployment.chain.name}.`);
  return {
    baseAsset: new Contract(deployment.baseAsset.address, erc20Abi, signer),
    liquidity: new Contract(deployment.contracts.liquidityManager, liquidityManagerAbi, signer),
  } as unknown as WriteContext;
}

export async function createSigner(
  provider: Eip1193Provider,
  address: string,
): Promise<JsonRpcSigner> {
  return new BrowserProvider(provider).getSigner(address);
}

export interface Eip1193Provider {
  request(args: { method: string; params?: readonly unknown[] | object }): Promise<unknown>;
  on?(event: 'accountsChanged' | 'chainChanged', listener: (...args: unknown[]) => void): void;
  removeListener?(
    event: 'accountsChanged' | 'chainChanged',
    listener: (...args: unknown[]) => void,
  ): void;
}
