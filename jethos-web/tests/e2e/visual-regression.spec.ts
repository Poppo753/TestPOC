import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1395, height: 900 } });

const output = resolve('artifacts/enterprise-final');
const surfaces = [
  ['home', '/index.html?webgl=off', 'Home banking, rebuilt around ownership.'],
  ['docs', '/pages/docs.html', 'Start with the question you need answered.'],
  ['demo', '/demo/index.html#overview', 'One balance. Two clear sides.'],
  ['app', '/app.html', 'USDC Conservative PoC'],
] as const;

test.describe('reviewable visual matrix', () => {
  for (const [name, path, heading] of surfaces) {
    test(`${name} captures a deterministic desktop artifact`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop-edge', 'Desktop review artifact only.');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      if (name === 'app') {
        await page.route('https://arb1.arbitrum.io/**', (route) => route.abort('connectionfailed'));
      }
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
      await expect(page.locator('[data-site-header]')).toHaveCSS('position', 'fixed');
      if (name === 'app') {
        await expect(page.locator('#data-status')).toContainText('failed', { timeout: 15_000 });
      }
      await mkdir(output, { recursive: true });
      await page.screenshot({
        path: resolve(output, `${name}-desktop.png`),
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
});
