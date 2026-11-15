import { useState, useCallback, useEffect } from 'react';
import { publicClient, CONTRACT_ADDRESSES, ABIS } from '../utils/web3.js';

export interface HypervisorPreFlightReport {
  isSafe: boolean;
  severity: 'NONE' | 'WARNING' | 'CRITICAL' | 'FATAL';
  riskScore: number;
  currentNAVPerShare: bigint;
  projectedNAVPerShare: bigint;
  currentCollateralRatioBps: bigint;
  projectedCollateralRatioBps: bigint;
  totalTreasuryDebtUSD: bigint;
  maxTreasuryDebtCapUSD: bigint;
  anomalyCode: `0x${string}`;
  summary: string;
}

export interface HypervisorHealth {
  isHealthy: boolean;
  navPerShare: bigint;
  collateralRatioBps: bigint;
  totalAssetsUSD: bigint;
  totalLiabilitiesUSD: bigint;
  totalDebtUSD: bigint;
  maxDebtCapUSD: bigint;
}

const SEVERITY_MAP: Record<number, HypervisorPreFlightReport['severity']> = {
  0: 'NONE',
  1: 'WARNING',
  2: 'CRITICAL',
  3: 'FATAL'
};

export function useHypervisorSentinel() {
  const [isInspecting, setIsInspecting] = useState(false);
  const [health, setHealth] = useState<HypervisorHealth | null>(null);
  const hypervisorAddress = (CONTRACT_ADDRESSES as any).HYPERVISOR as `0x${string}` | undefined;

  const fetchHealth = useCallback(async () => {
    if (!hypervisorAddress || hypervisorAddress === '0x0000000000000000000000000000000000000000') {
      return null;
    }
    try {
      const data = await publicClient.readContract({
        address: hypervisorAddress,
        abi: (ABIS as any).HYPERVISOR,
        functionName: 'assessTreasuryHealth'
      }) as any;

      const parsedHealth: HypervisorHealth = {
        isHealthy: Boolean(data.isHealthy),
        navPerShare: BigInt(data.navPerShare || 0n),
        collateralRatioBps: BigInt(data.collateralRatioBps || 0n),
        totalAssetsUSD: BigInt(data.totalAssetsUSD || 0n),
        totalLiabilitiesUSD: BigInt(data.totalLiabilitiesUSD || 0n),
        totalDebtUSD: BigInt(data.totalDebtUSD || 0n),
        maxDebtCapUSD: BigInt(data.maxDebtCapUSD || 0n)
      };
      setHealth(parsedHealth);
      return parsedHealth;
    } catch (err) {
      console.warn('[HypervisorSentinel] Error reading health:', err);
      return null;
    }
  }, [hypervisorAddress]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  /**
   * Inspecciona una llamada transaccional pre-flight contra el Hypervisor en la blockchain.
   */
  const inspectTransaction = useCallback(async (
    target: `0x${string}`,
    calldata: `0x${string}`,
    userAccount?: `0x${string}`
  ): Promise<HypervisorPreFlightReport> => {
    const user = userAccount || '0x0000000000000000000000000000000000000000';

    if (!hypervisorAddress || hypervisorAddress === '0x0000000000000000000000000000000000000000') {
      // Si el Hypervisor no está desplegado aún en este entorno, devuelve paso limpio
      return {
        isSafe: true,
        severity: 'NONE',
        riskScore: 0,
        currentNAVPerShare: 0n,
        projectedNAVPerShare: 0n,
        currentCollateralRatioBps: 10000n,
        projectedCollateralRatioBps: 10000n,
        totalTreasuryDebtUSD: 0n,
        maxTreasuryDebtCapUSD: 0n,
        anomalyCode: '0x0000000000000000000000000000000000000000000000000000000000000000',
        summary: 'Hypervisor en modo pasivo (sin dirección configurada).'
      };
    }

    setIsInspecting(true);
    try {
      const rawReport = await publicClient.readContract({
        address: hypervisorAddress,
        abi: (ABIS as any).HYPERVISOR,
        functionName: 'inspectPreFlight',
        args: [target, calldata, user]
      }) as any;

      const report: HypervisorPreFlightReport = {
        isSafe: Boolean(rawReport.isSafe),
        severity: SEVERITY_MAP[Number(rawReport.severity)] || 'NONE',
        riskScore: Number(rawReport.riskScore),
        currentNAVPerShare: BigInt(rawReport.currentNAVPerShare || 0n),
        projectedNAVPerShare: BigInt(rawReport.projectedNAVPerShare || 0n),
        currentCollateralRatioBps: BigInt(rawReport.currentCollateralRatioBps || 0n),
        projectedCollateralRatioBps: BigInt(rawReport.projectedCollateralRatioBps || 0n),
        totalTreasuryDebtUSD: BigInt(rawReport.totalTreasuryDebtUSD || 0n),
        maxTreasuryDebtCapUSD: BigInt(rawReport.maxTreasuryDebtCapUSD || 0n),
        anomalyCode: rawReport.anomalyCode,
        summary: String(rawReport.summary || '')
      };

      return report;
    } catch (err: any) {
      console.error('[HypervisorSentinel] Pre-flight simulation error:', err);
      return {
        isSafe: false,
        severity: 'CRITICAL',
        riskScore: 99,
        currentNAVPerShare: 0n,
        projectedNAVPerShare: 0n,
        currentCollateralRatioBps: 0n,
        projectedCollateralRatioBps: 0n,
        totalTreasuryDebtUSD: 0n,
        maxTreasuryDebtCapUSD: 0n,
        anomalyCode: '0x0000000000000000000000000000000000000000000000000000000000000000',
        summary: `Error en la simulación estática del Hypervisor: ${err?.message || 'Revert'}`
      };
    } finally {
      setIsInspecting(false);
    }
  }, [hypervisorAddress]);

  /**
   * Guarda de ejecución: simula y valida la llamada antes de abrir el popup de MetaMask.
   */
  const preflightGuard = useCallback(async ({
    target,
    calldata,
    userAccount,
    onApproved,
    onRejected
  }: {
    target: `0x${string}`;
    calldata: `0x${string}`;
    userAccount?: `0x${string}`;
    onApproved: () => Promise<void> | void;
    onRejected: (report: HypervisorPreFlightReport) => void;
  }) => {
    const report = await inspectTransaction(target, calldata, userAccount);
    if (!report.isSafe || report.severity === 'CRITICAL' || report.severity === 'FATAL') {
      onRejected(report);
      return false;
    }
    await onApproved();
    return true;
  }, [inspectTransaction]);

  return {
    isInspecting,
    health,
    fetchHealth,
    inspectTransaction,
    preflightGuard,
    hypervisorAddress
  };
}
