/**
 * Initializes listeners for smart contract events on Arbitrum One
 * Enforces a 2-block confirmation delay to mitigate block reorg risks.
 */
export declare function startEventListener(): void;
