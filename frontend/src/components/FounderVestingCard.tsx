import React from 'react';
import styles from './FounderVestingCard.module.css';
import { useFounderVesting } from '../hooks/useFounderVesting.js';
import { Card, Badge, Button, StatCard } from './common/index.js';

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
    <Card
      variant="surface"
      collapsible
      defaultExpanded={true}
      headerTitle="🏛️ Asignación Propietario / Fundador"
      headerSubtitle="Liberación de vesting ligada estrictamente a la salud y excedente de reservas del protocolo (Máx 10% / 72h)"
      headerAction={
        <Badge variant="amber" size="sm">
          Respaldo por Solvencia
        </Badge>
      }
    >
      <div className={styles.container}>
        {/* 📊 Grid de Métricas Principales */}
        <div className={styles.gridKpi}>
          <StatCard
            title="Asignación Total Bloqueada"
            value={`${totalAllocation} ALPHA`}
            variant="default"
            icon="🔒"
            subtext="100k Génesis Allocation"
          />

          <StatCard
            title="Restante por Liberar"
            value={`${remainingAllocation} ALPHA`}
            variant="amber"
            icon="⏳"
            subtext={`Total Reclamado: ${totalClaimed} ALPHA`}
          />

          <StatCard
            title="Excedente de Reservas"
            value={`$${surplusUSD} USD`}
            variant="emerald"
            icon="💎"
            subtext="Activos > Pasivos en Tesorería"
          />

          <StatCard
            title="Reclamable Actual (10% Máx)"
            value={`${claimableAlpha} ALPHA`}
            variant="blue"
            icon="📥"
            subtext={cooldownRemainingSec > 0 ? `Próximo: ${nextAvailableDate}` : 'Cooldown Completado'}
          />
        </div>

        {/* 👛 Panel de Beneficiario y Ejecución de Reclamo */}
        <div className={styles.footer}>
          <div className={styles.beneficiaryInfo}>
            <div className={styles.beneficiaryRow}>
              <span className={styles.beneficiaryLabel}>Beneficiario Registrado:</span>
              <span className={styles.beneficiaryAddr}>
                {beneficiary ? `${beneficiary.slice(0, 8)}...${beneficiary.slice(-6)}` : 'Cargando...'}
              </span>
              {isBeneficiary && (
                <Badge variant="emerald" size="sm">
                  Tu Billetera
                </Badge>
              )}
            </div>
            <p className={styles.disclaimer}>
              🛡️ Si las reservas bajan y no hay excedente de solvencia, los reclamos se bloquean automáticamente para proteger el patrimonio de los usuarios.
            </p>
          </div>

          <Button
            variant={canClaim && claimableAlphaNum > 0 ? 'emerald' : 'secondary'}
            size="md"
            onClick={executeClaim}
            disabled={!canClaim || claimableAlphaNum <= 0}
            className={styles.claimBtn}
          >
            {canClaim && claimableAlphaNum > 0
              ? `📥 Reclamar ${claimableAlpha} ALPHA`
              : surplusUSDNum <= 0
              ? '🔒 Sin Excedente de Reservas'
              : cooldownRemainingSec > 0
              ? `⏳ Cooldown 72h Activo`
              : '🔒 Reclamo No Disponible'}
          </Button>
        </div>
      </div>
    </Card>
  );
};
