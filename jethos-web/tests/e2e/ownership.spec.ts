import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('Ownership Journey', () => {
  test('wallet and vault explorer stay synchronized by keyboard', async ({ page }) => {
    await page.goto('/index.html');
    const wallet = page.locator('[data-wallet-allocation]');
    const usdc = wallet.locator('[data-wallet-asset="usdc"]');
    await usdc.click();
    await expect(usdc).toHaveAttribute('aria-pressed', 'true');
    await expect(wallet.locator('[data-wallet-chart-value]')).toHaveText('$3,900');
    await usdc.click();
    await expect(wallet.locator('[data-wallet-chart-value]')).toHaveText('$9.2k');

    const journey = page.locator('[data-ownership-journey]');
    const baseTab = journey.locator('[data-vault-mode="base"]');
    await baseTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(journey.locator('[data-vault-mode="pro"]')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('ArrowRight');
    await expect(journey.locator('[data-vault-mode="advanced"]')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(journey.locator('[data-token-filter]')).toBeVisible();
    await journey.locator('[data-chain="arbitrum"]').click();
    await journey.locator('[data-token="eth"]').click();
    await expect(journey.locator('[data-vault-option="opportunity"] [data-vault-apy]')).toHaveText(
      '10.7%',
    );

    const balanced = journey.locator('[data-vault-option="balanced"]');
    await balanced.click();
    const popover = page.locator('[data-vault-popover]');
    await expect(popover).toBeVisible();
    await expect(popover.locator('[data-vault-popover-title]')).toHaveText(
      'Balanced · Arbitrum · ETH',
    );
    await expect(popover.locator('.ownership-allocation-row')).toHaveCount(3);
    await popover.locator('.ownership-allocation-row').nth(1).focus();
    await expect(popover.locator('[data-vault-chart-value]')).toHaveText('45%');

    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(scan.violations).toEqual([]);

    await page.keyboard.press('Escape');
    await expect(popover).toBeHidden();
    await expect(balanced).toBeFocused();
  });

  test('motion adapts to desktop, compact layout and reduced-motion', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/index.html');
    const stage = page.locator('.ownership-stage');
    const source = page.locator('[data-ownership-source]');

    if (isMobile) {
      await expect(stage).toHaveClass(/is-compact-motion/u);
      await stage.scrollIntoViewIfNeeded();
      await expect(stage).toHaveClass(/is-compact-assembled/u);
    } else {
      await page.locator('.ownership-stage-wrap').scrollIntoViewIfNeeded();
      await expect(source).toHaveCSS('visibility', 'hidden');
      await expect(page.locator('[data-ownership-dashboard]')).toHaveCSS('opacity', '1');
    }

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await expect(page.locator('.ownership-stage')).not.toHaveClass(/is-compact-motion/u);
    await expect(page.locator('[data-ownership-source]')).not.toHaveAttribute(
      'style',
      /transform/u,
    );
  });
});
