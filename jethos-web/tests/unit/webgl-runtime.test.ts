import { describe, expect, it } from 'vitest';

import { qualityFromSignals } from '../../src/features/webgl/quality';
import { roadmapGates } from '../../src/features/webgl/roadmap-game';
import { isSceneName, sceneManifest } from '../../src/features/webgl/scene-manifest';

const capable = {
  override: null,
  reducedMotion: false,
  saveData: false,
  memory: 8,
  cores: 8,
  narrow: false,
};

describe('WebGL runtime contracts', () => {
  it('exposes every versioned scene through lazy factories', () => {
    expect(Object.keys(sceneManifest)).toEqual([
      'ownership',
      'journey',
      'protocol-stack',
      'roadmap-reactor',
    ]);
    expect(isSceneName('ownership')).toBe(true);
    expect(isSceneName('unknown')).toBe(false);
    expect(
      Object.values(sceneManifest).every(
        ({ load, maxFps }) => typeof load === 'function' && maxFps <= 60,
      ),
    ).toBe(true);
  });

  it('selects deterministic budgets for accessibility and device constraints', () => {
    expect(qualityFromSignals(capable).level).toBe('high');
    expect(qualityFromSignals({ ...capable, override: 'off' }).level).toBe('off');
    expect(qualityFromSignals({ ...capable, reducedMotion: true }).level).toBe('static');
    expect(qualityFromSignals({ ...capable, saveData: true }).level).toBe('low');
    expect(qualityFromSignals({ ...capable, narrow: true }).level).toBe('medium');
    expect(qualityFromSignals({ ...capable, override: 'low' }).level).toBe('low');
  });

  it('keeps the evidence game complete and unambiguous', () => {
    expect(roadmapGates).toHaveLength(5);
    for (const gate of roadmapGates) {
      expect(gate.answers).toHaveLength(3);
      expect(gate.answers[gate.correct]).toBeTruthy();
    }
  });
});
