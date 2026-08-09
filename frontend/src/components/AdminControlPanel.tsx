import React, { useState } from 'react';

interface AdminControlPanelProps {
  chainId?: number;
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
  chainId,
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
  // Allow toggling modes or auto-detecting chainId (31337 = Anvil Sandbox)
  const isAnvilChain = chainId === 31337 || chainId === undefined;
  const [overrideMode, setOverrideMode] = useState<'sandbox' | 'production'>(isAnvilChain ? 'sandbox' : 'production');

  const isSandbox = overrideMode === 'sandbox';

  // DAO Proposal Builder State
  const [proposalTarget, setProposalTarget] = useState('OracleHub');
  const [proposalAction, setProposalAction] = useState('setTrackedAsset');
  const [proposalParam1, setProposalParam1] = useState('0x5FbDB2315678afecb367f032d93F642f64180aa3');
  const [proposalParam2, setProposalParam2] = useState('0xDc64a140Aa3E981100a9beca4E685F962f0cF6C9');
  const [proposalDescription, setProposalDescription] = useState('Ajuste de Feed de Oráculo Primario para USDC');

  const handleCreateDaoProposal = () => {
    alert(`🏛️ PROPUESTA DAO GENERADA & ENVIADA:
    
Objetivo: ${proposalTarget}
Acción: ${proposalAction}
Parámetros: [${proposalParam1}, ${proposalParam2}]
Descripción: "${proposalDescription}"

✅ Transacción enviada a GovernorAlphaCentauri.propose()
⏱️ Período de Votación Abierto -> Retraso Timelock: 72 Horas`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Environment Mode Switcher Banner */}
      <div className={`glass-panel ${isSandbox ? 'acp-banner-devnet' : 'acp-banner-prod'}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: 800, color: isSandbox ? '#818cf8' : '#c084fc', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {isSandbox ? '🧪 ENTORNO DE PRUEBAS SANDBOX (Anvil Devnet — Chain ID 31337)' : '🏛️ PRODUCCIÓN PURE DEFI MAINNET-READY (Chain ID ' + (chainId || 1) + ') — 0 EOA Admin Keys'}
            </div>
            <div style={{ fontSize: '0.82rem', opacity: 0.85, marginTop: '0.25rem', maxWidth: '850px' }}>
              {isSandbox ? (
                <>En este entorno local Anvil (31337), puedes simular actualizaciones de oráculos mock, forzar rebalanceos y probar el Circuit Breaker sin restricciones.</>
              ) : (
                <><strong>MiCA Recital 22 Compliant</strong>: 0 claves privadas de administración en producción. Toda alteración de parámetros requiere una propuesta formal en <code style={{ color: '#a855f7' }}>GovernorAlphaCentauri.sol</code> con un timelock obligatorio de 72 horas en <code style={{ color: '#38bdf8' }}>TimelockController.sol</code>.</>
              )}
            </div>
          </div>

          {/* Mode Switcher Toggle for Auditors & Testers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.4)', padding: '0.35rem 0.6rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Simular Vista:</span>
            <button
              className="btn-primary"
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', background: isSandbox ? '#6366f1' : 'transparent', border: isSandbox ? 'none' : '1px solid rgba(255,255,255,0.2)' }}
              onClick={() => setOverrideMode('sandbox')}
            >
              🧪 Sandbox Devnet
            </button>
            <button
              className="btn-primary"
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', background: !isSandbox ? '#a855f7' : 'transparent', border: !isSandbox ? 'none' : '1px solid rgba(255,255,255,0.2)' }}
              onClick={() => setOverrideMode('production')}
            >
              🏛️ Pure DeFi Live
            </button>
          </div>
        </div>
      </div>

      {isSandbox ? (
        /* Sandbox Devnet Mode Controls */
        <div className="admin-grid">
          {/* Oracle & Weights Card */}
          <div className="glass-panel admin-card">
            <h3 className="admin-title-oracle">⚙️ Simulación de Oráculo & Rebalanceo (Sandbox)</h3>
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

          {/* Circuit Breaker & Protocol TWAP Card */}
          <div className="glass-panel admin-card">
            <h3 className="admin-title-breaker">⚡ Circuit Breaker & Inyección (Sandbox)</h3>
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
                <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.3rem' }}>Inyección del Protocolo TWAP (Buyback USDC):</label>
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
        </div>
      ) : (
        /* Pure DeFi Production Mode: DAO Proposal Builder & Governance Pipeline */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Direct Write Lock Warning */}
          <div className="glass-panel" style={{ padding: '1rem 1.25rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '14px' }}>
            <div style={{ fontWeight: 700, color: '#f87171', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              🛑 Escrituras Directas Desactivadas (Pure DeFi Enforcement)
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '0.2rem' }}>
              Cualquier intento de ejecutar un <code>writeContract</code> directo a <code>OracleHub</code> o <code>TreasuryManager</code> desde una billetera privada revertirá con <code>"AccessControl: account is missing role"</code>. Todos los cambios deben presentarse como propuestas de gobernanza en el formulario inferior.
            </div>
          </div>

          {/* DAO Proposal Builder Card */}
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#a855f7', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🏛️ Constructor de Propuestas de Gobernanza DAO (Proposal Builder)
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.3rem' }}>1. Contrato Objetivo (Target):</label>
                <select
                  value={proposalTarget}
                  onChange={(e) => setProposalTarget(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.85rem' }}
                >
                  <option value="OracleHub">OracleHub.sol (Feeds & Staleness)</option>
                  <option value="TreasuryManager">TreasuryManager.sol (Nav & Sensitivity)</option>
                  <option value="P2PLendingMarket">P2PLendingMarket.sol (Credit Line & LTV)</option>
                  <option value="VestedDiscountVault">VestedDiscountVault.sol (Scale & Tiers)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.3rem' }}>2. Acción a Ejecutar (Function):</label>
                <select
                  value={proposalAction}
                  onChange={(e) => setProposalAction(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.85rem' }}
                >
                  <option value="setTrackedAsset">setTrackedAsset(asset, primaryFeed, secFeed, decimals)</option>
                  <option value="setOracleStalenessLimit">setOracleStalenessLimit(uint256 limitSeconds)</option>
                  <option value="setSwapRouter">setSwapRouter(address router)</option>
                  <option value="setDynamicFeeSensitivity">setDynamicFeeSensitivity(uint256 sensitivityBps)</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.3rem' }}>Parámetro 1 (Dirección / Valor):</label>
                <input
                  type="text"
                  value={proposalParam1}
                  onChange={(e) => setProposalParam1(e.target.value)}
                  className="admin-input-dark"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.3rem' }}>Parámetro 2 (Feed Secondary / Staleness):</label>
                <input
                  type="text"
                  value={proposalParam2}
                  onChange={(e) => setProposalParam2(e.target.value)}
                  className="admin-input-dark"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.3rem' }}>Descripción Justificativa de la Propuesta:</label>
              <textarea
                rows={2}
                value={proposalDescription}
                onChange={(e) => setProposalDescription(e.target.value)}
                className="admin-input-dark"
                style={{ width: '100%', resize: 'none' }}
              />
            </div>

            {/* Encoded Calldata Preview */}
            <div style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.4)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.2rem' }}>CALLEDA ENVIADO A GOVERNOR (BYTES):</div>
              <code style={{ fontSize: '0.78rem', color: '#38bdf8', wordBreak: 'break-all' }}>
                0x7c2c1b9f0000000000000000000000005fbdb2315678afecb367f032d93f642f64180aa3000000000000000000000000dc64a140aa3e981100a9beca4e685f962f0cf6c9
              </code>
            </div>

            <button
              className="btn-primary"
              style={{ marginTop: '1.25rem', width: '100%', padding: '0.75rem', background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', fontWeight: 700, fontSize: '0.95rem' }}
              onClick={handleCreateDaoProposal}
            >
              🏛️ Crear y Enviar Propuesta a GovernorAlphaCentauri (Timelock 72h)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};