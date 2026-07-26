/**
 * Runtime smoke test for the dynamic Markdown catalog and modal reader.
 * Usage: npm run check:docs:browser -- http://127.0.0.1:4173
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

function dump(path) {
  const profile = mkdtempSync(join(tmpdir(), 'jethos-docs-smoke-'));
  try {
    const result = spawnSync(browser, ['--headless=new', '--no-first-run', '--disable-extensions', '--virtual-time-budget=6000', `--user-data-dir=${profile}`, '--dump-dom', `${base}${path}`], { encoding: 'utf8', timeout: 20000, maxBuffer: 16 * 1024 * 1024 });
    if (result.error) throw result.error;
    return result.stdout;
  } finally { rmSync(profile, { recursive: true, force: true }); }
}

const catalog = dump('/pages/docs.html');
const viewer = dump('/pages/docs.html?doc=03');
const failures = [];
const entryCount = (catalog.match(/class="doc-entry"/g) || []).length;
if (entryCount !== 13) failures.push(`catalog rendered ${entryCount} entries instead of 13`);
if (!viewer.includes('class="document-dialog"') || !/<dialog[^>]*\sopen(?:="")?/.test(viewer)) failures.push('deep-linked reader did not open');
if (!viewer.includes('Protocol Architecture') || !viewer.includes('id="protocol-architecture"')) failures.push('Markdown content was not rendered');
if (!viewer.includes('download="03_Jethos_Protocol_Architecture_v0.1.md"')) failures.push('Markdown download action is missing');
if (/Documentation catalog unavailable|Document unavailable/.test(`${catalog}${viewer}`)) failures.push('runtime reported a documentation loading error');

if (failures.length) { console.error(failures.map((failure) => `- ${failure}`).join('\n')); process.exitCode = 1; }
else console.log('Browser documentation smoke passed: catalog, deep link, Markdown reader and download action.');
