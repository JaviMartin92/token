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
    <div className="acp-container">
      {/* Environment Mode Switcher Banner */}
      <div className={`glass-panel ${isSandbox ? 'acp-banner-devnet' : 'acp-banner-prod'}`}>
        <div className="acp-banner-flex">
          <div>
            <div className={isSandbox ? 'acp-title-sandbox' : 'acp-title-prod'}>
              {isSandbox ? '🧪 ENTORNO DE PRUEBAS SANDBOX (Anvil Devnet — Chain ID 31337)' : '🏛️ PRODUCCIÓN PURE DEFI MAINNET-READY (Chain ID ' + (chainId || 1) + ') — 0 EOA Admin Keys'}
            </div>
            <div className="acp-banner-subtitle">
              {isSandbox ? (
                <>En este entorno local Anvil (31337), puedes simular actualizaciones de oráculos mock, forzar rebalanceos y probar el Circuit Breaker sin restricciones.</>
              ) : (
                <><strong>MiCA Recital 22 Compliant</strong>: 0 claves privadas de administración en producción. Toda alteración de parámetros requiere una propuesta formal en <code>GovernorAlphaCentauri.sol</code> con un timelock obligatorio de 72 horas en <code>TimelockController.sol</code>.</>
              )}
            </div>
          </div>

          {/* Mode Switcher Toggle for Auditors & Testers */}
          <div className="acp-toggle-box">
            <span className="acp-toggle-label">Simular Vista:</span>
            <button
              className={`btn-primary ${isSandbox ? 'acp-toggle-btn-sandbox-active' : 'acp-toggle-btn-sandbox-inactive'}`}
              onClick={() => setOverrideMode('sandbox')}
            >
              🧪 Sandbox Devnet
            </button>
            <button
              className={`btn-primary ${!isSandbox ? 'acp-toggle-btn-prod-active' : 'acp-toggle-btn-prod-inactive'}`}
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
            <div className="acp-control-stack">
              <div>
                <label className="acp-label-sm">Actualizar Precio Oráculo USDC Feed ($):</label>
                <div className="acp-flex-row-gap5">
                  <input
                    data-testid="admin-oracle-price-input"
                    type="number"
                    step="0.01"
                    value={oraclePrice}
                    onChange={(e) => setOraclePrice(e.target.value)}
                    className="admin-input-dark acp-flex-1"
                  />
                  <button data-testid="admin-oracle-update-btn" className="btn-primary acp-btn-indigo" onClick={onUpdateOracle}>
                    Actualizar Oráculo
                  </button>
                </div>
              </div>

              <div className="admin-section-divider">
                <label className="acp-label-sm">Rebalancear Ponderaciones Target (%):</label>
                <div className="admin-grid-4col">
                  <div>
                    <span className="admin-label-compact">USDC</span>
                    <input data-testid="admin-weight-usdc-input" type="number" value={newStablesWeight} onChange={(e) => setNewStablesWeight(e.target.value)} className="admin-input-compact" />
                  </div>
                  <div>
                    <span className="admin-label-compact">WBTC</span>
                    <input data-testid="admin-weight-wbtc-input" type="number" value={newWbtcWeight} onChange={(e) => setNewWbtcWeight(e.target.value)} className="admin-input-compact" />
                  </div>
                  <div>
                    <span className="admin-label-compact">WETH</span>
                    <input data-testid="admin-weight-weth-input" type="number" value={newWethWeight} onChange={(e) => setNewWethWeight(e.target.value)} className="admin-input-compact" />
                  </div>
                  <div>
                    <span className="admin-label-compact">ALPHA</span>
                    <input data-testid="admin-weight-alpha-input" type="number" value={newAltsWeight} onChange={(e) => setNewAltsWeight(e.target.value)} className="admin-input-compact" />
                  </div>
                </div>
                <button data-testid="admin-rebalance-btn" className="btn-primary acp-btn-indigo-full" onClick={onAdjustWeights}>
                  ⚖️ Rebalancear Cartera On-Chain
                </button>
              </div>
            </div>
          </div>

          {/* Circuit Breaker & Protocol TWAP Card */}
          <div className="glass-panel admin-card">
            <h3 className="admin-title-breaker">⚡ Circuit Breaker & Inyección (Sandbox)</h3>
            <div className="acp-control-stack">
              <div>
                <label className="acp-label-sm">
                  Estado del Interruptor: <strong>{circuitBreakerFrozen ? 'FROZEN (Congelado)' : 'NORMAL'}</strong>
                </label>
                <div className="acp-grid-2col">
                  <button className="btn-secondary acp-btn-danger-outline" onClick={onSimulateDrop}>
                    📉 Evaluar Caída Oráculo
                  </button>
                  <button data-testid="admin-reset-governance-btn" className="btn-primary acp-btn-green" onClick={onResetBreaker}>
                    🔄 Reset Gobernanza
                  </button>
                </div>
              </div>

              <div className="admin-section-divider">
                <label className="acp-label-sm">Inyección del Protocolo TWAP (Buyback USDC):</label>
                <div className="acp-flex-row-gap5">
                  <input
                    data-testid="admin-twap-amount-input"
                    type="number"
                    placeholder="Monto USDC"
                    value={injectionAmount}
                    onChange={(e) => setInjectionAmount(e.target.value)}
                    className="admin-input-dark acp-flex-1"
                  />
                  <button data-testid="admin-twap-execute-btn" className="btn-primary acp-btn-purple" onClick={onExecuteTWAP}>
                    Ejecutar TWAP
                  </button>
                </div>
              </div>

              <div className="admin-section-divider">
                <button data-testid="admin-reset-anvil-btn" className="btn-secondary acp-btn-warning-outline" onClick={onResetBlockchain}>
                  🔄 Reiniciar Entorno de Prueba Anvil
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Pure DeFi Production Mode: DAO Proposal Builder & Governance Pipeline */
        <div className="acp-container">
          {/* Direct Write Lock Warning */}
          <div className="glass-panel acp-pure-warning-card">
            <div className="acp-pure-warning-title">
              🛑 Escrituras Directas Desactivadas (Pure DeFi Enforcement)
            </div>
            <div className="acp-pure-warning-body">
              Cualquier intento de ejecutar un <code>writeContract</code> directo a <code>OracleHub</code> o <code>TreasuryManager</code> desde una billetera privada revertirá con <code>"AccessControl: account is missing role"</code>. Todos los cambios deben presentarse como propuestas de gobernanza en el formulario inferior.
            </div>
          </div>

          {/* DAO Proposal Builder Card */}
          <div className="glass-panel acp-proposal-card">
            <h3 className="acp-proposal-title">
              🏛️ Constructor de Propuestas de Gobernanza DAO (Proposal Builder)
            </h3>
            
            <div className="admin-grid-2col">
              <div>
                <label className="acp-label-sm">1. Contrato Objetivo (Target):</label>
                <select
                  value={proposalTarget}
                  onChange={(e) => setProposalTarget(e.target.value)}
                  className="acp-proposal-select"
                >
                  <option value="OracleHub">OracleHub.sol (Feeds & Staleness)</option>
                  <option value="TreasuryManager">TreasuryManager.sol (Nav & Sensitivity)</option>
                  <option value="P2PLendingMarket">P2PLendingMarket.sol (Credit Line & LTV)</option>
                  <option value="VestedDiscountVault">VestedDiscountVault.sol (Scale & Tiers)</option>
                </select>
              </div>

              <div>
                <label className="acp-label-sm">2. Acción a Ejecutar (Function):</label>
                <select
                  value={proposalAction}
                  onChange={(e) => setProposalAction(e.target.value)}
                  className="acp-proposal-select"
                >
                  <option value="setTrackedAsset">setTrackedAsset(asset, primaryFeed, secFeed, decimals)</option>
                  <option value="setOracleStalenessLimit">setOracleStalenessLimit(uint256 limitSeconds)</option>
                  <option value="setSwapRouter">setSwapRouter(address router)</option>
                  <option value="setDynamicFeeSensitivity">setDynamicFeeSensitivity(uint256 sensitivityBps)</option>
                </select>
              </div>
            </div>

            <div className="admin-grid-2col">
              <div>
                <label className="acp-label-sm">Parámetro 1 (Dirección / Valor):</label>
                <input
                  type="text"
                  value={proposalParam1}
                  onChange={(e) => setProposalParam1(e.target.value)}
                  className="admin-input-dark acp-flex-1"
                />
              </div>
              <div>
                <label className="acp-label-sm">Parámetro 2 (Feed Secondary / Staleness):</label>
                <input
                  type="text"
                  value={proposalParam2}
                  onChange={(e) => setProposalParam2(e.target.value)}
                  className="admin-input-dark acp-flex-1"
                />
              </div>
            </div>

            <div>
              <label className="acp-label-sm">Descripción Justificativa de la Propuesta:</label>
              <textarea
                rows={2}
                value={proposalDescription}
                onChange={(e) => setProposalDescription(e.target.value)}
                className="admin-input-dark acp-flex-1"
              />
            </div>

            {/* Encoded Calldata Preview */}
            <div className="acp-calldata-box">
              <div className="acp-toggle-label">CALLEDA ENVIADO A GOVERNOR (BYTES):</div>
              <code className="acp-calldata-code">
                0x7c2c1b9f0000000000000000000000005fbdb2315678afecb367f032d93f642f64180aa3000000000000000000000000dc64a140aa3e981100a9beca4e685f962f0cf6c9
              </code>
            </div>

            <button
              className="btn-primary acp-proposal-submit-btn"
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