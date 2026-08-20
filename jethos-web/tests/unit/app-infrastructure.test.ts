import type { JsonRpcSigner } from 'ethers';
import { describe, expect, it, vi } from 'vitest';

import type {
  Eip1193Provider,
  ReadContext,
  WriteContext,
} from '../../src/features/app/infrastructure/contracts';
import {
  deployment,
  explorerAddress,
  explorerTransaction,
  validateDeployment,
} from '../../src/features/app/infrastructure/deployment';
import {
  attempt,
  readProtocolSnapshot,
  readUserSnapshot,
  readVaultSnapshot,
} from '../../src/features/app/infrastructure/readers';
import { WalletSession } from '../../src/features/app/infrastructure/wallet';
import {
  approveExact,
  deposit,
  explainTransactionError,
  revokeApproval,
  withdraw,
  type TransactionDependencies,
  type TransactionState,
} from '../../src/features/app/web3/transactions';

class MockProvider implements Eip1193Provider {
  readonly calls: string[] = [];
  accounts = ['0x0000000000000000000000000000000000000001'];
  chainId = '0xa4b1';
  switchError: unknown;
  readonly listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  async request({ method }: { method: string }): Promise<unknown> {
    this.calls.push(method);
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return this.accounts;
    if (method === 'eth_chainId') return this.chainId;
    if (method === 'wallet_switchEthereumChain' && this.switchError) throw this.switchError;
    return null;
  }
  on(event: 'accountsChanged' | 'chainChanged', listener: (...args: unknown[]) => void) {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(listener);
    this.listeners.set(event, listeners);
  }
  removeListener(
    event: 'accountsChanged' | 'chainChanged',
    listener: (...args: unknown[]) => void,
  ) {
    this.listeners.get(event)?.delete(listener);
  }
  emit(event: string, value: unknown) {
    this.listeners.get(event)?.forEach((listener) => listener(value));
  }
}

const signerFactory = vi.fn(
  async (_provider: Eip1193Provider, address: string) =>
    ({
      getAddress: async () => address,
    }) as unknown as JsonRpcSigner,
);

const context = (): ReadContext => ({
  provider: {
    getBalance: vi.fn(async () => 2n),
    getBlockNumber: vi.fn(async () => 100),
  },
  baseAsset: { balanceOf: vi.fn(async () => 10n), allowance: vi.fn(async () => 3n) },
  shares: {
    balanceOf: vi.fn(async () => 4n),
    totalSupply: vi.fn(async () => 100n),
    decimals: vi.fn(async () => 18n),
    symbol: vi.fn(async () => 'JETH-LP'),
    paused: vi.fn(async () => false),
  },
  liquidity: {
    depositsEnabled: vi.fn(async () => true),
    withdrawsEnabled: vi.fn(async () => true),
    depositFee: vi.fn(async () => 25n),
    withdrawFee: vi.fn(async () => 30n),
    paused: vi.fn(async () => false),
    calculateWithdrawAmount: vi.fn(async () => 5n),
    calculateDepositShares: vi.fn(async () => 5n),
    canWithdraw: vi.fn(async () => [true, ''] as const),
    filters: { Deposit: vi.fn(() => ({})), Withdrawn: vi.fn(() => ({})) },
    queryFilter: vi.fn(async () => []),
  },
  valueCalculator: { getTotalPoolValueView: vi.fn(async () => 99n) },
  protocolManager: {
    getAllProtocolNames: vi.fn(async () => ['AaveV3']),
    getActiveProtocolCount: vi.fn(async () => 1n),
    getAllProtocolsValue: vi.fn(async () => 9n),
    getProtocolInfo: vi.fn(async () => ({ isActive: true })),
    getProtocolPositionBreakdown: vi.fn(async () => [9n, 0n, 9n]),
    getGlobalHealthFactor: vi.fn(async () => [2n, 'AaveV3']),
  },
});

describe('PoC deployment contract', () => {
  it('validates every recorded address and matching chain identifiers', () => {
    expect(validateDeployment()).toBe(true);
    expect(deployment.chain.id).toBe(42161);
    expect(deployment.baseAsset.address).toBe('0xaf88d065e77c8cC2239327C5EDb3A432268e5831');
    expect(explorerAddress(deployment.contracts.liquidityManager)).toContain('/address/0x80fB');
    expect(explorerTransaction('0xabc')).toBe('https://arbiscan.io/tx/0xabc');
  });
});

describe('RPC readers', () => {
  it('returns field-level provenance instead of converting failures into zero', async () => {
    const readContext = context();
    readContext.valueCalculator.getTotalPoolValueView = vi.fn(async () => {
      throw new Error('RPC offline');
    });
    const snapshot = await readVaultSnapshot(readContext);
    expect(snapshot.poolValue).toEqual({ ok: false, value: null, error: 'RPC offline' });
    expect(snapshot.reserve).toEqual({ ok: true, value: 10n });
  });

  it('reads user and protocol records concurrently with deployment fallback', async () => {
    const readContext = context();
    const user = await readUserSnapshot('0x0000000000000000000000000000000000000001', readContext);
    expect(user).toMatchObject({
      nativeBalance: { ok: true, value: 2n },
      estimatedRedeem: { ok: true, value: 5n },
    });
    readContext.protocolManager.getAllProtocolNames = vi.fn(async () => {
      throw new Error('registry unavailable');
    });
    const protocols = await readProtocolSnapshot(readContext);
    expect(protocols.source).toContain('deployment record');
    expect(protocols.protocols.map(({ name }) => name)).toEqual([...deployment.recordedProtocols]);
  });

  it('bounds stalled requests with an explicit error', async () => {
    const result = await attempt('slow read', () => new Promise(() => {}), 5);
    expect(result).toEqual({ ok: false, value: null, error: 'slow read timed out' });
  });
});

describe('EIP-1193 wallet session', () => {
  it('restores passively and connects only after the explicit method call', async () => {
    const provider = new MockProvider();
    const wallet = new WalletSession(provider, signerFactory);
    await wallet.restore();
    expect(provider.calls).toEqual(['eth_accounts', 'eth_chainId']);
    expect(wallet.snapshot()).toMatchObject({ connected: true, correctChain: true });
    await wallet.connect();
    expect(provider.calls).toContain('eth_requestAccounts');
    wallet.destroy();
    expect(provider.listeners.get('accountsChanged')?.size).toBe(0);
  });

  it('handles missing wallets, chain changes and add-chain fallback', async () => {
    await expect(new WalletSession(undefined).connect()).rejects.toThrow('No EIP-1193 wallet');
    const provider = new MockProvider();
    provider.accounts = [];
    const wallet = new WalletSession(provider, signerFactory);
    await wallet.restore();
    expect(wallet.snapshot().connected).toBe(false);
    provider.emit('chainChanged', '0x1');
    expect(wallet.snapshot()).toMatchObject({ chainId: 1, correctChain: false });
    provider.switchError = { code: 4902 };
    await wallet.switchToDeploymentChain();
    expect(provider.calls).toContain('wallet_addEthereumChain');
  });
});

describe('explicit transaction workflows', () => {
  const transaction = () =>
    ({
      hash: '0xtransaction',
      wait: vi.fn(async () => ({ status: 1 })),
    }) as never;
  const method = () => {
    const call = vi.fn(async () => transaction());
    return Object.assign(call, { estimateGas: vi.fn(async () => 21_000n) });
  };
  const setup = () => {
    const read = context();
    const approve = vi.fn(async () => transaction());
    const depositMethod = method();
    const withdrawMethod = method();
    const write: WriteContext = {
      baseAsset: { approve },
      liquidity: { deposit: depositMethod, withdrawWithDeadline: withdrawMethod },
    };
    const dependencies: TransactionDependencies = {
      read: vi.fn(async () => read),
      write: vi.fn(() => write),
      now: () => Date.parse('2026-08-03T00:00:00Z'),
    };
    const wallet = { address: '0x0000000000000000000000000000000000000001' } as WalletSession;
    return { read, write, approve, depositMethod, withdrawMethod, dependencies, wallet };
  };

  it('approves only the exact value, supports revoke and emits lifecycle states', async () => {
    const { approve, dependencies, wallet } = setup();
    const states: TransactionState[] = [];
    await approveExact(wallet, 123n, (state) => states.push(state), dependencies);
    expect(approve).toHaveBeenCalledWith(deployment.contracts.liquidityManager, 123n);
    expect(states.map(({ state }) => state)).toEqual(['awaiting-wallet', 'pending', 'confirmed']);
    await revokeApproval(wallet, undefined, dependencies);
    expect(approve).toHaveBeenLastCalledWith(deployment.contracts.liquidityManager, 0n);
  });

  it('preflights deposits and withdrawals before sending bounded writes', async () => {
    const { depositMethod, withdrawMethod, dependencies, wallet } = setup();
    await deposit(wallet, 3n, undefined, dependencies);
    expect(depositMethod.estimateGas).toHaveBeenCalledWith(3n);
    expect(depositMethod).toHaveBeenCalledWith(3n);
    await withdraw(wallet, 4n, undefined, 20, dependencies);
    expect(withdrawMethod.estimateGas).toHaveBeenCalledWith(4n, 1785716400n);
    expect(withdrawMethod).toHaveBeenCalledWith(4n, 1785716400n);
  });

  it('stops on safety gates and normalizes wallet rejection', async () => {
    const { read, dependencies, wallet } = setup();
    read.liquidity.depositsEnabled = vi.fn(async () => false);
    await expect(deposit(wallet, 1n, undefined, dependencies)).rejects.toThrow(
      'Deposits are disabled',
    );
    read.liquidity.withdrawsEnabled = vi.fn(async () => true);
    read.liquidity.canWithdraw = vi.fn(async () => [false, 'Liquidity unavailable'] as const);
    await expect(withdraw(wallet, 1n, undefined, 20, dependencies)).rejects.toThrow(
      'Liquidity unavailable',
    );
    expect(explainTransactionError({ code: 4001 })).toBe('The wallet request was rejected.');
    expect(explainTransactionError({ message: 'execution reverted: Policy denied' })).toBe(
      'Policy denied',
    );
  });
});
