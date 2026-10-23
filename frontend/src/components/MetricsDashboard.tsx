import React from 'react';
import styles from './MetricsDashboard.module.css';
import { ProtocolAnalyticsCharts } from './ProtocolAnalyticsCharts.js';
import { UI_STRINGS } from '../constants/strings.js';
import { Card, StatCard, DataTable, Badge, Button } from './common/index.js';

interface MetricsDashboardProps {
  porAssets: string;
  porLiabilities: string;
  porRatio: string;
  porBreakdown: { stables: number; wbtc: number; weth: number; alphaStaking: number };
  usdcBalance: string;
  sharesBalance: string;
  stakedBalance: string;
  claimableYield: string;
  totalBurnedTokens: string;
  circulatingSupply: string;
  totalStakedSupply: string;
  communityStakedSupply: string;
  communityVaultStakedSupply: string;
  treasuryStakedSupply: string;
  stakingRatioPct: string;
  navPerShareUSD: string;
  userPositions: any[];
  loansList: any[];
  onOpenApyModal: () => void;
  liveApyStr: string;
  targetWeights?: { stables: number; wbtc: number; weth: number; alts: number };
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({
  porAssets,
  porLiabilities,
  porRatio,
  porBreakdown,
  stakedBalance,
  claimableYield,
  totalBurnedTokens,
  circulatingSupply,
  totalStakedSupply,
  communityStakedSupply,
  communityVaultStakedSupply,
  treasuryStakedSupply,
  stakingRatioPct,
  navPerShareUSD,
  userPositions,
  loansList,
  onOpenApyModal,
  liveApyStr,
  targetWeights = { stables: 50, wbtc: 25, weth: 12.5, alts: 12.5 }
}) => {
  const numericRatioPct = parseFloat((porRatio || '100').replace(/,/g, '').replace('%', '')) || 100.0;
  const numericAssets = parseFloat(porAssets.replace(/,/g, '')) || 0;
  const numericLiabilities = parseFloat(porLiabilities.replace(/,/g, '')) || 0;

  // Real Treasury Surplus calculation based on NAV growth above par ($1.00 USD baseline)
  const numericNav = parseFloat((navPerShareUSD || '1.0').replace('$', '').replace(' USDC', '')) || 1.0;
  const numericCirculating = parseFloat((circulatingSupply || '0').replace(/,/g, '')) || 0;
  const parNominalLiabilities = numericCirculating * 1.0;
  const treasurySurplusUSD = (numericNav > 1.0 && numericCirculating > 0)
    ? (numericNav - 1.0) * numericCirculating
    : (numericAssets > numericLiabilities ? numericAssets - numericLiabilities : 0);
  const surplusPct = (numericNav > 1.0) ? (numericNav - 1.0) * 100 : 0;

  // Exogenous reserves breakdown directly from Treasury.sol getAssetBreakdown()
  const stablesUSD = porBreakdown.stables;
  const btcUSD = porBreakdown.wbtc;
  const ethUSD = porBreakdown.weth;

  // Treasury Sub-Reserve (stALPHA in Governance Staking)
  const treasuryStakedNum = parseFloat((treasuryStakedSupply || '0').replace(/,/g, '')) || 0;
  const treasuryStakedUSD = treasuryStakedNum * numericNav;

  // Dynamic portfolio allocation weights
  const totalPortfolioUSD = stablesUSD + btcUSD + ethUSD + treasuryStakedUSD;
  const safeTotalUSD = totalPortfolioUSD > 0 ? totalPortfolioUSD : 1;

  const stablesActualPct = (stablesUSD / safeTotalUSD) * 100;
  const btcActualPct = (btcUSD / safeTotalUSD) * 100;
  const ethActualPct = (ethUSD / safeTotalUSD) * 100;
  const alphaActualPct = (treasuryStakedUSD / safeTotalUSD) * 100;

  const tableHeaders = [
    UI_STRINGS.METRICS.TH_ASSET,
    UI_STRINGS.METRICS.TH_ALLOCATION,
    UI_STRINGS.METRICS.TH_TARGET_WEIGHT,
    UI_STRINGS.METRICS.TH_TOTAL_VALUE_USD,
    UI_STRINGS.METRICS.TH_YIELD_SOURCE
  ];

  return (
    <div className={styles.container}>
      {/* 📊 SECCIÓN 1: PANEL SUPERIOR DE KPI METRICS */}
      <Card variant="surface">
        <div className={styles.headerRow}>
          <div>
            <h2 className={styles.title}>{UI_STRINGS.METRICS.TITLE}</h2>
            <p className={styles.subtitle}>{UI_STRINGS.METRICS.SUBTITLE}</p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={onOpenApyModal}
          >
            ⚡ Desglose Matemático APY ({liveApyStr})
          </Button>
        </div>

        {/* KPIs Grid con StatCards */}
        <div className={styles.kpiGrid}>
          <StatCard
            title={UI_STRINGS.METRICS.SOLVENCY_CARD_TITLE}
            value={porRatio.includes('%') ? porRatio : `${porRatio}%`}
            testId="por-collateral-ratio"
            variant={numericRatioPct >= 100 ? 'emerald' : 'crimson'}
            icon="🛡️"
            subtext="Respaldo 1:1 al 100% NAV (Solvencia Plena)"
          />

          <StatCard
            title="Respaldo (NAV / ALPHA)"
            value={navPerShareUSD.startsWith('$') ? navPerShareUSD : `$${navPerShareUSD} USDC`}
            testId="header-nav-value"
            variant="blue"
            icon="💎"
            subtext="Valor Patrimonial Neto On-Chain"
          />

          <StatCard
            title={UI_STRINGS.METRICS.TOTAL_ASSETS_LABEL}
            value={`$${porAssets} USD`}
            testId="por-assets-total"
            variant="default"
            icon="🏦"
            subtext="USDC + WBTC + WETH en Reservas"
          />

          <StatCard
            title={UI_STRINGS.METRICS.TOTAL_LIABILITIES_LABEL}
            value={`$${porLiabilities} USD`}
            testId="por-liabilities-total"
            variant="default"
            icon="📄"
            subtext={parNominalLiabilities > 0
              ? '100% Cobertura de Reembolso Inmediato a Valor Liquidativo (NAV)'
              : 'Obligaciones con Tenedores de ALPHA'}
          />

          <StatCard
            title="Crecimiento de Reservas"
            value={`+$${treasurySurplusUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`}
            testId="treasury-surplus-total"
            variant="emerald"
            icon="✨"
            subtext={`+${surplusPct.toFixed(2)}% Crecimiento de NAV desde Génesis ($1.00)`}
          />
        </div>

        {/* 💎 Institutional Claim: Banner de Acreción de NAV y No Dilución */}
        {treasurySurplusUSD > 0 && (
          <div className={styles.surplusBanner}>
            <div className={styles.surplusInfo}>
              <span className={styles.surplusIcon} aria-hidden="true">💎</span>
              <div>
                <div className={styles.surplusHeading}>
                  CRECIMIENTO PATRIMONIAL DEL PROTOCOLO: +${treasurySurplusUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD (+{surplusPct.toFixed(2)}% sobre Base Génesis)
                </div>
                <div className={styles.surplusText}>
                  Cada nueva cuota de ALPHA se emite estrictamente a valor liquidativo (NAV actual: <strong>{navPerShareUSD.startsWith('$') ? navPerShareUSD : `$${navPerShareUSD} USDC`}</strong>) protegiendo a los tenedores contra la dilución. El valor patrimonial por share se ha revalorizado un <strong>+{surplusPct.toFixed(2)}%</strong> sobre la base génesis ($1.00 USD) impulsado por las comisiones de emisión protocolarias y los rendimientos reales de las bóvedas institucionales.
                </div>
              </div>
            </div>
            <Badge variant="emerald" size="md">
              ACRECIÓN DE VALOR ON-CHAIN
            </Badge>
          </div>
        )}
      </Card>

      {/* 🪙 SECCIÓN 2: ESTADO DE TOKENOMICS & STAKING EN PANTALLA */}
      <Card
        variant="surface"
        headerTitle="🥩 Tokenomics & Estado de Oferta Deflacionaria"
        headerSubtitle="Monitoreo en tiempo real de suministro circulante, staking en gobernanza y quemas deflacionarias"
      >
        <div className={styles.tokenomicsGrid}>
          <StatCard
            title={UI_STRINGS.STAKING.METRIC_CIRCULATING}
            value={`${circulatingSupply} ${UI_STRINGS.COMMON.SYMBOL_ALPHA}`}
            testId="staking-circulating-supply"
            variant="blue"
            icon="🪙"
            subtext="Suministro Circulante Total"
          />

          <StatCard
            title="Stake Comunidad"
            value={`${communityStakedSupply} ${UI_STRINGS.COMMON.SYMBOL_STALPHA}`}
            testId="staking-community-staked"
            variant="default"
            icon="👤"
            subtext="Bloqueado por Inversores"
          />

          <StatCard
            title="Stake Bóveda Comunitaria"
            value={
              <>
                <span data-testid="staking-vaults-staked">{communityVaultStakedSupply}</span> {UI_STRINGS.COMMON.SYMBOL_STALPHA}
              </>
            }
            testId="staking-community-vault-staked"
            variant="default"
            icon="💎"
            subtext="Community Yield Vault"
          />

          <StatCard
            title="Stake Reservas"
            value={`${treasuryStakedSupply} ${UI_STRINGS.COMMON.SYMBOL_STALPHA}`}
            testId="staking-reserves-staked"
            variant="emerald"
            icon="🏛️"
            subtext="Sub-Reserva Tesorería"
          />

          <StatCard
            title={UI_STRINGS.STAKING.METRIC_TOTAL_STAKED}
            value={
              <>
                <span data-testid="staking-global-staked">{totalStakedSupply}</span> {UI_STRINGS.COMMON.SYMBOL_ALPHA} ({stakingRatioPct.includes('%') ? stakingRatioPct : `${stakingRatioPct}%`})
              </>
            }
            testId="staking-total-staked"
            variant="default"
            icon="🥩"
            subtext="Total stALPHA en Gobernanza"
          />

          <StatCard
            title={UI_STRINGS.STAKING.METRIC_TOTAL_BURNED}
            value={
              <>
                <span data-testid="staking-deflation-destroyed">{totalBurnedTokens}</span> {UI_STRINGS.COMMON.SYMBOL_ALPHA}
              </>
            }
            testId="staking-deflation-burned"
            variant="crimson"
            icon="🔥"
            subtext="Quema Definitiva Irreversible"
          />
        </div>
      </Card>

      {/* 📊 SECCIÓN 3: TABLA DE RESPALDO EXÓGENO DE RESERVAS */}
      <Card
        variant="surface"
        headerTitle={UI_STRINGS.METRICS.TABLE_ASSETS_TITLE}
        headerSubtitle="Auditoría matemática de activos colaterales y bóvedas generadoras de rendimiento"
      >
        <DataTable headers={tableHeaders} minWidth="650px">
          <tr>
            <td data-label="Activo">
              <div className={styles.assetCell}>
                <span>💵</span>
                <span>USDC / Stablecoins</span>
              </div>
            </td>
            <td data-label="Asignación Actual" className={styles.boldNum}>{stablesActualPct.toFixed(2)}%</td>
            <td data-label="Ponderación Objetivo">{(targetWeights?.stables || 50).toFixed(2)}% Target</td>
            <td data-label="Valoración en USD" data-testid="por-row-usdc-val" className={styles.boldNum}>
              ${stablesUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </td>
            <td data-label="Fuente Rendimiento" className={styles.mutedText}>{UI_STRINGS.METRICS.MORPHO_USDC_SOURCE} / Créditos P2P</td>
          </tr>

          <tr>
            <td data-label="Activo">
              <div className={styles.assetCell}>
                <span>🪙</span>
                <span>Wrapped Bitcoin (WBTC)</span>
              </div>
            </td>
            <td data-label="Asignación Actual" className={styles.boldNum}>{btcActualPct.toFixed(2)}%</td>
            <td data-label="Ponderación Objetivo">{(targetWeights?.wbtc || 25).toFixed(2)}% Target</td>
            <td data-label="Valoración en USD" data-testid="por-row-wbtc-val" className={styles.boldNum}>
              ${btcUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </td>
            <td data-label="Fuente Rendimiento" className={styles.mutedText}>{UI_STRINGS.METRICS.LOMBARD_LBTC_SOURCE} / Oráculo Chainlink</td>
          </tr>

          <tr>
            <td data-label="Activo">
              <div className={styles.assetCell}>
                <span>🔷</span>
                <span>Wrapped Ethereum (WETH)</span>
              </div>
            </td>
            <td data-label="Asignación Actual" className={styles.boldNum}>{ethActualPct.toFixed(2)}%</td>
            <td data-label="Ponderación Objetivo">{(targetWeights?.weth || 12.5).toFixed(2)}% Target</td>
            <td data-label="Valoración en USD" data-testid="por-row-weth-val" className={styles.boldNum}>
              ${ethUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </td>
            <td data-label="Fuente Rendimiento" className={styles.mutedText}>{UI_STRINGS.METRICS.LIDO_WSTETH_SOURCE} / Oráculo Chainlink</td>
          </tr>

          <tr>
            <td data-label="Activo">
              <div className={styles.assetCell}>
                <span>🏛️</span>
                <span>Sub-Reserva ALPHA Staking (POL)</span>
              </div>
            </td>
            <td data-label="Asignación Actual" className={styles.boldNum}>{alphaActualPct.toFixed(2)}%</td>
            <td data-label="Ponderación Objetivo">{(targetWeights?.alts || 12.5).toFixed(2)}% Target</td>
            <td data-label="Valoración en USD" data-testid="por-row-alpha-val" className={styles.boldNum}>
              ${treasuryStakedUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </td>
            <td data-label="Fuente Rendimiento" className={styles.mutedText}>Auto-Staking Gobernanza DAO / Real Yield</td>
          </tr>

          <tr className={styles.totalRow}>
            <td data-label="Total">
              <div className={styles.assetCell}>
                <span>📊</span>
                <span>Total Cartera de Tesorería</span>
              </div>
            </td>
            <td data-label="Asignación Total" className={styles.boldNum}>100.00%</td>
            <td data-label="Objetivo Total" className={styles.boldNum}>100.00% Target</td>
            <td data-label="Valoración Total" className={styles.boldNum}>
              ${totalPortfolioUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </td>
            <td data-label="Auditoría" className={styles.mutedText}>Respaldo On-Chain Verificado</td>
          </tr>
        </DataTable>

        {treasurySurplusUSD > 0 && (
          <div className={styles.surplusNote}>
            <span>
              ✨ <strong>Acreción Patrimonial de Tesorería:</strong> +${treasurySurplusUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD acumulados en reservas por encima de la base génesis
            </span>
            <span className={styles.boldNum}>+{surplusPct.toFixed(2)}% Apreciación NAV</span>
          </div>
        )}
      </Card>

      {/* 📈 SECCIÓN 4: GRÁFICOS ANALÍTICOS Y TENDENCIAS HISTÓRICAS */}
      <ProtocolAnalyticsCharts
        porAssets={porAssets}
        porLiabilities={porLiabilities}
        porRatio={porRatio}
        porBreakdown={porBreakdown}
        stakedBalance={stakedBalance}
        claimableYield={claimableYield}
        userPositions={userPositions}
        loansList={loansList}
        liveApyStr={liveApyStr}
        targetWeights={targetWeights}
      />
    </div>
  );
};
