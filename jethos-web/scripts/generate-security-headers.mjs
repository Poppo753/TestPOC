import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const dist = resolve('dist');

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory() ? walk(join(directory, entry.name)) : join(directory, entry.name),
    ),
  );
  return files.flat();
}

const htmlFiles = (await walk(dist)).filter((file) => extname(file) === '.html');
const hashes = new Set();
const inlineScript = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/giu;

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  for (const match of html.matchAll(inlineScript)) {
    if (!match[1]) continue;
    const digest = createHash('sha256').update(match[1]).digest('base64');
    hashes.add(`'sha256-${digest}'`);
  }
}

const policy = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self' https://arb1.arbitrum.io",
  "font-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data:",
  "manifest-src 'self'",
  "object-src 'none'",
  `script-src 'self' ${[...hashes].sort().join(' ')}`,
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  'upgrade-insecure-requests',
].join('; ');

const headers = `/*
  Content-Security-Policy: ${policy}
  Cross-Origin-Opener-Policy: same-origin
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), geolocation=(), microphone=(), payment=(), usb=()

/_assets/*
  Cache-Control: public, max-age=31536000, immutable

/assets/*
  Cache-Control: public, max-age=86400
`;

await writeFile(resolve(dist, '_headers'), headers, 'utf8');
globalThis.console.log(`Security headers generated (${hashes.size} inline script hashes).`);
