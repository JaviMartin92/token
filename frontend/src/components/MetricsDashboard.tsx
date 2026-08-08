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
  const numericAssetsUSD = parseFloat((porAssets || '0').replace(/,/g, '')) || 0;
  const numericLiabilitiesUSD = parseFloat((porLiabilities || '0').replace(/,/g, '')) || 0;
  const numericRatioPct = parseFloat((porRatio || '100').replace(/,/g, '')) || 100.0;

  // Exogenous reserves breakdown directly from Treasury.sol getAssetBreakdown()
  const stablesUSD = porBreakdown.stables;
  const btcUSD = porBreakdown.wbtc;
  const ethUSD = porBreakdown.weth;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.5rem' }}>
      
      {/* 📊 SECCIÓN 1: PANEL SUPERIOR DE KPI METRICS */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '16px', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', pb: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, background: 'linear-gradient(135deg, #a855f7 0%, #38bdf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
              📊 Panel Consolidado de Métricas & Contadores On-Chain
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
              Monitoreo en tiempo real respaldado 100% por Proof of Reserves (PoR) y oráculos auditados.
            </p>
          </div>

          <button
            onClick={onOpenApyModal}
            style={{
              background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
              color: '#fff',
              border: 'none',
              padding: '0.6rem 1.2rem',
              borderRadius: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(168, 85, 247, 0.4)',
              fontSize: '0.9rem'
            }}
          >
            ⚡ Desglose Matemático APY ({liveApyStr})
          </button>
        </div>

        {/* KPIs Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>🛡️ Solvencia Global PoR</div>
            <div data-testid="por-collateral-ratio" style={{ fontSize: '1.6rem', fontWeight: 800, color: numericRatioPct >= 100 ? '#4ade80' : '#f87171', marginTop: '0.2rem' }}>
              {porRatio}%
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
              Ratio Solvencia = Total Activos / Pasivos
            </div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>💎 Respaldo (NAV / ALPHA)</div>
            <div data-testid="header-nav-value" style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.2rem' }}>
              ${navPerShareUSD} USDC
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
              Valor Patrimonial Neto On-Chain
            </div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>🏦 Activos Exógenos PoR</div>
            <div data-testid="por-assets-total" style={{ fontSize: '1.6rem', fontWeight: 800, color: '#c084fc', marginTop: '0.2rem' }}>
              ${porAssets} USD
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
              USDC + WBTC + WETH en Reservas
            </div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>📄 Pasivos Totales (Shares)</div>
            <div data-testid="por-liabilities-total" style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.2rem' }}>
              ${porLiabilities} USD
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
              Obligaciones con Tenedores de ALPHA
            </div>
          </div>
        </div>
      </div>

      {/* 🪙 SECCIÓN 2: ESTADO DE TOKENOMICS & STAKING EN PANTALLA */}
      <div className="card" style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🥩</span> Tokenomics & Estado de Oferta Deflacionaria
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>🪙 En Circulación</div>
            <div data-testid="staking-circulating-supply" style={{ fontSize: '1.3rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.3rem' }}>
              {circulatingSupply} ALPHA
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>Suministro Libre Flotante</div>
          </div>

          <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>👤 Stake Comunidad</div>
            <div data-testid="staking-community-staked" style={{ fontSize: '1.3rem', fontWeight: 700, color: '#c084fc', marginTop: '0.3rem' }}>
              {communityStakedSupply} stALPHA
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>Bloqueado por Inversores</div>
          </div>

          <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>🏢 Stake Bóvedas</div>
            <div data-testid="staking-corporate-staked" style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f472b6', marginTop: '0.3rem' }}>
              <span data-testid="staking-vaults-staked">{corporateStakedSupply}</span> stALPHA
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>OpEx & Profit Vaults</div>
          </div>

          <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>🏛️ Stake Reservas</div>
            <div data-testid="staking-reserves-staked" style={{ fontSize: '1.3rem', fontWeight: 700, color: '#4ade80', marginTop: '0.3rem' }}>
              {treasuryStakedSupply} stALPHA
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>Sub-Reserva Tesorería</div>
          </div>

          <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>🥩 Total Global Staked</div>
            <div data-testid="staking-total-staked" style={{ fontSize: '1.3rem', fontWeight: 700, color: '#a855f7', marginTop: '0.3rem' }}>
              <span data-testid="staking-global-staked">{totalStakedSupply}</span> ALPHA ({stakingRatioPct}%)
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>Total stALPHA en Gobernanza</div>
          </div>

          <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>🔥 Deflación Acumulada</div>
            <div data-testid="staking-deflation-burned" style={{ fontSize: '1.3rem', fontWeight: 700, color: '#ef4444', marginTop: '0.3rem' }}>
              <span data-testid="staking-deflation-destroyed">{totalBurnedTokens}</span> ALPHA Destruidos
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>Quema Definitiva Irreversible</div>
          </div>
        </div>
      </div>

      {/* 📊 SECCIÓN 3: TABLA DE RESPALDO EXÓGENO DE RESERVAS */}
      <div className="card" style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '1rem' }}>
          🛡️ Ponderaciones Exógenas de Reserva Pura (Proof of Reserves)
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                <th style={{ padding: '0.75rem' }}>Activo de Reserva</th>
                <th style={{ padding: '0.75rem' }}>Objetivo Protocolo</th>
                <th style={{ padding: '0.75rem' }}>Valor USD en Caja</th>
                <th style={{ padding: '0.75rem' }}>Bóvedas Deployed</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '0.75rem', fontWeight: 600, color: '#38bdf8' }}>💵 USDC / Stablecoins</td>
                <td style={{ padding: '0.75rem' }}>60.00% Target</td>
                <td data-testid="por-row-usdc-val" style={{ padding: '0.75rem', fontWeight: 700 }}>${stablesUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</td>
                <td style={{ padding: '0.75rem', color: '#94a3b8' }}>Morpho Blue (80% MetaMorpho Vault @ 6.45% APY)</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '0.75rem', fontWeight: 600, color: '#f59e0b' }}>🪙 Wrapped Bitcoin (WBTC)</td>
                <td style={{ padding: '0.75rem' }}>26.67% Target</td>
                <td data-testid="por-row-wbtc-val" style={{ padding: '0.75rem', fontWeight: 700 }}>${btcUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</td>
                <td style={{ padding: '0.75rem', color: '#94a3b8' }}>Staking Lombard LBTC / Chainlink Feed</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '0.75rem', fontWeight: 600, color: '#6366f1' }}>🔷 Wrapped Ethereum (WETH)</td>
                <td style={{ padding: '0.75rem' }}>13.33% Target</td>
                <td data-testid="por-row-weth-val" style={{ padding: '0.75rem', fontWeight: 700 }}>${ethUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</td>
                <td style={{ padding: '0.75rem', color: '#94a3b8' }}>Lido Liquid Staking stETH / Chainlink Feed</td>
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
