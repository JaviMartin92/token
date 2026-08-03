import React, { useState } from 'react';

import type { UserPosition } from './VestedVaults.js';

export interface MarketplaceLoan {
  id: number;
  lender: string;
  borrower: string;
  positionTokenId: number;
  borrowAmount: string;
  collateralAmount: string;
  interestRateBps: number;
  interestRateApr: string;
  durationDays: number;
  startTime: number;
  state: number; // 0: CREATED, 1: ACTIVE, 2: REPAID, 3: LIQUIDATED, 4: CANCELLED
  healthFactor?: string;
}

interface P2PMarketplaceProps {
  p2pTokenId: string;
  setP2pTokenId: (val: string) => void;
  p2pBorrowAmount: string;
  setP2pBorrowAmount: (val: string) => void;
  p2pInterestBps: string;
  setP2pInterestBps: (val: string) => void;
  p2pDays: string;
  setP2pDays: (val: string) => void;
  onCreateLoanOffer: () => void;
  targetLoanId: string;
  setTargetLoanId: (val: string) => void;
  loanCollateral: string;
  setLoanCollateral: (val: string) => void;
  onAcceptLoan: () => void;
  onRepayLoan: () => void;
  onLiquidateLoan: () => void;
  loansList?: MarketplaceLoan[];
  userPositions?: UserPosition[];
  userAddress?: string;
  onAcceptLoanById?: (loanId: number, borrowAmount: string) => void;
  onCancelLoanOffer?: (loanId: number) => void;
  onRepayLoanById?: (loanId: number, loanObj?: any) => void;
  onLiquidateLoanById?: (loanId: number) => void;
  onBorrowFromTreasury?: (collateralType: string, tokenIdOrAmt: string, amount: string, days: string) => void;
}

export const P2PMarketplace: React.FC<P2PMarketplaceProps> = ({
  p2pTokenId,
  setP2pTokenId,
  p2pBorrowAmount,
  setP2pBorrowAmount,
  p2pInterestBps,
  setP2pInterestBps,
  p2pDays,
  setP2pDays,
  onCreateLoanOffer,
  targetLoanId,
  setTargetLoanId,
  loanCollateral,
  setLoanCollateral,
  onAcceptLoan,
  onRepayLoan,
  onLiquidateLoan,
  loansList = [],
  userPositions = [],
  userAddress = '',
  onAcceptLoanById,
  onCancelLoanOffer,
  onRepayLoanById,
  onLiquidateLoanById,
  onBorrowFromTreasury
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'created' | 'active' | 'my'>('all');
  const [treasuryColType, setTreasuryColType] = useState<string>('nft');
  const [treasuryColAmount, setTreasuryColAmount] = useState<string>('5000');

  const filteredLoans = loansList.filter((loan) => {
    if (filterTab === 'created') return loan.state === 0;
    if (filterTab === 'active') return loan.state === 1;
    if (filterTab === 'my') {
      return (
        loan.lender.toLowerCase() === userAddress.toLowerCase() ||
        loan.borrower.toLowerCase() === userAddress.toLowerCase()
      );
    }
    return true;
  });

  const getStatusBadge = (state: number) => {
    switch (state) {
      case 0:
        return <span style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#facc15', border: '1px solid rgba(234, 179, 8, 0.4)', padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>🟡 Disponible (Oferta)</span>;
      case 1:
        return <span style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.4)', padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>🟢 Activo (Financiado)</span>;
      case 2:
        return <span style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.4)', padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>🔵 Reembolsado</span>;
      case 3:
        return <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>🔴 Liquidado</span>;
      case 4:
        return <span style={{ background: 'rgba(156, 163, 175, 0.2)', color: '#9ca3af', border: '1px solid rgba(156, 163, 175, 0.4)', padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>⚪ Cancelado</span>;
      default:
        return null;
    }
  };

  return (
    <div className="p2p-container">
      
      {/* Treasury Reserve APY Booster Banner */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', borderRadius: '16px', borderLeft: '4px solid #10b981', background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(15,23,42,0.4) 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h4 style={{ margin: 0, color: '#34d399', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🏛️ Respaldo Institucional: Préstamos con Reservas de Tesorería (Treasury APY Booster)
            </h4>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.82rem', opacity: 0.85, lineHeight: 1.45 }}>
              Las reservas de la tesorería despliegan hasta un <strong>20% máximo de su pool de stablecoins</strong> en préstamos sobre-colateralizados.
              Puedes solicitar financiación directa a la Tesorería al <strong>8.00% APR fijo</strong>. Los rendimientos generados retornan <strong>100% a la Tesorería</strong> aumentando el NAV del token ALPHA.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ padding: '0.4rem 0.8rem', background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '8px', color: '#6ee7b7', fontSize: '0.8rem', fontWeight: 600 }}>
              🛡️ Fondo de Reserva Activo
            </span>
            <span style={{ padding: '0.4rem 0.8rem', background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', borderRadius: '8px', color: '#93c5fd', fontSize: '0.8rem', fontWeight: 600 }}>
              ⚡ Tasa Promocional 8.00% APR
            </span>
          </div>
        </div>
      </div>

      {/* ACTIVE LOANS QUICK REPAYMENT PANEL - only show user's own loans */}
      {loansList.filter(l => (l.state === 1 && l.borrower.toLowerCase() === userAddress.toLowerCase()) || (l.state === 0 && l.lender.toLowerCase() === userAddress.toLowerCase())).length > 0 && (
        <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.4)', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)' }}>
          <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            💳 Mis Préstamos Solicitados & Activos ({loansList.filter(l => (l.state === 1 && l.borrower.toLowerCase() === userAddress.toLowerCase()) || (l.state === 0 && l.lender.toLowerCase() === userAddress.toLowerCase())).length})
          </h3>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', opacity: 0.85 }}>
            Aquí puedes ver claramente todos los préstamos solicitados u ofertas activas y <strong>reembolsarlos fácilmente en 1-clic</strong> para recuperar tu colateral en custodia (NFT, ALPHA, WBTC, WETH).
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {loansList.filter(l => (l.state === 1 && l.borrower.toLowerCase() === userAddress.toLowerCase()) || (l.state === 0 && l.lender.toLowerCase() === userAddress.toLowerCase())).map((loan) => (
              <div key={loan.id} style={{ background: 'rgba(0,0,0,0.3)', border: loan.state === 1 ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(234, 179, 8, 0.4)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>Préstamo #{loan.id}</span>
                    {getStatusBadge(loan.state)}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#38bdf8', fontWeight: 600 }}>
                    Deuda: <strong>${loan.borrowAmount} USDC</strong> @ {loan.interestRateApr}% APR
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    Colateral Custodiado: <strong style={{ color: '#f0abfc' }}>NFT #{loan.positionTokenId} / ERC20 en Escrow</strong>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.1rem' }}>
                    Plazo: {loan.durationDays} días • Factor Salud: <strong style={{ color: '#4ade80' }}>{loan.healthFactor || '140% (Seguro)'}</strong>
                  </div>
                </div>

                {loan.state === 1 && onRepayLoanById ? (
                  <button
                    className="btn-primary"
                    style={{ width: '100%', padding: '0.6rem', fontSize: '0.85rem', fontWeight: 700, background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}
                    onClick={() => onRepayLoanById(loan.id)}
                  >
                    💳 Reembolsar Préstamo #{loan.id} y Liberar Colateral
                  </button>
                ) : loan.state === 0 && onCancelLoanOffer ? (
                  <button
                    className="btn-primary"
                    style={{ width: '100%', padding: '0.55rem', fontSize: '0.8rem', background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#fca5a5' }}
                    onClick={() => onCancelLoanOffer(loan.id)}
                  >
                    ❌ Cancelar Solicitud #{loan.id}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid: Create Loan & Treasury Borrow & Quick Action Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* Treasury Direct Reserve Loan Card */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.4)', background: 'linear-gradient(145deg, rgba(16,185,129,0.06) 0%, rgba(15,23,42,0.8) 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.3rem' }}>🏛️</span>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#34d399' }}>Pedir Préstamo a la Tesorería</h3>
          </div>
          <p style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '1rem', lineHeight: 1.45 }}>
            Accede al <strong>20% de Reserva Líquida de la Tesorería</strong>. Desembolso instantáneo en USDC usando tu NFT como garantía a una <strong>tasa fija del 8.00% APR</strong>.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.2rem' }}>Selecciona Tipo de Garantía Colateral:</label>
              <select
                value={treasuryColType}
                onChange={(e) => setTreasuryColType(e.target.value)}
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', background: '#0f172a', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#fff', marginBottom: '0.6rem', fontSize: '0.85rem', fontWeight: 600 }}
              >
                <option value="nft">🖼️ NFT de Posición Bonos ERC-721 (70.00% Max LTV)</option>
                <option value="alpha">🥩 Token ALPHA Staked (50.00% Max LTV)</option>
                <option value="wbtc">₿ Wrapped Bitcoin - WBTC (70.00% Max LTV)</option>
                <option value="weth">Ξ Wrapped Ethereum - WETH (75.00% Max LTV)</option>
              </select>

              {treasuryColType === 'nft' ? (
                <>
                  <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.2rem' }}>NFT Token ID como Garantía:</label>
                  {userPositions.filter(p => !p.isRagequitted && !p.isMaturedClaimed).length > 0 ? (
                    <select
                      value={p2pTokenId}
                      onChange={(e) => setP2pTokenId(e.target.value)}
                      style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', background: '#0f172a', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#fff' }}
                    >
                      <option value="">-- Selecciona un NFT de tu Billetera --</option>
                      {userPositions.filter(p => !p.isRagequitted && !p.isMaturedClaimed).map((pos) => (
                        <option key={pos.id} value={pos.id.toString()}>
                          NFT #{pos.id} (Principal: ${pos.principal} USDC — LTV Máx ~${(parseFloat(pos.principal) * 0.7).toFixed(0)} USDC)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      placeholder="ej. 1"
                      value={p2pTokenId}
                      onChange={(e) => setP2pTokenId(e.target.value)}
                      style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#fff' }}
                    />
                  )}
                </>
              ) : (
                <>
                  <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.2rem' }}>
                    Monto de {treasuryColType.toUpperCase()} a Depositar como Garantía:
                  </label>
                  <input
                    type="text"
                    placeholder={treasuryColType === 'alpha' ? 'ej. 5000 ALPHA' : treasuryColType === 'wbtc' ? 'ej. 0.02 WBTC' : 'ej. 0.5 WETH'}
                    value={treasuryColAmount}
                    onChange={(e) => setTreasuryColAmount(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#34d399', fontWeight: 600 }}
                  />
                </>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', opacity: 0.8, display: 'block', marginBottom: '0.2rem' }}>Monto USDC a Solicitar:</label>
                <input
                  type="number"
                  placeholder="ej. 500"
                  value={p2pBorrowAmount}
                  onChange={(e) => setP2pBorrowAmount(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#fff' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', opacity: 0.8, display: 'block', marginBottom: '0.2rem' }}>Duración (Días):</label>
                <input
                  type="number"
                  value={p2pDays}
                  onChange={(e) => setP2pDays(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#fff' }}
                />
              </div>
            </div>

            <button
              className="btn-primary"
              style={{ width: '100%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', marginTop: '0.2rem', padding: '0.7rem', fontWeight: 700, boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
              onClick={() => onBorrowFromTreasury && onBorrowFromTreasury(treasuryColType, treasuryColType === 'nft' ? p2pTokenId : treasuryColAmount, p2pBorrowAmount, p2pDays)}
            >
              🏛️ Solicitar Crédito a la Tesorería ({treasuryColType.toUpperCase()})
            </button>
          </div>
        </div>
        
        {/* Create Loan Offer Card */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem' }}>🤝 Publicar Oferta de Préstamo P2P</h3>
          <p style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '1rem' }}>
            Deposita un NFT de Posición como colateral en escrow para solicitar un préstamo. Tu oferta se publicará inmediatamente en el Marketplace.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.2rem' }}>NFT Token ID a Colateralizar:</label>
              {userPositions.filter(p => !p.isRagequitted && !p.isMaturedClaimed).length > 0 ? (
                <select
                  value={p2pTokenId}
                  onChange={(e) => setP2pTokenId(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                >
                  <option value="">-- Selecciona un NFT de tu Billetera --</option>
                  {userPositions.filter(p => !p.isRagequitted && !p.isMaturedClaimed).map((pos) => (
                    <option key={pos.id} value={pos.id.toString()}>
                      NFT #{pos.id} (Principal: ${pos.principal} USDC — Bloqueo: {pos.lockYears} Años)
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  placeholder="ej. 1"
                  value={p2pTokenId}
                  onChange={(e) => setP2pTokenId(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
                />
              )}
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.2rem' }}>Monto a Pedir Prestado (USDC):</label>
              <input
                type="number"
                placeholder="ej. 500"
                value={p2pBorrowAmount}
                onChange={(e) => setP2pBorrowAmount(e.target.value)}
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', opacity: 0.8, display: 'block', marginBottom: '0.2rem' }}>Interés (BPS - 1000 = 10%):</label>
                <input
                  type="number"
                  value={p2pInterestBps}
                  onChange={(e) => setP2pInterestBps(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', opacity: 0.8, display: 'block', marginBottom: '0.2rem' }}>Duración (Días):</label>
                <input
                  type="number"
                  value={p2pDays}
                  onChange={(e) => setP2pDays(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
                />
              </div>
            </div>

            <button className="btn-primary" style={{ width: '100%', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', marginTop: '0.2rem', padding: '0.7rem' }} onClick={onCreateLoanOffer}>
              🚀 Crear y Publicar Oferta de Préstamo
            </button>
          </div>
        </div>

        {/* Manual Operation Card */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem' }}>⚖️ Gestor Manual por ID</h3>
          <p style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '1rem' }}>
            Financia, reembolsa o liquida préstamos ingresando directamente el ID correspondiente.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.2rem' }}>ID Préstamo Objetivo:</label>
              <input
                type="number"
                placeholder="ej. 1"
                value={targetLoanId}
                onChange={(e) => setTargetLoanId(e.target.value)}
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.2rem' }}>Colateral USDC Requerido (130%-150%):</label>
              <input
                type="number"
                placeholder="ej. 700"
                value={loanCollateral}
                onChange={(e) => setLoanCollateral(e.target.value)}
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.2rem' }}>
              <button className="btn-primary" style={{ background: '#22c55e' }} onClick={onAcceptLoan}>
                ✅ Financiar
              </button>
              <button className="btn-primary" style={{ background: '#3b82f6' }} onClick={onRepayLoan}>
                💰 Reembolsar
              </button>
            </div>

            <button className="btn-primary" style={{ width: '100%', background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', marginTop: '0.2rem', padding: '0.6rem' }} onClick={onLiquidateLoan}>
              ⚡ Auto-Liquidar si HF &lt; 115%
            </button>
          </div>
        </div>
      </div>

      {/* Main P2P Loan Marketplace Table / Cards */}
      <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📊 Explorador & Marketplace de Préstamos P2P ({filteredLoans.length})
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', opacity: 0.7 }}>
              Todas las ofertas creadas on-chain visibles en tiempo real. Financia préstamos para obtener rendimiento o gestiona tus posiciones.
            </p>
          </div>

          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: '0.35rem', background: 'rgba(0,0,0,0.4)', padding: '0.3rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <button
              onClick={() => setFilterTab('all')}
              style={{ padding: '0.35rem 0.85rem', borderRadius: '8px', border: 'none', background: filterTab === 'all' ? 'rgba(255,255,255,0.15)' : 'transparent', color: '#fff', fontSize: '0.8rem', cursor: 'pointer', fontWeight: filterTab === 'all' ? 600 : 400 }}
            >
              Todos ({loansList.length})
            </button>
            <button
              onClick={() => setFilterTab('created')}
              style={{ padding: '0.35rem 0.85rem', borderRadius: '8px', border: 'none', background: filterTab === 'created' ? 'rgba(234, 179, 8, 0.25)' : 'transparent', color: filterTab === 'created' ? '#facc15' : '#fff', fontSize: '0.8rem', cursor: 'pointer', fontWeight: filterTab === 'created' ? 600 : 400 }}
            >
              Disponibles ({loansList.filter((l) => l.state === 0).length})
            </button>
            <button
              onClick={() => setFilterTab('active')}
              style={{ padding: '0.35rem 0.85rem', borderRadius: '8px', border: 'none', background: filterTab === 'active' ? 'rgba(34, 197, 94, 0.25)' : 'transparent', color: filterTab === 'active' ? '#4ade80' : '#fff', fontSize: '0.8rem', cursor: 'pointer', fontWeight: filterTab === 'active' ? 600 : 400 }}
            >
              Financiados ({loansList.filter((l) => l.state === 1).length})
            </button>
            <button
              onClick={() => setFilterTab('my')}
              style={{ padding: '0.35rem 0.85rem', borderRadius: '8px', border: 'none', background: filterTab === 'my' ? 'rgba(59, 130, 246, 0.25)' : 'transparent', color: filterTab === 'my' ? '#60a5fa' : '#fff', fontSize: '0.8rem', cursor: 'pointer', fontWeight: filterTab === 'my' ? 600 : 400 }}
            >
              Mis Préstamos
            </button>
          </div>
        </div>

        {/* Loan Table */}
        {filteredLoans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.15)' }}>
            <p style={{ margin: 0, fontSize: '1rem', opacity: 0.6 }}>No hay préstamos P2P disponibles en esta categoría.</p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', opacity: 0.4 }}>¡Crea una nueva oferta utilizando el formulario superior!</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.03)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>ID</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Estado</th>
                  <th style={{ padding: '0.75rem 1rem' }}>NFT Colateral</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Monto Solicitado</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Tasa APR</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Plazo</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Creador / Ofertante</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Salud / HF</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Acción Directa</th>
                </tr>
              </thead>
              <tbody>
                {filteredLoans.map((loan) => {
                  const isLender = loan.lender.toLowerCase() === userAddress.toLowerCase();

                  return (
                    <tr key={loan.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>#{loan.id}</td>
                      <td style={{ padding: '0.85rem 1rem' }}>{getStatusBadge(loan.state)}</td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{ background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                          NFT #{loan.positionTokenId}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#38bdf8' }}>
                        ${loan.borrowAmount} USDC
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#4ade80' }}>
                        {loan.interestRateApr}% APR
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>{loan.durationDays} días</td>
                      <td style={{ padding: '0.85rem 1rem', opacity: 0.8, fontSize: '0.78rem' }}>
                        {isLender ? <span style={{ color: '#facc15', fontWeight: 600 }}>Tú (Creador)</span> : `${loan.lender.slice(0, 6)}...${loan.lender.slice(-4)}`}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {loan.state === 1 ? (
                          <span style={{ color: parseFloat(loan.healthFactor || '0') >= 130 ? '#4ade80' : '#f87171', fontWeight: 600 }}>
                            {loan.healthFactor}
                          </span>
                        ) : (
                          <span style={{ opacity: 0.4 }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        {/* Action Buttons based on Loan State */}
                        {loan.state === 0 && !isLender && onAcceptLoanById && (
                          <button
                            className="btn-primary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}
                            onClick={() => onAcceptLoanById(loan.id, loan.borrowAmount)}
                          >
                            ✅ Financiar Oferta
                          </button>
                        )}

                        {loan.state === 0 && isLender && onCancelLoanOffer && (
                          <button
                            className="btn-primary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', background: 'rgba(239, 68, 68, 0.3)', border: '1px solid #ef4444', color: '#fca5a5' }}
                            onClick={() => onCancelLoanOffer(loan.id)}
                          >
                            ❌ Cancelar Oferta
                          </button>
                        )}

                        {loan.state === 1 && onRepayLoanById && (
                          <button
                            className="btn-primary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}
                            onClick={() => onRepayLoanById(loan.id, loan)}
                          >
                            💰 Reembolsar
                          </button>
                        )}

                        {loan.state === 1 && onLiquidateLoanById && (
                          <button
                            className="btn-primary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#f87171' }}
                            onClick={() => onLiquidateLoanById(loan.id)}
                          >
                            ⚡ Auto-Liquidar
                          </button>
                        )}

                        {(loan.state === 2 || loan.state === 3 || loan.state === 4) && (
                          <span style={{ opacity: 0.4, fontSize: '0.75rem' }}>Completado</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};