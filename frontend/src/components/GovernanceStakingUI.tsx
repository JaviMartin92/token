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
  circulatingSupply = '0.00',
  totalStakedSupply = '0.00',
  communityStakedSupply = '0.00',
  corporateStakedSupply = '0.00',
  treasuryStakedSupply = '0.00',
  stakingRatioPct = '0.00%',
  navPerShareUSD = '$1.0000 USDC',
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
            <div className="por-metric-label">TU STAKING (stALPHA)</div>
            <div data-testid="staking-stalpha-balance" style={{ fontWeight: 700, fontSize: '1.05rem', color: '#c084fc' }}>{stakedBalance} stALPHA</div>
          </div>
          <div className="por-metric-box">
            <div className="por-metric-label">REAL YIELD ACUMULADO</div>
            <div data-testid="staking-real-yield" style={{ fontWeight: 700, fontSize: '1.05rem', color: '#4ade80' }}>${claimableYield} USD</div>
          </div>
          <div className="por-metric-box" style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
            <div className="por-metric-label" style={{ color: '#f87171' }}>🔥 TOTAL QUEMADOS</div>
            <div data-testid="staking-total-burned" style={{ fontWeight: 700, fontSize: '1.05rem', color: '#f87171' }}>{totalBurnedTokens} ALPHA</div>
          </div>
        </div>

        {/* Global Deflationary Tokenomics Breakdown */}
        <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '12px', padding: '0.85rem 1rem', marginBottom: '1.25rem', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.6, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            📊 Tokenomics & Estado de Oferta Deflacionaria
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
            <div>
              <span style={{ opacity: 0.6, display: 'block', fontSize: '0.68rem' }}>🪙 En Circulación:</span>
              <span data-testid="staking-circulating-supply" style={{ fontWeight: 700, color: '#38bdf8' }}>{circulatingSupply} ALPHA</span>
            </div>
            <div>
              <span style={{ opacity: 0.6, display: 'block', fontSize: '0.68rem' }}>👤 Stake Comunidad:</span>
              <span data-testid="staking-community-staked" style={{ fontWeight: 700, color: '#c084fc' }}>{communityStakedSupply} stALPHA</span>
            </div>
            <div>
              <span style={{ opacity: 0.6, display: 'block', fontSize: '0.68rem' }}>🏢 Stake Bóvedas:</span>
              <span data-testid="staking-vaults-staked" style={{ fontWeight: 700, color: '#a855f7' }}>{corporateStakedSupply} stALPHA</span>
            </div>
            <div>
              <span style={{ opacity: 0.6, display: 'block', fontSize: '0.68rem' }}>🏛️ Stake Reservas:</span>
              <span data-testid="staking-reserves-staked" style={{ fontWeight: 700, color: '#38bdf8' }}>{treasuryStakedSupply} stALPHA</span>
            </div>
            <div>
              <span style={{ opacity: 0.6, display: 'block', fontSize: '0.68rem' }}>🥩 Total Global Staked:</span>
              <span data-testid="staking-global-staked" style={{ fontWeight: 700, color: '#eab308' }}>{totalStakedSupply} ALPHA ({stakingRatioPct})</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', fontSize: '0.8rem', borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '0.5rem' }}>
            <div>
              <span style={{ opacity: 0.6, display: 'block', fontSize: '0.7rem' }}>💎 Respaldo (NAV / ALPHA):</span>
              <span data-testid="staking-backing-nav" style={{ fontWeight: 700, color: '#4ade80' }}>{navPerShareUSD}</span>
            </div>
            <div>
              <span style={{ opacity: 0.6, display: 'block', fontSize: '0.7rem' }}>🔥 Deflación Acumulada:</span>
              <span data-testid="staking-deflation-destroyed" style={{ fontWeight: 700, color: '#f87171' }}>{totalBurnedTokens} ALPHA Destruidos</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.2rem' }}>Monto a Bloquear / Desbloquear (ALPHA):</label>
            <input
              data-testid="staking-amount-input"
              type="number"
              placeholder="ej. 100"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              className="admin-input-dark"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button data-testid="staking-stake-btn" className="btn-primary" style={{ background: '#a855f7' }} onClick={onStake}>
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
          <button data-testid="yield-claim-btn" className="btn-primary" style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }} onClick={onClaimYield}>
            💸 Reclamar Yield
          </button>
          <button data-testid="yield-gasless-btn" className="btn-secondary" style={{ borderColor: '#6366f1', color: '#818cf8' }} onClick={onGaslessClaim}>
            ⚡ Reclamo Gasless (EIP-712)
          </button>
        </div>
      </div>
    </div>
  );
};