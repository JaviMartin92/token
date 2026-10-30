"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const ioredis_1 = __importDefault(require("ioredis"));
const database_js_1 = require("./database.js");
const ledger_js_1 = require("./ledger.js");
const client_1 = require("@prisma/client");
const strings_js_1 = require("./constants/strings.js");
dotenv_1.default.config();
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
async function main() {
    console.log(strings_js_1.BACKEND_STRINGS.SERVICES.CORE_START);
    // 1. Database Connection
    await (0, database_js_1.connectDb)();
    // 2. Redis Subscription Setup
    const redis = new ioredis_1.default(REDIS_URL);
    const channel = 'alpha_centauri_events';
    redis.subscribe(channel, (err) => {
        if (err) {
            console.error(strings_js_1.BACKEND_STRINGS.SERVICES.REDIS_SUB_ERROR, err);
        }
        else {
            console.log(strings_js_1.BACKEND_STRINGS.SERVICES.REDIS_SUB_SUCCESS(channel));
        }
    });
    redis.on('message', async (chan, msg) => {
        if (chan === channel) {
            try {
                const event = JSON.parse(msg);
                console.log(strings_js_1.BACKEND_STRINGS.SERVICES.EVENT_RECEIVED(event.type, event.txHash));
                await handleBlockchainEvent(event);
            }
            catch (error) {
                console.error(strings_js_1.BACKEND_STRINGS.SERVICES.EVENT_PROCESS_ERROR, error);
            }
        }
    });
}
/**
 * Handles incoming web3 transaction logs and records audit ledger entries.
 */
async function handleBlockchainEvent(event) {
    const { txHash } = event;
    switch (event.type) {
        case 'TREASURY_REDEEMED': {
            const { user, sharesBurned, assetAmountOut, feeCharged = '0' } = event.payload;
            // Calculate total assets redeemed in USD/USDC equivalent safely with BigInt precision
            const feeBig = BigInt(feeCharged && !isNaN(Number(feeCharged)) ? feeCharged : '0');
            const outBig = BigInt(assetAmountOut && !isNaN(Number(assetAmountOut)) ? assetAmountOut : '0');
            const burnedVal = (outBig + feeBig).toString();
            await (0, ledger_js_1.recordLedgerTransaction)(strings_js_1.BACKEND_STRINGS.LEDGER.USER_REDEEM_DESC(user), client_1.ReferenceType.REDEMPTION, txHash, [
                {
                    accountCode: 'USER_EQUITY',
                    debit: burnedVal,
                    credit: '0.0',
                    assetAddress: 'USDC_TOKEN_MOCK'
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
            ]);
            break;
        }
        case 'CORPORATE_CONTRIBUTION_INJECTED': {
            const { amount, auditRef } = event.payload;
            await (0, ledger_js_1.recordLedgerTransaction)(strings_js_1.BACKEND_STRINGS.LEDGER.CORP_INJECTION_DESC(auditRef), client_1.ReferenceType.CORP_INJECTION, txHash, [
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
            ]);
            break;
        }
        case 'TWAP_STEP_EXECUTED': {
            const { orderId, tokensBought, costUsdc } = event.payload;
            const tokensBoughtBig = BigInt(tokensBought && !isNaN(Number(tokensBought)) ? tokensBought : '0');
            const halfBig = tokensBoughtBig / 2n;
            const otherHalfBig = tokensBoughtBig - halfBig;
            const half = halfBig.toString();
            const otherHalf = otherHalfBig.toString();
            // Double-entry record for the TWAP trade (representing assets movements)
            await (0, ledger_js_1.recordLedgerTransaction)(strings_js_1.BACKEND_STRINGS.LEDGER.TWAP_BUYBACK_DESC(orderId), client_1.ReferenceType.REBALANCE, txHash, [
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
            ]);
            break;
        }
        case 'CIRCUIT_BREAKER_TRIGGERED': {
            const { asset, dropPercentage } = event.payload;
            console.warn(strings_js_1.BACKEND_STRINGS.SERVICES.CIRCUIT_BREAKER_TRIGGERED(asset, dropPercentage));
            // Update internal status...
            break;
        }
        default:
            console.log(strings_js_1.BACKEND_STRINGS.SERVICES.EVENT_UNHANDLED(event.type));
    }
}
main().catch((error) => {
    console.error(strings_js_1.BACKEND_STRINGS.SERVICES.CORE_CRASH, error);
});
//# sourceMappingURL=index.js.map