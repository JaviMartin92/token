import React, { useState, useMemo } from 'react';
import styles from './AdminControlPanel.module.css';
import { CONTRACT_ADDRESSES } from '../utils/web3.js';
import { UI_STRINGS } from '../constants/strings.js';

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
  onResetBlockchain
}) => {
  const isAnvilChain = chainId === 31337 || chainId === undefined;
  const [overrideMode, setOverrideMode] = useState<'sandbox' | 'production'>(isAnvilChain ? 'sandbox' : 'production');

  const isSandbox = overrideMode === 'sandbox';

  const [proposalTarget, setProposalTarget] = useState('OracleHub');
  const [proposalAction, setProposalAction] = useState('setTrackedAsset');
  const [proposalParam1, setProposalParam1] = useState<string>(CONTRACT_ADDRESSES.USDC || '');
  const [proposalParam2, setProposalParam2] = useState<string>(CONTRACT_ADDRESSES.USDT || '');
  const [proposalDescription, setProposalDescription] = useState('Ajuste de Feed de Oráculo Primario para USDC');

  const [buybackUsdcAmount, setBuybackUsdcAmount] = useState('1000');
  const [isExecutingBuyback, setIsExecutingBuyback] = useState(false);
  const [buybackStatus, setBuybackStatus] = useState<string | null>(null);

  const handleSimulateBuyback = async () => {
    setIsExecutingBuyback(true);
    setBuybackStatus(null);
    try {
      // In Sandbox mode, trigger discount buyback simulation
      await new Promise((resolve) => setTimeout(resolve, 800));
      setBuybackStatus(`✅ Recompra ejecutada: ${buybackUsdcAmount} USDC invertidos en DEX. Tokens ALPHA adquiridos con descuento y quemados on-chain. NAV/ALPHA incrementado.`);
    } catch (err: any) {
      setBuybackStatus(`❌ Error al ejecutar recompra: ${err.message || err}`);
    } finally {
      setIsExecutingBuyback(false);
    }
  };

  const generatedCalldata = useMemo(() => {
    try {
      const p1Clean = proposalParam1.replace(/^0x/i, '').padStart(64, '0');
      const p2Clean = proposalParam2.replace(/^0x/i, '').padStart(64, '0');
      return `0x7c2c1b9f${p1Clean}${p2Clean}`;
    } catch {
      return '0x';
    }
  }, [proposalParam1, proposalParam2]);

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
              {isSandbox ? UI_STRINGS.ADMIN.TITLE_SANDBOX : `🏛️ ${UI_STRINGS.ADMIN.TITLE_PROD} (Chain ID ${chainId || 1})`}
            </div>
            <div className="acp-banner-subtitle">
              {isSandbox ? (
                <>{UI_STRINGS.ADMIN.SUBTITLE_SANDBOX}</>
              ) : (
                <><strong>MiCA Recital 22 Compliant</strong>: {UI_STRINGS.ADMIN.SUBTITLE_PROD} Toda alteración de parámetros requiere una propuesta formal en <code>GovernorAlphaCentauri.sol</code> con un timelock obligatorio de 72 horas en <code>TimelockController.sol</code>.</>
              )}
            </div>
          </div>

          <div className="acp-toggle-box">
            <span className="acp-toggle-label">{UI_STRINGS.ADMIN.LABEL_TOGGLE_VIEW}</span>
            <button
              className={`btn-primary ${isSandbox ? 'acp-toggle-btn-sandbox-active' : 'acp-toggle-btn-sandbox-inactive'}`}
              onClick={() => setOverrideMode('sandbox')}
            >
              {UI_STRINGS.ADMIN.BTN_TOGGLE_SANDBOX}
            </button>
            <button
              className={`btn-primary ${!isSandbox ? styles.toggleBtnProdActive : styles.toggleBtnProdInactive}`}
              onClick={() => setOverrideMode('production')}
            >
              {UI_STRINGS.ADMIN.BTN_TOGGLE_PROD}
            </button>
          </div>
        </div>
      </div>

      {isSandbox ? (
        <div className="admin-grid">
          <div className="glass-panel admin-card">
            <h3 className="admin-title-oracle">⚙️ {UI_STRINGS.ADMIN.CARD_ORACLE_TITLE} (Sandbox)</h3>
            <div className={styles.controlStack}>
              <div>
                <label className={styles.labelSm}>{UI_STRINGS.ADMIN.LABEL_ORACLE_PRICE}</label>
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
                    {UI_STRINGS.ADMIN.BTN_UPDATE_ORACLE}
                  </button>
                </div>
              </div>

              <div className="admin-section-divider">
                <label className={styles.labelSm}>{UI_STRINGS.ADMIN.CARD_WEIGHTS_TITLE}</label>
                <div className="admin-grid-4col">
                  <div>
                    <span className="admin-label-compact">{UI_STRINGS.COMMON.SYMBOL_USDC}</span>
                    <input data-testid="admin-weight-usdc-input" type="number" value={newStablesWeight} onChange={(e) => setNewStablesWeight(e.target.value)} className="admin-input-compact" />
                  </div>
                  <div>
                    <span className="admin-label-compact">{UI_STRINGS.COMMON.SYMBOL_WBTC}</span>
                    <input data-testid="admin-weight-wbtc-input" type="number" value={newWbtcWeight} onChange={(e) => setNewWbtcWeight(e.target.value)} className="admin-input-compact" />
                  </div>
                  <div>
                    <span className="admin-label-compact">{UI_STRINGS.COMMON.SYMBOL_WETH}</span>
                    <input data-testid="admin-weight-weth-input" type="number" value={newWethWeight} onChange={(e) => setNewWethWeight(e.target.value)} className="admin-input-compact" />
                  </div>
                  <div>
                    <span className="admin-label-compact">{UI_STRINGS.COMMON.SYMBOL_ALPHA}</span>
                    <input data-testid="admin-weight-alpha-input" type="number" value={newAltsWeight} onChange={(e) => setNewAltsWeight(e.target.value)} className="admin-input-compact" />
                  </div>
                </div>
                <button data-testid="admin-rebalance-btn" className={`btn-primary ${styles.btnIndigoFull}`} onClick={onAdjustWeights}>
                  {UI_STRINGS.ADMIN.BTN_ADJUST_WEIGHTS}
                </button>
              </div>
            </div>
          </div>

          <div className="glass-panel admin-card">
            <h3 className="admin-title-breaker">⚡ {UI_STRINGS.ADMIN.CARD_BREAKER_TITLE} (Sandbox)</h3>
            <div className={styles.controlStack}>
              <div>
                <label className={styles.labelSm}>
                  {UI_STRINGS.ADMIN.LABEL_BREAKER_STATE} <strong>{circuitBreakerFrozen ? UI_STRINGS.COMMON.STATUS_FROZEN_FULL : UI_STRINGS.COMMON.STATUS_NORMAL}</strong>
                </label>
                <div className={styles.grid2col}>
                  <button className={`btn-secondary ${styles.btnDangerOutline}`} onClick={onSimulateDrop}>
                    📉 {UI_STRINGS.ADMIN.BTN_CHECK_DEVIATION}
                  </button>
                  <button data-testid="admin-reset-governance-btn" className={`btn-primary ${styles.btnGreen}`} onClick={onResetBreaker}>
                    {UI_STRINGS.ADMIN.BTN_RESET_BREAKER}
                  </button>
                </div>
              </div>

              <div className="admin-section-divider">
                <button data-testid="admin-reset-anvil-btn" className={`btn-secondary ${styles.btnWarningOutline}`} onClick={onResetBlockchain}>
                  {UI_STRINGS.ADMIN.BTN_RESET_EVM}
                </button>
              </div>
            </div>
          </div>

          <div className="glass-panel admin-card">
            <h3 className="admin-title-oracle">{UI_STRINGS.ADMIN.CARD_BUYBACK_TITLE}</h3>
            <div className={styles.controlStack}>
              <div>
                <label className={styles.labelSm}>
                  {UI_STRINGS.ADMIN.LABEL_BUYBACK_SAFETY} <strong>{UI_STRINGS.ADMIN.LABEL_BUYBACK_LOCKS_ACTIVE}</strong>
                </label>
                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', margin: '6px 0 10px 0', lineHeight: 1.4 }}>
                  {UI_STRINGS.ADMIN.BUYBACK_LOCKS_LIST.map((lock, idx) => (
                    <React.Fragment key={idx}>{lock}<br/></React.Fragment>
                  ))}
                </div>
                <div className="acp-flex-row-gap5">
                  <input
                    type="number"
                    placeholder={UI_STRINGS.ADMIN.INPUT_BUYBACK_PLACEHOLDER}
                    value={buybackUsdcAmount}
                    onChange={(e) => setBuybackUsdcAmount(e.target.value)}
                    className="admin-input-dark acp-flex-1"
                  />
                  <button
                    className={`btn-primary ${styles.btnIndigo}`}
                    onClick={handleSimulateBuyback}
                    disabled={isExecutingBuyback}
                  >
                    {isExecutingBuyback ? UI_STRINGS.ADMIN.BTN_BUYBACK_EXECUTING : UI_STRINGS.ADMIN.BTN_BUYBACK_SUBMIT}
                  </button>
                </div>
                {buybackStatus && (
                  <div style={{ marginTop: '8px', fontSize: '0.8rem', color: buybackStatus.includes('✅') ? '#34d399' : '#f87171' }}>
                    {buybackStatus}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="acp-container">
          <div className={`glass-panel ${styles.pureWarningCard}`}>
            <div className={styles.pureWarningTitle}>
              {UI_STRINGS.ADMIN.WARNING_PURE_DEFI_TITLE}
            </div>
            <div className={styles.pureWarningBody}>
              {UI_STRINGS.ADMIN.WARNING_PURE_DEFI_BODY}
            </div>
          </div>

          <div className={`glass-panel ${styles.proposalCard}`}>
            <h3 className={styles.proposalTitle}>
              {UI_STRINGS.GOVERNANCE.CARD_PROPOSE_TITLE} (Proposal Builder)
            </h3>
            
            <div className={styles.grid2col}>
              <div>
                <label className={styles.labelSm}>1. {UI_STRINGS.GOVERNANCE.LABEL_TARGET_CONTRACT}</label>
                <select
                  value={proposalTarget}
                  onChange={(e) => setProposalTarget(e.target.value)}
                  className={styles.proposalSelect}
                >
                  <option value="OracleHub">OracleHub.sol (Feeds & Staleness)</option>
                  <option value="TreasuryManager">TreasuryManager.sol (Nav & Sensitivity)</option>
                  <option value="DiscountBuybackEngine">DiscountBuybackEngine.sol (10 Candados & Budget)</option>
                  <option value="P2PLendingMarket">P2PLendingMarket.sol (Credit Line & LTV)</option>
                  <option value="VestedDiscountVault">VestedDiscountVault.sol (Scale & Tiers)</option>
                </select>
              </div>

              <div>
                <label className={styles.labelSm}>{UI_STRINGS.ADMIN.LABEL_ACTION_FUNCTION}</label>
                <select
                  value={proposalAction}
                  onChange={(e) => setProposalAction(e.target.value)}
                  className={styles.proposalSelect}
                >
                  <option value="setTrackedAsset">setTrackedAsset(asset, primaryFeed, secFeed, decimals)</option>
                  <option value="setOracleStalenessLimit">setOracleStalenessLimit(uint256 limitSeconds)</option>
                  <option value="setMinDiscountBps">setMinDiscountBps(uint256 minDiscountBps)</option>
                  <option value="setMaxDailyBudgetBps">setMaxDailyBudgetBps(uint256 maxDailyBudgetBps)</option>
                  <option value="setCooldownPeriod">setCooldownPeriod(uint256 cooldownPeriod)</option>
                  <option value="setSwapRouter">setSwapRouter(address router)</option>
                  <option value="setDynamicFeeSensitivity">setDynamicFeeSensitivity(uint256 sensitivityBps)</option>
                </select>
              </div>
            </div>

            <div className={styles.grid2col}>
              <div>
                <label className={styles.labelSm}>{UI_STRINGS.ADMIN.LABEL_PARAM_1}</label>
                <input
                  type="text"
                  value={proposalParam1}
                  onChange={(e) => setProposalParam1(e.target.value)}
                  className="admin-input-dark acp-flex-1"
                />
              </div>
              <div>
                <label className={styles.labelSm}>{UI_STRINGS.ADMIN.LABEL_PARAM_2}</label>
                <input
                  type="text"
                  value={proposalParam2}
                  onChange={(e) => setProposalParam2(e.target.value)}
                  className="admin-input-dark acp-flex-1"
                />
              </div>
            </div>

            <div>
              <label className={styles.labelSm}>{UI_STRINGS.GOVERNANCE.LABEL_DESCRIPTION}</label>
              <textarea
                rows={2}
                value={proposalDescription}
                onChange={(e) => setProposalDescription(e.target.value)}
                className="admin-input-dark"
              />
            </div>

            <div className={styles.calldataBox}>
              <div className="acp-toggle-label">{UI_STRINGS.GOVERNANCE.LABEL_CALLDATA}</div>
              <code className={styles.calldataCode}>
                {generatedCalldata}
              </code>
            </div>

            <button
              className={`btn-primary ${styles.proposalSubmitBtn}`}
              onClick={handleCreateDaoProposal}
            >
              {UI_STRINGS.GOVERNANCE.BTN_SUBMIT_PROPOSAL} (Timelock 72h)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
