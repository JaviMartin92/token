import { useState } from 'react';
import { publicClient, getWalletClient, CONTRACT_ADDRESSES, ABIS } from '../utils/web3.js';
import { parseEther, parseUnits } from 'viem';
import type { TxConfirmDetails } from '../components/TransactionConfirmModal.js';

interface TreasuryActionsParams {
  activeKey: string;
  userAddress: string;
  addLog: (msg: string) => void;
  addToast: (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => void;
  fetchData: () => Promise<void>;
  requestConfirmation?: (details: TxConfirmDetails, action: () => Promise<void>) => void;
  navPerShareNum: number;
}

export function useTreasuryActions({ activeKey, userAddress, addLog, addToast, fetchData, requestConfirmation, navPerShareNum }: TreasuryActionsParams) {
  const [depositAmount, setDepositAmount] = useState('');
  const [redeemAmount, setRedeemAmount] = useState('');

  const handleFaucetUSDC = async () => {
    try {
      addLog('Reclamando 10,000 USDC mock del Faucet...');
      addToast('info', 'Faucet USDC', 'Enviando transacción...');
      const client = getWalletClient(activeKey);
      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.USDC,
        abi: ABIS.ERC20,
        functionName: 'mint',
        args: [userAddress as `0x${string}`, parseUnits('10000', 6)]  // USDC = 6 decimals
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog('¡10,000 USDC mock recibidos en tu billetera!');
      addToast('success', 'Éxito Faucet', 'Recibidos 10,000 USDC mock');
      await fetchData();
    } catch (err: any) {
      addLog(`[Error] Faucet falló: ${err.message || err}`);
      addToast('error', 'Error Faucet', err.message || 'Transacción fallida');
    }
  };

  const executeDeposit = async () => {
    if (!depositAmount) return;
    try {
      addLog(`Depositando ${depositAmount} USDC en Tesorería...`);
      addToast('info', 'Depósito Tesorería', `Aprobando ${depositAmount} USDC...`);
      const amountWei = parseUnits(depositAmount, 6);  // USDC = 6 decimals
      const client = getWalletClient(activeKey);

      const appHash = await client.writeContract({
        address: CONTRACT_ADDRESSES.USDC,
        abi: ABIS.ERC20,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.TREASURY, amountWei]
      });
      await publicClient.waitForTransactionReceipt({ hash: appHash });

      const depHash = await client.writeContract({
        address: CONTRACT_ADDRESSES.TREASURY,
        abi: ABIS.TREASURY,
        functionName: 'deposit',
        args: [amountWei]
      });
      await publicClient.waitForTransactionReceipt({ hash: depHash });
      addLog(`Depósito completado. Shares ALPHA acuñadas a valor NAV.`);
      addToast('success', 'Depósito Completado', `Acuñadas ALPHA shares a valor NAV`);
      setDepositAmount('');
      await fetchData();
      setTimeout(fetchData, 500);
    } catch (err: any) {
      addLog(`[Error] Depósito falló: ${err.message || err}`);
      addToast('error', 'Error Depósito', err.message || 'Error al depositar');
    }
  };

  const handleDeposit = () => {
    if (!depositAmount) return;
    const num = parseFloat(depositAmount);
    if (isNaN(num) || num <= 0) return;

    if (requestConfirmation) {
      const fee = (num * 0.005).toFixed(2);
      const net = (num * 0.995).toFixed(2);
      const feeReserves = (num * 0.0025).toFixed(2);
      const feeOps = (num * 0.00125).toFixed(2);
      const feeProfit = (num * 0.00125).toFixed(2);

      requestConfirmation({
        title: 'Depósito de USDC en Tesorería',
        actionIcon: '💵',
        typeBadge: 'Acuñación NAV Shares',
        targetContractName: 'Treasury.sol',
        targetContractAddress: CONTRACT_ADDRESSES.TREASURY,
        inputAmount: `$${num.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        inputSymbol: 'USDC (Bruto Ingresado)',
        expectedOutput: `${(parseFloat(net) / navPerShareNum).toFixed(2)}`,
        expectedOutputSymbol: `ALPHA Shares (Acuñadas a $${navPerShareNum.toFixed(4)} NAV)`,
        details: [
          { label: 'Monto Bruto Ingresado', value: `$${num.toFixed(2)} USDC` },
          { label: 'Comisión de Entrada (0.50%)', value: `$${fee} USDC`, badge: 'Reparto 50%/25%/25%' },
          { label: 'Destino 50% Comisión (Reservas)', value: `$${feeReserves} USDC (Inyectado a Reservas Tesorería)` },
          { label: 'Destino 25% Comisión (OpEx Vault)', value: `$${feeOps} USDC (CorporateOpExVault Staked ALPHA)` },
          { label: 'Destino 25% Comisión (Profit Vault)', value: `$${feeProfit} USDC (CorporateProfitVault Staked ALPHA)` }
        ],
        warningNote: 'El 80% de tu depósito en USDC ingresará automáticamente a Morpho Yield Vault Adapter para APY pasivo, y el 20% se mantendrá como búfer líquido para préstamos P2P.',
        confirmButtonText: '✍️ Confirmar Depósito',
        confirmButtonColor: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
      }, executeDeposit);
    } else {
      executeDeposit();
    }
  };

  const executeRedeem = async () => {
    if (!redeemAmount) return;
    try {
      addLog(`Rescatando ${redeemAmount} ALPHA shares en Tesorería...`);
      addToast('info', 'Rescate Tesorería', 'Enviando transacción...');
      const amountWei = parseEther(redeemAmount);
      const client = getWalletClient(activeKey);

      const appHash = await client.writeContract({
        address: CONTRACT_ADDRESSES.ALPHA_TOKEN,
        abi: ABIS.ERC20,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.TREASURY, amountWei]
      });
      await publicClient.waitForTransactionReceipt({ hash: appHash });

      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.TREASURY,
        abi: ABIS.TREASURY,
        functionName: 'redeem',
        args: [amountWei]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(`Rescate completado. USDC transferidos a tu billetera.`);
      addToast('success', 'Rescate Completado', 'USDC abonados a tu billetera');
      setRedeemAmount('');
      await fetchData();
      setTimeout(fetchData, 500);
    } catch (err: any) {
      addLog(`[Error] Rescate falló: ${err.message || err}`);
      addToast('error', 'Error Rescate', err.message || 'Error al rescatar');
    }
  };

  const handleRedeem = () => {
    if (!redeemAmount) return;
    const num = parseFloat(redeemAmount);
    if (isNaN(num) || num <= 0) return;

    if (requestConfirmation) {
      const fee = (num * 0.01).toFixed(2);
      const net = (num * 0.99).toFixed(2);
      const feeReserves = (num * 0.005).toFixed(2);
      const feeOps = (num * 0.0025).toFixed(2);
      const feeProfit = (num * 0.0025).toFixed(2);

      requestConfirmation({
        title: 'Rescate de ALPHA Shares por USDC',
        actionIcon: '🏛️',
        typeBadge: 'Quema de Shares & Salida',
        targetContractName: 'Treasury.sol',
        targetContractAddress: CONTRACT_ADDRESSES.TREASURY,
        inputAmount: `${num.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        inputSymbol: 'ALPHA Shares a Quemar',
        expectedOutput: `$${(parseFloat(net) * navPerShareNum).toFixed(2)}`,
        expectedOutputSymbol: `USDC Netos Recibidos (Canje a $${navPerShareNum.toFixed(4)} NAV)`,
        details: [
          { label: 'Shares Presentadas para Rescate', value: `${num.toFixed(2)} ALPHA Shares` },
          { label: 'Comisión de Rescate (1.00%)', value: `$${fee} USDC`, badge: 'Reparto 50%/25%/25%' },
          { label: 'Destino 50% Comisión (Reservas)', value: `$${feeReserves} USDC (Acrece NAV del Protocolo)` },
          { label: 'Destino 25% Comisión (OpEx Vault)', value: `$${feeOps} USDC (CorporateOpExVault Staked ALPHA)` },
          { label: 'Destino 25% Comisión (Profit Vault)', value: `$${feeProfit} USDC (CorporateProfitVault Staked ALPHA)` }
        ],
        warningNote: 'Tus participaciones ALPHA serán quemadas y recibirás el monto neto en USDC a valor NAV.',
        confirmButtonText: '✍️ Confirmar Rescate',
        confirmButtonColor: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)'
      }, executeRedeem);
    } else {
      executeRedeem();
    }
  };

  const handleAuditPoR = async () => {
    try {
      addLog(`Auditando Proof of Reserves en tiempo real on-chain...`);
      fetchData();
      addToast('success', 'Auditoría PoR', `Proof of Reserves auditado`);
    } catch (err: any) {
      addLog(`[Error] Auditoría PoR falló: ${err.message || err}`);
    }
  };

  return {
    depositAmount,
    setDepositAmount,
    redeemAmount,
    setRedeemAmount,
    handleFaucetUSDC,
    handleDeposit,
    handleRedeem,
    handleAuditPoR
  };
}
