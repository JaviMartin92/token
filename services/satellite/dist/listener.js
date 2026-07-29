"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startEventListener = startEventListener;
const viem_1 = require("viem");
const chains_1 = require("viem/chains");
const ioredis_1 = __importDefault(require("ioredis"));
const config_js_1 = require("./config.js");
const redis = new ioredis_1.default(config_js_1.CONFIG.REDIS_URL);
const channel = 'alpha_centauri_events';
const client = (0, viem_1.createPublicClient)({
    chain: chains_1.arbitrum,
    transport: (0, viem_1.http)(config_js_1.CONFIG.ARBITRUM_RPC_URL),
});
let lastProcessedBlock = 0n;
/**
 * Initializes listeners for smart contract events on Arbitrum One
 * Enforces a 2-block confirmation delay to mitigate block reorg risks.
 */
function startEventListener() {
    console.log('[*] Initializing satellite event listeners with 2-block confirmation delay...');
    // Start the polling loop every 3 seconds
    setInterval(async () => {
        try {
            const currentBlock = await client.getBlockNumber();
            const targetBlock = currentBlock - 2n; // 2-block finality buffer
            if (lastProcessedBlock === 0n) {
                lastProcessedBlock = targetBlock - 10n; // Look back 10 blocks on startup
            }
            if (targetBlock <= lastProcessedBlock) {
                return;
            }
            const fromBlock = lastProcessedBlock + 1n;
            const toBlock = targetBlock;
            // 1. Poll Treasury Redemptions
            if (config_js_1.CONFIG.TREASURY_ADDRESS !== '0x0000000000000000000000000000000000000000') {
                const redemptionLogs = await client.getLogs({
                    address: config_js_1.CONFIG.TREASURY_ADDRESS,
                    event: (0, viem_1.parseAbiItem)('event Redeemed(address indexed user, uint256 sharesBurned, uint256 assetAmountOut, uint256 feeCharged)'),
                    fromBlock,
                    toBlock
                });
                for (const log of redemptionLogs) {
                    const { user, sharesBurned, assetAmountOut, feeCharged } = log.args;
                    if (user) {
                        publishEvent('TREASURY_REDEEMED', log.transactionHash, {
                            user,
                            sharesBurned: sharesBurned?.toString(),
                            assetAmountOut: assetAmountOut?.toString(),
                            feeCharged: feeCharged?.toString(),
                        });
                    }
                }
            }
            // 2. Poll Corporate Contributions and TWAP Executions
            if (config_js_1.CONFIG.CORPORATE_CONTRIBUTION_ADDRESS !== '0x0000000000000000000000000000000000000000') {
                const contributionLogs = await client.getLogs({
                    address: config_js_1.CONFIG.CORPORATE_CONTRIBUTION_ADDRESS,
                    event: (0, viem_1.parseAbiItem)('event ContributionReceived(uint256 amount, string auditRef)'),
                    fromBlock,
                    toBlock
                });
                for (const log of contributionLogs) {
                    const { amount, auditRef } = log.args;
                    if (amount) {
                        publishEvent('CORPORATE_CONTRIBUTION_INJECTED', log.transactionHash, {
                            amount: amount?.toString(),
                            auditRef,
                        });
                    }
                }
                const twapLogs = await client.getLogs({
                    address: config_js_1.CONFIG.CORPORATE_CONTRIBUTION_ADDRESS,
                    event: (0, viem_1.parseAbiItem)('event TwapStepExecuted(uint256 indexed orderId, uint256 tokensBought, uint256 costUsdc)'),
                    fromBlock,
                    toBlock
                });
                for (const log of twapLogs) {
                    const { orderId, tokensBought, costUsdc } = log.args;
                    if (orderId !== undefined) {
                        publishEvent('TWAP_STEP_EXECUTED', log.transactionHash, {
                            orderId: orderId?.toString(),
                            tokensBought: tokensBought?.toString(),
                            costUsdc: costUsdc?.toString(),
                        });
                    }
                }
            }
            // 3. Poll Circuit Breaker triggers
            if (config_js_1.CONFIG.CIRCUIT_BREAKER_ADDRESS !== '0x0000000000000000000000000000000000000000') {
                const circuitLogs = await client.getLogs({
                    address: config_js_1.CONFIG.CIRCUIT_BREAKER_ADDRESS,
                    event: (0, viem_1.parseAbiItem)('event CircuitTriggered(address indexed asset, uint256 dropPercentage, uint256 timestamp)'),
                    fromBlock,
                    toBlock
                });
                for (const log of circuitLogs) {
                    const { asset, dropPercentage, timestamp } = log.args;
                    if (asset) {
                        publishEvent('CIRCUIT_BREAKER_TRIGGERED', log.transactionHash, {
                            asset,
                            dropPercentage: dropPercentage?.toString(),
                            timestamp: timestamp?.toString(),
                        });
                    }
                }
            }
            // Progress watermark
            lastProcessedBlock = toBlock;
        }
        catch (err) {
            console.error('[!] Error in confirmed logs polling cycle:', err);
        }
    }, 3000);
    console.log('[+] Polling listener started successfully.');
}
function publishEvent(type, txHash, payload) {
    const eventMsg = {
        type,
        txHash: txHash || '0x0',
        timestamp: new Date().toISOString(),
        payload,
    };
    redis.publish(channel, JSON.stringify(eventMsg));
    console.log(`[Satellite] [Confirmed block log] ${type} -> published to Redis`);
}
//# sourceMappingURL=listener.js.map