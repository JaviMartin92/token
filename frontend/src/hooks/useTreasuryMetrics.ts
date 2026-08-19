import { useQuery } from '@tanstack/react-query';
import { publicClient, CONTRACT_ADDRESSES, ABIS } from '../utils/web3.js';
import { formatEther } from 'viem';

export function useTreasuryMetrics(refetchInterval = 3000) {
  const { data: totalBurnedTokens = '0.00' } = useQuery({
    queryKey: ['totalBurnedTokens'],
    queryFn: async () => {
      try {
        const rawBurned = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.TREASURY,
          abi: [{ name: 'totalBurnedTokens', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] }] as const,
          functionName: 'totalBurnedTokens'
        }) as bigint;
        return parseFloat(formatEther(rawBurned)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
      } catch (e) {
        return '0.00';
      }
    },
    refetchInterval
  });

  const { data: protocolOverview = { navValue: '1.00', navPerShareUSD: '$1.0000 USDC', navPerShareNum: 1.0 } } = useQuery({
    queryKey: ['protocolOverview'],
    queryFn: async () => {
      try {
        const overview = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.TREASURY,
          abi: ABIS.TREASURY,
          functionName: 'getProtocolOverview'
        }) as any;

        const navAssetsNum = parseFloat(formatEther(overview.totalAssetsUSD));
        const navPerShareNumVal = parseFloat(formatEther(overview.navPerShareUSD));

        return {
          navValue: navAssetsNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          navPerShareUSD: navPerShareNumVal > 0 ? `$${navPerShareNumVal.toFixed(4)} USDC` : '$1.0000 USDC',
          navPerShareNum: navPerShareNumVal > 0 ? navPerShareNumVal : 1.0
        };
      } catch (e) {
        return { navValue: '1.00', navPerShareUSD: '$1.0000 USDC', navPerShareNum: 1.0 };
      }
    },
    refetchInterval
  });

  const { data: targetWeights = { stables: 50, wbtc: 25, weth: 12.5, alts: 12.5 } } = useQuery({
    queryKey: ['targetWeights'],
    queryFn: async () => {
      try {
        const weights = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.TREASURY,
          abi: ABIS.TREASURY,
          functionName: 'currentWeights'
        }) as readonly [bigint, bigint, bigint, bigint];
        return {
          stables: Number(weights[0]) / 100,
          wbtc: Number(weights[1]) / 100,
          weth: Number(weights[2]) / 100,
          alts: Number(weights[3]) / 100
        };
      } catch (e) {
        return { stables: 50, wbtc: 25, weth: 12.5, alts: 12.5 };
      }
    },
    refetchInterval
  });

  const { data: circuitBreakerFrozen = false } = useQuery({
    queryKey: ['circuitBreakerFrozen'],
    queryFn: async () => {
      try {
        return await publicClient.readContract({
          address: CONTRACT_ADDRESSES.CIRCUIT_BREAKER,
          abi: ABIS.CIRCUIT_BREAKER,
          functionName: 'isFrozen',
          args: [CONTRACT_ADDRESSES.USDC]
        }) as boolean;
      } catch (e) {
        return false;
      }
    },
    refetchInterval
  });

  const { data: assetPrices = { wbtc: 60000.0, weth: 3000.0 } } = useQuery({
    queryKey: ['assetPrices'],
    queryFn: async () => {
      if (!CONTRACT_ADDRESSES.PRICE_FEED) {
        return { wbtc: 60000.0, weth: 3000.0 };
      }
      try {
        const oracleAbi = [
          { name: 'getPriceBase18', type: 'function', stateMutability: 'view', inputs: [{ name: 'asset', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }
        ] as const;

        const wbtcPriceWei = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.PRICE_FEED,
          abi: oracleAbi,
          functionName: 'getPriceBase18',
          args: [CONTRACT_ADDRESSES.WBTC]
        }) as bigint;

        const wethPriceWei = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.PRICE_FEED,
          abi: oracleAbi,
          functionName: 'getPriceBase18',
          args: [CONTRACT_ADDRESSES.WETH]
        }) as bigint;

        return {
          wbtc: parseFloat(formatEther(wbtcPriceWei)) || 60000.0,
          weth: parseFloat(formatEther(wethPriceWei)) || 3000.0
        };
      } catch (e) {
        return { wbtc: 60000.0, weth: 3000.0 };
      }
    },
    refetchInterval
  });

  return {
    totalBurnedTokens,
    navValue: protocolOverview.navValue,
    navPerShareUSD: protocolOverview.navPerShareUSD,
    navPerShareNum: protocolOverview.navPerShareNum,
    targetWeights,
    circuitBreakerFrozen,
    assetPrices
  };
}
