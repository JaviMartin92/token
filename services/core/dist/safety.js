"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPortfolioSanityBounds = checkPortfolioSanityBounds;
/**
 * Validates portfolio weights against hardcoded protocol safety bounds.
 */
function checkPortfolioSanityBounds(weights) {
    const errors = [];
    // Total weight check (should sum to 100%)
    const total = weights.stablecoins + weights.wbtc + weights.weth + weights.top20Altcoins;
    if (Math.abs(total - 1.0) > 0.0001) {
        errors.push(`Total allocation must equal 100% (currently ${total * 100}%)`);
    }
    // individual bounds check
    if (weights.stablecoins < 0.40 || weights.stablecoins > 0.60) {
        errors.push(`Stablecoins weight (${weights.stablecoins * 100}%) is outside bounds [40% - 60%]`);
    }
    if (weights.wbtc < 0.20 || weights.wbtc > 0.30) {
        errors.push(`WBTC weight (${weights.wbtc * 100}%) is outside bounds [20% - 30%]`);
    }
    if (weights.weth < 0.10 || weights.weth > 0.15) {
        errors.push(`WETH weight (${weights.weth * 100}%) is outside bounds [10% - 15%]`);
    }
    if (weights.top20Altcoins < 0.05 || weights.top20Altcoins > 0.15) {
        errors.push(`Top 20 Altcoins weight (${weights.top20Altcoins * 100}%) is outside bounds [5% - 15%]`);
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
//# sourceMappingURL=safety.js.map