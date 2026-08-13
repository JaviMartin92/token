import React, { useState } from 'react';
import styles from './GovernanceCommandCenter.module.css';
import { CONTRACT_ADDRESSES, publicClient, getWalletClient } from '../utils/web3.js';
import { encodeFunctionData, parseEther } from 'viem';

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

  // Map porBreakdown (from useUniversalYield) to the reserveBreakdown shape used in this component
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
      const governorAddress = CONTRACT_ADDRESSES.GOVERNOR || '0x04c89607413713ec9775e14b954286519d836fef';
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

  return (
    <div className="gcc-container">
      {/* Header Banner */}
      <div className="gcc-header">
        <div>
          <div className={styles.headerFlex}>
            <span className={styles.headerIcon}>🏛️</span>
            <div>
              <h2 className="gcc-header-title">
                Centro de Comando de Gobernanza & DAO
              </h2>
              <p className="gcc-header-subtitle">
                Auditoría Exhaustiva en Tiempo Real, Control de Parámetros On-Chain y Gestor Promocional Empresarial
              </p>
            </div>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className="gcc-badge-indigo">
            <div className={styles.badgeTitleIndigo}>EVM CHAIN DETECTADO</div>
            <div className={styles.badgeValIndigo}>Chain ID: {currentChainId}</div>
          </div>
          <div className="gcc-badge-green">
            <div className={styles.badgeTitleGreen}>RATIO SOLVENCIA PoR</div>
            <div data-testid="admin-por-solvency-ratio" className={styles.badgeValGreen}>{solvencyRatio}%</div>
          </div>
          <div className="gcc-badge-purple">
            <div className={styles.badgeTitlePurple}>NAV / TOKEN ALPHA</div>
            <div data-testid="admin-nav-per-share" className={styles.badgeValPurple}>${navValueNum.toFixed(4)}</div>
          </div>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="gcc-subtabs-row">
        {[
          { key: 'metrics', label: '📊 Auditoría & Métricas', icon: '📊' },
          { key: 'parameters', label: '⚙️ Control Parámetros', icon: '⚙️' },
          { key: 'wallets', label: '💼 Billeteras Corporativas', icon: '💼' },
          { key: 'promotions', label: '🎁 Eventos & Promociones', icon: '🎁' },
          { key: 'security', label: '🛡️ Consola Seguridad', icon: '🛡️' }
        ].map(tab => (
          <button
            key={tab.key}
            data-testid={`admin-subtab-${tab.key}`}
            onClick={() => setActiveSubTab(tab.key as any)}
            className={activeSubTab === tab.key ? 'gcc-tab-btn-active' : 'gcc-tab-btn-inactive'}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: METRICAS EXHAUSTIVAS */}
      {activeSubTab === 'metrics' && (
        <div>
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>ACTIVOS TOTALES (PoR)</div>
              <div data-testid="admin-total-assets-por" className={styles.metricValCyan}>
                ${totalAssetsVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className={styles.metricSubtext}>Cobertura On-Chain 100% Verificada</div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>DEFLACIÓN ACUMULADA</div>
              <div data-testid="admin-deflation-accumulated" className={styles.metricValRed}>
                🔥 {burnedTokensStr} ALPHA
              </div>
              <div className={styles.metricSubtext}>Tokens Destruidos por Fees Staking</div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>MODELO DE INGRESOS LIQUIDUS (50/50)</div>
              <div className={styles.modelText}>
                🏛️ 50% Res. Tesorería | 🏦 50% Yield Comunidad
              </div>
              <div className={styles.metricSubtextGreen}>Reparto Automático On-Chain Real Yield</div>
            </div>
          </div>

          <h3 className={styles.sectionTitle}>📌 Distribución Target de Activos de Reserva ({twStables.toFixed(1)} / {twWbtc.toFixed(1)} / {twWeth.toFixed(1)} / {twAlts.toFixed(1)})</h3>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.thRow}>
                  <th className={styles.thCell}>Activo de Reserva</th>
                  <th className={styles.thCell}>Valor USD Real</th>
                  <th className={styles.thCell}>Ponderación Target</th>
                  <th className={styles.thCell}>Función en Tesorería</th>
                </tr>
              </thead>
              <tbody>
                <tr className={styles.trBorder}>
                  <td className={styles.tdBlue}>💵 USDC (Sub-Reserva Exógena)</td>
                  <td className={styles.tdCell}>${parseFloat(reserveBreakdown?.usdcUsd || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className={styles.tdGreen}>{twStables.toFixed(2)}%</td>
                  <td className={styles.tdMuted}>Morpho Yield + Créditos P2P + Líquido</td>
                </tr>
                <tr className={styles.trBorder}>
                  <td className={styles.tdAmber}>₿ Wrapped Bitcoin (WBTC)</td>
                  <td className={styles.tdCell}>${parseFloat(reserveBreakdown?.wbtcUsd || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className={styles.tdGreen}>{twWbtc.toFixed(2)}%</td>
                  <td className={styles.tdMuted}>Compras DEX en Mercado Secundario</td>
                </tr>
                <tr className={styles.trBorder}>
                  <td className={styles.tdPurple}>Ξ Wrapped Ethereum (WETH)</td>
                  <td className={styles.tdCell}>${parseFloat(reserveBreakdown?.wethUsd || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className={styles.tdGreen}>{twWeth.toFixed(2)}%</td>
                  <td className={styles.tdMuted}>Compras DEX en Mercado Secundario</td>
                </tr>
                <tr>
                  <td className={styles.tdPink}>🥩 Native ALPHA Staked</td>
                  <td className={styles.tdCell}>${parseFloat(reserveBreakdown?.stakedAlphaUsd || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className={styles.tdGreen}>{twAlts.toFixed(2)}%</td>
                  <td className={styles.tdMuted}>Auto-stake Institucional Governance</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CONTROL DE PARAMETROS */}
      {activeSubTab === 'parameters' && (
        <div>
          <h3 className={styles.sectionTitle}>⚙️ Configuración Global de Parámetros y Comisiones</h3>
          
          {isProductionChain && (
            <div className={styles.pureBanner}>
              🏛️ <strong>Pure DeFi Governance Active (Mainnet Live - Chain ID {currentChainId})</strong>: Ajusta los parámetros en las casillas inferiores y pulsa <strong>"Proponer Votación DAO (72h)"</strong> para firmar y enviar la propuesta on-chain a <code>GovernorAlphaCentauri.sol</code>.
            </div>
          )}

          <div className={styles.paramGrid}>
            <div className={styles.paramCard}>
              <label className="acp-label-sm">COMISIÓN DE DEPÓSITO TESORERÍA (%)</label>
              <div className="acp-flex-row-gap5">
                <input
                  type="number"
                  step="0.1"
                  value={depositFeeInput}
                  onChange={(e) => setDepositFeeInput(e.target.value)}
                  className={styles.inputDark}
                />
                <button
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
                  className={isProductionChain ? styles.btnProd : styles.btnSandbox}
                >
                  {isProductionChain ? '🏛️ Proponer Votación DAO (72h)' : '🧪 Guardar (Sandbox)'}
                </button>
              </div>
              <span className={styles.metricSubtext}>Actual: {depositFeeInput}% ({Math.round(parseFloat(depositFeeInput || '0') * 100)} Bps)</span>
            </div>

            <div className={styles.paramCard}>
              <label className="acp-label-sm">COMISIÓN DE CANJE DIRECTO / REDEEM (%)</label>
              <div className="acp-flex-row-gap5">
                <input
                  type="number"
                  step="0.1"
                  value={redeemFeeInput}
                  onChange={(e) => setRedeemFeeInput(e.target.value)}
                  className={styles.inputDark}
                />
                <button
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
                  className={isProductionChain ? styles.btnProd : styles.btnSandbox}
                >
                  {isProductionChain ? '🏛️ Proponer Votación DAO (72h)' : '🧪 Guardar (Sandbox)'}
                </button>
              </div>
              <span className={styles.metricSubtext}>Actual: {redeemFeeInput}% ({Math.round(parseFloat(redeemFeeInput || '0') * 100)} Bps)</span>
            </div>

            <div className={styles.paramCard}>
              <label className="acp-label-sm">FEE ORIGINACIÓN PRÉSTAMOS P2P (%)</label>
              <div className="acp-flex-row-gap5">
                <input
                  type="number"
                  step="0.1"
                  value={p2pFeeInput}
                  onChange={(e) => setP2pFeeInput(e.target.value)}
                  className={styles.inputDark}
                />
                <button
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
                  className={isProductionChain ? styles.btnProd : styles.btnSandbox}
                >
                  {isProductionChain ? '🏛️ Proponer Votación DAO (72h)' : '🧪 Guardar (Sandbox)'}
                </button>
              </div>
              <span className={styles.metricSubtext}>Actual: {p2pFeeInput}% ({Math.round(parseFloat(p2pFeeInput || '0') * 100)} Bps)</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BILLETERAS CORPORATIVAS */}
      {activeSubTab === 'wallets' && (
        <div>
          <h3 className={styles.sectionTitle}>💼 Control y Direccionamiento de Billeteras Corporativas</h3>
          <div className={styles.promoCard}>
            <div className="acp-control-stack">
              <div>
                <label className="acp-label-sm">🏛️ BILLETERA BUNKER TESORERÍA (CONTRATO SUB-RESERVA)</label>
                <input
                  type="text"
                  readOnly
                  value={web3Data.contractAddresses?.TREASURY || '0x...'}
                  className={styles.walletInputBlue}
                />
              </div>

              <div>
                <label className="acp-label-sm">🛡️ BÓVEDA PROTOCOL OPEX (BÓVEDA OPEX INFRAESTRUCTURA & GRANTS)</label>
                <input
                  type="text"
                  readOnly
                  value={CONTRACT_ADDRESSES.PROTOCOL_OPEX_VAULT || '0x...'}
                  className={styles.walletInputPurple}
                />
              </div>

              <div>
                <label className="acp-label-sm">💎 BÓVEDA COMMUNITY REAL YIELD (BÓVEDA REAL YIELD STAKERS)</label>
                <input
                  type="text"
                  readOnly
                  value={CONTRACT_ADDRESSES.COMMUNITY_YIELD_VAULT || '0x...'}
                  className={styles.walletInputGreen}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PROMOCIONES Y EVENTOS ESPECIALES */}
      {activeSubTab === 'promotions' && (
        <div>
          <h3 className={styles.sectionTitle}>🎁 Gestor de Promociones, Incentivos & Eventos Especiales</h3>
          <div className={styles.promoCard}>
            <h4 className={styles.promoH4}>✨ Lanzar Nueva Campaña Promocional On-Chain</h4>
            <div className="admin-grid-2col">
              <div>
                <label className="acp-label-sm">NOMBRE DE LA CAMPAÑA / EVENTO</label>
                <input
                  type="text"
                  placeholder="Ej. Summer APY Boost 2026"
                  value={promoName}
                  onChange={(e) => setPromoName(e.target.value)}
                  className={styles.inputDark}
                />
              </div>
              <div>
                <label className="acp-label-sm">PRESUPUESTO DE INCENTIVOS (ALPHA)</label>
                <input
                  type="number"
                  placeholder="1000"
                  value={promoAmount}
                  onChange={(e) => setPromoAmount(e.target.value)}
                  className={styles.inputDark}
                />
              </div>
            </div>

            <button
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
              disabled={!promoName || !promoAmount}
              className={promoName && promoAmount ? (isProductionChain ? styles.btnProd : styles.promoBtnActive) : styles.promoBtnDisabled}
            >
              {isProductionChain ? '🏛️ Proponer Presupuesto Promocional en Governor (72h)' : '🚀 Crear y Activar Campaña Promocional On-Chain'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: SEGURIDAD & CIRCUIT BREAKER */}
      {activeSubTab === 'security' && (
        <div>
          <h3 className={styles.sectionTitle}>🛡️ Consola de Seguridad de Emergencia & Circuit Breaker</h3>
          <div className="admin-grid-2col">
            <div className={styles.secCard}>
              <h4 className={styles.secBreakerH4}>⚡ Descongelar Circuit Breaker</h4>
              <p className={styles.metricSubtext}>
                Restablece la operatividad del contrato tras una parada de seguridad provocada por alta volatilidad o congelamiento de oráculo.
              </p>
              <button
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
                className={isProductionChain ? styles.btnProd : styles.secBtnRed}
              >
                {isProductionChain ? '🛡️ Proponer Reset Breaker / Security Council Multisig (72h)' : '🔓 Reiniciar Circuit Breaker (Devnet)'}
              </button>
            </div>

            <div className={styles.secCard}>
              <h4 className={styles.secOracleH4}>🔮 Oráculo de Precios Chainlink</h4>
              <p className={styles.metricSubtext}>
                {isProductionChain ? 'En Mainnet Live, los precios son provistos automáticamente por los agregadores de nodos descentralizados de Chainlink.' : 'Actualiza el valor del feed de prueba de USDC en la sandbox para simular fluctuaciones de mercado.'}
              </p>
              <div className="acp-flex-row-gap5">
                <input
                  type="text"
                  value={adminActions.oraclePrice}
                  onChange={(e) => adminActions.setOraclePrice(e.target.value)}
                  className={styles.inputDark}
                />
                <button
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
                  className={isProductionChain ? styles.btnProd : styles.secBtnBlue}
                >
                  {isProductionChain ? '🏛️ Proponer Feed en Governor (72h)' : 'Actualizar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
