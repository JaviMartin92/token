import { useState } from 'react';
import { publicClient, getWalletClient, CONTRACT_ADDRESSES, ABIS } from '../utils/web3.js';
import { parseEther, parseUnits } from 'viem';
import type { TxConfirmDetails } from '../components/TransactionConfirmModal.js';

interface VestedVaultActionsParams {
  activeKey: string;
  addLog: (msg: string) => void;
  addToast: (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => void;
  fetchData: () => Promise<void>;
  requestConfirmation?: (details: TxConfirmDetails, action: () => Promise<void>) => void;
}

export function useVestedVaultActions({ activeKey, addLog, addToast, fetchData, requestConfirmation }: VestedVaultActionsParams) {
  const [bondPrincipal, setBondPrincipal] = useState('1000');
  const [bondLockYears, setBondLockYears] = useState('3');
  const [bondReferrer, setBondReferrer] = useState('');

  const executeBuyBond = async () => {
    if (!bondPrincipal) return;
    try {
      addLog(`Adquiriendo Bono Vestado a ${bondLockYears} años por $${bondPrincipal}...`);
      addToast('info', 'Compra Bono', 'Aprobando pago USDC...');
      const principalWei = parseUnits(bondPrincipal, 6);  // USDC = 6 decimals
      const refAddr = bondReferrer ? (bondReferrer as `0x${string}`) : '0x0000000000000000000000000000000000000000';
      const client = getWalletClient(activeKey);

      const appHash = await client.writeContract({
        address: CONTRACT_ADDRESSES.USDC,
        abi: ABIS.ERC20,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.VESTED_VAULT, parseUnits('1000000', 6)]  // USDC = 6 decimals
      });
      await publicClient.waitForTransactionReceipt({ hash: appHash });

      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.VESTED_VAULT,
        abi: ABIS.VESTED_VAULT,
        functionName: 'buyVestedBond',
        args: [principalWei, BigInt(bondLockYears), refAddr]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(`¡Bono Vestado adquirido! NFT de Posición acuñado.`);
      addToast('success', 'Bono Adquirido', 'NFT colateral acuñado en tu billetera');
      setBondPrincipal('1000');
      fetchData();
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
    let baseDiscountBps = Math.min(800 * yearsNum + 200, 4000); // 8% per year + 2% bonus (Max 40%)
    try {
      const userAddr = activeKey ? getWalletClient(activeKey).account.address : '0x0000000000000000000000000000000000000000';
      const onChainBps = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.VESTED_VAULT,
        abi: ABIS.VESTED_VAULT,
        functionName: 'calculateDiscountBps',
        args: [userAddr, BigInt(yearsNum)]
      }) as bigint;
      if (onChainBps > 0n) {
        baseDiscountBps = Number(onChainBps);
      }
    } catch (e) {}

    const basePct = Math.min(8 * yearsNum + 2, 40);
    let stakingBonusPct = 0;
    try {
      const userAddr = activeKey ? getWalletClient(activeKey).account.address : '0x0000000000000000000000000000000000000000';
      if (CONTRACT_ADDRESSES.STAKING) {
        const stakedBal = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.STAKING,
          abi: ABIS.STAKING,
          functionName: 'stakedBalances',
          args: [userAddr]
        }) as bigint;
        const stakedNum = Number(stakedBal / 10n**18n);
        if (stakedNum >= 20000) stakingBonusPct = 3.0;
        else if (stakedNum >= 10000) stakingBonusPct = 2.0;
        else if (stakedNum >= 5000) stakingBonusPct = 1.0;
      }
    } catch (e) {}

    const totalDiscountBps = baseDiscountBps;
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
          { label: 'Descuento Base por Duración', value: `${basePct.toFixed(1)}%` },
          { label: 'Bonus Extra Loyalty Staking ALPHA', value: `+${stakingBonusPct.toFixed(1)}% Extra Descuento`, badge: stakingBonusPct > 0 ? `Tier Staking (+${stakingBonusPct}%)` : 'Requiere >=5,000 ALPHA Staked' },
          { label: 'Descuento Total Consolidado', value: `${discountPct}% Total sobre NAV`, badge: `Ahorras $${savingsAmount.toFixed(2)} USDC` },
          { label: 'Comisión de Emisión de Bono (1.50%)', value: `$${(paidAmount * 0.015).toFixed(2)} USDC`, badge: '100% Inyectado a Flywheel Real Yield' },
          { label: 'Referido Asignado', value: bondReferrer ? `${bondReferrer.slice(0, 6)}...` : 'Ninguno (0x00)' }
        ],
        warningNote: `Tu capital de $${principalNum.toLocaleString('en-US')} estará bloqueado durante ${yearsNum} ${yearsNum === 1 ? 'año' : 'años'}. Podrás usar el NFT en el mercado P2P o ejecutar Ragequit con 15% penalización si necesitas liquidez.`,
        confirmButtonText: '✍️ Confirmar y Adquirir Bono',
        confirmButtonColor: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)'
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
      addToast('success', 'Bono Reclamado', `Reclamado NFT #${tokenId}`);
      fetchData();
    } catch (err: any) {
      addLog(`[Error] Reclamo de bono falló: ${err.message || err}`);
      addToast('error', 'Error Reclamo', err.message || 'Fallo en reclamo');
    }
  };

  const handleClaimMatured = (tokenId: number) => {
    if (requestConfirmation) {
      requestConfirmation({
        title: `Reclamo de Bono Vencido NFT #${tokenId}`,
        actionIcon: '🏆',
        typeBadge: 'Liberación 100% Principal',
        targetContractName: 'VestedDiscountVault.sol',
        targetContractAddress: CONTRACT_ADDRESSES.VESTED_VAULT,
        inputAmount: `NFT #${tokenId}`,
        inputSymbol: 'ERC-721 Token',
        expectedOutput: '100%',
        expectedOutputSymbol: 'Principal en USDC',
        details: [
          { label: 'Estado del Bono', value: 'Vencido (Periodo Cumplido)', badge: 'Sin Penalización' },
          { label: 'Comisión de Liberación', value: '0.00%' }
        ],
        confirmButtonText: '✍️ Confirmar Reclamo',
        confirmButtonColor: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
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
      addToast('warning', 'Ragequit Ejecutado', `Aplicada penalización del 15% en NFT #${tokenId}`);
      fetchData();
    } catch (err: any) {
      addLog(`[Error] Ragequit falló: ${err.message || err}`);
      addToast('error', 'Error Ragequit', err.message || 'Fallo en ragequit');
    }
  };

  const handleRagequit = (tokenId: number) => {
    if (requestConfirmation) {
      requestConfirmation({
        title: `Salida Anticipada (Ragequit) NFT #${tokenId}`,
        actionIcon: '⚠️',
        typeBadge: 'Penalización del 15% On-Chain',
        targetContractName: 'VestedDiscountVault.sol',
        targetContractAddress: CONTRACT_ADDRESSES.VESTED_VAULT,
        inputAmount: `NFT #${tokenId}`,
        inputSymbol: 'Posición Vestada',
        expectedOutput: '85%',
        expectedOutputSymbol: 'Principal Neto Reembolsado en USDC',
        details: [
          { label: 'Penalización por Salida Anticipada', value: '15.00% del Precio Pagado (RAGEQUIT_PENALTY_BPS)', isHighlight: true },
          { label: 'Destino 50% Penalización (Reservas)', value: '7.50% a Reservas Tesorería (Treasury.sol)' },
          { label: 'Destino 25% Penalización (OpEx Vault)', value: '3.75% a CorporateOpExVault (Auto-Staked ALPHA)' },
          { label: 'Destino 25% Penalización (Profit Vault)', value: '3.75% a CorporateProfitVault (Auto-Staked ALPHA)' }
        ],
        warningNote: '¡Atención! El contrato inteligente VestedDiscountVault.sol ejecutará una retención irreversible del 15.00% sobre el valor del bono.',
        confirmButtonText: '⚠️ Confirmar Ragequit (15% Penalty)',
        confirmButtonColor: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
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
