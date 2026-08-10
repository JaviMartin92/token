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
    <div className="modal-overlay">
      <div className="glass-panel modal-container">
        {/* Header */}
        <div className="txc-header-row">
          <div>
            <div className="txc-header-left">
              <span className="txc-action-icon">{txDetails.actionIcon}</span>
              <h3 data-testid="modal-title" className="txc-title-h3">{txDetails.title}</h3>
            </div>
            <span
              data-testid="modal-type-badge"
              className="txc-type-badge"
            >
              {txDetails.typeBadge}
            </span>
          </div>
          <button
            data-testid="modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            className="txc-close-btn"
          >
            ✕
          </button>
        </div>

        {/* Input vs Output Flow Card */}
        <div className="txc-flow-card">
          <div>
            <div className="txc-flow-label">ENVIAS / ENTRADA</div>
            <div data-testid="modal-input-amount" className="txc-flow-val-input">
              {txDetails.inputAmount} <span className="txc-flow-symbol">{txDetails.inputSymbol}</span>
            </div>
          </div>

          <div className="txc-flow-arrow">➔</div>

          <div className="text-right">
            <div className="txc-flow-label">RECIBES / ESTIMADO</div>
            <div data-testid="modal-expected-output" className="txc-flow-val-output">
              {txDetails.expectedOutput} <span className="txc-flow-symbol">{txDetails.expectedOutputSymbol}</span>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown Table */}
        <div className="txc-details-stack">
          <div className="txc-details-title">
            Resumen Operativo & Parámetros
          </div>

          {txDetails.details.map((item, idx) => (
            <div
              key={idx}
              className={`txc-item-row ${item.isHighlight ? 'txc-item-highlight' : 'txc-item-normal'}`}
            >
              <span className="opacity-70">{item.label}:</span>
              <div className="acp-flex-row-gap5">
                <span className={item.isHighlight ? 'txc-item-val-highlight' : 'txc-item-val-normal'}>{item.value}</span>
                {item.badge && (
                  <span className="txc-item-badge">
                    {item.badge}
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Contract Target Address */}
          <div className="txc-target-row">
            <span className="opacity-60">Contrato Objetivo:</span>
            <span data-testid="modal-contract-target" className="txc-target-addr">
              {txDetails.targetContractName} ({txDetails.targetContractAddress?.slice(0, 6)}...{txDetails.targetContractAddress?.slice(-4)})
            </span>
          </div>
        </div>

        {/* Warning Note if present */}
        {txDetails.warningNote && (
          <div className="txc-warning-box">
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
            className="txc-cancel-btn"
          >
            Cancelar
          </button>

          <button
            data-testid="modal-confirm-btn"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="txc-confirm-btn"
            style={txDetails.confirmButtonColor ? { background: txDetails.confirmButtonColor } : undefined}
          >
            {isSubmitting ? '⏳ Firmando...' : (txDetails.confirmButtonText || '✍️ Confirmar y Firmar')}
          </button>
        </div>
      </div>
    </div>
  );
};
