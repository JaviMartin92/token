"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.CONFIG = {
    ARBITRUM_RPC_URL: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    // Deployed smart contracts to monitor
    TREASURY_ADDRESS: (process.env.TREASURY_ADDRESS || '0x0000000000000000000000000000000000000000'),
    CIRCUIT_BREAKER_ADDRESS: (process.env.CIRCUIT_BREAKER_ADDRESS || '0x0000000000000000000000000000000000000000'),
    CORPORATE_CONTRIBUTION_ADDRESS: (process.env.CORPORATE_CONTRIBUTION_ADDRESS || '0x0000000000000000000000000000000000000000'),
};
//# sourceMappingURL=config.js.map