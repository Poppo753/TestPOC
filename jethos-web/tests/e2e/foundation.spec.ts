import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('enterprise foundation', () => {
  test('renders one main heading without automated accessibility violations', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Home banking, rebuilt around ownership.',
    );
    await expect(page.getByRole('main')).toBeVisible();

    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(scan.violations).toEqual([]);
  });

  test('applies baseline tokens and honors reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    const styles = await page.locator('body').evaluate((body) => {
      const bodyStyles = getComputedStyle(body);
      const rootStyles = getComputedStyle(document.documentElement);
      return {
        backgroundColor: rootStyles.backgroundColor,
        color: bodyStyles.color,
        focusColor: rootStyles.getPropertyValue('--color-focus-ring').trim(),
        scrollBehavior: rootStyles.scrollBehavior,
      };
    });

    expect(styles).toEqual({
      backgroundColor: 'rgb(7, 16, 31)',
      color: 'rgb(217, 224, 236)',
      focusColor: '#22d3ee',
      scrollBehavior: 'auto',
    });
  });

  test('renders the shared shell and operates responsive navigation', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('link', { name: 'Jethos home' }).first()).toBeVisible();
    const currentLink = page.locator('#primary-links a[aria-current="page"]');
    await expect(currentLink).toHaveText('Home');
    await expect(page.getByRole('contentinfo')).toContainText('Private proof of concept');

    const toggle = page.locator('[data-nav-toggle]');
    if ((page.viewportSize()?.width ?? 0) <= 1060) {
      await expect(toggle).toHaveAccessibleName('Open menu');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(toggle).toHaveAccessibleName('Close menu');
      await expect(page.getByRole('navigation').getByRole('link', { name: 'Docs' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(toggle).toBeFocused();
    } else {
      await expect(toggle).toBeHidden();
      await expect(page.getByRole('navigation').getByRole('link', { name: 'Docs' })).toBeVisible();
    }
  });
});
