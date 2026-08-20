import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function blockPublicRpc(page: import('@playwright/test').Page) {
  await page.route('https://arb1.arbitrum.io/**', (route) => route.abort('connectionfailed'));
}

async function installWallet(
  page: import('@playwright/test').Page,
  options: { accounts?: string[]; chainId?: string; rejectConnect?: boolean } = {},
) {
  await page.addInitScript((configuration) => {
    const calls: string[] = [];
    Object.defineProperty(window, '__walletCalls', { value: calls, configurable: true });
    Object.defineProperty(window, 'ethereum', {
      configurable: true,
      value: {
        request: async ({ method }: { method: string }) => {
          calls.push(method);
          if (method === 'eth_accounts') return configuration.accounts ?? [];
          if (method === 'eth_requestAccounts') {
            if (configuration.rejectConnect)
              throw Object.assign(new Error('Rejected'), { code: 4001 });
            return configuration.accounts ?? [];
          }
          if (method === 'eth_chainId') return configuration.chainId ?? '0xa4b1';
          return null;
        },
        on: () => {},
        removeListener: () => {},
      },
    });
  }, options);
}

test.describe('USDC PoC Console', () => {
  test('renders the complete read-only shell and degrades explicit RPC failure', async ({
    page,
  }) => {
    await blockPublicRpc(page);
    await page.goto('/app.html');
    await expect(page.getByRole('heading', { name: 'USDC Conservative PoC' })).toBeVisible();
    await expect(page.getByText('Private proof of concept.', { exact: true })).toBeVisible();
    await expect(page.locator('#data-status')).toContainText('Public contract reads failed');
    await expect(page.locator('#pool-value')).toHaveText('Read unavailable');
    await expect(
      page.getByRole('button', { name: 'Review explicit approval & deposit' }),
    ).toBeDisabled();
  });

  test('passive restore never requests accounts and explicit connection exposes wrong-chain recovery', async ({
    page,
  }) => {
    await blockPublicRpc(page);
    await installWallet(page, {
      accounts: ['0x0000000000000000000000000000000000000001'],
      chainId: '0x1',
    });
    await page.goto('/app.html');
    await expect(page.locator('#wallet-network')).toHaveText('Wrong network (1)');
    const calls = await page.evaluate(
      () => (window as unknown as { __walletCalls: string[] }).__walletCalls,
    );
    expect(calls).not.toContain('eth_requestAccounts');
    await expect(page.getByRole('button', { name: 'Switch network' })).toBeVisible();
    await page.getByRole('button', { name: 'Switch network' }).click();
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as { __walletCalls: string[] }).__walletCalls),
      )
      .toContain('wallet_switchEthereumChain');
  });

  test('normalizes a rejected explicit connect without unlocking writes', async ({ page }) => {
    await blockPublicRpc(page);
    await installWallet(page, { rejectConnect: true });
    await page.goto('/app.html');
    await expect(page.locator('#data-status')).toContainText('failed');
    await page.getByRole('button', { name: 'Connect wallet' }).click();
    await expect(page.getByText('The wallet request was rejected.')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Review explicit approval & deposit' }),
    ).toBeDisabled();
  });

  test('keeps tab and advanced diagnostic controls semantic', async ({ page }) => {
    await blockPublicRpc(page);
    await page.goto('/app.html');
    await expect(page.locator('#data-status')).toContainText('failed');
    const withdraw = page.getByRole('tab', { name: 'Withdraw' });
    await withdraw.click();
    await expect(withdraw).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-tab-panel="withdraw"]')).toBeVisible();
    const advanced = page.getByRole('tab', { name: 'Advanced details' });
    await advanced.click();
    await expect(advanced).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Protocol registry' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Revoke USDC approval' })).toBeDisabled();
  });

  test('has no automatically detectable accessibility violations', async ({ page }) => {
    await blockPublicRpc(page);
    await page.goto('/app.html');
    await expect(page.locator('#data-status')).toContainText('failed');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
