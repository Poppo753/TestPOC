import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('Home static composition', () => {
  test('preserves complete section and feature-host structure', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Home banking, rebuilt around ownership.',
    );
    await expect(page.locator('main > section')).toHaveCount(10);
    await expect(page.locator('[data-horizon-step]')).toHaveCount(5);
    await expect(page.locator('.boundary-steps article')).toHaveCount(6);
    await expect(page.locator('[data-decision-route]')).toHaveCount(3);
    await expect(page.locator('.strategy-view')).toHaveCount(3);
    await expect(page.locator('[data-architecture-chain]')).toHaveCount(3);
    await expect(page.getByRole('contentinfo')).toBeVisible();

    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(scan.violations).toEqual([]);
  });

  test('renders the complete responsive page for visual review', async ({ page }, testInfo) => {
    await page.goto('/index.html');
    await page.screenshot({
      path: testInfo.outputPath('home-static-full.png'),
      fullPage: true,
      animations: 'disabled',
    });
  });
});
