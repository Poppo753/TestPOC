import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const aliases = [['dist/demo.html', 'dist/demo/index.html']];

for (const [source, target] of aliases) {
  const sourcePath = resolve(projectRoot, source);
  const targetPath = resolve(projectRoot, target);
  await mkdir(dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);
}

globalThis.console.log(`Finalized ${aliases.length} exact legacy output path.`);
