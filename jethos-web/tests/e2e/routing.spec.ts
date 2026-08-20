import { expect, test } from '@playwright/test';

const redirects = [
  ['/config.html', '/pages/protocol.html'],
  ['/documentation.html', '/pages/docs.html'],
  ['/landing.html', '/index.html'],
  ['/portfolio.html', '/app.html'],
] as const;

test.describe('legacy route compatibility', () => {
  for (const [source, target] of redirects) {
    test(`${source} redirects to ${target}`, async ({ page }) => {
      await page.goto(source);
      await expect(page).toHaveURL(new RegExp(`${target.replaceAll('.', '\\.')}?$`, 'u'));
    });
  }

  test('redirect documents expose canonical and no-script fallback links', async ({ request }) => {
    for (const [source, target] of redirects) {
      const response = await request.get(source);
      expect(response.ok()).toBe(true);
      const html = await response.text();
      expect(html).toContain(`http-equiv="refresh" content="0;url=${target}"`);
      expect(html).toContain(`rel="canonical" href="${target}"`);
      expect(html).toContain(`<a href="${target}">`);
    }
  });
});
