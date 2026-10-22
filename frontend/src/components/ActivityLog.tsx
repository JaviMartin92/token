import React from 'react';
import { UI_STRINGS } from '../constants/strings.js';

interface ActivityLogProps {
  logs: string[];
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ logs }) => {
  return (
    <div className="glass-panel activity-log-card">
      <h4 className="activity-log-header">
        {UI_STRINGS.MODALS.ACTIVITY_LOG.TITLE}
      </h4>
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
    </div>
  );
};