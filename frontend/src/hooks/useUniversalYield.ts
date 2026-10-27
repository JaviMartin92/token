import { useQuery } from '@tanstack/react-query';
import { publicClient, CONTRACT_ADDRESSES, ABIS } from '../utils/web3.js';
import { formatEther } from 'viem';

export function useUniversalYield(refetchInterval = 3000) {
  const { data: proofOfReserves = { porAssets: '0.00', porLiabilities: '0.00', porRatio: '100.00%', vestedDebt: '0.00', netEquity: '0.00' } } = useQuery({
    queryKey: ['proofOfReserves'],
    queryFn: async () => {
      try {
        const [res, vestedLiabilityWei] = await Promise.all([
          publicClient.readContract({
            address: CONTRACT_ADDRESSES.TREASURY,
            abi: [
              { name: 'getProofOfReserves', type: 'function', stateMutability: 'view', inputs: [], outputs: [
                { name: 'totalAssetsUSD', type: 'uint256' },
                { name: 'totalLiabilitiesUSD', type: 'uint256' },
                { name: 'collateralRatioBps', type: 'uint256' }
              ]}
            ] as const,
            functionName: 'getProofOfReserves'
          }) as Promise<readonly [bigint, bigint, bigint]>,
          publicClient.readContract({
            address: CONTRACT_ADDRESSES.VESTED_VAULT,
            abi: [{ name: 'totalPresentLiability', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] }],
            functionName: 'totalPresentLiability'
          }).catch(() => 0n) as Promise<bigint>
        ]);

        const assetsVal = parseFloat(formatEther(res[0]));
        const liabilitiesVal = parseFloat(formatEther(res[1]));
        const ratioVal = liabilitiesVal > 0 ? (assetsVal / liabilitiesVal) * 100 : (Number(res[2]) / 100);
        const vestedDebtVal = parseFloat(formatEther(vestedLiabilityWei));
        const netEquityVal = assetsVal > vestedDebtVal ? assetsVal - vestedDebtVal : 0;

        return {
          porAssets: assetsVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          porLiabilities: liabilitiesVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          porRatio: `${ratioVal.toFixed(2)}%`,
          vestedDebt: vestedDebtVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          netEquity: netEquityVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        };
      } catch (e) {
        return { porAssets: '0.00', porLiabilities: '0.00', porRatio: '100.00%', vestedDebt: '0.00', netEquity: '0.00' };
      }
    },
    refetchInterval
  });

  const { data: porBreakdown = { stables: 0, wbtc: 0, weth: 0, alphaStaking: 0 } } = useQuery({
    queryKey: ['porBreakdown'],
    queryFn: async () => {
      try {
        const [breakdown, stakingBreakdown, navPerShareWei] = await Promise.all([
          publicClient.readContract({
            address: CONTRACT_ADDRESSES.TREASURY,
            abi: ABIS.TREASURY,
            functionName: 'getAssetBreakdown'
          }) as Promise<any>,
          publicClient.readContract({
            address: CONTRACT_ADDRESSES.STAKING,
            abi: ABIS.STAKING,
            functionName: 'getStakingBreakdown'
          }) as Promise<any>,
          publicClient.readContract({
            address: CONTRACT_ADDRESSES.TREASURY,
            abi: ABIS.TREASURY,
            functionName: 'getNAVPerShare'
          }) as Promise<bigint>
        ]);

        const stablesWei = Array.isArray(breakdown) ? breakdown[0] : (breakdown?.stablesUsd || 0n);
        const wbtcWei = Array.isArray(breakdown) ? breakdown[1] : (breakdown?.wbtcUsd || 0n);
        const wethWei = Array.isArray(breakdown) ? breakdown[2] : (breakdown?.wethUsd || 0n);

        const rawTuple = Array.isArray(stakingBreakdown) ? stakingBreakdown : stakingBreakdown?.breakdown;
        const treasuryStakedWei = Array.isArray(rawTuple)
          ? (rawTuple[2] ?? 0n)
          : (rawTuple?.treasuryStaked ?? stakingBreakdown?.treasuryStaked ?? 0n);

        const navPerShare = parseFloat(formatEther(navPerShareWei)) || 1.0;
        const alphaStakingUSD = parseFloat(formatEther(treasuryStakedWei)) * navPerShare;

        return {
          stables: parseFloat(formatEther(stablesWei)),
          wbtc: parseFloat(formatEther(wbtcWei)),
          weth: parseFloat(formatEther(wethWei)),
          alphaStaking: alphaStakingUSD
        };
      } catch (e) {
        return { stables: 0, wbtc: 0, weth: 0, alphaStaking: 0 };
      }
    },
    refetchInterval
  });

  const { data: yieldRates = { liveApyStr: '0.00%', assetRates: { stablesApyPct: 0, ethApyPct: 0, btcApyPct: 0 } } } = useQuery({
    queryKey: ['yieldRates', porBreakdown],
    queryFn: async () => {
      if (!CONTRACT_ADDRESSES.DYNAMIC_YIELD_ORACLE) {
        return { liveApyStr: '0.00%', assetRates: { stablesApyPct: 0, ethApyPct: 0, btcApyPct: 0 } };
      }

      try {
        const breakdown = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.TREASURY,
          abi: ABIS.TREASURY,
          functionName: 'getAssetBreakdown'
        }) as any;

        const stablesWei = Array.isArray(breakdown) ? breakdown[0] : (breakdown?.stablesUsd || 0n);
        const wbtcWei = Array.isArray(breakdown) ? breakdown[1] : (breakdown?.wbtcUsd || 0n);
        const wethWei = Array.isArray(breakdown) ? breakdown[2] : (breakdown?.wethUsd || 0n);

        const weightedApyBps = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.DYNAMIC_YIELD_ORACLE,
          abi: ABIS.DYNAMIC_YIELD_ORACLE,
          functionName: 'calculateWeightedYieldBps',
          args: [stablesWei, wbtcWei, wethWei]
        }) as bigint;
        
        const sVault = await publicClient.readContract({ address: CONTRACT_ADDRESSES.DYNAMIC_YIELD_ORACLE, abi: ABIS.DYNAMIC_YIELD_ORACLE, functionName: 'getBestYieldVault', args: [0] }) as any;
        const eVault = await publicClient.readContract({ address: CONTRACT_ADDRESSES.DYNAMIC_YIELD_ORACLE, abi: ABIS.DYNAMIC_YIELD_ORACLE, functionName: 'getBestYieldVault', args: [1] }) as any;
        const bVault = await publicClient.readContract({ address: CONTRACT_ADDRESSES.DYNAMIC_YIELD_ORACLE, abi: ABIS.DYNAMIC_YIELD_ORACLE, functionName: 'getBestYieldVault', args: [2] }) as any;

        const sBps = Number(Array.isArray(sVault) ? sVault[2] : (sVault?.highestApyBps ?? 0));
        const eBps = Number(Array.isArray(eVault) ? eVault[2] : (eVault?.highestApyBps ?? 0));
        const bBps = Number(Array.isArray(bVault) ? bVault[2] : (bVault?.highestApyBps ?? 0));

        const weightedPct = Number(weightedApyBps) > 0 ? (Number(weightedApyBps) / 100).toFixed(2) : '0.00';

        return {
          liveApyStr: `${weightedPct}%`,
          assetRates: {
            stablesApyPct: sBps > 0 ? sBps / 10000 : 0,
            ethApyPct: eBps > 0 ? eBps / 10000 : 0,
            btcApyPct: bBps > 0 ? bBps / 10000 : 0
          }
        };
      } catch (err) {
        console.warn('Yield oracle read fallback:', err);
        return {
          liveApyStr: '0.00%',
          assetRates: {
            stablesApyPct: 0,
            ethApyPct: 0,
            btcApyPct: 0
          }
        };
      }
    },
    enabled: !!CONTRACT_ADDRESSES.DYNAMIC_YIELD_ORACLE,
    refetchInterval
  });

  return {
    porAssets: proofOfReserves.porAssets,
    porLiabilities: proofOfReserves.porLiabilities,
    porRatio: proofOfReserves.porRatio,
    vestedDebt: proofOfReserves.vestedDebt,
    netEquity: proofOfReserves.netEquity,
    porBreakdown,
    liveApyStr: yieldRates.liveApyStr,
    assetRates: yieldRates.assetRates
  };
}
