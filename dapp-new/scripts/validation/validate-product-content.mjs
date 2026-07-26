/**
 * Validates the product narrative introduced by the Six_23.07.26 revision.
 * The gate prevents illustrative values, pending policy and recorded evidence
 * from silently collapsing into one undifferentiated marketing claim.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const failures = [];
const read = (path) => readFile(join(root, path), 'utf8');
const json = async (path) => JSON.parse(await read(path));

const product = await json('data/product/product-state.json');
const risk = await json('data/product/risk-policy.json');
const trust = await json('data/protocol/trust-evidence.json');
const changelog = await json('data/product/changelog.json');
const home = await read('index.html');
const app = await read('app.html');
const docs = await read('pages/docs.html');
const team = await read('pages/team.html');

if (product.horizons?.map(({ id }) => id).join(',') !== 'today,multi-asset,multi-chain,consumer,vision') failures.push('Product horizons must preserve the reviewed five-stage path.');
if (!risk.pendingDecisions?.length || !risk.illustrativeScenario?.notice) failures.push('Risk policy must preserve pending decisions and an illustrative notice.');
if (!trust.evidence?.some(({ status }) => status === 'unavailable')) failures.push('Trust evidence must expose unresolved fields.');
if (!trust.assuranceGates?.every(({ status }) => status && status !== 'Complete')) failures.push('No assurance gate may be silently marked complete.');
if (!changelog.entries?.length || changelog.entries.some((entry) => !entry.date || !entry.title || !entry.changes?.length)) failures.push('Changelog entries require date, title and changes.');

const homeOrder = ['class="hero"', 'class="product-horizons"', 'id="capital-boundary"', 'id="transparency"', 'id="current-product"', 'id="risk-intelligence"', 'id="financial-home"'];
let previous = -1;
for (const marker of homeOrder) {
  const index = home.indexOf(marker);
  if (index < 0) failures.push(`Homepage marker missing: ${marker}`);
  else if (index <= previous) failures.push(`Homepage narrative order is invalid at ${marker}`);
  previous = index;
}
for (const token of [
  'badge--illustrative',
  'USDC Conservative',
  'Not independently audited',
  'Multi-asset vaults',
  'Multi-chain vaults',
  'data-horizon-popover',
  'data-horizon-step="vision"',
  'data-ownership-dashboard',
  'data-vault-mode="base"',
  'data-vault-mode="pro"',
  'data-vault-mode="advanced"',
  'data-chain-filter',
  'data-token-filter',
  '24-word recovery phrase',
]) if (!home.includes(token)) failures.push(`Homepage evidence token missing: ${token}`);
for (const token of ['data-app-mode="simple"', 'data-app-mode="advanced"', 'transaction-summary', 'Major risks']) if (!app.includes(token)) failures.push(`PoC mode token missing: ${token}`);
for (const forbidden of ['docs/New_Doc/', 'npm run sync:docs', 'Loading documentation catalog']) if (docs.includes(forbidden)) failures.push(`Consumer Docs exposes internal implementation copy: ${forbidden}`);
if (!docs.includes('data-doc-count>13<') || (docs.match(/class="doc-entry"/g) || []).length !== 13) failures.push('Docs fallback must contain 13 selectable records.');
if (!team.includes('does not contain verified public biographies')) failures.push('Team page must retain its explicit disclosure boundary.');

if (failures.length) { console.error(failures.map((failure) => `- ${failure}`).join('\n')); process.exitCode = 1; }
else console.log('Product content validation passed: hierarchy, evidence boundaries, fallback Docs and PoC modes.');
