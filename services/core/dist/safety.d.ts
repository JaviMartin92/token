export interface PortfolioWeights {
    stablecoins: number;
    wbtc: number;
    weth: number;
    top20Altcoins: number;
}
/**
 * Validates portfolio weights against hardcoded protocol safety bounds.
 */
export declare function checkPortfolioSanityBounds(weights: PortfolioWeights): {
    valid: boolean;
    errors: string[];
};
