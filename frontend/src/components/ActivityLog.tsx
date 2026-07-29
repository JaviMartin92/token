import React from 'react';

interface ActivityLogProps {
  logs: string[];
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ logs }) => {
  return (
    <div className="glass-panel activity-log-card">
      <h4 className="activity-log-header">
        📋 Registro de Actividad On-Chain & Logs
      </h4>
      <div className="activity-log-box">
        {logs.length === 0 ? (
          <span className="activity-log-empty">No se registraron transacciones recientes.</span>
        ) : (
          logs.map((log, idx) => {
            const isError = log.includes('[Error]');
            const isReset = log.includes('[Reset');
            return (
              <div
                key={idx}
                style={{
                  color: isError ? '#f87171' : isReset ? '#facc15' : '#818cf8',
                  wordBreak: 'break-word'
                }}
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