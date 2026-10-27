import React, { useState, useMemo } from 'react';
import styles from './AdminControlPanel.module.css';
import { CONTRACT_ADDRESSES, publicClient, getWalletClient } from '../utils/web3.js';
import { UI_STRINGS } from '../constants/strings.js';
import { Card, Badge, Button } from './common/index.js';

interface AdminControlPanelProps {
  chainId?: number;
  userAddress?: string;
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
  userAddress,
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

  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);
  const [proposalStatus, setProposalStatus] = useState<string | null>(null);

  const handleSimulateBuyback = async () => {
    setIsExecutingBuyback(true);
    setBuybackStatus(null);
    try {
      if (!CONTRACT_ADDRESSES.DISCOUNT_BUYBACK_ENGINE || CONTRACT_ADDRESSES.DISCOUNT_BUYBACK_ENGINE === '0x0000000000000000000000000000000000000000') {
        throw new Error('Dirección de DiscountBuybackEngine no configurada');
      }
      const client = getWalletClient(userAddress);
      const usdcUnits = BigInt(Math.floor(parseFloat(buybackUsdcAmount || '0') * 1e6));
      if (usdcUnits <= 0n) throw new Error('Monto de USDC inválido');

      const hash = await client.writeContract({
        address: CONTRACT_ADDRESSES.DISCOUNT_BUYBACK_ENGINE as `0x${string}`,
        abi: [
          {
            name: 'executeDiscountBuyback',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'usdcToSpend', type: 'uint256' },
              { name: 'minAlphaOut', type: 'uint256' }
            ],
            outputs: [{ name: 'alphaBurned', type: 'uint256' }]
          }
        ] as const,
        functionName: 'executeDiscountBuyback',
        args: [usdcUnits, 1n]
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setBuybackStatus(`✅ Recompra ejecutada on-chain (Tx: ${receipt.transactionHash.slice(0, 10)}...): ${buybackUsdcAmount} USDC invertidos en DEX. Tokens ALPHA adquiridos y quemados on-chain.`);
    } catch (err: any) {
      setBuybackStatus(`❌ Error al ejecutar recompra: ${err.shortMessage || err.message || err}`);
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

  const handleCreateDaoProposal = async () => {
    setIsSubmittingProposal(true);
    setProposalStatus(null);
    try {
      if (!CONTRACT_ADDRESSES.GOVERNOR || CONTRACT_ADDRESSES.GOVERNOR === '0x0000000000000000000000000000000000000000') {
        throw new Error('Dirección de Governor no configurada');
      }
      const client = getWalletClient(userAddress);

      let targetAddress: `0x${string}`;
      if (proposalTarget === 'OracleHub') {
        targetAddress = (CONTRACT_ADDRESSES.PRICE_FEED || CONTRACT_ADDRESSES.TREASURY) as `0x${string}`;
      } else if (proposalTarget === 'TreasuryManager') {
        targetAddress = CONTRACT_ADDRESSES.TREASURY as `0x${string}`;
      } else if (proposalTarget === 'DiscountBuybackEngine') {
        targetAddress = (CONTRACT_ADDRESSES.DISCOUNT_BUYBACK_ENGINE || CONTRACT_ADDRESSES.TREASURY) as `0x${string}`;
      } else if (proposalTarget === 'P2PLendingMarket') {
        targetAddress = CONTRACT_ADDRESSES.P2P_MARKET as `0x${string}`;
      } else if (proposalTarget === 'VestedDiscountVault') {
        targetAddress = CONTRACT_ADDRESSES.VESTED_VAULT as `0x${string}`;
      } else {
        targetAddress = CONTRACT_ADDRESSES.TREASURY as `0x${string}`;
      }

      const callData = (generatedCalldata.startsWith('0x') ? generatedCalldata : '0x') as `0x${string}`;

      const hash = await client.writeContract({
        address: CONTRACT_ADDRESSES.GOVERNOR as `0x${string}`,
        abi: [
          {
            name: 'propose',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'target', type: 'address' },
              { name: 'value', type: 'uint256' },
              { name: 'data', type: 'bytes' }
            ],
            outputs: [{ name: 'proposalId', type: 'uint256' }]
          }
        ] as const,
        functionName: 'propose',
        args: [targetAddress, 0n, callData]
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setProposalStatus(`✅ Propuesta DAO creada on-chain (Tx: ${receipt.transactionHash.slice(0, 10)}...). Período de votación abierto.`);
    } catch (err: any) {
      setProposalStatus(`❌ Error al crear propuesta: ${err.shortMessage || err.message || err}`);
    } finally {
      setIsSubmittingProposal(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* 🧭 Selector de Entorno: Sandbox Local vs Producción DAO */}
      <div className={styles.modeCard}>
        <div className={styles.modeInfo}>
          <h2 className={styles.modeTitle}>
            <span>{isSandbox ? '🧪' : '🏛️'}</span>
            <span>{isSandbox ? UI_STRINGS.ADMIN.TITLE_SANDBOX : `${UI_STRINGS.ADMIN.TITLE_PROD} (Chain ID ${chainId || 1})`}</span>
            <Badge variant={isSandbox ? 'blue' : 'amber'} size="sm">
              {isSandbox ? 'Entorno Local' : 'Timelock 72h'}
            </Badge>
          </h2>
          <p className={styles.modeDesc}>
            {isSandbox ? (
              <>{UI_STRINGS.ADMIN.SUBTITLE_SANDBOX}</>
            ) : (
              <>
                <strong>Cumplimiento MiCA Recital 22</strong>: {UI_STRINGS.ADMIN.SUBTITLE_PROD} Toda alteración de parámetros requiere propuesta formal en <code>GovernorAlphaCentauri.sol</code> con timelock de 72 horas.
              </>
            )}
          </p>
        </div>

        <div className={styles.modeToggleBox}>
          <button
            type="button"
            className={`${styles.modeToggleBtn} ${isSandbox ? styles.modeToggleBtnActiveSandbox : ''}`}
            onClick={() => setOverrideMode('sandbox')}
          >
            {UI_STRINGS.ADMIN.BTN_TOGGLE_SANDBOX}
          </button>
          <button
            type="button"
            className={`${styles.modeToggleBtn} ${!isSandbox ? styles.modeToggleBtnActiveProd : ''}`}
            onClick={() => setOverrideMode('production')}
          >
            {UI_STRINGS.ADMIN.BTN_TOGGLE_PROD}
          </button>
        </div>
      </div>

      {isSandbox ? (
        <div className={styles.gridAdmin}>
          {/* Tarjeta 1: Oráculo y Ponderación de Reservas */}
          <Card
            variant="surface"
            collapsible
            defaultExpanded={true}
            headerTitle={`⚙️ ${UI_STRINGS.ADMIN.CARD_ORACLE_TITLE} (Sandbox)`}
            headerSubtitle="Simula precios del oráculo y ajusta la composición de la cartera"
          >
            <div className={styles.controlStack}>
              <div className={styles.formGroup}>
                <label className={styles.label}>{UI_STRINGS.ADMIN.LABEL_ORACLE_PRICE}</label>
                <div className={styles.inputRow}>
                  <input
                    data-testid="admin-oracle-price-input"
                    type="number"
                    step="0.01"
                    value={oraclePrice}
                    onChange={(e) => setOraclePrice(e.target.value)}
                    className={styles.input}
                  />
                  <Button
                    data-testid="admin-oracle-update-btn"
                    variant="primary"
                    size="sm"
                    onClick={onUpdateOracle}
                  >
                    {UI_STRINGS.ADMIN.BTN_UPDATE_ORACLE}
                  </Button>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>{UI_STRINGS.ADMIN.CARD_WEIGHTS_TITLE}</label>
                <div className={styles.weightsGrid}>
                  <div className={styles.weightItem}>
                    <span className={styles.weightSymbol}>{UI_STRINGS.COMMON.SYMBOL_USDC}</span>
                    <input
                      data-testid="admin-weight-usdc-input"
                      type="number"
                      value={newStablesWeight}
                      onChange={(e) => setNewStablesWeight(e.target.value)}
                      className={styles.weightInput}
                    />
                  </div>
                  <div className={styles.weightItem}>
                    <span className={styles.weightSymbol}>{UI_STRINGS.COMMON.SYMBOL_WBTC}</span>
                    <input
                      data-testid="admin-weight-wbtc-input"
                      type="number"
                      value={newWbtcWeight}
                      onChange={(e) => setNewWbtcWeight(e.target.value)}
                      className={styles.weightInput}
                    />
                  </div>
                  <div className={styles.weightItem}>
                    <span className={styles.weightSymbol}>{UI_STRINGS.COMMON.SYMBOL_WETH}</span>
                    <input
                      data-testid="admin-weight-weth-input"
                      type="number"
                      value={newWethWeight}
                      onChange={(e) => setNewWethWeight(e.target.value)}
                      className={styles.weightInput}
                    />
                  </div>
                  <div className={styles.weightItem}>
                    <span className={styles.weightSymbol}>{UI_STRINGS.COMMON.SYMBOL_ALPHA}</span>
                    <input
                      data-testid="admin-weight-alpha-input"
                      type="number"
                      value={newAltsWeight}
                      onChange={(e) => setNewAltsWeight(e.target.value)}
                      className={styles.weightInput}
                    />
                  </div>
                </div>

                <Button
                  data-testid="admin-rebalance-btn"
                  variant="primary"
                  size="md"
                  onClick={onAdjustWeights}
                >
                  {UI_STRINGS.ADMIN.BTN_ADJUST_WEIGHTS}
                </Button>
              </div>
            </div>
          </Card>

          {/* Tarjeta 2: Disyuntor de Emergencia (Circuit Breaker) */}
          <Card
            variant="surface"
            collapsible
            defaultExpanded={true}
            headerTitle={`⚡ ${UI_STRINGS.ADMIN.CARD_BREAKER_TITLE} (Sandbox)`}
            headerSubtitle="Protección frente a desanclajes extremos o manipulaciones de precios"
          >
            <div className={styles.controlStack}>
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  {UI_STRINGS.ADMIN.LABEL_BREAKER_STATE}:{' '}
                  <Badge variant={circuitBreakerFrozen ? 'crimson' : 'emerald'} size="sm" dot>
                    {circuitBreakerFrozen ? UI_STRINGS.COMMON.STATUS_FROZEN_FULL : UI_STRINGS.COMMON.STATUS_NORMAL}
                  </Badge>
                </label>
                <div className={styles.twoColButtons}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSimulateDrop}
                  >
                    📉 {UI_STRINGS.ADMIN.BTN_CHECK_DEVIATION}
                  </Button>
                  <Button
                    data-testid="admin-reset-governance-btn"
                    variant="emerald"
                    size="sm"
                    onClick={onResetBreaker}
                  >
                    {UI_STRINGS.ADMIN.BTN_RESET_BREAKER}
                  </Button>
                </div>
              </div>

              <div className={styles.formGroup}>
                <Button
                  data-testid="admin-reset-anvil-btn"
                  variant="secondary"
                  size="sm"
                  onClick={onResetBlockchain}
                >
                  🔄 {UI_STRINGS.ADMIN.BTN_RESET_EVM}
                </Button>
              </div>
            </div>
          </Card>

          {/* Tarjeta 3: Recompra con Descuento (Buyback Engine) */}
          <Card
            variant="surface"
            collapsible
            defaultExpanded={true}
            headerTitle={UI_STRINGS.ADMIN.CARD_BUYBACK_TITLE}
            headerSubtitle="Quema deflacionaria de participaciones adquiridas con descuento en el mercado secundario"
          >
            <div className={styles.controlStack}>
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  {UI_STRINGS.ADMIN.LABEL_BUYBACK_SAFETY}: <strong>{UI_STRINGS.ADMIN.LABEL_BUYBACK_LOCKS_ACTIVE}</strong>
                </label>
                <div className={styles.buybackLockList}>
                  {UI_STRINGS.ADMIN.BUYBACK_LOCKS_LIST.map((lock, idx) => (
                    <div key={idx}>{lock}</div>
                  ))}
                </div>

                <div className={styles.inputRow}>
                  <input
                    type="number"
                    placeholder={UI_STRINGS.ADMIN.INPUT_BUYBACK_PLACEHOLDER}
                    value={buybackUsdcAmount}
                    onChange={(e) => setBuybackUsdcAmount(e.target.value)}
                    className={styles.input}
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSimulateBuyback}
                    disabled={isExecutingBuyback}
                  >
                    {isExecutingBuyback ? UI_STRINGS.ADMIN.BTN_BUYBACK_EXECUTING : UI_STRINGS.ADMIN.BTN_BUYBACK_SUBMIT}
                  </Button>
                </div>

                {buybackStatus && (
                  <div className={buybackStatus.includes('✅') ? styles.statusSuccess : styles.statusError}>
                    {buybackStatus}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      ) : (
        /* MODO PRODUCCIÓN: ADVERTENCIA Y CONSTRUCTOR DE PROPUESTAS DAO */
        <div className={styles.container}>
          <div className={styles.warningCard}>
            <div className={styles.warningTitle}>
              <span>⚠️</span>
              <span>{UI_STRINGS.ADMIN.WARNING_PURE_DEFI_TITLE}</span>
            </div>
            <div className={styles.warningBody}>
              {UI_STRINGS.ADMIN.WARNING_PURE_DEFI_BODY}
            </div>
          </div>

          <Card
            variant="surface"
            collapsible
            defaultExpanded={true}
            headerTitle={`${UI_STRINGS.GOVERNANCE.CARD_PROPOSE_TITLE} (Proposal Builder)`}
            headerSubtitle="Genera transacciones codificadas y propuestas para GovernorAlphaCentauri.sol"
          >
            <div className={styles.proposalForm}>
              <div className={styles.twoColInputs}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>1. {UI_STRINGS.GOVERNANCE.LABEL_TARGET_CONTRACT}</label>
                  <select
                    value={proposalTarget}
                    onChange={(e) => setProposalTarget(e.target.value)}
                    className={styles.select}
                  >
                    <option value="OracleHub">OracleHub.sol (Feeds & Staleness)</option>
                    <option value="TreasuryManager">TreasuryManager.sol (Nav & Sensitivity)</option>
                    <option value="DiscountBuybackEngine">DiscountBuybackEngine.sol (10 Candados & Budget)</option>
                    <option value="P2PLendingMarket">P2PLendingMarket.sol (Credit Line & LTV)</option>
                    <option value="VestedDiscountVault">VestedDiscountVault.sol (Scale & Tiers)</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>{UI_STRINGS.ADMIN.LABEL_ACTION_FUNCTION}</label>
                  <select
                    value={proposalAction}
                    onChange={(e) => setProposalAction(e.target.value)}
                    className={styles.select}
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

              <div className={styles.twoColInputs}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{UI_STRINGS.ADMIN.LABEL_PARAM_1}</label>
                  <input
                    type="text"
                    value={proposalParam1}
                    onChange={(e) => setProposalParam1(e.target.value)}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{UI_STRINGS.ADMIN.LABEL_PARAM_2}</label>
                  <input
                    type="text"
                    value={proposalParam2}
                    onChange={(e) => setProposalParam2(e.target.value)}
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>{UI_STRINGS.GOVERNANCE.LABEL_DESCRIPTION}</label>
                <textarea
                  rows={2}
                  value={proposalDescription}
                  onChange={(e) => setProposalDescription(e.target.value)}
                  className={styles.textarea}
                />
              </div>

              <div className={styles.calldataBox}>
                <span className={styles.calldataHeader}>{UI_STRINGS.GOVERNANCE.LABEL_CALLDATA}</span>
                <code className={styles.calldataCode}>{generatedCalldata}</code>
              </div>

              <Button
                variant="primary"
                size="md"
                onClick={handleCreateDaoProposal}
                disabled={isSubmittingProposal}
              >
                {isSubmittingProposal ? 'Enviando Propuesta...' : `${UI_STRINGS.GOVERNANCE.BTN_SUBMIT_PROPOSAL} (Timelock 72h)`}
              </Button>

              {proposalStatus && (
                <div className={proposalStatus.includes('✅') ? styles.statusSuccess : styles.statusError} style={{ marginTop: '0.75rem' }}>
                  {proposalStatus}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
