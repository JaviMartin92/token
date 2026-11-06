import React, { useState } from 'react';
import styles from './ConnectWalletModal.module.css';
import { Button } from './common/index.js';

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectInjected: () => Promise<void>;
  isConnecting: boolean;
  errorMsg?: string | null;
}

export const ConnectWalletModal: React.FC<ConnectWalletModalProps> = ({
  isOpen,
  onClose,
  onConnectInjected,
  isConnecting,
  errorMsg
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const hasEthereum = typeof window !== 'undefined' && Boolean((window as any).ethereum);
  const isMobile =
    typeof navigator !== 'undefined' &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // Deep links para billeteras móviles
  const cleanUrl = typeof window !== 'undefined' ? window.location.href.replace(/^https?:\/\//, '') : '';
  const fullUrl = typeof window !== 'undefined' ? window.location.href : '';

  const metamaskDeepLink = `https://metamask.app.link/dapp/${cleanUrl}`;
  const trustWalletDeepLink = `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(fullUrl)}`;
  const coinbaseWalletDeepLink = `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(fullUrl)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback manual si clipboard API no está permitida en contexto inseguro
      const textarea = document.createElement('textarea');
      textarea.value = fullUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleOpenWallet = (deepLink: string, desktopUrl: string) => {
    if (isMobile) {
      window.location.href = deepLink;
    } else {
      window.open(desktopUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-wallet-modal-title"
    >
      <div
        className={`glass-panel modal-container ${styles.modalBox}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <span className={styles.headerIcon} aria-hidden="true">
              👛
            </span>
            <div>
              <h2 id="connect-wallet-modal-title" className={styles.title}>
                Conectar Billetera Web3
              </h2>
              <p className={styles.subtitle}>
                {hasEthereum
                  ? 'Billetera detectada en tu navegador. Pulsa para autorizar la conexión:'
                  : 'Selecciona cómo deseas conectar tu billetera en este dispositivo:'}
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="connect-wallet-modal-close-btn"
            onClick={onClose}
            className={styles.closeBtn}
            aria-label="Cerrar modal de conexión"
          >
            ✕
          </button>
        </div>

        {/* Notificación de Error */}
        {errorMsg && (
          <div className={styles.errorBanner} role="alert">
            <span className={styles.errorIcon}>⚠️</span>
            <span className={styles.errorText}>{errorMsg}</span>
          </div>
        )}

        {/* Opción 1: Proveedor Inyectado detectado */}
        {hasEthereum && (
          <div className={styles.detectedCard}>
            <div className={styles.detectedHeader}>
              <span className={styles.detectedDot} />
              <span className={styles.detectedTitle}>Billetera Web3 Lista en el Navegador</span>
            </div>
            <p className={styles.detectedDesc}>
              Se ha detectado un proveedor Web3 inyectado. Pulsa el botón para solicitar la
              autorización de cuentas en tu extensión o app.
            </p>
            <Button
              type="button"
              variant="primary"
              size="md"
              className={styles.detectedBtn}
              onClick={onConnectInjected}
              isLoading={isConnecting}
              loadingText="Esperando confirmación en tu billetera..."
            >
              🦊 Conectar Billetera Detectada
            </Button>
          </div>
        )}

        {/* Sección de Billeteras Móviles / Deep-links */}
        <div className={styles.walletSection}>
          <div className={styles.sectionLabel}>
            {isMobile
              ? '📱 Abrir directamente en tu App de Billetera:'
              : '📱 Billeteras Compatibles (Móvil / Escritorio):'}
          </div>

          <div className={styles.walletGrid}>
            {/* MetaMask */}
            <button
              type="button"
              className={styles.walletOptionBtn}
              onClick={() => handleOpenWallet(metamaskDeepLink, 'https://metamask.io/download/')}
            >
              <div className={styles.walletOptionLeft}>
                <span className={styles.walletOptionIcon}>🦊</span>
                <div className={styles.walletOptionText}>
                  <div className={styles.walletOptionName}>
                    MetaMask
                    <span className={styles.popularBadge}>Recomendado</span>
                  </div>
                  <div className={styles.walletOptionSub}>
                    {isMobile
                      ? 'Abrir dApp en la app de MetaMask'
                      : 'Instalar extensión para navegador'}
                  </div>
                </div>
              </div>
              <span className={styles.walletOptionArrow}>→</span>
            </button>

            {/* Trust Wallet */}
            <button
              type="button"
              className={styles.walletOptionBtn}
              onClick={() => handleOpenWallet(trustWalletDeepLink, 'https://trustwallet.com/')}
            >
              <div className={styles.walletOptionLeft}>
                <span className={styles.walletOptionIcon}>🛡️</span>
                <div className={styles.walletOptionText}>
                  <div className={styles.walletOptionName}>Trust Wallet</div>
                  <div className={styles.walletOptionSub}>
                    {isMobile ? 'Abrir en la app de Trust Wallet' : 'Visitar sitio web oficial'}
                  </div>
                </div>
              </div>
              <span className={styles.walletOptionArrow}>→</span>
            </button>

            {/* Coinbase Wallet */}
            <button
              type="button"
              className={styles.walletOptionBtn}
              onClick={() =>
                handleOpenWallet(coinbaseWalletDeepLink, 'https://www.coinbase.com/wallet')
              }
            >
              <div className={styles.walletOptionLeft}>
                <span className={styles.walletOptionIcon}>🔵</span>
                <div className={styles.walletOptionText}>
                  <div className={styles.walletOptionName}>Coinbase Wallet</div>
                  <div className={styles.walletOptionSub}>
                    {isMobile ? 'Abrir en Coinbase Wallet app' : 'Visitar sitio web oficial'}
                  </div>
                </div>
              </div>
              <span className={styles.walletOptionArrow}>→</span>
            </button>

            {/* Copiar enlace */}
            <button type="button" className={styles.walletOptionBtn} onClick={handleCopyLink}>
              <div className={styles.walletOptionLeft}>
                <span className={styles.walletOptionIcon}>{copied ? '✅' : '📋'}</span>
                <div className={styles.walletOptionText}>
                  <div className={styles.walletOptionName}>
                    {copied ? '¡Enlace Copiado!' : 'Copiar Enlace de la dApp'}
                  </div>
                  <div className={styles.walletOptionSub}>
                    {copied
                      ? 'Pégalo en el navegador de tu billetera'
                      : 'Para pegar en el explorador interno de cualquier wallet'}
                  </div>
                </div>
              </div>
              <span className={styles.copyBadge}>{copied ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
        </div>

        {/* Nota informativa en localhost */}
        {isLocalhost && isMobile && (
          <div className={styles.localhostNote}>
            ℹ️ <strong>Entorno Local (localhost)</strong>: Si abres la dApp en tu móvil desde la
            red Wi-Fi, asegúrate de usar la IP local de tu ordenador (ej.{' '}
            <code>http://192.168.1.X:5173</code>) para que la billetera pueda conectarse.
          </div>
        )}

        {/* Caja de Ayuda */}
        <div className={styles.helpBox}>
          <div className={styles.helpTitle}>💡 ¿Por qué es necesario en teléfonos móviles?</div>
          <div className={styles.helpDesc}>
            Por seguridad, los navegadores estándar en smartphones (Safari, Chrome) no permiten que
            los sitios web accedan directamente a tus fondos ni firmen transacciones. Pulsa arriba
            para abrir la dApp en tu billetera o copia el enlace y pégalo en su navegador Web3
            integrado.
          </div>
        </div>
      </div>
    </div>
  );
};
