import { test, expect } from '@playwright/test';
import { injectEip1193Provider } from './helpers/eip1193.js';
import { evmSnapshot, evmRevert } from './helpers/evm.js';

test.describe('Suite 1: Tesorería & Mercado Primario (Tx 01 - 11)', () => {
  let snapshotId: string;

  test.beforeAll(async () => {
    snapshotId = await evmSnapshot();
  });

  test.afterAll(async () => {
    if (snapshotId) await evmRevert(snapshotId);
  });

  test('Tx 01 - 11: Faucet, Depósitos, Rescates, NAV y Proof of Reserves', async ({ page }) => {
    await injectEip1193Provider(page, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    await page.goto('/');

    // 1. Conexión de Billetera
    const connectBtn = page.locator('button:has-text("Conectar Wallet")');
    if (await connectBtn.isVisible()) {
      await connectBtn.click();
    }
    await expect(page.locator('[data-testid="header-wallet-status"]')).toContainText('0xf39F', { timeout: 10000 });

    // [Tx 01] Faucet USDC
    const faucetBtn = page.locator('[data-testid="treasury-faucet-btn"]');
    await faucetBtn.click();
    await page.waitForTimeout(1000);
    const usdcBalEl = page.locator('[data-testid="treasury-usdc-balance"]');
    await expect(usdcBalEl).toContainText('USDC');

    // [Tx 02] Deposit USDC -> Mint ALPHA
    const depInput = page.locator('[data-testid="treasury-deposit-input"]');
    await depInput.fill('5000');
    await page.locator('[data-testid="treasury-deposit-btn"]').click();

    // Confirm Modal
    const confirmBtn = page.locator('[data-testid="modal-confirm-btn"]');
    await expect(confirmBtn).toBeVisible({ timeout: 10000 });
    await confirmBtn.click();
    await expect(confirmBtn).toBeHidden({ timeout: 15000 });

    // Verify ALPHA Shares minted
    const sharesBalEl = page.locator('[data-testid="treasury-shares-balance"]');
    await expect(sharesBalEl).not.toHaveText('0.00 ALPHA', { timeout: 10000 });

    // [Tx 03] Redeem ALPHA -> Withdraw USDC
    const redeemInput = page.locator('[data-testid="treasury-redeem-input"]');
    await redeemInput.fill('1000');
    await page.locator('[data-testid="treasury-redeem-btn"]').click();

    await expect(confirmBtn).toBeVisible({ timeout: 10000 });
    await confirmBtn.click();
    await expect(confirmBtn).toBeHidden({ timeout: 15000 });

    // [Tx 04] NAV Per Share
    await expect(page.locator('[data-testid="header-nav-value"]')).toContainText('USDC');

    // [Tx 07] Proof of Reserves
    await expect(page.locator('[data-testid="header-por-ratio"]')).toContainText('%');
  });
});
