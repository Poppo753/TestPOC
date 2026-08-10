import { expect, test } from '@playwright/test';

const scenes = [
  ['/', 'ownership'],
  ['/pages/how-it-works.html', 'journey'],
  ['/pages/protocol.html', 'protocol-stack'],
  ['/pages/roadmap.html', 'roadmap-reactor'],
] as const;

test.describe('progressive WebGL experience', () => {
  for (const [path, scene] of scenes) {
    test(`${scene} exposes an authored fallback without creating a canvas`, async ({ page }) => {
      await page.goto(`${path}?webgl=off`);
      await expect(page.locator('html')).toHaveAttribute('data-webgl-state', 'fallback');
      await expect(page.locator('html')).toHaveAttribute('data-webgl-fallback', 'forced-off');
      await expect(page.locator('[data-webgl-status]')).toHaveText('Static visual');
      await expect(page.locator('[data-webgl-host] canvas')).toHaveCount(0);
    });
  }

  test('journey and protocol controls remain semantic and synchronize selection', async ({
    page,
  }) => {
    await page.goto('/pages/how-it-works.html?webgl=low');
    await expect(page.locator('html')).toHaveAttribute('data-webgl-state', 'ready');
    const journey = page.locator('[data-scene-step]');
    await journey.nth(3).click();
    await expect(journey.nth(3)).toHaveAttribute('aria-pressed', 'true');
    await expect(journey.nth(0)).toHaveAttribute('aria-pressed', 'false');

    await page.goto('/pages/protocol.html?webgl=low');
    await expect(page.locator('html')).toHaveAttribute('data-webgl-state', 'ready');
    const layers = page.locator('[data-scene-layer]');
    await layers.nth(2).click();
    await expect(layers.nth(2)).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-scene-all]').click();
    await expect(layers.nth(2)).toHaveAttribute('aria-pressed', 'false');
  });

  test('roadmap game validates evidence and persists progress for the session', async ({
    page,
  }) => {
    await page.goto('/pages/roadmap.html?webgl=low');
    await expect(page.locator('html')).toHaveAttribute('data-webgl-state', 'ready');
    await expect(page.locator('[data-roadmap-game] h3')).toContainText('What proves');
    await page.getByRole('button', { name: 'A marketing screenshot' }).click();
    await expect(page.locator('.roadmap-game__message')).toContainText('does not prove');
    await page.getByRole('button', { name: 'Bytecode and chain ID reads' }).click();
    await expect(page.locator('[data-roadmap-game] h3')).toContainText('reconciled');
    await page.reload();
    await expect(page.locator('[data-roadmap-game] h3')).toContainText('reconciled');
  });

  test('reduced motion renders a static composition', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?webgl=high');
    await expect(page.locator('html')).toHaveAttribute('data-webgl-quality', 'static');
    await expect(page.locator('[data-webgl-status]')).toHaveText('Static 3D composition');
  });
});
