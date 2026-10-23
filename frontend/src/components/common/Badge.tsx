import React from 'react';
import styles from './Badge.module.css';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'emerald' | 'blue' | 'amber' | 'crimson' | 'purple' | 'neutral';
  size?: 'sm' | 'md';
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'sm',
  dot = false,
  children,
  className = '',
  ...props
}) => {
  const variantClass = styles[variant] || styles.neutral;
  const sizeClass = styles[size] || styles.sm;

  return (
    <span className={`${styles.badge} ${variantClass} ${sizeClass} ${className}`} {...props}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      <span>{children}</span>
    </span>
  );
};
