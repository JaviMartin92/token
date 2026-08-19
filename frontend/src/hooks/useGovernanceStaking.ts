import { useQuery } from '@tanstack/react-query';
import { publicClient, CONTRACT_ADDRESSES, ABIS } from '../utils/web3.js';
import { queryKeys } from '../constants/queryKeys.js';
import { formatEther } from 'viem';

export function useGovernanceStaking(refetchInterval = 3000) {
  const { data: stakingData = { 
    circulatingSupply: '0.00', 
    communityVaultStakedSupply: '0.00', 
    communityStakedSupply: '0.00', 
    treasuryStakedSupply: '0.00', 
    totalStakedSupply: '0.00', 
    totalBurnedTokens: '0.00',
    stakingRatioPct: '0.00%' 
  } } = useQuery({
    queryKey: queryKeys.staking.breakdown(),
    queryFn: async () => {
      try {
        const breakdown = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.STAKING,
          abi: ABIS.STAKING,
          functionName: 'getStakingBreakdown'
        }) as any;

        const isObj = breakdown && typeof breakdown === 'object';
        const communityTotal = isObj ? (breakdown.communityStaked ?? breakdown[0] ?? 0n) : 0n;
        const communityVaultTotal = isObj ? (breakdown.communityVaultStaked ?? breakdown[1] ?? 0n) : 0n;
        const treasuryTotal = isObj ? (breakdown.treasuryStaked ?? breakdown[2] ?? 0n) : 0n;
        const globalLockedTotal = isObj ? (breakdown.globalTotalStaked ?? breakdown[3] ?? 0n) : 0n;
        const netCirculating = isObj ? (breakdown.netCirculatingSupply ?? breakdown[4] ?? 0n) : 0n;
        const totalBurned = isObj ? (breakdown.totalBurned ?? breakdown[5] ?? 0n) : 0n;

        let stakingRatioPct = '0.00%';
        if (netCirculating > 0n) {
          const ratio = (Number(globalLockedTotal * 10000n / netCirculating) / 100).toFixed(2);
          stakingRatioPct = `${ratio}%`;
        }

        return {
          circulatingSupply: parseFloat(formatEther(netCirculating)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          communityVaultStakedSupply: parseFloat(formatEther(communityVaultTotal)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          communityStakedSupply: parseFloat(formatEther(communityTotal)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          treasuryStakedSupply: parseFloat(formatEther(treasuryTotal)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          totalStakedSupply: parseFloat(formatEther(globalLockedTotal)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          totalBurnedTokens: parseFloat(formatEther(totalBurned)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          stakingRatioPct
        };
      } catch (e) {
        return { 
          circulatingSupply: '0.00', 
          communityVaultStakedSupply: '0.00', 
          communityStakedSupply: '0.00', 
          treasuryStakedSupply: '0.00', 
          totalStakedSupply: '0.00', 
          totalBurnedTokens: '0.00',
          stakingRatioPct: '0.00%' 
        };
      }
    },
    refetchInterval
  });

  return stakingData;
}
