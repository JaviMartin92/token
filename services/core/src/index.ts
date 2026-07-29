import dotenv from 'dotenv';
import Redis from 'ioredis';
import { connectDb, prisma } from './database.js';
import { recordLedgerTransaction } from './ledger.js';
import { ReferenceType } from '@prisma/client';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function main() {
  console.log('[*] Starting Alpha Centauri Core Management Service...');
  
  // 1. Database Connection
  await connectDb();

  // 2. Redis Subscription Setup
  const redis = new Redis(REDIS_URL);
  const channel = 'alpha_centauri_events';

  redis.subscribe(channel, (err) => {
    if (err) {
      console.error('[!] Failed to subscribe to Redis events channel:', err);
    } else {
      console.log(`[+] Subscribed to real-time events channel: "${channel}"`);
    }
  });

  redis.on('message', async (chan, msg) => {
    if (chan === channel) {
      try {
        const event = JSON.parse(msg);
        console.log(`[Event Received] ${event.type} - Tx: ${event.txHash}`);
        
        await handleBlockchainEvent(event);
      } catch (error) {
        console.error('[!] Error processing event message:', error);
      }
    }
  });
}

interface Web3Event {
  type: string;
  txHash: string;
  payload: any;
}

/**
 * Handles incoming web3 transaction logs and records audit ledger entries.
 */
async function handleBlockchainEvent(event: Web3Event) {
  const { txHash } = event;

  switch (event.type) {
    case 'TREASURY_REDEEMED': {
      const { user, sharesBurned, assetAmountOut, feeCharged } = event.payload;
      
      // Calculate total assets redeemed in USD/USDC equivalent
      const burnedVal = (parseFloat(assetAmountOut) + parseFloat(feeCharged)).toString();

      await recordLedgerTransaction(
        `User ${user} redeemed shares at NAV`,
        ReferenceType.REDEMPTION,
        txHash,
        [
          {
            accountCode: 'USER_EQUITY',
            debit: burnedVal,
            credit: '0.0',
            assetAddress: 'SHARES_TOKEN_MOCK'
          },
          {
            accountCode: 'TREASURY_LIQUID_USDC',
            debit: '0.0',
            credit: assetAmountOut,
            assetAddress: 'USDC_TOKEN_MOCK'
          },
          {
            accountCode: 'TREASURY_FEE_INCOME',
            debit: '0.0',
            credit: feeCharged,
            assetAddress: 'USDC_TOKEN_MOCK'
          }
        ]
      );
      break;
    }

    case 'CORPORATE_CONTRIBUTION_INJECTED': {
      const { amount, auditRef } = event.payload;
      await recordLedgerTransaction(
        `Corporate contribution received: Ref ${auditRef}`,
        ReferenceType.CORP_INJECTION,
        txHash,
        [
          {
            accountCode: 'TREASURY_LIQUID_USDC',
            debit: amount,
            credit: '0.0',
            assetAddress: 'USDC_TOKEN_MOCK'
          },
          {
            accountCode: 'CORPORATE_EQUITY',
            debit: '0.0',
            credit: amount,
            assetAddress: 'USDC_TOKEN_MOCK'
          }
        ]
      );
      break;
    }

    case 'TWAP_STEP_EXECUTED': {
      const { orderId, tokensBought, costUsdc } = event.payload;
      
      const half = (parseFloat(tokensBought) / 2).toString();
      const otherHalf = (parseFloat(tokensBought) - parseFloat(half)).toString();

      // Double-entry record for the TWAP trade (representing assets movements)
      await recordLedgerTransaction(
        `TWAP Buyback Step Executed for Order ${orderId}`,
        ReferenceType.REBALANCE,
        txHash,
        [
          {
            accountCode: 'TREASURY_STAKED_NATIVE',
            debit: half,
            credit: '0.0',
            assetAddress: 'NATIVE_TOKEN_MOCK'
          },
          {
            accountCode: 'DEAD_BURN_ADDRESS',
            debit: otherHalf,
            credit: '0.0',
            assetAddress: 'NATIVE_TOKEN_MOCK'
          },
          {
            accountCode: 'SWAP_ROUTER_CLEARING',
            debit: '0.0',
            credit: tokensBought,
            assetAddress: 'NATIVE_TOKEN_MOCK'
          }
        ]
      );
      break;
    }

    case 'CIRCUIT_BREAKER_TRIGGERED': {
      const { asset, dropPercentage } = event.payload;
      console.warn(`[WARNING] Circuit breaker triggered for asset ${asset} due to ${dropPercentage}% drop!`);
      // Update internal status...
      break;
    }

    default:
      console.log(`[Info] Unhandled event category: ${event.type}`);
  }
}

main().catch((error) => {
  console.error('[!] Core runtime crash:', error);
});
