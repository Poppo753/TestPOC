/**
 * Read-only contract for the contained WebGL architecture. This gate prevents
 * regression to a global scene, verifies progressive-enhancement markup and
 * checks that each active page maps to a genuinely separate scene module.
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENE_MANIFEST, THREE_VERSION } from '../assets/js/webgl/scene-manifest.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const expected = new Map([
  ['index.html', 'ownership'],
  ['pages/how-it-works.html', 'journey'],
  ['pages/protocol.html', 'protocol-stack'],
  ['pages/roadmap.html', 'roadmap-reactor'],
]);
const pages = [join(root, 'index.html'), join(root, 'app.html'), ...(await readdir(join(root, 'pages'))).filter((name) => name.endsWith('.html')).map((name) => join(root, 'pages', name))];
const failures = []; const found = new Map();

for (const path of pages) {
  const relative = path.slice(root.length + 1).replaceAll('\\', '/');
  const html = await readFile(path, 'utf8');
  const match = html.match(/data-webgl-scene="([^"]+)"/);
  const expectedScene = expected.get(relative);
  if (expectedScene && match?.[1] !== expectedScene) failures.push(`${relative}: expected scene ${expectedScene}`);
  if (!expectedScene && match) failures.push(`${relative}: editorial/application page must not mount WebGL`);
  if (!match) continue;
  const scene = match[1]; found.set(scene, relative);
  if (!SCENE_MANIFEST[scene]) failures.push(`${relative}: unknown scene ${scene}`);
  if ((html.match(/data-webgl-host/g) || []).length !== 1) failures.push(`${relative}: requires exactly one local WebGL host`);
  if (!html.includes('immersive-fallback')) failures.push(`${relative}: missing authored fallback`);
  if (!html.includes('data-webgl-status')) failures.push(`${relative}: missing status label`);
  if (!html.includes('site-features.js')) failures.push(`${relative}: missing feature bootstrap`);
}

for (const [relative, scene] of expected) if (found.get(scene) !== relative) failures.push(`${relative}: scene ${scene} was not found`);
const modules = new Set();
for (const [scene, config] of Object.entries(SCENE_MANIFEST)) {
  if (!Array.isArray(config.camera) || config.camera.length !== 3) failures.push(`${scene}: invalid camera`);
  if (!(config.fov > 20 && config.fov < 80)) failures.push(`${scene}: invalid field of view`);
  if (modules.has(config.module)) failures.push(`${scene}: scene modules must be unique`); modules.add(config.module);
  const modulePath = join(root, 'assets/js/webgl', config.module.replace('./', ''));
  if (!existsSync(modulePath)) failures.push(`${scene}: module missing at ${modulePath}`);
  else {
    const source = await readFile(modulePath, 'utf8');
    if (!source.includes('export function createScene')) failures.push(`${scene}: factory export missing`);
    if (/PointsMaterial|wireframe\s*:/.test(source)) failures.push(`${scene}: debug particle/wireframe vocabulary is forbidden`);
  }
}
if (!/^\d+\.\d+\.\d+$/.test(THREE_VERSION)) failures.push('Three.js version must be pinned exactly');

const css = await readFile(join(root, 'assets/css/webgl.css'), 'utf8');
if (!/body\s*>\s*\[data-site-header\][^{]*\{[^}]*z-index:\s*1000/s.test(css)) failures.push('Header wrapper must own the global navigation layer');
if (!/\.immersive-canvas[^\{]*\{[^}]*pointer-events:\s*none/s.test(css)) failures.push('Canvas must never intercept input');
if (/\.webgl-stage\s*\{[^}]*position:\s*fixed/s.test(css)) failures.push('Global fixed WebGL stage is forbidden');
if (!/\.immersive-viewport[^\{]*\{[^}]*position:\s*fixed/s.test(css)) failures.push('Authored scene must render as a full-viewport background');
if (!/\.immersive-shell[^\{]*\{[^}]*border:\s*0/s.test(css) || !/\.immersive-shell[^\{]*\{[^}]*box-shadow:\s*none/s.test(css)) failures.push('WebGL shell must not look like a bordered demo panel');

const obsolete = ['capital-world.js', 'page-controls.js', 'scroll-timeline.js'];
for (const name of obsolete) if (existsSync(join(root, 'assets/js/webgl', name))) failures.push(`Obsolete shared-world file remains: ${name}`);

if (failures.length) { console.error(failures.map((failure) => `- ${failure}`).join('\n')); process.exitCode = 1; }
else console.log(`WebGL2 contract passed: ${found.size} contained scenes, ${modules.size} unique factories, Three.js ${THREE_VERSION}.`);
