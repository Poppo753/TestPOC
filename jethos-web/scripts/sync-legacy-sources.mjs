import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const legacyRoot = resolve(projectRoot, '..', 'dapp-new');
const manifestPath = resolve(projectRoot, 'src/content/legacy-manifest.json');

const copyRoots = [
  ['assets/brand', 'public/assets/brand'],
  ['data', 'src/content/data'],
  ['content/docs', 'src/content/docs'],
  ['content/docs', 'public/content/docs'],
  ['assets/js/webgl/scenes', 'src/features/webgl/legacy/scenes'],
  ['assets/js/demo', 'src/features/demo/legacy'],
  ['assets/js/app', 'src/features/app/legacy'],
];

const copyFiles = [
  ['assets/css/pages.css', 'src/styles/legacy/pages.css'],
  ['assets/css/webgl.css', 'src/styles/legacy/webgl.css'],
  ['assets/css/documentation.css', 'src/styles/legacy/documentation.css'],
  ['assets/css/home-refresh.css', 'src/styles/legacy/home-refresh.css'],
  ['assets/css/demo.css', 'src/styles/legacy/demo.css'],
  ['assets/js/webgl/visual-kit.js', 'src/features/webgl/legacy/visual-kit.js'],
];

const redirectFiles = ['config.html', 'documentation.html', 'landing.html', 'portfolio.html'];
const redirectsPath = resolve(projectRoot, 'src/config/legacy-redirects.json');
const mode = process.argv[2];

if (!['--check', '--write'].includes(mode)) {
  throw new Error('Usage: node scripts/sync-legacy-sources.mjs --check|--write');
}

const toPosix = (value) => value.split(sep).join('/');
const hash = (value) => createHash('sha256').update(value).digest('hex');

async function listFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) => {
        const entryPath = resolve(root, entry.name);
        return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
      }),
  );

  return nested.flat();
}

async function buildSources() {
  const sources = [];

  for (const [sourceDirectory, targetDirectory] of copyRoots) {
    const sourceRoot = resolve(legacyRoot, sourceDirectory);
    for (const source of await listFiles(sourceRoot)) {
      const suffix = relative(sourceRoot, source);
      const target = resolve(projectRoot, targetDirectory, suffix);
      const bytes = await readFile(source);
      sources.push({
        source,
        target,
        bytes,
        sourcePath: toPosix(relative(legacyRoot, source)),
        targetPath: toPosix(relative(projectRoot, target)),
        sha256: hash(bytes),
      });
    }
  }

  for (const [sourcePath, targetPath] of copyFiles) {
    const source = resolve(legacyRoot, sourcePath);
    const target = resolve(projectRoot, targetPath);
    const bytes = await readFile(source);
    sources.push({
      source,
      target,
      bytes,
      sourcePath,
      targetPath,
      sha256: hash(bytes),
    });
  }

  return sources.sort(
    (left, right) =>
      left.sourcePath.localeCompare(right.sourcePath) ||
      left.targetPath.localeCompare(right.targetPath),
  );
}

async function buildRedirects() {
  const redirects = {};

  for (const fileName of redirectFiles) {
    const html = await readFile(resolve(legacyRoot, fileName), 'utf8');
    const match = html.match(/http-equiv=["']refresh["'][^>]+content=["']0;url=([^"']+)["']/i);
    if (!match) throw new Error(`Redirect target missing in ${fileName}`);
    redirects[`/${fileName}`] = `/${match[1]}`;
  }

  return redirects;
}

const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;

async function expectedArtifacts() {
  const sources = await buildSources();
  const redirects = await buildRedirects();
  const manifest = {
    schemaVersion: 1,
    generatedFrom: '../dapp-new',
    files: sources.map(({ sourcePath, targetPath, sha256 }) => ({
      sourcePath,
      targetPath,
      sha256,
    })),
    redirects,
  };

  return { sources, redirects: serialize(redirects), manifest: serialize(manifest) };
}

async function writeArtifacts() {
  const artifacts = await expectedArtifacts();
  for (const source of artifacts.sources) {
    await mkdir(dirname(source.target), { recursive: true });
    await writeFile(source.target, source.bytes);
  }
  await mkdir(dirname(redirectsPath), { recursive: true });
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(redirectsPath, artifacts.redirects);
  await writeFile(manifestPath, artifacts.manifest);
  globalThis.console.log(
    `Synced ${artifacts.sources.length} source files and ${redirectFiles.length} redirects.`,
  );
}

async function assertExact(path, expected, label) {
  let actual;
  try {
    actual = await readFile(path);
  } catch {
    throw new Error(`${label} is missing: ${toPosix(relative(projectRoot, path))}`);
  }

  const expectedBytes = Buffer.isBuffer(expected) ? expected : Buffer.from(expected);
  if (!actual.equals(expectedBytes)) {
    throw new Error(`${label} drifted: ${toPosix(relative(projectRoot, path))}`);
  }
}

async function assertNoUnexpectedFiles(sources) {
  for (const [, targetDirectory] of copyRoots) {
    const targetRoot = resolve(projectRoot, targetDirectory);
    const expected = new Set(
      sources
        .filter(({ target }) => target.startsWith(`${targetRoot}${sep}`))
        .map(({ target }) => target),
    );
    for (const target of await listFiles(targetRoot)) {
      if (!expected.has(target)) {
        throw new Error(`Unexpected synced file: ${toPosix(relative(projectRoot, target))}`);
      }
    }
  }
}

async function checkArtifacts() {
  const artifacts = await expectedArtifacts();
  for (const source of artifacts.sources) {
    await assertExact(source.target, source.bytes, 'Synced source');
  }
  await assertNoUnexpectedFiles(artifacts.sources);
  await assertExact(redirectsPath, artifacts.redirects, 'Redirect map');
  await assertExact(manifestPath, artifacts.manifest, 'Source manifest');
  globalThis.console.log(
    `Parity verified for ${artifacts.sources.length} files and ${redirectFiles.length} redirects.`,
  );
}

await (mode === '--write' ? writeArtifacts() : checkArtifacts());
