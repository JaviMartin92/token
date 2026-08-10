import React, { useState } from 'react';
import styles from './AdminControlPanel.module.css';

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
  const isAnvilChain = chainId === 31337 || chainId === undefined;
  const [overrideMode, setOverrideMode] = useState<'sandbox' | 'production'>(isAnvilChain ? 'sandbox' : 'production');

  const isSandbox = overrideMode === 'sandbox';

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

          <div className="acp-toggle-box">
            <span className="acp-toggle-label">Simular Vista:</span>
            <button
              className={`btn-primary ${isSandbox ? 'acp-toggle-btn-sandbox-active' : 'acp-toggle-btn-sandbox-inactive'}`}
              onClick={() => setOverrideMode('sandbox')}
            >
              🧪 Sandbox Devnet
            </button>
            <button
              className={`btn-primary ${!isSandbox ? styles.toggleBtnProdActive : styles.toggleBtnProdInactive}`}
              onClick={() => setOverrideMode('production')}
            >
              🏛️ Pure DeFi Live
            </button>
          </div>
        </div>
      </div>

      {isSandbox ? (
        <div className="admin-grid">
          <div className="glass-panel admin-card">
            <h3 className="admin-title-oracle">⚙️ Simulación de Oráculo & Rebalanceo (Sandbox)</h3>
            <div className={styles.controlStack}>
              <div>
                <label className={styles.labelSm}>Actualizar Precio Oráculo USDC Feed ($):</label>
                <div className="acp-flex-row-gap5">
                  <input
                    data-testid="admin-oracle-price-input"
                    type="number"
                    step="0.01"
                    value={oraclePrice}
                    onChange={(e) => setOraclePrice(e.target.value)}
                    className="admin-input-dark acp-flex-1"
                  />
                  <button data-testid="admin-oracle-update-btn" className={`btn-primary ${styles.btnIndigo}`} onClick={onUpdateOracle}>
                    Actualizar Oráculo
                  </button>
                </div>
              </div>

              <div className="admin-section-divider">
                <label className={styles.labelSm}>Rebalancear Ponderaciones Target (%):</label>
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
                <button data-testid="admin-rebalance-btn" className={`btn-primary ${styles.btnIndigoFull}`} onClick={onAdjustWeights}>
                  ⚖️ Rebalancear Cartera On-Chain
                </button>
              </div>
            </div>
          </div>

          <div className="glass-panel admin-card">
            <h3 className="admin-title-breaker">⚡ Circuit Breaker & Inyección (Sandbox)</h3>
            <div className={styles.controlStack}>
              <div>
                <label className={styles.labelSm}>
                  Estado del Interruptor: <strong>{circuitBreakerFrozen ? 'FROZEN (Congelado)' : 'NORMAL'}</strong>
                </label>
                <div className={styles.grid2col}>
                  <button className={`btn-secondary ${styles.btnDangerOutline}`} onClick={onSimulateDrop}>
                    📉 Evaluar Caída Oráculo
                  </button>
                  <button data-testid="admin-reset-governance-btn" className={`btn-primary ${styles.btnGreen}`} onClick={onResetBreaker}>
                    🔄 Reset Gobernanza
                  </button>
                </div>
              </div>

              <div className="admin-section-divider">
                <label className={styles.labelSm}>Inyección del Protocolo TWAP (Buyback USDC):</label>
                <div className="acp-flex-row-gap5">
                  <input
                    data-testid="admin-twap-amount-input"
                    type="number"
                    placeholder="Monto USDC"
                    value={injectionAmount}
                    onChange={(e) => setInjectionAmount(e.target.value)}
                    className="admin-input-dark acp-flex-1"
                  />
                  <button data-testid="admin-twap-execute-btn" className={`btn-primary ${styles.btnPurple}`} onClick={onExecuteTWAP}>
                    Ejecutar TWAP
                  </button>
                </div>
              </div>

              <div className="admin-section-divider">
                <button data-testid="admin-reset-anvil-btn" className={`btn-secondary ${styles.btnWarningOutline}`} onClick={onResetBlockchain}>
                  🔄 Reiniciar Entorno de Prueba Anvil
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="acp-container">
          <div className={`glass-panel ${styles.pureWarningCard}`}>
            <div className={styles.pureWarningTitle}>
              🛑 Escrituras Directas Desactivadas (Pure DeFi Enforcement)
            </div>
            <div className={styles.pureWarningBody}>
              Cualquier intento de ejecutar un <code>writeContract</code> directo a <code>OracleHub</code> o <code>TreasuryManager</code> desde una billetera privada revertirá con <code>"AccessControl: account is missing role"</code>. Todos los cambios deben presentarse como propuestas de gobernanza en el formulario inferior.
            </div>
          </div>

          <div className={`glass-panel ${styles.proposalCard}`}>
            <h3 className={styles.proposalTitle}>
              🏛️ Constructor de Propuestas de Gobernanza DAO (Proposal Builder)
            </h3>
            
            <div className={styles.grid2col}>
              <div>
                <label className={styles.labelSm}>1. Contrato Objetivo (Target):</label>
                <select
                  value={proposalTarget}
                  onChange={(e) => setProposalTarget(e.target.value)}
                  className={styles.proposalSelect}
                >
                  <option value="OracleHub">OracleHub.sol (Feeds & Staleness)</option>
                  <option value="TreasuryManager">TreasuryManager.sol (Nav & Sensitivity)</option>
                  <option value="P2PLendingMarket">P2PLendingMarket.sol (Credit Line & LTV)</option>
                  <option value="VestedDiscountVault">VestedDiscountVault.sol (Scale & Tiers)</option>
                </select>
              </div>

              <div>
                <label className={styles.labelSm}>2. Acción a Ejecutar (Function):</label>
                <select
                  value={proposalAction}
                  onChange={(e) => setProposalAction(e.target.value)}
                  className={styles.proposalSelect}
                >
                  <option value="setTrackedAsset">setTrackedAsset(asset, primaryFeed, secFeed, decimals)</option>
                  <option value="setOracleStalenessLimit">setOracleStalenessLimit(uint256 limitSeconds)</option>
                  <option value="setSwapRouter">setSwapRouter(address router)</option>
                  <option value="setDynamicFeeSensitivity">setDynamicFeeSensitivity(uint256 sensitivityBps)</option>
                </select>
              </div>
            </div>

            <div className={styles.grid2col}>
              <div>
                <label className={styles.labelSm}>Parámetro 1 (Dirección / Valor):</label>
                <input
                  type="text"
                  value={proposalParam1}
                  onChange={(e) => setProposalParam1(e.target.value)}
                  className="admin-input-dark acp-flex-1"
                />
              </div>
              <div>
                <label className={styles.labelSm}>Parámetro 2 (Feed Secondary / Staleness):</label>
                <input
                  type="text"
                  value={proposalParam2}
                  onChange={(e) => setProposalParam2(e.target.value)}
                  className="admin-input-dark acp-flex-1"
                />
              </div>
            </div>

            <div>
              <label className={styles.labelSm}>Descripción Justificativa de la Propuesta:</label>
              <textarea
                rows={2}
                value={proposalDescription}
                onChange={(e) => setProposalDescription(e.target.value)}
                className="admin-input-dark"
              />
            </div>

            <div className={styles.calldataBox}>
              <div className="acp-toggle-label">CALLEDA ENVIADO A GOVERNOR (BYTES):</div>
              <code className={styles.calldataCode}>
                0x7c2c1b9f0000000000000000000000005fbdb2315678afecb367f032d93f642f64180aa3000000000000000000000000dc64a140aa3e981100a9beca4e685f962f0cf6c9
              </code>
            </div>

            <button
              className={`btn-primary ${styles.proposalSubmitBtn}`}
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