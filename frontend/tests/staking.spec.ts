import { test, expect } from '@playwright/test';

test.describe('Staking & Yield Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:5173');
    // We can do this from the client portal, which is the default active tab.
  });

  test('should allow user to simulate staking ALPHA', async ({ page }) => {
    // Switch to User
    await page.locator('button:has-text("Usuario")').click();
    await expect(page.locator('text=Usuario Retail').first()).toBeVisible({ timeout: 10000 });
    
    // Type stake amount
    const stakeInput = page.getByPlaceholder('ej. 100', { exact: true });
    await expect(stakeInput).toBeVisible({ timeout: 10000 });
    await stakeInput.fill('50');

    // Click Stake
    await page.locator('button:has-text("Stake ALPHA")').click();

    // Verify Pre-flight modal
    await expect(page.locator('text=Staking de ALPHA')).toBeVisible();
    await expect(page.getByText('50 ALPHA').first()).toBeVisible();

    // Cancel modal
    await page.locator('button:has-text("✕")').first().evaluate((el: HTMLElement) => el.click());
  });

  test('should allow user to simulate unstaking', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173');
    await page.locator('button:has-text("Usuario")').click();

    await expect(page.locator('h3', { hasText: /Staking de Gobernanza/i })).toBeVisible({ timeout: 10000 });

    const unstakeInput = page.getByPlaceholder('ej. 100', { exact: true });
    await expect(unstakeInput).toBeVisible({ timeout: 10000 });
    await unstakeInput.fill('25');
    await page.locator('button', { hasText: 'Unstake' }).click();

    // Verify Pre-flight modal
    await expect(page.locator('text=Liberar (Unstake) ALPHA')).toBeVisible({ timeout: 10000 });
    
    await page.locator('button:has-text("✕")').first().evaluate((el: HTMLElement) => el.click());
  });

  test('should allow user to select payout preference and claim yield', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173');
    await page.locator('button:has-text("Usuario")').click();

    await expect(page.locator('h3', { hasText: /Staking de Gobernanza/i })).toBeVisible({ timeout: 10000 });

    // Select Option B (radio button)
    await page.locator('label', { hasText: /Opción B/i }).click();

    // Claim yield
    await page.locator('button', { hasText: /Reclamar Yield/i }).click();

    // Verify Pre-flight modal
    await expect(page.locator('text=Cobrar Dividendos')).toBeVisible({ timeout: 10000 });
    await page.locator('button:has-text("✕")').first().click({ force: true });
  });
});
