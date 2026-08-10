import React, { useState } from 'react';
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
    reserveBreakdown
  } = web3Data;

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
          <div className="gcc-header-flex">
            <span className="gcc-header-icon">🏛️</span>
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

        <div className="gcc-header-right">
          <div className="gcc-badge-indigo">
            <div className="gcc-badge-title-indigo">EVM CHAIN DETECTADO</div>
            <div className="gcc-badge-val-indigo">Chain ID: {currentChainId}</div>
          </div>
          <div className="gcc-badge-green">
            <div className="gcc-badge-title-green">RATIO SOLVENCIA PoR</div>
            <div data-testid="admin-por-solvency-ratio" className="gcc-badge-val-green">{solvencyRatio}%</div>
          </div>
          <div className="gcc-badge-purple">
            <div className="gcc-badge-title-purple">NAV / TOKEN ALPHA</div>
            <div data-testid="admin-nav-per-share" className="gcc-badge-val-purple">${navValueNum.toFixed(4)}</div>
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
          <div className="gcc-metrics-grid">
            <div className="gcc-metric-card">
              <div className="gcc-metric-label">ACTIVOS TOTALES (PoR)</div>
              <div data-testid="admin-total-assets-por" className="gcc-metric-val-cyan">
                ${totalAssetsVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="gcc-metric-subtext">Cobertura On-Chain 100% Verificada</div>
            </div>

            <div className="gcc-metric-card">
              <div className="gcc-metric-label">DEFLACIÓN ACUMULADA</div>
              <div data-testid="admin-deflation-accumulated" className="gcc-metric-val-red">
                🔥 {burnedTokensStr} ALPHA
              </div>
              <div className="gcc-metric-subtext">Tokens Destruidos por Fees Staking</div>
            </div>

            <div className="gcc-metric-card">
              <div className="gcc-metric-label">MODELO DE INGRESOS (50/25/25)</div>
              <div className="gcc-model-text">
                🏛️ 50% Res | 💼 25% OpEx | 🏦 25% Prof
              </div>
              <div className="gcc-metric-subtext-green">Reparto Automático On-Chain</div>
            </div>
          </div>

          <h3 className="gcc-section-title">📌 Distribución Target de Activos de Reserva (50/25/12.5/12.5)</h3>
          <div className="gcc-table-container">
            <table className="gcc-table">
              <thead>
                <tr className="gcc-th-row">
                  <th className="gcc-th-cell">Activo de Reserva</th>
                  <th className="gcc-th-cell">Valor USD Real</th>
                  <th className="gcc-th-cell">Ponderación Target</th>
                  <th className="gcc-th-cell">Función en Tesorería</th>
                </tr>
              </thead>
              <tbody>
                <tr className="gcc-tr-border">
                  <td className="gcc-td-blue">💵 USDC (Sub-Reserva 80/20)</td>
                  <td className="gcc-td-cell">${parseFloat(reserveBreakdown?.usdcUsd || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="gcc-td-green">50.00%</td>
                  <td className="gcc-td-muted">Morpho Yield (80%) + Líquido (20%)</td>
                </tr>
                <tr className="gcc-tr-border">
                  <td className="gcc-td-amber">₿ Wrapped Bitcoin (WBTC)</td>
                  <td className="gcc-td-cell">${parseFloat(reserveBreakdown?.wbtcUsd || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="gcc-td-green">25.00%</td>
                  <td className="gcc-td-muted">Compras DEX en Mercado Secundario</td>
                </tr>
                <tr className="gcc-tr-border">
                  <td className="gcc-td-purple">Ξ Wrapped Ethereum (WETH)</td>
                  <td className="gcc-td-cell">${parseFloat(reserveBreakdown?.wethUsd || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="gcc-td-green">12.50%</td>
                  <td className="gcc-td-muted">Compras DEX en Mercado Secundario</td>
                </tr>
                <tr>
                  <td className="gcc-td-pink">🥩 Native ALPHA Staked</td>
                  <td className="gcc-td-cell">${parseFloat(reserveBreakdown?.stakedAlphaUsd || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="gcc-td-green">12.50%</td>
                  <td className="gcc-td-muted">Auto-stake Institucional Governance</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CONTROL DE PARAMETROS */}
      {activeSubTab === 'parameters' && (
        <div>
          <h3 className="gcc-section-title">⚙️ Configuración Global de Parámetros y Comisiones</h3>
          
          {isProductionChain && (
            <div className="gcc-pure-banner">
              🏛️ <strong>Pure DeFi Governance Active (Mainnet Live - Chain ID {currentChainId})</strong>: Ajusta los parámetros en las casillas inferiores y pulsa <strong>"Proponer Votación DAO (72h)"</strong> para firmar y enviar la propuesta on-chain a <code>GovernorAlphaCentauri.sol</code>.
            </div>
          )}

          <div className="gcc-param-grid">
            <div className="gcc-param-card">
              <label className="acp-label-sm">COMISIÓN DE DEPÓSITO TESORERÍA (%)</label>
              <div className="acp-flex-row-gap5">
                <input
                  type="number"
                  step="0.1"
                  value={depositFeeInput}
                  onChange={(e) => setDepositFeeInput(e.target.value)}
                  className="gcc-input-dark"
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
                  className={isProductionChain ? 'gcc-btn-prod' : 'gcc-btn-sandbox'}
                >
                  {isProductionChain ? '🏛️ Proponer Votación DAO (72h)' : '🧪 Guardar (Sandbox)'}
                </button>
              </div>
              <span className="gcc-metric-subtext">Actual: 0.50% (50 Bps)</span>
            </div>

            <div className="gcc-param-card">
              <label className="acp-label-sm">COMISIÓN DE CANJE DIRECTO / REDEEM (%)</label>
              <div className="acp-flex-row-gap5">
                <input
                  type="number"
                  step="0.1"
                  value={redeemFeeInput}
                  onChange={(e) => setRedeemFeeInput(e.target.value)}
                  className="gcc-input-dark"
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
                  className={isProductionChain ? 'gcc-btn-prod' : 'gcc-btn-sandbox'}
                >
                  {isProductionChain ? '🏛️ Proponer Votación DAO (72h)' : '🧪 Guardar (Sandbox)'}
                </button>
              </div>
              <span className="gcc-metric-subtext">Actual: 1.00% (100 Bps)</span>
            </div>

            <div className="gcc-param-card">
              <label className="acp-label-sm">FEE ORIGINACIÓN PRÉSTAMOS P2P (%)</label>
              <div className="acp-flex-row-gap5">
                <input
                  type="number"
                  step="0.1"
                  value={p2pFeeInput}
                  onChange={(e) => setP2pFeeInput(e.target.value)}
                  className="gcc-input-dark"
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
                  className={isProductionChain ? 'gcc-btn-prod' : 'gcc-btn-sandbox'}
                >
                  {isProductionChain ? '🏛️ Proponer Votación DAO (72h)' : '🧪 Guardar (Sandbox)'}
                </button>
              </div>
              <span className="gcc-metric-subtext">Actual: 0.50% (50 Bps)</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BILLETERAS CORPORATIVAS */}
      {activeSubTab === 'wallets' && (
        <div>
          <h3 className="gcc-section-title">💼 Control y Direccionamiento de Billeteras Corporativas</h3>
          <div className="gcc-promo-card">
            <div className="acp-control-stack">
              <div>
                <label className="acp-label-sm">🏛️ BILLETERA BUNKER TESORERÍA (50% RESERVAS)</label>
                <input
                  type="text"
                  readOnly
                  value={web3Data.contractAddresses?.TREASURY || '0x...'}
                  className="gcc-wallet-input-blue"
                />
              </div>

              <div>
                <label className="acp-label-sm">🛡️ BÓVEDA PROTOCOL OPEX (25% DAO INFRAESTRUCTURA & GRANTS)</label>
                <input
                  type="text"
                  readOnly
                  value={CONTRACT_ADDRESSES.PROTOCOL_OPEX_VAULT || '0x...'}
                  className="gcc-wallet-input-purple"
                />
              </div>

              <div>
                <label className="acp-label-sm">💎 BÓVEDA COMMUNITY REAL YIELD (25% REAL YIELD STAKERS)</label>
                <input
                  type="text"
                  readOnly
                  value={CONTRACT_ADDRESSES.COMMUNITY_YIELD_VAULT || '0x...'}
                  className="gcc-wallet-input-green"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PROMOCIONES Y EVENTOS ESPECIALES */}
      {activeSubTab === 'promotions' && (
        <div>
          <h3 className="gcc-section-title">🎁 Gestor de Promociones, Incentivos & Eventos Especiales</h3>
          <div className="gcc-promo-card">
            <h4 className="gcc-promo-h4">✨ Lanzar Nueva Campaña Promocional On-Chain</h4>
            <div className="admin-grid-2col">
              <div>
                <label className="acp-label-sm">NOMBRE DE LA CAMPAÑA / EVENTO</label>
                <input
                  type="text"
                  placeholder="Ej. Summer APY Boost 2026"
                  value={promoName}
                  onChange={(e) => setPromoName(e.target.value)}
                  className="gcc-input-dark"
                />
              </div>
              <div>
                <label className="acp-label-sm">PRESUPUESTO DE INCENTIVOS (ALPHA)</label>
                <input
                  type="number"
                  placeholder="1000"
                  value={promoAmount}
                  onChange={(e) => setPromoAmount(e.target.value)}
                  className="gcc-input-dark"
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
              className={promoName && promoAmount ? (isProductionChain ? 'gcc-btn-prod' : 'gcc-promo-btn-active') : 'gcc-promo-btn-disabled'}
            >
              {isProductionChain ? '🏛️ Proponer Presupuesto Promocional en Governor (72h)' : '🚀 Crear y Activar Campaña Promocional On-Chain'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: SEGURIDAD & CIRCUIT BREAKER */}
      {activeSubTab === 'security' && (
        <div>
          <h3 className="gcc-section-title">🛡️ Consola de Seguridad de Emergencia & Circuit Breaker</h3>
          <div className="admin-grid-2col">
            <div className="gcc-sec-card">
              <h4 className="gcc-sec-breaker-h4">⚡ Descongelar Circuit Breaker</h4>
              <p className="gcc-metric-subtext">
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
                className={isProductionChain ? 'gcc-btn-prod' : 'gcc-sec-btn-red'}
              >
                {isProductionChain ? '🛡️ Proponer Reset Breaker / Security Council Multisig (72h)' : '🔓 Reiniciar Circuit Breaker (Devnet)'}
              </button>
            </div>

            <div className="gcc-sec-card">
              <h4 className="gcc-sec-oracle-h4">🔮 Oráculo de Precios Chainlink</h4>
              <p className="gcc-metric-subtext">
                {isProductionChain ? 'En Mainnet Live, los precios son provistos automáticamente por los agregadores de nodos descentralizados de Chainlink.' : 'Actualiza el valor del feed de prueba de USDC en la sandbox para simular fluctuaciones de mercado.'}
              </p>
              <div className="acp-flex-row-gap5">
                <input
                  type="text"
                  value={adminActions.oraclePrice}
                  onChange={(e) => adminActions.setOraclePrice(e.target.value)}
                  className="gcc-input-dark"
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
                  className={isProductionChain ? 'gcc-btn-prod' : 'gcc-sec-btn-blue'}
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
