import { useState } from 'react';
import { parseEther } from 'viem';
import { CONTRACT_ADDRESSES, ABIS, publicClient, getWalletClient } from '../utils/web3.js';
import type { TxConfirmDetails } from '../components/TransactionConfirmModal.js';
import { UI_STRINGS } from '../constants/strings.js';

interface UseStakingActionsProps {
  activeKey: string;
  account?: any;
  userAddress?: string;
  payoutPref?: number;
  fetchData: () => Promise<void>;
  addLog: (msg: string) => void;
  addToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
  requestConfirmation?: (details: TxConfirmDetails, action: () => Promise<void>) => void;
}

export function useStakingActions({
  activeKey,
  fetchData,
  addLog,
  addToast,
  requestConfirmation
}: UseStakingActionsProps) {
  const [stakeAmount, setStakeAmount] = useState('1000');
  const [payoutPref, setPayoutPref] = useState(0);

  const executeStake = async () => {
    try {
      addLog(`Iniciando staking de ${stakeAmount} ALPHA (Comisión de entrada 1.00%)...`);
      const client = getWalletClient(activeKey);
      const amountWei = parseEther(stakeAmount);

      const appHash = await client.writeContract({
        address: CONTRACT_ADDRESSES.ALPHA_TOKEN,
        abi: ABIS.ERC20,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.STAKING, amountWei]
      });
      await publicClient.waitForTransactionReceipt({ hash: appHash });

      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.STAKING,
        abi: ABIS.STAKING,
        functionName: 'stake',
        args: [amountWei]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(`¡Staking exitoso de ${stakeAmount} ALPHA! (99% en stake, 0.5% quemado, 0.5% a Community Vault).`);
      addToast('success', 'Staking Exitoso', UI_STRINGS.TOASTS_AND_LOGS.STAKE_SUCCESS);
      await fetchData();
    } catch (err: any) {
      addLog(`[Error] Staking falló: ${err.message || err}`);
      addToast('error', 'Error Staking', err.message || 'Fallo');
    }
  };

  const handleStake = () => {
    if (!stakeAmount) return;
    const num = parseFloat(stakeAmount);
    if (isNaN(num) || num <= 0) return;

    const fee = (num * 0.01).toFixed(2);
    const net = (num * 0.99).toFixed(2);

    if (requestConfirmation) {
      requestConfirmation({
        title: 'Bloquear Tokens ALPHA en Staking de Gobernanza',
        actionIcon: '🔒',
        typeBadge: 'Staking con Real Yield & Deflación',
        targetContractName: 'GovernanceStaking.sol',
        targetContractAddress: CONTRACT_ADDRESSES.STAKING,
        inputAmount: `${num.toLocaleString('en-US')}`,
        inputSymbol: 'ALPHA',
        expectedOutput: `${net}`,
        expectedOutputSymbol: 'stALPHA (Tokens Staked)',
        details: [
          { label: 'Monto Bruto Ingresado', value: `${num.toLocaleString('en-US')} ALPHA Tokens` },
          { label: 'Comisión de Entrada a Staking (1.00%)', value: `${fee} ALPHA`, badge: 'Reparto 50%/50%' },
          { label: 'Destino 50% Comisión (Quema Deflacionaria)', value: `${(num * 0.005).toFixed(2)} ALPHA (Quema permanente en Tesorería)`, isHighlight: true },
          { label: 'Destino 50% Comisión (Community Yield Vault)', value: `${(num * 0.005).toFixed(2)} ALPHA (CommunityYieldVault Real Yield Pool)` },
          { label: 'Balance Neto Acreditado', value: `${net} stALPHA (Balance Staked On-Chain)`, badge: '100% Reembolsable en Unstake' },
          { label: 'Rendimiento Pasivo Asignado', value: 'Reparto Pro-Rata del APY de Reservas e Inyecciones de Comisiones en Liquid USDC', badge: 'Cobro en Tiempo Real' },
          { label: 'Beneficio Exclusivo Staking', value: 'Loyalty Tier Status: Hasta +5.00% Extra de Descuento en Bonos Vestados', badge: 'VIP Holder' },
          { label: 'Productividad del Yield', value: 'Auto-Compounding Activo: El Yield no reclamado sigue generando APY pasivo', badge: '🔄 Auto-Compound' }
        ],
        warningNote: 'El contrato inteligente GovernanceStaking.sol aplica la comisión del 1.00% enviando el 50% a quema permanente (elevando el valor NAV por token) y el 50% a las bóvedas del protocolo.',
        confirmButtonText: '✍️ Confirmar y Bloquear Staking',
        confirmButtonVariant: 'purple'
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
      addToast('success', 'Unstake Exitoso', UI_STRINGS.TOASTS_AND_LOGS.UNSTAKE_SUCCESS);
      await fetchData();
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
        confirmButtonVariant: 'blue'
      }, executeUnstake);
    } else {
      executeUnstake();
    }
  };

  const executeClaimYield = async () => {
    try {
      addLog(UI_STRINGS.TOASTS_AND_LOGS.CLAIM_YIELD_START);
      const client = getWalletClient(activeKey);
      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.REAL_YIELD_ROUTER,
        abi: ABIS.REAL_YIELD_ROUTER,
        functionName: 'claimRealYield'
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(UI_STRINGS.TOASTS_AND_LOGS.CLAIM_YIELD_SUCCESS);
      addToast('success', 'Yield Reclamado', UI_STRINGS.TOASTS_AND_LOGS.CLAIM_YIELD_SUCCESS);
      await fetchData();
    } catch (err: any) {
      addLog(`[Error] Reclamo Yield falló: ${err.message || err}`);
      addToast('error', 'Error Reclamo Yield', err.message || 'Fallo');
    }
  };

  const handleClaimYield = (claimableUsdNum?: number) => {
    const yieldAmountStr = claimableUsdNum && claimableUsdNum > 0 ? `$${claimableUsdNum.toFixed(2)}` : 'Rendimiento Acumulado';
    const outputStr = claimableUsdNum && claimableUsdNum > 0 ? `$${claimableUsdNum.toFixed(2)}` : 'Dividendos Netos';

    if (requestConfirmation) {
      requestConfirmation({
        title: 'Cobrar Dividendos de Real Yield',
        actionIcon: '🎁',
        typeBadge: 'Distribución de Dividendos DAO',
        targetContractName: 'RealYieldRouter.sol',
        targetContractAddress: CONTRACT_ADDRESSES.REAL_YIELD_ROUTER,
        inputAmount: yieldAmountStr,
        inputSymbol: 'Yield Acumulado On-Chain',
        expectedOutput: outputStr,
        expectedOutputSymbol: payoutPref === 0 ? 'USDC (Opción A)' : 'WBTC/WETH (Opción B)',
        details: [
          ...(claimableUsdNum && claimableUsdNum > 0 ? [{ label: 'Monto Total Dividendos Devengados', value: `$${claimableUsdNum.toFixed(2)} USD`, badge: 'Real Yield' }] : []),
          { label: 'Opción de Cobro Seleccionada', value: payoutPref === 0 ? 'Opción A (USDC Directo)' : 'Opción B (Activos de Reserva WBTC/WETH)' },
          { label: 'Comisión de Distribución', value: '0.00% (Transferencia Directa de Contrato)' }
        ],
        confirmButtonText: '✍️ Confirmar Cobro de Yield',
        confirmButtonVariant: 'emerald'
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
        return;
      }
      const streamId = 0n;
      const nonce = 0n;
      const amount = 0n;
      const signature = '0x' as `0x${string}`;

      const client = getWalletClient(activeKey);
      const tx = await client.writeContract({
        address: YIELD_VAULT_ADDRESS,
        abi: [
          {
            name: 'claimStreamWithPermit',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'streamId', type: 'uint256' },
              { name: 'amount', type: 'uint256' },
              { name: 'nonce', type: 'uint256' },
              { name: 'signature', type: 'bytes' }
            ],
            outputs: []
          }
        ] as const,
        functionName: 'claimStreamWithPermit',
        args: [streamId, amount, nonce, signature]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog('Reclamo gasless procesado.');
      addToast('success', 'Reclamo Gasless', 'Procesado vía YieldStreamingVault');
      await fetchData();
    } catch (err: any) {
      addLog(`[Error Gasless] Falló el reclamo: ${err.message || err}`);
      addToast('error', 'Error Gasless', err.message || 'Fallo');
    }
  };

  const handleSetPayoutPreference = async (pref: number) => {
    try {
      addLog(`Actualizando preferencia de pago a Opción ${pref === 0 ? 'A (USDC Directo)' : 'B (Activos de Reserva)'}...`);
      const client = getWalletClient(activeKey);
      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.REAL_YIELD_ROUTER,
        abi: ABIS.REAL_YIELD_ROUTER,
        functionName: 'setPayoutPreference',
        args: [pref]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(`¡Preferencia de pago actualizada on-chain!`);
      setPayoutPref(pref);
      addToast('success', 'Preferencia Guardada', `Modo de cobro actualizado a Opción ${pref === 0 ? 'A' : 'B'}`);
      await fetchData();
    } catch (err: any) {
      addLog(`[Error] No se pudo guardar preferencia: ${err.message || err}`);
      addToast('error', 'Error Preferencia', err.message || 'Fallo');
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
