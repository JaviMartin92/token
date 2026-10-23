import React, { useState } from 'react';
import styles from './Card.module.css';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'surface' | 'elevated' | 'highlight' | 'subtle';
  className?: string;
  headerTitle?: string;
  headerSubtitle?: string;
  headerAction?: React.ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  isExpanded?: boolean;
  onToggleExpanded?: (expanded: boolean) => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'surface',
  className = '',
  headerTitle,
  headerSubtitle,
  headerAction,
  collapsible = false,
  defaultExpanded = true,
  isExpanded: controlledExpanded,
  onToggleExpanded,
  ...props
}) => {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  const handleToggle = () => {
    if (!collapsible) return;
    const next = !isExpanded;
    if (controlledExpanded === undefined) {
      setInternalExpanded(next);
    }
    if (onToggleExpanded) {
      onToggleExpanded(next);
    }
  };

  const variantClass = styles[variant] || styles.surface;

  return (
    <div className={`${styles.card} ${variantClass} ${className}`} {...props}>
      {(headerTitle || headerAction || collapsible) && (
        <div
          className={`${styles.header} ${collapsible ? styles.headerClickable : ''} ${!isExpanded ? styles.headerClosed : ''}`}
          onClick={collapsible ? handleToggle : undefined}
          role={collapsible ? 'button' : undefined}
          tabIndex={collapsible ? 0 : undefined}
          aria-expanded={collapsible ? isExpanded : undefined}
          onKeyDown={collapsible ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleToggle();
            }
          } : undefined}
        >
          <div className={styles.headerTitleGroup}>
            {headerTitle && <h3 className={styles.title}>{headerTitle}</h3>}
            {headerSubtitle && <p className={styles.subtitle}>{headerSubtitle}</p>}
          </div>

          <div className={styles.headerActionGroup}>
            {headerAction && (
              <div
                className={styles.headerAction}
                onClick={(e) => {
                  if (collapsible) e.stopPropagation();
                }}
              >
                {headerAction}
              </div>
            )}

            {collapsible && (
              <span
                className={`${styles.chevron} ${isExpanded ? styles.chevronExpanded : ''}`}
                aria-hidden="true"
              >
                ▼
              </span>
            )}
          </div>
        </div>
      )}
      <div
        className={`${styles.body} ${isExpanded ? styles.bodyExpanded : styles.bodyCollapsed}`}
        aria-hidden={!isExpanded}
      >
        {children}
      </div>
    </div>
  );
};
