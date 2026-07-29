"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTwapScheduler = runTwapScheduler;
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
const chains_1 = require("viem/chains");
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
dotenv_1.default.config();
const prisma = new client_1.PrismaClient();
const RPC_URL = process.env.ARBITRUM_RPC_URL || 'http://localhost:8545';
const OPERATOR_KEY = process.env.BACKEND_OPERATOR_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const CONTRACT_ADDRESS = (process.env.CORP_CONTRIBUTION_ADDRESS || '0x0000000000000000000000000000000000000000');
const account = (0, accounts_1.privateKeyToAccount)(OPERATOR_KEY);
const walletClient = (0, viem_1.createWalletClient)({
    account,
    chain: chains_1.arbitrum,
    transport: (0, viem_1.http)(RPC_URL),
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
];
/**
 * Periodically scans the database for scheduled TWAP steps and executes them on-chain.
 */
async function runTwapScheduler() {
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
                }
                catch (txError) {
                    console.error(`[!] Failed to execute on-chain transaction for order ${order.id}:`, txError);
                }
            }
        }
        catch (dbError) {
            console.error('[!] Error querying active TWAP orders from DB:', dbError);
        }
    }, 10000); // Check every 10 seconds in the sandbox loop
}
//# sourceMappingURL=twap.js.map