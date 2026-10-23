import React from 'react';
import styles from './TreasuryDashboard.module.css';
import { UI_STRINGS } from '../constants/strings.js';
import { Card, StatCard, Button, Badge, TokenAmountInput } from './common/index.js';

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
  const totalLentUsd = loansList
    .filter((l: any) => l.active)
    .reduce((acc: number, curr: any) => acc + (parseFloat(curr.amount) || 0), 0);

  return (
    <div className={styles.container}>
      {/* 🏛️ Panel Principal de Emisión y Reembolso */}
      <Card
        variant="surface"
        headerTitle={UI_STRINGS.TREASURY.CARD_DEPOSIT_TITLE}
        headerSubtitle={UI_STRINGS.TREASURY.SUBTITLE}
        headerAction={
          <Button
            data-testid="treasury-faucet-btn"
            variant="outline"
            size="sm"
            onClick={onFaucetUSDC}
          >
            🚰 {UI_STRINGS.TREASURY.BTN_FAUCET}
          </Button>
        }
      >
        {/* 👛 Saldos Disponibles del Usuario */}
        <div className={styles.balancesGrid}>
          <StatCard
            title="Mi Balance Disponible"
            value={`${usdcBalance} ${UI_STRINGS.COMMON.SYMBOL_USDC}`}
            testId="treasury-usdc-balance"
            variant="emerald"
            icon="💵"
            subtext="Fondos líquidos disponibles para suscripción"
          />

          <StatCard
            title={`Mis ${UI_STRINGS.COMMON.SYMBOL_ALPHA} Shares`}
            value={`${sharesBalance} ${UI_STRINGS.COMMON.SYMBOL_ALPHA}`}
            testId="treasury-shares-balance"
            variant="blue"
            icon="💎"
            subtext="Participaciones con respaldo NAV en tesorería"
          />
        </div>

        {/* ⚡ Operaciones: Suscripción (Mint) y Reembolso (Redeem) */}
        <div className={styles.operationsGrid}>
          {/* Tarjeta de Depósito / Mint */}
          <div className={styles.actionCard}>
            <div className={styles.actionHeader}>
              <span>💳</span>
              <span>{UI_STRINGS.TREASURY.INPUT_DEPOSIT_LABEL}</span>
            </div>

            <TokenAmountInput
              testId="treasury-deposit-input"
              placeholder={UI_STRINGS.TREASURY.INPUT_DEPOSIT_PLACEHOLDER}
              value={depositAmount}
              onChange={setDepositAmount}
              tokenSymbol={UI_STRINGS.COMMON.SYMBOL_USDC}
              tokenDecimals={6}
              maxBalance={usdcBalance}
            />

            <Button
              data-testid="treasury-deposit-btn"
              variant="emerald"
              size="md"
              className={styles.submitBtn}
              onClick={onDeposit}
            >
              Suscribir ALPHA (Mint)
            </Button>
          </div>

          {/* Tarjeta de Reembolso / Burn */}
          <div className={styles.actionCard}>
            <div className={styles.actionHeader}>
              <span>🔥</span>
              <span>{UI_STRINGS.TREASURY.INPUT_REDEEM_LABEL}</span>
            </div>

            <TokenAmountInput
              testId="treasury-redeem-input"
              placeholder={UI_STRINGS.TREASURY.INPUT_REDEEM_PLACEHOLDER}
              value={redeemAmount}
              onChange={setRedeemAmount}
              tokenSymbol={UI_STRINGS.COMMON.SYMBOL_ALPHA}
              tokenDecimals={18}
              maxBalance={sharesBalance}
            />

            <Button
              data-testid="treasury-redeem-btn"
              variant="danger"
              size="md"
              className={styles.submitBtn}
              onClick={onRedeem}
            >
              Reembolsar USDC (Redeem)
            </Button>
          </div>
        </div>
      </Card>

      {/* 🌾 Panel de Estrategias Exógenas (Admin / Fiduciario) */}
      {isAdmin && (() => {
        const p2pAllocationUsd = totalLentUsd;
        const morphoAllocationUsd = Math.max(0, porBreakdown.stables - p2pAllocationUsd);
        const btcAllocationUsd = porBreakdown.wbtc;
        const ethAllocationUsd = porBreakdown.weth;

        return (
          <Card
            variant="surface"
            headerTitle={UI_STRINGS.METRICS.TABLE_ASSETS_TITLE}
            headerSubtitle="Distribución institucional de bóvedas y cosechas de rendimiento activas"
            headerAction={
              <Button
                variant="outline"
                size="sm"
                onClick={onAuditPoR}
              >
                🌾 Cosechar Rendimiento Diario (Morpho Harvest)
              </Button>
            }
          >
            <div className={styles.strategyGrid}>
              {/* Stablecoins Strategy */}
              <div className={styles.strategyCard}>
                <div className={styles.strategyHeader}>
                  <span>💵 Stablecoins (USDC / USDT)</span>
                  <Badge variant="emerald" size="sm">Real Yield Active</Badge>
                </div>
                <div className={styles.strategyList}>
                  <div className={styles.strategyRow}>
                    <span>Créditos Directos / P2P:</span>
                    <span className={styles.strategyVal}>
                      ${p2pAllocationUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                    </span>
                  </div>
                  <div className={styles.strategyRow}>
                    <span>Bóvedas Morpho Blue:</span>
                    <span className={styles.strategyVal}>
                      ${morphoAllocationUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                    </span>
                  </div>
                </div>
              </div>

              {/* Bitcoin Strategy */}
              <div className={styles.strategyCard}>
                <div className={styles.strategyHeader}>
                  <span>🪙 Bitcoin (WBTC / cbBTC)</span>
                  <Badge variant="amber" size="sm">Babylon & Morpho</Badge>
                </div>
                <div className={styles.strategyList}>
                  <div className={styles.strategyRow}>
                    <span>Reserva Auditada:</span>
                    <span className={styles.strategyVal}>
                      ${btcAllocationUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (WBTC)
                    </span>
                  </div>
                </div>
              </div>

              {/* Ethereum Strategy */}
              <div className={styles.strategyCard}>
                <div className={styles.strategyHeader}>
                  <span>🔷 Ethereum (WETH / stETH)</span>
                  <Badge variant="blue" size="sm">Staking & Vaults</Badge>
                </div>
                <div className={styles.strategyList}>
                  <div className={styles.strategyRow}>
                    <span>Reserva Auditada:</span>
                    <span className={styles.strategyVal}>
                      ${ethAllocationUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (WETH)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        );
      })()}
    </div>
  );
};
