import React from 'react';
import styles from './TreasuryDashboard.module.css';
import { UI_STRINGS } from '../constants/strings.js';
import { TokenAmountInput } from './common/TokenAmountInput.js';

interface TreasuryDashboardProps {
  porAssets?: string;
  porLiabilities?: string;
  porRatio?: string;
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
  porAssets: _porAssets = '100,000.00',
  porLiabilities: _porLiabilities = '100,000.00',
  porRatio: _porRatio = '100.00%',
  porBreakdown = { stables: 50000, wbtc: 25000, weth: 15000, alphaStaking: 10000 },
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
  const totalLentUsd = loansList.filter((l: any) => l.active).reduce((acc: number, curr: any) => acc + (parseFloat(curr.amount) || 0), 0);

  return (
    <div className="tab-content-container">
      {/* Top Banner Hero */}
      <div className="glass-panel text-center hero-banner-pad margin-bottom-lg">
        <h2 className={styles.heroH2}>
          {UI_STRINGS.TREASURY.TITLE}
        </h2>
        <p className={styles.heroP}>
          {UI_STRINGS.TREASURY.SUBTITLE}
        </p>
      </div>

      {/* Main Operations Card */}
      <div className="glass-panel padding-lg margin-bottom-lg">
        <div className="acp-banner-flex margin-bottom-md">
          <h3 className={styles.vaultH3}>
            {UI_STRINGS.TREASURY.CARD_DEPOSIT_TITLE}
          </h3>
          <button
            data-testid="treasury-faucet-btn"
            onClick={onFaucetUSDC}
            className={`btn-primary ${styles.faucetBtn}`}
          >
            {UI_STRINGS.TREASURY.BTN_FAUCET}
          </button>
        </div>

        <div>
          {/* User Balances Summary Cards */}
          <div className="admin-grid-2col margin-bottom-md">
            <div className={styles.cardBox}>
              <div className={styles.cardTitle}>MI BALANCE DISPONIBLE</div>
              <div data-testid="treasury-usdc-balance" className={styles.cardValGreen}>{usdcBalance} {UI_STRINGS.COMMON.SYMBOL_USDC}</div>
            </div>
            <div className={styles.cardBox}>
              <div className={styles.cardTitle}>MIS {UI_STRINGS.COMMON.SYMBOL_ALPHA} SHARES</div>
              <div data-testid="treasury-shares-balance" className={styles.cardValPurple}>{sharesBalance} {UI_STRINGS.COMMON.SYMBOL_ALPHA}</div>
            </div>
          </div>

          {/* Actions Forms */}
          <div className="admin-grid-2col">
            <div className={styles.actionBox}>
              <TokenAmountInput
                label={`💳 ${UI_STRINGS.TREASURY.INPUT_DEPOSIT_LABEL}`}
                testId="treasury-deposit-input"
                placeholder={UI_STRINGS.TREASURY.INPUT_DEPOSIT_PLACEHOLDER}
                value={depositAmount}
                onChange={setDepositAmount}
                tokenSymbol={UI_STRINGS.COMMON.SYMBOL_USDC}
                tokenDecimals={6}
                maxBalance={usdcBalance}
              />
              <button data-testid="treasury-deposit-btn" className={`btn-primary ${styles.depositBtn} margin-top-xs`} onClick={onDeposit}>
                {UI_STRINGS.COMMON.BTN_CONFIRM}
              </button>
            </div>

            <div className={styles.actionBox}>
              <TokenAmountInput
                label={`🔥 ${UI_STRINGS.TREASURY.INPUT_REDEEM_LABEL}`}
                testId="treasury-redeem-input"
                placeholder={UI_STRINGS.TREASURY.INPUT_REDEEM_PLACEHOLDER}
                value={redeemAmount}
                onChange={setRedeemAmount}
                tokenSymbol={UI_STRINGS.COMMON.SYMBOL_ALPHA}
                tokenDecimals={18}
                maxBalance={sharesBalance}
              />
              <button data-testid="treasury-redeem-btn" className={`btn-primary ${styles.redeemBtn} margin-top-xs`} onClick={onRedeem}>
                {UI_STRINGS.COMMON.BTN_CONFIRM}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sección Admin: Solo 3 Estrategias Exógenas */}
      {isAdmin && (() => {
        const p2pAllocationUsd = totalLentUsd;
        const morphoAllocationUsd = Math.max(0, porBreakdown.stables - p2pAllocationUsd);
        const btcAllocationUsd = porBreakdown.wbtc;
        const ethAllocationUsd = porBreakdown.weth;

        return (
        <div className="admin-strategy-panel margin-top-xl">
          <div className="acp-banner-flex margin-bottom-lg">
            <div>
              <h3 className={styles.adminH3}>
                {UI_STRINGS.METRICS.TABLE_ASSETS_TITLE}
              </h3>
            </div>
            <button
              className={`btn-primary ${styles.harvestBtn}`}
              onClick={onAuditPoR}
            >
              🌾 Cosechar Rendimiento Diario (Morpho Harvest)
            </button>
          </div>

          <div className="strategy-grid">
            {/* Stablecoins Strategy Box */}
            <div className="strategy-card">
              <div className="acp-banner-flex margin-bottom-sm">
                <span className="font-bold text-sm text-green-bright">💵 Stablecoins (USDC / USDT)</span>
                <span className={styles.tagGreen}>Real Yield Active</span>
              </div>
              <div className={styles.stratList}>
                <div className="acp-banner-flex">
                  <span>• Créditos Directos / P2P:</span>
                  <strong>${p2pAllocationUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong>
                </div>
                <div className="acp-banner-flex">
                  <span>• Bóvedas Morpho Blue:</span>
                  <strong>${morphoAllocationUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong>
                </div>
              </div>
            </div>

            {/* Bitcoin Strategy Box */}
            <div className="strategy-card">
              <div className="acp-banner-flex margin-bottom-sm">
                <span className="font-bold text-sm gcc-td-amber">₿ Bitcoin (WBTC / cbBTC)</span>
                <span className={styles.tagAmber}>Babylon & Morpho</span>
              </div>
              <div className={styles.stratList}>
                <div className="acp-banner-flex">
                  <span>• Reserva On-Chain Auditada:</span>
                  <strong>${btcAllocationUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (WBTC)</strong>
                </div>
              </div>
            </div>

            {/* Ethereum Strategy Box */}
            <div className="strategy-card">
              <div className="acp-banner-flex margin-bottom-sm">
                <span className="font-bold text-sm stk-val-purple">Ξ Ethereum (WETH / stETH)</span>
                <span className={styles.tagPurple}>Staking & Vaults</span>
              </div>
              <div className={styles.stratList}>
                <div className="acp-banner-flex">
                  <span>• Reserva On-Chain Auditada:</span>
                  <strong>${ethAllocationUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (WETH)</strong>
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