import { useState } from 'react';
import { publicClient, walletClient, getWalletClient, CONTRACT_ADDRESSES, ABIS } from '../utils/web3.js';
import { parseEther } from 'viem';
import type { TxConfirmDetails } from '../components/TransactionConfirmModal.js';

interface StakingActionsParams {
  activeKey: string;
  account: any;
  userAddress: string;
  addLog: (msg: string) => void;
  addToast: (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => void;
  fetchData: () => Promise<void>;
  requestConfirmation?: (details: TxConfirmDetails, action: () => Promise<void>) => void;
}

export function useStakingActions({ activeKey, account, userAddress, addLog, addToast, fetchData, requestConfirmation }: StakingActionsParams) {
  const [stakeAmount, setStakeAmount] = useState('100');
  const [payoutPref, setPayoutPref] = useState(0);

  const executeStake = async () => {
    try {
      addLog(`Haciendo stake de ${stakeAmount} ALPHA tokens...`);
      addToast('info', 'Staking ALPHA', 'Aprobando tokens...');
      const client = getWalletClient(activeKey);
      const appHash = await client.writeContract({
        address: CONTRACT_ADDRESSES.ALPHA_TOKEN,
        abi: ABIS.ERC20,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.STAKING, parseEther(stakeAmount)]
      });
      await publicClient.waitForTransactionReceipt({ hash: appHash });

      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.STAKING,
        abi: ABIS.STAKING,
        functionName: 'stake',
        args: [parseEther(stakeAmount)]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(`¡Stake de ${stakeAmount} ALPHA realizado con éxito!`);
      addToast('success', 'Staking Exitoso', 'ALPHA bloqueado en pool de gobernanza');
      await fetchData();
      setTimeout(fetchData, 500);
    } catch (err: any) {
      addLog(`[Error] Stake falló: ${err.message || err}`);
      addToast('error', 'Error Staking', err.message || 'Fallo');
    }
  };

  const handleStake = () => {
    if (!stakeAmount) return;
    const num = parseFloat(stakeAmount);
    if (isNaN(num) || num <= 0) return;

    if (requestConfirmation) {
      const fee = (num * 0.01).toFixed(2);
      const net = (num * 0.99).toFixed(2);

      requestConfirmation({
        title: 'Staking de ALPHA en Gobernanza DAO',
        actionIcon: '🥩',
        typeBadge: 'Participación On-Chain & Real Yield',
        targetContractName: 'GovernanceStaking.sol',
        targetContractAddress: CONTRACT_ADDRESSES.STAKING,
        inputAmount: `${num.toLocaleString('en-US')}`,
        inputSymbol: 'ALPHA Tokens Depositados',
        expectedOutput: `${net} stALPHA`,
        expectedOutputSymbol: 'Certificado Neto con Derecho a Dividendos USDC',
        details: [
          { label: 'Monto Bruto Ingresado', value: `${num.toLocaleString('en-US')} ALPHA Tokens` },
          { label: 'Comisión de Entrada a Staking (1.00%)', value: `${fee} ALPHA`, badge: 'Reparto 50%/25%/25%' },
          { label: 'Destino 50% Comisión (Quema Deflacionaria)', value: `${(num * 0.005).toFixed(2)} ALPHA (Quema permanente en Tesorería)`, isHighlight: true },
          { label: 'Destino 25% Comisión (OpEx Vault)', value: `${(num * 0.0025).toFixed(2)} ALPHA (CorporateOpExVault Auto-Staked)` },
          { label: 'Destino 25% Comisión (Profit Vault)', value: `${(num * 0.0025).toFixed(2)} ALPHA (CorporateProfitVault Auto-Staked)` },
          { label: 'Balance Neto Acreditado', value: `${net} stALPHA (Balance Staked On-Chain)`, badge: '100% Reembolsable en Unstake' },
          { label: 'Rendimiento Pasivo Asignado', value: 'Reparto Pro-Rata del APY de Reservas Morpho (8%-12%) e Inyecciones de Comisiones en USDC', badge: 'Cobro en Tiempo Real' },
          { label: 'Beneficio Exclusivo Staking', value: 'Loyalty Tier Status: Hasta +5.00% Extra de Descuento en Bonos Vestados', badge: 'VIP Holder' },
          { label: 'Productividad del Yield', value: 'Auto-Compounding Activo: El Yield no reclamado sigue generando 6.45% APY pasivo', badge: '🔄 Auto-Compound' }
        ],
        warningNote: 'El contrato inteligente GovernanceStaking.sol aplica la comisión del 1.00% enviando el 50% a quema permanente (elevando el valor NAV por token) y el 50% a las bóvedas corporativas. El APY no reclamado auto-compone diariamente.',
        confirmButtonText: '✍️ Confirmar y Bloquear Staking',
        confirmButtonColor: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)'
      }, executeStake);
    } else {
      executeStake();
    }
  };

  const executeUnstake = async () => {
    try {
      addLog(`Unstaking ${stakeAmount} ALPHA tokens...`);
      const client = getWalletClient(activeKey);
      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.STAKING,
        abi: ABIS.STAKING,
        functionName: 'unstake',
        args: [parseEther(stakeAmount)]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(`¡Unstake de ${stakeAmount} ALPHA completado!`);
      addToast('success', 'Unstake Exitoso', 'ALPHA liberado a tu billetera');
      await fetchData();
      setTimeout(fetchData, 500);
    } catch (err: any) {
      addLog(`[Error] Unstake falló: ${err.message || err}`);
      addToast('error', 'Error Unstake', err.message || 'Fallo');
    }
  };

  const handleUnstake = () => {
    if (!stakeAmount) return;
    const num = parseFloat(stakeAmount);
    if (isNaN(num) || num <= 0) return;

    if (requestConfirmation) {
      requestConfirmation({
        title: 'Liberar (Unstake) ALPHA Tokens',
        actionIcon: '🔓',
        typeBadge: 'Retiro de Staking Pool',
        targetContractName: 'GovernanceStaking.sol',
        targetContractAddress: CONTRACT_ADDRESSES.STAKING,
        inputAmount: `${num.toLocaleString('en-US')}`,
        inputSymbol: 'stALPHA Bloqueados',
        expectedOutput: `${num.toLocaleString('en-US')}`,
        expectedOutputSymbol: 'ALPHA Liberados a Billetera',
        details: [
          { label: 'Penalización de Retiro', value: '0.00% (Sin Penalización)' }
        ],
        confirmButtonText: '✍️ Confirmar Unstake',
        confirmButtonColor: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
      }, executeUnstake);
    } else {
      executeUnstake();
    }
  };

  const executeClaimYield = async () => {
    try {
      addLog('Reclamando Real Yield vía RealYieldRouter...');
      const client = getWalletClient(activeKey);
      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.REAL_YIELD_ROUTER,
        abi: ABIS.REAL_YIELD_ROUTER,
        functionName: 'claimRealYield'
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog('¡Real Yield reclamado con éxito!');
      addToast('success', 'Yield Reclamado', 'Dividendos transferidos');
      await fetchData();
      setTimeout(fetchData, 500);
    } catch (err: any) {
      addLog(`[Error] Reclamo Yield falló: ${err.message || err}`);
      addToast('error', 'Error Reclamo Yield', err.message || 'Fallo');
    }
  };

  const handleClaimYield = () => {
    if (requestConfirmation) {
      requestConfirmation({
        title: 'Cobrar Dividendos de Real Yield',
        actionIcon: '🎁',
        typeBadge: 'Distribución de Dividendos DAO',
        targetContractName: 'RealYieldRouter.sol',
        targetContractAddress: CONTRACT_ADDRESSES.REAL_YIELD_ROUTER,
        inputAmount: 'Rendimiento Acumulado',
        inputSymbol: 'Yield',
        expectedOutput: 'Dividendos Netos',
        expectedOutputSymbol: payoutPref === 0 ? 'USDC' : 'WBTC/WETH',
        details: [
          { label: 'Opción de Cobro Seleccionada', value: payoutPref === 0 ? 'Opción A (USDC)' : 'Opción B (Reservas)' }
        ],
        confirmButtonText: '✍️ Confirmar Cobro de Yield',
        confirmButtonColor: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
      }, executeClaimYield);
    } else {
      executeClaimYield();
    }
  };

  const handleGaslessClaim = async () => {
    try {
      addLog('Iniciando reclamo gasless vía YieldStreamingVault...');
      const YIELD_VAULT_ADDRESS = (import.meta.env.VITE_YIELD_STREAMING_VAULT_ADDRESS || CONTRACT_ADDRESSES.YIELD_VAULT || '') as `0x${string}`;
      if (!YIELD_VAULT_ADDRESS) {
        addLog('[Aviso] Dirección YieldStreamingVault no configurada.');
        addToast('warning', 'Configuración', 'Dirección YieldStreamingVault pendiente');
        return;
      }
      const yieldVaultABI = [
        { name: 'claimYield', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'user', type: 'address' }], outputs: [{ name: 'amount', type: 'uint256' }] }
      ] as const;
      const tx = await walletClient.writeContract({
        address: YIELD_VAULT_ADDRESS,
        abi: yieldVaultABI,
        functionName: 'claimYield',
        args: [userAddress as `0x${string}`],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog('¡Yield reclamado con éxito desde YieldStreamingVault!');
      addToast('success', 'Gasless Claim', 'Rendimiento reclamado sin costo de gas');
      fetchData();
    } catch (err: any) {
      addLog(`[Error] Gasless claim falló: ${err.message || err}`);
      addToast('error', 'Error Gasless Claim', err.message || 'Fallo');
    }
  };

  const handleSetPayoutPreference = async (pref: number) => {
    try {
      addLog(`Configurando preferencia de payout a Opción ${pref === 0 ? 'A (USDC)' : 'B (Reservas)'}...`);
      const client = getWalletClient(activeKey);
      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.REAL_YIELD_ROUTER,
        abi: ABIS.REAL_YIELD_ROUTER,
        functionName: 'setPayoutPreference',
        args: [pref]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setPayoutPref(pref);
      addLog(`¡Preferencia de payout actualizada!`);
      addToast('success', 'Preferencia Guardada', `Payout configurado en Opción ${pref === 0 ? 'A' : 'B'}`);
      fetchData();
    } catch (err: any) {
      addLog(`[Error] Fallo al cambiar preferencia: ${err.message || err}`);
    }
  };

  return {
    stakeAmount,
    setStakeAmount,
    payoutPref,
    setPayoutPref,
    handleStake,
    handleUnstake,
    handleClaimYield,
    handleGaslessClaim,
    handleSetPayoutPreference
  };
}
