import React from 'react';
import { UI_STRINGS } from '../constants/strings.js';
import { Card } from './common/index.js';

interface ActivityLogProps {
  logs: string[];
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ logs }) => {
  return (
    <Card
      variant="surface"
      collapsible
      defaultExpanded={false}
      headerTitle={`📜 ${UI_STRINGS.MODALS.ACTIVITY_LOG.TITLE}`}
      headerSubtitle="Registro cronológico en tiempo real de llamadas Web3, oráculos y transacciones"
    >
      <div data-testid="activity-log-container" className="activity-log-box">
        {logs.length === 0 ? (
          <span className="activity-log-empty">{UI_STRINGS.MODALS.ACTIVITY_LOG.EMPTY}</span>
        ) : (
          logs.map((log, idx) => {
            const isError = log.includes('[Error]');
            const isReset = log.includes('[Reset');
            return (
              <div
                key={idx}
                className={isError ? 'activity-log-item-error' : isReset ? 'activity-log-item-reset' : 'activity-log-item-normal'}
              >
                {log}
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};
