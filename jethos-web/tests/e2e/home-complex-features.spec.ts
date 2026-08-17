import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('complex Home features', () => {
  test('Strategy Inspector renders every depth and preserves ARIA state', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/index.html');
    const inspector = page.locator('[data-strategy-inspector]');
    await expect(inspector.locator('[data-inspector-chart] svg')).toHaveCount(2);
    await expect(inspector.locator('.strategy-route-row')).toHaveCount(4);

    const opportunity = inspector.locator('[data-inspector-strategy="opportunity"]');
    await opportunity.click();
    await expect(opportunity).toHaveAttribute('aria-pressed', 'true');
    await expect(inspector.locator('[data-inspector-selection]')).toHaveText(
      'Opportunity strategy',
    );
    await expect(inspector.locator('[data-base-yield]')).toHaveText('7.8%');
    await expect(inspector.locator('[data-advanced-reserve]')).toHaveText('10%');

    const baseExplain = inspector.locator('[data-view-detail="base"]');
    await baseExplain.click();
    const basePanel = inspector.locator('[data-view-detail-panel="base"]');
    await expect(basePanel).toBeVisible();
    await expect(basePanel.locator('[data-view-detail-title]')).toHaveText('Opportunity strategy');
    await expect(baseExplain).toHaveAttribute('aria-expanded', 'true');

    const proExplain = inspector.locator('[data-view-detail="pro"]');
    await proExplain.click();
    if (isMobile) await expect(basePanel).toBeHidden();
    else await expect(basePanel).toBeVisible();
    await expect(inspector.locator('[data-view-detail-panel="pro"]')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(inspector.locator('[data-view-detail-panel="pro"]')).toBeHidden();
    await expect(proExplain).toBeFocused();
  });

  test('Architecture Map separates current state and inspectable direction', async ({ page }) => {
    await page.goto('/index.html');
    const architecture = page.locator('[data-architecture-map]');
    const today = architecture.locator('[data-architecture-mode="today"]');
    const direction = architecture.locator('[data-architecture-mode="direction"]');
    await expect(direction).toHaveAttribute('aria-pressed', 'true');
    await today.click();
    await expect(architecture.locator('[data-architecture-panel="today"]')).toBeVisible();
    await expect(architecture.locator('[data-architecture-panel="direction"]')).toBeHidden();

    await direction.click();
    await architecture.locator('[data-architecture-risk="opportunity"]').click();
    await expect(architecture.locator('[data-master-tier]').first()).toHaveText('Opportunity');

    const baseChain = architecture.locator('[data-architecture-chain="base"]');
    await baseChain.locator('.architecture-chain__header').click();
    await expect(baseChain).toHaveClass(/is-expanded/u);
    const asset = baseChain.locator('[data-architecture-asset="usdc"]');
    await asset.click();
    const popover = page.locator('[data-architecture-asset-popover]');
    await expect(popover).toBeVisible();
    await expect(popover.locator('[data-asset-popover-title]')).toHaveText(
      'Base · Opportunity USDC Vault',
    );
    await expect(popover.locator('.architecture-route-candidate')).toHaveCount(7);

    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(scan.violations).toEqual([]);

    await page.keyboard.press('Escape');
    await expect(popover).toBeHidden();
    await expect(asset).toBeFocused();
  });
});
