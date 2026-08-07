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
    }
  ];

  return (
    <div className="treasury-main-container" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="glass-panel treasury-shares-panel" style={{ width: '100%' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>🏛️ Emisión y Rescate de ALPHA Shares (NAV)</h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                Opera directamente contra las reservas del protocolo a NAV (Net Asset Value).
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button data-testid="por-audit-btn" className="btn-secondary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem' }} onClick={onAuditPoR}>
                🔄 Auditar PoR
              </button>
              <button data-testid="treasury-faucet-btn" className="btn-secondary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }} onClick={onFaucetUSDC}>
                🚰 Faucet 10k USDC
              </button>
            </div>
          </div>

          {/* User Balances */}
          <div className="treasury-shares-grid" style={{ marginBottom: '1.25rem' }}>
            <div className="treasury-shares-card-usdc" style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '1rem', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.7, fontWeight: 600 }}>SALDO USDC DISPONIBLE</div>
              <div data-testid="treasury-usdc-balance" style={{ fontWeight: 800, fontSize: '1.4rem', color: '#4ade80', marginTop: '0.2rem' }}>{usdcBalance} USDC</div>
            </div>
            <div className="treasury-shares-card-shares" style={{ background: 'rgba(192, 132, 252, 0.08)', border: '1px solid rgba(192, 132, 252, 0.2)', padding: '1rem', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.7, fontWeight: 600 }}>MIS ALPHA SHARES</div>
              <div data-testid="treasury-shares-balance" style={{ fontWeight: 800, fontSize: '1.4rem', color: '#c084fc', marginTop: '0.2rem' }}>{sharesBalance} ALPHA</div>
            </div>
          </div>

          {/* Actions Forms */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', display: 'block', marginBottom: '0.5rem' }}>
                💳 Depositar USDC para Acuñar Shares:
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  data-testid="treasury-deposit-input"
                  type="number"
                  placeholder="Monto USDC (ej. 1000)"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="treasury-input-flex"
                  style={{ width: '100%', background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.6rem', borderRadius: '8px' }}
                />
                <button data-testid="treasury-deposit-btn" className="btn-primary" onClick={onDeposit} style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', whiteSpace: 'nowrap', padding: '0.6rem 1.2rem', fontWeight: 700 }}>
                  Depositar
                </button>
              </div>
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', display: 'block', marginBottom: '0.5rem' }}>
                🔥 Rescatar ALPHA Shares a NAV:
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  data-testid="treasury-redeem-input"
                  type="number"
                  placeholder="Monto ALPHA (ej. 500)"
                  value={redeemAmount}
                  onChange={(e) => setRedeemAmount(e.target.value)}
                  className="treasury-input-flex"
                  style={{ width: '100%', background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.6rem', borderRadius: '8px' }}
                />
                <button data-testid="treasury-redeem-btn" className="btn-primary" onClick={onRedeem} style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', whiteSpace: 'nowrap', padding: '0.6rem 1.2rem', fontWeight: 700 }}>
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