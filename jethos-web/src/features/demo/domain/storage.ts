import { demoAssets } from './catalog';
import type { DemoState } from './types';

export const demoSchemaVersion = 3 as const;
export const demoStorageKey = 'jethos-interactive-demo-v3';

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createInitialState(): DemoState {
  return {
    schemaVersion: demoSchemaVersion,
    walletAssets: Object.fromEntries(
      demoAssets.map((asset) => [asset.id, asset.value]),
    ) as DemoState['walletAssets'],
    positions: { 'conservative:plasma:usdc': { principal: 3280, daysAccrued: 0 } },
    activity: [],
    simulatedDays: 0,
    onboardingComplete: true,
  };
}

const validNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function isDemoState(value: unknown): value is DemoState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DemoState>;
  if (
    candidate.schemaVersion !== demoSchemaVersion ||
    !candidate.walletAssets ||
    !validNumber(candidate.simulatedDays)
  )
    return false;
  if (
    !candidate.positions ||
    typeof candidate.positions !== 'object' ||
    !Array.isArray(candidate.activity)
  )
    return false;
  if (!Object.values(candidate.walletAssets).every(validNumber)) return false;
  return Object.entries(candidate.positions).every(([id, position]) => {
    if (id.split(':').length !== 3 || !position || typeof position !== 'object') return false;
    const record = position as { principal?: unknown; daysAccrued?: unknown };
    return validNumber(record.principal) && validNumber(record.daysAccrued);
  });
}

export function loadDemoState(storage: StorageAdapter = window.localStorage): DemoState {
  try {
    const stored = storage.getItem(demoStorageKey);
    if (!stored) return createInitialState();
    const parsed: unknown = JSON.parse(stored);
    return isDemoState(parsed) ? parsed : createInitialState();
  } catch {
    return createInitialState();
  }
}

export const saveDemoState = (
  state: DemoState,
  storage: StorageAdapter = window.localStorage,
): void => storage.setItem(demoStorageKey, JSON.stringify(state));

export function clearDemoState(storage: StorageAdapter = window.localStorage): DemoState {
  storage.removeItem(demoStorageKey);
  return createInitialState();
}
