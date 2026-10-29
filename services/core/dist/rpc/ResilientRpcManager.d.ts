import { type PublicClient } from 'viem';
export interface RpcEndpointStatus {
    url: string;
    isHealthy: boolean;
    latencyMs: number;
    lastChecked: number;
    consecutiveFailures: number;
}
export interface ResilientRpcConfig {
    endpoints: string[];
    maxRetries?: number;
    timeoutMs?: number;
    healthCheckIntervalMs?: number;
}
export declare class ResilientRpcManager {
    private config;
    private statuses;
    private clients;
    private maxRetries;
    private timeoutMs;
    constructor(config: ResilientRpcConfig);
    /**
     * Returns all endpoint statuses for telemetry
     */
    getStatusList(): RpcEndpointStatus[];
    /**
     * Returns the primary or fastest healthy PublicClient
     */
    getHealthyClient(): {
        client: PublicClient;
        endpoint: string;
    };
    /**
     * Executes a Web3 read/call with automatic failover across endpoints
     */
    executeWithFallback<T>(operation: (client: PublicClient) => Promise<T>): Promise<T>;
    /**
     * Performs proactive ping health-checks on all configured endpoints
     */
    checkAllHealth(): Promise<RpcEndpointStatus[]>;
}
