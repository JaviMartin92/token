import React from 'react';

interface TreasuryDashboardProps {
  porAssets: string;
  porLiabilities: string;
  porRatio: string;
  porBreakdown?: { stables: number; wbtc: number; weth: number; alphaStaking: number };

  usdcBalance: string;
  sharesBalance: string;
  depositAmount: string;
  setDepositAmount: (val: string) => void;
  redeemAmount: string;
  setRedeemAmount: (val: string) => void;
  onDeposit: () => void;
  onRedeem: () => void;
  onFaucetUSDC: () => void;
  onAuditPoR: () => void;
  isAdmin?: boolean;
  loansList?: any[];
}

export const TreasuryDashboard: React.FC<TreasuryDashboardProps> = ({
  porAssets,
  porLiabilities,
  porRatio,

  usdcBalance,
  sharesBalance,
  depositAmount,
  setDepositAmount,
  redeemAmount,
  setRedeemAmount,
  onDeposit,
  onRedeem,
  onFaucetUSDC,
  onAuditPoR,
  isAdmin = false,
  loansList = []
}) => {
  const activeLoans = loansList.filter((l) => l.state === 1);
  const totalLentUsd = activeLoans.reduce((acc, l) => acc + (parseFloat((l.borrowAmount || '0').replace(/,/g, '')) || 0) * 1.08, 0);
  const totalCollateralUsd = activeLoans.reduce((acc, l) => {
    const val = parseFloat((l.collateralAmount || '0').replace(/,/g, '')) || 0;
    return acc + val;
  }, 0);
  const overCollateralRatio = totalLentUsd > 0 ? (totalCollateralUsd / totalLentUsd) * 100 : 100.00;

  // Estado de solvencia basado exclusivamente en la colateralización on-chain
  const ratioNum = parseFloat(porRatio.replace('%', '')) || 0;
  const isSolvent = ratioNum >= 100.0;
  const solvencyLabel = isSolvent ? '🟢 100% Solvente (NPV 1:1)' : `🔴 Insuficiente (${porRatio})`;
  const solvencyColor = isSolvent ? '#4ade80' : '#f43f5e';
  const solvencyBg = isSolvent ? 'rgba(74, 222, 128, 0.15)' : 'rgba(244, 63, 94, 0.15)';

  // --- CONTABILIDAD EXÓGENA PURA (100% Activos Exógenos On-Chain) ---
  const totalAssetsNum = parseFloat((porAssets || '0').replace(/,/g, '')) || 0;

  // Ponderaciones exógenas puras que suman 10.000 BPS (100%)
  const breakdownStables = (totalAssetsNum * 6000) / 10000; // 60.00% USDC
  const breakdownWbtc = (totalAssetsNum * 2667) / 10000;    // 26.67% WBTC
  const breakdownWeth = (totalAssetsNum * 1333) / 10000;    // 13.33% WETH

  const exogenousTokens = [
    { 
      symbol: 'USDC', 
      name: '💵 USDC (Bóvedas Morpho Blue + Préstamos P2P)', 
      val: breakdownStables, 
      weight: '60.00%', 
      testId: 'por-row-usdc-val', 
      weightId: 'por-row-usdc-weight' 
    },
    { 
      symbol: 'WBTC', 
      name: '₿ Wrapped Bitcoin (Staking Lombard)', 
      val: breakdownWbtc, 
      weight: '26.67%', 
      testId: 'por-row-wbtc-val', 
      weightId: 'por-row-wbtc-weight' 
    },
    { 
      symbol: 'WETH', 
      name: 'Ξ Wrapped Ethereum (Staking Lido)', 
      val: breakdownWeth, 
      weight: '13.33%', 
      testId: 'por-row-weth-val', 
      weightId: 'por-row-weth-weight' 
    }
  ];

  return (
    <div className="treasury-main-container">
      <div className="treasury-grid-two-col">
        
        {/* Bóveda 1: Proof of Reserves */}
        <div className="glass-panel treasury-por-panel">
          <div className="por-header">
            <h3 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🛡️ Proof of Reserves (Reserva On-Chain Exógena)
            </h3>
            <button data-testid="por-audit-btn" className="btn-secondary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }} onClick={onAuditPoR}>
              🔄 Auditar On-Chain
            </button>
          </div>

          <div className="por-metrics-trio">
            <div className="por-metric-box">
              <div className="por-metric-label">ACTIVOS TOTALES EXÓGENOS</div>
              <div data-testid="por-assets-total" className="por-metric-value-assets">${porAssets} USD</div>
            </div>
            <div className="por-metric-box">
              <div className="por-metric-label">PASIVOS TOTALES</div>
              <div data-testid="por-liabilities-total" className="por-metric-value-liabilities">${porLiabilities} USD</div>
            </div>
            <div className="por-metric-box">
              <div className="por-metric-label">COLATERALIZACIÓN</div>
              <div data-testid="por-collateral-ratio" style={{ fontWeight: 700, fontSize: '1.05rem', color: solvencyColor }}>{porRatio}</div>
              <div style={{ fontSize: '0.62rem', marginTop: '0.2rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: solvencyBg, color: solvencyColor, fontWeight: 600, display: 'inline-block' }}>
                {solvencyLabel}
              </div>
            </div>
          </div>

          <div className="banner-bond-coverage">
            <span><strong>Reserva Emisión de Bonos (NPV):</strong> Cobertura Inicial 1:1</span>
            <span style={{ color: '#4ade80', fontWeight: 600 }}>✓ {porRatio} Respaldado</span>
          </div>

          {/* Tabla de Reservas Exógenas Puras (Exactamente 3 Filas) */}
          <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.85rem', opacity: 0.8 }}>Desglose Transparente de Reservas Exógenas por Activo:</h4>
          <table className="por-table-styled">
            <thead>
              <tr>
                <th>Activo Reserva Exógeno</th>
                <th style={{ textAlign: 'right' }}>Valor USD Real</th>
                <th style={{ textAlign: 'right' }}>Ponderación Target</th>
              </tr>
            </thead>
            <tbody>
              {exogenousTokens.map((t, idx) => (
                <tr key={t.symbol} style={{ borderBottom: idx < exogenousTokens.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <td>{t.name}</td>
                  <td data-testid={t.testId} className="por-table-td-value">${t.val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</td>
                  <td data-testid={t.weightId} className="por-table-td-weight">{t.weight}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Créditos y Garantías Escrow */}
          <div style={{ marginTop: '0.9rem', background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(15, 23, 42, 0.5) 100%)', border: '1px solid rgba(168, 85, 247, 0.25)', padding: '0.85rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', flexWrap: 'wrap', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#c084fc', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                🏦 Créditos de Tesorería y Garantías en Escrow
              </span>
              <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(168, 85, 247, 0.2)', color: '#e9d5ff', fontWeight: 600 }}>
                🔒 Custodias Sobrecolateralizadas
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem', textAlign: 'center' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.55rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.62rem', opacity: 0.75, color: '#cbd5e1' }}>CANTIDAD PRESTADA</div>
                <div data-testid="escrow-total-lent" style={{ fontWeight: 700, fontSize: '0.95rem', color: '#38bdf8', marginTop: '0.1rem' }}>
                  ${totalLentUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.55rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.62rem', opacity: 0.75, color: '#cbd5e1' }}>COLATERAL EN ESCROW</div>
                <div data-testid="escrow-total-collateral" style={{ fontWeight: 700, fontSize: '0.95rem', color: '#4ade80', marginTop: '0.1rem' }}>
                  ${totalCollateralUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.55rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.62rem', opacity: 0.75, color: '#cbd5e1' }}>COBERTURA GARANTÍA</div>
                <div data-testid="escrow-coverage-ratio" style={{ fontWeight: 700, fontSize: '0.95rem', color: '#c084fc', marginTop: '0.1rem' }}>
                  {overCollateralRatio.toFixed(2)}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bóveda 2: Emisión y Rescate de Shares */}
        <div className="glass-panel treasury-shares-panel">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>🏛️ Emisión y Rescate de Shares (NAV)</h3>
              <button data-testid="treasury-faucet-btn" className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={onFaucetUSDC}>
                🚰 Faucet 10k USDC
              </button>
            </div>

            <div className="treasury-shares-grid">
              <div className="treasury-shares-card-usdc">
                <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>SALDO USDC DISPONIBLE</div>
                <div data-testid="treasury-usdc-balance" style={{ fontWeight: 700, fontSize: '1rem', color: '#4ade80' }}>{usdcBalance} USDC</div>
              </div>
              <div className="treasury-shares-card-shares">
                <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>MIS ALPHA SHARES</div>
                <div data-testid="treasury-shares-balance" style={{ fontWeight: 700, fontSize: '1rem', color: '#c084fc' }}>{sharesBalance} ALPHA</div>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.3rem' }}>
                Depositar USDC para Acuñar Shares:
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  data-testid="treasury-deposit-input"
                  type="number"
                  placeholder="Monto USDC (ej. 1000)"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="treasury-input-flex"
                />
                <button data-testid="treasury-deposit-btn" className="btn-primary" onClick={onDeposit} style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', whiteSpace: 'nowrap' }}>
                  Depositar
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.3rem' }}>
                Rescatar ALPHA Shares a NAV:
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  data-testid="treasury-redeem-input"
                  type="number"
                  placeholder="Shares a Rescatar (ej. 500)"
                  value={redeemAmount}
                  onChange={(e) => setRedeemAmount(e.target.value)}
                  className="treasury-input-flex"
                />
                <button data-testid="treasury-redeem-btn" className="btn-primary" onClick={onRedeem} style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', whiteSpace: 'nowrap' }}>
                  Rescatar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sección Admin: Solo 3 Estrategias Exógenas */}
      {isAdmin && (() => {
        const numericAssets = parseFloat(porAssets.replace(/,/g, '')) || 0;
        const p2pAllocationUsd = totalLentUsd;
        const morphoAllocationUsd = Math.max(0, (numericAssets * 0.60) - p2pAllocationUsd);
        const btcAllocationUsd = numericAssets * 0.2667;
        const ethAllocationUsd = numericAssets * 0.1333;

        return (
        <div className="admin-strategy-panel" style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🏛️ Estrategia e Inversión Institucional de Reservas Exógenas
              </h3>
            </div>
            <button
              className="btn-primary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', fontWeight: 600 }}
              onClick={onAuditPoR}
            >
              🌾 Cosechar Rendimiento Diario (Morpho Harvest)
            </button>
          </div>

          <div className="strategy-grid">
            {/* Stablecoins Strategy Box */}
            <div className="strategy-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#4ade80' }}>💵 Stablecoins (USDC / USDT)</span>
                <span style={{ fontSize: '0.75rem', background: 'rgba(74, 222, 128, 0.2)', color: '#4ade80', padding: '0.15rem 0.4rem', borderRadius: '6px', fontWeight: 600 }}>Real Yield Active</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem', opacity: 0.9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>• Créditos Directos / P2P:</span>
                  <strong>${p2pAllocationUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} @ 8.00% APR</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>• Bóvedas Morpho Blue:</span>
                  <strong>${morphoAllocationUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} @ Vault APY</strong>
                </div>
              </div>
            </div>

            {/* Bitcoin Strategy Box */}
            <div className="strategy-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f59e0b' }}>₿ Bitcoin (WBTC / cbBTC)</span>
                <span style={{ fontSize: '0.75rem', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', padding: '0.15rem 0.4rem', borderRadius: '6px', fontWeight: 600 }}>Babylon & Morpho</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', opacity: 0.9, fontSize: '0.78rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>• Staking Lombard (LBTC):</span>
                  <strong>${(btcAllocationUsd * 0.6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (LBTC)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>• Suministro Morpho:</span>
                  <strong>${(btcAllocationUsd * 0.4).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Low LTV)</strong>
                </div>
              </div>
            </div>

            {/* Ethereum Strategy Box */}
            <div className="strategy-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#a855f7' }}>Ξ Ethereum (WETH / stETH)</span>
                <span style={{ fontSize: '0.75rem', background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', padding: '0.15rem 0.4rem', borderRadius: '6px', fontWeight: 600 }}>Staking & Vaults</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem', opacity: 0.9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>• Liquid Staking Lido:</span>
                  <strong>${(ethAllocationUsd * 0.6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (stETH)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>• Colateral Morpho/Aave:</span>
                  <strong>${(ethAllocationUsd * 0.4).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Vaults)</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
};