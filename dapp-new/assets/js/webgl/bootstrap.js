import { getSceneConfig } from './scene-manifest.js';
import { detectQuality, supportsWebGL2 } from './quality-manager.js';
import { loadThree } from './three-loader.js';
import { SceneController } from './scene-controller.js';
import { bindSceneInteractions } from './interaction-bridge.js';
import { installRoadmapGame } from './roadmap-game.js';
import { activateFallback } from './fallback.js';

let active;

/** Mount an optional scene; failures preserve the authored CSS fallback. */
export async function initWebGLExperience() {
  const sceneName = document.body.dataset.webglScene;
  const config = getSceneConfig(sceneName);
  const host = document.querySelector('[data-webgl-host]');
  if (!sceneName || !config || !host || active) return null;
  const quality = detectQuality();
  document.documentElement.dataset.webglQuality = quality.level;
  if (quality.level === 'off') { activateFallback('forced-off'); return null; }
  if (!supportsWebGL2()) { activateFallback('webgl2-unsupported'); return null; }

  const canvas = document.createElement('canvas');
  canvas.className = 'immersive-canvas'; canvas.setAttribute('aria-hidden', 'true'); canvas.tabIndex = -1; host.append(canvas);
  try {
    const [THREE, module] = await Promise.all([loadThree(), import(config.module)]);
    if (typeof module.createScene !== 'function') throw new TypeError(`Scene factory missing: ${sceneName}`);
    const controller = new SceneController(THREE, host, canvas, config, quality, sceneName, module.createScene); active = controller;
    const unbind = bindSceneInteractions(controller, sceneName);
    if (sceneName === 'roadmap-reactor') installRoadmapGame(controller);
    controller.start(); document.documentElement.dataset.webglState = 'ready';
    document.querySelector('[data-webgl-status]')?.replaceChildren(document.createTextNode(quality.reducedMotion ? 'Static 3D composition' : `Live 3D · ${quality.level}`));
    addEventListener('pagehide', () => { unbind(); controller.dispose(); active = null; }, { once: true });
    return controller;
  } catch (error) {
    activateFallback(error.name || 'load-error', canvas);
    console.warn('Jethos immersive enhancement unavailable:', error.message);
    return null;
  }
}

