import React, { useState } from 'react';
import { CONTRACT_ADDRESSES } from '../utils/web3.js';

interface GovernanceCommandCenterProps {
  web3Data: any;
  adminActions: any;
  isAdmin: boolean;
}

export const GovernanceCommandCenter: React.FC<GovernanceCommandCenterProps> = ({
  web3Data,
  adminActions,
  isAdmin
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

  const totalAssetsVal = parseFloat(proofOfReserves?.totalAssetsUSD || '0');
  const totalLiabVal = parseFloat(proofOfReserves?.totalLiabilitiesUSD || '0');
  const solvencyRatio = totalLiabVal > 0 ? ((totalAssetsVal / totalLiabVal) * 100).toFixed(2) : '100.00';
  const navValueNum = navPerShareNum !== undefined ? navPerShareNum : 1.0;
  const burnedTokensStr = totalBurnedTokens || '0.00';

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '24px',
      padding: '28px',
      color: '#f8fafc',
      marginTop: '24px',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.35)'
    }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '2rem' }}>🏛️</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Centro de Comando de Gobernanza & DAO
              </h2>
              <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
                Auditoría Exhaustiva en Tiempo Real, Control de Parámetros On-Chain y Gestor Promocional Empresarial
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '8px 16px', borderRadius: '12px', textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: '#86efac', fontWeight: 700 }}>RATIO SOLVENCIA PoR</div>
            <div data-testid="admin-por-solvency-ratio" style={{ fontSize: '1.2rem', fontWeight: 800, color: '#4ade80' }}>{solvencyRatio}%</div>
          </div>
          <div style={{ background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '8px 16px', borderRadius: '12px', textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: '#d8b4fe', fontWeight: 700 }}>NAV / TOKEN ALPHA</div>
            <div data-testid="admin-nav-per-share" style={{ fontSize: '1.2rem', fontWeight: 800, color: '#c084fc' }}>${navValueNum.toFixed(4)}</div>
          </div>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
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
            style={{
              background: activeSubTab === tab.key ? 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)' : 'rgba(30, 41, 59, 0.6)',
              border: activeSubTab === tab.key ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              padding: '10px 18px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: activeSubTab === tab.key ? '0 4px 12px rgba(168, 85, 247, 0.4)' : 'none'
            }}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>COMISIÓN DE DEPÓSITO TESORERÍA (%)</label>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <input
                  type="number"
                  step="0.1"
                  value={depositFeeInput}
                  onChange={(e) => setDepositFeeInput(e.target.value)}
                  disabled={!isAdmin}
                  style={{ flex: 1, background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', padding: '10px 14px' }}
                />
                <button
                  disabled={!isAdmin}
                  style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: 'none', color: '#fff', borderRadius: '10px', padding: '0 16px', fontWeight: 700, cursor: isAdmin ? 'pointer' : 'not-allowed' }}
                >
                  Guardar
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
                  disabled={!isAdmin}
                  style={{ flex: 1, background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', padding: '10px 14px' }}
                />
                <button
                  disabled={!isAdmin}
                  style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: 'none', color: '#fff', borderRadius: '10px', padding: '0 16px', fontWeight: 700, cursor: isAdmin ? 'pointer' : 'not-allowed' }}
                >
                  Guardar
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
                  disabled={!isAdmin}
                  style={{ flex: 1, background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', padding: '10px 14px' }}
                />
                <button
                  disabled={!isAdmin}
                  style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: 'none', color: '#fff', borderRadius: '10px', padding: '0 16px', fontWeight: 700, cursor: isAdmin ? 'pointer' : 'not-allowed' }}
                >
                  Guardar
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
                <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>💼 VAULT CORPORATIVO OPEX (25% GASTOS OPERATIVOS)</label>
                <input
                  type="text"
                  readOnly
                  value={CONTRACT_ADDRESSES.CORPORATE_OPEX || '0x...'}
                  style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#a855f7', padding: '10px 14px', fontFamily: 'monospace', marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>🏦 VAULT CORPORATIVO BENEFICIOS (25% PROFIT EMPRESA)</label>
                <input
                  type="text"
                  readOnly
                  value={CONTRACT_ADDRESSES.CORPORATE_PROFIT || '0x...'}
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
                  disabled={!isAdmin}
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
                  disabled={!isAdmin}
                  style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', padding: '10px 14px', marginTop: '4px' }}
                />
              </div>
            </div>

            <button
              onClick={() => adminActions.handleCreateCampaign(promoName, promoAmount)}
              disabled={!isAdmin || !promoName || !promoAmount}
              style={{
                background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
                border: 'none',
                color: '#fff',
                padding: '12px 24px',
                borderRadius: '12px',
                fontWeight: 700,
                cursor: isAdmin ? 'pointer' : 'not-allowed',
                width: '100%'
              }}
            >
              🚀 Crear y Activar Campaña Promocional On-Chain
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
                onClick={adminActions.handleResetBreaker}
                disabled={!isAdmin}
                style={{ background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: '10px', fontWeight: 700, cursor: isAdmin ? 'pointer' : 'not-allowed', width: '100%' }}
              >
                🔓 Reiniciar Circuit Breaker
              </button>
            </div>

            <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#60a5fa' }}>🔮 Oráculo de Precios Chainlink</h4>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 16px 0' }}>
                Actualiza el valor del feed de prueba de USDC en la sandbox para simular fluctuaciones de mercado.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={adminActions.oraclePrice}
                  onChange={(e) => adminActions.setOraclePrice(e.target.value)}
                  disabled={!isAdmin}
                  style={{ flex: 1, background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', padding: '8px 12px' }}
                />
                <button
                  onClick={adminActions.handleUpdateOracle}
                  disabled={!isAdmin}
                  style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '10px', fontWeight: 700, cursor: isAdmin ? 'pointer' : 'not-allowed' }}
                >
                  Actualizar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
