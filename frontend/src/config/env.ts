import { z } from 'zod';

const envSchema = z.object({
  VITE_CHAIN_ID: z.coerce.number().default(31337),
  VITE_PUBLIC_RPC_URL: z.string().url().or(z.string().min(1)).default('http://127.0.0.1:8545'),
  VITE_WALLET_CONNECT_PROJECT_ID: z.string().optional(),
  VITE_ENABLE_ANALYTICS: z.coerce.boolean().default(false),
  MODE: z.string().default('development'),
  DEV: z.boolean().default(true),
  PROD: z.boolean().default(false)
});

function validateEnv() {
  const rawEnv = {
    VITE_CHAIN_ID: import.meta.env.VITE_CHAIN_ID,
    VITE_PUBLIC_RPC_URL: import.meta.env.VITE_PUBLIC_RPC_URL,
    VITE_WALLET_CONNECT_PROJECT_ID: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID,
    VITE_ENABLE_ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS,
    MODE: import.meta.env.MODE,
    DEV: import.meta.env.DEV,
    PROD: import.meta.env.PROD
  };

  const result = envSchema.safeParse(rawEnv);
  if (!result.success) {
    console.error('❌ [Alpha Centauri] Invalid environment configuration:', result.error.format());
    throw new Error(`[Config] Environment validation failed: ${result.error.message}`);
  }

  return result.data;
}

export const ENV = validateEnv();
