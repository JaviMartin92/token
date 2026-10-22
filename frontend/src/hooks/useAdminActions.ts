import { useState } from 'react';
import { parseEther } from 'viem';
import { CONTRACT_ADDRESSES, ABIS, publicClient, getWalletClient } from '../utils/web3.js';
import type { TxConfirmDetails } from '../components/TransactionConfirmModal.js';
import { UI_STRINGS } from '../constants/strings.js';

interface UseAdminActionsProps {
  activeKey: string;
  snapshotId: string | null;
  setSnapshotId: any;
  fetchData: () => Promise<void>;
  addLog: (msg: string) => void;
  addToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
  requestConfirmation?: (details: TxConfirmDetails, action: () => Promise<void>) => void;
}

export function useAdminActions({
  activeKey,
  snapshotId,
  setSnapshotId,
  fetchData,
  addLog,
  addToast,
  requestConfirmation
}: UseAdminActionsProps) {
  const [oraclePrice, setOraclePrice] = useState('1.00');
  const [newStablesWeight, setNewStablesWeight] = useState('50');
  const [newWbtcWeight, setNewWbtcWeight] = useState('25');
  const [newWethWeight, setNewWethWeight] = useState('15');
  const [newAltsWeight, setNewAltsWeight] = useState('10');

  const executeUpdateOracle = async () => {
    try {
      addLog(`Actualizando precio de oráculo USDC a $${oraclePrice}...`);
      const client = getWalletClient(activeKey);
      const priceScaled = BigInt(Math.round(parseFloat(oraclePrice) * 1e8));

      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.USDC,
        abi: [{ name: 'updateAnswer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_answer', type: 'int256' }], outputs: [] }],
        functionName: 'updateAnswer',
        args: [priceScaled]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(UI_STRINGS.TOASTS_AND_LOGS.ORACLE_UPDATE_SUCCESS);
      addToast('success', 'Oráculo Actualizado', `USDC Feed fijado en $${oraclePrice}`);
      fetchData();
    } catch (err: any) {
      addLog(`[Error] Falló actualización de oráculo: ${err.message || err}`);
    }
  };

  const handleUpdateOracle = () => {
    if (requestConfirmation) {
      requestConfirmation({
        title: 'Actualizar Oráculo de Precio Chainlink',
        actionIcon: '🔮',
        typeBadge: 'Ajuste de Feed On-Chain',
        targetContractName: 'MockAggregatorV3.sol',
        targetContractAddress: CONTRACT_ADDRESSES.USDC,
        inputAmount: `$${oraclePrice}`,
        inputSymbol: 'Precio USD Feed Actualizado',
        expectedOutput: `$${oraclePrice}`,
        expectedOutputSymbol: 'NAV Chainlink Oracle Valuation',
        details: [
          { label: 'Activo Auditado', value: 'USDC Reserve Feed' },
          { label: 'Impacto en Valoración NAV', value: 'Revaluación Automática de Proof of Reserves en Tiempo Real', badge: 'PoR Chainlink' },
          { label: 'Comisión de Transacción', value: '0.00% (Gestión Interna de Gobernanza)' }
        ],
        warningNote: 'Actualizar el precio del oráculo recalculará inmediatamente la valoración de reservas líquidas del protocolo.',
        confirmButtonText: '✍️ Confirmar y Actualizar Oráculo',
        confirmButtonVariant: 'indigo'
      }, executeUpdateOracle);
    } else {
      executeUpdateOracle();
    }
  };

  const executeAdjustWeights = async () => {
    try {
      addLog('Ajustando pesos objetivo de la tesorería...');
      const client = getWalletClient(activeKey);
      const s = BigInt(Math.round(parseFloat(newStablesWeight) * 100));
      const b = BigInt(Math.round(parseFloat(newWbtcWeight) * 100));
      const e = BigInt(Math.round(parseFloat(newWethWeight) * 100));
      const a = BigInt(Math.round(parseFloat(newAltsWeight) * 100));

      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.TREASURY,
        abi: ABIS.TREASURY,
        functionName: 'setAssetWeights',
        args: [s, b, e, a]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(UI_STRINGS.TOASTS_AND_LOGS.WEIGHTS_ADJUST_SUCCESS);
      addToast('success', 'Pesos Rebalanceados', 'Tesorería ajustada on-chain');
      fetchData();
    } catch (err: any) {
      addLog(`[Error] Rebalanceo falló: ${err.message || err}`);
    }
  };

  const handleAdjustWeights = () => {
    if (requestConfirmation) {
      requestConfirmation({
        title: 'Rebalancear Pesos Objetivo de Tesorería',
        actionIcon: '⚖️',
        typeBadge: 'Rebalanceo Estratégico DAO',
        targetContractName: 'Treasury.sol',
        targetContractAddress: CONTRACT_ADDRESSES.TREASURY,
        inputAmount: 'Configuración Actual',
        inputSymbol: 'Pesos Antiguos',
        expectedOutput: `${newStablesWeight}% / ${newWbtcWeight}% / ${newWethWeight}% / ${newAltsWeight}%`,
        expectedOutputSymbol: 'Nuevos Pesos Target',
        details: [
          { label: 'Stablecoins (USDC Morpho)', value: `${newStablesWeight}% (Min 40% - Max 60%)` },
          { label: 'Wrapped Bitcoin (LBTC Lombard)', value: `${newWbtcWeight}% (Min 20% - Max 30%)` },
          { label: 'Wrapped Ethereum (wstETH Lido)', value: `${newWethWeight}% (Min 10% - Max 15%)` },
          { label: 'Préstamos & ALPHA Staking', value: `${newAltsWeight}% (Min 5% - Max 15%)` },
          { label: 'Validación de Rangos On-Chain', value: 'Cumple Límites Sanitarios de Seguridad', badge: 'Sanity Bounds OK' },
          { label: 'Comisión por Rebalanceo', value: '0.00% (Reestructuración Interna)' }
        ],
        warningNote: 'El ajuste reconfigura los flujos de re-acumulación de reservas del contrato inteligente Treasury.sol.',
        confirmButtonText: '✍️ Confirmar Rebalanceo',
        confirmButtonVariant: 'purple'
      }, executeAdjustWeights);
    } else {
      executeAdjustWeights();
    }
  };

  const handleSimulateDrop = async () => {
    try {
      addLog('Chequeando variación de precio en CircuitBreaker...');
      const client = getWalletClient(activeKey);
      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.CIRCUIT_BREAKER,
        abi: ABIS.CIRCUIT_BREAKER,
        functionName: 'checkAssetDeviation',
        args: [CONTRACT_ADDRESSES.USDC]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog('Evaluación de volatilidad ejecutada on-chain.');
      addToast('info', 'Circuit Breaker', 'Desviación evaluada');
      fetchData();
    } catch (err: any) {
      addLog(`[Error] Chequeo de volatilidad falló: ${err.message || err}`);
    }
  };

  const executeResetBreaker = async () => {
    try {
      addLog('Reiniciando CircuitBreaker desde cuenta gobernanza...');
      const client = getWalletClient(activeKey);
      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.CIRCUIT_BREAKER,
        abi: ABIS.CIRCUIT_BREAKER,
        functionName: 'resetBreaker',
        args: [CONTRACT_ADDRESSES.USDC]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(UI_STRINGS.TOASTS_AND_LOGS.BREAKER_RESET_SUCCESS);
      addToast('success', 'Breaker Reiniciado', 'Operatividad restablecida');
      fetchData();
    } catch (err: any) {
      addLog(`[Error] Reinicio falló: ${err.message || err}`);
    }
  };

  const handleResetBreaker = () => {
    if (requestConfirmation) {
      requestConfirmation({
        title: 'Reiniciar CircuitBreaker de Seguridad',
        actionIcon: '⚡',
        typeBadge: 'Restablecimiento Operativo',
        targetContractName: 'CircuitBreaker.sol',
        targetContractAddress: CONTRACT_ADDRESSES.CIRCUIT_BREAKER,
        inputAmount: 'Estado Congelado',
        inputSymbol: 'Frozen',
        expectedOutput: 'Estado Operativo',
        expectedOutputSymbol: 'Active 100%',
        details: [
          { label: 'Activo a Descongelar', value: 'USDC Reserve' }
        ],
        confirmButtonText: '✍️ Confirmar y Reiniciar Breaker',
        confirmButtonVariant: 'danger'
      }, executeResetBreaker);
    } else {
      executeResetBreaker();
    }
  };

  const executeResetBlockchain = async () => {
    try {
      addLog('[Reset 🔄] Solicitando reinicio del entorno...');
      if (snapshotId) {
        await (publicClient.request as any)({ method: 'evm_revert', params: [snapshotId] });
        const newSnap = await (publicClient.request as any)({ method: 'evm_snapshot', params: [] });
        setSnapshotId(newSnap);
      } else {
        await (publicClient.request as any)({ method: 'anvil_reset', params: [] });
      }
      addLog(UI_STRINGS.TOASTS_AND_LOGS.BLOCKCHAIN_RESET_SUCCESS);
      addToast('info', 'Reset Anvil', 'Blockchain restaurada desde snapshot');
      fetchData();
    } catch (err: any) {
      addLog(`[Error Reset] Fallo al reiniciar entorno: ${err.message || err}`);
    }
  };

  const handleResetBlockchain = () => {
    if (requestConfirmation) {
      requestConfirmation({
        title: 'Restaurar Snapshot Blockchain (Reset)',
        actionIcon: '🔄',
        typeBadge: 'Acción de Sandbox EVM',
        targetContractName: 'Anvil EVM Node',
        targetContractAddress: '0x0000000000000000000000000000000000000000',
        inputAmount: 'Estado Actual',
        inputSymbol: 'EVM Snapshot',
        expectedOutput: 'Estado Inicial',
        expectedOutputSymbol: 'Blockchain Reset',
        details: [
          { label: 'Efecto', value: 'Revierte la blockchain al snapshot inicial' }
        ],
        warningNote: 'Esta acción revertirá todas las transacciones recientes del entorno local Anvil.',
        confirmButtonText: '🔄 Confirmar Reset Blockchain',
        confirmButtonVariant: 'danger'
      }, executeResetBlockchain);
    } else {
      executeResetBlockchain();
    }
  };

  const executeCreateCampaign = async (name: string, amount: string) => {
    try {
      addLog(`Creando campaña promocional "${name}" por $${amount} ALPHA...`);
      const client = getWalletClient(activeKey);
      const amountWei = parseEther(amount);
      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.PROMOTIONAL_VAULT,
        abi: [{ name: 'createCampaign', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'name', type: 'string' }, { name: 'rewardAmount', type: 'uint256' }], outputs: [{ name: 'campaignId', type: 'uint256' }] }],
        functionName: 'createCampaign',
        args: [name, amountWei]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(`¡Campaña "${name}" creada con éxito on-chain!`);
      addToast('success', 'Campaña Creada', `Evento "${name}" activado`);
      fetchData();
    } catch (err: any) {
      addLog(`[Error] Creación de campaña falló: ${err.message || err}`);
    }
  };

  const handleCreateCampaign = (name: string, amount: string) => {
    if (!name || !amount) return;
    if (requestConfirmation) {
      requestConfirmation({
        title: `Crear Campaña Promocional: ${name}`,
        actionIcon: '🎁',
        typeBadge: 'Incentivo de Gobernanza',
        targetContractName: 'PromotionalIncentiveVault.sol',
        targetContractAddress: CONTRACT_ADDRESSES.PROMOTIONAL_VAULT,
        inputAmount: `${amount} ALPHA`,
        inputSymbol: 'Presupuesto Promocional',
        expectedOutput: 'Campaña Activa',
        expectedOutputSymbol: 'Promoción On-Chain',
        details: [
          { label: 'Nombre de la Campaña', value: name },
          { label: 'Fondo Asignado', value: `${amount} ALPHA` }
        ],
        confirmButtonText: '✍️ Confirmar y Crear Campaña',
        confirmButtonVariant: 'pink'
      }, () => executeCreateCampaign(name, amount));
    } else {
      executeCreateCampaign(name, amount);
    }
  };

  return {
    oraclePrice,
    setOraclePrice,
    newStablesWeight,
    setNewStablesWeight,
    newWbtcWeight,
    setNewWbtcWeight,
    newWethWeight,
    setNewWethWeight,
    newAltsWeight,
    setNewAltsWeight,
    handleUpdateOracle,
    handleAdjustWeights,
    handleSimulateDrop,
    handleResetBreaker,
    handleResetBlockchain,
    handleCreateCampaign
  };
}
