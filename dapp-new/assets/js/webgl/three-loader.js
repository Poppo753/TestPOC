import { THREE_VERSION } from './scene-manifest.js';

let pending;

/**
 * Three.js is lazy and pinned. Failure is expected and safe: bootstrap catches
 * it and retains the CSS fallback. A timeout prevents a blocked CDN from
 * leaving the page in a permanent loading state.
 */
export function loadThree({ timeout = 8000 } = {}) {
  if (pending) return pending;
  const url = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.min.js`;
  const importPromise = import(url);
  const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Three.js import timed out')), timeout));
  pending = Promise.race([importPromise, timeoutPromise]);
  return pending;
}

