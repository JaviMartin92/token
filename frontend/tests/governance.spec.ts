import { test, expect } from '@playwright/test';

test.describe('Governance Command Center', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:5173');
    await page.locator('button:has-text("Admin / Owner")').click();
    await page.locator('button:has-text("Gobernanza & Tesorería (Admin)")').click();
  });

  test('should display Billeteras Corporativas and Promociones tabs', async ({ page }) => {
    // Switch to Promociones
    await page.locator('button:has-text("Eventos & Promociones")').click();
    
    // Verify Promotions UI
    await expect(page.locator('text=Lanzar Nueva Campaña Promocional On-Chain')).toBeVisible();
    
    const promoInput = page.locator('input[placeholder="Ej. Summer APY Boost 2026"]');
    await promoInput.fill('Test Promo');
    const amountInput = page.locator('input[placeholder="1000"]');
    await amountInput.fill('500');

    await page.locator('button', { hasText: 'Crear y Activar' }).click();
    await expect(page.locator('text=Test Promo').first()).toBeVisible();
    await page.locator('button:has-text("✕")').first().click();
  });
});
