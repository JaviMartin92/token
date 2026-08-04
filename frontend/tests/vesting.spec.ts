import { test, expect } from '@playwright/test';

test.describe('Vested Discount Vault', () => {
  test('should display accurate discount rates based on Lock Years', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173');
    
    // Switch to Client/Bonds Tab
    await page.locator('button:has-text("Portal Cliente & Bonos")').click();

    // The component might take a second if state is loading, wait for the heading
    await expect(page.locator('h3:has-text("Bóveda de Bonos Vestados con Descuento")')).toBeVisible({ timeout: 10000 });

    // Enter an amount for bond principal
    const principalInput = page.locator('.glass-panel:has-text("Bóveda de Bonos Vestados con Descuento")').locator('input[type="number"]').first();
    await principalInput.fill('1000');

    // Select 1 year
    const select = page.locator('.glass-panel:has-text("Bóveda de Bonos Vestados con Descuento")').locator('select').first();
    await select.selectOption('1');
    
    // Check if the discount is 10.0% OFF (based on calculation: 8*1 + 2 = 10%)
    await expect(page.locator('text=10.0% OFF').first()).toBeVisible();

    // Select 5 years
    await select.selectOption('5');
    
    // Check if the discount is 40.0% OFF (max)
    await expect(page.locator('text=40.0% OFF').first()).toBeVisible();
  });

  test('should allow user to purchase a bond and see the pre-flight modal with referral', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173');
    await page.locator('button:has-text("Usuario")').click();

    // The component might take a second if state is loading, wait for the heading
    await expect(page.locator('h3:has-text("Bóveda de Bonos Vestados con Descuento")')).toBeVisible({ timeout: 10000 });

    const principalInput = page.locator('.glass-panel:has-text("Bóveda de Bonos Vestados con Descuento")').locator('input[type="number"]').first();
    await principalInput.fill('1000');

    const select = page.locator('.glass-panel:has-text("Bóveda de Bonos Vestados con Descuento")').locator('select').first();
    await select.selectOption('1'); // 1 year, 10% discount

    // The referral input is on the card itself, no need to open the modal

    const referralInput = page.getByPlaceholder('0x...', { exact: true });
    await expect(referralInput).toBeVisible({ timeout: 10000 });
    await referralInput.fill('0x1234567890123456789012345678901234567890');

    // Click Buy Bond
    await page.locator('button', { hasText: /Comprar Bono Vestado & Mint NFT/i }).click({ force: true });

    // Verify Pre-Flight Modal
    await expect(page.locator('text=Compra de Bono Vestado a 1 Año').first()).toBeVisible();
    await expect(page.locator('text=USDC (Precio Final con Descuento)')).toBeVisible();
    await expect(page.locator('text=Principal en NFT de Posición')).toBeVisible();
    
    // Check referral label
    await expect(page.locator('text=Referido Asignado')).toBeVisible();

    // Close
    await page.locator('button:has-text("✕")').first().click();
  });
});
