import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = [
  ['/pages/vaults.html', 'One asset. One goal. Clear limits.'],
  ['/pages/risk-transparency.html', 'Simple profiles. Measurable constraints.'],
  ['/pages/trust-center.html', 'Know what is recorded—and what remains unproven.'],
  ['/pages/security.html', 'Controls reduce risk. They do not remove it.'],
  ['/pages/protocol.html', 'The modular engine beneath Jethos.'],
] as const;

test.describe('product and risk pages', () => {
  for (const [path, heading] of pages) {
    test(`${path} renders its complete accessible route`, async ({ page }) => {
      await page.goto(path);

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
      await expect(page.getByRole('contentinfo')).toBeVisible();
      const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(scan.violations).toEqual([]);
    });
  }

  test('renders structured product and protocol evidence', async ({ page }) => {
    await page.goto('/pages/trust-center.html');
    await expect(page.getByText('arbitrum-usdc-poc-1', { exact: true })).toBeVisible();
    await expect(page.getByText('4 recorded integrations; not current allocation.')).toBeVisible();

    await page.goto('/pages/vaults.html');
    await expect(page.getByRole('region', { name: 'Future vault families' })).toBeVisible();

    await page.goto('/pages/protocol.html');
    await expect(
      page.getByRole('region', { name: 'Protocol module responsibilities' }),
    ).toBeVisible();
    await expect(page.getByText('Morpho Vault')).toBeVisible();
  });
});
