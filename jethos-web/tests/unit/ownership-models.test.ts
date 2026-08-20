import { describe, expect, it } from 'vitest';

import { calculateSidePopoverPlacement } from '../../src/core/floating-popover';
import {
  baseVaults,
  contextLabel,
  scenarioAdjustment,
} from '../../src/features/home/ownership/vault-model';
import { walletAssets } from '../../src/features/home/ownership/wallet-allocation';

describe('Ownership models', () => {
  it('keeps wallet and vault allocations explicit and balanced', () => {
    expect(Object.keys(walletAssets)).toEqual(['usdc', 'usdt', 'btc', 'eth']);
    for (const vault of baseVaults) {
      expect(vault.allocations.reduce((sum, allocation) => sum + allocation.percent, 0)).toBe(100);
    }
  });

  it('derives scenario adjustments and readable context deterministically', () => {
    expect(scenarioAdjustment('base', 'ethereum', 'btc')).toBe(0);
    expect(scenarioAdjustment('pro', 'arbitrum', 'btc')).toBeCloseTo(1.1);
    expect(scenarioAdjustment('advanced', 'base', 'btc')).toBeCloseTo(2.5);
    expect(contextLabel('advanced', 'arbitrum', 'eth')).toBe('Arbitrum · ETH');
  });

  it('positions a side popover inside the viewport', () => {
    const placement = calculateSidePopoverPlacement(
      { left: 4, right: 64, top: 20, bottom: 60, width: 60, height: 40 } as DOMRect,
      { width: 220, height: 180 },
      { width: 360, height: 640 },
    );
    expect(placement.left).toBe(80);
    expect(placement.top).toBe(12);
  });
});
