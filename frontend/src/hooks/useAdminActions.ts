import { useState } from 'react';
import { publicClient, getWalletClient, CONTRACT_ADDRESSES, ABIS } from '../utils/web3.js';
import { parseEther, parseUnits } from 'viem';
import type { TxConfirmDetails } from '../components/TransactionConfirmModal.js';

interface AdminActionsParams {
  activeKey: string;
  snapshotId: string;
  setSnapshotId: (id: string) => void;
  addLog: (msg: string) => void;
  addToast: (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => void;
  fetchData: () => Promise<void>;
  requestConfirmation?: (details: TxConfirmDetails, action: () => Promise<void>) => void;
}

export function useAdminActions({ activeKey, snapshotId, setSnapshotId, addLog, addToast, fetchData, requestConfirmation }: AdminActionsParams) {
  const [injectionAmount, setInjectionAmount] = useState('');
  const [oraclePrice, setOraclePrice] = useState('1.00');

  const [newStablesWeight, setNewStablesWeight] = useState('50');
  const [newWbtcWeight, setNewWbtcWeight] = useState('25');
  const [newWethWeight, setNewWethWeight] = useState('12.5');
  const [newAltsWeight, setNewAltsWeight] = useState('12.5');

  const executeUpdateOracle = async () => {
    if (!oraclePrice) return;
    try {
      addLog(`Actualizando precio del oráculo Chainlink...`);
      const client = getWalletClient(activeKey);
      const feedAddress = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.TREASURY,
        abi: ABIS.TREASURY,
        functionName: 'priceFeeds',
        args: [CONTRACT_ADDRESSES.USDC]
      }) as `0x${string}`;

      const newPriceInt = BigInt(Math.round(parseFloat(oraclePrice) * 1e8));
      const tx = await client.writeContract({
        address: feedAddress,
        abi: [{ name: 'setPrice', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'price_', type: 'int256' }], outputs: [] }] as const,
        functionName: 'setPrice',
        args: [newPriceInt]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(`¡Oráculo de precio actualizado a $${oraclePrice}!`);
      addToast('success', 'Oráculo Actualizado', `Precio: $${oraclePrice}`);
      fetchData();
    } catch (err: any) {
      addLog(`[Error] Actualización de oráculo falló: ${err.message || err}`);
    }
  };

  const handleUpdateOracle = () => {
    if (!oraclePrice) return;
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
        confirmButtonColor: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
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
        functionName: 'adjustWeights',
        args: [{ stablecoins: s, wbtc: b, weth: e, alphaProtocolStaking: a }]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog('¡Pesos de tesorería ajustados con éxito on-chain!');
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
        confirmButtonColor: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)'
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
      addLog('¡CircuitBreaker reiniciado on-chain! Operatividad restablecida.');
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
        confirmButtonColor: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
      }, executeResetBreaker);
    } else {
      executeResetBreaker();
    }
  };

  const executeExecuteTWAP = async () => {
    if (!injectionAmount) return;
    try {
      addLog(`Creando orden TWAP de recompra por $${injectionAmount} USDC...`);
      const amountWei = parseUnits(injectionAmount, 6);  // USDC = 6 decimals

      const client = getWalletClient(activeKey);

      const appHash = await client.writeContract({
        address: CONTRACT_ADDRESSES.USDC,
        abi: ABIS.ERC20,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.CORPORATE_CONTRIBUTION, amountWei]
      });
      await publicClient.waitForTransactionReceipt({ hash: appHash });

      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.CORPORATE_CONTRIBUTION,
        abi: ABIS.CORPORATE_CONTRIBUTION,
        functionName: 'createTWAPOrder',
        args: [amountWei, BigInt(5), BigInt(300)]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog('¡Orden TWAP de recompra creada con éxito!');
      addToast('success', 'TWAP Creado', 'Orden de compra ejecutada');
      setInjectionAmount('');
      fetchData();
    } catch (err: any) {
      addLog(`[Error] Recompra TWAP falló: ${err.message || err}`);
    }
  };

  const handleExecuteTWAP = () => {
    if (!injectionAmount) return;
    const num = parseFloat(injectionAmount);
    if (isNaN(num) || num <= 0) return;

    if (requestConfirmation) {
      requestConfirmation({
        title: 'Orden TWAP de Recompra Corporativa',
        actionIcon: '📈',
        typeBadge: 'Inyección Algorítmica TWAP',
        targetContractName: 'CorporateContribution.sol',
        targetContractAddress: CONTRACT_ADDRESSES.CORPORATE_CONTRIBUTION,
        inputAmount: `$${num.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        inputSymbol: 'USDC Recompra',
        expectedOutput: '5 Intervalos',
        expectedOutputSymbol: 'Ejecución Gradual',
        details: [
          { label: 'Intervalos de Ejecución', value: '5 Tranchas de Compra' },
          { label: 'Tiempo entre Intervalos', value: '300 Segundos (5 Minutos)' },
          { label: 'Efecto', value: 'Soporte Directo al NAV y Liquidez de ALPHA' }
        ],
        confirmButtonText: '✍️ Confirmar y Ejecutar TWAP',
        confirmButtonColor: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
      }, executeExecuteTWAP);
    } else {
      executeExecuteTWAP();
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
      addLog('[Reset 🔄] ¡Entorno reiniciado con éxito!');
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
        confirmButtonColor: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
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
        confirmButtonColor: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)'
      }, () => executeCreateCampaign(name, amount));
    } else {
      executeCreateCampaign(name, amount);
    }
  };

  return {
    injectionAmount,
    setInjectionAmount,
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
    handleExecuteTWAP,
    handleResetBlockchain,
    handleCreateCampaign
  };
}
