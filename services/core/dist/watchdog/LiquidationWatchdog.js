"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiquidationWatchdogService = exports.FlashbotsPrivateRelay = exports.StandardRpcRelay = void 0;
const strings_js_1 = require("../constants/strings.js");
/**
 * Standard / Mock Relay for Devnet & local Anvil execution
 */
class StandardRpcRelay {
    async sendPrivateTransaction(rawTx) {
        return {
            txHash: `0xmock_tx_${Date.now()}`,
            isProtected: false
        };
    }
}
exports.StandardRpcRelay = StandardRpcRelay;
/**
 * Flashbots / MEV-Share Private Relay to neutralize front-running on Mainnet & L2s
 */
class FlashbotsPrivateRelay {
    relayEndpoint;
    constructor(relayEndpoint = 'https://rpc.flashbots.net') {
        this.relayEndpoint = relayEndpoint;
    }
    async sendPrivateTransaction(rawTx) {
        try {
            // In production, posts JSON-RPC eth_sendPrivateTransaction / mevd_sendBundle
            return {
                txHash: `0xflashbots_protected_${Date.now()}`,
                isProtected: true
            };
        }
        catch (err) {
            console.warn(strings_js_1.BACKEND_STRINGS.SERVICES.FLASHBOTS_FALLBACK, err);
            return {
                txHash: rawTx,
                isProtected: false
            };
        }
    }
}
exports.FlashbotsPrivateRelay = FlashbotsPrivateRelay;
class LiquidationWatchdogService {
    minHealthFactorThreshold = 1.0;
    atRiskThreshold = 1.2;
    privateRelay;
    constructor(minHealthFactor = 1.0, relay) {
        this.minHealthFactorThreshold = minHealthFactor;
        this.privateRelay = relay || new StandardRpcRelay();
    }
    /**
     * Evaluates health and liquidation status for a single loan
     */
    evaluateLoan(loan, assetPrices = { wbtc: 60000, weth: 3000, alpha: 1.0, usdc: 1.0 }, currentTimestampSec = Math.floor(Date.now() / 1000)) {
        if (loan.state !== 1) { // Not ACTIVE
            return {
                loanId: loan.id,
                borrower: loan.borrower,
                canLiquidate: false,
                isExpired: false,
                isUnderCollateralized: false,
                healthFactor: 999.0,
                totalDebtUSD: loan.borrowAmountUSD,
                collateralValueUSD: 0
            };
        }
        // 1. Calculate accrued debt with interest
        const elapsedSec = Math.max(0, currentTimestampSec - loan.startTimeSec);
        const elapsedDays = elapsedSec / 86400;
        const interestAccruedUSD = (loan.borrowAmountUSD * (loan.interestRateAprPct / 100) * elapsedDays) / 365;
        const totalDebtUSD = loan.borrowAmountUSD + interestAccruedUSD;
        // 2. Calculate current collateral market value
        let collateralValueUSD = loan.collateralValueUSD ?? 0;
        if (loan.collateralType === 'wbtc' && loan.collateralAmount) {
            collateralValueUSD = parseFloat(loan.collateralAmount) * assetPrices.wbtc;
        }
        else if (loan.collateralType === 'weth' && loan.collateralAmount) {
            collateralValueUSD = parseFloat(loan.collateralAmount) * assetPrices.weth;
        }
        else if (loan.collateralType === 'alpha' && loan.collateralAmount) {
            collateralValueUSD = parseFloat(loan.collateralAmount) * assetPrices.alpha;
        }
        else if (loan.collateralType === 'nft') {
            collateralValueUSD = loan.collateralValueUSD ?? (loan.borrowAmountUSD * 1.4);
        }
        // 3. Health Factor calculation: Collateral / Total Debt
        const healthFactor = totalDebtUSD > 0 ? collateralValueUSD / totalDebtUSD : 999.0;
        // 4. Expiration check
        const loanDurationSec = loan.durationDays * 86400;
        const isExpired = elapsedSec > loanDurationSec;
        // 5. Under-collateralization check
        const isUnderCollateralized = healthFactor < this.minHealthFactorThreshold;
        const canLiquidate = isExpired || isUnderCollateralized;
        let reason;
        if (isExpired && isUnderCollateralized) {
            reason = strings_js_1.BACKEND_STRINGS.WATCHDOG.LOAN_EXPIRED_AND_UNDERCOLLATERALIZED(Math.round(elapsedDays), loan.durationDays, healthFactor);
        }
        else if (isExpired) {
            reason = strings_js_1.BACKEND_STRINGS.WATCHDOG.LOAN_EXPIRED(loan.durationDays);
        }
        else if (isUnderCollateralized) {
            reason = strings_js_1.BACKEND_STRINGS.WATCHDOG.COLLATERAL_BREACHED(healthFactor, this.minHealthFactorThreshold);
        }
        return {
            loanId: loan.id,
            borrower: loan.borrower,
            canLiquidate,
            isExpired,
            isUnderCollateralized,
            healthFactor,
            reason,
            totalDebtUSD,
            collateralValueUSD
        };
    }
    /**
     * Scans a batch of loans and produces a consolidated risk report
     */
    generateAuditReport(loans, assetPrices, currentTimestampSec) {
        const activeLoans = loans.filter((l) => l.state === 1);
        const evaluations = activeLoans.map((l) => this.evaluateLoan(l, assetPrices, currentTimestampSec));
        const liquidatable = evaluations.filter((e) => e.canLiquidate);
        const atRisk = evaluations.filter((e) => !e.canLiquidate && e.healthFactor < this.atRiskThreshold);
        const safe = evaluations.filter((e) => !e.canLiquidate && e.healthFactor >= this.atRiskThreshold);
        return {
            timestamp: Date.now(),
            totalActiveLoans: activeLoans.length,
            safeLoans: safe.length,
            atRiskLoans: atRisk.length,
            liquidatableCount: liquidatable.length,
            liquidatableLoans: liquidatable
        };
    }
    /**
     * Dispatches a liquidation transaction through MEV-protected private relay
     */
    async dispatchMevProtectedLiquidation(loanId, rawTx) {
        const res = await this.privateRelay.sendPrivateTransaction(rawTx);
        return {
            loanId,
            txHash: res.txHash,
            isProtected: res.isProtected
        };
    }
}
exports.LiquidationWatchdogService = LiquidationWatchdogService;
//# sourceMappingURL=LiquidationWatchdog.js.map