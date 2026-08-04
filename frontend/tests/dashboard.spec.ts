import { test, expect } from '@playwright/test';

test.describe('Dashboard & Core Metrics', () => {
  test('should load the dashboard and display NAV and PoR metrics', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173');

    // Wait for the Alpha Centauri header text (using case-insensitive regex for safety)
    await expect(page.locator('h1', { hasText: /ALPHA CENTAURI/i })).toBeVisible({ timeout: 10000 });

    // Validate NAV Pill
    await expect(page.locator('text=VALOR NAV / SHARE')).toBeVisible();

    // Verify Proof of Reserves 
    await expect(page.locator('text=RATIO COLATERAL PoR')).toBeVisible();
    await expect(page.locator('text=100.00%').first()).toBeVisible();

    // Ensure there are no "NaN" values on the screen
    const textContent = await page.evaluate(() => document.body.innerText);
    expect(textContent).not.toContain('NaN');
  });
});
