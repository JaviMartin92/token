import React from 'react';
import { useFounderVesting } from '../hooks/useFounderVesting.js';

interface FounderVestingCardProps {
  userAddress: string;
  addLog: (msg: string) => void;
  addToast: (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => void;
}

export const FounderVestingCard: React.FC<FounderVestingCardProps> = ({
  userAddress,
  addLog,
  addToast
}) => {
  const {
    totalAllocation,
    totalClaimed,
    remainingAllocation,
    beneficiary,
    claimableAlpha,
    claimableAlphaNum,
    surplusUSD,
    surplusUSDNum,
    canClaim,
    nextAvailableDate,
    isBeneficiary,
    cooldownRemainingSec,
    executeClaim
  } = useFounderVesting(userAddress, addLog, addToast);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-xl">
            🏛️
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Asignación Propietario / Fundador
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Respaldo por Solvencia
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Liberación ligada estrictamente a la salud y excedente de reservas del protocolo (Máx 10% excedente / 72h).
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800/80">
          <span className="text-xs text-slate-400 block mb-1">Asignación Total Bloqueada</span>
          <span className="text-lg font-bold text-white font-mono">{totalAllocation} ALPHA</span>
          <span className="text-[10px] text-slate-500 block mt-1">100k Génesis Allocation</span>
        </div>

        <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800/80">
          <span className="text-xs text-slate-400 block mb-1">Restante por Liberar</span>
          <span className="text-lg font-bold text-amber-400 font-mono">{remainingAllocation} ALPHA</span>
          <span className="text-[10px] text-slate-500 block mt-1">Total Reclamado: {totalClaimed} ALPHA</span>
        </div>

        <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800/80">
          <span className="text-xs text-slate-400 block mb-1">Excedente de Reservas (USD)</span>
          <span className="text-lg font-bold text-emerald-400 font-mono">${surplusUSD} USD</span>
          <span className="text-[10px] text-slate-500 block mt-1">Activos &gt; Pasivos</span>
        </div>

        <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800/80">
          <span className="text-xs text-slate-400 block mb-1">Reclamable Actual (10% Máx)</span>
          <span className="text-lg font-bold text-cyan-400 font-mono">{claimableAlpha} ALPHA</span>
          <span className="text-[10px] text-slate-500 block mt-1">
            {cooldownRemainingSec > 0 ? `Próximo: ${nextAvailableDate}` : 'Cooldown Completado'}
          </span>
        </div>
      </div>

      <div className="bg-slate-950/40 p-4 rounded-lg border border-slate-800/50 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-xs text-slate-400 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Beneficiario Registrado:</span>
            <span className="font-mono text-slate-300">{beneficiary ? `${beneficiary.slice(0, 8)}...${beneficiary.slice(-6)}` : 'Cargando...'}</span>
            {isBeneficiary && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                Tu Billetera
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            🛡️ Si las reservas bajan y no hay excedente, los reclamos se bloquean automáticamente para proteger a los usuarios.
          </p>
        </div>

        <button
          onClick={executeClaim}
          disabled={!canClaim || claimableAlphaNum <= 0}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg ${
            canClaim && claimableAlphaNum > 0
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20 cursor-pointer font-bold'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
          }`}
        >
          {canClaim && claimableAlphaNum > 0
            ? `📥 Reclamar ${claimableAlpha} ALPHA`
            : surplusUSDNum <= 0
            ? '🔒 Sin Excedente de Reservas'
            : cooldownRemainingSec > 0
            ? `⏳ Cooldown 72h Activo`
            : '🔒 Reclamo No Disponible'}
        </button>
      </div>
    </div>
  );
};
