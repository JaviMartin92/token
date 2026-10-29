/**
 * Alpha Centauri Protocol - Centralized Backend Strings & Logging Dictionary
 *
 * Centralizes all service log messages, error templates, audit status keys,
 * and watchdog alert descriptions across core microservices and indexers.
 */
export declare const BACKEND_STRINGS: {
    readonly SERVICES: {
        readonly CORE_START: "[*] Starting Alpha Centauri Core Management Service...";
        readonly CORE_CRASH: "[!] Core runtime crash:";
        readonly REDIS_SUB_ERROR: "[!] Failed to subscribe to Redis events channel:";
        readonly REDIS_SUB_SUCCESS: (channel: string) => string;
        readonly EVENT_RECEIVED: (type: string, txHash: string) => string;
        readonly EVENT_PROCESS_ERROR: "[!] Error processing event message:";
        readonly EVENT_UNHANDLED: (type: string) => string;
        readonly CIRCUIT_BREAKER_TRIGGERED: (asset: string, dropPercentage: number) => string;
        readonly FLASHBOTS_FALLBACK: "[FlashbotsPrivateRelay] Fallback to standard transmission:";
    };
    readonly WATCHDOG: {
        readonly LOAN_EXPIRED_AND_UNDERCOLLATERALIZED: (elapsedDays: number, durationDays: number, healthFactor: number) => string;
        readonly LOAN_EXPIRED: (durationDays: number) => string;
        readonly COLLATERAL_BREACHED: (healthFactor: number, threshold: number) => string;
    };
    readonly RECONCILER: {
        readonly STATUS_SOLVENT_EXACT: "SOLVENT_EXACT";
        readonly STATUS_SOLVENT_ACCEPTABLE_VARIANCE: "SOLVENT_ACCEPTABLE_VARIANCE";
        readonly STATUS_DISCREPANCY_ALERT: "DISCREPANCY_ALERT";
    };
    readonly RPC: {
        readonly ERR_NO_ENDPOINTS: "[ResilientRpcManager] At least one RPC endpoint must be provided.";
        readonly ERR_ALL_FAILED: (count: number, lastError: string) => string;
        readonly WARN_CALL_FAILED: (url: string, attempts: number, error: string) => string;
    };
    readonly LEDGER: {
        readonly ERR_DOUBLE_ENTRY_VIOLATION: (debits: number, credits: number, deviation: number) => string;
        readonly USER_REDEEM_DESC: (user: string) => string;
        readonly CORP_INJECTION_DESC: (auditRef: string) => string;
        readonly TWAP_BUYBACK_DESC: (orderId: string) => string;
    };
    readonly INDEXER: {
        readonly HANDLER_ERROR: (eventName: string, txHash: string) => string;
        readonly LOGS_QUERY_NOTE: (eventName: string, error: string) => string;
        readonly POLLING_ERROR: "[BlockIndexer] Polling error:";
    };
    readonly SAFETY: {
        readonly ERR_TOTAL_ALLOCATION: (totalPct: number) => string;
        readonly ERR_STABLES_BOUNDS: (weightPct: number) => string;
        readonly ERR_WBTC_BOUNDS: (weightPct: number) => string;
        readonly ERR_WETH_BOUNDS: (weightPct: number) => string;
        readonly ERR_ALTS_BOUNDS: (weightPct: number) => string;
    };
};
