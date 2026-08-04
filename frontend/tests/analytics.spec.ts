import { test, expect } from '@playwright/test';

test.describe('Analytics & Charts Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:5173');
    await page.locator('button:has-text("Usuario")').click();
  });

  test('should load the analytics charts and allow toggling time ranges', async ({ page }) => {
    await expect(page.locator('text=Analíticas On-Chain en Tiempo Real & Desglose de Reservas')).toBeVisible();

    // Verify time range filters
    const filters = ['1W', '1M', '3M', '1Y', 'ALL'];
    for (const filter of filters) {
      await page.locator(`button:has-text("${filter}")`).click();
    }
  });
});
