import React from 'react';
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
      <div className="card met-top-card">
        <div className="met-header-row">
          <div>
            <h2 className="met-header-h2">
              📊 Panel Consolidado de Métricas & Contadores On-Chain
            </h2>
            <p className="met-header-subtitle">
              Monitoreo en tiempo real respaldado 100% por Proof of Reserves (PoR) y oráculos auditados.
            </p>
          </div>

          <button
            onClick={onOpenApyModal}
            className="met-apy-btn"
          >
            ⚡ Desglose Matemático APY ({liveApyStr})
          </button>
        </div>

        {/* KPIs Grid */}
        <div className="met-kpi-grid">
          <div className="met-kpi-card">
            <div className="met-kpi-title">🛡️ Solvencia Global PoR</div>
            <div data-testid="por-collateral-ratio" className={`font-black text-md margin-top-sm ${numericRatioPct >= 100 ? 'text-green-bright' : 'stk-burned-label'}`}>
              {porRatio.includes('%') ? porRatio : `${porRatio}%`}
            </div>
            <div className="met-kpi-subtext">
              Ratio Solvencia = Total Activos / Pasivos
            </div>
          </div>

          <div className="met-kpi-card">
            <div className="met-kpi-title">💎 Respaldo (NAV / ALPHA)</div>
            <div data-testid="header-nav-value" className="font-black text-md text-cyan margin-top-sm">
              {navPerShareUSD.startsWith('$') ? navPerShareUSD : `$${navPerShareUSD} USDC`}
            </div>
            <div className="met-kpi-subtext">
              Valor Patrimonial Neto On-Chain
            </div>
          </div>

          <div className="met-kpi-card">
            <div className="met-kpi-title">🏦 Activos Exógenos PoR</div>
            <div data-testid="por-assets-total" className="font-black text-md text-purple-bright margin-top-sm">
              ${porAssets} USD
            </div>
            <div className="met-kpi-subtext">
              USDC + WBTC + WETH en Reservas
            </div>
          </div>

          <div className="met-kpi-card">
            <div className="met-kpi-title">📄 Pasivos Totales (Shares)</div>
            <div data-testid="por-liabilities-total" className="font-black text-md gcc-td-amber margin-top-sm">
              ${porLiabilities} USD
            </div>
            <div className="met-kpi-subtext">
              Obligaciones con Tenedores de ALPHA
            </div>
          </div>
        </div>
      </div>

      {/* 🪙 SECCIÓN 2: ESTADO DE TOKENOMICS & STAKING EN PANTALLA */}
      <div className="card met-section-card">
        <h3 className="met-section-h3">
          <span>🥩</span> Tokenomics & Estado de Oferta Deflacionaria
        </h3>

        <div className="met-grid-subtle">
          <div className="met-box-subtle">
            <div className="met-box-title">🪙 En Circulación</div>
            <div data-testid="staking-circulating-supply" className="met-val-lg-cyan">
              {circulatingSupply} ALPHA
            </div>
            <div className="met-kpi-subtext">Suministro Libre Flotante</div>
          </div>

          <div className="met-box-subtle">
            <div className="met-box-title">👤 Stake Comunidad</div>
            <div data-testid="staking-community-staked" className="met-val-lg-purple">
              {communityStakedSupply} stALPHA
            </div>
            <div className="met-kpi-subtext">Bloqueado por Inversores</div>
          </div>

          <div className="met-box-subtle">
            <div className="met-box-title">🏢 Stake Bóvedas</div>
            <div data-testid="staking-corporate-staked" className="met-val-lg-pink">
              <span data-testid="staking-vaults-staked">{corporateStakedSupply}</span> stALPHA
            </div>
            <div className="met-kpi-subtext">Protocol OpEx & Community Yield</div>
          </div>

          <div className="met-box-subtle">
            <div className="met-box-title">🏛️ Stake Reservas</div>
            <div data-testid="staking-reserves-staked" className="met-val-lg-green">
              {treasuryStakedSupply} stALPHA
            </div>
            <div className="met-kpi-subtext">Sub-Reserva Tesorería</div>
          </div>

          <div className="met-box-subtle">
            <div className="met-box-title">🥩 Total Global Staked</div>
            <div data-testid="staking-total-staked" className="met-val-lg-violet">
              <span data-testid="staking-global-staked">{totalStakedSupply}</span> ALPHA ({stakingRatioPct.includes('%') ? stakingRatioPct : `${stakingRatioPct}%`})
            </div>
            <div className="met-kpi-subtext">Total stALPHA en Gobernanza</div>
          </div>

          <div className="met-box-subtle">
            <div className="met-box-title">🔥 Deflación Acumulada</div>
            <div data-testid="staking-deflation-burned" className="met-val-lg-red">
              <span data-testid="staking-deflation-destroyed">{totalBurnedTokens}</span> ALPHA Destruidos
            </div>
            <div className="met-kpi-subtext">Quema Definitiva Irreversible</div>
          </div>
        </div>
      </div>

      {/* 📊 SECCIÓN 3: TABLA DE RESPALDO EXÓGENO DE RESERVAS */}
      <div className="card met-section-card">
        <h3 className="met-section-h3">
          🛡️ Ponderaciones Exógenas de Reserva Pura (Proof of Reserves)
        </h3>

        <div className="table-responsive">
          <table className="gcc-table">
            <thead>
              <tr className="gcc-tr-border text-muted">
                <th className="met-table-th">Activo de Reserva</th>
                <th className="met-table-th">Objetivo Protocolo</th>
                <th className="met-table-th">Valor USD en Caja</th>
                <th className="met-table-th">Bóvedas Deployed</th>
              </tr>
            </thead>
            <tbody>
              <tr className="gcc-tr-border">
                <td className="met-table-td-cyan">💵 USDC / Stablecoins</td>
                <td className="met-table-td">60.00% Target</td>
                <td data-testid="por-row-usdc-val" className="met-table-td-bold">${stablesUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</td>
                <td className="met-table-td-muted">Morpho Blue (80% MetaMorpho Vault @ 6.45% APY)</td>
              </tr>
              <tr className="gcc-tr-border">
                <td className="met-table-td-amber">🪙 Wrapped Bitcoin (WBTC)</td>
                <td className="met-table-td">26.67% Target</td>
                <td data-testid="por-row-wbtc-val" className="met-table-td-bold">${btcUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</td>
                <td className="met-table-td-muted">Staking Lombard LBTC / Chainlink Feed</td>
              </tr>
              <tr className="gcc-tr-border">
                <td className="met-table-td-indigo">🔷 Wrapped Ethereum (WETH)</td>
                <td className="met-table-td">13.33% Target</td>
                <td data-testid="por-row-weth-val" className="met-table-td-bold">${ethUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</td>
                <td className="met-table-td-muted">Lido Liquid Staking stETH / Chainlink Feed</td>
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
