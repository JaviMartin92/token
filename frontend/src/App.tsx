import { useState, Suspense, lazy } from 'react';

// Fragmented Global State
import { useGlobalState } from './hooks/useGlobalState.js';
import { useTreasuryMetrics } from './hooks/useTreasuryMetrics.js';
import { useUniversalYield } from './hooks/useUniversalYield.js';
import { useGovernanceStaking } from './hooks/useGovernanceStaking.js';
import { useP2PMarketplace } from './hooks/useP2PMarketplace.js';
import { useUserPortfolio } from './hooks/useUserPortfolio.js';

// Action Hooks
import { useTreasuryActions } from './hooks/useTreasuryActions.js';
import { useVestedVaultActions } from './hooks/useVestedVaultActions.js';
import { useP2PLendingActions } from './hooks/useP2PLendingActions.js';
import { useStakingActions } from './hooks/useStakingActions.js';
import { useAdminActions } from './hooks/useAdminActions.js';
import { useTransactionConfirm } from './hooks/useTransactionConfirm.js';

import { useQueryClient } from '@tanstack/react-query';

// Always loaded components (Header & Modals)
import { Header } from './components/Header.js';
import { NotificationToast, type ToastMessage } from './components/NotificationToast.js';
import { ReferralModal } from './components/ReferralModal.js';
import { TransactionConfirmModal } from './components/TransactionConfirmModal.js';
import { ApyBreakdownModal } from './components/ApyBreakdownModal.js';
import { CONTRACT_ADDRESSES } from './utils/web3.js';
import { NetworkGuard } from './components/NetworkGuard.js';
import { LegalDisclaimerFooter } from './components/common/LegalDisclaimerFooter.js';

// Auto-recovering lazy import helper for seamless SPA chunk cache invalidation
const lazyWithRetry = (componentImport: () => Promise<any>) =>
  lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      // Chunk hash changed due to fresh deploy; force reload once to fetch latest bundles
      const reloaded = sessionStorage.getItem('chunk_reload');
      if (!reloaded) {
        sessionStorage.setItem('chunk_reload', 'true');
        window.location.reload();
        return { default: () => null };
      }
      sessionStorage.removeItem('chunk_reload');
      throw error;
    }
  });

// Lazy-loaded routes / views
const TreasuryDashboard = lazyWithRetry(() => import('./components/TreasuryDashboard.js').then(m => ({ default: m.TreasuryDashboard })));
const VestedVaults = lazyWithRetry(() => import('./components/VestedVaults.js').then(m => ({ default: m.VestedVaults })));
const P2PMarketplace = lazyWithRetry(() => import('./components/P2PMarketplace.js').then(m => ({ default: m.P2PMarketplace })));
const GovernanceStakingUI = lazyWithRetry(() => import('./components/GovernanceStakingUI.js').then(m => ({ default: m.GovernanceStakingUI })));
const MetricsDashboard = lazyWithRetry(() => import('./components/MetricsDashboard.js').then(m => ({ default: m.MetricsDashboard })));
const AdminControlPanel = lazyWithRetry(() => import('./components/AdminControlPanel.js').then(m => ({ default: m.AdminControlPanel })));
const GovernanceCommandCenter = lazyWithRetry(() => import('./components/GovernanceCommandCenter.js').then(m => ({ default: m.GovernanceCommandCenter })));
const ActivityLog = lazyWithRetry(() => import('./components/ActivityLog.js').then(m => ({ default: m.ActivityLog })));

// Loading Fallback Component
import { Skeleton } from './components/Skeleton.js';

const ViewLoader = () => (
  <div className="p-8 w-full max-w-7xl mx-auto space-y-6">
    <Skeleton className="h-12 w-1/3 mb-8" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Skeleton className="h-32" count={3} />
    </div>
    <Skeleton className="h-64 mt-8" />
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState<'client' | 'metrics' | 'governance'>('client');
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

  // 1. Hooks React Query
  const global = useGlobalState();
  const treasuryMetrics = useTreasuryMetrics();
  const universalYield = useUniversalYield();
  const stakingMetrics = useGovernanceStaking();
  const p2pMarket = useP2PMarketplace();
  const portfolio = useUserPortfolio(global.userAddress);

  const queryClient = useQueryClient();

  // 2. Transacciones y Acciones
  const txConfirm = useTransactionConfirm();

  const handleFetchData = async () => {
    await queryClient.invalidateQueries();
  };

  const treasury = useTreasuryActions({
    activeKey: global.activeKey,
    userAddress: global.userAddress || '',
    addLog,
    addToast,
    fetchData: handleFetchData, 
    requestConfirmation: txConfirm.requestConfirmation,
    navPerShareNum: treasuryMetrics.navPerShareNum
  });

  const vestedVault = useVestedVaultActions({
    activeKey: global.activeKey,
    addLog,
    addToast,
    fetchData: handleFetchData,
    requestConfirmation: txConfirm.requestConfirmation
  });

  const p2p = useP2PLendingActions({
    activeKey: global.activeKey,
    adminKey: global.activeKey,
    userAddress: global.userAddress || '',
    addLog,
    addToast,
    fetchData: handleFetchData,
    requestConfirmation: txConfirm.requestConfirmation
  });

  const staking = useStakingActions({
    activeKey: global.activeKey,
    account: global.account,
    userAddress: global.userAddress || '',
    addLog,
    addToast,
    fetchData: handleFetchData,
    requestConfirmation: txConfirm.requestConfirmation
  });

  const admin = useAdminActions({
    activeKey: global.activeKey,
    snapshotId: global.snapshotId,
    setSnapshotId: global.setSnapshotId,
    addLog,
    addToast,
    fetchData: handleFetchData,
    requestConfirmation: txConfirm.requestConfirmation
  });

  // Cálculos Derivados Locales
  const activeLoansSum = p2pMarket.loansList.reduce((acc, loan) => {
    return acc + (loan.state === 1 ? parseFloat(loan.borrowAmount.replace(/,/g, '')) || 0 : 0);
  }, 0);

  const activeTreasuryLoansSum = p2pMarket.loansList.reduce((acc, loan) => {
    const isTreasury = loan.lender && loan.lender.toLowerCase() === CONTRACT_ADDRESSES.TREASURY.toLowerCase();
    return acc + (loan.state === 1 && isTreasury ? parseFloat(loan.borrowAmount.replace(/,/g, '')) || 0 : 0);
  }, 0);

  const claimableYieldVal = parseFloat(portfolio.claimableYield.replace(/,/g, '')) || 0;
  const activeLoansInterestSum = p2pMarket.loansList.reduce((acc, loan) => {
    return acc + (loan.state === 1 ? (parseFloat(loan.borrowAmount.replace(/,/g, '')) || 0) * (loan.interestRateBps / 10000) : 0);
  }, 0);

  const grossCashflowUsd = portfolio.userPositions.reduce((acc, pos) => {
    return acc + (!pos.isRagequitted ? parseFloat(pos.principal || '0') || 0 : 0);
  }, 0);

  // Re-build a dummy web3 structure to pass to GovernanceCommandCenter which heavily relies on it.
  const web3DataDummy = {
    ...global,
    ...treasuryMetrics,
    ...universalYield,
    ...stakingMetrics,
    ...p2pMarket,
    ...portfolio
  };

  return (
    <NetworkGuard>
      <div className="app-container">
        <NotificationToast toasts={toasts} onDismiss={handleDismissToast} />

      <ReferralModal
        isOpen={isReferralOpen}
        onClose={() => setIsReferralOpen(false)}
        userAddress={global.userAddress || ''}
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
        navValue={treasuryMetrics.navPerShareUSD}
        porRatio={universalYield.porRatio}
        alphaApy={universalYield.liveApyStr}
        blockDateStr={global.blockDateStr}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        walletConnected={global.walletConnected}
        userAddress={global.userAddress || ''}
        circuitBreakerFrozen={treasuryMetrics.circuitBreakerFrozen}
        onOpenReferral={() => setIsReferralOpen(true)}
        onOpenApyModal={() => setIsApyModalOpen(true)}
      />

      <ApyBreakdownModal
        isOpen={isApyModalOpen}
        onClose={() => setIsApyModalOpen(false)}
        porAssets={universalYield.porAssets}
        porBreakdown={universalYield.porBreakdown}
        stakedBalance={stakingMetrics.totalStakedSupply}
        grossCashflowUsd={grossCashflowUsd}
        activeLoansUsd={activeLoansSum}
        claimableYieldUsd={claimableYieldVal}
        activeLoansInterestUsd={activeLoansInterestSum}
        assetRates={universalYield.assetRates}
        navPerShareNum={treasuryMetrics.navPerShareNum}
      />

      <Suspense fallback={<ViewLoader />}>
        {activeTab === 'client' ? (
          <>
            <TreasuryDashboard
              porAssets={universalYield.porAssets}
              porLiabilities={universalYield.porLiabilities}
              porRatio={universalYield.porRatio}
              porBreakdown={universalYield.porBreakdown}

              usdcBalance={portfolio.usdcBalance}
              sharesBalance={portfolio.sharesBalance}
              depositAmount={treasury.depositAmount}
              setDepositAmount={treasury.setDepositAmount}
              redeemAmount={treasury.redeemAmount}
              setRedeemAmount={treasury.setRedeemAmount}
              onDeposit={treasury.handleDeposit}
              onRedeem={treasury.handleRedeem}
              onFaucetUSDC={treasury.handleFaucetUSDC}
              onAuditPoR={treasury.handleAuditPoR}
              isAdmin={global.isSandbox && global.walletConnected}
              loansList={p2pMarket.loansList}
            />

            <VestedVaults
              bondPrincipal={vestedVault.bondPrincipal}
              setBondPrincipal={vestedVault.setBondPrincipal}
              bondLockYears={vestedVault.bondLockYears}
              setBondLockYears={vestedVault.setBondLockYears}
              bondReferrer={vestedVault.bondReferrer}
              setBondReferrer={vestedVault.setBondReferrer}
              onBuyBond={vestedVault.handleBuyBond}
              userPositions={portfolio.userPositions}
              onClaimMatured={vestedVault.handleClaimMatured}
              onRagequit={vestedVault.handleRagequit}
              userAddress={global.userAddress || ''}
              usdcBalance={portfolio.usdcBalance}
            />

            <P2PMarketplace
              loansList={p2pMarket.loansList}
              p2pTokenId={p2p.p2pTokenId}
              setP2pTokenId={p2p.setP2pTokenId}
              p2pBorrowAmount={p2p.p2pBorrowAmount}
              setP2pBorrowAmount={p2p.setP2pBorrowAmount}
              p2pInterestBps={p2p.p2pInterestBps}
              setP2pInterestBps={p2p.setP2pInterestBps}
              p2pDays={p2p.p2pDays}
              setP2pDays={p2p.setP2pDays}
              targetLoanId={p2p.targetLoanId}
              setTargetLoanId={p2p.setTargetLoanId}
              loanCollateral={p2p.loanCollateral}
              setLoanCollateral={p2p.setLoanCollateral}
              onCreateLoanOffer={p2p.handleCreateLoanOffer}
              onAcceptLoan={p2p.handleAcceptLoan}
              onRepayLoan={p2p.handleRepayLoan}
              onLiquidateLoan={p2p.handleLiquidateLoan}
              onAcceptLoanById={p2p.handleAcceptLoanById}
              onCancelLoanOffer={p2p.handleCancelLoanOffer}
              onRepayLoanById={p2p.handleRepayLoanById}
              onLiquidateLoanById={p2p.handleLiquidateLoanById}
              onBorrowFromTreasury={p2p.handleBorrowFromTreasury}
              userAddress={global.userAddress || ''}
              userPositions={portfolio.userPositions}
              navPerShareNum={treasuryMetrics.navPerShareNum}
              assetPrices={treasuryMetrics.assetPrices}
            />

            <GovernanceStakingUI
              totalStakedSupply={stakingMetrics.totalStakedSupply}
              circulatingSupply={stakingMetrics.circulatingSupply}
              stakingRatioPct={stakingMetrics.stakingRatioPct}
              totalBurnedTokens={treasuryMetrics.totalBurnedTokens}
              sharesBalance={portfolio.sharesBalance}
              stakedBalance={portfolio.stakedBalance}
              claimableYield={portfolio.claimableYield}
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
          </>
        ) : activeTab === 'metrics' ? (
          <MetricsDashboard
            porAssets={universalYield.porAssets}
            porLiabilities={universalYield.porLiabilities}
            porRatio={universalYield.porRatio}
            porBreakdown={universalYield.porBreakdown}
            usdcBalance={portfolio.usdcBalance}
            sharesBalance={portfolio.sharesBalance}
            stakedBalance={portfolio.stakedBalance}
            claimableYield={portfolio.claimableYield}
            circulatingSupply={stakingMetrics.circulatingSupply}
            totalStakedSupply={stakingMetrics.totalStakedSupply}
            communityStakedSupply={stakingMetrics.communityStakedSupply}
            communityVaultStakedSupply={stakingMetrics.communityVaultStakedSupply}
            treasuryStakedSupply={stakingMetrics.treasuryStakedSupply}
            stakingRatioPct={stakingMetrics.stakingRatioPct}
            totalBurnedTokens={treasuryMetrics.totalBurnedTokens}
            navPerShareUSD={treasuryMetrics.navPerShareUSD}
            userPositions={portfolio.userPositions}
            loansList={p2pMarket.loansList}
            onOpenApyModal={() => setIsApyModalOpen(true)}
            liveApyStr={universalYield.liveApyStr}
            targetWeights={treasuryMetrics.targetWeights}
          />
        ) : (
          <>
            <AdminControlPanel
              chainId={global.chainId}
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
              circuitBreakerFrozen={treasuryMetrics.circuitBreakerFrozen}
              onSimulateDrop={admin.handleSimulateDrop}
              onResetBreaker={admin.handleResetBreaker}
              onResetBlockchain={admin.handleResetBlockchain}
            />

            <GovernanceCommandCenter
              web3Data={web3DataDummy}
              adminActions={admin}
              isAdmin={global.isSandbox && global.walletConnected}
            />

            <ActivityLog logs={logs} />
          </>
        )}
      </Suspense>

      <LegalDisclaimerFooter chainId={global.chainId} />

      {/* Hidden Telemetry Container for E2E Auditing */}
      <div className="telemetry-hidden-container" aria-hidden="true">
        <span data-testid="por-assets-total">${universalYield.porAssets} USD</span>
        <span data-testid="por-liabilities-total">${universalYield.porLiabilities} USD</span>
        <span data-testid="por-collateral-ratio">{universalYield.porRatio}</span>
        <span data-testid="por-row-usdc-val">${universalYield.porBreakdown.stables.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
        <span data-testid="por-row-wbtc-val">${universalYield.porBreakdown.wbtc.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
        <span data-testid="por-row-weth-val">${universalYield.porBreakdown.weth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
        <span data-testid="staking-circulating-supply">{stakingMetrics.circulatingSupply} ALPHA</span>
        <span data-testid="staking-community-staked">{stakingMetrics.communityStakedSupply} stALPHA</span>
        <span data-testid="staking-community-vault-staked">{stakingMetrics.communityVaultStakedSupply} stALPHA</span>
        <span data-testid="staking-vaults-staked">{stakingMetrics.communityVaultStakedSupply} stALPHA</span>
        <span data-testid="staking-reserves-staked">{stakingMetrics.treasuryStakedSupply} stALPHA</span>
        <span data-testid="staking-total-staked">{stakingMetrics.totalStakedSupply} ALPHA ({stakingMetrics.stakingRatioPct})</span>
        <span data-testid="staking-global-staked">{stakingMetrics.totalStakedSupply} ALPHA ({stakingMetrics.stakingRatioPct})</span>
        <span data-testid="staking-deflation-burned">{treasuryMetrics.totalBurnedTokens} ALPHA</span>
        <span data-testid="staking-deflation-destroyed">{treasuryMetrics.totalBurnedTokens} ALPHA</span>
        <span data-testid="escrow-total-lent">${activeTreasuryLoansSum.toFixed(2)} USD</span>
      </div>
    </div>
    </NetworkGuard>
  );
}
