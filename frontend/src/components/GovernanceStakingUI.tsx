import React from 'react';

interface GovernanceStakingUIProps {
  stakedBalance: string;
  claimableYield: string;
  totalBurnedTokens?: string;
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
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>🥩 Staking de Gobernanza (ALPHA)</span>
          <span style={{ fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '0.25rem 0.6rem', borderRadius: '12px', fontWeight: 600 }}>
            🔥 Deflacionario
          </span>
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div className="por-metric-box">
            <div className="por-metric-label">ALPHA EN STAKING</div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#c084fc' }}>{stakedBalance} ALPHA</div>
          </div>
          <div className="por-metric-box">
            <div className="por-metric-label">REAL YIELD ACUMULADO</div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#4ade80' }}>${claimableYield} USD</div>
          </div>
          <div className="por-metric-box" style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
            <div className="por-metric-label" style={{ color: '#f87171' }}>🔥 ALPHA QUEMADOS</div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#f87171' }}>{totalBurnedTokens} ALPHA</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.2rem' }}>Monto a Bloquear / Desbloquear (ALPHA):</label>
            <input
              type="number"
              placeholder="ej. 100"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              className="admin-input-dark"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button className="btn-primary" style={{ background: '#a855f7' }} onClick={onStake}>
              🔒 Stake ALPHA
            </button>
            <button className="btn-secondary" onClick={onUnstake}>
              🔓 Unstake
            </button>
          </div>
        </div>
      </div>

      {/* Real Yield Routing & Preferences Card */}
      <div className="glass-panel por-card">
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem' }}>🔀 Real Yield Router & Preferencia Payout</h3>

        <p style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '1rem' }}>
          Selecciona cómo deseas recibir el rendimiento generado por las comisiones del protocolo.
        </p>

        <div className="strategy-card" style={{ padding: '0.85rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="radio"
                name="payoutPref"
                checked={payoutPref === 0}
                onChange={() => { setPayoutPref(0); onSetPayoutPreference(0); }}
              />
              <span><strong>Opción A:</strong> Stablecoins Líquidas (USDC directo)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <button className="btn-primary" style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }} onClick={onClaimYield}>
            💸 Reclamar Yield
          </button>
          <button className="btn-secondary" style={{ borderColor: '#6366f1', color: '#818cf8' }} onClick={onGaslessClaim}>
            ⚡ Reclamo Gasless (EIP-712)
          </button>
        </div>
      </div>
    </div>
  );
};