const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../frontend/src/App.tsx');
fs.appendFileSync(file, `
  useEffect(() => {
    if (userAddress) {
      fetchData();
      const interval = setInterval(fetchData, 3000);
      return () => clearInterval(interval);
    }
  }, [userAddress, activeKey]);

  const handleSwitchRole = (key: \`0x\${string}\`, roleName: string) => {
    setActiveKey(key);
    setUserAddress(privateKeyToAccount(key).address);
    addLog(\`Switched Connected Wallet to \${roleName}\`);
    addToast('info', 'Rol Cambiado', \`Conectado como \${roleName}\`);
  };

  const handleFaucetUSDC = async () => {
    try {
      addLog('Claiming 10,000 mock USDC from Faucet...');
      addToast('info', 'Faucet USDC', 'Enviando transacción...');
      const tx = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.USDC,
        abi: ABIS.ERC20,
        functionName: 'mint',
        args: [userAddress as \`0x\${string}\`, parseEther('10000')],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog('Successfully claimed 10,000 USDC!');
      addToast('success', 'Éxito Faucet', 'Recibidos 10,000 USDC mock');
      fetchData();
    } catch (err: any) {
      addLog(\`[Error] USDC Faucet failed: \${err.message || err}\`);
      addToast('error', 'Error Faucet', err.message || 'Transacción fallida');
    }
  };

  const handleDeposit = async () => {
    if (!depositAmount) return;
    try {
      addLog(\`Depositing \${depositAmount} USDC into Treasury...\`);
      addToast('info', 'Depósito Tesorería', \`Aprobando \${depositAmount} USDC...\`);
      const amountWei = parseEther(depositAmount);

      const appHash = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.USDC,
        abi: ABIS.ERC20,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.TREASURY, amountWei],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: appHash });

      const depHash = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.TREASURY,
        abi: ABIS.TREASURY,
        functionName: 'deposit',
        args: [amountWei],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: depHash });
      addLog(\`Successfully deposited USDC and minted ALPHA shares.\`);
      addToast('success', 'Depósito Completado', \`Acuñadas ALPHA shares a valor NAV\`);
      setDepositAmount('');
      fetchData();
    } catch (err: any) {
      addLog(\`[Error] Deposit failed: \${err.message || err}\`);
      addToast('error', 'Error Depósito', err.message || 'Error al depositar');
    }
  };

  const handleRedeem = async () => {
    if (!redeemAmount) return;
    try {
      addLog(\`Redeeming \${redeemAmount} ALPHA shares for USDC...\`);
      addToast('info', 'Rescate Shares', \`Rescatando \${redeemAmount} ALPHA...\`);
      const amountWei = parseEther(redeemAmount);

      const redHash = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.TREASURY,
        abi: ABIS.TREASURY,
        functionName: 'redeem',
        args: [amountWei],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: redHash });
      addLog(\`Successfully redeemed shares. Received USDC.\`);
      addToast('success', 'Rescate Exitoso', \`Tokens canjeados a valor NAV\`);
      setRedeemAmount('');
      fetchData();
    } catch (err: any) {
      addLog(\`[Error] Redemption failed: \${err.message || err}\`);
      addToast('error', 'Error Rescate', err.message || 'Fallo en rescate');
    }
  };

  const handleAuditPoR = async () => {
    try {
      addLog(\`Auditing Proof of Reserves on-chain...\`);
      const res = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.TREASURY,
        abi: [
          { name: 'getProofOfReserves', type: 'function', stateMutability: 'view', inputs: [], outputs: [
            { name: 'totalAssetsUSD', type: 'uint256' },
            { name: 'totalLiabilitiesUSD', type: 'uint256' },
            { name: 'collateralRatioBps', type: 'uint256' }
          ]}
        ] as const,
        functionName: 'getProofOfReserves'
      }) as readonly [bigint, bigint, bigint];

      const assetsVal = parseFloat(formatEther(res[0]));
      const liabilitiesVal = parseFloat(formatEther(res[1]));
      const ratioBps = Number(res[2]) / 100;

      setPorAssets(assetsVal.toLocaleString('en-US', { maximumFractionDigits: 2 }));
      setPorLiabilities(liabilitiesVal.toLocaleString('en-US', { maximumFractionDigits: 2 }));
      setPorRatio(\`\${ratioBps.toFixed(2)}%\`);
      addLog(\`Proof of Reserves Audited! Collateral Ratio: \${ratioBps.toFixed(2)}%\`);
      addToast('success', 'Auditoría PoR', \`Ratio: \${ratioBps.toFixed(2)}%\`);
    } catch (err: any) {
      addLog(\`[Error] Proof of Reserves audit failed: \${err.message || err}\`);
    }
  };

  const handleBuyBond = async () => {
    if (!bondPrincipal) return;
    try {
      addLog(\`Purchasing \${bondLockYears}-year Vested Bond for $\${bondPrincipal}...\`);
      addToast('info', 'Compra Bono', 'Aprobando pago USDC...');
      const principalWei = parseEther(bondPrincipal);
      const refAddr = bondReferrer ? (bondReferrer as \`0x\${string}\`) : '0x0000000000000000000000000000000000000000';

      const appHash = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.USDC,
        abi: ABIS.ERC20,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.VESTED_VAULT, parseEther('1000000')],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: appHash });

      const tx = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.VESTED_VAULT,
        abi: ABIS.VESTED_VAULT,
        functionName: 'buyVestedBond',
        args: [principalWei, BigInt(bondLockYears), refAddr],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(\`Vested Bond purchased! Position NFT minted.\`);
      addToast('success', 'Bono Adquirido', 'NFT colateral acuñado en tu billetera');
      setBondPrincipal('1000');
      fetchData();
    } catch (err: any) {
      addLog(\`[Error] Bond purchase failed: \${err.message || err}\`);
      addToast('error', 'Error Compra Bono', err.message || 'Fallo en compra');
    }
  };

  const handleClaimMatured = async (tokenId: number) => {
    try {
      addLog(\`Claiming matured position for NFT #\${tokenId}...\`);
      const tx = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.VESTED_VAULT,
        abi: ABIS.VESTED_VAULT,
        functionName: 'claimMatured',
        args: [BigInt(tokenId)],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(\`Matured position claimed for NFT #\${tokenId}! Principal unlocked.\`);
      addToast('success', 'Bono Vencido Reclamado', \`Principal reembolsado\`);
      fetchData();
    } catch (err: any) {
      addLog(\`[Error] Claim matured failed: \${err.message || err}\`);
      addToast('error', 'Error Reclamo', err.message || 'Fallo al reclamar');
    }
  };

  const handleRagequit = async (tokenId: number) => {
    try {
      addLog(\`Executing Ragequit on NFT #\${tokenId} (30% penalty applied)...\`);
      const tx = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.VESTED_VAULT,
        abi: ABIS.VESTED_VAULT,
        functionName: 'ragequit',
        args: [BigInt(tokenId)],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(\`Ragequit executed for NFT #\${tokenId}. Liquidity returned minus penalty.\`);
      addToast('warning', 'Ragequit Ejecutado', 'Penalización 30% distribuida');
      fetchData();
    } catch (err: any) {
      addLog(\`[Error] Ragequit failed: \${err.message || err}\`);
      addToast('error', 'Error Ragequit', err.message || 'Fallo en ragequit');
    }
  };

  const handleCreateLoanOffer = async () => {
    try {
      addLog(\`Creating P2P loan offer for NFT #\${p2pTokenId}...\`);
      addToast('info', 'Oferta P2P', 'Aprobando NFT colateral...');
      const appHash = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.POSITION_NFT,
        abi: ABIS.POSITION_NFT,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.P2P_MARKET, BigInt(p2pTokenId)],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: appHash });

      const tx = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.P2P_MARKET,
        abi: ABIS.P2P_MARKET,
        functionName: 'createLoanOffer',
        args: [BigInt(p2pTokenId), parseEther(p2pBorrowAmount), BigInt(p2pInterestBps), BigInt(p2pDays)],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(\`P2P Loan offer created! NFT locked as collateral.\`);
      addToast('success', 'Oferta Creada', 'Préstamo disponible en el mercado');
      fetchData();
    } catch (err: any) {
      addLog(\`[Error] Loan offer creation failed: \${err.message || err}\`);
      addToast('error', 'Error Oferta P2P', err.message || 'Fallo al crear oferta');
    }
  };

  const handleAcceptLoan = async () => {
    try {
      addLog(\`Accepting P2P Loan #\${targetLoanId} with \${loanCollateral} USDC collateral...\`);
      addToast('info', 'Aceptar Préstamo', 'Aprobando colateral USDC...');
      const appHash = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.USDC,
        abi: ABIS.ERC20,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.P2P_MARKET, parseEther('1000000')],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: appHash });

      const tx = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.P2P_MARKET,
        abi: ABIS.P2P_MARKET,
        functionName: 'acceptLoanAndDepositCollateral',
        args: [BigInt(targetLoanId), parseEther(loanCollateral)],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(\`Loan #\${targetLoanId} accepted! Collateral deposited.\`);
      addToast('success', 'Préstamo Aceptado', 'Fondos transferidos');
      fetchData();
    } catch (err: any) {
      addLog(\`[Error] Accept loan failed: \${err.message || err}\`);
      addToast('error', 'Error Aceptar Préstamo', err.message || 'Fallo');
    }
  };

  const handleRepayLoan = async () => {
    try {
      addLog(\`Repaying P2P Loan #\${targetLoanId}...\`);
      const tx = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.P2P_MARKET,
        abi: ABIS.P2P_MARKET,
        functionName: 'repayLoan',
        args: [BigInt(targetLoanId)],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(\`Loan #\${targetLoanId} fully repaid! Collateral NFT returned.\`);
      addToast('success', 'Préstamo Reembolsado', 'NFT devuelto al propietario');
      fetchData();
    } catch (err: any) {
      addLog(\`[Error] Repay loan failed: \${err.message || err}\`);
      addToast('error', 'Error Reembolso', err.message || 'Fallo');
    }
  };

  const handleLiquidateLoan = async () => {
    try {
      addLog(\`Executing Auto-Liquidation on Loan #\${targetLoanId}...\`);
      const tx = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.P2P_MARKET,
        abi: ABIS.P2P_MARKET,
        functionName: 'liquidateLoan',
        args: [BigInt(targetLoanId)],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(\`Loan #\${targetLoanId} liquidated! NFT transferred to lender.\`);
      addToast('warning', 'Liquidación Ejecutada', 'NFT transferido al prestamista');
      fetchData();
    } catch (err: any) {
      addLog(\`[Error] Liquidation failed: \${err.message || err}\`);
      addToast('error', 'Error Liquidación', err.message || 'Fallo');
    }
  };

  const handleStake = async () => {
    try {
      addLog(\`Staking \${stakeAmount} ALPHA tokens...\`);
      addToast('info', 'Staking ALPHA', 'Aprobando tokens...');
      const appHash = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.TREASURY,
        abi: ABIS.ERC20,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.STAKING, parseEther(stakeAmount)],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: appHash });

      const tx = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.STAKING,
        abi: ABIS.STAKING,
        functionName: 'stake',
        args: [parseEther(stakeAmount)],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(\`Staked \${stakeAmount} ALPHA successfully!\`);
      addToast('success', 'Staking Exitoso', 'ALPHA bloqueado en pool de gobernanza');
      fetchData();
    } catch (err: any) {
      addLog(\`[Error] Stake failed: \${err.message || err}\`);
      addToast('error', 'Error Staking', err.message || 'Fallo');
    }
  };

  const handleUnstake = async () => {
    try {
      addLog(\`Unstaking \${stakeAmount} ALPHA tokens...\`);
      const tx = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.STAKING,
        abi: ABIS.STAKING,
        functionName: 'unstake',
        args: [parseEther(stakeAmount)],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(\`Unstaked \${stakeAmount} ALPHA successfully!\`);
      addToast('success', 'Unstake Exitoso', 'ALPHA liberado a billetera');
      fetchData();
    } catch (err: any) {
      addLog(\`[Error] Unstake failed: \${err.message || err}\`);
      addToast('error', 'Error Unstake', err.message || 'Fallo');
    }
  };

  const handleClaimYield = async () => {
    try {
      addLog(\`Claiming Real Yield via RealYieldRouter...\`);
      const tx = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.REAL_YIELD_ROUTER,
        abi: ABIS.REAL_YIELD_ROUTER,
        functionName: 'claimRealYield',
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(\`Real Yield claimed successfully!\`);
      addToast('success', 'Yield Reclamado', 'Rendimiento transferido');
      fetchData();
    } catch (err: any) {
      addLog(\`[Error] Claim yield failed: \${err.message || err}\`);
      addToast('error', 'Error Reclamo Yield', err.message || 'Fallo');
    }
  };

  const handleGaslessClaim = async () => {
    try {
      addLog('Iniciando reclamo gasless vía YieldStreamingVault...');
      const YIELD_VAULT_ADDRESS = (import.meta.env.VITE_YIELD_STREAMING_VAULT_ADDRESS || '') as \`0x\${string}\`;
      if (!YIELD_VAULT_ADDRESS) {
        addLog('[Aviso] VITE_YIELD_STREAMING_VAULT_ADDRESS no configurada.');
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
        args: [userAddress as \`0x\${string}\`],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(\`¡Yield reclamado con éxito desde YieldStreamingVault!\`);
      addToast('success', 'Gasless Claim', 'Rendimiento reclamado sin gas');
      fetchData();
    } catch (err: any) {
      addLog(\`[Error] Gasless claim failed: \${err.message || err}\`);
      addToast('error', 'Error Gasless Claim', err.message || 'Fallo');
    }
  };

  const handleSetPayoutPreference = async (pref: number) => {
    try {
      addLog(\`Setting payout preference to Option \${pref === 0 ? 'A (USDC)' : 'B (Reserve Asset)'}...\`);
      const tx = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.REAL_YIELD_ROUTER,
        abi: ABIS.REAL_YIELD_ROUTER,
        functionName: 'setPayoutPreference',
        args: [pref],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(\`Payout preference updated on-chain!\`);
      addToast('success', 'Preferencia Guardada', \`Opción \${pref === 0 ? 'A (USDC)' : 'B (WBTC/WETH)'}\`);
    } catch (err: any) {
      addLog(\`[Error] Set payout preference failed: \${err.message || err}\`);
    }
  };

  const handleUpdateOracle = async () => {
    if (!oraclePrice) return;
    try {
      addLog(\`Updating Oracle price feed...\`);
      const feedAddress = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.TREASURY,
        abi: ABIS.TREASURY,
        functionName: 'priceFeeds',
        args: [CONTRACT_ADDRESSES.USDC]
      }) as \`0x\${string}\`;

      const newPriceInt = BigInt(Math.round(parseFloat(oraclePrice) * 1e8));
      const tx = await walletClient.writeContract({
        address: feedAddress,
        abi: [{ name: 'setPrice', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'price_', type: 'int256' }], outputs: [] }] as const,
        functionName: 'setPrice',
        args: [newPriceInt],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(\`Oracle price updated to $\${oraclePrice}!\`);
      addToast('success', 'Oráculo Actualizado', \`Precio: $\${oraclePrice}\`);
      fetchData();
    } catch (err: any) {
      addLog(\`[Error] Oracle update failed: \${err.message || err}\`);
    }
  };

  const handleAdjustWeights = async () => {
    try {
      addLog('Initiating weight rebalance adjustment...');
      const s = BigInt(Math.round(parseFloat(newStablesWeight) * 100));
      const b = BigInt(Math.round(parseFloat(newWbtcWeight) * 100));
      const e = BigInt(Math.round(parseFloat(newWethWeight) * 100));
      const a = BigInt(Math.round(parseFloat(newAltsWeight) * 100));

      const tx = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.TREASURY,
        abi: ABIS.TREASURY,
        functionName: 'adjustWeights',
        args: [{ stablecoins: s, wbtc: b, weth: e, alphaProtocolStaking: a }],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog('Weights adjusted successfully! Treasury rebalanced on-chain.');
      addToast('success', 'Pesos Rebalanceados', 'Tesorería ajustada on-chain');
      fetchData();
    } catch (err: any) {
      addLog(\`[Error] Rebalance failed: \${err.message || err}\`);
    }
  };

  const handleSimulateDrop = async () => {
    try {
      addLog('Triggering deviation check on-chain...');
      const tx = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.CIRCUIT_BREAKER,
        abi: ABIS.CIRCUIT_BREAKER,
        functionName: 'checkAssetDeviation',
        args: [CONTRACT_ADDRESSES.USDC],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog('Deviation check executed on-chain.');
      addToast('info', 'Circuit Breaker', 'Desviación evaluada');
      fetchData();
    } catch (err: any) {
      addLog(\`[Error] Deviation check failed: \${err.message || err}\`);
    }
  };

  const handleResetBreaker = async () => {
    try {
      addLog('Sending governance reset transaction to CircuitBreaker...');
      const tx = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.CIRCUIT_BREAKER,
        abi: ABIS.CIRCUIT_BREAKER,
        functionName: 'resetBreaker',
        args: [CONTRACT_ADDRESSES.USDC],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog('Circuit Breaker reset on-chain! Operations restored.');
      addToast('success', 'Breaker Reiniciado', 'Operativa restaurada');
      fetchData();
    } catch (err: any) {
      addLog(\`[Error] Reset failed: \${err.message || err}\`);
    }
  };

  const handleExecuteTWAP = async () => {
    if (!injectionAmount) return;
    try {
      addLog(\`Initiating TWAP Corporate Buyback with $\${injectionAmount} USDC...\`);
      const amountWei = parseEther(injectionAmount);

      const appHash = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.USDC,
        abi: ABIS.ERC20,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.CORPORATE_CONTRIBUTION, amountWei],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: appHash });

      const tx = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.CORPORATE_CONTRIBUTION,
        abi: ABIS.CORPORATE_CONTRIBUTION,
        functionName: 'createTWAPOrder',
        args: [amountWei, BigInt(5), BigInt(300)],
        account
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      addLog(\`TWAP Buyback order created!\`);
      addToast('success', 'TWAP Creado', 'Orden de compra ejecutada');
      setInjectionAmount('');
      fetchData();
    } catch (err: any) {
      addLog(\`[Error] TWAP Buyback failed: \${err.message || err}\`);
    }
  };

  const handleResetBlockchain = async () => {
    try {
      addLog(\`[Reset 🔄] Ejecutando reinicio del entorno de prueba...\`);
      if (snapshotId) {
        await (publicClient.request as any)({ method: 'evm_revert', params: [snapshotId] });
        const newSnap = await (publicClient.request as any)({ method: 'evm_snapshot', params: [] });
        setSnapshotId(newSnap);
      } else {
        await (publicClient.request as any)({ method: 'anvil_reset', params: [] });
      }
      addLog(\`[Reset 🔄] Entorno reiniciado con éxito!\`);
      addToast('info', 'Reset Anvil', 'Blockchain restaurada desde snapshot');
      fetchData();
    } catch (err: any) {
      addLog(\`[Error Reset] Fallo al reiniciar entorno: \${err.message || err}\`);
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      <NotificationToast toasts={toasts} onDismiss={handleDismissToast} />

      <Header
        navValue={navValue}
        porRatio={porRatio}
        blockDateStr={blockDateStr}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeKey={activeKey}
        ADMIN_KEY={ADMIN_KEY}
        USER_KEY={USER_KEY}
        onSwitchRole={handleSwitchRole}
        walletConnected={walletConnected}
        userAddress={userAddress}
        circuitBreakerFrozen={circuitBreakerFrozen}
      />

      {activeTab === 'client' ? (
        <>
          <TreasuryDashboard
            porAssets={porAssets}
            porLiabilities={porLiabilities}
            porRatio={porRatio}
            porBreakdown={porBreakdown}
            targetWeights={targetWeights}
            usdcBalance={usdcBalance}
            sharesBalance={sharesBalance}
            depositAmount={depositAmount}
            setDepositAmount={setDepositAmount}
            redeemAmount={redeemAmount}
            setRedeemAmount={setRedeemAmount}
            onDeposit={handleDeposit}
            onRedeem={handleRedeem}
            onFaucetUSDC={handleFaucetUSDC}
            onAuditPoR={handleAuditPoR}
          />

          <VestedVaults
            bondPrincipal={bondPrincipal}
            setBondPrincipal={setBondPrincipal}
            bondLockYears={bondLockYears}
            setBondLockYears={setBondLockYears}
            bondReferrer={bondReferrer}
            setBondReferrer={setBondReferrer}
            onBuyBond={handleBuyBond}
            userPositions={userPositions}
            onClaimMatured={handleClaimMatured}
            onRagequit={handleRagequit}
          />

          <P2PMarketplace
            p2pTokenId={p2pTokenId}
            setP2pTokenId={setP2pTokenId}
            p2pBorrowAmount={p2pBorrowAmount}
            setP2pBorrowAmount={setP2pBorrowAmount}
            p2pInterestBps={p2pInterestBps}
            setP2pInterestBps={setP2pInterestBps}
            p2pDays={p2pDays}
            setP2pDays={setP2pDays}
            onCreateLoanOffer={handleCreateLoanOffer}
            targetLoanId={targetLoanId}
            setTargetLoanId={setTargetLoanId}
            loanCollateral={loanCollateral}
            setLoanCollateral={setLoanCollateral}
            onAcceptLoan={handleAcceptLoan}
            onRepayLoan={handleRepayLoan}
            onLiquidateLoan={handleLiquidateLoan}
          />
        </>
      ) : (
        <>
          <GovernanceStakingUI
            stakedBalance={stakedBalance}
            claimableYield={claimableYield}
            stakeAmount={stakeAmount}
            setStakeAmount={setStakeAmount}
            payoutPref={payoutPref}
            setPayoutPref={setPayoutPref}
            onStake={handleStake}
            onUnstake={handleUnstake}
            onClaimYield={handleClaimYield}
            onGaslessClaim={handleGaslessClaim}
            onSetPayoutPreference={handleSetPayoutPreference}
          />

          <AdminControlPanel
            oraclePrice={oraclePrice}
            setOraclePrice={setOraclePrice}
            onUpdateOracle={handleUpdateOracle}
            newStablesWeight={newStablesWeight}
            setNewStablesWeight={setNewStablesWeight}
            newWbtcWeight={newWbtcWeight}
            setNewWbtcWeight={setNewWbtcWeight}
            newWethWeight={newWethWeight}
            setNewWethWeight={setNewWethWeight}
            newAltsWeight={newAltsWeight}
            setNewAltsWeight={setNewAltsWeight}
            onAdjustWeights={handleAdjustWeights}
            circuitBreakerFrozen={circuitBreakerFrozen}
            onSimulateDrop={handleSimulateDrop}
            onResetBreaker={handleResetBreaker}
            injectionAmount={injectionAmount}
            setInjectionAmount={setInjectionAmount}
            onExecuteTWAP={handleExecuteTWAP}
            onResetBlockchain={handleResetBlockchain}
          />
        </>
      )}

      <ActivityLog logs={logs} />
    </div>
  );
}
\`;
console.log('Part 3 appended');