import React from 'react';
import styles from './TransactionConfirmModal.module.css';
import { UI_STRINGS } from '../constants/strings.js';

interface TxDetailItem {
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
  confirmButtonVariant?: 'emerald' | 'purple' | 'danger' | 'blue' | 'amber' | 'pink' | 'indigo';
}

interface TransactionConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  txDetails: TxConfirmDetails | null;
  isSubmitting?: boolean;
}

const getVariantClass = (variant?: 'emerald' | 'purple' | 'danger' | 'blue' | 'amber' | 'pink' | 'indigo') => {
  switch (variant) {
    case 'purple': return styles.btnVariantPurple;
    case 'danger': return styles.btnVariantDanger;
    case 'blue': return styles.btnVariantBlue;
    case 'amber': return styles.btnVariantAmber;
    case 'pink': return styles.btnVariantPink;
    case 'indigo': return styles.btnVariantIndigo;
    case 'emerald':
    default:
      return styles.btnVariantEmerald;
  }
};

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
            <div className={styles.flowLabel}>{UI_STRINGS.MODALS.TRANSACTION_CONFIRM.FLOW_IN_LABEL}</div>
            <div data-testid="modal-input-amount" className={styles.flowValInput}>
              {txDetails.inputAmount} <span className={styles.flowSymbol}>{txDetails.inputSymbol}</span>
            </div>
          </div>

          <div className={styles.flowArrow}>➔</div>

          <div className="text-right">
            <div className={styles.flowLabel}>{UI_STRINGS.MODALS.TRANSACTION_CONFIRM.FLOW_OUT_LABEL}</div>
            <div data-testid="modal-expected-output" className={styles.flowValOutput}>
              {txDetails.expectedOutput} <span className={styles.flowSymbol}>{txDetails.expectedOutputSymbol}</span>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown Table */}
        <div className={styles.detailsStack}>
          <div className={styles.detailsTitle}>
            {UI_STRINGS.MODALS.TRANSACTION_CONFIRM.SUMMARY_SECTION_TITLE}
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
            <span className="opacity-60">{UI_STRINGS.MODALS.TRANSACTION_CONFIRM.TARGET_CONTRACT_LABEL}</span>
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
            {UI_STRINGS.MODALS.TRANSACTION_CONFIRM.BTN_CANCEL}
          </button>

          <button
            data-testid="modal-confirm-btn"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`${styles.confirmBtn} ${getVariantClass(txDetails.confirmButtonVariant)}`}
          >
            {isSubmitting ? UI_STRINGS.MODALS.TRANSACTION_CONFIRM.BTN_SIGNING : (txDetails.confirmButtonText || UI_STRINGS.MODALS.TRANSACTION_CONFIRM.BTN_CONFIRM_DEFAULT)}
          </button>
        </div>
      </div>
    </div>
  );
};
