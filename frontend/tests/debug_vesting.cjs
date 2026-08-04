const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5173');
  await page.locator('button:has-text("Usuario")').click();
  
  await page.waitForSelector('h3:has-text("Bóveda de Bonos Vestados con Descuento")', { timeout: 10000 });
  
  const principalInput = page.locator('input[type="number"]').first();
  await principalInput.fill('1000');
  
  const select = page.locator('select').first();
  await select.selectOption('1');
  
  await page.locator('button:has-text("Invitar Amigos")').click();
  await page.waitForSelector('h2:has-text("Programa de Referidos")', { timeout: 10000 });
  await page.locator('button:has-text("✕")').first().click();
  
  const referralInput = page.getByPlaceholder('0x...', { exact: true });
  await referralInput.fill('0x1234567890123456789012345678901234567890');
  
  await page.screenshot({ path: 'before_click.png' });
  
  await page.locator('button', { hasText: /Comprar Bono Vestado & Mint NFT/i }).click({ force: true });
  
  await page.waitForTimeout(2000);
  
  await page.screenshot({ path: 'after_click.png' });
  
  const bodyHtml = await page.innerHTML('body');
  fs.writeFileSync('page_body.html', bodyHtml);
  
  await browser.close();
})();
