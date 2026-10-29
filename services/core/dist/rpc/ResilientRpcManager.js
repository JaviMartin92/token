"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResilientRpcManager = void 0;
const viem_1 = require("viem");
const strings_js_1 = require("../constants/strings.js");
class ResilientRpcManager {
    config;
    statuses = new Map();
    clients = new Map();
    maxRetries;
    timeoutMs;
    constructor(config) {
        this.config = config;
        if (!config.endpoints || config.endpoints.length === 0) {
            throw new Error(strings_js_1.BACKEND_STRINGS.RPC.ERR_NO_ENDPOINTS);
        }
        this.maxRetries = config.maxRetries ?? 3;
        this.timeoutMs = config.timeoutMs ?? 5000;
        for (const url of config.endpoints) {
            this.statuses.set(url, {
                url,
                isHealthy: true,
                latencyMs: 0,
                lastChecked: Date.now(),
                consecutiveFailures: 0
            });
            this.clients.set(url, (0, viem_1.createPublicClient)({
                transport: (0, viem_1.http)(url, { timeout: this.timeoutMs })
            }));
        }
    }
    /**
     * Returns all endpoint statuses for telemetry
     */
    getStatusList() {
        return Array.from(this.statuses.values());
    }
    /**
     * Returns the primary or fastest healthy PublicClient
     */
    getHealthyClient() {
        // Find healthy endpoints sorted by latency
        const healthy = Array.from(this.statuses.values())
            .filter((s) => s.isHealthy)
            .sort((a, b) => a.latencyMs - b.latencyMs);
        const targetUrl = healthy.length > 0 ? healthy[0].url : this.config.endpoints[0];
        const client = this.clients.get(targetUrl) || this.clients.values().next().value;
        return { client, endpoint: targetUrl };
    }
    /**
     * Executes a Web3 read/call with automatic failover across endpoints
     */
    async executeWithFallback(operation) {
        const endpointsToTry = Array.from(this.statuses.values())
            .sort((a, b) => {
            if (a.isHealthy === b.isHealthy)
                return a.latencyMs - b.latencyMs;
            return a.isHealthy ? -1 : 1;
        })
            .map((s) => s.url);
        let lastError;
        for (const url of endpointsToTry) {
            const client = this.clients.get(url);
            const status = this.statuses.get(url);
            try {
                const start = Date.now();
                const result = await operation(client);
                const latency = Date.now() - start;
                // Record success
                status.isHealthy = true;
                status.latencyMs = latency;
                status.consecutiveFailures = 0;
                status.lastChecked = Date.now();
                return result;
            }
            catch (err) {
                lastError = err;
                status.consecutiveFailures += 1;
                if (status.consecutiveFailures >= 2) {
                    status.isHealthy = false;
                }
                status.lastChecked = Date.now();
                console.warn(strings_js_1.BACKEND_STRINGS.RPC.WARN_CALL_FAILED(url, status.consecutiveFailures, err.message || err));
            }
        }
        throw new Error(strings_js_1.BACKEND_STRINGS.RPC.ERR_ALL_FAILED(endpointsToTry.length, lastError?.message || lastError));
    }
    /**
     * Performs proactive ping health-checks on all configured endpoints
     */
    async checkAllHealth() {
        const results = await Promise.allSettled(this.config.endpoints.map(async (url) => {
            const client = this.clients.get(url);
            const status = this.statuses.get(url);
            const start = Date.now();
            try {
                await client.getBlockNumber();
                status.latencyMs = Date.now() - start;
                status.isHealthy = true;
                status.consecutiveFailures = 0;
            }
            catch {
                status.isHealthy = false;
                status.consecutiveFailures += 1;
            }
            status.lastChecked = Date.now();
            return status;
        }));
        return results
            .filter((r) => r.status === 'fulfilled')
            .map((r) => r.value);
    }
}
exports.ResilientRpcManager = ResilientRpcManager;
//# sourceMappingURL=ResilientRpcManager.js.map