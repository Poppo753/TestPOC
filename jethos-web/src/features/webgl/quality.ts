import type { QualityBudget, QualityLevel } from './contracts';

const settings: Record<QualityLevel, Pick<QualityBudget, 'fps' | 'dpr' | 'detail'>> = {
  off: { fps: 0, dpr: 1, detail: 0 },
  static: { fps: 1, dpr: 1, detail: 1 },
  low: { fps: 30, dpr: 1, detail: 1 },
  medium: { fps: 45, dpr: 1.2, detail: 2 },
  high: { fps: 60, dpr: 1.5, detail: 3 },
};

export interface QualitySignals {
  override?: string | null;
  reducedMotion: boolean;
  saveData: boolean;
  memory: number;
  cores: number;
  narrow: boolean;
}

export function qualityBudget(level: QualityLevel, reducedMotion: boolean): QualityBudget {
  return Object.freeze({ level, reducedMotion, ...settings[level] });
}

export function qualityFromSignals(signals: QualitySignals): QualityBudget {
  if (signals.override === 'off') return qualityBudget('off', signals.reducedMotion);
  if (signals.reducedMotion) return qualityBudget('static', true);
  if (signals.override && ['low', 'medium', 'high'].includes(signals.override)) {
    return qualityBudget(signals.override as QualityLevel, false);
  }
  if (signals.saveData || signals.memory <= 2 || signals.cores <= 2)
    return qualityBudget('low', false);
  if (signals.narrow || signals.memory <= 4 || signals.cores <= 4) {
    return qualityBudget('medium', false);
  }
  return qualityBudget('high', false);
}

export function detectQuality(): QualityBudget {
  const connection = navigator as Navigator & { connection?: { saveData?: boolean } };
  const device = navigator as Navigator & { deviceMemory?: number };
  return qualityFromSignals({
    override: new URLSearchParams(location.search).get('webgl'),
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: Boolean(connection.connection?.saveData),
    memory: Number(device.deviceMemory ?? 4),
    cores: Number(navigator.hardwareConcurrency || 4),
    narrow: matchMedia('(max-width: 700px)').matches,
  });
}

export function supportsWebGL2(): boolean {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}
