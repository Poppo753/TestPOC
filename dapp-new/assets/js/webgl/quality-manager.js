/** Device and user signals become explicit rendering budgets. */
export function detectQuality() {
  const override = new URLSearchParams(location.search).get('webgl');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = Boolean(navigator.connection?.saveData);
  const memory = Number(navigator.deviceMemory || 4);
  const cores = Number(navigator.hardwareConcurrency || 4);
  const narrow = matchMedia('(max-width: 700px)').matches;
  if (override === 'off') return budget('off', reducedMotion);
  if (reducedMotion) return budget('static', true);
  if (['low','medium','high'].includes(override)) return budget(override, false);
  if (saveData || memory <= 2 || cores <= 2) return budget('low', false);
  if (narrow || memory <= 4 || cores <= 4) return budget('medium', false);
  return budget('high', false);
}

function budget(level, reducedMotion) {
  const settings = {
    off: { fps: 0, dpr: 1, detail: 0 },
    static: { fps: 1, dpr: 1, detail: 1 },
    low: { fps: 30, dpr: 1, detail: 1 },
    medium: { fps: 45, dpr: 1.2, detail: 2 },
    high: { fps: 60, dpr: 1.5, detail: 3 },
  }[level];
  return Object.freeze({ level, reducedMotion, ...settings });
}

export function supportsWebGL2() {
  try { return Boolean(document.createElement('canvas').getContext('webgl2')); }
  catch { return false; }
}

