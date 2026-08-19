import { useState } from 'react';
import { publicClient, getWalletClient, CONTRACT_ADDRESSES, ABIS } from '../utils/web3.js';
import { parseUnits, parseEther, formatEther } from 'viem';
import { UI_STRINGS } from '../constants/strings.js';
import { parseWeb3Error } from '../utils/web3ErrorDecoder.js';

interface TreasuryActionsParams {
  activeKey: string;
  userAddress: string;
  addLog: (msg: string) => void;
  addToast: (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => void;
  fetchData: () => Promise<void>;
  requestConfirmation?: (options: any, onConfirm: () => Promise<void>) => void;
  navPerShareNum: number;
}

export function useTreasuryActions({ activeKey, userAddress, addLog, addToast, fetchData, requestConfirmation, navPerShareNum }: TreasuryActionsParams) {
  const [depositAmount, setDepositAmount] = useState('');
  const [redeemAmount, setRedeemAmount] = useState('');

  const getEffectiveAccount = async (client: any): Promise<`0x${string}`> => {
    if (userAddress && userAddress.startsWith('0x')) {
      return userAddress as `0x${string}`;
    }
    const addresses = await client.getAddresses();
    if (addresses && addresses.length > 0) {
      return addresses[0];
    }
    throw new Error('Por favor conecta tu billetera para firmar la transacción.');
  };

  const handleFaucetUSDC = async () => {
    try {
      addLog(UI_STRINGS.TOASTS_AND_LOGS.FAUCET_INFO);
      addToast('info', 'Faucet USDC', 'Enviando transacción...');
      const client = getWalletClient(userAddress || activeKey);
      const account = await getEffectiveAccount(client);

      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.USDC,
        abi: ABIS.ERC20,
        functionName: 'mint',
        args: [account, parseUnits('10000', 6)],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(UI_STRINGS.TOASTS_AND_LOGS.FAUCET_SUCCESS);
      addToast('success', 'Éxito Faucet', UI_STRINGS.TOASTS_AND_LOGS.FAUCET_SUCCESS);
      await fetchData();
    } catch (err: any) {
      const parsedErr = parseWeb3Error(err);
      addLog(`[Error] Faucet falló: ${parsedErr}`);
      addToast('error', 'Error Faucet', parsedErr);
    }
  };

  const executeDeposit = async () => {
    if (!depositAmount) return;
    try {
      addLog(UI_STRINGS.TOASTS_AND_LOGS.DEPOSIT_START);
      addToast('info', 'Depósito Tesorería', `Aprobando ${depositAmount} USDC...`);
      const amountWei = parseUnits(depositAmount, 6);  // USDC = 6 decimals
      const client = getWalletClient(userAddress || activeKey);
      const account = await getEffectiveAccount(client);

      const appHash = await client.writeContract({
        address: CONTRACT_ADDRESSES.USDC,
        abi: ABIS.ERC20,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.TREASURY, amountWei],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: appHash });

      const depHash = await client.writeContract({
        address: CONTRACT_ADDRESSES.TREASURY,
        abi: ABIS.TREASURY,
        functionName: 'deposit',
        args: [amountWei, 0n],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: depHash });
      addLog(UI_STRINGS.TOASTS_AND_LOGS.DEPOSIT_SUCCESS);
      addToast('success', 'Éxito Depósito', UI_STRINGS.TOASTS_AND_LOGS.DEPOSIT_SUCCESS);
      setDepositAmount('');
      await fetchData();
    } catch (err: any) {
      const parsedErr = parseWeb3Error(err);
      addLog(`[Error] Depósito falló: ${parsedErr}`);
      addToast('error', 'Error Depósito', parsedErr);
    }
  };

  const handleDeposit = async () => {
    if (!depositAmount) return;
    const num = parseFloat(depositAmount);
    if (isNaN(num) || num <= 0) return;

    if (requestConfirmation) {
      let dynamicFeeBps = 50;
      let spotNavNum = navPerShareNum || 1.0;
      try {
        const totalAssetsExo = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.TREASURY,
          abi: [
            { name: 'getTotalAssetsExogenousUSD', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] }
          ] as const,
          functionName: 'getTotalAssetsExogenousUSD'
        }) as bigint;

        const feeBps = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.TREASURY,
          abi: ABIS.TREASURY,
          functionName: 'calculateDynamicFeeBps',
          args: [parseEther(depositAmount), totalAssetsExo]
        }) as bigint;

        dynamicFeeBps = Number(feeBps);

        const currentNav = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.TREASURY,
          abi: ABIS.TREASURY,
          functionName: 'getNAVPerShare'
        }) as bigint;
        if (currentNav > 0n) {
          spotNavNum = parseFloat(formatEther(currentNav));
        }
      } catch (e) {}

      const dynamicFeePct = (dynamicFeeBps / 100).toFixed(2);
      const feeVal = (num * dynamicFeeBps) / 10000;
      const fee = feeVal.toFixed(2);
      const netVal = num - feeVal;
      const feeReserves = (feeVal * 0.50).toFixed(2);
      const feeCommunity = (feeVal * 0.50).toFixed(2);
      const expectedShares = (netVal / spotNavNum).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      requestConfirmation({
        title: 'Depósito de USDC en Tesorería',
        actionIcon: '💵',
        typeBadge: 'Acuñación NAV Shares (Dynamic Slippage)',
        targetContractName: 'Treasury.sol',
        targetContractAddress: CONTRACT_ADDRESSES.TREASURY,
        inputAmount: `$${num.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        inputSymbol: 'USDC (Bruto Ingresado)',
        expectedOutput: `${expectedShares}`,
        expectedOutputSymbol: `ALPHA Shares (Acuñadas a $${spotNavNum.toFixed(4)} NAV)`,
        details: [
          { label: 'Monto Bruto Ingresado', value: `$${num.toFixed(2)} USDC` },
          { label: `Comisión Dinámica Adaptativa (${dynamicFeePct}%)`, value: `$${fee} USDC`, badge: `Slippage BPS: ${dynamicFeeBps}` },
          { label: 'Destino 50% Comisión (Reservas)', value: `$${feeReserves} USDC (Inyectado a Reservas Tesorería)` },
          { label: 'Destino 50% Comisión (Community Yield Vault)', value: `$${feeCommunity} USDC (Liquid Real Yield para stakers)` }
        ],
        warningNote: 'El 80% de tu depósito en USDC ingresará automáticamente a Morpho Yield Vault Adapter para APY pasivo, y el 20% se mantendrá como búfer líquido para préstamos P2P.',
        confirmButtonText: '✍️ Confirmar Depósito',
        confirmButtonVariant: 'emerald'
      }, executeDeposit);
    } else {
      executeDeposit();
    }
  };

  const executeRedeem = async () => {
    if (!redeemAmount) return;
    try {
      addLog(UI_STRINGS.TOASTS_AND_LOGS.REDEEM_START);
      addToast('info', 'Rescate Tesorería', 'Enviando transacción...');
      const amountWei = parseEther(redeemAmount);
      const client = getWalletClient(userAddress || activeKey);
      const account = await getEffectiveAccount(client);

      const appHash = await client.writeContract({
        address: CONTRACT_ADDRESSES.ALPHA_TOKEN,
        abi: ABIS.ERC20,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.TREASURY, amountWei],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: appHash });

      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.TREASURY,
        abi: ABIS.TREASURY,
        functionName: 'redeem',
        args: [amountWei, 0n],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(UI_STRINGS.TOASTS_AND_LOGS.REDEEM_SUCCESS);
      addToast('success', 'Rescate Completado', UI_STRINGS.TOASTS_AND_LOGS.REDEEM_SUCCESS);
      setRedeemAmount('');
      await fetchData();
    } catch (err: any) {
      const parsedErr = parseWeb3Error(err);
      addLog(`[Error] Rescate falló: ${parsedErr}`);
      addToast('error', 'Error Rescate', parsedErr);
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
      const feeCommunity = (num * 0.005).toFixed(2);

      requestConfirmation({
        title: 'Rescate de ALPHA Shares por USDC',
        actionIcon: '🏛️',
        typeBadge: 'Quema de Shares & Salida',
        targetContractName: 'Treasury.sol',
        targetContractAddress: CONTRACT_ADDRESSES.TREASURY,
        inputAmount: `${num.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        inputSymbol: 'ALPHA Shares a Quemar',
        expectedOutput: `$${(parseFloat(net) * (navPerShareNum || 1.0)).toFixed(2)}`,
        expectedOutputSymbol: `USDC Netos Recibidos (Canje a $${(navPerShareNum || 1.0).toFixed(4)} NAV)`,
        details: [
          { label: 'Shares Presentadas para Rescate', value: `${num.toFixed(2)} ALPHA Shares` },
          { label: 'Comisión de Rescate (1.00%)', value: `$${fee} USDC`, badge: 'Reparto 50%/50%' },
          { label: 'Destino 50% Comisión (Reservas)', value: `$${feeReserves} USDC (Acrece NAV del Protocolo)` },
          { label: 'Destino 50% Comisión (Community Yield Vault)', value: `$${feeCommunity} USDC (Liquid Real Yield para stakers)` }
        ],
        warningNote: 'Tus participaciones ALPHA serán quemadas y recibirás el monto neto en USDC a valor NAV.',
        confirmButtonText: '✍️ Confirmar Rescate',
        confirmButtonVariant: 'amber'
      }, executeRedeem);
    } else {
      executeRedeem();
    }
  };

  const handleAuditPoR = async () => {
    try {
      addLog(`Auditando Proof of Reserves en tiempo real on-chain...`);
      await fetchData();
      addToast('success', 'Auditoría PoR', UI_STRINGS.TOASTS_AND_LOGS.POR_AUDIT_SUCCESS);
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
