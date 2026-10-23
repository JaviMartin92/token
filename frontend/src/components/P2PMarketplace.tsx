import React, { useState } from 'react';
import styles from './P2PMarketplace.module.css';
import { UI_STRINGS } from '../constants/strings.js';
import { Card, Badge, Button, DataTable, TokenAmountInput } from './common/index.js';
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
  const autoCalculatedColAmount = rawColTokens > 0 ? (Math.ceil(rawColTokens * 10000) / 10000).toString() : '0';

  const filteredLoans = loansList.filter((loan) => {
    if (filterTab === 'created') return loan.state === 0;
    if (filterTab === 'active') return loan.state === 1;
    if (filterTab === 'my') {
      const isBorrower = (loan.borrower || '').toLowerCase() === (userAddress || '').toLowerCase();
      const isLender = (loan.lender || '').toLowerCase() === (userAddress || '').toLowerCase();
      return (isBorrower || isLender) && (loan.state === 0 || loan.state === 1);
    }
    if (filterTab === 'history') return loan.state === 2 || loan.state === 3 || loan.state === 4;
    return true;
  });

  const getStatusBadge = (state: number) => {
    switch (state) {
      case 0:
        return <Badge variant="amber" size="sm">Disponible</Badge>;
      case 1:
        return <Badge variant="emerald" size="sm">Activo</Badge>;
      case 2:
        return <Badge variant="blue" size="sm">Reembolsado</Badge>;
      case 3:
        return <Badge variant="crimson" size="sm">Liquidado</Badge>;
      case 4:
        return <Badge variant="neutral" size="sm">Cancelado</Badge>;
      default:
        return <Badge variant="neutral" size="sm">Desconocido</Badge>;
    }
  };

  const tableHeaders = [
    UI_STRINGS.P2P_MARKETPLACE.TH_LOAN_ID,
    'Estado',
    UI_STRINGS.P2P_MARKETPLACE.TH_COLLATERAL,
    UI_STRINGS.P2P_MARKETPLACE.TH_AMOUNT,
    UI_STRINGS.P2P_MARKETPLACE.TH_APR,
    UI_STRINGS.P2P_MARKETPLACE.TH_DURATION,
    UI_STRINGS.P2P_MARKETPLACE.TH_BORROWER,
    UI_STRINGS.P2P_MARKETPLACE.TH_HEALTH,
    UI_STRINGS.P2P_MARKETPLACE.TH_ACTIONS
  ];

  return (
    <div className={styles.container}>
      {/* 💎 Banner de Aceleración de Rendimiento */}
      <div className={styles.boosterBanner}>
        <div className={styles.boosterInfo}>
          <h3 className={styles.boosterTitle}>
            <span>⚡</span>
            <span>{UI_STRINGS.P2P_MARKETPLACE.TITLE}</span>
          </h3>
          <p className={styles.boosterDesc}>
            {UI_STRINGS.P2P_MARKETPLACE.SUBTITLE}
          </p>
        </div>
        <div className={styles.boosterTags}>
          <Badge variant="emerald" size="md">
            Morpho Blue: 80% LTV
          </Badge>
          <Badge variant="blue" size="md">
            P2P Escrow: Real Yield
          </Badge>
        </div>
      </div>

      {/* ⚡ Operaciones: 3 Columnas Institucionales */}
      <div className={styles.operationsGrid}>
        {/* Operación 1: Préstamo Directo de Tesorería */}
        <Card
          variant="surface"
          collapsible
          defaultExpanded={false}
          headerTitle={UI_STRINGS.P2P_MARKETPLACE.CARD_TREASURY_TITLE}
          headerSubtitle={UI_STRINGS.P2P_MARKETPLACE.CARD_TREASURY_DESC}
        >
          <div className={styles.opStack}>
            <div className={styles.fieldGroup}>
              <label htmlFor="treasury-col-type" className={styles.label}>
                {UI_STRINGS.P2P_MARKETPLACE.LABEL_COL_TYPE}
              </label>
              <select
                id="treasury-col-type"
                value={treasuryColType}
                onChange={(e) => setTreasuryColType(e.target.value)}
                className={styles.select}
              >
                <option value="nft">🎫 {UI_STRINGS.P2P_MARKETPLACE.COL_NFT}</option>
                <option value="alpha">🥩 {UI_STRINGS.P2P_MARKETPLACE.COL_ALPHA}</option>
                <option value="wbtc">🪙 {UI_STRINGS.P2P_MARKETPLACE.COL_WBTC}</option>
                <option value="weth">🔷 {UI_STRINGS.P2P_MARKETPLACE.COL_WETH}</option>
              </select>

              {treasuryColType === 'nft' ? (
                <>
                  <label htmlFor="p2p-treasury-nft-id-input" className={styles.label}>
                    {UI_STRINGS.P2P_MARKETPLACE.LABEL_NFT_SELECT}
                  </label>
                  <select
                    id="p2p-treasury-nft-id-input"
                    data-testid="p2p-treasury-nft-id-input"
                    value={p2pTokenId}
                    onChange={(e) => setP2pTokenId(e.target.value)}
                    className={styles.select}
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
                <div className={styles.colCalcBox}>
                  ⚡ {autoCalculatedColAmount} {treasuryColType.toUpperCase()} (${requiredUsdBacking.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD Respaldo @ {(currentLtv * 100).toFixed(0)}% LTV)
                </div>
              )}
            </div>

            <div className={styles.twoColRow}>
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
              <div className={styles.fieldGroup}>
                <label htmlFor="p2p-treasury-duration-input" className={styles.label}>
                  {UI_STRINGS.P2P_MARKETPLACE.LABEL_DURATION_DAYS}
                </label>
                <input
                  id="p2p-treasury-duration-input"
                  data-testid="p2p-treasury-duration-input"
                  type="number"
                  value={p2pDays}
                  onChange={(e) => setP2pDays(e.target.value)}
                  className={styles.input}
                />
              </div>
            </div>

            <Button
              data-testid="p2p-treasury-request-btn"
              variant="emerald"
              size="md"
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
            </Button>
          </div>
        </Card>

        {/* Operación 2: Crear Oferta de Préstamo P2P */}
        <Card
          variant="surface"
          collapsible
          defaultExpanded={false}
          headerTitle={UI_STRINGS.P2P_MARKETPLACE.CARD_OFFER_TITLE}
          headerSubtitle={UI_STRINGS.P2P_MARKETPLACE.CARD_OFFER_DESC}
        >
          <div className={styles.opStack}>
            <div className={styles.fieldGroup}>
              <label htmlFor="p2p-offer-nft-id-input" className={styles.label}>
                {UI_STRINGS.P2P_MARKETPLACE.LABEL_OFFER_NFT}
              </label>
              <select
                id="p2p-offer-nft-id-input"
                data-testid="p2p-offer-nft-id-input"
                value={p2pTokenId}
                onChange={(e) => setP2pTokenId(e.target.value)}
                className={styles.select}
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

            <div className={styles.twoColRow}>
              <div className={styles.fieldGroup}>
                <label htmlFor="p2p-offer-interest-input" className={styles.label}>
                  {UI_STRINGS.P2P_MARKETPLACE.LABEL_OFFER_INTEREST}
                </label>
                <input
                  id="p2p-offer-interest-input"
                  data-testid="p2p-offer-interest-input"
                  type="number"
                  value={p2pInterestBps}
                  onChange={(e) => setP2pInterestBps(e.target.value)}
                  className={styles.input}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="p2p-offer-duration-input" className={styles.label}>
                  {UI_STRINGS.P2P_MARKETPLACE.LABEL_OFFER_DURATION}
                </label>
                <input
                  id="p2p-offer-duration-input"
                  data-testid="p2p-offer-duration-input"
                  type="number"
                  value={p2pDays}
                  onChange={(e) => setP2pDays(e.target.value)}
                  className={styles.input}
                />
              </div>
            </div>

            <Button
              data-testid="p2p-offer-create-btn"
              variant="primary"
              size="md"
              onClick={onCreateLoanOffer}
            >
              {UI_STRINGS.P2P_MARKETPLACE.BTN_CREATE_OFFER}
            </Button>
          </div>
        </Card>

        {/* Operación 3: Gestor Manual de Préstamos */}
        <Card
          variant="surface"
          collapsible
          defaultExpanded={false}
          headerTitle={UI_STRINGS.P2P_MARKETPLACE.LABEL_MANUAL_MANAGER}
          headerSubtitle={UI_STRINGS.P2P_MARKETPLACE.DESC_MANUAL_MANAGER}
        >
          <div className={styles.opStack}>
            <div className={styles.fieldGroup}>
              <label htmlFor="p2p-manual-loan-id-input" className={styles.label}>
                {UI_STRINGS.P2P_MARKETPLACE.LABEL_TARGET_LOAN_ID}
              </label>
              <input
                id="p2p-manual-loan-id-input"
                data-testid="p2p-manual-loan-id-input"
                type="number"
                placeholder="ej. 1"
                value={targetLoanId}
                onChange={(e) => setTargetLoanId(e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="loan-collateral-input" className={styles.label}>
                {UI_STRINGS.P2P_MARKETPLACE.LABEL_REQ_COL_PERCENT}
              </label>
              <input
                id="loan-collateral-input"
                type="number"
                placeholder="ej. 700"
                value={loanCollateral}
                onChange={(e) => setLoanCollateral(e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.twoColRow}>
              <Button
                data-testid="p2p-manual-fund-btn"
                variant="emerald"
                size="md"
                onClick={onAcceptLoan}
              >
                {UI_STRINGS.P2P_MARKETPLACE.BTN_FUND_LOAN}
              </Button>
              <Button
                data-testid="p2p-manual-repay-btn"
                variant="outline"
                size="md"
                onClick={onRepayLoan}
              >
                {UI_STRINGS.P2P_MARKETPLACE.BTN_REPAY_LOAN}
              </Button>
            </div>

            <Button
              data-testid="p2p-autoliquidate-btn"
              variant="danger"
              size="md"
              onClick={onLiquidateLoan}
            >
              {UI_STRINGS.P2P_MARKETPLACE.BTN_LIQUIDATE_LOAN} (HF &lt; 115%)
            </Button>
          </div>
        </Card>
      </div>

      {/* 📋 Tabla de Listados del Mercado P2P */}
      <Card
        variant="surface"
        collapsible
        defaultExpanded={false}
        headerTitle={`${UI_STRINGS.P2P_MARKETPLACE.TABLE_MARKET_TITLE} (${filteredLoans.length})`}
        headerSubtitle={UI_STRINGS.P2P_MARKETPLACE.SUBTITLE}
        headerAction={
          <Badge variant="blue" size="sm">
            {filteredLoans.length} {filteredLoans.length === 1 ? 'oferta' : 'ofertas'}
          </Badge>
        }
      >
        {/* 🧭 Filtros de Estado del Mercado P2P (Full Responsive 100% Ancho) */}
        <div className={styles.filterContainer}>
          <div className={styles.filterBox}>
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`${styles.filterBtn} ${filterTab === 'all' ? styles.filterBtnActive : ''}`}
            >
              Todas ({loansList.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('created')}
              className={`${styles.filterBtn} ${filterTab === 'created' ? styles.filterBtnActive : ''}`}
            >
              Disponibles ({loansList.filter((l) => l.state === 0).length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('active')}
              className={`${styles.filterBtn} ${filterTab === 'active' ? styles.filterBtnActive : ''}`}
            >
              Financiados ({loansList.filter((l) => l.state === 1).length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('my')}
              className={`${styles.filterBtn} ${filterTab === 'my' ? styles.filterBtnActive : ''}`}
            >
              Mis Préstamos ({loansList.filter((l) => ((l.lender || '').toLowerCase() === (userAddress || '').toLowerCase() || (l.borrower || '').toLowerCase() === (userAddress || '').toLowerCase()) && (l.state === 0 || l.state === 1)).length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('history')}
              className={`${styles.filterBtn} ${filterTab === 'history' ? styles.filterBtnActive : ''}`}
            >
              📜 Historial ({loansList.filter((l) => l.state === 2 || l.state === 3 || l.state === 4).length})
            </button>
          </div>
        </div>

        <DataTable
          headers={tableHeaders}
          emptyState={UI_STRINGS.P2P_MARKETPLACE.TABLE_MARKET_EMPTY}
          minWidth="100%"
        >
          {filteredLoans.map((loan) => {
            const isBorrower = loan.borrower.toLowerCase() === userAddress.toLowerCase();
            const isLender = loan.lender.toLowerCase() === userAddress.toLowerCase();

            return (
              <tr key={loan.id}>
                <td data-label="ID Préstamo" className={styles.tableBold}>#{loan.id}</td>
                <td data-label="Estado">{getStatusBadge(loan.state)}</td>
                <td data-label="Colateral">
                  {loan.positionTokenId > 0 ? (
                    <Badge variant="purple" size="sm">NFT #{loan.positionTokenId}</Badge>
                  ) : loan.collateralSymbol === 'USDC' ? (
                    <Badge variant="blue" size="sm">💵 ${loan.collateralAmount} USDC</Badge>
                  ) : loan.collateralSymbol === 'WBTC' ? (
                    <Badge variant="amber" size="sm">🪙 {loan.collateralAmount} WBTC</Badge>
                  ) : loan.collateralSymbol === 'WETH' ? (
                    <Badge variant="blue" size="sm">🔷 {loan.collateralAmount} WETH</Badge>
                  ) : (
                    <Badge variant="emerald" size="sm">🥩 {loan.collateralAmount} ALPHA</Badge>
                  )}
                </td>
                <td data-label="Monto" className={styles.tableBold}>
                  ${loan.borrowAmount} {UI_STRINGS.COMMON.SYMBOL_USDC}
                </td>
                <td data-label="Tasa APR" style={{ color: 'var(--color-emerald-light)', fontWeight: 700 }}>
                  {loan.interestRateApr}% APR
                </td>
                <td data-label="Plazo">{loan.durationDays} días</td>
                <td data-label="Prestatario" className={styles.tableMuted}>
                  {isBorrower ? (
                    <span style={{ color: 'var(--color-amber-light)', fontWeight: 600 }}>
                      Tú ({loan.state === 1 ? 'Prestatario' : 'Solicitante'})
                    </span>
                  ) : isLender ? (
                    <span style={{ color: 'var(--color-blue-light)', fontWeight: 600 }}>
                      Tú (Prestamista)
                    </span>
                  ) : (
                    `${loan.borrower.slice(0, 6)}...${loan.borrower.slice(-4)}`
                  )}
                </td>
                <td data-label="Health Factor">
                  {loan.state === 1 ? (
                    <span style={{
                      fontWeight: 700,
                      color: parseFloat(loan.healthFactor || '0') >= 130 ? 'var(--color-emerald-light)' : 'var(--color-crimson-light)'
                    }}>
                      {loan.healthFactor}
                    </span>
                  ) : (
                    <span className={styles.tableMuted}>-</span>
                  )}
                </td>
                <td data-label="Acciones" className={styles.actionsTd}>
                  <div className={styles.actionsCell}>
                    {loan.state === 0 && !isBorrower && onAcceptLoanById && (
                      <Button
                        variant="emerald"
                        size="sm"
                        onClick={() => onAcceptLoanById(loan.id, loan.borrowAmount)}
                      >
                        {UI_STRINGS.P2P_MARKETPLACE.BTN_FUND_LOAN}
                      </Button>
                    )}

                    {loan.state === 0 && isBorrower && onCancelLoanOffer && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onCancelLoanOffer(loan.id)}
                      >
                        {UI_STRINGS.P2P_MARKETPLACE.BTN_CANCEL_OFFER}
                      </Button>
                    )}

                    {loan.state === 1 && isBorrower && onRepayLoanById && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onRepayLoanById(loan.id, loan)}
                      >
                        {UI_STRINGS.P2P_MARKETPLACE.BTN_REPAY_LOAN}
                      </Button>
                    )}

                    {loan.state === 1 && onLiquidateLoanById && (
                      parseFloat(loan.healthFactor?.replace('%', '') || '1000') < 115 ? (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => onLiquidateLoanById(loan.id, loan)}
                        >
                          ⚡ {UI_STRINGS.P2P_MARKETPLACE.BTN_LIQUIDATE_LOAN}
                        </Button>
                      ) : (
                        <Badge variant="emerald" size="sm">🛡️ Solvente</Badge>
                      )
                    )}

                    {loan.state === 2 && (
                      <Badge variant="blue" size="sm">🔵 Reembolsado</Badge>
                    )}
                    {loan.state === 3 && (
                      <Badge variant="crimson" size="sm">🔴 Liquidado</Badge>
                    )}
                    {loan.state === 4 && (
                      <Badge variant="neutral" size="sm">⚪ Cancelado</Badge>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </Card>
    </div>
  );
};
