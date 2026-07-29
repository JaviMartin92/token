import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const CONFIG = {
  ARBITRUM_RPC_URL: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // Deployed smart contracts to monitor
  TREASURY_ADDRESS: (process.env.TREASURY_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`,
  CIRCUIT_BREAKER_ADDRESS: (process.env.CIRCUIT_BREAKER_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`,
  CORPORATE_CONTRIBUTION_ADDRESS: (process.env.CORPORATE_CONTRIBUTION_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`,
};
