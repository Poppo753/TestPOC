import type { DisposableController } from '../../core/disposable';
import { activateFallback } from './fallback';
import { bindSceneInteractions } from './interaction-bridge';
import { detectQuality, supportsWebGL2 } from './quality';
import { installRoadmapGame } from './roadmap-game';
import { SceneController } from './scene-controller';
import { isSceneName, sceneManifest } from './scene-manifest';

let active: DisposableController | undefined;

/** Mounts one optional scene. Failures leave the authored CSS visual and content intact. */
export async function initWebGLExperience(): Promise<DisposableController | null> {
  const sceneName = document.body.dataset.webglScene;
  const host = document.querySelector<HTMLElement>('[data-webgl-host]');
  if (!isSceneName(sceneName) || !host || active) return null;
  const quality = detectQuality();
  document.documentElement.dataset.webglQuality = quality.level;
  if (quality.level === 'off') {
    activateFallback('forced-off');
    return null;
  }
  if (!supportsWebGL2()) {
    activateFallback('webgl2-unsupported');
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.className = 'immersive-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.tabIndex = -1;
  host.append(canvas);
  try {
    const config = sceneManifest[sceneName];
    const module = await config.load();
    if (typeof module.createScene !== 'function')
      throw new TypeError(`Scene factory missing: ${sceneName}`);
    const controller = new SceneController(
      host,
      canvas,
      config,
      quality,
      sceneName,
      module.createScene,
    );
    const unbind = bindSceneInteractions(controller, sceneName);
    const uninstallGame =
      sceneName === 'roadmap-reactor' ? installRoadmapGame(controller) : () => {};
    const experience: DisposableController = {
      destroy() {
        uninstallGame();
        unbind();
        controller.dispose();
        active = undefined;
      },
    };
    active = experience;
    controller.start();
    document.documentElement.dataset.webglState = 'ready';
    document
      .querySelector('[data-webgl-status]')
      ?.replaceChildren(
        document.createTextNode(
          quality.reducedMotion ? 'Static 3D composition' : `Live 3D · ${quality.level}`,
        ),
      );
    window.addEventListener('pagehide', () => experience.destroy(), { once: true });
    return experience;
  } catch (error) {
    const reason = error instanceof Error ? error.name || 'load-error' : 'load-error';
    activateFallback(reason, canvas);
    console.warn('Jethos immersive enhancement unavailable:', error);
    return null;
  }
}
