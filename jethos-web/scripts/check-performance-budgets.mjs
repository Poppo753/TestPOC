import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';

const dist = resolve('dist');
const limits = {
  largestJavaScript: 768 * 1024,
  totalJavaScript: 1_400 * 1024,
  largestStylesheet: 128 * 1024,
  totalStylesheets: 180 * 1024,
  largestHtml: 64 * 1024,
};

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory() ? walk(join(directory, entry.name)) : join(directory, entry.name),
    ),
  );
  return files.flat();
}

const files = await walk(dist);
const sizes = new Map(
  await Promise.all(files.map(async (file) => [file, (await stat(file)).size])),
);
const byExtension = (extension) => files.filter((file) => extname(file) === extension);
const total = (selected) => selected.reduce((sum, file) => sum + sizes.get(file), 0);
const largest = (selected) => Math.max(0, ...selected.map((file) => sizes.get(file)));
const js = byExtension('.js');
const css = byExtension('.css');
const html = byExtension('.html');

const measurements = {
  largestJavaScript: largest(js),
  totalJavaScript: total(js),
  largestStylesheet: largest(css),
  totalStylesheets: total(css),
  largestHtml: largest(html),
};
const failures = Object.entries(measurements).filter(([key, value]) => value > limits[key]);

const editorial = await readFile(resolve(dist, 'pages/vaults.html'), 'utf8');
if (/\/_assets\/(?:bootstrap|controller)\./u.test(editorial)) {
  failures.push(['editorialOptionalRuntime', 1]);
}

if (failures.length > 0) {
  const details = failures.map(([key, value]) => `${key}: ${value} (limit ${limits[key] ?? 0})`);
  throw new Error(`Performance budget failed:\n${details.join('\n')}`);
}

const largestJs = js.sort((a, b) => sizes.get(b) - sizes.get(a))[0];
globalThis.console.log(
  `Performance budgets passed (JS ${measurements.totalJavaScript} B total; largest ${relative(dist, largestJs)} ${sizes.get(largestJs)} B).`,
);
