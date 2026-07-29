import { useState } from 'react';
import type { TxConfirmDetails } from '../components/TransactionConfirmModal.js';

export function useTransactionConfirm() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txDetails, setTxDetails] = useState<TxConfirmDetails | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

  const requestConfirmation = (details: TxConfirmDetails, action: () => Promise<void>) => {
    setTxDetails(details);
    setPendingAction(() => action);
    setIsOpen(true);
  };

  const handleConfirm = async () => {
    if (!pendingAction) return;
    try {
      setIsSubmitting(true);
      await pendingAction();
    } finally {
      setIsSubmitting(false);
      setIsOpen(false);
      setPendingAction(null);
      setTxDetails(null);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setIsOpen(false);
    setPendingAction(null);
    setTxDetails(null);
  };

  return {
    isOpen,
    isSubmitting,
    txDetails,
    requestConfirmation,
    handleConfirm,
    handleClose
  };
}
