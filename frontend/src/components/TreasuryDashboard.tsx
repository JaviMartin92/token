import React from 'react';
import styles from './TreasuryDashboard.module.css';

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
  porBreakdown = { stables: 0, wbtc: 0, weth: 0, alphaStaking: 0 },
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
  const totalLentUsd = porBreakdown.alphaStaking || (loansList.length ? 0 : 0);

  return (
    <div className={`treasury-main-container ${styles.container}`}>
      <div className="glass-panel treasury-shares-panel acp-flex-1">
        <div>
          <div className="acp-banner-flex margin-bottom-lg gcc-tr-border text-muted">
            <div>
              <h3 className={styles.headerH3}>🏛️ Emisión y Rescate de ALPHA Shares (NAV)</h3>
              <p className={styles.headerSub}>
                Opera directamente contra las reservas del protocolo a NAV (Net Asset Value).
              </p>
            </div>
            <div className="acp-flex-row-gap5">
              <button data-testid="por-audit-btn" className={`btn-secondary ${styles.btnAudit}`} onClick={onAuditPoR}>
                🔄 Auditar PoR
              </button>
              <button data-testid="treasury-faucet-btn" className={`btn-secondary ${styles.btnFaucet}`} onClick={onFaucetUSDC}>
                🚰 Faucet 10k USDC
              </button>
            </div>
          </div>

          {/* User Balances */}
          <div className="treasury-shares-grid margin-bottom-lg">
            <div className={`treasury-shares-card-usdc ${styles.cardUsdc}`}>
              <div className={styles.cardTitle}>SALDO USDC DISPONIBLE</div>
              <div data-testid="treasury-usdc-balance" className={styles.cardValGreen}>{usdcBalance} USDC</div>
            </div>
            <div className={`treasury-shares-card-shares ${styles.cardShares}`}>
              <div className={styles.cardTitle}>MIS ALPHA SHARES</div>
              <div data-testid="treasury-shares-balance" className={styles.cardValPurple}>{sharesBalance} ALPHA</div>
            </div>
          </div>

          {/* Actions Forms */}
          <div className="admin-grid-2col">
            <div className={styles.actionBox}>
              <label className={styles.actionLabel}>
                💳 Depositar USDC para Acuñar Shares:
              </label>
              <div className="acp-flex-row-gap5">
                <input
                  data-testid="treasury-deposit-input"
                  type="number"
                  placeholder="Monto USDC (ej. 1000)"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className={`treasury-input-flex ${styles.actionInput}`}
                />
                <button data-testid="treasury-deposit-btn" className={`btn-primary ${styles.depositBtn}`} onClick={onDeposit}>
                  Depositar
                </button>
              </div>
            </div>

            <div className={styles.actionBox}>
              <label className={styles.actionLabel}>
                🔥 Rescatar ALPHA Shares a NAV:
              </label>
              <div className="acp-flex-row-gap5">
                <input
                  data-testid="treasury-redeem-input"
                  type="number"
                  placeholder="Monto ALPHA (ej. 500)"
                  value={redeemAmount}
                  onChange={(e) => setRedeemAmount(e.target.value)}
                  className={`treasury-input-flex ${styles.actionInput}`}
                />
                <button data-testid="treasury-redeem-btn" className={`btn-primary ${styles.redeemBtn}`} onClick={onRedeem}>
                  Rescatar
                </button>
              </div>
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
                🏛️ Estrategia e Inversión Institucional de Reservas Exógenas
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