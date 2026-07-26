import { DEMO_ASSETS } from './data.js';

export const DEMO_SCHEMA_VERSION = 2;
export const DEMO_STORAGE_KEY = 'jethos-interactive-demo-v2';

export function createInitialState() {
  return {
    schemaVersion: DEMO_SCHEMA_VERSION,
    walletAssets: Object.fromEntries(DEMO_ASSETS.map((asset) => [asset.id, asset.value])),
    positions: {},
    activity: [],
    simulatedDays: 0,
    onboardingComplete: false,
  };
}

const validNumber = (value) => Number.isFinite(value) && value >= 0;

function isValidState(value) {
  if (!value || value.schemaVersion !== DEMO_SCHEMA_VERSION) return false;
  if (!value.walletAssets || !validNumber(value.simulatedDays)) return false;
  if (!value.positions || typeof value.positions !== 'object' || !Array.isArray(value.activity)) return false;
  if (!Object.values(value.walletAssets).every(validNumber)) return false;
  return Object.entries(value.positions).every(([id, position]) =>
    id.split(':').length === 3 && position && validNumber(position.principal) && validNumber(position.daysAccrued));
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
