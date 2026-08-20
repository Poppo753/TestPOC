import { THREE_VERSION } from './scene-manifest.js';

/**
 * Optional Blender/GLB entry point. Procedural scenes do not depend on assets;
 * a future art pass can call this without changing bootstrap or lifecycle.
 */
export async function loadGLTF(url, { timeout = 10000 } = {}) {
  const loaderUrl = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/loaders/GLTFLoader.js`;
  const { GLTFLoader } = await import(loaderUrl);
  const request = new Promise((resolve, reject) => new GLTFLoader().load(url, resolve, undefined, reject));
  const expiry = new Promise((_, reject) => setTimeout(() => reject(new Error(`GLB timed out: ${url}`)), timeout));
  return Promise.race([request, expiry]);
}

