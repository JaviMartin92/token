import React from 'react';
import styles from './MetricsDashboard.module.css';
import { ProtocolAnalyticsCharts } from './ProtocolAnalyticsCharts.js';

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
  corporateStakedSupply: string;
  treasuryStakedSupply: string;
  stakingRatioPct: string;
  navPerShareUSD: string;
  userPositions: any[];
  loansList: any[];
  onOpenApyModal: () => void;
  liveApyStr: string;
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
  corporateStakedSupply,
  treasuryStakedSupply,
  stakingRatioPct,
  navPerShareUSD,
  userPositions,
  loansList,
  onOpenApyModal,
  liveApyStr
}) => {
  const numericRatioPct = parseFloat((porRatio || '100').replace(/,/g, '').replace('%', '')) || 100.0;

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
              📊 Panel Consolidado de Métricas & Contadores On-Chain
            </h2>
            <p className={styles.headerSubtitle}>
              Monitoreo en tiempo real respaldado 100% por Proof of Reserves (PoR) y oráculos auditados.
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
            <div className={styles.kpiTitle}>🛡️ Solvencia Global PoR</div>
            <div data-testid="por-collateral-ratio" className={`font-black text-md margin-top-sm ${numericRatioPct >= 100 ? 'text-green-bright' : styles.valLgRed}`}>
              {porRatio.includes('%') ? porRatio : `${porRatio}%`}
            </div>
            <div className={styles.kpiSubtext}>
              Ratio Solvencia = Total Activos / Pasivos
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
            <div className={styles.kpiTitle}>🏦 Activos Exógenos PoR</div>
            <div data-testid="por-assets-total" className="font-black text-md text-purple-bright margin-top-sm">
              ${porAssets} USD
            </div>
            <div className={styles.kpiSubtext}>
              USDC + WBTC + WETH en Reservas
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiTitle}>📄 Pasivos Totales (Shares)</div>
            <div data-testid="por-liabilities-total" className="font-black text-md margin-top-sm">
              ${porLiabilities} USD
            </div>
            <div className={styles.kpiSubtext}>
              Obligaciones con Tenedores de ALPHA
            </div>
          </div>
        </div>
      </div>

      {/* 🪙 SECCIÓN 2: ESTADO DE TOKENOMICS & STAKING EN PANTALLA */}
      <div className={`card ${styles.sectionCard}`}>
        <h3 className={styles.sectionH3}>
          <span>🥩</span> Tokenomics & Estado de Oferta Deflacionaria
        </h3>

        <div className={styles.gridSubtle}>
          <div className={styles.boxSubtle}>
            <div className={styles.boxTitle}>🪙 En Circulación</div>
            <div data-testid="staking-circulating-supply" className={styles.valLgCyan}>
              {circulatingSupply} ALPHA
            </div>
            <div className={styles.kpiSubtext}>Suministro Libre Flotante</div>
          </div>

          <div className={styles.boxSubtle}>
            <div className={styles.boxTitle}>👤 Stake Comunidad</div>
            <div data-testid="staking-community-staked" className={styles.valLgPurple}>
              {communityStakedSupply} stALPHA
            </div>
            <div className={styles.kpiSubtext}>Bloqueado por Inversores</div>
          </div>

          <div className={styles.boxSubtle}>
            <div className={styles.boxTitle}>🏢 Stake Bóvedas</div>
            <div data-testid="staking-corporate-staked" className={styles.valLgPink}>
              <span data-testid="staking-vaults-staked">{corporateStakedSupply}</span> stALPHA
            </div>
            <div className={styles.kpiSubtext}>Protocol OpEx & Community Yield</div>
          </div>

          <div className={styles.boxSubtle}>
            <div className={styles.boxTitle}>🏛️ Stake Reservas</div>
            <div data-testid="staking-reserves-staked" className={styles.valLgGreen}>
              {treasuryStakedSupply} stALPHA
            </div>
            <div className={styles.kpiSubtext}>Sub-Reserva Tesorería</div>
          </div>

          <div className={styles.boxSubtle}>
            <div className={styles.boxTitle}>🥩 Total Global Staked</div>
            <div data-testid="staking-total-staked" className={styles.valLgViolet}>
              <span data-testid="staking-global-staked">{totalStakedSupply}</span> ALPHA ({stakingRatioPct.includes('%') ? stakingRatioPct : `${stakingRatioPct}%`})
            </div>
            <div className={styles.kpiSubtext}>Total stALPHA en Gobernanza</div>
          </div>

          <div className={styles.boxSubtle}>
            <div className={styles.boxTitle}>🔥 Deflación Acumulada</div>
            <div data-testid="staking-deflation-burned" className={styles.valLgRed}>
              <span data-testid="staking-deflation-destroyed">{totalBurnedTokens}</span> ALPHA Destruidos
            </div>
            <div className={styles.kpiSubtext}>Quema Definitiva Irreversible</div>
          </div>
        </div>
      </div>

      {/* 📊 SECCIÓN 3: TABLA DE RESPALDO EXÓGENO DE RESERVAS */}
      <div className={`card ${styles.sectionCard}`}>
        <h3 className={styles.sectionH3}>
          🛡️ Ponderaciones Exógenas de Reserva Pura (Proof of Reserves)
        </h3>

        <div className="table-responsive">
          <table className="gcc-table">
            <thead>
              <tr className="gcc-tr-border text-muted">
                <th className={styles.tableTh}>Activo de Reserva</th>
                <th className={styles.tableTh}>Objetivo Protocolo</th>
                <th className={styles.tableTh}>Valor USD en Caja</th>
                <th className={styles.tableTh}>Bóvedas Deployed</th>
              </tr>
            </thead>
            <tbody>
              <tr className="gcc-tr-border">
                <td className={styles.tableTdCyan}>💵 USDC / Stablecoins</td>
                <td className={styles.tableTd}>60.00% Target</td>
                <td data-testid="por-row-usdc-val" className={styles.tableTdBold}>${stablesUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</td>
                <td className={styles.tableTdMuted}>Morpho Blue (80% MetaMorpho Vault @ 6.45% APY)</td>
              </tr>
              <tr className="gcc-tr-border">
                <td className={styles.tableTdAmber}>🪙 Wrapped Bitcoin (WBTC)</td>
                <td className={styles.tableTd}>26.67% Target</td>
                <td data-testid="por-row-wbtc-val" className={styles.tableTdBold}>${btcUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</td>
                <td className={styles.tableTdMuted}>Staking Lombard LBTC / Chainlink Feed</td>
              </tr>
              <tr className="gcc-tr-border">
                <td className={styles.tableTdIndigo}>🔷 Wrapped Ethereum (WETH)</td>
                <td className={styles.tableTd}>13.33% Target</td>
                <td data-testid="por-row-weth-val" className={styles.tableTdBold}>${ethUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</td>
                <td className={styles.tableTdMuted}>Lido Liquid Staking stETH / Chainlink Feed</td>
              </tr>
            </tbody>
          </table>
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
      />
    </div>
  );
};
