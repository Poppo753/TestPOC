/** Optional runtime diagnostics. Enable with ?webglDebug=1. */
export function createDebugPanel(host, renderer, sceneName, quality) {
  if (new URLSearchParams(location.search).get('webglDebug') !== '1') return { update() {}, dispose() {} };
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
      fps = Math.round(frames * 1000 / (time - last));
      frames = 0;
      last = time;
      const info = renderer.info.render;
      const motion = sceneState
        ? `\nphase ${sceneState.phase} · mouse ${sceneState.pointer} · wave ${sceneState.wave}`
        : '';
      panel.textContent = `scene ${sceneName}\nquality ${quality.level} · ${fps} fps\ndraw ${info.calls} · triangles ${info.triangles}${motion}`;
    },
    dispose() { panel.remove(); },
  };
}
