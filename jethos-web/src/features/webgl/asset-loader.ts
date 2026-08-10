import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Local, version-locked GLB loader for future art passes; current scenes are procedural. */
export async function loadGLTF(url: string, timeout = 10_000) {
  let timer = 0;
  const request = new Promise((resolve, reject) =>
    new GLTFLoader().load(url, resolve, undefined, reject),
  );
  const expiry = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(`GLB timed out: ${url}`)), timeout);
  });
  try {
    return await Promise.race([request, expiry]);
  } finally {
    clearTimeout(timer);
  }
}
