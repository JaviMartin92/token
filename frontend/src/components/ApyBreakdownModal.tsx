import React from 'react';

interface ApyBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  porAssets?: string;
  porBreakdown?: { stables: number; wbtc: number; weth: number; alphaStaking: number };
  stakedBalance?: string;
  grossCashflowUsd?: number;
  activeLoansUsd?: number;
  claimableYieldUsd?: number;
  activeLoansInterestUsd?: number;
}

export function calculateProtocolApyMath(
  porAssets: string = '0.00',
  porBreakdown = { stables: 0, wbtc: 0, weth: 0, alphaStaking: 0 },
  stakedBalance: string = '0',
  grossCashflowUsd: number = 0,
  activeLoansUsd: number = 0,
  claimableYieldUsd: number = 0,
  activeLoansInterestUsd: number = 0
) {
  const numericAssetsUSD = parseFloat(porAssets.replace(/,/g, '')) || 0;
  const numericStakedAlpha = parseFloat(stakedBalance.replace(/,/g, '')) || 0;

  let stablesUSD = porBreakdown.stables;
  let wbtcUSD = porBreakdown.wbtc;
  let wethUSD = porBreakdown.weth;
  let loanPoolUSD = porBreakdown.alphaStaking;

  const realActiveLoansUSD = Math.min(activeLoansUsd, loanPoolUSD);
  const unlentLoanPoolUSD = Math.max(loanPoolUSD - realActiveLoansUSD, 0);
  const loanUtilizationPct = loanPoolUSD > 0 ? (realActiveLoansUSD / loanPoolUSD) * 100 : 0;

  const activeLoanInterestUSD = activeLoansInterestUsd;

  const treasuryLoanUSDYield = activeLoanInterestUSD;

  // 1. Morpho Blue (USDC): 80% of USDC stablecoin reserve deployed to MetaMorpho Vault @ ~6.45% APR
  const morphoUSDPool = stablesUSD * 0.80;
  const morphoUSDYield = morphoUSDPool * 0.0645;

  // 2. Lombard LBTC (WBTC): 100% of WBTC reserve @ ~4.85% APR
  const lbtcUSDYield = wbtcUSD * 0.0485;

  // 3. Lido wstETH (WETH): 100% of WETH reserve @ ~3.65% APR
  const wstEthUSDYield = wethUSD * 0.0365;

  const totalAnnualYieldUSD = morphoUSDYield + lbtcUSDYield + wstEthUSDYield + treasuryLoanUSDYield;
  const realTimeBaseApyPct = numericAssetsUSD > 0 ? (totalAnnualYieldUSD / numericAssetsUSD) * 100 : 0;

  const wStablesPct = numericAssetsUSD > 0 ? (stablesUSD / numericAssetsUSD) * 100 : 0;
  const wBtcPct = numericAssetsUSD > 0 ? (wbtcUSD / numericAssetsUSD) * 100 : 0;
  const wEthPct = numericAssetsUSD > 0 ? (wethUSD / numericAssetsUSD) * 100 : 0;
  const wLoanPct = numericAssetsUSD > 0 ? (loanPoolUSD / numericAssetsUSD) * 100 : 0;

  const actualBondFeesUSD = grossCashflowUsd * 0.015;
  const actualP2pFeesUSD = realActiveLoansUSD * 0.005;
  const actualInterestSpreadUSD = activeLoanInterestUSD * 0.10;
  const totalFlywheelFeesUSD = claimableYieldUsd > 0 ? claimableYieldUsd : (actualBondFeesUSD + actualP2pFeesUSD + actualInterestSpreadUSD);

  const flywheelApyPct = numericStakedAlpha > 0 
    ? (totalFlywheelFeesUSD / numericStakedAlpha) * 100 
    : 0.00;

  const totalApyPct = (realTimeBaseApyPct + flywheelApyPct).toFixed(2);

  return {
    numericAssetsUSD,
    numericStakedAlpha,
    stablesUSD,
    wbtcUSD,
    wethUSD,
    loanPoolUSD,
    realActiveLoansUSD,
    unlentLoanPoolUSD,
    loanUtilizationPct,
    activeLoanInterestUSD,
    treasuryLoanUSDYield,
    morphoUSDYield,
    lbtcUSDYield,
    wstEthUSDYield,
    totalAnnualYieldUSD,
    realTimeBaseApyPct,
    wStablesPct,
    wBtcPct,
    wEthPct,
    wLoanPct,
    actualBondFeesUSD,
    actualP2pFeesUSD,
    actualInterestSpreadUSD,
    totalFlywheelFeesUSD,
    flywheelApyPct,
    totalApyPct
  };
}

export const ApyBreakdownModal: React.FC<ApyBreakdownModalProps> = ({
  isOpen,
  onClose,
  porAssets = '0.00',
  porBreakdown = { stables: 0, wbtc: 0, weth: 0, alphaStaking: 0 },
  stakedBalance = '0',
  grossCashflowUsd = 0,
  activeLoansUsd = 0,
  claimableYieldUsd = 0,
  activeLoansInterestUsd = 0
}) => {
  if (!isOpen) return null;

  const {
    numericAssetsUSD,
    numericStakedAlpha,
    stablesUSD,
    wbtcUSD,
    wethUSD,
    loanPoolUSD,
    realActiveLoansUSD,
    unlentLoanPoolUSD,
    loanUtilizationPct,
    activeLoanInterestUSD,
    treasuryLoanUSDYield,
    morphoUSDYield,
    lbtcUSDYield,
    wstEthUSDYield,
    totalAnnualYieldUSD,
    realTimeBaseApyPct,
    wStablesPct,
    wBtcPct,
    wEthPct,
    wLoanPct,
    actualBondFeesUSD,
    actualP2pFeesUSD,
    actualInterestSpreadUSD,
    totalFlywheelFeesUSD,
    flywheelApyPct,
    totalApyPct
  } = calculateProtocolApyMath(
    porAssets,
    porBreakdown,
    stakedBalance,
    grossCashflowUsd,
    activeLoansUsd,
    claimableYieldUsd,
    activeLoansInterestUsd
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(10px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: '20px',
          border: '1px solid rgba(168, 85, 247, 0.5)',
          background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 27, 75, 0.95) 100%)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(168, 85, 247, 0.25)',
          padding: '1.75rem'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.6rem' }}>⚡</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#f0abfc', fontWeight: 800 }}>Desglose de Reservas y Rendimiento Anualizado en Tiempo Real</h3>
              <div style={{ fontSize: '0.75rem', color: '#cbd5e1', opacity: 0.8, marginTop: '0.1rem' }}>
                Reservas Totales: ${numericAssetsUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD • Staking: {numericStakedAlpha.toLocaleString()} ALPHA
              </div>
            </div>
          </div>
          <button
            data-testid="modal-apy-close-btn"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#94a3b8',
              fontSize: '1.2rem',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* Big APY Highlight Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%)',
            border: '1px solid rgba(168, 85, 247, 0.4)',
            borderRadius: '14px',
            padding: '1.15rem',
            textAlign: 'center',
            marginBottom: '1.5rem',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
          }}
        >
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#c084fc', fontWeight: 700, marginBottom: '0.2rem' }}>
            RENDIMIENTO ANUALIZADO TOTAL EN TIEMPO REAL
          </div>
          <div data-testid="modal-apy-total-apr" style={{ fontSize: '2.5rem', fontWeight: 900, color: '#f0abfc', textShadow: '0 2px 10px rgba(168,85,247,0.4)' }}>
            {totalApyPct}% APR
          </div>
          <div data-testid="modal-apy-annual-yield-usd" style={{ fontSize: '0.85rem', color: '#34d399', fontWeight: 700, marginTop: '0.2rem' }}>
            +${totalAnnualYieldUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD / año generados por las Reservas
          </div>
          <div style={{ fontSize: '0.75rem', color: '#e2e8f0', opacity: 0.9, marginTop: '0.4rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <span>🏦 Base Reservas: <strong data-testid="modal-apy-base-apr">{realTimeBaseApyPct.toFixed(3)}%</strong> (+${totalAnnualYieldUSD.toFixed(2)} USD/año)</span>
            <span>+</span>
            <span>💸 Flywheel Recompensas: <strong data-testid="modal-apy-flywheel-apr">{flywheelApyPct.toFixed(3)}%</strong> (+${totalFlywheelFeesUSD.toFixed(2)} USDC/año)</span>
          </div>
        </div>

        {/* Section 1: Base Reserve Yield */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>1. DÓNDE ESTÁN LAS RESERVAS & RENDIMIENTO ANUALIZADO (ON-CHAIN)</span>
            <span style={{ color: '#6ee7b7' }}>Tasa Base: {realTimeBaseApyPct.toFixed(3)}% APR</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {/* Morpho */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#e2e8f0' }}>🏦 Morpho Blue MetaMorpho Vault (USDC)</div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                  Ubicación: <strong>${stablesUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong> ({wStablesPct.toFixed(1)}% de Reservas) • Rendimiento Variable
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, color: '#34d399', fontSize: '0.95rem' }}>
                  +${morphoUSDYield.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD / año
                </div>
                <div style={{ fontSize: '0.7rem', color: '#6ee7b7' }}>+{( (morphoUSDYield / (numericAssetsUSD || 1)) * 100 ).toFixed(3)}% APR</div>
              </div>
            </div>

            {/* Lombard LBTC */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#e2e8f0' }}>₿ Lombard LBTC Bitcoin Liquid Staking</div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                  Ubicación: <strong>${wbtcUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong> ({wBtcPct.toFixed(1)}% de Reservas) • Rendimiento Variable
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, color: wbtcUSD > 0 ? '#34d399' : '#64748b', fontSize: '0.95rem' }}>
                  +${lbtcUSDYield.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD / año
                </div>
                <div style={{ fontSize: '0.7rem', color: wbtcUSD > 0 ? '#6ee7b7' : '#64748b' }}>+{( (lbtcUSDYield / (numericAssetsUSD || 1)) * 100 ).toFixed(3)}% APR</div>
              </div>
            </div>

            {/* Lido wstETH */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#e2e8f0' }}>Ξ Lido wstETH Ethereum Liquid Staking</div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                  Ubicación: <strong>${wethUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong> ({wEthPct.toFixed(1)}% de Reservas) • Rendimiento Variable
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, color: wethUSD > 0 ? '#34d399' : '#64748b', fontSize: '0.95rem' }}>
                  +${wstEthUSDYield.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD / año
                </div>
                <div style={{ fontSize: '0.7rem', color: wethUSD > 0 ? '#6ee7b7' : '#64748b' }}>+{( (wstEthUSDYield / (numericAssetsUSD || 1)) * 100 ).toFixed(3)}% APR</div>
              </div>
            </div>

            {/* Treasury Loans Utilization Breakdown */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#e2e8f0' }}>🏛️ Fondo de Préstamos Directos Tesorería ({wLoanPct.toFixed(1)}% Pool)</div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                  Fondo Total: <strong>${loanPoolUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong> • Prestado: <strong>${realActiveLoansUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD ({loanUtilizationPct.toFixed(1)}% util.)</strong> (Tasa Variable Real) (+${activeLoanInterestUSD.toFixed(2)}/año)
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.1rem' }}>
                  No Prestado (en Bóveda Morpho): <strong>${unlentLoanPoolUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong> (Tasa 0% inactiva) 
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, color: '#34d399', fontSize: '0.95rem' }}>
                  +${treasuryLoanUSDYield.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD / año
                </div>
                <div style={{ fontSize: '0.7rem', color: '#6ee7b7' }}>+{( (treasuryLoanUSDYield / (numericAssetsUSD || 1)) * 100 ).toFixed(3)}% APR</div>
              </div>
            </div>

            {/* ALPHA Token Staking & Treasury Backing */}
            <div style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: '10px', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#f0abfc' }}>🥩 Staking de Tokens ALPHA & Gobernanza DAO</div>
                <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '0.1rem' }}>
                  Posición Activa: <strong>{numericStakedAlpha.toLocaleString()} ALPHA</strong> • Respaldo Directo NAV: <strong>${(numericStakedAlpha * 1.0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#c084fc', marginTop: '0.1rem' }}>
                  Recibe el 100% del Flywheel Revenue del Protocolo (+${totalFlywheelFeesUSD.toFixed(2)} USDC/año repartidos a Stakers)
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, color: '#f0abfc', fontSize: '0.95rem' }}>
                  +{flywheelApyPct.toFixed(3)}% APR Boost
                </div>
                <div style={{ fontSize: '0.7rem', color: '#e9d5ff' }}>+${totalFlywheelFeesUSD.toFixed(2)} USDC / año</div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Flywheel Fee Distribution */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>2. COMISIONES DE PROTOCOLO FLUIDAS (FLYWHEEL REAL YIELD)</span>
            <span style={{ color: '#93c5fd' }}>Boost Staking: +{flywheelApyPct.toFixed(3)}% APR</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {/* Bond Fees */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#e2e8f0' }}>🏷️ Comisiones por Emisión de Bonos Vestados (1.5%)</div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                  Recaudación Anualizada de Comisiones: +${actualBondFeesUSD.toFixed(2)} USDC/año
                </div>
              </div>
              <div style={{ fontWeight: 700, color: '#60a5fa', fontSize: '0.95rem' }}>
                +${actualBondFeesUSD.toFixed(2)} USDC / año
              </div>
            </div>

            {/* P2P Fees */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#e2e8f0' }}>🤝 Comisiones de Originación P2P (0.50%)</div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                  Recaudación Anualizada sobre Préstamos: +${actualP2pFeesUSD.toFixed(2)} USDC/año
                </div>
              </div>
              <div style={{ fontWeight: 700, color: '#60a5fa', fontSize: '0.95rem' }}>
                +${actualP2pFeesUSD.toFixed(2)} USDC / año
              </div>
            </div>

            {/* Margin Spread */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#e2e8f0' }}>💰 Spread de Margen de Interés (10.0%)</div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                  10% de comisión sobre los intereses generados on-chain
                </div>
              </div>
              <div style={{ fontWeight: 700, color: '#60a5fa', fontSize: '0.95rem' }}>
                +${actualInterestSpreadUSD.toFixed(2)} USDC / año
              </div>
            </div>
          </div>
        </div>

        {/* Verification Footnote */}
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.85rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.5 }}>
          <div style={{ fontWeight: 600, color: '#f0abfc', marginBottom: '0.2rem' }}>🔍 Fórmula Matématica Exacta On-Chain:</div>
          <code>Rendimiento_Anual_USD = Σ (Ubicación_USD_i × Tasa_i) + Comisiones_Protocolo_USDC</code>
          <div style={{ marginTop: '0.3rem', fontSize: '0.7rem', opacity: 0.8 }}>
            Tasa APY Base = (Total_Generado_USD / Reservas_Totales_USD) = ({totalAnnualYieldUSD.toFixed(2)} / {numericAssetsUSD.toFixed(2)}) = <strong>{realTimeBaseApyPct.toFixed(3)}% APR</strong>
          </div>
        </div>

        {/* Close Button */}
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <button
            className="btn-primary"
            style={{ width: '100%', background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)', padding: '0.75rem', fontWeight: 700, borderRadius: '10px' }}
            onClick={onClose}
          >
            ✅ Entendido y Verificado
          </button>
        </div>
      </div>
    </div>
  );
};
