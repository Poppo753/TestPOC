/** Runtime smoke test for the browser-only Interactive Demo. */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const base = (process.argv[2] || 'http://127.0.0.1:4175').replace(/\/$/, '');
const candidates = process.platform === 'win32' ? [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
] : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/microsoft-edge'];
const browser = process.env.JETHOS_BROWSER || candidates.find(existsSync);
if (!browser) { console.error('No supported Chromium browser found. Set JETHOS_BROWSER.'); process.exit(1); }

const profile = mkdtempSync(join(tmpdir(), 'jethos-demo-smoke-'));
try {
  const result = spawnSync(browser, [
    '--headless=new',
    '--no-first-run',
    '--disable-extensions',
    '--virtual-time-budget=4000',
    `--user-data-dir=${profile}`,
    '--dump-dom',
    `${base}/demo/index.html#overview`,
  ], { encoding: 'utf8', timeout: 20000, maxBuffer: 12 * 1024 * 1024 });
  if (result.error) throw result.error;
  const dom = result.stdout;
  const required = [
    'class="auth-gate"',
    'Everything visible. Every action explicit.',
    'Total simulated value',
    'data-demo-route="transparency"',
    'No wallet, blockchain or real funds',
  ];
  const missing = required.filter((token) => !dom.includes(token));
  if (missing.length) {
    console.error(`Interactive Demo browser smoke missing: ${missing.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('Interactive Demo browser smoke passed: auth, overview, balances, navigation and disclaimer rendered.');
  }
} finally {
  rmSync(profile, { recursive: true, force: true });
}
