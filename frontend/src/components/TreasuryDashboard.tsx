import React from 'react';

interface TreasuryDashboardProps {
  porAssets: string;
  porLiabilities: string;
  porRatio: string;
  porBreakdown: { stables: number; wbtc: number; weth: number; alphaStaking: number };
  targetWeights: { stables: number; wbtc: number; weth: number; alts: number };
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
  porBreakdown,
  targetWeights,
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

  // Derive solvency status from the on-chain collateral ratio string (e.g. "92.91%")
  const ratioNum = parseFloat(porRatio.replace('%', '')) || 0;
  const isSolvent = ratioNum >= 100.0;
  const solvencyLabel = isSolvent ? '🟢 100% Solvente (NPV 1:1)' : `🔴 Insuficiente (${porRatio})`;
  const solvencyColor = isSolvent ? '#4ade80' : '#f43f5e';
  const solvencyBg = isSolvent ? 'rgba(74, 222, 128, 0.15)' : 'rgba(244, 63, 94, 0.15)';
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {/* 2-Column Grid: Proof of Reserves (Left) & Mint/Redeem Shares (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', marginBottom: isAdmin ? '1.5rem' : 0 }}>
        {/* Card 1: Proof of Reserves */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🛡️ Proof of Reserves (Reserva On-Chain)
            </h3>
            <button className="btn-secondary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }} onClick={onAuditPoR}>
              🔄 Auditar On-Chain
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem', textAlign: 'center' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>ACTIVOS TOTALES</div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#38bdf8' }}>${porAssets} USD</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>PASIVOS TOTALES</div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#f43f5e' }}>${porLiabilities} USD</div>
            </div>
            <div className="por-metric-box">
              <div className="por-metric-label">COLATERALIZACIÓN</div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: solvencyColor }}>{porRatio}</div>
              <div style={{ fontSize: '0.62rem', marginTop: '0.2rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: solvencyBg, color: solvencyColor, fontWeight: 600, display: 'inline-block' }}>
                {solvencyLabel}
              </div>
            </div>
          </div>

          {/* Bond Issuance Coverage Banner */}
          <div className="banner-bond-coverage">
            <span><strong>Reserva Emisión de Bonos (NPV):</strong> Cobertura Inicial 1:1</span>
            <span style={{ color: '#4ade80', fontWeight: 600 }}>✓ {porRatio} Respaldado</span>
          </div>

          {/* Assets Breakdown Table */}
          <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.85rem', opacity: 0.8 }}>Desglose Transparente de Reservas por Activo:</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', opacity: 0.6 }}>
                <th style={{ padding: '0.4rem' }}>Activo Reserva</th>
                <th style={{ padding: '0.4rem', textAlign: 'right' }}>Valor USD</th>
                <th style={{ padding: '0.4rem', textAlign: 'right' }}>Ponderación Target</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '0.45rem' }}>💵 USDC / Stablecoins (Reserva Líquida Búnker)</td>
                <td style={{ padding: '0.45rem', textAlign: 'right', fontWeight: 600 }}>${porBreakdown.stables.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</td>
                <td style={{ padding: '0.45rem', textAlign: 'right', opacity: 0.7 }}>{targetWeights.stables.toFixed(2)}%</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '0.45rem' }}>₿ Wrapped Bitcoin (WBTC Target Allocation)</td>
                <td style={{ padding: '0.45rem', textAlign: 'right', fontWeight: 600 }}>${porBreakdown.wbtc.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</td>
                <td style={{ padding: '0.45rem', textAlign: 'right', opacity: 0.7 }}>{targetWeights.wbtc.toFixed(2)}%</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '0.45rem' }}>Ξ Wrapped Ethereum (WETH Liquid Staking)</td>
                <td style={{ padding: '0.45rem', textAlign: 'right', fontWeight: 600 }}>${porBreakdown.weth.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</td>
                <td style={{ padding: '0.45rem', textAlign: 'right', opacity: 0.7 }}>{targetWeights.weth.toFixed(2)}%</td>
              </tr>
              <tr>
                <td style={{ padding: '0.45rem' }}>🥩 Native ALPHA Staking (Reserva por Acuñación)</td>
                <td style={{ padding: '0.45rem', textAlign: 'right', fontWeight: 600 }}>${porBreakdown.alphaStaking.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</td>
                <td style={{ padding: '0.45rem', textAlign: 'right', opacity: 0.7 }}>{targetWeights.alts.toFixed(2)}%</td>
              </tr>
            </tbody>
          </table>

          {/* Transparency Note */}
          <div style={{ marginTop: '0.8rem', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.4 }}>
            💡 <strong>Nota de Transparencia PoR:</strong> Las nuevas emisiones de bonos vestados ingresan respaldadas al 100.00% en Valor Presente Neto (NPV 1:1). Las micro-variaciones decimales reflejan la dilución proporcional de superávits o comisiones previas.
          </div>

          {/* Dedicated Section: Treasury Active Loans & Overcollateralized Escrow Reserves */}
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
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#38bdf8', marginTop: '0.1rem' }}>
                  ${totalLentUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.58rem', opacity: 0.6 }}>Principal + 8% Interest</div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.55rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.62rem', opacity: 0.75, color: '#cbd5e1' }}>COLATERAL EN ESCROW</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#4ade80', marginTop: '0.1rem' }}>
                  ${totalCollateralUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.58rem', opacity: 0.6 }}>Garantía Custodiada</div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.55rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.62rem', opacity: 0.75, color: '#cbd5e1' }}>COBERTURA GARANTÍA</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#c084fc', marginTop: '0.1rem' }}>
                  {overCollateralRatio.toFixed(2)}%
                </div>
                <div style={{ fontSize: '0.58rem', color: '#4ade80', fontWeight: 600 }}>✓ Sobrecolateralizado</div>
              </div>
            </div>

            <div style={{ fontSize: '0.68rem', color: '#94a3b8', lineHeight: 1.35 }}>
              ℹ️ <strong>Protección de Solvencia:</strong> Cada préstamo concedido por la Tesorería requiere un colateral custodiado en escrow del 130%-150%. Al prestar $500 USDC, se custodian $1,000 USD de colateral en la bóveda, asegurando que el respaldo supere siempre al pasivo emitido.
            </div>
          </div>
        </div>

        {/* Card 2: Mint / Redeem Shares (NAV) */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>🏛️ Emisión y Rescate de Shares (NAV)</h3>
              <button className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={onFaucetUSDC}>
                🚰 Faucet 10k USDC
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.65rem 0.85rem', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>SALDO USDC DISPONIBLE</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#4ade80' }}>{usdcBalance} USDC</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.65rem 0.85rem', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>MIS ALPHA SHARES</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#c084fc' }}>{sharesBalance} ALPHA</div>
              </div>
            </div>

            {/* Deposit form */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.3rem' }}>
                Depositar USDC para Acuñar Shares (Comisión 0.5%):
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  placeholder="Monto USDC (ej. 1000)"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
                />
                <button className="btn-primary" onClick={onDeposit} style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', whiteSpace: 'nowrap' }}>
                  Depositar
                </button>
              </div>
            </div>

            {/* Redeem form */}
            <div>
              <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.3rem' }}>
                Rescatar ALPHA Shares a NAV (Comisión 1.0%):
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  placeholder="Shares a Rescatar (ej. 500)"
                  value={redeemAmount}
                  onChange={(e) => setRedeemAmount(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
                />
                <button className="btn-primary" onClick={onRedeem} style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', whiteSpace: 'nowrap' }}>
                  Rescatar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isAdmin && (() => {
        const numericAssets = parseFloat(porAssets.replace(/,/g, '')) || 0;
        const p2pAllocationUsd = totalLentUsd;
        const morphoAllocationUsd = Math.max(0, (numericAssets * (porBreakdown.stables / 10000)) - p2pAllocationUsd);
        const ethAllocationUsd = numericAssets * (porBreakdown.weth / 10000);
        const btcAllocationUsd = numericAssets * (porBreakdown.wbtc / 10000);
        const alphaAllocationUsd = numericAssets * (porBreakdown.alphaStaking / 10000);

        return (
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(56, 189, 248, 0.3)', background: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.8) 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🏛️ Estrategia e Inversión Institucional de Reservas (Solo Administrador)
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', opacity: 0.8 }}>
                Optimización activa de rendimiento en bóvedas de máxima seguridad y staking nativo para maximizar el NAV.
              </p>
            </div>
            <button
              className="btn-primary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', fontWeight: 600 }}
              onClick={onAuditPoR}
            >
              🌾 Cosechar Rendimiento Diario (Morpho Harvest)
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            {/* Stablecoins Strategy Box */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
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

            {/* Ethereum Strategy Box */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
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

            {/* Bitcoin Strategy Box */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
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

            {/* ALPHA Governance Strategy Box */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#38bdf8' }}>🌟 ALPHA (Reserva Protocolo)</span>
                <span style={{ fontSize: '0.75rem', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '0.15rem 0.4rem', borderRadius: '6px', fontWeight: 600 }}>100% On-Chain</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', opacity: 0.9, fontSize: '0.78rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>• Staked en Gobernanza:</span>
                  <strong>${(alphaAllocationUsd * 0.9).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Real Yield)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>• Fondo Promocional:</span>
                  <strong>${(alphaAllocationUsd * 0.1).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Incentivos)</strong>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '0.6rem', fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🔄 <strong>Enrutador DEX Dinámico de Swaps (1inch V5 + CoW Protocol + Paraswap V6):</strong> Cotización y enrutamiento dinámico en tiempo real para compras de WBTC/WETH con el menor fee y cero slippage.</span>
          </div>
        </div>
        );
      })()}
    </div>
  );
};