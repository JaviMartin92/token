import React from 'react';

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
}

interface NotificationToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-fixed-container">
      {toasts.map((toast) => {
        const typeClass = {
          info: 'toast-item-info',
          success: 'toast-item-success',
          warning: 'toast-item-warning',
          error: 'toast-item-error'
        }[toast.type];

        const icons = {
          info: 'ℹ️',
          success: '✅',
          warning: '⚠️',
          error: '❌'
        };

        return (
          <div
            key={toast.id}
            className={`toast-item ${typeClass}`}
          >
            <span style={{ fontSize: '1.2rem', lineHeight: '1' }}>{icons[toast.type]}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem' }}>{toast.title}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.85, wordBreak: 'break-word' }}>{toast.message}</div>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="toast-close-btn"
            >
              ✖
            </button>
          </div>
        );
      })}
    </div>
  );
};