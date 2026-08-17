import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const dist = resolve('dist');
const requiredRoutes = [
  'index.html',
  'app.html',
  'demo.html',
  'demo/index.html',
  ...[
    'changelog',
    'developers',
    'docs',
    'faq',
    'how-it-works',
    'protocol',
    'risk-transparency',
    'roadmap',
    'security',
    'team',
    'trust-center',
    'vaults',
    'vision',
  ].map((page) => `pages/${page}.html`),
  ...Array.from({ length: 13 }, (_, index) => `pages/docs/${String(index).padStart(2, '0')}.html`),
  'config.html',
  'documentation.html',
  'landing.html',
  'portfolio.html',
];

const missing = [];
for (const route of requiredRoutes) {
  try {
    await access(resolve(dist, route));
  } catch {
    missing.push(route);
  }
}

if (missing.length > 0) {
  throw new Error(`Static artifact is missing required routes:\n${missing.join('\n')}`);
}

const demoAlias = await readFile(resolve(dist, 'demo/index.html'), 'utf8');
if (!demoAlias.includes('data-page="demo"')) {
  throw new Error(
    'The /demo/index.html compatibility alias does not contain the demo application.',
  );
}

globalThis.console.log(
  `Static artifact contract passed (${requiredRoutes.length} required routes).`,
);
