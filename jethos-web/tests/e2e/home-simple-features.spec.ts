import { expect, test } from '@playwright/test';

test.describe('simple Home features', () => {
  test('roadmap popover supports click, Escape and focus restoration', async ({ page }) => {
    await page.goto('/index.html');
    const control = page.locator('[data-horizon-step="multi-chain"]');
    await control.click();
    const popover = page.locator('[data-horizon-popover]');
    await expect(popover).toBeVisible();
    await expect(popover.locator('[data-horizon-popover-title]')).toHaveText('Multi-chain vaults');
    await expect(control).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');
    await expect(popover).toBeHidden();
    await expect(control).toBeFocused();
    await expect(control).toHaveAttribute('aria-expanded', 'false');
  });

  test('receipt, decision and synthesis synchronize keyboard state', async ({ page }) => {
    await page.goto('/index.html');

    const allocation = page.locator('[data-receipt-allocation="aave"]');
    await allocation.focus();
    await expect(page.locator('[data-receipt-chart-value]')).toHaveText('25%');
    await expect(page.locator('[data-receipt-slice="aave"]')).toHaveClass(/is-active/u);

    const excluded = page.locator('[data-decision-route="route-c"]');
    await excluded.focus();
    await expect(page.locator('[data-decision-net]')).toHaveText('5.2%');
    await expect(page.locator('[data-decision-policy]')).toHaveText('Outside limit');
    await excluded.click();
    await expect(excluded).toHaveAttribute('aria-pressed', 'true');

    const finance = page.locator('[data-synthesis-source="finance"]');
    await finance.focus();
    await expect(page.locator('[data-synthesis-scene]')).toHaveAttribute('data-active', 'finance');
    await finance.blur();
    await expect(page.locator('[data-synthesis-scene]')).not.toHaveAttribute('data-active');
  });

  test('reduced motion resolves animated features immediately', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/index.html');
    await expect(page.locator('[data-synthesis-scene]')).toHaveClass(/is-assembled/u);
    await expect(page.locator('[data-decision-runway]')).toHaveClass(/is-evaluating/u);
  });
});
