/**
 * Dependency-free structural validation for the static site.
 *
 * Usage from dapp-new:
 *   node scripts/validation/validate-site.mjs
 *
 * This is intentionally not a browser test. It catches broken local assets,
 * duplicate IDs, invalid JSON, missing page metadata, obsolete deployment
 * addresses in active modules and high-risk marketing claims. Browser and RPC
 * verification remain separate because they depend on Edge/Chrome and network.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEPLOYMENT } from '../../assets/js/web3/deployment-config.js';
import { SITE, STATUS_TAXONOMY } from '../../assets/js/config/site-config.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '../..');
const failures = [];

async function walk(directory) {
  const output = [];
  for (const name of await readdir(directory)) {
    const path = join(directory, name);
    const info = await stat(path);
    if (info.isDirectory()) output.push(...await walk(path)); else output.push(path);
  }
  return output;
}

const files = await walk(root);
const operationalFiles = files.filter((path) => !path.startsWith(join(root, 'legacy')) && !path.startsWith(join(root, 'artifacts')));
const htmlFiles = operationalFiles.filter((path) => extname(path) === '.html');
const jsonFiles = operationalFiles.filter((path) => extname(path) === '.json' && path.startsWith(join(root, 'data')));

for (const [, path] of SITE.navigation) {
  try { await stat(join(root, path)); } catch { failures.push(`Shell navigation target missing: ${path}`); }
}
for (const [, entries] of SITE.footer) for (const [, path] of entries) {
  try { await stat(join(root, path)); } catch { failures.push(`Shell footer target missing: ${path}`); }
}
for (const requiredStatus of ['live', 'implemented', 'poc', 'planned', 'vision', 'illustrative']) {
  if (!STATUS_TAXONOMY[requiredStatus]) failures.push(`Shell status taxonomy missing: ${requiredStatus}`);
}

for (const path of jsonFiles) {
  try { JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { failures.push(`Invalid JSON ${path}: ${error.message}`); }
}

for (const path of htmlFiles) {
  const html = await readFile(path, 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  for (const id of new Set(ids)) if (ids.filter((value) => value === id).length > 1) failures.push(`Duplicate id "${id}" in ${path}`);

  if (!html.includes('<title>')) failures.push(`Missing title in ${path}`);
  if (!html.includes('http-equiv="refresh"')) {
    const h1Count = (html.match(/<h1\b/g) || []).length;
    if (h1Count !== 1) failures.push(`Expected one h1, found ${h1Count} in ${path}`);
    if (!html.includes('name="description"')) failures.push(`Missing description in ${path}`);
  }

  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const reference = match[1].split(/[?#]/)[0];
    if (!reference || /^(https?:|mailto:|data:)/.test(reference)) continue;
    const target = resolve(dirname(path), reference);
    try { await stat(target); } catch { failures.push(`Broken local reference ${reference} in ${path}`); }
  }
}

const activeFiles = operationalFiles.filter((path) => /[\\/](assets|data|pages)[\\/]/.test(path) || /[\\/](index|app)\.html$/.test(path));
const activeText = (await Promise.all(activeFiles.map((path) => readFile(path, 'utf8').catch(() => '')))).join('\n');
for (const phrase of ['Maximum Yield', 'Every Protocol', 'No-Risk', 'fully audited']) {
  if (activeText.includes(phrase)) failures.push(`Disallowed claim found: ${phrase}`);
}
for (const oldAddress of [
  '0xdB997aBb94D11DfE6a10A866cce5a3eF9f804870',
  '0xfb26C7A0CF5b4e86Dcf870b2349A29DA4F630150',
  '0x8750344c6cf493f4F5d13F52b7F7Bf1d285978e1',
  '0x2E042874BcFc6bE51e0D6b23F8Da22bDd8B215B0',
]) if (activeText.toLowerCase().includes(oldAddress.toLowerCase())) failures.push(`Obsolete ETH deployment address found: ${oldAddress}`);

// The browser config is executable JavaScript while deployments.json is the
// public record. Compare the active entry so they cannot silently diverge.
try {
  const deploymentData = JSON.parse(await readFile(join(root, 'data', 'protocol', 'deployments.json'), 'utf8'));
  const record = deploymentData.deployments.find((entry) => entry.id === DEPLOYMENT.id);
  if (!record) failures.push(`Deployment ${DEPLOYMENT.id} missing from data/protocol/deployments.json`);
  else {
    if (record.chainId !== DEPLOYMENT.chain.id) failures.push('Deployment chainId mismatch between JSON and JS config');
    if (record.baseAsset.address.toLowerCase() !== DEPLOYMENT.baseAsset.address.toLowerCase()) failures.push('Base asset address mismatch between JSON and JS config');
    for (const [name, address] of Object.entries(record.contracts)) {
      if (DEPLOYMENT.contracts[name]?.toLowerCase() !== address.toLowerCase()) failures.push(`Contract mismatch for ${name}`);
    }
  }
} catch (error) { failures.push(`Unable to compare deployment sources: ${error.message}`); }

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Site validation passed: ${htmlFiles.length} HTML pages, ${jsonFiles.length} data files.`);
}
