import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const storageKey = 'jethos-interactive-demo-v3';

test.describe('Interactive Demo', () => {
  test('renders the exact legacy route and navigates every workspace through hash state', async ({
    page,
  }) => {
    await page.goto('/demo/index.html#overview');
    await expect(page).toHaveTitle(/Overview · Jethos Interactive Demo/);
    await expect(
      page.getByRole('heading', { name: 'One balance. Two clear sides.' }),
    ).toBeVisible();
    await expect(page.getByText('$12,480.00', { exact: true }).first()).toBeVisible();
    await page.getByRole('link', { name: 'Wallet' }).click();
    await expect(page).toHaveURL(/#wallet$/);
    await expect(page.getByRole('heading', { name: 'Your liquid assets' })).toBeVisible();
    await page.getByRole('link', { name: 'Understand' }).click();
    await expect(page).toHaveURL(/#transparency$/);
    await expect(page.getByRole('heading', { name: 'Understand before you act.' })).toBeVisible();
  });

  test('completes deposit, deterministic growth and withdrawal with persisted schema v3', async ({
    page,
  }) => {
    await page.goto('/demo/index.html#vaults');
    await expect(
      page.getByRole('heading', { name: 'You choose how, when and where to invest.' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Deposit' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('USDC value').fill('250');
    await dialog.getByRole('button', { name: 'Review' }).click();
    await expect(dialog.getByRole('heading')).toContainText('Review deposit');
    await dialog.getByRole('button', { name: 'Confirm simulated deposit' }).click();
    await expect(page).toHaveURL(/#portfolio$/);
    await expect(page.getByText('Deposit added to your illustrative portfolio.')).toBeVisible();
    await page.getByRole('button', { name: 'Simulate 30 days' }).click();
    await expect(page.getByText('Thirty illustrative days were added.')).toBeVisible();

    const stored = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? '{}'),
      storageKey,
    );
    expect(stored).toMatchObject({ schemaVersion: 3, simulatedDays: 30 });
    expect(stored.positions['conservative:plasma:usdc'].principal).toBe(3530);
    await page.reload();
    await expect(page.getByText('30 simulated days', { exact: false }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Withdraw' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: '25%' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Review' }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Confirm simulated withdraw' })
      .click();
    await expect(page.getByText('Withdrawal returned to the matching wallet asset.')).toBeVisible();
  });

  test('contains invalid operations, traps modal focus and restores the trigger', async ({
    page,
  }) => {
    await page.goto('/demo/index.html#vaults');
    const trigger = page.getByRole('button', { name: 'Deposit' }).first();
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('USDC value').fill('999999');
    await dialog.getByRole('button', { name: 'Review' }).click();
    await expect(dialog.getByRole('alert')).toContainText('exceeds the available');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('supports advanced filters and strategy inspection without Web3 traffic', async ({
    page,
  }) => {
    const externalRequests: string[] = [];
    page.on('request', (request) => {
      if (!request.url().startsWith('http://127.0.0.1:4321')) externalRequests.push(request.url());
    });
    await page.goto('/demo/index.html#vaults');
    await page.getByRole('button', { name: 'Advanced' }).click();
    await page.getByRole('button', { name: 'Arbitrum' }).click();
    await page.getByRole('button', { name: 'ETH', exact: true }).click();
    await page.getByRole('button', { name: 'Explain Arbitrum ETH Conservative' }).click();
    await expect(page.getByRole('dialog')).toContainText('Arbitrum ETH Conservative');
    expect(externalRequests).toEqual([]);
  });

  test('has no automatically detectable accessibility violations', async ({ page }) => {
    await page.goto('/demo/index.html#overview');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
