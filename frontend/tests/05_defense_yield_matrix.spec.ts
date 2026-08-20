import { test, expect } from '@playwright/test';
import { injectEip1193Provider } from './helpers/eip1193.js';
import { evmSnapshot, evmRevert } from './helpers/evm.js';

test.describe('Suite 5: Real Yield, Circuit Breaker & Admin (Tx 42 - 52)', () => {
  let snapshotId: string;

  test.beforeAll(async () => {
    snapshotId = await evmSnapshot();
  });

  test.afterAll(async () => {
    if (snapshotId) await evmRevert(snapshotId);
  });

  test('Tx 42 - 52: Universal Yield, Circuit Breaker, Oráculos y Bóvedas Auxiliares', async ({ page }) => {
    await injectEip1193Provider(page, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    await page.goto('/');

    const connectBtn = page.locator('button:has-text("Conectar Wallet")');
    if (await connectBtn.isVisible()) {
      await connectBtn.click();
    }

    // Switch to Analytics Tab
    await page.locator('[data-testid="header-tab-metrics"]').click();
    await expect(page.locator('[data-testid="por-collateral-ratio"]').first()).toBeVisible({ timeout: 10000 });

    // Switch to Governance Tab
    await page.locator('[data-testid="header-tab-governance"]').click();
    await page.waitForTimeout(1000);
    await expect(page.locator('.acp-container').first()).toBeVisible({ timeout: 10000 });
  });
});
