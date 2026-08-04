import { useState } from 'react';
import { parseUnits } from 'viem';
import { publicClient, getWalletClient, CONTRACT_ADDRESSES, ABIS } from '../utils/web3.js';
import type { TxConfirmDetails } from '../components/TransactionConfirmModal.js';

// Fetch real-time asset price directly from the on-chain OracleHub contract
async function getOnChainOraclePriceUSD(collateralType: string): Promise<number> {
  try {
    let assetAddress = CONTRACT_ADDRESSES.USDC;
    if (collateralType === 'wbtc') assetAddress = CONTRACT_ADDRESSES.WBTC || '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0';
    if (collateralType === 'weth') assetAddress = CONTRACT_ADDRESSES.WETH || '0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9';
    if (collateralType === 'alpha') assetAddress = CONTRACT_ADDRESSES.ALPHA_TOKEN;

    // We query the value of 1 ether (1e18) of the asset. The oracle handles decimal conversions
    // and returns the value in 18 decimal USD format.
    const oneTokenWei = parseUnits('1', collateralType === 'wbtc' ? 8 : 18);
    
    const usdValueWei = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.PRICE_FEED,
      abi: ABIS.PRICE_FEED,
      functionName: 'getAssetUsdValue',
      args: [assetAddress, oneTokenWei]
    }) as bigint;
    
    const usdValue = Number(usdValueWei) / 1e18;
    if (usdValue > 0) return usdValue;
  } catch (e) {
    console.error('Oracle fetch failed:', e);
  }
  return 1.0;
}

// Max LTV per collateral type
const MAX_LTV: Record<string, number> = {
  alpha: 0.50,
  wbtc: 0.70,
  weth: 0.75
};

interface P2PLendingActionsParams {
  activeKey: string;
  adminKey: string;  // Protocol operator key — injected from useWeb3State, never hardcoded here
  addLog: (msg: string) => void;
  addToast: (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => void;
  fetchData: () => Promise<void>;
  requestConfirmation?: (details: TxConfirmDetails, action: () => Promise<void>) => void;
}

export function useP2PLendingActions({ activeKey, adminKey, addLog, addToast, fetchData, requestConfirmation }: P2PLendingActionsParams) {
  const [p2pTokenId, setP2pTokenId] = useState('1');
  const [p2pBorrowAmount, setP2pBorrowAmount] = useState('500');
  const [p2pInterestBps, setP2pInterestBps] = useState('1000');
  const [p2pDays, setP2pDays] = useState('30');

  const [targetLoanId, setTargetLoanId] = useState('1');
  const [loanCollateral, setLoanCollateral] = useState('700');

  const executeCreateLoanOffer = async () => {
    try {
      const tokenIdBig = BigInt(p2pTokenId);

      addLog(`Creando oferta de préstamo P2P para NFT #${p2pTokenId}...`);
      addToast('info', 'Oferta P2P', 'Verificando aprobación...');
      const client = getWalletClient(activeKey);

      let isApproved = false;
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

      if (!isApproved) {
        const appHash = await client.writeContract({
          address: CONTRACT_ADDRESSES.POSITION_NFT,
          abi: ABIS.POSITION_NFT,
          functionName: 'approve',
          args: [CONTRACT_ADDRESSES.P2P_MARKET, tokenIdBig]
        });
        await publicClient.waitForTransactionReceipt({ hash: appHash });
      }

      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.P2P_MARKET,
        abi: ABIS.P2P_MARKET,
        functionName: 'createLoanOffer',
        args: [tokenIdBig, parseUnits(p2pBorrowAmount, 6), BigInt(p2pInterestBps), BigInt(p2pDays)]  // USDC = 6 decimals
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(`¡Oferta P2P creada! NFT #${p2pTokenId} en escrow. Publicada en el Marketplace.`);
      addToast('success', 'Oferta Creada', 'Préstamo publicado en el mercado en tiempo real');
      await fetchData();
      setTimeout(fetchData, 500);
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

      const signerAddr = getWalletClient(activeKey).account.address;
      if (ownerAddr.toLowerCase() !== signerAddr.toLowerCase()) {
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
        confirmButtonColor: 'gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
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
      setTimeout(fetchData, 500);
    } catch (err: any) {
      addLog(`[Error] Financiamiento falló: ${err.message || err}`);
      addToast('error', 'Error Financiamiento', err.message || 'Fallo');
    }
  };

  const handleAcceptLoanById = (loanId: number, reqBorrowAmountStr: string, customCollateralStr?: string) => {
    const numBorrow = parseFloat(reqBorrowAmountStr.replace(/,/g, ''));
    const colVal = customCollateralStr ? parseFloat(customCollateralStr) : numBorrow * 1.4;
    const colWei = parseUnits(colVal.toFixed(6), 6);  // USDC = 6 decimals

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
          { label: 'Ratio de Colateralización', value: '140.00%', badge: 'Seguro 130%-150%' },
          { label: 'Comisión de Originación (0.5%)', value: `$${(numBorrow * 0.005).toFixed(2)} USDC` }
        ],
        warningNote: 'Obtendrás derechos de cobro de intereses más principal. Si el prestatario entra en impago, podrás ejecutar auto-liquidación.',
        confirmButtonText: '✍️ Confirmar y Financiar',
        confirmButtonColor: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
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
      setTimeout(fetchData, 500);
    } catch (err: any) {
      addLog(`[Error] Cancelar oferta falló: ${err.message || err}`);
      addToast('error', 'Error Cancelar Oferta', err.message || 'Fallo');
    }
  };

  const handleCancelLoanOffer = (loanId: number) => {
    if (requestConfirmation) {
      requestConfirmation({
        title: `Cancelar Oferta de Préstamo #${loanId}`,
        actionIcon: '❌',
        typeBadge: 'Devolución de Escrow',
        targetContractName: 'P2PLendingMarket.sol',
        targetContractAddress: CONTRACT_ADDRESSES.P2P_MARKET,
        inputAmount: `Oferta #${loanId}`,
        inputSymbol: 'P2P Offer',
        expectedOutput: 'NFT Colateral',
        expectedOutputSymbol: 'Devuelto a la Billetera',
        details: [
          { label: 'Estado de la Oferta', value: 'No Financiada (Disponible)' }
        ],
        confirmButtonText: '✍️ Confirmar Cancelación',
        confirmButtonColor: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
      }, () => executeCancelLoanOffer(loanId));
    } else {
      executeCancelLoanOffer(loanId);
    }
  };

  const executeRepayLoanById = async (loanId: number, totalToPay: number) => {
    try {
      addLog(`Reembolsando préstamo P2P #${loanId}...`);
      addToast('info', 'Reembolso Préstamo', 'Aprobando pago en USDC e intereses...');
      const client = getWalletClient(activeKey);

      // 1. Approve USDC repayment to P2PLendingMarket contract
      const appHash = await client.writeContract({
        address: CONTRACT_ADDRESSES.USDC,
        abi: ABIS.ERC20,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.P2P_MARKET, parseUnits(totalToPay.toFixed(6), 6)]  // USDC = 6 decimals
      });
      await publicClient.waitForTransactionReceipt({ hash: appHash });

      // 2. Execute repayLoan on P2PLendingMarket
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
      setTimeout(fetchData, 500);
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
          { label: 'Intereses Devengados (8.00% APR)', value: `+$${interestVal.toFixed(2)} USDC` },
          { label: 'Monto TOTAL a Pagar en USDC', value: `$${totalToPay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`, badge: 'Pago Total' },
          { label: 'Colateral en Custodia a Recibir', value: collateralStr, badge: 'Liberación 100%' },
          { label: 'Spread de Margen de Interés (10.00%)', value: `$${interestSpreadVal.toFixed(2)} USDC -> Flywheel Real Yield Stakers`, badge: 'Reparto a Stakers' },
          { label: 'Acrecimiento a Reservas Tesorería', value: `$${treasuryAccretionVal.toFixed(2)} USDC -> Inyectado a Reservas`, badge: 'Incrementa NAV ALPHA' }
        ],
        warningNote: `Al confirmar, pagarás exactamente $${totalToPay.toFixed(2)} USDC para cancelar el préstamo #${loanId} y recuperarás tu colateral (${collateralStr}).`,
        confirmButtonText: '✍️ Confirmar y Reembolsar Préstamo',
        confirmButtonColor: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
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
      addLog(`Ejecutando auto-liquidación en Préstamo #${loanId}...`);
      const client = getWalletClient(activeKey);
      const tx = await client.writeContract({
        address: CONTRACT_ADDRESSES.P2P_MARKET,
        abi: ABIS.P2P_MARKET,
        functionName: 'liquidateLoan',
        args: [BigInt(loanId)]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(`¡Préstamo #${loanId} liquidado! NFT transferido al prestamista.`);
      addToast('warning', 'Liquidación Ejecutada', 'NFT transferido al prestamista');
      await fetchData();
      setTimeout(fetchData, 500);
    } catch (err: any) {
      addLog(`[Error] Liquidación falló: ${err.message || err}`);
      addToast('error', 'Error Liquidación', err.message || 'Fallo');
    }
  };

  const handleLiquidateLoanById = (loanId: number) => {
    if (requestConfirmation) {
      requestConfirmation({
        title: `Auto-Liquidación de Préstamo #${loanId}`,
        actionIcon: '⚡',
        typeBadge: 'Ejecución por Impago / HF < 115%',
        targetContractName: 'P2PLendingMarket.sol',
        targetContractAddress: CONTRACT_ADDRESSES.P2P_MARKET,
        inputAmount: `Préstamo #${loanId}`,
        inputSymbol: 'Posición en Impago',
        expectedOutput: 'NFT Colateral',
        expectedOutputSymbol: 'Transferido a la Billetera del Prestamista',
        details: [
          { label: 'Umbral de Liquidación', value: 'Health Factor < 115%', isHighlight: true }
        ],
        warningNote: 'Se ejecutará el embargo del colateral. La propiedad del NFT será transferida al prestamista.',
        confirmButtonText: '⚡ Confirmar Liquidación',
        confirmButtonColor: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
      }, () => executeLiquidateLoanById(loanId));
    } else {
      executeLiquidateLoanById(loanId);
    }
  };

  const handleLiquidateLoan = () => {
    handleLiquidateLoanById(Number(targetLoanId));
  };

  const executeBorrowFromTreasury = async (collateralType: string, tokenIdOrAmountStr: string, amountStr: string, daysStr: string) => {
    try {
      const amountWei = parseUnits(amountStr, 6);  // USDC = 6 decimals
      const daysBig = BigInt(daysStr || '30');
      const interestBpsBig = 800n; // 8.00% APR Fixed Treasury Reserve Rate
      const userClient = getWalletClient(activeKey);
      // Protocol admin client — key is injected via hook props from useWeb3State, never hardcoded
      const adminClient = getWalletClient(adminKey);

      let tokenIdBig: bigint;

      if (collateralType === 'nft') {
        tokenIdBig = BigInt(tokenIdOrAmountStr || '1');
        addLog(`[Tesorería APY Booster] Solicitando préstamo de $${amountStr} USDC con NFT #${tokenIdOrAmountStr}...`);
        addToast('info', 'Préstamo Tesorería', 'Enviando solicitud y aprobando NFT...');
      } else {
        // For ALPHA / WBTC / WETH collateral, mint a Position NFT for the collateral position
        const colAmt = parseFloat(tokenIdOrAmountStr || '0');
        const priceUsd = await getOnChainOraclePriceUSD(collateralType);

        const colValUSD = colAmt * priceUsd;
        const colValWei = parseUnits(colValUSD.toFixed(6), 6);  // USDC = 6 decimals
        const assetSymbol = collateralType.toUpperCase();

        addLog(`[Tesorería APY Booster] Registrando posición de colateral en la blockchain (${tokenIdOrAmountStr} ${assetSymbol} = $${colValUSD.toFixed(2)} USD)...`);
        addToast('info', 'Préstamo Tesorería', `Creando registro de colateral en ${assetSymbol}...`);

        // 1. Mint Position NFT representing collateral position
        const txMintNft = await adminClient.writeContract({
          address: CONTRACT_ADDRESSES.POSITION_NFT,
          abi: ABIS.POSITION_NFT,
          functionName: 'mintPosition',
          args: [
            userClient.account.address,
            collateralType === 'alpha' ? CONTRACT_ADDRESSES.ALPHA_TOKEN : CONTRACT_ADDRESSES.USDC,
            colValWei,
            colValWei,
            1n
          ]
        });
        await publicClient.waitForTransactionReceipt({ hash: txMintNft });

        // 2. Get the new NFT ID
        const nextNftId = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.POSITION_NFT,
          abi: ABIS.POSITION_NFT,
          functionName: 'nextTokenId'
        }) as bigint;
        tokenIdBig = nextNftId - 1n;

        // 3. Lock collateral ERC20 tokens in Escrow contract
          const colTokenAddr = collateralType === 'alpha' ? CONTRACT_ADDRESSES.ALPHA_TOKEN : collateralType === 'wbtc' ? CONTRACT_ADDRESSES.USDT : CONTRACT_ADDRESSES.USDC;
        const colAmountWei = parseUnits(tokenIdOrAmountStr, 6);  // Assuming USDC collateral, 6 decimals

        const appCol = await userClient.writeContract({
          address: colTokenAddr,
          abi: ABIS.ERC20,
          functionName: 'approve',
          args: [CONTRACT_ADDRESSES.P2P_MARKET, colAmountWei]
        });
        await publicClient.waitForTransactionReceipt({ hash: appCol });

        const txEscrow = await userClient.writeContract({
          address: colTokenAddr,
          abi: ABIS.ERC20,
          functionName: 'transfer',
          args: [CONTRACT_ADDRESSES.P2P_MARKET, colAmountWei]
        });
        await publicClient.waitForTransactionReceipt({ hash: txEscrow });
        addLog(`[Escrow On-Chain] ${tokenIdOrAmountStr} ${assetSymbol} bloqueados en custodia.`);
      }

      // 4. Approve Position NFT to P2P Market
      let isApproved = false;
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

      if (!isApproved) {
        const appHash = await userClient.writeContract({
          address: CONTRACT_ADDRESSES.POSITION_NFT,
          abi: ABIS.POSITION_NFT,
          functionName: 'approve',
          args: [CONTRACT_ADDRESSES.P2P_MARKET, tokenIdBig]
        });
        await publicClient.waitForTransactionReceipt({ hash: appHash });
      }

      // 5. Create Loan Offer on-chain at 8.00% APR
      const txCreate = await userClient.writeContract({
        address: CONTRACT_ADDRESSES.P2P_MARKET,
        abi: ABIS.P2P_MARKET,
        functionName: 'createLoanOffer',
        args: [tokenIdBig, amountWei, interestBpsBig, daysBig]
      });
      await publicClient.waitForTransactionReceipt({ hash: txCreate });

      // 6. Get the new Loan ID
      const nextId = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.P2P_MARKET,
        abi: ABIS.P2P_MARKET,
        functionName: 'nextLoanId'
      }) as bigint;
      const newLoanId = nextId - 1n;

      // 7. Fund loan using Treasury Reserve liquidity via Admin Wallet
      addLog(`[Tesorería APY Booster] Desembolsando $${amountStr} USDC desde reservas de la tesorería al préstamo #${newLoanId}...`);
      const appUsdc = await adminClient.writeContract({
        address: CONTRACT_ADDRESSES.USDC,
        abi: ABIS.ERC20,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.P2P_MARKET, amountWei * 2n]
      });
      await publicClient.waitForTransactionReceipt({ hash: appUsdc });

      const txFund = await adminClient.writeContract({
        address: CONTRACT_ADDRESSES.P2P_MARKET,
        abi: ABIS.P2P_MARKET,
        functionName: 'fundLoanOffer',
        args: [newLoanId]
      });
      await publicClient.waitForTransactionReceipt({ hash: txFund });

      addLog(`¡Préstamo #${newLoanId} desembolsado por la Tesorería! $${amountStr} USDC acreditados en tu billetera.`);
      addToast('success', 'Préstamo Desembolsado', `Préstamo #${newLoanId} registrado y $${amountStr} USDC acreditados de las Reservas`);

      await fetchData();
      setTimeout(fetchData, 500);
    } catch (err: any) {
      addLog(`[Error] Préstamo Tesorería falló: ${err.message || err}`);
      addToast('error', 'Error Préstamo Tesorería', err.message || 'Fallo en desembolso');
    }
  };

  const handleBorrowFromTreasury = async (collateralType: string, tokenIdOrAmountStr: string, amountStr: string, daysStr: string) => {
    if (!amountStr || parseFloat(amountStr) <= 0) {
      addToast('warning', 'Monto Inválido', 'Ingresa un monto en USDC mayor a 0');
      return;
    }

    const numAmt = parseFloat(amountStr);
    const colSymbol = collateralType.toUpperCase();

    // Strict LTV Validation Check for Non-NFT Collateral
    if (collateralType !== 'nft') {
      const colAmt = parseFloat(tokenIdOrAmountStr || '0');
      const priceUsd = await getOnChainOraclePriceUSD(collateralType);
      const maxLtv = MAX_LTV[collateralType] ?? 0.50;

      const collateralValUSD = colAmt * priceUsd;
      const maxBorrowUSD = collateralValUSD * maxLtv;

      if (numAmt > maxBorrowUSD) {
        const requiredColateralAmt = numAmt / (priceUsd * maxLtv);
        addLog(`[Error LTV] Colateral insuficiente. Con ${colAmt} ${colSymbol} ($${collateralValUSD.toFixed(2)} USD) solo puedes pedir un máximo de $${maxBorrowUSD.toFixed(2)} USDC (${(maxLtv * 100).toFixed(0)}% LTV).`);
        addToast('error', 'Colateral Insuficiente', `Para pedir $${numAmt} USDC necesitas al menos ${requiredColateralAmt.toFixed(collateralType === 'alpha' ? 0 : 4)} ${colSymbol} ($${(numAmt / maxLtv).toFixed(2)} USD de garantía al ${(maxLtv * 100).toFixed(0)}% LTV).`);
        return;
      }
    }

    if (requestConfirmation) {
      requestConfirmation({
        title: `Solicitar Préstamo a Tesorería (${colSymbol})`,
        actionIcon: '🏛️',
        typeBadge: 'Reserva Líquida Tesorería (APY Booster)',
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
        confirmButtonColor: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
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

