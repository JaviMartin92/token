import { Page, Locator, expect } from '@playwright/test';
import { TokenomicsSupervisorAgent, AuditRecord } from './TokenomicsSupervisorAgent.js';
import { timeWarp } from '../helpers/evm.js';

export async function isElementVisible(locator: Locator, timeoutMs = 1200): Promise<boolean> {
  try {
    await locator.waitFor({ state: 'visible', timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

export async function confirmModalIfPresent(page: Page, timeoutMs = 1800): Promise<boolean> {
  const confirmBtn = page.locator('[data-testid="modal-confirm-btn"]');
  try {
    await confirmBtn.waitFor({ state: 'visible', timeout: timeoutMs });
    await confirmBtn.click();
    await expect(confirmBtn).toBeHidden({ timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

export async function ensureWalletConnected(page: Page) {
  const connectBtn = page.locator('button:has-text("Conectar Wallet")');
  if (await isElementVisible(connectBtn, 600)) {
    await connectBtn.click();
    await page.waitForTimeout(200);
  }
}

export interface PlatformOperationDef {
  id: string;
  name: string;
  subsystem: string;
  description: string;
  run: (page: Page, iteration: number) => Promise<void>;
}

export class PlatformEndUserAgent {
  private page: Page;
  private supervisor: TokenomicsSupervisorAgent;

  constructor(page: Page, supervisor: TokenomicsSupervisorAgent) {
    this.page = page;
    this.supervisor = supervisor;
    console.log('👤 [USER AGENT] PlatformEndUserAgent inicializado para operar la UI.');
  }

  /**
   * Ejecuta una operación de la plataforma de forma autónoma a través de la UI
   * y delega la auditoría inmediata al supervisor.
   */
  public async executeTransactionWithAudit(
    op: PlatformOperationDef,
    iteration: number
  ): Promise<AuditRecord> {
    console.log(`\n▶️ [USER AGENT -> ITERATION #${iteration}] Ejecutando: ${op.name} (${op.id})`);

    // 1. Auditoría Previa (Pantalla y On-Chain)
    const preScreen = await this.supervisor.captureScreenMetrics(this.page);
    const preChain = await this.supervisor.captureOnChainMetrics();

    // 2. Acción Real del Usuario en la Interfaz (Clicks, Inputs, Modales)
    await op.run(this.page, iteration);

    // 3. Pequeño respiro de sincronización para minado de bloque en Anvil (automine ~10ms)
    await this.page.waitForTimeout(150);

    // 4. Auditoría Posterior (Pantalla y On-Chain)
    const postScreen = await this.supervisor.captureScreenMetrics(this.page);
    const postChain = await this.supervisor.captureOnChainMetrics();

    // 5. Evaluación por el Supervisor Independiente
    const record = this.supervisor.auditTransaction({
      transactionId: `${op.id}-IT${iteration.toString().padStart(2, '0')}`,
      operationName: op.name,
      iteration,
      subsystem: op.subsystem,
      preScreen,
      postScreen,
      preChain,
      postChain,
    });

    if (record.verdict === 'REJECTED') {
      throw new Error(`🚨 [CRITICAL VIOLATION] ${op.name} falló la auditoría de Tokenomics: ${record.rationale}`);
    }

    return record;
  }

  /**
   * Catálogo del 100% de operaciones transaccionales disponibles en la plataforma.
   */
  public getOperationCatalog(): PlatformOperationDef[] {
    return [
      // 1. Faucet Claim
      {
        id: 'TX01_FAUCET',
        name: 'Reclamo de Fondos Faucet USDC',
        subsystem: 'Tesorería & Liquidez',
        description: 'Solicita liquidez USDC de prueba para fondear billetera del usuario.',
        run: async (page, iter) => {
          await ensureWalletConnected(page);
          const faucetBtn = page.locator('[data-testid="treasury-faucet-btn"]');
          if (await isElementVisible(faucetBtn, 1200)) {
            await faucetBtn.click();
            await page.waitForTimeout(200);
          }
        }
      },

      // 2. Suscripción / Depósito Primario (Mint ALPHA)
      {
        id: 'TX02_DEPOSIT',
        name: 'Suscripción de ALPHA (Depósito USDC a NAV)',
        subsystem: 'Tesorería & Mercado Primario',
        description: 'Deposita USDC a valor liquidativo cobrando fee protocolario que acrecienta el NAV.',
        run: async (page, iter) => {
          await ensureWalletConnected(page);
          const amounts = ['100', '250', '500', '750', '1000', '1250', '1500', '2000', '2500', '3000'];
          const amt = amounts[(iter - 1) % amounts.length];
          const depInput = page.locator('[data-testid="treasury-deposit-input"]');
          await depInput.fill(amt);
          await page.locator('[data-testid="treasury-deposit-btn"]').click();
          await confirmModalIfPresent(page, 3000);
          await page.waitForTimeout(200);
        }
      },

      // 3. Reembolso / Retiro Primario (Redeem ALPHA)
      {
        id: 'TX03_REDEEM',
        name: 'Reembolso de ALPHA (Retiro USDC a NAV)',
        subsystem: 'Tesorería & Mercado Primario',
        description: 'Quema cuotas de ALPHA para retirar USDC a NAV descontando comisión de salida.',
        run: async (page, iter) => {
          await ensureWalletConnected(page);
          const amounts = ['20', '35', '50', '65', '80', '100', '120', '150', '180', '200'];
          const amt = amounts[(iter - 1) % amounts.length];
          const redeemInput = page.locator('[data-testid="treasury-redeem-input"]');
          await redeemInput.fill(amt);
          await page.locator('[data-testid="treasury-redeem-btn"]').click();
          await confirmModalIfPresent(page, 3000);
          await page.waitForTimeout(200);
        }
      },

      // 4. Staking de ALPHA -> stALPHA
      {
        id: 'TX04_STAKE',
        name: 'Staking de Gobernanza (ALPHA -> stALPHA)',
        subsystem: 'Gobernanza & Real Yield',
        description: 'Bloquea ALPHA en el contrato GovernanceStaking para devengar Real Yield y derecho de voto.',
        run: async (page, iter) => {
          await ensureWalletConnected(page);
          const amounts = ['50', '80', '120', '150', '200', '250', '300', '350', '400', '500'];
          const amt = amounts[(iter - 1) % amounts.length];
          const stakeInput = page.locator('[data-testid="staking-amount-input"]');
          await stakeInput.fill(amt);
          await page.locator('[data-testid="staking-stake-btn"]').click();
          await confirmModalIfPresent(page, 3000);
          await page.waitForTimeout(200);
        }
      },

      // 5. Retiro de Staking (Unstake stALPHA -> ALPHA)
      {
        id: 'TX05_UNSTAKE',
        name: 'Desbloqueo de Staking (stALPHA -> ALPHA)',
        subsystem: 'Gobernanza & Real Yield',
        description: 'Libera participaciones de stALPHA recibiendo tokens ALPHA líquidos.',
        run: async (page, iter) => {
          await ensureWalletConnected(page);
          const amounts = ['10', '15', '20', '25', '30', '35', '40', '45', '50', '60'];
          const amt = amounts[(iter - 1) % amounts.length];
          const stakeInput = page.locator('[data-testid="staking-amount-input"]');
          await stakeInput.fill(amt);
          const unstakeBtn = page.locator('[data-testid="staking-unstake-btn"]');
          if (await isElementVisible(unstakeBtn, 1200)) {
            await unstakeBtn.click();
            await confirmModalIfPresent(page, 3000);
            await page.waitForTimeout(200);
          }
        }
      },

      // 6. Configuración de Pago de Rendimientos (Opción A vs Opción B)
      {
        id: 'TX06_YIELD_PREFERENCE',
        name: 'Preferencia de Pago de Rendimiento (USDC vs Compounding ALPHA)',
        subsystem: 'Gobernanza & Real Yield',
        description: 'Alterna entre cobro en USDC directo y reinversión automática compuesta en ALPHA.',
        run: async (page, iter) => {
          await ensureWalletConnected(page);
          const isOptionA = iter % 2 === 1;
          const selector = isOptionA ? 'label:has-text("Opción A")' : 'label:has-text("Opción B")';
          const radioBtn = page.locator(selector);
          if (await isElementVisible(radioBtn, 800)) {
            await radioBtn.click();
            await page.waitForTimeout(150);
          }
        }
      },

      // 7. Reclamo de Rendimientos Reales (Real Yield Harvest)
      {
        id: 'TX07_CLAIM_YIELD',
        name: 'Reclamo de Real Yield Acumulado',
        subsystem: 'Gobernanza & Real Yield',
        description: 'Cosecha las recompensas devengadas por comisiones protocolarias hacia la cartera del staker.',
        run: async (page, iter) => {
          await ensureWalletConnected(page);
          const claimBtn = page.locator('button:has-text("Reclamar"), [data-testid="staking-claim-yield-btn"]').first();
          if (await isElementVisible(claimBtn, 800)) {
            await claimBtn.click();
            await confirmModalIfPresent(page, 2000);
            await page.waitForTimeout(150);
          }
        }
      },

      // 8. Adquisición de Bonos Vestados con Descuento (1, 2 y 3 Años)
      {
        id: 'TX08_BUY_BOND',
        name: 'Adquisición de Bono Vestado con Descuento sobre NAV',
        subsystem: 'Bonos Vestados & Posiciones NFT',
        description: 'Compra un bono a descuento emitiendo un NFT. La tesorería provisiona la obligación exacta.',
        run: async (page, iter) => {
          await ensureWalletConnected(page);
          const amounts = ['200', '400', '600', '800', '1000', '1200', '1500', '1800', '2000', '2500'];
          const amt = amounts[(iter - 1) % amounts.length];
          const yearsOptions = ['1', '2', '3'];
          const yr = yearsOptions[(iter - 1) % yearsOptions.length];

          const bondInput = page.locator('[data-testid="bonds-principal-input"]').first();
          await bondInput.scrollIntoViewIfNeeded();
          await bondInput.fill(amt);
          const bondYears = page.locator('[data-testid="bonds-years-select"]').first();
          await bondYears.selectOption(yr);
          await page.locator('[data-testid="bonds-buy-btn"]').first().click();
          await confirmModalIfPresent(page, 3000);
          await page.waitForTimeout(200);
        }
      },

      // 9. Salida Anticipada de Bono (Ragequit con 15% de Penalización)
      {
        id: 'TX09_RAGEQUIT_BOND',
        name: 'Salida Anticipada de Bono (Ragequit)',
        subsystem: 'Bonos Vestados & Salida Anticipada',
        description: 'Cancela posición de bono anticipadamente pagando penalización (50% tesorería, 50% stakers).',
        run: async (page, iter) => {
          await ensureWalletConnected(page);
          let rqBtn = page.locator('button:has-text("Ragequit")').first();
          if (!(await isElementVisible(rqBtn, 800))) {
            const bondInput = page.locator('[data-testid="bonds-principal-input"]').first();
            await bondInput.fill('100');
            await page.locator('[data-testid="bonds-buy-btn"]').first().click();
            await confirmModalIfPresent(page, 3000);
            await page.waitForTimeout(200);
            rqBtn = page.locator('button:has-text("Ragequit")').first();
          }

          if (await isElementVisible(rqBtn, 1200)) {
            await rqBtn.scrollIntoViewIfNeeded();
            await rqBtn.click();
            await confirmModalIfPresent(page, 3000);
            await page.waitForTimeout(200);
          }
        }
      },

      // 10. Reclamo de Bono Vencido (Time-Warp a Vencimiento)
      {
        id: 'TX10_MATURED_BOND_CLAIM',
        name: 'Reclamo de Bono Mínimo Vencido al 100%',
        subsystem: 'Bonos Vestados & Vencimiento',
        description: 'Simula el avance del tiempo y liquida las cuotas de ALPHA devengadas sin penalizaciones.',
        run: async (page, iter) => {
          await ensureWalletConnected(page);
          if (iter === 1) {
            // Avanzar el tiempo 370 días una sola vez para madurar todas las posiciones
            await timeWarp(370 * 86400);
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(400);
            await ensureWalletConnected(page);
          }

          const claimBtn = page.locator('button:has-text("Reclamar")').first();
          if (await isElementVisible(claimBtn, 1200)) {
            await claimBtn.scrollIntoViewIfNeeded();
            await claimBtn.click();
            await confirmModalIfPresent(page, 3000);
            await page.waitForTimeout(200);
          }
        }
      },

      // 11. Creación de Oferta de Préstamo P2P con Colateral NFT
      {
        id: 'TX11_P2P_CREATE_OFFER',
        name: 'Publicación de Solicitud de Préstamo P2P',
        subsystem: 'Préstamos P2P & Escrow',
        description: 'Publica oferta de crédito colateralizada por la posición de bono.',
        run: async (page, iter) => {
          await ensureWalletConnected(page);
          const offerInput = page.locator('[data-testid="p2p-offer-amount-input"]');
          if (await isElementVisible(offerInput, 800)) {
            await offerInput.fill((200 + iter * 50).toString());
            await page.locator('[data-testid="p2p-offer-create-btn"]').click();
            await confirmModalIfPresent(page, 3000);
            await page.waitForTimeout(200);
          }
        }
      },

      // 12. Cancelación / Recuperación de Oferta P2P en Escrow
      {
        id: 'TX12_P2P_CANCEL_OFFER',
        name: 'Cancelación y Rescate de Posición P2P',
        subsystem: 'Préstamos P2P & Escrow',
        description: 'Cancela la solicitud activa y recupera el colateral del contrato escrow.',
        run: async (page, iter) => {
          await ensureWalletConnected(page);
          const cancelBtn = page.locator('button:has-text("Cancelar")').first();
          if (await isElementVisible(cancelBtn, 1000)) {
            await cancelBtn.click();
            await confirmModalIfPresent(page, 3000);
            await page.waitForTimeout(200);
          }
        }
      },

      // 13. Solicitud de Crédito a la Línea de Tesorería P2P
      {
        id: 'TX13_P2P_BORROW_TREASURY',
        name: 'Préstamo Colateralizado de Tesorería',
        subsystem: 'Préstamos P2P & Tesorería',
        description: 'Toma liquidez de la línea de crédito institucional de tesorería a interés devengado.',
        run: async (page, iter) => {
          await ensureWalletConnected(page);
          const treasuryAmtInput = page.locator('[data-testid="p2p-treasury-amount-input"]');
          if (await isElementVisible(treasuryAmtInput, 800)) {
            await treasuryAmtInput.fill('150');
            await page.locator('[data-testid="p2p-treasury-request-btn"]').click();
            await confirmModalIfPresent(page, 3000);
            await page.waitForTimeout(200);
          }
        }
      },

      // 14. Reembolso de Préstamo de Tesorería con Intereses
      {
        id: 'TX14_P2P_REPAY_TREASURY',
        name: 'Reembolso de Préstamo de Tesorería con Intereses',
        subsystem: 'Préstamos P2P & Tesorería',
        description: 'Devuelve principal e intereses que fluyen directamente al fondo de reserva y Real Yield.',
        run: async (page, iter) => {
          await ensureWalletConnected(page);
          const repayBtn = page.locator('button:has-text("Reembolsar")').first();
          if (await isElementVisible(repayBtn, 1000)) {
            await repayBtn.click();
            await confirmModalIfPresent(page, 3000);
            await page.waitForTimeout(200);
          }
        }
      },

      // 15. Creación de Propuesta de Parámetros en Governor DAO
      {
        id: 'TX15_DAO_PROPOSAL',
        name: 'Propuesta de Gobernanza On-Chain (Governor DAO)',
        subsystem: 'Gobernanza DAO',
        description: 'Registra una propuesta formal de actualización de comisiones o parámetros de riesgo.',
        run: async (page, iter) => {
          await page.locator('[data-testid="header-tab-governance"]').click();
          await page.waitForTimeout(300);
          await ensureWalletConnected(page);
          const feeSubtab = page.locator('[data-testid="admin-subtab-fees"]');
          if (await isElementVisible(feeSubtab, 600)) {
            await feeSubtab.click();
            await page.waitForTimeout(150);
          }
          const proposeBtn = page.locator('button:has-text("Guardar Parámetros"), button:has-text("Crear Propuesta DAO")').first();
          if (await isElementVisible(proposeBtn, 1000)) {
            await proposeBtn.click();
            await confirmModalIfPresent(page, 2000);
            await page.waitForTimeout(200);
          }
          await page.locator('[data-testid="header-tab-portal"]').click();
          await page.waitForTimeout(200);
        }
      },

      // 16. Rebalanceo Estratégico de Cartera de Tesorería
      {
        id: 'TX16_REBALANCE_PORTFOLIO',
        name: 'Rebalanceo de Asignación Estratégica de Activos',
        subsystem: 'Gestión de Reservas',
        description: 'Ejecuta el rebalanceo de pesos objetivo (50% USDC, 25% WBTC, 12.5% WETH, 12.5% POL).',
        run: async (page, iter) => {
          await page.locator('[data-testid="header-tab-governance"]').click();
          await page.waitForTimeout(300);
          await ensureWalletConnected(page);
          const rebalBtn = page.locator('[data-testid="admin-rebalance-btn"]');
          if (await isElementVisible(rebalBtn, 1200)) {
            await rebalBtn.click();
            await confirmModalIfPresent(page, 2500);
            await page.waitForTimeout(200);
          }
          await page.locator('[data-testid="header-tab-portal"]').click();
          await page.waitForTimeout(200);
        }
      },

      // 17. Motor de Recompra con Descuento & Quema Deflacionaria
      {
        id: 'TX17_BUYBACK_AND_BURN',
        name: 'Ejecución del Motor de Recompra y Quema Deflacionaria',
        subsystem: 'Mecanismos Antidilución',
        description: 'Recompra tokens en el mercado secundario y los quema irreversiblemente para sostener el NAV.',
        run: async (page, iter) => {
          await page.locator('[data-testid="header-tab-governance"]').click();
          await page.waitForTimeout(300);
          await ensureWalletConnected(page);
          const buybackBtn = page.locator('button:has-text("Recomprar"), button:has-text("Simular Recompra")').first();
          if (await isElementVisible(buybackBtn, 1000)) {
            await buybackBtn.click();
            await page.waitForTimeout(250);
          }
          await page.locator('[data-testid="header-tab-portal"]').click();
          await page.waitForTimeout(200);
        }
      },

      // 18. Prueba de Resiliencia del Circuit Breaker & Restablecimiento
      {
        id: 'TX18_CIRCUIT_BREAKER_CHECK',
        name: 'Prueba de Congelamiento y Restablecimiento de Circuit Breaker',
        subsystem: 'Seguridad & Circuit Breaker',
        description: 'Verifica la integridad del interruptor de emergencia y su restauración mediante multisig DAO.',
        run: async (page, iter) => {
          await page.locator('[data-testid="header-tab-governance"]').click();
          await page.waitForTimeout(300);
          await ensureWalletConnected(page);
          const resetBtn = page.locator('[data-testid="admin-reset-governance-btn"]');
          if (await isElementVisible(resetBtn, 1000)) {
            await resetBtn.click();
            await confirmModalIfPresent(page, 2500);
            await page.waitForTimeout(200);
          }
          await page.locator('[data-testid="header-tab-portal"]').click();
          await page.waitForTimeout(200);
        }
      },

      // 19. Auditoría Transparente del Panel de Métricas & PoR
      {
        id: 'TX19_METRICS_AUDIT_TAB',
        name: 'Inspección de Transparencia y Desglose Patrimonial',
        subsystem: 'Transparencia & Auditoría',
        description: 'Valida la sincronización en vivo de la tabla de solvencia, PoR y ratios de colateral.',
        run: async (page, iter) => {
          await page.locator('[data-testid="header-tab-metrics"]').click();
          await page.waitForTimeout(400);
          await expect(page.locator('[data-testid="por-collateral-ratio"]').first()).toBeVisible({ timeout: 5000 });
          await page.locator('[data-testid="header-tab-portal"]').click();
          await page.waitForTimeout(200);
        }
      },

      // 20. Inspección de Modal APY Desglosado y Enlaces de Referidos
      {
        id: 'TX20_APY_AND_REFERRALS',
        name: 'Auditoría de Componentes Dinámicos (Modal APY y Referidos)',
        subsystem: 'Transparencia & Comunidad',
        description: 'Verifica la apertura y cálculo matemático de las fuentes de rendimiento real y referidos.',
        run: async (page, iter) => {
          await ensureWalletConnected(page);
          const apyPill = page.locator('div[role="button"][title*="APY"]');
          if (await isElementVisible(apyPill, 800)) {
            await apyPill.click();
            await page.waitForTimeout(300);
            await page.locator('.modal-overlay button:has-text("✕")').click();
            await page.waitForTimeout(150);
          }
        }
      }
    ];
  }
}
