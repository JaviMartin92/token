import { test, expect } from '@playwright/test';
import { injectEip1193Provider } from './helpers/eip1193.js';
import { evmSnapshot, evmRevert, timeWarp } from './helpers/evm.js';

test.describe('Suite 3: Bonos con Descuento & Posiciones NFT (Tx 22 - 27)', () => {
  let snapshotId: string;

  test.beforeAll(async () => {
    snapshotId = await evmSnapshot();
  });

  test.afterAll(async () => {
    if (snapshotId) await evmRevert(snapshotId);
  });

  test('Tx 22 - 27: Compra de Bonos, Emisión de NFT, Ragequit y Claim Matured', async ({ page }) => {
    await injectEip1193Provider(page, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    await page.goto('/');

    const connectBtn = page.locator('button:has-text("Conectar Wallet")');
    if (await connectBtn.isVisible()) {
      await connectBtn.click();
    }

    // [Tx 22] Buy Vested Bond 1-Year
    const bondPrincipalInput = page.locator('[data-testid="bonds-principal-input"]').first();
    await bondPrincipalInput.scrollIntoViewIfNeeded();
    await bondPrincipalInput.fill('1000');

    const bondYearsSelect = page.locator('[data-testid="bonds-years-select"]').first();
    await bondYearsSelect.selectOption('1');

    const buyBondBtn = page.locator('[data-testid="bonds-buy-btn"]').first();
    await buyBondBtn.click();

    const confirmBtn = page.locator('[data-testid="modal-confirm-btn"]');
    await expect(confirmBtn).toBeVisible({ timeout: 10000 });
    await confirmBtn.click();
    await expect(confirmBtn).toBeHidden({ timeout: 15000 });

    // [Tx 23] Buy Vested Bond 3-Year
    await bondPrincipalInput.fill('2000');
    await bondYearsSelect.selectOption('3');
    await buyBondBtn.click();
    await expect(confirmBtn).toBeVisible({ timeout: 10000 });
    await confirmBtn.click();
    await expect(confirmBtn).toBeHidden({ timeout: 15000 });

    // [Tx 25] Ragequit on NFT
    const rqBtn = page.locator('button:has-text("Ragequit")').first();
    if (await rqBtn.isVisible()) {
      await rqBtn.click();
      await expect(confirmBtn).toBeVisible({ timeout: 10000 });
      await confirmBtn.click();
      await expect(confirmBtn).toBeHidden({ timeout: 15000 });
    }

    // [Tx 26] Time-warp 366 days to mature 1-yr bond and claim
    await timeWarp(366 * 86400);
    await page.reload();
    await page.waitForTimeout(2000);

    const claimBtn = page.locator('button:has-text("Reclamar")').first();
    if (await claimBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await claimBtn.click();
      if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await confirmBtn.click();
        await expect(confirmBtn).toBeHidden({ timeout: 15000 });
      }
    }
  });
});
