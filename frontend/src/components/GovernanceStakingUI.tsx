import React from 'react';
import styles from './GovernanceStakingUI.module.css';
import { UI_STRINGS } from '../constants/strings.js';
import { Card, StatCard, Badge, Button, TokenAmountInput } from './common/index.js';

interface GovernanceStakingUIProps {
  sharesBalance?: string;
  stakedBalance: string;
  claimableYield: string;
  totalBurnedTokens?: string;
  circulatingSupply?: string;
  totalStakedSupply?: string;
  communityStakedSupply?: string;
  communityVaultStakedSupply?: string;
  treasuryStakedSupply?: string;
  stakingRatioPct?: string;
  navPerShareUSD?: string;
  stakeAmount: string;
  setStakeAmount: (val: string) => void;
  payoutPref: number;
  setPayoutPref: (val: number) => void;
  onStake: () => void;
  onUnstake: () => void;
  onClaimYield: () => void;
  onGaslessClaim: () => void;
  onSetPayoutPreference: (pref: number) => void;
}

export const GovernanceStakingUI: React.FC<GovernanceStakingUIProps> = ({
  sharesBalance,
  stakedBalance,
  claimableYield,
  totalBurnedTokens = '0.00',
  stakeAmount,
  setStakeAmount,
  payoutPref,
  setPayoutPref,
  onStake,
  onUnstake,
  onClaimYield,
  onGaslessClaim,
  onSetPayoutPreference
}) => {
  return (
    <div className={styles.container}>
      {/* 🥩 Tarjeta 1: Staking y Gobernanza Deflacionaria */}
      <Card
        variant="surface"
        collapsible
        defaultExpanded={false}
        headerTitle={UI_STRINGS.STAKING.TITLE}
        headerSubtitle="Bloqueo de participaciones ALPHA para derechos de voto DAO y rendimientos reales exógenos"
        headerAction={
          <Badge variant="crimson" size="sm" dot>
            🔥 Deflacionario
          </Badge>
        }
      >
        <div className={styles.kpiRow}>
          <StatCard
            title={`Tu Staking (${UI_STRINGS.COMMON.SYMBOL_STALPHA})`}
            value={`${stakedBalance} ${UI_STRINGS.COMMON.SYMBOL_STALPHA}`}
            testId="staking-stalpha-balance"
            variant="blue"
            icon="🥩"
            subtext="Participaciones en gobernanza activa"
          />

          <StatCard
            title="Real Yield Acumulado"
            value={`$${claimableYield} USD`}
            testId="staking-real-yield"
            variant="emerald"
            icon="💎"
            subtext="Rendimiento disponible para reclamar"
          />

          <StatCard
            title={UI_STRINGS.STAKING.METRIC_TOTAL_BURNED}
            value={`${totalBurnedTokens} ${UI_STRINGS.COMMON.SYMBOL_ALPHA}`}
            testId="staking-total-burned"
            variant="crimson"
            icon="🔥"
            subtext="Quema definitiva irreversible"
          />
        </div>

        <div className={styles.formStack}>
          <TokenAmountInput
            label={UI_STRINGS.STAKING.INPUT_STAKE_LABEL}
            testId="staking-amount-input"
            placeholder={UI_STRINGS.STAKING.INPUT_STAKE_PLACEHOLDER}
            value={stakeAmount}
            onChange={setStakeAmount}
            tokenSymbol={UI_STRINGS.COMMON.SYMBOL_ALPHA}
            tokenDecimals={18}
            maxBalance={sharesBalance}
          />

          <div className={styles.buttonRow}>
            <Button
              data-testid="staking-stake-btn"
              variant="primary"
              size="md"
              className={styles.actionBtn}
              onClick={onStake}
            >
              {UI_STRINGS.STAKING.BTN_STAKE}
            </Button>

            <Button
              data-testid="staking-unstake-btn"
              variant="outline"
              size="md"
              className={styles.actionBtn}
              onClick={onUnstake}
            >
              {UI_STRINGS.STAKING.BTN_UNSTAKE}
            </Button>
          </div>
        </div>
      </Card>

      {/* 🔀 Tarjeta 2: Real Yield Router & Preferencia Payout */}
      <Card
        variant="surface"
        collapsible
        defaultExpanded={false}
        headerTitle="🔀 Real Yield Router & Preferencia Payout"
        headerSubtitle="Configuración institucional del destino de rendimientos y reclamos gasless"
      >
        <p className={styles.description}>
          {UI_STRINGS.STAKING.CARD_YIELD_DESC}
        </p>

        <div className={styles.optionsCard}>
          <label className={styles.radioOption}>
            <input
              type="radio"
              name="payoutPref"
              checked={payoutPref === 0}
              onChange={() => {
                setPayoutPref(0);
                onSetPayoutPreference(0);
              }}
              className={styles.radioInput}
            />
            <span className={styles.radioText}>
              <strong>Opción A:</strong> {UI_STRINGS.STAKING.PREF_OPTION_A}
            </span>
          </label>

          <label className={styles.radioOption}>
            <input
              type="radio"
              name="payoutPref"
              checked={payoutPref === 1}
              onChange={() => {
                setPayoutPref(1);
                onSetPayoutPreference(1);
              }}
              className={styles.radioInput}
            />
            <span className={styles.radioText}>
              <strong>Opción B:</strong> {UI_STRINGS.STAKING.PREF_OPTION_B}
            </span>
          </label>
        </div>

        <div className={styles.buttonRow}>
          <Button
            data-testid="yield-claim-btn"
            variant="emerald"
            size="md"
            className={styles.actionBtn}
            onClick={onClaimYield}
          >
            {UI_STRINGS.STAKING.BTN_CLAIM_YIELD}
          </Button>

          <Button
            data-testid="yield-gasless-btn"
            variant="outline"
            size="md"
            className={styles.actionBtn}
            onClick={onGaslessClaim}
          >
            {UI_STRINGS.STAKING.BTN_GASLESS_CLAIM}
          </Button>
        </div>
      </Card>
    </div>
  );
};
