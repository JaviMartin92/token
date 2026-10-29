import { useQuery } from '@tanstack/react-query';
import { publicClient, CONTRACT_ADDRESSES, ABIS } from '../utils/web3.js';
import { formatEther, formatUnits } from 'viem';
import type { UserPosition } from '../components/VestedVaults.js';

export function useUserPortfolio(userAddress: string | undefined, refetchInterval = 3000) {
  
  const { data: portfolio = { usdcBalance: '0.00', sharesBalance: '0.00', stakedBalance: '0.00', claimableYield: '0.00', userPositions: [] as UserPosition[] } } = useQuery({
    queryKey: ['userPortfolio', userAddress],
    queryFn: async () => {
      if (!userAddress) return { usdcBalance: '0.00', sharesBalance: '0.00', stakedBalance: '0.00', claimableYield: '0.00', userPositions: [] };

      const targetAddr = userAddress as `0x${string}`;
      
      let usdcBalance = '0.00';
      let sharesBalance = '0.00';
      let stakedBalance = '0.00';
      let claimableYield = '0.00';
      const userPositions: UserPosition[] = [];

      try {
        const usdc = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.USDC,
          abi: ABIS.ERC20,
          functionName: 'balanceOf',
          args: [targetAddr]
        }) as bigint;
        usdcBalance = parseFloat(formatUnits(usdc, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } catch (e) {}

      try {
        const shares = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.ALPHA_TOKEN,
          abi: ABIS.ERC20,
          functionName: 'balanceOf',
          args: [targetAddr]
        }) as bigint;
        sharesBalance = parseFloat(formatEther(shares)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } catch (e) {}

      try {
        const staked = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.STAKING,
          abi: ABIS.STAKING,
          functionName: 'stakedBalances',
          args: [targetAddr]
        }) as bigint;
        stakedBalance = parseFloat(formatEther(staked)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const earnedYield = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.STAKING,
          abi: ABIS.STAKING,
          functionName: 'earned',
          args: [targetAddr]
        }) as bigint;
        claimableYield = parseFloat(formatUnits(earnedYield, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } catch (e) {}

      try {
        const currentBlock = await publicClient.getBlock();
        const currentSec = Number(currentBlock.timestamp);

        let maxTokens = 50;
        try {
          const nextTokenId = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.POSITION_NFT,
            abi: ABIS.POSITION_NFT,
            functionName: 'nextTokenId'
          }) as bigint;
          maxTokens = Number(nextTokenId);
        } catch (e) {}

        const tokenIds = Array.from({ length: Math.max(0, maxTokens - 1) }, (_, idx) => BigInt(idx + 1));
        if (tokenIds.length > 0) {
          const ownerCalls = tokenIds.map(id => ({
            address: CONTRACT_ADDRESSES.POSITION_NFT,
            abi: [{ name: 'ownerOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] }] as const,
            functionName: 'ownerOf',
            args: [id]
          }));

          const ownerResults: readonly any[] = await publicClient.multicall({ contracts: ownerCalls as any }).catch(async () => {
            return await Promise.all(ownerCalls.map(c => publicClient.readContract(c as any).then(result => ({ status: 'success', result })).catch(() => ({ status: 'failure', error: null }))));
          });

          const matchingIds: bigint[] = [];
          ownerResults.forEach((res: any, idx: number) => {
            if (res.status === 'success' && typeof res.result === 'string' && res.result.toLowerCase() === targetAddr.toLowerCase()) {
              matchingIds.push(tokenIds[idx]);
            }
          });

          if (matchingIds.length > 0) {
            const posCalls = matchingIds.map(id => ({
              address: CONTRACT_ADDRESSES.POSITION_NFT,
              abi: ABIS.POSITION_NFT,
              functionName: 'getPosition' as const,
              args: [id]
            }));

            const posResults: readonly any[] = await publicClient.multicall({ contracts: posCalls as any }).catch(async () => {
              return await Promise.all(posCalls.map(c => publicClient.readContract(c as any).then(result => ({ status: 'success', result })).catch(() => ({ status: 'failure', error: null }))));
            });

            posResults.forEach((res: any, idx: number) => {
              if (res.status === 'success' && res.result) {
                const pos = res.result as any;
                const i = Number(matchingIds[idx]);
                const principalWei = pos.principalAmount ?? (Array.isArray(pos) ? pos[7] : 0n);
                const paidWei = pos.discountedPricePaid ?? (Array.isArray(pos) ? pos[8] : 0n);
                const expSec = Number(pos.expirationTimestamp ?? (Array.isArray(pos) ? pos[4] : 0));
                const lockYearsVal = (pos.lockYears ?? (Array.isArray(pos) ? pos[3] : 1)).toString();
                const isRagequitted = Boolean(pos.isRagequitted ?? (Array.isArray(pos) ? pos[5] : false));
                const isMaturedClaimed = Boolean(pos.isMaturedClaimed ?? (Array.isArray(pos) ? pos[6] : false));

                const isExpired = currentSec >= expSec;
                userPositions.push({
                  id: i,
                  principal: parseFloat(formatUnits(BigInt(principalWei), 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                  paid: parseFloat(formatUnits(BigInt(paidWei), 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                  expirationTimestamp: expSec,
                  expDateStr: new Date(expSec * 1000).toLocaleDateString('es-ES'),
                  lockYears: lockYearsVal,
                  isRagequitted,
                  isMaturedClaimed,
                  canClaim: isExpired && !isRagequitted && !isMaturedClaimed
                });
              }
            });
          }
        }
      } catch (e) {}

      return {
        usdcBalance,
        sharesBalance,
        stakedBalance,
        claimableYield,
        userPositions
      };
    },
    refetchInterval
  });

  return portfolio;
}
