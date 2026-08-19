import React, { useState } from 'react';
import styles from './P2PMarketplace.module.css';
import { UI_STRINGS } from '../constants/strings.js';
import { TokenAmountInput } from './common/TokenAmountInput.js';

import type { UserPosition } from './VestedVaults.js';

export interface MarketplaceLoan {
  id: number;
  lender: string;
  borrower: string;
  positionTokenId: number;
  borrowAmount: string;
  collateralAmount: string;
  collateralSymbol?: string;
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
  onLiquidateLoanById?: (loanId: number, loanObj?: any) => void;
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
  const [filterTab, setFilterTab] = useState<'all' | 'created' | 'active' | 'my' | 'history'>('all');
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
      const isMine = (loan.lender || '').toLowerCase() === (userAddress || '').toLowerCase() ||
                     (loan.borrower || '').toLowerCase() === (userAddress || '').toLowerCase();
      return isMine && (loan.state === 0 || loan.state === 1);
    }
    if (filterTab === 'history') return loan.state === 2 || loan.state === 3 || loan.state === 4;
    return true;
  });

  const getStatusBadge = (state: number) => {
    switch (state) {
      case 0:
        return <span className={styles.badgeAvailable}>🟡 {UI_STRINGS.COMMON.STATUS_AVAILABLE} (Oferta)</span>;
      case 1:
        return <span className={styles.badgeActive}>🟢 {UI_STRINGS.COMMON.STATUS_ACTIVE} ({UI_STRINGS.COMMON.STATUS_FUNDED})</span>;
      case 2:
        return <span className={styles.badgeRepaid}>🔵 {UI_STRINGS.COMMON.STATUS_REPAID}</span>;
      case 3:
        return <span className={styles.badgeLiquidated}>🔴 {UI_STRINGS.COMMON.STATUS_LIQUIDATED}</span>;
      case 4:
        return <span className={styles.badgeCancelled}>⚪ {UI_STRINGS.COMMON.STATUS_CANCELLED}</span>;
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
              {UI_STRINGS.P2P_MARKETPLACE.CARD_TREASURY_TITLE}
            </h4>
            <p className={styles.boosterDesc}>
              {UI_STRINGS.P2P_MARKETPLACE.CARD_TREASURY_DESC}
            </p>
          </div>
          <div className="acp-flex-row-gap5">
            <span className={styles.tagGreen}>
              {UI_STRINGS.P2P_MARKETPLACE.TAG_RESERVE_ACTIVE}
            </span>
            <span className={styles.tagBlue}>
              {UI_STRINGS.P2P_MARKETPLACE.TAG_FIXED_RATE}
            </span>
          </div>
        </div>
      </div>

      {/* ACTIVE LOANS QUICK REPAYMENT PANEL - show user's created and active loans */}
      {loansList.filter(l => (l.borrower.toLowerCase() === userAddress.toLowerCase() || l.lender.toLowerCase() === userAddress.toLowerCase()) && (l.state === 0 || l.state === 1)).length > 0 && (
        <div className={`glass-panel ${styles.activePanel}`}>
          <h3 className={styles.activeTitle}>
            {UI_STRINGS.P2P_MARKETPLACE.CARD_ACTIVE_LOANS_TITLE} ({loansList.filter(l => (l.borrower.toLowerCase() === userAddress.toLowerCase() || l.lender.toLowerCase() === userAddress.toLowerCase()) && (l.state === 0 || l.state === 1)).length})
          </h3>
          <p className="acp-label-sm margin-bottom-lg">
            {UI_STRINGS.P2P_MARKETPLACE.CARD_ACTIVE_LOANS_DESC}
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
                    Monto: <strong>${loan.borrowAmount} {UI_STRINGS.COMMON.SYMBOL_USDC}</strong> @ {loan.interestRateApr}% APR
                  </div>
                  <div className="text-muted text-xs margin-top-xs">
                    Garantía Custodiada: <strong className="text-pink-light">{loan.positionTokenId > 0 ? `NFT #${loan.positionTokenId}` : `${loan.collateralAmount} ${loan.collateralSymbol || 'ALPHA'}`}</strong>
                  </div>
                  <div className="text-muted-dark text-xs margin-top-xs">
                    Plazo: {loan.durationDays} días • {loan.state === 1 ? (loan.lender.toLowerCase() === loan.borrower.toLowerCase() ? 'Financiado' : '🏛️ Fondeado por Tesorería') : '🟡 Oferta Disponible'}
                  </div>
                </div>

                {loan.state === 1 && loan.borrower.toLowerCase() === userAddress.toLowerCase() && onRepayLoanById ? (
                  <button
                    className={`btn-primary ${styles.btnBlueGrad}`}
                    onClick={() => onRepayLoanById(loan.id, loan)}
                  >
                    💳 {UI_STRINGS.P2P_MARKETPLACE.BTN_REPAY_LOAN}
                  </button>
                ) : loan.state === 0 && loan.borrower.toLowerCase() === userAddress.toLowerCase() && onCancelLoanOffer ? (
                  <button
                    className="btn-primary acp-pure-warning-card text-red-light border-red-500"
                    onClick={() => onCancelLoanOffer(loan.id)}
                  >
                    ❌ {UI_STRINGS.P2P_MARKETPLACE.BTN_CANCEL_OFFER} #{loan.id}
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
            <h3 className="gcc-metric-subtext-green font-bold text-sm margin-none">{UI_STRINGS.P2P_MARKETPLACE.CARD_TREASURY_TITLE}</h3>
          </div>
          <p className="acp-label-sm margin-bottom-lg line-height-normal">
            {UI_STRINGS.P2P_MARKETPLACE.CARD_TREASURY_DESC}
          </p>

          <div className="acp-control-stack">
            <div>
              <label className="acp-label-sm">{UI_STRINGS.P2P_MARKETPLACE.LABEL_COL_TYPE}</label>
              <select
                value={treasuryColType}
                onChange={(e) => setTreasuryColType(e.target.value)}
                className={styles.selectGreen}
              >
                <option value="nft">🖼️ {UI_STRINGS.P2P_MARKETPLACE.COL_NFT}</option>
                <option value="alpha">🥩 {UI_STRINGS.P2P_MARKETPLACE.COL_ALPHA}</option>
                <option value="wbtc">₿ {UI_STRINGS.P2P_MARKETPLACE.COL_WBTC}</option>
                <option value="weth">Ξ {UI_STRINGS.P2P_MARKETPLACE.COL_WETH}</option>
              </select>

              {treasuryColType === 'nft' ? (
                <>
                  <label className="acp-label-sm">{UI_STRINGS.P2P_MARKETPLACE.LABEL_NFT_SELECT}</label>
                  <select
                    data-testid="p2p-treasury-nft-id-input"
                    value={p2pTokenId}
                    onChange={(e) => setP2pTokenId(e.target.value)}
                    className="gcc-input-dark"
                  >
                    <option value="">{UI_STRINGS.COMMON.SELECT_OPTION_DEFAULT}</option>
                    {userPositions.filter(p => !p.isRagequitted && !p.isMaturedClaimed).map((pos) => (
                      <option key={pos.id} value={pos.id.toString()}>
                        NFT #{pos.id} (Principal: ${pos.principal} {UI_STRINGS.COMMON.SYMBOL_USDC})
                      </option>
                    ))}
                    {userPositions.filter(p => !p.isRagequitted && !p.isMaturedClaimed).length === 0 && (
                      <option value="" disabled>{UI_STRINGS.COMMON.NO_POSITIONS_AVAILABLE}</option>
                    )}
                  </select>
                </>
              ) : (
                <div>
                  <label className="acp-label-sm">
                    {UI_STRINGS.P2P_MARKETPLACE.LABEL_REQ_COL_AMOUNT} ({treasuryColType.toUpperCase()}):
                  </label>
                  <div className={styles.colCalcBox}>
                    ⚡ {autoCalculatedColAmount} {treasuryColType.toUpperCase()} (${requiredUsdBacking.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD Respaldo @ {(currentLtv * 100).toFixed(0)}% LTV)
                  </div>
                </div>
              )}
            </div>

            <div className="admin-grid-2col">
              <div>
                <TokenAmountInput
                  label={UI_STRINGS.P2P_MARKETPLACE.LABEL_BORROW_AMOUNT}
                  testId="p2p-treasury-amount-input"
                  placeholder="ej. 500"
                  value={p2pBorrowAmount}
                  onChange={setP2pBorrowAmount}
                  tokenSymbol={UI_STRINGS.COMMON.SYMBOL_USDC}
                  tokenDecimals={6}
                  showMaxButton={false}
                />
              </div>
              <div>
                <label className="acp-label-xs">{UI_STRINGS.P2P_MARKETPLACE.LABEL_DURATION_DAYS}</label>
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
              {UI_STRINGS.P2P_MARKETPLACE.BTN_BORROW_TREASURY} ({treasuryColType.toUpperCase()})
            </button>
          </div>
        </div>
        
        {/* Create Loan Offer Card */}
        <div className="glass-panel acp-proposal-card">
          <h3 className="margin-bottom-xs font-bold text-sm">{UI_STRINGS.P2P_MARKETPLACE.CARD_OFFER_TITLE}</h3>
          <p className="acp-label-sm margin-bottom-lg">
            {UI_STRINGS.P2P_MARKETPLACE.CARD_OFFER_DESC}
          </p>

          <div className="acp-control-stack">
            <div>
              <label className="acp-label-sm">{UI_STRINGS.P2P_MARKETPLACE.LABEL_OFFER_NFT}</label>
              <select
                data-testid="p2p-offer-nft-id-input"
                value={p2pTokenId}
                onChange={(e) => setP2pTokenId(e.target.value)}
                className="gcc-input-dark"
              >
                <option value="">{UI_STRINGS.COMMON.SELECT_OPTION_DEFAULT}</option>
                {userPositions.filter(p => !p.isRagequitted && !p.isMaturedClaimed).map((pos) => (
                  <option key={pos.id} value={pos.id.toString()}>
                    NFT #{pos.id} (Principal: ${pos.principal} {UI_STRINGS.COMMON.SYMBOL_USDC} — Bloqueo: {pos.lockYears} Años)
                  </option>
                ))}
                {userPositions.filter(p => !p.isRagequitted && !p.isMaturedClaimed).length === 0 && (
                  <option value="" disabled>{UI_STRINGS.COMMON.NO_POSITIONS_AVAILABLE}</option>
                )}
              </select>
            </div>

            <div>
              <TokenAmountInput
                label={UI_STRINGS.P2P_MARKETPLACE.LABEL_OFFER_AMOUNT}
                testId="p2p-offer-amount-input"
                placeholder="ej. 500"
                value={p2pBorrowAmount}
                onChange={setP2pBorrowAmount}
                tokenSymbol={UI_STRINGS.COMMON.SYMBOL_USDC}
                tokenDecimals={6}
                showMaxButton={false}
              />
            </div>

            <div className="admin-grid-2col">
              <div>
                <label className="acp-label-xs">{UI_STRINGS.P2P_MARKETPLACE.LABEL_OFFER_INTEREST}</label>
                <input
                  data-testid="p2p-offer-interest-input"
                  type="number"
                  value={p2pInterestBps}
                  onChange={(e) => setP2pInterestBps(e.target.value)}
                  className="gcc-input-dark"
                />
              </div>
              <div>
                <label className="acp-label-xs">{UI_STRINGS.P2P_MARKETPLACE.LABEL_OFFER_DURATION}</label>
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
              {UI_STRINGS.P2P_MARKETPLACE.BTN_CREATE_OFFER}
            </button>
          </div>
        </div>

        {/* Manual Operation Card */}
        <div className="glass-panel acp-proposal-card">
          <h3 className="margin-bottom-xs font-bold text-sm">{UI_STRINGS.P2P_MARKETPLACE.LABEL_MANUAL_MANAGER}</h3>
          <p className="acp-label-sm margin-bottom-lg">
            {UI_STRINGS.P2P_MARKETPLACE.DESC_MANUAL_MANAGER}
          </p>

          <div className="acp-control-stack">
            <div>
              <label className="acp-label-sm">{UI_STRINGS.P2P_MARKETPLACE.LABEL_TARGET_LOAN_ID}</label>
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
              <label className="acp-label-sm">{UI_STRINGS.P2P_MARKETPLACE.LABEL_REQ_COL_PERCENT}</label>
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
                {UI_STRINGS.P2P_MARKETPLACE.BTN_FUND_LOAN}
              </button>
              <button data-testid="p2p-manual-repay-btn" className="btn-primary stk-btn-indigo-outline" onClick={onRepayLoan}>
                {UI_STRINGS.P2P_MARKETPLACE.BTN_REPAY_LOAN}
              </button>
            </div>

            <button data-testid="p2p-autoliquidate-btn" className={`btn-primary ${styles.btnDangerGrad}`} onClick={onLiquidateLoan}>
              {UI_STRINGS.P2P_MARKETPLACE.BTN_LIQUIDATE_LOAN} (HF &lt; 115%)
            </button>
          </div>
        </div>
      </div>

      {/* Main P2P Loan Marketplace Table / Cards */}
      <div className="glass-panel acp-proposal-card">
        <div className="acp-banner-flex margin-bottom-lg">
          <div>
            <h3 className="margin-none text-sm font-bold acp-flex-row-gap5">
              {UI_STRINGS.P2P_MARKETPLACE.TABLE_MARKET_TITLE} ({filteredLoans.length})
            </h3>
            <p className="acp-label-sm margin-top-xs">
              {UI_STRINGS.P2P_MARKETPLACE.SUBTITLE}
            </p>
          </div>

          {/* Filter Tabs */}
          <div className={styles.filterBox}>
            <button
              onClick={() => setFilterTab('all')}
              className={`${styles.filterBtn} ${filterTab === 'all' ? styles.filterBtnActiveAll : ''}`}
            >
              {UI_STRINGS.P2P_MARKETPLACE.TAB_ALL_OFFERS} ({loansList.length})
            </button>
            <button
              onClick={() => setFilterTab('created')}
              className={`${styles.filterBtn} ${filterTab === 'created' ? styles.filterBtnActiveCreated : ''}`}
            >
              {UI_STRINGS.P2P_MARKETPLACE.TAB_AVAILABLE} ({loansList.filter((l) => l.state === 0).length})
            </button>
            <button
              onClick={() => setFilterTab('active')}
              className={`${styles.filterBtn} ${filterTab === 'active' ? styles.filterBtnActiveActive : ''}`}
            >
              {UI_STRINGS.P2P_MARKETPLACE.TAB_FUNDED} ({loansList.filter((l) => l.state === 1).length})
            </button>
            <button
              onClick={() => setFilterTab('my')}
              className={`${styles.filterBtn} ${filterTab === 'my' ? styles.filterBtnActiveMy : ''}`}
            >
              {UI_STRINGS.P2P_MARKETPLACE.TAB_MY_LOANS} ({loansList.filter((l) => ((l.lender || '').toLowerCase() === (userAddress || '').toLowerCase() || (l.borrower || '').toLowerCase() === (userAddress || '').toLowerCase()) && (l.state === 0 || l.state === 1)).length})
            </button>
            <button
              onClick={() => setFilterTab('history')}
              className={`${styles.filterBtn} ${filterTab === 'history' ? styles.filterBtnActiveMy : ''}`}
            >
              📜 Historial ({loansList.filter((l) => l.state === 2 || l.state === 3 || l.state === 4).length})
            </button>
          </div>
        </div>

        {/* Loan Table */}
        {filteredLoans.length === 0 ? (
          <div className={styles.emptyBox}>
            <p className="margin-none text-sm opacity-60">{UI_STRINGS.P2P_MARKETPLACE.TABLE_MARKET_EMPTY}</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="gcc-table">
              <thead>
                <tr className="gcc-tr-border text-muted">
                  <th className="met-table-th">{UI_STRINGS.P2P_MARKETPLACE.TH_LOAN_ID}</th>
                  <th className="met-table-th">Estado</th>
                  <th className="met-table-th">{UI_STRINGS.P2P_MARKETPLACE.TH_COLLATERAL}</th>
                  <th className="met-table-th">{UI_STRINGS.P2P_MARKETPLACE.TH_AMOUNT}</th>
                  <th className="met-table-th">{UI_STRINGS.P2P_MARKETPLACE.TH_APR}</th>
                  <th className="met-table-th">{UI_STRINGS.P2P_MARKETPLACE.TH_DURATION}</th>
                  <th className="met-table-th">{UI_STRINGS.P2P_MARKETPLACE.TH_BORROWER}</th>
                  <th className="met-table-th">{UI_STRINGS.P2P_MARKETPLACE.TH_HEALTH}</th>
                  <th className="met-table-th text-right">{UI_STRINGS.P2P_MARKETPLACE.TH_ACTIONS}</th>
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
                        {loan.positionTokenId > 0 ? (
                          <span className="gcc-badge-indigo">
                            NFT #{loan.positionTokenId}
                          </span>
                        ) : loan.collateralSymbol === 'WBTC' ? (
                          <span className="gcc-badge-amber">
                            ₿ {loan.collateralAmount} WBTC
                          </span>
                        ) : loan.collateralSymbol === 'WETH' ? (
                          <span className="gcc-badge-indigo">
                            Ξ {loan.collateralAmount} WETH
                          </span>
                        ) : (
                          <span className="gcc-badge-cyan">
                            🥩 {loan.collateralAmount} ALPHA
                          </span>
                        )}
                      </td>
                      <td className="met-table-td-cyan">
                        ${loan.borrowAmount} {UI_STRINGS.COMMON.SYMBOL_USDC}
                      </td>
                      <td className="stk-val-green met-table-td">
                        {loan.interestRateApr}% APR
                      </td>
                      <td className="met-table-td">{loan.durationDays} días</td>
                      <td className="met-table-td opacity-80 text-xs">
                        {isBorrower ? (
                          <span className="text-amber-bright font-semibold">Tú ({loan.state === 1 ? 'Prestatario' : 'Solicitante'})</span>
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
                            {UI_STRINGS.P2P_MARKETPLACE.BTN_FUND_LOAN}
                          </button>
                        )}

                        {loan.state === 0 && isBorrower && onCancelLoanOffer && (
                          <button
                            className={`btn-primary acp-pure-warning-card text-red-light border-red-500 ${styles.actionBtnSm}`}
                            onClick={() => onCancelLoanOffer(loan.id)}
                          >
                            {UI_STRINGS.P2P_MARKETPLACE.BTN_CANCEL_OFFER}
                          </button>
                        )}

                        {loan.state === 1 && isBorrower && onRepayLoanById && (
                          <button
                            className={`btn-primary ${styles.btnBlueGrad} ${styles.actionBtnSm}`}
                            onClick={() => onRepayLoanById(loan.id, loan)}
                          >
                            {UI_STRINGS.P2P_MARKETPLACE.BTN_REPAY_LOAN}
                          </button>
                        )}

                        {loan.state === 1 && onLiquidateLoanById && (
                          parseFloat(loan.healthFactor?.replace('%', '') || '1000') < 115 ? (
                            <button
                              className={`btn-primary acp-pure-warning-card text-red-light border-red-500 ${styles.actionBtnSm}`}
                              onClick={() => onLiquidateLoanById(loan.id, loan)}
                            >
                              ⚡ {UI_STRINGS.P2P_MARKETPLACE.BTN_LIQUIDATE_LOAN}
                            </button>
                          ) : (
                            <button
                              className={`btn-primary opacity-60 cursor-not-allowed ${styles.actionBtnSm}`}
                              title="Préstamo solvente (HF ≥ 115%). Solo liquidable si cae por debajo del 115% o si vence el plazo."
                              onClick={() => onLiquidateLoanById(loan.id, loan)}
                            >
                              🛡️ Solvente
                            </button>
                          )
                        )}

                        {loan.state === 2 && (
                          <span className="text-cyan text-xs font-semibold">🔵 Reembolsado</span>
                        )}
                        {loan.state === 3 && (
                          <span className="text-red-light text-xs font-semibold">🔴 Liquidado</span>
                        )}
                        {loan.state === 4 && (
                          <span className="opacity-40 text-xs">⚪ Cancelado</span>
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