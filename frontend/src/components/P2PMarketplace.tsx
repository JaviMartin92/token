import React, { useState } from 'react';
import styles from './P2PMarketplace.module.css';

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
  navPerShareNum?: number;
  assetPrices?: { wbtc: number; weth: number };
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
  navPerShareNum = 1.0,
  assetPrices = { wbtc: 60000.0, weth: 3000.0 },
  onAcceptLoanById,
  onCancelLoanOffer,
  onRepayLoanById,
  onLiquidateLoanById,
  onBorrowFromTreasury
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'created' | 'active' | 'my'>('all');
  const [treasuryColType, setTreasuryColType] = useState<string>('nft');

  const MAX_LTV_MAP: Record<string, number> = {
    alpha: 0.50,
    wbtc: 0.70,
    weth: 0.75
  };

  const ASSET_PRICE_MAP: Record<string, number> = {
    alpha: navPerShareNum && navPerShareNum > 0 ? navPerShareNum : 1.0,
    wbtc: assetPrices?.wbtc && assetPrices.wbtc > 0 ? assetPrices.wbtc : 60000.0,
    weth: assetPrices?.weth && assetPrices.weth > 0 ? assetPrices.weth : 3000.0
  };

  const borrowAmtNum = parseFloat(p2pBorrowAmount || '0') || 0;
  const currentLtv = MAX_LTV_MAP[treasuryColType] || 0.50;
  const currentPrice = ASSET_PRICE_MAP[treasuryColType] || 1.0;
  const requiredUsdBacking = borrowAmtNum > 0 ? borrowAmtNum / currentLtv : 0;
  const rawColTokens = currentPrice > 0 ? requiredUsdBacking / currentPrice : 0;
  const colDecimalsMult = treasuryColType === 'alpha' ? 100 : 10000;
  const autoCalculatedColAmount = rawColTokens > 0 ? (Math.ceil(rawColTokens * colDecimalsMult) / colDecimalsMult).toFixed(treasuryColType === 'alpha' ? 2 : 4) : '0.00';

  const filteredLoans = loansList.filter((loan) => {
    if (filterTab === 'created') return loan.state === 0;
    if (filterTab === 'active') return loan.state === 1;
    if (filterTab === 'my') {
      return (
        (loan.lender || '').toLowerCase() === (userAddress || '').toLowerCase() ||
        (loan.borrower || '').toLowerCase() === (userAddress || '').toLowerCase()
      );
    }
    return true;
  });

  const getStatusBadge = (state: number) => {
    switch (state) {
      case 0:
        return <span className={styles.badgeAvailable}>🟡 Disponible (Oferta)</span>;
      case 1:
        return <span className={styles.badgeActive}>🟢 Activo (Financiado)</span>;
      case 2:
        return <span className={styles.badgeRepaid}>🔵 Reembolsado</span>;
      case 3:
        return <span className={styles.badgeLiquidated}>🔴 Liquidado</span>;
      case 4:
        return <span className={styles.badgeCancelled}>⚪ Cancelado</span>;
      default:
        return null;
    }
  };

  return (
    <div className="acp-container">
      
      {/* Treasury Reserve APY Booster Banner */}
      <div className={`glass-panel ${styles.boosterBanner}`}>
        <div className="acp-banner-flex">
          <div>
            <h4 className={styles.boosterTitle}>
              🏛️ Respaldo Institucional: Préstamos con Reservas de Tesorería (Treasury APY Booster)
            </h4>
            <p className={styles.boosterDesc}>
              Las reservas de la tesorería despliegan su fondo de liquidez en préstamos sobre-colateralizados.
              Puedes solicitar financiación directa a la Tesorería a la <strong>Tasa Fija On-Chain de Tesorería</strong>. Los rendimientos generados retornan <strong>100% a la Tesorería</strong> aumentando el NAV del token ALPHA.
            </p>
          </div>
          <div className="acp-flex-row-gap5">
            <span className={styles.tagGreen}>
              🛡️ Fondo de Reserva Activo
            </span>
            <span className={styles.tagBlue}>
              ⚡ Tasa Fija Tesorería On-Chain
            </span>
          </div>
        </div>
      </div>

      {/* ACTIVE LOANS QUICK REPAYMENT PANEL - show user's created and active loans */}
      {loansList.filter(l => (l.borrower.toLowerCase() === userAddress.toLowerCase() || l.lender.toLowerCase() === userAddress.toLowerCase()) && (l.state === 0 || l.state === 1)).length > 0 && (
        <div className={`glass-panel ${styles.activePanel}`}>
          <h3 className={styles.activeTitle}>
            💳 Mis Préstamos Solicitados & Activos ({loansList.filter(l => (l.borrower.toLowerCase() === userAddress.toLowerCase() || l.lender.toLowerCase() === userAddress.toLowerCase()) && (l.state === 0 || l.state === 1)).length})
          </h3>
          <p className="acp-label-sm margin-bottom-lg">
            Aquí puedes ver claramente todos los préstamos solicitados u ofertas activas y <strong>reembolsarlos o cancelarlos en 1-clic</strong> para gestionar tu custodia.
          </p>

          <div className="met-grid-subtle">
            {loansList.filter(l => (l.borrower.toLowerCase() === userAddress.toLowerCase() || l.lender.toLowerCase() === userAddress.toLowerCase()) && (l.state === 0 || l.state === 1)).map((loan) => (
              <div key={loan.id} className={loan.state === 1 ? styles.activeCardActive : styles.activeCardOffer}>
                <div>
                  <div className="acp-banner-flex margin-bottom-xs">
                    <span className="font-bold text-slate-100 text-sm">Préstamo #{loan.id}</span>
                    {getStatusBadge(loan.state)}
                  </div>
                  <div className="text-cyan font-semibold text-xs">
                    Monto: <strong>${loan.borrowAmount} USDC</strong> @ {loan.interestRateApr}% APR
                  </div>
                  <div className="text-muted text-xs margin-top-xs">
                    Garantía Garantizada: <strong className="text-pink-light">NFT #{loan.positionTokenId} en Custodia</strong>
                  </div>
                  <div className="text-muted-dark text-xs margin-top-xs">
                    Plazo: {loan.durationDays} días • Factor Salud: <strong className="text-green-bright">{loan.healthFactor || '140% (Seguro)'}</strong>
                  </div>
                </div>

                {loan.state === 1 && loan.borrower.toLowerCase() === userAddress.toLowerCase() && onRepayLoanById ? (
                  <button
                    className={`btn-primary ${styles.btnBlueGrad}`}
                    onClick={() => onRepayLoanById(loan.id, loan)}
                  >
                    💳 Reembolsar Deuda (+$ Interest)
                  </button>
                ) : loan.state === 0 && loan.borrower.toLowerCase() === userAddress.toLowerCase() && onCancelLoanOffer ? (
                  <button
                    className="btn-primary acp-pure-warning-card text-red-light border-red-500"
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
      <div className="met-grid-subtle">
        
        {/* Treasury Direct Reserve Loan Card */}
        <div className={`glass-panel ${styles.treasuryCard}`}>
          <div className="acp-flex-row-gap5 margin-bottom-sm">
            <span className="text-md">🏛️</span>
            <h3 className="gcc-metric-subtext-green font-bold text-sm margin-none">Pedir Préstamo a la Tesorería</h3>
          </div>
          <p className="acp-label-sm margin-bottom-lg line-height-normal">
            Accede a la Reserva Líquida de la Tesorería. Desembolso instantáneo en USDC usando tu garantía a la tasa fija acordada on-chain.
          </p>

          <div className="acp-control-stack">
            <div>
              <label className="acp-label-sm">Selecciona Tipo de Garantía Colateral:</label>
              <select
                value={treasuryColType}
                onChange={(e) => setTreasuryColType(e.target.value)}
                className={styles.selectGreen}
              >
                <option value="nft">🖼️ NFT de Posición Bonos ERC-721 (Max LTV On-Chain)</option>
                <option value="alpha">🥩 Token ALPHA Staked (Max LTV On-Chain)</option>
                <option value="wbtc">₿ Wrapped Bitcoin - WBTC (Max LTV On-Chain)</option>
                <option value="weth">Ξ Wrapped Ethereum - WETH (Max LTV On-Chain)</option>
              </select>

              {treasuryColType === 'nft' ? (
                <>
                  <label className="acp-label-sm">NFT Token ID como Garantía:</label>
                  <select
                    data-testid="p2p-treasury-nft-id-input"
                    value={p2pTokenId}
                    onChange={(e) => setP2pTokenId(e.target.value)}
                    className="gcc-input-dark"
                  >
                    <option value="">-- Selecciona un NFT de tu Billetera --</option>
                    {userPositions.filter(p => !p.isRagequitted && !p.isMaturedClaimed).map((pos) => (
                      <option key={pos.id} value={pos.id.toString()}>
                        NFT #{pos.id} (Principal: ${pos.principal} USDC)
                      </option>
                    ))}
                    {userPositions.filter(p => !p.isRagequitted && !p.isMaturedClaimed).length === 0 && (
                      <option value="2">NFT #2 (Posición Activa)</option>
                    )}
                  </select>
                </>
              ) : (
                <div>
                  <label className="acp-label-sm">
                    Garantía Requerida en {treasuryColType.toUpperCase()} (Calculada Automáticamente):
                  </label>
                  <div className={styles.colCalcBox}>
                    ⚡ {autoCalculatedColAmount} {treasuryColType.toUpperCase()} (${requiredUsdBacking.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD Respaldo @ {(currentLtv * 100).toFixed(0)}% LTV)
                  </div>
                </div>
              )}
            </div>

            <div className="admin-grid-2col">
              <div>
                <label className="acp-label-xs">Monto USDC a Solicitar:</label>
                <input
                  data-testid="p2p-treasury-amount-input"
                  type="number"
                  placeholder="ej. 500"
                  value={p2pBorrowAmount}
                  onChange={(e) => setP2pBorrowAmount(e.target.value)}
                  className={styles.inputGreen}
                />
              </div>
              <div>
                <label className="acp-label-xs">Duración (Días):</label>
                <input
                  data-testid="p2p-treasury-duration-input"
                  type="number"
                  value={p2pDays}
                  onChange={(e) => setP2pDays(e.target.value)}
                  className={styles.inputGreen}
                />
              </div>
            </div>

            <button
              data-testid="p2p-treasury-request-btn"
              className={`btn-primary ${styles.btnEmerald}`}
              onClick={() => onBorrowFromTreasury && onBorrowFromTreasury(
                treasuryColType,
                treasuryColType === 'nft'
                  ? (p2pTokenId || userPositions.find(p => !p.isRagequitted && !p.isMaturedClaimed)?.id.toString() || '')
                  : autoCalculatedColAmount,
                p2pBorrowAmount,
                p2pDays
              )}
            >
              🏛️ Solicitar Crédito a la Tesorería ({treasuryColType.toUpperCase()})
            </button>
          </div>
        </div>
        
        {/* Create Loan Offer Card */}
        <div className="glass-panel acp-proposal-card">
          <h3 className="margin-bottom-xs font-bold text-sm">🤝 Publicar Oferta de Préstamo P2P</h3>
          <p className="acp-label-sm margin-bottom-lg">
            Deposita un NFT de Posición como colateral en escrow para solicitar un préstamo. Tu oferta se publicará inmediatamente en el Marketplace.
          </p>

          <div className="acp-control-stack">
            <div>
              <label className="acp-label-sm">NFT Token ID a Colateralizar:</label>
              <select
                data-testid="p2p-offer-nft-id-input"
                value={p2pTokenId}
                onChange={(e) => setP2pTokenId(e.target.value)}
                className="gcc-input-dark"
              >
                <option value="">-- Selecciona un NFT de tu Billetera --</option>
                {userPositions.filter(p => !p.isRagequitted && !p.isMaturedClaimed).map((pos) => (
                  <option key={pos.id} value={pos.id.toString()}>
                    NFT #{pos.id} (Principal: ${pos.principal} USDC — Bloqueo: {pos.lockYears} Años)
                  </option>
                ))}
                {userPositions.filter(p => !p.isRagequitted && !p.isMaturedClaimed).length === 0 && (
                  <option value="1">NFT #1 (Posición Activa)</option>
                )}
              </select>
            </div>

            <div>
              <label className="acp-label-sm">Monto a Pedir Prestado (USDC):</label>
              <input
                data-testid="p2p-offer-amount-input"
                type="number"
                placeholder="ej. 500"
                value={p2pBorrowAmount}
                onChange={(e) => setP2pBorrowAmount(e.target.value)}
                className="gcc-input-dark"
              />
            </div>

            <div className="admin-grid-2col">
              <div>
                <label className="acp-label-xs">Interés (BPS - 1000 = 10%):</label>
                <input
                  data-testid="p2p-offer-interest-input"
                  type="number"
                  value={p2pInterestBps}
                  onChange={(e) => setP2pInterestBps(e.target.value)}
                  className="gcc-input-dark"
                />
              </div>
              <div>
                <label className="acp-label-xs">Duración (Días):</label>
                <input
                  data-testid="p2p-offer-duration-input"
                  type="number"
                  value={p2pDays}
                  onChange={(e) => setP2pDays(e.target.value)}
                  className="gcc-input-dark"
                />
              </div>
            </div>

            <button data-testid="p2p-offer-create-btn" className={`btn-primary ${styles.btnBlueGrad}`} onClick={onCreateLoanOffer}>
              🚀 Crear y Publicar Oferta de Préstamo
            </button>
          </div>
        </div>

        {/* Manual Operation Card */}
        <div className="glass-panel acp-proposal-card">
          <h3 className="margin-bottom-xs font-bold text-sm">⚖️ Gestor Manual por ID</h3>
          <p className="acp-label-sm margin-bottom-lg">
            Financia, reembolsa o liquida préstamos ingresando directamente el ID correspondiente.
          </p>

          <div className="acp-control-stack">
            <div>
              <label className="acp-label-sm">ID Préstamo Objetivo:</label>
              <input
                data-testid="p2p-manual-loan-id-input"
                type="number"
                placeholder="ej. 1"
                value={targetLoanId}
                onChange={(e) => setTargetLoanId(e.target.value)}
                className="gcc-input-dark"
              />
            </div>

            <div>
              <label className="acp-label-sm">Colateral USDC Requerido (130%-150%):</label>
              <input
                type="number"
                placeholder="ej. 700"
                value={loanCollateral}
                onChange={(e) => setLoanCollateral(e.target.value)}
                className="gcc-input-dark"
              />
            </div>

            <div className="admin-grid-2col margin-top-xs">
              <button data-testid="p2p-manual-fund-btn" className="btn-primary stk-btn-green-grad" onClick={onAcceptLoan}>
                ✅ Financiar
              </button>
              <button data-testid="p2p-manual-repay-btn" className="btn-primary stk-btn-indigo-outline" onClick={onRepayLoan}>
                💰 Reembolsar
              </button>
            </div>

            <button data-testid="p2p-autoliquidate-btn" className={`btn-primary ${styles.btnDangerGrad}`} onClick={onLiquidateLoan}>
              ⚡ Auto-Liquidar si HF &lt; 115%
            </button>
          </div>
        </div>
      </div>

      {/* Main P2P Loan Marketplace Table / Cards */}
      <div className="glass-panel acp-proposal-card">
        <div className="acp-banner-flex margin-bottom-lg">
          <div>
            <h3 className="margin-none text-sm font-bold acp-flex-row-gap5">
              📊 Explorador & Marketplace de Préstamos P2P ({filteredLoans.length})
            </h3>
            <p className="acp-label-sm margin-top-xs">
              Todas las ofertas creadas on-chain visibles en tiempo real. Financia préstamos para obtener rendimiento o gestiona tus posiciones.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className={styles.filterBox}>
            <button
              onClick={() => setFilterTab('all')}
              className={`${styles.filterBtn} ${filterTab === 'all' ? styles.filterBtnActiveAll : ''}`}
            >
              Todos ({loansList.length})
            </button>
            <button
              onClick={() => setFilterTab('created')}
              className={`${styles.filterBtn} ${filterTab === 'created' ? styles.filterBtnActiveCreated : ''}`}
            >
              Disponibles ({loansList.filter((l) => l.state === 0).length})
            </button>
            <button
              onClick={() => setFilterTab('active')}
              className={`${styles.filterBtn} ${filterTab === 'active' ? styles.filterBtnActiveActive : ''}`}
            >
              Financiados ({loansList.filter((l) => l.state === 1).length})
            </button>
            <button
              onClick={() => setFilterTab('my')}
              className={`${styles.filterBtn} ${filterTab === 'my' ? styles.filterBtnActiveMy : ''}`}
            >
              Mis Préstamos
            </button>
          </div>
        </div>

        {/* Loan Table */}
        {filteredLoans.length === 0 ? (
          <div className={styles.emptyBox}>
            <p className="margin-none text-sm opacity-60">No hay préstamos P2P disponibles en esta categoría.</p>
            <p className="acp-label-sm margin-top-xs opacity-40">¡Crea una nueva oferta utilizando el formulario superior!</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="gcc-table">
              <thead>
                <tr className="gcc-tr-border text-muted">
                  <th className="met-table-th">ID</th>
                  <th className="met-table-th">Estado</th>
                  <th className="met-table-th">NFT Colateral</th>
                  <th className="met-table-th">Monto Solicitado</th>
                  <th className="met-table-th">Tasa APR</th>
                  <th className="met-table-th">Plazo</th>
                  <th className="met-table-th">Creador / Ofertante</th>
                  <th className="met-table-th">Salud / HF</th>
                  <th className="met-table-th text-right">Acción Directa</th>
                </tr>
              </thead>
              <tbody>
                {filteredLoans.map((loan) => {
                  const isBorrower = loan.borrower.toLowerCase() === userAddress.toLowerCase();
                  const isLender = loan.lender.toLowerCase() === userAddress.toLowerCase();

                  return (
                    <tr key={loan.id} className="gcc-tr-border">
                      <td className="met-table-td-bold">#{loan.id}</td>
                      <td className="met-table-td">{getStatusBadge(loan.state)}</td>
                      <td className="met-table-td">
                        <span className="gcc-badge-indigo">
                          NFT #{loan.positionTokenId}
                        </span>
                      </td>
                      <td className="met-table-td-cyan">
                        ${loan.borrowAmount} USDC
                      </td>
                      <td className="stk-val-green met-table-td">
                        {loan.interestRateApr}% APR
                      </td>
                      <td className="met-table-td">{loan.durationDays} días</td>
                      <td className="met-table-td opacity-80 text-xs">
                        {isBorrower ? (
                          <span className="text-amber-bright font-semibold">Tú (Solicitante)</span>
                        ) : isLender ? (
                          <span className="text-cyan font-semibold">Tú (Prestamista)</span>
                        ) : (
                          `${loan.borrower.slice(0, 6)}...${loan.borrower.slice(-4)}`
                        )}
                      </td>
                      <td className="met-table-td">
                        {loan.state === 1 ? (
                          <span className={`font-semibold ${parseFloat(loan.healthFactor || '0') >= 130 ? 'text-green-bright' : 'stk-burned-label'}`}>
                            {loan.healthFactor}
                          </span>
                        ) : (
                          <span className="opacity-40">-</span>
                        )}
                      </td>
                      <td className="met-table-td text-right">
                        {/* Action Buttons based on Loan State */}
                        {loan.state === 0 && !isBorrower && onAcceptLoanById && (
                          <button
                            className={`btn-primary stk-btn-green-grad ${styles.actionBtnSm}`}
                            onClick={() => onAcceptLoanById(loan.id, loan.borrowAmount)}
                          >
                            ✅ Financiar Oferta
                          </button>
                        )}

                        {loan.state === 0 && isBorrower && onCancelLoanOffer && (
                          <button
                            className={`btn-primary acp-pure-warning-card text-red-light border-red-500 ${styles.actionBtnSm}`}
                            onClick={() => onCancelLoanOffer(loan.id)}
                          >
                            ❌ Cancelar Oferta
                          </button>
                        )}

                        {loan.state === 1 && isBorrower && onRepayLoanById && (
                          <button
                            className={`btn-primary ${styles.btnBlueGrad} ${styles.actionBtnSm}`}
                            onClick={() => onRepayLoanById(loan.id, loan)}
                          >
                            💰 Reembolsar
                          </button>
                        )}

                        {loan.state === 1 && onLiquidateLoanById && (
                          <button
                            className={`btn-primary acp-pure-warning-card text-red-light border-red-500 ${styles.actionBtnSm}`}
                            onClick={() => onLiquidateLoanById(loan.id)}
                          >
                            ⚡ Auto-Liquidar
                          </button>
                        )}

                        {(loan.state === 2 || loan.state === 3 || loan.state === 4) && (
                          <span className="opacity-40 text-xs">Completado</span>
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