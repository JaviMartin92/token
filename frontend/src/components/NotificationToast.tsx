import React from 'react';
import styles from './NotificationToast.module.css';
import { getExplorerTxUrl } from '../utils/web3.js';

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  txHash?: string;
  chainId?: number;
}

interface NotificationToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  toasts,
  onDismiss
}) => {
  if (!toasts || toasts.length === 0) return null;

  const getIcon = (type: ToastMessage['type']) => {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'info': default: return 'ℹ️';
    }
  };

  return (
    <div className="toast-container" role="region" aria-label="Notificaciones del sistema">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast-item toast-${toast.type}`}
        >
          <span className={styles.toastIcon} aria-hidden="true">{getIcon(toast.type)}</span>
          <div className={styles.toastContentBox}>
            <div className={styles.toastTitleText}>{toast.title}</div>
            <div className={styles.toastMsgText}>{toast.message}</div>
            {toast.txHash && (
              <a
                href={getExplorerTxUrl(toast.txHash, toast.chainId)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.explorerLink}
              >
                Ver en Arbiscan ↗
              </a>
            )}
          </div>
          <button
            type="button"
            className="toast-close-btn"
            onClick={() => onDismiss(toast.id)}
            aria-label="Cerrar notificación"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};
