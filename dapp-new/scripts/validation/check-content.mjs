/**
 * Editorial contract checker. This catches language that would overstate
 * custody, assurance or returns and confirms that the core message and status
 * labels remain present. It reads files only.
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
async function walk(directory) {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) result.push(...await walk(path));
    else if (extname(path) === '.html' || path.endsWith('site-content.json') || path.endsWith('site-config.js')) result.push(path);
  }
  return result;
}

const files = (await walk(root)).filter((path) => !path.includes(`${join(root, 'src')}`));
const entries = await Promise.all(files.map(async (path) => [path, await readFile(path, 'utf8')]));
const corpus = entries.map(([, content]) => content).join('\n').toLowerCase();
const failures = [];
const prohibited = ['risk-free', 'guaranteed yield', 'nobody can touch', 'fully audited', 'completely transparent'];
for (const claim of prohibited) if (corpus.includes(claim)) failures.push(`Prohibited or absolute claim: "${claim}"`);

const required = [
  'home banking, rebuilt around ownership',
  'jethos cannot move assets you have not deposited or separately approved',
  'private proof of concept',
  'does not guarantee returns',
];
for (const phrase of required) if (!corpus.includes(phrase)) failures.push(`Required message missing: "${phrase}"`);

for (const [path, content] of entries.filter(([path]) => path.endsWith('.html'))) {
  if (!content.includes('name="description"') && !content.includes('http-equiv="refresh"')) failures.push(`Missing description: ${path}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exitCode = 1;
} else console.log(`Content contract passed across ${entries.length} active sources.`);
