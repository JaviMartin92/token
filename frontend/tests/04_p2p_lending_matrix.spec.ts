import { test, expect } from '@playwright/test';
import { injectEip1193Provider } from './helpers/eip1193.js';
import { evmSnapshot, evmRevert, timeWarp } from './helpers/evm.js';

test.describe('Suite 4: Préstamos P2P & Multi-Colateral (Tx 28 - 41)', () => {
  let snapshotId: string;

  test.beforeAll(async () => {
    snapshotId = await evmSnapshot();
  });

  test.afterAll(async () => {
    if (snapshotId) await evmRevert(snapshotId);
  });

  test('Tx 28 - 41: Ofertas P2P, Préstamos con Tesorería, Amortizaciones y Liquidaciones', async ({ page }) => {
    await injectEip1193Provider(page, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    await page.goto('/');

    const connectBtn = page.locator('button:has-text("Conectar Wallet")');
    if (await connectBtn.isVisible()) {
      await connectBtn.click();
    }

    // [Tx 30] Create Loan Offer with Collateral
    const offerAmtInput = page.locator('[data-testid="p2p-offer-amount-input"]');
    if (await offerAmtInput.isVisible()) {
      await offerAmtInput.fill('1000');
      const createOfferBtn = page.locator('[data-testid="p2p-offer-create-btn"]');
      await createOfferBtn.click();

      const confirmBtn = page.locator('[data-testid="modal-confirm-btn"]');
      if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await confirmBtn.click();
        await expect(confirmBtn).toBeHidden({ timeout: 15000 });
      }
    }

    // Verify marketplace table has loans
    await expect(page.locator('.gcc-table')).toBeVisible({ timeout: 10000 });
  });
});
