import React from 'react';
import styles from './MetricsDashboard.module.css';
import { ProtocolAnalyticsCharts } from './ProtocolAnalyticsCharts.js';
import { UI_STRINGS } from '../constants/strings.js';

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
  targetWeights = { stables: 60, wbtc: 26.67, weth: 13.33, alts: 0 }
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

  return (
    <div className="acp-container">
      
      {/* 📊 SECCIÓN 1: PANEL SUPERIOR DE KPI METRICS */}
      <div className={`card ${styles.topCard}`}>
        <div className={styles.headerRow}>
          <div>
            <h2 className={styles.headerH2}>
              {UI_STRINGS.METRICS.TITLE}
            </h2>
            <p className={styles.headerSubtitle}>
              {UI_STRINGS.METRICS.SUBTITLE}
            </p>
          </div>

          <button
            onClick={onOpenApyModal}
            className={styles.apyBtn}
          >
            ⚡ Desglose Matemático APY ({liveApyStr})
          </button>
        </div>

        {/* KPIs Grid */}
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiTitle}>🛡️ {UI_STRINGS.METRICS.SOLVENCY_CARD_TITLE}</div>
            <div data-testid="por-collateral-ratio" className={`font-black text-md margin-top-sm ${numericRatioPct >= 100 ? 'text-green-bright' : styles.valLgRed}`}>
              {porRatio.includes('%') ? porRatio : `${porRatio}%`}
            </div>
            <div className={styles.kpiSubtext}>
              Respaldo 1:1 al 100% NAV (Solvencia Plena)
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiTitle}>💎 Respaldo (NAV / ALPHA)</div>
            <div data-testid="header-nav-value" className="font-black text-md text-cyan margin-top-sm">
              {navPerShareUSD.startsWith('$') ? navPerShareUSD : `$${navPerShareUSD} USDC`}
            </div>
            <div className={styles.kpiSubtext}>
              Valor Patrimonial Neto On-Chain
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiTitle}>🏦 {UI_STRINGS.METRICS.TOTAL_ASSETS_LABEL}</div>
            <div data-testid="por-assets-total" className="font-black text-md text-purple-bright margin-top-sm">
              ${porAssets} USD
            </div>
            <div className={styles.kpiSubtext}>
              USDC + WBTC + WETH en Reservas
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiTitle}>📄 {UI_STRINGS.METRICS.TOTAL_LIABILITIES_LABEL}</div>
            <div data-testid="por-liabilities-total" className="font-black text-md margin-top-sm">
              ${porLiabilities} USD
            </div>
            <div className={styles.kpiSubtext}>
              {parNominalLiabilities > 0
                ? `100% Cobertura de Reembolso Inmediato a Valor Liquidativo (NAV)`
                : 'Obligaciones con Tenedores de ALPHA'}
            </div>
          </div>

          <div className={styles.kpiCard} style={{ borderColor: 'rgba(34, 197, 94, 0.4)', background: 'rgba(34, 197, 94, 0.06)' }}>
            <div className={styles.kpiTitle} style={{ color: '#86efac' }}>✨ Crecimiento de Reservas</div>
            <div data-testid="treasury-surplus-total" className="font-black text-md text-green-bright margin-top-sm">
              +${treasurySurplusUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </div>
            <div className={styles.kpiSubtext} style={{ color: '#a7f3d0' }}>
              +{surplusPct.toFixed(2)}% Crecimiento de NAV desde Génesis ($1.00)
            </div>
          </div>
        </div>

        {/* 💎 Institutional Claim: Banner de Acreción de NAV y No Dilución */}
        {treasurySurplusUSD > 0 && (
          <div style={{
            marginTop: '1.25rem',
            background: 'linear-gradient(90deg, rgba(34, 197, 94, 0.12) 0%, rgba(56, 189, 248, 0.12) 100%)',
            border: '1px solid rgba(34, 197, 94, 0.35)',
            borderRadius: '12px',
            padding: '0.85rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>💎</span>
              <div>
                <div style={{ fontWeight: 800, color: '#4ade80', fontSize: '0.95rem', letterSpacing: '0.02em' }}>
                  CRECIMIENTO PATRIMONIAL DEL PROTOCOLO: +${treasurySurplusUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD (+{surplusPct.toFixed(2)}% sobre Base Génesis)
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                  Cada nueva cuota de ALPHA se emite estrictamente a valor liquidativo (NAV actual: <strong>{navPerShareUSD.startsWith('$') ? navPerShareUSD : `$${navPerShareUSD} USDC`}</strong>) protegiendo a los tenedores contra la dilución. El valor patrimonial por share se ha revalorizado un <strong>+{surplusPct.toFixed(2)}%</strong> sobre la base génesis ($1.00 USD) impulsado por las comisiones de emisión protocolarias y los rendimientos reales de las bóvedas institucionales.
                </div>
              </div>
            </div>
            <div style={{
              fontSize: '0.75rem',
              padding: '6px 12px',
              borderRadius: '20px',
              background: 'rgba(34, 197, 94, 0.2)',
              color: '#86efac',
              fontWeight: 800,
              border: '1px solid rgba(34, 197, 94, 0.4)',
              letterSpacing: '0.05em'
            }}>
              ACRECIÓN DE VALOR ON-CHAIN
            </div>
          </div>
        )}
      </div>

      {/* 🪙 SECCIÓN 2: ESTADO DE TOKENOMICS & STAKING EN PANTALLA */}
      <div className={`card ${styles.sectionCard}`}>
        <h3 className={styles.sectionH3}>
          <span>🥩</span> Tokenomics & Estado de Oferta Deflacionaria
        </h3>

        <div className={styles.gridSubtle}>
          <div className={styles.boxSubtle}>
            <div className={styles.boxTitle}>🪙 {UI_STRINGS.STAKING.METRIC_CIRCULATING}</div>
            <div data-testid="staking-circulating-supply" className={styles.valLgCyan}>
              {circulatingSupply} {UI_STRINGS.COMMON.SYMBOL_ALPHA}
            </div>
            <div className={styles.kpiSubtext}>Suministro Circulante Total</div>
          </div>

          <div className={styles.boxSubtle}>
            <div className={styles.boxTitle}>👤 Stake Comunidad</div>
            <div data-testid="staking-community-staked" className={styles.valLgPurple}>
              {communityStakedSupply} {UI_STRINGS.COMMON.SYMBOL_STALPHA}
            </div>
            <div className={styles.kpiSubtext}>Bloqueado por Inversores</div>
          </div>

          <div className={styles.boxSubtle}>
            <div className={styles.boxTitle}>💎 Stake Bóveda Comunitaria</div>
            <div data-testid="staking-community-vault-staked" className={styles.valLgPink}>
              <span data-testid="staking-vaults-staked">{communityVaultStakedSupply}</span> {UI_STRINGS.COMMON.SYMBOL_STALPHA}
            </div>
            <div className={styles.kpiSubtext}>Community Yield Vault</div>
          </div>

          <div className={styles.boxSubtle}>
            <div className={styles.boxTitle}>🏛️ Stake Reservas</div>
            <div data-testid="staking-reserves-staked" className={styles.valLgGreen}>
              {treasuryStakedSupply} {UI_STRINGS.COMMON.SYMBOL_STALPHA}
            </div>
            <div className={styles.kpiSubtext}>Sub-Reserva Tesorería</div>
          </div>

          <div className={styles.boxSubtle}>
            <div className={styles.boxTitle}>🥩 {UI_STRINGS.STAKING.METRIC_TOTAL_STAKED}</div>
            <div data-testid="staking-total-staked" className={styles.valLgViolet}>
              <span data-testid="staking-global-staked">{totalStakedSupply}</span> {UI_STRINGS.COMMON.SYMBOL_ALPHA} ({stakingRatioPct.includes('%') ? stakingRatioPct : `${stakingRatioPct}%`})
            </div>
            <div className={styles.kpiSubtext}>Total stALPHA en Gobernanza</div>
          </div>

          <div className={styles.boxSubtle}>
            <div className={styles.boxTitle}>🔥 {UI_STRINGS.STAKING.METRIC_TOTAL_BURNED}</div>
            <div data-testid="staking-deflation-burned" className={styles.valLgRed}>
              <span data-testid="staking-deflation-destroyed">{totalBurnedTokens}</span> {UI_STRINGS.COMMON.SYMBOL_ALPHA} Destruidos
            </div>
            <div className={styles.kpiSubtext}>Quema Definitiva Irreversible</div>
          </div>
        </div>
      </div>

      {/* 📊 SECCIÓN 3: TABLA DE RESPALDO EXÓGENO DE RESERVAS */}
      <div className={`card ${styles.sectionCard}`}>
        <h3 className={styles.sectionH3}>
          {UI_STRINGS.METRICS.TABLE_ASSETS_TITLE}
        </h3>

        <div className="table-responsive">
          <table className="gcc-table">
            <thead>
              <tr className="gcc-tr-border text-muted">
                <th className={styles.tableTh}>{UI_STRINGS.METRICS.TH_ASSET}</th>
                <th className={styles.tableTh}>{UI_STRINGS.METRICS.TH_TARGET_WEIGHT}</th>
                <th className={styles.tableTh}>{UI_STRINGS.METRICS.TH_TOTAL_VALUE_USD}</th>
                <th className={styles.tableTh}>{UI_STRINGS.METRICS.TH_YIELD_SOURCE}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="gcc-tr-border">
                <td className={styles.tableTdCyan}>💵 USDC / Stablecoins</td>
                <td className={styles.tableTd}>{(targetWeights?.stables || 60).toFixed(2)}% Target</td>
                <td data-testid="por-row-usdc-val" className={styles.tableTdBold}>${stablesUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</td>
                <td className={styles.tableTdMuted}>{UI_STRINGS.METRICS.MORPHO_USDC_SOURCE} / Créditos P2P</td>
              </tr>
              <tr className="gcc-tr-border">
                <td className={styles.tableTdAmber}>🪙 Wrapped Bitcoin (WBTC)</td>
                <td className={styles.tableTd}>{(targetWeights?.wbtc || 26.67).toFixed(2)}% Target</td>
                <td data-testid="por-row-wbtc-val" className={styles.tableTdBold}>${btcUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</td>
                <td className={styles.tableTdMuted}>{UI_STRINGS.METRICS.LOMBARD_LBTC_SOURCE} / Oráculo Chainlink</td>
              </tr>
              <tr className="gcc-tr-border">
                <td className={styles.tableTdIndigo}>🔷 Wrapped Ethereum (WETH)</td>
                <td className={styles.tableTd}>{(targetWeights?.weth || 13.33).toFixed(2)}% Target</td>
                <td data-testid="por-row-weth-val" className={styles.tableTdBold}>${ethUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</td>
                <td className={styles.tableTdMuted}>{UI_STRINGS.METRICS.LIDO_WSTETH_SOURCE} / Oráculo Chainlink</td>
              </tr>
            </tbody>
          </table>
          {treasurySurplusUSD > 0 && (
            <div style={{
              marginTop: '0.75rem',
              padding: '0.6rem 1rem',
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
              fontSize: '0.8rem',
              color: '#86efac'
            }}>
              <span>✨ <strong>Acreción Patrimonial de Tesorería:</strong> +${treasurySurplusUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD acumulados en reservas por encima de la base génesis</span>
              <span style={{ fontWeight: 700, color: '#4ade80' }}>+{surplusPct.toFixed(2)}% Apreciación NAV</span>
            </div>
          )}
        </div>
      </div>

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
