/**
 * Browser-only persistence boundary for the demo.
 *
 * The key contains "demo" intentionally: this state must never be interpreted
 * as an account record. Schema mismatches or malformed JSON reset to a known,
 * safe scenario rather than attempting speculative migrations.
 */
export const DEMO_SCHEMA_VERSION = 1;
export const DEMO_STORAGE_KEY = 'jethos-interactive-demo-v1';

export function createInitialState() {
  return {
    schemaVersion: DEMO_SCHEMA_VERSION,
    walletBalance: 10000,
    positions: {},
    activity: [],
    simulatedDays: 0,
    onboardingComplete: false,
  };
}

function validNumber(value) {
  return Number.isFinite(value) && value >= 0;
}

function isValidState(value) {
  if (!value || value.schemaVersion !== DEMO_SCHEMA_VERSION) return false;
  if (!validNumber(value.walletBalance) || !validNumber(value.simulatedDays)) return false;
  if (!value.positions || typeof value.positions !== 'object' || !Array.isArray(value.activity)) return false;
  return Object.values(value.positions).every((position) =>
    position && validNumber(position.principal) && validNumber(position.daysAccrued));
}

export function loadDemoState(storage = window.localStorage) {
  try {
    const stored = storage.getItem(DEMO_STORAGE_KEY);
    if (!stored) return createInitialState();
    const parsed = JSON.parse(stored);
    return isValidState(parsed) ? parsed : createInitialState();
  } catch {
    return createInitialState();
  }
}

export function saveDemoState(state, storage = window.localStorage) {
  storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
}

export function clearDemoState(storage = window.localStorage) {
  storage.removeItem(DEMO_STORAGE_KEY);
  return createInitialState();
}

