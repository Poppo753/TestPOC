import { describe, expect, it } from 'vitest';

import { calculateFloatingPopoverPlacement } from '../../src/core/floating-popover';
import { candidatesFor } from '../../src/features/home/architecture-map/model';
import { grossYield, STRATEGIES } from '../../src/features/home/strategy-inspector/model';

describe('complex Home models', () => {
  it('inherits route candidates by selected risk tier', () => {
    expect(candidatesFor('arbitrum', 'usdc', 'conservative')).toHaveLength(3);
    expect(candidatesFor('arbitrum', 'usdc', 'balanced')).toHaveLength(5);
    const opportunity = candidatesFor('arbitrum', 'usdc', 'opportunity');
    expect(opportunity).toHaveLength(7);
    expect(new Set(opportunity.map((candidate) => candidate.tier))).toEqual(
      new Set(['Conservative', 'Balanced', 'Opportunity']),
    );
  });

  it('keeps strategy allocations balanced and computes weighted yield', () => {
    for (const strategy of Object.values(STRATEGIES)) {
      expect(strategy.base.reduce((sum, route) => sum + route.percent, 0)).toBe(100);
      expect(strategy.pro.reduce((sum, route) => sum + route.percent, 0)).toBe(100);
      expect(grossYield(strategy)).toBeGreaterThanOrEqual(0);
    }
    expect(grossYield(STRATEGIES.balanced)).toBeCloseTo(5.76, 2);
  });

  it('keeps floating popovers inside the viewport and flips near the top', () => {
    const placement = calculateFloatingPopoverPlacement(
      { left: 2, right: 42, top: 40, bottom: 80, width: 40, height: 40 } as DOMRect,
      { width: 300, height: 180 },
      { width: 360 },
    );
    expect(placement.left).toBe(12);
    expect(placement.top).toBe(92);
    expect(placement.below).toBe(true);
  });
});
