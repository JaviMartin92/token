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
    <div style={{
      position: 'fixed',
      bottom: '1.5rem',
      right: '1.5rem',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      maxWidth: '380px',
      width: '100%'
    }}>
      {toasts.map((toast) => {
        const bgColors = {
          info: 'rgba(59, 130, 246, 0.15)',
          success: 'rgba(34, 197, 94, 0.15)',
          warning: 'rgba(234, 179, 8, 0.15)',
          error: 'rgba(239, 68, 68, 0.15)'
        };
        const borderColors = {
          info: 'rgba(59, 130, 246, 0.4)',
          success: 'rgba(34, 197, 94, 0.4)',
          warning: 'rgba(234, 179, 8, 0.4)',
          error: 'rgba(239, 68, 68, 0.4)'
        };
        const icons = {
          info: 'ℹ️',
          success: '✅',
          warning: '⚠️',
          error: '❌'
        };

        return (
          <div
            key={toast.id}
            style={{
              background: bgColors[toast.type],
              border: `1px solid ${borderColors[toast.type]}`,
              backdropFilter: 'blur(12px)',
              borderRadius: '12px',
              padding: '0.85rem 1.1rem',
              color: '#fff',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              animation: 'slideIn 0.3s ease-out'
            }}
          >
            <span style={{ fontSize: '1.2rem', lineHeight: '1' }}>{icons[toast.type]}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem' }}>{toast.title}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.85, wordBreak: 'break-word' }}>{toast.message}</div>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                color: '#aaa',
                cursor: 'pointer',
                fontSize: '1rem',
                padding: '0 0.2rem'
              }}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
};