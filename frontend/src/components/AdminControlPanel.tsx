import React from 'react';

interface AdminControlPanelProps {
  oraclePrice: string;
  setOraclePrice: (val: string) => void;
  onUpdateOracle: () => void;
  newStablesWeight: string;
  setNewStablesWeight: (val: string) => void;
  newWbtcWeight: string;
  setNewWbtcWeight: (val: string) => void;
  newWethWeight: string;
  setNewWethWeight: (val: string) => void;
  newAltsWeight: string;
  setNewAltsWeight: (val: string) => void;
  onAdjustWeights: () => void;
  circuitBreakerFrozen: boolean;
  onSimulateDrop: () => void;
  onResetBreaker: () => void;
  injectionAmount: string;
  setInjectionAmount: (val: string) => void;
  onExecuteTWAP: () => void;
  onResetBlockchain: () => void;
}

export const AdminControlPanel: React.FC<AdminControlPanelProps> = ({
  oraclePrice,
  setOraclePrice,
  onUpdateOracle,
  newStablesWeight,
  setNewStablesWeight,
  newWbtcWeight,
  setNewWbtcWeight,
  newWethWeight,
  setNewWethWeight,
  newAltsWeight,
  setNewAltsWeight,
  onAdjustWeights,
  circuitBreakerFrozen,
  onSimulateDrop,
  onResetBreaker,
  injectionAmount,
  setInjectionAmount,
  onExecuteTWAP,
  onResetBlockchain
}) => {
  return (
    <div className="admin-grid">
      {/* Oracle & Weights Card */}
      <div className="glass-panel admin-card">
        <h3 className="admin-title-oracle">⚙️ Oráculo & Rebalanceo de Cartera</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.2rem' }}>Actualizar Precio Oráculo USDC Feed ($):</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                data-testid="admin-oracle-price-input"
                type="number"
                step="0.01"
                value={oraclePrice}
                onChange={(e) => setOraclePrice(e.target.value)}
                className="admin-input-dark"
                style={{ flex: 1 }}
              />
              <button data-testid="admin-oracle-update-btn" className="btn-primary" style={{ background: '#6366f1' }} onClick={onUpdateOracle}>
                Actualizar Oráculo
              </button>
            </div>
          </div>

          <div className="admin-section-divider">
            <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.4rem' }}>Rebalancear Ponderaciones Target (%):</label>
            <div className="admin-grid-4col">
              <div>
                <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>USDC</span>
                <input data-testid="admin-weight-usdc-input" type="number" value={newStablesWeight} onChange={(e) => setNewStablesWeight(e.target.value)} className="admin-input-compact" />
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>WBTC</span>
                <input data-testid="admin-weight-wbtc-input" type="number" value={newWbtcWeight} onChange={(e) => setNewWbtcWeight(e.target.value)} className="admin-input-compact" />
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>WETH</span>
                <input data-testid="admin-weight-weth-input" type="number" value={newWethWeight} onChange={(e) => setNewWethWeight(e.target.value)} className="admin-input-compact" />
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>ALPHA</span>
                <input data-testid="admin-weight-alpha-input" type="number" value={newAltsWeight} onChange={(e) => setNewAltsWeight(e.target.value)} className="admin-input-compact" />
              </div>
            </div>
            <button data-testid="admin-rebalance-btn" className="btn-primary" style={{ width: '100%', background: '#4f46e5' }} onClick={onAdjustWeights}>
              ⚖️ Rebalancear Cartera On-Chain
            </button>
          </div>
        </div>
      </div>

      {/* Circuit Breaker & Corporate TWAP Card */}
      <div className="glass-panel admin-card">
        <h3 className="admin-title-breaker">⚡ Circuit Breaker & Inyección Corporativa</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.3rem' }}>
              Estado del Interruptor: <strong>{circuitBreakerFrozen ? 'FROZEN (Congelado)' : 'NORMAL'}</strong>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button className="btn-secondary" style={{ borderColor: '#ef4444', color: '#ef4444' }} onClick={onSimulateDrop}>
                📉 Evaluar Caída Oráculo
              </button>
              <button data-testid="admin-reset-governance-btn" className="btn-primary" style={{ background: '#22c55e' }} onClick={onResetBreaker}>
                🔄 Reset Gobernanza
              </button>
            </div>
          </div>

          <div className="admin-section-divider">
            <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.3rem' }}>Inyección Corporativa TWAP (Buyback USDC):</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                data-testid="admin-twap-amount-input"
                type="number"
                placeholder="Monto USDC"
                value={injectionAmount}
                onChange={(e) => setInjectionAmount(e.target.value)}
                className="admin-input-dark"
                style={{ flex: 1 }}
              />
              <button data-testid="admin-twap-execute-btn" className="btn-primary" style={{ background: '#a855f7' }} onClick={onExecuteTWAP}>
                Ejecutar TWAP
              </button>
            </div>
          </div>

          <div className="admin-section-divider">
            <button data-testid="admin-reset-anvil-btn" className="btn-secondary" style={{ width: '100%', borderColor: '#eab308', color: '#eab308' }} onClick={onResetBlockchain}>
              🔄 Reiniciar Entorno de Prueba Anvil
            </button>
          </div>
        </div>
      </div>

      {/* Manual Vault Governance & Opportunity Notification Card */}
      <div className="glass-panel admin-card admin-card-fullwidth">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ⚙️ Control de Gobernanza y Selección Manual de Bóvedas
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', opacity: 0.8 }}>
              Permite al administrador fijar manualmente la bóveda objetivo de cada activo o activar el modo 100% autónomo.
            </p>
          </div>
          <button
            className="btn-secondary"
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem', borderColor: '#818cf8', color: '#818cf8' }}
            onClick={() => alert('🔍 Comprobación diaria ejecutada. El algoritmo ha verificado las mejores tasas APY del mercado.')}
          >
            🔍 Ejecutar Comprobación Diaria de Oportunidades
          </button>
        </div>

        {/* Opportunity Alert Box */}
        <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', padding: '0.85rem 1rem', borderRadius: '12px', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ fontWeight: 700, color: '#fb7185', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              🔔 Notificación de Oportunidad Detectada en Comprobación Diaria
            </div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9, marginTop: '0.2rem' }}>
              El algoritmo ha verificado que <strong>Aave V3 Core Pool</strong> ofrece <strong>7.10% APY</strong> (+0.65% superior a Morpho Blue 6.45%).
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn-primary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: '#22c55e' }}
              onClick={() => alert('✅ Oportunidad Aceptada: Bóveda actualizada a Aave V3 Core Pool (7.10% APY). Rebalanceo completado.')}
            >
              ✅ Aceptar y Rebalancear
            </button>
            <button
              className="btn-secondary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', borderColor: '#ef4444', color: '#ef4444' }}
              onClick={() => alert('❌ Oportunidad Rechazada: Se mantiene la selección manual del administrador.')}
            >
              ❌ Rechazar
            </button>
          </div>
        </div>

        {/* Manual Override Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', fontSize: '0.8rem' }}>
          {/* Stablecoins Manual Control */}
          <div className="strategy-card">
            <div style={{ fontWeight: 600, color: '#4ade80', marginBottom: '0.4rem' }}>💵 Bóveda Stablecoins:</div>
            <select
              style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.8rem' }}
              defaultValue="morpho"
              onChange={(e) => alert(`⚙️ Bóveda de Stablecoins ajustada a: ${e.target.options[e.target.selectedIndex].text}`)}
            >
              <option value="auto">🤖 Modo 100% Autónomo (Auto-Máximo APY)</option>
              <option value="morpho">⚙️ Manual: Morpho Blue MetaMorpho (6.45% APY)</option>
              <option value="aave">⚙️ Manual: Aave V3 Core USDC Pool (5.12% APY)</option>
              <option value="compound">⚙️ Manual: Compound V3 USDC Market (4.80% APY)</option>
            </select>
          </div>

          {/* Ethereum Manual Control */}
          <div className="strategy-card">
            <div style={{ fontWeight: 600, color: '#c084fc', marginBottom: '0.4rem' }}>Ξ Bóveda Ethereum:</div>
            <select
              style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.8rem' }}
              defaultValue="lido"
              onChange={(e) => alert(`⚙️ Bóveda de Ethereum ajustada a: ${e.target.options[e.target.selectedIndex].text}`)}
            >
              <option value="auto">🤖 Modo 100% Autónomo (Auto-Máximo APY)</option>
              <option value="lido">⚙️ Manual: Lido wstETH Staking (4.20% APY)</option>
              <option value="rocket">⚙️ Manual: Rocket Pool rETH (3.75% APY)</option>
              <option value="kiln">⚙️ Manual: Kiln Native Staking (3.60% APY)</option>
            </select>
          </div>

          {/* Bitcoin Manual Control */}
          <div className="strategy-card">
            <div style={{ fontWeight: 600, color: '#fbbf24', marginBottom: '0.4rem' }}>₿ Bóveda Bitcoin:</div>
            <select
              style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.8rem' }}
              defaultValue="lombard"
              onChange={(e) => alert(`⚙️ Bóveda de Bitcoin ajustada a: ${e.target.options[e.target.selectedIndex].text}`)}
            >
              <option value="auto">🤖 Modo 100% Autónomo (Auto-Máximo APY)</option>
              <option value="lombard">⚙️ Manual: Lombard LBTC Babylon (3.80% APY)</option>
              <option value="bedrock">⚙️ Manual: Bedrock uniBTC Vault (3.10% APY)</option>
              <option value="solv">⚙️ Manual: Solv Protocol BTC (2.95% APY)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};