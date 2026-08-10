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
            <span className="toast-icon">{icons[toast.type]}</span>
            <div className="toast-content-box">
              <div className="toast-title-text">{toast.title}</div>
              <div className="toast-msg-text">{toast.message}</div>
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