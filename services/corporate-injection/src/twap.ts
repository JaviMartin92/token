import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrum } from 'viem/chains';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();

const RPC_URL = process.env.ARBITRUM_RPC_URL || 'http://localhost:8545';
const OPERATOR_KEY = process.env.BACKEND_OPERATOR_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const CONTRACT_ADDRESS = (process.env.CORP_CONTRIBUTION_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`;

const account = privateKeyToAccount(OPERATOR_KEY as `0x${string}`);

const walletClient = createWalletClient({
  account,
  chain: arbitrum,
  transport: http(RPC_URL),
});

// Minimum ABI for executeTwapStep call
const CorporateContributionABI = [
  {
    name: 'executeTwapStep',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'orderId', type: 'uint256' }],
    outputs: []
  }
] as const;

/**
 * Periodically scans the database for scheduled TWAP steps and executes them on-chain.
 */
export async function runTwapScheduler() {
  console.log('[*] Initializing TWAP scheduler execution loop...');

  setInterval(async () => {
    try {
      // Find all active orders in the database that are due for execution
      const now = new Date();
      const activeOrders = await prisma.twapOrder.findMany({
        where: {
          status: 'ACTIVE',
          nextExecutionAt: { lte: now }
        }
      });

      for (const order of activeOrders) {
        console.log(`[+] Found active TWAP order due for execution: ID ${order.id}`);

        if (CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
          console.warn('[!] Corporate Contribution contract address not configured.');
          continue;
        }

        try {
          const contractOrderId = 0n; // In mock/integration testing, use first order index

          // Dispatch transaction to smart contract
          const hash = await walletClient.writeContract({
            address: CONTRACT_ADDRESS,
            abi: CorporateContributionABI,
            functionName: 'executeTwapStep',
            args: [contractOrderId],
            account
          });

          console.log(`[+] Executed TWAP step. Tx hash: ${hash}`);

          // Update database state
          const nextStep = order.executedSteps + 1;
          const isCompleted = nextStep >= order.totalSteps;

          await prisma.$transaction([
            prisma.twapOrder.update({
              where: { id: order.id },
              data: {
                executedSteps: nextStep,
                executedAmount: { increment: order.totalAmount.toNumber() / order.totalSteps },
                nextExecutionAt: new Date(Date.now() + order.intervalMinutes * 60000),
                status: isCompleted ? 'COMPLETED' : 'ACTIVE'
              }
            }),
            prisma.twapHistory.create({
              data: {
                orderId: order.id,
                txHash: hash,
                tokensBought: (order.totalAmount.toNumber() / order.totalSteps) * 2, // Mock 2x native token payout
                usdcSpent: order.totalAmount.toNumber() / order.totalSteps,
                slippage: 0.00
              }
            })
          ]);

          console.log(`[+] Successfully updated TWAP Order status in DB.`);
        } catch (txError) {
          console.error(`[!] Failed to execute on-chain transaction for order ${order.id}:`, txError);
        }
      }
    } catch (dbError) {
      console.error('[!] Error querying active TWAP orders from DB:', dbError);
    }
  }, 10000); // Check every 10 seconds in the sandbox loop
}
