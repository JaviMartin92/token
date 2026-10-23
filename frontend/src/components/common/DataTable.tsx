import React from 'react';
import styles from './DataTable.module.css';

export interface DataTableProps {
  headers?: React.ReactNode[];
  children: React.ReactNode;
  emptyState?: React.ReactNode;
  className?: string;
  minWidth?: string | number;
}

export const DataTable: React.FC<DataTableProps> = ({
  headers,
  children,
  emptyState,
  className = '',
  minWidth = '100%'
}) => {
  const hasContent = React.Children.count(children) > 0;

  return (
    <div className={`${styles.tableWrapper} ${className}`}>
      <table className={styles.table} style={{ minWidth }}>
        {headers && headers.length > 0 && (
          <thead>
            <tr className={styles.headerRow}>
              {headers.map((header, idx) => (
                <th key={idx} className={styles.headerCell}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className={styles.tbody}>
          {hasContent ? (
            children
          ) : (
            <tr>
              <td colSpan={headers ? headers.length : 1} className={styles.emptyCell}>
                {emptyState || 'No hay datos disponibles'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
