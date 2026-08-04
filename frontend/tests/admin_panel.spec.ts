import { test, expect } from '@playwright/test';
import * as fs from 'fs';

test.describe('Admin Control Panel Operations', () => {
  test('should block standard User from accessing the Admin panel', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173');
    
    // Switch to User
    await page.locator('button:has-text("Usuario")').click();
    
    // Switch to Admin Tab
    await page.locator('button:has-text("Gobernanza & Admin (Solo Admin)")').click();

    // Verify Restricted Access Modal appears
    await expect(page.locator('text=Acceso Restringido: Módulo Exclusivo de Administrador')).toBeVisible();
    await expect(page.locator('text=El Panel de Gobernanza y Administración')).toBeVisible();
    
    // Back to Client
    await page.locator('button:has-text("Volver al Portal Cliente")').click();
  });

  test('should allow Admin access and trigger Corporate Injections', async ({ page }) => {
    page.on('pageerror', (err) => console.log('PAGE ERROR:', err));
    page.on('console', (msg) => console.log('CONSOLE:', msg.text()));
    await page.goto('http://127.0.0.1:5173');
    
    // Switch to Admin
    await page.locator('button:has-text("Admin / Owner")').click();
    
    // Switch to Admin Tab
    await page.locator('button:has-text("Gobernanza & Tesorería (Admin)")').click();

    // Verify Admin Panel is visible
    await expect(page.locator('text=Centro de Comando de Gobernanza & DAO')).toBeVisible();

    // 1. Promotions
    await page.locator('button:has-text("Eventos & Promociones")').click();
    
    // Fill campaign details
    await page.locator('input[placeholder="Ej. Summer APY Boost 2026"]').fill('Test Campaign');
    await page.locator('input[placeholder="1000"]').fill('500');
    
    // Click Create Campaign
    await page.locator('button:has-text("Crear y Activar Campaña Promocional")').click();
    
    // Verify pre-flight modal
    await page.waitForTimeout(500); // Give it a tiny bit of time to render
    const html = await page.content();
    fs.writeFileSync('dom-state.html', html);
    await expect(page.locator('text=Test Campaign').first()).toBeVisible();
    
    // Cancel modal
    await page.locator('button:has-text("✕")').first().click();
  });

  test('should allow Admin to toggle Circuit Breaker', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173');
    await page.locator('button:has-text("Admin / Owner")').click();
    await page.locator('button:has-text("Gobernanza & Tesorería (Admin)")').click();

    // Navigate to the Security tab
    await page.locator('button:has-text("🛡️ Consola Seguridad")').click();

    // Update Oracle Price
    await page.locator('button', { hasText: 'Actualizar Oráculo' }).click();
  });
});
