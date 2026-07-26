/**
 * Static release gate for the Interactive Demo.
 *
 * This validates architectural and editorial boundaries that are easy to
 * accidentally remove during future visual work. It complements, rather than
 * replaces, the behavioral engine test and browser review.
 */
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_VAULTS } from '../../assets/js/demo/data.js';
import { DEMO_SCHEMA_VERSION } from '../../assets/js/demo/storage.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const failures = [];
const required = [
  'demo/index.html',
  'assets/css/demo.css',
  'assets/js/demo/data.js',
  'assets/js/demo/storage.js',
  'assets/js/demo/engine.js',
  'assets/js/demo/controller.js',
];

for (const path of required) {
  try { await stat(join(root, path)); } catch { failures.push(`Missing demo file: ${path}`); }
}

const html = await readFile(join(root, 'demo/index.html'), 'utf8');
const controller = await readFile(join(root, 'assets/js/demo/controller.js'), 'utf8');
const shell = await readFile(join(root, 'assets/js/core/site-shell.js'), 'utf8');
const home = await readFile(join(root, 'index.html'), 'utf8');
const demoSource = [html, controller, await readFile(join(root, 'assets/js/demo/engine.js'), 'utf8')].join('\n');

for (const route of ['overview', 'vaults', 'portfolio', 'activity', 'transparency']) {
  if (!html.includes(`data-demo-route="${route}"`)) failures.push(`Missing demo route: ${route}`);
}
for (const token of ['noindex,nofollow', 'No wallet, blockchain or real funds', 'data-demo-reset']) {
  if (!html.includes(token)) failures.push(`Missing demo boundary token: ${token}`);
}
if (/from ['"][^'"]*web3\//.test(demoSource)) failures.push('Demo code must not import Web3 modules.');
if (DEMO_SCHEMA_VERSION !== 1) failures.push('Unexpected demo schema version.');
if (!shell.includes('demo/index.html') || !home.includes('demo/index.html')) failures.push('Demo must be linked from the shared shell and landing page.');

const ids = new Set();
for (const vault of DEMO_VAULTS) {
  if (ids.has(vault.id)) failures.push(`Duplicate demo vault id: ${vault.id}`);
  ids.add(vault.id);
  const total = vault.allocations.reduce((sum, allocation) => sum + allocation.percent, 0);
  if (total !== 100) failures.push(`Allocations for ${vault.id} total ${total}, expected 100.`);
  if (!vault.risks.length || !vault.apy || !vault.liquidity) failures.push(`Incomplete illustrative profile: ${vault.id}`);
}
if (DEMO_VAULTS.length !== 3) failures.push('The reviewed demo requires exactly three comparable illustrative profiles.');

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log('Interactive Demo validation passed: files, routes, disclaimers, allocations and Web3 separation.');
}

