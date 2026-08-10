import { describe, expect, it } from 'vitest';

import {
  decisionRoutes,
  isDecisionRouteId,
} from '../../src/features/home/decision-runway/controller';
import { allocations } from '../../src/features/home/receipt-allocation/controller';
import { isPhaseId, phases } from '../../src/features/home/roadmap-strip/controller';

describe('simple Home feature models', () => {
  it('keeps the five product horizons explicit and finite', () => {
    expect(Object.keys(phases)).toEqual([
      'poc',
      'multi-asset',
      'multi-chain',
      'consumer',
      'vision',
    ]);
    expect(isPhaseId('multi-chain')).toBe(true);
    expect(isPhaseId('unknown')).toBe(false);
  });

  it('keeps receipt allocation balanced', () => {
    const total = Object.values(allocations).reduce(
      (sum, allocation) => sum + Number.parseInt(allocation.value, 10),
      0,
    );
    expect(total).toBe(100);
  });

  it('preserves three explainable decision outcomes', () => {
    expect(Object.keys(decisionRoutes)).toHaveLength(3);
    expect(decisionRoutes['route-c'].policy).toBe('Outside limit');
    expect(isDecisionRouteId('route-b')).toBe(true);
    expect(isDecisionRouteId('route-z')).toBe(false);
  });
});
