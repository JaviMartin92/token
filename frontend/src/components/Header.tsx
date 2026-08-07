import React from 'react';

interface HeaderProps {
  navValue: string;
  porRatio: string;
  alphaApy?: string;
  blockDateStr: string;
  activeTab: 'client' | 'metrics' | 'governance';
  setActiveTab: (tab: 'client' | 'metrics' | 'governance') => void;
  activeKey: string;
  ADMIN_KEY: string;
  USER_KEY: string;
  onSwitchRole: (key: `0x${string}`, roleName: string) => void;
  walletConnected: boolean;
  userAddress: string;
  circuitBreakerFrozen: boolean;
  onOpenReferral: () => void;
  onOpenApyModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  navValue,
  porRatio,
  alphaApy = '11.25%',
  blockDateStr,
  activeTab,
  setActiveTab,
  activeKey,
  ADMIN_KEY,
  USER_KEY,
  onSwitchRole,
  walletConnected,
  userAddress,
  circuitBreakerFrozen,
  onOpenReferral,
  onOpenApyModal
}) => {
  return (
    <header className="glass-panel header-banner" style={{ marginBottom: '1.5rem', padding: '1.25rem 1.75rem', borderRadius: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div className="header-brand">
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              ALPHA CENTAURI <span style={{ fontSize: '0.9rem', padding: '0.2rem 0.6rem', borderRadius: '6px', background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' }}>V6 MAINNET-READY</span>
            </h1>
            {circuitBreakerFrozen && (
              <span className="badge badge-danger" style={{ animation: 'pulse 1.5s infinite' }}>⚡ CIRCUIT BREAKER ACTIVE</span>
            )}
          </div>
          <p style={{ margin: '0.25rem 0 0 0', opacity: 0.7, fontSize: '0.85rem' }}>
            Reserva On-Chain Transparente • Bonos Vestados • Préstamos P2P Colateralizados
          </p>
        </div>

        <div className="header-controls">
          {/* Interactive ALPHA APY Badge (Clickable with Modal) */}
          <div
            onClick={onOpenApyModal}
            style={{
              background: 'linear-gradient(135deg, rgba(168,85,247,0.2) 0%, rgba(99,102,241,0.2) 100%)',
              border: '1px solid rgba(168, 85, 247, 0.5)',
              padding: '0.4rem 0.85rem',
              borderRadius: '10px',
              textAlign: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(168,85,247,0.25)',
              transition: 'all 0.2s ease'
            }}
            title="Haz clic para ver el desglose al milímetro de dónde viene el APY de ALPHA"
          >
            <div style={{ fontSize: '0.7rem', color: '#c084fc', fontWeight: 600 }}>⚡ APY ALPHA (DESGLOSE 🔍)</div>
            <div style={{ fontWeight: 800, color: '#f0abfc', fontSize: '0.95rem' }}>{alphaApy} APR ℹ️</div>
          </div>

          {/* PoR Badge */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.4rem 0.8rem', borderRadius: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>RATIO COLATERAL PoR</div>
            <div data-testid="header-por-ratio" style={{ fontWeight: 700, color: '#4ade80', fontSize: '0.95rem' }}>{porRatio}</div>
          </div>

          {/* NAV Pill */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.4rem 0.8rem', borderRadius: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>VALOR NAV / SHARE</div>
            <div data-testid="header-nav-value" style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.95rem' }}>{navValue}</div>
          </div>

          {/* Wallet Status Badge */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.4rem 0.8rem', borderRadius: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>ESTADO WALLET</div>
            <div data-testid="header-wallet-status" style={{ fontWeight: 600, color: walletConnected ? '#4ade80' : '#f87171', fontSize: '0.85rem' }}>
              {walletConnected ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : 'Desconectado'}
            </div>
          </div>

          {/* Role Switcher */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
            <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>ROL CONECTADO:</div>
            <div style={{ display: 'flex', gap: '0.4rem', background: 'rgba(0,0,0,0.3)', padding: '0.25rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button
                data-testid="header-role-admin"
                style={{
                  background: activeKey === ADMIN_KEY ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'transparent',
                  color: '#fff',
                  border: 'none',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.8rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: activeKey === ADMIN_KEY ? 700 : 400,
                  boxShadow: activeKey === ADMIN_KEY ? '0 2px 8px rgba(99, 102, 241, 0.4)' : 'none'
                }}
                onClick={() => onSwitchRole(ADMIN_KEY as `0x${string}`, 'Owner/Admin')}
              >
                👑 Admin / Owner
              </button>
              <button
                data-testid="header-role-user"
                style={{
                  background: activeKey === USER_KEY ? 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)' : 'transparent',
                  color: '#fff',
                  border: 'none',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.8rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: activeKey === USER_KEY ? 700 : 400,
                  boxShadow: activeKey === USER_KEY ? '0 2px 8px rgba(168, 85, 247, 0.4)' : 'none'
                }}
                onClick={() => onSwitchRole(USER_KEY as `0x${string}`, 'Usuario Retail')}
              >
                👤 Usuario
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          data-testid="header-tab-portal"
          onClick={() => setActiveTab('client')}
          className={`header-nav-btn ${activeTab === 'client' ? 'header-nav-btn-active' : 'header-nav-btn-inactive'}`}
        >
          💎 Portal Cliente & Bonos
        </button>
        <button
          data-testid="header-tab-metrics"
          onClick={() => setActiveTab('metrics')}
          className={`header-nav-btn ${activeTab === 'metrics' ? 'header-nav-btn-active' : 'header-nav-btn-inactive'}`}
        >
          📊 Métricas & Analítica
        </button>
        <button
          data-testid="header-tab-governance"
          onClick={() => setActiveTab('governance')}
          className={`header-nav-btn ${activeTab === 'governance' ? 'header-nav-btn-active' : 'header-nav-btn-inactive'}`}
          style={{ opacity: activeKey !== ADMIN_KEY ? 0.7 : 1 }}
        >
          {activeKey === ADMIN_KEY ? '⚙️ Gobernanza & Tesorería (Admin)' : '🔒 Gobernanza & Admin (Solo Admin)'}
        </button>

        <button
          onClick={onOpenReferral}
          style={{
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(56, 189, 248, 0.3) 100%)',
            border: '1px solid rgba(168, 85, 247, 0.5)',
            color: '#fff',
            padding: '0.5rem 1.2rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 12px rgba(168, 85, 247, 0.25)',
            transition: 'all 0.2s'
          }}
        >
          🎁 Invitar Amigos <span style={{ fontSize: '0.75rem', background: '#22c55e', padding: '0.1rem 0.4rem', borderRadius: '4px', color: '#000' }}>Gana 1.5%</span>
        </button>

        {blockDateStr && (
          <div style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: '0.75rem', opacity: 0.5 }}>
            🕒 Bloque EVM: {blockDateStr}
          </div>
        )}
      </div>
    </header>
  );
};