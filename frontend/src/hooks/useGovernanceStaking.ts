import { useQuery } from '@tanstack/react-query';
import { publicClient, CONTRACT_ADDRESSES, ABIS } from '../utils/web3.js';
import { formatEther } from 'viem';

export function useGovernanceStaking(refetchInterval = 3000) {
  const { data: stakingData = { 
    circulatingSupply: '99,500.00', 
    corporateStakedSupply: '0.00', 
    communityStakedSupply: '0.00', 
    treasuryStakedSupply: '0.00', 
    totalStakedSupply: '0.00', 
    stakingRatioPct: '0.00%' 
  } } = useQuery({
    queryKey: ['stakingBreakdown'],
    queryFn: async () => {
      const breakdown = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.STAKING,
        abi: ABIS.STAKING,
        functionName: 'getStakingBreakdown'
      }) as any;

      const communityTotal = breakdown.communityStaked;
      const communityVaultTotal = breakdown.communityVaultStaked;
      const treasuryTotal = breakdown.treasuryStaked;
      const globalLockedTotal = breakdown.globalTotalStaked;
      const netCirculating = breakdown.netCirculatingSupply;

      let stakingRatioPct = '0.00%';
      if (netCirculating > 0n) {
        const ratio = (Number(globalLockedTotal * 10000n / netCirculating) / 100).toFixed(2);
        stakingRatioPct = `${ratio}%`;
      }

      return {
        circulatingSupply: parseFloat(formatEther(netCirculating)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        corporateStakedSupply: parseFloat(formatEther(communityVaultTotal)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        communityStakedSupply: parseFloat(formatEther(communityTotal)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        treasuryStakedSupply: parseFloat(formatEther(treasuryTotal)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        totalStakedSupply: parseFloat(formatEther(globalLockedTotal)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        stakingRatioPct
      };
    },
    refetchInterval
  });

  return stakingData;
}
