import type { SceneConfig, SceneName } from './contracts';

export const sceneManifest = {
  ownership: {
    load: () => import('./legacy/scenes/ownership-core.js'),
    camera: [0, 0.15, 7.8],
    fov: 38,
    maxFps: 60,
  },
  journey: {
    load: () => import('./legacy/scenes/capital-journey.js'),
    camera: [0, 0.72, 6.35],
    fov: 40,
    maxFps: 45,
  },
  'protocol-stack': {
    load: () => import('./legacy/scenes/protocol-stack.js'),
    camera: [5.1, 3.6, 6.7],
    fov: 38,
    maxFps: 45,
  },
  'roadmap-reactor': {
    load: () => import('./legacy/scenes/evidence-reactor.js'),
    camera: [0, 0.35, 6.9],
    fov: 40,
    maxFps: 60,
  },
} as const satisfies Record<SceneName, SceneConfig>;

export const isSceneName = (value: string | undefined): value is SceneName =>
  Boolean(value && Object.hasOwn(sceneManifest, value));
