import { useState } from 'react';
import { parseUnits, formatUnits } from 'viem';
import { publicClient, getWalletClient, CONTRACT_ADDRESSES, ABIS } from '../utils/web3.js';
import { simulatePreflightTransaction } from '../utils/preflightSimulation.js';
import type { TxConfirmDetails } from '../components/TransactionConfirmModal.js';
import { UI_STRINGS } from '../constants/strings.js';

interface P2PLendingActionsParams {
  activeKey: string;
  adminKey?: string;
  userAddress?: string;
  addLog: (msg: string) => void;
  addToast: (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => void;
  fetchData: () => Promise<void>;
  requestConfirmation?: (details: TxConfirmDetails, action: () => Promise<void>) => void;
}

export function useP2PLendingActions({ activeKey, userAddress, addLog, addToast, fetchData, requestConfirmation }: P2PLendingActionsParams) {
  const [p2pTokenId, setP2pTokenId] = useState('1');
  const [p2pBorrowAmount, setP2pBorrowAmount] = useState('500');
  const [p2pInterestBps, setP2pInterestBps] = useState('1000');
  const [p2pDays, setP2pDays] = useState('30');

  const [targetLoanId, setTargetLoanId] = useState('1');
  const [loanCollateral, setLoanCollateral] = useState('700');

  const executeCreateLoanOffer = async () => {
    try {
      const tokenIdBig = BigInt(p2pTokenId);

      addLog(UI_STRINGS.TOASTS_AND_LOGS.P2P_OFFER_START);
      addToast('info', 'Oferta P2P', 'Verificando autorización del NFT...');
      const client = getWalletClient(activeKey);

      let isApproved = false;
      try {
        const isAllApproved = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.POSITION_NFT,
          abi: ABIS.POSITION_NFT,
          functionName: 'isApprovedForAll',
          args: [client.account.address, CONTRACT_ADDRESSES.P2P_MARKET]
        }) as boolean;
        if (isAllApproved) isApproved = true;
      } catch (e) {}

      if (!isApproved) {
        try {
          const approved = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.POSITION_NFT,
            abi: ABIS.POSITION_NFT,
            functionName: 'getApproved',
            args: [tokenIdBig]
          }) as string;
          if (approved.toLowerCase() === CONTRACT_ADDRESSES.P2P_MARKET.toLowerCase()) {
            isApproved = true;
          }
        } catch (e) {}
      }

      if (!isApproved) {
        addLog(`[Paso 1/2] Aprobando autorización de custodia para el Mercado P2P...`);
        addToast('info', 'Paso 1/2: Autorización', 'Firma la autorización en tu billetera (solo 1 vez)...');
        const appHash = await client.writeContract({
          address: CONTRACT_ADDRESSES.POSITION_NFT,
          abi: ABIS.POSITION_NFT,
          functionName: 'setApprovalForAll',
          args: [CONTRACT_ADDRESSES.P2P_MARKET, true]
        });
        await publicClient.waitForTransactionReceipt({ hash: appHash });
        addToast('info', 'Paso 2/2: Crear Oferta', 'Autorización completada. Registrando préstamo...');
        await new Promise((res) => setTimeout(res, 500));
      }

      addLog(`[Paso 2/2] Creando oferta de préstamo P2P para NFT #${tokenIdBig}...`);
      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.P2P_MARKET,
        abi: ABIS.P2P_MARKET,
        functionName: 'createLoanOffer',
        args: [tokenIdBig, parseUnits(p2pBorrowAmount, 6), BigInt(p2pInterestBps), BigInt(p2pDays)]  // USDC = 6 decimals
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(UI_STRINGS.TOASTS_AND_LOGS.P2P_OFFER_SUCCESS);
      addToast('success', 'Oferta Creada', UI_STRINGS.TOASTS_AND_LOGS.P2P_OFFER_SUCCESS);
      await fetchData();
    } catch (err: any) {
      addLog(`[Error] Creación de préstamo falló: ${err.message || err}`);
      addToast('error', 'Error Oferta P2P', err.message || 'Fallo al crear oferta');
    }
  };

  const handleCreateLoanOffer = async () => {
    if (!p2pTokenId) {
      addToast('warning', 'Selección de NFT', 'Debes seleccionar un ID de NFT válido');
      return;
    }
    const tokenIdBig = BigInt(p2pTokenId);

    try {
      const ownerAddr = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.POSITION_NFT,
        abi: [{ name: 'ownerOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] }] as const,
        functionName: 'ownerOf',
        args: [tokenIdBig]
      }) as string;

      if (!userAddress || ownerAddr.toLowerCase() !== userAddress.toLowerCase()) {
        addLog(`[Aviso] El NFT #${p2pTokenId} pertenece a ${ownerAddr.slice(0, 6)}...`);
        addToast('warning', 'NFT No Disponible', `El NFT #${p2pTokenId} ya está en escrow o no pertenece a tu billetera activa.`);
        return;
      }
    } catch (e) {
      addToast('warning', 'NFT Inexistente', `El NFT #${p2pTokenId} no existe en el contrato.`);
      return;
    }

    const apr = (parseFloat(p2pInterestBps) / 100).toFixed(2);

    if (requestConfirmation) {
      const origFee = (parseFloat(p2pBorrowAmount) * 0.005).toFixed(2);
      const netBorrow = (parseFloat(p2pBorrowAmount) * 0.995).toFixed(2);

      requestConfirmation({
        title: `Publicar Oferta P2P con NFT #${p2pTokenId}`,
        actionIcon: '🤝',
        typeBadge: 'Escrow Colateralizado ERC-721',
        targetContractName: 'P2PLendingMarket.sol',
        targetContractAddress: CONTRACT_ADDRESSES.P2P_MARKET,
        inputAmount: `NFT #${p2pTokenId}`,
        inputSymbol: 'Garantía Colateral Custodiada',
        expectedOutput: `$${netBorrow}`,
        expectedOutputSymbol: 'USDC Prestado Neto (Tras Fee 0.5%)',
        details: [
          { label: 'Monto Solicitado Bruto', value: `$${p2pBorrowAmount} USDC` },
          { label: 'Comisión de Originación (0.50%)', value: `$${origFee} USDC`, badge: '100% a Stakers Real Yield' },
          { label: 'Monto Neto Recibido por Prestamista', value: `$${netBorrow} USDC` },
          { label: 'Tasa de Interés Propuesta', value: `${apr}% APR (${p2pInterestBps} BPS)` },
          { label: 'Plazo del Préstamo', value: `${p2pDays} Días` },
          { label: 'LTV Máximo Permitido', value: '70.00% del Valor del NFT' }
        ],
        warningNote: `Tu NFT #${p2pTokenId} quedará custodiado en el contrato de préstamo hasta que reembolses la deuda.`,
        confirmButtonText: '✍️ Confirmar y Publicar Oferta',
        confirmButtonVariant: 'blue'
      }, executeCreateLoanOffer);
    } else {
      executeCreateLoanOffer();
    }
  };

  const executeAcceptLoanById = async (loanId: number, colWei: bigint) => {
    try {
      addLog(`Financiando préstamo P2P #${loanId}...`);
      addToast('info', 'Financiar Préstamo', 'Aprobando USDC...');
      const client = getWalletClient(activeKey);

      const appHash = await client.writeContract({
        address: CONTRACT_ADDRESSES.USDC,
        abi: ABIS.ERC20,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.P2P_MARKET, colWei * 2n]
      });
      await publicClient.waitForTransactionReceipt({ hash: appHash });

      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.P2P_MARKET,
        abi: ABIS.P2P_MARKET,
        functionName: 'acceptLoanAndDepositCollateral',
        args: [BigInt(loanId), colWei]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(`¡Préstamo #${loanId} financiado con éxito!`);
      addToast('success', 'Préstamo Financiado', 'Fondos transferidos al prestatario');
      await fetchData();
    } catch (err: any) {
      addLog(`[Error] Financiamiento falló: ${err.message || err}`);
      addToast('error', 'Error Financiamiento', err.message || 'Fallo');
    }
  };

  const handleAcceptLoanById = (loanId: number, reqBorrowAmountStr: string, customCollateralStr?: string) => {
    const numBorrow = parseFloat(reqBorrowAmountStr.replace(/,/g, ''));
    const colVal = customCollateralStr ? parseFloat(customCollateralStr) : numBorrow * 1.4;
    const colWei = parseUnits(colVal.toFixed(6), 6);  // USDC = 6 decimals
    const ratioPct = numBorrow > 0 ? ((colVal / numBorrow) * 100).toFixed(2) : '140.00';
    const origFee = (numBorrow * 0.005).toFixed(2);
    const netBorrow = (numBorrow * 0.995).toFixed(2);

    if (requestConfirmation) {
      requestConfirmation({
        title: `Financiar Préstamo P2P #${loanId}`,
        actionIcon: '✅',
        typeBadge: 'Aceptación de Oferta',
        targetContractName: 'P2PLendingMarket.sol',
        targetContractAddress: CONTRACT_ADDRESSES.P2P_MARKET,
        inputAmount: `$${colVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        inputSymbol: 'USDC Colateral Depositado',
        expectedOutput: `$${numBorrow.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        expectedOutputSymbol: 'USDC Transferido al Ofertante',
        details: [
          { label: 'ID Préstamo', value: `#${loanId}` },
          { label: 'Ratio de Colateralización Calculado', value: `${ratioPct}%`, badge: `LTV: ${(100 / parseFloat(ratioPct) * 100).toFixed(1)}%` },
          { label: 'Comisión de Originación (0.5%)', value: `$${origFee} USDC (Destino: Real Yield Flywheel)` },
          { label: 'Desembolso Neto al Prestatario', value: `$${netBorrow} USDC` }
        ],
        warningNote: 'Obtendrás derechos de cobro de intereses más principal. Si el prestatario entra en impago, podrás ejecutar auto-liquidación.',
        confirmButtonText: '✍️ Confirmar y Financiar',
        confirmButtonVariant: 'emerald'
      }, () => executeAcceptLoanById(loanId, colWei));
    } else {
      executeAcceptLoanById(loanId, colWei);
    }
  };

  const handleAcceptLoan = () => {
    handleAcceptLoanById(Number(targetLoanId), loanCollateral, loanCollateral);
  };

  const executeCancelLoanOffer = async (loanId: number) => {
    try {
      addLog(`Cancelando oferta de préstamo P2P #${loanId}...`);
      addToast('info', 'Cancelar Oferta', 'Enviando transacción...');
      const client = getWalletClient(activeKey);
      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.P2P_MARKET,
        abi: ABIS.P2P_MARKET,
        functionName: 'cancelLoanOffer',
        args: [BigInt(loanId)]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(`¡Oferta #${loanId} cancelada! NFT devuelto a tu billetera.`);
      addToast('success', 'Oferta Cancelada', `NFT devuelto a la billetera`);
      await fetchData();
    } catch (err: any) {
      addLog(`[Error] Cancelar oferta falló: ${err.message || err}`);
      addToast('error', 'Error Cancelar Oferta', err.message || 'Fallo');
    }
  };

  const handleCancelLoanOffer = (loanId: number, loanObj?: any) => {
    const borrowAmt = loanObj ? (parseFloat((loanObj.borrowAmount || '0').toString().replace(/,/g, '')) || 0) : 0;
    const nftId = loanObj ? loanObj.positionTokenId : null;

    if (requestConfirmation) {
      requestConfirmation({
        title: `Cancelar Oferta de Préstamo #${loanId}`,
        actionIcon: '❌',
        typeBadge: 'Devolución de Escrow',
        targetContractName: 'P2PLendingMarket.sol',
        targetContractAddress: CONTRACT_ADDRESSES.P2P_MARKET,
        inputAmount: `Oferta #${loanId}`,
        inputSymbol: 'P2P Offer',
        expectedOutput: nftId ? `NFT #${nftId}` : 'NFT Colateral',
        expectedOutputSymbol: 'Devuelto a la Billetera',
        details: [
          { label: 'Estado de la Oferta', value: 'No Financiada (Disponible en Mercado)' },
          ...(borrowAmt > 0 ? [{ label: 'Monto de Préstamo Cancelado', value: `$${borrowAmt.toFixed(2)} USDC` }] : []),
          { label: 'Comisión por Cancelación', value: '0.00% ($0.00 USDC)' }
        ],
        confirmButtonText: '✍️ Confirmar Cancelación',
        confirmButtonVariant: 'danger'
      }, () => executeCancelLoanOffer(loanId));
    } else {
      executeCancelLoanOffer(loanId);
    }
  };

  const executeRepayLoanById = async (loanId: number, _totalToPay: number) => {
    try {
      addLog(`Reembolsando préstamo P2P #${loanId}...`);
      const client = getWalletClient(activeKey);

      // Query on-chain calculateTotalOwed to get exact amount with interest
      let totalOwedWei = 0n;
      try {
        const owedRes = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.P2P_MARKET,
          abi: ABIS.P2P_MARKET,
          functionName: 'calculateTotalOwed',
          args: [BigInt(loanId)]
        }) as [bigint, bigint];
        if (owedRes && owedRes[0]) {
          totalOwedWei = owedRes[0];
        }
      } catch (e) {
        totalOwedWei = parseUnits((_totalToPay * 1.005).toFixed(6), 6);
      }

      if (totalOwedWei === 0n) {
        totalOwedWei = parseUnits((_totalToPay * 1.005).toFixed(6), 6);
      }

      // Check current allowance first to avoid redundant signatures
      let currentAllowance = 0n;
      try {
        currentAllowance = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.USDC,
          abi: ABIS.ERC20,
          functionName: 'allowance',
          args: [client.account.address, CONTRACT_ADDRESSES.P2P_MARKET]
        }) as bigint;
      } catch (e) {}

      // 1. Approve exact USDC repayment amount only if needed
      if (currentAllowance < totalOwedWei) {
        const exactUsdcStr = formatUnits(totalOwedWei, 6);
        addToast('info', 'Paso 1/2: Aprobación', `Aprobando pago exacto de $${exactUsdcStr} USDC...`);
        const appHash = await client.writeContract({
          address: CONTRACT_ADDRESSES.USDC,
          abi: ABIS.ERC20,
          functionName: 'approve',
          args: [CONTRACT_ADDRESSES.P2P_MARKET, totalOwedWei]
        });
        await publicClient.waitForTransactionReceipt({ hash: appHash });
        addToast('info', 'Paso 2/2: Reembolso', 'Aprobación completada. Amortizando deuda...');
        await new Promise((res) => setTimeout(res, 500));
      }

      // 2. Pre-flight simulation check
      const preflight = await simulatePreflightTransaction(
        CONTRACT_ADDRESSES.P2P_MARKET,
        ABIS.P2P_MARKET,
        'repayLoan',
        [BigInt(loanId)],
        client.account.address
      );

      if (!preflight.canExecute && preflight.error) {
        addToast('error', preflight.error.title, preflight.error.message);
        addLog(`[Error Pre-Vuelo] ${preflight.error.message}`);
        return;
      }

      // 3. Execute repayLoan on P2PLendingMarket
      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.P2P_MARKET,
        abi: ABIS.P2P_MARKET,
        functionName: 'repayLoan',
        args: [BigInt(loanId)]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });

      addLog(`¡Préstamo #${loanId} reembolsado totalmente! Principal e intereses acreditados a las Reservas de Tesorería.`);
      addToast('success', 'Préstamo Reembolsado', 'Garantía liberada y reservas incrementadas con el interés generado');
      await fetchData();
    } catch (err: any) {
      addLog(`[Error] Reembolso falló: ${err.message || err}`);
      addToast('error', 'Error Reembolso', err.message || 'Fallo');
    }
  };

  const handleRepayLoanById = (loanId: number, loanObj?: any) => {
    // All values come from the on-chain loan object — no hardcoded fallbacks
    const principalVal = loanObj ? (parseFloat((loanObj.borrowAmount || '0').replace(/,/g, '')) || 0) : 0;
    const aprVal = loanObj ? (parseFloat(loanObj.interestRateApr || '0') || 0) : 0;
    const daysVal = loanObj ? (Number(loanObj.durationDays) || 0) : 0;

    // Calculated interest owed from actual loan terms
    const interestVal = (principalVal * (aprVal / 100) * daysVal) / 365;
    const totalToPay = principalVal + interestVal;

    let collateralStr = 'Garantía On-Chain (ver detalles en contrato)';
    if (loanObj) {
      if (loanObj.positionTokenId && loanObj.positionTokenId > 0) {
        collateralStr = `NFT #${loanObj.positionTokenId}`;
      } else if (loanObj.collateralAmount && parseFloat(loanObj.collateralAmount) > 0) {
        collateralStr = `$${loanObj.collateralAmount} USD (Garantía Custodiada)`;
      }
    }

    const interestSpreadVal = interestVal * 0.10; // 10% spread to stakers
    const treasuryAccretionVal = interestVal * 0.90; // 90% accretion to reserves

    if (requestConfirmation) {
      requestConfirmation({
        title: `Reembolso de Deuda Préstamo #${loanId}`,
        actionIcon: '💰',
        typeBadge: 'Cancelación Total de Deuda On-Chain',
        targetContractName: 'P2PLendingMarket.sol & Treasury.sol',
        targetContractAddress: CONTRACT_ADDRESSES.P2P_MARKET,
        inputAmount: `$${totalToPay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        inputSymbol: `USDC A Pagar (Principal $${principalVal.toFixed(0)} + Int. $${interestVal.toFixed(2)})`,
        expectedOutput: collateralStr,
        expectedOutputSymbol: 'Devuelto 100% a tu Billetera',
        details: [
          { label: 'ID del Préstamo', value: `#${loanId}` },
          { label: 'Capital Inicial Prestado (Principal)', value: `$${principalVal.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC` },
          { label: `Intereses Devengados (${aprVal.toFixed(2)}% APR)`, value: `+$${interestVal.toFixed(2)} USDC` },
          { label: 'Monto TOTAL a Pagar en USDC', value: `$${totalToPay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`, badge: 'Pago Total' },
          { label: 'Colateral en Custodia a Recibir', value: collateralStr, badge: 'Liberación 100%' },
          { label: 'Spread de Margen de Interés (10.00%)', value: `$${interestSpreadVal.toFixed(2)} USDC -> Flywheel Real Yield Stakers`, badge: 'Reparto a Stakers' },
          { label: 'Acrecimiento a Reservas Tesorería', value: `$${treasuryAccretionVal.toFixed(2)} USDC -> Inyectado a Reservas`, badge: 'Incrementa NAV ALPHA' }
        ],
        warningNote: `Al confirmar, pagarás exactamente $${totalToPay.toFixed(2)} USDC para cancelar el préstamo #${loanId} y recuperarás tu colateral (${collateralStr}).`,
        confirmButtonText: '✍️ Confirmar y Reembolsar Préstamo',
        confirmButtonVariant: 'blue'
      }, () => executeRepayLoanById(loanId, totalToPay));
    } else {
      executeRepayLoanById(loanId, totalToPay);
    }
  };

  const handleRepayLoan = () => {
    handleRepayLoanById(Number(targetLoanId));
  };

  const executeLiquidateLoanById = async (loanId: number) => {
    try {
      if (!loanId || loanId <= 0) {
        addToast('warning', 'ID Inválido', 'Indica un ID de préstamo válido para liquidar');
        return;
      }

      addLog(`Verificando solvencia y estado del Préstamo #${loanId}...`);
      const client = getWalletClient(activeKey);

      // 1. Check loan state and liquidatibility
      const rawLoan = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.P2P_MARKET,
        abi: ABIS.P2P_MARKET,
        functionName: 'loans',
        args: [BigInt(loanId)]
      }) as any;

      if (!rawLoan) {
        addToast('error', 'Préstamo Inexistente', `El préstamo #${loanId} no fue encontrado on-chain`);
        return;
      }

      const state = Array.isArray(rawLoan) ? Number(rawLoan[9]) : Number(rawLoan.state);
      if (state !== 1) { // 1 = ACTIVE
        addToast('warning', 'Préstamo No Activo', `El préstamo #${loanId} no está activo (Estado actual: ${state === 0 ? 'Oferta Disponible' : state === 2 ? 'Reembolsado' : state === 3 ? 'Liquidado' : 'Cancelado'})`);
        return;
      }

      const startTime = Array.isArray(rawLoan) ? Number(rawLoan[8]) : Number(rawLoan.startTime);
      const durationDays = Array.isArray(rawLoan) ? Number(rawLoan[7]) : Number(rawLoan.durationDays);
      const isExpired = Date.now() / 1000 > (startTime + durationDays * 86400);

      const hfRatio = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.P2P_MARKET,
        abi: ABIS.P2P_MARKET,
        functionName: 'calculateHealthFactor',
        args: [BigInt(loanId)]
      }) as bigint;

      const healthPercent = Number(hfRatio);

      if (healthPercent >= 115 && !isExpired) {
        addToast('warning', 'Préstamo Solvente', `El préstamo #${loanId} no es liquidable. Su factor de salud es de ${healthPercent}% (seguro ≥ 115%) y el plazo no ha vencido.`);
        addLog(`[Info] Préstamo #${loanId} es solvente (${healthPercent}% salud, plazo vigente). No liquidable.`);
        return;
      }

      // 2. Query total owed to approve USDC payment
      let totalOwedWei = 0n;
      try {
        const owedRes = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.P2P_MARKET,
          abi: ABIS.P2P_MARKET,
          functionName: 'calculateTotalOwed',
          args: [BigInt(loanId)]
        }) as [bigint, bigint];
        if (owedRes && owedRes[0]) {
          totalOwedWei = owedRes[0];
        }
      } catch (e) {}

      if (totalOwedWei > 0n) {
        let currentAllowance = 0n;
        try {
          currentAllowance = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.USDC,
            abi: ABIS.ERC20,
            functionName: 'allowance',
            args: [client.account.address, CONTRACT_ADDRESSES.P2P_MARKET]
          }) as bigint;
        } catch (e) {}

        if (currentAllowance < totalOwedWei) {
          addToast('info', 'Aprobación Liquidación', `Aprobando pago de $${formatUnits(totalOwedWei, 6)} USDC para saldar la deuda impagada...`);
          const appHash = await client.writeContract({
            address: CONTRACT_ADDRESSES.USDC,
            abi: ABIS.ERC20,
            functionName: 'approve',
            args: [CONTRACT_ADDRESSES.P2P_MARKET, totalOwedWei]
          });
          await publicClient.waitForTransactionReceipt({ hash: appHash });
          await new Promise((res) => setTimeout(res, 500));
        }
      }

      // 3. Pre-flight simulation check
      const preflight = await simulatePreflightTransaction(
        CONTRACT_ADDRESSES.P2P_MARKET,
        ABIS.P2P_MARKET,
        'liquidateLoan',
        [BigInt(loanId)],
        client.account.address
      );

      if (!preflight.canExecute && preflight.error) {
        addToast('error', preflight.error.title, preflight.error.message);
        addLog(`[Error Pre-Vuelo] ${preflight.error.message}`);
        return;
      }

      // 4. Execute liquidateLoan
      addLog(`Ejecutando embargo y liquidación en Préstamo #${loanId}...`);
      addToast('info', 'Liquidando Préstamo', 'Enviando transacción de liquidación...');
      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.P2P_MARKET,
        abi: ABIS.P2P_MARKET,
        functionName: 'liquidateLoan',
        args: [BigInt(loanId)]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(`¡Préstamo #${loanId} liquidado exitosamente! Colateral transferido al liquidador.`);
      addToast('warning', 'Liquidación Ejecutada', 'Deuda saldada y colateral transferido.');
      await fetchData();
    } catch (err: any) {
      addLog(`[Error] Liquidación falló: ${err.message || err}`);
      addToast('error', 'Error Liquidación', err.message || 'Fallo');
    }
  };

  const handleLiquidateLoanById = async (loanId: number, loanObj?: any) => {
    if (!loanId || loanId <= 0) {
      addToast('warning', 'ID Inválido', 'Indica un ID de préstamo válido para liquidar');
      return;
    }

    try {
      const rawLoan = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.P2P_MARKET,
        abi: ABIS.P2P_MARKET,
        functionName: 'loans',
        args: [BigInt(loanId)]
      }) as any;

      if (!rawLoan) {
        addToast('error', 'Préstamo Inexistente', `El préstamo #${loanId} no fue encontrado on-chain`);
        return;
      }

      const state = Array.isArray(rawLoan) ? Number(rawLoan[9]) : Number(rawLoan.state);
      if (state !== 1) {
        addToast('warning', 'Préstamo No Activo', `El préstamo #${loanId} no está activo (Estado: ${state === 0 ? 'Oferta' : state === 2 ? 'Reembolsado' : state === 3 ? 'Liquidado' : 'Cancelado'})`);
        return;
      }

      const startTime = Array.isArray(rawLoan) ? Number(rawLoan[8]) : Number(rawLoan.startTime);
      const durationDays = Array.isArray(rawLoan) ? Number(rawLoan[7]) : Number(rawLoan.durationDays);
      const isExpired = Date.now() / 1000 > (startTime + durationDays * 86400);

      const hfRatio = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.P2P_MARKET,
        abi: ABIS.P2P_MARKET,
        functionName: 'calculateHealthFactor',
        args: [BigInt(loanId)]
      }) as bigint;

      const healthPercent = Number(hfRatio);

      if (healthPercent >= 115 && !isExpired) {
        addToast('warning', 'Préstamo Solvente (No Liquidable)', `El préstamo #${loanId} es 100% solvente (Factor de Salud: ${healthPercent}%, seguro ≥ 115%) y su plazo está vigente. No puede ser liquidado.`);
        addLog(`[Info] Préstamo #${loanId} es 100% solvente (${healthPercent}% salud, plazo vigente). Liquidación no permitida.`);
        return;
      }

      const borrowAmt = loanObj ? (parseFloat((loanObj.borrowAmount || '0').toString().replace(/,/g, '')) || 0) : 0;
      const nftId = loanObj ? loanObj.positionTokenId : null;

      if (requestConfirmation) {
        requestConfirmation({
          title: `Ejecutar Liquidación de Préstamo #${loanId}`,
          actionIcon: '⚡',
          typeBadge: isExpired ? 'Plazo Vencido' : 'Health Factor < 115%',
          targetContractName: 'P2PLendingMarket.sol',
          targetContractAddress: CONTRACT_ADDRESSES.P2P_MARKET,
          inputAmount: `Préstamo #${loanId}`,
          inputSymbol: borrowAmt > 0 ? `$${borrowAmt.toFixed(2)} Deuda Impagada` : 'Posición en Impago',
          expectedOutput: nftId ? `NFT #${nftId}` : 'Colateral en Custodia',
          expectedOutputSymbol: 'Transferido al Liquidador (+10% Bono de Liquidación)',
          details: [
            { label: 'Estado de Solvencia', value: isExpired ? 'Plazo Vencido' : `Bajo Umbral (${healthPercent}% < 115%)`, isHighlight: true },
            ...(borrowAmt > 0 ? [{ label: 'Deuda a Amortizar', value: `$${borrowAmt.toFixed(2)} USDC` }] : []),
            { label: 'Incentivo Liquidador', value: '+10.00% Bono sobre Deuda', badge: 'Fair Liquidation' }
          ],
          warningNote: 'Al confirmar, pagarás la deuda del préstamo y recibirás el colateral en custodia con bonificación del 10%.',
          confirmButtonText: '⚡ Confirmar y Liquidar',
          confirmButtonVariant: 'danger'
        }, () => executeLiquidateLoanById(loanId));
      } else {
        executeLiquidateLoanById(loanId);
      }
    } catch (err: any) {
      addToast('error', 'Error Verificación', err.message || 'Fallo al verificar préstamo');
    }
  };

  const handleLiquidateLoan = () => {
    handleLiquidateLoanById(Number(targetLoanId));
  };

  const executeBorrowFromTreasury = async (collateralType: string, tokenIdOrAmountStr: string, amountStr: string, daysStr: string) => {
    try {
      const amountWei = parseUnits(amountStr, 6);  // USDC = 6 decimals
      const daysBig = BigInt(daysStr || '30');
      const userClient = getWalletClient(activeKey);

      if (collateralType === 'nft') {
        const tokenIdBig = BigInt(tokenIdOrAmountStr || '0');
        if (tokenIdBig === 0n) {
          addToast('warning', 'NFT No Válido', 'Por favor selecciona un NFT de Posición válido de tu billetera.');
          return;
        }

        // Pre-validate NFT ownership on-chain to avoid EVM revert
        try {
          const nftOwner = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.POSITION_NFT,
            abi: [{ inputs: [{ type: 'uint256', name: 'tokenId' }], name: 'ownerOf', outputs: [{ type: 'address', name: '' }], stateMutability: 'view', type: 'function' }],
            functionName: 'ownerOf',
            args: [tokenIdBig]
          }) as string;

          if (!userAddress || nftOwner.toLowerCase() !== userAddress.toLowerCase()) {
            addToast('warning', 'Sin Propiedad del NFT', `El NFT #${tokenIdBig} pertenece a otra dirección y no a tu billetera activa.`);
            return;
          }
        } catch (e) {
          addToast('error', 'NFT Inexistente', `El NFT #${tokenIdBig} no existe on-chain. Adquiere un Bono con Descuento primero para obtener un NFT.`);
          return;
        }

        addLog(`[Tesorería] Solicitando préstamo institucional de $${amountStr} USDC con NFT #${tokenIdBig}...`);
        addToast('info', 'Préstamo Tesorería', 'Verificando autorización del NFT...');

        let isApproved = false;
        try {
          const isAllApproved = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.POSITION_NFT,
            abi: ABIS.POSITION_NFT,
            functionName: 'isApprovedForAll',
            args: [userClient.account.address, CONTRACT_ADDRESSES.P2P_MARKET]
          }) as boolean;
          if (isAllApproved) isApproved = true;
        } catch (e) {}

        if (!isApproved) {
          try {
            const approved = await publicClient.readContract({
              address: CONTRACT_ADDRESSES.POSITION_NFT,
              abi: ABIS.POSITION_NFT,
              functionName: 'getApproved',
              args: [tokenIdBig]
            }) as string;
            if (approved.toLowerCase() === CONTRACT_ADDRESSES.P2P_MARKET.toLowerCase()) {
              isApproved = true;
            }
          } catch (e) {}
        }

        if (!isApproved) {
          addLog(`[Paso 1/2] Aprobando autorización de custodia para la Tesorería...`);
          addToast('info', 'Paso 1/2: Autorización', 'Firma la autorización en tu billetera (solo 1 vez)...');
          const appHash = await userClient.writeContract({
            address: CONTRACT_ADDRESSES.POSITION_NFT,
            abi: ABIS.POSITION_NFT,
            functionName: 'setApprovalForAll',
            args: [CONTRACT_ADDRESSES.P2P_MARKET, true]
          });
          await publicClient.waitForTransactionReceipt({ hash: appHash });
          addToast('info', 'Paso 2/2: Desembolso', 'Autorización completada. Desembolsando crédito...');
          await new Promise((res) => setTimeout(res, 500));
        }

        // Direct Treasury borrow: instant funding & disbursement
        addLog(`[Paso 2/2] Desembolsando $${amountStr} USDC directamente desde las Reservas de Tesorería...`);
        const txCreate = await userClient.writeContract({
          address: CONTRACT_ADDRESSES.P2P_MARKET,
          abi: ABIS.P2P_MARKET,
          functionName: 'borrowFromTreasury',
          args: [tokenIdBig, amountWei, daysBig]
        });
        await publicClient.waitForTransactionReceipt({ hash: txCreate });

        addLog(`¡Préstamo de $${amountStr} USDC desembolsado por la Tesorería! Fondos acreditados en tu billetera.`);
        addToast('success', 'Préstamo Desembolsado', `$${amountStr} USDC recibidos en tu billetera (Activo)`);
        await fetchData();
      } else if (collateralType === 'alpha') {
        const colAmtWei = parseUnits(tokenIdOrAmountStr || '0', 18);
        if (colAmtWei === 0n) {
          addToast('warning', 'Monto de ALPHA Requerido', 'Calcula o introduce una cantidad válida de tokens ALPHA como colateral.');
          return;
        }

        addLog(`[Tesorería] Solicitando préstamo institucional de $${amountStr} USDC con ${tokenIdOrAmountStr} ALPHA de colateral...`);
        addToast('info', 'Préstamo Tesorería', 'Verificando aprobación de tokens ALPHA...');

        // Approve ALPHA tokens to P2PLendingMarket
        const appHash = await userClient.writeContract({
          address: CONTRACT_ADDRESSES.ALPHA_TOKEN,
          abi: ABIS.ERC20,
          functionName: 'approve',
          args: [CONTRACT_ADDRESSES.P2P_MARKET, colAmtWei * 2n]
        });
        await publicClient.waitForTransactionReceipt({ hash: appHash });
        await new Promise((res) => setTimeout(res, 500));

        addLog(`Desembolsando $${amountStr} USDC desde Reservas con respaldo de ${tokenIdOrAmountStr} ALPHA...`);
        const txBorrow = await userClient.writeContract({
          address: CONTRACT_ADDRESSES.P2P_MARKET,
          abi: ABIS.P2P_MARKET,
          functionName: 'borrowFromTreasuryWithAlpha',
          args: [colAmtWei, amountWei, daysBig]
        });
        await publicClient.waitForTransactionReceipt({ hash: txBorrow });

        addLog(`¡Préstamo con respaldo ALPHA desembolsado con éxito! $${amountStr} USDC recibidos en tu billetera.`);
        addToast('success', 'Préstamo Desembolsado', `$${amountStr} USDC recibidos con colateral ALPHA (Activo)`);
        await fetchData();
      } else if (collateralType === 'wbtc') {
        const colAmtWei = parseUnits(tokenIdOrAmountStr || '0', 8); // WBTC = 8 decimals
        if (colAmtWei === 0n) {
          addToast('warning', 'Monto de WBTC Requerido', 'Introduce una cantidad válida de WBTC como colateral.');
          return;
        }

        addLog(`[Tesorería] Solicitando préstamo institucional de $${amountStr} USDC con ${tokenIdOrAmountStr} WBTC de colateral...`);
        addToast('info', 'Préstamo Tesorería', 'Verificando aprobación de WBTC...');

        const appHash = await userClient.writeContract({
          address: CONTRACT_ADDRESSES.WBTC,
          abi: ABIS.ERC20,
          functionName: 'approve',
          args: [CONTRACT_ADDRESSES.P2P_MARKET, colAmtWei * 2n]
        });
        await publicClient.waitForTransactionReceipt({ hash: appHash });
        await new Promise((res) => setTimeout(res, 500));

        addLog(`Desembolsando $${amountStr} USDC desde Reservas con respaldo de ${tokenIdOrAmountStr} WBTC (70% Max LTV)...`);
        const txBorrow = await userClient.writeContract({
          address: CONTRACT_ADDRESSES.P2P_MARKET,
          abi: ABIS.P2P_MARKET,
          functionName: 'borrowFromTreasuryWithAsset',
          args: [CONTRACT_ADDRESSES.WBTC, colAmtWei, amountWei, daysBig]
        });
        await publicClient.waitForTransactionReceipt({ hash: txBorrow });

        addLog(`¡Préstamo con respaldo WBTC desembolsado con éxito! $${amountStr} USDC recibidos en tu billetera.`);
        addToast('success', 'Préstamo Desembolsado', `$${amountStr} USDC recibidos con colateral WBTC (Activo)`);
        await fetchData();
      } else if (collateralType === 'weth') {
        const colAmtWei = parseUnits(tokenIdOrAmountStr || '0', 18); // WETH = 18 decimals
        if (colAmtWei === 0n) {
          addToast('warning', 'Monto de WETH Requerido', 'Introduce una cantidad válida de WETH como colateral.');
          return;
        }

        addLog(`[Tesorería] Solicitando préstamo institucional de $${amountStr} USDC con ${tokenIdOrAmountStr} WETH de colateral...`);
        addToast('info', 'Préstamo Tesorería', 'Verificando aprobación de WETH...');

        const appHash = await userClient.writeContract({
          address: CONTRACT_ADDRESSES.WETH,
          abi: ABIS.ERC20,
          functionName: 'approve',
          args: [CONTRACT_ADDRESSES.P2P_MARKET, colAmtWei * 2n]
        });
        await publicClient.waitForTransactionReceipt({ hash: appHash });
        await new Promise((res) => setTimeout(res, 500));

        addLog(`Desembolsando $${amountStr} USDC desde Reservas con respaldo de ${tokenIdOrAmountStr} WETH (75% Max LTV)...`);
        const txBorrow = await userClient.writeContract({
          address: CONTRACT_ADDRESSES.P2P_MARKET,
          abi: ABIS.P2P_MARKET,
          functionName: 'borrowFromTreasuryWithAsset',
          args: [CONTRACT_ADDRESSES.WETH, colAmtWei, amountWei, daysBig]
        });
        await publicClient.waitForTransactionReceipt({ hash: txBorrow });

        addLog(`¡Préstamo con respaldo WETH desembolsado con éxito! $${amountStr} USDC recibidos en tu billetera.`);
        addToast('success', 'Préstamo Desembolsado', `$${amountStr} USDC recibidos con colateral WETH (Activo)`);
        await fetchData();
      } else {
        addToast('info', 'Colateral no soportado', 'Selecciona NFT de Bono Vestado (vPOS), ALPHA, WBTC o WETH.');
      }
    } catch (err: any) {
      addLog(`[Error] Préstamo con Tesorería falló: ${err.message || err}`);
      addToast('error', 'Error Préstamo', err.message || 'Fallo');
    }
  };

  const handleBorrowFromTreasury = async (collateralType: string, tokenIdOrAmountStr: string, amountStr: string, daysStr: string) => {
    if (!amountStr || parseFloat(amountStr) <= 0) {
      addToast('warning', 'Monto Requerido', 'Ingresa un monto válido en USDC a solicitar');
      return;
    }

    const numAmt = parseFloat(amountStr);
    const colSymbol = collateralType.toUpperCase();

    if (requestConfirmation) {
      requestConfirmation({
        title: `Solicitar Préstamo a Tesorería: $${numAmt.toLocaleString('en-US')} USDC`,
        actionIcon: '🏛️',
        typeBadge: 'Crédito Institucional con Colateral',
        targetContractName: 'P2PLendingMarket.sol & Treasury.sol',
        targetContractAddress: CONTRACT_ADDRESSES.P2P_MARKET,
        inputAmount: collateralType === 'nft' ? `NFT #${tokenIdOrAmountStr}` : `${tokenIdOrAmountStr} ${colSymbol}`,
        inputSymbol: 'Garantía Colateral Custodiada',
        expectedOutput: `$${numAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        expectedOutputSymbol: 'USDC Desembolsado a tu Billetera',
        details: [
          { label: 'Tipo de Colateral', value: collateralType === 'nft' ? 'NFT Posición (70% Max LTV)' : `${colSymbol} (${collateralType === 'alpha' ? '50%' : collateralType === 'weth' ? '75%' : '70%'} Max LTV)` },
          { label: 'Tasa Fija Tesorería', value: '8.00% APR (800 BPS)', badge: 'Garantía Institucional' },
          { label: 'Comisión de Originación (0.50%)', value: `$${(numAmt * 0.005).toFixed(2)} USDC`, badge: '100% Inyectado a Flywheel Real Yield' },
          { label: 'Interés Devengado Est. (' + (daysStr || '30') + ' Días)', value: `+$${(numAmt * 0.08 * (parseFloat(daysStr || '30') / 365)).toFixed(2)} USDC`, badge: '90% Tesorería / 10% Stakers' },
          { label: 'Origen de Fondos', value: '20% Pool de Reservas Líquidas' }
        ],
        warningNote: 'La Tesorería financiará tu préstamo de forma inmediata. La garantía quedará en custodia del contrato de Escrow hasta el reembolso total.',
        confirmButtonText: '🏛️ Confirmar y Solicitar Crédito',
        confirmButtonVariant: 'emerald'
      }, () => executeBorrowFromTreasury(collateralType, tokenIdOrAmountStr, amountStr, daysStr));
    } else {
      executeBorrowFromTreasury(collateralType, tokenIdOrAmountStr, amountStr, daysStr);
    }
  };

  return {
    p2pTokenId,
    setP2pTokenId,
    p2pBorrowAmount,
    setP2pBorrowAmount,
    p2pInterestBps,
    setP2pInterestBps,
    p2pDays,
    setP2pDays,
    targetLoanId,
    setTargetLoanId,
    loanCollateral,
    setLoanCollateral,
    handleCreateLoanOffer,
    handleAcceptLoan,
    handleAcceptLoanById,
    handleCancelLoanOffer,
    handleRepayLoan,
    handleRepayLoanById,
    handleLiquidateLoan,
    handleLiquidateLoanById,
    handleBorrowFromTreasury
  };
}
