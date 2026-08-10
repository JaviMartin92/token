import React from 'react';

interface GovernanceStakingUIProps {
  stakedBalance: string;
  claimableYield: string;
  totalBurnedTokens?: string;
  circulatingSupply?: string;
  totalStakedSupply?: string;
  communityStakedSupply?: string;
  corporateStakedSupply?: string;
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
          <span>🥩 Staking de Gobernanza (ALPHA)</span>
          <span className="stk-deflationary-tag">
            🔥 Deflacionario
          </span>
        </h3>

        <div className="admin-grid-3col margin-bottom-lg">
          <div className="por-metric-box">
            <div className="por-metric-label">TU STAKING (stALPHA)</div>
            <div data-testid="staking-stalpha-balance" className="stk-val-purple">{stakedBalance} stALPHA</div>
          </div>
          <div className="por-metric-box">
            <div className="por-metric-label">REAL YIELD ACUMULADO</div>
            <div data-testid="staking-real-yield" className="stk-val-green">${claimableYield} USD</div>
          </div>
          <div className="por-metric-box stk-burned-box">
            <div className="por-metric-label stk-burned-label">🔥 TOTAL QUEMADOS</div>
            <div data-testid="staking-total-burned" className="stk-burned-val">{totalBurnedTokens} ALPHA</div>
          </div>
        </div>

        <div className="acp-control-stack">
          <div>
            <label className="acp-label-sm">Monto a Bloquear / Desbloquear (ALPHA):</label>
            <input
              data-testid="staking-amount-input"
              type="number"
              placeholder="ej. 100"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              className="admin-input-dark acp-flex-1"
            />
          </div>

          <div className="admin-grid-2col">
            <button data-testid="staking-stake-btn" className="btn-primary stk-btn-purple" onClick={onStake}>
              🔒 Stake ALPHA
            </button>
            <button data-testid="staking-unstake-btn" className="btn-secondary" onClick={onUnstake}>
              🔓 Unstake
            </button>
          </div>
        </div>
      </div>

      {/* Real Yield Routing & Preferences Card */}
      <div className="glass-panel por-card">
        <h3 className="margin-bottom-lg">🔀 Real Yield Router & Preferencia Payout</h3>

        <p className="acp-label-sm margin-bottom-lg">
          Selecciona cómo deseas recibir el rendimiento generado por las comisiones del protocolo.
        </p>

        <div className="strategy-card margin-bottom-lg">
          <div className="acp-control-stack">
            <label className="stk-radio-label">
              <input
                type="radio"
                name="payoutPref"
                checked={payoutPref === 0}
                onChange={() => { setPayoutPref(0); onSetPayoutPreference(0); }}
              />
              <span><strong>Opción A:</strong> Stablecoins Líquidas (USDC directo)</span>
            </label>
            <label className="stk-radio-label">
              <input
                type="radio"
                name="payoutPref"
                checked={payoutPref === 1}
                onChange={() => { setPayoutPref(1); onSetPayoutPreference(1); }}
              />
              <span><strong>Opción B:</strong> Reserva WBTC/WETH (Atomic Swap)</span>
            </label>
          </div>
        </div>

        <div className="admin-grid-2col">
          <button data-testid="yield-claim-btn" className="btn-primary stk-btn-green-grad" onClick={onClaimYield}>
            💸 Reclamar Yield
          </button>
          <button data-testid="yield-gasless-btn" className="btn-secondary stk-btn-indigo-outline" onClick={onGaslessClaim}>
            ⚡ Reclamo Gasless (EIP-712)
          </button>
        </div>
      </div>
    </div>
  );
};