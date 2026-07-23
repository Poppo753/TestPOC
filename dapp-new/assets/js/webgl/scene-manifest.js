/**
 * Only pages where spatial representation adds meaning may mount WebGL.
 * Every entry resolves to a separate scene factory; configuration no longer
 * disguises one shared world as multiple experiences.
 */
export const THREE_VERSION = '0.185.1';

export const SCENE_MANIFEST = Object.freeze({
  ownership: { module: './scenes/ownership-core.js', camera: [0, .15, 7.8], fov: 38, maxFps: 60 },
  journey: { module: './scenes/capital-journey.js', camera: [0, .72, 6.35], fov: 40, maxFps: 45 },
  'protocol-stack': { module: './scenes/protocol-stack.js', camera: [5.1, 3.6, 6.7], fov: 38, maxFps: 45 },
  'roadmap-reactor': { module: './scenes/evidence-reactor.js', camera: [0, .35, 6.9], fov: 40, maxFps: 60 },
});

export function getSceneConfig(name) { return SCENE_MANIFEST[name] || null; }
