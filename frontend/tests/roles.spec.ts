import { test, expect } from '@playwright/test';

test.describe('Role-Based Access Control', () => {
  test('should allow switching between User and Admin roles', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173');

    // Click on the role switcher button in the header
    await page.locator('button:has-text("Usuario")').click();

    // The user should now see the Restricted Access warning if they try to access Admin tab
    await page.locator('button:has-text("Gobernanza & Admin (Solo Admin)")').click();
    await expect(page.locator('text=Acceso Restringido')).toBeVisible();
    await expect(page.locator('text=Cambiar a Rol Admin / Owner')).toBeVisible();

    // Click the button to switch back to Admin
    await page.locator('button:has-text("Cambiar a Rol Admin / Owner")').click();

    // Verify Admin sees the Governance Command Center
    await expect(page.locator('text=Centro de Comando de Gobernanza')).toBeVisible();
  });
});
