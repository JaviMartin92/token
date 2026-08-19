import React, { useId } from 'react';
import styles from './TokenAmountInput.module.css';

export interface TokenAmountInputProps {
  value: string;
  onChange: (value: string) => void;
  tokenSymbol: string;
  tokenDecimals?: number;
  maxBalance?: number | string;
  onMaxClick?: () => void;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  testId?: string;
  showMaxButton?: boolean;
  reserveGas?: boolean;
  minAmount?: number;
  className?: string;
}

export const TokenAmountInput: React.FC<TokenAmountInputProps> = ({
  value,
  onChange,
  tokenSymbol,
  tokenDecimals = 18,
  maxBalance,
  onMaxClick,
  disabled = false,
  placeholder = '0.0',
  label,
  testId,
  showMaxButton = true,
  reserveGas = false,
  className = ''
}) => {
  const inputId = useId();

  const numVal = parseFloat(value);
  const numBalance = (maxBalance !== undefined && maxBalance !== null)
    ? (typeof maxBalance === 'string' ? parseFloat(maxBalance.replace(/,/g, '').trim()) : Number(maxBalance))
    : undefined;

  const isInsufficient = maxBalance !== undefined &&
    maxBalance !== null &&
    !isNaN(numVal) &&
    numBalance !== undefined &&
    !isNaN(numBalance) &&
    numVal > numBalance;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;

    // Allow empty
    if (raw === '') {
      onChange('');
      return;
    }

    // Replace comma with dot
    raw = raw.replace(',', '.');

    // Only allow positive numbers and a single dot
    if (!/^\d*\.?\d*$/.test(raw)) {
      return;
    }

    // Enforce decimal limit
    const parts = raw.split('.');
    if (parts.length === 2 && parts[1].length > tokenDecimals) {
      raw = `${parts[0]}.${parts[1].slice(0, tokenDecimals)}`;
    }

    onChange(raw);
  };

  const handleSetMax = () => {
    if (onMaxClick) {
      onMaxClick();
      return;
    }

    if (numBalance !== undefined && !isNaN(numBalance)) {
      let maxVal = numBalance;
      if (reserveGas && maxVal > 0.01) {
        maxVal = Math.max(0, maxVal - 0.01);
      }
      onChange(maxVal.toString());
    }
  };

  return (
    <div className={`${styles.container} ${className}`}>
      {(label || maxBalance !== undefined) && (
        <div className={styles.header}>
          {label && <label htmlFor={inputId} className={styles.label}>{label}</label>}
          {maxBalance !== undefined && (
            <span
              className={styles.balance}
              onClick={handleSetMax}
              title="Haz clic para seleccionar el balance máximo"
            >
              Saldo: {typeof maxBalance === 'number' ? maxBalance.toLocaleString('en-US', { maximumFractionDigits: 4 }) : maxBalance} {tokenSymbol}
            </span>
          )}
        </div>
      )}

      <div className={`${styles.inputWrapper} ${isInsufficient ? styles.inputWrapperError : ''}`}>
        <input
          id={inputId}
          data-testid={testId}
          type="text"
          inputMode="decimal"
          pattern="^[0-9]*[.,]?[0-9]*$"
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          className={styles.input}
          autoComplete="off"
        />

        <div className={styles.controls}>
          {showMaxButton && maxBalance !== undefined && (
            <button
              type="button"
              onClick={handleSetMax}
              disabled={disabled || (numBalance !== undefined && numBalance <= 0)}
              className={styles.maxBtn}
            >
              MAX
            </button>
          )}
          <span className={styles.symbolBadge}>{tokenSymbol}</span>
        </div>
      </div>

      {isInsufficient && numBalance !== undefined && (
        <span className={styles.errorText}>
          ⚠️ Saldo insuficiente ({numVal.toLocaleString('en-US')} &gt; {numBalance.toLocaleString('en-US')} {tokenSymbol})
        </span>
      )}
    </div>
  );
};
