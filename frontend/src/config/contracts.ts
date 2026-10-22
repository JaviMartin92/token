import { z } from 'zod';
import contractsJson from '../contracts.json';

const ethAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, { message: 'Must be a valid 40-character hexadecimal Ethereum address with 0x prefix' })
  .transform((val) => val as `0x${string}`);

const contractsConfigSchema = z.object({
  USDC: ethAddressSchema,
  USDT: ethAddressSchema,
  WBTC: ethAddressSchema,
  WETH: ethAddressSchema,
  TREASURY: ethAddressSchema,
  ALPHA_TOKEN: ethAddressSchema,
  CIRCUIT_BREAKER: ethAddressSchema,
  POSITION_NFT: ethAddressSchema,
  VESTED_VAULT: ethAddressSchema,
  P2P_MARKET: ethAddressSchema,
  STAKING: ethAddressSchema,
  REAL_YIELD_ROUTER: ethAddressSchema,
  YIELD_VAULT: ethAddressSchema.optional().default('0x0000000000000000000000000000000000000000' as `0x${string}`),
  COMMUNITY_YIELD_VAULT: ethAddressSchema,
  ALPHA_VAULT: ethAddressSchema.optional().default('0x0000000000000000000000000000000000000000' as `0x${string}`),
  PRICE_FEED: ethAddressSchema,
  PROMOTIONAL_VAULT: ethAddressSchema.optional().default('0x0000000000000000000000000000000000000000' as `0x${string}`),
  DYNAMIC_YIELD_ORACLE: ethAddressSchema.optional().default('0x0000000000000000000000000000000000000000' as `0x${string}`),
  GOVERNOR: ethAddressSchema.optional().default('0x0000000000000000000000000000000000000000' as `0x${string}`),
  TIMELOCK: ethAddressSchema.optional().default('0x0000000000000000000000000000000000000000' as `0x${string}`),
  DISCOUNT_BUYBACK_ENGINE: ethAddressSchema.optional().default('0x0000000000000000000000000000000000000000' as `0x${string}`)
});

export type ValidatedContractsConfig = z.infer<typeof contractsConfigSchema>;

function loadAndValidateContracts(): ValidatedContractsConfig {
  const rawAddresses = {
    USDC: (contractsJson as any).USDC || import.meta.env.VITE_USDC_ADDRESS,
    USDT: (contractsJson as any).USDT || import.meta.env.VITE_USDT_ADDRESS,
    WBTC: (contractsJson as any).WBTC || import.meta.env.VITE_WBTC_ADDRESS,
    WETH: (contractsJson as any).WETH || import.meta.env.VITE_WETH_ADDRESS,
    TREASURY: (contractsJson as any).TREASURY || import.meta.env.VITE_TREASURY_MANAGER_ADDRESS,
    ALPHA_TOKEN: (contractsJson as any).ALPHA_TOKEN || import.meta.env.VITE_ALPHA_TOKEN_ADDRESS,
    CIRCUIT_BREAKER: (contractsJson as any).CIRCUIT_BREAKER || import.meta.env.VITE_CIRCUIT_BREAKER_ADDRESS,
    POSITION_NFT: (contractsJson as any).POSITION_NFT || import.meta.env.VITE_POSITION_NFT_ADDRESS,
    VESTED_VAULT: (contractsJson as any).VESTED_VAULT || import.meta.env.VITE_VESTED_VAULT_ADDRESS,
    P2P_MARKET: (contractsJson as any).P2P_MARKET || import.meta.env.VITE_P2P_MARKET_ADDRESS,
    STAKING: (contractsJson as any).STAKING || import.meta.env.VITE_STAKING_ADDRESS,
    REAL_YIELD_ROUTER: (contractsJson as any).REAL_YIELD_ROUTER || import.meta.env.VITE_REAL_YIELD_ROUTER_ADDRESS,
    YIELD_VAULT: (contractsJson as any).YIELD_VAULT || import.meta.env.VITE_YIELD_STREAMING_VAULT_ADDRESS || '0x0000000000000000000000000000000000000000',
    COMMUNITY_YIELD_VAULT: (contractsJson as any).COMMUNITY_YIELD_VAULT || import.meta.env.VITE_COMMUNITY_YIELD_VAULT_ADDRESS,
    ALPHA_VAULT: (contractsJson as any).ALPHA_VAULT || '0x0000000000000000000000000000000000000000',
    PRICE_FEED: (contractsJson as any).ORACLE_ROUTER || (contractsJson as any).PRICE_FEED,
    PROMOTIONAL_VAULT: (contractsJson as any).PROMO_VAULT || '0x0000000000000000000000000000000000000000',
    DYNAMIC_YIELD_ORACLE: (contractsJson as any).DYNAMIC_YIELD_ORACLE || '0x0000000000000000000000000000000000000000',
    GOVERNOR: (contractsJson as any).GOVERNOR || '0x0000000000000000000000000000000000000000',
    TIMELOCK: (contractsJson as any).TIMELOCK || '0x0000000000000000000000000000000000000000',
    DISCOUNT_BUYBACK_ENGINE: (contractsJson as any).DISCOUNT_BUYBACK_ENGINE || import.meta.env.VITE_DISCOUNT_BUYBACK_ENGINE_ADDRESS || '0x0000000000000000000000000000000000000000'
  };

  const parsed = contractsConfigSchema.safeParse(rawAddresses);
  if (!parsed.success) {
    console.error('❌ [Alpha Centauri] Contract addresses validation failed:', parsed.error.format());
    throw new Error(`[Contracts] Address validation error: ${parsed.error.message}`);
  }

  return parsed.data;
}

export const VALIDATED_CONTRACT_ADDRESSES = loadAndValidateContracts();
