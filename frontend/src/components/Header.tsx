import React from 'react';
import { useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { UI_STRINGS } from '../constants/strings.js';

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
  const { connectAsync, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const handleConnectWallet = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
      }
      const targetConnector = connectors.find(c => c.type === 'injected') || connectors[0] || injected();
      await connectAsync({ connector: targetConnector });
    } catch (e: any) {
      console.warn('[Wallet] Conexión:', e?.message || e);
      if (typeof window !== 'undefined' && !(window as any).ethereum) {
        alert('No se detectó ninguna extensión de billetera Web3 (ej. MetaMask / Rabby / Coinbase Wallet). Instala una extensión para conectar tu billetera.');
      }
    }
  };

  return (
    <header className="glass-panel header-container">
      <div className="header-inner">
        <div>
          <div className="header-brand">
            <h1 className="header-title-text">
              {UI_STRINGS.HEADER.TITLE} <span className="header-title-badge">{UI_STRINGS.HEADER.BADGE_ENV_PROD}</span>
            </h1>
            {circuitBreakerFrozen && (
              <span className="badge badge-danger">⚡ {UI_STRINGS.ADMIN.BREAKER_STATUS_FROZEN}</span>
            )}
          </div>
          <p className="header-subtitle">
            {UI_STRINGS.TREASURY.SUBTITLE}
          </p>
        </div>

        <div className="header-controls">
          {/* Interactive ALPHA APY Badge (Clickable with Modal) */}
          <div
            onClick={onOpenApyModal}
            className="header-apy-badge"
            title={UI_STRINGS.MODALS.APY_BREAKDOWN.TITLE}
          >
            <div className="header-info-label">{UI_STRINGS.HEADER.LABEL_APY_BREAKDOWN_TOOLTIP}</div>
            <div className="header-info-val-purple">{alphaApy} APR ℹ️</div>
          </div>

          {/* PoR Badge */}
          <div className="header-info-box">
            <div className="header-info-label">{UI_STRINGS.HEADER.LABEL_POR_RATIO}</div>
            <div data-testid="header-por-ratio" className="header-info-val-green">{porRatio}</div>
          </div>

          {/* NAV Pill */}
          <div className="header-info-box">
            <div className="header-info-label">{UI_STRINGS.HEADER.LABEL_NAV}</div>
            <div data-testid="header-nav-value" className="header-info-val-cyan">{navValue}</div>
          </div>

          {/* Wallet Status Badge */}
          <div className="header-info-box">
            <div className="header-info-label">{UI_STRINGS.HEADER.LABEL_WALLET_STATUS}</div>
            <div data-testid="header-wallet-status" className={walletConnected ? 'header-info-val-green' : 'header-info-label'}>
              {walletConnected ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : UI_STRINGS.COMMON.STATUS_DISCONNECTED}
            </div>
          </div>

          {/* Wallet Actions */}
          <div className="header-role-wrapper">
            <div className="header-info-label">{UI_STRINGS.HEADER.LABEL_WEB3_CONNECTION}</div>
            <div className="header-role-box">
              {walletConnected ? (
                <button
                  className="btn-danger btn-wallet-action"
                  onClick={() => disconnect()}
                >
                  {UI_STRINGS.HEADER.BTN_DISCONNECT}
                </button>
              ) : (
                <button
                  className="btn-primary btn-wallet-action"
                  onClick={handleConnectWallet}
                >
                  {UI_STRINGS.HEADER.BTN_CONNECT}
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
          {UI_STRINGS.COMMON.TAB_PORTAL_CLIENT}
        </button>
        <button
          data-testid="header-tab-metrics"
          onClick={() => setActiveTab('metrics')}
          className={`header-nav-btn ${activeTab === 'metrics' ? 'header-nav-btn-active' : 'header-nav-btn-inactive'}`}
        >
          {UI_STRINGS.COMMON.TAB_METRICS_ANALYTICS}
        </button>
        <button
          data-testid="header-tab-governance"
          onClick={() => setActiveTab('governance')}
          className={`header-nav-btn ${activeTab === 'governance' ? 'header-nav-btn-active' : 'header-nav-btn-inactive'}`}
        >
          {UI_STRINGS.COMMON.TAB_GOVERNANCE_OPERATIONS}
        </button>

        <button
          onClick={onOpenReferral}
          className="header-referral-btn"
        >
          {UI_STRINGS.COMMON.BTN_INVITE_FRIENDS}
        </button>

        {blockDateStr && (
          <div className="header-date-badge">
            {UI_STRINGS.COMMON.EVM_BLOCK_LABEL} {blockDateStr}
          </div>
        )}
      </div>
    </header>
  );
};