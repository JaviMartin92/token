import React from 'react';
import { useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';

interface HeaderProps {
  navValue: string;
  porRatio: string;
  alphaApy?: string;
  blockDateStr: string;
  activeTab: 'client' | 'metrics' | 'governance';
  setActiveTab: (tab: 'client' | 'metrics' | 'governance') => void;
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
  circuitBreakerFrozen,
  onOpenReferral,
  onOpenApyModal,
  walletConnected,
  userAddress
}) => {
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

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

          {/* Wallet Actions */}
          <div className="header-role-wrapper">
            <div className="header-info-label">CONEXIÓN WEB3:</div>
            <div className="header-role-box">
              {walletConnected ? (
                <button
                  className="btn-danger"
                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
                  onClick={() => disconnect()}
                >
                  Desconectar
                </button>
              ) : (
                <button
                  className="btn-primary"
                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
                  onClick={() => connect({ connector: injected() })}
                >
                  Conectar Wallet
                </button>
              )}
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