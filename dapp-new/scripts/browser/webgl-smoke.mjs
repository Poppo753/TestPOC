/**
 * Runtime smoke gate using an installed Chromium browser, without dependencies.
 *
 * Usage:
 *   1. Serve dapp-new, for example: python -m http.server 4173
 *   2. npm run check:webgl:browser -- http://127.0.0.1:4173
 *
 * The script verifies runtime mount on all four pages and the explicit off
 * fallback. It does not replace manual visual/GPU/device review.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const base = (process.argv[2] || 'http://127.0.0.1:4173').replace(/\/$/, '');
const candidates = process.platform === 'win32' ? [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
] : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/microsoft-edge'];
const browser = process.env.JETHOS_BROWSER || candidates.find(existsSync);
if (!browser) { console.error('No supported Chromium browser found. Set JETHOS_BROWSER.'); process.exit(1); }

const cases = [
  ['/index.html', 'ownership'],
  ['/pages/how-it-works.html', 'journey'],
  ['/pages/protocol.html', 'protocol-stack'],
  ['/pages/roadmap.html', 'roadmap-reactor'],
];
const failures = [];

function dump(path) {
  const profile = mkdtempSync(join(tmpdir(), 'jethos-webgl-smoke-'));
  try {
    const result = spawnSync(browser, ['--headless=new','--no-first-run','--disable-extensions','--use-angle=swiftshader','--enable-unsafe-swiftshader','--virtual-time-budget=9000',`--user-data-dir=${profile}`,'--dump-dom',`${base}${path}`], { encoding: 'utf8', timeout: 20000, maxBuffer: 8 * 1024 * 1024 });
    if (result.error) throw result.error;
    return result.stdout;
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
}

for (const [path, scene] of cases) {
  const dom = dump(path);
  if (!dom.includes('data-webgl-state="ready"')) failures.push(`${path}: runtime did not reach ready`);
  if (!dom.includes('class="immersive-canvas"')) failures.push(`${path}: canvas was not mounted`);
  if (!dom.includes(`data-webgl-scene="${scene}"`)) failures.push(`${path}: wrong scene identity`);
  // The shared preview gate intentionally pauses shell rendering until valid
  // credentials are entered. In a clean headless profile, accept the locked
  // gate as the expected pre-auth state; auth has its own runtime smoke test.
  if (!dom.includes('class="site-header"') && !dom.includes('class="auth-gate"')) failures.push(`${path}: neither site header nor preview gate rendered`);
}
const fallback = dump('/index.html?webgl=off');
if (!fallback.includes('data-webgl-state="fallback"') || !fallback.includes('data-webgl-fallback="forced-off"')) failures.push('Forced-off fallback did not activate');
if (fallback.includes('class="immersive-canvas"')) failures.push('Forced-off mode mounted a canvas');

if (failures.length) { console.error(failures.map((failure) => `- ${failure}`).join('\n')); process.exitCode = 1; }
else console.log(`Browser WebGL2 smoke passed: ${cases.length} live scenes and forced-off fallback.`);
