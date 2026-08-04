import { useState } from 'react';
import { useWeb3State } from './hooks/useWeb3State.js';
import { useTreasuryActions } from './hooks/useTreasuryActions.js';
import { useVestedVaultActions } from './hooks/useVestedVaultActions.js';
import { useP2PLendingActions } from './hooks/useP2PLendingActions.js';
import { useStakingActions } from './hooks/useStakingActions.js';
import { useAdminActions } from './hooks/useAdminActions.js';
import { useTransactionConfirm } from './hooks/useTransactionConfirm.js';

import { Header } from './components/Header.js';
import { TreasuryDashboard } from './components/TreasuryDashboard.js';
import { VestedVaults } from './components/VestedVaults.js';
import { P2PMarketplace } from './components/P2PMarketplace.js';
import { GovernanceStakingUI } from './components/GovernanceStakingUI.js';
import { AdminControlPanel } from './components/AdminControlPanel.js';
import { GovernanceCommandCenter } from './components/GovernanceCommandCenter.js';
import { ActivityLog } from './components/ActivityLog.js';
import { NotificationToast, type ToastMessage } from './components/NotificationToast.js';
import { ReferralModal } from './components/ReferralModal.js';
import { TransactionConfirmModal } from './components/TransactionConfirmModal.js';
import { ProtocolAnalyticsCharts } from './components/ProtocolAnalyticsCharts.js';
import { ApyBreakdownModal, calculateProtocolApyMath } from './components/ApyBreakdownModal.js';

export default function App() {
  const [activeTab, setActiveTab] = useState<'client' | 'governance'>('client');
  const [isReferralOpen, setIsReferralOpen] = useState(false);
  const [isApyModalOpen, setIsApyModalOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => { setToasts((prev) => prev.filter((t) => t.id !== id)); }, 5000);
  };

  const addLog = (msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 14)]);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Web3 State & Polling Hook
  const web3 = useWeb3State();

  // DeFi Pre-Flight Transaction Review Modal Hook
  const txConfirm = useTransactionConfirm();

  const handleSwitchRole = (key: `0x${string}`, roleName: string) => {
    web3.setActiveKey(key);
    if (key !== web3.ADMIN_KEY) {
      setActiveTab('client');
    }
    addLog(`Cambiado rol conectado a ${roleName}`);
    addToast('info', 'Rol Cambiado', `Conectado como ${roleName}`);
  };

  // Action Hooks with Pre-Flight Modal Integration
  const treasury = useTreasuryActions({
    activeKey: web3.activeKey,
    userAddress: web3.userAddress,
    addLog,
    addToast,
    fetchData: web3.fetchData,
    requestConfirmation: txConfirm.requestConfirmation,
    navPerShareNum: web3.navPerShareNum
  });

  const vestedVault = useVestedVaultActions({
    activeKey: web3.activeKey,
    addLog,
    addToast,
    fetchData: web3.fetchData,
    requestConfirmation: txConfirm.requestConfirmation
  });

  const p2p = useP2PLendingActions({
    activeKey: web3.activeKey,
    adminKey: web3.ADMIN_KEY,
    addLog,
    addToast,
    fetchData: web3.fetchData,
    requestConfirmation: txConfirm.requestConfirmation
  });

  const staking = useStakingActions({
    activeKey: web3.activeKey,
    account: web3.account,
    userAddress: web3.userAddress,
    addLog,
    addToast,
    fetchData: web3.fetchData,
    requestConfirmation: txConfirm.requestConfirmation
  });

  const admin = useAdminActions({
    activeKey: web3.activeKey,
    snapshotId: web3.snapshotId,
    setSnapshotId: web3.setSnapshotId,
    addLog,
    addToast,
    fetchData: web3.fetchData,
    requestConfirmation: txConfirm.requestConfirmation
  });

  const activeLoansSum = web3.loansList.reduce((acc, loan) => {
    return acc + (loan.state === 1 ? parseFloat(loan.borrowAmount.replace(/,/g, '')) || 0 : 0);
  }, 0);

  const claimableYieldVal = parseFloat(web3.claimableYield.replace(/,/g, '')) || 0;

  // Gross cashflow = total principal in active vested bonds (real data, no hardcode)
  const grossCashflowUsd = web3.userPositions.reduce((acc, pos) => {
    return acc + (!pos.isRagequitted ? parseFloat(pos.principal || '0') || 0 : 0);
  }, 0);

  // Compute exact dynamic real-time APY from live Treasury reserve allocation (100% synchronized)
  const apyCalculated = calculateProtocolApyMath(
    web3.porAssets,
    web3.porBreakdown,
    web3.stakedBalance,
    grossCashflowUsd,
    activeLoansSum,
    claimableYieldVal
  );
  const liveApyStr = `${apyCalculated.totalApyPct}%`;

  return (
    <div style={{ minHeight: '100vh', padding: '1.5rem', background: 'radial-gradient(ellipse at top, #1e1b4b 0%, #0f172a 100%)', color: '#fff' }}>
      <NotificationToast toasts={toasts} onDismiss={handleDismissToast} />

      <ReferralModal
        isOpen={isReferralOpen}
        onClose={() => setIsReferralOpen(false)}
        userAddress={web3.userAddress}
        onCopySuccess={() => addToast('success', 'Copiado', 'Enlace de referido copiado')}
      />

      <TransactionConfirmModal
        isOpen={txConfirm.isOpen}
        onClose={txConfirm.handleClose}
        onConfirm={txConfirm.handleConfirm}
        txDetails={txConfirm.txDetails}
        isSubmitting={txConfirm.isSubmitting}
      />

      <Header
        navValue={web3.navValue}
        porRatio={web3.porRatio}
        alphaApy={liveApyStr}
        blockDateStr={web3.blockDateStr}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeKey={web3.activeKey}
        ADMIN_KEY={web3.ADMIN_KEY}
        USER_KEY={web3.USER_KEY}
        onSwitchRole={handleSwitchRole}
        walletConnected={web3.walletConnected}
        userAddress={web3.userAddress}
        circuitBreakerFrozen={web3.circuitBreakerFrozen}
        onOpenReferral={() => setIsReferralOpen(true)}
        onOpenApyModal={() => setIsApyModalOpen(true)}
      />

      <ApyBreakdownModal
        isOpen={isApyModalOpen}
        onClose={() => setIsApyModalOpen(false)}
        porAssets={web3.porAssets}
        porBreakdown={web3.porBreakdown}
        stakedBalance={web3.stakedBalance}
        grossCashflowUsd={grossCashflowUsd}
        activeLoansUsd={activeLoansSum}
        claimableYieldUsd={claimableYieldVal}
      />

      {activeTab === 'client' ? (
        <>
          <ProtocolAnalyticsCharts
            porAssets={web3.porAssets}
            porLiabilities={web3.porLiabilities}
            porRatio={web3.porRatio}
            porBreakdown={web3.porBreakdown}
            stakedBalance={web3.stakedBalance}
            claimableYield={web3.claimableYield}
            userPositions={web3.userPositions}
            loansList={web3.loansList}
          />

          <TreasuryDashboard
            porAssets={web3.porAssets}
            porLiabilities={web3.porLiabilities}
            porRatio={web3.porRatio}
            porBreakdown={web3.porBreakdown}

            usdcBalance={web3.usdcBalance}
            sharesBalance={web3.sharesBalance}
            depositAmount={treasury.depositAmount}
            setDepositAmount={treasury.setDepositAmount}
            redeemAmount={treasury.redeemAmount}
            setRedeemAmount={treasury.setRedeemAmount}
            onDeposit={treasury.handleDeposit}
            onRedeem={treasury.handleRedeem}
            onFaucetUSDC={treasury.handleFaucetUSDC}
            onAuditPoR={treasury.handleAuditPoR}
            isAdmin={web3.activeKey === web3.ADMIN_KEY}
            loansList={web3.loansList}
          />

          <VestedVaults
            bondPrincipal={vestedVault.bondPrincipal}
            setBondPrincipal={vestedVault.setBondPrincipal}
            bondLockYears={vestedVault.bondLockYears}
            setBondLockYears={vestedVault.setBondLockYears}
            bondReferrer={vestedVault.bondReferrer}
            setBondReferrer={vestedVault.setBondReferrer}
            onBuyBond={vestedVault.handleBuyBond}
            userPositions={web3.userPositions}
            onClaimMatured={vestedVault.handleClaimMatured}
            onRagequit={vestedVault.handleRagequit}
            onOpenReferral={() => setIsReferralOpen(true)}
          />

          <GovernanceStakingUI
            stakedBalance={web3.stakedBalance}
            claimableYield={web3.claimableYield}
            totalBurnedTokens={web3.totalBurnedTokens}
            circulatingSupply={web3.circulatingSupply}
            totalStakedSupply={web3.totalStakedSupply}
            communityStakedSupply={web3.communityStakedSupply}
            corporateStakedSupply={web3.corporateStakedSupply}
            treasuryStakedSupply={web3.treasuryStakedSupply}
            stakingRatioPct={web3.stakingRatioPct}
            navPerShareUSD={web3.navPerShareUSD}
            stakeAmount={staking.stakeAmount}
            setStakeAmount={staking.setStakeAmount}
            payoutPref={staking.payoutPref}
            setPayoutPref={staking.setPayoutPref}
            onStake={staking.handleStake}
            onUnstake={staking.handleUnstake}
            onClaimYield={staking.handleClaimYield}
            onGaslessClaim={staking.handleGaslessClaim}
            onSetPayoutPreference={staking.handleSetPayoutPreference}
          />

          <P2PMarketplace
            p2pTokenId={p2p.p2pTokenId}
            setP2pTokenId={p2p.setP2pTokenId}
            p2pBorrowAmount={p2p.p2pBorrowAmount}
            setP2pBorrowAmount={p2p.setP2pBorrowAmount}
            p2pInterestBps={p2p.p2pInterestBps}
            setP2pInterestBps={p2p.setP2pInterestBps}
            p2pDays={p2p.p2pDays}
            setP2pDays={p2p.setP2pDays}
            onCreateLoanOffer={p2p.handleCreateLoanOffer}
            targetLoanId={p2p.targetLoanId}
            setTargetLoanId={p2p.setTargetLoanId}
            loanCollateral={p2p.loanCollateral}
            setLoanCollateral={p2p.setLoanCollateral}
            onAcceptLoan={p2p.handleAcceptLoan}
            onRepayLoan={p2p.handleRepayLoan}
            onLiquidateLoan={p2p.handleLiquidateLoan}
            loansList={web3.loansList}
            userPositions={web3.userPositions}
            userAddress={web3.userAddress}
            onAcceptLoanById={p2p.handleAcceptLoanById}
            onCancelLoanOffer={p2p.handleCancelLoanOffer}
            onRepayLoanById={p2p.handleRepayLoanById}
            onLiquidateLoanById={p2p.handleLiquidateLoanById}
            onBorrowFromTreasury={p2p.handleBorrowFromTreasury}
          />
        </>
      ) : web3.activeKey !== web3.ADMIN_KEY ? (
        <div className="restricted-access-card">
          <div className="restricted-access-icon">🔒</div>
          <h3 className="restricted-access-title">Acceso Restringido: Módulo Exclusivo de Administrador</h3>
          <p className="restricted-access-desc">
            El Panel de Gobernanza y Administración (rebalanceo de pesos de tesorería, feeds de oráculos, órdenes TWAP de recompra y reset de emergencia) está estrictamente restringido a la cuenta <strong>Owner / Admin del Protocolo</strong>.
          </p>
          <div className="restricted-access-actions">
            <button className="btn-primary" onClick={() => setActiveTab('client')}>
              💎 Volver al Portal Cliente
            </button>
            <button className="btn-primary" onClick={() => handleSwitchRole(web3.ADMIN_KEY as `0x${string}`, 'Owner/Admin')}>
              👑 Cambiar a Rol Admin / Owner
            </button>
          </div>
        </div>
      ) : (
        <>
          <GovernanceStakingUI
            stakedBalance={web3.stakedBalance}
            claimableYield={web3.claimableYield}
            totalBurnedTokens={web3.totalBurnedTokens}
            circulatingSupply={web3.circulatingSupply}
            totalStakedSupply={web3.totalStakedSupply}
            communityStakedSupply={web3.communityStakedSupply}
            corporateStakedSupply={web3.corporateStakedSupply}
            treasuryStakedSupply={web3.treasuryStakedSupply}
            stakingRatioPct={web3.stakingRatioPct}
            navPerShareUSD={web3.navPerShareUSD}
            stakeAmount={staking.stakeAmount}
            setStakeAmount={staking.setStakeAmount}
            payoutPref={staking.payoutPref}
            setPayoutPref={staking.setPayoutPref}
            onStake={staking.handleStake}
            onUnstake={staking.handleUnstake}
            onClaimYield={staking.handleClaimYield}
            onGaslessClaim={staking.handleGaslessClaim}
            onSetPayoutPreference={staking.handleSetPayoutPreference}
          />

          <GovernanceCommandCenter
            web3Data={web3}
            adminActions={admin}
            isAdmin={web3.activeKey === web3.ADMIN_KEY}
          />

          <AdminControlPanel
            oraclePrice={admin.oraclePrice}
            setOraclePrice={admin.setOraclePrice}
            onUpdateOracle={admin.handleUpdateOracle}
            newStablesWeight={admin.newStablesWeight}
            setNewStablesWeight={admin.setNewStablesWeight}
            newWbtcWeight={admin.newWbtcWeight}
            setNewWbtcWeight={admin.setNewWbtcWeight}
            newWethWeight={admin.newWethWeight}
            setNewWethWeight={admin.setNewWethWeight}
            newAltsWeight={admin.newAltsWeight}
            setNewAltsWeight={admin.setNewAltsWeight}
            onAdjustWeights={admin.handleAdjustWeights}
            circuitBreakerFrozen={web3.circuitBreakerFrozen}
            onSimulateDrop={admin.handleSimulateDrop}
            onResetBreaker={admin.handleResetBreaker}
            injectionAmount={admin.injectionAmount}
            setInjectionAmount={admin.setInjectionAmount}
            onExecuteTWAP={admin.handleExecuteTWAP}
            onResetBlockchain={admin.handleResetBlockchain}
          />
        </>
      )}

      <ActivityLog logs={logs} />

      <ReferralModal
        isOpen={isReferralOpen}
        onClose={() => setIsReferralOpen(false)}
        userAddress={web3.userAddress}
        onCopySuccess={() => addToast('success', '¡Enlace Copiado!', 'Tu enlace de referido ha sido copiado al portapapeles.')}
      />
    </div>
  );
}
