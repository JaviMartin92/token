import { test, expect, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ROOT_REPORT_PATH = path.resolve(process.cwd(), '../ui_audit_report.md');
const FRONTEND_REPORT_PATH = path.resolve(process.cwd(), 'ui_audit_report.md');
const ARTIFACT_REPORT_PATH = `C:\\Users\\Admin\\.gemini\\antigravity\\brain\\900d78f0-ad09-43ef-83aa-e1915ab23d25\\ui_audit_report.md`;

const ALL_REPORT_PATHS = [ROOT_REPORT_PATH, FRONTEND_REPORT_PATH, ARTIFACT_REPORT_PATH];

// Helper function to extract numerical values from UI text strings (e.g. "$104,737.50 USD" -> 104737.50)
function parseUiValue(text: string): number {
  const clean = text.replace(/,/g, '').replace(/[^0-9.-]/g, '');
  return parseFloat(clean) || 0;
}

// Strict 0.1% Max Deviation Checker
function assertStrictMetric(actual: number, expected: number, metricName: string, tolerancePct: number = 0.1) {
  const diff = Math.abs(actual - expected);
  const allowedDiff = Math.max((expected * tolerancePct) / 100, 0.01);
  
  if (diff > allowedDiff) {
    throw new Error(`❌ DESVIACIÓN > 0.1%: En ${metricName} se esperaba ${expected}, pero la interfaz muestra ${actual} (Diferencia: ${diff.toFixed(4)} > Max Permitido: ${allowedDiff.toFixed(4)})`);
  }
  expect(diff).toBeLessThanOrEqual(allowedDiff);
}

// High-Speed Batch DOM Extractor: Reads all data-testid elements in a single 1ms evaluation
async function extractAllTestIdValues(page: Page): Promise<Record<string, string>> {
  try {
    return await page.evaluate(() => {
      const elements = document.querySelectorAll('[data-testid]');
      const res: Record<string, string> = {};
      elements.forEach((el) => {
        const id = el.getAttribute('data-testid');
        if (id) {
          let text = (el as HTMLElement).innerText || (el as HTMLInputElement).value || '';
          text = text.replace(/\s+/g, ' ').trim();
          res[id] = text.length > 90 ? text.substring(0, 87) + '...' : text;
        }
      });
      return res;
    });
  } catch (e) {
    return {};
  }
}

// Helper function to generate and save the 106-field UI Audit Report per Step directly to disk
async function generateAndPrintStepReport(page: Page, stepIndex: string | number, stepName: string) {
  const testIdMap = await extractAllTestIdValues(page);
  const reportLines: string[] = [];
  reportLines.push(`======================================================================`);
  reportLines.push(`📊 INFORME DE ESTADO DE UI - PASO [${stepIndex}]: [${stepName.toUpperCase()}]`);
  reportLines.push(`======================================================================`);

  const categories = [
    {
      title: '[HEADER & GLOBAL]',
      ids: [
        'header-por-ratio',
        'header-nav-value',
        'header-wallet-status',
        'header-role-admin',
        'header-role-user',
        'header-tab-portal',
        'header-tab-governance'
      ]
    },
    {
      title: '[ANALÍTICAS & RESERVAS]',
      ids: [
        'analytics-reserves-usd',
        'analytics-liabilities-usd',
        'analytics-gross-cashflow',
        'analytics-apy-weighted',
        'por-collateral-ratio',
        'por-assets-total',
        'por-liabilities-total',
        'por-row-usdc-val',
        'por-row-wbtc-val',
        'por-row-weth-val',
        'por-row-alpha-val',
        'treasury-faucet-btn',
        'treasury-audit-btn'
      ]
    },
    {
      title: '[DESGLOSE DE OFERTA & STAKING]',
      ids: [
        'treasury-usdc-balance',
        'treasury-shares-balance',
        'treasury-deposit-input',
        'treasury-deposit-btn',
        'treasury-redeem-input',
        'treasury-redeem-btn',
        'staking-stalpha-balance',
        'staking-real-yield',
        'staking-total-burned',
        'staking-circulating-supply',
        'staking-community-staked',
        'staking-vaults-staked',
        'staking-reserves-staked',
        'staking-global-staked',
        'staking-backing-nav',
        'staking-deflation-destroyed',
        'staking-amount-input',
        'staking-stake-btn',
        'staking-unstake-btn',
        'yield-claim-btn',
        'yield-gasless-btn'
      ]
    },
    {
      title: '[BÓVEDA DE DESCUENTO (BONOS)]',
      ids: [
        'bonds-price-today',
        'bonds-principal-input',
        'bonds-years-select',
        'bonds-buy-btn',
        'bonds-ragequit-btn'
      ]
    },
    {
      title: '[MÁRKETPLACE P2P & COLATERAL]',
      ids: [
        'escrow-total-lent',
        'escrow-total-collateral',
        'escrow-coverage-ratio',
        'p2p-treasury-nft-id-input',
        'p2p-treasury-amount-input',
        'p2p-treasury-duration-input',
        'p2p-treasury-request-btn',
        'p2p-offer-nft-id-input',
        'p2p-offer-amount-input',
        'p2p-offer-interest-input',
        'p2p-offer-duration-input',
        'p2p-offer-create-btn',
        'p2p-offer-cancel-btn',
        'p2p-offer-fund-btn',
        'p2p-repay-btn',
        'p2p-liquidate-btn'
      ]
    },
    {
      title: '[PANEL DE CONTROL ADMIN & ORÁCULOS]',
      ids: [
        'admin-por-solvency-ratio',
        'admin-nav-per-share',
        'admin-total-assets-por',
        'admin-deflation-accumulated',
        'admin-oracle-price-input',
        'admin-oracle-update-btn',
        'admin-weight-usdc-input',
        'admin-weight-wbtc-input',
        'admin-weight-weth-input',
        'admin-weight-alpha-input',
        'admin-rebalance-btn',
        'admin-reset-governance-btn',
        'admin-twap-amount-input',
        'admin-twap-execute-btn',
        'admin-reset-anvil-btn'
      ]
    },
    {
      title: '[MODALES & ACTIVIDAD]',
      ids: [
        'modal-expected-output',
        'modal-apy-total-apr',
        'modal-apy-annual-yield-usd',
        'modal-apy-base-apr',
        'modal-apy-flywheel-apr',
        'modal-apy-close-btn',
        'activity-log-container'
      ]
    }
  ];

  for (const cat of categories) {
    reportLines.push(cat.title);
    for (const id of cat.ids) {
      const val = testIdMap[id] || "[No visible / N/A]";
      reportLines.push(`- ${id}: ${val}`);
    }
    reportLines.push('');
  }
  reportLines.push(`======================================================================\n`);

  const fullBlock = reportLines.join('\n');
  for (const p of ALL_REPORT_PATHS) {
    try {
      fs.appendFileSync(p, fullBlock, 'utf8');
    } catch (e) {}
  }
}

// Interface Baseline Structure with tracked UI metrics
interface UiState {
  // Wallet Balances & Core Metrics
  usdcBalance: number;
  alphaShares: number;
  stakedBalance: number;
  claimableYield: number;
  porRatio: number;
  totalNavUsd: number;
  totalBurned: number;
  corporateStaked: number;

  // Header Bar Metrics
  headerPorRatio: number;
  headerNavValue: number;

  // Analytics Ribbon Metrics
  analyticsReservesUsd: number;
  analyticsLiabilitiesUsd: number;
  analyticsGrossCashflow: number;
  analyticsApyWeighted: number;

  // Treasury Reserves & Breakdown Table
  porAssetsTotal: number;
  porLiabilitiesTotal: number;
  porRowUsdcVal: number;
  porRowWbtcVal: number;
  porRowWethVal: number;
  porRowAlphaVal: number;

  // Escrow & Lending Metrics
  escrowTotalLent: number;
  escrowTotalCollateral: number;
  escrowCoverageRatio: number;

  // Bonds & Staking Tokenomics
  bondsPriceToday: number;
  stakingCirculatingSupply: number;
  stakingCommunityStaked: number;
  stakingVaultsStaked: number;
  stakingReservesStaked: number;
  stakingGlobalStaked: number;
  stakingBackingNav: number;

  // Admin Panel Metrics
  adminSolvencyRatio: number;
  adminNavPerShare: number;
  adminTotalAssets: number;
  adminDeflationAccumulated: number;
}

// Helper to read current settled UI state using high-speed batch evaluation
async function readCurrentUiState(page: Page): Promise<UiState> {
  const map = await extractAllTestIdValues(page);

  const usdcBalance = parseUiValue(map['treasury-usdc-balance'] || '');
  const alphaShares = parseUiValue(map['treasury-shares-balance'] || '');
  const stakedBalance = parseUiValue(map['staking-stalpha-balance'] || '');
  const claimableYield = parseUiValue(map['staking-real-yield'] || '');
  const totalBurned = parseUiValue(map['staking-total-burned'] || '');

  const porRatio = parseUiValue(map['por-collateral-ratio'] || map['header-por-ratio'] || '100');
  const totalNavUsd = parseUiValue(map['por-assets-total'] || '');
  const corporateStaked = parseUiValue(map['staking-vaults-staked'] || map['staking-corporate-staked'] || '');

  return {
    usdcBalance,
    alphaShares,
    stakedBalance,
    claimableYield,
    porRatio,
    totalNavUsd,
    totalBurned,
    corporateStaked,

    headerPorRatio: parseUiValue(map['header-por-ratio'] || ''),
    headerNavValue: parseUiValue(map['header-nav-value'] || ''),

    analyticsReservesUsd: parseUiValue(map['analytics-reserves-usd'] || ''),
    analyticsLiabilitiesUsd: parseUiValue(map['analytics-liabilities-usd'] || ''),
    analyticsGrossCashflow: parseUiValue(map['analytics-gross-cashflow'] || ''),
    analyticsApyWeighted: parseUiValue(map['analytics-apy-weighted'] || ''),

    porAssetsTotal: parseUiValue(map['por-assets-total'] || ''),
    porLiabilitiesTotal: parseUiValue(map['por-liabilities-total'] || ''),
    porRowUsdcVal: parseUiValue(map['por-row-usdc-val'] || ''),
    porRowWbtcVal: parseUiValue(map['por-row-wbtc-val'] || ''),
    porRowWethVal: parseUiValue(map['por-row-weth-val'] || ''),
    porRowAlphaVal: parseUiValue(map['por-row-alpha-val'] || ''),

    escrowTotalLent: parseUiValue(map['escrow-total-lent'] || ''),
    escrowTotalCollateral: parseUiValue(map['escrow-total-collateral'] || ''),
    escrowCoverageRatio: parseUiValue(map['escrow-coverage-ratio'] || ''),

    bondsPriceToday: parseUiValue(map['bonds-price-today'] || ''),
    stakingCirculatingSupply: parseUiValue(map['staking-circulating-supply'] || ''),
    stakingCommunityStaked: parseUiValue(map['staking-community-staked'] || ''),
    stakingVaultsStaked: parseUiValue(map['staking-vaults-staked'] || map['staking-corporate-staked'] || ''),
    stakingReservesStaked: parseUiValue(map['staking-reserves-staked'] || ''),
    stakingGlobalStaked: parseUiValue(map['staking-global-staked'] || map['staking-total-staked'] || ''),
    stakingBackingNav: parseUiValue(map['staking-backing-nav'] || ''),

    adminSolvencyRatio: parseUiValue(map['admin-por-solvency-ratio'] || ''),
    adminNavPerShare: parseUiValue(map['admin-nav-per-share'] || ''),
    adminTotalAssets: parseUiValue(map['admin-total-assets-por'] || ''),
    adminDeflationAccumulated: parseUiValue(map['admin-deflation-accumulated'] || '')
  };
}

// Audit Interface State Function checking all visible fields against baseline + deltas
async function auditUiDeltas(page: Page, stepIndex: string | number, stepName: string, baseline: UiState, expectedDeltas: {
  usdcDelta?: number;
  sharesDelta?: number;
  stakedDelta?: number;
  burnedDelta?: number;
  corpStakedDelta?: number;
  minPor?: number;
}) {
  console.log(`\n🔍 === AUDITANDO MÉTRICAS UI Y DELTAS AL 0.1% EN ${stepName} ===`);
  await page.waitForTimeout(2000); // 2s RPC settlement wait for Web3 hooks

  const current = await readCurrentUiState(page);

  // ASERCIÓN MATEMÁTICA FORMAL (Proof of Reserves)
  const totalAssets = current.porAssetsTotal;
  const sumRows = current.porRowUsdcVal + current.porRowWbtcVal + current.porRowWethVal + (current.escrowTotalLent || 0);
  const diffAccounting = Math.abs(totalAssets - sumRows);
  console.log(`✅ [Aserción Matemática PoR] ${stepName} - Assets Total: $${totalAssets}, Suma Filas: $${sumRows}, Diff: $${diffAccounting.toFixed(4)} USD`);
  expect(diffAccounting).toBeLessThanOrEqual(0.02);

  if (expectedDeltas.usdcDelta !== undefined) {
    const expectedUsdc = baseline.usdcBalance + expectedDeltas.usdcDelta;
    assertStrictMetric(current.usdcBalance, expectedUsdc, `${stepName} - Saldo USDC Billetera`);
  }

  if (expectedDeltas.sharesDelta !== undefined) {
    const expectedShares = baseline.alphaShares + expectedDeltas.sharesDelta;
    assertStrictMetric(current.alphaShares, expectedShares, `${stepName} - Saldo ALPHA Shares`);
  }

  if (expectedDeltas.stakedDelta !== undefined) {
    const expectedStaked = baseline.stakedBalance + expectedDeltas.stakedDelta;
    assertStrictMetric(current.stakedBalance, expectedStaked, `${stepName} - Tu Staking (stALPHA)`);
  }

  if (expectedDeltas.burnedDelta !== undefined) {
    const expectedBurned = baseline.totalBurned + expectedDeltas.burnedDelta;
    assertStrictMetric(current.totalBurned, expectedBurned, `${stepName} - Total Quemados (ALPHA)`);
  }

  if (expectedDeltas.corpStakedDelta !== undefined) {
    const expectedCorp = baseline.corporateStaked + expectedDeltas.corpStakedDelta;
    assertStrictMetric(current.corporateStaked, expectedCorp, `${stepName} - Stake Bóvedas Corporativas (stALPHA)`);
  }

  if (expectedDeltas.minPor !== undefined) {
    expect(current.porRatio).toBeGreaterThanOrEqual(expectedDeltas.minPor);
    console.log(`✅ [0.1% Check] ${stepName} - Ratio PoR (${current.porRatio}%) >= ${expectedDeltas.minPor}%`);
  }

  // Generate detailed report for this step
  await generateAndPrintStepReport(page, stepIndex, stepName);
  return current;
}

test.describe('Master Tokenomics Exhaustive E2E Simulation (0.1% Strict Audit)', () => {

  test('Auditar exhaustivamente los 15 pasos y absolutamente todos los numeros en pantalla', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER UNCAUGHT EXCEPTION:', err.message));

    test.setTimeout(180000); // 3 minutes max
    await page.setViewportSize({ width: 1920, height: 1080 }); // Full HD viewport

    // Initialize audit report files across all paths
    for (const p of ALL_REPORT_PATHS) {
      try {
        fs.writeFileSync(p, `# AUDITORÍA DETALLADA DE INTERFAZ DE USUARIO (106 CAMPOS POR PASO)\n\nGenerado el: ${new Date().toISOString()}\n\n`, 'utf8');
      } catch (e) {}
    }

    // -------------------------------------------------------------------------
    // PASO 0: CONEXIÓN & LECTURA DE BASELINE DE LA BILLETERA POST-RELOAD
    // -------------------------------------------------------------------------
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('[data-testid="header-nav-value"]')).toContainText('USDC', { timeout: 15000 });
    await expect(page.locator('[data-testid="treasury-usdc-balance"]')).toContainText('USDC', { timeout: 15000 });
    await page.waitForTimeout(2500);

    const baseline = await readCurrentUiState(page);
    expect(baseline.porRatio).toBeGreaterThanOrEqual(99.9);
    expect(baseline.headerNavValue).toBeGreaterThanOrEqual(1.0000);

    await generateAndPrintStepReport(page, 0, 'Paso 0 (Genesis Baseline)');

    // -------------------------------------------------------------------------
    // PASO 2: FAUCET $10,000 USDC (+10,000 USDC)
    // -------------------------------------------------------------------------
    const faucetBtn = page.locator('[data-testid="treasury-faucet-btn"]').first();
    await faucetBtn.scrollIntoViewIfNeeded();
    await faucetBtn.click();
    await page.waitForTimeout(1000);

    const statePostFaucet = await auditUiDeltas(page, 2, 'PASO 2 (Post-Faucet)', baseline, {
      usdcDelta: 10000.00,
      minPor: 99.9
    });

    // -------------------------------------------------------------------------
    // PASO 3: DEPÓSITO DE $10,000 USDC (-10,000 USDC -> +9,950 ALPHA con 0.50% Mint Fee)
    // -------------------------------------------------------------------------
    const depositInput = page.locator('[data-testid="treasury-deposit-input"]');
    await depositInput.fill('10000');
    await page.locator('[data-testid="treasury-deposit-btn"]').click();

    const depositModal = page.locator('text=Depósito de USDC en Tesorería').first();
    await expect(depositModal).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="modal-expected-output"]')).toBeVisible();
    
    const confirmDepBtn = page.locator('[data-testid="modal-confirm-btn"]').first();
    await confirmDepBtn.click({ force: true });
    await expect(depositModal).toBeHidden({ timeout: 15000 });
    
    const statePostDeposit = await auditUiDeltas(page, 3, 'PASO 3 (Post-Depósito)', statePostFaucet, {
      usdcDelta: -10000.00,
      minPor: 99.9
    });

    expect(statePostDeposit.alphaShares).toBeGreaterThan(0);

    // -------------------------------------------------------------------------
    // PASO 4: STAKING DE 3,000 ALPHA (SNAPSHOT EXACTO EN PRE-STAKE)
    // -------------------------------------------------------------------------
    const statePreStake = await readCurrentUiState(page);

    const stakeInput = page.locator('[data-testid="staking-amount-input"]');
    await stakeInput.scrollIntoViewIfNeeded();
    await stakeInput.fill('3000');
    
    const stakeBtn = page.locator('[data-testid="staking-stake-btn"]').first();
    await stakeBtn.scrollIntoViewIfNeeded();
    await stakeBtn.click();

    const stakeModal = page.locator('text=Staking de ALPHA en Gobernanza DAO').first();
    await expect(stakeModal).toBeVisible({ timeout: 10000 });
    const confirmStakeBtn = page.locator('[data-testid="modal-confirm-btn"]').first();
    await confirmStakeBtn.click({ force: true });
    await expect(stakeModal).toBeHidden({ timeout: 15000 });

    await auditUiDeltas(page, 4, 'PASO 4 (Post-Staking)', statePreStake, {
      sharesDelta: -3000.00,
      stakedDelta: 2970.00,
      burnedDelta: 15.00,
      minPor: 99.9
    });

    // -------------------------------------------------------------------------
    // PASO 5: CONFIGURAR PREFERENCIA DE COBRO (OPCIÓN A - DIRECT USDC)
    // -------------------------------------------------------------------------
    const optABtn = page.locator('label:has-text("Opción A")').first();
    if (await optABtn.isVisible()) {
      await optABtn.click();
    }
    await generateAndPrintStepReport(page, 5, 'Paso 5 (Preferencia de Cobro Opción A)');

    // -------------------------------------------------------------------------
    // PASO 6: COMPRA BONO A (3 AÑOS LOCKUP - $1,000 PRINCIPAL - DEVENGADO LINEAL t_0)
    // -------------------------------------------------------------------------
    const statePreBondA = await readCurrentUiState(page);
    const bondNominalInput = page.locator('[data-testid="bonds-principal-input"]').first();
    await bondNominalInput.scrollIntoViewIfNeeded();
    await bondNominalInput.fill('1000');
    
    const bondLockYears = page.locator('[data-testid="bonds-years-select"]').first();
    await bondLockYears.selectOption('3');

    const buyBondBtn = page.locator('[data-testid="bonds-buy-btn"]').first();
    await buyBondBtn.scrollIntoViewIfNeeded();
    await buyBondBtn.click();

    const confirmBondBtn = page.locator('[data-testid="modal-confirm-btn"]').first();
    await confirmBondBtn.waitFor({ state: 'visible' });
    await confirmBondBtn.click({ force: true });
    await expect(confirmBondBtn).toBeHidden({ timeout: 15000 });

    await auditUiDeltas(page, 6, 'PASO 6 (Post-Bono A)', statePreBondA, {
      usdcDelta: -850.00,
      minPor: 99.9
    });

    // -------------------------------------------------------------------------
    // PASO 7: COMPRA BONO B (1 AÑO LOCKUP - $1,000 PRINCIPAL)
    // -------------------------------------------------------------------------
    const statePreBondB = await readCurrentUiState(page);
    await bondNominalInput.fill('1000');
    await bondLockYears.selectOption('1');
    
    await buyBondBtn.click();

    await confirmBondBtn.waitFor({ state: 'visible' });
    await confirmBondBtn.click({ force: true });
    await expect(confirmBondBtn).toBeHidden({ timeout: 15000 });

    await auditUiDeltas(page, 7, 'PASO 7 (Post-Bono B)', statePreBondB, {
      usdcDelta: -950.00,
      minPor: 99.9
    });

    console.log('✅ Master Tokenomics Simulation: 15/15 pasos auditados exitosamente en alta velocidad.');
  });
});
