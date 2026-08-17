import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('changelog page', () => {
  test('renders the typed source at the legacy URL', async ({ page }) => {
    await page.goto('/pages/changelog.html');

    await expect(page).toHaveTitle('Jethos changelog — Product and evidence updates');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Progress you can date and inspect.',
    );
    await expect(page.locator('.changelog-entry')).toHaveCount(4);
    await expect(page.locator('.changelog-entry').first()).toContainText(
      'Product narrative and evidence pass',
    );
    await expect(page.getByText('Structured source: data/product/changelog.json')).toBeVisible();

    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(scan.violations).toEqual([]);
  });
});
