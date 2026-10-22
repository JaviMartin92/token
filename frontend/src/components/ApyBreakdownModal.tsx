import React from 'react';
import styles from './ApyBreakdownModal.module.css';
import { UI_STRINGS } from '../constants/strings.js';

interface ApyBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  porAssets?: string;
  porBreakdown?: { stables: number; wbtc: number; weth: number; alphaStaking: number };
  stakedBalance?: string;
  grossCashflowUsd?: number;
  activeLoansUsd?: number;
  claimableYieldUsd?: number;
  activeLoansInterestUsd?: number;
  assetRates?: { stablesApyPct: number; ethApyPct: number; btcApyPct: number };
  navPerShareNum?: number;
}

export function calculateProtocolApyMath(
  porAssets: string = '0.00',
  porBreakdown = { stables: 0, wbtc: 0, weth: 0, alphaStaking: 0 },
  stakedBalance: string = '0',
  grossCashflowUsd: number = 0,
  activeLoansUsd: number = 0,
  _claimableYieldUsd: number = 0,
  activeLoansInterestUsd: number = 0,
  assetRates = { stablesApyPct: 0, ethApyPct: 0, btcApyPct: 0 },
  _navPerShareNum: number = 1.0
) {
  const numericAssetsUSD = parseFloat(porAssets.replace(/,/g, '')) || 0;
  const numericStakedAlpha = parseFloat(stakedBalance.replace(/,/g, '')) || 0;

  let stablesUSD = porBreakdown.stables;
  let wbtcUSD = porBreakdown.wbtc;
  let wethUSD = porBreakdown.weth;

  // 1. Morpho Blue (USDC): 90% of USDC stablecoin reserve deployed to MetaMorpho Vault @ Dynamic On-Chain Oracle APR
  const morphoUSDPool = stablesUSD * 0.90;
  const liquidBufferUSDPool = stablesUSD * 0.10;
  const morphoUSDYield = morphoUSDPool * assetRates.stablesApyPct;

  // 2. Lombard LBTC (WBTC): 100% of WBTC reserve @ Dynamic On-Chain Oracle APR
  const lbtcUSDYield = wbtcUSD * assetRates.btcApyPct;

  // 3. Lido wstETH (WETH): 100% of WETH reserve @ Dynamic On-Chain Oracle APR
  const wstEthUSDYield = wethUSD * assetRates.ethApyPct;

  // 4. P2P Direct Treasury Loans: Up to 20% Max Credit Line from Exogenous Reserves
  const maxCreditLineUSD = numericAssetsUSD * 0.20;
  const realActiveLoansUSD = Math.min(activeLoansUsd, maxCreditLineUSD);
  const unlentAvailableUSD = Math.max(maxCreditLineUSD - realActiveLoansUSD, 0);
  const unlentLoanPoolUSDYield = (unlentAvailableUSD * 0.90) * assetRates.stablesApyPct;
  const loanUtilizationPct = maxCreditLineUSD > 0 ? (realActiveLoansUSD / maxCreditLineUSD) * 100 : 0;
  const activeLoanInterestUSD = activeLoansInterestUsd;
  const treasuryLoanUSDYield = activeLoanInterestUSD;

  const totalAnnualYieldUSD = morphoUSDYield + lbtcUSDYield + wstEthUSDYield + treasuryLoanUSDYield;
  const realTimeBaseApyPct = numericAssetsUSD > 0 ? (totalAnnualYieldUSD / numericAssetsUSD) * 100 : 0;

  const wStablesPct = numericAssetsUSD > 0 ? (stablesUSD / numericAssetsUSD) * 100 : 0;
  const wMorphoPct = numericAssetsUSD > 0 ? (morphoUSDPool / numericAssetsUSD) * 100 : 0;
  const wLiquidBufferPct = numericAssetsUSD > 0 ? (liquidBufferUSDPool / numericAssetsUSD) * 100 : 0;
  const wBtcPct = numericAssetsUSD > 0 ? (wbtcUSD / numericAssetsUSD) * 100 : 0;
  const wEthPct = numericAssetsUSD > 0 ? (wethUSD / numericAssetsUSD) * 100 : 0;
  const wLoanPct = numericAssetsUSD > 0 ? (maxCreditLineUSD / numericAssetsUSD) * 100 : 0;

  const actualBondFeesUSD = grossCashflowUsd * 0.015;
  const actualP2pFeesUSD = realActiveLoansUSD * 0.005;
  const actualInterestSpreadUSD = activeLoanInterestUSD * 0.10;
  const totalFlywheelFeesUSD = actualBondFeesUSD + actualP2pFeesUSD + actualInterestSpreadUSD;

  const flywheelApyPct = numericStakedAlpha > 0 
    ? (totalFlywheelFeesUSD / numericStakedAlpha) * 100 
    : 0.00;

  const stakingTotalApyPct = realTimeBaseApyPct + flywheelApyPct;
  const totalApyPct = (realTimeBaseApyPct + flywheelApyPct).toFixed(2);

  return {
    numericAssetsUSD,
    numericStakedAlpha,
    stablesUSD,
    morphoUSDPool,
    liquidBufferUSDPool,
    wbtcUSD,
    wethUSD,
    loanPoolUSD: maxCreditLineUSD,
    maxCreditLineUSD,
    realActiveLoansUSD,
    unlentAvailableUSD,
    unlentLoanPoolUSDYield,
    loanUtilizationPct,
    activeLoanInterestUSD,
    treasuryLoanUSDYield,
    morphoUSDYield,
    lbtcUSDYield,
    wstEthUSDYield,
    totalAnnualYieldUSD,
    realTimeBaseApyPct,
    wStablesPct,
    wMorphoPct,
    wLiquidBufferPct,
    wBtcPct,
    wEthPct,
    wLoanPct,
    actualBondFeesUSD,
    actualP2pFeesUSD,
    actualInterestSpreadUSD,
    totalFlywheelFeesUSD,
    flywheelApyPct,
    stakingTotalApyPct,
    totalApyPct
  };
}

export const ApyBreakdownModal: React.FC<ApyBreakdownModalProps> = ({
  isOpen,
  onClose,
  porAssets = '0.00',
  porBreakdown = { stables: 0, wbtc: 0, weth: 0, alphaStaking: 0 },
  stakedBalance = '0',
  grossCashflowUsd = 0,
  activeLoansUsd = 0,
  claimableYieldUsd = 0,
  activeLoansInterestUsd = 0,
  assetRates = { stablesApyPct: 0, ethApyPct: 0, btcApyPct: 0 },
  navPerShareNum = 1.0
}) => {
  if (!isOpen) return null;

  const {
    numericAssetsUSD,
    numericStakedAlpha,
    stablesUSD: _stablesUSD,
    morphoUSDPool,
    liquidBufferUSDPool,
    wbtcUSD,
    wethUSD,
    loanPoolUSD: _loanPoolUSD,
    maxCreditLineUSD,
    realActiveLoansUSD,
    unlentAvailableUSD: _unlentAvailableUSD,
    unlentLoanPoolUSDYield: _unlentLoanPoolUSDYield,
    loanUtilizationPct,
    activeLoanInterestUSD,
    treasuryLoanUSDYield,
    morphoUSDYield,
    lbtcUSDYield,
    wstEthUSDYield,
    totalAnnualYieldUSD,
    realTimeBaseApyPct,
    wStablesPct: _wStablesPct,
    wMorphoPct,
    wLiquidBufferPct,
    wBtcPct,
    wEthPct,
    wLoanPct: _wLoanPct,
    actualBondFeesUSD,
    actualP2pFeesUSD,
    actualInterestSpreadUSD,
    totalFlywheelFeesUSD,
    flywheelApyPct,
    stakingTotalApyPct,
    totalApyPct
  } = calculateProtocolApyMath(
    porAssets,
    porBreakdown,
    stakedBalance,
    grossCashflowUsd,
    activeLoansUsd,
    claimableYieldUsd,
    activeLoansInterestUsd,
    assetRates,
    navPerShareNum
  );

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
    >
      <div
        className="glass-panel modal-container modal-container-wide"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleBox}>
            <span className={styles.modalTitleIcon}>⚡</span>
            <div>
              <h3 className={styles.modalTitleH3}>{UI_STRINGS.MODALS.APY_BREAKDOWN.TITLE}</h3>
              <div className={styles.modalSubtitle}>
                {UI_STRINGS.MODALS.APY_BREAKDOWN.SUBTITLE_PREFIX} ${numericAssetsUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} {UI_STRINGS.COMMON.SYMBOL_USDC} • {UI_STRINGS.MODALS.APY_BREAKDOWN.SUBTITLE_STAKING_PREFIX} {numericStakedAlpha.toLocaleString()} {UI_STRINGS.COMMON.SYMBOL_ALPHA}
              </div>
            </div>
          </div>
          <button
            data-testid="modal-apy-close-btn"
            onClick={onClose}
            className={styles.modalCloseRound}
          >
            ✕
          </button>
        </div>

        {/* Big APY Highlight Banner */}
        <div className={styles.highlightBanner}>
          <div className={styles.highlightLabel}>
            {UI_STRINGS.MODALS.APY_BREAKDOWN.HIGHLIGHT_LABEL}
          </div>
          <div data-testid="modal-apy-total-apr" className={styles.highlightApr}>
            {totalApyPct}% APR
          </div>
          <div data-testid="modal-apy-annual-yield-usd" className={styles.highlightUsd}>
            +${totalAnnualYieldUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {UI_STRINGS.MODALS.APY_BREAKDOWN.HIGHLIGHT_USD_SUFFIX}
          </div>
          <div className={styles.highlightFooter}>
            <span>{UI_STRINGS.MODALS.APY_BREAKDOWN.HIGHLIGHT_BASE_LABEL} <strong data-testid="modal-apy-base-apr">{realTimeBaseApyPct.toFixed(3)}%</strong> (+${totalAnnualYieldUSD.toFixed(2)} USD/año)</span>
            <span>+</span>
            <span>{UI_STRINGS.MODALS.APY_BREAKDOWN.HIGHLIGHT_FLYWHEEL_LABEL} <strong data-testid="modal-apy-flywheel-apr">{flywheelApyPct.toFixed(3)}%</strong> (+${totalFlywheelFeesUSD.toFixed(2)} USDC/año)</span>
          </div>
        </div>

        {/* Section 1: Base Reserve Yield */}
        <div className="margin-bottom-lg">
          <div className={styles.sectionHeader}>
            <span>{UI_STRINGS.MODALS.APY_BREAKDOWN.SECTION_1_TITLE}</span>
            <span className="text-green-light">{UI_STRINGS.MODALS.APY_BREAKDOWN.SECTION_1_BASE_RATE} {realTimeBaseApyPct.toFixed(3)}% APR</span>
          </div>

          <div className={styles.listStack}>
            {/* Morpho */}
            <div className={styles.rowCard}>
              <div>
                <div className="font-semibold text-base">{UI_STRINGS.MODALS.APY_BREAKDOWN.MORPHO_TITLE} ({wMorphoPct.toFixed(1)}% USDC Invertido)</div>
                <div className="text-sm text-muted margin-top-xs">
                  {UI_STRINGS.MODALS.APY_BREAKDOWN.MORPHO_LOCATION_PREFIX} <strong>${morphoUSDPool.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong> ({wMorphoPct.toFixed(1)}% {UI_STRINGS.MODALS.APY_BREAKDOWN.MORPHO_OF_RESERVES}) • {UI_STRINGS.MODALS.APY_BREAKDOWN.MORPHO_VAULT_RATE} <strong>{(assetRates.stablesApyPct * 100).toFixed(2)}% APY</strong>
                </div>
              </div>
              <div className="text-align-right">
                <div className="font-bold text-green-bright text-md">
                  +${morphoUSDYield.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD / año
                </div>
                <div className="text-xs text-green-light">+{( (morphoUSDYield / (numericAssetsUSD || 1)) * 100 ).toFixed(3)}% {UI_STRINGS.MODALS.APY_BREAKDOWN.MORPHO_TOTAL_ADD}</div>
              </div>
            </div>

            {/* Búfer Líquido de Tesorería */}
            <div className={styles.rowCard}>
              <div>
                <div className="font-semibold text-base">{UI_STRINGS.MODALS.APY_BREAKDOWN.BUFFER_TITLE} ({wLiquidBufferPct.toFixed(1)}% USDC Libre)</div>
                <div className="text-sm text-muted margin-top-xs">
                  {UI_STRINGS.MODALS.APY_BREAKDOWN.MORPHO_LOCATION_PREFIX} <strong>${liquidBufferUSDPool.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong> ({wLiquidBufferPct.toFixed(1)}% {UI_STRINGS.MODALS.APY_BREAKDOWN.MORPHO_OF_RESERVES}) • {UI_STRINGS.MODALS.APY_BREAKDOWN.BUFFER_DESC}
                </div>
              </div>
              <div className="text-align-right">
                <div className="font-bold text-dim text-md">
                  +$0.00 USD / año
                </div>
                <div className="text-xs text-dim">0.000% APR</div>
              </div>
            </div>

            {/* Lombard LBTC */}
            <div className={styles.rowCard}>
              <div>
                <div className="font-semibold text-base">{UI_STRINGS.MODALS.APY_BREAKDOWN.LBTC_TITLE}</div>
                <div className="text-sm text-muted margin-top-xs">
                  {UI_STRINGS.MODALS.APY_BREAKDOWN.MORPHO_LOCATION_PREFIX} <strong>${wbtcUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong> ({wBtcPct.toFixed(1)}% {UI_STRINGS.MODALS.APY_BREAKDOWN.MORPHO_OF_RESERVES}) • {UI_STRINGS.MODALS.APY_BREAKDOWN.LBTC_DESC}
                </div>
              </div>
              <div className="text-align-right">
                <div className={`font-bold text-md ${wbtcUSD > 0 ? 'text-green-bright' : 'text-dim'}`}>
                  +${lbtcUSDYield.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD / año
                </div>
                <div className={`text-xs ${wbtcUSD > 0 ? 'text-green-light' : 'text-dim'}`}>+{( (lbtcUSDYield / (numericAssetsUSD || 1)) * 100 ).toFixed(3)}% APR</div>
              </div>
            </div>

            {/* Lido wstETH */}
            <div className={styles.rowCard}>
              <div>
                <div className="font-semibold text-base">{UI_STRINGS.MODALS.APY_BREAKDOWN.WSTETH_TITLE}</div>
                <div className="text-sm text-muted margin-top-xs">
                  {UI_STRINGS.MODALS.APY_BREAKDOWN.MORPHO_LOCATION_PREFIX} <strong>${wethUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong> ({wEthPct.toFixed(1)}% {UI_STRINGS.MODALS.APY_BREAKDOWN.MORPHO_OF_RESERVES}) • {UI_STRINGS.MODALS.APY_BREAKDOWN.LBTC_DESC}
                </div>
              </div>
              <div className="text-align-right">
                <div className={`font-bold text-md ${wethUSD > 0 ? 'text-green-bright' : 'text-dim'}`}>
                  +${wstEthUSDYield.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD / año
                </div>
                <div className={`text-xs ${wethUSD > 0 ? 'text-green-light' : 'text-dim'}`}>+{( (wstEthUSDYield / (numericAssetsUSD || 1)) * 100 ).toFixed(3)}% APR</div>
              </div>
            </div>

            {/* Treasury Loans Utilization Breakdown */}
            <div className={styles.rowCard}>
              <div>
                <div className="font-semibold text-base">{UI_STRINGS.MODALS.APY_BREAKDOWN.TREASURY_LOANS_TITLE}</div>
                <div className="text-sm text-muted margin-top-xs">
                  {UI_STRINGS.MODALS.APY_BREAKDOWN.TREASURY_LOANS_MAX} <strong>${maxCreditLineUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong> • {UI_STRINGS.MODALS.APY_BREAKDOWN.TREASURY_LOANS_LENT} <strong>${realActiveLoansUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD ({loanUtilizationPct.toFixed(1)}% util.)</strong> (+${activeLoanInterestUSD.toFixed(2)}/año)
                </div>
              </div>
              <div className="text-align-right">
                <div className="font-bold text-green-bright text-md">
                  +${treasuryLoanUSDYield.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD / año
                </div>
                <div className="text-xs text-green-light">+{( (treasuryLoanUSDYield / (numericAssetsUSD || 1)) * 100 ).toFixed(3)}% APR</div>
              </div>
            </div>

            {/* ALPHA Token Staking & Treasury Backing */}
            <div className={styles.rowCardPurple}>
              <div>
                <div className="font-semibold text-base text-purple-light">{UI_STRINGS.MODALS.APY_BREAKDOWN.ALPHA_STAKING_TITLE}</div>
                <div className="text-sm margin-top-xs">
                  {UI_STRINGS.MODALS.APY_BREAKDOWN.ALPHA_STAKING_ACTIVE} <strong>{numericStakedAlpha.toLocaleString()} {UI_STRINGS.COMMON.SYMBOL_ALPHA}</strong> • {UI_STRINGS.MODALS.APY_BREAKDOWN.ALPHA_STAKING_BACKING} <strong>${(numericStakedAlpha * (navPerShareNum || 1.0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong>
                </div>
              </div>
              <div className="text-align-right">
                <div className="font-bold text-purple-light text-md">
                  +{stakingTotalApyPct.toFixed(3)}% APY Total
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Flywheel Fee Distribution */}
        <div className="margin-bottom-lg">
          <div className={styles.sectionHeaderBlue}>
            <span>{UI_STRINGS.MODALS.APY_BREAKDOWN.SECTION_2_TITLE}</span>
            <span className="text-blue-light">{UI_STRINGS.MODALS.APY_BREAKDOWN.SECTION_2_BOOST} +{flywheelApyPct.toFixed(3)}% APR</span>
          </div>

          <div className={styles.listStack}>
            {/* Bond Fees */}
            <div className={styles.rowCard}>
              <div>
                <div className="font-semibold text-base">{UI_STRINGS.MODALS.APY_BREAKDOWN.BOND_FEES_TITLE}</div>
                <div className="text-xs text-muted margin-top-xs">
                  {UI_STRINGS.MODALS.APY_BREAKDOWN.BOND_FEES_DESC} +${actualBondFeesUSD.toFixed(2)} USDC/año
                </div>
              </div>
              <div className="font-bold text-blue-bright text-md">
                +${actualBondFeesUSD.toFixed(2)} USDC / año
              </div>
            </div>

            {/* P2P Fees */}
            <div className={styles.rowCard}>
              <div>
                <div className="font-semibold text-base">{UI_STRINGS.MODALS.APY_BREAKDOWN.P2P_FEES_TITLE}</div>
                <div className="text-xs text-muted margin-top-xs">
                  {UI_STRINGS.MODALS.APY_BREAKDOWN.P2P_FEES_DESC} +${actualP2pFeesUSD.toFixed(2)} USDC/año
                </div>
              </div>
              <div className="font-bold text-blue-bright text-md">
                +${actualP2pFeesUSD.toFixed(2)} USDC / año
              </div>
            </div>

            {/* Margin Spread */}
            <div className={styles.rowCard}>
              <div>
                <div className="font-semibold text-base">{UI_STRINGS.MODALS.APY_BREAKDOWN.MARGIN_FEES_TITLE}</div>
                <div className="text-xs text-muted margin-top-xs">
                  {UI_STRINGS.MODALS.APY_BREAKDOWN.MARGIN_FEES_DESC}
                </div>
              </div>
              <div className="font-bold text-blue-bright text-md">
                +${actualInterestSpreadUSD.toFixed(2)} USDC / año
              </div>
            </div>
          </div>
        </div>

        {/* Verification Footnote */}
        <div className={styles.footnoteCard}>
          <div className="font-semibold text-purple-light margin-bottom-sm">{UI_STRINGS.MODALS.APY_BREAKDOWN.MATH_FORMULA_TITLE}</div>
          <code>{UI_STRINGS.MODALS.APY_BREAKDOWN.MATH_FORMULA_CODE}</code>
          <div className="margin-top-md text-xs">
            Tasa APY Base = (Total_Generado_USD / Reservas_Totales_USD) = ({totalAnnualYieldUSD.toFixed(2)} / {numericAssetsUSD.toFixed(2)}) = <strong>{realTimeBaseApyPct.toFixed(3)}% APR</strong>
          </div>
        </div>

        {/* Close Button */}
        <div className="margin-top-xl text-center">
          <button
            className={`btn-primary ${styles.confirmBtn}`}
            onClick={onClose}
          >
            {UI_STRINGS.MODALS.APY_BREAKDOWN.BTN_UNDERSTOOD}
          </button>
        </div>
      </div>
    </div>
  );
};
