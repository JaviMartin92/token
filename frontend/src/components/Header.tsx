import React from 'react';
import { useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { UI_STRINGS } from '../constants/strings.js';
import { Badge } from './common/Badge.js';
import { Button } from './common/Button.js';
import styles from './Header.module.css';

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
    <header className={styles.header}>
      {/* 🏛️ Barra Superior: Marca, Billetera y Controles */}
      <div className={styles.topBar}>
        <div className={styles.brandGroup}>
          <div className={styles.brandLogo} aria-hidden="true">α</div>
          <div className={styles.brandText}>
            <div className={styles.titleRow}>
              <h1 className={styles.brandTitle}>{UI_STRINGS.HEADER.TITLE}</h1>
              <Badge variant="blue" size="sm" className={styles.envBadge}>
                {UI_STRINGS.HEADER.BADGE_ENV_PROD}
              </Badge>
              {circuitBreakerFrozen && (
                <Badge variant="crimson" size="sm" dot>
                  ⚡ {UI_STRINGS.ADMIN.BREAKER_STATUS_FROZEN}
                </Badge>
              )}
            </div>
            <p className={styles.subtitle}>{UI_STRINGS.TREASURY.SUBTITLE}</p>
          </div>
        </div>

        {/* 👛 Billetera & Controles */}
        <div className={styles.walletGroup}>
          <div className={styles.walletBadge}>
            <span
              className={walletConnected ? styles.walletDotConnected : styles.walletDotDisconnected}
              aria-hidden="true"
            />
            <span data-testid="header-wallet-status">
              {walletConnected
                ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`
                : UI_STRINGS.COMMON.STATUS_DISCONNECTED}
            </span>
          </div>

          {walletConnected ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => disconnect()}
            >
              {UI_STRINGS.HEADER.BTN_DISCONNECT}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleConnectWallet}
            >
              {UI_STRINGS.HEADER.BTN_CONNECT}
            </Button>
          )}

          <button
            type="button"
            onClick={onOpenReferral}
            className={styles.mobileReferralBtn}
            title={UI_STRINGS.COMMON.BTN_INVITE_FRIENDS}
          >
            🤝
          </button>
        </div>

        {/* 📊 Métricas Globales (Pills Fluidas en Ticker) */}
        <div className={styles.metricsGroup}>
          <div
            onClick={onOpenApyModal}
            className={styles.metricPillInteractive}
            role="button"
            tabIndex={0}
            title={UI_STRINGS.MODALS.APY_BREAKDOWN.TITLE}
          >
            <span className={styles.metricLabel}>{UI_STRINGS.HEADER.LABEL_APY_BREAKDOWN_TOOLTIP}</span>
            <span className={`${styles.metricValue} ${styles.metricPurple}`}>{alphaApy} APR ℹ️</span>
          </div>

          <div className={styles.metricPill}>
            <span className={styles.metricLabel}>{UI_STRINGS.HEADER.LABEL_POR_RATIO}</span>
            <span data-testid="header-por-ratio" className={`${styles.metricValue} ${styles.metricEmerald}`}>
              {porRatio}
            </span>
          </div>

          <div className={styles.metricPill}>
            <span className={styles.metricLabel}>{UI_STRINGS.HEADER.LABEL_NAV}</span>
            <span data-testid="header-nav-value" className={`${styles.metricValue} ${styles.metricBlue}`}>
              {navValue}
            </span>
          </div>
        </div>
      </div>

      {/* 🧭 Barra de Navegación Institucional (100% Ancho sin Scrollbar) */}
      <nav className={styles.navBar} aria-label="Navegación principal">
        <div className={styles.navContainer}>
          <div className={styles.navTabs}>
            <button
              type="button"
              data-testid="header-tab-portal"
              onClick={() => setActiveTab('client')}
              className={activeTab === 'client' ? styles.navTabActive : styles.navTab}
            >
              <span className={styles.tabDesktopText}>{UI_STRINGS.COMMON.TAB_PORTAL_CLIENT}</span>
              <span className={styles.tabMobileText}>🏛️ Tesorería</span>
            </button>
            <button
              type="button"
              data-testid="header-tab-metrics"
              onClick={() => setActiveTab('metrics')}
              className={activeTab === 'metrics' ? styles.navTabActive : styles.navTab}
            >
              <span className={styles.tabDesktopText}>{UI_STRINGS.COMMON.TAB_METRICS_ANALYTICS}</span>
              <span className={styles.tabMobileText}>📊 Solvencia</span>
            </button>
            <button
              type="button"
              data-testid="header-tab-governance"
              onClick={() => setActiveTab('governance')}
              className={activeTab === 'governance' ? styles.navTabActive : styles.navTab}
            >
              <span className={styles.tabDesktopText}>{UI_STRINGS.COMMON.TAB_GOVERNANCE_OPERATIONS}</span>
              <span className={styles.tabMobileText}>⚖️ Gobernanza</span>
            </button>
          </div>

          <div className={styles.navActions}>
            <button
              type="button"
              onClick={onOpenReferral}
              className={styles.referralBtn}
            >
              🤝 {UI_STRINGS.COMMON.BTN_INVITE_FRIENDS}
            </button>

            {blockDateStr && (
              <span className={styles.blockDate}>
                {UI_STRINGS.COMMON.EVM_BLOCK_LABEL} {blockDateStr}
              </span>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
};
