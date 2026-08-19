/**
 * Alpha Centauri Protocol - Centralized Backend Strings & Logging Dictionary
 * 
 * Centralizes all service log messages, error templates, audit status keys,
 * and watchdog alert descriptions across core microservices and indexers.
 */

export const BACKEND_STRINGS = {
  SERVICES: {
    CORE_START: '[*] Starting Alpha Centauri Core Management Service...',
    CORE_CRASH: '[!] Core runtime crash:',
    REDIS_SUB_ERROR: '[!] Failed to subscribe to Redis events channel:',
    REDIS_SUB_SUCCESS: (channel: string) => `[+] Subscribed to real-time events channel: "${channel}"`,
    EVENT_RECEIVED: (type: string, txHash: string) => `[Event Received] ${type} - Tx: ${txHash}`,
    EVENT_PROCESS_ERROR: '[!] Error processing event message:',
    EVENT_UNHANDLED: (type: string) => `[Info] Unhandled event category: ${type}`,
    CIRCUIT_BREAKER_TRIGGERED: (asset: string, dropPercentage: number) => `[WARNING] Circuit breaker triggered for asset ${asset} due to ${dropPercentage}% drop!`,
    FLASHBOTS_FALLBACK: '[FlashbotsPrivateRelay] Fallback to standard transmission:'
  },

  WATCHDOG: {
    LOAN_EXPIRED_AND_UNDERCOLLATERALIZED: (elapsedDays: number, durationDays: number, healthFactor: number) =>
      `Loan expired (${elapsedDays}d > ${durationDays}d) and under-collateralized (HF: ${healthFactor.toFixed(2)})`,
    LOAN_EXPIRED: (durationDays: number) =>
      `Loan expired: duration ${durationDays} days exceeded`,
    COLLATERAL_BREACHED: (healthFactor: number, threshold: number) =>
      `Collateral ratio breached: Health Factor ${healthFactor.toFixed(2)} < ${threshold.toFixed(2)}`
  },

  RECONCILER: {
    STATUS_SOLVENT_EXACT: 'SOLVENT_EXACT',
    STATUS_SOLVENT_ACCEPTABLE_VARIANCE: 'SOLVENT_ACCEPTABLE_VARIANCE',
    STATUS_DISCREPANCY_ALERT: 'DISCREPANCY_ALERT'
  },

  RPC: {
    ERR_NO_ENDPOINTS: '[ResilientRpcManager] At least one RPC endpoint must be provided.',
    ERR_ALL_FAILED: (count: number, lastError: string) => `[ResilientRpcManager] All ${count} RPC endpoints failed. Last error: ${lastError}`,
    WARN_CALL_FAILED: (url: string, attempts: number, error: string) => `[ResilientRpcManager] Call failed on ${url} (attempts: ${attempts}): ${error}`
  },

  LEDGER: {
    ERR_DOUBLE_ENTRY_VIOLATION: (debits: number, credits: number, deviation: number) =>
      `[IdempotentLedger] Double-entry equilibrium violated: Debits (${debits}) != Credits (${credits}). Deviation: ${deviation}`,
    USER_REDEEM_DESC: (user: string) => `User ${user} redeemed shares at NAV`,
    CORP_INJECTION_DESC: (auditRef: string) => `Corporate contribution received: Ref ${auditRef}`,
    TWAP_BUYBACK_DESC: (orderId: string) => `TWAP Buyback Step Executed for Order ${orderId}`
  },

  INDEXER: {
    HANDLER_ERROR: (eventName: string, txHash: string) => `[BlockIndexer] Error processing handler for ${eventName} (tx: ${txHash}):`,
    LOGS_QUERY_NOTE: (eventName: string, error: string) => `[BlockIndexer] Note querying ${eventName}: ${error}`,
    POLLING_ERROR: '[BlockIndexer] Polling error:'
  },

  SAFETY: {
    ERR_TOTAL_ALLOCATION: (totalPct: number) => `Total allocation must equal 100% (currently ${totalPct}%)`,
    ERR_STABLES_BOUNDS: (weightPct: number) => `Stablecoins weight (${weightPct}%) is outside bounds [40% - 60%]`,
    ERR_WBTC_BOUNDS: (weightPct: number) => `WBTC weight (${weightPct}%) is outside bounds [20% - 30%]`,
    ERR_WETH_BOUNDS: (weightPct: number) => `WETH weight (${weightPct}%) is outside bounds [10% - 15%]`,
    ERR_ALTS_BOUNDS: (weightPct: number) => `Top 20 Altcoins weight (${weightPct}%) is outside bounds [5% - 15%]`
  }
} as const;
