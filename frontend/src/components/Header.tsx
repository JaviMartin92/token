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
  alphaApy = '0.00%',
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
    <header className="glass-panel header-container">
      <div className="header-inner">
        <div>
          <div className="header-brand">
            <h1 className="header-title-text">
              ALPHA CENTAURI <span className="header-title-badge">V6 MAINNET-READY</span>
            </h1>
            {circuitBreakerFrozen && (
              <span className="badge badge-danger">⚡ CIRCUIT BREAKER ACTIVE</span>
            )}
          </div>
          <p className="header-subtitle">
            Reserva On-Chain Transparente • Bonos Vestados • Préstamos P2P Colateralizados
          </p>
        </div>

        <div className="header-controls">
          {/* Interactive ALPHA APY Badge (Clickable with Modal) */}
          <div
            onClick={onOpenApyModal}
            className="header-apy-badge"
            title="Haz clic para ver el desglose al milímetro de dónde viene el APY de ALPHA"
          >
            <div className="header-info-label">⚡ APY ALPHA (DESGLOSE 🔍)</div>
            <div className="header-info-val-purple">{alphaApy} APR ℹ️</div>
          </div>

          {/* PoR Badge */}
          <div className="header-info-box">
            <div className="header-info-label">RATIO COLATERAL PoR</div>
            <div data-testid="header-por-ratio" className="header-info-val-green">{porRatio}</div>
          </div>

          {/* NAV Pill */}
          <div className="header-info-box">
            <div className="header-info-label">VALOR NAV / SHARE</div>
            <div data-testid="header-nav-value" className="header-info-val-cyan">{navValue}</div>
          </div>

          {/* Wallet Status Badge */}
          <div className="header-info-box">
            <div className="header-info-label">ESTADO WALLET</div>
            <div data-testid="header-wallet-status" className={walletConnected ? 'header-info-val-green' : 'header-info-label'}>
              {walletConnected ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : 'Desconectado'}
            </div>
          </div>

          {/* Role Switcher */}
          <div className="header-role-wrapper">
            <div className="header-info-label">ENTORNO / ROL WALLET:</div>
            <div className="header-role-box">
              <button
                data-testid="header-role-admin"
                className={activeKey === ADMIN_KEY ? 'header-role-btn-admin-active' : 'header-role-btn-admin-inactive'}
                onClick={() => onSwitchRole(ADMIN_KEY as `0x${string}`, 'Sandbox Tester / Operador Devnet')}
              >
                🧪 Devnet / Ops Sandbox
              </button>
              <button
                data-testid="header-role-user"
                className={activeKey === USER_KEY ? 'header-role-btn-user-active' : 'header-role-btn-user-inactive'}
                onClick={() => onSwitchRole(USER_KEY as `0x${string}`, 'Usuario Retail / Staker')}
              >
                👤 Usuario Retail
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="header-tabs-row">
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
        >
          🏛️ Operaciones Protocolo & Gobernanza DAO
        </button>

        <button
          onClick={onOpenReferral}
          className="header-referral-btn"
        >
          🎁 Invitar Amigos
        </button>

        {blockDateStr && (
          <div className="header-date-badge">
            🕒 Bloque EVM: {blockDateStr}
          </div>
        )}
      </div>
    </header>
  );
};