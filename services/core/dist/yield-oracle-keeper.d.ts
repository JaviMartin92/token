export interface YieldFeedRate {
    assetClass: number;
    protocolName: string;
    vaultAddress: `0x${string}`;
    apyBps: number;
    apyPct: number;
    source: string;
    timestamp: number;
    isVerified: boolean;
}
export declare const CONSERVATIVE_SANITY_BOUNDS: Record<number, {
    minBps: number;
    maxBps: number;
    maxDeltaBps: number;
    label: string;
}>;
/**
 * Sourcing: Morpho Blue MetaMorpho Vault Net APY
 */
export declare function fetchMorphoUsdcApy(): Promise<YieldFeedRate>;
/**
 * Sourcing: Lido wstETH Staking APR
 */
export declare function fetchLidoEthApy(): Promise<YieldFeedRate>;
/**
 * Sourcing: Lombard LBTC Babylon Staking APY
 */
export declare function fetchLombardBtcApy(): Promise<YieldFeedRate>;
/**
 * Fetches all live rates concurrently
 */
export declare function fetchAllLiveYieldRates(): Promise<YieldFeedRate[]>;
/**
 * Validates a rate against conservative protocol survival bounds and anti-manipulation limits
 */
export declare function validateConservativeRate(rate: YieldFeedRate, currentOnChainBps?: number): {
    isValid: boolean;
    reason?: string;
};
/**
 * Synchronizes verified yield rates on-chain into DynamicYieldOracleRouter
 */
export declare function syncYieldRatesOnChain(customRpcUrl?: string, customKey?: string): Promise<({
    assetClass: number;
    updated: boolean;
    reason: string | undefined;
    txHash?: undefined;
    newBps?: undefined;
    error?: undefined;
} | {
    assetClass: number;
    updated: boolean;
    txHash: `0x${string}`;
    newBps: number;
    reason?: undefined;
    error?: undefined;
} | {
    assetClass: number;
    updated: boolean;
    error: any;
    reason?: undefined;
    txHash?: undefined;
    newBps?: undefined;
})[]>;
