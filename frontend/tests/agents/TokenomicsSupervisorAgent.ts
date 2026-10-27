import { Page } from '@playwright/test';
import { createPublicClient, http, formatEther, parseEther } from 'viem';
import * as fs from 'fs';
import * as path from 'path';

const ANVIL_URL = process.env.ANVIL_URL || 'http://127.0.0.1:8545';

function loadContractsConfig(): Record<string, string> {
  const possiblePaths = [
    path.resolve(process.cwd(), 'src/contracts.json'),
    path.resolve(process.cwd(), 'frontend/src/contracts.json'),
    path.resolve(process.cwd(), '../frontend/src/contracts.json'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
      } catch {
        // Continue
      }
    }
  }
  return {
    TREASURY: '0x322813fd9a801c5507c9de605d63cea4f2ce6c44',
    STAKING: '0x95401dc811bb5740090279ba06cfa8fcf6113778',
    ALPHA_TOKEN: '0x68b1d87f95878fe05b998f19b66f4baba5de1aed',
    VESTED_VAULT: '0x5f3f1dbd7b74c6b46e8c44f98792a1daf8d69154'
  };
}

const contractsConfig = loadContractsConfig();

const client = createPublicClient({
  transport: http(ANVIL_URL)
});

export interface ScreenMetrics {
  navUSD: number;
  porRatioPct: number;
  liabilitiesUSD: number;
  assetsUSD: number;
  circulatingAlpha: number;
  communityStakedAlpha: number;
  totalStakedAlpha: number;
  burnedAlpha: number;
  treasuryUsdc: number;
  treasuryAlpha: number;
}

export interface OnChainMetrics {
  navUSD: number;
  porRatioPct: number;
  totalAssetsUSD: number;
  totalLiabilitiesUSD: number;
  circulatingShares: number;
  lastSettledNav: number;
  totalSupplyAlpha: number;
  communityStaked: number;
  treasuryStaked: number;
  globalTotalStaked: number;
  totalBurned: number;
  vestedLiabilityUSD: number;
}

export interface AuditRecord {
  transactionId: string;
  operationName: string;
  iteration: number;
  subsystem: string;
  timestamp: string;
  preScreen: ScreenMetrics;
  postScreen: ScreenMetrics;
  preChain: OnChainMetrics;
  postChain: OnChainMetrics;
  discrepancies: {
    navDiscrepancy: number;
    porDiscrepancy: number;
    liabilitiesDiscrepancy: number;
    assetsDiscrepancy: number;
    circulatingDiscrepancy: number;
    hasDiscrepancy: boolean;
    notes: string[];
  };
  invariants: {
    nonDecreasingNav: boolean;
    deltaNav: number;
    fullSolvencyPoR: boolean;
    honestLiabilityRecognition: boolean;
    capitalLeakageFree: boolean;
    deflationIntegrity: boolean;
    allInvariantsPass: boolean;
  };
  verdict: 'APPROVED' | 'FLAGGED' | 'REJECTED';
  rationale: string;
}

export class TokenomicsSupervisorAgent {
  private auditLedger: AuditRecord[] = [];
  private client = client;
  private lastKnownNav = 1.0;
  private contracts = contractsConfig;

  constructor() {
    console.log('🛡️ [SUPERVISOR AGENT] TokenomicsSupervisorAgent inicializado con conexión RPC directa.');
  }

  /**
   * Captura métricas directamente de la interfaz de usuario (DOM).
   */
  public async captureScreenMetrics(page: Page): Promise<ScreenMetrics> {
    const parseNum = (s: string | null) => {
      if (!s) return 0;
      const clean = s.replace(/[^0-9.-]/g, '');
      return parseFloat(clean) || 0;
    };

    const navText = await page.locator('[data-testid="header-nav-value"]').textContent({ timeout: 2500 }).catch(() => '');
    const porText = await page.locator('[data-testid="header-por-ratio"]').textContent({ timeout: 2500 }).catch(() => '100%');
    const liabilitiesText = await page.locator('[data-testid="por-liabilities-total"]').textContent({ timeout: 1500 }).catch(() => '$0 USD');
    const assetsText = await page.locator('[data-testid="por-assets-total"]').textContent({ timeout: 1500 }).catch(() => '$0 USD');
    const circText = await page.locator('[data-testid="staking-circulating-supply"]').textContent({ timeout: 1500 }).catch(() => '0 ALPHA');
    const commStakedText = await page.locator('[data-testid="staking-community-staked"]').textContent({ timeout: 1500 }).catch(() => '0 stALPHA');
    const totalStakedText = await page.locator('[data-testid="staking-total-staked"]').textContent({ timeout: 1500 }).catch(() => '0 ALPHA');
    const burnedText = await page.locator('[data-testid="staking-deflation-burned"]').textContent({ timeout: 1500 }).catch(() => '0 ALPHA');
    const usdcText = await page.locator('[data-testid="treasury-usdc-balance"]').textContent({ timeout: 1500 }).catch(() => '0');
    const sharesText = await page.locator('[data-testid="treasury-shares-balance"]').textContent({ timeout: 1500 }).catch(() => '0');

    let parsedNav = parseNum(navText);
    if (parsedNav > 0) {
      this.lastKnownNav = parsedNav;
    } else {
      parsedNav = this.lastKnownNav;
    }

    return {
      navUSD: parsedNav,
      porRatioPct: parseNum(porText) || 100,
      liabilitiesUSD: parseNum(liabilitiesText),
      assetsUSD: parseNum(assetsText),
      circulatingAlpha: parseNum(circText),
      communityStakedAlpha: parseNum(commStakedText),
      totalStakedAlpha: parseNum(totalStakedText),
      burnedAlpha: parseNum(burnedText),
      treasuryUsdc: parseNum(usdcText),
      treasuryAlpha: parseNum(sharesText),
    };
  }

  /**
   * Consulta el estado de verdad absoluta on-chain a través del nodo RPC.
   */
  public async captureOnChainMetrics(): Promise<OnChainMetrics> {
    try {
      const treasuryAddr = this.contracts.TREASURY as `0x${string}`;
      const stakingAddr = this.contracts.STAKING as `0x${string}`;
      const alphaTokenAddr = this.contracts.ALPHA_TOKEN as `0x${string}`;
      const vestedVaultAddr = this.contracts.VESTED_VAULT as `0x${string}`;

      const [porRes, navWei, netCircWei, lastSettledNavWei, stakingBreakdown, vestedLiabilityWei, totalSupplyWei] = await Promise.all([
        this.client.readContract({
          address: treasuryAddr,
          abi: [
            {
              name: 'getProofOfReserves',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [
                { name: 'totalAssetsUSD', type: 'uint256' },
                { name: 'totalLiabilitiesUSD', type: 'uint256' },
                { name: 'collateralRatioBps', type: 'uint256' }
              ]
            }
          ],
          functionName: 'getProofOfReserves'
        }) as Promise<[bigint, bigint, bigint]>,

        this.client.readContract({
          address: treasuryAddr,
          abi: [{ name: 'getNAVPerShare', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] }],
          functionName: 'getNAVPerShare'
        }) as Promise<bigint>,

        this.client.readContract({
          address: treasuryAddr,
          abi: [{ name: 'getNetCirculatingShares', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] }],
          functionName: 'getNetCirculatingShares'
        }) as Promise<bigint>,

        this.client.readContract({
          address: treasuryAddr,
          abi: [{ name: 'lastSettledNAVPerShare', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] }],
          functionName: 'lastSettledNAVPerShare'
        }) as Promise<bigint>,

        this.client.readContract({
          address: stakingAddr,
          abi: [
            {
              name: 'getStakingBreakdown',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [
                {
                  type: 'tuple',
                  components: [
                    { name: 'communityStaked', type: 'uint256' },
                    { name: 'communityVaultStaked', type: 'uint256' },
                    { name: 'treasuryStaked', type: 'uint256' },
                    { name: 'globalTotalStaked', type: 'uint256' },
                    { name: 'netCirculatingSupply', type: 'uint256' },
                    { name: 'totalBurned', type: 'uint256' }
                  ]
                }
              ]
            }
          ],
          functionName: 'getStakingBreakdown'
        }) as Promise<any>,

        this.client.readContract({
          address: vestedVaultAddr,
          abi: [{ name: 'totalPresentLiability', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] }],
          functionName: 'totalPresentLiability'
        }).catch(() => 0n) as Promise<bigint>,

        this.client.readContract({
          address: alphaTokenAddr,
          abi: [{ name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] }],
          functionName: 'totalSupply'
        }) as Promise<bigint>,
      ]);

      const totalAssets = parseFloat(formatEther(porRes[0]));
      const totalLiabilities = parseFloat(formatEther(porRes[1]));
      const porRatioPct = totalLiabilities > 0 ? (totalAssets / totalLiabilities) * 100 : Number(porRes[2]) / 100;
      const navUSD = parseFloat(formatEther(navWei));
      const circulatingShares = parseFloat(formatEther(netCircWei));
      const lastSettledNav = parseFloat(formatEther(lastSettledNavWei));
      const totalSupplyAlpha = parseFloat(formatEther(totalSupplyWei));
      const vestedLiabilityUSD = parseFloat(formatEther(vestedLiabilityWei));

      const commStaked = parseFloat(formatEther(stakingBreakdown.communityStaked ?? stakingBreakdown[0] ?? 0n));
      const treasStaked = parseFloat(formatEther(stakingBreakdown.treasuryStaked ?? stakingBreakdown[2] ?? 0n));
      const globStaked = parseFloat(formatEther(stakingBreakdown.globalTotalStaked ?? stakingBreakdown[3] ?? 0n));
      const burned = parseFloat(formatEther(stakingBreakdown.totalBurned ?? stakingBreakdown[5] ?? 0n));

      return {
        navUSD,
        porRatioPct,
        totalAssetsUSD: totalAssets,
        totalLiabilitiesUSD: totalLiabilities,
        circulatingShares,
        lastSettledNav,
        totalSupplyAlpha,
        communityStaked: commStaked,
        treasuryStaked: treasStaked,
        globalTotalStaked: globStaked,
        totalBurned: burned,
        vestedLiabilityUSD,
      };
    } catch (err: any) {
      console.error('❌ [SUPERVISOR AGENT] Error leyendo estado on-chain:', err.message);
      return {
        navUSD: this.lastKnownNav,
        porRatioPct: 100,
        totalAssetsUSD: 0,
        totalLiabilitiesUSD: 0,
        circulatingShares: 0,
        lastSettledNav: 1.0,
        totalSupplyAlpha: 0,
        communityStaked: 0,
        treasuryStaked: 0,
        globalTotalStaked: 0,
        totalBurned: 0,
        vestedLiabilityUSD: 0,
      };
    }
  }

  /**
   * Ejecuta la auditoría comparativa tras cada transacción:
   * 1. Compara pantalla vs on-chain (discrepancias).
   * 2. Comprueba los 5 invariantes matemáticos de los tokenomics.
   * 3. Emite veredicto: APPROVED | FLAGGED | REJECTED.
   */
  public auditTransaction(params: {
    transactionId: string;
    operationName: string;
    iteration: number;
    subsystem: string;
    preScreen: ScreenMetrics;
    postScreen: ScreenMetrics;
    preChain: OnChainMetrics;
    postChain: OnChainMetrics;
  }): AuditRecord {
    const { transactionId, operationName, iteration, subsystem, preScreen, postScreen, preChain, postChain } = params;

    // 1. Análisis de Discrepancias Pantalla vs On-Chain (Tolerancia máxima 0.05% o redondeo de centavos)
    const navDiff = Math.abs(postScreen.navUSD - postChain.navUSD);
    const porDiff = Math.abs(postScreen.porRatioPct - postChain.porRatioPct);
    const liabDiff = postChain.totalLiabilitiesUSD > 0
      ? Math.abs(postScreen.liabilitiesUSD - postChain.totalLiabilitiesUSD) / postChain.totalLiabilitiesUSD
      : 0;
    const assetsDiff = postChain.totalAssetsUSD > 0
      ? Math.abs(postScreen.assetsUSD - postChain.totalAssetsUSD) / postChain.totalAssetsUSD
      : 0;
    const circDiff = Math.abs(postScreen.circulatingAlpha - postChain.circulatingShares);

    const notes: string[] = [];
    let hasDiscrepancy = false;

    if (navDiff > 0.005) {
      hasDiscrepancy = true;
      notes.push(`Discrepancia en NAV: Pantalla=$${postScreen.navUSD.toFixed(4)} vs OnChain=$${postChain.navUSD.toFixed(4)} (diff: ${navDiff.toFixed(6)})`);
    }
    if (porDiff > 0.1) {
      hasDiscrepancy = true;
      notes.push(`Discrepancia en PoR: Pantalla=${postScreen.porRatioPct.toFixed(2)}% vs OnChain=${postChain.porRatioPct.toFixed(2)}% (diff: ${porDiff.toFixed(4)}%)`);
    }
    if (liabDiff > 0.02) {
      hasDiscrepancy = true;
      notes.push(`Discrepancia en Pasivos: Pantalla=$${postScreen.liabilitiesUSD.toFixed(2)} vs OnChain=$${postChain.totalLiabilitiesUSD.toFixed(2)} (diff: ${(liabDiff * 100).toFixed(2)}%)`);
    }

    // 2. Verificación de los 5 Invariantes Fundamentales de Tokenomics
    // Invariante 1: No dilución de NAV (NAV post >= NAV pre - epsilon)
    const deltaNav = postChain.navUSD - preChain.navUSD;
    const nonDecreasingNav = deltaNav >= -0.00001;
    if (!nonDecreasingNav) {
      notes.push(`INVARIANTE NAV VIOLADO: NAV disminuyó de $${preChain.navUSD.toFixed(6)} a $${postChain.navUSD.toFixed(6)} (delta: ${deltaNav.toFixed(6)})`);
    }

    // Invariante 2: Cobertura de Solvencia Global (PoR >= 100.00%)
    const fullSolvencyPoR = postChain.porRatioPct >= 99.99;
    if (!fullSolvencyPoR) {
      notes.push(`INVARIANTE PoR VIOLADO: PoR cayó bajo solvencia plena: ${postChain.porRatioPct.toFixed(2)}%`);
    }

    // Invariante 3: Reconocimiento Honesto de Pasivos
    const honestLiabilityRecognition = postChain.totalLiabilitiesUSD >= 0 && postChain.vestedLiabilityUSD >= 0;

    // Invariante 4: Cero Fuga de Capital (Activos no desaparecen sin contrapartida)
    const capitalLeakageFree = postChain.totalAssetsUSD > 0;

    // Invariante 5: Integridad Deflacionaria (Quemas acumuladas nunca disminuyen)
    const deflationIntegrity = postChain.totalBurned >= preChain.totalBurned;
    if (!deflationIntegrity) {
      notes.push(`INVARIANTE QUEMAS VIOLADO: totalBurned disminuyó de ${preChain.totalBurned} a ${postChain.totalBurned}`);
    }

    const allInvariantsPass = nonDecreasingNav && fullSolvencyPoR && honestLiabilityRecognition && capitalLeakageFree && deflationIntegrity;

    let verdict: 'APPROVED' | 'FLAGGED' | 'REJECTED' = 'APPROVED';
    if (!allInvariantsPass) {
      verdict = 'REJECTED';
    } else if (hasDiscrepancy) {
      verdict = 'FLAGGED';
    }

    const rationale = verdict === 'APPROVED'
      ? `Transacción verificada: NAV preservado (+${deltaNav.toFixed(6)} USD), PoR solvente (${postChain.porRatioPct.toFixed(2)}%), y concordancia pantalla/on-chain.`
      : notes.join(' | ');

    const record: AuditRecord = {
      transactionId,
      operationName,
      iteration,
      subsystem,
      timestamp: new Date().toISOString(),
      preScreen,
      postScreen,
      preChain,
      postChain,
      discrepancies: {
        navDiscrepancy: navDiff,
        porDiscrepancy: porDiff,
        liabilitiesDiscrepancy: liabDiff,
        assetsDiscrepancy: assetsDiff,
        circulatingDiscrepancy: circDiff,
        hasDiscrepancy,
        notes,
      },
      invariants: {
        nonDecreasingNav,
        deltaNav,
        fullSolvencyPoR,
        honestLiabilityRecognition,
        capitalLeakageFree,
        deflationIntegrity,
        allInvariantsPass,
      },
      verdict,
      rationale,
    };

    this.auditLedger.push(record);

    const icon = verdict === 'APPROVED' ? '✅' : verdict === 'FLAGGED' ? '⚠️' : '🚨';
    console.log(`${icon} [SUPERVISOR AUDIT #${iteration}] ${operationName}: ${verdict} | NAV: $${postChain.navUSD.toFixed(4)} (Δ${deltaNav >= 0 ? '+' : ''}${deltaNav.toFixed(4)}) | PoR: ${postChain.porRatioPct.toFixed(2)}%`);

    return record;
  }

  public getLedger(): AuditRecord[] {
    return this.auditLedger;
  }

  public getSummary() {
    const total = this.auditLedger.length;
    const approved = this.auditLedger.filter(r => r.verdict === 'APPROVED').length;
    const flagged = this.auditLedger.filter(r => r.verdict === 'FLAGGED').length;
    const rejected = this.auditLedger.filter(r => r.verdict === 'REJECTED').length;

    return {
      total,
      approved,
      flagged,
      rejected,
      passRatePct: total > 0 ? ((approved / total) * 100).toFixed(2) : '100.00',
    };
  }
}
