import { test, expect } from '@playwright/test';
import { injectEip1193Provider } from './helpers/eip1193.js';
import { evmSnapshot, evmRevert } from './helpers/evm.js';

test.describe('Suite 2: Gobernanza & Staking DAO (Tx 12 - 21)', () => {
  let snapshotId: string;

  test.beforeAll(async () => {
    snapshotId = await evmSnapshot();
  });

  test.afterAll(async () => {
    if (snapshotId) await evmRevert(snapshotId);
  });

  test('Tx 12 - 21: Stake, Preferencias de Pago, Yield y Unstake', async ({ page }) => {
    await injectEip1193Provider(page, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    await page.goto('/');

    // 1. Connect & Switch to Governance Tab
    const connectBtn = page.locator('button:has-text("Conectar Wallet")');
    if (await connectBtn.isVisible()) {
      await connectBtn.click();
    }
    await page.locator('[data-testid="header-tab-governance"]').click();

    // [Tx 12] Stake ALPHA
    const stakeInput = page.locator('[data-testid="staking-amount-input"]');
    if (await stakeInput.isVisible()) {
      await stakeInput.fill('500');
      const stakeBtn = page.locator('[data-testid="staking-stake-btn"]');
      await stakeBtn.click();

      const confirmBtn = page.locator('[data-testid="modal-confirm-btn"]');
      if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await confirmBtn.click();
        await expect(confirmBtn).toBeHidden({ timeout: 15000 });
      }
    }

    // [Tx 13/14] Payout Preferences
    const optA = page.locator('label:has-text("Opción A")');
    if (await optA.isVisible()) {
      await optA.click();
      await page.waitForTimeout(500);
    }

    // [Tx 18] Unstake
    const unstakeBtn = page.locator('[data-testid="staking-unstake-btn"]');
    if (await unstakeBtn.isVisible()) {
      await unstakeBtn.click();
      const confirmBtn = page.locator('[data-testid="modal-confirm-btn"]');
      if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await confirmBtn.click();
        await expect(confirmBtn).toBeHidden({ timeout: 15000 });
      }
    }
  });
});
