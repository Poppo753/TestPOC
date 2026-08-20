import { describe, expect, it } from 'vitest';

import {
  demoAssets,
  demoNetworks,
  demoVaults,
  vaultById,
  vaultId,
} from '../../src/features/demo/domain/catalog';
import {
  advanceDays,
  deposit,
  positionValue,
  summarize,
  withdraw,
} from '../../src/features/demo/domain/engine';
import {
  clearDemoState,
  createInitialState,
  demoStorageKey,
  isDemoState,
  loadDemoState,
  saveDemoState,
  type StorageAdapter,
} from '../../src/features/demo/domain/storage';

class MemoryStorage implements StorageAdapter {
  readonly records = new Map<string, string>();
  getItem(key: string) {
    return this.records.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.records.set(key, value);
  }
  removeItem(key: string) {
    this.records.delete(key);
  }
}

const now = new Date('2026-08-03T00:00:00.000Z');

describe('Demo domain', () => {
  it('preserves the complete product matrix and computed vault identities', () => {
    expect(demoAssets).toHaveLength(4);
    expect(demoNetworks).toHaveLength(5);
    expect(demoVaults).toHaveLength(3);
    expect(vaultId('balanced', 'arbitrum', 'eth')).toBe('balanced:arbitrum:eth');
    expect(vaultById('balanced:arbitrum:eth')).toMatchObject({
      name: 'Arbitrum ETH Balanced',
      apy: 0.062,
      riskScore: 3,
    });
    expect(vaultById('unknown')).toBeUndefined();
    expect(
      demoVaults.every(
        (vault) => vault.allocations.reduce((sum, route) => sum + route.percent, 0) === 100,
      ),
    ).toBe(true);
  });

  it('matches the legacy initial accounting and deterministic growth formula', () => {
    const state = createInitialState();
    expect(summarize(state)).toEqual({
      wallet: 9200,
      vaultValue: 3280,
      principal: 3280,
      earnings: 0,
      total: 12480,
      positionCount: 1,
    });
    advanceDays(state, 30, now);
    const vault = vaultById('conservative:plasma:usdc');
    expect(positionValue(state.positions['conservative:plasma:usdc'], vault)).toBe(3289.548466);
    expect(state.activity[0]).toMatchObject({
      type: 'Advanced 30 days',
      amount: 0,
      timestamp: now.toISOString(),
    });
  });

  it('deposits, compounds accrued value and supports partial or full withdrawal', () => {
    const state = createInitialState();
    advanceDays(state, 30, now);
    deposit(state, 'conservative:plasma:usdc', '500', now);
    expect(state.walletAssets.usdc).toBe(3400);
    expect(state.positions['conservative:plasma:usdc']).toEqual({
      principal: 3789.548466,
      daysAccrued: 0,
    });
    withdraw(state, 'conservative:plasma:usdc', 100, now);
    expect(state.walletAssets.usdc).toBe(3500);
    expect(state.positions['conservative:plasma:usdc']?.principal).toBe(3689.548466);
    withdraw(state, 'conservative:plasma:usdc', 3689.547, now);
    expect(state.positions['conservative:plasma:usdc']).toBeUndefined();
    expect(summarize(state).positionCount).toBe(0);
  });

  it('rejects invalid amounts, insufficient balances and impossible operations', () => {
    expect(() => deposit(createInitialState(), 'bad', 1)).toThrow('does not exist');
    expect(() => deposit(createInitialState(), 'balanced:plasma:usdc', 4000)).toThrow(
      'enough USDC',
    );
    expect(() => deposit(createInitialState(), 'balanced:plasma:usdc', 0)).toThrow(
      'greater than zero',
    );
    expect(() => withdraw(createInitialState(), 'balanced:plasma:usdc', 1)).toThrow('No position');
    expect(() => advanceDays({ ...createInitialState(), positions: {} }, 30)).toThrow('Deposit');
    expect(() => advanceDays(createInitialState(), 1.5)).toThrow('positive integer');
  });
});

describe('Demo state persistence', () => {
  it('round-trips schema v3 under the exact legacy storage key', () => {
    const storage = new MemoryStorage();
    const state = createInitialState();
    deposit(state, 'balanced:arbitrum:usdt', 200, now);
    saveDemoState(state, storage);
    expect(storage.records.has('jethos-interactive-demo-v3')).toBe(true);
    expect(loadDemoState(storage)).toEqual(state);
  });

  it('recovers safely from missing, corrupt or wrong-version data', () => {
    const storage = new MemoryStorage();
    expect(loadDemoState(storage)).toEqual(createInitialState());
    storage.setItem(demoStorageKey, '{broken');
    expect(loadDemoState(storage)).toEqual(createInitialState());
    storage.setItem(demoStorageKey, JSON.stringify({ ...createInitialState(), schemaVersion: 2 }));
    expect(loadDemoState(storage)).toEqual(createInitialState());
    expect(isDemoState({ ...createInitialState(), simulatedDays: -1 })).toBe(false);
  });

  it('clears only Demo state and returns a fresh baseline', () => {
    const storage = new MemoryStorage();
    storage.setItem(demoStorageKey, 'state');
    storage.setItem('unrelated', 'keep');
    expect(clearDemoState(storage)).toEqual(createInitialState());
    expect(storage.getItem(demoStorageKey)).toBeNull();
    expect(storage.getItem('unrelated')).toBe('keep');
  });
});
