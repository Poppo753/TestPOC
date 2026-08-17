import type { WebGLRenderer } from 'three';

import type { QualityBudget, SceneName } from './contracts';

interface DebugPanel {
  update(time: number, state?: Record<string, unknown>): void;
  dispose(): void;
}

export function createDebugPanel(
  host: HTMLElement,
  renderer: WebGLRenderer,
  sceneName: SceneName,
  quality: QualityBudget,
): DebugPanel {
  if (new URLSearchParams(location.search).get('webglDebug') !== '1') {
    return { update() {}, dispose() {} };
  }
  const panel = document.createElement('output');
  panel.className = 'webgl-debug';
  panel.setAttribute('aria-label', 'WebGL diagnostics');
  host.append(panel);
  let frames = 0;
  let last = performance.now();
  let fps = 0;
  return {
    update(time, sceneState) {
      frames += 1;
      if (time - last <= 500) return;
      fps = Math.round((frames * 1000) / (time - last));
      frames = 0;
      last = time;
      const info = renderer.info.render;
      const state = sceneState ? `\n${JSON.stringify(sceneState)}` : '';
      panel.textContent = `scene ${sceneName}\nquality ${quality.level} · ${fps} fps\ndraw ${info.calls} · triangles ${info.triangles}${state}`;
    },
    dispose() {
      panel.remove();
    },
  };
}
