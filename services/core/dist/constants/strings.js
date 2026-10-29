"use strict";
/**
 * Alpha Centauri Protocol - Centralized Backend Strings & Logging Dictionary
 *
 * Centralizes all service log messages, error templates, audit status keys,
 * and watchdog alert descriptions across core microservices and indexers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BACKEND_STRINGS = void 0;
exports.BACKEND_STRINGS = {
    SERVICES: {
        CORE_START: '[*] Starting Alpha Centauri Core Management Service...',
        CORE_CRASH: '[!] Core runtime crash:',
        REDIS_SUB_ERROR: '[!] Failed to subscribe to Redis events channel:',
        REDIS_SUB_SUCCESS: (channel) => `[+] Subscribed to real-time events channel: "${channel}"`,
        EVENT_RECEIVED: (type, txHash) => `[Event Received] ${type} - Tx: ${txHash}`,
        EVENT_PROCESS_ERROR: '[!] Error processing event message:',
        EVENT_UNHANDLED: (type) => `[Info] Unhandled event category: ${type}`,
        CIRCUIT_BREAKER_TRIGGERED: (asset, dropPercentage) => `[WARNING] Circuit breaker triggered for asset ${asset} due to ${dropPercentage}% drop!`,
        FLASHBOTS_FALLBACK: '[FlashbotsPrivateRelay] Fallback to standard transmission:'
    },
    WATCHDOG: {
        LOAN_EXPIRED_AND_UNDERCOLLATERALIZED: (elapsedDays, durationDays, healthFactor) => `Loan expired (${elapsedDays}d > ${durationDays}d) and under-collateralized (HF: ${healthFactor.toFixed(2)})`,
        LOAN_EXPIRED: (durationDays) => `Loan expired: duration ${durationDays} days exceeded`,
        COLLATERAL_BREACHED: (healthFactor, threshold) => `Collateral ratio breached: Health Factor ${healthFactor.toFixed(2)} < ${threshold.toFixed(2)}`
    },
    RECONCILER: {
        STATUS_SOLVENT_EXACT: 'SOLVENT_EXACT',
        STATUS_SOLVENT_ACCEPTABLE_VARIANCE: 'SOLVENT_ACCEPTABLE_VARIANCE',
        STATUS_DISCREPANCY_ALERT: 'DISCREPANCY_ALERT'
    },
    RPC: {
        ERR_NO_ENDPOINTS: '[ResilientRpcManager] At least one RPC endpoint must be provided.',
        ERR_ALL_FAILED: (count, lastError) => `[ResilientRpcManager] All ${count} RPC endpoints failed. Last error: ${lastError}`,
        WARN_CALL_FAILED: (url, attempts, error) => `[ResilientRpcManager] Call failed on ${url} (attempts: ${attempts}): ${error}`
    },
    LEDGER: {
        ERR_DOUBLE_ENTRY_VIOLATION: (debits, credits, deviation) => `[IdempotentLedger] Double-entry equilibrium violated: Debits (${debits}) != Credits (${credits}). Deviation: ${deviation}`,
        USER_REDEEM_DESC: (user) => `User ${user} redeemed shares at NAV`,
        CORP_INJECTION_DESC: (auditRef) => `Corporate contribution received: Ref ${auditRef}`,
        TWAP_BUYBACK_DESC: (orderId) => `TWAP Buyback Step Executed for Order ${orderId}`
    },
    INDEXER: {
        HANDLER_ERROR: (eventName, txHash) => `[BlockIndexer] Error processing handler for ${eventName} (tx: ${txHash}):`,
        LOGS_QUERY_NOTE: (eventName, error) => `[BlockIndexer] Note querying ${eventName}: ${error}`,
        POLLING_ERROR: '[BlockIndexer] Polling error:'
    },
    SAFETY: {
        ERR_TOTAL_ALLOCATION: (totalPct) => `Total allocation must equal 100% (currently ${totalPct}%)`,
        ERR_STABLES_BOUNDS: (weightPct) => `Stablecoins weight (${weightPct}%) is outside bounds [40% - 60%]`,
        ERR_WBTC_BOUNDS: (weightPct) => `WBTC weight (${weightPct}%) is outside bounds [20% - 30%]`,
        ERR_WETH_BOUNDS: (weightPct) => `WETH weight (${weightPct}%) is outside bounds [10% - 15%]`,
        ERR_ALTS_BOUNDS: (weightPct) => `Top 20 Altcoins weight (${weightPct}%) is outside bounds [5% - 15%]`
    }
};
//# sourceMappingURL=strings.js.map