import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = [
  ['/pages/how-it-works.html', 'One explicit route. Five understandable states.'],
  ['/pages/roadmap.html', 'Evidence before expansion.'],
  ['/pages/vision.html', 'Digital finance that feels familiar—and remains verifiable.'],
  ['/pages/faq.html', 'Control, choice and transparency.'],
  ['/pages/developers.html', 'Build against explicit deployment records.'],
  ['/pages/team.html', 'Trust also requires people and accountability.'],
] as const;

test.describe('narrative pages', () => {
  for (const [path, heading] of pages) {
    test(`${path} renders complete accessible content`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
      await expect(page.getByRole('contentinfo')).toBeVisible();

      const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(scan.violations).toEqual([]);
    });
  }

  test('preserves narrative data, disclosure and native FAQ behavior', async ({ page }) => {
    await page.goto('/pages/roadmap.html');
    await expect(page.locator('.timeline-item')).toHaveCount(4);

    await page.goto('/pages/how-it-works.html');
    await expect(page.locator('.boundary-steps article')).toHaveCount(5);

    await page.goto('/pages/faq.html');
    await expect(page.locator('.faq-item')).toHaveCount(20);
    const secondQuestion = page.locator('.faq-item').nth(1);
    await expect(secondQuestion).not.toHaveAttribute('open');
    await secondQuestion.locator('summary').click();
    await expect(secondQuestion).toHaveAttribute('open', '');

    await page.goto('/pages/developers.html');
    await expect(page.getByText('0x80fB731B78D2C7180cd22eCF18Dc4243546ce192')).toBeVisible();
  });
});
