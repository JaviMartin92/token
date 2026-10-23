import React from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'emerald';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loadingText?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loadingText,
  iconLeft,
  iconRight,
  className = '',
  disabled,
  ...props
}) => {
  const variantClass = styles[variant] || styles.primary;
  const sizeClass = styles[size] || styles.md;

  return (
    <button
      className={`${styles.button} ${variantClass} ${sizeClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className={styles.loadingWrapper}>
          <span className={styles.spinner} aria-hidden="true" />
          <span>{loadingText || children}</span>
        </span>
      ) : (
        <span className={styles.contentWrapper}>
          {iconLeft && <span className={styles.icon}>{iconLeft}</span>}
          <span className={styles.text}>{children}</span>
          {iconRight && <span className={styles.icon}>{iconRight}</span>}
        </span>
      )}
    </button>
  );
};
