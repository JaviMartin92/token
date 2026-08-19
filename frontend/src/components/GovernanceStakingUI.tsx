import React from 'react';
import styles from './GovernanceStakingUI.module.css';
import { UI_STRINGS } from '../constants/strings.js';
import { TokenAmountInput } from './common/TokenAmountInput.js';

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
    <div className="admin-grid">
      {/* Staking & Reward Metrics Card */}
      <div className="glass-panel por-card">
        <h3 className="acp-banner-flex margin-bottom-lg">
          <span>{UI_STRINGS.STAKING.TITLE}</span>
          <span className={styles.deflationaryTag}>
            🔥 Deflacionario
          </span>
        </h3>

        <div className="admin-grid-3col margin-bottom-lg">
          <div className="por-metric-box">
            <div className="por-metric-label">TU STAKING ({UI_STRINGS.COMMON.SYMBOL_STALPHA})</div>
            <div data-testid="staking-stalpha-balance" className={styles.valPurple}>{stakedBalance} {UI_STRINGS.COMMON.SYMBOL_STALPHA}</div>
          </div>
          <div className="por-metric-box">
            <div className="por-metric-label">REAL YIELD ACUMULADO</div>
            <div data-testid="staking-real-yield" className={styles.valGreen}>${claimableYield} USD</div>
          </div>
          <div className={`por-metric-box ${styles.burnedBox}`}>
            <div className={`por-metric-label ${styles.burnedLabel}`}>🔥 {UI_STRINGS.STAKING.METRIC_TOTAL_BURNED}</div>
            <div data-testid="staking-total-burned" className={styles.burnedVal}>{totalBurnedTokens} {UI_STRINGS.COMMON.SYMBOL_ALPHA}</div>
          </div>
        </div>

        <div className="acp-control-stack">
          <div>
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
          </div>

          <div className="admin-grid-2col margin-top-xs">
            <button data-testid="staking-stake-btn" className={`btn-primary ${styles.btnPurple}`} onClick={onStake}>
              {UI_STRINGS.STAKING.BTN_STAKE}
            </button>
            <button data-testid="staking-unstake-btn" className="btn-secondary" onClick={onUnstake}>
              {UI_STRINGS.STAKING.BTN_UNSTAKE}
            </button>
          </div>
        </div>
      </div>

      {/* Real Yield Routing & Preferences Card */}
      <div className="glass-panel por-card">
        <h3 className="margin-bottom-lg">🔀 Real Yield Router & Preferencia Payout</h3>

        <p className="acp-label-sm margin-bottom-lg">
          {UI_STRINGS.STAKING.CARD_YIELD_DESC}
        </p>

        <div className="strategy-card margin-bottom-lg">
          <div className="acp-control-stack">
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="payoutPref"
                checked={payoutPref === 0}
                onChange={() => { setPayoutPref(0); onSetPayoutPreference(0); }}
              />
              <span><strong>Opción A:</strong> {UI_STRINGS.STAKING.PREF_OPTION_A}</span>
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="payoutPref"
                checked={payoutPref === 1}
                onChange={() => { setPayoutPref(1); onSetPayoutPreference(1); }}
              />
              <span><strong>Opción B:</strong> {UI_STRINGS.STAKING.PREF_OPTION_B}</span>
            </label>
          </div>
        </div>

        <div className="admin-grid-2col">
          <button data-testid="yield-claim-btn" className={`btn-primary ${styles.btnGreenGrad}`} onClick={onClaimYield}>
            {UI_STRINGS.STAKING.BTN_CLAIM_YIELD}
          </button>
          <button data-testid="yield-gasless-btn" className={`btn-secondary ${styles.btnIndigoOutline}`} onClick={onGaslessClaim}>
            {UI_STRINGS.STAKING.BTN_GASLESS_CLAIM}
          </button>
        </div>
      </div>
    </div>
  );
};
