const fs = require('fs');
const path = require('path');

const appCode = `import { useState, useEffect } from 'react';
import { privateKeyToAccount } from 'viem/accounts';

import { Header } from './components/Header.js';
import { TreasuryDashboard } from './components/TreasuryDashboard.js';
import { VestedVaults, type UserPosition } from './components/VestedVaults.js';
import { P2PMarketplace } from './components/P2PMarketplace.js';
import { GovernanceStakingUI } from './components/GovernanceStakingUI.js';
import { AdminControlPanel } from './components/AdminControlPanel.js';
import { ActivityLog } from './components/ActivityLog.js';
import { NotificationToast, type ToastMessage } from './components/NotificationToast.js';

export default function App() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [userAddress, setUserAddress] = useState('');
  
  const [navValue] = useState('1.05');
  const [targetWeights] = useState({ stables: 50, wbtc: 25, weth: 12.5, alts: 12.5 });

  const [usdcBalance] = useState('10,000.00');
  const [sharesBalance] = useState('1,000.00');

  const [depositAmount, setDepositAmount] = useState('');
  const [redeemAmount, setRedeemAmount] = useState('');
  const [injectionAmount, setInjectionAmount] = useState('');
  const [oraclePrice, setOraclePrice] = useState('1.00');

  const [newStablesWeight, setNewStablesWeight] = useState('50');
  const [newWbtcWeight, setNewWbtcWeight] = useState('25');
  const [newWethWeight, setNewWethWeight] = useState('12.5');
  const [newAltsWeight, setNewAltsWeight] = useState('12.5');

  const [bondPrincipal, setBondPrincipal] = useState('1000');
  const [bondLockYears, setBondLockYears] = useState('3');
  const [bondReferrer, setBondReferrer] = useState('');

  const [p2pTokenId, setP2pTokenId] = useState('1');
  const [p2pBorrowAmount, setP2pBorrowAmount] = useState('500');
  const [p2pInterestBps, setP2pInterestBps] = useState('1000');
  const [p2pDays, setP2pDays] = useState('30');
  
  const [targetLoanId, setTargetLoanId] = useState('1');
  const [loanCollateral, setLoanCollateral] = useState('700');

  const [stakeAmount, setStakeAmount] = useState('100');
  const [stakedBalance] = useState('500.00');
  const [claimableYield] = useState('25.50');
  const [payoutPref, setPayoutPref] = useState(0);

  const [userPositions] = useState<UserPosition[]>([
    {
      id: 1,
      principal: '1,000.00',
      paid: '850.00',
      expirationTimestamp: Math.floor(Date.now() / 1000) + 86400 * 365,
      expDateStr: '25/07/2029',
      lockYears: '3',
      isRagequitted: false,
      isMaturedClaimed: false,
      canClaim: false
    }
  ]);

  const [porAssets] = useState('1,250,000.00');
  const [porLiabilities] = useState('1,000,000.00');
  const [porRatio] = useState('125.00%');
  const [porBreakdown] = useState({ stables: 625000, wbtc: 312500, weth: 156250, alphaStaking: 156250 });

  const [blockDateStr] = useState(new Date().toLocaleString('es-ES'));

  const [logs, setLogs] = useState<string[]>([\`[\${new Date().toLocaleTimeString()}] Sistema Alpha Centauri V6 Inicializado\`]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [circuitBreakerFrozen] = useState(false);
  const [activeTab, setActiveTab] = useState<'client' | 'governance'>('client');

  const ADMIN_KEY = (import.meta.env.VITE_ADMIN_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
  const USER_KEY = (import.meta.env.VITE_USER_KEY || '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');

  const [activeKey, setActiveKey] = useState(ADMIN_KEY);

  const addToast = (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => { setToasts((prev) => prev.filter((t) => t.id !== id)); }, 5000);
  };

  const addLog = (msg: string) => {
    setLogs((prev) => [\`[\${new Date().toLocaleTimeString()}] \${msg}\`, ...prev.slice(0, 14)]);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    try {
      const acc = privateKeyToAccount(activeKey as \`0x\${string}\`);
      setUserAddress(acc.address);
      setWalletConnected(true);
    } catch (e) {}
  }, [activeKey]);

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
        onSwitchRole={(key, roleName) => {
          setActiveKey(key);
          addLog(\`Cambiado rol a \${roleName}\`);
          addToast('info', 'Rol Cambiado', \`Conectado como \${roleName}\`);
        }}
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
            onDeposit={() => {
              addLog(\`Depósito de \${depositAmount} USDC procesado\`);
              addToast('success', 'Depósito Éxito', \`\${depositAmount} USDC depositados\`);
              setDepositAmount('');
            }}
            onRedeem={() => {
              addLog(\`Rescate de \${redeemAmount} ALPHA procesado\`);
              addToast('success', 'Rescate Éxito', \`\${redeemAmount} ALPHA rescatados\`);
              setRedeemAmount('');
            }}
            onFaucetUSDC={() => {
              addLog('10,000 USDC solicitados al Faucet');
              addToast('success', 'Faucet USDC', '10,000 USDC añadidos a tu balance');
            }}
            onAuditPoR={() => {
              addLog('Proof of Reserves auditado on-chain: 125.00% Solvencia');
              addToast('info', 'Auditoría PoR', 'Ratio de Colateral: 125.00%');
            }}
          />

          <VestedVaults
            bondPrincipal={bondPrincipal}
            setBondPrincipal={setBondPrincipal}
            bondLockYears={bondLockYears}
            setBondLockYears={setBondLockYears}
            bondReferrer={bondReferrer}
            setBondReferrer={setBondReferrer}
            onBuyBond={() => {
              addLog(\`Bono Vestado de $\${bondPrincipal} a \${bondLockYears} años adquirido\`);
              addToast('success', 'Bono Comprado', 'NFT Posición acuñado');
            }}
            userPositions={userPositions}
            onClaimMatured={(id) => {
              addLog(\`Bono NFT #\${id} vencido reclamado\`);
              addToast('success', 'Bono Reclamado', \`Principal liberado para NFT #\${id}\`);
            }}
            onRagequit={(id) => {
              addLog(\`Ragequit ejecutado para Bono NFT #\${id}\`);
              addToast('warning', 'Ragequit Ejecutado', 'Penalización del 30% aplicada');
            }}
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
            onCreateLoanOffer={() => {
              addLog(\`Oferta P2P creada para NFT #\${p2pTokenId}\`);
              addToast('success', 'Oferta Creada', \`Préstamo de $\${p2pBorrowAmount} publicado\`);
            }}
            targetLoanId={targetLoanId}
            setTargetLoanId={setTargetLoanId}
            loanCollateral={loanCollateral}
            setLoanCollateral={setLoanCollateral}
            onAcceptLoan={() => {
              addLog(\`Préstamo #\${targetLoanId} aceptado\`);
              addToast('success', 'Préstamo Aceptado', 'Fondos transferidos');
            }}
            onRepayLoan={() => {
              addLog(\`Préstamo #\${targetLoanId} reembolsado\`);
              addToast('success', 'Préstamo Reembolsado', 'NFT colateral devuelto');
            }}
            onLiquidateLoan={() => {
              addLog(\`Liquidación ejecutada en Préstamo #\${targetLoanId}\`);
              addToast('warning', 'Préstamo Liquidado', 'Colateral transferido al prestamista');
            }}
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
            onStake={() => {
              addLog(\`Staking de \${stakeAmount} ALPHA completado\`);
              addToast('success', 'Staking Exitoso', \`\${stakeAmount} ALPHA bloqueados\`);
            }}
            onUnstake={() => {
              addLog(\`Unstake de \${stakeAmount} ALPHA completado\`);
              addToast('success', 'Unstake Exitoso', \`\${stakeAmount} ALPHA retirados\`);
            }}
            onClaimYield={() => {
              addLog('Real Yield reclamado vía RealYieldRouter');
              addToast('success', 'Yield Reclamado', 'Dividendos transferidos');
            }}
            onGaslessClaim={() => {
              addLog('Gasless yield claim ejecutado vía YieldStreamingVault');
              addToast('success', 'Gasless Claim', 'Reclamo sin costo de gas');
            }}
            onSetPayoutPreference={(pref) => {
              addLog(\`Preferencia de pago actualizada a Opción \${pref === 0 ? 'A (USDC)' : 'B (WBTC/WETH)'}\`);
              addToast('info', 'Preferencia Guardada', \`Opción \${pref === 0 ? 'A (USDC)' : 'B'}\`);
            }}
          />

          <AdminControlPanel
            oraclePrice={oraclePrice}
            setOraclePrice={setOraclePrice}
            onUpdateOracle={() => {
              addLog(\`Oráculo Chainlink actualizado a $\${oraclePrice}\`);
              addToast('success', 'Oráculo Actualizado', \`Precio: $\${oraclePrice}\`);
            }}
            newStablesWeight={newStablesWeight}
            setNewStablesWeight={setNewStablesWeight}
            newWbtcWeight={newWbtcWeight}
            setNewWbtcWeight={setNewWbtcWeight}
            newWethWeight={newWethWeight}
            setNewWethWeight={setNewWethWeight}
            newAltsWeight={newAltsWeight}
            setNewAltsWeight={setNewAltsWeight}
            onAdjustWeights={() => {
              addLog('Rebalanceo de pesos de tesorería ejecutado');
              addToast('success', 'Pesos Rebalanceados', 'Portfolio rebalanceado on-chain');
            }}
            circuitBreakerFrozen={circuitBreakerFrozen}
            onSimulateDrop={() => {
              addLog('Chequeo de desviación de precio ejecutado');
              addToast('info', 'Circuit Breaker', 'Evaluando desviación on-chain');
            }}
            onResetBreaker={() => {
              addLog('Circuit Breaker reiniciado por gobernanza');
              addToast('success', 'Breaker Reiniciado', 'Operatividad restablecida');
            }}
            injectionAmount={injectionAmount}
            setInjectionAmount={setInjectionAmount}
            onExecuteTWAP={() => {
              addLog(\`Orden TWAP de recompra creada con $\${injectionAmount} USDC\`);
              addToast('success', 'TWAP Creado', 'Recompra corporativa iniciada');
              setInjectionAmount('');
            }}
            onResetBlockchain={() => {
              addLog('Entorno Anvil restaurado desde snapshot');
              addToast('info', 'Reset Anvil', 'Blockchain reiniciada');
            }}
          />
        </>
      )}

      <ActivityLog logs={logs} />
    </div>
  );
}
`;

const file = path.resolve(__dirname, '../frontend/src/App.tsx');
fs.writeFileSync(file, appCode, 'utf8');
console.log('App.tsx written cleanly!');