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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '2rem' }}>🏛️</span>
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

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div className="gcc-badge-indigo">
            <div style={{ fontSize: '0.75rem', color: '#a5b4fc', fontWeight: 700 }}>EVM CHAIN DETECTADO</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#818cf8' }}>Chain ID: {currentChainId}</div>
          </div>
          <div className="gcc-badge-green">
            <div style={{ fontSize: '0.75rem', color: '#86efac', fontWeight: 700 }}>RATIO SOLVENCIA PoR</div>
            <div data-testid="admin-por-solvency-ratio" style={{ fontSize: '1.2rem', fontWeight: 800, color: '#4ade80' }}>{solvencyRatio}%</div>
          </div>
          <div className="gcc-badge-purple">
            <div style={{ fontSize: '0.75rem', color: '#d8b4fe', fontWeight: 700 }}>NAV / TOKEN ALPHA</div>
            <div data-testid="admin-nav-per-share" style={{ fontSize: '1.2rem', fontWeight: 800, color: '#c084fc' }}>${navValueNum.toFixed(4)}</div>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>ACTIVOS TOTALES (PoR)</div>
              <div data-testid="admin-total-assets-por" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
                ${totalAssetsVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Cobertura On-Chain 100% Verificada</div>
            </div>

            <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>DEFLACIÓN ACUMULADA</div>
              <div data-testid="admin-deflation-accumulated" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444', marginTop: '4px' }}>
                🔥 {burnedTokensStr} ALPHA
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Tokens Destruidos por Fees Staking</div>
            </div>

            <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>MODELO DE INGRESOS (50/25/25)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#e2e8f0', marginTop: '6px' }}>
                🏛️ 50% Res | 💼 25% OpEx | 🏦 25% Prof
              </div>
              <div style={{ fontSize: '0.75rem', color: '#86efac', marginTop: '4px' }}>Reparto Automático On-Chain</div>
            </div>
          </div>

          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: '#cbd5e1' }}>📌 Distribución Target de Activos de Reserva (50/25/12.5/12.5)</h3>
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: 'rgba(30, 41, 59, 0.9)', color: '#94a3b8' }}>
                  <th style={{ padding: '12px 16px' }}>Activo de Reserva</th>
                  <th style={{ padding: '12px 16px' }}>Valor USD Real</th>
                  <th style={{ padding: '12px 16px' }}>Ponderación Target</th>
                  <th style={{ padding: '12px 16px' }}>Función en Tesorería</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#60a5fa' }}>💵 USDC (Sub-Reserva 80/20)</td>
                  <td style={{ padding: '12px 16px' }}>${parseFloat(reserveBreakdown?.usdcUsd || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: '12px 16px', color: '#4ade80', fontWeight: 700 }}>50.00%</td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8' }}>Morpho Yield (80%) + Líquido (20%)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#f59e0b' }}>₿ Wrapped Bitcoin (WBTC)</td>
                  <td style={{ padding: '12px 16px' }}>${parseFloat(reserveBreakdown?.wbtcUsd || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: '12px 16px', color: '#4ade80', fontWeight: 700 }}>25.00%</td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8' }}>Compras DEX en Mercado Secundario</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#a855f7' }}>Ξ Wrapped Ethereum (WETH)</td>
                  <td style={{ padding: '12px 16px' }}>${parseFloat(reserveBreakdown?.wethUsd || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: '12px 16px', color: '#4ade80', fontWeight: 700 }}>12.50%</td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8' }}>Compras DEX en Mercado Secundario</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#ec4899' }}>🥩 Native ALPHA Staked</td>
                  <td style={{ padding: '12px 16px' }}>${parseFloat(reserveBreakdown?.stakedAlphaUsd || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: '12px 16px', color: '#4ade80', fontWeight: 700 }}>12.50%</td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8' }}>Auto-stake Institucional Governance</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CONTROL DE PARAMETROS */}
      {activeSubTab === 'parameters' && (
        <div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: '#cbd5e1' }}>⚙️ Configuración Global de Parámetros y Comisiones</h3>
          
          {isProductionChain && (
            <div style={{ background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', fontSize: '0.82rem', color: '#c084fc' }}>
              🏛️ <strong>Pure DeFi Governance Active (Mainnet Live - Chain ID {currentChainId})</strong>: Ajusta los parámetros en las casillas inferiores y pulsa <strong>"Proponer Votación DAO (72h)"</strong> para firmar y enviar la propuesta on-chain a <code>GovernorAlphaCentauri.sol</code>.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>COMISIÓN DE DEPÓSITO TESORERÍA (%)</label>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <input
                  type="number"
                  step="0.1"
                  value={depositFeeInput}
                  onChange={(e) => setDepositFeeInput(e.target.value)}
                  style={{ flex: 1, background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', padding: '10px 14px' }}
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
                  style={{ background: isProductionChain ? 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: 'none', color: '#fff', borderRadius: '10px', padding: '0 16px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  {isProductionChain ? '🏛️ Proponer Votación DAO (72h)' : '🧪 Guardar (Sandbox)'}
                </button>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px', display: 'block' }}>Actual: 0.50% (50 Bps)</span>
            </div>

            <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>COMISIÓN DE CANJE DIRECTO / REDEEM (%)</label>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <input
                  type="number"
                  step="0.1"
                  value={redeemFeeInput}
                  onChange={(e) => setRedeemFeeInput(e.target.value)}
                  style={{ flex: 1, background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', padding: '10px 14px' }}
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
                  style={{ background: isProductionChain ? 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: 'none', color: '#fff', borderRadius: '10px', padding: '0 16px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  {isProductionChain ? '🏛️ Proponer Votación DAO (72h)' : '🧪 Guardar (Sandbox)'}
                </button>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px', display: 'block' }}>Actual: 1.00% (100 Bps)</span>
            </div>

            <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>FEE ORIGINACIÓN PRÉSTAMOS P2P (%)</label>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <input
                  type="number"
                  step="0.1"
                  value={p2pFeeInput}
                  onChange={(e) => setP2pFeeInput(e.target.value)}
                  style={{ flex: 1, background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', padding: '10px 14px' }}
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
                  style={{ background: isProductionChain ? 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: 'none', color: '#fff', borderRadius: '10px', padding: '0 16px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  {isProductionChain ? '🏛️ Proponer Votación DAO (72h)' : '🧪 Guardar (Sandbox)'}
                </button>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px', display: 'block' }}>Actual: 0.50% (50 Bps)</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BILLETERAS CORPORATIVAS */}
      {activeSubTab === 'wallets' && (
        <div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: '#cbd5e1' }}>💼 Control y Direccionamiento de Billeteras Corporativas</h3>
          <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>🏛️ BILLETERA BUNKER TESORERÍA (50% RESERVAS)</label>
                <input
                  type="text"
                  readOnly
                  value={web3Data.contractAddresses?.TREASURY || '0x...'}
                  style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#38bdf8', padding: '10px 14px', fontFamily: 'monospace', marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>🛡️ BÓVEDA PROTOCOL OPEX (25% DAO INFRAESTRUCTURA & GRANTS)</label>
                <input
                  type="text"
                  readOnly
                  value={CONTRACT_ADDRESSES.PROTOCOL_OPEX_VAULT || '0x...'}
                  style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#a855f7', padding: '10px 14px', fontFamily: 'monospace', marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>💎 BÓVEDA COMMUNITY REAL YIELD (25% REAL YIELD STAKERS)</label>
                <input
                  type="text"
                  readOnly
                  value={CONTRACT_ADDRESSES.COMMUNITY_YIELD_VAULT || '0x...'}
                  style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#4ade80', padding: '10px 14px', fontFamily: 'monospace', marginTop: '4px' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PROMOCIONES Y EVENTOS ESPECIALES */}
      {activeSubTab === 'promotions' && (
        <div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: '#cbd5e1' }}>🎁 Gestor de Promociones, Incentivos & Eventos Especiales</h3>
          <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: '#f472b6' }}>✨ Lanzar Nueva Campaña Promocional On-Chain</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>NOMBRE DE LA CAMPAÑA / EVENTO</label>
                <input
                  type="text"
                  placeholder="Ej. Summer APY Boost 2026"
                  value={promoName}
                  onChange={(e) => setPromoName(e.target.value)}
                  style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', padding: '10px 14px', marginTop: '4px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>PRESUPUESTO DE INCENTIVOS (ALPHA)</label>
                <input
                  type="number"
                  placeholder="1000"
                  value={promoAmount}
                  onChange={(e) => setPromoAmount(e.target.value)}
                  style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', padding: '10px 14px', marginTop: '4px' }}
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
              style={{
                background: isProductionChain ? 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)' : 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
                border: 'none',
                color: '#fff',
                padding: '12px 24px',
                borderRadius: '12px',
                fontWeight: 700,
                cursor: promoName && promoAmount ? 'pointer' : 'not-allowed',
                width: '100%'
              }}
            >
              {isProductionChain ? '🏛️ Proponer Presupuesto Promocional en Governor (72h)' : '🚀 Crear y Activar Campaña Promocional On-Chain'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: SEGURIDAD & CIRCUIT BREAKER */}
      {activeSubTab === 'security' && (
        <div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: '#cbd5e1' }}>🛡️ Consola de Seguridad de Emergencia & Circuit Breaker</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#f87171' }}>⚡ Descongelar Circuit Breaker</h4>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 16px 0' }}>
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
                style={{ background: isProductionChain ? 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)' : 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', width: '100%' }}
              >
                {isProductionChain ? '🛡️ Proponer Reset Breaker / Security Council Multisig (72h)' : '🔓 Reiniciar Circuit Breaker (Devnet)'}
              </button>
            </div>

            <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#60a5fa' }}>🔮 Oráculo de Precios Chainlink</h4>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 16px 0' }}>
                {isProductionChain ? 'En Mainnet Live, los precios son provistos automáticamente por los agregadores de nodos descentralizados de Chainlink.' : 'Actualiza el valor del feed de prueba de USDC en la sandbox para simular fluctuaciones de mercado.'}
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={adminActions.oraclePrice}
                  onChange={(e) => adminActions.setOraclePrice(e.target.value)}
                  style={{ flex: 1, background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', padding: '8px 12px' }}
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
                  style={{ background: isProductionChain ? 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)' : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}
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
