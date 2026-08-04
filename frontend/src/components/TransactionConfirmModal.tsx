import React from 'react';

export interface TxDetailItem {
  label: string;
  value: string;
  badge?: string;
  isHighlight?: boolean;
}

export interface TxConfirmDetails {
  title: string;
  actionIcon: string;
  typeBadge: string;
  targetContractName: string;
  targetContractAddress: string;
  inputAmount: string;
  inputSymbol: string;
  expectedOutput: string;
  expectedOutputSymbol: string;
  details: TxDetailItem[];
  warningNote?: string;
  confirmButtonText?: string;
  confirmButtonColor?: string;
}

interface TransactionConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  txDetails: TxConfirmDetails | null;
  isSubmitting?: boolean;
}

export const TransactionConfirmModal: React.FC<TransactionConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  txDetails,
  isSubmitting = false
}) => {
  if (!isOpen || !txDetails) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem'
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: '20px',
          padding: '1.75rem',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          background: 'linear-gradient(145deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.95) 100%)',
          color: '#fff',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '1.5rem' }}>{txDetails.actionIcon}</span>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{txDetails.title}</h3>
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.6rem',
                borderRadius: '6px',
                background: 'rgba(99, 102, 241, 0.2)',
                color: '#818cf8',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                fontWeight: 600
              }}
            >
              {txDetails.typeBadge}
            </span>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              color: '#aaa',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              fontSize: '1.1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* Input vs Output Flow Card */}
        <div
          style={{
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '14px',
            padding: '1.1rem 1.25rem',
            marginBottom: '1.25rem',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.15rem' }}>ENVIAS / ENTRADA</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8' }}>
              {txDetails.inputAmount} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>{txDetails.inputSymbol}</span>
            </div>
          </div>

          <div style={{ fontSize: '1.4rem', opacity: 0.5 }}>➔</div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.15rem' }}>RECIBES / ESTIMADO</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#4ade80' }}>
              {txDetails.expectedOutput} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>{txDetails.expectedOutputSymbol}</span>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem', fontSize: '0.83rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.5, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.1rem' }}>
            Resumen Operativo & Parámetros
          </div>

          {txDetails.details.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.45rem 0.6rem',
                borderRadius: '8px',
                background: item.isHighlight ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.02)',
                border: item.isHighlight ? '1px solid rgba(99, 102, 241, 0.2)' : 'none'
              }}
            >
              <span style={{ opacity: 0.7 }}>{item.label}:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontWeight: item.isHighlight ? 700 : 600, color: item.isHighlight ? '#a855f7' : '#fff' }}>{item.value}</span>
                {item.badge && (
                  <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' }}>
                    {item.badge}
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Contract Target Address */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.45rem 0.6rem',
              borderRadius: '8px',
              background: 'rgba(0,0,0,0.25)',
              fontSize: '0.78rem'
            }}
          >
            <span style={{ opacity: 0.6 }}>Contrato Objetivo:</span>
            <span style={{ fontFamily: 'monospace', opacity: 0.85, color: '#38bdf8' }}>
              {txDetails.targetContractName} ({txDetails.targetContractAddress?.slice(0, 6)}...{txDetails.targetContractAddress?.slice(-4)})
            </span>
          </div>
        </div>

        {/* Warning Note if present */}
        {txDetails.warningNote && (
          <div
            style={{
              background: 'rgba(234, 179, 8, 0.1)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              borderRadius: '10px',
              padding: '0.75rem',
              marginBottom: '1.25rem',
              fontSize: '0.78rem',
              color: '#fde047',
              lineHeight: 1.4,
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'flex-start'
            }}
          >
            <span>⚠️</span>
            <span>{txDetails.warningNote}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              padding: '0.75rem',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#fff',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer'
            }}
          >
            Cancelar
          </button>

          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            style={{
              padding: '0.75rem',
              borderRadius: '10px',
              background: txDetails.confirmButtonColor || 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              border: 'none',
              color: '#fff',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            {isSubmitting ? '⏳ Firmando...' : (txDetails.confirmButtonText || '✍️ Confirmar y Firmar')}
          </button>
        </div>
      </div>
    </div>
  );
};
