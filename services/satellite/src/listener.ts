import { createPublicClient, http, parseAbiItem } from 'viem';
import { arbitrum } from 'viem/chains';
import Redis from 'ioredis';
import { CONFIG } from './config.js';

const redis = new Redis(CONFIG.REDIS_URL);
const channel = 'alpha_centauri_events';

const client = createPublicClient({
  chain: arbitrum,
  transport: http(CONFIG.ARBITRUM_RPC_URL),
});

let lastProcessedBlock = 0n;

/**
 * Initializes listeners for smart contract events on Arbitrum One
 * Enforces a 2-block confirmation delay to mitigate block reorg risks.
 */
export function startEventListener() {
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
      if (CONFIG.TREASURY_ADDRESS !== '0x0000000000000000000000000000000000000000') {
        const redemptionLogs = await client.getLogs({
          address: CONFIG.TREASURY_ADDRESS,
          event: parseAbiItem('event Redeemed(address indexed user, uint256 sharesBurned, uint256 assetAmountOut, uint256 feeCharged)'),
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
      if (CONFIG.CORPORATE_CONTRIBUTION_ADDRESS !== '0x0000000000000000000000000000000000000000') {
        const contributionLogs = await client.getLogs({
          address: CONFIG.CORPORATE_CONTRIBUTION_ADDRESS,
          event: parseAbiItem('event ContributionReceived(uint256 amount, string auditRef)'),
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
          address: CONFIG.CORPORATE_CONTRIBUTION_ADDRESS,
          event: parseAbiItem('event TwapStepExecuted(uint256 indexed orderId, uint256 tokensBought, uint256 costUsdc)'),
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
      if (CONFIG.CIRCUIT_BREAKER_ADDRESS !== '0x0000000000000000000000000000000000000000') {
        const circuitLogs = await client.getLogs({
          address: CONFIG.CIRCUIT_BREAKER_ADDRESS,
          event: parseAbiItem('event CircuitTriggered(address indexed asset, uint256 dropPercentage, uint256 timestamp)'),
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
    } catch (err) {
      console.error('[!] Error in confirmed logs polling cycle:', err);
    }
  }, 3000);

  console.log('[+] Polling listener started successfully.');
}

function publishEvent(type: string, txHash: string | null, payload: any) {
  const eventMsg = {
    type,
    txHash: txHash || '0x0',
    timestamp: new Date().toISOString(),
    payload,
  };

  redis.publish(channel, JSON.stringify(eventMsg));
  console.log(`[Satellite] [Confirmed block log] ${type} -> published to Redis`);
}
