import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const dist = resolve('dist');
const manifestPath = resolve(dist, 'release-manifest.json');

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory() ? walk(join(directory, entry.name)) : join(directory, entry.name),
    ),
  );
  return files.flat();
}

const files = (await walk(dist)).filter((file) => file !== manifestPath).sort();
const records = {};
for (const file of files) {
  const content = await readFile(file);
  records[relative(dist, file).replaceAll('\\', '/')] = {
    bytes: (await stat(file)).size,
    sha256: createHash('sha256').update(content).digest('hex'),
  };
}

const manifest = {
  schemaVersion: 1,
  artifact: '@jethos/web',
  fileCount: files.length,
  files: records,
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
globalThis.console.log(`Release manifest created (${files.length} hashed files).`);
