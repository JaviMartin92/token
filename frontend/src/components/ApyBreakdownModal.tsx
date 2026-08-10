import React from 'react';

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
}

export function calculateProtocolApyMath(
  porAssets: string = '0.00',
  porBreakdown = { stables: 0, wbtc: 0, weth: 0, alphaStaking: 0 },
  stakedBalance: string = '0',
  grossCashflowUsd: number = 0,
  activeLoansUsd: number = 0,
  _claimableYieldUsd: number = 0,
  activeLoansInterestUsd: number = 0,
  assetRates = { stablesApyPct: 0, ethApyPct: 0, btcApyPct: 0 }
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
  assetRates = { stablesApyPct: 0, ethApyPct: 0, btcApyPct: 0 }
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
    unlentAvailableUSD,
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
    assetRates
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
        <div className="apy-modal-header">
          <div className="apy-modal-title-box">
            <span className="apy-modal-title-icon">⚡</span>
            <div>
              <h3 className="apy-modal-title-h3">Desglose de Reservas y Rendimiento Anualizado en Tiempo Real</h3>
              <div className="apy-modal-subtitle">
                Reservas Totales: ${numericAssetsUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD • Staking: {numericStakedAlpha.toLocaleString()} ALPHA
              </div>
            </div>
          </div>
          <button
            data-testid="modal-apy-close-btn"
            onClick={onClose}
            className="apy-modal-close-round"
          >
            ✕
          </button>
        </div>

        {/* Big APY Highlight Banner */}
        <div className="apy-highlight-banner">
          <div className="apy-highlight-label">
            RENDIMIENTO ANUALIZADO TOTAL EN TIEMPO REAL
          </div>
          <div data-testid="modal-apy-total-apr" className="apy-highlight-apr">
            {totalApyPct}% APR
          </div>
          <div data-testid="modal-apy-annual-yield-usd" className="apy-highlight-usd">
            +${totalAnnualYieldUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD / año generados por las Reservas
          </div>
          <div className="apy-highlight-footer">
            <span>🏦 Base Reservas: <strong data-testid="modal-apy-base-apr">{realTimeBaseApyPct.toFixed(3)}%</strong> (+${totalAnnualYieldUSD.toFixed(2)} USD/año)</span>
            <span>+</span>
            <span>💸 Flywheel Recompensas: <strong data-testid="modal-apy-flywheel-apr">{flywheelApyPct.toFixed(3)}%</strong> (+${totalFlywheelFeesUSD.toFixed(2)} USDC/año)</span>
          </div>
        </div>

        {/* Section 1: Base Reserve Yield */}
        <div className="margin-bottom-lg">
          <div className="apy-section-header">
            <span>1. DÓNDE ESTÁN LAS RESERVAS & RENDIMIENTO ANUALIZADO (ON-CHAIN)</span>
            <span className="text-green-light">Tasa Base: {realTimeBaseApyPct.toFixed(3)}% APR</span>
          </div>

          <div className="apy-list-stack">
            {/* Morpho */}
            <div className="apy-row-card">
              <div>
                <div className="font-semibold text-base">🏦 Morpho Blue MetaMorpho Vault (90% USDC Invertido)</div>
                <div className="text-sm text-muted margin-top-xs">
                  Ubicación: <strong>${morphoUSDPool.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong> ({wMorphoPct.toFixed(1)}% de Reservas) • Tasa Vault On-Chain: <strong>{(assetRates.stablesApyPct * 100).toFixed(2)}% APY</strong>
                </div>
              </div>
              <div className="text-align-right">
                <div className="font-bold text-green-bright text-md">
                  +${morphoUSDYield.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD / año
                </div>
                <div className="text-xs text-green-light">+{( (morphoUSDYield / (numericAssetsUSD || 1)) * 100 ).toFixed(3)}% APR al Total</div>
              </div>
            </div>

            {/* Búfer Líquido de Tesorería */}
            <div className="apy-row-card">
              <div>
                <div className="font-semibold text-base">💧 Búfer Líquido de Tesorería (10% USDC Libre)</div>
                <div className="text-sm text-muted margin-top-xs">
                  Ubicación: <strong>${liquidBufferUSDPool.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong> ({wLiquidBufferPct.toFixed(1)}% de Reservas) • Liquidez Inmediata para Rescates
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
            <div className="apy-row-card">
              <div>
                <div className="font-semibold text-base">₿ Lombard LBTC Bitcoin Liquid Staking</div>
                <div className="text-sm text-muted margin-top-xs">
                  Ubicación: <strong>${wbtcUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong> ({wBtcPct.toFixed(1)}% de Reservas) • Rendimiento Variable
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
            <div className="apy-row-card">
              <div>
                <div className="font-semibold text-base">Ξ Lido wstETH Ethereum Liquid Staking</div>
                <div className="text-sm text-muted margin-top-xs">
                  Ubicación: <strong>${wethUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong> ({wEthPct.toFixed(1)}% de Reservas) • Rendimiento Variable
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
            <div className="apy-row-card">
              <div>
                <div className="font-semibold text-base">🏛️ Fondo de Préstamos Directos Tesorería (Línea de Crédito 20.0% Máx. de Reservas)</div>
                <div className="text-sm text-muted margin-top-xs">
                  Fondo Total Máximo: <strong>${maxCreditLineUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong> • Prestado: <strong>${realActiveLoansUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD ({loanUtilizationPct.toFixed(1)}% util.)</strong> (8.00% APR) (+${activeLoanInterestUSD.toFixed(2)}/año)
                </div>
                <div className="text-xs text-dim margin-top-xs">
                  Disponible para Solicitar (en Vault Morpho @ 6.45% APY): <strong>${unlentAvailableUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong>
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
            <div className="apy-row-card-purple">
              <div>
                <div className="font-semibold text-base text-purple-light">🥩 Staking de Tokens ALPHA & Gobernanza DAO</div>
                <div className="text-sm margin-top-xs">
                  Posición Activa: <strong>{numericStakedAlpha.toLocaleString()} ALPHA</strong> • Respaldo Directo NAV: <strong>${(numericStakedAlpha * 1.0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong>
                </div>
                <div className="text-xs text-purple-bright margin-top-xs">
                  Base NAV Reservas: +{realTimeBaseApyPct.toFixed(3)}% APY • Flywheel Recompensas: +{flywheelApyPct.toFixed(3)}% APR (+${totalFlywheelFeesUSD.toFixed(2)} USDC/año)
                </div>
              </div>
              <div className="text-align-right">
                <div className="font-bold text-purple-light text-md">
                  +{stakingTotalApyPct.toFixed(3)}% APY Total
                </div>
                <div className="text-xs">+${( (numericStakedAlpha * stakingTotalApyPct) / 100 ).toFixed(2)} USD / año</div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Flywheel Fee Distribution */}
        <div className="margin-bottom-lg">
          <div className="apy-section-header-blue">
            <span>2. COMISIONES DE PROTOCOLO FLUIDAS (FLYWHEEL REAL YIELD)</span>
            <span className="text-blue-light">Boost Staking: +{flywheelApyPct.toFixed(3)}% APR</span>
          </div>

          <div className="apy-list-stack">
            {/* Bond Fees */}
            <div className="apy-row-card">
              <div>
                <div className="font-semibold text-base">🏷️ Comisiones por Emisión de Bonos Vestados (1.5%)</div>
                <div className="text-xs text-muted margin-top-xs">
                  Recaudación Anualizada de Comisiones: +${actualBondFeesUSD.toFixed(2)} USDC/año
                </div>
              </div>
              <div className="font-bold text-blue-bright text-md">
                +${actualBondFeesUSD.toFixed(2)} USDC / año
              </div>
            </div>

            {/* P2P Fees */}
            <div className="apy-row-card">
              <div>
                <div className="font-semibold text-base">🤝 Comisiones de Originación P2P (0.50%)</div>
                <div className="text-xs text-muted margin-top-xs">
                  Recaudación Anualizada sobre Préstamos: +${actualP2pFeesUSD.toFixed(2)} USDC/año
                </div>
              </div>
              <div className="font-bold text-blue-bright text-md">
                +${actualP2pFeesUSD.toFixed(2)} USDC / año
              </div>
            </div>

            {/* Margin Spread */}
            <div className="apy-row-card">
              <div>
                <div className="font-semibold text-base">💰 Spread de Margen de Interés (10.0%)</div>
                <div className="text-xs text-muted margin-top-xs">
                  10% de comisión sobre los intereses generados on-chain
                </div>
              </div>
              <div className="font-bold text-blue-bright text-md">
                +${actualInterestSpreadUSD.toFixed(2)} USDC / año
              </div>
            </div>
          </div>
        </div>

        {/* Verification Footnote */}
        <div className="apy-footnote-card">
          <div className="font-semibold text-purple-light margin-bottom-sm">🔍 Fórmula Matématica Exacta On-Chain:</div>
          <code>Rendimiento_Anual_USD = Σ (Ubicación_USD_i × Tasa_i) + Comisiones_Protocolo_USDC</code>
          <div className="margin-top-md text-xs">
            Tasa APY Base = (Total_Generado_USD / Reservas_Totales_USD) = ({totalAnnualYieldUSD.toFixed(2)} / {numericAssetsUSD.toFixed(2)}) = <strong>{realTimeBaseApyPct.toFixed(3)}% APR</strong>
          </div>
        </div>

        {/* Close Button */}
        <div className="margin-top-xl text-center">
          <button
            className="btn-primary apy-confirm-btn"
            onClick={onClose}
          >
            ✅ Entendido y Verificado
          </button>
        </div>
      </div>
    </div>
  );
};
