import React from 'react';
import styles from './StatCard.module.css';

export interface StatCardProps {
  title: string;
  value: React.ReactNode;
  subtext?: React.ReactNode;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  testId?: string;
  variant?: 'default' | 'emerald' | 'blue' | 'amber' | 'crimson';
  className?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtext,
  badge,
  icon,
  testId,
  variant = 'default',
  className = '',
  onClick
}) => {
  const variantClass = styles[variant] || styles.default;
  const isClickable = Boolean(onClick);

  return (
    <div
      className={`${styles.statCard} ${variantClass} ${isClickable ? styles.clickable : ''} ${className}`}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      <div className={styles.header}>
        <div className={styles.titleRow}>
          {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
          <span className={styles.title}>{title}</span>
        </div>
        {badge && <div className={styles.badge}>{badge}</div>}
      </div>

      <div className={styles.valueRow}>
        <span data-testid={testId} className={styles.value}>
          {value}
        </span>
      </div>

      {subtext && <div className={styles.subtext}>{subtext}</div>}
    </div>
  );
};
