import { test, expect } from '@playwright/test';

test.describe('Treasury Core Operations', () => {
  test('should allow a user to simulate depositing USDC and see pre-flight modal', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173');
    
    // Switch to User role
    await page.locator('button:has-text("Usuario")').click();

    // Ensure the balance is loaded before interacting
    await expect(page.locator('text=SALDO USDC DISPONIBLE')).toBeVisible({ timeout: 10000 });

    // Type 1000 in the deposit input field
    const depositInput = page.locator('input[placeholder="Monto USDC (ej. 1000)"]');
    await depositInput.fill('1000');

    // Click Deposit
    await page.locator('button', { hasText: 'Depositar' }).click();

    // Verify Pre-Flight Modal appears
    await expect(page.locator('text=Depósito de USDC en Tesorería')).toBeVisible();
    await expect(page.locator('text=Monto Bruto Ingresado')).toBeVisible();
    await expect(page.locator('text=$1000.00 USDC')).toBeVisible();
  });

  test('should allow a user to simulate redeeming ALPHA for USDC and see pre-flight modal', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173');
    await page.locator('button:has-text("Usuario")').click();

    // Type 500 in the redeem input field
    const redeemInput = page.locator('input[placeholder="Shares a Rescatar (ej. 500)"]');
    await redeemInput.fill('500');

    // Click Rescatar
    await page.locator('button', { hasText: 'Rescatar' }).click();

    // Verify Pre-Flight Modal appears
    await expect(page.locator('text=Rescate de ALPHA Shares por USDC')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Quema de Shares & Salida')).toBeVisible();
    await expect(page.locator('text=500.00').first()).toBeVisible();
    
    // Close modal
    await page.locator('button:has-text("✕")').first().click();
  });

  test('should allow user to request USDC from Faucet', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173');
    await page.locator('button:has-text("Usuario")').click();

    // Click Faucet
    await page.locator('button:has-text("Faucet 10k USDC")').click();
    
    // Verify toast or execution (We wait for the Faucet success toast, assuming mock resolves instantly or fast)
    await expect(page.locator('text=Éxito Faucet')).toBeVisible({ timeout: 10000 });
  });
});
