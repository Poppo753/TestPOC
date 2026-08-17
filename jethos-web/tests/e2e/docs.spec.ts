import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('documentation', () => {
  test('catalog search and standalone fallback remain complete', async ({ page }) => {
    await page.goto('/pages/docs.html');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Start with the question you need answered.',
    );
    await expect(page.locator('[data-doc-entry]')).toHaveCount(13);

    await page.getByRole('searchbox', { name: 'Search documents' }).fill('architecture');
    await expect(page.locator('[data-doc-entry]:visible')).toHaveCount(1);
    await expect(page.locator('[data-doc-count]')).toHaveText('1');

    await page.goto('/pages/docs/03.html');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Protocol Architecture');
    await expect(page.locator('[data-document-body] h2').first()).toBeVisible();
    await expect(page.locator('[data-document-toc] a').first()).toBeVisible();

    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(scan.violations).toEqual([]);
  });

  test('enhanced reader supports deep links, TOC, download and focus restoration', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/pages/docs.html');
    const entry = page.locator('[data-doc-entry][data-doc-id="03"]');
    await entry.focus();
    await entry.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: 'Protocol Architecture', level: 2 }),
    ).toBeVisible();
    await expect(dialog.locator('[data-doc-body] h2').first()).toBeVisible();
    if (isMobile) await expect(dialog.locator('[data-doc-toc]')).toBeHidden();
    else await expect(dialog.locator('[data-doc-toc] a').first()).toBeVisible();
    await expect(dialog.locator('[data-doc-download]')).toHaveAttribute(
      'href',
      '/content/docs/03_Jethos_Protocol_Architecture_v0.1.md',
    );
    await expect(page).toHaveURL(/\?doc=03$/u);

    const scan = await new AxeBuilder({ page })
      .include('[data-doc-dialog]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(scan.violations).toEqual([]);

    await dialog.getByRole('button', { name: 'Close document' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(entry).toBeFocused();
    await expect(page).toHaveURL(/\/pages\/docs\.html$/u);

    await page.goto('/pages/docs.html?doc=09');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').locator('[data-doc-title]')).toHaveText(
      'Multi-chain & Vault Composability',
    );
  });
});
