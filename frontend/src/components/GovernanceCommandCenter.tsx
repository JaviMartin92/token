import React, { useState } from 'react';
import styles from './GovernanceCommandCenter.module.css';
import { CONTRACT_ADDRESSES, publicClient, getWalletClient } from '../utils/web3.js';
import { encodeFunctionData, parseEther, keccak256, toHex } from 'viem';
import { UI_STRINGS } from '../constants/strings.js';
import { generateQuantumKeyPair, signWinternitzMessage } from '../utils/pqc.js';
import { Card, Badge, Button, StatCard } from './common/index.js';

interface GovernanceCommandCenterProps {
  web3Data: any;
  adminActions: any;
  isAdmin: boolean;
}

export const GovernanceCommandCenter: React.FC<GovernanceCommandCenterProps> = ({
  web3Data,
  adminActions,
  isAdmin: _isAdmin
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'metrics' | 'parameters' | 'wallets' | 'promotions' | 'security'>('metrics');

  // Promo form state
  const [promoName, setPromoName] = useState('');
  const [promoAmount, setPromoAmount] = useState('1000');

  // Parameter sliders state
  const [depositFeeInput, setDepositFeeInput] = useState('0.50');
  const [redeemFeeInput, setRedeemFeeInput] = useState('1.00');
  const [p2pFeeInput, setP2pFeeInput] = useState('0.50');

  // Post-Quantum Cryptography (PQC W-OTS+) state
  const [pqcKeyPair, setPqcKeyPair] = useState<{ seeds: `0x${string}`[]; publicKeys: `0x${string}`[]; commitmentRoot: `0x${string}` } | null>(null);
  const [pqcCommitment, setPqcCommitment] = useState<string>('');
  const [pqcStatusMsg, setPqcStatusMsg] = useState<string>('');
  const [isPqcProcessing, setIsPqcProcessing] = useState<boolean>(false);

  const {
    navPerShareNum,
    proofOfReserves,
    totalBurnedTokens,
    porBreakdown,
    targetWeights
  } = web3Data;

  const twStables = targetWeights?.stables ?? 60.00;
  const twWbtc = targetWeights?.wbtc ?? 26.67;
  const twWeth = targetWeights?.weth ?? 13.33;
  const twAlts = targetWeights?.alts ?? 0.00;

  // Map porBreakdown to the reserveBreakdown shape
  const reserveBreakdown = porBreakdown ? {
    usdcUsd: String(porBreakdown.stables ?? 0),
    wbtcUsd: String(porBreakdown.wbtc ?? 0),
    wethUsd: String(porBreakdown.weth ?? 0),
    stakedAlphaUsd: String(porBreakdown.alphaStaking ?? 0)
  } : { usdcUsd: '0', wbtcUsd: '0', wethUsd: '0', stakedAlphaUsd: '0' };

  const isProductionChain = web3Data.chainId !== 31337 && web3Data.chainId !== undefined;
  const currentChainId = web3Data.chainId ?? 31337;

  const totalAssetsVal = parseFloat(proofOfReserves?.totalAssetsUSD || '0');
  const totalLiabVal = parseFloat(proofOfReserves?.totalLiabilitiesUSD || '0');
  const solvencyRatio = totalLiabVal > 0 ? ((totalAssetsVal / totalLiabVal) * 100).toFixed(2) : '100.00';
  const navValueNum = navPerShareNum !== undefined ? navPerShareNum : 1.0;
  const burnedTokensStr = totalBurnedTokens || '0.00';

  const submitGovernanceProposal = async (target: `0x${string}`, data: `0x${string}`, description: string) => {
    try {
      const client = getWalletClient(web3Data.activeKey);
      const governorAddress = CONTRACT_ADDRESSES.GOVERNOR;
      if (!governorAddress) throw new Error('Dirección de Governor no configurada');
      const tx = await client.writeContract({
        address: governorAddress as `0x${string}`,
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
        args: [target, 0n, data]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      alert(`🏛️ PROPUESTA DE GOBERNANZA ENVIADA ON-CHAIN:
      
Hash Transacción: ${tx}
Objetivo: ${target}
Descripción: "${description}"

✅ Transacción enviada exitosamente a GovernorAlphaCentauri.propose()
⏱️ Período de Votación Abierto -> Retraso Timelock Mandatory: 72 Horas`);
      if (web3Data.fetchData) await web3Data.fetchData();
    } catch (err: any) {
      console.error('Error enviando propuesta DAO:', err);
      alert(`⚠️ Transacción enviada a GovernorAlphaCentauri.propose(): ${err.message || err}`);
    }
  };

  const handleGeneratePqcKeys = () => {
    try {
      setIsPqcProcessing(true);
      const kp = generateQuantumKeyPair();
      setPqcKeyPair(kp);
      setPqcStatusMsg(`⚡ Par de claves post-cuánticas generado (67 cadenas W-OTS+). Raíz: ${kp.commitmentRoot.slice(0, 18)}...`);
    } catch (err: any) {
      setPqcStatusMsg(`Error generando claves PQC: ${err.message || err}`);
    } finally {
      setIsPqcProcessing(false);
    }
  };

  const handleRegisterCommitmentOnChain = async () => {
    if (!pqcKeyPair) return;
    try {
      setIsPqcProcessing(true);
      setPqcStatusMsg('Enviando raíz de compromiso a PostQuantumGuard.sol en blockchain...');
      const client = getWalletClient(web3Data.activeKey);
      const targetContract = (CONTRACT_ADDRESSES as any).POST_QUANTUM_GUARD;
      if (!targetContract || targetContract === '0x0000000000000000000000000000000000000000') {
        throw new Error('Contrato PostQuantumGuard no configurado o no desplegado');
      }
      const tx = await client.writeContract({
        address: targetContract as `0x${string}`,
        abi: [
          {
            name: 'registerQuantumCommitment',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [{ name: 'commitmentRoot', type: 'bytes32' }],
            outputs: []
          }
        ] as const,
        functionName: 'registerQuantumCommitment',
        args: [pqcKeyPair.commitmentRoot]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setPqcCommitment(pqcKeyPair.commitmentRoot);
      setPqcStatusMsg(`✅ Compromiso Post-Cuántica anclado con éxito. Tx: ${tx.slice(0, 16)}...`);
    } catch (err: any) {
      setPqcStatusMsg(`Error registrando compromiso cuántico: ${err.message || err}`);
    } finally {
      setIsPqcProcessing(false);
    }
  };

  const handleTestQuantumVerification = async () => {
    if (!pqcKeyPair || !pqcCommitment) return;
    try {
      setIsPqcProcessing(true);
      setPqcStatusMsg('Firmando acción administrativa con W-OTS+ y verificando on-chain...');
      const client = getWalletClient(web3Data.activeKey);
      const targetContract = (CONTRACT_ADDRESSES as any).POST_QUANTUM_GUARD;
      const actionId = keccak256(toHex(`PQC_ACTION_${Date.now()}`));
      const signature = signWinternitzMessage(actionId, pqcKeyPair.seeds);

      const tx = await client.writeContract({
        address: targetContract as `0x${string}`,
        abi: [
          {
            name: 'authorizeActionWithQuantumSignature',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'commitmentRoot', type: 'bytes32' },
              { name: 'actionId', type: 'bytes32' },
              { name: 'signature', type: 'bytes32[]' }
            ],
            outputs: []
          }
        ] as const,
        functionName: 'authorizeActionWithQuantumSignature',
        args: [pqcKeyPair.commitmentRoot as `0x${string}`, actionId, signature]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setPqcStatusMsg(`🛡️ ¡Acción certificada y ejecutada con Firma Cuántica W-OTS+! Tx: ${tx.slice(0, 16)}...`);
    } catch (err: any) {
      setPqcStatusMsg(`Error verificando firma cuántica: ${err.message || err}`);
    } finally {
      setIsPqcProcessing(false);
    }
  };

  return (
    <Card
      variant="surface"
      collapsible
      defaultExpanded={true}
      headerTitle={`⚖️ ${UI_STRINGS.GOVERNANCE.TITLE}`}
      headerSubtitle={UI_STRINGS.GOVERNANCE.SUBTITLE}
      headerAction={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Badge variant="blue" size="sm">
            EVM Chain {currentChainId}
          </Badge>
          <Badge variant="emerald" size="sm">
            <span data-testid="admin-por-solvency-ratio">{solvencyRatio}% Solvencia</span>
          </Badge>
          <Badge variant="purple" size="sm">
            <span data-testid="admin-nav-per-share">${navValueNum.toFixed(4)} NAV</span>
          </Badge>
        </div>
      }
    >
      <div className={styles.container}>
        {/* 🧭 Navegación de Sub-Pestañas Institucional */}
        <div className={styles.subTabsBar}>
          {[
            { key: 'metrics', label: UI_STRINGS.GOVERNANCE.TAB_AUDIT_METRICS, icon: '📊' },
            { key: 'parameters', label: UI_STRINGS.GOVERNANCE.TAB_PARAM_CONTROL, icon: '⚙️' },
            { key: 'wallets', label: UI_STRINGS.GOVERNANCE.TAB_PROTOCOL_VAULTS, icon: '💼' },
            { key: 'promotions', label: UI_STRINGS.GOVERNANCE.TAB_PROMOTIONS, icon: '🎁' },
            { key: 'security', label: UI_STRINGS.GOVERNANCE.TAB_SECURITY, icon: '🛡️' }
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              data-testid={`admin-subtab-${tab.key}`}
              onClick={() => setActiveSubTab(tab.key as any)}
              className={activeSubTab === tab.key ? styles.subTabBtnActive : styles.subTabBtn}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* TAB 1: MÉTRICAS Y TABLA DE ASIGNACIONES */}
        {activeSubTab === 'metrics' && (
          <div>
            <div className={styles.metricsGrid}>
              <StatCard
                title={UI_STRINGS.METRICS.TOTAL_ASSETS_LABEL}
                value={
                  <span data-testid="admin-total-assets-por">
                    ${totalAssetsVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                }
                variant="blue"
                icon="🏦"
                subtext={UI_STRINGS.GOVERNANCE.COVERAGE_VERIFIED}
              />

              <StatCard
                title={UI_STRINGS.STAKING.METRIC_TOTAL_BURNED}
                value={
                  <span data-testid="admin-deflation-accumulated">
                    {burnedTokensStr} {UI_STRINGS.COMMON.SYMBOL_ALPHA}
                  </span>
                }
                variant="crimson"
                icon="🔥"
                subtext={UI_STRINGS.GOVERNANCE.BURNED_BY_FEES}
              />

              <StatCard
                title={UI_STRINGS.GOVERNANCE.INCOME_MODEL_TITLE}
                value={UI_STRINGS.GOVERNANCE.INCOME_MODEL_DESC}
                variant="emerald"
                icon="📈"
                subtext={UI_STRINGS.GOVERNANCE.INCOME_MODEL_AUTODISTRIB}
              />
            </div>

            <h3 className={styles.sectionHeading}>
              <span>🎯</span>
              <span>
                {UI_STRINGS.GOVERNANCE.SECTION_TARGET_DISTRIB} ({twStables.toFixed(1)} / {twWbtc.toFixed(1)} / {twWeth.toFixed(1)} / {twAlts.toFixed(1)})
              </span>
            </h3>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr className={styles.thRow}>
                    <th className={styles.thCell}>{UI_STRINGS.METRICS.TH_ASSET}</th>
                    <th className={styles.thCell}>{UI_STRINGS.GOVERNANCE.TH_REAL_USD_VAL}</th>
                    <th className={styles.thCell}>{UI_STRINGS.METRICS.TH_TARGET_WEIGHT}</th>
                    <th className={styles.thCell}>{UI_STRINGS.GOVERNANCE.TH_TREASURY_ROLE}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className={styles.trBorder}>
                    <td data-label="Activo" className={styles.tdBold}>💵 {UI_STRINGS.COMMON.SYMBOL_USDC} (Sub-Reserva Exógena)</td>
                    <td data-label="Valoración">${parseFloat(reserveBreakdown?.usdcUsd || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</td>
                    <td data-label="Ponderación Objetivo" className={styles.tdGreen}>{twStables.toFixed(2)}%</td>
                    <td data-label="Rol Fiduciario" className={styles.tdMuted}>{UI_STRINGS.GOVERNANCE.ROLE_MORPHO_P2P}</td>
                  </tr>
                  <tr className={styles.trBorder}>
                    <td data-label="Activo" className={styles.tdBold}>₿ Wrapped Bitcoin ({UI_STRINGS.COMMON.SYMBOL_WBTC})</td>
                    <td data-label="Valoración">${parseFloat(reserveBreakdown?.wbtcUsd || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</td>
                    <td data-label="Ponderación Objetivo" className={styles.tdGreen}>{twWbtc.toFixed(2)}%</td>
                    <td data-label="Rol Fiduciario" className={styles.tdMuted}>{UI_STRINGS.GOVERNANCE.ROLE_DEX_BUYS}</td>
                  </tr>
                  <tr className={styles.trBorder}>
                    <td data-label="Activo" className={styles.tdBold}>Ξ Wrapped Ethereum ({UI_STRINGS.COMMON.SYMBOL_WETH})</td>
                    <td data-label="Valoración">${parseFloat(reserveBreakdown?.wethUsd || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</td>
                    <td data-label="Ponderación Objetivo" className={styles.tdGreen}>{twWeth.toFixed(2)}%</td>
                    <td data-label="Rol Fiduciario" className={styles.tdMuted}>{UI_STRINGS.GOVERNANCE.ROLE_DEX_BUYS}</td>
                  </tr>
                  <tr className={styles.trBorder}>
                    <td data-label="Activo" className={styles.tdBold}>🥩 Native {UI_STRINGS.COMMON.SYMBOL_ALPHA} Staked</td>
                    <td data-label="Valoración">${parseFloat(reserveBreakdown?.stakedAlphaUsd || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</td>
                    <td data-label="Ponderación Objetivo" className={styles.tdGreen}>{twAlts.toFixed(2)}%</td>
                    <td data-label="Rol Fiduciario" className={styles.tdMuted}>{UI_STRINGS.GOVERNANCE.ROLE_AUTO_STAKE}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: CONTROL DE PARÁMETROS */}
        {activeSubTab === 'parameters' && (
          <div>
            <h3 className={styles.sectionHeading}>
              <span>⚙️</span>
              <span>{UI_STRINGS.GOVERNANCE.SECTION_GLOBAL_CONFIG}</span>
            </h3>

            {isProductionChain && (
              <div className={styles.pureBanner}>
                🏛️ <strong>Pure DeFi Governance Active (Mainnet Live - Chain ID {currentChainId})</strong>: Ajusta los parámetros en las casillas inferiores y pulsa <strong>"{UI_STRINGS.GOVERNANCE.BTN_PROPOSE_DAO}"</strong> para firmar y enviar la propuesta on-chain a <code>GovernorAlphaCentauri.sol</code>.
              </div>
            )}

            <div className={styles.paramGrid}>
              <div className={styles.paramCard}>
                <span className={styles.paramLabel}>{UI_STRINGS.GOVERNANCE.LABEL_DEPOSIT_FEE_PCT}</span>
                <div className={styles.paramRow}>
                  <input
                    type="number"
                    step="0.1"
                    value={depositFeeInput}
                    onChange={(e) => setDepositFeeInput(e.target.value)}
                    className={styles.paramInput}
                  />
                  <Button
                    variant={isProductionChain ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={async () => {
                      if (isProductionChain) {
                        const bps = BigInt(Math.round(parseFloat(depositFeeInput || '0') * 100));
                        const calldata = encodeFunctionData({
                          abi: [{ name: 'setDepositFee', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'feeBps', type: 'uint256' }], outputs: [] }] as const,
                          functionName: 'setDepositFee',
                          args: [bps]
                        });
                        await submitGovernanceProposal(CONTRACT_ADDRESSES.TREASURY, calldata, `Ajustar Comisión de Depósito Tesorería a ${depositFeeInput}% (${bps} Bps)`);
                      } else {
                        alert(`🧪 [Sandbox - Chain 31337] Comisión de depósito simulada a ${depositFeeInput}%`);
                      }
                    }}
                  >
                    {isProductionChain ? UI_STRINGS.GOVERNANCE.BTN_PROPOSE_DAO : UI_STRINGS.GOVERNANCE.BTN_SAVE_SANDBOX}
                  </Button>
                </div>
                <span className={styles.paramSubtext}>
                  Actual: {depositFeeInput}% ({Math.round(parseFloat(depositFeeInput || '0') * 100)} Bps)
                </span>
              </div>

              <div className={styles.paramCard}>
                <span className={styles.paramLabel}>{UI_STRINGS.GOVERNANCE.LABEL_REDEEM_FEE_PCT}</span>
                <div className={styles.paramRow}>
                  <input
                    type="number"
                    step="0.1"
                    value={redeemFeeInput}
                    onChange={(e) => setRedeemFeeInput(e.target.value)}
                    className={styles.paramInput}
                  />
                  <Button
                    variant={isProductionChain ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={async () => {
                      if (isProductionChain) {
                        const bps = BigInt(Math.round(parseFloat(redeemFeeInput || '0') * 100));
                        const calldata = encodeFunctionData({
                          abi: [{ name: 'setRedeemFee', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'feeBps', type: 'uint256' }], outputs: [] }] as const,
                          functionName: 'setRedeemFee',
                          args: [bps]
                        });
                        await submitGovernanceProposal(CONTRACT_ADDRESSES.TREASURY, calldata, `Ajustar Comisión de Canje Directo / Redeem a ${redeemFeeInput}% (${bps} Bps)`);
                      } else {
                        alert(`🧪 [Sandbox - Chain 31337] Comisión de canje simulada a ${redeemFeeInput}%`);
                      }
                    }}
                  >
                    {isProductionChain ? UI_STRINGS.GOVERNANCE.BTN_PROPOSE_DAO : UI_STRINGS.GOVERNANCE.BTN_SAVE_SANDBOX}
                  </Button>
                </div>
                <span className={styles.paramSubtext}>
                  Actual: {redeemFeeInput}% ({Math.round(parseFloat(redeemFeeInput || '0') * 100)} Bps)
                </span>
              </div>

              <div className={styles.paramCard}>
                <span className={styles.paramLabel}>{UI_STRINGS.GOVERNANCE.LABEL_P2P_FEE_PCT}</span>
                <div className={styles.paramRow}>
                  <input
                    type="number"
                    step="0.1"
                    value={p2pFeeInput}
                    onChange={(e) => setP2pFeeInput(e.target.value)}
                    className={styles.paramInput}
                  />
                  <Button
                    variant={isProductionChain ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={async () => {
                      if (isProductionChain) {
                        const bps = BigInt(Math.round(parseFloat(p2pFeeInput || '0') * 100));
                        const calldata = encodeFunctionData({
                          abi: [{ name: 'setFeeBps', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'feeBps', type: 'uint256' }], outputs: [] }] as const,
                          functionName: 'setFeeBps',
                          args: [bps]
                        });
                        await submitGovernanceProposal(CONTRACT_ADDRESSES.P2P_MARKET, calldata, `Ajustar Fee de Originación Préstamos P2P a ${p2pFeeInput}% (${bps} Bps)`);
                      } else {
                        alert(`🧪 [Sandbox - Chain 31337] Fee de originación simulado a ${p2pFeeInput}%`);
                      }
                    }}
                  >
                    {isProductionChain ? UI_STRINGS.GOVERNANCE.BTN_PROPOSE_DAO : UI_STRINGS.GOVERNANCE.BTN_SAVE_SANDBOX}
                  </Button>
                </div>
                <span className={styles.paramSubtext}>
                  Actual: {p2pFeeInput}% ({Math.round(parseFloat(p2pFeeInput || '0') * 100)} Bps)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: BÓVEDAS DEL PROTOCOLO */}
        {activeSubTab === 'wallets' && (
          <div>
            <h3 className={styles.sectionHeading}>
              <span>💼</span>
              <span>{UI_STRINGS.GOVERNANCE.SECTION_VAULT_ADDRESSES}</span>
            </h3>

            <div className={styles.vaultStack}>
              <div className={styles.vaultItem}>
                <div className={styles.vaultHeader}>
                  <span className={styles.vaultLabel}>{UI_STRINGS.GOVERNANCE.LABEL_BUNKER_WALLET}</span>
                  <Badge variant="blue" size="sm">Cold Storage Multisig</Badge>
                </div>
                <input
                  type="text"
                  readOnly
                  value={web3Data.contractAddresses?.TREASURY || '0x...'}
                  className={styles.vaultInput}
                />
              </div>

              <div className={styles.vaultItem}>
                <div className={styles.vaultHeader}>
                  <span className={styles.vaultLabel}>{UI_STRINGS.GOVERNANCE.LABEL_COMMUNITY_YIELD_VAULT}</span>
                  <Badge variant="emerald" size="sm">Yield Distribution</Badge>
                </div>
                <input
                  type="text"
                  readOnly
                  value={CONTRACT_ADDRESSES.COMMUNITY_YIELD_VAULT || '0x...'}
                  className={styles.vaultInput}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PROMOCIONES Y CAMPAÑAS */}
        {activeSubTab === 'promotions' && (
          <div>
            <h3 className={styles.sectionHeading}>
              <span>🎁</span>
              <span>{UI_STRINGS.GOVERNANCE.SECTION_PROMOS_TITLE}</span>
            </h3>

            <div className={styles.promoForm}>
              <div className={styles.twoColInputs}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className={styles.paramLabel}>{UI_STRINGS.ADMIN.LABEL_CAMPAIGN_NAME}</label>
                  <input
                    type="text"
                    placeholder="Ej. Summer APY Boost 2026"
                    value={promoName}
                    onChange={(e) => setPromoName(e.target.value)}
                    className={styles.paramInput}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className={styles.paramLabel}>{UI_STRINGS.ADMIN.LABEL_CAMPAIGN_AMOUNT}</label>
                  <input
                    type="number"
                    placeholder="1000"
                    value={promoAmount}
                    onChange={(e) => setPromoAmount(e.target.value)}
                    className={styles.paramInput}
                  />
                </div>
              </div>

              <Button
                variant={promoName && promoAmount ? 'emerald' : 'secondary'}
                size="md"
                disabled={!promoName || !promoAmount}
                onClick={async () => {
                  if (!promoName || !promoAmount) return;
                  if (isProductionChain) {
                    const amountWei = parseEther(promoAmount);
                    const calldata = encodeFunctionData({
                      abi: [{ name: 'createCampaign', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'name', type: 'string' }, { name: 'rewardAmount', type: 'uint256' }], outputs: [{ name: 'campaignId', type: 'uint256' }] }] as const,
                      functionName: 'createCampaign',
                      args: [promoName, amountWei]
                    });
                    await submitGovernanceProposal(CONTRACT_ADDRESSES.PROMOTIONAL_VAULT, calldata, `Aprobación de Presupuesto de Incentivos para "${promoName}" por ${promoAmount} ALPHA`);
                  } else {
                    adminActions.handleCreateCampaign(promoName, promoAmount);
                  }
                }}
              >
                {isProductionChain ? UI_STRINGS.GOVERNANCE.BTN_PROPOSE_PROMO : UI_STRINGS.GOVERNANCE.BTN_ACTIVATE_PROMO}
              </Button>
            </div>
          </div>
        )}

        {/* TAB 5: SEGURIDAD & BLINDAJE POST-CUÁNTICO */}
        {activeSubTab === 'security' && (
          <div>
            <h3 className={styles.sectionHeading}>
              <span>🛡️</span>
              <span>{UI_STRINGS.GOVERNANCE.SECTION_SECURITY_TITLE}</span>
            </h3>

            <div className={styles.secGrid}>
              <div className={styles.secCard}>
                <div>
                  <h4 className={styles.secTitle}>⚡ {UI_STRINGS.GOVERNANCE.SUBTITLE_RESET_BREAKER}</h4>
                  <p className={styles.secDesc}>
                    {UI_STRINGS.GOVERNANCE.DESC_RESET_BREAKER}
                  </p>
                </div>
                <Button
                  variant={isProductionChain ? 'primary' : 'danger'}
                  size="sm"
                  onClick={async () => {
                    if (isProductionChain) {
                      const calldata = encodeFunctionData({
                        abi: [{ name: 'resetBreaker', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'asset', type: 'address' }], outputs: [] }] as const,
                        functionName: 'resetBreaker',
                        args: [CONTRACT_ADDRESSES.USDC]
                      });
                      await submitGovernanceProposal(CONTRACT_ADDRESSES.CIRCUIT_BREAKER, calldata, 'Descongelar Circuit Breaker para Reserva USDC (Propuesta DAO / Multisig Security Council)');
                    } else {
                      adminActions.handleResetBreaker();
                    }
                  }}
                >
                  {isProductionChain ? UI_STRINGS.GOVERNANCE.BTN_PROPOSE_RESET_BREAKER : UI_STRINGS.GOVERNANCE.BTN_RESET_BREAKER_DEV}
                </Button>
              </div>

              <div className={styles.secCard}>
                <div>
                  <h4 className={styles.secTitle}>🔮 {UI_STRINGS.ADMIN.CARD_ORACLE_TITLE}</h4>
                  <p className={styles.secDesc}>
                    {isProductionChain ? UI_STRINGS.GOVERNANCE.DESC_ORACLE_PROD : UI_STRINGS.GOVERNANCE.DESC_ORACLE_DEV}
                  </p>
                </div>
                <div className={styles.paramRow}>
                  <input
                    type="text"
                    value={adminActions.oraclePrice}
                    onChange={(e) => adminActions.setOraclePrice(e.target.value)}
                    className={styles.paramInput}
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={async () => {
                      if (isProductionChain) {
                        const calldata = encodeFunctionData({
                          abi: [{ name: 'setPriceFeed', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'asset', type: 'address' }, { name: 'feed', type: 'address' }], outputs: [] }] as const,
                          functionName: 'setPriceFeed',
                          args: [CONTRACT_ADDRESSES.USDC, CONTRACT_ADDRESSES.PRICE_FEED]
                        });
                        await submitGovernanceProposal(CONTRACT_ADDRESSES.PRICE_FEED, calldata, `Propuesta de Actualización de Feed Oráculo Primary USDC a $${adminActions.oraclePrice}`);
                      } else {
                        adminActions.handleUpdateOracle();
                      }
                    }}
                  >
                    {isProductionChain ? UI_STRINGS.GOVERNANCE.BTN_PROPOSE_FEED : UI_STRINGS.GOVERNANCE.BTN_UPDATE_FEED}
                  </Button>
                </div>
              </div>
            </div>

            {/* PQC GUARD CARD */}
            <div className={styles.pqcCard}>
              <div className={styles.pqcHeader}>
                <h4 className={styles.pqcTitle}>
                  <span>⚛️</span>
                  <span>Blindaje Criptográfico Post-Cuántico (NIST SP 800-208 / W-OTS+)</span>
                </h4>
                <Badge variant="blue" size="sm">
                  Grover-Resistant O(2^128)
                </Badge>
              </div>

              <p className={styles.secDesc}>
                Módulo institucional de resistencia post-cuántica que protege las acciones críticas de gobernanza y tesorería frente a ataques de ordenadores cuánticos (algoritmos de Shor y Grover). Implementa esquemas de firma basados en hash de Winternitz (W-OTS+ w=4, 67 cadenas) verificados directamente por el contrato inteligente <code>PostQuantumGuard.sol</code>.
              </p>

              <div className={styles.pqcInfoGrid}>
                <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>CONTRATO POST-CUÁNTICO:</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-primary)', wordBreak: 'break-all', marginTop: '4px' }}>
                    {(CONTRACT_ADDRESSES as any).POST_QUANTUM_GUARD || '0x...'}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>ESTADO DE COMPROMISO ACTIVO:</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: pqcCommitment ? 'var(--color-emerald-light)' : 'var(--color-amber-light)', wordBreak: 'break-all', marginTop: '4px' }}>
                    {pqcCommitment ? `Raíz On-Chain: ${pqcCommitment.slice(0, 10)}...${pqcCommitment.slice(-8)}` : 'Sin Compromiso Activo en Sesión'}
                  </div>
                </div>
              </div>

              {pqcStatusMsg && (
                <div className={pqcStatusMsg.includes('Error') ? styles.pqcStatusError : styles.pqcStatusSuccess}>
                  {pqcStatusMsg}
                </div>
              )}

              <div className={styles.pqcButtons}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleGeneratePqcKeys}
                  disabled={isPqcProcessing}
                >
                  ⚡ Generar Par de Claves Cuánticas W-OTS+
                </Button>

                {pqcKeyPair && (
                  <Button
                    variant="emerald"
                    size="sm"
                    onClick={handleRegisterCommitmentOnChain}
                    disabled={isPqcProcessing}
                  >
                    📝 Registrar Raíz de Compromiso On-Chain
                  </Button>
                )}

                {pqcKeyPair && pqcCommitment && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleTestQuantumVerification}
                    disabled={isPqcProcessing}
                  >
                    🛡️ Certificar Acción con Firma Cuántica
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
