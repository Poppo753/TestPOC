/** Runtime smoke test for the shared private-preview gate. */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const base = (process.argv[2] || 'http://127.0.0.1:4174').replace(/\/$/, '');
const candidates = process.platform === 'win32' ? [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
] : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/microsoft-edge'];
const browser = process.env.JETHOS_BROWSER || candidates.find(existsSync);
if (!browser) { console.error('No supported Chromium browser found. Set JETHOS_BROWSER.'); process.exit(1); }

const profile = mkdtempSync(join(tmpdir(), 'jethos-auth-smoke-'));
try {
  const result = spawnSync(browser, ['--headless=new', '--no-first-run', '--disable-extensions', '--virtual-time-budget=3000', `--user-data-dir=${profile}`, '--dump-dom', `${base}/pages/docs.html`], { encoding: 'utf8', timeout: 20000, maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw result.error;
  const dom = result.stdout;
  const required = ['data-auth-state="locked"', 'class="auth-gate"', 'Enter Jethos', 'name="username"', 'name="password"'];
  const missing = required.filter((token) => !dom.includes(token));
  if (missing.length) { console.error(`Authentication gate missing: ${missing.join(', ')}`); process.exitCode = 1; }
  else console.log('Browser authentication smoke passed: shared preview gate is locked and rendered.');
} finally { rmSync(profile, { recursive: true, force: true }); }
