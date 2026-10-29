import { useState } from 'react';
import { publicClient, getWalletClient, CONTRACT_ADDRESSES, ABIS } from '../utils/web3.js';
import { parseUnits } from 'viem';
import type { TxConfirmDetails } from '../components/TransactionConfirmModal.js';
import { UI_STRINGS } from '../constants/strings.js';
import { simulatePreflightTransaction } from '../utils/preflightSimulation.js';

interface VestedVaultActionsParams {
  activeKey: string;
  userAddress?: string;
  addLog: (msg: string) => void;
  addToast: (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string, txHash?: string) => void;
  fetchData: () => Promise<void>;
  requestConfirmation?: (details: TxConfirmDetails, action: () => Promise<void>) => void;
}

export function useVestedVaultActions({ activeKey, userAddress, addLog, addToast, fetchData, requestConfirmation }: VestedVaultActionsParams) {
  const [bondPrincipal, setBondPrincipal] = useState('1000');
  const [bondLockYears, setBondLockYears] = useState('3');
  const [bondReferrer, setBondReferrer] = useState(() => {
    if (typeof window !== 'undefined' && window.location?.search) {
      const refParam = new URLSearchParams(window.location.search).get('ref');
      if (refParam && /^0x[a-fA-F0-9]{40}$/.test(refParam)) {
        return refParam;
      }
    }
    return '';
  });

  const executeBuyBond = async () => {
    if (!bondPrincipal) return;
    try {
      addLog(`Adquiriendo Bono Vestado a ${bondLockYears} años por ${bondPrincipal}...`);
      const principalWei = parseUnits(bondPrincipal, 6);  // USDC = 6 decimals
      const refAddr = bondReferrer ? (bondReferrer as `0x${string}`) : '0x0000000000000000000000000000000000000000';
      const client = getWalletClient(activeKey);
      const userAddr = (userAddress || activeKey) as `0x${string}`;

      // Gas optimization: check allowance first
      const currentAllowance = (await publicClient.readContract({
        address: CONTRACT_ADDRESSES.USDC,
        abi: ABIS.ERC20,
        functionName: 'allowance',
        args: [userAddr, CONTRACT_ADDRESSES.VESTED_VAULT]
      })) as bigint;

      if (currentAllowance < principalWei) {
        addToast('info', 'Aprobación USDC', 'Autorizando USDC para Bono con Descuento...');
        const appHash = await client.writeContract({
          address: CONTRACT_ADDRESSES.USDC,
          abi: ABIS.ERC20,
          functionName: 'approve',
          args: [CONTRACT_ADDRESSES.VESTED_VAULT, principalWei]
        });
        await publicClient.waitForTransactionReceipt({ hash: appHash });
      }

      // Preflight simulation
      const preflight = await simulatePreflightTransaction(
        CONTRACT_ADDRESSES.VESTED_VAULT,
        ABIS.VESTED_VAULT,
        'buyVestedBond',
        [principalWei, BigInt(bondLockYears), refAddr],
        userAddr
      );
      if (!preflight.canExecute && preflight.error) {
        addLog(`[Error Preflight] Compra de bono rechazada: ${preflight.error.message}`);
        addToast('error', preflight.error.title, preflight.error.message);
        return;
      }

      addToast('info', 'Compra de Bono', 'Confirmando emisión de NFT...');
      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.VESTED_VAULT,
        abi: ABIS.VESTED_VAULT,
        functionName: 'buyVestedBond',
        args: [principalWei, BigInt(bondLockYears), refAddr]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(UI_STRINGS.TOASTS_AND_LOGS.BOND_BUY_SUCCESS);
      addToast('success', 'Bono Adquirido', UI_STRINGS.TOASTS_AND_LOGS.BOND_BUY_SUCCESS, tx);
      setBondPrincipal('1000');
      await fetchData();
    } catch (err: any) {
      addLog(`[Error] Compra de bono falló: ${err.message || err}`);
      addToast('error', 'Error Compra Bono', err.message || 'Fallo en compra');
    }
  };

  const handleBuyBond = async () => {
    if (!bondPrincipal) return;
    const principalNum = parseFloat(bondPrincipal);
    if (isNaN(principalNum) || principalNum <= 0) return;

    const yearsNum = parseInt(bondLockYears) || 1;
    let totalDiscountBps = Math.min(yearsNum * 500, 2500);
    try {
      const userAddr = (userAddress && userAddress.startsWith('0x') ? userAddress : '0x0000000000000000000000000000000000000000') as `0x${string}`;
      const onChainBps = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.VESTED_VAULT,
        abi: ABIS.VESTED_VAULT,
        functionName: 'calculateDiscountBps',
        args: [userAddr, BigInt(yearsNum)]
      }) as bigint;
      if (onChainBps > 0n) {
        totalDiscountBps = Number(onChainBps);
      }
    } catch (e) {}

    const discountPct = (totalDiscountBps / 100).toFixed(1);
    const paidAmount = principalNum * (1 - totalDiscountBps / 10000);
    const savingsAmount = principalNum - paidAmount;

    if (requestConfirmation) {
      requestConfirmation({
        title: `Compra de Bono Vestado a ${yearsNum} ${yearsNum === 1 ? 'Año' : 'Años'}`,
        actionIcon: '📜',
        typeBadge: 'Emisión de Posición NFT ERC-721',
        targetContractName: 'VestedDiscountVault.sol',
        targetContractAddress: CONTRACT_ADDRESSES.VESTED_VAULT,
        inputAmount: `$${paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        inputSymbol: 'USDC (Precio Final con Descuento)',
        expectedOutput: `$${principalNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        expectedOutputSymbol: 'Principal en NFT de Posición',
        details: [
          { label: 'Plazo de Bloqueo', value: `${yearsNum} ${yearsNum === 1 ? 'Año' : 'Años'}` },
          { label: 'Descuento Total Consolidado', value: `${discountPct}% Total sobre NAV`, badge: `Ahorras $${savingsAmount.toFixed(2)} USDC` },
          { label: 'Comisión de Emisión de Bono (1.50%)', value: `$${(paidAmount * 0.015).toFixed(2)} USDC`, badge: '100% Inyectado a Flywheel Real Yield' },
          { label: 'Referido Asignado', value: bondReferrer ? `${bondReferrer.slice(0, 6)}...` : 'Ninguno (0x00)' }
        ],
        warningNote: `Tu capital de $${principalNum.toLocaleString('en-US')} estará bloqueado durante ${yearsNum} ${yearsNum === 1 ? 'año' : 'años'}. Podrás usar el NFT en el mercado P2P o ejecutar Ragequit con 15% penalización si necesitas liquidez.`,
        confirmButtonText: '✍️ Confirmar y Adquirir Bono',
        confirmButtonVariant: 'purple'
      }, executeBuyBond);
    } else {
      executeBuyBond();
    }
  };

  const executeClaimMatured = async (tokenId: number) => {
    try {
      addLog(`Reclamando bono vencido NFT #${tokenId}...`);
      const client = getWalletClient(activeKey);
      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.VESTED_VAULT,
        abi: ABIS.VESTED_VAULT,
        functionName: 'claimMatured',
        args: [BigInt(tokenId)]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(`¡Bono NFT #${tokenId} reclamado con éxito!`);
      addToast('success', 'Bono Reclamado', UI_STRINGS.TOASTS_AND_LOGS.BOND_CLAIM_SUCCESS);
      fetchData();
    } catch (err: any) {
      addLog(`[Error] Reclamo de bono falló: ${err.message || err}`);
      addToast('error', 'Error Reclamo', err.message || 'Fallo en reclamo');
    }
  };

  const handleClaimMatured = (tokenId: number, positionObj?: any) => {
    const principalVal = positionObj ? (parseFloat((positionObj.principal || positionObj.principalAmount || '0').toString().replace(/,/g, '')) || 0) : 0;
    const outputStr = principalVal > 0 ? `$${principalVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '100%';

    if (requestConfirmation) {
      requestConfirmation({
        title: `Reclamo de Bono Vencido NFT #${tokenId}`,
        actionIcon: '🏆',
        typeBadge: 'Liberación 100% Principal',
        targetContractName: 'VestedDiscountVault.sol',
        targetContractAddress: CONTRACT_ADDRESSES.VESTED_VAULT,
        inputAmount: `NFT #${tokenId}`,
        inputSymbol: 'ERC-721 Token',
        expectedOutput: outputStr,
        expectedOutputSymbol: 'Principal en USDC',
        details: [
          ...(principalVal > 0 ? [{ label: 'Monto Principal Liberado', value: `$${principalVal.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC` }] : []),
          { label: 'Estado del Bono', value: 'Vencido (Periodo Cumplido)', badge: 'Sin Penalización' },
          { label: 'Comisión de Liberación', value: '0.00% ($0.00 USDC)' }
        ],
        confirmButtonText: '✍️ Confirmar Reclamo',
        confirmButtonVariant: 'emerald'
      }, () => executeClaimMatured(tokenId));
    } else {
      executeClaimMatured(tokenId);
    }
  };

  const executeRagequit = async (tokenId: number) => {
    try {
      addLog(`Ejecutando Ragequit anticipado en NFT #${tokenId} (15% penalización)...`);
      const client = getWalletClient(activeKey);
      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.VESTED_VAULT,
        abi: ABIS.VESTED_VAULT,
        functionName: 'ragequit',
        args: [BigInt(tokenId)]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(`Ragequit ejecutado en NFT #${tokenId}. Reembolso recibido.`);
      addToast('warning', 'Ragequit Ejecutado', UI_STRINGS.TOASTS_AND_LOGS.RAGEQUIT_SUCCESS);
      fetchData();
    } catch (err: any) {
      addLog(`[Error] Ragequit falló: ${err.message || err}`);
      addToast('error', 'Error Ragequit', err.message || 'Fallo en ragequit');
    }
  };

  const handleRagequit = (tokenId: number, positionObj?: any) => {
    const pricePaid = positionObj ? (parseFloat((positionObj.discountedPricePaid || positionObj.principal || positionObj.principalAmount || '0').toString().replace(/,/g, '')) || 0) : 0;
    const netRefund = pricePaid * 0.85;
    const penalty = pricePaid * 0.15;
    const feeReserves = pricePaid * 0.075;
    const feeCommunity = pricePaid * 0.075;

    const outputStr = pricePaid > 0 ? `$${netRefund.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '85%';

    if (requestConfirmation) {
      requestConfirmation({
        title: `Salida Anticipada (Ragequit) NFT #${tokenId}`,
        actionIcon: '⚠️',
        typeBadge: 'Penalización del 15% On-Chain',
        targetContractName: 'VestedDiscountVault.sol',
        targetContractAddress: CONTRACT_ADDRESSES.VESTED_VAULT,
        inputAmount: `NFT #${tokenId}`,
        inputSymbol: 'Posición Vestada',
        expectedOutput: outputStr,
        expectedOutputSymbol: 'Principal Neto Reembolsado en USDC',
        details: [
          ...(pricePaid > 0 ? [{ label: 'Precio Pagado / Valor del Bono', value: `$${pricePaid.toFixed(2)} USDC` }] : []),
          { label: 'Penalización por Salida Anticipada (15.00%)', value: pricePaid > 0 ? `$${penalty.toFixed(2)} USDC` : '15.00% del Precio Pagado (RAGEQUIT_PENALTY_BPS)', isHighlight: true },
          ...(pricePaid > 0 ? [
            { label: 'Reembolso Neto en USDC (85.00%)', value: `$${netRefund.toFixed(2)} USDC`, badge: 'Transferencia Inmediata' },
            { label: 'Destino 50% Penalización (Reservas)', value: `$${feeReserves.toFixed(2)} USDC (Treasury.sol)` },
            { label: 'Destino 50% Penalización (Community Yield Vault)', value: `$${feeCommunity.toFixed(2)} USDC (Liquid Real Yield para stakers)` }
          ] : [
            { label: 'Destino 50% Penalización (Reservas)', value: '7.50% a Reservas Tesorería (Treasury.sol)' },
            { label: 'Destino 50% Penalización (Community Yield Vault)', value: '7.50% a CommunityYieldVault (Liquid USDC Real Yield)' }
          ])
        ],
        warningNote: '¡Atención! El contrato inteligente VestedDiscountVault.sol ejecutará una retención irreversible del 15.00% sobre el valor del bono.',
        confirmButtonText: '⚠️ Confirmar Ragequit (15% Penalty)',
        confirmButtonVariant: 'danger'
      }, () => executeRagequit(tokenId));
    } else {
      executeRagequit(tokenId);
    }
  };

  return {
    bondPrincipal,
    setBondPrincipal,
    bondLockYears,
    setBondLockYears,
    bondReferrer,
    setBondReferrer,
    handleBuyBond,
    handleClaimMatured,
    handleRagequit
  };
}
