import React from 'react';
import styles from './TransactionConfirmModal.module.css';

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
    <div className="modal-overlay">
      <div className="glass-panel modal-container">
        {/* Header */}
        <div className={styles.headerRow}>
          <div>
            <div className={styles.headerLeft}>
              <span className={styles.actionIcon}>{txDetails.actionIcon}</span>
              <h3 data-testid="modal-title" className={styles.titleH3}>{txDetails.title}</h3>
            </div>
            <span
              data-testid="modal-type-badge"
              className={styles.typeBadge}
            >
              {txDetails.typeBadge}
            </span>
          </div>
          <button
            data-testid="modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            className={styles.closeBtn}
          >
            ✕
          </button>
        </div>

        {/* Input vs Output Flow Card */}
        <div className={styles.flowCard}>
          <div>
            <div className={styles.flowLabel}>ENVIAS / ENTRADA</div>
            <div data-testid="modal-input-amount" className={styles.flowValInput}>
              {txDetails.inputAmount} <span className={styles.flowSymbol}>{txDetails.inputSymbol}</span>
            </div>
          </div>

          <div className={styles.flowArrow}>➔</div>

          <div className="text-right">
            <div className={styles.flowLabel}>RECIBES / ESTIMADO</div>
            <div data-testid="modal-expected-output" className={styles.flowValOutput}>
              {txDetails.expectedOutput} <span className={styles.flowSymbol}>{txDetails.expectedOutputSymbol}</span>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown Table */}
        <div className={styles.detailsStack}>
          <div className={styles.detailsTitle}>
            Resumen Operativo & Parámetros
          </div>

          {txDetails.details.map((item, idx) => (
            <div
              key={idx}
              className={`${styles.itemRow} ${item.isHighlight ? styles.itemHighlight : styles.itemNormal}`}
            >
              <span className="opacity-70">{item.label}:</span>
              <div className="acp-flex-row-gap5">
                <span className={item.isHighlight ? styles.itemValHighlight : styles.itemValNormal}>{item.value}</span>
                {item.badge && (
                  <span className={styles.itemBadge}>
                    {item.badge}
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Contract Target Address */}
          <div className={styles.targetRow}>
            <span className="opacity-60">Contrato Objetivo:</span>
            <span data-testid="modal-contract-target" className={styles.targetAddr}>
              {txDetails.targetContractName} ({txDetails.targetContractAddress?.slice(0, 6)}...{txDetails.targetContractAddress?.slice(-4)})
            </span>
          </div>
        </div>

        {/* Warning Note if present */}
        {txDetails.warningNote && (
          <div className={styles.warningBox}>
            <span>⚠️</span>
            <span>{txDetails.warningNote}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="admin-grid-2col">
          <button
            data-testid="modal-cancel-btn"
            onClick={onClose}
            disabled={isSubmitting}
            className={styles.cancelBtn}
          >
            Cancelar
          </button>

          <button
            data-testid="modal-confirm-btn"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={styles.confirmBtn}
            style={txDetails.confirmButtonColor ? { background: txDetails.confirmButtonColor } : undefined}
          >
            {isSubmitting ? '⏳ Firmando...' : (txDetails.confirmButtonText || '✍️ Confirmar y Firmar')}
          </button>
        </div>
      </div>
    </div>
  );
};
