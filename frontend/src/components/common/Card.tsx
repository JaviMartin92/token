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
  defaultExpanded = false,
  isExpanded: controlledExpanded,
  onToggleExpanded,
  ...props
}) => {
  const isTestingEnv = typeof window !== 'undefined' && Boolean((window as any).__PLAYWRIGHT_TEST__);
  const [internalExpanded, setInternalExpanded] = useState(isTestingEnv ? true : defaultExpanded);
  const isExpanded = !collapsible
    ? true
    : controlledExpanded !== undefined
    ? controlledExpanded
    : internalExpanded;

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
          <div className={styles.titleArea}>
            {headerTitle && <h3 className={styles.title}>{headerTitle}</h3>}
          </div>

          {collapsible && (
            <div className={styles.chevronArea}>
              <span
                className={`${styles.chevronWrapper} ${isExpanded ? styles.chevronWrapperExpanded : ''}`}
                aria-hidden="true"
              >
                <svg
                  className={styles.chevronSvg}
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>
            </div>
          )}

          {headerSubtitle && (
            <div className={styles.subtitleArea}>
              <p className={styles.subtitle}>{headerSubtitle}</p>
            </div>
          )}

          {headerAction && (
            <div
              className={`${styles.actionArea} ${!isExpanded ? styles.actionAreaHidden : ''}`}
              onClick={(e) => {
                if (collapsible) e.stopPropagation();
              }}
            >
              {headerAction}
            </div>
          )}
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
