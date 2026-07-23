/**
 * Static documentation gate: checks that the generated catalog is complete,
 * ordered and safe to consume, without modifying the canonical source pack.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = join(root, 'content', 'docs');
const failures = [];
let manifest;

try { manifest = JSON.parse(readFileSync(join(docsRoot, 'manifest.json'), 'utf8')); }
catch (error) { failures.push(`manifest.json is unavailable or invalid: ${error.message}`); }

if (manifest) {
  const documents = manifest.documents || [];
  const expected = Array.from({ length: 13 }, (_, index) => String(index).padStart(2, '0'));
  const ids = documents.map((document) => document.id);
  if (JSON.stringify(ids) !== JSON.stringify(expected)) failures.push(`expected ordered IDs 00-12, received ${ids.join(', ')}`);
  for (const document of documents) {
    const path = join(docsRoot, document.file || '');
    if (!existsSync(path)) { failures.push(`${document.id}: missing ${document.file}`); continue; }
    const markdown = readFileSync(path, 'utf8');
    if (!/^#\s+\S/m.test(markdown)) failures.push(`${document.id}: no level-one title`);
    if (/[ÃÂ]|â(?:€™|€œ|€|†)/.test(markdown)) failures.push(`${document.id}: likely character-encoding corruption`);
  }
}

const page = readFileSync(join(root, 'pages', 'docs.html'), 'utf8');
const controller = readFileSync(join(root, 'assets', 'js', 'docs', 'documentation.js'), 'utf8');
const renderer = readFileSync(join(root, 'assets', 'js', 'docs', 'markdown-renderer.js'), 'utf8');
for (const [label, source, tokens] of [
  ['docs page', page, ['data-doc-catalog', 'data-doc-dialog', 'data-doc-body', 'documentation.js']],
  ['docs controller', controller, ['fetch(manifestUrl', 'showModal()', 'renderMarkdown', 'history.pushState']],
  ['Markdown renderer', renderer, ['escapeHtml', 'renderMarkdown', 'function inline']],
]) for (const token of tokens) if (!source.includes(token)) failures.push(`${label}: missing ${token}`);

if (failures.length) { console.error(failures.map((failure) => `- ${failure}`).join('\n')); process.exitCode = 1; }
else console.log(`Documentation validation passed: ${manifest.documents.length} readable documents (00-12).`);
