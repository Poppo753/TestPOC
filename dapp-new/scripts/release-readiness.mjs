/**
 * One-command, read-only release gate. Each child command is intentionally
 * independent so its output remains useful when another gate fails.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scripts = dirname(fileURLToPath(import.meta.url));
const checks = [
  ['Static site', 'validation/validate-site.mjs'],
  ['Editorial contract', 'validation/check-content.mjs'],
  ['Product narrative', 'validation/validate-product-content.mjs'],
  ['Interactive Demo structure', 'validation/validate-demo.mjs'],
  ['Interactive Demo engine', 'validation/test-demo-engine.mjs'],
  ['Contained WebGL2', 'validation/validate-webgl.mjs'],
  ['Documentation reader', 'validation/validate-documentation.mjs'],
  ['Deployment state', 'diagnostics/check-deployment.mjs'],
  ['Protocol registry', 'diagnostics/inspect-protocols.mjs'],
];

let failed = false;
for (const [label, script] of checks) {
  console.log(`\n[${label}]`);
  const result = spawnSync(process.execPath, [join(scripts, script)], { stdio: 'inherit' });
  if (result.status !== 0) { failed = true; console.error(`${label} failed.`); }
}
if (failed) process.exitCode = 1;
else console.log('\nRelease readiness passed. This is not an audit or production authorization.');
