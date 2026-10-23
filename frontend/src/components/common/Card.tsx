import React from 'react';
import styles from './Card.module.css';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'surface' | 'elevated' | 'highlight' | 'subtle';
  className?: string;
  headerTitle?: string;
  headerSubtitle?: string;
  headerAction?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'surface',
  className = '',
  headerTitle,
  headerSubtitle,
  headerAction,
  ...props
}) => {
  const variantClass = styles[variant] || styles.surface;

  return (
    <div className={`${styles.card} ${variantClass} ${className}`} {...props}>
      {(headerTitle || headerAction) && (
        <div className={styles.header}>
          <div>
            {headerTitle && <h3 className={styles.title}>{headerTitle}</h3>}
            {headerSubtitle && <p className={styles.subtitle}>{headerSubtitle}</p>}
          </div>
          {headerAction && <div className={styles.headerAction}>{headerAction}</div>}
        </div>
      )}
      <div className={styles.body}>{children}</div>
    </div>
  );
};
